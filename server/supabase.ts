import express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SupabaseSyncTable =
  | 'vs_users'
  | 'vs_vehicles'
  | 'vs_loads'
  | 'vs_quotations'
  | 'vs_bookings'
  | 'vs_support_tickets';

const ALLOWED_SYNC_TABLES = new Set<SupabaseSyncTable>([
  'vs_users',
  'vs_vehicles',
  'vs_loads',
  'vs_quotations',
  'vs_bookings',
  'vs_support_tickets'
]);

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

const PARTNER_ROLES = new Set(['driver', 'vehicle_owner', 'fleet_partner', 'transporter']);

export function isPartnerRole(role: unknown): boolean {
  return PARTNER_ROLES.has(String(role || '').toLowerCase());
}

// Server-side in-memory admin session tokens (issued by /api/auth/admin-session)
export const adminSessionTokens = new Set<string>();

export function verifyAdminTokenFromReq(req: express.Request): boolean {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const custom = String(req.headers['x-zuggi-admin-token'] || '').trim();
  const token = bearer || custom;
  return Boolean(token && adminSessionTokens.has(token));
}

const BOT_RECORD_IDS = new Set([
  'user_cust_01',
  'user_driver_01',
  'user_trans_01',
  'user_admin_01',
  'user_owner_01',
  'user_fleet_01',
  'user_applicant_02',
  'user_applicant_03',
  'test_shipper_9911',
  'test_driver_9922',
  'test_driver_9933',
  'user_driver_9678944132',
  'user_shipper_9678944132',
  'veh_01',
  'veh_02',
  'veh_03',
  'veh_04',
  'veh_test_driver_9922',
  'veh_test_driver_9933',
  'veh_demo_9678944132',
  'load_active_01',
  'load_pending_02',
  'load_available_03',
  'quote_01',
  'quote_02',
  'booking_01',
  'booking_completed_01',
  'booking_completed_02',
  'booking_completed_03',
  'booking_completed_04',
  'tick_01',
  'tick_02',
  'tick_03'
]);

function isLegacyBotRecord(rec: any): boolean {
  if (!rec) return false;
  if (rec.id === 'owner_baruahg39') return false;
  if (rec.isTestAccount === true || rec.isTestLoad === true || rec.isTestBid === true || rec.isTestBooking === true) {
    return true;
  }
  const id = String(rec.id || '');
  const ownerId = String(rec.ownerId || '');
  const customerId = String(rec.customerId || '');
  const driverId = String(rec.driverId || '');
  const transporterId = String(rec.transporterId || '');
  const email = String(rec.email || '').toLowerCase();
  const phone = String(rec.phone || '').replace(/\D/g, '').slice(-10);
  if (phone === '9999911111' || phone === '9999922222' || phone === '9999933333') return true;
  if (email.endsWith('@test.vahansetu.in') || email.endsWith('@test.zuggi.in')) return true;
  return (
    BOT_RECORD_IDS.has(id) ||
    id.startsWith('test_') ||
    id.startsWith('veh_test_') ||
    id.startsWith('veh_demo_') ||
    BOT_RECORD_IDS.has(ownerId) ||
    BOT_RECORD_IDS.has(customerId) ||
    BOT_RECORD_IDS.has(driverId) ||
    BOT_RECORD_IDS.has(transporterId)
  );
}

function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

export function isSupabaseConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  return Boolean(
    url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('your-project-id') &&
      !key.includes('your_supabase')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const configKey = `${url}:${key.slice(0, 12)}`;

  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    cachedConfigKey = configKey;
  }
  return cachedClient;
}

function buildRowForTable(table: SupabaseSyncTable, record: any): Record<string, any> {
  const now = new Date().toISOString();
  switch (table) {
    case 'vs_users':
      return {
        id: String(record.id),
        name: String(record.name || 'User'),
        phone: record.phone || null,
        email: record.email || null,
        role: String(record.role || 'customer'),
        is_blocked: Boolean(record.isBlocked),
        data: record,
        updated_at: now
      };
    case 'vs_vehicles':
      return {
        id: String(record.id),
        owner_id: String(record.ownerId || ''),
        registration_number: String(record.registrationNumber || ''),
        is_online: Boolean(record.isOnline),
        is_available: record.isAvailable !== false,
        verification_status: String(record.verificationStatus || 'pending'),
        data: record,
        updated_at: now
      };
    case 'vs_loads':
      return {
        id: String(record.id),
        customer_id: String(record.customerId || ''),
        status: String(record.status || 'posted'),
        pickup_city: record.pickup?.city || null,
        delivery_city: record.delivery?.city || null,
        weight_kg: Number(record.weightKg || 0),
        data: record,
        updated_at: now
      };
    case 'vs_quotations':
      return {
        id: String(record.id),
        load_id: String(record.loadId || ''),
        transporter_id: String(record.transporterId || ''),
        status: String(record.status || 'submitted'),
        quote_amount_inr: Number(record.quoteAmountInr || 0),
        data: record,
        updated_at: now
      };
    case 'vs_bookings':
      return {
        id: String(record.id),
        load_id: String(record.loadId || ''),
        customer_id: String(record.customerId || ''),
        transporter_id: String(record.transporterId || ''),
        driver_id: record.driverId || null,
        vehicle_id: record.vehicleId || null,
        status: String(record.status || 'assigned'),
        total_agreed_amount_inr: Number(record.totalAgreedAmountInr || 0),
        data: record,
        updated_at: now
      };
    case 'vs_support_tickets':
      return {
        id: String(record.id),
        user_id: String(record.userId || ''),
        status: String(record.status || 'open'),
        data: record,
        updated_at: now
      };
  }
}

export async function upsertSupabaseRecords(
  table: SupabaseSyncTable,
  records: any[],
  options?: { isAdmin?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client || records.length === 0) return { ok: false, error: 'Not configured or empty' };
  const isAdmin = Boolean(options?.isAdmin);
  try {
    let prepared = records.filter((r) => r && r.id);
    if (prepared.length === 0) return { ok: true };

    // Preserve server-side passcodeHash AND prevent non-admin self-verification or privilege escalation on vs_users
    if (table === 'vs_users') {
      const ids = prepared.map((r) => String(r.id));
      const { data: existingRows } = await client
        .from('vs_users')
        .select('id, data')
        .in('id', ids);
      const existingMap = new Map(
        (Array.isArray(existingRows) ? existingRows : []).map((row: any) => [String(row.id), row.data || {}])
      );

      prepared = prepared.map((rec) => {
        const prev = existingMap.get(String(rec.id)) || {};
        const next: Record<string, any> = { ...rec };

        // Preserve server-side passcodeHash if omitted by client sync
        if (!next.passcodeHash && prev.passcodeHash) {
          next.hasPasscode = true;
          next.passcodeHash = prev.passcodeHash;
          next.passcodeUpdatedAt = next.passcodeUpdatedAt || prev.passcodeUpdatedAt;
        }

        if (!isAdmin) {
          // Non-admin clients can never self-assign admin role
          if (String(next.role || '').toLowerCase() === 'admin' && String(prev.role || '').toLowerCase() !== 'admin') {
            next.role = prev.role || 'customer';
          }
          // Preserve server-controlled block flags
          if (typeof prev.isBlocked === 'boolean') {
            next.isBlocked = prev.isBlocked;
            next.blockedReason = prev.blockedReason;
          }
          // Strictly enforce backend Admin approval for all partner roles (drivers, owners, fleet partners)
          if (isPartnerRole(next.role)) {
            next.isVerified = prev.isVerified === true;
          }
        }

        return next;
      });
    }

    // Prevent non-admin clients from self-verifying commercial vehicles
    if (table === 'vs_vehicles' && !isAdmin) {
      const ids = prepared.map((r) => String(r.id));
      const { data: existingRows } = await client
        .from('vs_vehicles')
        .select('id, data')
        .in('id', ids);
      const existingMap = new Map(
        (Array.isArray(existingRows) ? existingRows : []).map((row: any) => [String(row.id), row.data || {}])
      );

      prepared = prepared.map((rec) => {
        const prev = existingMap.get(String(rec.id));
        const authoritativeStatus = prev?.verificationStatus || 'pending';
        return {
          ...rec,
          verificationStatus: authoritativeStatus,
          isBlocked: typeof prev?.isBlocked === 'boolean' ? prev.isBlocked : Boolean(rec.isBlocked),
          blockedReason: prev?.blockedReason ?? rec.blockedReason,
          isOnline: authoritativeStatus === 'verified' ? Boolean(rec.isOnline) : false,
          isAvailable: authoritativeStatus === 'verified' ? rec.isAvailable !== false : false
        };
      });
    }

    const rows = prepared.map((r) => buildRowForTable(table, r));
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Supabase upsert failed' };
  }
}

export async function findSupabaseUserById(userId: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;
  try {
    const { data, error } = await client
      .from('vs_users')
      .select('data')
      .eq('id', userId)
      .limit(1);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data[0]?.data || null;
  } catch {
    return null;
  }
}

export async function findSupabaseVehiclesByOwner(ownerId: string): Promise<any[]> {
  const client = getSupabaseClient();
  if (!client || !ownerId) return [];
  try {
    const { data, error } = await client
      .from('vs_vehicles')
      .select('data')
      .eq('owner_id', ownerId)
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => r.data).filter(Boolean);
  } catch {
    return [];
  }
}

export async function findSupabaseUserByPhone(cleanTenDigits: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client || !cleanTenDigits || cleanTenDigits.length !== 10) return null;
  try {
    const { data, error } = await client
      .from('vs_users')
      .select('data')
      .or(`phone.ilike.%${cleanTenDigits}%`)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error || !Array.isArray(data) || data.length === 0) return null;
    // Prefer the record that already has a passcodeHash configured
    const withPasscode = data.find((r: any) => r?.data?.passcodeHash);
    return (withPasscode || data[0])?.data || null;
  } catch {
    return null;
  }
}

export async function listSupabaseLoads(limit = 300): Promise<Array<{ data: any; updated_at?: string }>> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('vs_loads')
      .select('data, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.filter((row: any) => row && row.data && row.data.id);
  } catch {
    return [];
  }
}

export async function findSupabaseLoadById(loadId: string): Promise<{ data: any; updated_at?: string } | null> {
  const client = getSupabaseClient();
  if (!client || !loadId) return null;
  try {
    const { data, error } = await client
      .from('vs_loads')
      .select('data, updated_at')
      .eq('id', loadId)
      .limit(1);
    if (error || !Array.isArray(data) || data.length === 0 || !data[0]?.data) return null;
    return data[0];
  } catch {
    return null;
  }
}

export async function persistTripToSupabase(trip: {
  id: string;
  load_id: string;
  assigned_vehicle_id: string;
  assigned_driver_id: string;
  status: string;
  tracking_token: string;
  latest_ping?: { lat: number; lng: number };
  [key: string]: any;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('vs_trips').upsert(
      {
        id: trip.id,
        load_id: trip.load_id,
        assigned_vehicle_id: trip.assigned_vehicle_id,
        assigned_driver_id: trip.assigned_driver_id,
        status: trip.status,
        tracking_token: trip.tracking_token,
        latest_lat: trip.latest_ping?.lat ?? null,
        latest_lng: trip.latest_ping?.lng ?? null,
        data: trip,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );
  } catch {
    // Non-blocking if schema not yet initialized
  }
}

export async function persistLocationPingsToSupabase(
  tripId: string,
  pings: Array<{
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    battery_level: number;
    is_buffered?: boolean;
    recorded_at: string;
  }>
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || pings.length === 0) return;
  try {
    const rows = pings.map((p) => ({
      trip_id: tripId,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
      heading: p.heading,
      battery_level: p.battery_level,
      is_buffered: Boolean(p.is_buffered),
      recorded_at: p.recorded_at
    }));
    await client.from('vs_location_pings').insert(rows);
  } catch {
    // Non-blocking fallback
  }
}

export async function loadTripFromSupabase(tripIdOrLoadId: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data: tripRows, error } = await client
      .from('vs_trips')
      .select('data')
      .or(`id.eq.${tripIdOrLoadId},load_id.eq.${tripIdOrLoadId}`)
      .limit(1);

    if (error || !tripRows || tripRows.length === 0 || !tripRows[0]?.data) {
      return null;
    }

    const trip = tripRows[0].data;
    const { data: pingRows } = await client
      .from('vs_location_pings')
      .select('trip_id, lat, lng, speed, heading, battery_level, is_buffered, recorded_at')
      .eq('trip_id', trip.id)
      .order('recorded_at', { ascending: true })
      .limit(100);

    if (Array.isArray(pingRows) && pingRows.length > 0) {
      trip.history = pingRows;
      trip.latest_ping = pingRows[pingRows.length - 1];
    }
    return trip;
  } catch {
    return null;
  }
}

export const supabaseRouter = express.Router();

supabaseRouter.get('/status', async (_req, res) => {
  const configured = isSupabaseConfigured();
  const client = getSupabaseClient();
  if (!configured || !client) {
    return res.json({ success: true, configured: false, connected: false, tablesReady: false });
  }

  try {
    const { error } = await client.from('vs_loads').select('id').limit(1);
    if (error) {
      return res.json({
        success: true,
        configured: true,
        connected: true,
        tablesReady: false,
        message: error.message
      });
    }
    return res.json({ success: true, configured: true, connected: true, tablesReady: true });
  } catch (err: any) {
    return res.json({
      success: true,
      configured: true,
      connected: false,
      tablesReady: false,
      message: err?.message
    });
  }
});

supabaseRouter.get('/bootstrap', async (_req, res) => {
  const client = getSupabaseClient();
  if (!client) {
    return res.json({ success: true, configured: false, tablesReady: false, data: null });
  }

  try {
    const [usersRes, vehRes, loadsRes, quotesRes, bookingsRes, ticketsRes] = await Promise.all([
      client.from('vs_users').select('data').limit(500),
      client.from('vs_vehicles').select('data').limit(500),
      client.from('vs_loads').select('data').order('updated_at', { ascending: false }).limit(500),
      client.from('vs_quotations').select('data').limit(500),
      client.from('vs_bookings').select('data').order('updated_at', { ascending: false }).limit(500),
      client.from('vs_support_tickets').select('data').limit(500)
    ]);

    const firstError = [usersRes, vehRes, loadsRes, quotesRes, bookingsRes, ticketsRes].find((r) => r.error)?.error;
    if (firstError) {
      return res.json({
        success: true,
        configured: true,
        tablesReady: false,
        message: firstError.message,
        data: null
      });
    }

    return res.json({
      success: true,
      configured: true,
      tablesReady: true,
      data: {
        users: (usersRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r)),
        vehicles: (vehRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r)),
        loads: (loadsRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r)),
        quotations: (quotesRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r)),
        bookings: (bookingsRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r)),
        tickets: (ticketsRes.data || []).map((r: any) => r.data).filter((r: any) => r && !isLegacyBotRecord(r))
      }
    });
  } catch (err: any) {
    return res.json({
      success: false,
      configured: true,
      tablesReady: false,
      message: err?.message || 'Bootstrap query failed'
    });
  }
});

supabaseRouter.post('/sync', async (req, res) => {
  const { table, record, records } = req.body || {};
  if (!table || !ALLOWED_SYNC_TABLES.has(table)) {
    return res.status(400).json({ success: false, message: 'Invalid or unsupported table name.' });
  }
  const list = Array.isArray(records) ? records : record ? [record] : [];
  const isAdmin = verifyAdminTokenFromReq(req);

  // Backend enforcement: block unverified drivers/owners from submitting quotes or accepting loads
  if (!isAdmin && (table === 'vs_quotations' || table === 'vs_bookings')) {
    for (const item of list) {
      if (!item) continue;
      const partnerId = String(item.transporterId || item.driverId || '').trim();
      if (!partnerId) continue;
      const dbUser = await findSupabaseUserById(partnerId);
      if (dbUser && isPartnerRole(dbUser.role) && dbUser.isVerified !== true) {
        return res.status(403).json({
          success: false,
          code: 'PARTNER_UNVERIFIED',
          message: 'Backend verification required: Admin approval is mandatory before bidding on or accepting loads.'
        });
      }
      if (dbUser?.isBlocked) {
        return res.status(403).json({
          success: false,
          code: 'PARTNER_BLOCKED',
          message: `Account suspended: ${dbUser.blockedReason || 'Blocked by Admin'}.`
        });
      }
    }
  }

  const result = await upsertSupabaseRecords(table, list, { isAdmin });
  if (!result.ok) {
    return res.status(202).json({ success: false, deferred: true, message: result.error });
  }
  return res.json({ success: true, syncedCount: list.length });
});
