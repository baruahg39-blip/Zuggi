import {
  AdminReviewLog,
  AppNotification,
  Booking,
  CashfreeVendor,
  CommercialVehicle,
  DigitalAcceptanceSubmission,
  GeofenceEvent,
  GeofenceZoneConfig,
  GeofenceZoneState,
  Invoice,
  LoadItem,
  LoadStatus,
  LocationPing,
  MarketplacePaymentTransaction,
  PartnerAccountStatus,
  PartnerAgreementType,
  PartnerApplication,
  PartnerType,
  PartnerUploadedDoc,
  PaymentDispute,
  Quotation,
  Settlement,
  SupportTicket,
  TicketCategory,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  TripFeedback,
  User,
  UserRole,
  VehicleCategory,
  VehicleCategoryType
} from '../types';
import {
  DEFAULT_GEOFENCE_CONFIG,
  evaluateGeofenceCrossing,
  buildGeofenceEventMessage,
  calculateDistanceMeters,
  formatMetersOrKm
} from '../utils/geofence';
import {
  HUBS_LOCATIONS,
  VEHICLE_CATEGORIES,
  SEED_BOOKINGS,
  SEED_SETTLEMENTS,
  SEED_VEHICLES,
  SEED_LOADS,
  SEED_QUOTATIONS
} from '../data/mockData';
import { SEED_PARTNER_APPLICATIONS } from '../data/seedPartnerApplications';
import {
  db,
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  SUPER_ADMIN_EMAIL
} from './firebase';

// Highway corridor waypoints from Dibrugarh to Guwahati along NH-27 / NH-37
export const NH27_CORRIDOR_WAYPOINTS = [
  { lat: 27.4728, lng: 94.9120, name: 'Dibrugarh Jalan Tea Yard', km: 0 },
  { lat: 27.2415, lng: 94.6218, name: 'Moranhat Bypass', km: 45 },
  { lat: 26.9825, lng: 94.6341, name: 'Sibsagar Commercial Gate', km: 82 },
  { lat: 26.7509, lng: 94.2037, name: 'Jorhat Gar-Ali Flyover', km: 135 },
  { lat: 26.5821, lng: 93.9632, name: 'Dergaon Toll Plaza', km: 160 },
  { lat: 26.6543, lng: 93.3854, name: 'Kaziranga National Highway', km: 230 },
  { lat: 26.5412, lng: 92.7915, name: 'Jakhalabandha Junction', km: 290 },
  { lat: 26.3421, lng: 92.6841, name: 'Nagaon Bypass Toll Gate', km: 330 },
  { lat: 26.1925, lng: 92.1245, name: 'Jagiroad Industrial Corridor', km: 390 },
  { lat: 26.1445, lng: 91.8210, name: 'Khanapara Entry Toll, Guwahati', km: 425 },
  { lat: 26.1856, lng: 91.6881, name: 'Amingaon Inland Container Depot, Guwahati', km: 442 }
];

const STORAGE_KEYS = {
  CURRENT_USER: 'vs_current_user',
  USERS: 'vs_users',
  VEHICLES: 'vs_vehicles',
  LOADS: 'vs_loads',
  QUOTATIONS: 'vs_quotations',
  BOOKINGS: 'vs_bookings',
  LOCATION_PINGS: 'vs_location_pings',
  INVOICES: 'vs_invoices',
  SETTLEMENTS: 'vs_settlements',
  NOTIFICATIONS: 'vs_notifications',
  TICKETS: 'vs_support_tickets',
  FEEDBACKS: 'vs_trip_feedbacks',
  CASHFREE_VENDORS: 'vs_cashfree_vendors',
  PAYMENT_TRANSACTIONS: 'vs_payment_transactions',
  DISPUTES: 'vs_payment_disputes',
  PARTNER_APPLICATIONS: 'vs_partner_applications',
  AGREEMENT_ACCEPTANCES: 'vs_agreement_acceptances',
  USER_REGISTRY: 'vs_user_profile_registry',
  GEOFENCE_CONFIGS: 'vs_geofence_configs',
  GEOFENCE_STATES: 'vs_geofence_states',
  GEOFENCE_EVENTS: 'vs_geofence_events'
};

const BROADCAST_NAME = 'vahansetu_state_sync';
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_NAME);
  }
} catch {
  // BroadcastChannel unavailable
}

class LogisticsStore {
  private listeners: Set<() => void> = new Set();
  private unsubscribers: Array<() => void> = [];
  private supabaseBootstrapped = false;

  constructor() {
    this.purgeLegacyDemoData();
    this.seedRegistryIfEmpty();
    if (broadcastChannel) {
      broadcastChannel.onmessage = () => {
        this.notifyListeners();
      };
    }
    // Initialize Firestore & Supabase synchronization with active user if logged in
    const active = this.getCurrentUser();
    if (active) {
      this.initFirestoreSync(active);
    }
    void this.initSupabaseSync();
  }

  private purgeLegacyDemoData() {
    if (typeof window === 'undefined') return;

    // Purge legacy demo personas & fake records if they exist in localStorage
    const userRaw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (
      userRaw && 
      (userRaw.includes('user_cust_01') || 
       userRaw.includes('user_trans_01') || 
       userRaw.includes('user_admin_01') || 
       userRaw.includes('Rajesh Agarwal') || 
       userRaw.includes('Bikash Kalita'))
    ) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.LOADS);
      localStorage.removeItem(STORAGE_KEYS.QUOTATIONS);
      localStorage.removeItem(STORAGE_KEYS.BOOKINGS);
      localStorage.removeItem(STORAGE_KEYS.VEHICLES);
      localStorage.removeItem(STORAGE_KEYS.INVOICES);
      localStorage.removeItem(STORAGE_KEYS.SETTLEMENTS);
      localStorage.removeItem(STORAGE_KEYS.TICKETS);
      localStorage.removeItem(STORAGE_KEYS.FEEDBACKS);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error invoking store listener', err);
      }
    });
  }

  private safeJsonParse<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  private triggerChange() {
    this.notifyListeners();
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage('state_updated');
      } catch {
        // broadcast failed
      }
    }
  }

  // --- Users & Roles ---
  public getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) {
      return null;
    }
    try {
      const u = JSON.parse(raw);
      if (u && u.id && u.role && u.name) {
        return u;
      }
      return null;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
    this.initFirestoreSync(user);
    void this.initSupabaseSync(true);
    this.triggerChange();
  }

  public switchCurrentUserRole(role: UserRole) {
    const user = this.getCurrentUser();
    if (user) {
      user.role = role;
      if (role === 'admin') {
        user.email = SUPER_ADMIN_EMAIL;
      }
      this.setCurrentUser(user);
    }
  }

  private mergeCollectionById<T extends { id: string }>(
    storageKey: string,
    localItems: T[],
    remoteItems: T[]
  ): boolean {
    if (!Array.isArray(remoteItems) || remoteItems.length === 0) return false;
    const remoteMap = new Map(remoteItems.filter((item) => item && item.id).map((item) => [item.id, item]));
    const merged: T[] = [...remoteMap.values()];
    localItems.forEach((item) => {
      if (item && item.id && !remoteMap.has(item.id)) {
        merged.push(item);
      }
    });
    localStorage.setItem(storageKey, JSON.stringify(merged));
    return true;
  }

  private syncToSupabase(
    table: 'vs_users' | 'vs_vehicles' | 'vs_loads' | 'vs_quotations' | 'vs_bookings' | 'vs_support_tickets',
    payload: any | any[]
  ) {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const body = Array.isArray(payload) ? { table, records: payload } : { table, record: payload };
    fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  public async initSupabaseSync(force = false): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    if (this.supabaseBootstrapped && !force) return;
    this.supabaseBootstrapped = true;

    try {
      const res = await fetch('/api/db/bootstrap');
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.configured || !json?.tablesReady || !json?.data) return;

      const remote = json.data;
      let changed = false;

      if (Array.isArray(remote.users) && remote.users.length > 0) {
        changed = this.mergeCollectionById<User>(STORAGE_KEYS.USERS, this.getUsers(), remote.users) || changed;
        remote.users.forEach((u: User) => {
          if (u?.phone) {
            const existingVeh = Array.isArray(remote.vehicles)
              ? remote.vehicles.find((v: CommercialVehicle) => v.ownerId === u.id)
              : undefined;
            this.saveRegisteredProfile(u.phone, u, existingVeh);
          }
        });
      }
      if (Array.isArray(remote.vehicles) && remote.vehicles.length > 0) {
        changed = this.mergeCollectionById<CommercialVehicle>(STORAGE_KEYS.VEHICLES, this.getVehicles(), remote.vehicles) || changed;
      }
      if (Array.isArray(remote.loads) && remote.loads.length > 0) {
        changed = this.mergeCollectionById<LoadItem>(STORAGE_KEYS.LOADS, this.getLoads(), remote.loads) || changed;
      }
      if (Array.isArray(remote.quotations) && remote.quotations.length > 0) {
        changed = this.mergeCollectionById<Quotation>(STORAGE_KEYS.QUOTATIONS, this.getQuotations(), remote.quotations) || changed;
      }
      if (Array.isArray(remote.bookings) && remote.bookings.length > 0) {
        changed = this.mergeCollectionById<Booking>(STORAGE_KEYS.BOOKINGS, this.getBookings(), remote.bookings) || changed;
      }
      if (Array.isArray(remote.tickets) && remote.tickets.length > 0) {
        changed = this.mergeCollectionById<SupportTicket>(STORAGE_KEYS.TICKETS, this.getTickets(), remote.tickets) || changed;
      }

      if (changed) {
        this.notifyListeners();
      }
    } catch {
      // Silent fallback to Firestore + localStorage
    }
  }

  /**
   * Real-time bidirectional synchronization with Firebase Firestore.
   * Respects user roles and private data boundaries:
   * - Drivers only receive their own submitted bids.
   * - Shippers receive bids submitted for their loads.
   * - Platform owner / Admin has global auditing capabilities.
   */
  public initFirestoreSync(user: User | null) {
    // Teardown previous listeners
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignored
      }
    });
    this.unsubscribers = [];

    if (!user || typeof window === 'undefined') return;

    try {
      // 1. Synchronize Loads Collection
      const loadsRef = collection(db, 'loads');
      const unsubLoads = onSnapshot(
        loadsRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteLoads: LoadItem[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as LoadItem;
              if (data && data.id) {
                remoteLoads.push(data);
              }
            });
            if (remoteLoads.length > 0) {
              const localLoads = this.getLoads();
              const remoteMap = new Map(remoteLoads.map((l) => [l.id, l]));
              const merged = [...remoteLoads];
              localLoads.forEach((l) => {
                if (!remoteMap.has(l.id)) merged.push(l);
              });
              localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(merged));
              this.notifyListeners();
            }
          }
        },
        (err) => {
          console.warn('Firestore loads listener sync:', err.message);
        }
      );
      this.unsubscribers.push(unsubLoads);

      // 2. Synchronize Bids Collection (Privacy Guard: Driver only sees own bids)
      let bidsQuery;
      if (user.role === 'admin') {
        bidsQuery = query(collection(db, 'bids'));
      } else if (user.role === 'driver') {
        bidsQuery = query(collection(db, 'bids'), where('driverId', '==', user.id));
      } else {
        bidsQuery = query(collection(db, 'bids'), where('customerId', '==', user.id));
      }

      const unsubBids = onSnapshot(
        bidsQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteBids: Quotation[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Quotation;
              if (data && data.id) {
                remoteBids.push(data);
              }
            });
            if (remoteBids.length > 0) {
              const localBids = this.getQuotations();
              const remoteMap = new Map(remoteBids.map((b) => [b.id, b]));
              const merged = [...remoteBids];
              localBids.forEach((b) => {
                if (!remoteMap.has(b.id)) merged.push(b);
              });
              localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(merged));
              this.notifyListeners();
            }
          }
        },
        (err) => {
          console.warn('Firestore bids listener sync:', err.message);
        }
      );
      this.unsubscribers.push(unsubBids);

      // 3. Synchronize Bookings
      let bookingsQuery;
      if (user.role === 'admin') {
        bookingsQuery = query(collection(db, 'bookings'));
      } else if (user.role === 'driver') {
        bookingsQuery = query(collection(db, 'bookings'), where('driverId', '==', user.id));
      } else {
        bookingsQuery = query(collection(db, 'bookings'), where('customerId', '==', user.id));
      }

      const unsubBookings = onSnapshot(
        bookingsQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteBookings: Booking[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Booking;
              if (data && data.id) {
                remoteBookings.push(data);
              }
            });
            if (remoteBookings.length > 0) {
              const localBookings = this.getBookings();
              const remoteMap = new Map(remoteBookings.map((b) => [b.id, b]));
              const merged = [...remoteBookings];
              localBookings.forEach((b) => {
                if (!remoteMap.has(b.id)) merged.push(b);
              });
              localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(merged));
              this.notifyListeners();
            }
          }
        },
        (err) => {
          console.warn('Firestore bookings listener sync:', err.message);
        }
      );
      this.unsubscribers.push(unsubBookings);

      // 4. Synchronize Commercial Vehicles
      const vehiclesRef = collection(db, 'vehicles');
      const unsubVehicles = onSnapshot(
        vehiclesRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteVehicles: CommercialVehicle[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as CommercialVehicle;
              if (data && data.id) {
                remoteVehicles.push(data);
              }
            });
            if (remoteVehicles.length > 0) {
              const localVehicles = this.getVehicles();
              const remoteMap = new Map(remoteVehicles.map((v) => [v.id, v]));
              const merged = [...remoteVehicles];
              localVehicles.forEach((v) => {
                if (!remoteMap.has(v.id)) merged.push(v);
              });
              localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(merged));
              this.notifyListeners();
            }
          }
        },
        (err) => {
          console.warn('Firestore vehicles listener sync:', err.message);
        }
      );
      this.unsubscribers.push(unsubVehicles);

      // 5. Synchronize Trip Feedbacks
      const feedbacksRef = collection(db, 'trip_feedbacks');
      const unsubFeedbacks = onSnapshot(
        feedbacksRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteFeedbacks: TripFeedback[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as TripFeedback;
              if (data && data.id) {
                remoteFeedbacks.push(data);
              }
            });
            if (remoteFeedbacks.length > 0) {
              localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(remoteFeedbacks));
              this.notifyListeners();
            }
          }
        },
        (err) => {
          console.warn('Firestore feedbacks listener sync:', err.message);
        }
      );
      this.unsubscribers.push(unsubFeedbacks);

    } catch (err: any) {
      console.warn('Firestore sync setup warning:', err?.message);
    }
  }

  public getUsers(): User[] {
    return this.safeJsonParse<User[]>(STORAGE_KEYS.USERS, []);
  }

  public getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  }

  // --- Permanent User Profile Registry (Keyed by 10-digit mobile number) ---
  public seedRegistryIfEmpty() {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEYS.USER_REGISTRY);
    let registry: Record<string, any> = {};
    if (raw) {
      try {
        registry = JSON.parse(raw);
      } catch {
        registry = {};
      }
    }

    let modified = false;

    // 1. Gaurov Baruah (+91 9678944132)
    if (!registry['9678944132']) {
      registry['9678944132'] = {
        user: {
          id: 'user_driver_9678944132',
          name: 'Gaurov Baruah',
          phone: '+91 96789 44132',
          email: 'baruahg39@gmail.com',
          role: 'driver',
          businessName: 'VahanSetu Assam Express Fleet',
          city: 'Guwahati',
          state: 'Assam',
          isVerified: true,
          createdAt: '2026-01-01T00:00:00Z'
        },
        vehicle: {
          id: 'veh_demo_9678944132',
          ownerId: 'user_driver_9678944132',
          transporterName: 'VahanSetu Assam Express Fleet',
          registrationNumber: 'AS-01-DM-0000',
          category: 'bolero_pickup',
          bodyType: 'tarpaulin',
          capacityKg: 1750,
          modelName: 'Mahindra Bolero Maxi Truck Plus',
          fuelType: 'diesel',
          permitType: 'all_northeast',
          currentLocation: {
            lat: 26.1445,
            lng: 91.7362,
            address: 'Beltola Wholesale Transport Yard, Guwahati',
            city: 'Guwahati'
          },
          isOnline: true,
          isAvailable: true,
          verificationStatus: 'verified',
          driverName: 'Gaurov Baruah',
          driverPhone: '+91 96789 44132',
          driverRating: 4.9,
          completedTrips: 14,
          photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
        },
        updatedAt: new Date().toISOString()
      };
      modified = true;
    }

    // 2. Shipper (+91 9999911111)
    if (!registry['9999911111']) {
      registry['9999911111'] = {
        user: {
          id: 'test_shipper_9911',
          name: 'Brahmaputra Valley Agro Commodities',
          phone: '+91 99999 11111',
          email: '9999911111@test.vahansetu.in',
          role: 'customer',
          businessName: 'Assam Tea Exports & FMCG Ltd',
          city: 'Guwahati',
          state: 'Assam',
          isVerified: true,
          isTestAccount: true,
          createdAt: '2026-01-01T00:00:00Z'
        },
        updatedAt: new Date().toISOString()
      };
      modified = true;
    }

    // 3. Driver Bikash (+91 9999922222)
    if (!registry['9999922222']) {
      registry['9999922222'] = {
        user: {
          id: 'test_driver_9922',
          name: 'Bikash Highway Transport',
          phone: '+91 99999 22222',
          email: '9999922222@test.vahansetu.in',
          role: 'driver',
          businessName: 'Bikash Logistics Assam',
          city: 'Nagaon',
          state: 'Assam',
          isVerified: true,
          isTestAccount: true,
          createdAt: '2026-01-01T00:00:00Z'
        },
        vehicle: {
          id: 'veh_test_driver_9922',
          ownerId: 'test_driver_9922',
          transporterName: 'Bikash Logistics Assam',
          registrationNumber: 'AS-02-TC-9911',
          category: 'bolero_pickup',
          bodyType: 'tarpaulin',
          capacityKg: 1500,
          modelName: 'Mahindra Bolero Maxi Truck',
          fuelType: 'diesel',
          permitType: 'all_northeast',
          currentLocation: {
            lat: 26.3421,
            lng: 92.6841,
            address: 'Nagaon Bypass Commercial Yard',
            city: 'Nagaon'
          },
          isOnline: true,
          isAvailable: true,
          verificationStatus: 'verified',
          driverName: 'Bikash Highway Transport',
          driverPhone: '+91 99999 22222',
          driverRating: 4.9,
          completedTrips: 18,
          photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
        },
        updatedAt: new Date().toISOString()
      };
      modified = true;
    }

    // 4. Fleet Owner Pragati (+91 9999933333)
    if (!registry['9999933333']) {
      registry['9999933333'] = {
        user: {
          id: 'test_driver_9933',
          name: 'Pragati Multi-Axle Fleet',
          phone: '+91 99999 33333',
          email: '9999933333@test.vahansetu.in',
          role: 'driver',
          businessName: 'Kamrup Heavy Carriers Pvt Ltd',
          city: 'Jorhat',
          state: 'Assam',
          isVerified: true,
          isTestAccount: true,
          createdAt: '2026-01-01T00:00:00Z'
        },
        vehicle: {
          id: 'veh_test_driver_9933',
          ownerId: 'test_driver_9933',
          transporterName: 'Kamrup Heavy Carriers Pvt Ltd',
          registrationNumber: 'AS-03-CC-8822',
          category: 'eicher_14ft',
          bodyType: 'tarpaulin',
          capacityKg: 4500,
          modelName: 'Eicher Pro 2049',
          fuelType: 'diesel',
          permitType: 'all_northeast',
          currentLocation: {
            lat: 26.7509,
            lng: 94.2037,
            address: 'Jorhat Gar-Ali Transport Hub',
            city: 'Jorhat'
          },
          isOnline: true,
          isAvailable: true,
          verificationStatus: 'verified',
          driverName: 'Pragati Multi-Axle Fleet',
          driverPhone: '+91 99999 33333',
          driverRating: 5.0,
          completedTrips: 32,
          photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
        },
        updatedAt: new Date().toISOString()
      };
      modified = true;
    }

    if (modified) {
      localStorage.setItem(STORAGE_KEYS.USER_REGISTRY, JSON.stringify(registry));
    }

    // Ensure seeded registry accounts also appear in USERS list for Admin Console monitoring
    const currentUsers = this.getUsers();
    let usersModified = false;
    Object.values(registry).forEach((entry: any) => {
      if (entry?.user?.id && !currentUsers.some((u) => u.id === entry.user.id)) {
        currentUsers.push(entry.user);
        usersModified = true;
      }
    });
    if (usersModified) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
    }
  }

  public getRegisteredProfile(phone: string): {
    user: User;
    vehicle?: CommercialVehicle;
    dlNumber?: string;
    isFleetOwner?: boolean;
    fleetSize?: number;
    hasPasscode?: boolean;
    passcodeDigest?: string;
  } | null {
    if (typeof window === 'undefined') return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    if (!clean || clean.length < 10) return null;

    const raw = localStorage.getItem(STORAGE_KEYS.USER_REGISTRY);
    if (!raw) return null;
    try {
      const registry = JSON.parse(raw);
      return registry[clean] || null;
    } catch {
      return null;
    }
  }

  public async computeLocalPasscodeDigest(phone: string, passcode: string): Promise<string> {
    let clean = phone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    const payload = `zuggi_pin_v1:${clean}:${passcode.trim()}`;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(payload);
      const buf = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    // Lightweight fallback hash when SubtleCrypto is unavailable in insecure context
    let h = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fnv:${(h >>> 0).toString(16)}`;
  }

  public async setLocalPasscode(phone: string, passcode: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    if (!clean || clean.length < 10) return null;

    const digest = await this.computeLocalPasscodeDigest(clean, passcode);
    const existing = this.getRegisteredProfile(clean);
    if (existing?.user) {
      this.saveRegisteredProfile(
        clean,
        {
          ...existing.user,
          hasPasscode: true,
          passcodeUpdatedAt: new Date().toISOString()
        },
        existing.vehicle,
        {
          dlNumber: existing.dlNumber,
          isFleetOwner: existing.isFleetOwner,
          fleetSize: existing.fleetSize,
          hasPasscode: true,
          passcodeDigest: digest
        }
      );
    }
    return digest;
  }

  public async verifyLocalPasscode(phone: string, passcode: string): Promise<boolean> {
    const profile = this.getRegisteredProfile(phone);
    if (!profile?.passcodeDigest) return false;
    const digest = await this.computeLocalPasscodeDigest(phone, passcode);
    return digest === profile.passcodeDigest;
  }

  public saveRegisteredProfile(
    phone: string,
    user: User,
    vehicle?: CommercialVehicle,
    extra?: {
      dlNumber?: string;
      isFleetOwner?: boolean;
      fleetSize?: number;
      hasPasscode?: boolean;
      passcodeDigest?: string;
    }
  ) {
    if (typeof window === 'undefined') return;
    let clean = phone.replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length > 10) clean = clean.slice(-10);
    if (!clean || clean.length < 10) return;

    let registry: Record<string, any> = {};
    const raw = localStorage.getItem(STORAGE_KEYS.USER_REGISTRY);
    if (raw) {
      try {
        registry = JSON.parse(raw);
      } catch {}
    }

    const existing = registry[clean];
    const hasPasscode = Boolean(
      extra?.hasPasscode ?? user.hasPasscode ?? existing?.hasPasscode ?? existing?.user?.hasPasscode
    );

    registry[clean] = {
      user: {
        ...user,
        phone: `+91 ${clean}`,
        hasPasscode
      },
      vehicle: vehicle || existing?.vehicle,
      dlNumber: extra?.dlNumber || existing?.dlNumber,
      isFleetOwner: extra?.isFleetOwner ?? existing?.isFleetOwner,
      fleetSize: extra?.fleetSize ?? existing?.fleetSize,
      hasPasscode,
      passcodeDigest: extra?.passcodeDigest || existing?.passcodeDigest,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEYS.USER_REGISTRY, JSON.stringify(registry));
  }

  public saveUser(user: User) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    if (user.phone) {
      this.saveRegisteredProfile(user.phone, user);
    }
    this.syncToSupabase('vs_users', user);

    this.triggerChange();
  }

  // --- Vehicles ---
  public getVehicles(): CommercialVehicle[] {
    const raw = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(SEED_VEHICLES));
      return SEED_VEHICLES;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return SEED_VEHICLES;
    } catch {
      return SEED_VEHICLES;
    }
  }

  public getVehicleById(id: string): CommercialVehicle | undefined {
    return this.getVehicles().find((v) => v.id === id);
  }

  public saveVehicle(vehicle: CommercialVehicle) {
    const vehicles = this.getVehicles();
    const idx = vehicles.findIndex((v) => v.id === vehicle.id);
    if (idx >= 0) {
      vehicles[idx] = vehicle;
    } else {
      vehicles.unshift(vehicle);
    }
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    setDoc(doc(db, 'vehicles', vehicle.id), vehicle).catch(() => {});
    this.syncToSupabase('vs_vehicles', vehicle);

    const contactPhone = vehicle.driverPhone || this.getUserById(vehicle.ownerId)?.phone;
    if (contactPhone) {
      const reg = this.getRegisteredProfile(contactPhone);
      if (reg) {
        this.saveRegisteredProfile(contactPhone, reg.user, vehicle);
      }
    }

    this.triggerChange();
  }

  public toggleVehicleOnline(vehicleId: string, isOnline: boolean) {
    const vehicles = this.getVehicles();
    const v = vehicles.find((item) => item.id === vehicleId);
    if (v) {
      if (isOnline && v.isBlocked) {
        return;
      }
      v.isOnline = isOnline;
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      updateDoc(doc(db, 'vehicles', vehicleId), { isOnline }).catch(() => {});
      this.syncToSupabase('vs_vehicles', v);
      this.triggerChange();
    }
  }

  public updateVehicleVerification(vehicleId: string, status: 'verified' | 'rejected' | 'pending', reason?: string) {
    const vehicles = this.getVehicles();
    const v = vehicles.find((item) => item.id === vehicleId);
    if (v) {
      v.verificationStatus = status;
      v.documents = v.documents.map((docItem) => ({
        ...docItem,
        verificationStatus: status,
        rejectionReason: status === 'rejected' ? reason || 'Document image unclear' : undefined,
        verifiedAt: status === 'verified' ? new Date().toISOString() : undefined
      }));
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      updateDoc(doc(db, 'vehicles', vehicleId), {
        verificationStatus: status,
        documents: v.documents
      }).catch(() => {});
      this.syncToSupabase('vs_vehicles', v);
      
      this.addNotification({
        recipientRole: 'driver',
        recipientId: v.ownerId,
        title: status === 'verified' ? 'Vehicle Approved!' : 'Vehicle Verification Status Updated',
        message: status === 'verified' 
          ? `Vehicle ${v.registrationNumber} has been verified and is ready to accept loads.`
          : `Vehicle ${v.registrationNumber} document issue: ${reason || 'Please re-upload clear copies'}.`,
        type: 'document_verified',
        linkId: v.id
      });

      this.triggerChange();
    }
  }

  // --- Loads ---
  public getLoads(): LoadItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOADS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(SEED_LOADS));
      return SEED_LOADS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return SEED_LOADS;
    } catch {
      return SEED_LOADS;
    }
  }

  public getLoadById(id: string): LoadItem | undefined {
    return this.getLoads().find((l) => l.id === id);
  }

  public createLoad(newLoadData: Omit<LoadItem, 'id' | 'createdAt' | 'status' | 'matchedVehicleCount' | 'deliveryOtp'>): LoadItem {
    const loads = this.getLoads();
    const id = `load_${Date.now()}`;
    // Generate secure 4-digit OTP for consignee delivery handover
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Match count based on vehicle category & capacity
    const vehicles = this.getVehicles();
    const matched = vehicles.filter(
      (v) => v.category === newLoadData.requiredVehicleCategory && v.isOnline && v.isAvailable
    ).length;

    const currentUser = this.getCurrentUser();
    const isTestLoad = !!(currentUser?.isTestAccount || (currentUser?.phone && currentUser.phone.includes('99999')));

    const newLoad: LoadItem = {
      ...newLoadData,
      id,
      createdAt: new Date().toISOString(),
      status: 'posted',
      matchedVehicleCount: Math.max(matched, 0),
      deliveryOtp,
      isTestLoad
    };

    loads.unshift(newLoad);
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));

    // Save to Firestore & Supabase
    setDoc(doc(db, 'loads', newLoad.id), newLoad).catch((err) => {
      console.warn('Firestore load sync notice:', err?.message);
    });
    this.syncToSupabase('vs_loads', newLoad);

    // Notify drivers in network
    this.addNotification({
      recipientRole: 'driver',
      recipientId: 'all_drivers',
      title: 'New Profitable Load Alert',
      message: `${newLoad.pickup.city} to ${newLoad.delivery.city}: ${newLoad.goodsDescription.slice(0, 40)}... (₹${newLoad.targetBudgetInr?.toLocaleString('en-IN') || 'Open Bid'})`,
      type: 'bid_received',
      linkId: id
    });

    this.triggerChange();
    return newLoad;
  }

  public cancelLoad(loadId: string, reason = 'Cancelled by shipper'): { success: boolean; message: string } {
    const loads = this.getLoads();
    const load = loads.find((l) => l.id === loadId);
    if (!load) return { success: false, message: 'Load not found' };

    load.status = 'cancelled';
    load.cancellationReason = reason;
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    this.syncToSupabase('vs_loads', load);

    if (load.assignedBookingId) {
      const bookings = this.getBookings();
      const b = bookings.find((item) => item.id === load.assignedBookingId);
      if (b) {
        b.status = 'cancelled';
        localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
        updateDoc(doc(db, 'bookings', b.id), { status: 'cancelled' }).catch(() => {});
        this.syncToSupabase('vs_bookings', b);
      }
    }

    updateDoc(doc(db, 'loads', loadId), {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    }).catch(() => {});

    this.addNotification({
      recipientRole: 'driver',
      recipientId: 'all_drivers',
      title: 'Load Cancelled',
      message: `Load ${load.pickup.city} to ${load.delivery.city} has been cancelled (${reason}).`,
      type: 'alert',
      linkId: loadId
    });

    this.triggerChange();
    return { success: true, message: 'Load cancelled successfully.' };
  }

  public updateLoadStatus(loadId: string, status: LoadItem['status']) {
    const loads = this.getLoads();
    const load = loads.find((l) => l.id === loadId);
    if (load) {
      load.status = status;
      localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
      updateDoc(doc(db, 'loads', loadId), { status }).catch(() => {});
      this.syncToSupabase('vs_loads', load);
      this.triggerChange();
    }
  }

  // --- Quotations & Bidding ---
  public getQuotations(loadId?: string): Quotation[] {
    const raw = localStorage.getItem(STORAGE_KEYS.QUOTATIONS);
    let quotes: Quotation[] = [];
    if (!raw) {
      quotes = SEED_QUOTATIONS;
      localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));
    } else {
      try {
        quotes = JSON.parse(raw);
        if (!Array.isArray(quotes)) quotes = SEED_QUOTATIONS;
      } catch {
        quotes = SEED_QUOTATIONS;
      }
    }
    if (loadId) {
      return quotes.filter((q) => q.loadId === loadId);
    }
    return quotes;
  }

  public submitQuotation(quoteData: Omit<Quotation, 'id' | 'status' | 'createdAt'>): Quotation {
    const quotes = this.getQuotations();

    // Prevent duplicate bid submission for the same load by the same transporter
    const existing = quotes.find(
      (q) => q.loadId === quoteData.loadId && q.transporterId === quoteData.transporterId && q.status !== 'withdrawn'
    );
    if (existing) {
      return existing;
    }

    const id = `quote_${Date.now()}`;
    const currentUser = this.getCurrentUser();
    const isTestBid = !!(currentUser?.isTestAccount || (currentUser?.phone && currentUser.phone.includes('99999')));
    
    // Strict Booking Permission: Enforce approved partner status
    const eligibility = this.checkPartnerBookingEligibility(quoteData.transporterId);
    if (!eligibility.isEligible && !isTestBid) {
      throw new Error(`Bidding restricted: ${eligibility.reason}`);
    }

    const load = this.getLoadById(quoteData.loadId);

    const newQuote: Quotation = {
      ...quoteData,
      id,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      isTestBid
    };

    quotes.push(newQuote);
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

    // Save to Firestore & Supabase
    setDoc(doc(db, 'bids', newQuote.id), {
      ...newQuote,
      driverId: newQuote.transporterId,
      customerId: load?.customerId || '',
      isTestBid
    }).catch((err) => {
      console.warn('Firestore bid save notice:', err?.message);
    });
    this.syncToSupabase('vs_quotations', newQuote);

    // Mark load as bidding
    if (load && load.status === 'posted') {
      this.updateLoadStatus(load.id, 'bidding');
    }

    // Notify customer
    if (load) {
      this.addNotification({
        recipientRole: 'customer',
        recipientId: load.customerId,
        title: `New Quotation: ₹${quoteData.quoteAmountInr.toLocaleString('en-IN')}`,
        message: `${quoteData.transporterName} (${quoteData.vehicleRegNumber}) quoted for your shipment to ${load.delivery.city}.`,
        type: 'bid_received',
        linkId: load.id
      });
    }

    this.triggerChange();
    return newQuote;
  }

  public counterOfferQuotation(quoteId: string, counterAmount: number, note: string) {
    const quotes = this.getQuotations();
    const q = quotes.find((item) => item.id === quoteId);
    if (q) {
      q.counterOfferAmountInr = counterAmount;
      q.counterOfferNote = note;
      q.status = 'countered';
      localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

      updateDoc(doc(db, 'bids', q.id), {
        counterOfferAmountInr: counterAmount,
        counterOfferNote: note,
        status: 'countered',
        updatedAt: new Date().toISOString()
      }).catch(() => {});
      this.syncToSupabase('vs_quotations', q);

      this.addNotification({
        recipientRole: 'driver',
        recipientId: q.transporterId,
        title: `Counter-Offer Received: ₹${counterAmount.toLocaleString('en-IN')}`,
        message: `Customer countered your quote for load ${q.vehicleRegNumber}. Note: "${note}"`,
        type: 'bid_received',
        linkId: q.loadId
      });

      this.triggerChange();
    }
  }

  public reviseQuotation(quoteId: string, newAmount: number, newNotes?: string): { success: boolean; message: string } {
    const quotes = this.getQuotations();
    const q = quotes.find((item) => item.id === quoteId);
    if (!q) return { success: false, message: 'Quotation not found.' };

    const load = this.getLoadById(q.loadId);
    if (!load || (load.status !== 'posted' && load.status !== 'bidding')) {
      return { success: false, message: 'Cannot revise: Load is already awarded or closed.' };
    }

    if (q.status !== 'submitted' && q.status !== 'countered') {
      return { success: false, message: `Cannot revise bid with status: ${q.status}` };
    }

    q.quoteAmountInr = newAmount;
    q.counterOfferAmountInr = undefined;
    q.counterOfferNote = undefined;
    if (newNotes) q.notes = newNotes;
    q.status = 'submitted';
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

    updateDoc(doc(db, 'bids', q.id), {
      quoteAmountInr: newAmount,
      ...(newNotes ? { notes: newNotes } : {}),
      status: 'submitted',
      updatedAt: new Date().toISOString()
    }).catch(() => {});
    this.syncToSupabase('vs_quotations', q);

    if (load) {
      this.addNotification({
        recipientRole: 'customer',
        recipientId: load.customerId,
        title: `Revised Bid Received: ₹${newAmount.toLocaleString('en-IN')}`,
        message: `${q.transporterName} updated quotation to ₹${newAmount.toLocaleString('en-IN')}.`,
        type: 'bid_received',
        linkId: load.id
      });
    }

    this.triggerChange();
    return { success: true, message: 'Quotation revised successfully.' };
  }

  public rejectQuotationByDriver(quoteId: string): { success: boolean; message: string } {
    const quotes = this.getQuotations();
    const q = quotes.find((item) => item.id === quoteId);
    if (!q) return { success: false, message: 'Quotation not found.' };

    q.status = 'withdrawn';
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));
    updateDoc(doc(db, 'bids', q.id), {
      status: 'withdrawn',
      updatedAt: new Date().toISOString()
    }).catch(() => {});
    this.syncToSupabase('vs_quotations', q);
    this.triggerChange();
    return { success: true, message: 'Bid withdrawn successfully.' };
  }

  public rejectQuotationByShipper(quoteId: string, reason = 'Declined by shipper'): { success: boolean; message: string } {
    const quotes = this.getQuotations();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) {
      return { success: false, message: 'Quotation not found.' };
    }

    quote.status = 'rejected';
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

    updateDoc(doc(db, 'bids', quote.id), {
      status: 'rejected',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString()
    }).catch(() => {});
    this.syncToSupabase('vs_quotations', quote);

    const load = this.getLoadById(quote.loadId);
    this.addNotification({
      recipientRole: 'driver',
      recipientId: quote.transporterId,
      title: 'Quotation Declined',
      message: `Your quotation for load ${load ? `${load.pickup.city} to ${load.delivery.city}` : quote.loadId} was declined by the shipper.`,
      type: 'bid_received',
      linkId: quote.loadId
    });

    this.triggerChange();
    return { success: true, message: 'Bid declined.' };
  }

  /**
   * Server-authoritative transaction:
   * Prevents two transporters from simultaneously accepting or booking the same load.
   */
  public acceptQuotation(quoteId: string): { success: boolean; bookingId?: string; message: string } {
    const quotes = this.getQuotations();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) {
      return { success: false, message: 'Quotation not found.' };
    }

    const loads = this.getLoads();
    const load = loads.find((l) => l.id === quote.loadId);
    if (!load) {
      return { success: false, message: 'Associated load not found.' };
    }

    // Strict Lock Check: Has this load already been claimed/booked?
    if (load.status !== 'posted' && load.status !== 'bidding') {
      return {
        success: false,
        message: `This load has already been booked or assigned (Status: ${load.status}).`
      };
    }

    const bookingId = `booking_${Date.now()}`;
    const localTrackingToken = `trk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const totalAgreedFare =
      quote.status === 'countered' && quote.counterOfferAmountInr
        ? quote.counterOfferAmountInr
        : quote.quoteAmountInr;
    const platformCommission = Math.round(totalAgreedFare * 0.05); // Exactly 5% VahanSetu platform commission
    const netDriverPayable = totalAgreedFare - platformCommission;  // Exactly 95% fleet net earnings

    // Business Payment Rules:
    // Customer: 90% advance before pickup, 10% balance after delivery
    const customerAdvance = Math.round(totalAgreedFare * 0.90);
    const customerBalance = totalAgreedFare - customerAdvance;

    // Fleet: 90% of net after pickup, 10% of net after delivery & POD
    const driverFirstPayout = Math.round(netDriverPayable * 0.90);
    const driverFinalPayout = netDriverPayable - driverFirstPayout;

    const newBooking: Booking = {
      id: bookingId,
      loadId: load.id,
      quotationId: quote.id,
      customerId: load.customerId,
      transporterId: quote.transporterId,
      driverId: quote.transporterId,
      vehicleId: quote.vehicleId,
      pickup: load.pickup,
      delivery: load.delivery,
      goodsDescription: load.goodsDescription,
      weightKg: load.weightKg,
      totalAgreedAmountInr: totalAgreedFare,
      platformCommissionInr: platformCommission,
      netDriverPayableInr: netDriverPayable,
      customerAdvanceAmountInr: customerAdvance,
      customerBalanceAmountInr: customerBalance,
      driverFirstPayoutInr: driverFirstPayout,
      driverFinalPayoutInr: driverFinalPayout,
      status: 'assigned',
      paymentStatus: 'pending',
      paymentMode: 'online_upi',
      paymentAdvanceStatus: 'pending',
      paymentBalanceStatus: 'pending',
      payoutStage1Status: 'pending',
      payoutStage2Status: 'pending',
      deliveryOtp: load.deliveryOtp,
      eWayBillNumber: load.specialRequirements?.eWayBillNumber,
      trackingToken: localTrackingToken,
      isTestBooking: !!(load.isTestLoad || quote.isTestBid),
      createdAt: new Date().toISOString()
    };

    // Save booking
    const bookings = this.getBookings();
    bookings.unshift(newBooking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

    // Update quote status and reject other competitors
    quote.status = 'accepted';
    quotes.forEach((other) => {
      if (other.loadId === load.id && other.id !== quote.id) {
        other.status = 'rejected';
        updateDoc(doc(db, 'bids', other.id), { status: 'rejected' }).catch(() => {});
      }
    });
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

    // Update load status and persist updated loads array
    load.status = 'assigned';
    load.assignedBookingId = bookingId;
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));

    // Mark vehicle as occupied
    const vehicles = this.getVehicles();
    const v = vehicles.find((veh) => veh.id === quote.vehicleId);
    if (v) {
      v.isAvailable = false;
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      this.syncToSupabase('vs_vehicles', v);
    }

    this.syncToSupabase('vs_bookings', newBooking);
    this.syncToSupabase('vs_loads', load);
    this.syncToSupabase('vs_quotations', quotes.filter((qItem) => qItem.loadId === load.id));

    // Atomic Mutual Exclusion in Firestore
    runTransaction(db, async (transaction: any) => {
      const loadRef = doc(db, 'loads', load.id);
      const quoteRef = doc(db, 'bids', quote.id);
      const bookingRef = doc(db, 'bookings', bookingId);

      const remoteLoadSnap = await transaction.get(loadRef);
      if (remoteLoadSnap.exists()) {
        const remoteLoad = remoteLoadSnap.data() as LoadItem;
        if (remoteLoad.status !== 'posted' && remoteLoad.status !== 'bidding') {
          throw new Error(`Load is already awarded or booked (Status: ${remoteLoad.status}). Cannot double-book.`);
        }
        transaction.update(loadRef, {
          status: 'assigned',
          assignedBookingId: bookingId,
          assignedDriverId: quote.transporterId,
          updatedAt: new Date().toISOString()
        });
      }

      transaction.set(bookingRef, {
        ...newBooking,
        id: bookingId,
        isTestBooking: !!(load.isTestLoad || quote.isTestBid)
      });

      transaction.update(quoteRef, {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      if (quote.vehicleId) {
        const vehRef = doc(db, 'vehicles', quote.vehicleId);
        transaction.update(vehRef, { isAvailable: false });
      }
    }).catch((txErr: any) => {
      console.warn('Firestore atomic mutual exclusion notice:', txErr?.message);
    });

    // Generate GST Tax Invoice draft
    this.generateGstInvoice(newBooking, load, quote);

    // Initial GPS ping at pickup
    const initialPing: LocationPing = {
      bookingId,
      lat: load.pickup.lat,
      lng: load.pickup.lng,
      speedKmh: 0,
      heading: 0,
      timestamp: new Date().toISOString(),
      batteryLevel: 95,
      isGpsReliable: true,
      nearLandmark: load.pickup.address
    };
    const pings = this.getLocationPings();
    pings.push(initialPing);
    localStorage.setItem(STORAGE_KEYS.LOCATION_PINGS, JSON.stringify(pings));

    // Sync assignment to backend /trips/:id/assign so live-tracking endpoint has encrypted token immediately
    if (typeof fetch !== 'undefined') {
      fetch(`/trips/${bookingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: load.id,
          vehicle_id: quote.vehicleId,
          driver_id: quote.transporterId,
          vehicle_number: quote.vehicleRegNumber,
          vehicle_type: quote.vehicleCategory,
          driver_name: quote.driverName || quote.transporterName,
          driver_phone: quote.transporterPhone || '+919678944132',
          owner_id: quote.transporterId,
          tracking_source: 'MOBILE_APP',
          initial_status: 'ASSIGNED',
          pickup: {
            lat: load.pickup.lat,
            lng: load.pickup.lng,
            address: load.pickup.address,
            city: load.pickup.city,
            contact_name: load.pickup.contactName,
            contact_phone: load.pickup.contactPhone
          },
          drop: {
            lat: load.delivery.lat,
            lng: load.delivery.lng,
            address: load.delivery.address,
            city: load.delivery.city,
            contact_name: load.delivery.contactName,
            contact_phone: load.delivery.contactPhone
          }
        })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.trip?.tracking_token) {
            this.setBookingTrackingToken(bookingId, data.trip.tracking_token);
          }
        })
        .catch(() => {});
    }

    // Push notifications
    this.addNotification({
      recipientRole: 'driver',
      recipientId: quote.transporterId,
      title: 'Booking Confirmed!',
      message: `Your bid for ${load.pickup.city} to ${load.delivery.city} was accepted! Start heading to pickup.`,
      type: 'booking_confirmed',
      linkId: bookingId
    });

    this.addNotification({
      recipientRole: 'customer',
      recipientId: load.customerId,
      title: 'Vehicle Booked & Locked',
      message: `Transporter ${quote.transporterName} (${quote.vehicleRegNumber}) has been assigned to your shipment.`,
      type: 'booking_confirmed',
      linkId: load.id
    });

    this.triggerChange();
    return { success: true, bookingId, message: 'Booking confirmed and assigned securely.' };
  }

  /**
   * Rapido / Uber-style 1-Tap Instant Accept & Start Ride
   * Allows a verified Driver / Vehicle Owner / Fleet Partner to immediately lock a load,
   * create the booking, generate an encrypted tracking token, and begin riding to pickup.
   */
  public instantAcceptLoad(
    loadId: string,
    partnerUser: User,
    preferredVehicleId?: string
  ): { success: boolean; bookingId?: string; trackingToken?: string; message: string } {
    if (partnerUser.isBlocked) {
      return {
        success: false,
        message: `Account suspended: ${partnerUser.blockedReason || 'Blocked by Super Admin'}.`
      };
    }

    const eligibility = this.checkPartnerBookingEligibility(partnerUser.id);
    if (!eligibility.isEligible) {
      return {
        success: false,
        message: `Cannot accept load: ${eligibility.reason}`
      };
    }

    const loads = this.getLoads();
    const load = loads.find((l) => l.id === loadId);
    if (!load) {
      return { success: false, message: 'Load not found.' };
    }

    if (load.isBlocked || load.status === 'blocked') {
      return { success: false, message: 'This load has been blocked by Platform Administration.' };
    }

    if (load.status !== 'posted' && load.status !== 'bidding') {
      return {
        success: false,
        message: `Load already matched or closed (Status: ${load.status.replace('_', ' ')}).`
      };
    }

    const vehicles = this.getVehicles();
    let assignedVehicle =
      (preferredVehicleId ? vehicles.find((v) => v.id === preferredVehicleId) : undefined) ||
      vehicles.find((v) => v.ownerId === partnerUser.id && v.isAvailable && !v.isBlocked) ||
      vehicles.find((v) => v.ownerId === partnerUser.id && !v.isBlocked) ||
      vehicles.find((v) => v.assignedDriverId === partnerUser.id && !v.isBlocked);

    if (assignedVehicle?.isBlocked) {
      return {
        success: false,
        message: `Vehicle ${assignedVehicle.registrationNumber} is blocked: ${assignedVehicle.blockedReason || 'Admin hold'}.`
      };
    }

    if (!assignedVehicle) {
      const cleanPhone = (partnerUser.phone || '9999').replace(/\D/g, '').slice(-4);
      assignedVehicle = {
        id: `veh_${partnerUser.id}_${Date.now().toString().slice(-4)}`,
        ownerId: partnerUser.id,
        transporterName: partnerUser.businessName || `${partnerUser.name} Transport`,
        registrationNumber: `AS-01-VS-${cleanPhone || '1001'}`,
        category: load.requiredVehicleCategory,
        bodyType: load.requiredBodyType || 'tarpaulin',
        capacityKg: Math.max(1500, load.weightKg),
        modelName: 'Commercial Freight Carrier',
        fuelType: 'diesel',
        permitType: 'all_northeast',
        currentLocation: {
          lat: load.pickup.lat,
          lng: load.pickup.lng,
          address: `${partnerUser.city || load.pickup.city} Hub`,
          city: partnerUser.city || load.pickup.city
        },
        isOnline: true,
        isAvailable: false,
        verificationStatus: 'verified',
        documents: [],
        assignedDriverId: partnerUser.id,
        driverName: partnerUser.name,
        driverPhone: partnerUser.phone,
        driverRating: 4.9,
        completedTrips: 1,
        photoUrl: 'https://images.unsplash.com/photo-1559297434-fae8a1916a79?auto=format&fit=crop&w=600&q=80'
      };
      vehicles.unshift(assignedVehicle);
    } else {
      assignedVehicle.isAvailable = false;
      assignedVehicle.isOnline = true;
    }
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));

    const fareEstimate = this.calculateEstimatedFreight(
      load.pickup.lat,
      load.pickup.lng,
      load.delivery.lat,
      load.delivery.lng,
      load.requiredVehicleCategory,
      load.loadType,
      load.specialRequirements.loadingHelpersNeeded
    );

    const totalAgreedFare = load.targetBudgetInr && load.targetBudgetInr > 0
      ? load.targetBudgetInr
      : fareEstimate.totalEstimate;

    const platformCommission = Math.round(totalAgreedFare * 0.05);
    const netDriverPayable = totalAgreedFare - platformCommission;
    const customerAdvance = Math.round(totalAgreedFare * 0.90);
    const customerBalance = totalAgreedFare - customerAdvance;
    const driverFirstPayout = Math.round(netDriverPayable * 0.90);
    const driverFinalPayout = netDriverPayable - driverFirstPayout;

    const bookingId = `booking_${Date.now()}`;
    const localTrackingToken = `trk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const newBooking: Booking = {
      id: bookingId,
      loadId: load.id,
      customerId: load.customerId,
      transporterId: partnerUser.id,
      driverId: assignedVehicle.assignedDriverId || partnerUser.id,
      vehicleId: assignedVehicle.id,
      pickup: load.pickup,
      delivery: load.delivery,
      goodsDescription: load.goodsDescription,
      weightKg: load.weightKg,
      totalAgreedAmountInr: totalAgreedFare,
      platformCommissionInr: platformCommission,
      netDriverPayableInr: netDriverPayable,
      customerAdvanceAmountInr: customerAdvance,
      customerBalanceAmountInr: customerBalance,
      driverFirstPayoutInr: driverFirstPayout,
      driverFinalPayoutInr: driverFinalPayout,
      status: 'en_route_pickup',
      paymentStatus: 'pending',
      paymentMode: 'online_upi',
      paymentAdvanceStatus: 'pending',
      paymentBalanceStatus: 'pending',
      payoutStage1Status: 'pending',
      payoutStage2Status: 'pending',
      deliveryOtp: load.deliveryOtp,
      eWayBillNumber: load.specialRequirements.eWayBillNumber,
      trackingToken: localTrackingToken,
      isTestBooking: !!(load.isTestLoad || partnerUser.isTestAccount),
      createdAt: new Date().toISOString()
    };

    const bookings = this.getBookings();
    bookings.unshift(newBooking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

    // Reject competing open quotes
    const quotes = this.getQuotations();
    quotes.forEach((q) => {
      if (q.loadId === load.id && q.status !== 'withdrawn') {
        q.status = q.transporterId === partnerUser.id ? 'accepted' : 'rejected';
      }
    });
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));

    // Update load status to en_route_pickup immediately (Rapido/Uber live match)
    load.status = 'en_route_pickup';
    load.assignedBookingId = bookingId;
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));

    // Generate synthetic quotation object for GST invoice generation
    const syntheticQuote: Quotation = {
      id: `quote_instant_${Date.now()}`,
      loadId: load.id,
      transporterId: partnerUser.id,
      transporterName: partnerUser.businessName || partnerUser.name,
      transporterPhone: partnerUser.phone,
      vehicleId: assignedVehicle.id,
      vehicleRegNumber: assignedVehicle.registrationNumber,
      vehicleCategory: assignedVehicle.category,
      driverName: assignedVehicle.driverName || partnerUser.name,
      driverRating: assignedVehicle.driverRating || 4.9,
      driverCompletedTrips: assignedVehicle.completedTrips || 1,
      quoteAmountInr: totalAgreedFare,
      chargeBreakdown: {
        baseFreight: Math.round(totalAgreedFare * 0.95),
        loadingUnloadingCharges: load.specialRequirements.loadingHelpersNeeded * 450,
        tollEstimate: fareEstimate.tollEstimate,
        gstAmount: Math.round(totalAgreedFare * 0.05),
        platformFee: platformCommission
      },
      estimatedPickupTime: 'Immediate Dispatch',
      status: 'accepted',
      createdAt: new Date().toISOString()
    };
    this.generateGstInvoice(newBooking, load, syntheticQuote);

    // Initial GPS ping near pickup
    const initialPing: LocationPing = {
      bookingId,
      lat: assignedVehicle.currentLocation?.lat || load.pickup.lat,
      lng: assignedVehicle.currentLocation?.lng || load.pickup.lng,
      speedKmh: 28,
      heading: 90,
      timestamp: new Date().toISOString(),
      batteryLevel: 96,
      isGpsReliable: true,
      nearLandmark: `En-route to ${load.pickup.city} Pickup`
    };
    const pings = this.getLocationPings();
    pings.push(initialPing);
    localStorage.setItem(STORAGE_KEYS.LOCATION_PINGS, JSON.stringify(pings));

    // Persist to Firestore & Supabase (non-blocking)
    setDoc(doc(db, 'bookings', bookingId), newBooking).catch(() => {});
    updateDoc(doc(db, 'loads', load.id), {
      status: 'en_route_pickup',
      assignedBookingId: bookingId,
      assignedDriverId: newBooking.driverId
    }).catch(() => {});
    this.syncToSupabase('vs_bookings', newBooking);
    this.syncToSupabase('vs_loads', load);
    this.syncToSupabase('vs_vehicles', assignedVehicle);

    // Sync assignment to backend /trips/:id/assign so live-tracking endpoint has encrypted token immediately
    if (typeof fetch !== 'undefined') {
      fetch(`/trips/${bookingId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: load.id,
          vehicle_id: assignedVehicle.id,
          driver_id: newBooking.driverId,
          vehicle_number: assignedVehicle.registrationNumber,
          vehicle_type: assignedVehicle.category,
          driver_name: assignedVehicle.driverName || partnerUser.name,
          driver_phone: assignedVehicle.driverPhone || partnerUser.phone,
          owner_id: partnerUser.id,
          tracking_source: 'MOBILE_APP',
          initial_status: 'ASSIGNED',
          pickup: {
            lat: load.pickup.lat,
            lng: load.pickup.lng,
            address: load.pickup.address,
            city: load.pickup.city,
            contact_name: load.pickup.contactName,
            contact_phone: load.pickup.contactPhone
          },
          drop: {
            lat: load.delivery.lat,
            lng: load.delivery.lng,
            address: load.delivery.address,
            city: load.delivery.city,
            contact_name: load.delivery.contactName,
            contact_phone: load.delivery.contactPhone
          }
        })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.trip?.tracking_token) {
            this.setBookingTrackingToken(bookingId, data.trip.tracking_token);
          }
        })
        .catch(() => {});
    }

    // Notify Shipper & Driver & Admin
    this.addNotification({
      recipientRole: 'customer',
      recipientId: load.customerId,
      title: `⚡ Driver Matched! ${assignedVehicle.registrationNumber}`,
      message: `${assignedVehicle.driverName || partnerUser.name} accepted your load (${load.pickup.city} → ${load.delivery.city}) @ ₹${totalAgreedFare.toLocaleString('en-IN')} and is en-route to pickup.`,
      type: 'booking_confirmed',
      linkId: load.id
    });

    this.addNotification({
      recipientRole: 'driver',
      recipientId: partnerUser.id,
      title: 'Ride Confirmed & Started!',
      message: `Head to ${load.pickup.city} pickup for ₹${totalAgreedFare.toLocaleString('en-IN')}.`,
      type: 'booking_confirmed',
      linkId: bookingId
    });

    this.triggerChange();
    return {
      success: true,
      bookingId,
      trackingToken: localTrackingToken,
      message: `Instant ride confirmed with ${assignedVehicle.registrationNumber}! Head to pickup.`
    };
  }

  public setBookingTrackingToken(bookingId: string, trackingToken: string) {
    const bookings = this.getBookings();
    const b = bookings.find((item) => item.id === bookingId);
    if (b && b.trackingToken !== trackingToken) {
      b.trackingToken = trackingToken;
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      this.syncToSupabase('vs_bookings', b);
      this.triggerChange();
    }
  }

  public assignDriverAndVehicleToBooking(
    bookingId: string,
    vehicleId: string,
    driverName?: string,
    driverPhone?: string,
    driverId?: string,
    trackingToken?: string
  ): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    const vehicles = this.getVehicles();
    const previousVehicleId = booking.vehicleId;
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (vehicle?.isBlocked) {
      return { success: false, message: 'Cannot assign a blocked vehicle.' };
    }

    if (previousVehicleId && previousVehicleId !== vehicleId) {
      const prevVehicle = vehicles.find((v) => v.id === previousVehicleId);
      if (prevVehicle) {
        prevVehicle.isAvailable = true;
        updateDoc(doc(db, 'vehicles', prevVehicle.id), { isAvailable: true }).catch(() => {});
        this.syncToSupabase('vs_vehicles', prevVehicle);
      }
    }

    booking.vehicleId = vehicleId;
    if (driverId) booking.driverId = driverId;
    if (trackingToken) booking.trackingToken = trackingToken;

    if (vehicle) {
      if (driverId) vehicle.assignedDriverId = driverId;
      if (driverName) vehicle.driverName = driverName;
      if (driverPhone) vehicle.driverPhone = driverPhone;
      vehicle.isAvailable = false;
      vehicle.isOnline = true;
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      updateDoc(doc(db, 'vehicles', vehicle.id), {
        assignedDriverId: vehicle.assignedDriverId || null,
        driverName: vehicle.driverName || null,
        driverPhone: vehicle.driverPhone || null,
        isAvailable: false,
        isOnline: true
      }).catch(() => {});
      this.syncToSupabase('vs_vehicles', vehicle);
    }

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    updateDoc(doc(db, 'bookings', bookingId), {
      vehicleId: booking.vehicleId,
      driverId: booking.driverId,
      ...(trackingToken ? { trackingToken } : {})
    }).catch(() => {});
    this.syncToSupabase('vs_bookings', booking);

    const loads = this.getLoads();
    const matchedLoad = loads.find((l) => l.id === booking.loadId);
    if (matchedLoad) {
      updateDoc(doc(db, 'loads', matchedLoad.id), {
        assignedDriverId: booking.driverId
      }).catch(() => {});
    }

    const displayReg = vehicle?.registrationNumber || vehicleId;
    const displayDriver = driverName || vehicle?.driverName || 'Assigned Driver';

    if (driverId) {
      this.addNotification({
        recipientRole: 'driver',
        recipientId: driverId,
        title: `New Trip Dispatched: ${displayReg}`,
        message: `Head to ${booking.pickup.city} pickup for delivery to ${booking.delivery.city}. Tap to view live GPS & OTP.`,
        type: 'booking_confirmed',
        linkId: bookingId
      });
    }

    this.addNotification({
      recipientRole: 'customer',
      recipientId: booking.customerId,
      title: `Vehicle & Driver Dispatched`,
      message: `${displayDriver} (${displayReg})${driverPhone ? ` • ${driverPhone}` : ''} is assigned to your shipment.`,
      type: 'booking_confirmed',
      linkId: booking.loadId
    });

    this.triggerChange();
    return { success: true, message: `Assigned ${displayReg} to trip.` };
  }

  public assignBookingDriverAndVehicle(
    bookingId: string,
    opts: {
      vehicleId: string;
      driverId?: string;
      driverName?: string;
      driverPhone?: string;
      trackingToken?: string;
    }
  ): { success: boolean; message: string } {
    return this.assignDriverAndVehicleToBooking(
      bookingId,
      opts.vehicleId,
      opts.driverName,
      opts.driverPhone,
      opts.driverId,
      opts.trackingToken
    );
  }

  // --- Super Admin Master Control Powers ---
  public toggleBlockUser(userId: string, isBlocked: boolean, reason = 'Blocked by Platform Super Admin'): { success: boolean; message: string } {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return { success: false, message: 'User not found.' };
    if (target.role === 'admin') return { success: false, message: 'Cannot block Super Admin account.' };

    target.isBlocked = isBlocked;
    target.blockedReason = isBlocked ? reason : undefined;
    target.blockedAt = isBlocked ? new Date().toISOString() : undefined;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    if (target.phone) {
      this.saveRegisteredProfile(target.phone, target);
    }

    // If blocked user owns vehicles, take them offline
    if (isBlocked) {
      const vehicles = this.getVehicles();
      let vehChanged = false;
      vehicles.forEach((v) => {
        if (v.ownerId === userId || v.assignedDriverId === userId) {
          v.isOnline = false;
          v.isAvailable = false;
          v.isBlocked = true;
          v.blockedReason = `Owner suspended: ${reason}`;
          vehChanged = true;
        }
      });
      if (vehChanged) {
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      }
    }

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, isBlocked, blockedReason: target.blockedReason });
    }

    updateDoc(doc(db, 'users', userId), {
      isBlocked,
      blockedReason: target.blockedReason || null
    }).catch(() => {});
    this.syncToSupabase('vs_users', target);

    this.triggerChange();
    return {
      success: true,
      message: isBlocked ? `${target.name} has been blocked.` : `${target.name} has been unblocked & reinstated.`
    };
  }

  public toggleBlockVehicle(vehicleId: string, isBlocked: boolean, reason = 'Blocked by Super Admin'): { success: boolean; message: string } {
    const vehicles = this.getVehicles();
    const v = vehicles.find((item) => item.id === vehicleId);
    if (!v) return { success: false, message: 'Vehicle not found.' };

    v.isBlocked = isBlocked;
    v.blockedReason = isBlocked ? reason : undefined;
    if (isBlocked) {
      v.isOnline = false;
      v.isAvailable = false;
    } else {
      v.isAvailable = true;
    }
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    updateDoc(doc(db, 'vehicles', vehicleId), {
      isBlocked,
      blockedReason: v.blockedReason || null,
      isOnline: v.isOnline,
      isAvailable: v.isAvailable
    }).catch(() => {});
    this.syncToSupabase('vs_vehicles', v);

    this.addNotification({
      recipientRole: 'driver',
      recipientId: v.ownerId,
      title: isBlocked ? `⛔ Vehicle Blocked: ${v.registrationNumber}` : `✅ Vehicle Unblocked: ${v.registrationNumber}`,
      message: isBlocked ? `Reason: ${reason}` : 'Your vehicle has been reinstated by Administration.',
      type: 'alert',
      linkId: v.id
    });

    this.triggerChange();
    return {
      success: true,
      message: isBlocked ? `Vehicle ${v.registrationNumber} blocked.` : `Vehicle ${v.registrationNumber} unblocked.`
    };
  }

  public toggleBlockLoad(loadId: string, isBlocked: boolean, reason = 'Blocked by Super Admin'): { success: boolean; message: string } {
    const loads = this.getLoads();
    const load = loads.find((l) => l.id === loadId);
    if (!load) return { success: false, message: 'Load not found.' };

    load.isBlocked = isBlocked;
    load.blockedReason = isBlocked ? reason : undefined;
    if (isBlocked) {
      load.status = 'blocked';
    } else if (load.status === 'blocked') {
      load.status = load.assignedBookingId ? 'assigned' : 'posted';
    }
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    updateDoc(doc(db, 'loads', loadId), {
      status: load.status,
      isBlocked,
      blockedReason: load.blockedReason || null
    }).catch(() => {});
    this.syncToSupabase('vs_loads', load);

    this.addNotification({
      recipientRole: 'customer',
      recipientId: load.customerId,
      title: isBlocked ? '⛔ Load Blocked by Admin' : '✅ Load Unblocked',
      message: isBlocked
        ? `Your load (${load.pickup.city} → ${load.delivery.city}) was blocked: ${reason}`
        : `Your load (${load.pickup.city} → ${load.delivery.city}) is active again.`,
      type: 'alert',
      linkId: load.id
    });

    this.triggerChange();
    return {
      success: true,
      message: isBlocked ? `Load ${load.id} blocked.` : `Load ${load.id} unblocked.`
    };
  }

  public adminOverrideBookingStatus(bookingId: string, status: LoadStatus, reason = 'Admin override'): { success: boolean; message: string } {
    if (status === 'cancelled') {
      const bookings = this.getBookings();
      const b = bookings.find((item) => item.id === bookingId);
      if (!b) return { success: false, message: 'Booking not found.' };
      return this.cancelLoad(b.loadId, reason);
    }
    return this.updateBookingMilestone(bookingId, status);
  }

  // --- Bookings & Trips ---
  public getBookings(): Booking[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(SEED_BOOKINGS));
      return SEED_BOOKINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return SEED_BOOKINGS;
    } catch {
      return SEED_BOOKINGS;
    }
  }

  public getBookingById(id: string): Booking | undefined {
    return this.getBookings().find((b) => b.id === id);
  }

  public updateBookingMilestone(
    bookingId: string,
    milestone: Booking['status'],
    metadata?: {
      loadingProofUrl?: string;
      podDocumentUrl?: string;
      podSignatureUrl?: string;
      eWayBillNumber?: string;
    }
  ): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    booking.status = milestone;
    if (metadata?.loadingProofUrl) booking.loadingProofUrl = metadata.loadingProofUrl;
    if (metadata?.podDocumentUrl) booking.podDocumentUrl = metadata.podDocumentUrl;
    if (metadata?.podSignatureUrl) booking.podSignatureUrl = metadata.podSignatureUrl;
    if (metadata?.eWayBillNumber) booking.eWayBillNumber = metadata.eWayBillNumber;

    const dispute = milestone === 'completed' ? this.getDisputeByBookingId(booking.id) : undefined;
    if (milestone === 'at_pickup') {
      booking.pickupConfirmedAt = new Date().toISOString();
    }
    if (milestone === 'completed') {
      booking.completedAt = new Date().toISOString();

      // Mark vehicle free again
      const vehicles = this.getVehicles();
      const v = vehicles.find((veh) => veh.id === booking.vehicleId);
      if (v) {
        v.isAvailable = true;
        v.completedTrips += 1;
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
        this.syncToSupabase('vs_vehicles', v);
      }

      if (dispute && dispute.status !== 'RESOLVED_RELEASED') {
        booking.payoutStage2Status = 'disputed_on_hold';
      }
    }

    // Persist status and metadata BEFORE releasing payouts so payout helpers read latest state without being overwritten
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

    if (milestone === 'at_pickup' && booking.payoutStage1Status !== 'settled') {
      // Automatically disburse 90% first fleet payout upon verified pickup
      this.releaseStage1Payout(booking.id);
    }
    if (milestone === 'completed' && (!dispute || dispute.status === 'RESOLVED_RELEASED')) {
      this.releaseStage2Payout(booking.id);
    }

    // Keep associated load status in sync
    this.updateLoadStatus(booking.loadId, milestone);

    // Sync to Firestore & Supabase
    const syncedBooking = this.getBookingById(booking.id) || booking;
    this.syncToSupabase('vs_bookings', syncedBooking);

    updateDoc(doc(db, 'bookings', bookingId), {
      status: milestone,
      ...(metadata?.loadingProofUrl ? { loadingProofUrl: metadata.loadingProofUrl } : {}),
      ...(metadata?.podDocumentUrl ? { podDocumentUrl: metadata.podDocumentUrl } : {}),
      ...(metadata?.podSignatureUrl ? { podSignatureUrl: metadata.podSignatureUrl } : {}),
      ...(metadata?.eWayBillNumber ? { eWayBillNumber: metadata.eWayBillNumber } : {}),
      ...(milestone === 'at_pickup' ? { pickupConfirmedAt: new Date().toISOString() } : {}),
      ...(milestone === 'completed' ? { completedAt: new Date().toISOString(), paymentStatus: 'completed' } : {})
    }).catch(() => {});

    updateDoc(doc(db, 'loads', booking.loadId), {
      status: milestone
    }).catch(() => {});

    // Notify customer about milestone
    const milestoneMessages: Record<string, string> = {
      en_route_pickup: 'Driver is on the way to pickup location.',
      at_pickup: 'Driver has arrived at the pickup location.',
      loading: 'Goods are being loaded onto the truck.',
      in_transit: 'Shipment is now on the road in transit. Live GPS tracking is active.',
      at_destination: 'Driver has reached the delivery destination.',
      delivered: 'Goods delivered! Awaiting delivery confirmation OTP.',
      completed: 'Trip completed successfully! GST Invoice & Proof of Delivery are available.'
    };

    if (milestoneMessages[milestone]) {
      this.addNotification({
        recipientRole: 'customer',
        recipientId: booking.customerId,
        title: `Trip Update: ${milestone.replace('_', ' ').toUpperCase()}`,
        message: milestoneMessages[milestone],
        type: 'trip_milestone',
        linkId: booking.loadId
      });
    }

    this.triggerChange();
    return { success: true, message: `Status updated to ${milestone}` };
  }

  public verifyDeliveryOtpAndComplete(
    bookingId: string,
    inputOtp: string,
    podUrl: string
  ): { success: boolean; message: string } {
    const booking = this.getBookingById(bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    if (booking.deliveryOtp !== inputOtp.trim()) {
      return { success: false, message: 'Invalid Delivery Confirmation OTP. Please ask consignee for the correct 4-digit code.' };
    }

    return this.updateBookingMilestone(bookingId, 'completed', {
      podDocumentUrl: podUrl
    });
  }

  // --- Location Pings & Real-Time Tracking ---
  public getLocationPings(bookingId?: string): LocationPing[] {
    const pings = this.safeJsonParse<LocationPing[]>(STORAGE_KEYS.LOCATION_PINGS, []);
    if (bookingId) {
      return pings.filter((p) => p.bookingId === bookingId);
    }
    return pings;
  }

  public getLatestPing(bookingId: string): LocationPing | undefined {
    const pings = this.getLocationPings(bookingId);
    return pings[pings.length - 1];
  }

  public recordLocationPing(ping: LocationPing): GeofenceEvent[] {
    const pings = this.getLocationPings();
    pings.push(ping);
    // Keep max 500 historical pings across bookings
    if (pings.length > 500) {
      pings.splice(0, pings.length - 500);
    }
    localStorage.setItem(STORAGE_KEYS.LOCATION_PINGS, JSON.stringify(pings));

    // Update vehicle's current location
    const booking = this.getBookingById(ping.bookingId);
    if (booking) {
      const vehicles = this.getVehicles();
      const v = vehicles.find((veh) => veh.id === booking.vehicleId);
      if (v) {
        v.currentLocation = {
          lat: ping.lat,
          lng: ping.lng,
          address: ping.nearLandmark || 'Highway Corridor En-Route',
          city: v.currentLocation.city
        };
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      }
    }

    const triggered = this.evaluateBookingGeofence(ping.bookingId, ping.lat, ping.lng, ping.timestamp);
    this.triggerChange();
    return triggered;
  }

  // --- Geo-Fencing Engine (Zones, State, Automated Statuses & Alerts) ---
  public getGeofenceConfig(bookingId: string): GeofenceZoneConfig {
    const booking = this.getBookingById(bookingId);
    if (booking?.geofenceConfig) {
      return booking.geofenceConfig;
    }
    const configs = this.safeJsonParse<Record<string, GeofenceZoneConfig>>(STORAGE_KEYS.GEOFENCE_CONFIGS, {});
    return configs[bookingId] || { ...DEFAULT_GEOFENCE_CONFIG };
  }

  public updateGeofenceConfig(
    bookingId: string,
    patch: Partial<GeofenceZoneConfig>
  ): GeofenceZoneConfig {
    const current = this.getGeofenceConfig(bookingId);
    const nextConfig: GeofenceZoneConfig = {
      pickupRadiusMeters: patch.pickupRadiusMeters !== undefined
        ? Math.max(150, Math.min(5000, Math.round(patch.pickupRadiusMeters)))
        : current.pickupRadiusMeters,
      deliveryRadiusMeters: patch.deliveryRadiusMeters !== undefined
        ? Math.max(150, Math.min(5000, Math.round(patch.deliveryRadiusMeters)))
        : current.deliveryRadiusMeters,
      autoUpdateStatus: patch.autoUpdateStatus !== undefined
        ? Boolean(patch.autoUpdateStatus)
        : current.autoUpdateStatus,
      updatedAt: new Date().toISOString()
    };

    const configs = this.safeJsonParse<Record<string, GeofenceZoneConfig>>(STORAGE_KEYS.GEOFENCE_CONFIGS, {});
    configs[bookingId] = nextConfig;
    localStorage.setItem(STORAGE_KEYS.GEOFENCE_CONFIGS, JSON.stringify(configs));

    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (booking) {
      booking.geofenceConfig = nextConfig;
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      this.syncToSupabase('vs_bookings', booking);
    }

    // Re-evaluate latest ping immediately under updated radius rules
    const latest = this.getLatestPing(bookingId);
    if (latest) {
      this.evaluateBookingGeofence(bookingId, latest.lat, latest.lng, new Date().toISOString());
    }

    // Non-blocking backend sync
    if (typeof fetch !== 'undefined') {
      fetch(`/trips/${encodeURIComponent(bookingId)}/geofence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig)
      }).catch(() => {});
    }

    this.triggerChange();
    return nextConfig;
  }

  public getGeofenceState(bookingId: string): GeofenceZoneState {
    const booking = this.getBookingById(bookingId);
    const states = this.safeJsonParse<Record<string, GeofenceZoneState>>(STORAGE_KEYS.GEOFENCE_STATES, {});
    const saved = booking?.geofenceState || states[bookingId];
    if (saved) return saved;

    const latest = this.getLatestPing(bookingId);
    const config = this.getGeofenceConfig(bookingId);
    if (booking && latest) {
      const distPickup = calculateDistanceMeters(latest.lat, latest.lng, booking.pickup.lat, booking.pickup.lng);
      const distDelivery = calculateDistanceMeters(latest.lat, latest.lng, booking.delivery.lat, booking.delivery.lng);
      return {
        insidePickup: distPickup <= config.pickupRadiusMeters,
        insideDelivery: distDelivery <= config.deliveryRadiusMeters,
        distanceToPickupMeters: distPickup,
        distanceToDeliveryMeters: distDelivery,
        lastCheckedAt: latest.timestamp
      };
    }

    return {
      insidePickup: false,
      insideDelivery: false
    };
  }

  public getGeofenceEvents(bookingId?: string): GeofenceEvent[] {
    const events = this.safeJsonParse<GeofenceEvent[]>(STORAGE_KEYS.GEOFENCE_EVENTS, []);
    if (bookingId) {
      return events.filter((e) => e.bookingId === bookingId || e.tripId === bookingId || e.loadId === bookingId);
    }
    return events;
  }

  private emitGeofenceNotifications(booking: Booking, evt: GeofenceEvent, isPrematureDeliveryExit: boolean) {
    const vehicle = this.getVehicleById(booking.vehicleId);
    const reg = vehicle?.registrationNumber || booking.vehicleId;
    const actionWord = evt.transition === 'ENTERED' ? 'Entered' : 'Exited';
    const zoneName = evt.zoneType === 'pickup' ? 'Pickup Zone' : 'Delivery Zone';

    if (isPrematureDeliveryExit) {
      const warnMsg = `Alert: Vehicle ${reg} exited ${evt.city} Delivery Geo-Fence (${formatMetersOrKm(evt.distanceMeters)} away) before Consignee OTP & POD completion!`;
      this.addNotification({
        recipientRole: 'customer',
        recipientId: booking.customerId,
        title: `Premature Exit Warning: ${evt.city}`,
        message: warnMsg,
        type: 'alert',
        linkId: booking.loadId
      });
      this.addNotification({
        recipientRole: 'admin',
        recipientId: 'owner_baruahg39',
        title: `Geo-Fence Exit Alert (${reg})`,
        message: warnMsg,
        type: 'alert',
        linkId: booking.id
      });
      return;
    }

    const otpHint = evt.zoneType === 'delivery' && evt.transition === 'ENTERED'
      ? ` Delivery OTP for consignee confirmation: ${booking.deliveryOtp}.`
      : '';

    this.addNotification({
      recipientRole: 'customer',
      recipientId: booking.customerId,
      title: `Geo-Fence: ${actionWord} ${evt.city} ${zoneName}`,
      message: `${reg} — ${evt.message}${otpHint}`,
      type: 'trip_milestone',
      linkId: booking.loadId
    });

    this.addNotification({
      recipientRole: 'driver',
      recipientId: booking.driverId,
      title: `Geo-Fence ${actionWord}: ${evt.city}`,
      message: evt.message,
      type: 'trip_milestone',
      linkId: booking.id
    });

    this.addNotification({
      recipientRole: 'admin',
      recipientId: 'owner_baruahg39',
      title: `Geo-Fence ${actionWord}: ${reg} (${evt.city})`,
      message: evt.message,
      type: 'trip_milestone',
      linkId: booking.id
    });
  }

  public evaluateBookingGeofence(
    bookingId: string,
    lat: number,
    lng: number,
    timestamp = new Date().toISOString()
  ): GeofenceEvent[] {
    const booking = this.getBookingById(bookingId);
    if (!booking) return [];

    const config = this.getGeofenceConfig(bookingId);
    const states = this.safeJsonParse<Record<string, GeofenceZoneState>>(STORAGE_KEYS.GEOFENCE_STATES, {});
    const prevState: GeofenceZoneState = states[bookingId] || booking.geofenceState || {
      insidePickup: false,
      insideDelivery: false
    };

    const { nextState, transitions } = evaluateGeofenceCrossing({
      bookingId: booking.id,
      tripId: booking.id,
      loadId: booking.loadId,
      vehicleId: booking.vehicleId,
      driverId: booking.driverId,
      pickup: booking.pickup,
      delivery: booking.delivery,
      config,
      prevState,
      lat,
      lng,
      timestamp
    });

    const createdEvents: GeofenceEvent[] = [];
    const existingEvents = this.getGeofenceEvents();

    for (const tr of transitions) {
      let autoUpdatedStatus: string | undefined;
      let isPrematureDeliveryExit = false;

      if (config.autoUpdateStatus) {
        if (tr.zoneType === 'pickup' && tr.transition === 'ENTERED') {
          if (booking.status === 'assigned' || booking.status === 'en_route_pickup') {
            autoUpdatedStatus = 'at_pickup';
            this.updateBookingMilestone(booking.id, 'at_pickup');
          }
        } else if (tr.zoneType === 'pickup' && tr.transition === 'EXITED') {
          if (
            booking.status === 'assigned' ||
            booking.status === 'en_route_pickup' ||
            booking.status === 'at_pickup' ||
            booking.status === 'loading'
          ) {
            autoUpdatedStatus = 'in_transit';
            this.updateBookingMilestone(booking.id, 'in_transit');
          }
        } else if (tr.zoneType === 'delivery' && tr.transition === 'ENTERED') {
          if (
            booking.status === 'assigned' ||
            booking.status === 'en_route_pickup' ||
            booking.status === 'at_pickup' ||
            booking.status === 'loading' ||
            booking.status === 'in_transit'
          ) {
            autoUpdatedStatus = 'at_destination';
            this.updateBookingMilestone(booking.id, 'at_destination');
          }
        } else if (tr.zoneType === 'delivery' && tr.transition === 'EXITED') {
          if (booking.status === 'at_destination') {
            isPrematureDeliveryExit = true;
          }
        }
      }

      const message = isPrematureDeliveryExit
        ? `Premature exit warning: Vehicle left ${tr.city} Delivery Geo-Fence (${formatMetersOrKm(tr.distanceMeters)} from gate) without consignee OTP/POD sign-off.`
        : buildGeofenceEventMessage(
            tr.zoneType,
            tr.transition,
            tr.city,
            tr.distanceMeters,
            tr.radiusMeters,
            autoUpdatedStatus
          );

      const newEvt: GeofenceEvent = {
        id: `gf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        bookingId: booking.id,
        tripId: booking.id,
        loadId: booking.loadId,
        vehicleId: booking.vehicleId,
        driverId: booking.driverId,
        zoneType: tr.zoneType,
        transition: tr.transition,
        zoneLabel: tr.zoneLabel,
        city: tr.city,
        lat,
        lng,
        distanceMeters: tr.distanceMeters,
        radiusMeters: tr.radiusMeters,
        autoUpdatedStatus,
        message,
        timestamp
      };

      createdEvents.push(newEvt);
      existingEvents.unshift(newEvt);
      this.emitGeofenceNotifications(booking, newEvt, isPrematureDeliveryExit);
    }

    if (createdEvents.length > 0) {
      if (existingEvents.length > 150) existingEvents.length = 150;
      localStorage.setItem(STORAGE_KEYS.GEOFENCE_EVENTS, JSON.stringify(existingEvents));
    }

    states[bookingId] = nextState;
    localStorage.setItem(STORAGE_KEYS.GEOFENCE_STATES, JSON.stringify(states));

    // Persist updated state onto booking record too
    const latestBookings = this.getBookings();
    const targetBooking = latestBookings.find((b) => b.id === bookingId);
    if (targetBooking) {
      targetBooking.geofenceState = nextState;
      if (!targetBooking.geofenceConfig) targetBooking.geofenceConfig = config;
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(latestBookings));
      if (createdEvents.length > 0) {
        this.syncToSupabase('vs_bookings', targetBooking);
      }
    }

    return createdEvents;
  }

  public ingestServerGeofenceEvents(
    bookingId: string,
    serverEvents?: GeofenceEvent[],
    serverState?: GeofenceZoneState,
    serverConfig?: GeofenceZoneConfig
  ): GeofenceEvent[] {
    let newlyAdded: GeofenceEvent[] = [];

    if (serverConfig) {
      const configs = this.safeJsonParse<Record<string, GeofenceZoneConfig>>(STORAGE_KEYS.GEOFENCE_CONFIGS, {});
      configs[bookingId] = serverConfig;
      localStorage.setItem(STORAGE_KEYS.GEOFENCE_CONFIGS, JSON.stringify(configs));
    }

    if (serverState) {
      const states = this.safeJsonParse<Record<string, GeofenceZoneState>>(STORAGE_KEYS.GEOFENCE_STATES, {});
      states[bookingId] = serverState;
      localStorage.setItem(STORAGE_KEYS.GEOFENCE_STATES, JSON.stringify(states));
    }

    if (serverEvents && serverEvents.length > 0) {
      const existing = this.getGeofenceEvents();
      const existingIds = new Set(existing.map((e) => e.id));
      const booking = this.getBookingById(bookingId);

      for (const evt of serverEvents) {
        if (!existingIds.has(evt.id)) {
          existing.unshift(evt);
          existingIds.add(evt.id);
          newlyAdded.push(evt);
          if (booking && !evt.id.startsWith('gf_demo_')) {
            const premature =
              evt.zoneType === 'delivery' &&
              evt.transition === 'EXITED' &&
              booking.status === 'at_destination';
            this.emitGeofenceNotifications(booking, evt, premature);
          }
        }
      }

      if (newlyAdded.length > 0) {
        existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (existing.length > 150) existing.length = 150;
        localStorage.setItem(STORAGE_KEYS.GEOFENCE_EVENTS, JSON.stringify(existing));
        this.triggerChange();
      }
    }

    return newlyAdded;
  }

  // --- GST Invoices & Settlements ---
  public getInvoices(): Invoice[] {
    return this.safeJsonParse<Invoice[]>(STORAGE_KEYS.INVOICES, []);
  }

  public getInvoiceByBookingId(bookingId: string): Invoice | undefined {
    return this.getInvoices().find((i) => i.bookingId === bookingId);
  }

  private generateGstInvoice(booking: Booking, load: LoadItem, quote: Quotation) {
    const invoices = this.getInvoices();
    const freight = quote.quoteAmountInr;
    const isInterstate = load.pickup.state !== load.delivery.state;

    // Goods Transport Agency (GTA) standard 5% GST
    const cgst = isInterstate ? 0 : Math.round(freight * 0.025 * 100) / 100;
    const sgst = isInterstate ? 0 : Math.round(freight * 0.025 * 100) / 100;
    const igst = isInterstate ? Math.round(freight * 0.05 * 100) / 100 : 0;
    const totalAmount = freight + cgst + sgst + igst;

    const newInvoice: Invoice = {
      id: `inv_${Date.now()}`,
      invoiceNumber: `VSF/${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}/${Math.floor(1000 + Math.random() * 9000)}`,
      bookingId: booking.id,
      loadId: load.id,
      consignor: {
        name: load.pickup.contactName,
        company: load.customerCompany || load.customerName,
        gstin: load.customerGstin || 'Unregistered',
        address: `${load.pickup.address}, ${load.pickup.city}, ${load.pickup.state}`,
        state: load.pickup.state
      },
      consignee: {
        name: load.delivery.contactName,
        address: `${load.delivery.address}, ${load.delivery.city}, ${load.delivery.state}`,
        state: load.delivery.state
      },
      transporter: {
        name: quote.transporterName,
        gstin: '18AAAFK4902L1ZQ',
        pan: 'AAAFK4902L',
        regNumber: quote.vehicleRegNumber
      },
      sacCode: '996511',
      freightAmount: freight,
      cgst,
      sgst,
      igst,
      totalAmount,
      gstPayableUnderRcm: true,
      invoiceDate: new Date().toISOString().split('T')[0],
      status: 'issued'
    };

    invoices.unshift(newInvoice);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }

  public getSettlements(): Settlement[] {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTLEMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(SEED_SETTLEMENTS));
      return SEED_SETTLEMENTS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return SEED_SETTLEMENTS;
    } catch {
      return SEED_SETTLEMENTS;
    }
  }

  // --- CASHFREE EASY SPLIT MARKETPLACE SETTLEMENTS & ESCROW ENGINE ---

  public getPaymentTransactions(bookingId?: string): MarketplacePaymentTransaction[] {
    const txs = this.safeJsonParse<MarketplacePaymentTransaction[]>(STORAGE_KEYS.PAYMENT_TRANSACTIONS, []);
    if (bookingId) return txs.filter((t) => t.bookingId === bookingId);
    return txs;
  }

  public recordPaymentTransaction(tx: MarketplacePaymentTransaction) {
    const txs = this.getPaymentTransactions();
    txs.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.PAYMENT_TRANSACTIONS, JSON.stringify(txs));
  }

  public getCashfreeVendors(): CashfreeVendor[] {
    return this.safeJsonParse<CashfreeVendor[]>(STORAGE_KEYS.CASHFREE_VENDORS, []);
  }

  public getVendorByDriverId(driverId: string): CashfreeVendor | undefined {
    return this.getCashfreeVendors().find((v) => v.userId === driverId);
  }

  public saveCashfreeVendor(vendor: CashfreeVendor) {
    const vendors = this.getCashfreeVendors();
    const idx = vendors.findIndex((v) => v.vendorId === vendor.vendorId || v.userId === vendor.userId);
    if (idx >= 0) {
      vendors[idx] = vendor;
    } else {
      vendors.unshift(vendor);
    }
    localStorage.setItem(STORAGE_KEYS.CASHFREE_VENDORS, JSON.stringify(vendors));
    this.triggerChange();
  }

  public getDisputes(role?: UserRole, userId?: string): PaymentDispute[] {
    let list = this.safeJsonParse<PaymentDispute[]>(STORAGE_KEYS.DISPUTES, []);
    if (role === 'customer' && userId) {
      list = list.filter((d) => d.customerId === userId);
    } else if (role === 'driver' && userId) {
      list = list.filter((d) => d.driverId === userId);
    }
    return list;
  }

  public getDisputeByBookingId(bookingId: string): PaymentDispute | undefined {
    return this.getDisputes().find((d) => d.bookingId === bookingId);
  }

  /**
   * 1. Customer Advance Payment (90% before pickup)
   */
  public payCustomerAdvance(bookingId: string, paymentRef?: string): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    if (booking.paymentAdvanceStatus === 'paid') {
      return { success: false, message: 'Advance payment already received.' };
    }

    booking.paymentAdvanceStatus = 'paid';
    booking.paymentStatus = 'advance_paid';
    booking.cashfreeAdvanceOrderId = paymentRef || `CF_ADV_${booking.id}_${Date.now()}`;

    // Record Transaction
    this.recordPaymentTransaction({
      id: `tx_${Date.now()}_adv`,
      bookingId: booking.id,
      type: 'customer_advance_90',
      amountInr: booking.customerAdvanceAmountInr,
      orderId: booking.cashfreeAdvanceOrderId,
      cfPaymentId: `pay_${Date.now().toString(36)}`,
      status: 'success',
      timestamp: new Date().toISOString(),
      notes: `90% Advance payment secured in Cashfree escrow. Platform commission: ₹${booking.platformCommissionInr}`
    });

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    this.syncToSupabase('vs_bookings', booking);

    // Send notifications
    this.addNotification({
      recipientRole: 'driver',
      recipientId: booking.driverId,
      title: 'Advance Secured in Escrow!',
      message: `Customer paid ₹${booking.customerAdvanceAmountInr.toLocaleString('en-IN')} (90% advance) in Cashfree escrow. You may now proceed to pickup.`,
      type: 'payment_received',
      linkId: booking.id
    });

    this.addNotification({
      recipientRole: 'customer',
      recipientId: booking.customerId,
      title: 'Advance Payment Successful',
      message: `₹${booking.customerAdvanceAmountInr.toLocaleString('en-IN')} secured in Cashfree Escrow. Transporter dispatched for pickup.`,
      type: 'payment_received',
      linkId: booking.loadId
    });

    this.triggerChange();
    return { success: true, message: `Advance payment of ₹${booking.customerAdvanceAmountInr.toLocaleString('en-IN')} secured in Cashfree Escrow.` };
  }

  /**
   * 2. Release Stage 1 Fleet Payout (90% of Net Earnings after verified pickup)
   */
  public releaseStage1Payout(bookingId: string): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    if (booking.payoutStage1Status === 'settled') {
      return { success: false, message: 'Stage 1 payout already disbursed.' };
    }

    const firstPayout = booking.driverFirstPayoutInr || Math.round(booking.netDriverPayableInr * 0.90);
    booking.payoutStage1Status = 'settled';
    booking.cashfreeStage1SplitId = `split_1_${booking.id}_${Date.now()}`;

    // Create Settlement Record
    const driverObj = this.getUserById(booking.driverId);
    const vehObj = this.getVehicleById(booking.vehicleId);
    const resolvedDriverName = driverObj?.name || vehObj?.driverName || vehObj?.transporterName || 'Assigned Transporter';
    const settlements = this.getSettlements();
    const newSettlement: Settlement = {
      id: `set_stg1_${Date.now()}`,
      settlementRef: `CF/SPLIT1/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`,
      driverId: booking.driverId,
      driverName: resolvedDriverName,
      bookingId: booking.id,
      grossFreight: booking.customerAdvanceAmountInr,
      commission: Math.round(booking.platformCommissionInr * 0.90),
      tdsDeduction: Math.round(firstPayout * 0.01), // 1% TDS
      netDisbursed: firstPayout - Math.round(firstPayout * 0.01),
      bankAccount: {
        bankName: 'Cashfree Verified Bank / UPI',
        accountNumberMasked: '•••• •••• 9102',
        ifsc: 'HDFC0000128',
        upiId: 'transporter@okaxis'
      },
      status: 'settled',
      utrNumber: `CFSPLIT${Date.now().toString().slice(-9)}`,
      settledAt: new Date().toISOString()
    };
    settlements.unshift(newSettlement);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    // Record Transaction
    this.recordPaymentTransaction({
      id: `tx_${Date.now()}_stg1`,
      bookingId: booking.id,
      type: 'driver_payout_stage1',
      amountInr: firstPayout,
      orderId: booking.cashfreeAdvanceOrderId || booking.id,
      splitId: booking.cashfreeStage1SplitId,
      status: 'success',
      timestamp: new Date().toISOString(),
      notes: `Stage 1 Easy Split payout (90% of net earnings) released to driver upon pickup.`
    });

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    this.syncToSupabase('vs_bookings', booking);

    this.addNotification({
      recipientRole: 'driver',
      recipientId: booking.driverId,
      title: 'First Payout Disbursed!',
      message: `₹${firstPayout.toLocaleString('en-IN')} (90% net earnings) credited to your bank via Cashfree Easy Split.`,
      type: 'payment_received',
      linkId: booking.id
    });

    this.triggerChange();
    return { success: true, message: `First payout of ₹${firstPayout.toLocaleString('en-IN')} disbursed to driver.` };
  }

  /**
   * 3. Customer Final Balance Payment (10% post delivery)
   */
  public payCustomerBalance(bookingId: string, paymentRef?: string): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    if (booking.paymentBalanceStatus === 'paid') {
      return { success: false, message: 'Final balance payment already paid.' };
    }

    booking.paymentBalanceStatus = 'paid';
    booking.cashfreeBalanceOrderId = paymentRef || `CF_BAL_${booking.id}_${Date.now()}`;

    // Record Transaction
    this.recordPaymentTransaction({
      id: `tx_${Date.now()}_bal`,
      bookingId: booking.id,
      type: 'customer_balance_10',
      amountInr: booking.customerBalanceAmountInr,
      orderId: booking.cashfreeBalanceOrderId,
      cfPaymentId: `pay_bal_${Date.now().toString(36)}`,
      status: 'success',
      timestamp: new Date().toISOString(),
      notes: `10% final balance payment collected from customer.`
    });

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    this.syncToSupabase('vs_bookings', booking);

    // If trip completed, POD verified, and NO dispute, release Stage 2 final payout automatically
    const dispute = this.getDisputeByBookingId(bookingId);
    if (!dispute || dispute.status === 'RESOLVED_RELEASED') {
      this.releaseStage2Payout(bookingId);
    } else {
      booking.payoutStage2Status = 'disputed_on_hold';
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    }

    this.triggerChange();
    return { success: true, message: `Final balance of ₹${booking.customerBalanceAmountInr.toLocaleString('en-IN')} received successfully.` };
  }

  /**
   * 4. Release Stage 2 Final Payout (10% of Net Earnings after delivery, POD, and zero disputes)
   */
  public releaseStage2Payout(bookingId: string): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    // HARD LOCK: Check for active customer dispute
    const dispute = this.getDisputeByBookingId(bookingId);
    if (dispute && (dispute.status === 'OPEN' || dispute.status === 'INVESTIGATING')) {
      booking.payoutStage2Status = 'disputed_on_hold';
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      this.triggerChange();
      return {
        success: false,
        message: 'Final payout is LOCKED in escrow because a customer cargo dispute is currently active.'
      };
    }

    if (booking.payoutStage2Status === 'settled') {
      return { success: false, message: 'Final payout has already been settled.' };
    }

    const finalPayout = booking.driverFinalPayoutInr || Math.round(booking.netDriverPayableInr * 0.10);
    booking.payoutStage2Status = 'settled';
    booking.paymentStatus = 'completed';
    booking.cashfreeStage2SplitId = `split_2_${booking.id}_${Date.now()}`;

    // Create Settlement Record
    const driverObj = this.getUserById(booking.driverId);
    const vehObj = this.getVehicleById(booking.vehicleId);
    const resolvedDriverName = driverObj?.name || vehObj?.driverName || vehObj?.transporterName || 'Assigned Transporter';
    const settlements = this.getSettlements();
    const newSettlement: Settlement = {
      id: `set_stg2_${Date.now()}`,
      settlementRef: `CF/SPLIT2/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`,
      driverId: booking.driverId,
      driverName: resolvedDriverName,
      bookingId: booking.id,
      grossFreight: booking.customerBalanceAmountInr,
      commission: Math.round(booking.platformCommissionInr * 0.10),
      tdsDeduction: Math.round(finalPayout * 0.01),
      netDisbursed: finalPayout - Math.round(finalPayout * 0.01),
      bankAccount: {
        bankName: 'Cashfree Verified Bank / UPI',
        accountNumberMasked: '•••• •••• 9102',
        ifsc: 'HDFC0000128',
        upiId: 'transporter@okaxis'
      },
      status: 'settled',
      utrNumber: `CFSPLIT${Date.now().toString().slice(-9)}`,
      settledAt: new Date().toISOString()
    };
    settlements.unshift(newSettlement);
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlements));

    // Record Transaction
    this.recordPaymentTransaction({
      id: `tx_${Date.now()}_stg2`,
      bookingId: booking.id,
      type: 'driver_payout_stage2',
      amountInr: finalPayout,
      orderId: booking.cashfreeBalanceOrderId || booking.id,
      splitId: booking.cashfreeStage2SplitId,
      status: 'success',
      timestamp: new Date().toISOString(),
      notes: `Stage 2 final payout (10% of net earnings) released post POD verification.`
    });

    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    this.syncToSupabase('vs_bookings', booking);

    this.addNotification({
      recipientRole: 'driver',
      recipientId: booking.driverId,
      title: 'Final Payout Disbursed!',
      message: `₹${finalPayout.toLocaleString('en-IN')} (remaining 10% net earnings) credited to your bank. Trip fully settled!`,
      type: 'payment_received',
      linkId: booking.id
    });

    this.triggerChange();
    return { success: true, message: `Final payout of ₹${finalPayout.toLocaleString('en-IN')} successfully settled.` };
  }

  /**
   * 5. Customer Raises Dispute (Locks Final Payout Immediately)
   */
  public raisePaymentDispute(params: {
    bookingId: string;
    reason: PaymentDispute['reason'];
    description: string;
    evidencePhotoUrl?: string;
  }): { success: boolean; message: string } {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === params.bookingId);
    if (!booking) return { success: false, message: 'Booking not found.' };

    const load = this.getLoadById(booking.loadId);
    const customer = this.getUserById(booking.customerId);
    const driver = this.getUserById(booking.driverId);

    const dispute: PaymentDispute = {
      id: `disp_${Date.now()}`,
      bookingId: booking.id,
      loadId: booking.loadId,
      customerId: booking.customerId,
      customerName: customer?.name || load?.customerName || 'Customer',
      driverId: booking.driverId,
      driverName: driver?.name || 'Transporter',
      reason: params.reason,
      description: params.description,
      evidencePhotoUrl: params.evidencePhotoUrl,
      status: 'OPEN',
      heldAmountInr: booking.driverFinalPayoutInr,
      createdAt: new Date().toISOString()
    };

    booking.dispute = dispute;
    booking.payoutStage2Status = 'disputed_on_hold';

    // Save dispute list
    const disputes = this.getDisputes();
    disputes.unshift(dispute);
    localStorage.setItem(STORAGE_KEYS.DISPUTES, JSON.stringify(disputes));
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    this.syncToSupabase('vs_bookings', booking);

    // Notify Admin & Driver
    this.addNotification({
      recipientRole: 'admin',
      recipientId: 'admin',
      title: '🚨 Payment Dispute Raised!',
      message: `Customer opened a dispute for Booking ${booking.id}. Final payout ₹${dispute.heldAmountInr.toLocaleString('en-IN')} is locked in escrow.`,
      type: 'alert',
      linkId: booking.id
    });

    this.addNotification({
      recipientRole: 'driver',
      recipientId: booking.driverId,
      title: 'Payment Dispute Notice',
      message: `A dispute was raised regarding your delivery. Final payout of ₹${dispute.heldAmountInr.toLocaleString('en-IN')} is on temporary hold for review.`,
      type: 'alert',
      linkId: booking.id
    });

    this.triggerChange();
    return {
      success: true,
      message: `Dispute filed. The driver's final payout of ₹${dispute.heldAmountInr.toLocaleString('en-IN')} is now locked in escrow pending admin review.`
    };
  }

  /**
   * 6. Admin Resolves Payment Dispute
   */
  public resolvePaymentDispute(
    disputeId: string,
    resolution: 'release_to_driver' | 'refund_to_customer',
    adminNotes?: string
  ): { success: boolean; message: string } {
    const disputes = this.getDisputes();
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return { success: false, message: 'Dispute record not found.' };

    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === dispute.bookingId);
    if (!booking) return { success: false, message: 'Associated booking not found.' };

    dispute.resolvedAt = new Date().toISOString();
    dispute.adminResolutionNotes = adminNotes || 'Resolved by Platform Administrator';

    if (resolution === 'release_to_driver') {
      dispute.status = 'RESOLVED_RELEASED';
      booking.dispute = dispute;
      localStorage.setItem(STORAGE_KEYS.DISPUTES, JSON.stringify(disputes));
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

      // Trigger release of stage 2 payout
      this.releaseStage2Payout(booking.id);
      return { success: true, message: 'Dispute resolved in favor of transporter. Final payout released.' };
    } else {
      dispute.status = 'RESOLVED_REFUNDED';
      booking.dispute = dispute;
      booking.payoutStage2Status = 'failed';
      booking.paymentStatus = 'refunded';

      this.recordPaymentTransaction({
        id: `tx_${Date.now()}_refund`,
        bookingId: booking.id,
        type: 'refund',
        amountInr: dispute.heldAmountInr,
        orderId: booking.cashfreeBalanceOrderId || booking.id,
        status: 'success',
        timestamp: new Date().toISOString(),
        notes: `Refund processed back to customer due to cargo dispute resolution: ${adminNotes}`
      });

      localStorage.setItem(STORAGE_KEYS.DISPUTES, JSON.stringify(disputes));
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      this.syncToSupabase('vs_bookings', booking);

      this.addNotification({
        recipientRole: 'customer',
        recipientId: booking.customerId,
        title: 'Dispute Resolved: Refund Processed',
        message: `₹${dispute.heldAmountInr.toLocaleString('en-IN')} has been refunded to your source payment method.`,
        type: 'payment_received',
        linkId: booking.loadId
      });

      this.triggerChange();
      return { success: true, message: 'Dispute resolved. Escrowed amount refunded to customer.' };
    }
  }

  // --- Notifications ---
  public getNotifications(userRole?: UserRole, userId?: string): AppNotification[] {
    const list = this.safeJsonParse<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    if (userRole === 'admin') {
      return list.filter((n) => n.recipientRole === 'admin');
    }
    if (userRole && userId) {
      return list.filter(
        (n) =>
          n.recipientId === userId ||
          (n.recipientId === 'all_drivers' && userRole !== 'customer') ||
          (n.recipientRole === userRole && !n.recipientId)
      );
    }
    if (userRole) {
      return list.filter((n) => n.recipientRole === userRole || n.recipientId === 'all_drivers');
    }
    return list;
  }

  public addNotification(note: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) {
    const notes = this.getNotifications();
    const newNote: AppNotification = {
      ...note,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      read: false,
      timestamp: new Date().toISOString()
    };
    notes.unshift(newNote);
    if (notes.length > 50) notes.pop();
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notes));
  }

  public markNotificationAsRead(id: string) {
    const notes = this.getNotifications();
    const n = notes.find((item) => item.id === id);
    if (n) {
      n.read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notes));
      this.triggerChange();
    }
  }

  // --- Freight Pricing & Estimation Engine ---
  public calculateEstimatedFreight(
    pickupLat: number,
    pickupLng: number,
    dropLat: number,
    dropLng: number,
    categoryType: VehicleCategoryType,
    loadType: 'full_load' | 'part_load' = 'full_load',
    helpersNeeded = 0
  ) {
    // Great circle distance with 1.32x road curvature winding factor for Assam/Northeast terrain
    const R = 6371; // Earth radius in km
    const dLat = ((dropLat - pickupLat) * Math.PI) / 180;
    const dLon = ((dropLng - pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickupLat * Math.PI) / 180) *
        Math.cos((dropLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const aerialKm = R * c;
    const roadKm = Math.max(12, Math.round(aerialKm * 1.34));

    const category = VEHICLE_CATEGORIES.find((cat) => cat.id === categoryType) || VEHICLE_CATEGORIES[1];
    const baseDistancePrice = roadKm * category.basePricePerKm;
    const subtotalFreight = Math.max(category.minBasePrice, Math.round(baseDistancePrice));

    // Part load discount (35% off for sharing truck space)
    const loadTypeFactor = loadType === 'part_load' ? 0.65 : 1.0;
    const adjustedFreight = Math.round(subtotalFreight * loadTypeFactor);

    const helperCharges = helpersNeeded * 450;
    const tollEstimate = roadKm > 80 ? Math.round((roadKm / 65) * 110) : 0;
    const gstAmount = Math.round(adjustedFreight * 0.05); // 5% GTA GST

    const totalEstimate = adjustedFreight + helperCharges + tollEstimate + gstAmount;
    const estimatedHours = Math.round((roadKm / 42) * 10) / 10; // 42 km/h commercial truck average in hills/plains

    return {
      distanceKm: roadKm,
      estimatedHours,
      baseFreight: adjustedFreight,
      helperCharges,
      tollEstimate,
      gstAmount,
      totalEstimate,
      ratePerKm: category.basePricePerKm
    };
  }

  // --- Support Tickets Management ---
  public getTickets(userRole?: UserRole, userId?: string): SupportTicket[] {
    const tickets = this.safeJsonParse<SupportTicket[]>(STORAGE_KEYS.TICKETS, []);
    
    if (userRole === 'admin') {
      return tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    if (userId) {
      return tickets
        .filter((t) => t.userId === userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getTicketById(ticketId: string): SupportTicket | undefined {
    const tickets = this.getTickets();
    return tickets.find((t) => t.id === ticketId);
  }

  public createTicket(data: {
    userId: string;
    userName: string;
    userPhone: string;
    userRole: UserRole;
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
    relatedLoadId?: string;
    relatedBookingId?: string;
    initialMessage?: string;
  }): SupportTicket {
    const tickets = this.getTickets();
    const now = new Date().toISOString();
    const ticketId = `tick_${Date.now()}`;
    const ticketNumber = `TICK-${Math.floor(1000 + Math.random() * 9000)}`;

    const firstMsg: TicketMessage = {
      id: `msg_${ticketId}_init`,
      senderId: data.userId,
      senderName: data.userName,
      senderRole: data.userRole as any,
      message: data.initialMessage || data.description,
      timestamp: now
    };

    const newTicket: SupportTicket = {
      id: ticketId,
      ticketNumber,
      userId: data.userId,
      userName: data.userName,
      userPhone: data.userPhone,
      userRole: data.userRole,
      category: data.category,
      priority: data.priority,
      status: 'open',
      subject: data.subject,
      description: data.description,
      relatedLoadId: data.relatedLoadId,
      relatedBookingId: data.relatedBookingId,
      createdAt: now,
      updatedAt: now,
      messages: [firstMsg]
    };

    tickets.unshift(newTicket);
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    this.syncToSupabase('vs_support_tickets', newTicket);

    // Notify Central Logistics Admin
    this.addNotification({
      recipientRole: 'admin',
      recipientId: 'admin_central',
      title: `New Support Case: ${ticketNumber}`,
      message: `${data.userName} (${data.userRole.toUpperCase()}) filed ${data.priority.toUpperCase()} case: "${data.subject.slice(0, 45)}..."`,
      type: 'alert',
      linkId: ticketId
    });

    this.triggerChange();
    return newTicket;
  }

  public addTicketMessage(
    ticketId: string,
    messageData: {
      senderId: string;
      senderName: string;
      senderRole: 'customer' | 'driver' | 'transporter' | 'admin' | 'system';
      message: string;
    }
  ): SupportTicket | null {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const newMsg: TicketMessage = {
      id: `msg_${Date.now()}`,
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      senderRole: messageData.senderRole,
      message: messageData.message,
      timestamp: now
    };

    const ticket = tickets[index];
    ticket.messages.push(newMsg);
    ticket.updatedAt = now;

    // If an admin replies and ticket was open, mark as in_progress
    if (messageData.senderRole === 'admin') {
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      ticket.assignedAdminName = messageData.senderName;

      // Notify the customer / driver who opened the ticket
      this.addNotification({
        recipientRole: ticket.userRole,
        recipientId: ticket.userId,
        title: `Support Update: ${ticket.ticketNumber}`,
        message: `${messageData.senderName}: "${messageData.message.slice(0, 60)}..."`,
        type: 'alert',
        linkId: ticket.id
      });
    } else {
      // User sent message; notify admin
      this.addNotification({
        recipientRole: 'admin',
        recipientId: 'admin_central',
        title: `Update on ${ticket.ticketNumber}`,
        message: `${messageData.senderName}: "${messageData.message.slice(0, 60)}..."`,
        type: 'alert',
        linkId: ticket.id
      });
    }

    tickets[index] = ticket;
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    this.syncToSupabase('vs_support_tickets', ticket);
    this.triggerChange();
    return ticket;
  }

  public updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    adminNote?: string,
    adminName = 'Operations Desk'
  ): SupportTicket | null {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const ticket = tickets[index];
    ticket.status = status;
    ticket.updatedAt = now;

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = now;
    }

    if (adminNote) {
      ticket.messages.push({
        id: `msg_status_${Date.now()}`,
        senderId: 'admin_system',
        senderName: adminName,
        senderRole: 'system',
        message: `[Status changed to ${status.toUpperCase().replace('_', ' ')}]: ${adminNote}`,
        timestamp: now
      });
    }

    // Notify ticket owner
    this.addNotification({
      recipientRole: ticket.userRole,
      recipientId: ticket.userId,
      title: `Ticket ${ticket.ticketNumber} ${status.toUpperCase().replace('_', ' ')}`,
      message: adminNote || `Your support ticket has been marked as ${status.replace('_', ' ')}.`,
      type: 'alert',
      linkId: ticket.id
    });

    tickets[index] = ticket;
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    this.syncToSupabase('vs_support_tickets', ticket);
    this.triggerChange();
    return ticket;
  }

  public updateTicketPriority(ticketId: string, priority: TicketPriority): SupportTicket | null {
    const tickets = this.getTickets();
    const index = tickets.findIndex((t) => t.id === ticketId);
    if (index === -1) return null;

    tickets[index].priority = priority;
    tickets[index].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    this.syncToSupabase('vs_support_tickets', tickets[index]);
    this.triggerChange();
    return tickets[index];
  }

  // --- Hub Locations ---
  public getHubLocations() {
    return HUBS_LOCATIONS;
  }

  public getVehicleCategories(): VehicleCategory[] {
    return VEHICLE_CATEGORIES;
  }

  // --- Trip Feedback & Ratings (Punctuality, Vehicle Condition, Communication) ---
  public getFeedbacks(): TripFeedback[] {
    return this.safeJsonParse<TripFeedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  }

  public getFeedbackByBookingId(bookingId: string): TripFeedback | undefined {
    return this.getFeedbacks().find((f) => f.bookingId === bookingId);
  }

  public getFeedbackByLoadId(loadId: string): TripFeedback | undefined {
    return this.getFeedbacks().find((f) => f.loadId === loadId);
  }

  public getFeedbacksForDriver(driverId: string): TripFeedback[] {
    return this.getFeedbacks().filter((f) => f.driverId === driverId);
  }

  public submitTripFeedback(data: Omit<TripFeedback, 'id' | 'createdAt'>): TripFeedback {
    const feedbacks = this.getFeedbacks();
    const existingIndex = feedbacks.findIndex((f) => f.bookingId === data.bookingId);

    // Calculate overall rating from punctuality, vehicle condition, and communication
    const punctuality = Math.min(5, Math.max(1, data.punctualityRating || 5));
    const vehicleCondition = Math.min(5, Math.max(1, data.vehicleConditionRating || 5));
    const communication = Math.min(5, Math.max(1, data.communicationRating || 5));
    const overall = Number(((punctuality + vehicleCondition + communication) / 3).toFixed(1));

    let savedFeedback: TripFeedback;
    if (existingIndex >= 0) {
      savedFeedback = {
        ...feedbacks[existingIndex],
        ...data,
        punctualityRating: punctuality,
        vehicleConditionRating: vehicleCondition,
        communicationRating: communication,
        overallRating: overall,
        createdAt: new Date().toISOString()
      };
      feedbacks[existingIndex] = savedFeedback;
    } else {
      savedFeedback = {
        ...data,
        id: `feedback_${Date.now()}`,
        punctualityRating: punctuality,
        vehicleConditionRating: vehicleCondition,
        communicationRating: communication,
        overallRating: overall,
        createdAt: new Date().toISOString()
      };
      feedbacks.unshift(savedFeedback);
    }

    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(feedbacks));
    setDoc(doc(db, 'trip_feedbacks', savedFeedback.id), savedFeedback).catch(() => {});

    // Recalculate driver's overall rating across all feedback reviews
    const driverReviews = feedbacks.filter((f) => f.driverId === data.driverId);
    if (driverReviews.length > 0) {
      const avgRating = Number(
        (driverReviews.reduce((sum, r) => sum + r.overallRating, 0) / driverReviews.length).toFixed(1)
      );

      // Update vehicle rating in store
      const vehicles = this.getVehicles();
      const updatedVehicles: CommercialVehicle[] = [];
      vehicles.forEach((veh) => {
        if (veh.id === data.vehicleId || veh.ownerId === data.driverId || veh.assignedDriverId === data.driverId) {
          veh.driverRating = avgRating;
          updatedVehicles.push(veh);
        }
      });
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      if (updatedVehicles.length > 0) this.syncToSupabase('vs_vehicles', updatedVehicles);

      // Update quotations rating in store
      const quotes = this.getQuotations();
      const updatedQuotes: Quotation[] = [];
      quotes.forEach((q) => {
        if (q.vehicleId === data.vehicleId || q.transporterId === data.driverId) {
          q.driverRating = avgRating;
          updatedQuotes.push(q);
        }
      });
      localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotes));
      if (updatedQuotes.length > 0) this.syncToSupabase('vs_quotations', updatedQuotes);
    }

    // Send high-priority notification to driver with shipper's review
    this.addNotification({
      recipientRole: 'driver',
      recipientId: data.driverId,
      title: `⭐ New Shipper Review: ${overall} Stars`,
      message: `${data.customerName} (${data.customerCompany || 'Shipper'}) rated your trip: Punctuality ${punctuality}★, Vehicle Condition ${vehicleCondition}★, Communication ${communication}★. "${data.reviewComments || 'Great delivery service!'}"`,
      type: 'alert',
      linkId: data.loadId
    });

    // If tip was added, notify driver of extra earnings
    if (data.tipAmountInr && data.tipAmountInr > 0) {
      this.addNotification({
        recipientRole: 'driver',
        recipientId: data.driverId,
        title: `💰 Driver Tip Received: ₹${data.tipAmountInr}`,
        message: `${data.customerName} sent an appreciation tip of ₹${data.tipAmountInr} for exceptional service!`,
        type: 'payment_received',
        linkId: data.bookingId
      });
    }

    this.triggerChange();
    return savedFeedback;
  }

  // ==========================================
  // VEHICLE PARTNER ONBOARDING & COMPLIANCE METHODS
  // ==========================================

  public getPartnerApplications(): PartnerApplication[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PARTNER_APPLICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PARTNER_APPLICATIONS, JSON.stringify(SEED_PARTNER_APPLICATIONS));
      return SEED_PARTNER_APPLICATIONS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(STORAGE_KEYS.PARTNER_APPLICATIONS, JSON.stringify(SEED_PARTNER_APPLICATIONS));
        return SEED_PARTNER_APPLICATIONS;
      }
      return parsed;
    } catch {
      return SEED_PARTNER_APPLICATIONS;
    }
  }

  public getPartnerApplicationByUserId(userId: string): PartnerApplication | undefined {
    const apps = this.getPartnerApplications();
    return apps.find((a) => a.userId === userId);
  }

  public getPartnerApplicationById(appId: string): PartnerApplication | undefined {
    const apps = this.getPartnerApplications();
    return apps.find((a) => a.id === appId);
  }

  public savePartnerApplication(app: PartnerApplication): PartnerApplication {
    const apps = this.getPartnerApplications();
    const index = apps.findIndex((a) => a.id === app.id);
    if (index >= 0) {
      apps[index] = { ...app, updatedAt: new Date().toISOString() };
    } else {
      apps.unshift(app);
    }
    localStorage.setItem(STORAGE_KEYS.PARTNER_APPLICATIONS, JSON.stringify(apps));
    this.triggerChange();
    return app;
  }

  public submitPartnerApplication(
    data: Omit<PartnerApplication, 'id' | 'createdAt' | 'updatedAt' | 'reviewLogs' | 'status'> & { status?: PartnerAccountStatus }
  ): PartnerApplication {
    const apps = this.getPartnerApplications();
    const existingIndex = apps.findIndex((a) => a.userId === data.userId || a.phone === data.phone);
    const now = new Date().toISOString();

    const application: PartnerApplication = {
      ...data,
      id: existingIndex >= 0 ? apps[existingIndex].id : `app_part_${Date.now()}`,
      status: 'SUBMITTED',
      createdAt: existingIndex >= 0 ? apps[existingIndex].createdAt : now,
      updatedAt: now,
      reviewLogs: existingIndex >= 0 ? apps[existingIndex].reviewLogs : []
    };

    if (existingIndex >= 0) {
      apps[existingIndex] = application;
    } else {
      apps.unshift(application);
    }

    localStorage.setItem(STORAGE_KEYS.PARTNER_APPLICATIONS, JSON.stringify(apps));

    // Also register vehicles into vehicle inventory if provided
    if (application.registeredVehicles && application.registeredVehicles.length > 0) {
      const existingVehicles = this.getVehicles();
      const addedVehicles: CommercialVehicle[] = [];
      application.registeredVehicles.forEach((regVeh) => {
        const found = existingVehicles.find((v) => v.registrationNumber.toUpperCase() === regVeh.registrationNumber.toUpperCase());
        if (!found) {
          const newVeh: CommercialVehicle = {
            id: regVeh.id || `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ownerId: application.userId,
            transporterName: application.companyDetails?.companyName || application.fullName,
            registrationNumber: regVeh.registrationNumber.toUpperCase(),
            category: regVeh.category,
            bodyType: 'closed_container',
            capacityKg: regVeh.capacityKg,
            modelName: regVeh.modelName,
            fuelType: 'diesel',
            permitType: regVeh.permitType,
            currentLocation: {
              lat: 26.1445,
              lng: 91.7362,
              address: `${application.city}, ${application.state}`,
              city: application.city
            },
            isOnline: true,
            isAvailable: true,
            verificationStatus: 'pending',
            documents: application.documents.map((d) => ({
              id: d.id,
              type: d.category === 'dl' ? 'driving_license' : d.category === 'permit' ? 'national_permit' : d.category === 'insurance' ? 'insurance' : d.category === 'fitness' ? 'fitness' : d.category === 'puc' ? 'pollution' : 'rc',
              documentNumber: d.documentNumber,
              documentUrl: d.fileUrl,
              expiryDate: d.expiryDate || '2028-12-31',
              verificationStatus: 'pending'
            })),
            driverRating: 4.9,
            completedTrips: 0,
            photoUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80'
          };
          existingVehicles.push(newVeh);
          addedVehicles.push(newVeh);
        }
      });
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(existingVehicles));
      if (addedVehicles.length > 0) this.syncToSupabase('vs_vehicles', addedVehicles);
    }

    // Add alert notification for Admin Compliance Desk
    this.addNotification({
      recipientRole: 'admin',
      recipientId: 'all_admins',
      title: 'New Vehicle Partner KYC Submitted',
      message: `${application.fullName} (${application.partnerType.replace('_', ' ').toUpperCase()}) submitted documents for Parivahan & RTO verification.`,
      type: 'alert',
      linkId: application.id
    });

    this.triggerChange();
    return application;
  }

  public reviewPartnerApplication(
    appId: string,
    review: {
      adminId: string;
      adminName: string;
      action: 'APPROVED' | 'REJECTED' | 'DOCUMENTS_REQUIRED' | 'SUSPENDED' | 'REACTIVATED';
      notes?: string;
      requestedDocuments?: string[];
    }
  ): { success: boolean; message: string } {
    const apps = this.getPartnerApplications();
    const app = apps.find((a) => a.id === appId);
    if (!app) return { success: false, message: 'Application not found' };

    const newStatus: PartnerAccountStatus = 
      review.action === 'APPROVED' ? 'APPROVED' :
      review.action === 'REJECTED' ? 'REJECTED' :
      review.action === 'DOCUMENTS_REQUIRED' ? 'DOCUMENTS_REQUIRED' :
      review.action === 'SUSPENDED' ? 'SUSPENDED' :
      review.action === 'REACTIVATED' ? 'APPROVED' : 'UNDER_REVIEW';

    app.status = newStatus;
    app.updatedAt = new Date().toISOString();
    if (review.notes) app.adminNotes = review.notes;
    if (review.action === 'REJECTED' && review.notes) app.rejectionReason = review.notes;
    if (review.action === 'DOCUMENTS_REQUIRED') {
      app.requestedChangesNotes = review.notes;
    }

    // Add review log
    const log: AdminReviewLog = {
      id: `rev_log_${Date.now()}`,
      adminId: review.adminId,
      adminName: review.adminName,
      action: review.action,
      timestamp: new Date().toISOString(),
      notes: review.notes,
      requestedDocuments: review.requestedDocuments
    };
    app.reviewLogs.unshift(log);

    // If approved, mark all documents as verified unless explicitly flagged
    if (review.action === 'APPROVED') {
      app.documents.forEach((d) => {
        if (d.status !== 'rejected') {
          d.status = 'verified';
          d.verifiedAt = new Date().toISOString();
        }
      });

      // Update user isVerified flag in store
      const users = this.getUsers();
      const user = users.find((u) => u.id === app.userId || u.phone === app.phone);
      if (user) {
        user.isVerified = true;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        this.syncToSupabase('vs_users', user);
      }

      // Also verify registered vehicles
      const vehicles = this.getVehicles();
      const verifiedVehicles: CommercialVehicle[] = [];
      vehicles.forEach((v) => {
        if (v.ownerId === app.userId || app.registeredVehicles.some((rv) => rv.registrationNumber.toUpperCase() === v.registrationNumber.toUpperCase())) {
          v.verificationStatus = 'verified';
          verifiedVehicles.push(v);
        }
      });
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      if (verifiedVehicles.length > 0) this.syncToSupabase('vs_vehicles', verifiedVehicles);
    } else if (review.action === 'SUSPENDED') {
      const users = this.getUsers();
      const user = users.find((u) => u.id === app.userId);
      if (user) {
        user.isVerified = false;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        this.syncToSupabase('vs_users', user);
      }
    }

    localStorage.setItem(STORAGE_KEYS.PARTNER_APPLICATIONS, JSON.stringify(apps));

    // Notify Partner
    this.addNotification({
      recipientRole: 'driver',
      recipientId: app.userId,
      title: review.action === 'APPROVED' ? '✅ Partner Application Approved' :
             review.action === 'DOCUMENTS_REQUIRED' ? '⚠️ Additional Documents Required' :
             review.action === 'REJECTED' ? '❌ Application Rejected' : 'Partner Status Update',
      message: review.notes || `Your Zuggi onboarding application status is now ${app.status}.`,
      type: 'alert',
      linkId: app.id
    });

    this.triggerChange();
    return { success: true, message: `Application ${app.fullName} updated to ${app.status}.` };
  }

  public checkPartnerBookingEligibility(userId: string): {
    isEligible: boolean;
    status: PartnerAccountStatus;
    reason: string;
    application?: PartnerApplication;
  } {
    const apps = this.getPartnerApplications();
    let app = apps.find((a) => a.userId === userId);

    const users = this.getUsers();
    const current = this.getCurrentUser();
    const user = users.find((u) => u.id === userId) || (current?.id === userId ? current : undefined);

    if (user?.isBlocked) {
      return {
        isEligible: false,
        status: 'SUSPENDED',
        reason: `Account suspended by Super Admin: ${user.blockedReason || 'Compliance review hold'}.`
      };
    }

    // If user is test account, link approved profile
    if (!app && user && (user.isTestAccount || user.phone?.includes('99999') || user.phone?.includes('96789'))) {
      app = apps.find((a) => a.userId === 'user_driver_01');
    }

    // Newly onboarded/verified Drivers & Fleets via instant mobile onboarding are permitted immediately
    if (!app && user && (user.isVerified || user.role === 'driver' || user.role === 'vehicle_owner' || user.role === 'fleet_partner' || user.role === 'transporter')) {
      return {
        isEligible: true,
        status: 'APPROVED',
        reason: 'Verified partner account active for instant dispatch & bidding.'
      };
    }

    if (!app) {
      return {
        isEligible: false,
        status: 'DRAFT',
        reason: 'Vehicle partner onboarding not completed. Please finish KYC registration and accept mandatory transport agreements.'
      };
    }

    if (app.status === 'APPROVED') {
      return {
        isEligible: true,
        status: 'APPROVED',
        reason: 'Partner is fully verified, KYC authenticated, and permitted to bid and execute commercial transport.',
        application: app
      };
    }

    const reasonMap: Record<PartnerAccountStatus, string> = {
      DRAFT: 'Application is in draft state. Complete document upload and sign agreements.',
      SUBMITTED: 'Application submitted and queued for Parivahan & RTO compliance verification.',
      UNDER_REVIEW: 'Application is actively under compliance desk review. Bidding will unlock once approved.',
      DOCUMENTS_REQUIRED: `Additional documents required: ${app.requestedChangesNotes || 'Please re-upload expired or rejected certificates.'}`,
      REJECTED: `Application was rejected by compliance desk: ${app.rejectionReason || 'Non-compliant documents.'}`,
      SUSPENDED: 'Partner account is temporarily suspended. Contact compliance support.',
      EXPIRED: 'Statutory documents (RC, Commercial DL, or Fitness) have expired. Please upload renewed certificates.',
      APPROVED: 'Approved'
    };

    return {
      isEligible: false,
      status: app.status,
      reason: reasonMap[app.status] || 'Partner is not yet approved for commercial transport.',
      application: app
    };
  }
}

export const logisticsStore = new LogisticsStore();
