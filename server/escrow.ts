import express from 'express';
import crypto from 'crypto';
import { cashfreeServer } from './cashfree.js';
import { IS_PRODUCTION } from './security.js';
import {
  getSupabaseClient,
  findSupabaseBookingById,
  findSupabaseUserById,
  upsertSupabaseRecords,
  verifyAdminTokenFromReq,
  verifyUserTokenFromReq,
  isCsrfSafeMutation,
  type UserSessionInfo
} from './supabase.js';

export type FleetKycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type EscrowState =
  | 'AWAITING_PAYMENT'
  | 'FUNDED_LOCKED'
  | 'ADVANCE_70_RELEASED'
  | 'DISPUTE_HOLD'
  | 'FULLY_SETTLED'
  | 'REFUNDED';

export type TrancheType = 'ADVANCE_70' | 'BALANCE_30';

export type TrancheStatus =
  | 'LOCKED'
  | 'QUEUED_FOR_RELEASE'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED';

export interface FleetVendorRecord {
  id: string;
  user_id: string;
  external_user_id: string;
  cashfree_vendor_id: string;
  kyc_status: FleetKycStatus;
  bank_account_last4?: string | null;
  upi_id?: string | null;
  vendor_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface TripEscrowLedgerRecord {
  id: string;
  trip_id: string;
  external_trip_id: string;
  shipper_id: string;
  external_shipper_id: string;
  vendor_id: string;
  cashfree_vendor_id: string;
  cashfree_order_id: string;
  cf_payment_id?: string | null;
  payment_session_id?: string | null;
  is_simulated?: boolean;
  total_freight_inr: number;
  platform_fee_inr: number;
  platform_base_fee_inr: number;
  platform_gst_inr: number;
  net_vendor_payable_inr: number;
  advance_70_amount: number;
  balance_30_amount: number;
  escrow_state: EscrowState;
  dispute_reason?: string | null;
  dispute_raised_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowPayoutTrancheRecord {
  id: string;
  ledger_id: string;
  trip_id: string;
  external_trip_id: string;
  tranche_type: TrancheType;
  amount_inr: number;
  idempotency_key: string;
  cashfree_split_ref_id?: string | null;
  status: TrancheStatus;
  scheduled_release_at?: string | null;
  released_at?: string | null;
  failure_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EscrowSplitBreakdown {
  totalFreightPaise: number;
  basePlatformFeePaise: number;
  gstOnFeePaise: number;
  platformFeePaise: number;
  netVendorPayablePaise: number;
  advance70Paise: number;
  balance30Paise: number;
  totalFreightInr: number;
  basePlatformFeeInr: number;
  gstOnFeeInr: number;
  platformFeeInr: number;
  netVendorPayableInr: number;
  advance70Inr: number;
  balance30Inr: number;
  platformFeeRate: number;
  commissionGstRate: number;
}

const DEFAULT_FEE_RATE = 0.05; // 5% platform commission
const DEFAULT_GST_RATE = 0.18; // 18% GST on commission
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getConfiguredFeeRates(): { feeRate: number; gstRate: number } {
  const envFee = Number(process.env.ESCROW_PLATFORM_FEE_RATE);
  const envGst = Number(process.env.ESCROW_COMMISSION_GST_RATE);
  const feeRate = Number.isFinite(envFee) && envFee >= 0 && envFee <= 0.3 ? envFee : DEFAULT_FEE_RATE;
  const gstRate = Number.isFinite(envGst) && envGst >= 0 && envGst <= 0.3 ? envGst : DEFAULT_GST_RATE;
  return { feeRate, gstRate };
}

/**
 * Exact integer-paise financial calculation (zero floating-point drift).
 * Guarantees:
 *   platformFeePaise = basePlatformFeePaise + gstOnFeePaise
 *   netVendorPayablePaise = totalFreightPaise - platformFeePaise
 *   advance70Paise + balance30Paise === netVendorPayablePaise
 */
export function computeEscrow7030SplitPaise(
  totalFreightInr: number,
  feeRateOverride?: number,
  gstRateOverride?: number
): EscrowSplitBreakdown {
  if (!Number.isFinite(totalFreightInr) || totalFreightInr <= 0) {
    throw new Error('totalFreightInr must be a positive finite number.');
  }

  const configured = getConfiguredFeeRates();
  const platformFeeRate =
    feeRateOverride !== undefined && Number.isFinite(feeRateOverride) && feeRateOverride >= 0 && feeRateOverride <= 0.3
      ? feeRateOverride
      : configured.feeRate;
  const commissionGstRate =
    gstRateOverride !== undefined && Number.isFinite(gstRateOverride) && gstRateOverride >= 0 && gstRateOverride <= 0.3
      ? gstRateOverride
      : configured.gstRate;

  const totalFreightPaise = Math.round(totalFreightInr * 100);
  const basePlatformFeePaise = Math.round(totalFreightPaise * platformFeeRate);
  const gstOnFeePaise = Math.round(basePlatformFeePaise * commissionGstRate);
  const platformFeePaise = basePlatformFeePaise + gstOnFeePaise;
  const netVendorPayablePaise = Math.max(0, totalFreightPaise - platformFeePaise);
  const advance70Paise = Math.round(netVendorPayablePaise * 0.7);
  const balance30Paise = netVendorPayablePaise - advance70Paise;

  return {
    totalFreightPaise,
    basePlatformFeePaise,
    gstOnFeePaise,
    platformFeePaise,
    netVendorPayablePaise,
    advance70Paise,
    balance30Paise,
    totalFreightInr: totalFreightPaise / 100,
    basePlatformFeeInr: basePlatformFeePaise / 100,
    gstOnFeeInr: gstOnFeePaise / 100,
    platformFeeInr: platformFeePaise / 100,
    netVendorPayableInr: netVendorPayablePaise / 100,
    advance70Inr: advance70Paise / 100,
    balance30Inr: balance30Paise / 100,
    platformFeeRate,
    commissionGstRate
  };
}

/**
 * Deterministically converts any non-UUID string (e.g. booking_123 / user_driver_...)
 * into a RFC-4122 v5-compatible UUID so Supabase PostgreSQL UUID columns work seamlessly.
 */
export function toDeterministicUuid(rawId: string): string {
  const clean = String(rawId || '').trim();
  if (UUID_REGEX.test(clean)) return clean.toLowerCase();
  const hash = crypto.createHash('sha256').update(`zuggi:escrow:uuid:v1:${clean}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.slice(18, 20)}`,
    hash.slice(20, 32)
  ].join('-');
}

function sanitizeId(raw: unknown, maxLen = 96): string {
  return String(raw || '').trim().slice(0, maxLen);
}

function buildCashfreeVendorId(userId: string): string {
  const safe = String(userId || 'partner')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 38);
  return `vnd_${safe}`;
}

function buildCashfreeOrderId(tripId: string): string {
  const safeTrip = String(tripId || 'trip')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 26);
  const suffix = crypto.randomBytes(4).toString('hex');
  return `zgesc_${safeTrip}_${suffix}`.slice(0, 50);
}

// ============================================================================
// Dual-Layer Persistence: Native Supabase PostgreSQL Tables + Resilient Fallback
// ============================================================================

const memoryVendorsByExternalUserId = new Map<string, FleetVendorRecord>();
const memoryVendorsById = new Map<string, FleetVendorRecord>();
const memoryLedgersByTripId = new Map<string, TripEscrowLedgerRecord>();
const memoryLedgersByOrderId = new Map<string, TripEscrowLedgerRecord>();
const memoryTranchesByTripId = new Map<string, EscrowPayoutTrancheRecord[]>();
const memoryTranchesByIdempotencyKey = new Map<string, EscrowPayoutTrancheRecord>();

// Per-tranche mutex prevents concurrent double-payout races
const inFlightTrancheLocks = new Map<string, Promise<any>>();

async function withIdempotencyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightTrancheLocks.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const run = fn().finally(() => {
    if (inFlightTrancheLocks.get(key) === run) {
      inFlightTrancheLocks.delete(key);
    }
  });
  inFlightTrancheLocks.set(key, run);
  return run;
}

let nativeTablesAvailable: boolean | null = null;
let nativeTablesCheckedAt = 0;

function isMissingTableError(error: any): boolean {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

async function checkNativeEscrowTables(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const now = Date.now();
  if (nativeTablesAvailable !== null && now - nativeTablesCheckedAt < 60_000) {
    return nativeTablesAvailable;
  }
  try {
    const { error } = await client.from('trip_escrow_ledger').select('id').limit(1);
    if (error && isMissingTableError(error)) {
      nativeTablesAvailable = false;
    } else {
      nativeTablesAvailable = !error;
    }
  } catch {
    nativeTablesAvailable = false;
  }
  nativeTablesCheckedAt = now;
  return nativeTablesAvailable;
}

function storeVendorInMemory(v: FleetVendorRecord): void {
  memoryVendorsByExternalUserId.set(v.external_user_id, v);
  memoryVendorsByExternalUserId.set(v.user_id, v);
  memoryVendorsById.set(v.id, v);
}

function storeLedgerInMemory(ledger: TripEscrowLedgerRecord): void {
  memoryLedgersByTripId.set(ledger.external_trip_id, ledger);
  memoryLedgersByTripId.set(ledger.trip_id, ledger);
  if (ledger.cashfree_order_id) {
    memoryLedgersByOrderId.set(ledger.cashfree_order_id, ledger);
  }
}

function storeTranchesInMemory(externalTripId: string, tripUuid: string, tranches: EscrowPayoutTrancheRecord[]): void {
  const sorted = [...tranches].sort((a, b) => (a.tranche_type === 'ADVANCE_70' ? -1 : b.tranche_type === 'ADVANCE_70' ? 1 : 0));
  memoryTranchesByTripId.set(externalTripId, sorted);
  memoryTranchesByTripId.set(tripUuid, sorted);
  for (const t of sorted) {
    memoryTranchesByIdempotencyKey.set(t.idempotency_key, t);
  }
}

async function mirrorEscrowSnapshotToBooking(
  externalTripId: string,
  ledger: TripEscrowLedgerRecord,
  tranches: EscrowPayoutTrancheRecord[],
  extraBookingPatch?: Record<string, any>
): Promise<void> {
  try {
    const booking = await findSupabaseBookingById(externalTripId);
    if (!booking) return;
    const updatedBooking = {
      ...booking,
      ...(extraBookingPatch || {}),
      escrow7030: {
        ledger,
        tranches,
        updatedAt: new Date().toISOString()
      }
    };
    await upsertSupabaseRecords('vs_bookings', [updatedBooking]);
  } catch {
    // Non-fatal mirror failure; ledger remains authoritative in native table / server memory
  }
}

async function ensureNativeTripRow(tripUuid: string, externalTripId: string, shipperUuid: string, booking: any): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('trips').upsert(
      {
        id: tripUuid,
        external_trip_id: externalTripId,
        shipper_id: shipperUuid,
        status: String(booking?.status || 'assigned'),
        total_freight_inr: Number(booking?.finalPrice || booking?.amount || 0),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );
  } catch {
    // Best-effort parent trip row sync
  }
}

async function findFleetVendorByUserId(userId: string): Promise<FleetVendorRecord | null> {
  const cleanId = sanitizeId(userId);
  if (!cleanId) return null;

  const mem = memoryVendorsByExternalUserId.get(cleanId);
  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const userUuid = toDeterministicUuid(cleanId);
      const { data, error } = await client
        .from('fleet_vendors')
        .select('*')
        .or(`external_user_id.eq.${cleanId},user_id.eq.${userUuid}`)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const record: FleetVendorRecord = {
          id: String(data.id),
          user_id: String(data.user_id),
          external_user_id: String(data.external_user_id || cleanId),
          cashfree_vendor_id: String(data.cashfree_vendor_id),
          kyc_status: data.kyc_status as FleetKycStatus,
          bank_account_last4: data.bank_account_last4 ?? null,
          upi_id: data.upi_id ?? null,
          created_at: String(data.created_at || new Date().toISOString()),
          updated_at: data.updated_at ? String(data.updated_at) : undefined
        };
        storeVendorInMemory(record);
        return record;
      }
    }
  }
  return mem || null;
}

async function upsertFleetVendor(record: FleetVendorRecord): Promise<FleetVendorRecord> {
  storeVendorInMemory(record);
  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from('fleet_vendors').upsert(
        {
          id: record.id,
          user_id: record.user_id,
          external_user_id: record.external_user_id,
          cashfree_vendor_id: record.cashfree_vendor_id,
          kyc_status: record.kyc_status,
          bank_account_last4: record.bank_account_last4 ?? null,
          upi_id: record.upi_id ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'cashfree_vendor_id' }
      );
      if (error && isMissingTableError(error)) {
        nativeTablesAvailable = false;
      }
    }
  }
  return record;
}

async function resolveOrProvisionVerifiedVendor(
  driverUserId: string,
  fallbackDriverDetails?: { name?: string; phone?: string; email?: string; upiId?: string; bankAccountLast4?: string; cashfreeVendorId?: string; kycStatus?: FleetKycStatus }
): Promise<FleetVendorRecord | null> {
  const existing = await findFleetVendorByUserId(driverUserId);
  if (existing) return existing;

  // Inspect existing platform user profile (vs_users) to honor KYC verification status
  const userDoc = await findSupabaseUserById(driverUserId);
  const now = new Date().toISOString();

  if (userDoc) {
    const isVerified = Boolean(
      userDoc.isVerified ||
        userDoc.kycStatus === 'VERIFIED' ||
        userDoc.kycVerified ||
        userDoc.verificationStatus === 'verified' ||
        userDoc.cashfreeVendorId ||
        (!IS_PRODUCTION && userDoc.role && userDoc.role !== 'customer')
    );
    const kycStatus: FleetKycStatus =
      userDoc.kycStatus === 'REJECTED' ? 'REJECTED' : isVerified ? 'VERIFIED' : 'PENDING';
    const rawBank = String(userDoc.bankAccountNumber || userDoc.bankDetails?.accountNumber || '').replace(/\D/g, '');
    const record: FleetVendorRecord = {
      id: toDeterministicUuid(`vendor:${driverUserId}`),
      user_id: toDeterministicUuid(driverUserId),
      external_user_id: driverUserId,
      cashfree_vendor_id: sanitizeId(userDoc.cashfreeVendorId || fallbackDriverDetails?.cashfreeVendorId || buildCashfreeVendorId(driverUserId), 50),
      kyc_status: kycStatus,
      bank_account_last4: rawBank ? rawBank.slice(-4) : fallbackDriverDetails?.bankAccountLast4 || null,
      upi_id: userDoc.upiId || userDoc.bankDetails?.upiId || fallbackDriverDetails?.upiId || null,
      vendor_name: userDoc.name || fallbackDriverDetails?.name || 'Fleet Partner',
      created_at: now,
      updated_at: now
    };
    return upsertFleetVendor(record);
  }

  // In non-production sandbox testing, allow explicit fallback KYC metadata if provided
  if (!IS_PRODUCTION && fallbackDriverDetails?.kycStatus) {
    const record: FleetVendorRecord = {
      id: toDeterministicUuid(`vendor:${driverUserId}`),
      user_id: toDeterministicUuid(driverUserId),
      external_user_id: driverUserId,
      cashfree_vendor_id: sanitizeId(fallbackDriverDetails.cashfreeVendorId || buildCashfreeVendorId(driverUserId), 50),
      kyc_status: fallbackDriverDetails.kycStatus,
      bank_account_last4: fallbackDriverDetails.bankAccountLast4 || '4821',
      upi_id: fallbackDriverDetails.upiId || `${driverUserId.slice(-6)}@okaxis`,
      vendor_name: fallbackDriverDetails.name || 'Verified Fleet Partner',
      created_at: now,
      updated_at: now
    };
    return upsertFleetVendor(record);
  }

  return null;
}

async function findLedgerAndTranchesByTripId(
  tripId: string
): Promise<{ ledger: TripEscrowLedgerRecord; tranches: EscrowPayoutTrancheRecord[] } | null> {
  const cleanId = sanitizeId(tripId);
  if (!cleanId) return null;

  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const tripUuid = toDeterministicUuid(cleanId);
      const { data: ledgerRow, error } = await client
        .from('trip_escrow_ledger')
        .select('*')
        .or(`external_trip_id.eq.${cleanId},trip_id.eq.${tripUuid}`)
        .limit(1)
        .maybeSingle();
      if (!error && ledgerRow) {
        const { data: trancheRows } = await client
          .from('escrow_payout_tranches')
          .select('*')
          .eq('ledger_id', ledgerRow.id);

        const memLedger = memoryLedgersByTripId.get(cleanId);
        const ledger = normalizeLedgerRow(ledgerRow, memLedger);
        const tranches = (trancheRows || []).map((r: any) => normalizeTrancheRow(r, ledger.external_trip_id));
        storeLedgerInMemory(ledger);
        storeTranchesInMemory(ledger.external_trip_id, ledger.trip_id, tranches);
        return { ledger, tranches };
      }
    }
  }

  const memLedger = memoryLedgersByTripId.get(cleanId);
  if (memLedger) {
    const memTranches = memoryTranchesByTripId.get(memLedger.external_trip_id) || [];
    return { ledger: memLedger, tranches: memTranches };
  }

  // Hydrate from mirrored booking record in Supabase if server restarted before SQL migration ran
  const booking = await findSupabaseBookingById(cleanId);
  if (booking?.escrow7030?.ledger && Array.isArray(booking?.escrow7030?.tranches)) {
    const ledger = booking.escrow7030.ledger as TripEscrowLedgerRecord;
    const tranches = booking.escrow7030.tranches as EscrowPayoutTrancheRecord[];
    storeLedgerInMemory(ledger);
    storeTranchesInMemory(ledger.external_trip_id, ledger.trip_id, tranches);
    return { ledger, tranches };
  }

  return null;
}

async function findLedgerAndTranchesByOrderId(
  orderId: string
): Promise<{ ledger: TripEscrowLedgerRecord; tranches: EscrowPayoutTrancheRecord[] } | null> {
  const cleanOrderId = sanitizeId(orderId);
  if (!cleanOrderId) return null;

  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { data: ledgerRow, error } = await client
        .from('trip_escrow_ledger')
        .select('*')
        .eq('cashfree_order_id', cleanOrderId)
        .limit(1)
        .maybeSingle();
      if (!error && ledgerRow) {
        const { data: trancheRows } = await client
          .from('escrow_payout_tranches')
          .select('*')
          .eq('ledger_id', ledgerRow.id);
        const memLedger = memoryLedgersByOrderId.get(cleanOrderId);
        const ledger = normalizeLedgerRow(ledgerRow, memLedger);
        const tranches = (trancheRows || []).map((r: any) => normalizeTrancheRow(r, ledger.external_trip_id));
        storeLedgerInMemory(ledger);
        storeTranchesInMemory(ledger.external_trip_id, ledger.trip_id, tranches);
        return { ledger, tranches };
      }
    }
  }

  const memLedger = memoryLedgersByOrderId.get(cleanOrderId);
  if (memLedger) {
    const memTranches = memoryTranchesByTripId.get(memLedger.external_trip_id) || [];
    return { ledger: memLedger, tranches: memTranches };
  }
  return null;
}

function normalizeLedgerRow(row: any, memFallback?: TripEscrowLedgerRecord): TripEscrowLedgerRecord {
  const total = Number(row.total_freight_inr || 0);
  const fee = Number(row.platform_fee_inr || 0);
  const net = Number(row.net_vendor_payable_inr || 0);
  const split = total > 0 ? computeEscrow7030SplitPaise(total) : null;
  return {
    id: String(row.id),
    trip_id: String(row.trip_id),
    external_trip_id: String(row.external_trip_id || row.trip_id),
    shipper_id: String(row.shipper_id),
    external_shipper_id: String(row.external_shipper_id || row.shipper_id),
    vendor_id: String(row.vendor_id),
    cashfree_vendor_id: String(memFallback?.cashfree_vendor_id || row.cashfree_vendor_id || ''),
    cashfree_order_id: String(row.cashfree_order_id || ''),
    cf_payment_id: row.cf_payment_id ?? null,
    payment_session_id: memFallback?.payment_session_id ?? row.payment_session_id ?? null,
    is_simulated: memFallback?.is_simulated ?? false,
    total_freight_inr: total,
    platform_fee_inr: fee,
    platform_base_fee_inr: memFallback?.platform_base_fee_inr ?? split?.basePlatformFeeInr ?? fee,
    platform_gst_inr: memFallback?.platform_gst_inr ?? split?.gstOnFeeInr ?? 0,
    net_vendor_payable_inr: net,
    advance_70_amount: Number(row.advance_70_amount || 0),
    balance_30_amount: Number(row.balance_30_amount || 0),
    escrow_state: row.escrow_state as EscrowState,
    dispute_reason: row.dispute_reason ?? null,
    dispute_raised_at: row.dispute_raised_at ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString())
  };
}

function normalizeTrancheRow(row: any, externalTripId: string): EscrowPayoutTrancheRecord {
  return {
    id: String(row.id),
    ledger_id: String(row.ledger_id),
    trip_id: String(row.trip_id),
    external_trip_id: String(row.external_trip_id || externalTripId),
    tranche_type: row.tranche_type as TrancheType,
    amount_inr: Number(row.amount_inr || 0),
    idempotency_key: String(row.idempotency_key),
    cashfree_split_ref_id: row.cashfree_split_ref_id ?? null,
    status: row.status as TrancheStatus,
    scheduled_release_at: row.scheduled_release_at ?? null,
    released_at: row.released_at ?? null,
    failure_reason: row.failure_reason ?? null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  };
}

async function persistLedgerAndTranches(
  ledger: TripEscrowLedgerRecord,
  tranches: EscrowPayoutTrancheRecord[],
  extraBookingPatch?: Record<string, any>
): Promise<void> {
  ledger.updated_at = new Date().toISOString();
  storeLedgerInMemory(ledger);
  storeTranchesInMemory(ledger.external_trip_id, ledger.trip_id, tranches);

  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { error: ledgerErr } = await client.from('trip_escrow_ledger').upsert(
        {
          id: ledger.id,
          trip_id: ledger.trip_id,
          external_trip_id: ledger.external_trip_id,
          shipper_id: ledger.shipper_id,
          external_shipper_id: ledger.external_shipper_id,
          vendor_id: ledger.vendor_id,
          cashfree_order_id: ledger.cashfree_order_id,
          cf_payment_id: ledger.cf_payment_id ?? null,
          total_freight_inr: ledger.total_freight_inr,
          platform_fee_inr: ledger.platform_fee_inr,
          net_vendor_payable_inr: ledger.net_vendor_payable_inr,
          advance_70_amount: ledger.advance_70_amount,
          balance_30_amount: ledger.balance_30_amount,
          escrow_state: ledger.escrow_state,
          dispute_reason: ledger.dispute_reason ?? null,
          dispute_raised_at: ledger.dispute_raised_at ?? null,
          updated_at: ledger.updated_at
        },
        { onConflict: 'id' }
      );
      if (ledgerErr && isMissingTableError(ledgerErr)) {
        nativeTablesAvailable = false;
      } else if (!ledgerErr) {
        const tranchePayload = tranches.map((t) => ({
          id: t.id,
          ledger_id: t.ledger_id,
          trip_id: t.trip_id,
          tranche_type: t.tranche_type,
          amount_inr: t.amount_inr,
          idempotency_key: t.idempotency_key,
          cashfree_split_ref_id: t.cashfree_split_ref_id ?? null,
          status: t.status,
          scheduled_release_at: t.scheduled_release_at ?? null,
          released_at: t.released_at ?? null,
          failure_reason: t.failure_reason ?? null,
          updated_at: new Date().toISOString()
        }));
        await client.from('escrow_payout_tranches').upsert(tranchePayload, { onConflict: 'idempotency_key' });
      }
    }
  }

  await mirrorEscrowSnapshotToBooking(ledger.external_trip_id, ledger, tranches, extraBookingPatch);
}

// ============================================================================
// Authorization Helper
// ============================================================================

function requireAuthenticatedCaller(req: express.Request, res: express.Response): {
  isAdmin: boolean;
  session: UserSessionInfo | null;
} | null {
  if (req.method !== 'GET' && !isCsrfSafeMutation(req)) {
    res.status(403).json({ success: false, message: 'Forbidden cross-site mutation request.' });
    return null;
  }
  const isAdmin = verifyAdminTokenFromReq(req);
  const session = isAdmin ? null : verifyUserTokenFromReq(req);
  if (!isAdmin && !session) {
    res.status(401).json({ success: false, message: 'Authentication required for escrow operations.' });
    return null;
  }
  return { isAdmin, session };
}

function isShipperForLedger(session: UserSessionInfo | null, ledger: TripEscrowLedgerRecord): boolean {
  if (!session) return false;
  return (
    session.userId === ledger.external_shipper_id ||
    toDeterministicUuid(session.userId) === ledger.shipper_id
  );
}

async function isVendorForLedger(session: UserSessionInfo | null, ledger: TripEscrowLedgerRecord): Promise<boolean> {
  if (!session) return false;
  const vendor = await findFleetVendorByUserId(session.userId);
  if (vendor && vendor.id === ledger.vendor_id) return true;
  if (toDeterministicUuid(`vendor:${session.userId}`) === ledger.vendor_id) return true;
  const booking = await findSupabaseBookingById(ledger.external_trip_id);
  if (booking && (booking.driverId === session.userId || booking.ownerId === session.userId)) return true;
  return false;
}

// ============================================================================
// Core State Transition Helpers (Used by Endpoints, Webhooks, and Cron Worker)
// ============================================================================

async function markEscrowOrderFunded(
  ledger: TripEscrowLedgerRecord,
  tranches: EscrowPayoutTrancheRecord[],
  cfPaymentId: string
): Promise<{ ledger: TripEscrowLedgerRecord; tranches: EscrowPayoutTrancheRecord[] }> {
  if (ledger.escrow_state !== 'AWAITING_PAYMENT') {
    return { ledger, tranches };
  }
  ledger.escrow_state = 'FUNDED_LOCKED';
  ledger.cf_payment_id = cfPaymentId;
  await persistLedgerAndTranches(ledger, tranches, {
    paymentStatus: 'escrow_funded',
    escrowFundedAt: new Date().toISOString(),
    paymentVerifiedByGateway: true,
    cashfreeOrderId: ledger.cashfree_order_id,
    cfPaymentId
  });
  return { ledger, tranches };
}

async function executeTrancheRelease(
  ledger: TripEscrowLedgerRecord,
  tranches: EscrowPayoutTrancheRecord[],
  trancheType: TrancheType,
  remarks: string
): Promise<{
  ok: boolean;
  idempotentReplay: boolean;
  statusCode: number;
  message: string;
  ledger: TripEscrowLedgerRecord;
  tranches: EscrowPayoutTrancheRecord[];
  tranche: EscrowPayoutTrancheRecord;
}> {
  const tranche = tranches.find((t) => t.tranche_type === trancheType);
  if (!tranche) {
    return {
      ok: false,
      idempotentReplay: false,
      statusCode: 404,
      message: `${trancheType} payout tranche not found for trip.`,
      ledger,
      tranches,
      tranche: tranches[0]
    };
  }

  return withIdempotencyLock(tranche.idempotency_key, async () => {
    // Re-read freshest state inside lock to avoid stale reads
    const latest = await findLedgerAndTranchesByTripId(ledger.external_trip_id);
    const activeLedger = latest?.ledger || ledger;
    const activeTranches = latest?.tranches || tranches;
    const activeTranche = activeTranches.find((t) => t.tranche_type === trancheType) || tranche;

    // Idempotent replay: already processing or settled
    if (activeTranche.status === 'PROCESSING' || activeTranche.status === 'SETTLED') {
      return {
        ok: true,
        idempotentReplay: true,
        statusCode: 200,
        message: `${trancheType} tranche already ${activeTranche.status.toLowerCase()}.`,
        ledger: activeLedger,
        tranches: activeTranches,
        tranche: activeTranche
      };
    }

    // Strict state machine guards
    if (activeLedger.escrow_state === 'DISPUTE_HOLD') {
      return {
        ok: false,
        idempotentReplay: false,
        statusCode: 409,
        message: 'Escrow is currently frozen under DISPUTE_HOLD. Release blocked pending admin review.',
        ledger: activeLedger,
        tranches: activeTranches,
        tranche: activeTranche
      };
    }

    if (activeLedger.escrow_state === 'AWAITING_PAYMENT' || activeLedger.escrow_state === 'REFUNDED') {
      return {
        ok: false,
        idempotentReplay: false,
        statusCode: 409,
        message: `Cannot release ${trancheType} while escrow state is ${activeLedger.escrow_state}.`,
        ledger: activeLedger,
        tranches: activeTranches,
        tranche: activeTranche
      };
    }

    if (trancheType === 'ADVANCE_70') {
      if (activeLedger.escrow_state !== 'FUNDED_LOCKED' || activeTranche.status !== 'LOCKED') {
        return {
          ok: false,
          idempotentReplay: false,
          statusCode: 409,
          message: `ADVANCE_70 requires escrow_state=FUNDED_LOCKED and tranche status=LOCKED (current: ${activeLedger.escrow_state} / ${activeTranche.status}).`,
          ledger: activeLedger,
          tranches: activeTranches,
          tranche: activeTranche
        };
      }
    }

    if (trancheType === 'BALANCE_30') {
      if (activeTranche.status !== 'LOCKED' && activeTranche.status !== 'QUEUED_FOR_RELEASE' && activeTranche.status !== 'FAILED') {
        return {
          ok: false,
          idempotentReplay: false,
          statusCode: 409,
          message: `BALANCE_30 cannot be released from status ${activeTranche.status}.`,
          ledger: activeLedger,
          tranches: activeTranches,
          tranche: activeTranche
        };
      }
    }

    const vendor = memoryVendorsById.get(activeLedger.vendor_id);
    const cashfreeVendorId = activeLedger.cashfree_vendor_id || vendor?.cashfree_vendor_id;
    if (!cashfreeVendorId) {
      return {
        ok: false,
        idempotentReplay: false,
        statusCode: 400,
        message: 'Assigned fleet vendor Cashfree Vendor ID is missing.',
        ledger: activeLedger,
        tranches: activeTranches,
        tranche: activeTranche
      };
    }

    const releaseResult = await cashfreeServer.releaseOnDemandSplit({
      orderId: activeLedger.cashfree_order_id,
      vendorId: cashfreeVendorId,
      amountInr: activeTranche.amount_inr,
      idempotencyKey: activeTranche.idempotency_key,
      trancheType,
      remarks
    });

    if (!releaseResult.ok) {
      activeTranche.status = 'FAILED';
      activeTranche.failure_reason = releaseResult.failureReason || 'Gateway rejected split release.';
      await persistLedgerAndTranches(activeLedger, activeTranches);
      return {
        ok: false,
        idempotentReplay: false,
        statusCode: 502,
        message: activeTranche.failure_reason,
        ledger: activeLedger,
        tranches: activeTranches,
        tranche: activeTranche
      };
    }

    const nowIso = new Date().toISOString();
    activeTranche.cashfree_split_ref_id = releaseResult.splitRefId;
    activeTranche.status = releaseResult.status; // PROCESSING or SETTLED
    activeTranche.failure_reason = null;
    if (releaseResult.status === 'SETTLED') {
      activeTranche.released_at = nowIso;
    }

    if (trancheType === 'ADVANCE_70') {
      activeLedger.escrow_state = 'ADVANCE_70_RELEASED';
    } else if (trancheType === 'BALANCE_30') {
      activeLedger.escrow_state = 'FULLY_SETTLED';
    }

    const bookingPatch =
      trancheType === 'BALANCE_30'
        ? { paymentStatus: 'released_to_driver', balanceReleasedAt: nowIso }
        : { advanceReleasedAt: nowIso };

    await persistLedgerAndTranches(activeLedger, activeTranches, bookingPatch);

    return {
      ok: true,
      idempotentReplay: false,
      statusCode: 200,
      message:
        trancheType === 'ADVANCE_70'
          ? `70% loading advance (₹${activeTranche.amount_inr.toLocaleString('en-IN')}) released to fleet vendor.`
          : `30% POD balance (₹${activeTranche.amount_inr.toLocaleString('en-IN')}) released to fleet vendor.`,
      ledger: activeLedger,
      tranches: activeTranches,
      tranche: activeTranche
    };
  });
}

// ============================================================================
// Scheduled Cron Job: Auto-Release Due 30% POD Balances (2-Hour Window)
// ============================================================================

export async function processDueScheduledBalanceReleases(): Promise<{
  checked: number;
  released: number;
  skippedDispute: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  const dueTripIds = new Set<string>();

  // 1. Query native PostgreSQL table for due BALANCE_30 tranches
  if (await checkNativeEscrowTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { data } = await client
        .from('escrow_payout_tranches')
        .select('trip_id, ledger_id')
        .eq('tranche_type', 'BALANCE_30')
        .eq('status', 'QUEUED_FOR_RELEASE')
        .lte('scheduled_release_at', nowIso)
        .limit(50);

      for (const row of data || []) {
        if (row?.trip_id) dueTripIds.add(String(row.trip_id));
      }
    }
  }

  // 2. Also scan in-memory tranches for non-migrated / sandbox instances
  const nowMs = Date.now();
  for (const [tripKey, trancheList] of memoryTranchesByTripId.entries()) {
    const bal = trancheList.find((t) => t.tranche_type === 'BALANCE_30');
    if (
      bal &&
      bal.status === 'QUEUED_FOR_RELEASE' &&
      bal.scheduled_release_at &&
      new Date(bal.scheduled_release_at).getTime() <= nowMs
    ) {
      dueTripIds.add(bal.external_trip_id || tripKey);
    }
  }

  let released = 0;
  let skippedDispute = 0;
  let failed = 0;

  for (const tripId of dueTripIds) {
    const state = await findLedgerAndTranchesByTripId(tripId);
    if (!state) continue;
    if (state.ledger.escrow_state === 'DISPUTE_HOLD') {
      skippedDispute += 1;
      continue;
    }
    const bal = state.tranches.find((t) => t.tranche_type === 'BALANCE_30');
    if (!bal || bal.status !== 'QUEUED_FOR_RELEASE' || !bal.scheduled_release_at) continue;
    if (new Date(bal.scheduled_release_at).getTime() > Date.now()) continue;

    const result = await executeTrancheRelease(
      state.ledger,
      state.tranches,
      'BALANCE_30',
      'Automated 2-hour POD dispute window expiry release'
    );
    if (result.ok) released += 1;
    else failed += 1;
  }

  return {
    checked: dueTripIds.size,
    released,
    skippedDispute,
    failed
  };
}

let autoReleaseTimer: NodeJS.Timeout | null = null;

export function startEscrowAutoReleaseWorker(): void {
  if (autoReleaseTimer) return;
  autoReleaseTimer = setInterval(() => {
    processDueScheduledBalanceReleases().catch(() => {
      // Non-fatal periodic sweep error
    });
  }, 60_000);
  if (typeof autoReleaseTimer.unref === 'function') {
    autoReleaseTimer.unref();
  }
}

// ============================================================================
// Cashfree Webhook Handler (POST /api/webhooks/cashfree)
// ============================================================================

export async function cashfreeEscrowWebhookHandler(req: express.Request, res: express.Response) {
  try {
    const signature = String(req.headers['x-webhook-signature'] || '');
    const timestamp = String(req.headers['x-webhook-timestamp'] || '');
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

    const isValid = cashfreeServer.verifyWebhook(signature, timestamp, rawBody);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Cashfree webhook signature or expired timestamp.'
      });
    }

    const event = req.body || {};
    const eventType = String(event?.type || '').toUpperCase();
    const orderId = sanitizeId(
      event?.data?.order?.order_id || event?.data?.order_id || event?.data?.transfer?.order_id || ''
    );
    const cfPaymentId = sanitizeId(
      event?.data?.payment?.cf_payment_id || event?.data?.payment?.payment_id || `cf_pay_${Date.now()}`
    );
    const paidAmount = Number(
      event?.data?.order?.order_amount || event?.data?.payment?.payment_amount || 0
    );

    // 1. Shipper Checkout Payment Success -> FUNDED_LOCKED
    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || eventType === 'PAYMENT_CHARGES_WEBHOOK') {
      if (!orderId) {
        return res.status(200).json({ success: true, ignored: true, reason: 'missing_order_id' });
      }
      const found = await findLedgerAndTranchesByOrderId(orderId);
      if (!found) {
        return res.status(200).json({ success: true, ignored: true, reason: 'order_not_in_escrow_ledger' });
      }

      if (paidAmount > 0 && Math.abs(paidAmount - found.ledger.total_freight_inr) > 1) {
        return res.status(400).json({
          success: false,
          message: 'Webhook payment amount does not match escrow ledger total.'
        });
      }

      await markEscrowOrderFunded(found.ledger, found.tranches, cfPaymentId);
      return res.status(200).json({
        success: true,
        eventType,
        escrow_state: found.ledger.escrow_state,
        cf_payment_id: cfPaymentId
      });
    }

    // 2. Split Settlement / Transfer Success -> Tranche SETTLED
    if (
      eventType === 'SPLIT_SETTLEMENT_SUCCESS' ||
      eventType === 'TRANSFER_SUCCESS' ||
      eventType === 'SPLIT_SETTLEMENT_FAILED' ||
      eventType === 'TRANSFER_FAILED'
    ) {
      const splitRefId = sanitizeId(
        event?.data?.split?.split_reference_id ||
          event?.data?.transfer?.reference_id ||
          event?.data?.cf_split_id ||
          ''
      );
      const idempotencyKey = sanitizeId(
        event?.data?.split?.tags?.idempotency_key ||
          event?.data?.transfer?.idempotency_key ||
          event?.data?.idempotency_key ||
          ''
      );
      const declaredTrancheType = String(
        event?.data?.split?.tags?.tranche_type || event?.data?.tranche_type || ''
      ).toUpperCase() as TrancheType;

      let found = orderId ? await findLedgerAndTranchesByOrderId(orderId) : null;
      if (!found && idempotencyKey) {
        const memTranche = memoryTranchesByIdempotencyKey.get(idempotencyKey);
        if (memTranche) {
          found = await findLedgerAndTranchesByTripId(memTranche.external_trip_id);
        }
      }

      if (!found) {
        return res.status(200).json({ success: true, ignored: true, reason: 'tranche_ledger_not_found' });
      }

      const targetTranche = found.tranches.find(
        (t) =>
          (idempotencyKey && t.idempotency_key === idempotencyKey) ||
          (splitRefId && t.cashfree_split_ref_id === splitRefId) ||
          (declaredTrancheType && t.tranche_type === declaredTrancheType)
      );

      if (!targetTranche) {
        return res.status(200).json({ success: true, ignored: true, reason: 'tranche_not_matched' });
      }

      const nowIso = new Date().toISOString();
      if (eventType.endsWith('SUCCESS')) {
        targetTranche.status = 'SETTLED';
        targetTranche.released_at = targetTranche.released_at || nowIso;
        if (splitRefId) targetTranche.cashfree_split_ref_id = splitRefId;
        targetTranche.failure_reason = null;

        if (targetTranche.tranche_type === 'ADVANCE_70' && found.ledger.escrow_state === 'FUNDED_LOCKED') {
          found.ledger.escrow_state = 'ADVANCE_70_RELEASED';
        } else if (targetTranche.tranche_type === 'BALANCE_30') {
          found.ledger.escrow_state = 'FULLY_SETTLED';
        }
      } else {
        targetTranche.status = 'FAILED';
        targetTranche.failure_reason = sanitizeId(
          event?.data?.reason || event?.data?.failure_reason || 'Cashfree split transfer failed.',
          200
        );
      }

      await persistLedgerAndTranches(found.ledger, found.tranches);
      return res.status(200).json({
        success: true,
        eventType,
        tranche_type: targetTranche.tranche_type,
        tranche_status: targetTranche.status,
        escrow_state: found.ledger.escrow_state
      });
    }

    return res.status(200).json({ success: true, received: true, eventType });
  } catch (err: any) {
    console.error(`[Cashfree Escrow Webhook Error] code=${err?.code || 'webhook_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to process Cashfree escrow webhook.' });
  }
}

// ============================================================================
// Express Router: Escrow Payment Engine API Endpoints (mounted at /api)
// ============================================================================

export const escrowRouter = express.Router();

/**
 * 1. POST /api/payments/create-escrow-order
 * Validates trip details + fleet owner KYC === 'VERIFIED', computes exact integer-paise
 * 70/30 split, creates Cashfree PG order with deferred Easy Split holding 100% of
 * net_vendor_payable_inr in escrow, and persists ledger + both LOCKED tranches.
 */
escrowRouter.post('/payments/create-escrow-order', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const body = req.body || {};
    const tripId = sanitizeId(body.tripId || body.trip_id || body.bookingId);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }

    // Look up existing booking/trip if stored in Supabase
    const booking = await findSupabaseBookingById(tripId);

    // Ownership check: only the shipper who owns this trip (or admin) can initialize payment
    const shipperExternalId = booking?.customerId || auth.session?.userId || sanitizeId(body.shipperId);
    if (!auth.isAdmin && auth.session) {
      if (booking?.customerId && booking.customerId !== auth.session.userId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only the shipper who owns this trip may initiate escrow payment.'
        });
      }
    }

    // Check if an escrow ledger already exists for this trip
    const existing = await findLedgerAndTranchesByTripId(tripId);
    if (existing) {
      if (existing.ledger.escrow_state === 'AWAITING_PAYMENT' && existing.ledger.payment_session_id) {
        const vendor = memoryVendorsById.get(existing.ledger.vendor_id) || null;
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          payment_session_id: existing.ledger.payment_session_id,
          cashfree_order_id: existing.ledger.cashfree_order_id,
          isSimulated: Boolean(existing.ledger.is_simulated),
          ledger: existing.ledger,
          tranches: existing.tranches,
          vendor
        });
      }
      return res.status(409).json({
        success: false,
        message: `Escrow order already exists in state ${existing.ledger.escrow_state}.`,
        ledger: existing.ledger,
        tranches: existing.tranches
      });
    }

    // Resolve assigned fleet vendor and enforce kyc_status === 'VERIFIED'
    const driverExternalId = sanitizeId(
      booking?.driverId || booking?.ownerId || body.vendorUserId || body.driverId || ''
    );
    if (!driverExternalId) {
      return res.status(400).json({
        success: false,
        message: 'An assigned fleet owner / driver is required before funding escrow.'
      });
    }

    const vendor = await resolveOrProvisionVerifiedVendor(driverExternalId, {
      name: booking?.driverName || body.vendorName,
      upiId: body.vendorUpiId,
      bankAccountLast4: body.vendorBankLast4,
      cashfreeVendorId: body.cashfreeVendorId,
      kycStatus: !IS_PRODUCTION && body.allowSandboxAutoVerify !== false ? 'VERIFIED' : undefined
    });

    if (!vendor) {
      return res.status(400).json({
        success: false,
        message: 'Assigned fleet owner has not completed Cashfree Easy Split payout onboarding.'
      });
    }

    if (vendor.kyc_status !== 'VERIFIED') {
      return res.status(400).json({
        success: false,
        message: `Assigned fleet vendor KYC status is ${vendor.kyc_status}. Escrow checkout requires VERIFIED vendor KYC.`
      });
    }

    // Authoritative freight amount: prefer server-stored booking amount over client input
    const serverBookingAmount = Number(booking?.finalPrice || booking?.totalFare || booking?.amount || 0);
    const requestedAmount = Number(body.totalFreightInr || body.total_freight_inr || body.amount || 0);
    const totalFreightInr = serverBookingAmount > 0 ? serverBookingAmount : requestedAmount;

    if (!Number.isFinite(totalFreightInr) || totalFreightInr < 100 || totalFreightInr > 50_000_000) {
      return res.status(400).json({
        success: false,
        message: 'total_freight_inr must be between ₹100 and ₹5,00,00,000.'
      });
    }

    const breakdown = computeEscrow7030SplitPaise(totalFreightInr);
    const cashfreeOrderId = buildCashfreeOrderId(tripId);
    const shipperPhone = String(body.customerPhone || auth.session?.phone10 || '9999999999')
      .replace(/\D/g, '')
      .slice(-10)
      .padStart(10, '9');

    const cfOrder = await cashfreeServer.createEscrowOrder({
      orderId: cashfreeOrderId,
      orderAmount: breakdown.totalFreightInr,
      vendorId: vendor.cashfree_vendor_id,
      netVendorPayableInr: breakdown.netVendorPayableInr,
      customerDetails: {
        customer_id: sanitizeId(shipperExternalId, 50),
        customer_name: sanitizeId(body.customerName || booking?.customerName || 'Zuggi Shipper', 100),
        customer_email: sanitizeId(body.customerEmail || 'shipper@zuggi.in', 100),
        customer_phone: shipperPhone
      },
      orderNote: `Zuggi 70/30 Escrow Trip ${tripId}`,
      tags: {
        trip_id: tripId.slice(0, 48),
        advance_70_inr: breakdown.advance70Inr.toFixed(2),
        balance_30_inr: breakdown.balance30Inr.toFixed(2)
      }
    });

    const nowIso = new Date().toISOString();
    const tripUuid = toDeterministicUuid(tripId);
    const shipperUuid = toDeterministicUuid(shipperExternalId);
    const ledgerId = crypto.randomUUID();

    if (await checkNativeEscrowTables()) {
      await ensureNativeTripRow(tripUuid, tripId, shipperUuid, booking);
    }

    const ledger: TripEscrowLedgerRecord = {
      id: ledgerId,
      trip_id: tripUuid,
      external_trip_id: tripId,
      shipper_id: shipperUuid,
      external_shipper_id: shipperExternalId,
      vendor_id: vendor.id,
      cashfree_vendor_id: vendor.cashfree_vendor_id,
      cashfree_order_id: cashfreeOrderId,
      cf_payment_id: null,
      payment_session_id: String(cfOrder?.payment_session_id || ''),
      is_simulated: Boolean((cfOrder as any)?.isSimulated),
      total_freight_inr: breakdown.totalFreightInr,
      platform_fee_inr: breakdown.platformFeeInr,
      platform_base_fee_inr: breakdown.basePlatformFeeInr,
      platform_gst_inr: breakdown.gstOnFeeInr,
      net_vendor_payable_inr: breakdown.netVendorPayableInr,
      advance_70_amount: breakdown.advance70Inr,
      balance_30_amount: breakdown.balance30Inr,
      escrow_state: 'AWAITING_PAYMENT',
      dispute_reason: null,
      dispute_raised_at: null,
      created_at: nowIso,
      updated_at: nowIso
    };

    const tranches: EscrowPayoutTrancheRecord[] = [
      {
        id: crypto.randomUUID(),
        ledger_id: ledgerId,
        trip_id: tripUuid,
        external_trip_id: tripId,
        tranche_type: 'ADVANCE_70',
        amount_inr: breakdown.advance70Inr,
        idempotency_key: `${tripId}_ADVANCE_70`,
        cashfree_split_ref_id: null,
        status: 'LOCKED',
        scheduled_release_at: null,
        released_at: null,
        failure_reason: null,
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: crypto.randomUUID(),
        ledger_id: ledgerId,
        trip_id: tripUuid,
        external_trip_id: tripId,
        tranche_type: 'BALANCE_30',
        amount_inr: breakdown.balance30Inr,
        idempotency_key: `${tripId}_BALANCE_30`,
        cashfree_split_ref_id: null,
        status: 'LOCKED',
        scheduled_release_at: null,
        released_at: null,
        failure_reason: null,
        created_at: nowIso,
        updated_at: nowIso
      }
    ];

    await persistLedgerAndTranches(ledger, tranches);

    return res.status(201).json({
      success: true,
      payment_session_id: ledger.payment_session_id,
      cashfree_order_id: ledger.cashfree_order_id,
      isSimulated: Boolean(ledger.is_simulated),
      breakdown,
      ledger,
      tranches,
      vendor
    });
  } catch (err: any) {
    console.error(`[Create Escrow Order Error] code=${err?.code || 'escrow_order_error'}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to create 70/30 escrow payment order.'
    });
  }
});

/**
 * 2. POST /api/escrow/release-advance
 * Triggered on Loading / Digital LR verification (IN_TRANSIT).
 * Verifies escrow_state === 'FUNDED_LOCKED' and ADVANCE_70 === 'LOCKED', then triggers
 * Cashfree Easy Split On-Demand Release using idempotency_key = "{trip_id}_ADVANCE_70".
 */
escrowRouter.post('/escrow/release-advance', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const tripId = sanitizeId(req.body?.tripId || req.body?.trip_id);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }

    const found = await findLedgerAndTranchesByTripId(tripId);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Escrow ledger not found for this trip.' });
    }

    // Participant / admin authorization
    if (!auth.isAdmin) {
      const allowed =
        isShipperForLedger(auth.session, found.ledger) ||
        (await isVendorForLedger(auth.session, found.ledger));
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only assigned trip participants or admins may release the loading advance.'
        });
      }
    }

    const result = await executeTrancheRelease(
      found.ledger,
      found.tranches,
      'ADVANCE_70',
      sanitizeId(req.body?.remarks || 'Loading verified & Digital LR issued (IN_TRANSIT)', 100)
    );

    return res.status(result.statusCode).json({
      success: result.ok,
      idempotentReplay: result.idempotentReplay,
      message: result.message,
      ledger: result.ledger,
      tranches: result.tranches,
      tranche: result.tranche
    });
  } catch (err: any) {
    console.error(`[Release Advance Error] code=${err?.code || 'release_advance_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to release 70% loading advance.' });
  }
});

/**
 * 3. POST /api/escrow/trigger-balance
 * Two modes:
 *  - action: 'pod_uploaded' (Driver / Fleet Owner / Admin)
 *      Sets BALANCE_30 -> QUEUED_FOR_RELEASE and scheduled_release_at = now() + 2 hours.
 *  - action: 'approve_pod_now' (Shipper / Admin)
 *      Immediately calls Cashfree Easy Split On-Demand Release for balance_30_amount using
 *      idempotency_key = "{trip_id}_BALANCE_30" (blocked if escrow_state === 'DISPUTE_HOLD').
 */
escrowRouter.post('/escrow/trigger-balance', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const tripId = sanitizeId(req.body?.tripId || req.body?.trip_id);
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }
    if (action !== 'pod_uploaded' && action !== 'approve_pod_now') {
      return res.status(400).json({
        success: false,
        message: "action must be either 'pod_uploaded' or 'approve_pod_now'."
      });
    }

    const found = await findLedgerAndTranchesByTripId(tripId);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Escrow ledger not found for this trip.' });
    }

    const balanceTranche = found.tranches.find((t) => t.tranche_type === 'BALANCE_30');
    if (!balanceTranche) {
      return res.status(404).json({ success: false, message: 'BALANCE_30 tranche not found.' });
    }

    if (action === 'pod_uploaded') {
      // Only assigned driver/fleet vendor or admin can queue POD release
      if (!auth.isAdmin) {
        const isVendor = await isVendorForLedger(auth.session, found.ledger);
        if (!isVendor) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Only the assigned fleet owner/driver or admin may mark POD uploaded.'
          });
        }
      }

      if (found.ledger.escrow_state === 'AWAITING_PAYMENT' || found.ledger.escrow_state === 'REFUNDED') {
        return res.status(409).json({
          success: false,
          message: `Cannot queue POD balance while escrow state is ${found.ledger.escrow_state}.`
        });
      }

      if (found.ledger.escrow_state === 'DISPUTE_HOLD') {
        return res.status(409).json({
          success: false,
          message: 'Trip escrow is under DISPUTE_HOLD. Auto-release countdown cannot start until resolved.'
        });
      }

      if (balanceTranche.status === 'SETTLED' || balanceTranche.status === 'PROCESSING') {
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          message: '30% delivery balance is already released.',
          ledger: found.ledger,
          tranches: found.tranches,
          tranche: balanceTranche
        });
      }

      if (balanceTranche.status === 'QUEUED_FOR_RELEASE' && balanceTranche.scheduled_release_at) {
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          message: '30% delivery balance is already queued for auto-release.',
          ledger: found.ledger,
          tranches: found.tranches,
          tranche: balanceTranche
        });
      }

      const scheduledAt = new Date(Date.now() + TWO_HOURS_MS).toISOString();
      balanceTranche.status = 'QUEUED_FOR_RELEASE';
      balanceTranche.scheduled_release_at = scheduledAt;

      await persistLedgerAndTranches(found.ledger, found.tranches, {
        podUploadedAt: new Date().toISOString(),
        escrowBalanceScheduledAt: scheduledAt
      });

      return res.status(200).json({
        success: true,
        message: 'POD verified. 30% balance queued for automatic release in 2 hours unless disputed.',
        scheduled_release_at: scheduledAt,
        ledger: found.ledger,
        tranches: found.tranches,
        tranche: balanceTranche
      });
    }

    // action === 'approve_pod_now' -> strictly Shipper or Admin
    if (!auth.isAdmin && !isShipperForLedger(auth.session, found.ledger)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the shipper who booked this trip or an admin may approve POD for instant release.'
      });
    }

    const result = await executeTrancheRelease(
      found.ledger,
      found.tranches,
      'BALANCE_30',
      'Shipper approved POD for instant 30% balance release'
    );

    return res.status(result.statusCode).json({
      success: result.ok,
      idempotentReplay: result.idempotentReplay,
      message: result.message,
      ledger: result.ledger,
      tranches: result.tranches,
      tranche: result.tranche
    });
  } catch (err: any) {
    console.error(`[Trigger Balance Error] code=${err?.code || 'trigger_balance_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to process 30% POD balance trigger.' });
  }
});

/**
 * 4. POST /api/escrow/raise-dispute
 * Allows shipper to freeze BALANCE_30 before scheduled_release_at expires, moving
 * escrow_state to DISPUTE_HOLD and logging an admin alert ticket.
 */
escrowRouter.post('/escrow/raise-dispute', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const tripId = sanitizeId(req.body?.tripId || req.body?.trip_id);
    const reason = sanitizeId(req.body?.reason || req.body?.disputeReason || '', 500);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }
    if (reason.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear dispute reason (at least 5 characters) to freeze the 30% balance.'
      });
    }

    const found = await findLedgerAndTranchesByTripId(tripId);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Escrow ledger not found for this trip.' });
    }

    if (!auth.isAdmin && !isShipperForLedger(auth.session, found.ledger)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the shipper or an admin may raise an escrow dispute on this trip.'
      });
    }

    const balanceTranche = found.tranches.find((t) => t.tranche_type === 'BALANCE_30');
    if (!balanceTranche) {
      return res.status(404).json({ success: false, message: 'BALANCE_30 tranche not found.' });
    }

    if (balanceTranche.status === 'SETTLED' || balanceTranche.status === 'PROCESSING' || found.ledger.escrow_state === 'FULLY_SETTLED') {
      return res.status(409).json({
        success: false,
        message: 'Dispute window closed: 30% delivery balance has already been released.'
      });
    }

    if (
      balanceTranche.scheduled_release_at &&
      Date.now() >= new Date(balanceTranche.scheduled_release_at).getTime()
    ) {
      return res.status(409).json({
        success: false,
        message: 'The 2-hour POD dispute window has already elapsed.'
      });
    }

    const nowIso = new Date().toISOString();
    found.ledger.escrow_state = 'DISPUTE_HOLD';
    found.ledger.dispute_reason = reason;
    found.ledger.dispute_raised_at = nowIso;
    balanceTranche.status = 'LOCKED';
    balanceTranche.scheduled_release_at = null;

    await persistLedgerAndTranches(found.ledger, found.tranches, {
      paymentStatus: 'disputed',
      disputeReason: reason,
      disputeRaisedAt: nowIso
    });

    // Alert operations team via support tickets table
    try {
      await upsertSupabaseRecords('vs_support_tickets', [
        {
          id: `escrow_dispute_${tripId}_${Date.now()}`,
          userId: auth.session?.userId || found.ledger.external_shipper_id,
          category: 'ESCROW_DISPUTE_HOLD',
          priority: 'HIGH',
          status: 'OPEN',
          tripId,
          ledgerId: found.ledger.id,
          frozenAmountInr: balanceTranche.amount_inr,
          subject: `Escrow 30% Dispute Hold — Trip ${tripId}`,
          message: reason,
          createdAt: nowIso
        }
      ]);
    } catch {
      // Non-fatal alert logging failure
    }

    return res.status(200).json({
      success: true,
      message: `30% delivery balance (₹${balanceTranche.amount_inr.toLocaleString('en-IN')}) frozen under DISPUTE_HOLD. Operations team alerted.`,
      ledger: found.ledger,
      tranches: found.tranches
    });
  } catch (err: any) {
    console.error(`[Raise Escrow Dispute Error] code=${err?.code || 'dispute_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to freeze balance under dispute hold.' });
  }
});

/**
 * 5. GET /api/escrow/ledger/:tripId
 * Fetches full escrow ledger, tranches, and fleet vendor summary for authorized trip participants/admin.
 */
escrowRouter.get('/escrow/ledger/:tripId', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const tripId = sanitizeId(req.params.tripId);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }

    const found = await findLedgerAndTranchesByTripId(tripId);
    if (!found) {
      return res.status(200).json({ success: true, exists: false, ledger: null, tranches: [] });
    }

    if (!auth.isAdmin) {
      const allowed =
        isShipperForLedger(auth.session, found.ledger) ||
        (await isVendorForLedger(auth.session, found.ledger));
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have access to this trip escrow ledger.'
        });
      }
    }

    const vendor = memoryVendorsById.get(found.ledger.vendor_id) || null;
    return res.status(200).json({
      success: true,
      exists: true,
      ledger: found.ledger,
      tranches: found.tranches,
      vendor: vendor
        ? {
            id: vendor.id,
            cashfree_vendor_id: vendor.cashfree_vendor_id,
            kyc_status: vendor.kyc_status,
            bank_account_last4: vendor.bank_account_last4,
            upi_id: vendor.upi_id
          }
        : null
    });
  } catch (err: any) {
    console.error(`[Get Escrow Ledger Error] code=${err?.code || 'get_ledger_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to load trip escrow ledger.' });
  }
});

/**
 * 6. GET /api/escrow/vendor-wallet
 * Fleet Owner / Driver Live Escrow Wallet: aggregates locked, released 70%, queued 30%,
 * dispute hold, and fully settled totals across all trips for the signed-in fleet partner.
 */
escrowRouter.get('/escrow/vendor-wallet', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const targetUserId =
      auth.isAdmin && req.query.userId
        ? sanitizeId(req.query.userId)
        : auth.session?.userId || '';

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Unable to determine fleet vendor account.' });
    }

    const vendor = await resolveOrProvisionVerifiedVendor(targetUserId);
    const items: Array<{ ledger: TripEscrowLedgerRecord; tranches: EscrowPayoutTrancheRecord[] }> = [];
    const seenLedgerIds = new Set<string>();

    if (vendor && (await checkNativeEscrowTables())) {
      const client = getSupabaseClient();
      if (client) {
        const { data: ledgerRows } = await client
          .from('trip_escrow_ledger')
          .select('*')
          .eq('vendor_id', vendor.id)
          .order('created_at', { ascending: false })
          .limit(50);

        for (const row of ledgerRows || []) {
          const { data: trancheRows } = await client
            .from('escrow_payout_tranches')
            .select('*')
            .eq('ledger_id', row.id);
          const ledger = normalizeLedgerRow(row);
          const tranches = (trancheRows || []).map((r: any) => normalizeTrancheRow(r, ledger.external_trip_id));
          seenLedgerIds.add(ledger.id);
          items.push({ ledger, tranches });
        }
      }
    }

    // Include any in-memory ledgers matching this vendor
    const vendorUuid = vendor?.id || toDeterministicUuid(`vendor:${targetUserId}`);
    for (const ledger of memoryLedgersByTripId.values()) {
      if (seenLedgerIds.has(ledger.id)) continue;
      if (ledger.vendor_id === vendorUuid || ledger.cashfree_vendor_id === vendor?.cashfree_vendor_id) {
        seenLedgerIds.add(ledger.id);
        const tranches = memoryTranchesByTripId.get(ledger.external_trip_id) || [];
        items.push({ ledger, tranches });
      }
    }

    items.sort((a, b) => new Date(b.ledger.created_at).getTime() - new Date(a.ledger.created_at).getTime());

    let lockedInEscrowPaise = 0;
    let releasedAdvancePaise = 0;
    let queuedBalancePaise = 0;
    let settledTotalPaise = 0;
    let disputeHoldPaise = 0;

    for (const { ledger, tranches } of items) {
      if (ledger.escrow_state === 'AWAITING_PAYMENT' || ledger.escrow_state === 'REFUNDED') continue;
      for (const t of tranches) {
        const paise = Math.round(t.amount_inr * 100);
        if (ledger.escrow_state === 'DISPUTE_HOLD' && t.tranche_type === 'BALANCE_30') {
          disputeHoldPaise += paise;
        } else if (t.status === 'SETTLED' || t.status === 'PROCESSING') {
          settledTotalPaise += paise;
          if (t.tranche_type === 'ADVANCE_70') releasedAdvancePaise += paise;
        } else if (t.status === 'QUEUED_FOR_RELEASE') {
          queuedBalancePaise += paise;
        } else if (t.status === 'LOCKED') {
          lockedInEscrowPaise += paise;
        }
      }
    }

    return res.status(200).json({
      success: true,
      vendor: vendor
        ? {
            id: vendor.id,
            cashfree_vendor_id: vendor.cashfree_vendor_id,
            kyc_status: vendor.kyc_status,
            bank_account_last4: vendor.bank_account_last4,
            upi_id: vendor.upi_id
          }
        : null,
      summary: {
        lockedInEscrowInr: lockedInEscrowPaise / 100,
        releasedAdvanceInr: releasedAdvancePaise / 100,
        queuedBalanceInr: queuedBalancePaise / 100,
        settledTotalInr: settledTotalPaise / 100,
        disputeHoldInr: disputeHoldPaise / 100,
        totalTrips: items.length
      },
      trips: items
    });
  } catch (err: any) {
    console.error(`[Get Vendor Wallet Error] code=${err?.code || 'vendor_wallet_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to load fleet escrow wallet.' });
  }
});

/**
 * 7. POST /api/escrow/vendors/register
 * Onboards the signed-in fleet partner to Cashfree Easy Split & records their verified
 * fleet_vendors row (bank_account_last4 / upi_id).
 */
escrowRouter.post('/escrow/vendors/register', async (req, res) => {
  try {
    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const targetUserId = auth.isAdmin && req.body?.userId ? sanitizeId(req.body.userId) : auth.session?.userId || '';
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Fleet partner user account is required.' });
    }

    const name = sanitizeId(req.body?.name || 'Fleet Partner', 100);
    const email = sanitizeId(req.body?.email || `${targetUserId}@zuggi.in`, 100);
    const phone = String(req.body?.phone || auth.session?.phone10 || '').replace(/\D/g, '').slice(-10);
    const bankAccountNumber = String(req.body?.bankAccountNumber || '').replace(/\s+/g, '');
    const bankIfsc = sanitizeId(req.body?.bankIfsc || '', 20).toUpperCase();
    const upiId = sanitizeId(req.body?.upiId || '', 80);

    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required.' });
    }
    if (!upiId && (!bankAccountNumber || !bankIfsc)) {
      return res.status(400).json({
        success: false,
        message: 'Provide either a UPI ID or Bank Account Number + IFSC for Easy Split payouts.'
      });
    }

    const cashfreeVendorId = buildCashfreeVendorId(targetUserId);
    const cfResp = await cashfreeServer.registerVendor({
      vendor_id: cashfreeVendorId,
      name,
      email,
      phone,
      bank_account_number: bankAccountNumber || undefined,
      bank_ifsc: bankIfsc || undefined,
      upi_vpa: !bankAccountNumber ? upiId : undefined,
      verify_account: true
    });

    const remoteStatus = String(cfResp?.status || '').toUpperCase();
    const kycStatus: FleetKycStatus =
      remoteStatus === 'ACTIVE' || remoteStatus === 'VERIFIED' || cfResp?.penny_drop_status === 'SUCCESS'
        ? 'VERIFIED'
        : 'PENDING';

    const nowIso = new Date().toISOString();
    const record = await upsertFleetVendor({
      id: toDeterministicUuid(`vendor:${targetUserId}`),
      user_id: toDeterministicUuid(targetUserId),
      external_user_id: targetUserId,
      cashfree_vendor_id: cashfreeVendorId,
      kyc_status: kycStatus,
      bank_account_last4: bankAccountNumber ? bankAccountNumber.slice(-4) : null,
      upi_id: upiId || null,
      vendor_name: name,
      created_at: nowIso,
      updated_at: nowIso
    });

    return res.status(200).json({
      success: true,
      vendor: record,
      isSimulated: Boolean((cfResp as any)?.isSimulated)
    });
  } catch (err: any) {
    console.error(`[Register Fleet Vendor Error] code=${err?.code || 'vendor_register_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to register fleet payout vendor.' });
  }
});

/**
 * 8. POST /api/escrow/confirm-sandbox-payment (NON-PRODUCTION SANDBOX ONLY)
 * Allows testing the full checkout -> FUNDED_LOCKED -> 70% loading release -> 30% POD countdown
 * workflow when Cashfree credentials are in sandbox/preview mode. Strictly blocked in production.
 */
escrowRouter.post('/escrow/confirm-sandbox-payment', async (req, res) => {
  try {
    if (IS_PRODUCTION) {
      return res.status(403).json({
        success: false,
        message: 'Sandbox payment confirmation is disabled in production. Use signed Cashfree webhooks.'
      });
    }

    const auth = requireAuthenticatedCaller(req, res);
    if (!auth) return;

    const tripId = sanitizeId(req.body?.tripId || req.body?.trip_id);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }

    const found = await findLedgerAndTranchesByTripId(tripId);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Escrow ledger not found for this trip.' });
    }

    if (!auth.isAdmin && !isShipperForLedger(auth.session, found.ledger)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the trip shipper or an admin may confirm sandbox checkout.'
      });
    }

    const cfPaymentId = `cf_pay_sbx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const updated = await markEscrowOrderFunded(found.ledger, found.tranches, cfPaymentId);

    return res.status(200).json({
      success: true,
      message: 'Sandbox checkout confirmed. 100% of net freight is now safely locked in Cashfree escrow.',
      ledger: updated.ledger,
      tranches: updated.tranches
    });
  } catch (err: any) {
    console.error(`[Sandbox Escrow Confirm Error] code=${err?.code || 'sandbox_confirm_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to confirm sandbox payment.' });
  }
});

/**
 * 9. POST /api/escrow/process-scheduled-releases (Admin / Cron Trigger)
 */
escrowRouter.post('/escrow/process-scheduled-releases', async (req, res) => {
  try {
    if (!isCsrfSafeMutation(req) || !verifyAdminTokenFromReq(req)) {
      return res.status(403).json({ success: false, message: 'Admin authorization required.' });
    }
    const summary = await processDueScheduledBalanceReleases();
    return res.status(200).json({ success: true, ...summary });
  } catch (err: any) {
    console.error(`[Escrow Cron Trigger Error] code=${err?.code || 'cron_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to process scheduled escrow releases.' });
  }
});
