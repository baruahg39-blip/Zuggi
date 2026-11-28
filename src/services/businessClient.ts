import { logisticsStore } from './store';
import type { GoodsCategory, LocationPoint, VehicleCategoryType } from '../types';

export interface BusinessProfile {
  id: string;
  user_id?: string;
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
  created_at?: string;
  updated_at?: string;
}

export type SavedAddressType = 'pickup' | 'drop' | 'both';

export interface SavedBusinessAddress {
  id: string;
  external_user_id?: string;
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
  created_at?: string;
}

export interface RebookTripPrefill {
  sourceTripId: string;
  pickup: LocationPoint;
  delivery: LocationPoint;
  requiredVehicleCategory: VehicleCategoryType;
  goodsCategory: GoodsCategory;
  goodsDescription: string;
  weightKg: number;
  packageCount: number;
}

export const INDIAN_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const GST_STATE_CODES: Record<string, string> = {
  '07': 'Delhi',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '33': 'Tamil Nadu',
  '36': 'Telangana'
};

export function validateIndianGstin(raw: string): {
  valid: boolean;
  normalized: string;
  stateName?: string;
  error?: string;
} {
  const normalized = String(raw || '').trim().toUpperCase();
  if (!normalized) {
    return { valid: true, normalized: '' };
  }
  if (normalized.length !== 15) {
    return {
      valid: false,
      normalized,
      error: `GSTIN must be 15 characters (currently ${normalized.length}).`
    };
  }
  if (!INDIAN_GSTIN_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Invalid 15-digit GSTIN pattern (example: 18AAAFK4902L1ZQ).'
    };
  }
  const stateCode = normalized.slice(0, 2);
  return {
    valid: true,
    normalized,
    stateName: GST_STATE_CODES[stateCode] || `State Code ${stateCode}`
  };
}

function profileCacheKey(userId: string): string {
  return `zuggi_biz_profile_${userId}`;
}

function addrCacheKey(userId: string): string {
  return `zuggi_biz_addresses_${userId}`;
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

async function bizRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const isMutation = Boolean(init?.method && init.method !== 'GET');
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...logisticsStore.buildAuthHeaders(isMutation),
      ...(init?.headers || {})
    }
  });
  const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
  return data as T;
}

export const businessClient = {
  getCachedProfile(userId: string): BusinessProfile | null {
    return readCache<BusinessProfile>(profileCacheKey(userId));
  },

  getCachedAddresses(userId: string): SavedBusinessAddress[] {
    return readCache<SavedBusinessAddress[]>(addrCacheKey(userId)) || [];
  },

  async getProfile(userId?: string): Promise<{ success: boolean; profile: BusinessProfile | null; message?: string }> {
    try {
      const resp = await bizRequest<{ success: boolean; profile: BusinessProfile | null; message?: string }>(
        '/api/business/profile',
        { method: 'GET' }
      );
      if (resp.success && resp.profile && userId) {
        writeCache(profileCacheKey(userId), resp.profile);
      }
      return resp;
    } catch {
      const cached = userId ? readCache<BusinessProfile>(profileCacheKey(userId)) : null;
      return { success: Boolean(cached), profile: cached };
    }
  },

  async saveProfile(
    userId: string,
    payload: Omit<BusinessProfile, 'id' | 'external_user_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; profile?: BusinessProfile; message?: string }> {
    const resp = await bizRequest<{ success: boolean; profile?: BusinessProfile; message?: string }>(
      '/api/business/profile',
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      }
    );
    if (resp.success && resp.profile) {
      writeCache(profileCacheKey(userId), resp.profile);
      // Sync local store profile display name & GSTIN cleanly
      const current = logisticsStore.getCurrentUser();
      if (current && current.id === userId) {
        logisticsStore.setCurrentUser({
          ...current,
          businessName: resp.profile.company_legal_name || current.businessName,
          gstin: resp.profile.gstin || current.gstin
        });
      }
    }
    return resp;
  },

  async listSavedAddresses(userId?: string): Promise<{ success: boolean; addresses: SavedBusinessAddress[]; message?: string }> {
    try {
      const resp = await bizRequest<{ success: boolean; addresses: SavedBusinessAddress[]; message?: string }>(
        '/api/business/addresses',
        { method: 'GET' }
      );
      if (resp.success && Array.isArray(resp.addresses) && userId) {
        writeCache(addrCacheKey(userId), resp.addresses);
      }
      return {
        success: resp.success,
        addresses: Array.isArray(resp.addresses) ? resp.addresses : [],
        message: resp.message
      };
    } catch {
      const cached = userId ? readCache<SavedBusinessAddress[]>(addrCacheKey(userId)) || [] : [];
      return { success: true, addresses: cached };
    }
  },

  async addSavedAddress(
    userId: string,
    payload: Omit<SavedBusinessAddress, 'id' | 'external_user_id' | 'created_at'>
  ): Promise<{ success: boolean; address?: SavedBusinessAddress; addresses?: SavedBusinessAddress[]; message?: string }> {
    const resp = await bizRequest<{
      success: boolean;
      address?: SavedBusinessAddress;
      addresses?: SavedBusinessAddress[];
      message?: string;
    }>('/api/business/addresses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (resp.success && Array.isArray(resp.addresses)) {
      writeCache(addrCacheKey(userId), resp.addresses);
    }
    return resp;
  },

  async deleteSavedAddress(
    userId: string,
    addressId: string
  ): Promise<{ success: boolean; addresses?: SavedBusinessAddress[]; message?: string }> {
    const resp = await bizRequest<{
      success: boolean;
      addresses?: SavedBusinessAddress[];
      message?: string;
    }>(`/api/business/addresses/${encodeURIComponent(addressId)}`, {
      method: 'DELETE'
    });
    if (resp.success && Array.isArray(resp.addresses)) {
      writeCache(addrCacheKey(userId), resp.addresses);
    }
    return resp;
  },

  async fetchTripPodDocument(tripId: string): Promise<{
    success: boolean;
    source?: 'supabase_storage' | 'booking_record' | 'none';
    podUrl: string | null;
    fileName?: string;
    uploadedAt?: string | null;
    message?: string;
  }> {
    return bizRequest(`/api/business/documents/${encodeURIComponent(tripId)}/pod`, { method: 'GET' });
  }
};
