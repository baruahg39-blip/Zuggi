import express from 'express';
import crypto from 'crypto';
import {
  getSupabaseClient,
  findSupabaseUserById,
  findSupabaseBookingById,
  upsertSupabaseRecords,
  verifyAdminTokenFromReq,
  verifyUserTokenFromReq,
  isCsrfSafeMutation,
  type UserSessionInfo
} from './supabase.js';
import { toDeterministicUuid } from './escrow.js';

export interface BusinessProfileRecord {
  id: string;
  user_id: string;
  external_user_id: string;
  company_legal_name: string;
  gstin: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_pincode: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
}

export type SavedAddressType = 'pickup' | 'drop' | 'both';

export interface SavedAddressRecord {
  id: string;
  user_id: string;
  external_user_id: string;
  label: string;
  address_type: SavedAddressType;
  formatted_address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  contact_name: string;
  contact_phone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Official 15-character Indian GSTIN format:
// 2 digits state code + 5 uppercase letters + 4 digits + 1 letter + 1 alphanumeric (1-9,A-Z) + Z + 1 check char
export const INDIAN_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function sanitizeText(raw: unknown, maxLen = 200): string {
  return String(raw ?? '').trim().slice(0, maxLen);
}

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

// Dual-layer persistence: Native PostgreSQL tables when migrated + resilient vs_users mirror & memory fallback
const memoryProfilesByUserId = new Map<string, BusinessProfileRecord>();
const memoryAddressesByUserId = new Map<string, SavedAddressRecord[]>();

let nativeBusinessTablesAvailable: boolean | null = null;
let nativeBusinessCheckedAt = 0;

async function checkNativeBusinessTables(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const now = Date.now();
  if (nativeBusinessTablesAvailable !== null && now - nativeBusinessCheckedAt < 60_000) {
    return nativeBusinessTablesAvailable;
  }
  try {
    const { error } = await client.from('business_profiles').select('id').limit(1);
    if (error && isMissingTableError(error)) {
      nativeBusinessTablesAvailable = false;
    } else {
      nativeBusinessTablesAvailable = !error;
    }
  } catch {
    nativeBusinessTablesAvailable = false;
  }
  nativeBusinessCheckedAt = now;
  return nativeBusinessTablesAvailable;
}

function requireCaller(
  req: express.Request,
  res: express.Response
): { isAdmin: boolean; session: UserSessionInfo | null; userId: string } | null {
  if (req.method !== 'GET' && !isCsrfSafeMutation(req)) {
    res.status(403).json({ success: false, message: 'Forbidden cross-site mutation request.' });
    return null;
  }
  const isAdmin = verifyAdminTokenFromReq(req);
  const session = isAdmin ? null : verifyUserTokenFromReq(req);
  if (!isAdmin && !session) {
    res.status(401).json({ success: false, message: 'Authentication required for Business Dashboard.' });
    return null;
  }
  const userId =
    isAdmin && typeof req.query.userId === 'string' && req.query.userId.trim()
      ? sanitizeText(req.query.userId, 96)
      : session?.userId || 'admin';
  return { isAdmin, session, userId };
}

async function mirrorBusinessDataToUserDoc(
  userId: string,
  patch: { businessProfile?: BusinessProfileRecord; savedAddresses?: SavedAddressRecord[] }
): Promise<void> {
  try {
    const existingUser = await findSupabaseUserById(userId);
    if (!existingUser) return;
    const updatedUser = {
      ...existingUser,
      ...(patch.businessProfile
        ? {
            businessProfile: patch.businessProfile,
            businessName: patch.businessProfile.company_legal_name || existingUser.businessName,
            gstin: patch.businessProfile.gstin || existingUser.gstin
          }
        : {}),
      ...(patch.savedAddresses ? { savedAddresses: patch.savedAddresses } : {})
    };
    await upsertSupabaseRecords('vs_users', [updatedUser]);
  } catch {
    // Non-fatal mirror failure
  }
}

async function loadBusinessProfile(userId: string): Promise<BusinessProfileRecord | null> {
  if (await checkNativeBusinessTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('business_profiles')
        .select('*')
        .eq('external_user_id', userId)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        const rec: BusinessProfileRecord = {
          id: String(data.id),
          user_id: String(data.user_id || toDeterministicUuid(userId)),
          external_user_id: String(data.external_user_id || userId),
          company_legal_name: String(data.company_legal_name || ''),
          gstin: String(data.gstin || ''),
          billing_address: String(data.billing_address || ''),
          billing_city: String(data.billing_city || 'Guwahati'),
          billing_state: String(data.billing_state || 'Assam'),
          billing_pincode: String(data.billing_pincode || ''),
          contact_person: String(data.contact_person || ''),
          contact_phone: String(data.contact_phone || ''),
          contact_email: String(data.contact_email || ''),
          created_at: String(data.created_at || new Date().toISOString()),
          updated_at: String(data.updated_at || new Date().toISOString())
        };
        memoryProfilesByUserId.set(userId, rec);
        return rec;
      }
      if (error && isMissingTableError(error)) {
        nativeBusinessTablesAvailable = false;
      }
    }
  }

  const mem = memoryProfilesByUserId.get(userId);
  if (mem) return mem;

  const userDoc = await findSupabaseUserById(userId);
  if (userDoc?.businessProfile) {
    const rec = userDoc.businessProfile as BusinessProfileRecord;
    memoryProfilesByUserId.set(userId, rec);
    return rec;
  }

  if (userDoc) {
    const nowIso = new Date().toISOString();
    return {
      id: toDeterministicUuid(`biz_profile:${userId}`),
      user_id: toDeterministicUuid(userId),
      external_user_id: userId,
      company_legal_name: String(userDoc.businessName || userDoc.companyName || ''),
      gstin: String(userDoc.gstin || ''),
      billing_address: String(userDoc.address || ''),
      billing_city: String(userDoc.city || 'Guwahati'),
      billing_state: 'Assam',
      billing_pincode: String(userDoc.pincode || ''),
      contact_person: String(userDoc.name || ''),
      contact_phone: String(userDoc.phone || ''),
      contact_email: String(userDoc.email || ''),
      created_at: nowIso,
      updated_at: nowIso
    };
  }

  return null;
}

async function saveBusinessProfile(record: BusinessProfileRecord): Promise<BusinessProfileRecord> {
  memoryProfilesByUserId.set(record.external_user_id, record);
  if (await checkNativeBusinessTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client.from('business_profiles').upsert(
        {
          id: record.id,
          user_id: record.user_id,
          external_user_id: record.external_user_id,
          company_legal_name: record.company_legal_name,
          gstin: record.gstin || null,
          billing_address: record.billing_address,
          billing_city: record.billing_city,
          billing_state: record.billing_state,
          billing_pincode: record.billing_pincode,
          contact_person: record.contact_person,
          contact_phone: record.contact_phone,
          contact_email: record.contact_email,
          updated_at: record.updated_at
        },
        { onConflict: 'external_user_id' }
      );
      if (error && isMissingTableError(error)) {
        nativeBusinessTablesAvailable = false;
      }
    }
  }
  await mirrorBusinessDataToUserDoc(record.external_user_id, { businessProfile: record });
  return record;
}

async function listSavedAddresses(userId: string): Promise<SavedAddressRecord[]> {
  if (await checkNativeBusinessTables()) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('saved_addresses')
        .select('*')
        .eq('external_user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const mapped: SavedAddressRecord[] = data.map((row: any) => ({
          id: String(row.id),
          user_id: String(row.user_id || toDeterministicUuid(userId)),
          external_user_id: String(row.external_user_id || userId),
          label: String(row.label || ''),
          address_type: (['pickup', 'drop', 'both'].includes(row.address_type)
            ? row.address_type
            : 'both') as SavedAddressType,
          formatted_address: String(row.formatted_address || ''),
          city: String(row.city || ''),
          state: String(row.state || 'Assam'),
          pincode: String(row.pincode || ''),
          lat: typeof row.lat === 'number' ? row.lat : null,
          lng: typeof row.lng === 'number' ? row.lng : null,
          contact_name: String(row.contact_name || ''),
          contact_phone: String(row.contact_phone || ''),
          is_default: Boolean(row.is_default),
          created_at: String(row.created_at || new Date().toISOString()),
          updated_at: String(row.updated_at || new Date().toISOString())
        }));
        memoryAddressesByUserId.set(userId, mapped);
        return mapped;
      }
      if (error && isMissingTableError(error)) {
        nativeBusinessTablesAvailable = false;
      }
    }
  }

  const mem = memoryAddressesByUserId.get(userId);
  if (mem) return mem;

  const userDoc = await findSupabaseUserById(userId);
  if (Array.isArray(userDoc?.savedAddresses)) {
    const list = userDoc.savedAddresses as SavedAddressRecord[];
    memoryAddressesByUserId.set(userId, list);
    return list;
  }

  return [];
}

export const businessRouter = express.Router();

/**
 * GET /api/business/profile
 */
businessRouter.get('/business/profile', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;
    const profile = await loadBusinessProfile(caller.userId);
    return res.status(200).json({ success: true, profile });
  } catch (err: any) {
    console.error(`[Get Business Profile Error] code=${err?.code || 'business_profile_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to load business profile.' });
  }
});

/**
 * PUT /api/business/profile
 */
businessRouter.put('/business/profile', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;

    const body = req.body || {};
    const companyLegalName = sanitizeText(body.company_legal_name || body.companyLegalName, 140);
    const gstin = sanitizeText(body.gstin, 15).toUpperCase();
    const billingAddress = sanitizeText(body.billing_address || body.billingAddress, 300);
    const billingCity = sanitizeText(body.billing_city || body.billingCity || 'Guwahati', 80);
    const billingState = sanitizeText(body.billing_state || body.billingState || 'Assam', 80);
    const billingPincode = sanitizeText(body.billing_pincode || body.billingPincode, 10).replace(/\D/g, '').slice(0, 6);
    const contactPerson = sanitizeText(body.contact_person || body.contactPerson, 100);
    const contactPhone = sanitizeText(body.contact_phone || body.contactPhone, 20);
    const contactEmail = sanitizeText(body.contact_email || body.contactEmail, 120);

    if (!companyLegalName || companyLegalName.length < 2) {
      return res.status(400).json({ success: false, message: 'Company Legal Name is required.' });
    }
    if (gstin && !INDIAN_GSTIN_REGEX.test(gstin)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GSTIN format. Must be a valid 15-character Indian GSTIN (e.g., 18AAAFK4902L1ZQ).'
      });
    }
    if (!billingAddress || billingAddress.length < 5) {
      return res.status(400).json({ success: false, message: 'Billing Address is required.' });
    }

    const existing = await loadBusinessProfile(caller.userId);
    const nowIso = new Date().toISOString();
    const record: BusinessProfileRecord = {
      id: existing?.id || toDeterministicUuid(`biz_profile:${caller.userId}`),
      user_id: toDeterministicUuid(caller.userId),
      external_user_id: caller.userId,
      company_legal_name: companyLegalName,
      gstin,
      billing_address: billingAddress,
      billing_city: billingCity,
      billing_state: billingState,
      billing_pincode: billingPincode,
      contact_person: contactPerson,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso
    };

    const saved = await saveBusinessProfile(record);
    return res.status(200).json({ success: true, profile: saved });
  } catch (err: any) {
    console.error(`[Save Business Profile Error] code=${err?.code || 'save_profile_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to save business profile.' });
  }
});

/**
 * GET /api/business/addresses
 */
businessRouter.get('/business/addresses', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;
    const addresses = await listSavedAddresses(caller.userId);
    return res.status(200).json({ success: true, addresses });
  } catch (err: any) {
    console.error(`[List Saved Addresses Error] code=${err?.code || 'list_addr_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to load saved business locations.' });
  }
});

/**
 * POST /api/business/addresses
 */
businessRouter.post('/business/addresses', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;

    const body = req.body || {};
    const label = sanitizeText(body.label, 80);
    const rawType = String(body.address_type || body.addressType || 'both').toLowerCase();
    const addressType: SavedAddressType =
      rawType === 'pickup' || rawType === 'drop' || rawType === 'both' ? rawType : 'both';
    const formattedAddress = sanitizeText(body.formatted_address || body.formattedAddress, 300);
    const city = sanitizeText(body.city, 80);
    const state = sanitizeText(body.state || 'Assam', 80);
    const pincode = sanitizeText(body.pincode, 10).replace(/\D/g, '').slice(0, 6);
    const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
    const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;
    const contactName = sanitizeText(body.contact_name || body.contactName, 100);
    const contactPhone = sanitizeText(body.contact_phone || body.contactPhone, 20);
    const isDefault = Boolean(body.is_default || body.isDefault);

    if (!label || !formattedAddress || !city) {
      return res.status(400).json({
        success: false,
        message: 'Label, full address, and city are required to save a location.'
      });
    }

    const current = await listSavedAddresses(caller.userId);
    if (current.length >= 50) {
      return res.status(400).json({ success: false, message: 'Maximum 50 saved locations allowed per account.' });
    }

    const nowIso = new Date().toISOString();
    const newAddr: SavedAddressRecord = {
      id: crypto.randomUUID(),
      user_id: toDeterministicUuid(caller.userId),
      external_user_id: caller.userId,
      label,
      address_type: addressType,
      formatted_address: formattedAddress,
      city,
      state,
      pincode,
      lat,
      lng,
      contact_name: contactName,
      contact_phone: contactPhone,
      is_default: isDefault,
      created_at: nowIso,
      updated_at: nowIso
    };

    const nextList = [
      newAddr,
      ...current.map((item) => (isDefault && item.address_type === addressType ? { ...item, is_default: false } : item))
    ];
    memoryAddressesByUserId.set(caller.userId, nextList);

    if (await checkNativeBusinessTables()) {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client.from('saved_addresses').insert({
          id: newAddr.id,
          user_id: newAddr.user_id,
          external_user_id: newAddr.external_user_id,
          label: newAddr.label,
          address_type: newAddr.address_type,
          formatted_address: newAddr.formatted_address,
          city: newAddr.city,
          state: newAddr.state,
          pincode: newAddr.pincode,
          lat: newAddr.lat,
          lng: newAddr.lng,
          contact_name: newAddr.contact_name,
          contact_phone: newAddr.contact_phone,
          is_default: newAddr.is_default
        });
        if (error && isMissingTableError(error)) {
          nativeBusinessTablesAvailable = false;
        }
      }
    }

    await mirrorBusinessDataToUserDoc(caller.userId, { savedAddresses: nextList });
    return res.status(201).json({ success: true, address: newAddr, addresses: nextList });
  } catch (err: any) {
    console.error(`[Create Saved Address Error] code=${err?.code || 'create_addr_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to save business location.' });
  }
});

/**
 * DELETE /api/business/addresses/:id
 */
businessRouter.delete('/business/addresses/:id', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;

    const targetId = sanitizeText(req.params.id, 80);
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Address ID is required.' });
    }

    const current = await listSavedAddresses(caller.userId);
    const exists = current.some((a) => a.id === targetId && a.external_user_id === caller.userId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Saved location not found.' });
    }

    const nextList = current.filter((a) => a.id !== targetId);
    memoryAddressesByUserId.set(caller.userId, nextList);

    if (await checkNativeBusinessTables()) {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client
          .from('saved_addresses')
          .delete()
          .eq('id', targetId)
          .eq('external_user_id', caller.userId);
        if (error && isMissingTableError(error)) {
          nativeBusinessTablesAvailable = false;
        }
      }
    }

    await mirrorBusinessDataToUserDoc(caller.userId, { savedAddresses: nextList });
    return res.status(200).json({ success: true, addresses: nextList });
  } catch (err: any) {
    console.error(`[Delete Saved Address Error] code=${err?.code || 'delete_addr_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to delete saved business location.' });
  }
});

/**
 * GET /api/business/documents/:tripId/pod
 * Fetches signed Proof of Delivery image/PDF for an authorized trip owned by the caller.
 * Checks Supabase Storage bucket `trip-documents` first (15-min signed URL), falling back to
 * verified `podDocumentUrl` stored on the booking/trip record.
 */
businessRouter.get('/business/documents/:tripId/pod', async (req, res) => {
  try {
    const caller = requireCaller(req, res);
    if (!caller) return;

    const tripId = sanitizeText(req.params.tripId, 96);
    if (!tripId) {
      return res.status(400).json({ success: false, message: 'tripId is required.' });
    }

    const booking = await findSupabaseBookingById(tripId);
    if (booking && !caller.isAdmin && caller.session) {
      const isOwner =
        booking.customerId === caller.session.userId ||
        booking.driverId === caller.session.userId ||
        booking.transporterId === caller.session.userId;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view this trip POD.'
        });
      }
    }

    const client = getSupabaseClient();
    const storagePath = sanitizeText(booking?.podStoragePath || booking?.pod_storage_path || '', 240);

    // 1. Try explicit Supabase Storage path inside `trip-documents` bucket
    if (client && storagePath && !storagePath.includes('..') && !storagePath.startsWith('/')) {
      try {
        const { data: signed, error } = await client.storage
          .from('trip-documents')
          .createSignedUrl(storagePath, 900);
        if (!error && signed?.signedUrl) {
          return res.status(200).json({
            success: true,
            source: 'supabase_storage',
            podUrl: signed.signedUrl,
            fileName: storagePath.split('/').pop() || `POD_${tripId}.jpg`,
            uploadedAt: booking?.podUploadedAt || booking?.deliveredAt || booking?.updatedAt || null
          });
        }
      } catch {
        // Fall through to storage prefix scan / booking document URL
      }
    }

    // 2. Check if driver uploaded a POD file under `pod/{tripId}/` in Supabase Storage `trip-documents`
    if (client && /^[a-zA-Z0-9_-]{3,80}$/.test(tripId)) {
      try {
        const { data: files } = await client.storage.from('trip-documents').list(`pod/${tripId}`, { limit: 5 });
        const firstDoc = (files || []).find((f: any) => f?.name && !f.name.startsWith('.'));
        if (firstDoc) {
          const pathInBucket = `pod/${tripId}/${firstDoc.name}`;
          const { data: signed } = await client.storage
            .from('trip-documents')
            .createSignedUrl(pathInBucket, 900);
          if (signed?.signedUrl) {
            return res.status(200).json({
              success: true,
              source: 'supabase_storage',
              podUrl: signed.signedUrl,
              fileName: firstDoc.name,
              uploadedAt: firstDoc.updated_at || firstDoc.created_at || null
            });
          }
        }
      } catch {
        // Bucket may not be provisioned yet; fall back cleanly
      }
    }

    // 3. Fallback to booking's verified podDocumentUrl (captured camera POD data URL or URL)
    const fallbackUrl = booking?.podDocumentUrl || booking?.pod_document_url || null;
    if (fallbackUrl && typeof fallbackUrl === 'string') {
      return res.status(200).json({
        success: true,
        source: 'booking_record',
        podUrl: fallbackUrl,
        fileName: `POD_${tripId}.jpg`,
        uploadedAt: booking?.podUploadedAt || booking?.deliveredAt || booking?.updatedAt || null
      });
    }

    return res.status(200).json({
      success: true,
      source: 'none',
      podUrl: null,
      message: 'POD has not been uploaded by the driver yet.'
    });
  } catch (err: any) {
    console.error(`[Get Trip POD Document Error] code=${err?.code || 'pod_doc_error'}`);
    return res.status(500).json({ success: false, message: 'Failed to retrieve POD document.' });
  }
});
