import express from 'express';
import crypto from 'crypto';
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

// Strong HMAC-SHA256 signing secret for stateless-verified + revocable JWT sessions
const SESSION_TOKEN_SECRET =
  (process.env.SESSION_TOKEN_SECRET || process.env.TRACKING_TOKEN_SECRET || '').trim() ||
  crypto.randomBytes(32).toString('hex');

const USER_SESSION_TTL_SEC = 24 * 60 * 60; // 24 hours
const ADMIN_SESSION_TTL_SEC = 12 * 60 * 60; // 12 hours

// Server-side token revocation blacklist (jti -> expEpochMs) + per-subject revocation watermark
const revokedTokenJtis = new Map<string, number>();
const subjectRevokedBeforeSec = new Map<string, number>();

export interface UserSessionInfo {
  userId: string;
  phone10: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  jti: string;
}

interface SignedTokenClaims {
  sub: string;
  uid: string;
  phone10: string;
  role: string;
  email?: string;
  iat: number;
  exp: number;
  jti: string;
}

function pruneRevokedTokens(): void {
  const nowMs = Date.now();
  if (revokedTokenJtis.size < 200) return;
  for (const [jti, expMs] of revokedTokenJtis.entries()) {
    if (expMs <= nowMs) revokedTokenJtis.delete(jti);
  }
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signSessionJwt(claims: SignedTokenClaims): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}

function verifySessionJwt(token: string): SignedTokenClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;

    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_TOKEN_SECRET)
      .update(signingInput)
      .digest('base64url');

    const providedBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SignedTokenClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!claims || typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || !claims.jti) {
      return null;
    }
    if (claims.exp <= nowSec) {
      return null;
    }

    // Check explicit logout blacklist
    if (revokedTokenJtis.has(claims.jti)) {
      return null;
    }

    // Check per-user revocation watermark (triggered on password reset or account deletion)
    const uidWatermark = claims.uid ? subjectRevokedBeforeSec.get(`uid:${claims.uid}`) || 0 : 0;
    const phoneWatermark = claims.phone10 ? subjectRevokedBeforeSec.get(`phone:${claims.phone10}`) || 0 : 0;
    if (claims.iat < uidWatermark || claims.iat < phoneWatermark) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

function extractTenDigits(raw: unknown): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : '';
}

const USER_SESSION_COOKIE = 'zuggi_session';
const ADMIN_SESSION_COOKIE = 'zuggi_admin_session';

function parseCookies(req: express.Request): Record<string, string> {
  const raw = String(req.headers.cookie || '');
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      map[key] = decodeURIComponent(val);
    } catch {
      map[key] = val;
    }
  }
  return map;
}

function isSecureRequest(req: express.Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || '').toLowerCase();
  return proto.includes('https') || process.env.NODE_ENV === 'production';
}

function buildSessionCookieHeader(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly'
  ];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

function appendSetCookie(res: express.Response, cookieStr: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing.map(String), cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

export function setUserSessionCookie(req: express.Request, res: express.Response, token: string): void {
  if (!token) return;
  appendSetCookie(res, buildSessionCookieHeader(USER_SESSION_COOKIE, token, USER_SESSION_TTL_SEC, isSecureRequest(req)));
}

export function setAdminSessionCookie(req: express.Request, res: express.Response, token: string): void {
  if (!token) return;
  appendSetCookie(res, buildSessionCookieHeader(ADMIN_SESSION_COOKIE, token, ADMIN_SESSION_TTL_SEC, isSecureRequest(req)));
}

export function clearSessionCookies(req: express.Request, res: express.Response): void {
  const secure = isSecureRequest(req);
  appendSetCookie(res, buildSessionCookieHeader(USER_SESSION_COOKIE, '', 0, secure));
  appendSetCookie(res, buildSessionCookieHeader(ADMIN_SESSION_COOKIE, '', 0, secure));
}

function hasExplicitAuthHeader(req: express.Request): boolean {
  return Boolean(
    String(req.headers.authorization || '').trim() ||
      String(req.headers['x-zuggi-user-token'] || '').trim() ||
      String(req.headers['x-zuggi-admin-token'] || '').trim()
  );
}

/**
 * Guard cookie-authenticated mutations against cross-site request forgery.
 * Explicit Bearer / custom token headers are inherently CSRF-safe.
 */
export function isCsrfSafeMutation(req: express.Request): boolean {
  if (hasExplicitAuthHeader(req)) return true;
  const xrw = String(req.headers['x-requested-with'] || '').trim().toLowerCase();
  if (xrw === 'xmlhttprequest') return true;
  const secFetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') return true;
  const origin = String(req.headers.origin || '').trim();
  const host = String(req.headers.host || '').trim().toLowerCase();
  if (origin && host) {
    try {
      const parsed = new URL(origin);
      if (parsed.host.toLowerCase() === host) return true;
    } catch {
      return false;
    }
  }
  return !origin;
}

function extractRawTokensFromReq(req: express.Request): string[] {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const adminHdr = String(req.headers['x-zuggi-admin-token'] || '').trim();
  const userHdr = String(req.headers['x-zuggi-user-token'] || '').trim();
  const cookies = parseCookies(req);
  const adminCookie = (cookies[ADMIN_SESSION_COOKIE] || '').trim();
  const userCookie = (cookies[USER_SESSION_COOKIE] || '').trim();
  return [adminHdr, userHdr, bearer, adminCookie, userCookie].filter(Boolean);
}

// Legacy Set kept exported for backwards compatibility; all new tokens are signed expiring JWTs
export const adminSessionTokens = new Set<string>();

export function issueAdminSessionToken(email: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  return signSessionJwt({
    sub: 'owner_baruahg39',
    uid: 'owner_baruahg39',
    phone10: '',
    role: 'admin',
    email: String(email || '').trim().toLowerCase(),
    iat: nowSec,
    exp: nowSec + ADMIN_SESSION_TTL_SEC,
    jti: crypto.randomUUID()
  });
}

export function verifyAdminTokenFromReq(req: express.Request): boolean {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const custom = String(req.headers['x-zuggi-admin-token'] || '').trim();
  const cookies = parseCookies(req);
  const adminCookie = (cookies[ADMIN_SESSION_COOKIE] || '').trim();
  const candidates = [custom, bearer, adminCookie].filter(Boolean);
  for (const token of candidates) {
    if (adminSessionTokens.has(token)) return true;
    const claims = verifySessionJwt(token);
    if (claims && claims.role === 'admin') return true;
  }
  return false;
}

export function issueUserSessionToken(user: { id?: string; phone?: string; role?: string }): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const uid = String(user.id || '');
  const phone10 = extractTenDigits(user.phone || '');
  const safeRole = String(user.role || 'customer').toLowerCase() === 'admin' ? 'customer' : String(user.role || 'customer');
  return signSessionJwt({
    sub: uid || phone10 || 'user',
    uid,
    phone10,
    role: safeRole,
    iat: nowSec,
    exp: nowSec + USER_SESSION_TTL_SEC,
    jti: crypto.randomUUID()
  });
}

export function verifyUserTokenFromReq(req: express.Request): UserSessionInfo | null {
  const authHeader = String(req.headers.authorization || '').trim();
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const custom = String(req.headers['x-zuggi-user-token'] || '').trim();
  const cookies = parseCookies(req);
  const userCookie = (cookies[USER_SESSION_COOKIE] || '').trim();
  const candidates = [custom, bearer, userCookie].filter(Boolean);
  for (const token of candidates) {
    const claims = verifySessionJwt(token);
    if (claims && claims.role !== 'admin') {
      return {
        userId: claims.uid,
        phone10: claims.phone10,
        role: claims.role,
        issuedAt: claims.iat * 1000,
        expiresAt: claims.exp * 1000,
        jti: claims.jti
      };
    }
  }
  return null;
}

/**
 * Blacklists the caller's active JWT session token(s) immediately upon logout.
 */
export function revokeTokenFromReq(req: express.Request): boolean {
  pruneRevokedTokens();
  let revokedAny = false;
  for (const token of extractRawTokensFromReq(req)) {
    if (adminSessionTokens.delete(token)) {
      revokedAny = true;
    }
    const claims = verifySessionJwt(token);
    if (claims?.jti) {
      revokedTokenJtis.set(claims.jti, claims.exp * 1000);
      revokedAny = true;
    }
  }
  return revokedAny;
}

/**
 * Invalidates all tokens issued before now for a given user ID / phone number
 * (called on password reset or account deletion).
 */
export function revokeUserSessions(userId?: string, phone10?: string): void {
  const cutoffSec = Math.floor(Date.now() / 1000) + 1;
  if (userId) {
    subjectRevokedBeforeSec.set(`uid:${userId}`, cutoffSec);
  }
  const targetPhone = extractTenDigits(phone10 || '');
  if (targetPhone) {
    subjectRevokedBeforeSec.set(`phone:${targetPhone}`, cutoffSec);
  }
}

// Strict server-side upload MIME & size validator (prevents SVG/HTML XSS & oversized payloads)
const ALLOWED_UPLOAD_MIME_PREFIXES = [
  'data:image/jpeg;base64,',
  'data:image/jpg;base64,',
  'data:image/png;base64,',
  'data:image/webp;base64,',
  'data:application/pdf;base64,'
];
const MAX_UPLOAD_DATA_URI_LENGTH = 7 * 1024 * 1024; // ~5 MB binary file encoded in base64

export function validateSafeUploadDataUris(value: unknown, depth = 0): { ok: boolean; reason?: string } {
  if (depth > 8 || value === null || value === undefined) return { ok: true };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^data:/i.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      const allowed = ALLOWED_UPLOAD_MIME_PREFIXES.some((prefix) => lower.startsWith(prefix));
      if (!allowed) {
        return {
          ok: false,
          reason: 'Unsupported file upload format. Only JPEG, PNG, WebP images and PDF documents are allowed.'
        };
      }
      if (trimmed.length > MAX_UPLOAD_DATA_URI_LENGTH) {
        return {
          ok: false,
          reason: 'Uploaded file exceeds the 5 MB maximum size limit.'
        };
      }
    }
    return { ok: true };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const check = validateSafeUploadDataUris(item, depth + 1);
      if (!check.ok) return check;
    }
    return { ok: true };
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const check = validateSafeUploadDataUris(v, depth + 1);
      if (!check.ok) return check;
    }
  }
  return { ok: true };
}

function maskAccountNumber(acct?: string): string | undefined {
  const clean = String(acct || '').replace(/\s+/g, '');
  if (!clean) return undefined;
  return clean.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

// Strict field-level allowlist for the signed-in user's own profile (zero password hashes or internal fields)
export function filterSelfUserFields(user: any) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: user.id,
    name: user.name || '',
    phone: user.phone || '',
    email: user.email || '',
    role: user.role || 'customer',
    avatarUrl: user.avatarUrl,
    businessName: user.businessName,
    gstin: user.gstin,
    pan: user.pan,
    address: user.address,
    state: user.state || 'Assam',
    city: user.city || 'Guwahati',
    isVerified: Boolean(user.isVerified),
    isBlocked: Boolean(user.isBlocked),
    blockedReason: user.blockedReason,
    hasPasscode: Boolean(user.passcodeHash || user.hasPasscode),
    passcodeUpdatedAt: user.passcodeUpdatedAt,
    bankDetails: user.bankDetails
      ? {
          accountHolderName: user.bankDetails.accountHolderName,
          bankName: user.bankDetails.bankName,
          accountNumber: maskAccountNumber(user.bankDetails.accountNumber),
          ifscCode: user.bankDetails.ifscCode,
          upiId: user.bankDetails.upiId,
          isVerified: Boolean(user.bankDetails.isVerified),
          updatedAt: user.bankDetails.updatedAt
        }
      : undefined,
    createdAt: user.createdAt
  };
}

// Strict field-level allowlist for Admin console (masks bank account numbers, strips hashes)
function filterAdminUserFields(user: any) {
  return filterSelfUserFields(user);
}

// Minimal non-PII public display stub for other users referenced in marketplace items
function filterPublicPeerUserFields(user: any) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: user.id,
    name: user.name || 'Zuggi Member',
    phone: '',
    email: '',
    role: user.role || 'customer',
    businessName: user.businessName,
    state: user.state || 'Assam',
    city: user.city || 'Guwahati',
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt
  };
}

function filterLoadForViewer(load: any, canSeeContacts: boolean) {
  if (!load || typeof load !== 'object') return load;
  if (canSeeContacts) return load;
  return {
    ...load,
    deliveryOtp: undefined,
    pickup: load.pickup
      ? {
          ...load.pickup,
          contactName: undefined,
          contactPhone: undefined
        }
      : load.pickup,
    delivery: load.delivery
      ? {
          ...load.delivery,
          contactName: undefined,
          contactPhone: undefined
        }
      : load.delivery
  };
}

function filterVehicleForViewer(vehicle: any, canSeePrivateDetails: boolean) {
  if (!vehicle || typeof vehicle !== 'object') return vehicle;
  if (canSeePrivateDetails) return vehicle;
  return {
    ...vehicle,
    driverPhone: undefined
  };
}

/**
 * Permanently delete user profile & vehicles and anonymize personal contact fields
 * in Supabase tables while retaining statutory invoice/booking totals required by law.
 */
export async function deleteAndAnonymizeUserDataInSupabase(
  cleanTenDigits: string,
  userId?: string
): Promise<{ deletedUsers: number; deletedVehicles: number; anonymizedRecords: number }> {
  const result = { deletedUsers: 0, deletedVehicles: 0, anonymizedRecords: 0 };
  const client = getSupabaseClient();
  if (!client) return result;

  try {
    const matchedUserIds = new Set<string>();
    if (userId) matchedUserIds.add(userId);

    if (cleanTenDigits && /^\d{10}$/.test(cleanTenDigits)) {
      const { data: phoneUsers } = await client
        .from('vs_users')
        .select('id')
        .ilike('phone', `%${cleanTenDigits}%`)
        .limit(20);
      (phoneUsers || []).forEach((row: any) => {
        if (row?.id && row.id !== 'owner_baruahg39') matchedUserIds.add(String(row.id));
      });
    }

    const ids = Array.from(matchedUserIds).filter((id) => id && id !== 'owner_baruahg39');
    if (ids.length === 0) return result;

    // 1. Permanently delete user profile rows (removes name, phone, email, PAN, GSTIN, address, bankDetails, passcodeHash)
    const { data: delUsers } = await client.from('vs_users').delete().in('id', ids).select('id');
    result.deletedUsers = Array.isArray(delUsers) ? delUsers.length : 0;

    // 2. Permanently delete owned vehicles (removes vehicle RC & driver phone)
    const { data: delVehs } = await client.from('vs_vehicles').delete().in('owner_id', ids).select('id');
    result.deletedVehicles = Array.isArray(delVehs) ? delVehs.length : 0;

    // 3. Anonymize support tickets authored by this user
    const { data: userTickets } = await client.from('vs_support_tickets').select('id, data').in('user_id', ids).limit(200);
    if (Array.isArray(userTickets) && userTickets.length > 0) {
      const anonymizedTickets = userTickets.map((row: any) => ({
        id: row.id,
        user_id: 'deleted_user',
        status: row.data?.status || 'closed',
        data: {
          ...(row.data || {}),
          userId: 'deleted_user',
          userName: 'Deleted User',
          userPhone: '',
          userEmail: ''
        },
        updated_at: new Date().toISOString()
      }));
      await client.from('vs_support_tickets').upsert(anonymizedTickets, { onConflict: 'id' });
      result.anonymizedRecords += anonymizedTickets.length;
    }

    // 4. Anonymize contact details on historical loads (preserving freight metrics)
    const { data: userLoads } = await client.from('vs_loads').select('id, data').in('customer_id', ids).limit(200);
    if (Array.isArray(userLoads) && userLoads.length > 0) {
      const anonymizedLoads = userLoads.map((row: any) => {
        const d = row.data || {};
        return {
          ...buildRowForTable('vs_loads', {
            ...d,
            customerName: 'Deleted User',
            pickup: d.pickup ? { ...d.pickup, contactName: 'Deleted User', contactPhone: '' } : d.pickup,
            delivery: d.delivery ? { ...d.delivery, contactName: 'Deleted User', contactPhone: '' } : d.delivery
          })
        };
      });
      await client.from('vs_loads').upsert(anonymizedLoads, { onConflict: 'id' });
      result.anonymizedRecords += anonymizedLoads.length;
    }

    // 5. Anonymize personal contact info on bookings (preserving statutory GST/invoice records)
    const { data: custBookings } = await client.from('vs_bookings').select('id, data').in('customer_id', ids).limit(200);
    const { data: drvBookings } = await client.from('vs_bookings').select('id, data').in('driver_id', ids).limit(200);
    const bookingMap = new Map<string, any>();
    [...(custBookings || []), ...(drvBookings || [])].forEach((row: any) => {
      if (row?.id) bookingMap.set(row.id, row.data || {});
    });
    if (bookingMap.size > 0) {
      const anonymizedBookings = Array.from(bookingMap.values()).map((d: any) =>
        buildRowForTable('vs_bookings', {
          ...d,
          customerName: ids.includes(String(d.customerId)) ? 'Deleted User' : d.customerName,
          driverName: ids.includes(String(d.driverId)) ? 'Deleted Driver' : d.driverName,
          driverPhone: ids.includes(String(d.driverId)) ? '' : d.driverPhone
        })
      );
      await client.from('vs_bookings').upsert(anonymizedBookings, { onConflict: 'id' });
      result.anonymizedRecords += anonymizedBookings.length;
    }
  } catch {
    console.warn('[Supabase Account Erasure Notice] Partial cleanup error.');
  }

  return result;
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
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

export function isSupabaseConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    // Enforce TLS/HTTPS exclusively; reject embedded credentials and localhost in production
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production' && (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')) {
      return false;
    }
  } catch {
    return false;
  }
  const lowerUrl = url.toLowerCase();
  const lowerKey = key.toLowerCase();
  return !(
    lowerUrl.includes('your-project-id') ||
    lowerKey.includes('your_supabase') ||
    lowerKey.includes('postgres:postgres') ||
    lowerKey.includes('changeme')
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

        // Preserve server-side passcodeHash and adminPasscodeHash if omitted by client sync
        if (!next.passcodeHash && prev.passcodeHash) {
          next.hasPasscode = true;
          next.passcodeHash = prev.passcodeHash;
          next.passcodeUpdatedAt = next.passcodeUpdatedAt || prev.passcodeUpdatedAt;
        }
        if (!next.adminPasscodeHash && prev.adminPasscodeHash) {
          next.adminPasscodeHash = prev.adminPasscodeHash;
          next.adminPasscodeUpdatedAt = next.adminPasscodeUpdatedAt || prev.adminPasscodeUpdatedAt;
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
    invalidateBootstrapTableCache(table);
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
  if (!client || !cleanTenDigits || !/^\d{10}$/.test(cleanTenDigits)) return null;
  try {
    const { data, error } = await client
      .from('vs_users')
      .select('data')
      .ilike('phone', `%${cleanTenDigits}%`)
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

export async function findSupabaseBookingById(bookingId: string): Promise<any | null> {
  const client = getSupabaseClient();
  const safeId = String(bookingId || '').trim();
  if (!client || !safeId || !/^[a-zA-Z0-9_-]{1,80}$/.test(safeId)) return null;
  try {
    const { data, error } = await client
      .from('vs_bookings')
      .select('data')
      .eq('id', safeId)
      .limit(1);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data[0]?.data || null;
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
  const safeId = String(tripIdOrLoadId || '').trim();
  if (!client || !safeId || !/^[a-zA-Z0-9_-]{1,80}$/.test(safeId)) return null;
  try {
    // Parameterized equality lookups (avoids PostgREST .or() string interpolation)
    let { data: tripRows, error } = await client
      .from('vs_trips')
      .select('data')
      .eq('id', safeId)
      .limit(1);

    if (!error && (!tripRows || tripRows.length === 0)) {
      const byLoadRes = await client
        .from('vs_trips')
        .select('data')
        .eq('load_id', safeId)
        .limit(1);
      tripRows = byLoadRes.data;
      error = byLoadRes.error;
    }

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
      console.warn('[Supabase Status Notice] Schema check failed:', error.code || 'schema_not_ready');
      return res.json({
        success: true,
        configured: true,
        connected: true,
        tablesReady: false,
        message: 'Database tables are not initialized yet.'
      });
    }
    return res.json({ success: true, configured: true, connected: true, tablesReady: true });
  } catch {
    console.warn('[Supabase Status Notice] Database connection check failed.');
    return res.json({
      success: true,
      configured: true,
      connected: false,
      tablesReady: false,
      message: 'Database connection unavailable.'
    });
  }
});

const BOOTSTRAP_CACHE_TTL_MS = 10 * 1000;
const bootstrapTableCache = new Map<SupabaseSyncTable, { rows: any[]; fetchedAt: number }>();
const bootstrapInFlight = new Map<SupabaseSyncTable, Promise<{ rows: any[]; schemaMissing: boolean; transientError: boolean }>>();

function invalidateBootstrapTableCache(table?: SupabaseSyncTable): void {
  if (table) {
    bootstrapTableCache.delete(table);
  } else {
    bootstrapTableCache.clear();
  }
}

function isMissingSchemaError(err: any): boolean {
  const code = String(err?.code || '').toUpperCase();
  return code === '42P01' || code === 'PGRST205' || code === '42703';
}

async function fetchBootstrapTableRows(
  client: SupabaseClient,
  table: SupabaseSyncTable,
  orderByUpdatedAt = false
): Promise<{ rows: any[]; schemaMissing: boolean; transientError: boolean }> {
  const cached = bootstrapTableCache.get(table);
  if (cached && Date.now() - cached.fetchedAt < BOOTSTRAP_CACHE_TTL_MS) {
    return { rows: cached.rows, schemaMissing: false, transientError: false };
  }

  const existingFlight = bootstrapInFlight.get(table);
  if (existingFlight) {
    return existingFlight;
  }

  const runFetch = (async () => {
    const executeQuery = async () => {
      const q = client.from(table).select('data');
      return orderByUpdatedAt
        ? q.order('updated_at', { ascending: false }).limit(500)
        : q.limit(500);
    };

    try {
      let res = await executeQuery();
      if (res.error && !isMissingSchemaError(res.error)) {
        // One quick retry for transient network / socket resets from Supabase
        await new Promise((resolve) => setTimeout(resolve, 250));
        res = await executeQuery();
      }

      if (res.error) {
        if (isMissingSchemaError(res.error)) {
          return { rows: [], schemaMissing: true, transientError: false };
        }
        return {
          rows: cached?.rows || [],
          schemaMissing: false,
          transientError: true
        };
      }

      const cleaned = (res.data || [])
        .map((r: any) => r?.data)
        .filter((r: any) => r && !isLegacyBotRecord(r));
      bootstrapTableCache.set(table, { rows: cleaned, fetchedAt: Date.now() });
      return { rows: cleaned, schemaMissing: false, transientError: false };
    } catch {
      return {
        rows: cached?.rows || [],
        schemaMissing: false,
        transientError: true
      };
    } finally {
      bootstrapInFlight.delete(table);
    }
  })();

  bootstrapInFlight.set(table, runFetch);
  return runFetch;
}

supabaseRouter.get('/bootstrap', async (req, res) => {
  const client = getSupabaseClient();
  if (!client) {
    return res.json({ success: true, configured: false, tablesReady: false, data: null });
  }

  const isAdmin = verifyAdminTokenFromReq(req);
  const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;
  const callerId = callerSession?.userId || '';
  const callerPhone10 = callerSession?.phone10 || '';
  const needsPrivateTables = isAdmin || Boolean(callerSession);

  try {
    const emptyTableResult = Promise.resolve({ rows: [] as any[], schemaMissing: false, transientError: false });
    const [usersRes, vehRes, loadsRes, quotesRes, bookingsRes, ticketsRes] = await Promise.all([
      needsPrivateTables ? fetchBootstrapTableRows(client, 'vs_users', false) : emptyTableResult,
      fetchBootstrapTableRows(client, 'vs_vehicles', false),
      fetchBootstrapTableRows(client, 'vs_loads', true),
      needsPrivateTables ? fetchBootstrapTableRows(client, 'vs_quotations', false) : emptyTableResult,
      needsPrivateTables ? fetchBootstrapTableRows(client, 'vs_bookings', true) : emptyTableResult,
      needsPrivateTables ? fetchBootstrapTableRows(client, 'vs_support_tickets', false) : emptyTableResult
    ]);

    const allResults = [usersRes, vehRes, loadsRes, quotesRes, bookingsRes, ticketsRes];
    if (allResults.some((r) => r.schemaMissing)) {
      return res.json({
        success: true,
        configured: true,
        tablesReady: false,
        message: 'Database tables are not ready yet.',
        data: null
      });
    }

    const rawUsers = usersRes.rows;
    const rawVehicles = vehRes.rows;
    const rawLoads = loadsRes.rows;
    const rawQuotes = quotesRes.rows;
    const rawBookings = bookingsRes.rows;
    const rawTickets = ticketsRes.rows;

    const isSelfUser = (u: any) =>
      Boolean(
        callerSession &&
          ((callerId && u.id === callerId) ||
            (callerPhone10 && extractTenDigits(u.phone) === callerPhone10))
      );

    // Field-level & ownership-level filtering:
    // - Admin gets full filtered view (no password hashes, masked bank account numbers)
    // - Signed-in user gets ONLY their own profile + non-PII public display stubs + their own bookings/tickets/quotes
    // - Unauthenticated visitor gets ONLY public marketplace loads/vehicles with personal contact fields stripped
    const filteredUsers = isAdmin
      ? rawUsers.map(filterAdminUserFields)
      : callerSession
      ? rawUsers.map((u: any) => (isSelfUser(u) ? filterSelfUserFields(u) : filterPublicPeerUserFields(u)))
      : [];

    const filteredVehicles = rawVehicles.map((v: any) =>
      filterVehicleForViewer(v, isAdmin || Boolean(callerId && (v.ownerId === callerId || v.assignedDriverId === callerId)))
    );

    const callerLoadIds = new Set(
      rawLoads.filter((l: any) => callerId && l.customerId === callerId).map((l: any) => l.id)
    );

    const filteredBookings = isAdmin
      ? rawBookings
      : callerSession
      ? rawBookings.filter(
          (b: any) => b.customerId === callerId || b.transporterId === callerId || b.driverId === callerId
        )
      : [];

    const callerBookingLoadIds = new Set(filteredBookings.map((b: any) => b.loadId));

    const filteredLoads = rawLoads.map((l: any) =>
      filterLoadForViewer(l, isAdmin || callerLoadIds.has(l.id) || callerBookingLoadIds.has(l.id))
    );

    const filteredQuotations = isAdmin
      ? rawQuotes
      : callerSession
      ? rawQuotes.filter(
          (q: any) =>
            q.transporterId === callerId ||
            q.driverId === callerId ||
            callerLoadIds.has(q.loadId)
        )
      : [];

    const filteredTickets = isAdmin
      ? rawTickets
      : callerSession
      ? rawTickets.filter((t: any) => t.userId === callerId)
      : [];

    return res.json({
      success: true,
      configured: true,
      tablesReady: true,
      data: {
        users: filteredUsers,
        vehicles: filteredVehicles,
        loads: filteredLoads,
        quotations: filteredQuotations,
        bookings: filteredBookings,
        tickets: filteredTickets
      }
    });
  } catch {
    console.warn('[Supabase Bootstrap Notice] Unexpected bootstrap failure.');
    return res.json({
      success: false,
      configured: true,
      tablesReady: false,
      message: 'Database bootstrap query failed.'
    });
  }
});

supabaseRouter.post('/sync', async (req, res) => {
  if (!isCsrfSafeMutation(req)) {
    return res.status(403).json({
      success: false,
      message: 'Cross-site request blocked.'
    });
  }

  const isAdmin = verifyAdminTokenFromReq(req);
  const callerSession = !isAdmin ? verifyUserTokenFromReq(req) : null;

  if (!isAdmin && !callerSession) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required to sync records.'
    });
  }

  const { table, record, records } = req.body || {};
  if (!table || !ALLOWED_SYNC_TABLES.has(table)) {
    return res.status(400).json({ success: false, message: 'Invalid or unsupported table name.' });
  }
  const list = Array.isArray(records) ? records : record ? [record] : [];
  if (list.length > 200) {
    return res.status(400).json({ success: false, message: 'Batch size exceeds maximum limit of 200 records.' });
  }

  // Server-side validation for any embedded file uploads (blocks SVG/HTML XSS & oversized payloads)
  const uploadCheck = validateSafeUploadDataUris(list);
  if (!uploadCheck.ok) {
    return res.status(400).json({
      success: false,
      message: uploadCheck.reason || 'Invalid file upload content.'
    });
  }

  // Strict ownership & anti-IDOR authorization for non-admin callers
  if (!isAdmin && callerSession) {
    const callerId = callerSession.userId;
    const callerPhone10 = callerSession.phone10;

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      if (table === 'vs_users') {
        const sameId = Boolean(callerId && String(item.id || '') === callerId);
        const samePhone = Boolean(callerPhone10 && extractTenDigits(item.phone) === callerPhone10);
        if (!sameId && !samePhone) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only update your own user profile.'
          });
        }
      } else if (table === 'vs_vehicles') {
        if (!callerId || String(item.ownerId || '') !== callerId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only manage vehicles owned by your account.'
          });
        }
      } else if (table === 'vs_loads') {
        if (!callerId || String(item.customerId || '') !== callerId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only modify loads created by your account.'
          });
        }
      } else if (table === 'vs_quotations') {
        const isPartnerOwner = callerId && (String(item.transporterId || '') === callerId || String(item.driverId || '') === callerId);
        // Allow shipper who owns the target load to update quotation acceptance status
        let isLoadShipper = false;
        if (!isPartnerOwner && item.loadId) {
          const loadRow = await findSupabaseLoadById(String(item.loadId));
          if (loadRow?.data?.customerId === callerId) {
            isLoadShipper = true;
          }
        }
        if (!isPartnerOwner && !isLoadShipper) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to modify this quotation.'
          });
        }
      } else if (table === 'vs_bookings') {
        const isParticipant =
          Boolean(
            callerId &&
              (String(item.customerId || '') === callerId ||
                String(item.transporterId || '') === callerId ||
                String(item.driverId || '') === callerId)
          );
        if (!isParticipant) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only update bookings you participate in.'
          });
        }
      } else if (table === 'vs_support_tickets') {
        if (!callerId || String(item.userId || '') !== callerId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only create or modify your own support tickets.'
          });
        }
      }
    }
  }

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
    console.warn(`[Supabase Sync Notice] Deferred sync for ${table}.`);
    return res.status(202).json({ success: false, deferred: true, message: 'Sync deferred; data saved locally.' });
  }
  return res.json({ success: true, syncedCount: list.length });
});
