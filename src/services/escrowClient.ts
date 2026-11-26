import { logisticsStore } from './store';

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

export interface FleetVendorSummary {
  id: string;
  cashfree_vendor_id: string;
  kyc_status: FleetKycStatus;
  bank_account_last4?: string | null;
  upi_id?: string | null;
}

export interface TripEscrowLedger {
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

export interface EscrowPayoutTranche {
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
}

export interface EscrowLedgerResponse {
  success: boolean;
  exists?: boolean;
  ledger: TripEscrowLedger | null;
  tranches: EscrowPayoutTranche[];
  vendor?: FleetVendorSummary | null;
  message?: string;
}

export interface CreateEscrowOrderResponse {
  success: boolean;
  idempotentReplay?: boolean;
  payment_session_id?: string;
  cashfree_order_id?: string;
  isSimulated?: boolean;
  breakdown?: EscrowSplitBreakdown;
  ledger?: TripEscrowLedger;
  tranches?: EscrowPayoutTranche[];
  vendor?: FleetVendorSummary | null;
  message?: string;
}

export interface VendorWalletResponse {
  success: boolean;
  vendor: FleetVendorSummary | null;
  summary: {
    lockedInEscrowInr: number;
    releasedAdvanceInr: number;
    queuedBalanceInr: number;
    settledTotalInr: number;
    disputeHoldInr: number;
    totalTrips: number;
  };
  trips: Array<{
    ledger: TripEscrowLedger;
    tranches: EscrowPayoutTranche[];
  }>;
  message?: string;
}

/**
 * Exact integer-paise calculation mirroring server/escrow.ts (zero floating-point drift).
 */
export function calculateEscrow7030Breakdown(
  totalFreightInr: number,
  platformFeeRate = 0.05,
  commissionGstRate = 0.18
): EscrowSplitBreakdown {
  const safeTotal = Number.isFinite(totalFreightInr) && totalFreightInr > 0 ? totalFreightInr : 0;
  const totalFreightPaise = Math.round(safeTotal * 100);
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

export function formatInrExact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasDecimals = Math.abs(safe - Math.round(safe)) > 0.001;
  return `₹${safe.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

export function formatCountdownHMS(targetIso?: string | null): {
  remainingMs: number;
  expired: boolean;
  formatted: string;
  compact: string;
} {
  if (!targetIso) {
    return { remainingMs: 0, expired: false, formatted: '02:00:00', compact: '02h 00m' };
  }
  const remainingMs = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    remainingMs,
    expired: remainingMs <= 0,
    formatted: `${pad(hrs)}:${pad(mins)}:${pad(secs)}`,
    compact: hrs > 0 ? `${pad(hrs)}h ${pad(mins)}m` : `${pad(mins)}m ${pad(secs)}s`
  };
}

async function escrowRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const isMutation = init?.method && init.method !== 'GET';
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...logisticsStore.buildAuthHeaders(Boolean(isMutation)),
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  if (!res.ok && data && typeof data === 'object' && !('success' in data)) {
    return { success: false, message: `Request failed (HTTP ${res.status})` } as T;
  }
  return data as T;
}

export const escrowClient = {
  createEscrowOrder(params: {
    tripId: string;
    totalFreightInr: number;
    driverId?: string;
    vendorName?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  }): Promise<CreateEscrowOrderResponse> {
    return escrowRequest<CreateEscrowOrderResponse>('/api/payments/create-escrow-order', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  confirmSandboxPayment(tripId: string): Promise<EscrowLedgerResponse> {
    return escrowRequest<EscrowLedgerResponse>('/api/escrow/confirm-sandbox-payment', {
      method: 'POST',
      body: JSON.stringify({ tripId })
    });
  },

  getTripEscrowLedger(tripId: string): Promise<EscrowLedgerResponse> {
    return escrowRequest<EscrowLedgerResponse>(`/api/escrow/ledger/${encodeURIComponent(tripId)}`, {
      method: 'GET'
    });
  },

  releaseLoadingAdvance(tripId: string, remarks?: string): Promise<EscrowLedgerResponse & { idempotentReplay?: boolean }> {
    return escrowRequest<EscrowLedgerResponse & { idempotentReplay?: boolean }>('/api/escrow/release-advance', {
      method: 'POST',
      body: JSON.stringify({ tripId, remarks })
    });
  },

  triggerPodBalance(
    tripId: string,
    action: 'pod_uploaded' | 'approve_pod_now'
  ): Promise<EscrowLedgerResponse & { scheduled_release_at?: string; idempotentReplay?: boolean }> {
    return escrowRequest<EscrowLedgerResponse & { scheduled_release_at?: string; idempotentReplay?: boolean }>(
      '/api/escrow/trigger-balance',
      {
        method: 'POST',
        body: JSON.stringify({ tripId, action })
      }
    );
  },

  raiseDispute(tripId: string, reason: string): Promise<EscrowLedgerResponse> {
    return escrowRequest<EscrowLedgerResponse>('/api/escrow/raise-dispute', {
      method: 'POST',
      body: JSON.stringify({ tripId, reason })
    });
  },

  getVendorWallet(): Promise<VendorWalletResponse> {
    return escrowRequest<VendorWalletResponse>('/api/escrow/vendor-wallet', {
      method: 'GET'
    });
  },

  registerFleetVendor(params: {
    name: string;
    email?: string;
    phone: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
    upiId?: string;
  }): Promise<{ success: boolean; vendor?: FleetVendorSummary; message?: string }> {
    return escrowRequest('/api/escrow/vendors/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
};
