import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  User as UserIcon, 
  Phone, 
  CheckCircle2, 
  ShieldCheck, 
  LogOut, 
  Truck, 
  ShieldAlert,
  Clock,
  Trash2
} from 'lucide-react';
import { User, VehicleCategoryType } from '../../types';
import { logisticsStore } from '../../services/store';
import { authService } from '../../services/authService';
import { navigateSpa } from '../../utils/seo';
import { VEHICLE_CATEGORIES } from '../../data/mockData';

interface CustomerProfileModalProps {
  currentUser: User;
  portalMode?: 'web' | 'partner';
  onClose: () => void;
  onUserSwitched?: (user: User) => void;
  onOpenAuth?: () => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  currentUser,
  portalMode = 'web',
  onClose,
  onUserSwitched,
  onOpenAuth
}) => {
  // Shipper form fields
  const [shipperType, setShipperType] = useState<'individual' | 'company'>(
    currentUser.businessName ? 'company' : 'individual'
  );
  const [name, setName] = useState(currentUser.name || '');
  const [businessName, setBusinessName] = useState(currentUser.businessName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [gstin, setGstin] = useState(currentUser.gstin || '');
  const [pan, setPan] = useState(currentUser.pan || '');
  const [address, setAddress] = useState(currentUser.address || '');
  const [city, setCity] = useState(currentUser.city || 'Guwahati');
  const [state] = useState(currentUser.state || 'Assam');

  // Driver / Transporter form fields
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [fleetSize, setFleetSize] = useState(1);
  const [dlNumber, setDlNumber] = useState('AS-01-2022-0049182');
  const [vehicleReg, setVehicleReg] = useState('AS-01-GC-9921');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategoryType>('tata_ace');
  const [insuranceNumber, setInsuranceNumber] = useState('NIC/COMM/2026/89410');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await fetch('/api/auth/request-account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: currentUser.phone,
          reason: 'Requested in-app via Profile settings',
          source: portalMode === 'partner' ? 'partner_app_profile' : 'web_profile'
        })
      }).catch(() => {});
    } finally {
      setIsDeletingAccount(false);
      onClose();
      await authService.logout();
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedUser: User = {
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      businessName: currentUser.role === 'customer'
        ? (shipperType === 'company' ? businessName.trim() : `${name.trim()} (Individual)`)
        : (businessName.trim() || `${name.trim()} Transport`),
      gstin: gstin.trim().toUpperCase() || undefined,
      pan: pan.trim().toUpperCase() || undefined,
      address: address.trim() || undefined,
      city,
      state
    };

    logisticsStore.saveUser(updatedUser);
    logisticsStore.setCurrentUser(updatedUser);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    onClose();
    await authService.logout();
  };

  const isShipper = currentUser.role === 'customer';
  const isDriver = currentUser.role === 'driver' || currentUser.role === 'transporter';
  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-gray-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] text-[#171318]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#171318] text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E83E83] flex items-center justify-center text-white font-bold shrink-0 shadow-md">
              {isShipper && <Building2 className="w-5 h-5 text-white" />}
              {isDriver && <Truck className="w-5 h-5 text-white" />}
              {isAdmin && <ShieldAlert className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  {isShipper && 'Truck Booking Profile'}
                  {isDriver && 'Driver & Fleet Profile'}
                  {isAdmin && 'Platform Owner Profile'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-[#FFF0F6] text-[#E83E83]">
                  {isShipper ? 'Book a Truck' : currentUser.role.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Official Marketplace Credentials & Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-[#171318]">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile credentials saved successfully!</span>
            </div>
          )}

          {/* VERIFIED MOBILE NUMBER CARD (Locked to Authenticated SIM) */}
          <div className="p-3.5 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#E83E83]/30 flex items-center justify-center text-[#E83E83] shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-[#77717A] block font-semibold">Verified Mobile Number</span>
                <span className="text-xs font-bold text-[#171318] font-mono">
                  {currentUser.phone || '+91 Authenticated'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-[10px] font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>OTP Verified</span>
            </div>
          </div>

          {/* ACTIVE PORTAL BADGE */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-[#171318] block text-xs">
                {portalMode === 'partner' ? 'Partner Mobile App Account' : 'Zuggi Truck Booking Account'}
              </span>
              <span className="text-[10px] text-[#77717A]">
                {isShipper
                  ? 'Signed in to Book a Truck on Web'
                  : 'Signed in as Driver / Fleet Owner in Mobile App'}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-[#FFF0F6] text-[#E83E83] text-[10px] font-black uppercase">
              {isShipper ? 'Book a Truck' : currentUser.role.replace('_', ' ')}
            </span>
          </div>

          {/* VIEW A: TRUCK BOOKING ACCOUNT FORM */}
          {isShipper && (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Account Type Toggle */}
              <div>
                <label className="text-[#77717A] block mb-1.5 font-bold text-[11px]">Account Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShipperType('individual')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                      shipperType === 'individual'
                        ? 'bg-[#E83E83] text-white border-[#E83E83] shadow-md shadow-[#E83E83]/20'
                        : 'bg-gray-50 border-gray-200 text-[#77717A]'
                    }`}
                  >
                    Individual / Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setShipperType('company')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition cursor-pointer ${
                      shipperType === 'company'
                        ? 'bg-[#E83E83] text-white border-[#E83E83] shadow-md shadow-[#E83E83]/20'
                        : 'bg-gray-50 border-gray-200 text-[#77717A]'
                    }`}
                  >
                    Enterprise / Company
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[#77717A] block mb-1 font-bold">Authorized Contact Person *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Barman"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  required
                />
              </div>

              {shipperType === 'company' && (
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Registered Company / Business Name *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Assam Tea Consignments LLP"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">GSTIN (Optional for MSME)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="18AABCB1234F1Z5"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] font-mono uppercase focus:outline-none focus:border-[#E83E83]"
                  />
                </div>
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Permanent Account Number (PAN)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="AABCB1234F"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] font-mono uppercase focus:outline-none focus:border-[#E83E83]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#77717A] block mb-1 font-bold">Registered Billing Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Warehouse #4, Amingaon Logistics Corridor, Kamrup"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Operating City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  >
                    <option value="Guwahati">Guwahati</option>
                    <option value="Dibrugarh">Dibrugarh</option>
                    <option value="Jorhat">Jorhat</option>
                    <option value="Silchar">Silchar</option>
                    <option value="Tezpur">Tezpur</option>
                    <option value="Shillong">Shillong</option>
                    <option value="Dimapur">Dimapur</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">State</label>
                  <input
                    type="text"
                    value={state}
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#77717A] cursor-not-allowed"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-[#E83E83]/30 active:scale-95"
              >
                Save Business Profile
              </button>
            </form>
          )}

          {/* VIEW B: DRIVER / FLEET OWNER FORM */}
          {isDriver && (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Verification Audit Notice */}
              <div className="p-3.5 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/20 text-[#171318] text-xs flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#E83E83] shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block text-[#171318]">Document Compliance Audit</span>
                  <p className="text-[11px] text-[#77717A] mt-0.5">
                    Vehicles and drivers are verified by official Parivahan RTO document inspection.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[#77717A] block mb-1 font-bold">Transporter / Driver Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bikash Kalita"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Commercial Driving License (DL) *</label>
                  <input
                    type="text"
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AS-01-2022-0049182"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] font-mono uppercase focus:outline-none focus:border-[#E83E83]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Primary Vehicle RC Reg No. *</label>
                  <input
                    type="text"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                    placeholder="e.g. AS-01-GC-9921"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] font-mono uppercase focus:outline-none focus:border-[#E83E83]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[#77717A] block mb-1 font-bold">Primary Vehicle Category</label>
                <select
                  value={vehicleCategory}
                  onChange={(e) => setVehicleCategory(e.target.value as VehicleCategoryType)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                >
                  {VEHICLE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.capacityTonnes} MT / {cat.hindiName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#77717A] block mb-1 font-bold">Commercial Insurance Policy Number</label>
                <input
                  type="text"
                  value={insuranceNumber}
                  onChange={(e) => setInsuranceNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. NIC/COMM/2026/89410"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] font-mono uppercase focus:outline-none focus:border-[#E83E83]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fleetToggle"
                  checked={isFleetOwner}
                  onChange={(e) => setIsFleetOwner(e.target.checked)}
                  className="w-4 h-4 accent-[#E83E83] rounded"
                />
                <label htmlFor="fleetToggle" className="text-[#171318] font-bold">
                  I operate a fleet with multiple commercial trucks
                </label>
              </div>

              {isFleetOwner && (
                <div>
                  <label className="text-[#77717A] block mb-1 font-bold">Total Fleet Size</label>
                  <input
                    type="number"
                    min={2}
                    max={500}
                    value={fleetSize}
                    onChange={(e) => setFleetSize(parseInt(e.target.value) || 2)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#171318] focus:outline-none focus:border-[#E83E83]"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-[#E83E83]/30 active:scale-95"
              >
                Save Transporter Credentials
              </button>
            </form>
          )}

          {/* VIEW C: SUPER ADMIN (PLATFORM OWNER) */}
          {isAdmin && (
            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2 text-[#E83E83] font-black">
                <ShieldAlert className="w-5 h-5 text-[#E83E83]" />
                <span>Super Administrator Privilege</span>
              </div>
              <p className="text-[11px] text-[#77717A] leading-relaxed">
                You are authenticated as the platform owner with full oversight of verified users, live shipments, compliance audits, platform commissions, and financial reconciliations.
              </p>
              <div className="p-3 rounded-xl bg-white border border-gray-200 font-mono text-xs text-[#171318] font-bold">
                Authorized Email: {currentUser.email}
              </div>
            </div>
          )}

          {/* LEGAL & GOOGLE PLAY ACCOUNT DELETION SECTION */}
          <div className="pt-3 border-t border-gray-200 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#77717A]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigateSpa('/privacy');
                }}
                className="hover:text-[#E83E83] underline cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigateSpa('/terms');
                }}
                className="hover:text-[#E83E83] underline cursor-pointer"
              >
                Terms &amp; Conditions
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigateSpa('/refund-policy');
                }}
                className="hover:text-[#E83E83] underline cursor-pointer"
              >
                Refund Policy
              </button>
            </div>

            {!isAdmin && (
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-2">
                {!showDeleteConfirm ? (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-rose-900 block">Delete Account &amp; Personal Data</span>
                      <span className="text-[10px] text-rose-700">
                        Permanently revoke login &amp; erase profile/KYC data
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Account</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-rose-900">
                      Confirm permanent deletion for <span className="font-mono">{currentUser.phone}</span>? You will be signed out immediately and your profile/KYC data will be erased within 7 working days.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isDeletingAccount}
                        onClick={handleConfirmDeleteAccount}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-60"
                      >
                        {isDeletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-[#171318] border border-gray-300 text-[11px] font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SIGN OUT BUTTON */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-[#77717A]">User ID: {currentUser.id.slice(-8)}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl bg-[#FFF0F6] hover:bg-[#ffe2ee] text-[#E83E83] border border-[#E83E83]/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5 text-[#E83E83]" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
