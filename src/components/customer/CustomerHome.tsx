import React, { useState, useEffect, useMemo } from 'react';
import { 
  PackagePlus, 
  Search, 
  MapPin, 
  Truck, 
  Clock, 
  IndianRupee, 
  FileText, 
  ChevronRight, 
  Radio, 
  ShieldCheck, 
  ArrowUpRight,
  Calculator,
  Compass,
  FileSpreadsheet,
  LifeBuoy,
  MessageSquare,
  CheckCircle2,
  Navigation,
  Eye,
  Filter,
  CreditCard,
  History,
  Phone
} from 'lucide-react';
import { LoadItem, User, Booking, CommercialVehicle } from '../../types';
import { logisticsStore } from '../../services/store';
import { exportCustomerBookingsToCsv } from '../../utils/csvExport';
import { ShipperLiveTracker } from '../tracking/ShipperLiveTracker';
import { DriverGpsSimulatorModal } from '../tracking/DriverGpsSimulatorModal';
import { LocationAutocompleteInput, SelectedPlace } from '../shared/LocationAutocompleteInput';
import { CashfreeEscrowModal } from '../payments/CashfreeEscrowModal';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal';

interface CustomerHomeProps {
  currentUser: User;
  onCreateLoadClick: () => void;
  onSelectLoad: (loadId: string) => void;
  onViewInvoice: (bookingId: string) => void;
  onOpenSupport?: (loadId?: string) => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({
  currentUser,
  onCreateLoadClick,
  onSelectLoad,
  onViewInvoice,
  onOpenSupport
}) => {
  // Tabs: 'overview' | 'my_loads' | 'find_vehicles' | 'track' | 'history' | 'payments'
  const [activeTab, setActiveTab] = useState<'overview' | 'my_loads' | 'find_vehicles' | 'track' | 'history' | 'payments'>('overview');

  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<CommercialVehicle[]>([]);
  const vehicleCategories = useMemo(() => logisticsStore.getVehicleCategories(), []);

  // Quick estimator state — supports ANY area, town, city, or pincode across the state & India
  const [calcFrom, setCalcFrom] = useState('');
  const [calcFromCoords, setCalcFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [calcTo, setCalcTo] = useState('');
  const [calcToCoords, setCalcToCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [calcVehicle, setCalcVehicle] = useState(vehicleCategories[1]?.id || 'bolero_pickup');

  // Live Tracking and Simulator state
  const [selectedTrackTripId, setSelectedTrackTripId] = useState<string>('trip_demo_01');
  const [showDriverSimulator, setShowDriverSimulator] = useState<boolean>(false);
  const [simulatorTripId, setSimulatorTripId] = useState<string>('trip_demo_01');
  const [simulatorToken, setSimulatorToken] = useState<string>('');
  const [paymentModalTarget, setPaymentModalTarget] = useState<{
    booking: Booking;
    stage: 'advance_90' | 'balance_10';
  } | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const allLoads = logisticsStore.getLoads();
      const allBookings = logisticsStore.getBookings();
      setLoads(
        allLoads.filter(
          (l) =>
            l.customerId === currentUser.id ||
            (currentUser.isTestAccount && (l.isTestLoad || l.customerId === 'user_cust_01'))
        )
      );
      setBookings(
        allBookings.filter(
          (b) =>
            b.customerId === currentUser.id ||
            (currentUser.isTestAccount && (b.isTestBooking || b.customerId === 'user_cust_01'))
        )
      );
      setVehicles(logisticsStore.getVehicles().filter((v) => !v.isBlocked));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [currentUser.id, currentUser.isTestAccount]);

  useEffect(() => {
    const activeAssigned = loads.find(
      (l) =>
        l.assignedBookingId &&
        ['assigned', 'en_route_pickup', 'at_pickup', 'loading', 'in_transit', 'at_destination'].includes(l.status)
    );
    if (activeAssigned?.assignedBookingId && selectedTrackTripId === 'trip_demo_01') {
      setSelectedTrackTripId(activeAssigned.assignedBookingId);
    }
  }, [loads, selectedTrackTripId]);

  // Active in-transit or matched shipment (Rapido/Uber live ride banner)
  const activeShipment = loads.find(
    (l) =>
      l.status === 'assigned' ||
      l.status === 'en_route_pickup' ||
      l.status === 'at_pickup' ||
      l.status === 'loading' ||
      l.status === 'in_transit' ||
      l.status === 'at_destination'
  );

  const financialStats = useMemo(() => {
    const validBookings = bookings.filter((b) => b.status !== 'cancelled');
    const completedBookings = validBookings.filter((b) => b.status === 'completed' || b.status === 'delivered');
    const totalSpend = validBookings.reduce((sum, b) => sum + (Number(b.totalAgreedAmountInr) || 0), 0);
    const totalPaid = validBookings.reduce((sum, b) => {
      const total = Number(b.totalAgreedAmountInr) || 0;
      let paid = 0;
      if (b.paymentAdvanceStatus === 'paid') {
        paid += Number(b.customerAdvanceAmountInr) || Math.round(total * 0.90);
      }
      if (b.paymentBalanceStatus === 'paid') {
        paid += Number(b.customerBalanceAmountInr) || Math.round(total * 0.10);
      }
      return sum + paid;
    }, 0);
    const totalDue = Math.max(0, totalSpend - totalPaid);
    return {
      totalSpend,
      totalPaid,
      totalDue,
      completedCount: completedBookings.length
    };
  }, [bookings]);

  // Quick instant estimate computation from real selected coordinates
  const quickEst = useMemo(() => {
    if (!calcFromCoords || !calcToCoords) return null;
    return logisticsStore.calculateEstimatedFreight(
      calcFromCoords.lat,
      calcFromCoords.lng,
      calcToCoords.lat,
      calcToCoords.lng,
      calcVehicle
    );
  }, [calcFromCoords, calcToCoords, calcVehicle]);

  const handleExportBookingsCsv = () => {
    exportCustomerBookingsToCsv(loads, bookings);
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* SHIPPER HERO BANNER - Pink + Black */}
      <div className="bg-[#171318] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0F6] text-[#E83E83] text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Commercial Logistics Marketplace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Move Commercial Goods with Verified Fleets
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-xl">
              Connect directly with verified truck owners across Assam & Northeast. Get instant freight bids and satellite GPS live tracking.
            </p>
          </div>

          <button
            onClick={onCreateLoadClick}
            className="w-full sm:w-auto px-6 py-3.5 bg-[#E83E83] hover:bg-[#d62e73] text-white text-sm font-black rounded-2xl shadow-lg shadow-[#E83E83]/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <PackagePlus className="w-5 h-5" />
            <span>+ Post a Load Now</span>
          </button>
        </div>

        {/* SHIPPER 6 NAVIGATION TABS */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Dashboard Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('my_loads')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'my_loads'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Loads ({loads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('find_vehicles')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'find_vehicles'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Find Vehicles ({vehicles.filter(v => v.isOnline).length} Online)</span>
          </button>

          <button
            onClick={() => setActiveTab('track')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'track'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Track Shipment {activeShipment ? '(1 Live)' : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Booking History</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-[#E83E83] text-white shadow-md shadow-[#E83E83]/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Payments & Escrow</span>
          </button>
        </div>
      </div>

      {/* TAB: OVERVIEW (HOME SCREEN WITH 4 ACTION CARDS) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* THE 4 CLEAN ACTION CARDS */}
          <div>
            <h2 className="text-sm font-bold text-[#77717A] uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Card 1: Post a Load */}
              <button
                onClick={onCreateLoadClick}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-[#E83E83]/40 transition text-left space-y-3 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center group-hover:scale-105 transition">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#171318]">Post a Load</h3>
                  <p className="text-xs text-[#77717A] mt-1">Submit your cargo & get transporter bids</p>
                </div>
              </button>

              {/* Card 2: Find a Load */}
              <button
                onClick={() => setActiveTab('my_loads')}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-[#E83E83]/40 transition text-left space-y-3 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-[#171318] flex items-center justify-center group-hover:scale-105 transition">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#171318]">My Loads</h3>
                  <p className="text-xs text-[#77717A] mt-1">Manage active listings and incoming bids</p>
                </div>
              </button>

              {/* Card 3: Find a Vehicle */}
              <button
                onClick={() => setActiveTab('find_vehicles')}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-[#E83E83]/40 transition text-left space-y-3 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center group-hover:scale-105 transition">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#171318]">Find Vehicles</h3>
                  <p className="text-xs text-[#77717A] mt-1">Browse trucks ready for hire in Assam</p>
                </div>
              </button>

              {/* Card 4: Track My Shipment */}
              <button
                onClick={() => setActiveTab('track')}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-[#E83E83]/40 transition text-left space-y-3 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16A36A] flex items-center justify-center group-hover:scale-105 transition">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#171318]">Track Shipment</h3>
                  <p className="text-xs text-[#77717A] mt-1">Live satellite GPS location & ETA</p>
                </div>
              </button>
            </div>
          </div>

          {/* ACTIVE SHIPMENT HIGHLIGHT (IF ANY) */}
          {activeShipment && (
            <div className="bg-white rounded-3xl p-6 border-2 border-[#E83E83]/30 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#16A36A] animate-ping" />
                  <span className="text-xs font-bold text-[#16A36A] uppercase tracking-wider">Live In Transit</span>
                  <span className="font-mono text-xs text-[#77717A]">#{activeShipment.id}</span>
                </div>
                <button
                  onClick={() => onSelectLoad(activeShipment.id)}
                  className="px-4 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#d62e73] transition self-start sm:self-auto cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Live Map & Driver</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4">
                <div>
                  <span className="text-xs text-[#77717A] block">Cargo Details</span>
                  <span className="font-bold text-base text-[#171318]">{activeShipment.goodsDescription}</span>
                  <span className="text-xs text-[#77717A] block mt-1">
                    Weight: {(activeShipment.weightKg ? (activeShipment.weightKg / 1000).toFixed(1) : '3.5')} MT
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#77717A] block">Corridor</span>
                  <span className="font-bold text-sm text-[#171318]">
                    {activeShipment.pickup?.city || 'Guwahati'} → {activeShipment.delivery?.city || 'Dibrugarh'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* QUICK FREIGHT ESTIMATOR (ANY LOCATION ACROSS CITY, STATE & INDIA) */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#E83E83]" />
                <h3 className="font-bold text-base text-[#171318]">Instant Freight Rate Calculator</h3>
              </div>
              <span className="text-[11px] text-[#77717A] font-medium">Search any street, town, city or pincode</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#77717A]">Pickup Location</label>
                <LocationAutocompleteInput
                  value={calcFrom}
                  onChangeText={(txt) => {
                    setCalcFrom(txt);
                    if (!txt.trim()) setCalcFromCoords(null);
                  }}
                  onSelectPlace={(place: SelectedPlace) => {
                    setCalcFrom(place.label);
                    setCalcFromCoords({ lat: place.lat, lng: place.lng });
                  }}
                  placeholder="Enter pickup area, city or pincode"
                  theme="light"
                  showGpsButton={true}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#77717A]">Drop Location</label>
                <LocationAutocompleteInput
                  value={calcTo}
                  onChangeText={(txt) => {
                    setCalcTo(txt);
                    if (!txt.trim()) setCalcToCoords(null);
                  }}
                  onSelectPlace={(place: SelectedPlace) => {
                    setCalcTo(place.label);
                    setCalcToCoords({ lat: place.lat, lng: place.lng });
                  }}
                  placeholder="Enter drop area, city or pincode"
                  theme="light"
                  showGpsButton={false}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#77717A]">Vehicle Type</label>
                <select
                  value={calcVehicle}
                  onChange={(e) => setCalcVehicle(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E83E83] bg-white text-[#171318]"
                >
                  {vehicleCategories.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.capacityTonnes} MT)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-[#FFF0F6] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {quickEst ? (
                <div>
                  <span className="text-xs font-bold text-[#E83E83] block">Estimated Freight Range</span>
                  <span className="text-2xl font-black text-[#171318]">
                    ₹{Math.round(quickEst.totalEstimate * 0.95).toLocaleString('en-IN')} – ₹{Math.round(quickEst.totalEstimate * 1.05).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-[#77717A] block mt-0.5">
                    Est. Distance: {quickEst.distanceKm} km • Travel time: ~{quickEst.estimatedHours} hrs
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-bold text-[#E83E83] block">Any Pickup → Any Drop</span>
                  <span className="text-sm font-bold text-[#171318] block mt-0.5">
                    Select pickup &amp; drop locations above to see live distance and freight estimate
                  </span>
                  <span className="text-[11px] text-[#77717A] block mt-0.5">
                    Works for local city deliveries, inter-district trips &amp; interstate highways
                  </span>
                </div>
              )}

              <button
                onClick={onCreateLoadClick}
                className="px-5 py-2.5 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition cursor-pointer shrink-0"
              >
                {quickEst ? 'Book with This Rate' : 'Book a Truck Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MY LOADS */}
      {activeTab === 'my_loads' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">My Consignments & Loads</h2>
              <p className="text-xs text-[#77717A]">Track bids from transporters and view consignment statuses</p>
            </div>
            <button
              onClick={onCreateLoadClick}
              className="px-4 py-2 bg-[#E83E83] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#d62e73] transition flex items-center gap-1.5 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Post New Load</span>
            </button>
          </div>

          <div className="space-y-3">
            {loads.map((load) => (
              <div 
                key={load.id}
                onClick={() => onSelectLoad(load.id)}
                className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-[#E83E83]/40 transition cursor-pointer space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-[#E83E83] font-bold block">#{load.id}</span>
                    <span className="font-bold text-base text-[#171318]">{load.goodsDescription}</span>
                  </div>
                  <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wider self-start sm:self-auto ${
                    load.status === 'posted' || load.status === 'bidding'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : load.status === 'assigned'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : load.status === 'delivered' || load.status === 'completed'
                      ? 'bg-emerald-50 text-[#16A36A] border border-emerald-200'
                      : load.status === 'cancelled'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    {load.status === 'posted' || load.status === 'bidding'
                      ? 'Open for Bids'
                      : load.status === 'assigned'
                      ? 'Assigned'
                      : load.status === 'delivered' || load.status === 'completed'
                      ? 'Delivered'
                      : load.status === 'cancelled'
                      ? 'Cancelled'
                      : 'In Transit'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-gray-50 rounded-2xl p-3">
                  <div>
                    <span className="text-[#77717A] block">From:</span>
                    <span className="font-semibold text-[#171318]">{load.pickup?.city || 'Guwahati'}</span>
                  </div>
                  <div>
                    <span className="text-[#77717A] block">To:</span>
                    <span className="font-semibold text-[#171318]">{load.delivery?.city || 'Dibrugarh'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#77717A]">
                    Target Budget: <span className="font-bold text-[#171318]">₹{(load.targetBudgetInr || 22000).toLocaleString('en-IN')}</span>
                  </span>
                  <span className="text-xs font-bold text-[#E83E83] flex items-center gap-1">
                    <span>View Bids & Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: FIND VEHICLES */}
      {activeTab === 'find_vehicles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Available Trucks in Northeast</h2>
              <p className="text-xs text-[#77717A]">Verified commercial carriers active and available for immediate dispatch</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div key={v.id} className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-base font-extrabold text-[#171318] block">{v.registrationNumber}</span>
                    <span className="text-xs text-[#77717A]">{v.modelName}</span>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    v.isOnline ? 'bg-emerald-50 text-[#16A36A]' : 'bg-gray-100 text-[#77717A]'
                  }`}>
                    {v.isOnline ? 'Available' : 'Busy'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-gray-100">
                  <div>
                    <span className="text-[#77717A] block">Capacity:</span>
                    <span className="font-bold text-[#171318]">{(v.capacityKg ? (v.capacityKg / 1000).toFixed(1) : '3.5')} MT</span>
                  </div>
                  <div>
                    <span className="text-[#77717A] block">Rating:</span>
                    <span className="font-bold text-[#E9A23B]">
                      ★ {(v.driverRating || 4.8).toFixed(1)} ({v.completedTrips || 0} trips)
                    </span>
                  </div>
                </div>

                <div className="text-xs text-[#77717A] space-y-0.5">
                  <div>
                    Driver: <span className="font-semibold text-[#171318]">{v.driverName || v.transporterName}</span>
                  </div>
                  <div>
                    Location: <span className="font-semibold text-[#171318]">{v.currentLocation?.city || 'Guwahati, Assam'}</span>
                  </div>
                </div>

                <button
                  onClick={onCreateLoadClick}
                  className="w-full py-2.5 bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Request Quote from Truck
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: TRACK SHIPMENT */}
      {activeTab === 'track' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Live GPS Satellite Tracking</h2>
              <p className="text-xs text-[#77717A]">Real-time telemetry, route corridor, and animated truck marker</p>
            </div>

            {/* Shipment Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 hidden sm:inline">Active Trip:</span>
              <select
                value={selectedTrackTripId}
                onChange={(e) => setSelectedTrackTripId(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-[#171318] focus:outline-none focus:ring-2 focus:ring-[#E83E83] shadow-sm cursor-pointer"
              >
                <option value="trip_demo_01">Dibrugarh → Guwahati (Live Corridor Feed)</option>
                {loads
                  .filter(
                    (l) =>
                      l.assignedBookingId ||
                      l.status === 'assigned' ||
                      l.status === 'en_route_pickup' ||
                      l.status === 'at_pickup' ||
                      l.status === 'loading' ||
                      l.status === 'in_transit' ||
                      l.status === 'at_destination'
                  )
                  .map((l) => (
                    <option key={l.id} value={l.assignedBookingId || `trip_${l.id}`}>
                      {l.pickup.city} → {l.delivery.city} ({l.status.replace('_', ' ').toUpperCase()})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Interactive Live Tracking Map Component */}
          <ShipperLiveTracker
            tripId={selectedTrackTripId}
            initialTrackingToken={bookings.find((b) => b.id === selectedTrackTripId)?.trackingToken}
            onOpenDriverSimulator={(tId, tok) => {
              setSimulatorTripId(tId);
              setSimulatorToken(tok);
              setShowDriverSimulator(true);
            }}
          />
        </div>
      )}

      {/* TAB: BOOKING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#171318]">Booking History & Consignment Receipts</h2>
              <p className="text-xs text-[#77717A]">Download GST invoices and proof-of-delivery records</p>
            </div>
            <button
              onClick={handleExportBookingsCsv}
              className="px-4 py-2 bg-[#FFF0F6] text-[#E83E83] text-xs font-bold rounded-xl hover:bg-[#ffe2ee] transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#E83E83]">Booking #{b.id}</span>
                    <span className="font-bold text-base text-[#171318] block">
                      {b.pickup?.city || 'Guwahati'} → {b.delivery?.city || 'Dibrugarh'}
                    </span>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-emerald-50 text-[#16A36A] self-start sm:self-auto">
                    {b.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                  <span className="text-[#77717A]">
                    Total Paid: <span className="font-black text-[#171318]">₹{(b.totalAgreedAmountInr || 25500).toLocaleString('en-IN')}</span>
                  </span>
                  <button
                    onClick={() => onViewInvoice(b.id)}
                    className="px-4 py-2 bg-[#171318] text-white text-xs font-semibold rounded-xl hover:bg-black transition cursor-pointer"
                  >
                    View Tax Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {paymentNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{paymentNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1.5">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Verified Paid</span>
              <span className="text-3xl font-black text-[#16A36A] font-mono tabular-nums block">
                ₹{financialStats.totalPaid.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-[#77717A]">
                Out of ₹{financialStats.totalSpend.toLocaleString('en-IN')} across {bookings.length} booking(s)
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1.5">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Pending / Due</span>
              <span className="text-3xl font-black text-[#E83E83] font-mono tabular-nums block">
                ₹{financialStats.totalDue.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-[#77717A]">90% advance before pickup · 10% on delivery</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-1.5">
              <span className="text-xs font-bold text-[#77717A] uppercase tracking-wider block">Payment Options</span>
              <span className="text-lg font-black text-[#171318] flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-[#16A36A]" />
                <span>UPI · Bank · On-Site</span>
              </span>
              <p className="text-xs text-[#77717A]">Pay Zuggi via UPI/NEFT or pay the driver directly</p>
            </div>
          </div>

          {/* Booking Payment List */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#171318]">Booking Payments</h3>
                <p className="text-xs text-[#77717A]">Pay 90% advance, settle 10% on delivery, or view receipts</p>
              </div>
              <span className="text-xs font-semibold text-[#77717A]">{bookings.length} Booking(s)</span>
            </div>

            {bookings.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#77717A]">
                No booked shipments yet. Once you accept a transporter quote, your payment steps will appear here.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bookings.map((b) => {
                  const advAmt = Number(b.customerAdvanceAmountInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.90);
                  const balAmt = Number(b.customerBalanceAmountInr) || Math.round((Number(b.totalAgreedAmountInr) || 0) * 0.10);
                  const advLabel =
                    b.paymentAdvanceStatus === 'paid'
                      ? 'Paid'
                      : b.paymentAdvanceStatus === 'processing'
                      ? b.advancePaymentMethod === 'pay_driver_direct'
                        ? 'Pay Driver at Pickup'
                        : 'Verifying UTR'
                      : 'Unpaid';
                  const balLabel =
                    b.paymentBalanceStatus === 'paid'
                      ? 'Paid'
                      : b.paymentBalanceStatus === 'processing'
                      ? b.balancePaymentMethod === 'pay_driver_direct'
                        ? 'Pay Driver at Delivery'
                        : 'Verifying UTR'
                      : 'On Delivery';

                  return (
                    <div key={b.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#77717A]">#{b.id}</span>
                          <span className="text-sm font-extrabold text-[#171318]">
                            {b.pickup.city} → {b.delivery.city}
                          </span>
                        </div>
                        <p className="text-xs text-[#77717A]">
                          {b.goodsDescription} · Total Fare:{' '}
                          <strong className="text-[#171318] font-mono tabular-nums">
                            ₹{(Number(b.totalAgreedAmountInr) || 0).toLocaleString('en-IN')}
                          </strong>
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs pt-0.5">
                          <span className="text-[#77717A]">
                            Advance (90%):{' '}
                            <strong
                              className={
                                b.paymentAdvanceStatus === 'paid'
                                  ? 'text-[#16A36A]'
                                  : b.paymentAdvanceStatus === 'processing'
                                  ? 'text-amber-600'
                                  : 'text-[#E83E83]'
                              }
                            >
                              ₹{advAmt.toLocaleString('en-IN')} ({advLabel})
                            </strong>
                          </span>
                          <span className="text-[#77717A]">
                            Balance (10%):{' '}
                            <strong
                              className={
                                b.paymentBalanceStatus === 'paid'
                                  ? 'text-[#16A36A]'
                                  : b.paymentBalanceStatus === 'processing'
                                  ? 'text-amber-600'
                                  : 'text-[#171318]'
                              }
                            >
                              ₹{balAmt.toLocaleString('en-IN')} ({balLabel})
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {b.paymentAdvanceStatus !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => setPaymentModalTarget({ booking: b, stage: 'advance_90' })}
                            className="min-h-[40px] px-4 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold transition cursor-pointer"
                          >
                            {b.paymentAdvanceStatus === 'processing' ? 'Update Advance' : `Pay Advance (₹${advAmt.toLocaleString('en-IN')})`}
                          </button>
                        )}
                        {b.paymentAdvanceStatus === 'paid' && b.paymentBalanceStatus !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => setPaymentModalTarget({ booking: b, stage: 'balance_10' })}
                            className="min-h-[40px] px-4 rounded-xl bg-[#171318] hover:bg-black text-white text-xs font-bold transition cursor-pointer"
                          >
                            {b.paymentBalanceStatus === 'processing' ? 'Update Balance' : `Pay Balance (₹${balAmt.toLocaleString('en-IN')})`}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReceiptBooking(b)}
                          className="min-h-[40px] px-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-semibold transition cursor-pointer"
                        >
                          Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(b.id)}
                          className="min-h-[40px] px-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-semibold transition cursor-pointer"
                        >
                          GST Invoice
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal from Payments Tab */}
      {paymentModalTarget && (
        <CashfreeEscrowModal
          booking={paymentModalTarget.booking}
          stage={paymentModalTarget.stage}
          currentUser={currentUser}
          onClose={() => setPaymentModalTarget(null)}
          onPaymentSuccess={(msg) => {
            setPaymentNotice(msg);
            setTimeout(() => setPaymentNotice(null), 6000);
          }}
        />
      )}

      {/* Receipt Modal from Payments Tab */}
      {receiptBooking && (
        <PaymentReceiptModal
          booking={receiptBooking}
          onClose={() => setReceiptBooking(null)}
        />
      )}

      {/* Driver GPS Simulator Modal */}
      {showDriverSimulator && (
        <DriverGpsSimulatorModal
          tripId={simulatorTripId}
          trackingToken={simulatorToken}
          isOpen={true}
          onClose={() => setShowDriverSimulator(false)}
        />
      )}
    </div>
  );
};
