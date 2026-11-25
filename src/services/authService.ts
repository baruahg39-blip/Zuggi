import { 
  auth, 
  db, 
  SUPER_ADMIN_EMAIL,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from './firebase';
import { User, UserRole, VehicleCategoryType, CommercialVehicle } from '../types';
import { logisticsStore } from './store';
import { ConfirmationResult, User as FirebaseUser } from 'firebase/auth';
import { isPartnerRole } from '../utils/portalMode';

export interface PhoneAuthState {
  isOtpSent: boolean;
  phone: string;
  cooldownSeconds: number;
  attemptsRemaining: number;
  isVerifying: boolean;
  error: string | null;
}

export interface DevTestAccount {
  id: string;
  phone: string;
  formattedE164: string;
  displayPhone: string;
  role: 'customer' | 'driver';
  roleLabel: string;
  name: string;
  company: string;
  city: string;
  defaultCode: string;
  description: string;
  vehicleReg?: string;
  vehicleCategory?: VehicleCategoryType;
}

// Bot / sandbox test accounts are permanently disabled in production.
export const DEV_TEST_ACCOUNTS: DevTestAccount[] = [];

class AuthService {
  private confirmationResult: ConfirmationResult | null = null;
  private attemptCount = 0;
  private maxAttempts = 3;
  private lastOtpSentTime = 0;
  private cooldownMs = 60000;

  constructor() {
    // Restore cooldown from sessionStorage if available
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('vs_otp_cooldown_expiry');
      if (stored) {
        const expiry = parseInt(stored, 10);
        if (expiry > Date.now()) {
          this.lastOtpSentTime = expiry - this.cooldownMs;
        }
      }
    }
    this.listenToAuthState();
  }

  /**
   * Get remaining cooldown seconds before next SMS OTP can be dispatched
   */
  public getRemainingCooldown(): number {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('vs_otp_cooldown_expiry');
      if (stored) {
        const expiry = parseInt(stored, 10);
        const rem = Math.ceil((expiry - Date.now()) / 1000);
        if (rem > 0) return rem;
      }
    }
    const elapsed = Date.now() - this.lastOtpSentTime;
    const remaining = Math.ceil((this.cooldownMs - elapsed) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Listen to Firebase Auth state changes and sync user profile from Firestore
   */
  private listenToAuthState() {
    onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        // Check if user is Super Admin
        const isOwner = fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);

          if (snap.exists()) {
            const data = snap.data();
            const syncedUser: User = {
              id: fbUser.uid,
              name: data.name || (isOwner ? 'Platform Owner' : 'Freight Partner'),
              phone: data.phone || fbUser.phoneNumber || '',
              email: data.email || fbUser.email || '',
              role: isOwner ? 'admin' : (data.role as UserRole) || 'customer',
              businessName: data.businessName,
              gstin: data.gstin,
              pan: data.pan,
              city: data.city || 'Guwahati',
              state: data.state || 'Assam',
              address: data.address,
              isVerified: isOwner ? true : (data.isVerified ?? false),
              createdAt: data.createdAt || new Date().toISOString()
            };
            logisticsStore.setCurrentUser(syncedUser);
          } else {
            // New user without Firestore record yet
            const initialRole: UserRole = isOwner ? 'admin' : 'customer';
            const newUser: User = {
              id: fbUser.uid,
              name: isOwner ? 'Platform Owner' : (fbUser.displayName || 'Freight Partner'),
              phone: fbUser.phoneNumber || '',
              email: fbUser.email || (isOwner ? SUPER_ADMIN_EMAIL : ''),
              role: initialRole,
              city: 'Guwahati',
              state: 'Assam',
              isVerified: isOwner,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newUser);
            logisticsStore.setCurrentUser(newUser);
          }
        } catch {
          // If Firestore is still offline or connecting, create local session
          if (isOwner) {
            const adminUser: User = {
              id: fbUser.uid,
              name: 'Platform Owner (Super Admin)',
              phone: fbUser.phoneNumber || '+91 94350 88219',
              email: SUPER_ADMIN_EMAIL,
              role: 'admin',
              city: 'Guwahati',
              state: 'Assam',
              isVerified: true,
              createdAt: new Date().toISOString()
            };
            logisticsStore.setCurrentUser(adminUser);
          }
        }
      }
    });
  }

  /**
   * Direct 1-tap instant sign-in without external carrier SMS or reCAPTCHA delays.
   * Completely avoids 'reCAPTCHA has already been rendered' and 'auth/operation-not-allowed'.
   */
  public loginInstantWithPhone(rawPhone: string, preferredRole: UserRole = 'customer'): User {
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(-10);
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('A valid 10-digit mobile number is required.');
    }

    // 1. Check in-memory user profile registry first
    const registered = logisticsStore.getRegisteredProfile(cleanPhone);
    const existingStoreUser = logisticsStore.getUsers().find(
      (u) => u.phone.replace(/\D/g, '').endsWith(cleanPhone)
    );
    if (existingStoreUser?.isBlocked) {
      throw new Error(`Account suspended: ${existingStoreUser.blockedReason || 'Blocked by Platform Administrator'}.`);
    }

    if (registered && registered.user && registered.user.name && registered.user.name.trim().length > 0) {
      if (registered.user.isBlocked) {
        throw new Error(`Account suspended: ${registered.user.blockedReason || 'Blocked by Platform Administrator'}.`);
      }
      const targetRole: UserRole =
        preferredRole === 'driver' && isPartnerRole(registered.user.role)
          ? registered.user.role
          : preferredRole || registered.user.role || 'customer';
      const restoredUser: User = {
        ...registered.user,
        role: targetRole,
        isBlocked: existingStoreUser?.isBlocked ?? registered.user.isBlocked,
        blockedReason: existingStoreUser?.blockedReason ?? registered.user.blockedReason,
        businessName: registered.user.businessName || (targetRole === 'customer' ? `${registered.user.name} Logistics` : `${registered.user.name} Transport`)
      };
      if (registered.vehicle) {
        logisticsStore.saveVehicle(registered.vehicle);
      } else if (isPartnerRole(targetRole)) {
        const vehId = `veh_${cleanPhone}`;
        const existingVeh = logisticsStore.getVehicleById(vehId);
        if (!existingVeh) {
          const defaultVeh: CommercialVehicle = {
            id: vehId,
            ownerId: restoredUser.id,
            transporterName: restoredUser.businessName || `${restoredUser.name} Transport`,
            registrationNumber: `AS-01-TC-${cleanPhone.slice(-4)}`,
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
          logisticsStore.saveVehicle(defaultVeh);
        }
      }
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('vs_logged_out');
      }
      logisticsStore.saveRegisteredProfile(cleanPhone, restoredUser, registered.vehicle);
      logisticsStore.saveUser(restoredUser);
      logisticsStore.setCurrentUser(restoredUser);
      return restoredUser;
    }

    const role: UserRole = preferredRole || 'customer';

    if (role === 'admin') {
      throw new Error('Admin access requires server-verified Super Admin credentials.');
    }

    // 3. For new users: return a provisional user WITHOUT setting active session!
    // The session will ONLY be activated after completeOnboarding is submitted.
    const provisionalUser: User = {
      id: `user_${role}_${Date.now()}`,
      name: '', // Empty name triggers onboarding flow in AuthModal
      phone: `+91 ${cleanPhone}`,
      email: `${cleanPhone}@zuggi.in`,
      role,
      city: 'Guwahati',
      state: 'Assam',
      isVerified: false,
      createdAt: new Date().toISOString()
    };

    return provisionalUser;
  }

  /**
   * Switch the active logged-in user's non-admin portal role (customer <-> driver)
   */
  public switchRole(newRole: UserRole): User {
    if (newRole === 'admin') {
      throw new Error('Admin access requires server-verified Super Admin credentials.');
    }
    const current = logisticsStore.getCurrentUser();
    if (!current?.phone) {
      throw new Error('Please sign in first before switching portals.');
    }
    return this.loginInstantWithPhone(current.phone, newRole);
  }

  /**
   * Verify Firebase Phone Auth confirmation code when Firebase Phone Auth is active
   */
  public async verifySmsOtp(otpCode: string, _preferredRole: UserRole = 'customer'): Promise<User> {
    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      throw new Error('OTP must be exactly 6 digits.');
    }

    if (!this.confirmationResult) {
      throw new Error('No active OTP session. Please request a new verification code.');
    }

    if (this.attemptCount >= this.maxAttempts) {
      this.confirmationResult = null;
      throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    this.attemptCount++;

    try {
      const userCredential = await this.confirmationResult.confirm(cleanOtp);
      const fbUser = userCredential.user;

      // Check if user already exists in Firestore
      const userDocRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userDocRef);

      const isOwner = fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

      let appUser: User;
      if (snap.exists()) {
        const data = snap.data();
        appUser = {
          id: fbUser.uid,
          name: data.name || 'Commercial Freight User',
          phone: fbUser.phoneNumber || '',
          email: data.email || '',
          role: isOwner ? 'admin' : (data.role as UserRole) || 'customer',
          businessName: data.businessName,
          gstin: data.gstin,
          pan: data.pan,
          city: data.city || 'Guwahati',
          state: data.state || 'Assam',
          isVerified: isOwner ? true : Boolean(data.isVerified),
          isTestAccount: false,
          createdAt: data.createdAt || new Date().toISOString()
        };
      } else {
        // Standard real phone onboarding needed
        appUser = {
          id: fbUser.uid,
          name: '',
          phone: fbUser.phoneNumber || '',
          email: '',
          role: 'customer',
          city: 'Guwahati',
          state: 'Assam',
          isVerified: false,
          isTestAccount: false,
          createdAt: new Date().toISOString()
        };
      }

      logisticsStore.setCurrentUser(appUser);
      return appUser;
    } catch (err: any) {
      console.error('OTP confirmation error:', err?.code || 'verification_failed');
      if (err.code === 'auth/invalid-verification-code') {
        const remaining = this.maxAttempts - this.attemptCount;
        throw new Error(`Incorrect OTP code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Session expired.'}`);
      } else if (err.code === 'auth/code-expired') {
        this.confirmationResult = null;
        throw new Error('This verification code has expired. Please request a new code.');
      } else {
        throw new Error(err.message || 'OTP verification failed. Please try again.');
      }
    }
  }

  /**
   * Save onboarding profile (strictly enforcing that only 'shipper' or 'driver' can be chosen)
   */
  public async completeOnboarding(profile: {
    userId: string;
    role: 'customer' | 'driver';
    name: string;
    phone: string;
    businessName?: string;
    city: string;
    gstin?: string;
    pan?: string;
    dlNumber?: string;
    vehicleRegNumber?: string;
    vehicleCategory?: string;
    isFleetOwner?: boolean;
    fleetSize?: number;
    passcode?: string;
  }): Promise<User> {
    // SECURITY ENFORCEMENT: Public onboarding can NEVER create an admin
    if ((profile.role as string) === 'admin') {
      throw new Error('Security Violation: Admin role cannot be created via public onboarding.');
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('vs_logged_out');
    }

    let cleanPhone = profile.phone.replace(/\D/g, '');
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    const hasPasscode = Boolean(profile.passcode && /^\d{4,6}$/.test(profile.passcode.trim()));
    const nowIso = new Date().toISOString();

    const isNewPartner = profile.role === 'driver';
    const isTestPhone = false;

    const updatedUser: User = {
      id: profile.userId,
      name: profile.name,
      phone: `+91 ${cleanPhone}`,
      email: `${profile.name.toLowerCase().replace(/\s+/g, '')}@zuggi.in`,
      role: profile.role,
      businessName: profile.businessName || (profile.role === 'customer' ? `${profile.name} Traders` : `${profile.name} Transport`),
      city: profile.city,
      state: 'Assam',
      gstin: profile.gstin,
      pan: profile.pan,
      // CRITICAL: Brand-new drivers/owners MUST remain unverified until Admin approves on backend
      isVerified: isNewPartner ? isTestPhone : true,
      hasPasscode,
      passcodeUpdatedAt: hasPasscode ? nowIso : undefined,
      createdAt: nowIso
    };

    let vehicleObj: CommercialVehicle | undefined;

    if (profile.role === 'driver' && profile.vehicleRegNumber) {
      const vehId = `veh_${cleanPhone || Date.now()}`;
      vehicleObj = {
        id: vehId,
        ownerId: profile.userId,
        transporterName: profile.businessName || `${profile.name} Transport`,
        registrationNumber: profile.vehicleRegNumber.toUpperCase().trim(),
        category: (profile.vehicleCategory as VehicleCategoryType) || 'tata_ace',
        bodyType: 'tarpaulin',
        capacityKg: profile.vehicleCategory === 'eicher_14ft' ? 4500 : 1500,
        modelName: profile.vehicleCategory === 'eicher_14ft' ? 'Eicher Pro 2049' : 'Mahindra Bolero Maxi Truck',
        fuelType: 'diesel',
        permitType: 'all_northeast',
        currentLocation: {
          lat: 26.1445,
          lng: 91.7362,
          address: `${profile.city || 'Guwahati'} Transport Hub`,
          city: profile.city || 'Guwahati'
        },
        isOnline: isTestPhone,
        isAvailable: isTestPhone,
        verificationStatus: isTestPhone ? 'verified' : 'pending',
        documents: [
          {
            id: `doc_rc_${vehId}`,
            type: 'rc',
            documentNumber: profile.vehicleRegNumber.toUpperCase().trim(),
            documentUrl: '',
            expiryDate: '2032-12-31',
            verificationStatus: isTestPhone ? 'verified' : 'pending'
          }
        ],
        driverName: profile.name,
        driverPhone: updatedUser.phone,
        driverRating: 5.0,
        completedTrips: 0,
        photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
      };

      logisticsStore.saveVehicle(vehicleObj);
    }

    // Auto-create SUBMITTED PartnerApplication in Admin Compliance Queue for new real drivers/owners
    if (isNewPartner && !isTestPhone) {
      const existingApp = logisticsStore.getPartnerApplicationByUserId(profile.userId);
      if (!existingApp) {
        const resolvedPartnerType = profile.isFleetOwner ? 'fleet_partner' : 'driver';
        logisticsStore.submitPartnerApplication({
          userId: profile.userId,
          partnerType: resolvedPartnerType,
          fullName: profile.name,
          phone: updatedUser.phone,
          email: updatedUser.email,
          address: `${profile.city || 'Guwahati'}, Assam`,
          city: profile.city || 'Guwahati',
          state: 'Assam',
          pincode: '781001',
          pan: profile.pan || '',
          gstin: profile.gstin || '',
          bankDetails: {
            accountHolderName: profile.name,
            accountNumber: '',
            ifscCode: '',
            bankName: '',
            isVerified: false
          },
          registeredVehicles: vehicleObj
            ? [
                {
                  id: vehicleObj.id,
                  registrationNumber: vehicleObj.registrationNumber,
                  category: vehicleObj.category,
                  modelName: vehicleObj.modelName,
                  capacityKg: vehicleObj.capacityKg,
                  permitType: vehicleObj.permitType,
                  rcDocNumber: vehicleObj.registrationNumber
                }
              ]
            : [],
          documents: [
            ...(profile.dlNumber
              ? [
                  {
                    id: `doc_dl_${cleanPhone}`,
                    name: 'Commercial Driving License',
                    category: 'dl' as const,
                    documentNumber: profile.dlNumber.toUpperCase().trim(),
                    fileUrl: '',
                    uploadedAt: nowIso,
                    status: 'pending' as const
                  }
                ]
              : []),
            ...(profile.vehicleRegNumber
              ? [
                  {
                    id: `doc_rc_${cleanPhone}`,
                    name: 'Vehicle Registration Certificate (RC)',
                    category: 'rc' as const,
                    documentNumber: profile.vehicleRegNumber.toUpperCase().trim(),
                    fileUrl: '',
                    uploadedAt: nowIso,
                    status: 'pending' as const
                  }
                ]
              : [])
          ]
        });
      }
    }

    // Save to in-memory profile registry (never stores passcode digests in browser storage)
    logisticsStore.saveRegisteredProfile(
      cleanPhone,
      updatedUser,
      vehicleObj,
      {
        dlNumber: profile.dlNumber,
        isFleetOwner: profile.isFleetOwner,
        fleetSize: profile.fleetSize,
        hasPasscode
      }
    );

    try {
      await setDoc(doc(db, 'users', profile.userId), updatedUser);

      if (profile.role === 'driver') {
        await setDoc(doc(db, 'drivers', profile.userId), {
          userId: profile.userId,
          name: profile.name,
          dlNumber: profile.dlNumber || 'PENDING_UPLOAD',
          isFleetOwner: profile.isFleetOwner ?? false,
          fleetSize: profile.fleetSize ?? 1,
          verificationStatus: isTestPhone ? 'verified' : 'pending',
          rating: 5.0,
          completedTrips: 0,
          totalEarnings: 0,
          activeVehicleReg: profile.vehicleRegNumber || 'PENDING'
        });

        if (vehicleObj) {
          await setDoc(doc(db, 'vehicles', vehicleObj.id), vehicleObj);
        }
      } else {
        await setDoc(doc(db, 'shippers', profile.userId), {
          userId: profile.userId,
          companyName: profile.businessName || `${profile.name} Commercial Goods`,
          gstin: profile.gstin || '',
          billingAddress: `${profile.city}, Assam`,
          totalLoadsPosted: 0,
          totalSpent: 0,
          rating: 5.0
        });
      }
    } catch {
      // Local fallback
    }

    logisticsStore.saveUser(updatedUser);
    logisticsStore.setCurrentUser(updatedUser);

    if (hasPasscode && profile.passcode) {
      await this.setupUserPasscode(cleanPhone, profile.passcode.trim(), updatedUser);
    }

    return updatedUser;
  }

  /**
   * Checks whether a mobile number already has a registered account and login passcode.
   * Combines backend Supabase lookup with local registry so returning users can log in with no OTP.
   */
  public async checkAccountPasscodeStatus(rawPhone: string): Promise<{
    exists: boolean;
    hasPasscode: boolean;
    name?: string;
    role?: UserRole;
    isBlocked?: boolean;
    blockedReason?: string;
  }> {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    if (clean.length !== 10) return { exists: false, hasPasscode: false };

    const localProfile = logisticsStore.getRegisteredProfile(clean);
    try {
      const res = await fetch('/api/auth/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.exists) {
          return {
            exists: true,
            hasPasscode: Boolean(data.hasPasscode || localProfile?.hasPasscode),
            name: localProfile?.user?.name,
            role: (data.role as UserRole) || localProfile?.user?.role,
            isBlocked: Boolean(data.isBlocked || localProfile?.user?.isBlocked),
            blockedReason: localProfile?.user?.blockedReason
          };
        }
      }
    } catch {
      // Fall back to in-memory registry if network is unreachable
    }

    if (localProfile?.user?.name) {
      return {
        exists: true,
        hasPasscode: Boolean(localProfile.hasPasscode || localProfile.user.hasPasscode),
        name: localProfile.user.name,
        role: localProfile.user.role,
        isBlocked: localProfile.user.isBlocked,
        blockedReason: localProfile.user.blockedReason
      };
    }

    return { exists: false, hasPasscode: false };
  }

  /**
   * Saves a hashed 4-6 digit passcode on both the Express/Supabase backend and local registry.
   */
  public async setupUserPasscode(rawPhone: string, passcode: string, userRecord: User): Promise<User> {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);

    const cleanPasscode = passcode.trim();
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      throw new Error('Passcode must be 4 to 6 numeric digits.');
    }

    const updatedUser: User = {
      ...userRecord,
      phone: `+91 ${clean}`,
      hasPasscode: true,
      passcodeUpdatedAt: new Date().toISOString()
    };

    const res = await fetch('/api/auth/set-passcode', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        phone: clean,
        passcode: cleanPasscode,
        userRecord: updatedUser
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || 'Unable to save passcode. Please verify via OTP and try again.');
    }

    if (data?.sessionToken) {
      logisticsStore.setUserSessionToken(String(data.sessionToken));
    }
    logisticsStore.saveUser(updatedUser);
    logisticsStore.setCurrentUser(updatedUser);
    return updatedUser;
  }

  /**
   * Direct returning-user login using Mobile Number + Passcode (NO OTP required).
   */
  public async loginWithPasscode(
    rawPhone: string,
    passcode: string,
    preferredRole: UserRole = 'customer'
  ): Promise<User> {
    if (preferredRole === 'admin') {
      throw new Error('Admin access requires Platform Owner Security Passcode verification.');
    }

    let clean = rawPhone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    if (clean.length !== 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const cleanPasscode = passcode.trim();
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      throw new Error('Please enter your 4 to 6-digit numeric passcode.');
    }

    let authenticatedUser: User | null = null;
    let serverError: string | null = null;

    try {
      const res = await fetch('/api/auth/login-passcode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ phone: clean, passcode: cleanPasscode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.user) {
        authenticatedUser = data.user as User;
        if (data.sessionToken) {
          logisticsStore.setUserSessionToken(String(data.sessionToken));
        }
      } else {
        serverError = data?.message || 'Invalid mobile number or passcode.';
      }
    } catch {
      throw new Error('Unable to reach authentication server. Please check your connection and try again.');
    }

    if (!authenticatedUser) {
      throw new Error(
        serverError ||
          'Invalid mobile number or passcode. Please try again or reset via OTP.'
      );
    }

    const localProfile = logisticsStore.getRegisteredProfile(clean);
    const existingStoreUser = logisticsStore
      .getUsers()
      .find((u) => u.phone.replace(/\D/g, '').endsWith(clean));

    if (authenticatedUser.isBlocked || existingStoreUser?.isBlocked || localProfile?.user?.isBlocked) {
      throw new Error(
        `Account suspended: ${
          existingStoreUser?.blockedReason ||
          authenticatedUser.blockedReason ||
          localProfile?.user?.blockedReason ||
          'Blocked by Super Admin'
        }.`
      );
    }

    const resolvedRole: UserRole =
      preferredRole === 'customer'
        ? 'customer'
        : authenticatedUser.role === 'vehicle_owner' ||
          authenticatedUser.role === 'transporter' ||
          authenticatedUser.role === 'fleet_partner' ||
          authenticatedUser.role === 'driver'
        ? authenticatedUser.role
        : preferredRole;

    const restoredUser: User = {
      ...localProfile?.user,
      ...authenticatedUser,
      phone: `+91 ${clean}`,
      role: resolvedRole,
      hasPasscode: true,
      businessName:
        authenticatedUser.businessName ||
        localProfile?.user?.businessName ||
        (resolvedRole === 'customer' ? `${authenticatedUser.name} Logistics` : `${authenticatedUser.name} Transport`)
    };

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('vs_logged_out');
    }

    if (resolvedRole !== 'customer' && localProfile?.vehicle) {
      logisticsStore.saveVehicle(localProfile.vehicle);
    }

    logisticsStore.saveRegisteredProfile(clean, restoredUser, localProfile?.vehicle, {
      dlNumber: localProfile?.dlNumber,
      isFleetOwner: localProfile?.isFleetOwner,
      fleetSize: localProfile?.fleetSize,
      hasPasscode: true
    });
    logisticsStore.saveUser(restoredUser);
    logisticsStore.setCurrentUser(restoredUser);
    return restoredUser;
  }

  /**
   * Reset a forgotten 4–6 digit login passcode after one-time SMS OTP verification.
   * Updates the salted scrypt hash on the server/Supabase, clears any brute-force lockout,
   * refreshes the local passcode digest, and signs the user in immediately.
   */
  public async resetUserPasscode(
    rawPhone: string,
    newPasscode: string,
    resetToken: string,
    existingUser?: User | null,
    preferredRole: UserRole = 'customer'
  ): Promise<User> {
    let clean = String(rawPhone || '').replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    const cleanPasscode = String(newPasscode || '').trim();
    if (clean.length !== 10) {
      throw new Error('Please enter a valid 10-digit registered mobile number.');
    }
    if (!/^\d{4,6}$/.test(cleanPasscode)) {
      throw new Error('New passcode must be 4 to 6 numeric digits.');
    }

    const localProfile = logisticsStore.getRegisteredProfile(clean);
    const fallbackUser = existingUser || localProfile?.user || null;

    let serverUser: User | null = null;
    try {
      const res = await fetch('/api/auth/reset-passcode', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          phone: clean,
          newPasscode: cleanPasscode,
          resetToken,
          userRecord: fallbackUser || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to reset passcode. Please verify OTP again.');
      }
      if (data.sessionToken) {
        logisticsStore.setUserSessionToken(String(data.sessionToken));
      }
      serverUser = data.user || null;
    } catch (err: any) {
      if (err instanceof TypeError) {
        throw new Error('Unable to reach server to reset passcode. Please try again.');
      }
      throw err;
    }

    const baseUser = serverUser || fallbackUser;
    if (!baseUser) {
      throw new Error('No registered account found for this mobile number. Please register first.');
    }

    const resolvedRole: UserRole =
      preferredRole === 'customer'
        ? 'customer'
        : isPartnerRole(baseUser.role)
        ? baseUser.role
        : preferredRole;

    const updatedUser: User = {
      ...localProfile?.user,
      ...baseUser,
      phone: `+91 ${clean}`,
      role: resolvedRole,
      hasPasscode: true,
      passcodeUpdatedAt: new Date().toISOString(),
      businessName:
        baseUser.businessName ||
        localProfile?.user?.businessName ||
        (resolvedRole === 'customer' ? `${baseUser.name} Logistics` : `${baseUser.name} Transport`)
    };

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('vs_logged_out');
    }

    if (isPartnerRole(resolvedRole) && localProfile?.vehicle) {
      logisticsStore.saveVehicle(localProfile.vehicle);
    }

    logisticsStore.saveRegisteredProfile(clean, updatedUser, localProfile?.vehicle, {
      dlNumber: localProfile?.dlNumber,
      isFleetOwner: localProfile?.isFleetOwner,
      fleetSize: localProfile?.fleetSize,
      hasPasscode: true
    });
    logisticsStore.saveUser(updatedUser);
    logisticsStore.setCurrentUser(updatedUser);
    return updatedUser;
  }

  /**
   * Check whether Super Admin passcode is configured via env var or claimed during first-run setup.
   */
  public async getAdminSetupStatus(): Promise<{
    configured: boolean;
    claimed: boolean;
    requiresSetup: boolean;
  }> {
    const res = await fetch('/api/auth/admin-status');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || 'Unable to verify Super Admin setup status.');
    }
    return {
      configured: Boolean(data?.configured),
      claimed: Boolean(data?.claimed),
      requiresSetup: Boolean(data?.requiresSetup)
    };
  }

  private async completeOwnerSignIn(sessionToken: string): Promise<User> {
    const adminUser: User = {
      id: 'owner_baruahg39',
      name: 'G. Baruah (Platform Owner)',
      phone: '+91 94350 88219',
      email: SUPER_ADMIN_EMAIL,
      role: 'admin',
      businessName: 'Zuggi Technologies India',
      city: 'Guwahati',
      state: 'Assam',
      isVerified: true,
      createdAt: '2026-01-01T00:00:00Z'
    };

    try {
      await setDoc(doc(db, 'users', adminUser.id), adminUser);
      await setDoc(doc(db, 'admins', adminUser.id), {
        email: SUPER_ADMIN_EMAIL,
        verifiedAt: new Date().toISOString()
      });
    } catch {
      // Firestore sync optional when not authenticated with Firebase Auth
    }

    logisticsStore.setAdminSessionToken(sessionToken);
    logisticsStore.saveUser(adminUser);
    logisticsStore.setCurrentUser(adminUser);
    return adminUser;
  }

  /**
   * One-time first-run Super Admin passcode setup (only active when ZUGGI_ADMIN_PASSCODE is unset).
   */
  public async claimInitialAdminPasscode(newPasscode: string): Promise<User> {
    const cleanPasscode = newPasscode.trim();
    if (cleanPasscode.length < 8) {
      throw new Error('Super Admin passcode must be at least 8 characters long.');
    }

    const res = await fetch('/api/auth/admin-claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: SUPER_ADMIN_EMAIL, passcode: cleanPasscode })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
      throw new Error(data?.message || 'Unable to initialize Super Admin passcode.');
    }

    return this.completeOwnerSignIn(data.token);
  }

  /**
   * Platform Owner Authentication Portal
   * Strictly verifies the owner credential against the backend /api/auth/admin-session endpoint.
   */
  public async loginOwner(secretPasscode: string): Promise<User> {
    const cleanPasscode = secretPasscode.trim();
    if (!cleanPasscode) {
      throw new Error('Please enter your Super Admin passcode.');
    }

    const sessionRes = await fetch('/api/auth/admin-session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ email: SUPER_ADMIN_EMAIL, passcode: cleanPasscode })
    });

    const sessionData = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok || !sessionData?.token) {
      throw new Error(sessionData?.message || 'Access Denied: Invalid Super Admin verification credential.');
    }

    return this.completeOwnerSignIn(sessionData.token);
  }

  /**
   * 100% Free Development Test Mode - Instant Sandbox Login
   * Completely bypasses SMS and external carrier verification.
   * Enables immediate Android mobile testing of full shipper & driver marketplace workflows.
   * Strictly enforces that Admin privileges can NEVER be accessed via test mode.
   */
  public loginDevTestAccount(_idOrPhone: string): User {
    throw new Error('Demo and bot accounts have been removed. Please sign in with your real mobile number or Google account.');
  }

  /**
   * Permanently delete and anonymize the signed-in user's account and personal data across
   * the Express backend, Supabase, Firestore, and browser storage.
   */
  public async deleteMyAccount(
    reason = 'User requested account deletion',
    source = 'in_app'
  ): Promise<{ referenceId?: string; message: string }> {
    const current = logisticsStore.getCurrentUser();
    const userToken = logisticsStore.getUserSessionToken();
    const cleanPhone = (current?.phone || '').replace(/\D/g, '').slice(-10);

    let referenceId: string | undefined;
    let message = 'Your account and personal data have been erased and anonymized.';

    // 1. Trigger authoritative server-side & Supabase erasure/anonymization
    if (cleanPhone.length === 10 || userToken) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      const res = await fetch('/api/auth/request-account-deletion', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          phone: cleanPhone || undefined,
          reason,
          source
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.message ||
            'Please verify your mobile number via OTP at /delete-account to permanently erase your account.'
        );
      }
      referenceId = data.referenceId;
      if (data.message) message = data.message;
    }

    // 2. Anonymize & delete Firestore user/role documents when signed in via Firebase Auth
    if (auth.currentUser?.uid) {
      const uid = auth.currentUser.uid;
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            id: uid,
            name: 'Deleted User',
            phone: '',
            email: '',
            businessName: '',
            gstin: '',
            pan: '',
            address: '',
            bankDetails: null,
            isVerified: false,
            deletedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch {
        // Non-blocking if Firestore user doc doesn't exist
      }
      try {
        await deleteDoc(doc(db, 'shippers', uid));
      } catch {
        // Non-blocking
      }
      try {
        await deleteDoc(doc(db, 'drivers', uid));
      } catch {
        // Non-blocking
      }
    }

    // 3. Erase all in-memory PII & sign out cleanly
    if (current?.id || cleanPhone) {
      logisticsStore.eraseAccountFromMemory(current?.id || '', cleanPhone);
    }
    await this.logout();
    return { referenceId, message };
  }

  /**
   * Log out of current session:
   * Completely wipes all session storage, clears local user state,
   * signs out of Firebase Auth, and ensures currentUser is null.
   */
  public async logout(): Promise<void> {
    // Blacklist active user/admin JWT session token & clear HttpOnly cookies server-side
    try {
      const headers = logisticsStore.buildAuthHeaders(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers
      });
    } catch {
      // Non-blocking if offline
    }
    try {
      await fbSignOut(auth);
    } catch {
      // Ignored
    }
    this.confirmationResult = null;
    this.attemptCount = 0;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('vs_logged_out', 'true');
      sessionStorage.removeItem('vs_otp_cooldown_expiry');
    }
    logisticsStore.setUserSessionToken(null);
    logisticsStore.setAdminSessionToken(null);
    logisticsStore.purgeAllUserPiiFromBrowserStorage();
    logisticsStore.setCurrentUser(null);
  }
}

export const authService = new AuthService();
