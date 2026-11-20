import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Power, 
  MapPin, 
  Phone, 
  Navigation, 
  CheckCircle2, 
  AlertCircle, 
  LifeBuoy, 
  IndianRupee, 
  History, 
  Clock, 
  Package, 
  ShieldCheck, 
  ChevronRight, 
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Radio,
  Zap
} from 'lucide-react';
import { Booking, CommercialVehicle, LoadItem, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { showToast } from '../shared/Toast';
import { PartnerOnboardingModal } from '../partner/PartnerOnboardingModal';
import { NortheastHighwayAlerts } from './NortheastHighwayAlerts';

interface DriverHomeProps {
  currentUser: User;
  onNavigateToFindLoads: () => void;
  onNavigateToTrip: (bookingId: string) => void;
  onNavigateToFleet: () => void;
  onNavigateToEarnings: () => void;
  onNavigateToTripHistory: () => void;
  onOpenSupport?: (loadId?: string) => void;
}

export const DriverHome: React.FC<DriverHomeProps> = ({
  currentUser,
  onNavigateToFindLoads,
  onNavigateToTrip,
  onNavigateToFleet,
  onNavigateToEarnings,
  onNavigateToTripHistory,
  onOpenSupport
}) => {
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | undefined>(undefined);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [openLoads, setOpenLoads] = useState<LoadItem[]>([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [partnerEligibility, setPartnerEligibility] = useState(() => 
    logisticsStore.checkPartnerBookingEligibility(currentUser.id)
  );
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Active section for the driver tabs: 'trips' | 'pickup' | 'navigation' | 'status' | 'support' | 'highway_alerts'
  const [activeDriverTab, setActiveDriverTab] = useState<'trips' | 'pickup' | 'navigation' | 'status' | 'support' | 'highway_alerts'>('trips');

  useEffect(() => {
    const update = () => {
      setPartnerEligibility(logisticsStore.checkPartnerBookingEligibility(currentUser.id));
      const allVehicles = logisticsStore.getVehicles().filter((v) => !v.isBlocked);
      const myVehicles = allVehicles.filter(
        (v) => v.ownerId === currentUser.id || v.assignedDriverId === currentUser.id
      );
      setVehicles(myVehicles);

      const myVehicleIds = new Set(myVehicles.map((v) => v.id));
      const allBookings = logisticsStore.getBookings();
      const myBookings = allBookings.filter(
        (b) =>
          b.driverId === currentUser.id ||
          b.transporterId === currentUser.id ||
          myVehicleIds.has(b.vehicleId) ||
          (currentUser.isTestAccount && b.isTestBooking)
      );
      setDriverBookings(myBookings);

      const active = myBookings.find(
        (b) => b.status !== 'completed' && b.status !== 'cancelled'
      );
      setActiveBooking(active);

      const availableLoads = logisticsStore
        .getLoads()
        .filter((l) => (l.status === 'posted' || l.status === 'bidding') && !l.isBlocked);
      setOpenLoads(availableLoads);
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id, currentUser.isTestAccount]);

  const primaryVehicle = vehicles[0];
  const isOnline = primaryVehicle?.isOnline ?? false;

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleToggleOnline = () => {
    if (primaryVehicle) {
      if (primaryVehicle.isBlocked) {
        showToast(`Vehicle blocked: ${primaryVehicle.blockedReason || 'Contact Admin'}`, 'error');
        return;
      }
      logisticsStore.toggleVehicleOnline(primaryVehicle.id, !isOnline);
      showNotification(isOnline ? 'You are now Offline' : 'You are now Online and ready for loads!');
    }
  };

  const handleInstantAccept = (loadId: string) => {
    const res = logisticsStore.instantAcceptLoad(loadId, currentUser, primaryVehicle?.id);
    if (!res.success || !res.bookingId) {
      showToast(res.message || 'Could not start ride.', 'error');
      return;
    }
    showToast(res.message, 'success');
    onNavigateToTrip(res.bookingId);
  };

  const handleUpdateTripStatus = (newStatus: 'assigned' | 'at_pickup' | 'in_transit' | 'at_destination' | 'completed') => {
    if (!activeBooking) return;
    if (newStatus === 'completed') {
      onNavigateToTrip(activeBooking.id);
      return;
    }
    logisticsStore.updateBookingMilestone(activeBooking.id, newStatus as any);
    showNotification(`Status updated to: ${newStatus.replace('_', ' ').toUpperCase()}`);
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {feedbackMsg && (
        <div className="fixed top-18 right-4 z-50 bg-[#16A36A] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{feedbackMsg}</span>
        </div>
      )}

      {/* DRIVER STATUS HERO CARD - Premium Pink & Black */}
      <div className="bg-[#171318] text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleOnline}
              disabled={!primaryVehicle}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition shadow-lg cursor-pointer ${
                !primaryVehicle
                  ? 'bg-gray-800 text-gray-500'
                  : isOnline
                  ? 'bg-[#16A36A] text-white shadow-[#16A36A]/30'
                  : 'bg-[#E83E83] text-white shadow-[#E83E83]/30'
              }`}
              title="Toggle Online/Offline"
            >
              <Power className="w-7 h-7" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">
                  {isOnline ? 'Ready for Loads' : 'Offline / On Break'}
                </span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  isOnline 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-rose-500/20 text-[#E83E83] border border-[#E83E83]/30'
                }`}>
                  {isOnline ? 'Online' : 'Paused'}
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Truck: <span className="font-mono font-bold text-white">{primaryVehicle?.registrationNumber || 'No Vehicle Linked'}</span>
                {primaryVehicle?.modelName ? ` (${primaryVehicle.modelName})` : ''}
              </p>
            </div>
          </div>

          {/* Quick Driver Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onNavigateToTripHistory}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>Trip History</span>
            </button>

            <button
              onClick={onNavigateToEarnings}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-[#FFF0F6] text-[#E83E83] hover:bg-[#ffe2ee] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <IndianRupee className="w-4 h-4" />
              <span>My Earnings</span>
            </button>
          </div>
        </div>

        {/* DRIVER DASHBOARD 6 SECTIONS NAVIGATION TABS */}
        <div className="mt-6 pt-5 border-t border-gray-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveDriverTab('trips')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'trips'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>1. My Assigned Trips</span>
          </button>

          <button
            onClick={() => setActiveDriverTab('pickup')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'pickup'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>2. Pickup Details</span>
          </button>

          <button
            onClick={() => setActiveDriverTab('navigation')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'navigation'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>3. Navigation</span>
          </button>

          <button
            onClick={() => setActiveDriverTab('status')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'status'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>4. Update Trip Status</span>
          </button>

          <button
            onClick={() => setActiveDriverTab('support')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'support'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            <span>5. Contact Support</span>
          </button>

          <button
            onClick={() => setActiveDriverTab('highway_alerts')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeDriverTab === 'highway_alerts'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-[#E83E83]" />
            <span>6. Highway Traffic & Alerts</span>
            <span className="w-2 h-2 rounded-full bg-[#E83E83] animate-pulse" />
          </button>
        </div>
      </div>

      {/* SECTION 1: MY ASSIGNED TRIPS */}
      {activeDriverTab === 'trips' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">My Assigned Trips</h2>
              <p className="text-xs text-[#77717A]">Active and upcoming freight trips assigned to your truck</p>
            </div>
            <button
              onClick={onNavigateToFindLoads}
              className="px-4 py-2.5 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Find More Loads</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {activeBooking ? (
            <div className="bg-white rounded-3xl p-6 border-2 border-[#E83E83]/20 shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-[#E83E83] bg-[#FFF0F6] px-2.5 py-1 rounded-md">
                      ACTIVE TRIP #{activeBooking.id}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase bg-amber-50 text-[#E9A23B] border border-amber-200">
                      {activeBooking.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-[#171318] mt-2">
                    {activeBooking.pickup?.city || 'Dibrugarh'} → {activeBooking.delivery?.city || 'Guwahati'}
                  </h3>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-[#77717A] block font-medium">Your Freight Payout</span>
                  <span className="text-2xl font-black text-[#16A36A]">
                    ₹{(activeBooking.netDriverPayableInr || 24225).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-[#77717A] block">5% platform fee deducted</span>
                </div>
              </div>

              {/* Cargo info */}
              <div className="bg-gray-50 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[#77717A] block">Goods Description:</span>
                    <span className="font-bold text-[#171318] text-sm">{activeBooking.goodsDescription}</span>
                  </div>
                  <span className="bg-[#FFF0F6] text-[#E83E83] font-bold px-2.5 py-1 rounded-lg">
                    {(activeBooking.weightKg ? (activeBooking.weightKg / 1000).toFixed(1) : '3.5')} MT
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => setActiveDriverTab('pickup')}
                  className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[#E83E83]" />
                  <span>View Pickup Details</span>
                </button>

                <button
                  onClick={() => setActiveDriverTab('navigation')}
                  className="py-3 px-4 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-[#E83E83]" />
                  <span>Start Navigation</span>
                </button>

                <button
                  onClick={() => onNavigateToTrip(activeBooking.id)}
                  className="py-3 px-4 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Open Full Trip Mode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-gray-200 text-center space-y-3">
              <Truck className="w-12 h-12 text-[#E83E83] mx-auto" />
              <h3 className="font-bold text-base text-[#171318]">No Active Trip Right Now</h3>
              <p className="text-xs text-[#77717A] max-w-md mx-auto">
                You are currently idle. Check available loads from tea gardens, FMCG, and agricultural merchants in Assam.
              </p>
              <button
                onClick={onNavigateToFindLoads}
                className="px-6 py-3 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition cursor-pointer"
              >
                Browse Available Loads
              </button>
            </div>
          )}

          {/* RAPIDO / UBER STYLE INSTANT RIDE RADAR ON DRIVER HOME */}
          {!activeBooking && openLoads.length > 0 && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Live Instant Dispatch Radar</span>
                  </span>
                  <h3 className="text-base font-black text-[#171318]">Ready-to-Accept Loads ({openLoads.length})</h3>
                </div>
                <button
                  onClick={onNavigateToFindLoads}
                  className="text-xs font-bold text-[#E83E83] hover:underline cursor-pointer"
                >
                  View All →
                </button>
              </div>

              <div className="space-y-3">
                {openLoads.slice(0, 3).map((load) => (
                  <div
                    key={load.id}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#171318]">
                          {load.pickup.city} → {load.delivery.city}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600 font-bold">
                          {load.estimatedDistanceKm} km
                        </span>
                      </div>
                      <p className="text-xs text-[#77717A]">
                        {load.goodsDescription} • {(load.weightKg / 1000).toFixed(1)} MT • {load.requiredVehicleCategory.replace('_', ' ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-[#77717A] block">Est. Fare</span>
                        <span className="text-sm font-black text-[#16A36A] font-mono">
                          ₹{(load.targetBudgetInr || Math.round(load.estimatedDistanceKm * 34)).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleInstantAccept(load.id)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Accept & Start Ride</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REAL-TIME HIGHWAY TRAFFIC & ROAD CLOSURE ALERTS ON DRIVER HOME SCREEN */}
          <div className="pt-2">
            <NortheastHighwayAlerts
              activeBooking={activeBooking}
              onOpenSupport={onOpenSupport}
            />
          </div>
        </div>
      )}

      {/* SECTION 2: PICKUP DETAILS */}
      {activeDriverTab === 'pickup' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#171318]">Consignment Pickup Details</h2>
            <button
              onClick={() => setActiveDriverTab('trips')}
              className="text-xs text-[#E83E83] font-bold hover:underline"
            >
              ← Back to Trips
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Pickup Hub & Address</span>
              <div className="flex items-start gap-3 bg-[#FFF0F6] p-4 rounded-2xl">
                <MapPin className="w-5 h-5 text-[#E83E83] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-extrabold text-base text-[#171318]">
                    {activeBooking?.pickup?.city ? `${activeBooking.pickup.city} Logistics Terminal` : 'Dibrugarh Tea Logistics Terminal'}
                  </h3>
                  <p className="text-xs text-[#77717A] mt-1">
                    {activeBooking?.pickup?.address || 'Plot 14-B, Industrial Estate, Jalan Tea Road, Dibrugarh, Assam - 786001'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-[#77717A] block">Sender Contact</span>
                <span className="font-bold text-sm text-[#171318] block">
                  {activeBooking?.pickup?.contactName || 'Shipper Consignor'}
                </span>
                <a
                  href={`tel:${(activeBooking?.pickup?.contactPhone || '9678944132').replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A36A] text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Sender: {activeBooking?.pickup?.contactPhone || 'On File'}</span>
                </a>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-[#77717A] block">Cargo & Consignment Instructions</span>
                <p className="text-xs text-[#171318] leading-relaxed">
                  {activeBooking?.goodsDescription || 'Verify seal, loading weight and tarpaulin cover before departure.'}
                  {activeBooking?.eWayBillNumber ? (
                    <> • e-Way Bill: <span className="font-mono font-bold text-[#E83E83]">{activeBooking.eWayBillNumber}</span></>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => handleUpdateTripStatus('at_pickup')}
                className="flex-1 py-3 bg-[#171318] hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Mark "Arrived at Pickup"
              </button>
              <button
                onClick={() => handleUpdateTripStatus('in_transit')}
                className="flex-1 py-3 bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                Confirm Loaded & Start Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NAVIGATION */}
      {activeDriverTab === 'navigation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Route Navigation & GPS</h2>
              <p className="text-xs text-[#77717A]">Turn-by-turn route directions for commercial vehicles</p>
            </div>
            <button
              onClick={() => setActiveDriverTab('trips')}
              className="text-xs text-[#E83E83] font-bold hover:underline"
            >
              ← Back to Trips
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFF0F6] p-4 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-[#E83E83] uppercase block">Current Destination</span>
                <h3 className="font-extrabold text-base text-[#171318]">
                  {activeBooking?.delivery?.address || `${activeBooking?.delivery?.city || 'Guwahati'} Unloading Depot`}
                </h3>
                <p className="text-xs text-[#77717A]">
                  {activeBooking?.pickup?.city || 'Origin'} → {activeBooking?.delivery?.city || 'Destination'} • {activeBooking?.delivery?.state || 'Assam'}
                </p>
              </div>

              <a
                href={
                  activeBooking?.delivery?.lat && activeBooking?.delivery?.lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${activeBooking.delivery.lat},${activeBooking.delivery.lng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeBooking?.delivery?.city || 'Guwahati')}`
                }
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 bg-[#171318] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
              >
                <Navigation className="w-4 h-4 text-[#E83E83]" />
                <span>Open Google Maps App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 p-4 rounded-2xl">
                <span className="text-xs text-[#77717A] block">Speed Limit</span>
                <span className="font-extrabold text-lg text-[#171318]">60 km/h</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <span className="text-xs text-[#77717A] block">Toll Plazas</span>
                <span className="font-extrabold text-lg text-[#171318]">FASTag Auto</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl">
                <span className="text-xs text-[#77717A] block">GPS Ping</span>
                <span className="font-extrabold text-lg text-[#16A36A]">Active (Live)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: UPDATE PICKUP & DELIVERY STATUS */}
      {activeDriverTab === 'status' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Update Trip Progress</h2>
              <p className="text-xs text-[#77717A]">Tap each step when you complete it to update customer and trigger escrow release</p>
            </div>
            <button
              onClick={() => setActiveDriverTab('trips')}
              className="text-xs text-[#E83E83] font-bold hover:underline"
            >
              ← Back to Trips
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Step 1: Arrived at Pickup */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#E83E83]">STEP 1</span>
                <Clock className="w-4 h-4 text-[#77717A]" />
              </div>
              <h3 className="font-bold text-base text-[#171318]">Arrived at Pickup Location</h3>
              <p className="text-xs text-[#77717A]">
                Notify the shipper that your truck has arrived at the warehouse or loading dock.
              </p>
              <button
                onClick={() => handleUpdateTripStatus('at_pickup')}
                className="w-full py-3 bg-[#171318] hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Confirm Arrival at Pickup
              </button>
            </div>

            {/* Step 2: Loaded & Departed */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#E83E83]">STEP 2</span>
                <Truck className="w-4 h-4 text-[#77717A]" />
              </div>
              <h3 className="font-bold text-base text-[#171318]">Goods Loaded (In Transit)</h3>
              <p className="text-xs text-[#77717A]">
                Start your delivery journey. Satellite GPS tracking will be shared with the shipper.
              </p>
              <button
                onClick={() => handleUpdateTripStatus('in_transit')}
                className="w-full py-3 bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                Goods Loaded & Departed
              </button>
            </div>

            {/* Step 3: Arrived at Destination */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#E83E83]">STEP 3</span>
                <MapPin className="w-4 h-4 text-[#77717A]" />
              </div>
              <h3 className="font-bold text-base text-[#171318]">Arrived at Destination</h3>
              <p className="text-xs text-[#77717A]">
                Your vehicle has reached the receiver's unloading bay or storehouse.
              </p>
              <button
                onClick={() => handleUpdateTripStatus('at_destination')}
                className="w-full py-3 bg-[#171318] hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Arrived at Destination
              </button>
            </div>

            {/* Step 4: Delivered & Settle Escrow */}
            <div className="bg-white rounded-3xl p-5 border-2 border-emerald-500/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#16A36A]">STEP 4 (FINAL)</span>
                <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
              </div>
              <h3 className="font-bold text-base text-[#171318]">Delivery Completed (POD)</h3>
              <p className="text-xs text-[#77717A]">
                Unloading completed and receiver signed. Releases ₹{(activeBooking?.netDriverPayableInr || 24225).toLocaleString('en-IN')} payout into your bank.
              </p>
              <button
                onClick={() => handleUpdateTripStatus('completed')}
                className="w-full py-3 bg-[#16A36A] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                Confirm Delivered & Get Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: CONTACT SUPPORT */}
      {activeDriverTab === 'support' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">24/7 Driver Support & Emergency SOS</h2>
              <p className="text-xs text-[#77717A]">Direct connection to Zuggi operations team</p>
            </div>
            <button
              onClick={() => setActiveDriverTab('trips')}
              className="text-xs text-[#E83E83] font-bold hover:underline"
            >
              ← Back to Trips
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-rose-200 bg-rose-50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#DC3545]">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-black text-sm">Emergency Roadside Assistance</span>
                </div>
                <p className="text-xs text-gray-700">
                  Accident, breakdown, tyre puncture or police/toll dispute on highway.
                </p>
                <a
                  href="tel:18002008899"
                  className="w-full py-3 bg-[#DC3545] hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Emergency Helpline: 1800-200-8899</span>
                </a>
              </div>

              <div className="border border-gray-200 bg-gray-50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#171318]">
                  <LifeBuoy className="w-5 h-5 text-[#E83E83]" />
                  <span className="font-black text-sm">Operations & Payment Desk</span>
                </div>
                <p className="text-xs text-gray-700">
                  Questions regarding escrow disbursement, POD verification, or customer contact.
                </p>
                <button
                  onClick={() => onOpenSupport && onOpenSupport(activeBooking?.id)}
                  className="w-full py-3 bg-[#171318] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-[#E83E83]" />
                  <span>Open Support Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: HIGHWAY TRAFFIC & ROAD CLOSURE ALERTS (DEDICATED FULL VIEW) */}
      {activeDriverTab === 'highway_alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Highway Traffic & Road Closures</h2>
              <p className="text-xs text-[#77717A]">
                Real-time road conditions, animal corridor restrictions, and toll delays across Northeast India
              </p>
            </div>
            <button
              onClick={() => setActiveDriverTab('trips')}
              className="text-xs text-[#E83E83] font-bold hover:underline cursor-pointer"
            >
              ← Back to My Trips
            </button>
          </div>

          <NortheastHighwayAlerts
            activeBooking={activeBooking}
            onOpenSupport={onOpenSupport}
          />
        </div>
      )}

      {/* KYC / Onboarding Modal if needed */}
      {isOnboardingOpen && (
        <PartnerOnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
