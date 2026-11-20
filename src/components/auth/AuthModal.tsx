import React, { useState, useEffect } from 'react';
import { 
  X, 
  Truck, 
  Building2, 
  ShieldAlert, 
  Phone, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Clock,
  Loader2
} from 'lucide-react';
import { User, UserRole, VehicleCategoryType } from '../../types';
import { authService, DEV_TEST_ACCOUNTS } from '../../services/authService';
import { logisticsStore } from '../../services/store';
import { SUPER_ADMIN_EMAIL } from '../../services/firebase';
import { VEHICLE_CATEGORIES } from '../../data/mockData';
import { showToast } from '../shared/Toast';

import { AppPortalMode, isPartnerRole } from '../../utils/portalMode';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  initialRole?: 'customer' | 'driver' | 'admin';
  portalMode?: AppPortalMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialRole = 'customer',
  portalMode = 'web'
}) => {
  // Target Portal: 'customer' | 'driver' | 'admin'
  const [targetPortal, setTargetPortal] = useState<'customer' | 'driver' | 'admin'>(
    portalMode === 'partner' ? 'driver' : initialRole === 'driver' ? 'customer' : initialRole
  );

  // Modal Mode: 'phone_otp' | 'onboarding' | 'owner_portal'
  // Always open immediately into the OTP / Mobile Phone verification section per user requirement
  const [authView, setAuthView] = useState<'phone_otp' | 'onboarding' | 'owner_portal'>('phone_otp');

  // Phone OTP States
  const [phone, setPhone] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Verified User (Pending Onboarding)
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Onboarding Form States
  const [selectedRole, setSelectedRole] = useState<'customer' | 'driver'>('customer');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleCat, setVehicleCat] = useState<VehicleCategoryType>('tata_ace');
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [fleetSize, setFleetSize] = useState(1);
  const [operatingCity, setOperatingCity] = useState('Guwahati');

  // Owner Portal States
  const [ownerPasscode, setOwnerPasscode] = useState('');
  const [ownerError, setOwnerError] = useState('');
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [isLoggingInOwner, setIsLoggingInOwner] = useState(false);

  // Synchronize targetPortal when modal opens or initialRole/portalMode changes
  useEffect(() => {
    if (isOpen) {
      const activeRole: 'customer' | 'driver' | 'admin' =
        portalMode === 'partner'
          ? 'driver'
          : initialRole === 'driver'
          ? 'customer'
          : initialRole || 'customer';
      setTargetPortal(activeRole);
      // Ensure it opens the AuthModal popup immediately into the OTP / Mobile Phone verification section
      setAuthView('phone_otp');
      setSelectedRole(activeRole === 'admin' ? 'customer' : activeRole);
      setErrorMessage('');
      setInfoMessage('');
      setPhone('');
      setOtpDigits(['', '', '', '', '', '']);
      setIsOtpSent(false);
    }
  }, [isOpen, initialRole, portalMode]);

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleCloseModal = () => {
    // Reset all internal states so closing/cancelling NEVER logs in or leaves partial state
    setPhone('');
    setIsOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setIsSending(false);
    setIsVerifying(false);
    setCountdown(0);
    setErrorMessage('');
    setInfoMessage('');
    setPendingUser(null);
    setFullName('');
    setBusinessName('');
    setGstin('');
    setDlNumber('');
    setVehicleReg('');
    setOwnerPasscode('');
    setOwnerError('');
    setAuthView('phone_otp');
    onClose();
  };

  const handleSelectPortal = (portal: 'customer' | 'driver' | 'admin') => {
    setTargetPortal(portal);
    setErrorMessage('');
    setOwnerError('');
    setInfoMessage('');
    setIsOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    if (portal === 'admin') {
      setAuthView('owner_portal');
    } else {
      setAuthView('phone_otp');
      setSelectedRole(portal);
    }
  };

  const handlePhoneInput = (val: string) => {
    let raw = val.replace(/\D/g, '');
    if (raw.length > 10 && raw.startsWith('91')) {
      raw = raw.slice(2);
    } else if (raw.length > 10) {
      raw = raw.slice(-10);
    }
    setPhone(raw);
    setErrorMessage('');
  };

  // 1. Send OTP Request to our Express backend (triggers httpSMS -> Jio SIM)
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    let clean = phone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) {
      clean = clean.slice(2);
    } else if (clean.length > 10) {
      clean = clean.slice(-10);
    }

    if (!clean || clean.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to send OTP via SMS gateway.');
      }

      setIsOtpSent(true);
      setInfoMessage(data.message || 'Verification code sent to your phone!');
      setCountdown(60); // 60s cooldown to protect Jio SMS balance
      if (data.otp) {
        setOtpDigits(String(data.otp).split('').slice(0, 6));
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch OTP. Please check server or phone connection.');
    } finally {
      setIsSending(false);
    }
  };

  // 2. Verify OTP with our Express backend
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const code = otpDigits.join('');

    if (code.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit SMS OTP code.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Incorrect or expired OTP code.');
      }

      // Prevent arbitrary-phone OTP elevation into Admin console
      if (targetPortal === 'admin') {
        setAuthView('owner_portal');
        throw new Error('Admin access requires Platform Owner Security Passcode verification.');
      }
      // Check permanent user profile registry first!
      const registered = logisticsStore.getRegisteredProfile(phone);
      const cleanPhoneDigits = phone.replace(/\D/g, '').slice(-10);
      const existingStoreUser = logisticsStore.getUsers().find(
        (u) => cleanPhoneDigits && u.phone.replace(/\D/g, '').endsWith(cleanPhoneDigits)
      );
      if (existingStoreUser?.isBlocked || registered?.user?.isBlocked) {
        throw new Error(
          `Account suspended: ${existingStoreUser?.blockedReason || registered?.user?.blockedReason || 'Blocked by Super Admin'}.`
        );
      }

      const resolvedPartnerRole: UserRole =
        isPartnerRole(existingStoreUser?.role)
          ? existingStoreUser!.role
          : isPartnerRole(registered?.user?.role)
          ? registered!.user.role
          : 'driver';
      const targetRole: UserRole = targetPortal === 'driver' ? resolvedPartnerRole : targetPortal;

      if (registered && registered.user && registered.user.name && registered.user.name.trim().length > 0) {
        // Automatically restore their saved profile with the matching portal role
        const restoredUser: User = {
          ...registered.user,
          role: targetRole,
          isBlocked: existingStoreUser?.isBlocked ?? registered.user.isBlocked,
          blockedReason: existingStoreUser?.blockedReason ?? registered.user.blockedReason,
          businessName: registered.user.businessName || (targetRole === 'customer' ? `${registered.user.name} Logistics` : `${registered.user.name} Transport`)
        };

        let activeVeh = registered.vehicle;
        if (isPartnerRole(targetRole)) {
          if (!activeVeh) {
            const clean = phone.replace(/\D/g, '').slice(-10);
            activeVeh = {
              id: `veh_${clean}`,
              ownerId: restoredUser.id,
              transporterName: restoredUser.businessName || `${restoredUser.name} Transport`,
              registrationNumber: registered.dlNumber ? `AS-01-TC-${clean.slice(-4)}` : 'AS-01-ET-2026',
              category: 'bolero_pickup',
              bodyType: 'tarpaulin',
              capacityKg: 1750,
              modelName: 'Mahindra Bolero Maxi Truck',
              fuelType: 'diesel',
              permitType: 'all_northeast',
              currentLocation: {
                lat: 26.1445,
                lng: 91.7362,
                address: `${restoredUser.city || 'Guwahati'} Transport Hub`,
                city: restoredUser.city || 'Guwahati'
              },
              isOnline: true,
              isAvailable: true,
              verificationStatus: 'verified',
              documents: [],
              driverName: restoredUser.name,
              driverPhone: restoredUser.phone,
              driverRating: 4.9,
              completedTrips: 18,
              photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
            };
          }
          logisticsStore.saveVehicle(activeVeh);
        }

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('vs_logged_out');
        }
        logisticsStore.saveRegisteredProfile(phone, restoredUser, activeVeh);
        logisticsStore.saveUser(restoredUser);
        logisticsStore.setCurrentUser(restoredUser);
        showToast(
          targetRole === 'customer'
            ? 'Signed in to Customer & Shipper Portal'
            : 'Signed in to Driver & Fleet Portal',
          'success'
        );
        onLoginSuccess(restoredUser);
        handleCloseModal();
        return;
      }

      // Check existing user profile with target portal role or test accounts
      const verifiedUser = authService.loginInstantWithPhone(phone, targetRole);

      if (verifiedUser && verifiedUser.name && verifiedUser.name.trim().length > 0) {
        showToast(
          targetRole === 'customer'
            ? 'Signed in to Customer & Shipper Portal'
            : 'Signed in to Driver & Fleet Portal',
          'success'
        );
        onLoginSuccess(verifiedUser);
        handleCloseModal();
      } else {
        // New user without registered profile -> transition to onboarding
        // Does NOT activate active session until onboarding form is completed and submitted
        setPendingUser(verifiedUser);
        setSelectedRole(targetPortal);
        setAuthView('onboarding');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Onboarding Completion
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompletingProfile) return;
    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!pendingUser) return;

    setIsCompletingProfile(true);
    try {
      const completedUser = await authService.completeOnboarding({
        userId: pendingUser.id,
        role: selectedRole,
        name: fullName.trim(),
        phone: pendingUser.phone || `+91 ${phone}`,
        businessName: businessName.trim(),
        city: operatingCity,
        gstin: gstin.trim(),
        dlNumber: dlNumber.trim(),
        vehicleRegNumber: vehicleReg.trim(),
        vehicleCategory: vehicleCat,
        isFleetOwner,
        fleetSize
      });

      showToast('Registration profile completed successfully!', 'success');
      onLoginSuccess(completedUser);
      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete registration profile.');
      showToast(err.message || 'Failed to complete profile.', 'error');
    } finally {
      setIsCompletingProfile(false);
    }
  };

  // Handle Owner Portal Login
  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingInOwner) return;
    setOwnerError('');
    setIsLoggingInOwner(true);

    try {
      const adminUser = await authService.loginOwner(ownerPasscode);
      showToast('Authenticated as Platform Owner', 'success');
      onLoginSuccess(adminUser);
      handleCloseModal();
    } catch (err: any) {
      setOwnerError(err.message || 'Access Denied.');
      showToast(err.message || 'Access Denied', 'error');
    } finally {
      setIsLoggingInOwner(false);
    }
  };

  // Instant sandbox login for testing Customer, Driver, or Fleet portals
  const handleSandboxLogin = (accId: string) => {
    try {
      const user = authService.loginDevTestAccount(accId);
      onLoginSuccess(user);
      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Sandbox login failed.');
    }
  };

  // 1-tap Super Admin sign-in
  const handleQuickAdminLogin = async () => {
    try {
      const adminUser = await authService.loginOwner('Admin@VahanSetu2026');
      onLoginSuccess(adminUser);
      handleCloseModal();
    } catch (err: any) {
      setOwnerError(err.message || 'Access Denied.');
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((char, i) => {
        if (i < 6) newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = val;
    setOtpDigits(newDigits);

    if (val && index < 5) {
      document.getElementById(`real-otp-${index + 1}`)?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`real-otp-${index - 1}`)?.focus();
    }
  };

  // Handle ESC key to cancel/close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={handleCloseModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-gray-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95vh] text-[#171318]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#171318] text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E83E83] flex items-center justify-center text-white font-black shadow-md shadow-[#E83E83]/30">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">Zuggi Freight</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] font-black uppercase">
                  SIM Gateway
                </span>
              </div>
              <p className="text-xs text-gray-400">Commercial Transport & Goods Exchange</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portal Selection Tabs (Strictly scoped by portalMode) */}
        {portalMode === 'partner' ? (
          <div className="bg-[#171318] px-4 pb-3 pt-1 flex items-center justify-between text-xs border-t border-gray-800">
            <span className="inline-flex items-center gap-1.5 text-white font-bold">
              <Truck className="w-4 h-4 text-[#E83E83]" />
              <span>Driver & Fleet Partner Sign-In</span>
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#E83E83]/20 text-[#FF85B7] font-bold uppercase">
              Mobile App
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 bg-[#171318] p-1.5 text-xs font-semibold gap-1.5 border-t border-gray-800">
            <button
              type="button"
              onClick={() => handleSelectPortal('customer')}
              className={`py-2.5 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                targetPortal === 'customer'
                  ? 'bg-[#E83E83] text-white font-bold shadow-md shadow-[#E83E83]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Shipper / Customer</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPortal('admin')}
              className={`py-2.5 px-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                targetPortal === 'admin'
                  ? 'bg-[#E83E83] text-white font-bold shadow-md shadow-[#E83E83]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Platform Owner Console"
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Admin Console</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* VIEW: PRODUCTION MOBILE PHONE AUTH */}
          {authView === 'phone_otp' && (
            <div className="space-y-4">
              {/* Role Context Explainer Banner */}
              <div className="p-3 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/20 flex items-start gap-2.5">
                {targetPortal === 'admin' ? (
                  <>
                    <ShieldAlert className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-[#171318]">Super Admin Console Sign-In</h4>
                      <p className="text-[11px] text-[#77717A] mt-0.5 leading-snug">
                        Platform governance, KYC compliance, active shipments, and escrow tracking ({SUPER_ADMIN_EMAIL}).
                      </p>
                    </div>
                  </>
                ) : targetPortal === 'customer' ? (
                  <>
                    <Building2 className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-[#171318]">Customer / Shipper Portal Sign-In</h4>
                      <p className="text-[11px] text-[#77717A] mt-0.5 leading-snug">
                        Post freight loads, compare live driver quotes, book commercial trucks, and track shipments across Northeast India.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Truck className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-[#171318]">Driver & Commercial Fleet Portal Sign-In</h4>
                      <p className="text-[11px] text-[#77717A] mt-0.5 leading-snug">
                        Find available loads, submit bids, manage commercial trucks, and track your trip earnings.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!isOtpSent ? (
                <div className="space-y-4">
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1.5">
                        Indian Mobile Number
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-[#171318] text-sm font-semibold shrink-0">
                          <span className="text-base">🇮🇳</span>
                          <span>+91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => handlePhoneInput(e.target.value)}
                          placeholder="Enter 10-digit number"
                          className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm focus:outline-none tracking-wider font-mono placeholder:text-gray-400"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#77717A] mt-1.5">
                        A real 6-digit SMS OTP will be delivered directly from your connected Jio gateway.
                      </p>
                    </div>

                    {countdown > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Please wait <strong className="font-mono text-amber-900">{countdown}s</strong> before requesting another OTP.
                        </span>
                      </div>
                    )}

                    {errorMessage && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                        <div>
                          <p>{errorMessage}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSending || countdown > 0}
                        className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer active:scale-95"
                      >
                        {isSending ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Sending SMS via Gateway...
                          </span>
                        ) : (
                          <>
                            <span>Get Verification Code</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Sandbox 1-Tap Sign-In Buttons */}
                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#77717A]">
                        <span className="font-semibold">Quick Sandbox Access:</span>
                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-mono">Instant Testing</span>
                      </div>
                      {targetPortal === 'admin' ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={handleQuickAdminLogin}
                            className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                              <span>⚡ 1-Tap Sign-In ({SUPER_ADMIN_EMAIL})</span>
                            </span>
                            <span className="font-mono text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Super Admin</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthView('owner_portal')}
                            className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5 text-gray-500" />
                            <span>Or Authenticate with Security Passcode Key</span>
                          </button>
                        </div>
                      ) : targetPortal === 'customer' ? (
                        <button
                          type="button"
                          onClick={() => handleSandboxLogin('test_shipper_9911')}
                          className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#E83E83]" />
                            <span>Brahmaputra Agro Consignor (Customer Portal)</span>
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">+91 99999 11111</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSandboxLogin('test_driver_9922')}
                            className="py-2.5 px-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex flex-col text-left transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1 text-[11px]">
                              <Truck className="w-3 h-3 text-[#E83E83]" />
                              <span className="font-bold truncate">Driver Bikash</span>
                            </span>
                            <span className="font-mono text-[9px] text-gray-500 mt-0.5">+91 99999 22222</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSandboxLogin('test_driver_9933')}
                            className="py-2.5 px-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex flex-col text-left transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1 text-[11px]">
                              <Truck className="w-3 h-3 text-emerald-600" />
                              <span className="font-bold truncate">Pragati Fleet</span>
                            </span>
                            <span className="font-mono text-[9px] text-gray-500 mt-0.5">+91 99999 33333</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {infoMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{infoMessage}</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Sent to +91 {phone}. Check your phone SMS.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-2 text-center">
                      Enter 6-Digit SMS Code
                    </label>
                    <div className="flex items-center justify-center gap-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`real-otp-${idx}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          className="w-10 sm:w-12 h-12 text-center text-lg font-bold font-mono bg-gray-50 border border-gray-300 focus:border-[#E83E83] focus:ring-1 focus:ring-[#E83E83] rounded-xl text-[#171318] focus:outline-none"
                        />
                      ))}
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                      <div>
                        <p>{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#77717A] pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOtpSent(false);
                        setErrorMessage('');
                      }}
                      className="hover:text-[#171318] transition underline cursor-pointer"
                    >
                      Change Number
                    </button>

                    <div>
                      {countdown > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-[#77717A] text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Resend in <strong className="font-mono text-[#171318]">{countdown}s</strong></span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequestOtp()}
                          className="text-[#E83E83] font-bold hover:underline cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Resend SMS OTP</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
                  >
                    {isVerifying ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Verifying Code...
                      </span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* VIEW 2: NEW USER ONBOARDING */}
          {authView === 'onboarding' && (
            <form onSubmit={handleCompleteOnboarding} className="space-y-4">
              <div className="p-3 bg-[#FFF0F6] border border-[#E83E83]/30 rounded-2xl text-xs space-y-1">
                <span className="font-bold text-[#E83E83] block">Phone Number Verified!</span>
                <p className="text-[#77717A]">
                  Please select your role and enter your details to complete your transport profile.
                </p>
              </div>

              <div className="p-3 rounded-2xl border bg-gray-50 border-gray-200 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#E83E83] text-white shrink-0">
                  {selectedRole === 'customer' ? <Building2 className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-[#171318]">
                    {selectedRole === 'customer' ? 'Shipper / Cargo Owner Account (Web)' : 'Driver / Fleet Partner Account (Mobile)'}
                  </div>
                  <p className="text-[10px] text-[#77717A] mt-0.5">
                    {selectedRole === 'customer'
                      ? 'Post freight loads, compare fleet quotes, and track deliveries.'
                      : 'Bid on freight loads, manage trucks, and receive direct payouts.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Barman"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                  required
                />
              </div>

              {selectedRole === 'customer' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1">
                        Company / Business Name *
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Assam Tea Traders LLP"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1">
                        GSTIN (Optional)
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="18AABCB1234F1Z5"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none font-mono uppercase"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1">
                        Driving License (DL) No. *
                      </label>
                      <input
                        type="text"
                        value={dlNumber}
                        onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. AS-01-2022-0049182"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none font-mono uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1">
                        Vehicle Registration (RC) No. *
                      </label>
                      <input
                        type="text"
                        value={vehicleReg}
                        onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                        placeholder="e.g. AS-01-GC-9921"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none font-mono uppercase"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-1">
                      Primary Commercial Vehicle Category *
                    </label>
                    <select
                      value={vehicleCat}
                      onChange={(e) => setVehicleCat(e.target.value as VehicleCategoryType)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                    >
                      {VEHICLE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.capacityTonnes} MT / {cat.hindiName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="fleetOwner"
                      checked={isFleetOwner}
                      onChange={(e) => setIsFleetOwner(e.target.checked)}
                      className="w-4 h-4 accent-[#E83E83] rounded"
                    />
                    <label htmlFor="fleetOwner" className="text-xs text-[#171318] font-semibold">
                      I operate a transport fleet with multiple commercial trucks
                    </label>
                  </div>

                  {isFleetOwner && (
                    <div>
                      <label className="text-xs font-bold text-[#171318] block mb-1">
                        Fleet Size (Total Vehicles)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={500}
                        value={fleetSize}
                        onChange={(e) => setFleetSize(parseInt(e.target.value) || 2)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1">
                  Primary Operating Hub / Base City
                </label>
                <select
                  value={operatingCity}
                  onChange={(e) => setOperatingCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                >
                  <option value="Guwahati">Guwahati (Amingaon ICD & Beltola Hub)</option>
                  <option value="Dibrugarh">Dibrugarh (Upper Assam Tea Belt)</option>
                  <option value="Jorhat">Jorhat (Gar-Ali Freight Junction)</option>
                  <option value="Silchar">Silchar (Barak Valley Gateway)</option>
                  <option value="Tezpur">Tezpur (North Bank Industrial)</option>
                  <option value="Dimapur">Dimapur (Nagaland Entry Hub)</option>
                  <option value="Shillong">Shillong (Meghalaya Corridor)</option>
                </select>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isCompletingProfile}
                  className="w-full sm:w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-[#171318] font-bold rounded-xl text-xs transition cursor-pointer text-center disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompletingProfile}
                  className="w-full sm:w-2/3 py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:bg-[#E83E83]/50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
                >
                  {isCompletingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Complete & Enter</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: SUPER ADMIN PLATFORM OWNER PORTAL */}
          {authView === 'owner_portal' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#FFF0F6] border border-[#E83E83]/30 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-[#E83E83] font-black">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Restricted Access: Platform Owner</span>
                </div>
                <p className="text-[#77717A]">
                  This console is strictly reserved for the authorized platform owner ({SUPER_ADMIN_EMAIL}).
                </p>
              </div>

              <form onSubmit={handleOwnerLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#171318] block mb-1.5">
                    Platform Owner Email
                  </label>
                  <input
                    type="email"
                    value={SUPER_ADMIN_EMAIL}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 text-[#77717A] rounded-xl text-xs font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#171318] block mb-1.5">
                    Super Admin Security Key / Passcode
                  </label>
                  <input
                    type="password"
                    value={ownerPasscode}
                    onChange={(e) => setOwnerPasscode(e.target.value)}
                    placeholder="Enter owner authorization passcode"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none"
                    required
                  />
                </div>

                {ownerError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                    <span>{ownerError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingInOwner}
                  className="w-full py-3.5 bg-[#171318] hover:bg-black disabled:bg-[#171318]/60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isLoggingInOwner ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-[#E83E83]" />
                      <span>Authenticate Admin Console</span>
                    </>
                  )}
                </button>

                <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAdminLogin}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#FFF0F6] hover:bg-[#ffe2ee] border border-[#E83E83]/30 text-[#E83E83] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-[#E83E83]" />
                    <span>⚡ Quick Sign-In ({SUPER_ADMIN_EMAIL})</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleSelectPortal('customer')}
                    className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#E83E83]" />
                    <span>Return to Shipper Phone OTP</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-[#171318] border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted • Parivahan Verified</span>
          </div>
          <div>
            <span className="font-bold text-white">Zuggi Freight</span>
          </div>
        </div>
      </div>
    </div>
  );
};