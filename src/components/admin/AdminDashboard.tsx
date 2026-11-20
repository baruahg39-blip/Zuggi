import React, { useState, useEffect, useMemo } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import {
  ShieldAlert,
  Users,
  Truck,
  Package,
  IndianRupee,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  MapPin,
  Activity,
  LifeBuoy,
  Building2,
  Layers,
  FileCheck,
  BarChart3,
  Download,
  Radar,
  Ban,
  ShieldCheck,
  Eye,
  X,
  Phone,
  Radio,
  Navigation,
  RefreshCw,
  Zap,
  BellRing,
  LogIn,
  LogOut
} from 'lucide-react';
import { Booking, CommercialVehicle, GeofenceEvent, LoadItem, LoadStatus, PartnerApplication, Quotation, SupportTicket, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { SUPER_ADMIN_EMAIL } from '../../services/firebase';
import { exportAdminMasterReportCsv } from '../../utils/csvExport';
import { AdminSupportDesk } from './AdminSupportDesk';
import { AdminPaymentsTab } from './AdminPaymentsTab';
import { AdminPartnerVerificationTab } from './AdminPartnerVerificationTab';
import { ShipperLiveTracker } from '../tracking/ShipperLiveTracker';
import { GeofenceOverlay } from '../maps/GeofenceOverlay';
import { LiveTelemetryFallbackMap } from '../maps/LiveTelemetryFallbackMap';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { AdminAnalyticsCharts } from './AdminAnalyticsCharts';

interface AdminDashboardProps {
  currentUser: User;
  onViewInvoice: (bookingId: string) => void;
}

type AdminTab =
  | 'overview'
  | 'live_radar'
  | 'loads'
  | 'users'
  | 'shippers'
  | 'vehicles'
  | 'drivers'
  | 'fleets'
  | 'bookings'
  | 'payments'
  | 'disputes'
  | 'verification'
  | 'reports';

type BlockTarget =
  | { type: 'user'; id: string; label: string }
  | { type: 'vehicle'; id: string; label: string }
  | { type: 'load'; id: string; label: string };

const BOOKING_STATUS_OPTIONS: LoadStatus[] = [
  'assigned',
  'en_route_pickup',
  'at_pickup',
  'loading',
  'in_transit',
  'at_destination',
  'delivered',
  'completed',
  'cancelled'
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onViewInvoice
}) => {
  const { apiKey, canRenderGoogleMap, mapAuthError, reportMapError } = useGoogleMapsApiKey();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [partnerApps, setPartnerApps] = useState<PartnerApplication[]>([]);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);

  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [loadStatusFilter, setLoadStatusFilter] = useState<string>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Inline block reason modal state (zero window.prompt)
  const [pendingBlock, setPendingBlock] = useState<BlockTarget | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // Inline booking status override & live tracking modal
  const [statusOverrides, setStatusOverrides] = useState<Record<string, LoadStatus>>({});
  const [liveTrackBooking, setLiveTrackBooking] = useState<Booking | null>(null);
  const [inspectLoadBids, setInspectLoadBids] = useState<LoadItem | null>(null);

  // Radar InfoWindow selection
  const [selectedRadarVehicle, setSelectedRadarVehicle] = useState<CommercialVehicle | null>(null);
  const [selectedRadarLoad, setSelectedRadarLoad] = useState<LoadItem | null>(null);

  useEffect(() => {
    const update = () => {
      setVehicles(logisticsStore.getVehicles());
      setLoads(logisticsStore.getLoads());
      setBookings(logisticsStore.getBookings());
      setUsers(logisticsStore.getUsers());
      setQuotations(logisticsStore.getQuotations());
      setTickets(logisticsStore.getTickets('admin'));
      setPartnerApps(logisticsStore.getPartnerApplications());
      setGeofenceEvents(logisticsStore.getGeofenceEvents());
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setAdminActionMessage(msg);
    setTimeout(() => setAdminActionMessage(null), 3500);
  };

  // Real derived lists & metrics
  const shippersList = useMemo(() => users.filter((u) => u.role === 'customer'), [users]);
  const driversList = useMemo(() => users.filter((u) => u.role === 'driver' || u.role === 'vehicle_owner'), [users]);
  const fleetPartnersList = useMemo(
    () => users.filter((u) => u.role === 'fleet_partner' || u.role === 'transporter'),
    [users]
  );

  const onlineVehicles = useMemo(() => vehicles.filter((v) => v.isOnline && !v.isBlocked), [vehicles]);
  const blockedVehiclesCount = useMemo(() => vehicles.filter((v) => v.isBlocked).length, [vehicles]);
  const blockedUsersCount = useMemo(() => users.filter((u) => u.isBlocked).length, [users]);

  const activeLoadsCount = useMemo(
    () => loads.filter((l) => ['posted', 'bidding'].includes(l.status) && !l.isBlocked).length,
    [loads]
  );
  const liveTripsCount = useMemo(
    () =>
      bookings.filter((b) =>
        ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)
      ).length,
    [bookings]
  );

  const totalGMV = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + (b.totalAgreedAmountInr || 0), 0),
    [bookings]
  );
  const platformRevenue = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + (b.platformCommissionInr || Math.round((b.totalAgreedAmountInr || 0) * 0.05)), 0),
    [bookings]
  );
  const openDisputes = useMemo(
    () => tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
    [tickets]
  );

  const analyticsMetrics = useMemo(() => {
    const completedBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'delivered');
    const nonCancelled = bookings.filter((b) => b.status !== 'cancelled');
    const totalTonnageMT = nonCancelled.reduce((sum, b) => sum + (b.weightKg || 0), 0) / 1000;
    const fulfillmentRate = nonCancelled.length > 0
      ? Math.round((completedBookings.length / nonCancelled.length) * 1000) / 10
      : 100;
    return {
      completedCount: completedBookings.length,
      totalActiveCount: liveTripsCount,
      totalTonnageMT: totalTonnageMT.toFixed(1),
      fulfillmentRate: Math.min(100, fulfillmentRate)
    };
  }, [bookings, liveTripsCount]);

  // Dynamic corridor activity from real loads
  const topCorridors = useMemo(() => {
    const counts: Record<string, { route: string; count: number; totalValue: number }> = {};
    loads.forEach((l) => {
      const from = l.pickup?.city || 'Guwahati';
      const to = l.delivery?.city || 'Dibrugarh';
      const key = `${from} → ${to}`;
      if (!counts[key]) {
        counts[key] = { route: key, count: 0, totalValue: 0 };
      }
      counts[key].count += 1;
      counts[key].totalValue += l.targetBudgetInr || 0;
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [loads]);

  // Filtered views
  const qLower = searchQuery.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'blocked' ? Boolean(u.isBlocked) : u.role === roleFilter);
      const matchesSearch =
        !qLower ||
        u.name.toLowerCase().includes(qLower) ||
        (u.phone || '').toLowerCase().includes(qLower) ||
        (u.email || '').toLowerCase().includes(qLower) ||
        (u.businessName || '').toLowerCase().includes(qLower);
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, qLower]);

  const filteredShippers = useMemo(() => {
    return shippersList.filter(
      (s) =>
        !qLower ||
        s.name.toLowerCase().includes(qLower) ||
        (s.businessName || '').toLowerCase().includes(qLower) ||
        (s.phone || '').toLowerCase().includes(qLower)
    );
  }, [shippersList, qLower]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesFilter =
        vehicleFilter === 'all' ||
        (vehicleFilter === 'online' && v.isOnline && !v.isBlocked) ||
        (vehicleFilter === 'blocked' && Boolean(v.isBlocked)) ||
        (vehicleFilter === 'pending' && v.verificationStatus !== 'verified');
      const matchesSearch =
        !qLower ||
        v.registrationNumber.toLowerCase().includes(qLower) ||
        v.modelName.toLowerCase().includes(qLower) ||
        (v.driverName || '').toLowerCase().includes(qLower) ||
        (v.transporterName || '').toLowerCase().includes(qLower);
      return matchesFilter && matchesSearch;
    });
  }, [vehicles, vehicleFilter, qLower]);

  const filteredDrivers = useMemo(() => {
    return driversList.filter(
      (d) =>
        !qLower ||
        d.name.toLowerCase().includes(qLower) ||
        (d.phone || '').toLowerCase().includes(qLower) ||
        (d.city || '').toLowerCase().includes(qLower)
    );
  }, [driversList, qLower]);

  const filteredFleets = useMemo(() => {
    return fleetPartnersList.filter(
      (f) =>
        !qLower ||
        f.name.toLowerCase().includes(qLower) ||
        (f.businessName || '').toLowerCase().includes(qLower) ||
        (f.phone || '').toLowerCase().includes(qLower)
    );
  }, [fleetPartnersList, qLower]);

  const filteredLoads = useMemo(() => {
    return loads.filter((l) => {
      const matchesStatus =
        loadStatusFilter === 'all' ||
        (loadStatusFilter === 'active_ride' &&
          ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(l.status)) ||
        (loadStatusFilter === 'open' && ['posted', 'bidding'].includes(l.status)) ||
        (loadStatusFilter === 'blocked' && (Boolean(l.isBlocked) || l.status === 'blocked')) ||
        l.status === loadStatusFilter;
      const matchesSearch =
        !qLower ||
        l.id.toLowerCase().includes(qLower) ||
        (l.pickup?.city || '').toLowerCase().includes(qLower) ||
        (l.delivery?.city || '').toLowerCase().includes(qLower) ||
        (l.customerName || '').toLowerCase().includes(qLower) ||
        (l.goodsDescription || '').toLowerCase().includes(qLower);
      return matchesStatus && matchesSearch;
    });
  }, [loads, loadStatusFilter, qLower]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus =
        bookingStatusFilter === 'all' ||
        (bookingStatusFilter === 'live' &&
          ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)) ||
        b.status === bookingStatusFilter;
      const veh = vehicles.find((v) => v.id === b.vehicleId);
      const drv = users.find((u) => u.id === b.driverId);
      const matchesSearch =
        !qLower ||
        b.id.toLowerCase().includes(qLower) ||
        (b.pickup?.city || '').toLowerCase().includes(qLower) ||
        (b.delivery?.city || '').toLowerCase().includes(qLower) ||
        (veh?.registrationNumber || '').toLowerCase().includes(qLower) ||
        (drv?.name || '').toLowerCase().includes(qLower);
      return matchesStatus && matchesSearch;
    });
  }, [bookings, bookingStatusFilter, qLower, vehicles, users]);

  // Action Handlers
  const handleApproveVehicle = (vehicleId: string) => {
    logisticsStore.updateVehicleVerification(vehicleId, 'verified');
    showToast(`Vehicle ${vehicleId} verified & approved.`);
  };

  const handleRejectVehicle = (vehicleId: string) => {
    logisticsStore.updateVehicleVerification(vehicleId, 'rejected', 'Document mismatch or expired RC/Insurance');
    showToast(`Vehicle ${vehicleId} rejected.`);
  };

  const handleForceVehicleOffline = (vehicleId: string) => {
    logisticsStore.toggleVehicleOnline(vehicleId, false);
    showToast(`Vehicle ${vehicleId} taken offline.`);
  };

  const handleConfirmBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingBlock) return;
    const reason = blockReasonInput.trim() || 'Blocked by Platform Super Admin';

    let res: { success: boolean; message: string } = { success: false, message: 'Unknown target' };
    if (pendingBlock.type === 'user') {
      res = logisticsStore.toggleBlockUser(pendingBlock.id, true, reason);
    } else if (pendingBlock.type === 'vehicle') {
      res = logisticsStore.toggleBlockVehicle(pendingBlock.id, true, reason);
    } else if (pendingBlock.type === 'load') {
      res = logisticsStore.toggleBlockLoad(pendingBlock.id, true, reason);
    }

    showToast(res.message);
    setPendingBlock(null);
    setBlockReasonInput('');
  };

  const handleUnblockUser = (userId: string) => {
    const res = logisticsStore.toggleBlockUser(userId, false);
    showToast(res.message);
  };

  const handleUnblockVehicle = (vehicleId: string) => {
    const res = logisticsStore.toggleBlockVehicle(vehicleId, false);
    showToast(res.message);
  };

  const handleUnblockLoad = (loadId: string) => {
    const res = logisticsStore.toggleBlockLoad(loadId, false);
    showToast(res.message);
  };

  const handleCancelLoadAdmin = (loadId: string) => {
    const res = logisticsStore.cancelLoad(loadId, 'Cancelled by Platform Super Admin');
    showToast(res.message);
  };

  const handleApplyBookingOverride = (bookingId: string, currentStatus: LoadStatus) => {
    const targetStatus = statusOverrides[bookingId] || currentStatus;
    const res = logisticsStore.adminOverrideBookingStatus(bookingId, targetStatus, 'Super Admin override');
    showToast(res.message);
  };

  const navTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: '1. Overview', icon: Activity },
    { id: 'live_radar', label: `2. Live Radar (${liveTripsCount})`, icon: Radar },
    { id: 'loads', label: `3. Loads Control (${loads.length})`, icon: Package },
    { id: 'bookings', label: `4. Bookings (${bookings.length})`, icon: FileText },
    { id: 'users', label: `5. All Users (${users.length})`, icon: Users },
    { id: 'shippers', label: `6. Shippers (${shippersList.length})`, icon: Building2 },
    { id: 'vehicles', label: `7. Vehicles (${vehicles.length})`, icon: Truck },
    { id: 'drivers', label: `8. Drivers (${driversList.length})`, icon: Users },
    { id: 'fleets', label: `9. Fleets (${fleetPartnersList.length})`, icon: Layers },
    { id: 'payments', label: '10. Escrow & Payouts', icon: IndianRupee },
    { id: 'disputes', label: `11. Disputes (${openDisputes})`, icon: LifeBuoy },
    { id: 'verification', label: '12. Partner KYC', icon: FileCheck },
    { id: 'reports', label: '13. Reports & CSV', icon: BarChart3 }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20 w-full">
      {/* Toast */}
      {adminActionMessage && (
        <div className="fixed top-18 right-4 z-50 bg-[#16A36A] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{adminActionMessage}</span>
        </div>
      )}

      {/* Block Reason Modal (Zero window.prompt) */}
      {pendingBlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmBlock}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-[#DC3545] flex items-center justify-center">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#171318]">
                    Block {pendingBlock.type.toUpperCase()}
                  </h3>
                  <p className="text-xs text-[#77717A]">{pendingBlock.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingBlock(null);
                  setBlockReasonInput('');
                }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#171318]">Reason for blocking / suspension</label>
              <textarea
                rows={3}
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="e.g., Suspicious pricing, expired permit/insurance, or shipper complaint..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingBlock(null);
                  setBlockReasonInput('');
                }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#DC3545] text-white text-xs font-bold hover:bg-rose-700 cursor-pointer flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Block</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Tracking Modal for Super Admin */}
      {liveTrackBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#E83E83]">
                  ADMIN LIVE TELEMETRY • #{liveTrackBooking.id}
                </span>
                <h3 className="font-black text-lg text-[#171318]">
                  {liveTrackBooking.pickup?.city} → {liveTrackBooking.delivery?.city}
                </h3>
              </div>
              <button
                onClick={() => setLiveTrackBooking(null)}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ShipperLiveTracker
              tripId={liveTrackBooking.id}
              loadId={liveTrackBooking.loadId}
              initialTrackingToken={liveTrackBooking.trackingToken}
            />
          </div>
        </div>
      )}

      {/* Inspect Load Bids Modal */}
      {inspectLoadBids && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#E83E83]">LOAD #{inspectLoadBids.id}</span>
                <h3 className="font-black text-base text-[#171318]">
                  {inspectLoadBids.pickup?.city} → {inspectLoadBids.delivery?.city} ({inspectLoadBids.goodsDescription})
                </h3>
              </div>
              <button
                onClick={() => setInspectLoadBids(null)}
                className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const loadQuotes = quotations.filter((q) => q.loadId === inspectLoadBids.id);
              if (loadQuotes.length === 0) {
                return (
                  <p className="text-xs text-[#77717A] py-6 text-center bg-gray-50 rounded-2xl">
                    No quotations received for this load yet.
                  </p>
                );
              }
              return (
                <div className="space-y-2.5">
                  {loadQuotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-[#171318] block">
                          {q.transporterName} ({q.driverName})
                        </span>
                        <span className="text-[#77717A]">
                          Vehicle: <span className="font-mono font-bold text-[#171318]">{q.vehicleRegNumber}</span> • {q.transporterPhone}
                        </span>
                      </div>
                      <div className="text-left sm:text-right">
                        <span className="text-base font-black text-[#16A36A] block">
                          ₹{q.quoteAmountInr.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[#171318]">
                          {q.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Admin Top Header Card */}
      <div className="bg-[#171318] text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E83E83] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#E83E83]/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white">Zuggi Executive Control Panel</h1>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#FFF0F6] text-[#E83E83] font-black uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Authorized Owner: <span className="text-white font-mono">{currentUser.email || SUPER_ADMIN_EMAIL}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-gray-400 mr-1.5">Online Trucks:</span>
              <span className="font-black text-emerald-400">{onlineVehicles.length}/{vehicles.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
              <span className="text-gray-400 mr-1.5">Blocked:</span>
              <span className="font-black text-rose-400">{blockedUsersCount} Users • {blockedVehiclesCount} Trucks</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-5 border-t border-gray-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {navTabs.map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shared Search Bar for directory/control tabs */}
      {['loads', 'bookings', 'users', 'shippers', 'vehicles', 'drivers', 'fleets'].includes(activeTab) && (
        <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search in ${activeTab}... (name, phone, reg no., city, ID)`}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E83E83]"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* 1. BUSINESS OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Total Shippers</span>
              <span className="text-2xl font-black text-[#171318]">{shippersList.length}</span>
              <span className="text-[10px] text-emerald-600 block">Verified Accounts</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Drivers & Owners</span>
              <span className="text-2xl font-black text-[#171318]">{driversList.length}</span>
              <span className="text-[10px] text-emerald-600 block">+{fleetPartnersList.length} Fleet Operators</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Online Trucks</span>
              <span className="text-2xl font-black text-[#16A36A]">{onlineVehicles.length} / {vehicles.length}</span>
              <span className="text-[10px] text-rose-600 block">{blockedVehiclesCount} Blocked</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Open Loads</span>
              <span className="text-2xl font-black text-amber-600">{activeLoadsCount}</span>
              <span className="text-[10px] text-gray-500 block">{loads.length} Total Posted</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Live Rides</span>
              <span className="text-2xl font-black text-[#E83E83]">{liveTripsCount}</span>
              <span className="text-[10px] text-emerald-600 block">GPS Active</span>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-gray-200 shadow-sm space-y-1">
              <span className="text-xs text-[#77717A] font-semibold block">Gross GMV</span>
              <span className="text-2xl font-black text-[#171318]">₹{totalGMV.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-emerald-600 block">Commission: ₹{platformRevenue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#171318]">Live Freight Corridors</h3>
                <button
                  onClick={() => setActiveTab('live_radar')}
                  className="text-xs font-bold text-[#E83E83] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Radar className="w-3.5 h-3.5" />
                  <span>Open Live Radar</span>
                </button>
              </div>
              <div className="space-y-3 text-xs">
                {topCorridors.map((c) => (
                  <div key={c.route} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                    <div>
                      <span className="font-bold text-sm text-[#171318] block">{c.route}</span>
                      <span className="text-[#77717A]">Total Target Freight Value: ₹{c.totalValue.toLocaleString('en-IN')}</span>
                    </div>
                    <span className="font-black text-sm text-[#16A36A]">{c.count} Load{c.count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-[#171318]">Quick Super Admin Controls</h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <button
                  onClick={() => setActiveTab('live_radar')}
                  className="p-3.5 rounded-2xl bg-[#FFF0F6] text-[#E83E83] font-bold hover:bg-[#ffe1ee] transition text-left space-y-1 cursor-pointer"
                >
                  <Radar className="w-5 h-5" />
                  <span className="block">Live Fleet Radar</span>
                </button>
                <button
                  onClick={() => setActiveTab('loads')}
                  className="p-3.5 rounded-2xl bg-amber-50 text-amber-800 font-bold hover:bg-amber-100 transition text-left space-y-1 cursor-pointer"
                >
                  <Package className="w-5 h-5" />
                  <span className="block">Manage All Loads</span>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 font-bold hover:bg-rose-100 transition text-left space-y-1 cursor-pointer"
                >
                  <Ban className="w-5 h-5" />
                  <span className="block">Block / Unblock Entities</span>
                </button>
                <button
                  onClick={() => setActiveTab('verification')}
                  className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-100 transition text-left space-y-1 cursor-pointer"
                >
                  <FileCheck className="w-5 h-5" />
                  <span className="block">Partner KYC Queue</span>
                </button>
              </div>
            </div>
          </div>

          <AdminAnalyticsCharts
            bookings={bookings}
            loads={loads}
            vehicles={vehicles}
          />
        </div>
      )}

      {/* 2. LIVE FLEET & LOAD RADAR */}
      {activeTab === 'live_radar' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Live Fleet & Consignment GPS Radar</h2>
              <p className="text-xs text-[#77717A]">
                Click any truck or load pin to inspect live telemetry, block suspicious entities, or open turn-by-turn live tracking.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#16A36A]">Green = Online Free</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Amber = Busy / En-Route</span>
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-[#DC3545]">Red = Blocked</span>
              <span className="px-2.5 py-1 rounded-full bg-[#FFF0F6] text-[#E83E83]">Pink = Open Load</span>
            </div>
          </div>

          <div className="w-full h-[460px] rounded-3xl overflow-hidden border border-gray-200 shadow-lg bg-[#120F15] relative">
            {canRenderGoogleMap ? (
              <APIProvider apiKey={apiKey} language="en" region="IN" onError={reportMapError}>
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  defaultCenter={{ lat: 26.25, lng: 92.9 }}
                  defaultZoom={7}
                  gestureHandling="greedy"
                  className="w-full h-full"
                >
                  {vehicles.map((v) => {
                    const pos = v.currentLocation || { lat: 26.1445, lng: 91.7362 };
                    const bg = v.isBlocked
                      ? '#DC3545'
                      : !v.isOnline
                      ? '#6B7280'
                      : v.isAvailable
                      ? '#16A36A'
                      : '#E9A23B';
                    return (
                      <AdvancedMarker
                        key={v.id}
                        position={{ lat: pos.lat, lng: pos.lng }}
                        title={`${v.registrationNumber} (${v.driverName || v.transporterName})`}
                        onClick={() => {
                          setSelectedRadarLoad(null);
                          setSelectedRadarVehicle(v);
                        }}
                      >
                        <Pin background={bg} borderColor="#171318" glyphColor="#FFFFFF" glyphText="T" />
                      </AdvancedMarker>
                    );
                  })}

                  {loads
                    .filter((l) => l.status !== 'completed' && l.status !== 'cancelled')
                    .map((l) => (
                      <AdvancedMarker
                        key={l.id}
                        position={{ lat: l.pickup.lat, lng: l.pickup.lng }}
                        title={`${l.pickup.city} → ${l.delivery.city}`}
                        onClick={() => {
                          setSelectedRadarVehicle(null);
                          setSelectedRadarLoad(l);
                        }}
                      >
                        <Pin
                          background={l.isBlocked ? '#DC3545' : '#E83E83'}
                          borderColor="#FFFFFF"
                          glyphColor="#FFFFFF"
                          glyphText="L"
                        />
                      </AdvancedMarker>
                    ))}

                  {bookings
                    .filter((b) =>
                      ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)
                    )
                    .map((b) => (
                      <GeofenceOverlay
                        key={`gf_${b.id}`}
                        pickup={b.pickup}
                        delivery={b.delivery}
                        pickupRadiusMeters={b.geofenceConfig?.pickupRadiusMeters || 800}
                        deliveryRadiusMeters={b.geofenceConfig?.deliveryRadiusMeters || 500}
                        insidePickup={b.geofenceState?.insidePickup}
                        insideDelivery={b.geofenceState?.insideDelivery}
                      />
                    ))}

                  {selectedRadarVehicle && (
                    <InfoWindow
                      position={{
                        lat: selectedRadarVehicle.currentLocation?.lat || 26.1445,
                        lng: selectedRadarVehicle.currentLocation?.lng || 91.7362
                      }}
                      onCloseClick={() => setSelectedRadarVehicle(null)}
                    >
                      <div className="p-1.5 text-xs space-y-1.5 max-w-[230px]">
                        <div className="font-mono font-black text-sm text-[#171318]">
                          {selectedRadarVehicle.registrationNumber}
                        </div>
                        <div className="text-gray-600">
                          {selectedRadarVehicle.modelName} • {selectedRadarVehicle.driverName || selectedRadarVehicle.transporterName}
                        </div>
                        <div className="text-gray-500">
                          {selectedRadarVehicle.currentLocation?.address || selectedRadarVehicle.currentLocation?.city}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          {selectedRadarVehicle.isBlocked ? (
                            <button
                              onClick={() => {
                                handleUnblockVehicle(selectedRadarVehicle.id);
                                setSelectedRadarVehicle(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#16A36A] text-white font-bold cursor-pointer"
                            >
                              Unblock Truck
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setPendingBlock({
                                  type: 'vehicle',
                                  id: selectedRadarVehicle.id,
                                  label: selectedRadarVehicle.registrationNumber
                                });
                                setSelectedRadarVehicle(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#DC3545] text-white font-bold cursor-pointer"
                            >
                              Block Truck
                            </button>
                          )}
                        </div>
                      </div>
                    </InfoWindow>
                  )}

                  {selectedRadarLoad && (
                    <InfoWindow
                      position={{ lat: selectedRadarLoad.pickup.lat, lng: selectedRadarLoad.pickup.lng }}
                      onCloseClick={() => setSelectedRadarLoad(null)}
                    >
                      <div className="p-1.5 text-xs space-y-1.5 max-w-[240px]">
                        <div className="font-mono font-bold text-[#E83E83]">#{selectedRadarLoad.id}</div>
                        <div className="font-bold text-[#171318]">
                          {selectedRadarLoad.pickup.city} → {selectedRadarLoad.delivery.city}
                        </div>
                        <div className="text-gray-600 line-clamp-2">{selectedRadarLoad.goodsDescription}</div>
                        <div className="flex items-center gap-1.5 pt-1">
                          {selectedRadarLoad.assignedBookingId && (
                            <button
                              onClick={() => {
                                const b = bookings.find((bk) => bk.id === selectedRadarLoad.assignedBookingId);
                                if (b) setLiveTrackBooking(b);
                                setSelectedRadarLoad(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#171318] text-white font-bold cursor-pointer"
                            >
                              Live Track
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPendingBlock({
                                type: 'load',
                                id: selectedRadarLoad.id,
                                label: `${selectedRadarLoad.pickup.city} → ${selectedRadarLoad.delivery.city}`
                              });
                              setSelectedRadarLoad(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#DC3545] text-white font-bold cursor-pointer"
                          >
                            Block Load
                          </button>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            ) : (
              <LiveTelemetryFallbackMap
                pickup={
                  bookings[0]?.pickup || { lat: 27.4728, lng: 94.912, city: 'Dibrugarh', address: 'Dibrugarh Transport Hub' }
                }
                drop={
                  bookings[0]?.delivery || { lat: 26.1445, lng: 91.7362, city: 'Guwahati', address: 'Guwahati ICD' }
                }
                currentLocation={
                  vehicles.find((v) => v.currentLocation)?.currentLocation || { lat: 26.5821, lng: 93.9632 }
                }
                historyPings={vehicles
                  .filter((v) => v.currentLocation)
                  .map((v) => ({ lat: v.currentLocation!.lat, lng: v.currentLocation!.lng }))}
                vehicleNumber={vehicles[0]?.registrationNumber || 'Fleet Radar'}
                speedKmh={48}
                heading={245}
                reason={mapAuthError ? 'auth_error' : 'missing_key'}
              />
            )}
          </div>

          {/* Active Rides Watchlist */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-[#171318] flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#16A36A]" />
              <span>Active Trips Feed ({liveTripsCount})</span>
            </h3>
            {liveTripsCount === 0 ? (
              <p className="text-xs text-[#77717A] py-4">No active trips currently in motion.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bookings
                  .filter((b) =>
                    ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(b.status)
                  )
                  .map((b) => {
                    const veh = vehicles.find((v) => v.id === b.vehicleId);
                    const drv = users.find((u) => u.id === b.driverId);
                    return (
                      <div key={b.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-[#E83E83] block">#{b.id}</span>
                          <span className="font-bold text-sm text-[#171318] block">
                            {b.pickup?.city} → {b.delivery?.city}
                          </span>
                          <span className="text-[#77717A] block">
                            {veh?.registrationNumber || b.vehicleId} • {veh?.driverName || drv?.name || 'Driver'}
                          </span>
                        </div>
                        <button
                          onClick={() => setLiveTrackBooking(b)}
                          className="px-3.5 py-2 rounded-xl bg-[#171318] hover:bg-black text-white font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Track GPS</span>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Geo-Fence Boundary Crossing & Compliance Feed */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#171318] flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#E83E83]" />
                <span>Geo-Fence Perimeter Alerts ({geofenceEvents.length})</span>
              </h3>
              <span className="text-[11px] text-[#77717A]">Automated Pickup / Delivery Gate Tracking</span>
            </div>
            {geofenceEvents.length === 0 ? (
              <p className="text-xs text-[#77717A] py-3">
                No recent geo-fence perimeter crossings logged yet. Open any active trip&apos;s Live Tracking or Driver Simulator to trigger entry/exit alerts.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {geofenceEvents.slice(0, 8).map((evt) => {
                  const isEnter = evt.transition === 'ENTERED';
                  const isPremature = evt.zoneType === 'delivery' && !isEnter && !evt.autoUpdatedStatus;
                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                        isPremature ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isPremature
                            ? 'bg-rose-600 text-white'
                            : isEnter
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isPremature ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : isEnter ? (
                          <LogIn className="w-3.5 h-3.5" />
                        ) : (
                          <LogOut className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#171318] truncate">{evt.zoneLabel}</span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              isPremature
                                ? 'bg-rose-600 text-white'
                                : isEnter
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {evt.transition}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-0.5">{evt.message}</p>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Booking #{evt.bookingId.slice(-6).toUpperCase()} • {new Date(evt.timestamp).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. LOADS CONTROL */}
      {activeTab === 'loads' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#171318]">All Marketplace Loads ({filteredLoads.length})</h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'open', label: 'Open / Bidding' },
                { id: 'active_ride', label: 'Active Ride' },
                { id: 'completed', label: 'Completed' },
                { id: 'blocked', label: 'Blocked' },
                { id: 'cancelled', label: 'Cancelled' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLoadStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                    loadStatusFilter === f.id
                      ? 'bg-[#171318] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredLoads.map((load) => {
              const bidCount = quotations.filter((q) => q.loadId === load.id).length;
              const linkedBooking = bookings.find((b) => b.id === load.assignedBookingId || b.loadId === load.id);
              return (
                <div
                  key={load.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 ${
                    load.isBlocked || load.status === 'blocked' ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#E83E83]">#{load.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-bold uppercase">
                          {load.pricingMode === 'instant_fixed' ? '⚡ Instant Dispatch' : 'Bidding'}
                        </span>
                        {load.isBlocked && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-[#DC3545] font-bold uppercase">
                            BLOCKED: {load.blockedReason || 'Admin Hold'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-[#171318] mt-0.5">
                        {load.pickup?.city} → {load.delivery?.city} • {load.goodsDescription}
                      </h3>
                      <p className="text-xs text-[#77717A]">
                        Shipper: <span className="font-semibold text-[#171318]">{load.customerCompany || load.customerName}</span> ({load.customerPhone}) • {(load.weightKg / 1000).toFixed(1)} MT • ₹{(load.targetBudgetInr || 0).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase self-start sm:self-auto ${
                      load.isBlocked || load.status === 'blocked'
                        ? 'bg-rose-100 text-[#DC3545]'
                        : load.status === 'completed' || load.status === 'delivered'
                        ? 'bg-emerald-50 text-[#16A36A]'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {load.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
                    <button
                      onClick={() => setInspectLoadBids(load)}
                      className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Bids ({bidCount})</span>
                    </button>

                    {linkedBooking && (
                      <button
                        onClick={() => setLiveTrackBooking(linkedBooking)}
                        className="px-3 py-1.5 rounded-xl bg-[#171318] hover:bg-black text-white font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Live Track</span>
                      </button>
                    )}

                    {load.isBlocked || load.status === 'blocked' ? (
                      <button
                        onClick={() => handleUnblockLoad(load.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#16A36A] hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Unblock Load</span>
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setPendingBlock({
                            type: 'load',
                            id: load.id,
                            label: `${load.pickup?.city} → ${load.delivery?.city} (${load.customerName})`
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC3545] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block Load</span>
                      </button>
                    )}

                    {load.status !== 'completed' && load.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelLoadAdmin(load.id)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                      >
                        Cancel Load
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. BOOKING MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#171318]">Consignment Bookings ({filteredBookings.length})</h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'live', label: 'Live Active' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setBookingStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    bookingStatusFilter === f.id
                      ? 'bg-[#171318] text-white'
                      : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredBookings.map((b) => {
              const veh = vehicles.find((v) => v.id === b.vehicleId);
              const drv = users.find((u) => u.id === b.driverId);
              const shipper = users.find((u) => u.id === b.customerId);
              const selectedStatus = statusOverrides[b.id] || b.status;

              return (
                <div key={b.id} className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#E83E83]">Booking #{b.id}</span>
                      <span className="font-bold text-base text-[#171318] block">
                        {b.pickup?.city || 'Origin'} → {b.delivery?.city || 'Destination'}
                      </span>
                      <span className="text-xs text-[#77717A]">
                        Shipper: {shipper?.businessName || shipper?.name || b.customerId}
                      </span>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-emerald-50 text-[#16A36A] self-start sm:self-auto">
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-gray-50 p-3 rounded-2xl">
                    <div>
                      <span className="text-[#77717A] block">Truck:</span>
                      <span className="font-mono font-bold text-[#171318]">
                        {veh?.registrationNumber || b.vehicleId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Driver:</span>
                      <span className="font-bold text-[#171318]">
                        {veh?.driverName || drv?.name || b.driverId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Total Agreed:</span>
                      <span className="font-bold text-[#16A36A]">
                        ₹{(b.totalAgreedAmountInr || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#77717A] block">Escrow Status:</span>
                      <span className="font-bold text-[#171318] uppercase">{b.paymentStatus.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setLiveTrackBooking(b)}
                        className="px-3.5 py-2 rounded-xl bg-[#171318] hover:bg-black text-white font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Track Live Map</span>
                      </button>
                      <button
                        onClick={() => onViewInvoice(b.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#FFF0F6] text-[#E83E83] hover:bg-[#ffe1ee] font-bold cursor-pointer"
                      >
                        View GST Invoice
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedStatus}
                        onChange={(e) =>
                          setStatusOverrides((prev) => ({
                            ...prev,
                            [b.id]: e.target.value as LoadStatus
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-xl border border-gray-300 text-xs font-semibold bg-white"
                      >
                        {BOOKING_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st.replace('_', ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleApplyBookingOverride(b.id, b.status)}
                        className="px-3 py-1.5 rounded-xl bg-[#E83E83] text-white font-bold hover:bg-[#d62e73] cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Override</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#171318]">All Marketplace Users ({filteredUsers.length})</h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Roles' },
                { id: 'customer', label: 'Shippers' },
                { id: 'driver', label: 'Drivers' },
                { id: 'vehicle_owner', label: 'Owners' },
                { id: 'fleet_partner', label: 'Fleets' },
                { id: 'blocked', label: `Blocked (${blockedUsersCount})` }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoleFilter(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    roleFilter === r.id
                      ? 'bg-[#171318] text-white'
                      : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                    u.isBlocked ? 'bg-rose-50/40' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 ${
                        u.isBlocked ? 'bg-rose-100 text-[#DC3545]' : 'bg-[#FFF0F6] text-[#E83E83]'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-[#171318]">{u.name}</span>
                        {u.isVerified && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-[#16A36A] font-bold">
                            Verified
                          </span>
                        )}
                        {u.isBlocked && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-[#DC3545] font-bold">
                            BLOCKED: {u.blockedReason || 'Suspended'}
                          </span>
                        )}
                      </div>
                      <span className="text-[#77717A] block">
                        {u.phone || 'No phone'} • {u.email || 'No email'} {u.city ? `• ${u.city}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="font-bold uppercase text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-[#171318]">
                      {u.role.replace('_', ' ')}
                    </span>

                    {u.role !== 'admin' && (
                      u.isBlocked ? (
                        <button
                          onClick={() => handleUnblockUser(u.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#16A36A] hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => setPendingBlock({ type: 'user', id: u.id, label: `${u.name} (${u.phone})` })}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC3545] font-bold cursor-pointer flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. SHIPPER MANAGEMENT */}
      {activeTab === 'shippers' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#171318]">Registered Shippers ({filteredShippers.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredShippers.map((s) => {
              const shipperLoads = loads.filter((l) => l.customerId === s.id);
              const shipperSpend = bookings
                .filter((b) => b.customerId === s.id && b.status !== 'cancelled')
                .reduce((sum, b) => sum + (b.totalAgreedAmountInr || 0), 0);
              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 ${
                    s.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-base text-[#171318] block">{s.businessName || s.name}</span>
                      <span className="text-xs text-[#77717A]">Contact: {s.name} ({s.phone})</span>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        s.isBlocked ? 'bg-rose-100 text-[#DC3545]' : 'bg-emerald-50 text-[#16A36A]'
                      }`}
                    >
                      {s.isBlocked ? 'Blocked' : s.isVerified ? 'KYC Verified' : 'Active'}
                    </span>
                  </div>

                  <div className="text-xs text-[#77717A] bg-gray-50 p-3 rounded-2xl flex flex-wrap justify-between gap-2">
                    <span>
                      GSTIN: <span className="font-mono font-bold text-[#171318]">{s.gstin || 'Unregistered'}</span>
                    </span>
                    <span>
                      Loads: <span className="font-bold text-[#171318]">{shipperLoads.length}</span> • Spend:{' '}
                      <span className="font-bold text-[#16A36A]">₹{shipperSpend.toLocaleString('en-IN')}</span>
                    </span>
                  </div>

                  <div className="flex justify-end">
                    {s.isBlocked ? (
                      <button
                        onClick={() => handleUnblockUser(s.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#16A36A] text-white text-xs font-bold cursor-pointer"
                      >
                        Unblock Shipper
                      </button>
                    ) : (
                      <button
                        onClick={() => setPendingBlock({ type: 'user', id: s.id, label: s.businessName || s.name })}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC3545] text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block Shipper</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. VEHICLE MANAGEMENT */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#171318]">Commercial Vehicles ({filteredVehicles.length})</h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'online', label: 'Online' },
                { id: 'pending', label: 'Unverified' },
                { id: 'blocked', label: `Blocked (${blockedVehiclesCount})` }
              ].map((vf) => (
                <button
                  key={vf.id}
                  onClick={() => setVehicleFilter(vf.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    vehicleFilter === vf.id ? 'bg-[#171318] text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((v) => (
              <div
                key={v.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 ${
                  v.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-extrabold text-[#171318] block">{v.registrationNumber}</span>
                    <span className="text-xs text-[#77717A]">{v.modelName}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      v.isBlocked
                        ? 'bg-rose-100 text-[#DC3545]'
                        : v.verificationStatus === 'verified'
                        ? 'bg-emerald-50 text-[#16A36A]'
                        : 'bg-amber-50 text-[#E9A23B]'
                    }`}
                  >
                    {v.isBlocked ? 'Blocked' : v.verificationStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-[#77717A]">
                    <span>Driver / Operator:</span>
                    <span className="font-bold text-[#171318]">{v.driverName || v.transporterName}</span>
                  </div>
                  <div className="flex justify-between text-[#77717A]">
                    <span>Capacity:</span>
                    <span className="font-bold text-[#171318]">{v.capacityKg ? (v.capacityKg / 1000).toFixed(1) : '3.5'} MT</span>
                  </div>
                  <div className="flex justify-between text-[#77717A]">
                    <span>GPS Status:</span>
                    <span className={`font-bold ${v.isOnline ? 'text-[#16A36A]' : 'text-gray-500'}`}>
                      {v.isOnline ? 'Online' : 'Offline'} • {v.currentLocation?.city || 'Assam'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  {v.verificationStatus !== 'verified' && (
                    <>
                      <button
                        onClick={() => handleApproveVehicle(v.id)}
                        className="flex-1 py-1.5 bg-[#16A36A] text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectVehicle(v.id)}
                        className="flex-1 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {v.isOnline && !v.isBlocked && (
                    <button
                      onClick={() => handleForceVehicleOffline(v.id)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Force Offline
                    </button>
                  )}

                  {v.isBlocked ? (
                    <button
                      onClick={() => handleUnblockVehicle(v.id)}
                      className="flex-1 py-1.5 bg-[#16A36A] text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      onClick={() => setPendingBlock({ type: 'vehicle', id: v.id, label: v.registrationNumber })}
                      className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#DC3545] text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Block Vehicle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. DRIVER MANAGEMENT */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#171318]">Commercial Drivers & Owners ({filteredDrivers.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDrivers.map((d) => {
              const app = partnerApps.find((a) => a.userId === d.id);
              const driverVehicles = vehicles.filter((v) => v.ownerId === d.id || v.assignedDriverId === d.id);
              const dlDisplay =
                (d as unknown as { drivingLicenseNumber?: string }).drivingLicenseNumber ||
                app?.documents.find((doc) => doc.category === 'dl')?.documentNumber ||
                `${d.city || 'Assam'} • Verified Partner`;

              return (
                <div
                  key={d.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 ${
                    d.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-base text-[#171318] block">{d.name}</span>
                      <span className="text-xs text-[#77717A] flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {d.phone} • {d.role.replace('_', ' ')}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        d.isBlocked ? 'bg-rose-100 text-[#DC3545]' : 'bg-emerald-50 text-[#16A36A]'
                      }`}
                    >
                      {d.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                  </div>

                  <div className="text-xs bg-gray-50 p-3 rounded-2xl space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#77717A]">DL / KYC Ref:</span>
                      <span className="font-mono font-bold text-[#171318]">{dlDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#77717A]">Registered Trucks:</span>
                      <span className="font-bold text-[#171318]">
                        {driverVehicles.length > 0
                          ? driverVehicles.map((v) => v.registrationNumber).join(', ')
                          : 'Auto-assigned on ride'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    {d.isBlocked ? (
                      <button
                        onClick={() => handleUnblockUser(d.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#16A36A] text-white text-xs font-bold cursor-pointer"
                      >
                        Unblock Driver
                      </button>
                    ) : (
                      <button
                        onClick={() => setPendingBlock({ type: 'user', id: d.id, label: d.name })}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC3545] text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block Driver</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9. FLEET MANAGEMENT */}
      {activeTab === 'fleets' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[#171318]">Fleet Operators ({filteredFleets.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFleets.map((f) => {
              const fleetVehicles = vehicles.filter(
                (v) => v.ownerId === f.id || (f.businessName && v.transporterName === f.businessName)
              );
              const fleetEarnings = bookings
                .filter((b) => (b.transporterId === f.id || b.driverId === f.id) && b.status !== 'cancelled')
                .reduce((sum, b) => sum + (b.totalAgreedAmountInr || 0), 0);

              return (
                <div
                  key={f.id}
                  className={`bg-white rounded-3xl p-5 border shadow-sm space-y-3 ${
                    f.isBlocked ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-base text-[#171318] block">{f.businessName || f.name}</span>
                      <span className="text-xs text-[#77717A]">Operator: {f.name} ({f.phone})</span>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        f.isBlocked ? 'bg-rose-100 text-[#DC3545]' : 'bg-[#FFF0F6] text-[#E83E83]'
                      }`}
                    >
                      {f.isBlocked ? 'Blocked' : 'Fleet Partner'}
                    </span>
                  </div>

                  <div className="text-xs bg-gray-50 p-3 rounded-2xl flex justify-between">
                    <span className="text-[#77717A]">
                      Fleet Size: <span className="font-bold text-[#171318]">{fleetVehicles.length} Trucks</span>
                    </span>
                    <span className="text-[#77717A]">
                      GMV: <span className="font-bold text-[#16A36A]">₹{fleetEarnings.toLocaleString('en-IN')}</span>
                    </span>
                  </div>

                  <div className="flex justify-end">
                    {f.isBlocked ? (
                      <button
                        onClick={() => handleUnblockUser(f.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#16A36A] text-white text-xs font-bold cursor-pointer"
                      >
                        Unblock Fleet
                      </button>
                    ) : (
                      <button
                        onClick={() => setPendingBlock({ type: 'user', id: f.id, label: f.businessName || f.name })}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#DC3545] text-xs font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Block Fleet</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 10. PAYMENTS & ESCROW */}
      {activeTab === 'payments' && <AdminPaymentsTab />}

      {/* 11. COMPLAINTS & DISPUTES */}
      {activeTab === 'disputes' && <AdminSupportDesk currentUser={currentUser} />}

      {/* 12. DOCUMENT VERIFICATION */}
      {activeTab === 'verification' && <AdminPartnerVerificationTab currentUser={currentUser} />}

      {/* 13. REPORTS & ANALYTICS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-[#171318]">Interstate Freight Master Dispatch Reports</h3>
                <p className="text-xs text-[#77717A]">Real-time computed operational & GST settlement metrics</p>
              </div>
              <button
                onClick={() => {
                  exportAdminMasterReportCsv(bookings, loads);
                  showToast('Master CSV Report downloaded.');
                }}
                className="px-4 py-2.5 bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Download className="w-4 h-4" />
                <span>Export Master CSV ({bookings.length} Trips)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-4 bg-gray-50 rounded-2xl text-center space-y-1">
                <span className="text-xs text-[#77717A]">Trips Completed</span>
                <span className="text-2xl font-black text-[#171318] block">
                  {analyticsMetrics.completedCount} Trips
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl text-center space-y-1">
                <span className="text-xs text-[#77717A]">Total Tonnage Dispatched</span>
                <span className="text-2xl font-black text-[#16A36A] block">
                  {analyticsMetrics.totalTonnageMT} MT
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl text-center space-y-1">
                <span className="text-xs text-[#77717A]">Completion Rate</span>
                <span className="text-2xl font-black text-[#E83E83] block">
                  {analyticsMetrics.fulfillmentRate}%
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl text-center space-y-1">
                <span className="text-xs text-[#77717A]">Net Commission Earned</span>
                <span className="text-2xl font-black text-[#171318] block">
                  ₹{platformRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <AdminAnalyticsCharts
            bookings={bookings}
            loads={loads}
            vehicles={vehicles}
          />
        </div>
      )}
    </div>
  );
};
