import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  Navigation,
  PackagePlus,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import type { Booking, LoadItem, User } from '../../types';
import { logisticsStore } from '../../services/store';
import {
  businessClient,
  validateIndianGstin,
  type BusinessProfile,
  type RebookTripPrefill,
  type SavedAddressType,
  type SavedBusinessAddress
} from '../../services/businessClient';
import {
  calculateEscrow7030Breakdown,
  escrowClient,
  formatInrExact,
  type EscrowPayoutTranche,
  type TripEscrowLedger
} from '../../services/escrowClient';
import { LocationAutocompleteInput, type SelectedPlace } from '../shared/LocationAutocompleteInput';
import { ShipperLiveTracker } from '../tracking/ShipperLiveTracker';
import { showToast } from '../shared/Toast';
import {
  DocumentVaultModal,
  type DocumentVaultTripData,
  type VaultDocumentTab
} from './DocumentVaultModal';

interface BusinessDashboardProps {
  currentUser: User;
  onBackToShipperHome: () => void;
  onCreateNewBooking: () => void;
  onRebookTrip: (prefill: RebookTripPrefill) => void;
  onOpenLoadDetails: (loadId: string) => void;
}

type DashboardTab = 'trips' | 'ledger' | 'profile';
type TripsSubTab = 'active' | 'past';

interface UnifiedBusinessTrip {
  tripId: string;
  loadId?: string;
  booking?: Booking;
  load?: LoadItem;
  statusGroup: 'active' | 'past';
  statusLabel: string;
  statusTone: 'amber' | 'blue' | 'emerald' | 'slate' | 'red';
  isCompleted: boolean;
  isCancelled: boolean;
  pickupCity: string;
  pickupAddress: string;
  deliveryCity: string;
  deliveryAddress: string;
  vehicleLabel: string;
  vehicleRegNumber: string;
  driverName: string;
  driverPhone: string;
  totalFareInr: number;
  advance70Inr: number;
  balance30Inr: number;
  advanceStatusLabel: string;
  advancePaid: boolean;
  balanceStatusLabel: string;
  balanceSettled: boolean;
  balancePendingInr: number;
  cashfreeRef: string;
  createdAt: string;
  escrowLedger?: TripEscrowLedger | null;
}

const NE_CITY_PRESETS = [
  { city: 'Guwahati', state: 'Assam', pincode: '781028', lat: 26.1445, lng: 91.7362 },
  { city: 'Byrnihat', state: 'Meghalaya', pincode: '793101', lat: 26.0507, lng: 91.8698 },
  { city: 'Jorhat', state: 'Assam', pincode: '785001', lat: 26.7509, lng: 94.2037 },
  { city: 'Dibrugarh', state: 'Assam', pincode: '786001', lat: 27.4728, lng: 94.912 },
  { city: 'Silchar', state: 'Assam', pincode: '788001', lat: 24.8333, lng: 92.7789 },
  { city: 'Tinsukia', state: 'Assam', pincode: '786125', lat: 27.4922, lng: 95.3468 }
];

export const BusinessDashboard: React.FC<BusinessDashboardProps> = ({
  currentUser,
  onBackToShipperHome,
  onCreateNewBooking,
  onRebookTrip,
  onOpenLoadDetails
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('trips');
  const [tripsSubTab, setTripsSubTab] = useState<TripsSubTab>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [escrowByTripId, setEscrowByTripId] = useState<
    Record<string, { ledger: TripEscrowLedger; tranches: EscrowPayoutTranche[] }>
  >({});

  // Live map modal state (reuses existing ShipperLiveTracker)
  const [trackingTripId, setTrackingTripId] = useState<string | null>(null);

  // Document Vault modal state
  const [vaultState, setVaultState] = useState<{
    trip: DocumentVaultTripData;
    tab: VaultDocumentTab;
  } | null>(null);

  // Business Profile state
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(() =>
    businessClient.getCachedProfile(currentUser.id)
  );
  const [profileForm, setProfileForm] = useState({
    company_legal_name: businessProfile?.company_legal_name || currentUser.businessName || '',
    gstin: businessProfile?.gstin || currentUser.gstin || '',
    billing_address: businessProfile?.billing_address || '',
    billing_city: businessProfile?.billing_city || 'Guwahati',
    billing_state: businessProfile?.billing_state || 'Assam',
    billing_pincode: businessProfile?.billing_pincode || '',
    contact_person: businessProfile?.contact_person || currentUser.name || '',
    contact_phone: businessProfile?.contact_phone || currentUser.phone || '',
    contact_email: businessProfile?.contact_email || currentUser.email || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Saved Addresses state
  const [savedAddresses, setSavedAddresses] = useState<SavedBusinessAddress[]>(() =>
    businessClient.getCachedAddresses(currentUser.id)
  );
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addrSearchText, setAddrSearchText] = useState('');
  const [addrForm, setAddrForm] = useState<{
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
  }>({
    label: '',
    address_type: 'both',
    formatted_address: '',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '',
    lat: 26.1445,
    lng: 91.7362,
    contact_name: currentUser.name || '',
    contact_phone: currentUser.phone || '',
    is_default: false
  });

  // Subscribe to logisticsStore for real-time shipper loads & bookings
  useEffect(() => {
    const sync = () => {
      const myLoads = logisticsStore
        .getLoads()
        .filter(
          (l) =>
            l.customerId === currentUser.id ||
            (currentUser.isTestAccount && (l.isTestLoad || l.customerId === 'user_cust_01'))
        );
      const myBookings = logisticsStore
        .getBookings()
        .filter(
          (b) =>
            b.customerId === currentUser.id ||
            (currentUser.isTestAccount && (b.isTestBooking || b.customerId === 'user_cust_01'))
        );
      setLoads(myLoads);
      setBookings(myBookings);
    };
    sync();
    const unsub = logisticsStore.subscribe(sync);
    return unsub;
  }, [currentUser.id, currentUser.isTestAccount]);

  // Load Business Profile & Saved Addresses from server
  useEffect(() => {
    let active = true;
    businessClient.getProfile(currentUser.id).then((res) => {
      if (!active || !res.success || !res.profile) return;
      setBusinessProfile(res.profile);
      setProfileForm({
        company_legal_name: res.profile.company_legal_name || '',
        gstin: res.profile.gstin || '',
        billing_address: res.profile.billing_address || '',
        billing_city: res.profile.billing_city || 'Guwahati',
        billing_state: res.profile.billing_state || 'Assam',
        billing_pincode: res.profile.billing_pincode || '',
        contact_person: res.profile.contact_person || currentUser.name || '',
        contact_phone: res.profile.contact_phone || currentUser.phone || '',
        contact_email: res.profile.contact_email || currentUser.email || ''
      });
    });

    businessClient.listSavedAddresses(currentUser.id).then((res) => {
      if (!active || !res.success) return;
      setSavedAddresses(res.addresses);
    });

    return () => {
      active = false;
    };
  }, [currentUser.id, currentUser.name, currentUser.phone, currentUser.email]);

  // Fetch 70/30 escrow ledgers for bookings
  useEffect(() => {
    let active = true;
    const bookingIds = bookings.map((b) => b.id).slice(0, 20);
    if (bookingIds.length === 0) return;

    Promise.all(
      bookingIds.map(async (id) => {
        try {
          const res = await escrowClient.getTripEscrowLedger(id);
          if (res.success && res.ledger) {
            return [id, { ledger: res.ledger, tranches: res.tranches || [] }] as const;
          }
        } catch {
          // ignore
        }
        return null;
      })
    ).then((results) => {
      if (!active) return;
      const map: Record<string, { ledger: TripEscrowLedger; tranches: EscrowPayoutTranche[] }> = {};
      for (const entry of results) {
        if (entry) map[entry[0]] = entry[1];
      }
      setEscrowByTripId(map);
    });

    return () => {
      active = false;
    };
  }, [bookings]);

  const vehicleCategories = useMemo(() => logisticsStore.getVehicleCategories(), []);

  // Build unified B2B trip records (combining bookings + pending unassigned loads)
  const unifiedTrips: UnifiedBusinessTrip[] = useMemo(() => {
    const loadsById = new Map(loads.map((l) => [l.id, l]));
    const bookedLoadIds = new Set<string>();
    const rows: UnifiedBusinessTrip[] = [];

    for (const b of bookings) {
      if (b.loadId) bookedLoadIds.add(b.loadId);
      const load = b.loadId ? loadsById.get(b.loadId) : undefined;
      const vehicle = b.vehicleId ? logisticsStore.getVehicleById(b.vehicleId) : undefined;
      const driverUser = b.driverId ? logisticsStore.getUserById(b.driverId) : undefined;
      const cat = vehicleCategories.find(
        (c) => c.id === (vehicle?.category || load?.requiredVehicleCategory)
      );

      const isCompleted = b.status === 'completed' || b.status === 'delivered';
      const isCancelled = b.status === 'cancelled';
      const statusGroup: 'active' | 'past' = isCompleted || isCancelled ? 'past' : 'active';

      const statusMeta: Record<string, { label: string; tone: UnifiedBusinessTrip['statusTone'] }> = {
        assigned: { label: 'Driver Assigned', tone: 'blue' },
        en_route_pickup: { label: 'Driver Assigned · En Route', tone: 'blue' },
        at_pickup: { label: 'At Pickup Point', tone: 'amber' },
        loading: { label: 'Loading Cargo', tone: 'amber' },
        in_transit: { label: 'In-Transit', tone: 'blue' },
        at_destination: { label: 'At Destination', tone: 'amber' },
        delivered: { label: 'Delivered', tone: 'emerald' },
        completed: { label: 'Delivered', tone: 'emerald' },
        cancelled: { label: 'Cancelled', tone: 'red' }
      };
      const st = statusMeta[b.status] || { label: 'Active', tone: 'blue' };

      const totalFareInr = Number(b.totalAgreedAmountInr) || 0;
      const escrow = escrowByTripId[b.id];
      const ledger = escrow?.ledger || null;
      const tranches = escrow?.tranches || [];
      const advTranche = tranches.find((t) => t.tranche_type === 'ADVANCE_70');
      const balTranche = tranches.find((t) => t.tranche_type === 'BALANCE_30');

      const split = calculateEscrow7030Breakdown(totalFareInr);
      const advance70Inr = ledger?.advance_70_amount ?? Math.round(totalFareInr * 0.7);
      const balance30Inr = ledger?.balance_30_amount ?? Math.max(0, totalFareInr - advance70Inr);

      const advancePaid = Boolean(
        (ledger && ledger.escrow_state !== 'AWAITING_PAYMENT' && ledger.escrow_state !== 'REFUNDED') ||
          b.paymentAdvanceStatus === 'paid'
      );
      const balanceSettled = Boolean(
        ledger?.escrow_state === 'FULLY_SETTLED' ||
          balTranche?.status === 'SETTLED' ||
          b.paymentBalanceStatus === 'paid'
      );

      let advanceStatusLabel = 'Pending 70% Advance';
      if (isCancelled) {
        advanceStatusLabel = 'Cancelled / Refunded';
      } else if (advTranche?.status === 'SETTLED') {
        advanceStatusLabel = 'Paid · Released on Loading';
      } else if (ledger?.escrow_state === 'FUNDED_LOCKED') {
        advanceStatusLabel = 'Funded · Locked in Escrow';
      } else if (advancePaid) {
        advanceStatusLabel = '70% Advance Paid';
      } else if (b.paymentAdvanceStatus === 'processing') {
        advanceStatusLabel = 'Verifying Payment';
      }

      let balanceStatusLabel = 'Held until POD';
      if (isCancelled) {
        balanceStatusLabel = 'Cancelled';
      } else if (ledger?.escrow_state === 'DISPUTE_HOLD') {
        balanceStatusLabel = 'Dispute Hold (30% Frozen)';
      } else if (balanceSettled) {
        balanceStatusLabel = 'Settled on POD';
      } else if (balTranche?.status === 'QUEUED_FOR_RELEASE') {
        balanceStatusLabel = 'POD Uploaded · Auto-Releasing';
      } else if (b.podDocumentUrl || isCompleted) {
        balanceStatusLabel = 'POD Uploaded · Due Release';
      }

      const cashfreeRef =
        ledger?.cf_payment_id ||
        ledger?.cashfree_order_id ||
        b.advancePaymentUtr ||
        b.balancePaymentUtr ||
        `CF-${b.id.slice(-8).toUpperCase()}`;

      rows.push({
        tripId: b.id,
        loadId: b.loadId,
        booking: b,
        load,
        statusGroup,
        statusLabel: st.label,
        statusTone: st.tone,
        isCompleted,
        isCancelled,
        pickupCity: b.pickup?.city || load?.pickup?.city || 'Origin',
        pickupAddress: b.pickup?.address || load?.pickup?.address || '',
        deliveryCity: b.delivery?.city || load?.delivery?.city || 'Destination',
        deliveryAddress: b.delivery?.address || load?.delivery?.address || '',
        vehicleLabel: cat?.name || vehicle?.modelName || 'Commercial Truck',
        vehicleRegNumber: vehicle?.registrationNumber || 'Assigned',
        driverName: driverUser?.name || vehicle?.driverName || 'Assigned Driver',
        driverPhone: driverUser?.phone || vehicle?.driverPhone || '',
        totalFareInr,
        advance70Inr: ledger ? ledger.advance_70_amount : Math.round(totalFareInr * 0.7),
        balance30Inr: ledger ? ledger.balance_30_amount : Math.max(0, totalFareInr - Math.round(totalFareInr * 0.7)),
        advanceStatusLabel,
        advancePaid: !isCancelled && advancePaid,
        balanceStatusLabel,
        balanceSettled: !isCancelled && balanceSettled,
        balancePendingInr: !isCancelled && !balanceSettled ? (ledger ? ledger.balance_30_amount : split.balance30Inr > 0 ? Math.max(0, totalFareInr - Math.round(totalFareInr * 0.7)) : 0) : 0,
        cashfreeRef,
        createdAt: b.createdAt,
        escrowLedger: ledger
      });
    }

    // Also include pending / bidding loads that do not have a booking yet
    for (const l of loads) {
      if (bookedLoadIds.has(l.id)) continue;
      const isCancelled = l.status === 'cancelled';
      const cat = vehicleCategories.find((c) => c.id === l.requiredVehicleCategory);
      const estFare = Number(l.targetBudgetInr || 0);
      const adv70 = Math.round(estFare * 0.7);
      const bal30 = Math.max(0, estFare - adv70);

      rows.push({
        tripId: l.id,
        loadId: l.id,
        load: l,
        statusGroup: isCancelled ? 'past' : 'active',
        statusLabel: isCancelled ? 'Cancelled' : 'Pending Driver Match',
        statusTone: isCancelled ? 'red' : 'amber',
        isCompleted: false,
        isCancelled,
        pickupCity: l.pickup?.city || 'Origin',
        pickupAddress: l.pickup?.address || '',
        deliveryCity: l.delivery?.city || 'Destination',
        deliveryAddress: l.delivery?.address || '',
        vehicleLabel: cat?.name || l.requiredVehicleCategory.replace(/_/g, ' '),
        vehicleRegNumber: 'Awaiting Truck',
        driverName: 'Matching Verified Fleet',
        driverPhone: '',
        totalFareInr: estFare,
        advance70Inr: adv70,
        balance30Inr: bal30,
        advanceStatusLabel: isCancelled ? 'Cancelled' : 'Awaiting Confirmation',
        advancePaid: false,
        balanceStatusLabel: isCancelled ? 'Cancelled' : '30% On-Delivery',
        balanceSettled: false,
        balancePendingInr: 0,
        cashfreeRef: 'Pending Booking',
        createdAt: l.createdAt,
        escrowLedger: null
      });
    }

    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [bookings, loads, escrowByTripId, vehicleCategories]);

  // Top Payment & Ledger Summary KPIs (exact integer paise sums)
  const summaryStats = useMemo(() => {
    let totalSpendPaise = 0;
    let advance70PaidPaise = 0;
    let balance30PendingPaise = 0;

    for (const t of unifiedTrips) {
      if (t.isCancelled || !t.booking) continue;
      totalSpendPaise += Math.round(t.totalFareInr * 100);
      if (t.advancePaid) {
        advance70PaidPaise += Math.round(t.advance70Inr * 100);
      }
      if (!t.balanceSettled) {
        balance30PendingPaise += Math.round(t.balance30Inr * 100);
      }
    }

    return {
      totalSpendInr: totalSpendPaise / 100,
      advance70PaidInr: advance70PaidPaise / 100,
      balance30PendingInr: balance30PendingPaise / 100,
      activeCount: unifiedTrips.filter((t) => t.statusGroup === 'active').length,
      pastCount: unifiedTrips.filter((t) => t.statusGroup === 'past').length
    };
  }, [unifiedTrips]);

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unifiedTrips.filter((t) => {
      if (t.statusGroup !== tripsSubTab) return false;
      if (!q) return true;
      return (
        t.tripId.toLowerCase().includes(q) ||
        t.pickupCity.toLowerCase().includes(q) ||
        t.deliveryCity.toLowerCase().includes(q) ||
        t.vehicleRegNumber.toLowerCase().includes(q) ||
        t.driverName.toLowerCase().includes(q)
      );
    });
  }, [unifiedTrips, tripsSubTab, searchQuery]);

  const ledgerTrips = useMemo(
    () => unifiedTrips.filter((t) => Boolean(t.booking)),
    [unifiedTrips]
  );

  const gstValidation = useMemo(
    () => validateIndianGstin(profileForm.gstin),
    [profileForm.gstin]
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.company_legal_name.trim()) {
      showToast('Please enter your Company Legal Name.', 'error');
      return;
    }
    if (profileForm.gstin.trim() && !gstValidation.valid) {
      showToast(gstValidation.error || 'Please enter a valid 15-digit GSTIN.', 'error');
      return;
    }
    if (!profileForm.billing_address.trim()) {
      showToast('Please enter your Billing Address.', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const resp = await businessClient.saveProfile(currentUser.id, {
        ...profileForm,
        gstin: gstValidation.normalized
      });
      if (resp.success && resp.profile) {
        setBusinessProfile(resp.profile);
        showToast('Business profile & GSTIN saved cleanly.', 'success');
      } else {
        showToast(resp.message || 'Unable to save business profile.', 'error');
      }
    } catch {
      showToast('Network error saving business profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectAddressPlace = (place: SelectedPlace) => {
    setAddrSearchText(place.label);
    setAddrForm((prev) => ({
      ...prev,
      formatted_address: place.address || place.label,
      city: place.city || prev.city,
      state: place.state || prev.state || 'Assam',
      pincode: place.pincode || prev.pincode,
      lat: place.lat,
      lng: place.lng
    }));
  };

  const handleAddSavedAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrForm.label.trim() || !addrForm.formatted_address.trim() || !addrForm.city.trim()) {
      showToast('Location label, full address, and city are required.', 'error');
      return;
    }
    setSavingAddress(true);
    try {
      const resp = await businessClient.addSavedAddress(currentUser.id, addrForm);
      if (resp.success && resp.addresses) {
        setSavedAddresses(resp.addresses);
        setShowAddAddress(false);
        setAddrSearchText('');
        setAddrForm({
          label: '',
          address_type: 'both',
          formatted_address: '',
          city: 'Guwahati',
          state: 'Assam',
          pincode: '',
          lat: 26.1445,
          lng: 91.7362,
          contact_name: profileForm.contact_person || currentUser.name || '',
          contact_phone: profileForm.contact_phone || currentUser.phone || '',
          is_default: false
        });
        showToast('Saved location added to your Business Address Book.', 'success');
      } else {
        showToast(resp.message || 'Could not save location.', 'error');
      }
    } catch {
      showToast('Network error saving address.', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteSavedAddress = async (id: string) => {
    try {
      const resp = await businessClient.deleteSavedAddress(currentUser.id, id);
      if (resp.success && resp.addresses) {
        setSavedAddresses(resp.addresses);
        showToast('Saved location removed.', 'info');
      }
    } catch {
      showToast('Failed to remove saved location.', 'error');
    }
  };

  const handleOpenDocumentVault = (trip: UnifiedBusinessTrip, tab: VaultDocumentTab = 'lr') => {
    setVaultState({
      tab,
      trip: {
        tripId: trip.tripId,
        loadId: trip.loadId,
        booking: trip.booking,
        load: trip.load,
        vehicleLabel: trip.vehicleLabel,
        vehicleRegNumber: trip.vehicleRegNumber,
        driverName: trip.driverName,
        driverPhone: trip.driverPhone,
        totalFareInr: trip.totalFareInr,
        escrowLedger: trip.escrowLedger
      }
    });
  };

  const handleRebook = (trip: UnifiedBusinessTrip) => {
    const pickup = trip.booking?.pickup || trip.load?.pickup || {
      address: trip.pickupAddress || trip.pickupCity,
      city: trip.pickupCity,
      district: trip.pickupCity,
      state: 'Assam',
      pincode: '',
      lat: 26.1445,
      lng: 91.7362,
      contactName: profileForm.contact_person || currentUser.name,
      contactPhone: profileForm.contact_phone || currentUser.phone
    };
    const delivery = trip.booking?.delivery || trip.load?.delivery || {
      address: trip.deliveryAddress || trip.deliveryCity,
      city: trip.deliveryCity,
      district: trip.deliveryCity,
      state: 'Assam',
      pincode: '',
      lat: 27.4728,
      lng: 94.912,
      contactName: '',
      contactPhone: ''
    };
    const vehicle = trip.booking?.vehicleId
      ? logisticsStore.getVehicleById(trip.booking.vehicleId)
      : undefined;

    onRebookTrip({
      sourceTripId: trip.tripId,
      pickup,
      delivery,
      requiredVehicleCategory:
        trip.load?.requiredVehicleCategory || vehicle?.category || 'bolero_pickup',
      goodsCategory: trip.load?.goodsCategory || 'general_freight',
      goodsDescription: trip.load?.goodsDescription || '',
      weightKg: trip.load?.weightKg || 1000,
      packageCount: trip.load?.packageCount || 10
    });
  };

  const renderStatusIndicator = (tone: UnifiedBusinessTrip['statusTone'], label: string) => {
    const map = {
      amber: { cls: 'text-amber-700', Icon: Clock },
      blue: { cls: 'text-blue-700', Icon: Truck },
      emerald: { cls: 'text-emerald-700', Icon: CheckCircle2 },
      slate: { cls: 'text-slate-600', Icon: Clock },
      red: { cls: 'text-red-700', Icon: XCircle }
    }[tone];
    const Icon = map.Icon;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${map.cls}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToShipperHome}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#171318] transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Shipper Home</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-[#E83E83]">Business Dashboard</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#171318]">
              {businessProfile?.company_legal_name || currentUser.businessName || 'Customer Business Dashboard'}
            </h1>
            {businessProfile?.gstin && (
              <span className="text-xs font-mono text-slate-500">
                GSTIN: {businessProfile.gstin}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCreateNewBooking}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Book a Truck</span>
          </button>
        </div>
      </div>

      {/* Top Payment & Ledger Summary Bar (Always Visible) */}
      <section
        aria-label="Freight Payment and Escrow Summary"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Freight Spend</span>
            <IndianRupee className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-[#171318] font-mono tabular-nums tracking-tight">
            {formatInrExact(summaryStats.totalSpendInr)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {summaryStats.activeCount} active · {summaryStats.pastCount} completed/past trips
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>70% Advance Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight">
            {formatInrExact(summaryStats.advance70PaidInr)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Loading milestone releases via Cashfree Easy Split
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>30% Pending / Escrow Balance</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-700 font-mono tabular-nums tracking-tight">
            {formatInrExact(summaryStats.balance30PendingInr)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Held safely in escrow until verified POD upload
          </p>
        </div>
      </section>

      {/* Primary Section Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-200 px-3 sm:px-5 flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'trips' as DashboardTab, label: 'My Trips', icon: Truck, count: unifiedTrips.length },
            { id: 'ledger' as DashboardTab, label: 'Billing & Ledger (70/30)', icon: Receipt, count: ledgerTrips.length },
            { id: 'profile' as DashboardTab, label: 'Business Profile & Saved Locations', icon: Building2, count: savedAddresses.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'border-[#E83E83] text-[#171318]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] text-slate-400">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* TAB 1: MY TRIPS (ACTIVE & PAST TRIPS + TRACK LIVE + RE-BOOK)     */}
        {/* ================================================================ */}
        {activeTab === 'trips' && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Sub-tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setTripsSubTab('active')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                    tripsSubTab === 'active'
                      ? 'bg-[#171318] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active Trips ({summaryStats.activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTripsSubTab('past')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${
                    tripsSubTab === 'past'
                      ? 'bg-[#171318] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Past Trips ({summaryStats.pastCount})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Trip ID, city, vehicle..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#E83E83]/25 focus:border-[#E83E83]"
                />
              </div>
            </div>

            {/* Inline Live Tracking Drawer (reuses existing ShipperLiveTracker) */}
            {trackingTripId && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#E83E83]" />
                    <span className="text-xs sm:text-sm font-bold text-[#171318]">
                      Live GPS Tracking · Trip <span className="font-mono">{trackingTripId}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrackingTripId(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Close Map
                  </button>
                </div>
                <ShipperLiveTracker tripId={trackingTripId} />
              </div>
            )}

            {filteredTrips.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2.5">
                <Truck className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {tripsSubTab === 'active' ? 'No Active Shipments Right Now' : 'No Past Trips Yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {tripsSubTab === 'active'
                    ? 'Book a truck for Guwahati, Dibrugarh, Jorhat, Silchar, or any Pan-India corridor to track it live here.'
                    : 'Delivered and cancelled shipments will appear here with 1-click Re-book and Document Vault access.'}
                </p>
                {tripsSubTab === 'active' && (
                  <button
                    type="button"
                    onClick={onCreateNewBooking}
                    className="mt-1 px-4 py-2 rounded-lg bg-[#171318] hover:bg-black text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Book Your First Truck</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Responsive Table */}
                <div className="hidden lg:block overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Trip ID &amp; Date</th>
                        <th className="py-3 px-4">Route (Pickup → Drop)</th>
                        <th className="py-3 px-4">Vehicle &amp; Driver</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Freight</th>
                        <th className="py-3 px-4 text-right">Documents &amp; Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredTrips.map((trip) => (
                        <tr key={trip.tripId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 align-top">
                            <button
                              type="button"
                              onClick={() => trip.loadId && onOpenLoadDetails(trip.loadId)}
                              className="font-mono font-semibold text-[#171318] hover:text-[#E83E83] text-left cursor-pointer"
                            >
                              {trip.tripId}
                            </button>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(trip.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-slate-900">
                              {trip.pickupCity} → {trip.deliveryCity}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[240px] mt-0.5">
                              {trip.pickupAddress || trip.deliveryAddress}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-slate-900">
                              {trip.vehicleLabel}{' '}
                              <span className="font-mono text-slate-600">· {trip.vehicleRegNumber}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2">
                              <span>{trip.driverName}</span>
                              {trip.driverPhone && (
                                <a
                                  href={`tel:${trip.driverPhone.replace(/\s+/g, '')}`}
                                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-mono font-semibold"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{trip.driverPhone}</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            {renderStatusIndicator(trip.statusTone, trip.statusLabel)}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-bold text-slate-900">
                            {formatInrExact(trip.totalFareInr)}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {trip.statusGroup === 'active' && trip.booking && (
                                <button
                                  type="button"
                                  onClick={() => setTrackingTripId(trip.tripId)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Navigation className="w-3 h-3" />
                                  <span>Track Live</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenDocumentVault(trip, 'lr')}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                title="Open Digital LR, GST Invoice & POD"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Documents</span>
                              </button>

                              {trip.statusGroup === 'past' && trip.isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleRebook(trip)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#171318] hover:bg-black text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Re-book</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Stacked Cards (Android TWA optimized) */}
                <div className="lg:hidden space-y-3">
                  {filteredTrips.map((trip) => (
                    <article
                      key={trip.tripId}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-[#171318]">{trip.tripId}</div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {trip.pickupCity} → {trip.deliveryCity}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono tabular-nums text-sm font-bold text-slate-900">
                            {formatInrExact(trip.totalFareInr)}
                          </div>
                          <div className="mt-0.5">
                            {renderStatusIndicator(trip.statusTone, trip.statusLabel)}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400">Vehicle:</span>{' '}
                          <span className="font-semibold text-slate-800">{trip.vehicleLabel}</span> ·{' '}
                          <span className="font-mono">{trip.vehicleRegNumber}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            <span className="text-slate-400">Driver:</span>{' '}
                            <span className="font-medium text-slate-800">{trip.driverName}</span>
                          </span>
                          {trip.driverPhone && (
                            <a
                              href={`tel:${trip.driverPhone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-emerald-700 font-mono font-semibold"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call {trip.driverPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* One-click Action Row */}
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-1">
                        {trip.statusGroup === 'active' && trip.booking && (
                          <button
                            type="button"
                            onClick={() => setTrackingTripId(trip.tripId)}
                            className="px-3 py-2 rounded-lg bg-[#E83E83] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Track Live</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDocumentVault(trip, 'lr')}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>LR / GST / POD</span>
                        </button>
                        {trip.statusGroup === 'past' && trip.isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleRebook(trip)}
                            className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg bg-[#171318] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Re-book Same Route</span>
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: BILLING & LEDGER (70% ADVANCE / 30% ON-DELIVERY POD)      */}
        {/* ================================================================ */}
        {activeTab === 'ledger' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#171318]">
                  Transaction-Wise Trip Ledger (70% Advance / 30% On-Delivery)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Every trip follows Cashfree Easy Split escrow: 70% loading advance + 30% held safely until POD verification.
                </p>
              </div>
            </div>

            {ledgerTrips.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                No confirmed freight transactions yet. Completed and active booked trips will populate your 70/30 ledger automatically.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Trip &amp; Corridor</th>
                      <th className="py-3 px-4 text-right">Total Fare</th>
                      <th className="py-3 px-4">70% Loading Advance</th>
                      <th className="py-3 px-4">30% Delivery Balance (POD)</th>
                      <th className="py-3 px-4">Cashfree Ref</th>
                      <th className="py-3 px-4 text-right">Vault</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {ledgerTrips.map((trip) => (
                      <tr key={trip.tripId} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-semibold text-slate-900">{trip.tripId}</div>
                          <div className="text-[11px] text-slate-500">
                            {trip.pickupCity} → {trip.deliveryCity}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatInrExact(trip.totalFareInr)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatInrExact(trip.advance70Inr)}
                          </div>
                          <div
                            className={`text-[11px] font-medium mt-0.5 ${
                              trip.advancePaid ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {trip.advanceStatusLabel}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono tabular-nums font-semibold text-slate-900">
                            {formatInrExact(trip.balance30Inr)}
                          </div>
                          <div
                            className={`text-[11px] font-medium mt-0.5 ${
                              trip.balanceSettled
                                ? 'text-emerald-700'
                                : trip.escrowLedger?.escrow_state === 'DISPUTE_HOLD'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {trip.balanceStatusLabel}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          {trip.cashfreeRef}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDocumentVault(trip, 'gst_invoice')}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>GST Invoice</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDocumentVault(trip, 'pod')}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              <span>POD</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: BUSINESS PROFILE, GSTIN & SAVED PICKUP / DROP LOCATIONS   */}
        {/* ================================================================ */}
        {activeTab === 'profile' && (
          <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Business Profile & 15-Digit GSTIN */}
            <form onSubmit={handleSaveProfile} className="lg:col-span-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#171318]">
                  Company Legal Profile &amp; GSTIN
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically populates your Digital LRs, GST Tax Invoices (SAC 996511), and Truck Booking forms.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.company_legal_name}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, company_legal_name: e.target.value }))
                    }
                    placeholder="e.g., Brahmaputra Agro Industries Pvt. Ltd."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E83E83]/25 focus:border-[#E83E83]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    15-Digit GSTIN (Optional for unregistered firms)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={profileForm.gstin}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))
                    }
                    placeholder="18AAAFK4902L1ZQ"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 ${
                      profileForm.gstin && !gstValidation.valid
                        ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                        : 'border-slate-200 focus:ring-[#E83E83]/25 focus:border-[#E83E83]'
                    }`}
                  />
                  {profileForm.gstin && (
                    <div className="mt-1 text-[11px] flex items-center gap-1">
                      {gstValidation.valid ? (
                        <span className="text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valid 15-digit GSTIN ({gstValidation.stateName})</span>
                        </span>
                      ) : (
                        <span className="text-red-600 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{gstValidation.error}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Billing Address *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={profileForm.billing_address}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, billing_address: e.target.value }))
                    }
                    placeholder="Plot 42, Industrial Estate, Bamunimaidan, Guwahati"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E83E83]/25 focus:border-[#E83E83]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={profileForm.billing_city}
                      onChange={(e) => setProfileForm((p) => ({ ...p, billing_city: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={profileForm.billing_state}
                      onChange={(e) => setProfileForm((p) => ({ ...p, billing_state: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={profileForm.billing_pincode}
                      onChange={(e) =>
                        setProfileForm((p) => ({ ...p, billing_pincode: e.target.value.replace(/\D/g, '') }))
                      }
                      placeholder="781021"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={profileForm.contact_person}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_person: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={profileForm.contact_phone}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Accounts / Billing Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.contact_email}
                    onChange={(e) => setProfileForm((p) => ({ ...p, contact_email: e.target.value }))}
                    placeholder="accounts@yourcompany.in"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#171318] hover:bg-black disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Business Profile</span>
              </button>
            </form>

            {/* Right Column: Saved Pickup & Drop Locations */}
            <div className="lg:col-span-6 space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#171318]">
                    Saved Warehouses &amp; Factory Gates
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    One-click auto-fill in the Truck Booking form for frequent Assam &amp; NE sites.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAddress((v) => !v)}
                  className="px-3 py-2 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddAddress ? 'Close' : 'Add Location'}</span>
                </button>
              </div>

              {showAddAddress && (
                <form
                  onSubmit={handleAddSavedAddress}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Custom Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrForm.label}
                        onChange={(e) => setAddrForm((a) => ({ ...a, label: e.target.value }))}
                        placeholder="e.g., Main Warehouse / Factory Gate"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Usage Type
                      </label>
                      <select
                        value={addrForm.address_type}
                        onChange={(e) =>
                          setAddrForm((a) => ({ ...a, address_type: e.target.value as SavedAddressType }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                      >
                        <option value="both">Both Pickup &amp; Drop</option>
                        <option value="pickup">Pickup Only</option>
                        <option value="drop">Drop Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Northeast City Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500">Quick hub:</span>
                    {NE_CITY_PRESETS.map((preset) => (
                      <button
                        key={preset.city}
                        type="button"
                        onClick={() =>
                          setAddrForm((a) => ({
                            ...a,
                            city: preset.city,
                            state: preset.state,
                            pincode: preset.pincode,
                            lat: preset.lat,
                            lng: preset.lng
                          }))
                        }
                        className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:border-[#E83E83] text-slate-700 cursor-pointer"
                      >
                        {preset.city}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Search Address via OpenStreetMap
                    </label>
                    <LocationAutocompleteInput
                      value={addrSearchText}
                      onChangeText={setAddrSearchText}
                      onSelectPlace={handleSelectAddressPlace}
                      placeholder="Search warehouse, industrial area, Byrnihat, Jorhat..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Complete Street / Gate Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={addrForm.formatted_address}
                      onChange={(e) => setAddrForm((a) => ({ ...a, formatted_address: e.target.value }))}
                      placeholder="Gate 2, EPIP Industrial Park, Byrnihat"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={addrForm.city}
                      onChange={(e) => setAddrForm((a) => ({ ...a, city: e.target.value }))}
                      placeholder="City"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                    />
                    <input
                      type="text"
                      value={addrForm.state}
                      onChange={(e) => setAddrForm((a) => ({ ...a, state: e.target.value }))}
                      placeholder="State"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                    />
                    <input
                      type="text"
                      maxLength={6}
                      value={addrForm.pincode}
                      onChange={(e) =>
                        setAddrForm((a) => ({ ...a, pincode: e.target.value.replace(/\D/g, '') }))
                      }
                      placeholder="Pincode"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={addrForm.contact_name}
                      onChange={(e) => setAddrForm((a) => ({ ...a, contact_name: e.target.value }))}
                      placeholder="Site Manager Name"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900"
                    />
                    <input
                      type="tel"
                      value={addrForm.contact_phone}
                      onChange={(e) => setAddrForm((a) => ({ ...a, contact_phone: e.target.value }))}
                      placeholder="Site Phone"
                      className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="w-full py-2 rounded-lg bg-[#171318] hover:bg-black disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {savingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Location</span>
                  </button>
                </form>
              )}

              {savedAddresses.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1.5">
                  <MapPin className="w-6 h-6 text-slate-400 mx-auto" />
                  <p>No saved locations yet. Add your Main Warehouse or Factory Gate for 1-click booking auto-fill.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#171318]">{addr.label}</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            · {addr.address_type === 'both' ? 'Pickup & Drop' : addr.address_type === 'pickup' ? 'Pickup' : 'Drop'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{addr.formatted_address}</p>
                        <p className="text-[11px] text-slate-500">
                          {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                          {addr.contact_name ? ` · ${addr.contact_name}` : ''}
                          {addr.contact_phone ? ` (${addr.contact_phone})` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedAddress(addr.id)}
                        aria-label={`Delete ${addr.label}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Vault Modal (Digital LR, GST Invoice, POD) */}
      {vaultState && (
        <DocumentVaultModal
          trip={vaultState.trip}
          currentUser={currentUser}
          businessProfile={businessProfile}
          initialTab={vaultState.tab}
          onClose={() => setVaultState(null)}
        />
      )}
    </div>
  );
};
