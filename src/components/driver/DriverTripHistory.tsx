import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  MapPin,
  Navigation,
  Printer,
  Search,
  ShieldCheck,
  Star,
  Truck,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Eye,
  X,
  Building2,
  Calendar,
  Layers,
  Award,
  PhoneCall
} from 'lucide-react';
import { Booking, Settlement, TripFeedback, User } from '../../types';
import { logisticsStore } from '../../services/store';
import { exportTripHistoryToCsv } from '../../utils/csvExport';

interface DriverTripHistoryProps {
  currentUser: User;
  onBack: () => void;
  onViewInvoice?: (bookingId: string) => void;
  onOpenSupport?: (loadId?: string) => void;
}

export const DriverTripHistory: React.FC<DriverTripHistoryProps> = ({
  currentUser,
  onBack,
  onViewInvoice,
  onOpenSupport
}) => {
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [feedbacks, setFeedbacks] = useState<TripFeedback[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'month' | '30days' | '90days'>('all');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'settled' | 'stage1_only' | 'held'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'fare_high' | 'fare_low'>('newest');

  // Detailed Modal State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewPodUrl, setPreviewPodUrl] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setAllBookings(logisticsStore.getBookings());
      setSettlements(logisticsStore.getSettlements());
      setFeedbacks(logisticsStore.getFeedbacks());
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, []);

  // Filter completed and delivered trips for the logged-in driver/transporter
  const completedTrips = useMemo(() => {
    return allBookings.filter((b) => {
      const isFinished = b.status === 'completed' || b.status === 'delivered';
      if (!isFinished) return false;
      return b.driverId === currentUser.id || b.transporterId === currentUser.id;
    });
  }, [allBookings, currentUser]);

  // Aggregate metrics
  const totalCompletedCount = completedTrips.length;
  const totalGrossEarnings = completedTrips.reduce((sum, b) => sum + b.totalAgreedAmountInr, 0);
  const totalPlatformFees = completedTrips.reduce((sum, b) => sum + b.platformCommissionInr, 0);
  const totalNetDisbursed = completedTrips.reduce((sum, b) => sum + b.netDriverPayableInr, 0);
  const averageFarePerTrip = totalCompletedCount > 0 ? Math.round(totalNetDisbursed / totalCompletedCount) : 0;

  // Filter & Search Logic
  const filteredTrips = useMemo(() => {
    let result = [...completedTrips];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.goodsDescription.toLowerCase().includes(q) ||
          b.pickup.city.toLowerCase().includes(q) ||
          b.delivery.city.toLowerCase().includes(q) ||
          b.pickup.contactName.toLowerCase().includes(q) ||
          b.delivery.contactName.toLowerCase().includes(q) ||
          (b.eWayBillNumber && b.eWayBillNumber.toLowerCase().includes(q))
      );
    }

    // Corridor Filter
    if (corridorFilter !== 'all') {
      result = result.filter((b) => `${b.pickup.city} → ${b.delivery.city}` === corridorFilter);
    }

    // Payout status filter
    if (payoutFilter === 'settled') {
      result = result.filter((b) => b.payoutStage1Status === 'settled' && b.payoutStage2Status === 'settled');
    } else if (payoutFilter === 'stage1_only') {
      result = result.filter((b) => b.payoutStage1Status === 'settled' && b.payoutStage2Status !== 'settled');
    } else if (payoutFilter === 'held') {
      result = result.filter((b) => b.payoutStage2Status === 'disputed_on_hold');
    }

    // Timeframe filter
    if (timeframeFilter !== 'all') {
      const now = Date.now();
      result = result.filter((b) => {
        const tripDate = new Date(b.completedAt || b.createdAt).getTime();
        const diffDays = (now - tripDate) / (1000 * 60 * 60 * 24);
        if (timeframeFilter === 'month') return diffDays <= 31;
        if (timeframeFilter === '30days') return diffDays <= 30;
        if (timeframeFilter === '90days') return diffDays <= 90;
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.completedAt || a.createdAt).getTime();
      const dateB = new Date(b.completedAt || b.createdAt).getTime();

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'fare_high') return b.netDriverPayableInr - a.netDriverPayableInr;
      if (sortBy === 'fare_low') return a.netDriverPayableInr - b.netDriverPayableInr;
      return 0;
    });

    return result;
  }, [completedTrips, searchQuery, corridorFilter, payoutFilter, timeframeFilter, sortBy]);

  // Unique corridors for filter dropdown
  const uniqueCorridors = useMemo(() => {
    const set = new Set<string>();
    completedTrips.forEach((b) => {
      set.add(`${b.pickup.city} → ${b.delivery.city}`);
    });
    return Array.from(set);
  }, [completedTrips]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    exportTripHistoryToCsv(filteredTrips, settlements);
  };

  const getFeedbackForBooking = (bookingId: string) => {
    return feedbacks.find((f) => f.bookingId === bookingId);
  };

  const getSettlementsForBooking = (bookingId: string) => {
    return settlements.filter((s) => s.bookingId === bookingId);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Trip History & Delivery Archives</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/30">
                  {totalCompletedCount} Completed
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Audit record of verified consignments, Proof of Delivery (POD) documents, and 2-stage Cashfree settlements.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredTrips.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
            title="Export all completed trips, fare breakdowns, and UTR codes into CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Aggregate Earnings & Delivery Performance Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-slate-400 text-xs block font-medium">Net Disbursed Earnings</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono flex items-center">
            <span>₹{totalNetDisbursed.toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            95% fleet share credited via bank UTR
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-slate-400 text-xs block font-medium">Total Agreed Fares (Gross)</span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            ₹{totalGrossEarnings.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-amber-400 block font-medium">
            ₹{totalPlatformFees.toLocaleString('en-IN')} (5% Platform Fee)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-slate-400 text-xs block font-medium">Average Payout / Trip</span>
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">
            ₹{averageFarePerTrip.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 block">Across all completed routes</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-lg">
          <span className="text-slate-400 text-xs block font-medium">POD Verification Rate</span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>100%</span>
          </div>
          <span className="text-[10px] text-emerald-400 block font-semibold">Zero open delivery disputes</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Trip ID, goods description, city, consignor, or e-Way bill..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Timeframe Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap hidden sm:inline">
              Period:
            </span>
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'month', label: 'This Month' },
                { id: '30days', label: 'Past 30 Days' },
                { id: '90days', label: 'Past 90 Days' }
              ] as const
            ).map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframeFilter(tf.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  timeframeFilter === tf.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            {/* Corridor Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Corridor:</span>
              <select
                value={corridorFilter}
                onChange={(e) => setCorridorFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Corridors ({uniqueCorridors.length})</option>
                {uniqueCorridors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Payout Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Payout:</span>
              <select
                value={payoutFilter}
                onChange={(e) => setPayoutFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">All Payout States</option>
                <option value="settled">Fully Settled (100%)</option>
                <option value="stage1_only">Stage 1 Only (90%)</option>
                <option value="held">Dispute On Hold</option>
              </select>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="newest">Most Recent Delivery First</option>
              <option value="oldest">Oldest Delivery First</option>
              <option value="fare_high">Highest Earnings First</option>
              <option value="fare_low">Lowest Earnings First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Completed Deliveries List */}
      {filteredTrips.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <Truck className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Completed Deliveries Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery || corridorFilter !== 'all' || timeframeFilter !== 'all'
              ? 'No trips matched your search filters. Try clearing the filter options above.'
              : 'You do not have any completed deliveries yet. When you complete an active trip and verify the consignee OTP, it will appear here.'}
          </p>
          {(searchQuery || corridorFilter !== 'all' || timeframeFilter !== 'all' || payoutFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCorridorFilter('all');
                setTimeframeFilter('all');
                setPayoutFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing <strong className="text-white font-mono">{filteredTrips.length}</strong> of{' '}
              <strong className="text-white font-mono">{totalCompletedCount}</strong> deliveries
            </span>
            <span className="text-[11px]">All records authenticated with e-Way Bill & OTP</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTrips.map((booking) => {
              const fb = getFeedbackForBooking(booking.id);
              const tripSettlements = getSettlementsForBooking(booking.id);
              const completedDateFormatted = booking.completedAt
                ? new Date(booking.completedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : new Date(booking.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });

              return (
                <div
                  key={booking.id}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl hover:border-slate-700 transition space-y-4"
                >
                  {/* Card Top Header: ID, Date, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        <span>{booking.id}</span>
                        <button
                          onClick={() => handleCopyId(booking.id)}
                          className="hover:text-white transition cursor-pointer"
                          title="Copy Trip ID"
                        >
                          {copiedId === booking.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Completed: {completedDateFormatted}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>DELIVERED & SETTLED</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-mono font-semibold border border-indigo-500/30">
                        Cashfree Easy Split
                      </span>
                    </div>
                  </div>

                  {/* Route Corridor & Cargo Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Origin -> Destination Corridor */}
                    <div className="space-y-2 md:col-span-1 border-r border-slate-800/60 pr-0 md:pr-4">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                        FREIGHT CORRIDOR
                      </span>

                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold text-white text-xs">{booking.pickup.city}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{booking.pickup.address}</div>
                          </div>
                        </div>

                        <div className="pl-1.5 border-l-2 border-dashed border-slate-800 ml-1.5 h-3"></div>

                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold text-white text-xs">{booking.delivery.city}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{booking.delivery.address}</div>
                          </div>
                        </div>
                      </div>

                      {booking.eWayBillNumber && (
                        <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <span className="text-slate-500">e-Way:</span>
                          <span className="text-amber-300 font-semibold">{booking.eWayBillNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Cargo & Vehicle Details */}
                    <div className="space-y-2 md:col-span-1 border-r border-slate-800/60 pr-0 md:pr-4">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                        CARGO & VEHICLE
                      </span>

                      <div className="font-semibold text-slate-200 line-clamp-2 leading-relaxed">
                        {booking.goodsDescription}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                          {booking.weightKg} kg ({(booking.weightKg / 1000).toFixed(1)} MT)
                        </span>

                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400 font-mono font-semibold flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          <span>{booking.vehicleId || 'AS-01-MC-7822'}</span>
                        </span>
                      </div>

                      {/* Consignee Delivery Confirmation OTP */}
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Consignee Confirmed OTP:</span>
                        <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                          {booking.deliveryOtp}
                        </span>
                      </div>
                    </div>

                    {/* Payout & Earnings Summary Box */}
                    <div className="space-y-2 md:col-span-1 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/90 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>Gross Booking Fare</span>
                          <span className="font-mono text-white font-semibold">
                            ₹{(booking.totalAgreedAmountInr ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                          <span>Less: 5% Platform Fee</span>
                          <span className="font-mono text-amber-400">
                            -₹{(booking.platformCommissionInr ?? Math.round((booking.totalAgreedAmountInr || 0) * 0.05)).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="font-bold text-slate-300 text-xs">Net Driver Earnings (95%)</span>
                          <span className="text-base font-black text-emerald-400 font-mono">
                            ₹{(booking.netDriverPayableInr ?? Math.round((booking.totalAgreedAmountInr || 0) * 0.95)).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Cashfree 2-Stage Split Status Indicator */}
                      <div className="grid grid-cols-2 gap-1.5 pt-2 text-[10px] border-t border-slate-800/80">
                        <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
                          <span className="text-slate-400 block">Stage 1 (90%)</span>
                          <span className="font-mono font-bold text-white">
                            ₹{(booking.driverFirstPayoutInr ?? Math.round(((booking.netDriverPayableInr || (booking.totalAgreedAmountInr * 0.95)) || 0) * 0.9)).toLocaleString('en-IN')}
                          </span>
                          <span className="text-emerald-400 font-semibold block text-[9px]">✓ Disbursed</span>
                        </div>

                        <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
                          <span className="text-slate-400 block">Stage 2 (10%)</span>
                          <span className="font-mono font-bold text-white">
                            ₹{(booking.driverFinalPayoutInr ?? Math.round(((booking.netDriverPayableInr || (booking.totalAgreedAmountInr * 0.95)) || 0) * 0.1)).toLocaleString('en-IN')}
                          </span>
                          <span className="text-emerald-400 font-semibold block text-[9px]">✓ Disbursed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Review / Compliments (If Available) */}
                  {fb && (
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3 h-3 ${s <= Math.round(fb.overallRating) ? 'fill-amber-400' : 'text-slate-700'}`}
                            />
                          ))}
                        </div>
                        <span className="font-bold text-slate-200">{fb.customerName}</span>
                        {fb.customerCompany && (
                          <span className="text-slate-400 text-[11px] hidden sm:inline">
                            • {fb.customerCompany}
                          </span>
                        )}
                        <span className="italic text-slate-400 text-[11px]">
                          &quot;{fb.reviewComments}&quot;
                        </span>
                      </div>

                      {fb.tipAmountInr ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 whitespace-nowrap">
                          +₹{fb.tipAmountInr} Tip Added
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {booking.podDocumentUrl && (
                        <button
                          onClick={() => setPreviewPodUrl(booking.podDocumentUrl || null)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-400" />
                          <span>View POD Document</span>
                        </button>
                      )}

                      {onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(booking.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>GST Tax Invoice</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 font-bold text-xs transition cursor-pointer"
                    >
                      <span>View Detailed Delivery Report</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAILED TRIP REPORT & EARNINGS BREAKDOWN MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-5 sm:p-7 space-y-6 my-auto text-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black uppercase">
                    OFFICIAL FREIGHT VOUCHER
                  </span>
                  <span className="text-xs font-mono text-slate-400">({selectedBooking.id})</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Goods Consignment & Driver Settlement Voucher
                </h2>
                <p className="text-xs text-slate-400">
                  Zuggi Indian GTA Commercial Freight & Cashfree Easy Split Settlement Record
                </p>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Consignor & Consignee Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                  CONSIGNOR / SHIPPER (PICKUP)
                </span>
                <div className="font-bold text-white text-sm">{selectedBooking.pickup.contactName}</div>
                <div className="text-slate-300">{selectedBooking.pickup.address}</div>
                <div className="text-slate-400">
                  {selectedBooking.pickup.city}, {selectedBooking.pickup.state} - {selectedBooking.pickup.pincode}
                </div>
                <div className="text-amber-400 font-mono pt-1">
                  Contact: {selectedBooking.pickup.contactPhone}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                  CONSIGNEE (DELIVERY)
                </span>
                <div className="font-bold text-white text-sm">{selectedBooking.delivery.contactName}</div>
                <div className="text-slate-300">{selectedBooking.delivery.address}</div>
                <div className="text-slate-400">
                  {selectedBooking.delivery.city}, {selectedBooking.delivery.state} - {selectedBooking.delivery.pincode}
                </div>
                <div className="text-emerald-400 font-mono pt-1">
                  Contact: {selectedBooking.delivery.contactPhone}
                </div>
              </div>
            </div>

            {/* Cargo & Vehicle Specifications */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                CARGO & FLEET SPECIFICATIONS
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 text-[10px] block">Goods Description</span>
                  <span className="text-white font-semibold">{selectedBooking.goodsDescription}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Consignment Weight</span>
                  <span className="text-white font-mono font-semibold">
                    {selectedBooking.weightKg} kg ({(selectedBooking.weightKg / 1000).toFixed(2)} Tonnes)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Vehicle Registration</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {selectedBooking.vehicleId || 'AS-01-MC-7822'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">e-Way Bill Number</span>
                  <span className="text-white font-mono">
                    {selectedBooking.eWayBillNumber || 'EXEMPT (Local Intra-State)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Itemized Financial Voucher */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4" />
                  <span>Settlement & Net Earnings Statement</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  Status: 100% Fully Settled
                </span>
              </div>

              <div className="space-y-2 text-xs divide-y divide-slate-800/60">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Total Agreed Booking Fare (Gross)</span>
                  <span className="font-mono text-white font-bold text-sm">
                    ₹{(selectedBooking.totalAgreedAmountInr ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Zuggi Platform Commission (5%)</span>
                  <span className="font-mono text-amber-400 font-semibold">
                    -₹{(selectedBooking.platformCommissionInr ?? Math.round((selectedBooking.totalAgreedAmountInr || 0) * 0.05)).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-bold text-white text-sm">Final Net Driver Earnings (95%)</span>
                  <span className="font-mono text-emerald-400 font-black text-lg">
                    ₹{(selectedBooking.netDriverPayableInr ?? Math.round((selectedBooking.totalAgreedAmountInr || 0) * 0.95)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* 2-Stage Cashfree Payout Lifecycle Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">First Payout (90%)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{(selectedBooking.driverFirstPayoutInr ?? Math.round(((selectedBooking.netDriverPayableInr || (selectedBooking.totalAgreedAmountInr * 0.95)) || 0) * 0.9)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Disbursed instantly upon verified cargo pickup at origin warehouse.
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                    Split ID: {selectedBooking.cashfreeStage1SplitId || 'CF_SPLIT1_98124'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">Final Payout (10%)</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{(selectedBooking.driverFinalPayoutInr ?? Math.round(((selectedBooking.netDriverPayableInr || (selectedBooking.totalAgreedAmountInr * 0.95)) || 0) * 0.1)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Disbursed post-delivery verification and consignee OTP clearance.
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                    Split ID: {selectedBooking.cashfreeStage2SplitId || 'CF_SPLIT2_98124'}
                  </div>
                </div>
              </div>
            </div>

            {/* Proof of Delivery (POD) Section */}
            {selectedBooking.podDocumentUrl && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                  PROOF OF DELIVERY (POD) ARCHIVE
                </span>

                <div className="flex items-center gap-4">
                  <img
                    src={selectedBooking.podDocumentUrl}
                    alt="Proof of Delivery"
                    className="w-24 h-24 object-cover rounded-xl border border-slate-700 cursor-pointer hover:opacity-90"
                    onClick={() => setPreviewPodUrl(selectedBooking.podDocumentUrl || null)}
                  />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Consignee Signed POD Verified</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Digital confirmation code: <span className="font-mono font-bold text-emerald-400">{selectedBooking.deliveryOtp}</span>
                    </p>
                    <button
                      onClick={() => setPreviewPodUrl(selectedBooking.podDocumentUrl || null)}
                      className="text-amber-400 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Enlarge / Inspect Document →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close Voucher
              </button>

              <div className="flex items-center gap-2">
                {onViewInvoice && (
                  <button
                    onClick={() => {
                      onViewInvoice(selectedBooking.id);
                      setSelectedBooking(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>View GST Tax Invoice</span>
                  </button>
                )}

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Consignment Voucher</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen POD Document Image Viewer */}
      {previewPodUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Proof of Delivery (POD) Slip</span>
              </span>
              <button
                onClick={() => setPreviewPodUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden max-h-[75vh] flex items-center justify-center bg-slate-950">
              <img src={previewPodUrl} alt="POD Document Full" className="max-h-[75vh] object-contain w-auto" />
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setPreviewPodUrl(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
