import React, { useState, useEffect } from 'react';
import { 
  X, 
  Truck, 
  Building2, 
  ShieldAlert, 
  Phone, 
  Lock, 
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
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
import { LocationAutocompleteInput } from '../shared/LocationAutocompleteInput';
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

  // Modal Mode: 'phone_otp' | 'onboarding' | 'setup_passcode' | 'reset_passcode' | 'owner_portal'
  const [authView, setAuthView] = useState<'phone_otp' | 'onboarding' | 'setup_passcode' | 'reset_passcode' | 'owner_portal'>('phone_otp');

  // Login Mode inside phone view: 'passcode' (returning user, no OTP) | 'otp' (first-time registration or reset)
  const [loginMethod, setLoginMethod] = useState<'passcode' | 'otp'>('passcode');
  const [isResettingPasscode, setIsResettingPasscode] = useState(false);

  // Dedicated 3-Step Forgot / Reset Passcode via OTP state
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetToken, setResetToken] = useState('');
  const [resetAccountNotFound, setResetAccountNotFound] = useState(false);

  // Account Detection State (auto-checks if 10-digit mobile already has a passcode)
  const [accountStatus, setAccountStatus] = useState<{
    checkedPhone: string;
    exists: boolean;
    hasPasscode: boolean;
    name?: string;
    isChecking: boolean;
  }>({ checkedPhone: '', exists: false, hasPasscode: false, isChecking: false });

  // Phone OTP & Passcode States
  const [phone, setPhone] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [showLoginPasscode, setShowLoginPasscode] = useState(false);
  const [isLoggingInPasscode, setIsLoggingInPasscode] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Verified User (Pending Onboarding or Passcode Setup)
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Onboarding Form States
  const [selectedRole, setSelectedRole] = useState<'customer' | 'driver'>('customer');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleCat, setVehicleCat] = useState<VehicleCategoryType>('tata_ace');
  const [isFleetOwner, setIsFleetOwner] = useState(false);
  const [fleetSize, setFleetSize] = useState(1);
  const [operatingCity, setOperatingCity] = useState('Guwahati');

  // New Passcode Setup States (used during first-time registration & existing-user passcode setup/reset)
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);

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
      setAuthView(activeRole === 'admin' ? 'owner_portal' : 'phone_otp');
      setLoginMethod('passcode');
      setIsResettingPasscode(false);
      setResetStep(1);
      setResetToken('');
      setResetAccountNotFound(false);
      setAccountStatus({ checkedPhone: '', exists: false, hasPasscode: false, isChecking: false });
      setSelectedRole(activeRole === 'admin' ? 'customer' : activeRole);
      setErrorMessage('');
      setInfoMessage('');
      setPhone('');
      setLoginPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setOtpDigits(['', '', '', '', '', '']);
      setIsOtpSent(false);
    }
  }, [isOpen, initialRole, portalMode]);

  // Auto-detect whether a 10-digit phone already has a Passcode configured
  useEffect(() => {
    if (!isOpen || (authView !== 'phone_otp' && authView !== 'reset_passcode') || targetPortal === 'admin') return;
    if (phone.length !== 10) {
      if (accountStatus.checkedPhone) {
        setAccountStatus({ checkedPhone: '', exists: false, hasPasscode: false, isChecking: false });
      }
      return;
    }

    let active = true;
    setAccountStatus((prev) => ({ ...prev, checkedPhone: phone, isChecking: true }));
    authService
      .checkAccountPasscodeStatus(phone)
      .then((status) => {
        if (!active) return;
        setAccountStatus({
          checkedPhone: phone,
          exists: status.exists,
          hasPasscode: status.hasPasscode,
          name: status.name,
          isChecking: false
        });
        // Automatically switch returning users with a passcode to no-OTP Passcode Login (unless resetting)
        if (status.hasPasscode && !isResettingPasscode && !isOtpSent) {
          setLoginMethod('passcode');
        }
      })
      .catch(() => {
        if (!active) return;
        setAccountStatus({ checkedPhone: phone, exists: false, hasPasscode: false, isChecking: false });
      });

    return () => {
      active = false;
    };
  }, [phone, isOpen, authView, targetPortal, isResettingPasscode, isOtpSent]);

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
    setLoginPasscode('');
    setShowLoginPasscode(false);
    setNewPasscode('');
    setConfirmPasscode('');
    setShowNewPasscode(false);
    setIsResettingPasscode(false);
    setResetStep(1);
    setResetToken('');
    setResetAccountNotFound(false);
    setAccountStatus({ checkedPhone: '', exists: false, hasPasscode: false, isChecking: false });
    setIsOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setIsSending(false);
    setIsVerifying(false);
    setIsLoggingInPasscode(false);
    setIsSavingPasscode(false);
    setCountdown(0);
    setErrorMessage('');
    setInfoMessage('');
    setPendingUser(null);
    setFullName('');
    setBusinessName('');
    setGstin('');
    setPanNumber('');
    setDlNumber('');
    setVehicleReg('');
    setOwnerPasscode('');
    setOwnerError('');
    setAuthView('phone_otp');
    setLoginMethod('passcode');
    onClose();
  };

  const openForgotPasscodeFlow = () => {
    setErrorMessage('');
    setInfoMessage('');
    setIsResettingPasscode(true);
    setResetStep(1);
    setResetToken('');
    setResetAccountNotFound(false);
    setOtpDigits(['', '', '', '', '', '']);
    setNewPasscode('');
    setConfirmPasscode('');
    setPendingUser(null);
    setAuthView('reset_passcode');
  };

  const handleSelectPortal = (portal: 'customer' | 'driver' | 'admin') => {
    setTargetPortal(portal);
    setErrorMessage('');
    setOwnerError('');
    setInfoMessage('');
    setIsOtpSent(false);
    setIsResettingPasscode(false);
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

  // Direct No-OTP Passcode Sign-In for already registered Shippers, Customers, Drivers & Vehicle Owners
  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingInPasscode) return;
    setErrorMessage('');
    setInfoMessage('');

    if (phone.length !== 10) {
      setErrorMessage('Please enter your 10-digit registered mobile number.');
      return;
    }
    if (!/^\d{4,6}$/.test(loginPasscode.trim())) {
      setErrorMessage('Please enter your 4 to 6-digit numeric login passcode.');
      return;
    }

    setIsLoggingInPasscode(true);
    try {
      const targetRole: UserRole = targetPortal === 'driver' ? 'driver' : 'customer';
      const user = await authService.loginWithPasscode(phone, loginPasscode.trim(), targetRole);
      showToast(
        user.role === 'customer'
          ? 'Signed in with Passcode (No OTP required)'
          : 'Partner signed in with Passcode (No OTP required)',
        'success'
      );
      onLoginSuccess(user);
      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Passcode sign-in failed. Please check your passcode or reset via OTP.');
    } finally {
      setIsLoggingInPasscode(false);
    }
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
      // Check permanent user profile registry (local + server/Supabase cross-device!)
      const registered = logisticsStore.getRegisteredProfile(phone);
      const cleanPhoneDigits = phone.replace(/\D/g, '').slice(-10);
      const existingStoreUser = logisticsStore.getUsers().find(
        (u) => cleanPhoneDigits && u.phone.replace(/\D/g, '').endsWith(cleanPhoneDigits)
      );
      const serverExistingUser: User | null = data.existingUser || null;
      if (existingStoreUser?.isBlocked || registered?.user?.isBlocked || serverExistingUser?.isBlocked) {
        throw new Error(
          `Account suspended: ${
            existingStoreUser?.blockedReason ||
            registered?.user?.blockedReason ||
            serverExistingUser?.blockedReason ||
            'Blocked by Super Admin'
          }.`
        );
      }

      const resolvedPartnerRole: UserRole =
        isPartnerRole(existingStoreUser?.role)
          ? existingStoreUser!.role
          : isPartnerRole(registered?.user?.role)
          ? registered!.user.role
          : isPartnerRole(serverExistingUser?.role)
          ? serverExistingUser!.role
          : 'driver';
      const targetRole: UserRole = targetPortal === 'driver' ? resolvedPartnerRole : targetPortal;

      const resolvedBaseUser = registered?.user || serverExistingUser || null;
      if (resolvedBaseUser && resolvedBaseUser.name && resolvedBaseUser.name.trim().length > 0) {
        // Automatically restore their saved profile with the matching portal role
        const restoredUser: User = {
          ...resolvedBaseUser,
          role: targetRole,
          isBlocked: existingStoreUser?.isBlocked ?? resolvedBaseUser.isBlocked,
          blockedReason: existingStoreUser?.blockedReason ?? resolvedBaseUser.blockedReason,
          businessName:
            resolvedBaseUser.businessName ||
            (targetRole === 'customer' ? `${resolvedBaseUser.name} Logistics` : `${resolvedBaseUser.name} Transport`)
        };

        const activeVeh = registered?.vehicle;
        if (isPartnerRole(targetRole) && activeVeh) {
          logisticsStore.saveVehicle(activeVeh);
        }

        // If user is resetting passcode OR hasn't set up a passcode yet, take them to quick Passcode Setup
        const alreadyHasPasscode = Boolean(
          registered?.hasPasscode ||
            registered?.passcodeDigest ||
            restoredUser.hasPasscode ||
            serverExistingUser?.hasPasscode ||
            accountStatus.hasPasscode
        );
        if (isResettingPasscode || !alreadyHasPasscode) {
          if (data.resetToken) setResetToken(String(data.resetToken));
          logisticsStore.saveRegisteredProfile(phone, restoredUser, activeVeh);
          setPendingUser(restoredUser);
          setNewPasscode('');
          setConfirmPasscode('');
          setErrorMessage('');
          setAuthView('setup_passcode');
          return;
        }

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('vs_logged_out');
        }
        logisticsStore.saveRegisteredProfile(phone, restoredUser, activeVeh);
        logisticsStore.saveUser(restoredUser);
        logisticsStore.setCurrentUser(restoredUser);
        showToast(
          targetRole === 'customer'
            ? 'Signed in — Ready to Book a Truck'
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
        if (isResettingPasscode || !verifiedUser.hasPasscode) {
          if (data.resetToken) setResetToken(String(data.resetToken));
          setPendingUser(verifiedUser);
          setNewPasscode('');
          setConfirmPasscode('');
          setErrorMessage('');
          setAuthView('setup_passcode');
          return;
        }
        showToast(
          targetRole === 'customer'
            ? 'Signed in — Ready to Book a Truck'
            : 'Signed in to Driver & Fleet Portal',
          'success'
        );
        onLoginSuccess(verifiedUser);
        handleCloseModal();
      } else {
        // New user without registered profile -> transition to onboarding (documents + passcode setup)
        // Does NOT activate active session until onboarding form is completed and submitted
        setPendingUser(verifiedUser);
        setSelectedRole(targetPortal);
        setNewPasscode('');
        setConfirmPasscode('');
        setAuthView('onboarding');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // --- DEDICATED 3-STEP FORGOT / RESET PASSCODE VIA OTP HANDLERS ---
  const handleResetRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setResetAccountNotFound(false);

    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length !== 10) {
      setErrorMessage('Please enter your 10-digit registered mobile number.');
      return;
    }

    setIsSending(true);
    try {
      const status = await authService.checkAccountPasscodeStatus(clean);
      if (status.isBlocked) {
        throw new Error(`Account suspended: ${status.blockedReason || 'Blocked by Super Admin'}.`);
      }

      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, purpose: 'reset_passcode' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to send reset OTP right now.');
      }

      setInfoMessage(data.message || '6-digit reset OTP sent to your mobile number.');
      setCountdown(60);
      if (data.otp) {
        setOtpDigits(String(data.otp).split('').slice(0, 6));
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }
      setResetStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send reset OTP.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResetVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setResetAccountNotFound(false);

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

      const clean = phone.replace(/\D/g, '').slice(-10);
      const localReg = logisticsStore.getRegisteredProfile(clean);
      const storeMatch = logisticsStore.getUsers().find((u) => u.phone.replace(/\D/g, '').endsWith(clean));
      const serverUser: User | null = data.existingUser || null;
      const matchedUser = serverUser || localReg?.user || storeMatch || null;

      if (matchedUser?.isBlocked) {
        throw new Error(`Account suspended: ${matchedUser.blockedReason || 'Blocked by Super Admin'}.`);
      }

      setResetToken(String(data.resetToken || ''));

      if (!matchedUser || !matchedUser.name || !matchedUser.name.trim()) {
        setResetAccountNotFound(true);
        setErrorMessage(
          `No registered account found for +91 ${clean}. You can register now as a new ${
            targetPortal === 'driver' ? 'Driver / Fleet Partner' : 'Book a Truck'
          } without verifying OTP again.`
        );
        return;
      }

      setPendingUser(matchedUser);
      setNewPasscode('');
      setConfirmPasscode('');
      setInfoMessage('');
      setResetStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP verification failed. Please check the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetSavePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPasscode) return;
    setErrorMessage('');

    const cleanPin = newPasscode.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setErrorMessage('New passcode must be 4 to 6 numeric digits.');
      return;
    }
    if (cleanPin !== confirmPasscode.trim()) {
      setErrorMessage('Passcodes do not match. Please enter the same 4–6 digit passcode twice.');
      return;
    }

    setIsSavingPasscode(true);
    try {
      const targetRole: UserRole =
        targetPortal === 'driver'
          ? isPartnerRole(pendingUser?.role)
            ? pendingUser!.role
            : 'driver'
          : 'customer';
      const updatedUser = await authService.resetUserPasscode(
        phone || pendingUser?.phone || '',
        cleanPin,
        resetToken,
        pendingUser,
        targetRole
      );
      showToast('Passcode reset successful! Signed in with your new passcode.', 'success');
      onLoginSuccess(updatedUser);
      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset passcode. Please try again.');
    } finally {
      setIsSavingPasscode(false);
    }
  };

  // Handle Passcode Setup / Reset for already-registered users who just verified via OTP
  const handleSavePasscodeForExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPasscode || !pendingUser) return;
    setErrorMessage('');

    const cleanPin = newPasscode.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setErrorMessage('Please enter a 4 to 6-digit numeric passcode.');
      return;
    }
    if (cleanPin !== confirmPasscode.trim()) {
      setErrorMessage('Passcodes do not match. Please re-enter to confirm.');
      return;
    }

    setIsSavingPasscode(true);
    try {
      const updatedUser = await authService.setupUserPasscode(
        phone || pendingUser.phone,
        cleanPin,
        pendingUser
      );
      showToast('Passcode saved! Next time, sign in directly with your Passcode — no OTP needed.', 'success');
      onLoginSuccess(updatedUser);
      handleCloseModal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save passcode.');
    } finally {
      setIsSavingPasscode(false);
    }
  };

  // Handle Onboarding Completion (Documents + Permanent Login Passcode Setup)
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompletingProfile) return;
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    const cleanPin = newPasscode.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setErrorMessage('Please create a 4 to 6-digit numeric login passcode for future sign-ins.');
      return;
    }
    if (cleanPin !== confirmPasscode.trim()) {
      setErrorMessage('Confirm Passcode does not match your chosen Passcode.');
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
        pan: panNumber.trim(),
        dlNumber: dlNumber.trim(),
        vehicleRegNumber: vehicleReg.trim(),
        vehicleCategory: vehicleCat,
        isFleetOwner,
        fleetSize,
        passcode: cleanPin
      });

      showToast(
        'Registered & Passcode set! Next time, sign in directly with your Passcode — no OTP needed.',
        'success'
      );
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
            <div className="w-11 h-11 rounded-2xl bg-[#060309] border border-white/15 overflow-hidden flex items-center justify-center shadow-md shadow-[#E83E83]/25 shrink-0">
              <img
                src="/assets/aistudio/Zuggi_Pink_Delivery_Logo_bf3220a3.png"
                alt="Zuggi Logo"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">Zuggi Freight</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] font-black uppercase">
                  Passcode & OTP
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
              <span className="truncate">Book a Truck</span>
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
                      <h4 className="text-xs font-black text-[#171318]">Book a Truck — Sign In</h4>
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

              {/* Login Mode Switcher: Passcode Login (No OTP) vs One-Time OTP Registration */}
              {!isOtpSent && targetPortal !== 'admin' && (
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-gray-100 border border-gray-200 text-xs font-bold gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('passcode');
                      setIsResettingPasscode(false);
                      setErrorMessage('');
                      setInfoMessage('');
                    }}
                    className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      loginMethod === 'passcode'
                        ? 'bg-white text-[#171318] shadow-sm border border-gray-200'
                        : 'text-[#77717A] hover:text-[#171318]'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#E83E83]" />
                    <span>Passcode Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod('otp');
                      setIsResettingPasscode(false);
                      setErrorMessage('');
                      setInfoMessage('');
                    }}
                    className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      loginMethod === 'otp'
                        ? 'bg-white text-[#171318] shadow-sm border border-gray-200'
                        : 'text-[#77717A] hover:text-[#171318]'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>New User / OTP</span>
                  </button>
                </div>
              )}

              {!isOtpSent ? (
                <div className="space-y-4">
                  {loginMethod === 'passcode' && targetPortal !== 'admin' ? (
                    <form onSubmit={handlePasscodeLogin} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-[#171318] block mb-1.5">
                          Registered Mobile Number
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

                        {phone.length === 10 && !accountStatus.isChecking && accountStatus.checkedPhone === phone && (
                          accountStatus.hasPasscode ? (
                            <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                Welcome back{accountStatus.name ? `, ${accountStatus.name}` : ''}! Enter your Passcode — no OTP needed.
                              </span>
                            </p>
                          ) : (
                            <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between gap-2">
                              <span>
                                {accountStatus.exists
                                  ? 'No passcode set on this account yet.'
                                  : 'New mobile number? Verify once with OTP & documents to set your Passcode.'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setLoginMethod('otp');
                                  setErrorMessage('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#E83E83] text-white font-bold shrink-0 cursor-pointer"
                              >
                                Register / OTP
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-[#171318]">
                            4–6 Digit Login Passcode (No OTP)
                          </label>
                          <button
                            type="button"
                            onClick={openForgotPasscodeFlow}
                            className="text-[11px] font-bold text-[#E83E83] hover:underline cursor-pointer"
                          >
                            Forgot / Reset Passcode?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showLoginPasscode ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]{4,6}"
                            maxLength={6}
                            value={loginPasscode}
                            onChange={(e) => {
                              setLoginPasscode(e.target.value.replace(/\D/g, '').slice(0, 6));
                              setErrorMessage('');
                            }}
                            placeholder="Enter 4–6 digit passcode"
                            className="w-full px-3.5 py-2.5 pr-11 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm focus:outline-none tracking-[0.25em] font-mono placeholder:tracking-normal placeholder:text-gray-400"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPasscode((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#171318] cursor-pointer"
                            aria-label={showLoginPasscode ? 'Hide passcode' : 'Show passcode'}
                          >
                            {showLoginPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[11px] text-[#77717A] mt-1.5">
                          Registered Truck Booking Accounts, Drivers & Fleet Owners can sign in anytime with Passcode — no SMS OTP required.
                        </p>
                      </div>

                      {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                          <div className="space-y-1.5 flex-1">
                            <p>{errorMessage}</p>
                            <button
                              type="button"
                              onClick={openForgotPasscodeFlow}
                              className="inline-flex items-center gap-1 font-extrabold text-[#E83E83] hover:underline cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Passcode via SMS OTP →</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoggingInPasscode}
                        className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer active:scale-95"
                      >
                        {isLoggingInPasscode ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Signing In...</span>
                          </span>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>Sign In with Passcode</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <div className="text-center text-xs text-[#77717A]">
                        First time on Zuggi?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setLoginMethod('otp');
                            setIsResettingPasscode(false);
                            setErrorMessage('');
                          }}
                          className="text-[#E83E83] font-bold hover:underline cursor-pointer"
                        >
                          Register once with OTP & Documents
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                      {infoMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{infoMessage}</span>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-bold text-[#171318] block mb-1.5">
                          Indian Mobile Number ({isResettingPasscode ? 'Passcode Reset' : 'One-Time Registration OTP'})
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
                          {isResettingPasscode
                            ? 'Verify once via SMS OTP to set a new 4–6 digit login passcode.'
                            : 'Verify once via SMS OTP, submit your documents & set a permanent Passcode. Future logins need no OTP!'}
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
                              <span>{isResettingPasscode ? 'Send OTP to Reset Passcode' : 'Get One-Time Verification OTP'}</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Admin Security Portal (Always shown for Admin) OR Sandbox Demo Buttons (Localhost / ?demo=1 only) */}
                  {targetPortal === 'admin' ? (
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <button
                        type="button"
                        onClick={() => setAuthView('owner_portal')}
                        className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-purple-600" />
                        <span>Sign In to Super Admin Console (Passcode)</span>
                      </button>
                      {typeof window !== 'undefined' &&
                        (window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.search.includes('demo=1')) && (
                          <button
                            type="button"
                            onClick={handleQuickAdminLogin}
                            className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                              <span>1-Tap Dev Admin ({SUPER_ADMIN_EMAIL})</span>
                            </span>
                            <span className="font-mono text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">Dev</span>
                          </button>
                        )}
                    </div>
                  ) : (
                    typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.search.includes('demo=1')) && (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-[#77717A]">
                          <span className="font-semibold">Quick Test Access (Dev Only):</span>
                          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-mono">Demo</span>
                        </div>
                        {targetPortal === 'customer' ? (
                          <button
                            type="button"
                            onClick={() => handleSandboxLogin('test_shipper_9911')}
                            className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-[#171318] text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-[#E83E83]" />
                              <span>Brahmaputra Agro (Book a Truck Demo)</span>
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
                    )
                  )}
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
                    {selectedRole === 'customer' ? 'Book a Truck Account (Web)' : 'Driver / Fleet Partner Account (Mobile)'}
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
                        PAN Card Number *
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. ABCDE1234F"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs focus:outline-none font-mono uppercase"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-1">
                      GSTIN (Optional for Businesses)
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
                  Your City / Town / District *
                </label>
                <LocationAutocompleteInput
                  value={operatingCity}
                  onChangeText={(txt) => setOperatingCity(txt)}
                  onSelectPlace={(place) => setOperatingCity(place.city || place.label)}
                  placeholder="Type your city, town, or district (e.g. Guwahati, Nagaon, Barpeta...)"
                  theme="light"
                  showGpsButton={true}
                  cityOnly={true}
                />
              </div>

              {/* Permanent Login Passcode Setup (So Future Logins Require Zero OTP) */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-black text-emerald-950">
                      Set Your Permanent Login Passcode *
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                      Choose a 4–6 digit numeric passcode. After registration, you can log in anytime using this Passcode — no OTP required.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#171318] block mb-1">
                      Create Passcode (4–6 digits) *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPasscode ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={newPasscode}
                        onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="e.g. 4829"
                        className="w-full px-3 py-2.5 pr-9 bg-white border border-emerald-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs font-mono tracking-widest focus:outline-none placeholder:tracking-normal"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasscode((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#171318] cursor-pointer"
                        aria-label="Toggle passcode visibility"
                      >
                        {showNewPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#171318] block mb-1">
                      Confirm Passcode *
                    </label>
                    <input
                      type={showNewPasscode ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Re-enter passcode"
                      className="w-full px-3 py-2.5 bg-white border border-emerald-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-xs font-mono tracking-widest focus:outline-none placeholder:tracking-normal"
                      required
                    />
                  </div>
                </div>
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
                      <span>Saving Profile & Passcode...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Complete Registration & Save Passcode</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2B: QUICK PASSCODE SETUP / RESET FOR EXISTING VERIFIED USERS */}
          {authView === 'setup_passcode' && pendingUser && (
            <form onSubmit={handleSavePasscodeForExistingUser} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-black text-emerald-900">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isResettingPasscode ? 'Reset Your Login Passcode' : 'Set Up Your Login Passcode (One-Time)'}
                  </span>
                </div>
                <p className="text-emerald-800 leading-snug">
                  Mobile <strong>+91 {phone}</strong> verified for <strong>{pendingUser.name}</strong>. Set a 4–6 digit passcode below so future logins require zero OTP.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1.5">
                  New 4–6 Digit Passcode *
                </label>
                <div className="relative">
                  <input
                    type={showNewPasscode ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newPasscode}
                    onChange={(e) => {
                      setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setErrorMessage('');
                    }}
                    placeholder="Enter 4–6 numeric digits"
                    className="w-full px-3.5 py-2.5 pr-11 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm font-mono tracking-[0.25em] focus:outline-none placeholder:tracking-normal"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasscode((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#171318] cursor-pointer"
                    aria-label="Toggle passcode visibility"
                  >
                    {showNewPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#171318] block mb-1.5">
                  Confirm Passcode *
                </label>
                <input
                  type={showNewPasscode ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPasscode}
                  onChange={(e) => {
                    setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setErrorMessage('');
                  }}
                  placeholder="Re-enter your 4–6 digit passcode"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm font-mono tracking-[0.25em] focus:outline-none placeholder:tracking-normal"
                  required
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingPasscode}
                className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
              >
                {isSavingPasscode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Passcode...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Save Passcode & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW 2C: DEDICATED 3-STEP FORGOT / RESET PASSCODE VIA OTP */}
          {authView === 'reset_passcode' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('phone_otp');
                    setLoginMethod('passcode');
                    setIsResettingPasscode(false);
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#77717A] hover:text-[#171318] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Passcode Login</span>
                </button>
                <span className="text-[11px] font-bold text-[#E83E83] bg-[#FFF0F6] px-2.5 py-0.5 rounded-full">
                  Step {resetStep} of 3
                </span>
              </div>

              {/* 3-Step Visual Progress Bar */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { step: 1, label: '1. Mobile' },
                  { step: 2, label: '2. Verify OTP' },
                  { step: 3, label: '3. New Passcode' }
                ].map((item) => (
                  <div
                    key={item.step}
                    className={`rounded-xl px-2 py-1.5 text-center text-[11px] font-bold border transition ${
                      resetStep === item.step
                        ? 'bg-[#171318] text-white border-[#171318]'
                        : resetStep > item.step
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-[#77717A] border-gray-200'
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              {/* STEP 1: ENTER REGISTERED MOBILE NUMBER */}
              {resetStep === 1 && (
                <form onSubmit={handleResetRequestOtp} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/20 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-black text-[#171318]">
                      <KeyRound className="w-4 h-4 text-[#E83E83]" />
                      <span>Forgot Your Login Passcode?</span>
                    </div>
                    <p className="text-[#77717A] leading-snug">
                      Enter your registered 10-digit mobile number. We will send a one-time 6-digit SMS OTP so you can set a new passcode.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-1.5">
                      Registered Mobile Number *
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-[#171318] text-sm font-semibold shrink-0">
                        <span className="text-base">🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => handlePhoneInput(e.target.value)}
                        placeholder="Enter 10-digit registered number"
                        className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm focus:outline-none tracking-wider font-mono placeholder:text-gray-400"
                        required
                      />
                    </div>

                    {phone.length === 10 && !accountStatus.isChecking && accountStatus.checkedPhone === phone && (
                      accountStatus.exists ? (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Registered account found{accountStatus.name ? ` (${accountStatus.name})` : ''}. Ready to send reset OTP.
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between gap-2">
                          <span>No passcode found yet for +91 {phone}.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAuthView('phone_otp');
                              setLoginMethod('otp');
                              setIsResettingPasscode(false);
                              setErrorMessage('');
                            }}
                            className="px-2 py-0.5 rounded-lg bg-[#E83E83] text-white font-bold shrink-0 cursor-pointer"
                          >
                            Register New
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSending || countdown > 0}
                    className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Reset OTP...</span>
                      </>
                    ) : countdown > 0 ? (
                      <span>Wait {countdown}s to Resend OTP</span>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        <span>Send Reset OTP</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: VERIFY 6-DIGIT RESET OTP */}
              {resetStep === 2 && (
                <form onSubmit={handleResetVerifyOtp} className="space-y-4">
                  {infoMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{infoMessage}</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Sent to +91 {phone}. Enter the 6-digit code below.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-2 text-center">
                      Enter 6-Digit Reset OTP
                    </label>
                    <div
                      className="flex items-center justify-center gap-2"
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pasted.length === 6) {
                          e.preventDefault();
                          setOtpDigits(pasted.split(''));
                        }
                      }}
                    >
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
                      <div className="space-y-2 flex-1">
                        <p>{errorMessage}</p>
                        {resetAccountNotFound && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetRole: UserRole = targetPortal === 'driver' ? 'driver' : 'customer';
                              const newUser = authService.loginInstantWithPhone(phone, targetRole);
                              setPendingUser(newUser);
                              setSelectedRole(targetPortal === 'driver' ? 'driver' : 'customer');
                              setErrorMessage('');
                              setAuthView('onboarding');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#171318] text-white font-bold text-[11px] hover:bg-black cursor-pointer"
                          >
                            Continue to New User Registration →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#77717A]">
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep(1);
                        setErrorMessage('');
                      }}
                      className="hover:text-[#171318] underline cursor-pointer"
                    >
                      Change Number
                    </button>
                    {countdown > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5" /> Resend in <strong className="font-mono text-[#171318]">{countdown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleResetRequestOtp()}
                        className="text-[#E83E83] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Reset OTP...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify OTP &amp; Set New Passcode</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 3: CREATE & CONFIRM NEW 4–6 DIGIT PASSCODE */}
              {resetStep === 3 && (
                <form onSubmit={handleResetSavePasscode} className="space-y-4">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-black text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>OTP Verified — Set Your New Passcode</span>
                    </div>
                    <p className="text-emerald-800 leading-snug">
                      Verified <strong>+91 {phone}</strong>{pendingUser?.name ? ` (${pendingUser.name})` : ''}. Choose a new 4–6 digit numeric passcode. Any previous lockouts will be cleared automatically.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-1.5">
                      New 4–6 Digit Passcode *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPasscode ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={newPasscode}
                        onChange={(e) => {
                          setNewPasscode(e.target.value.replace(/\D/g, '').slice(0, 6));
                          setErrorMessage('');
                        }}
                        placeholder="Enter 4–6 numeric digits"
                        className="w-full px-3.5 py-2.5 pr-11 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm font-mono tracking-[0.25em] focus:outline-none placeholder:tracking-normal"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasscode((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#171318] cursor-pointer"
                        aria-label="Toggle passcode visibility"
                      >
                        {showNewPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#171318] block mb-1.5">
                      Confirm New Passcode *
                    </label>
                    <input
                      type={showNewPasscode ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPasscode}
                      onChange={(e) => {
                        setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setErrorMessage('');
                      }}
                      placeholder="Re-enter your new passcode"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 focus:border-[#E83E83] rounded-xl text-[#171318] text-sm font-mono tracking-[0.25em] focus:outline-none placeholder:tracking-normal"
                      required
                    />
                    {confirmPasscode.length >= 4 && (
                      <p
                        className={`text-[11px] font-semibold mt-1 ${
                          newPasscode === confirmPasscode ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {newPasscode === confirmPasscode ? '✓ Passcodes match' : 'Passcodes do not match yet'}
                      </p>
                    )}
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#DC3545] shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingPasscode}
                    className="w-full py-3.5 bg-[#E83E83] hover:bg-[#d62e73] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 cursor-pointer"
                  >
                    {isSavingPasscode ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Updating Passcode...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Reset Passcode &amp; Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
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
                    <span>Return to Book a Truck Sign-In</span>
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