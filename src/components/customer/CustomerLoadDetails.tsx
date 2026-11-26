import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  AlertCircle, 
  Star, 
  Phone, 
  MessageSquare,
  Lock,
  Download,
  KeyRound,
  LifeBuoy,
  Sparkles,
  Award,
  CreditCard,
  Receipt,
  ShieldAlert,
  XCircle,
  Loader2
} from 'lucide-react';
import { Booking, LoadItem, Quotation, TripFeedback } from '../../types';
import { logisticsStore } from '../../services/store';
import { ShipperLiveTrackingScreen } from '../tracking/ShipperLiveTrackingScreen';
import { DriverGpsSimulatorModal } from '../tracking/DriverGpsSimulatorModal';
import { TripFeedbackModal } from './TripFeedbackModal';
import { CashfreeEscrowModal } from '../payments/CashfreeEscrowModal';
import { RaiseDisputeModal } from '../payments/RaiseDisputeModal';
import { showToast } from '../shared/Toast';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal';
import {
  escrowClient,
  type TripEscrowLedger,
  type EscrowPayoutTranche,
  type FleetVendorSummary
} from '../../services/escrowClient';
import { ShipperCheckoutBreakdownCard } from '../escrow/ShipperCheckoutBreakdownCard';
import { ShipperPodApprovalBanner } from '../escrow/ShipperPodApprovalBanner';
import {
  applyClientSeo,
  buildClientFreightListingJsonLd,
  loadItemToPublicFreight
} from '../../utils/seo';

interface CustomerLoadDetailsProps {
  loadId: string;
  onBack: () => void;
  onViewInvoice: (bookingId: string) => void;
  onOpenSupport?: (loadId: string) => void;
}

export const CustomerLoadDetails: React.FC<CustomerLoadDetailsProps> = ({
  loadId,
  onBack,
  onViewInvoice,
  onOpenSupport
}) => {
  const [load, setLoad] = useState<LoadItem | undefined>(() => logisticsStore.getLoadById(loadId));
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [counterQuoteId, setCounterQuoteId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState<number>(0);
  const [counterNote, setCounterNote] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [processingQuoteId, setProcessingQuoteId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<TripFeedback | undefined>(undefined);
  const [escrowModalStage, setEscrowModalStage] = useState<'advance_90' | 'balance_10' | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showDisputeModal, setShowDisputeModal] = useState<boolean>(false);
  const [showDriverSimulator, setShowDriverSimulator] = useState<boolean>(false);
  const [simulatorTripId, setSimulatorTripId] = useState<string>('');
  const [simulatorToken, setSimulatorToken] = useState<string>('');
  const [confirmCancel, setConfirmCancel] = useState<boolean>(false);
  const [escrowLedger, setEscrowLedger] = useState<TripEscrowLedger | null>(null);
  const [escrowTranches, setEscrowTranches] = useState<EscrowPayoutTranche[]>([]);
  const [escrowVendor, setEscrowVendor] = useState<FleetVendorSummary | null>(null);
  const currentUser = logisticsStore.getCurrentUser();

  const assignedQuote = quotations.find((q) => q.id === booking?.quotationId);
  const assignedVehicle = booking?.vehicleId ? logisticsStore.getVehicleById(booking.vehicleId) : undefined;
  const assignedDriverUser = booking?.driverId ? logisticsStore.getUserById(booking.driverId) : undefined;
  const assignedTransporterName = assignedQuote?.transporterName || 'Assigned Transporter';
  const assignedVehicleReg = assignedVehicle?.registrationNumber || assignedQuote?.vehicleRegNumber || 'Vehicle Assigned';
  const assignedDriverName =
    assignedDriverUser?.name || assignedVehicle?.driverName || assignedQuote?.driverName || 'Assigned Transporter Driver';
  const assignedDriverPhone =
    assignedDriverUser?.phone || assignedVehicle?.driverPhone || assignedQuote?.transporterPhone || '';

  useEffect(() => {
    const update = () => {
      const currentLoad = logisticsStore.getLoadById(loadId);
      setLoad(currentLoad);
      setQuotations(logisticsStore.getQuotations(loadId));
      if (currentLoad?.assignedBookingId) {
        const b = logisticsStore.getBookingById(currentLoad.assignedBookingId);
        setBooking(b);
        if (b) {
          setFeedback(logisticsStore.getFeedbackByBookingId(b.id));
        }
      }
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [loadId]);

  useEffect(() => {
    let active = true;
    if (!booking?.id) {
      setEscrowLedger(null);
      setEscrowTranches([]);
      setEscrowVendor(null);
      return;
    }
    escrowClient
      .getTripEscrowLedger(booking.id)
      .then((res) => {
        if (!active || !res.success) return;
        setEscrowLedger(res.ledger || null);
        setEscrowTranches(res.tranches || []);
        setEscrowVendor(res.vendor || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [booking?.id]);

  // Inject dynamic meta tags & Schema.org Structured Data for this individual freight listing
  useEffect(() => {
    if (!load) return;
    const publicListing = loadItemToPublicFreight(load);
    applyClientSeo({
      title: `${publicListing.pickupCity} to ${publicListing.deliveryCity} Load (${publicListing.weightKg}kg) | Zuggi`,
      description: `${publicListing.goodsCategoryLabel} freight from ${publicListing.pickupCity} to ${publicListing.deliveryCity} (${publicListing.estimatedDistanceKm} km). ${publicListing.requiredVehicleName} on Zuggi.`,
      canonicalPath: `/freight/${encodeURIComponent(publicListing.id)}`,
      ogType: 'product',
      jsonLd: buildClientFreightListingJsonLd(publicListing)
    });
  }, [load]);

  if (!load) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Load not found or was removed.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleAcceptQuotation = async (quoteId: string) => {
    if (processingQuoteId) return;
    setProcessingQuoteId(quoteId);

    try {
      const res = logisticsStore.acceptQuotation(quoteId);
      if (res.success) {
        const feedback = 'Accepted - Driver Assigned! Shipment booked and ready for dispatch.';
        setActionMessage({ text: feedback });
        showToast(feedback, 'success');
        setTimeout(() => setActionMessage(null), 6000);
      } else {
        setActionMessage({ text: res.message, error: true });
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to accept quotation.';
      setActionMessage({ text: errorMsg, error: true });
      showToast(errorMsg, 'error');
    } finally {
      setProcessingQuoteId(null);
    }
  };

  const handleRejectQuotation = async (quoteId: string) => {
    if (processingQuoteId) return;
    setProcessingQuoteId(quoteId);

    try {
      const res = logisticsStore.rejectQuotationByShipper(quoteId);
      if (res.success) {
        const feedback = 'Bid Declined.';
        setActionMessage({ text: feedback });
        showToast(feedback, 'info');
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        setActionMessage({ text: res.message, error: true });
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to decline quotation.';
      setActionMessage({ text: errorMsg, error: true });
      showToast(errorMsg, 'error');
    } finally {
      setProcessingQuoteId(null);
    }
  };

  const handleSendCounterOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterQuoteId || counterAmount <= 0) return;

    logisticsStore.counterOfferQuotation(counterQuoteId, counterAmount, counterNote);
    setActionMessage({ text: `Counter-offer of ₹${counterAmount.toLocaleString('en-IN')} sent to transporter.` });
    setCounterQuoteId(null);
    setCounterAmount(0);
    setCounterNote('');
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Status progression stages
  const statusSteps = [
    { key: 'posted', label: 'Load Posted' },
    { key: 'bidding', label: 'Bids Received' },
    { key: 'assigned', label: 'Driver Assigned' },
    { key: 'at_pickup', label: 'At Pickup' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'completed', label: 'Completed' }
  ];

  const normalizedStepStatus =
    load.status === 'en_route_pickup'
      ? 'assigned'
      : load.status === 'loading'
      ? 'at_pickup'
      : load.status === 'at_destination'
      ? 'in_transit'
      : load.status;
  const currentStepIdx = statusSteps.findIndex((s) => s.key === normalizedStepStatus);
  const activeStepIdx = currentStepIdx >= 0 ? currentStepIdx : 2;

  const isTrackingAvailable = [
    'assigned',
    'en_route_pickup',
    'at_pickup',
    'loading',
    'in_transit',
    'at_destination',
    'delivered',
    'completed'
  ].includes(load.status);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Loads</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">ID: {load.id}</span>
          <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${
            load.status === 'posted' || load.status === 'bidding'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : load.status === 'assigned'
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
              : load.status === 'delivered' || load.status === 'completed'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : load.status === 'cancelled'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse'
          }`}>
            {load.status === 'posted' || load.status === 'bidding'
              ? 'Open for Bids'
              : load.status === 'assigned'
              ? 'Assigned'
              : load.status === 'en_route_pickup'
              ? 'En Route to Pickup'
              : load.status === 'at_pickup'
              ? 'At Pickup'
              : load.status === 'loading'
              ? 'Loading Cargo'
              : load.status === 'at_destination'
              ? 'At Destination'
              : load.status === 'delivered' || load.status === 'completed'
              ? 'Delivered'
              : load.status === 'blocked'
              ? 'Blocked'
              : load.status === 'cancelled'
              ? 'Cancelled'
              : 'In Transit'}
          </span>


          {(load.status === 'posted' || load.status === 'bidding') && (
            confirmCancel ? (
              <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-700 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] text-rose-200 font-semibold">Cancel load?</span>
                <button
                  onClick={() => {
                    const res = logisticsStore.cancelLoad(load.id, 'Cancelled by shipper');
                    if (res.success) {
                      setActionMessage({ text: 'Load cancelled successfully.' });
                      setTimeout(() => onBack(), 1200);
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold transition cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancel Load</span>
              </button>
            )
          )}

          {booking && (
            <button
              onClick={() => onViewInvoice(booking.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>GST Invoice</span>
            </button>
          )}

          {booking && (
            <button
              onClick={() => setShowRatingModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition cursor-pointer ${
                feedback
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
              }`}
              title="Rate driver on punctuality, vehicle condition & communication"
            >
              <Star className={`w-3.5 h-3.5 ${feedback ? 'fill-amber-400 text-amber-400' : 'fill-slate-950 text-slate-950'}`} />
              <span>{feedback ? `${feedback.overallRating}★ Rated` : 'Rate Driver'}</span>
            </button>
          )}

          {onOpenSupport && (
            <button
              onClick={() => onOpenSupport(load.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm hover:border-amber-500/50"
              title="Report an issue or ask questions about this consignment"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-amber-400" />
              <span>Report Issue</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-medium border ${
          actionMessage.error
            ? 'bg-rose-950/80 text-rose-200 border-rose-800'
            : 'bg-emerald-950/80 text-emerald-200 border-emerald-800'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Shipment Progress Stepper */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-800 -z-0"></div>
            <div
              className="absolute top-4 left-6 h-0.5 bg-amber-500 transition-all duration-500 -z-0"
              style={{ width: `${(activeStepIdx / (statusSteps.length - 1)) * 92}%` }}
            ></div>

            {statusSteps.map((s, idx) => {
              const isPast = idx < activeStepIdx;
              const isCurrent = idx === activeStepIdx;
              return (
                <div key={s.key} className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                    isPast
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurrent
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[11px] font-semibold mt-2 ${
                    isCurrent ? 'text-amber-400 font-bold' : isPast ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Map Tracking Panel (If In Transit / Assigned) */}
      {isTrackingAvailable && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Vehicle GPS Telemetry & Route
            </h3>
            {load.deliveryOtp && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-amber-500/30">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs text-slate-300">Delivery Confirmation OTP:</span>
                <span className="text-xs font-mono font-black text-amber-400 tracking-wider">
                  {load.deliveryOtp}
                </span>
              </div>
            )}
          </div>

          <ShipperLiveTrackingScreen
            tripId={load.assignedBookingId || `trip_${load.id}`}
            loadId={load.id}
            initialTrackingToken={booking?.trackingToken}
            onOpenDriverSimulator={(tId, tok) => {
              setSimulatorTripId(tId);
              setSimulatorToken(tok || booking?.trackingToken || '');
              setShowDriverSimulator(true);
            }}
          />
        </div>
      )}

      {/* Load Summary & Route Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Origin & Destination Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Route & Transit Corridor</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <MapPin className="w-4 h-4" />
                  <span>Pickup Origin</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{load.pickup.city}, {load.pickup.state}</div>
                <div className="text-xs text-slate-400">{load.pickup.address}</div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{load.pickup.contactName} ({load.pickup.contactPhone})</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                  <MapPin className="w-4 h-4" />
                  <span>Delivery Destination</span>
                </div>
                <div className="text-sm font-bold text-slate-100">{load.delivery.city}, {load.delivery.state}</div>
                <div className="text-xs text-slate-400">{load.delivery.address}</div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/60 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{load.delivery.contactName} ({load.delivery.contactPhone})</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {booking?.liveEta && load.status !== 'completed' && load.status !== 'delivered'
                    ? 'Live Distance Left'
                    : 'Estimated Distance'}
                </span>
                <span className="text-amber-400 font-bold font-mono tabular-nums text-sm">
                  {booking?.liveEta && load.status !== 'completed' && load.status !== 'delivered'
                    ? `${booking.liveEta.distanceKm} km`
                    : `${load.estimatedDistanceKm} km`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {booking?.liveEta && load.status !== 'completed' && load.status !== 'delivered'
                    ? 'Live Destination ETA'
                    : 'Estimated Duration'}
                </span>
                <span className="text-emerald-400 font-bold font-mono tabular-nums text-sm">
                  {booking?.liveEta && load.status !== 'completed' && load.status !== 'delivered'
                    ? `${booking.liveEta.formattedArrivalTime} (${booking.liveEta.formattedDuration})`
                    : `${load.estimatedDurationHours} hrs`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Pickup Date</span>
                <span className="text-slate-200 font-bold text-xs">{new Date(load.pickupDateTime).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Cargo Specs */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl text-xs">
            <h3 className="font-bold text-slate-400 uppercase tracking-wider">Cargo & Compliance</h3>
            <p className="text-sm font-semibold text-slate-200">{load.goodsDescription}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Gross Weight</span>
                <span className="text-slate-100 font-bold font-mono text-sm">{load.weightKg} kg</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Package Count</span>
                <span className="text-slate-100 font-bold font-mono text-sm">{load.packageCount} pkgs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Declared Goods Value</span>
                <span className="text-amber-400 font-bold font-mono text-sm">₹{load.declaredValueInr.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">e-Way Bill No.</span>
                <span className="text-slate-200 font-mono text-xs">{load.specialRequirements.eWayBillNumber || 'Exempt / Not provided'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Bids Comparison OR Confirmed Booking Details */}
        <div className="space-y-4">
          {booking ? (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Assigned Transporter</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                  Confirmed
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-400">Transporter Fleet:</div>
                  <div className="text-sm font-bold text-slate-100">{assignedTransporterName}</div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vehicle Assigned:</span>
                  <span className="font-mono font-bold text-amber-400">{assignedVehicleReg}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Driver Contact:</span>
                  <span className="font-semibold text-slate-200">
                    {assignedDriverName} {assignedDriverPhone ? `(${assignedDriverPhone})` : ''}
                  </span>
                </div>

                {/* 1-Tap Direct Call, WhatsApp Driver & Share Delivery OTP */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {assignedDriverPhone && (
                    <>
                      <a
                        href={`tel:${assignedDriverPhone.replace(/\s+/g, '')}`}
                        className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Driver</span>
                      </a>
                      <a
                        href={`https://wa.me/91${assignedDriverPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                          `Namaste ${assignedDriverName}, regarding Zuggi Booking #${booking.id} (${load.pickup.city} to ${load.delivery.city}, Vehicle: ${assignedVehicleReg}).`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp Driver</span>
                      </a>
                    </>
                  )}
                  {load.deliveryOtp && (
                    <a
                      href={`https://wa.me/${load.delivery.contactPhone ? '91' + load.delivery.contactPhone.replace(/\D/g, '').slice(-10) : ''}?text=${encodeURIComponent(
                        `Zuggi Shipment Update:\nRoute: ${load.pickup.city} → ${load.delivery.city}\nTruck: ${assignedVehicleReg}\nDriver: ${assignedDriverName} (${assignedDriverPhone || 'Assigned'})\nSecret Delivery OTP: ${load.deliveryOtp}\nShare this OTP with the driver ONLY after receiving & verifying the goods.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Share Truck Details &amp; Delivery OTP on WhatsApp</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Agreed Fare:</span>
                  <span className="font-bold text-base text-emerald-400 font-mono">
                    ₹{(Number(booking.totalAgreedAmountInr) || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* SHIPPER POD APPROVAL & 2-HOUR AUTO-RELEASE BANNER */}
                <ShipperPodApprovalBanner
                  tripId={booking.id}
                  ledger={escrowLedger}
                  tranches={escrowTranches}
                  podUploadedFallback={Boolean(
                    booking.podDocumentUrl ||
                      booking.status === 'delivered' ||
                      booking.status === 'completed'
                  )}
                  onLedgerUpdated={(nextLedger, nextTranches) => {
                    setEscrowLedger(nextLedger);
                    setEscrowTranches(nextTranches);
                  }}
                />

                {/* CASHFREE 70% LOADING ADVANCE + 30% POD BALANCE ESCROW BREAKDOWN */}
                <ShipperCheckoutBreakdownCard
                  tripId={booking.id}
                  totalFreightInr={Number(booking.totalAgreedAmountInr) || 0}
                  driverId={booking.driverId}
                  vendorName={assignedTransporterName}
                  customerName={currentUser?.name}
                  customerPhone={currentUser?.phone}
                  customerEmail={currentUser?.email}
                  ledger={escrowLedger}
                  tranches={escrowTranches}
                  vendor={escrowVendor}
                  onLedgerUpdated={(nextLedger, nextTranches) => {
                    setEscrowLedger(nextLedger);
                    setEscrowTranches(nextTranches);
                  }}
                  compact
                />

                {/* PRACTICAL 2-STEP FREIGHT PAYMENT CARD */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Freight Payment (2 Steps)</span>
                    </div>
                    <span className="text-[11px] text-slate-400">90% Pickup · 10% Delivery</span>
                  </div>

                  {/* Step 1: 90% Advance */}
                  {(() => {
                    const advAmt = booking.customerAdvanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.90);
                    const advStatus = booking.paymentAdvanceStatus;
                    const advMethod = booking.advancePaymentMethod;
                    const isPaid = advStatus === 'paid';
                    const isProcessing = advStatus === 'processing';
                    const isDirect = advMethod === 'pay_driver_direct';
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60 gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {isPaid ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : isProcessing ? (
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-amber-500/80 shrink-0" />
                              )}
                              <span>Step 1: 90% Advance</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                              {isPaid
                                ? isDirect
                                  ? 'Paid directly to driver at pickup'
                                  : booking.advancePaymentUtr
                                  ? `Verified · UTR ${booking.advancePaymentUtr}`
                                  : 'Verified & Paid'
                                : isProcessing
                                ? isDirect
                                  ? 'Pay driver at pickup · Driver will confirm receipt'
                                  : `UTR ${booking.advancePaymentUtr || ''} · Verifying with Zuggi Admin`
                                : 'Pay via UPI, Bank Transfer, or Pay Driver at Pickup'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono tabular-nums font-bold text-emerald-400 text-xs">
                              ₹{advAmt.toLocaleString('en-IN')}
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                isPaid ? 'text-emerald-400' : isProcessing ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            >
                              {isPaid
                                ? 'Paid'
                                : isProcessing
                                ? isDirect
                                  ? 'Pay at Pickup'
                                  : 'Verifying UTR'
                                : 'Unpaid'}
                            </span>
                          </div>
                        </div>

                        {booking.advanceRejectionNote && !isPaid && !isProcessing && (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                            <strong>Re-submit needed:</strong> {booking.advanceRejectionNote}
                          </div>
                        )}

                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => setEscrowModalStage('advance_90')}
                            className={`w-full min-h-[40px] px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                              isProcessing
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>
                              {isProcessing
                                ? 'Change Payment Method / Update UTR'
                                : `Pay 90% Advance (₹${advAmt.toLocaleString('en-IN')})`}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Step 2: 10% Final Balance */}
                  {(() => {
                    const balAmt = booking.customerBalanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.10);
                    const balStatus = booking.paymentBalanceStatus;
                    const balMethod = booking.balancePaymentMethod;
                    const isPaid = balStatus === 'paid';
                    const isProcessing = balStatus === 'processing';
                    const isDirect = balMethod === 'pay_driver_direct';
                    const canPayBalance =
                      !isPaid &&
                      (load.status === 'at_destination' ||
                        load.status === 'delivered' ||
                        load.status === 'completed' ||
                        booking.status === 'at_destination' ||
                        booking.status === 'delivered' ||
                        booking.status === 'completed');

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60 gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {isPaid ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : isProcessing ? (
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                              )}
                              <span>Step 2: 10% Final Balance</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                              {isPaid
                                ? isDirect
                                  ? 'Paid directly to driver at delivery'
                                  : booking.balancePaymentUtr
                                  ? `Verified · UTR ${booking.balancePaymentUtr}`
                                  : 'Verified & Paid'
                                : isProcessing
                                ? isDirect
                                  ? 'Pay driver at delivery · Driver will confirm receipt'
                                  : `UTR ${booking.balancePaymentUtr || ''} · Verifying with Zuggi Admin`
                                : 'Pay upon safe delivery & unloading'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono tabular-nums font-bold text-slate-200 text-xs">
                              ₹{balAmt.toLocaleString('en-IN')}
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                isPaid ? 'text-emerald-400' : isProcessing ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            >
                              {isPaid
                                ? 'Paid'
                                : isProcessing
                                ? isDirect
                                  ? 'Pay at Delivery'
                                  : 'Verifying UTR'
                                : 'On Delivery'}
                            </span>
                          </div>
                        </div>

                        {booking.balanceRejectionNote && !isPaid && !isProcessing && (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                            <strong>Re-submit needed:</strong> {booking.balanceRejectionNote}
                          </div>
                        )}

                        {canPayBalance && (
                          <button
                            type="button"
                            onClick={() => setEscrowModalStage('balance_10')}
                            className={`w-full min-h-[40px] px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                              isProcessing
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>
                              {isProcessing
                                ? 'Change Payment Method / Update UTR'
                                : `Pay 10% Final Balance (₹${balAmt.toLocaleString('en-IN')})`}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Active Dispute Alert if any */}
                  {booking.dispute && (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING') && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1 text-rose-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Driver Final Payout On Hold (Dispute Open)</span>
                      </div>
                      <p className="text-[10px] text-rose-300/80">
                        Reason: {booking.dispute.reason.replace(/_/g, ' ').toUpperCase()} — ₹{booking.dispute.heldAmountInr.toLocaleString('en-IN')} held pending Admin review.
                      </p>
                    </div>
                  )}

                  {/* Receipt & Dispute Action Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setShowReceiptModal(true)}
                      className="min-h-[38px] px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border border-slate-800 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Payment Receipt</span>
                    </button>

                    {(!booking.dispute || booking.dispute.status === 'RESOLVED_RELEASED') && (
                      <button
                        type="button"
                        onClick={() => setShowDisputeModal(true)}
                        className="min-h-[38px] px-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border border-slate-800 hover:border-rose-800/50 cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>Raise Dispute</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  <button
                    onClick={() => onViewInvoice(booking.id)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download GST Tax Invoice</span>
                  </button>

                  {/* Post-Trip Rating & Feedback Card */}
                  {feedback ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Star className="w-4 h-4 fill-amber-400" />
                          <span>Your Rating: {feedback.overallRating}★ / 5.0</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowRatingModal(true)}
                          className="text-[11px] text-amber-300 hover:underline font-semibold cursor-pointer"
                        >
                          Edit Review
                        </button>
                      </div>

                      {/* 3 Core Criteria Breakdown */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-slate-950/70 p-2 rounded-lg font-mono">
                        <div>
                          <span className="text-slate-400 block">Punctuality</span>
                          <span className="text-amber-400 font-bold">{feedback.punctualityRating}★</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Vehicle</span>
                          <span className="text-amber-400 font-bold">{feedback.vehicleConditionRating}★</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Comm</span>
                          <span className="text-amber-400 font-bold">{feedback.communicationRating}★</span>
                        </div>
                      </div>

                      {feedback.tags && feedback.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {feedback.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-amber-300/90 border border-amber-500/20">
                              ✓ {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {feedback.reviewComments && (
                        <p className="text-[11px] text-slate-300 italic line-clamp-2">
                          &quot;{feedback.reviewComments}&quot;
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowRatingModal(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-98"
                    >
                      <Star className="w-4 h-4 fill-slate-950" />
                      <span>{load.status === 'completed' || booking.status === 'completed' ? 'Rate Driver (Punctuality, Vehicle & Comm)' : 'Rate Driver & Service'}</span>
                    </button>
                  )}

                  {/* Simulator for Testing Complete Delivery with OTP */}
                  {booking.status !== 'completed' && load.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => {
                        const podUrl = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80';
                        logisticsStore.verifyDeliveryOtpAndComplete(booking.id, booking.deliveryOtp, podUrl);
                        setActionMessage({ text: 'Consignee OTP verified & delivery completed! You can now submit post-trip rating.' });
                        setTimeout(() => setActionMessage(null), 5000);
                      }}
                      className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700/80 hover:border-emerald-500/40"
                      title="Simulate OTP verification and advance to completed state"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Simulate Consignee OTP & Complete Trip</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Quotations / Bidding Section */
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Quotations Received</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black">
                    {quotations.length}
                  </span>
                </h3>
                <span className="text-xs text-slate-400">Marketplace Bids</span>
              </div>

              {quotations.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  <Truck className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-bounce" />
                  <p>Matching with commercial vehicles in the area...</p>
                  <p className="text-[11px] text-slate-600 mt-1">Transporters will submit quotes shortly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotations.map((quote) => (
                    <div
                      key={quote.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-100">{quote.transporterName}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-amber-400 font-semibold">{quote.vehicleRegNumber}</span>
                            <span>•</span>
                            <span className="flex items-center text-amber-400">
                              <Star className="w-3 h-3 fill-current" /> {quote.driverRating}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-base font-extrabold text-emerald-400 font-mono">
                            ₹{quote.quoteAmountInr.toLocaleString('en-IN')}
                          </div>
                          {quote.counterOfferAmountInr && (
                            <div className="text-[10px] text-amber-400 font-mono">
                              Countered: ₹{quote.counterOfferAmountInr.toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      </div>

                      {quote.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded-lg">
                          &quot;{quote.notes}&quot;
                        </p>
                      )}

                      {/* Bid Actions or Result Status */}
                      {quote.status === 'accepted' ? (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Accepted - Driver Assigned</span>
                          </span>
                          <span className="text-[10px] uppercase font-mono text-emerald-300/80">Active Assignment</span>
                        </div>
                      ) : quote.status === 'rejected' ? (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400 font-semibold text-xs">
                          <span className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>Bid Declined</span>
                          </span>
                          <span className="text-[10px] text-rose-400/70">Declined</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleAcceptQuotation(quote.id)}
                            disabled={processingQuoteId === quote.id || (load.status !== 'posted' && load.status !== 'bidding')}
                            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {processingQuoteId === quote.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                                <span>Assigning...</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Accept & Book</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleRejectQuotation(quote.id)}
                            disabled={processingQuoteId === quote.id}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 hover:border-rose-700/50 text-slate-300 font-medium text-xs border border-slate-700/80 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Decline this quotation"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Decline</span>
                          </button>

                          <button
                            onClick={() => {
                              setCounterQuoteId(quote.id);
                              setCounterAmount(Math.round(quote.quoteAmountInr * 0.92));
                            }}
                            disabled={processingQuoteId === quote.id}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium text-xs transition cursor-pointer disabled:opacity-50"
                          >
                            Counter Offer
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Counter-offer modal */}
      {counterQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleSendCounterOffer}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Send Counter-Offer</h4>
              <button
                type="button"
                onClick={() => setCounterQuoteId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Your Offered Amount (₹)</label>
              <input
                type="number"
                value={counterAmount}
                onChange={(e) => setCounterAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Message Note for Driver (Optional)</label>
              <input
                type="text"
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
                placeholder="e.g., Quick loading ready at warehouse..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCounterQuoteId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
              >
                Submit Offer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Post-Trip Rating & Feedback Modal */}
      {showRatingModal && booking && currentUser && (
        <TripFeedbackModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          booking={booking}
          load={load}
          currentUser={currentUser}
          onFeedbackSubmitted={(f) => {
            setFeedback(f);
            setActionMessage({ text: '⭐ Driver feedback published successfully! Transporter rating updated.' });
            setTimeout(() => setActionMessage(null), 4000);
          }}
        />
      )}

      {/* Cashfree Easy Split Escrow Payment Modal */}
      {escrowModalStage && booking && currentUser && (
        <CashfreeEscrowModal
          booking={booking}
          stage={escrowModalStage}
          currentUser={currentUser}
          onClose={() => setEscrowModalStage(null)}
          onPaymentSuccess={(msg) => {
            setActionMessage({ text: msg });
            setTimeout(() => setActionMessage(null), 6000);
          }}
        />
      )}

      {/* Raise Dispute Modal */}
      {showDisputeModal && booking && (
        <RaiseDisputeModal
          booking={booking}
          onClose={() => setShowDisputeModal(false)}
          onDisputeRaised={(msg) => {
            setActionMessage({ text: msg });
            setTimeout(() => setActionMessage(null), 6000);
          }}
        />
      )}

      {/* Payment Receipt Modal */}
      {showReceiptModal && booking && (
        <PaymentReceiptModal
          booking={booking}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* Driver GPS Pinger & Offline Buffer Simulator Modal */}
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
