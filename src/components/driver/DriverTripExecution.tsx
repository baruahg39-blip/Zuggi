import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  Phone, 
  Upload, 
  CheckCircle2, 
  Navigation, 
  ShieldCheck, 
  AlertCircle, 
  Radio, 
  FileText, 
  KeyRound, 
  Camera,
  LocateFixed,
  Lock,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { Booking, GeofenceEvent, GeofenceZoneConfig, GeofenceZoneState, LoadItem } from '../../types';
import { logisticsStore } from '../../services/store';
import { LiveTrackingMap } from '../maps/LiveTrackingMap';
import { GeofenceMonitorPanel } from '../tracking/GeofenceMonitorPanel';
import { showToast } from '../shared/Toast';

interface DriverTripExecutionProps {
  bookingId: string;
  onBack: () => void;
  onTripCompleted: () => void;
}

export const DriverTripExecution: React.FC<DriverTripExecutionProps> = ({
  bookingId,
  onBack,
  onTripCompleted
}) => {
  const [booking, setBooking] = useState<Booking | undefined>(() => logisticsStore.getBookingById(bookingId));
  const [load, setLoad] = useState<LoadItem | undefined>(undefined);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState<string>('');
  const [podPhotoUploaded, setPodPhotoUploaded] = useState<boolean>(false);
  const [loadingProofUploaded, setLoadingProofUploaded] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [simStep, setSimStep] = useState(5);
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceZoneConfig>(() => logisticsStore.getGeofenceConfig(bookingId));
  const [geofenceState, setGeofenceState] = useState<GeofenceZoneState>(() => logisticsStore.getGeofenceState(bookingId));
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>(() => logisticsStore.getGeofenceEvents(bookingId));

  useEffect(() => {
    const update = () => {
      const b = logisticsStore.getBookingById(bookingId);
      setBooking(b);
      if (b) {
        setLoad(logisticsStore.getLoadById(b.loadId));
        if (b.podDocumentUrl) setPodPhotoUploaded(true);
        if (b.loadingProofUrl) setLoadingProofUploaded(true);
      }
      setGeofenceConfig(logisticsStore.getGeofenceConfig(bookingId));
      setGeofenceState(logisticsStore.getGeofenceState(bookingId));
      setGeofenceEvents(logisticsStore.getGeofenceEvents(bookingId));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [bookingId]);

  // Ensure backend /trips record exists & obtain tracking token if missing
  const ensureBackendTripToken = useCallback(async (b: Booking, l: LoadItem): Promise<string | null> => {
    try {
      const liveRes = await fetch(`/trips/${b.id}/live-tracking`);
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (liveData?.tracking_token) {
          logisticsStore.setBookingTrackingToken(b.id, liveData.tracking_token);
          return liveData.tracking_token;
        }
      }
      const veh = logisticsStore.getVehicleById(b.vehicleId);
      const drv = logisticsStore.getUserById(b.driverId);
      const assignRes = await fetch(`/trips/${b.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: l.id,
          vehicle_id: b.vehicleId,
          driver_id: b.driverId,
          vehicle_number: veh?.registrationNumber,
          vehicle_type: veh?.category,
          driver_name: veh?.driverName || drv?.name,
          driver_phone: veh?.driverPhone || drv?.phone,
          owner_id: b.transporterId,
          tracking_source: 'MOBILE_APP',
          pickup: b.pickup,
          drop: b.delivery
        })
      });
      const assignData = await assignRes.json();
      const tok = assignData?.trip?.tracking_token;
      if (tok) {
        logisticsStore.setBookingTrackingToken(b.id, tok);
        return tok;
      }
    } catch {
      // Ignore network fallback
    }
    return b.trackingToken || null;
  }, []);

  const syncStatusToServer = useCallback(async (b: Booking, nextStatus: Booking['status']) => {
    const statusMap: Record<string, string> = {
      assigned: 'ASSIGNED',
      en_route_pickup: 'ASSIGNED',
      at_pickup: 'AT_PICKUP',
      loading: 'AT_PICKUP',
      in_transit: 'IN_TRANSIT',
      at_destination: 'IN_TRANSIT',
      delivered: 'DELIVERED',
      completed: 'DELIVERED'
    };
    const backendStatus = statusMap[nextStatus];
    if (!backendStatus) return;
    try {
      await fetch(`/trips/${b.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: backendStatus })
      });
    } catch {
      // Ignore offline
    }
  }, []);

  useEffect(() => {
    if (booking && load && !booking.trackingToken) {
      ensureBackendTripToken(booking, load);
    }
  }, [booking?.id, booking?.trackingToken, load?.id, ensureBackendTripToken]);

  if (!booking || !load) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Trip booking not found.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs">
          Return
        </button>
      </div>
    );
  }

  // Broadcast either real device GPS or next interpolated route point
  const handleBroadcastGps = async () => {
    if (!booking || !load) return;
    const transmitPoint = async (lat: number, lng: number, speed: number, landmark: string) => {
      const now = new Date().toISOString();
      const localEvents = logisticsStore.recordLocationPing({
        bookingId: booking.id,
        lat,
        lng,
        speedKmh: speed,
        heading: 240,
        timestamp: now,
        batteryLevel: 88,
        isGpsReliable: true,
        nearLandmark: landmark
      });
      localEvents.forEach((evt) => showToast(evt.message, 'info'));

      const token = await ensureBackendTripToken(booking, load);
      if (token) {
        try {
          const pingRes = await fetch(`/trips/${booking.id}/location-ping`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              lat,
              lng,
              speed,
              heading: 240,
              battery_level: 88,
              recorded_at: now
            })
          });
          if (pingRes.ok) {
            const pingData = await pingRes.json();
            if (Array.isArray(pingData?.geofence_events_triggered)) {
              logisticsStore.ingestServerGeofenceEvents(
                booking.id,
                pingData.geofence_events_triggered,
                pingData.geofence_state,
                pingData.geofence_config
              );
            }
          }
        } catch {
          // Offline buffered in store
        }
      }
      const msg = localEvents.length > 0
        ? localEvents[0].message
        : `Live GPS ping transmitted (${lat.toFixed(4)}, ${lng.toFixed(4)}) @ ${speed} km/h`;
      setStatusFeedback({ text: msg });
      showToast(msg, 'success');
    };

    const progress = Math.min(0.95, 0.25 + (simStep % 6) * 0.14);
    setSimStep((s) => s + 1);
    const interpLat = booking.pickup.lat + (booking.delivery.lat - booking.pickup.lat) * progress;
    const interpLng = booking.pickup.lng + (booking.delivery.lng - booking.pickup.lng) * progress;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          transmitPoint(
            pos.coords.latitude,
            pos.coords.longitude,
            Math.max(42, Math.round((pos.coords.speed || 12) * 3.6)),
            'Device Live GPS'
          );
        },
        () => {
          transmitPoint(interpLat, interpLng, 48, `Highway Transit (${Math.round(progress * 100)}% to ${booking.delivery.city})`);
        },
        { timeout: 2500 }
      );
    } else {
      await transmitPoint(interpLat, interpLng, 48, `Highway Transit (${Math.round(progress * 100)}% to ${booking.delivery.city})`);
    }
  };

  // Handle advancing through the 11-step driver workflow
  const handleAdvanceMilestone = (nextStatus: Booking['status']) => {
    const res = logisticsStore.updateBookingMilestone(booking.id, nextStatus, {
      loadingProofUrl: loadingProofUploaded
        ? 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
        : undefined
    });

    if (res.success) {
      syncStatusToServer(booking, nextStatus);
      const msg = `Milestone updated to: ${nextStatus.replace('_', ' ').toUpperCase()}`;
      setStatusFeedback({ text: msg });
      showToast(msg, 'success');
      setTimeout(() => setStatusFeedback(null), 4000);
    } else {
      setStatusFeedback({ text: res.message, error: true });
      showToast(res.message, 'error');
    }
  };

  // Complete trip via delivery OTP check & POD
  const handleVerifyOtpAndComplete = (e: React.FormEvent) => {
    e.preventDefault();

    if (!podPhotoUploaded) {
      const err = 'Proof of Delivery (POD) photo is mandatory before completing trip.';
      setStatusFeedback({
        text: err,
        error: true
      });
      showToast(err, 'error');
      return;
    }

    const podUrl = 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80';
    const res = logisticsStore.verifyDeliveryOtpAndComplete(booking.id, deliveryOtpInput, podUrl);

    if (res.success) {
      syncStatusToServer(booking, 'completed');
      const msg = 'Trip verified & successfully completed! Payout settled.';
      setStatusFeedback({ text: msg });
      showToast(msg, 'success');
      setTimeout(() => {
        onTripCompleted();
      }, 1500);
    } else {
      setStatusFeedback({ text: res.message, error: true });
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Driver Mode</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Current Trip Stage:</span>
          <span className="text-xs font-black uppercase px-2.5 py-1 rounded-full bg-amber-500 text-slate-950">
            {booking.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {statusFeedback && (
        <div className={`p-4 rounded-xl text-xs font-bold border ${
          statusFeedback.error
            ? 'bg-rose-950/90 text-rose-200 border-rose-800'
            : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
        }`}>
          {statusFeedback.text}
        </div>
      )}

      {/* Main Map Visualizer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-bold flex items-center gap-1.5 text-white">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            Live Navigation & Tracking
          </span>
          <span className="font-mono text-slate-400">
            Vehicle: {logisticsStore.getVehicleById(booking.vehicleId)?.registrationNumber || 'Commercial Truck'}
          </span>
        </div>

        <LiveTrackingMap
          bookingId={booking.id}
          pickup={booking.pickup}
          delivery={booking.delivery}
          vehicleRegNumber={logisticsStore.getVehicleById(booking.vehicleId)?.registrationNumber || 'Commercial Truck'}
          driverName={logisticsStore.getVehicleById(booking.vehicleId)?.driverName || 'Assigned Driver'}
          shipmentStatus={booking.status}
          isDriverMode={true}
        />
      </div>

      {/* Large-Button Touch Workflow Action Box */}
      <div className="p-6 rounded-3xl bg-slate-900 border-2 border-amber-500/40 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            <span>Driver Trip Actions</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Net Earnings (95%): <span className="text-emerald-400 font-bold">₹{booking.netDriverPayableInr.toLocaleString('en-IN')}</span>
          </span>
        </div>

        {/* CASHFREE EASY SPLIT ESCROW & PAYOUT STATUS BANNER */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Cashfree Easy Split Escrow Tracker</span>
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              Fare: ₹{booking.totalAgreedAmountInr.toLocaleString('en-IN')} (5% Fee: ₹{booking.platformCommissionInr.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Stage 1: 90% */}
            <div className={`p-2.5 rounded-xl border ${
              booking.payoutStage1Status === 'settled'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : booking.paymentAdvanceStatus === 'paid'
                ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
            }`}>
              <div className="font-bold flex items-center gap-1">
                {booking.payoutStage1Status === 'settled' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Stage 1 (90%): ₹{(booking.driverFirstPayoutInr || Math.round(booking.netDriverPayableInr * 0.90)).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {booking.payoutStage1Status === 'settled'
                  ? 'Credited to your bank account'
                  : booking.paymentAdvanceStatus === 'paid'
                  ? 'Escrowed by customer. Releases at pickup.'
                  : 'Awaiting customer 90% advance deposit'}
              </p>
            </div>

            {/* Stage 2: 10% */}
            <div className={`p-2.5 rounded-xl border ${
              booking.dispute && (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING')
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : booking.payoutStage2Status === 'settled'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}>
              <div className="font-bold flex items-center gap-1">
                {booking.dispute && (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING') ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                ) : booking.payoutStage2Status === 'settled' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Stage 2 (10%): ₹{(booking.driverFinalPayoutInr || Math.round(booking.netDriverPayableInr * 0.10)).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {booking.dispute && (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING')
                  ? 'HELD: Customer raised cargo dispute'
                  : booking.payoutStage2Status === 'settled'
                  ? 'Credited to your bank account'
                  : 'Releases after POD & customer balance'}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Action according to trip stage */}
        {booking.status === 'assigned' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="text-amber-400 font-bold block">STEP 1: Head to Pickup Location</span>
              <p>Proceed to: <strong className="text-white">{booking.pickup.address}, {booking.pickup.city}</strong></p>
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consignor: {booking.pickup.contactName} ({booking.pickup.contactPhone})</span>
              </div>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('en_route_pickup')}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Navigation className="w-5 h-5 fill-slate-950" />
              <span>Start Heading to Pickup</span>
            </button>
          </div>
        )}

        {booking.status === 'en_route_pickup' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="text-amber-400 font-bold block">STEP 2: Arrived at Pickup</span>
              <p>When you reach the warehouse gate or factory premises, mark arrival.</p>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('at_pickup')}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MapPin className="w-5 h-5 fill-slate-950" />
              <span>Mark Arrived at Pickup</span>
            </button>
          </div>
        )}

        {(booking.status === 'at_pickup' || booking.status === 'loading') && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
              <span className="text-amber-400 font-bold block">STEP 3: Loading Goods onto Truck</span>
              <p>Verify carton / sack count: <strong className="text-white">{load.packageCount} packages ({load.weightKg} kg)</strong></p>

              {/* Upload Proof of Loading */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setLoadingProofUploaded(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                    loadingProofUploaded
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{loadingProofUploaded ? '✓ Loading Photo Attached' : 'Attach Photo of Loaded Truck'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('in_transit')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Truck className="w-5 h-5 fill-slate-950" />
              <span>Confirm Loading & Start Journey</span>
            </button>
          </div>
        )}

        {booking.status === 'in_transit' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">STEP 4: En Route in Transit</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                  GPS Active
                </span>
              </div>
              <p>Transit to destination: <strong className="text-white">{booking.delivery.address}, {booking.delivery.city}</strong></p>
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Consignee Contact: {booking.delivery.contactName} ({booking.delivery.contactPhone})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleAdvanceMilestone('at_destination')}
                className="py-4 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <MapPin className="w-5 h-5 fill-slate-950" />
                <span>Mark Reached Destination</span>
              </button>

              <button
                onClick={handleBroadcastGps}
                className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LocateFixed className="w-4 h-4" />
                <span>Broadcast Live GPS Ping</span>
              </button>
            </div>
          </div>
        )}

        {(booking.status === 'at_destination' || booking.status === 'delivered') && (
          <form onSubmit={handleVerifyOtpAndComplete} className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
              <span className="text-amber-400 font-bold block">
                FINAL STEP: Proof of Delivery (POD) & Recipient Confirmation OTP
              </span>
              <p>Unload goods and verify condition with the receiver.</p>

              {/* Upload Proof of Delivery (POD) Photo / Signature */}
              <div>
                <button
                  type="button"
                  onClick={() => setPodPhotoUploaded(true)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                    podPhotoUploaded
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{podPhotoUploaded ? '✓ Proof of Delivery (POD) Signed & Uploaded' : 'Capture Signed POD / Bilty'}</span>
                </button>
              </div>

              {/* Consignee 4-Digit OTP Input */}
              <div className="pt-2">
                <label className="text-slate-300 block mb-1 font-semibold">
                  Ask Consignee for 4-Digit Delivery Confirmation OTP
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      maxLength={4}
                      value={deliveryOtpInput}
                      onChange={(e) => setDeliveryOtpInput(e.target.value)}
                      placeholder="e.g. 7412"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-center text-lg font-mono font-black tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  (Note for testing: Consignee OTP for this shipment is: <strong className="text-amber-300 font-mono">{booking.deliveryOtp}</strong>)
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5 fill-slate-950" />
              <span>Verify OTP & Complete Delivery</span>
            </button>
          </form>
        )}

        {booking.status === 'completed' && (
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-extrabold text-white">Trip Successfully Completed!</h3>
            <p className="text-xs text-emerald-300">
              Net earnings of ₹{booking.netDriverPayableInr.toLocaleString('en-IN')} have been settled to your registered bank account.
            </p>
            <button
              onClick={onBack}
              className="mt-2 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Return to Driver Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Live Auto-Milestone Geo-Fence Monitor */}
      <GeofenceMonitorPanel
        tripId={booking.id}
        pickupCity={booking.pickup.city}
        deliveryCity={booking.delivery.city}
        config={geofenceConfig}
        state={geofenceState}
        events={geofenceEvents}
        canEditConfig={false}
        darkTheme={true}
      />

      {/* Cargo & Shipment Summary Footer */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
        <h4 className="font-bold text-slate-400 uppercase tracking-wider">Cargo Particulars</h4>
        <div className="text-slate-200 font-semibold">{booking.goodsDescription}</div>
        <div className="text-slate-400 flex items-center gap-3 pt-1">
          <span>Weight: {booking.weightKg} kg</span>
          <span>•</span>
          <span>e-Way Bill: {load.specialRequirements?.eWayBillNumber || booking.eWayBillNumber || 'Exempt'}</span>
          <span>•</span>
          <span>Mode: {booking.paymentMode.replace('_', ' ').toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
