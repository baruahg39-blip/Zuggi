import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  MapPin,
  Truck,
  Phone,
  CheckCircle2,
  Navigation,
  Radio,
  KeyRound,
  Camera,
  LocateFixed,
  Lock,
  AlertTriangle,
  Clock,
  ExternalLink,
  Search,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { Booking, GeofenceEvent, GeofenceZoneConfig, GeofenceZoneState, LoadItem } from '../../types';
import { logisticsStore } from '../../services/store';
import { LiveTrackingMap } from '../maps/LiveTrackingMap';
import { GeofenceMonitorPanel } from '../tracking/GeofenceMonitorPanel';
import { showToast } from '../shared/Toast';

interface DriverTripExecutionProps {
  bookingId: string | null;
  onBack: () => void;
  onTripCompleted: () => void;
  onFindLoads?: () => void;
}

/** Compress a captured phone camera / gallery image to a lightweight JPEG Data URL */
async function compressImageFileToDataUrl(file: File, maxDim = 960, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image selected.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function buildGoogleMapsNavUrl(lat?: number, lng?: number, address?: string, city?: string): string {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  const q = encodeURIComponent([address, city].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export const DriverTripExecution: React.FC<DriverTripExecutionProps> = ({
  bookingId,
  onBack,
  onTripCompleted,
  onFindLoads
}) => {
  const [booking, setBooking] = useState<Booking | undefined>(() =>
    bookingId ? logisticsStore.getBookingById(bookingId) : undefined
  );
  const [load, setLoad] = useState<LoadItem | undefined>(undefined);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState<string>('');
  const [loadingProofDataUrl, setLoadingProofDataUrl] = useState<string | null>(null);
  const [podPhotoDataUrl, setPodPhotoDataUrl] = useState<string | null>(null);
  const [uploadingPhotoType, setUploadingPhotoType] = useState<'loading' | 'pod' | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const [simStep, setSimStep] = useState(5);
  const [autoGpsEnabled, setAutoGpsEnabled] = useState<boolean>(false);
  const [lastGpsPingTime, setLastGpsPingTime] = useState<string | null>(null);
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceZoneConfig>(() =>
    logisticsStore.getGeofenceConfig(bookingId || 'none')
  );
  const [geofenceState, setGeofenceState] = useState<GeofenceZoneState>(() =>
    logisticsStore.getGeofenceState(bookingId || 'none')
  );
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>(() =>
    logisticsStore.getGeofenceEvents(bookingId || 'none')
  );

  const loadingFileInputRef = useRef<HTMLInputElement | null>(null);
  const podFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastWatchSentAtRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      if (!bookingId) {
        setBooking(undefined);
        setLoad(undefined);
        return;
      }
      const b = logisticsStore.getBookingById(bookingId);
      setBooking(b);
      if (b) {
        setLoad(logisticsStore.getLoadById(b.loadId));
        if (b.podDocumentUrl) setPodPhotoDataUrl(b.podDocumentUrl);
        if (b.loadingProofUrl) setLoadingProofDataUrl(b.loadingProofUrl);
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

  const transmitGpsPoint = useCallback(
    async (
      b: Booking,
      l: LoadItem,
      lat: number,
      lng: number,
      speed: number,
      heading: number,
      landmark: string,
      silent = false
    ) => {
      const now = new Date().toISOString();
      const localEvents = logisticsStore.recordLocationPing({
        bookingId: b.id,
        lat,
        lng,
        speedKmh: speed,
        heading,
        timestamp: now,
        batteryLevel: 88,
        isGpsReliable: true,
        nearLandmark: landmark
      });
      localEvents.forEach((evt) => showToast(evt.message, 'info'));

      const token = await ensureBackendTripToken(b, l);
      if (token) {
        try {
          const pingRes = await fetch(`/trips/${b.id}/location-ping`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              lat,
              lng,
              speed,
              heading,
              battery_level: 88,
              recorded_at: now
            })
          });
          if (pingRes.ok) {
            const pingData = await pingRes.json();
            if (Array.isArray(pingData?.geofence_events_triggered)) {
              logisticsStore.ingestServerGeofenceEvents(
                b.id,
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

      setLastGpsPingTime(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );

      if (!silent) {
        const msg =
          localEvents.length > 0
            ? localEvents[0].message
            : `Live GPS ping transmitted (${lat.toFixed(4)}, ${lng.toFixed(4)}) @ ${speed} km/h`;
        setStatusFeedback({ text: msg });
        showToast(msg, 'success');
      }
    },
    [ensureBackendTripToken]
  );

  // Continuous phone GPS watchPosition when Auto Live GPS is toggled on during active driving stages
  useEffect(() => {
    if (!autoGpsEnabled || !booking || !load) return;
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      setAutoGpsEnabled(false);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Device GPS is unavailable on this browser.', 'error');
      setAutoGpsEnabled(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nowMs = Date.now();
        // Throttle pings to once every 12 seconds so battery & mobile data stay light
        if (nowMs - lastWatchSentAtRef.current < 12000) return;
        lastWatchSentAtRef.current = nowMs;
        const speedKmh = pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : 0;
        const heading = pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : 0;
        void transmitGpsPoint(
          booking,
          load,
          pos.coords.latitude,
          pos.coords.longitude,
          speedKmh,
          heading,
          'Phone Live GPS',
          true
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          showToast('Location permission denied. Allow GPS in phone settings to auto-track.', 'error');
          setAutoGpsEnabled(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [autoGpsEnabled, booking, load, transmitGpsPoint]);

  // Empty state when no active trip is assigned yet
  if (!booking || !load) {
    return (
      <div className="max-w-lg mx-auto my-6 p-7 bg-white rounded-3xl border border-gray-200 shadow-lg text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#FFF0F6] border border-[#E83E83]/25 flex items-center justify-center mx-auto text-[#E83E83]">
          <Navigation className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-[#171318]">No Active Trip Running</h2>
          <p className="text-xs sm:text-sm text-[#77717A] leading-relaxed">
            Once you accept an instant load or a shipper approves your freight quote, your live GPS trip console, navigation, and POD scanner will appear right here.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          {onFindLoads && (
            <button
              onClick={onFindLoads}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#E83E83]/25"
            >
              <Search className="w-4 h-4" />
              <span>Find Available Loads</span>
            </button>
          )}
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#171318] text-xs font-bold transition cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Handle capturing a real Loading Proof or Signed POD photo from phone camera / gallery
  const handlePhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'loading' | 'pod'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhotoType(type);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      if (type === 'loading') {
        setLoadingProofDataUrl(dataUrl);
        showToast('Loading photo captured & attached!', 'success');
      } else {
        setPodPhotoDataUrl(dataUrl);
        showToast('Signed POD / Bilty photo captured!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not process selected photo.', 'error');
    } finally {
      setUploadingPhotoType(null);
      e.target.value = '';
    }
  };

  // Manual single GPS ping (uses real phone GPS first, falls back to route interpolation if indoors/desktop)
  const handleBroadcastGps = async () => {
    const progress = Math.min(0.95, 0.25 + (simStep % 6) * 0.14);
    setSimStep((s) => s + 1);
    const interpLat = booking.pickup.lat + (booking.delivery.lat - booking.pickup.lat) * progress;
    const interpLng = booking.pickup.lng + (booking.delivery.lng - booking.pickup.lng) * progress;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void transmitGpsPoint(
            booking,
            load,
            pos.coords.latitude,
            pos.coords.longitude,
            Math.max(10, Math.round((pos.coords.speed || 10) * 3.6)),
            pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : 240,
            'Device Live GPS'
          );
        },
        () => {
          void transmitGpsPoint(
            booking,
            load,
            interpLat,
            interpLng,
            48,
            240,
            `Highway Transit (${Math.round(progress * 100)}% to ${booking.delivery.city})`
          );
        },
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      await transmitGpsPoint(
        booking,
        load,
        interpLat,
        interpLng,
        48,
        240,
        `Highway Transit (${Math.round(progress * 100)}% to ${booking.delivery.city})`
      );
    }
  };

  // Handle advancing through the driver workflow
  const handleAdvanceMilestone = (nextStatus: Booking['status']) => {
    const res = logisticsStore.updateBookingMilestone(booking.id, nextStatus, {
      loadingProofUrl: loadingProofDataUrl || undefined
    });

    if (res.success) {
      void syncStatusToServer(booking, nextStatus);
      const msg = `Milestone updated to: ${nextStatus.replace('_', ' ').toUpperCase()}`;
      setStatusFeedback({ text: msg });
      showToast(msg, 'success');
      if (nextStatus === 'en_route_pickup' || nextStatus === 'in_transit') {
        setAutoGpsEnabled(true);
      }
      setTimeout(() => setStatusFeedback(null), 4000);
    } else {
      setStatusFeedback({ text: res.message, error: true });
      showToast(res.message, 'error');
    }
  };

  // Complete trip via delivery OTP check & real captured POD photo
  const handleVerifyOtpAndComplete = (e: React.FormEvent) => {
    e.preventDefault();

    if (!podPhotoDataUrl) {
      const err = 'Please capture or upload the Signed Proof of Delivery (POD) photo first.';
      setStatusFeedback({ text: err, error: true });
      showToast(err, 'error');
      return;
    }

    const res = logisticsStore.verifyDeliveryOtpAndComplete(booking.id, deliveryOtpInput, podPhotoDataUrl);

    if (res.success) {
      setAutoGpsEnabled(false);
      void syncStatusToServer(booking, 'completed');
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

  const pickupNavUrl = buildGoogleMapsNavUrl(
    booking.pickup.lat,
    booking.pickup.lng,
    booking.pickup.address,
    booking.pickup.city
  );
  const dropNavUrl = buildGoogleMapsNavUrl(
    booking.delivery.lat,
    booking.delivery.lng,
    booking.delivery.address,
    booking.delivery.city
  );

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-24">
      {/* Hidden native camera / gallery file inputs */}
      <input
        ref={loadingFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handlePhotoSelected(e, 'loading')}
        className="hidden"
      />
      <input
        ref={podFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handlePhotoSelected(e, 'pod')}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#171318] border border-gray-800 text-xs font-bold text-white hover:bg-black transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Desk</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#77717A]">Stage:</span>
          <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-[#E83E83] text-white shadow-sm">
            {booking.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            statusFeedback.error
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {statusFeedback.text}
        </div>
      )}

      {/* Main Map Visualizer + Live Auto-GPS Controls */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-extrabold flex items-center gap-1.5 text-[#171318]">
            <Radio className={`w-4 h-4 ${autoGpsEnabled ? 'text-emerald-600 animate-pulse' : 'text-[#E83E83]'}`} />
            <span>Live Navigation &amp; GPS Telemetry</span>
            {lastGpsPingTime && (
              <span className="text-[10px] font-mono text-[#77717A] font-normal">
                (Last sent {lastGpsPingTime})
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {booking.status !== 'completed' && booking.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setAutoGpsEnabled((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                  autoGpsEnabled
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-white text-[#171318] border-gray-300 hover:bg-gray-50'
                }`}
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>{autoGpsEnabled ? 'Auto GPS: ON' : 'Start Auto GPS'}</span>
              </button>
            )}
            <span className="font-mono text-xs font-bold text-[#171318] bg-white px-2.5 py-1.5 rounded-xl border border-gray-200">
              {logisticsStore.getVehicleById(booking.vehicleId)?.registrationNumber || 'Commercial Truck'}
            </span>
          </div>
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
      <div className="p-5 sm:p-6 rounded-3xl bg-[#171318] border border-gray-800 shadow-2xl space-y-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-800">
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#E83E83]" />
            <span>Driver Trip Actions</span>
          </h2>
          <span className="text-xs text-gray-400 font-mono">
            Net Earnings (95%):{' '}
            <span className="text-emerald-400 font-bold">₹{booking.netDriverPayableInr.toLocaleString('en-IN')}</span>
          </span>
        </div>

        {/* PRACTICAL TRIP PAYMENT & PAYOUT STATUS */}
        {(() => {
          const activeUser = logisticsStore.getCurrentUser();
          const driverProfile = logisticsStore.getUserById(booking.driverId) || activeUser;
          const hasBankOrUpi = Boolean(
            driverProfile?.bankDetails?.upiId || driverProfile?.bankDetails?.accountNumber
          );
          const stage1Amt = booking.driverFirstPayoutInr || Math.round(booking.netDriverPayableInr * 0.9);
          const stage2Amt = booking.driverFinalPayoutInr || Math.round(booking.netDriverPayableInr * 0.1);
          const customerAdvAmt =
            booking.customerAdvanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.9);
          const customerBalAmt =
            booking.customerBalanceAmountInr || Math.round(booking.totalAgreedAmountInr * 0.1);

          const isStage1DirectPending =
            booking.paymentAdvanceStatus === 'processing' &&
            booking.advancePaymentMethod === 'pay_driver_direct';
          const isStage2DirectPending =
            booking.paymentBalanceStatus === 'processing' &&
            booking.balancePaymentMethod === 'pay_driver_direct';

          const handleConfirmDirect = (stage: 'advance_90' | 'balance_10') => {
            const res = logisticsStore.driverConfirmDirectPayment(
              booking.id,
              stage,
              activeUser?.id || booking.driverId
            );
            if (res.success) {
              showToast(res.message, 'success');
              setStatusFeedback({ text: res.message, error: false });
            } else {
              showToast(res.message, 'error');
              setStatusFeedback({ text: res.message, error: true });
            }
          };

          return (
            <div className="p-3.5 rounded-2xl bg-[#060309] border border-gray-800 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-[#FF85B7]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Trip Payment &amp; Payout Status</span>
                </span>
                <span className="text-gray-400 font-mono tabular-nums text-[10px]">
                  Fare: ₹{booking.totalAgreedAmountInr.toLocaleString('en-IN')} (5% Fee: ₹
                  {booking.platformCommissionInr.toLocaleString('en-IN')})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                {/* Step 1: 90% Pickup */}
                <div
                  className={`p-3 rounded-xl border space-y-2 ${
                    booking.payoutStage1Status === 'settled'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : isStage1DirectPending
                      ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                      : booking.paymentAdvanceStatus === 'paid'
                      ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                      : 'bg-gray-900/90 border-gray-800 text-gray-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {booking.payoutStage1Status === 'settled' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="font-mono tabular-nums">
                      Step 1 (90%): ₹{stage1Amt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-snug">
                    {booking.payoutStage1Status === 'settled'
                      ? booking.advancePaymentMethod === 'pay_driver_direct'
                        ? 'Confirmed collected directly from customer at pickup.'
                        : `Paid to your account${booking.stage1PayoutUtr ? ` · UTR ${booking.stage1PayoutUtr}` : ''}`
                      : isStage1DirectPending
                      ? `Customer will pay ₹${customerAdvAmt.toLocaleString('en-IN')} directly to you at pickup (Cash / UPI).`
                      : booking.paymentAdvanceStatus === 'paid'
                      ? 'Customer paid Zuggi. Admin will transfer your 90% payout to your UPI/Bank.'
                      : booking.paymentAdvanceStatus === 'processing'
                      ? 'Customer submitted UTR — Zuggi Admin is verifying.'
                      : 'Waiting for customer 90% advance payment.'}
                  </p>

                  {isStage1DirectPending && (
                    <button
                      type="button"
                      onClick={() => handleConfirmDirect('advance_90')}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition cursor-pointer"
                    >
                      Confirm ₹{customerAdvAmt.toLocaleString('en-IN')} Received at Pickup
                    </button>
                  )}
                </div>

                {/* Step 2: 10% Final Delivery */}
                <div
                  className={`p-3 rounded-xl border space-y-2 ${
                    booking.dispute &&
                    (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING')
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                      : booking.payoutStage2Status === 'settled'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : isStage2DirectPending
                      ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                      : booking.paymentBalanceStatus === 'paid'
                      ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                      : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {booking.dispute &&
                    (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING') ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : booking.payoutStage2Status === 'settled' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    )}
                    <span className="font-mono tabular-nums">
                      Step 2 (10%): ₹{stage2Amt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-snug">
                    {booking.dispute &&
                    (booking.dispute.status === 'OPEN' || booking.dispute.status === 'INVESTIGATING')
                      ? 'On hold: customer opened a delivery dispute.'
                      : booking.payoutStage2Status === 'settled'
                      ? booking.balancePaymentMethod === 'pay_driver_direct'
                        ? 'Confirmed collected directly from customer at delivery.'
                        : `Paid to your account${booking.stage2PayoutUtr ? ` · UTR ${booking.stage2PayoutUtr}` : ''}`
                      : isStage2DirectPending
                      ? `Customer will pay ₹${customerBalAmt.toLocaleString('en-IN')} directly to you at delivery (Cash / UPI).`
                      : booking.paymentBalanceStatus === 'paid'
                      ? 'Customer paid Zuggi. Admin will transfer your 10% final payout.'
                      : booking.paymentBalanceStatus === 'processing'
                      ? 'Customer submitted balance UTR — Zuggi Admin is verifying.'
                      : 'Due after delivery & POD confirmation.'}
                  </p>

                  {isStage2DirectPending && (
                    <button
                      type="button"
                      onClick={() => handleConfirmDirect('balance_10')}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition cursor-pointer"
                    >
                      Confirm ₹{customerBalAmt.toLocaleString('en-IN')} Received at Delivery
                    </button>
                  )}
                </div>
              </div>

              {(Number(booking.driverCommissionDueInr) || 0) > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-600/50 text-[11px] text-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Zuggi 5% Commission Due (Cash Collection):</strong>{' '}
                    <span className="font-mono tabular-nums font-bold text-amber-300">
                      ₹{(Number(booking.driverCommissionDueInr) || 0).toLocaleString('en-IN')}
                    </span>{' '}
                    {booking.driverCommissionStatus === 'verifying_utr'
                      ? `(UTR ${booking.driverCommissionUtr} verifying with Admin)`
                      : '— Pay via UPI in Earnings → Commission Due or adjust in next online payout.'}
                  </span>
                </div>
              )}

              {!hasBankOrUpi && (
                <p className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-xl px-3 py-2">
                  Tip: Add your UPI ID or Bank Account in <strong>Earnings → Bank / UPI</strong> so Zuggi Admin can transfer your payouts immediately.
                </p>
              )}
            </div>
          );
        })()}

        {/* Dynamic Action according to trip stage */}
        {booking.status === 'assigned' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#060309] border border-gray-800 text-xs text-gray-300 space-y-2.5">
              <span className="text-[#FF85B7] font-bold block">STEP 1: Head to Pickup Location</span>
              <p>
                Proceed to:{' '}
                <strong className="text-white">
                  {booking.pickup.address}, {booking.pickup.city}
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`tel:${(booking.pickup.contactPhone || '').replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {booking.pickup.contactName}</span>
                </a>
                {booking.pickup.contactPhone && (
                  <a
                    href={`https://wa.me/91${booking.pickup.contactPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                      `Namaste ${booking.pickup.contactName}, I am your Zuggi Driver assigned for Booking #${booking.id} (${booking.pickup.city} to ${booking.delivery.city}). Starting towards pickup location now.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 font-bold text-xs transition"
                  >
                    <span>WhatsApp</span>
                  </a>
                )}
                <a
                  href={pickupNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-bold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Navigate in Google Maps</span>
                </a>
              </div>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('en_route_pickup')}
              className="w-full py-4 rounded-2xl bg-[#E83E83] hover:bg-[#d62e73] active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-[#E83E83]/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Navigation className="w-5 h-5" />
              <span>Start Heading to Pickup</span>
            </button>
          </div>
        )}

        {booking.status === 'en_route_pickup' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#060309] border border-gray-800 text-xs text-gray-300 space-y-2">
              <span className="text-[#FF85B7] font-bold block">STEP 2: Arrived at Pickup</span>
              <p>
                Heading to: <strong className="text-white">{booking.pickup.address}, {booking.pickup.city}</strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`tel:${booking.pickup.contactPhone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Consignor</span>
                </a>
                <a
                  href={pickupNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Maps</span>
                </a>
              </div>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('at_pickup')}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MapPin className="w-5 h-5" />
              <span>Mark Arrived at Pickup</span>
            </button>
          </div>
        )}

        {(booking.status === 'at_pickup' || booking.status === 'loading') && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#060309] border border-gray-800 text-xs text-gray-300 space-y-3">
              <span className="text-[#FF85B7] font-bold block">STEP 3: Loading Goods onto Truck</span>
              <p>
                Verify carton / sack count:{' '}
                <strong className="text-white">
                  {load.packageCount} packages ({load.weightKg} kg)
                </strong>
              </p>

              {/* Real Phone Camera / Gallery Photo Upload for Loading Proof */}
              <div className="space-y-2.5 pt-1">
                {loadingProofDataUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-700/70 max-w-xs">
                    <img
                      src={loadingProofDataUrl}
                      alt="Loaded truck proof"
                      className="w-full h-36 object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Photo Attached
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={uploadingPhotoType === 'loading'}
                  onClick={() => loadingFileInputRef.current?.click()}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    loadingProofDataUrl
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60'
                      : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                  }`}
                >
                  {loadingProofDataUrl ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4 text-[#FF85B7]" />}
                  <span>
                    {uploadingPhotoType === 'loading'
                      ? 'Processing Photo...'
                      : loadingProofDataUrl
                      ? 'Retake Loading Photo'
                      : 'Take / Upload Photo of Loaded Truck'}
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleAdvanceMilestone('in_transit')}
              className="w-full py-4 rounded-2xl bg-[#E83E83] hover:bg-[#d62e73] active:scale-98 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-[#E83E83]/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Truck className="w-5 h-5" />
              <span>Confirm Loading &amp; Start Journey</span>
            </button>
          </div>
        )}

        {booking.status === 'in_transit' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#060309] border border-gray-800 text-xs text-gray-300 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">STEP 4: En Route in Transit</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono border border-emerald-800/60">
                  {autoGpsEnabled ? 'Auto GPS Live' : 'GPS Ready'}
                </span>
              </div>
              <p>
                Destination:{' '}
                <strong className="text-white">
                  {booking.delivery.address}, {booking.delivery.city}
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`tel:${(booking.delivery.contactPhone || '').replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {booking.delivery.contactName}</span>
                </a>
                {booking.delivery.contactPhone && (
                  <a
                    href={`https://wa.me/91${booking.delivery.contactPhone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                      `Namaste ${booking.delivery.contactName}, I am your Zuggi Driver carrying Booking #${booking.id} from ${booking.pickup.city} to ${booking.delivery.city}. Sharing live arrival update.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 font-bold text-xs transition"
                  >
                    <span>WhatsApp Receiver</span>
                  </a>
                )}
                <a
                  href={dropNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-bold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Navigate in Google Maps</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleAdvanceMilestone('at_destination')}
                className="py-4 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <MapPin className="w-5 h-5" />
                <span>Mark Reached Destination</span>
              </button>

              <button
                onClick={handleBroadcastGps}
                className="py-4 px-4 rounded-2xl bg-gray-800 hover:bg-gray-700 text-[#FF85B7] font-bold text-xs uppercase tracking-wider border border-gray-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LocateFixed className="w-4 h-4" />
                <span>Send GPS Ping Now</span>
              </button>
            </div>
          </div>
        )}

        {(booking.status === 'at_destination' || booking.status === 'delivered') && (
          <form onSubmit={handleVerifyOtpAndComplete} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#060309] border border-gray-800 text-xs text-gray-300 space-y-3">
              <span className="text-[#FF85B7] font-bold block">
                FINAL STEP: Signed Proof of Delivery (POD) &amp; Recipient OTP
              </span>
              <p>Unload goods, get the bilty / challan signed by the receiver, and capture a clear photo.</p>

              {/* Real Camera / Gallery POD Photo Upload */}
              <div className="space-y-2.5">
                {podPhotoDataUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-700/70 max-w-xs">
                    <img
                      src={podPhotoDataUrl}
                      alt="Signed POD document"
                      className="w-full h-40 object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Signed POD Ready
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={uploadingPhotoType === 'pod'}
                  onClick={() => podFileInputRef.current?.click()}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    podPhotoDataUrl
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60'
                      : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                  }`}
                >
                  {podPhotoDataUrl ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4 text-[#FF85B7]" />}
                  <span>
                    {uploadingPhotoType === 'pod'
                      ? 'Saving POD Photo...'
                      : podPhotoDataUrl
                      ? 'Retake / Replace Signed POD Photo'
                      : 'Capture Signed POD / Bilty Photo'}
                  </span>
                </button>
              </div>

              {/* Consignee 4-Digit OTP Input */}
              <div className="pt-2">
                <label className="text-gray-200 block mb-1.5 font-semibold">
                  Enter Receiver&apos;s 4-Digit Delivery Confirmation OTP
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={deliveryOtpInput}
                    onChange={(e) => setDeliveryOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit OTP"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-3 py-3 text-center text-lg font-mono font-black tracking-widest text-[#FF85B7] focus:outline-none focus:border-[#E83E83]"
                  />
                </div>
                <p className="text-[11px] text-amber-300/90 mt-1.5">
                  Ask the consignee / receiver at the drop point for their secret 4-digit Zuggi Delivery OTP to confirm handover and release your final payout.
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Verify OTP &amp; Complete Delivery</span>
            </button>
          </form>
        )}

        {booking.status === 'completed' && (
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-extrabold text-white">Trip Successfully Completed!</h3>
            <p className="text-xs text-emerald-300">
              Net earnings of ₹{booking.netDriverPayableInr.toLocaleString('en-IN')} have been settled to your
              registered bank account.
            </p>
            <button
              onClick={onBack}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs cursor-pointer"
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
      <div className="p-5 rounded-2xl bg-[#171318] border border-gray-800 text-xs space-y-2 text-white">
        <h4 className="font-bold text-gray-400 uppercase tracking-wider">Cargo Particulars</h4>
        <div className="text-white font-semibold">{booking.goodsDescription}</div>
        <div className="text-gray-400 flex flex-wrap items-center gap-2.5 pt-1">
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
