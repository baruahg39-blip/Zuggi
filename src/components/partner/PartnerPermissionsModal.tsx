import React, { useCallback, useEffect, useState } from 'react';
import {
  MapPin,
  Camera,
  Bell,
  Users,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  X,
  Loader2,
  FolderCheck
} from 'lucide-react';
import {
  DevicePermissionState,
  DevicePermissionsSnapshot,
  areCoreDriverPermissionsGranted,
  getDevicePermissionsSnapshot,
  markPartnerPermissionsAcknowledged,
  requestCameraPermission,
  requestContactsAccess,
  requestLocationPermission,
  requestNotificationPermission,
  saveEmergencyContact
} from '../../utils/devicePermissions';
import { showToast } from '../shared/Toast';

interface PartnerPermissionsModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onPermissionsUpdated?: (snapshot: DevicePermissionsSnapshot) => void;
}

const INITIAL_SNAPSHOT: DevicePermissionsSnapshot = {
  location: 'prompt',
  camera: 'prompt',
  notifications: 'prompt',
  contacts: 'prompt',
  contactsPickerSupported: false,
  emergencyContact: null,
  lastKnownCoords: null
};

export const PartnerPermissionsModal: React.FC<PartnerPermissionsModalProps> = ({
  isOpen,
  userId,
  onClose,
  onPermissionsUpdated
}) => {
  const [snapshot, setSnapshot] = useState<DevicePermissionsSnapshot>(INITIAL_SNAPSHOT);
  const [busyKey, setBusyKey] = useState<'all' | 'location' | 'camera' | 'notifications' | 'contacts' | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [showManualContact, setShowManualContact] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const refreshSnapshot = useCallback(async () => {
    const next = await getDevicePermissionsSnapshot();
    setSnapshot(next);
    onPermissionsUpdated?.(next);
    window.dispatchEvent(new CustomEvent('zuggi-permissions-updated'));
    return next;
  }, [onPermissionsUpdated]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorNote(null);
    void refreshSnapshot();
  }, [isOpen, refreshSnapshot]);

  if (!isOpen) return null;

  const handleRequestLocation = async () => {
    setBusyKey('location');
    setErrorNote(null);
    const res = await requestLocationPermission();
    const next = await refreshSnapshot();
    setBusyKey(null);
    if (res.status === 'granted') {
      showToast('GPS location access enabled for live tracking.', 'success');
    } else if (res.error) {
      setErrorNote(res.error);
    }
    return next;
  };

  const handleRequestCamera = async () => {
    setBusyKey('camera');
    setErrorNote(null);
    const res = await requestCameraPermission();
    const next = await refreshSnapshot();
    setBusyKey(null);
    if (res.status === 'granted') {
      showToast('Camera access enabled for e-POD and KYC documents.', 'success');
    } else if (res.error) {
      setErrorNote(res.error);
    }
    return next;
  };

  const handleRequestNotifications = async () => {
    setBusyKey('notifications');
    setErrorNote(null);
    const res = await requestNotificationPermission();
    const next = await refreshSnapshot();
    setBusyKey(null);
    if (res.status === 'granted') {
      showToast('Load and payout alerts enabled.', 'success');
    } else if (res.error) {
      setErrorNote(res.error);
    }
    return next;
  };

  const handleRequestContacts = async () => {
    setErrorNote(null);
    if (!snapshot.contactsPickerSupported) {
      setShowManualContact(true);
      return;
    }
    setBusyKey('contacts');
    const res = await requestContactsAccess();
    await refreshSnapshot();
    setBusyKey(null);
    if (res.status === 'granted' && res.contact) {
      showToast(`Saved emergency / co-driver contact: ${res.contact.name}`, 'success');
      setShowManualContact(false);
    } else if (res.error) {
      setErrorNote(res.error);
      setShowManualContact(true);
    }
  };

  const handleSaveManualContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = manualPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setErrorNote('Please enter a valid 10-digit mobile number for your co-driver or emergency contact.');
      return;
    }
    saveEmergencyContact(manualName || 'Co-Driver / Emergency', manualPhone, 'manual');
    setShowManualContact(false);
    setManualName('');
    setManualPhone('');
    setErrorNote(null);
    await refreshSnapshot();
    showToast('Emergency / co-driver contact saved.', 'success');
  };

  const handleAllowAllRequired = async () => {
    setBusyKey('all');
    setErrorNote(null);
    const errors: string[] = [];

    if (snapshot.location !== 'granted' && snapshot.location !== 'unsupported') {
      const locRes = await requestLocationPermission();
      if (locRes.error && locRes.status !== 'granted') errors.push(locRes.error);
    }

    if (snapshot.camera !== 'granted' && snapshot.camera !== 'unsupported') {
      const camRes = await requestCameraPermission();
      if (camRes.error && camRes.status !== 'granted') errors.push(camRes.error);
    }

    if (snapshot.notifications !== 'granted' && snapshot.notifications !== 'unsupported') {
      const notifRes = await requestNotificationPermission();
      if (notifRes.error && notifRes.status !== 'granted') errors.push(notifRes.error);
    }

    const latest = await refreshSnapshot();
    setBusyKey(null);

    if (errors.length > 0) {
      setErrorNote(errors[0]);
      return;
    }

    if (areCoreDriverPermissionsGranted(latest)) {
      markPartnerPermissionsAcknowledged(userId);
      showToast('All required driver permissions are active.', 'success');
    }
  };

  const handleDone = () => {
    markPartnerPermissionsAcknowledged(userId);
    onClose();
  };

  const coreReady = areCoreDriverPermissionsGranted(snapshot);
  const anyDenied =
    snapshot.location === 'denied' || snapshot.camera === 'denied' || snapshot.notifications === 'denied';

  const renderStatusText = (state: DevicePermissionState, optional = false) => {
    if (state === 'granted') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Allowed</span>
        </span>
      );
    }
    if (state === 'denied') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Blocked</span>
        </span>
      );
    }
    if (state === 'unsupported') {
      return <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Handled by device</span>;
    }
    return (
      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
        {optional ? 'Recommended' : 'Required'}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-permissions-title"
    >
      <div className="w-full max-w-lg bg-white text-[#171318] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="partner-permissions-title" className="text-base sm:text-lg font-extrabold text-[#171318] leading-snug">
                Enable Driver App Permissions
              </h2>
              <p className="text-xs text-[#6B6470] mt-0.5 leading-relaxed">
                Zuggi Partner requires device access for live GPS trip tracking, e-POD camera photos, load alerts, and highway emergency contacts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDone}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 rounded-xl flex items-center justify-center text-gray-500 hover:text-[#171318] hover:bg-gray-100 transition cursor-pointer"
            aria-label="Close permissions dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Permission Rows */}
        <div className="flex-1 overflow-y-auto px-5 divide-y divide-gray-100">
          {/* 1. Location */}
          <div className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[#171318]">Precise Location (GPS)</h3>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  {renderStatusText(snapshot.location)}
                </div>
                <p className="text-xs text-[#6B6470] mt-0.5 leading-relaxed">
                  Shares live truck location during active trips, verifies pickup/drop arrival, and matches nearby loads.
                </p>
              </div>
            </div>
            {snapshot.location !== 'granted' && snapshot.location !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={busyKey !== null}
                className="min-h-[44px] px-4 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busyKey === 'location' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allow'}
              </button>
            )}
          </div>

          {/* 2. Camera */}
          <div className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center shrink-0 mt-0.5">
                <Camera className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[#171318]">Camera &amp; Document Scan</h3>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  {renderStatusText(snapshot.camera)}
                </div>
                <p className="text-xs text-[#6B6470] mt-0.5 leading-relaxed">
                  Capture Proof of Delivery (e-POD), signed Lorry Receipt / Bilty, and RC / Driving Licence KYC photos.
                </p>
              </div>
            </div>
            {snapshot.camera !== 'granted' && snapshot.camera !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestCamera}
                disabled={busyKey !== null}
                className="min-h-[44px] px-4 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busyKey === 'camera' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allow'}
              </button>
            )}
          </div>

          {/* 3. Notifications */}
          <div className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[#171318]">Load &amp; Payout Alerts</h3>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  {renderStatusText(snapshot.notifications)}
                </div>
                <p className="text-xs text-[#6B6470] mt-0.5 leading-relaxed">
                  Instant notifications when a shipper posts a nearby load, accepts your bid, or releases freight advance.
                </p>
              </div>
            </div>
            {snapshot.notifications !== 'granted' && snapshot.notifications !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestNotifications}
                disabled={busyKey !== null}
                className="min-h-[44px] px-4 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busyKey === 'notifications' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Allow'}
              </button>
            )}
          </div>

          {/* 4. Contacts (Emergency / Co-Driver) */}
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#171318]">Contacts (Co-Driver / Emergency)</h3>
                    <span className="text-gray-300" aria-hidden="true">·</span>
                    {snapshot.emergencyContact ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Saved</span>
                      </span>
                    ) : (
                      renderStatusText(snapshot.contacts, true)
                    )}
                  </div>
                  <p className="text-xs text-[#6B6470] mt-0.5 leading-relaxed">
                    Select a helper, fleet owner, or family contact from your phonebook for highway emergency support. We only store the contact you pick.
                  </p>
                  {snapshot.emergencyContact && (
                    <p className="text-xs font-semibold text-[#171318] mt-1 font-mono tabular-nums">
                      {snapshot.emergencyContact.name} · {snapshot.emergencyContact.phone}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestContacts}
                disabled={busyKey !== null}
                className="min-h-[44px] px-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busyKey === 'contacts'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : snapshot.emergencyContact
                  ? 'Change'
                  : snapshot.contactsPickerSupported
                  ? 'Pick Contact'
                  : 'Add Number'}
              </button>
            </div>

            {showManualContact && (
              <form onSubmit={handleSaveManualContact} className="pl-13 space-y-2.5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Co-driver / Owner name"
                    className="min-h-[44px] px-3 rounded-xl border border-gray-300 text-xs text-[#171318] focus:border-[#E83E83] outline-none"
                  />
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                    className="min-h-[44px] px-3 rounded-xl border border-gray-300 text-xs text-[#171318] font-mono focus:border-[#E83E83] outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold transition cursor-pointer"
                  >
                    Save Emergency Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualContact(false)}
                    className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 5. Phone Dialer & Secure Photo Upload note (Play Store compliant) */}
          <div className="py-3.5 flex items-center gap-6 text-xs text-[#6B6470]">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-gray-500 shrink-0" />
              <span>1-tap Call uses phone dialer</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Gallery uses secure photo picker</span>
            </div>
          </div>

          {/* Feedback / Blocked instructions */}
          {(errorNote || anyDenied) && (
            <div className="py-3.5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-semibold">
                  {errorNote || 'One or more permissions are currently blocked in your browser or phone settings.'}
                </p>
                {anyDenied && (
                  <p className="text-[11px] text-amber-900">
                    To turn them back on: tap the lock/tune icon in your Chrome address bar (or Android Settings → Apps → Zuggi App → Permissions) and set Location, Camera, and Notifications to Allow.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Thumb-Zone Primary CTA */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-2">
          {!coreReady ? (
            <button
              type="button"
              onClick={handleAllowAllRequired}
              disabled={busyKey !== null}
              className="w-full min-h-[48px] px-5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 transition shadow-md shadow-[#E83E83]/20 cursor-pointer disabled:opacity-60"
            >
              {busyKey === 'all' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Requesting Device Access...</span>
                </>
              ) : (
                <span>Allow Required Permissions</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDone}
              className="w-full min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>All Set — Continue to Partner App</span>
            </button>
          )}

          {!coreReady && (
            <button
              type="button"
              onClick={handleDone}
              className="w-full min-h-[40px] text-xs font-semibold text-[#6B6470] hover:text-[#171318] transition cursor-pointer"
            >
              Continue for now (you can enable anytime from Dashboard)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
