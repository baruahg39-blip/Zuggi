export type DevicePermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface EmergencyContactRecord {
  name: string;
  phone: string;
  source: 'contact_picker' | 'manual';
  savedAt: string;
}

export interface DevicePermissionsSnapshot {
  location: DevicePermissionState;
  camera: DevicePermissionState;
  notifications: DevicePermissionState;
  contacts: DevicePermissionState;
  contactsPickerSupported: boolean;
  emergencyContact: EmergencyContactRecord | null;
  lastKnownCoords: { lat: number; lng: number } | null;
}

const STORAGE_ACK_PREFIX = 'zuggi_partner_permissions_ack_v1_';
const STORAGE_CONTACT_KEY = 'zuggi_partner_emergency_contact_v1';
const STORAGE_CAMERA_GRANTED_KEY = 'zuggi_camera_permission_granted_v1';
const STORAGE_COORDS_KEY = 'zuggi_last_known_coords_v1';

interface ContactPickerEntry {
  name?: string[];
  tel?: string[];
}

interface NavigatorWithContacts extends Navigator {
  contacts?: {
    select: (properties: string[], options?: { multiple?: boolean }) => Promise<ContactPickerEntry[]>;
    getProperties?: () => Promise<string[]>;
  };
}

export function isContactPickerSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithContacts;
  return Boolean(nav.contacts && typeof nav.contacts.select === 'function');
}

export function getSavedEmergencyContact(): EmergencyContactRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_CONTACT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmergencyContactRecord;
    if (parsed && parsed.phone) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveEmergencyContact(
  name: string,
  phone: string,
  source: 'contact_picker' | 'manual'
): EmergencyContactRecord {
  const record: EmergencyContactRecord = {
    name: name.trim() || 'Emergency / Co-Driver',
    phone: phone.trim(),
    source,
    savedAt: new Date().toISOString()
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_CONTACT_KEY, JSON.stringify(record));
  }
  return record;
}

export function getLastKnownCoords(): { lat: number; lng: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number };
    if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng)) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function queryBrowserPermission(name: 'geolocation' | 'camera'): Promise<DevicePermissionState | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getDevicePermissionsSnapshot(): Promise<DevicePermissionsSnapshot> {
  const hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const hasCamera = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasNotifications = typeof window !== 'undefined' && 'Notification' in window;
  const contactsPickerSupported = isContactPickerSupported();
  const emergencyContact = getSavedEmergencyContact();
  const lastKnownCoords = getLastKnownCoords();

  let location: DevicePermissionState = hasGeolocation ? 'prompt' : 'unsupported';
  if (hasGeolocation) {
    const queried = await queryBrowserPermission('geolocation');
    if (queried) {
      location = queried;
    } else if (lastKnownCoords) {
      location = 'granted';
    }
  }

  let camera: DevicePermissionState = hasCamera ? 'prompt' : 'unsupported';
  if (hasCamera) {
    const queried = await queryBrowserPermission('camera');
    if (queried) {
      camera = queried;
    } else if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_CAMERA_GRANTED_KEY) === '1') {
      camera = 'granted';
    }
  }

  let notifications: DevicePermissionState = 'unsupported';
  if (hasNotifications) {
    const perm = window.Notification.permission;
    notifications = perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt';
  }

  let contacts: DevicePermissionState = 'unsupported';
  if (emergencyContact) {
    contacts = 'granted';
  } else if (contactsPickerSupported) {
    contacts = 'prompt';
  }

  return {
    location,
    camera,
    notifications,
    contacts,
    contactsPickerSupported,
    emergencyContact,
    lastKnownCoords
  };
}

export function requestLocationPermission(): Promise<{
  status: DevicePermissionState;
  lat?: number;
  lng?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ status: 'unsupported', error: 'GPS location is not supported on this device.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_COORDS_KEY, JSON.stringify(coords));
        }
        resolve({ status: 'granted', lat: coords.lat, lng: coords.lng });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            status: 'denied',
            error: 'Location permission was denied. Enable it in browser or phone App Settings.'
          });
        } else {
          resolve({
            status: 'prompt',
            error: 'Could not lock GPS signal right now. Please ensure Location / GPS is switched on.'
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export async function requestCameraPermission(): Promise<{
  status: DevicePermissionState;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { status: 'unsupported', error: 'Camera access is not supported in this browser.' };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    // Release camera immediately after permission grant so hardware indicator turns off
    stream.getTracks().forEach((track) => track.stop());
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_CAMERA_GRANTED_KEY, '1');
    }
    return { status: 'granted' };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        status: 'denied',
        error: 'Camera access was blocked. Allow Camera in browser or phone App Settings.'
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        status: 'unsupported',
        error: 'No camera detected on this device. You can still upload POD photos from files.'
      };
    }
    return {
      status: 'prompt',
      error: 'Could not open camera right now. Please try again.'
    };
  }
}

export async function requestNotificationPermission(): Promise<{
  status: DevicePermissionState;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { status: 'unsupported', error: 'Notifications are not supported on this browser.' };
  }

  try {
    const result = await window.Notification.requestPermission();
    if (result === 'granted') {
      return { status: 'granted' };
    }
    if (result === 'denied') {
      return {
        status: 'denied',
        error: 'Notifications are blocked. Enable them in site/app settings to receive instant load alerts.'
      };
    }
    return { status: 'prompt' };
  } catch {
    return { status: 'unsupported', error: 'Unable to request notification permission.' };
  }
}

export async function requestContactsAccess(): Promise<{
  status: DevicePermissionState;
  contact?: EmergencyContactRecord;
  error?: string;
}> {
  if (!isContactPickerSupported()) {
    return {
      status: 'unsupported',
      error: 'Direct phone contact picker is supported on Android Chrome. Enter your emergency or co-driver number below.'
    };
  }

  try {
    const nav = navigator as NavigatorWithContacts;
    const selected = await nav.contacts!.select(['name', 'tel'], { multiple: false });
    if (!selected || selected.length === 0) {
      return { status: 'prompt', error: 'No contact selected.' };
    }
    const entry = selected[0];
    const name = entry.name?.[0] || 'Co-Driver / Emergency Contact';
    const phone = entry.tel?.[0] || '';
    if (!phone) {
      return { status: 'prompt', error: 'Selected contact has no phone number.' };
    }
    const saved = saveEmergencyContact(name, phone, 'contact_picker');
    return { status: 'granted', contact: saved };
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      return { status: 'prompt' };
    }
    return {
      status: 'prompt',
      error: 'Could not open phone contacts. You can type your co-driver or emergency number below.'
    };
  }
}

export function hasAcknowledgedPartnerPermissions(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  return window.localStorage.getItem(`${STORAGE_ACK_PREFIX}${userId}`) === '1';
}

export function markPartnerPermissionsAcknowledged(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(`${STORAGE_ACK_PREFIX}${userId}`, '1');
}

export function areCoreDriverPermissionsGranted(snapshot: DevicePermissionsSnapshot): boolean {
  const locOk = snapshot.location === 'granted' || snapshot.location === 'unsupported';
  const camOk = snapshot.camera === 'granted' || snapshot.camera === 'unsupported';
  return locOk && camOk;
}
