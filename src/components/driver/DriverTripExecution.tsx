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
  Image as ImageIcon,
  Bell,
  BellOff
} from 'lucide-react';
import {
  Booking,
  BookingLiveEta,
  GeofenceEvent,
  GeofenceZoneConfig,
  GeofenceZoneState,
  LoadItem
} from '../../types';
import { logisticsStore } from '../../services/store';
import {
  calculateLiveDestinationEta,
  computeHaversineMeters
} from '../../services/routeMatrixEta';
import {
  GEOFENCE_ALERT_RADIUS_METERS,
  BrowserNotificationPermissionState,
  check500mGeofenceEntry,
  formatMetersOrKm,
  getBrowserNotificationPermission,
  offsetCoordinateByMeters,
  requestBrowserNotificationPermission,
  triggerGeofenceBrowserNotification
} from '../../utils/geofence';
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
  const [liveEta, setLiveEta] = useState<BookingLiveEta | null>(() => {
    const initialBooking = bookingId ? logisticsStore.getBookingById(bookingId) : undefined;
    return initialBooking?.liveEta || null;
  });
  const [isCalculatingEta, setIsCalculatingEta] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());
  const [proximity500m, setProximity500m] = useState<{
    distanceToPickupMeters?: number;
    distanceToDeliveryMeters?: number;
    insidePickup: boolean;
    insideDelivery: boolean;
    lastAlert?: {
      zoneType: 'pickup' | 'delivery';
      title: string;
      body: string;
      timestamp: string;
      deliveredViaBrowser: boolean;
    };
  }>({
    insidePickup: false,
    insideDelivery: false
  });

  const loadingFileInputRef = useRef<HTMLInputElement | null>(null);
  const podFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastWatchSentAtRef = useRef<number>(0);
  const lastEtaCalcAtRef = useRef<number>(0);
  const lastEtaCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const etaInFlightRef = useRef<boolean>(false);
  const wasInside500mRef = useRef<{ pickup: boolean; delivery: boolean }>({
    pickup: false,
    delivery: false
  });
  const lastEvaluated500mPingKeyRef = useRef<string | null>(null);

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
        if (b.liveEta) setLiveEta(b.liveEta);
      }
      setGeofenceConfig(logisticsStore.getGeofenceConfig(bookingId));
      setGeofenceState(logisticsStore.getGeofenceState(bookingId));
      setGeofenceEvents(logisticsStore.getGeofenceEvents(bookingId));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [bookingId]);

  // Reset 500m geofence entry flags whenever the active booking changes
  useEffect(() => {
    wasInside500mRef.current = { pickup: false, delivery: false };
    lastEvaluated500mPingKeyRef.current = null;
    setProximity500m({ insidePickup: false, insideDelivery: false });
    setNotificationPermission(getBrowserNotificationPermission());
  }, [bookingId]);

  const handleEnableBrowserNotifications = useCallback(async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      showToast('Browser geo-fence notifications enabled for 500m pickup & delivery zones.', 'success');
    } else if (perm === 'denied') {
      showToast('Browser notifications are blocked. Allow notifications in browser site settings.', 'error');
    } else {
      showToast('Browser Notification API is not supported on this device; in-app alerts remain active.', 'info');
    }
  }, []);

  // Core 500m geo-fencing monitor: detects entry into 500m radius of pickup or delivery coordinates
  // and dispatches a browser-based Notification (plus in-app banner fallback).
  const evaluate500mGeofence = useCallback(
    async (b: Booking, lat: number, lng: number, forceTriggerZone?: 'pickup' | 'delivery') => {
      if (b.status === 'completed' || b.status === 'cancelled') return;

      const wasInsidePickup = forceTriggerZone === 'pickup' ? false : wasInside500mRef.current.pickup;
      const wasInsideDelivery = forceTriggerZone === 'delivery' ? false : wasInside500mRef.current.delivery;

      const evaluation = check500mGeofenceEntry({
        lat,
        lng,
        pickup: { lat: b.pickup.lat, lng: b.pickup.lng },
        delivery: { lat: b.delivery.lat, lng: b.delivery.lng },
        wasInsidePickup,
        wasInsideDelivery,
        radiusMeters: GEOFENCE_ALERT_RADIUS_METERS
      });

      wasInside500mRef.current = {
        pickup: evaluation.insidePickup,
        delivery: evaluation.insideDelivery
      };

      setProximity500m((prev) => ({
        ...prev,
        distanceToPickupMeters: evaluation.distanceToPickupMeters,
        distanceToDeliveryMeters: evaluation.distanceToDeliveryMeters,
        insidePickup: evaluation.insidePickup,
        insideDelivery: evaluation.insideDelivery
      }));

      if (evaluation.newlyEnteredZones.length === 0) return;

      const vehicleReg = logisticsStore.getVehicleById(b.vehicleId)?.registrationNumber;

      for (const zoneType of evaluation.newlyEnteredZones) {
        const point = zoneType === 'pickup' ? b.pickup : b.delivery;
        const distanceMeters =
          zoneType === 'pickup'
            ? evaluation.distanceToPickupMeters
            : evaluation.distanceToDeliveryMeters;

        const notifResult = await triggerGeofenceBrowserNotification({
          zoneType,
          city: point.city,
          address: point.address,
          distanceMeters,
          radiusMeters: GEOFENCE_ALERT_RADIUS_METERS,
          bookingId: b.id,
          vehicleRegNumber: vehicleReg
        });

        setNotificationPermission(getBrowserNotificationPermission());
        setProximity500m((prev) => ({
          ...prev,
          lastAlert: {
            zoneType,
            title: notifResult.title,
            body: notifResult.body,
            timestamp: notifResult.timestamp,
            deliveredViaBrowser: notifResult.deliveredViaBrowser
          }
        }));
        showToast(`${notifResult.title} (${formatMetersOrKm(distanceMeters)} away)`, 'success');
      }
    },
    []
  );

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

  // Compute live traffic-aware ETA to destination via Google Maps Platform Routes API (Compute Route Matrix)
  // and sync immediately to both local logisticsStore and backend /trips/:id/live-eta for the shipper.
  const refreshLiveEta = useCallback(
    async (
      b: Booking,
      originLat: number,
      originLng: number,
      force = false
    ): Promise<BookingLiveEta | null> => {
      if (b.status === 'completed' || b.status === 'cancelled') return null;
      if (etaInFlightRef.current) return null;

      const nowMs = Date.now();
      const prevCoord = lastEtaCoordRef.current;
      const elapsedMs = nowMs - lastEtaCalcAtRef.current;
      const movedMeters = prevCoord
        ? computeHaversineMeters(prevCoord.lat, prevCoord.lng, originLat, originLng)
        : Infinity;

      // Throttle automatic refreshes to protect API quota unless driver moved >= 500m or >= 60s elapsed
      if (!force && elapsedMs < 60_000 && movedMeters < 500) {
        return null;
      }

      etaInFlightRef.current = true;
      setIsCalculatingEta(true);
      try {
        const computed = await calculateLiveDestinationEta({
          origin: { lat: originLat, lng: originLng },
          destination: { lat: b.delivery.lat, lng: b.delivery.lng },
          destinationCity: b.delivery.city
        });

        lastEtaCalcAtRef.current = Date.now();
        lastEtaCoordRef.current = { lat: originLat, lng: originLng };
        setLiveEta(computed);
        logisticsStore.updateBookingLiveEta(b.id, computed);

        // Relay live ETA to backend trip record so cross-device shipper views receive it in /live-tracking
        fetch(`/trips/${encodeURIComponent(b.id)}/live-eta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            minutes: Math.max(0, Math.round(computed.durationSeconds / 60)),
            formatted: computed.formattedDuration,
            distance_remaining_km: computed.distanceKm,
            eta_iso: computed.etaIso,
            formatted_arrival_time: computed.formattedArrivalTime,
            traffic_condition: computed.trafficCondition,
            traffic_delay_minutes: computed.trafficDelayMinutes,
            source: computed.source,
            calculated_at: computed.calculatedAt
          })
        }).catch(() => {});

        return computed;
      } finally {
        etaInFlightRef.current = false;
        setIsCalculatingEta(false);
      }
    },
    []
  );

  // Auto-calculate initial live ETA when trip opens, and refresh whenever a new GPS ping arrives from map controls
  useEffect(() => {
    if (!booking || booking.status === 'completed' || booking.status === 'cancelled') return;

    const latestPing = logisticsStore.getLatestPing(booking.id);
    const originLat = latestPing?.lat ?? booking.pickup.lat;
    const originLng = latestPing?.lng ?? booking.pickup.lng;

    // Trigger immediate 500m proximity evaluation on initial trip ping if available
    if (latestPing) {
      const initKey = `${latestPing.timestamp}:${latestPing.lat.toFixed(6)},${latestPing.lng.toFixed(6)}`;
      if (lastEvaluated500mPingKeyRef.current !== initKey) {
        lastEvaluated500mPingKeyRef.current = initKey;
        void evaluate500mGeofence(booking, latestPing.lat, latestPing.lng);
      }
    }

    // Trigger immediate calculation if no fresh ETA exists yet
    const existingAgeMs = booking.liveEta
      ? Date.now() - new Date(booking.liveEta.calculatedAt).getTime()
      : Infinity;
    if (!booking.liveEta || existingAgeMs > 90_000) {
      void refreshLiveEta(booking, originLat, originLng, true);
    }

    const unsub = logisticsStore.subscribe(() => {
      const updatedBooking = logisticsStore.getBookingById(booking.id);
      if (!updatedBooking || updatedBooking.status === 'completed' || updatedBooking.status === 'cancelled') {
        return;
      }
      const ping = logisticsStore.getLatestPing(booking.id);
      if (ping) {
        const pingKey = `${ping.timestamp}:${ping.lat.toFixed(6)},${ping.lng.toFixed(6)}`;
        if (lastEvaluated500mPingKeyRef.current !== pingKey) {
          lastEvaluated500mPingKeyRef.current = pingKey;
          void evaluate500mGeofence(updatedBooking, ping.lat, ping.lng);
        }
        void refreshLiveEta(updatedBooking, ping.lat, ping.lng, false);
      }
    });

    return unsub;
  }, [booking?.id, booking?.status, refreshLiveEta, evaluate500mGeofence]);

  const handleManualRefreshEta = useCallback(async () => {
    if (!booking) return;
    const latestPing = logisticsStore.getLatestPing(booking.id);
    const originLat = latestPing?.lat ?? booking.pickup.lat;
    const originLng = latestPing?.lng ?? booking.pickup.lng;
    const updated = await refreshLiveEta(booking, originLat, originLng, true);
    if (updated) {
      showToast(
        `Live ETA updated: ${updated.formattedDuration} (${updated.distanceKm} km) — shared with shipper.`,
        'success'
      );
    }
  }, [booking, refreshLiveEta]);

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

      // Evaluate 500m pickup/delivery geo-fence & trigger browser notification on zone entry
      const pingKey = `${now}:${lat.toFixed(6)},${lng.toFixed(6)}`;
      lastEvaluated500mPingKeyRef.current = pingKey;
      void evaluate500mGeofence(b, lat, lng);

      // Recalculate traffic-aware ETA to destination from the new GPS ping (throttled for quota efficiency)
      void refreshLiveEta(b, lat, lng, !silent);

      if (!silent) {
        const msg =
          localEvents.length > 0
            ? localEvents[0].message
            : `Live GPS ping transmitted (${lat.toFixed(4)}, ${lng.toFixed(4)}) @ ${speed} km/h`;
        setStatusFeedback({ text: msg });
        showToast(msg, 'success');
      }
    },
    [ensureBackendTripToken, refreshLiveEta, evaluate500mGeofence]
  );

  // One-tap verification helper: positions vehicle 180m inside Pickup or Delivery 500m radius
  // and invokes the real browser notification + GPS pipeline.
  const handleSimulate500mZoneEntry = useCallback(
    async (zoneType: 'pickup' | 'delivery') => {
      if (!booking || !load) return;
      if (getBrowserNotificationPermission() === 'default') {
        const perm = await requestBrowserNotificationPermission();
        setNotificationPermission(perm);
      }
      const target = zoneType === 'pickup' ? booking.pickup : booking.delivery;
      const insideCoord = offsetCoordinateByMeters(target.lat, target.lng, 140, 110); // ~178m from center
      wasInside500mRef.current = {
        ...wasInside500mRef.current,
        [zoneType]: false
      };
      await transmitGpsPoint(
        booking,
        load,
        insideCoord.lat,
        insideCoord.lng,
        18,
        90,
        `${target.city} ${zoneType === 'pickup' ? 'Pickup' : 'Delivery'} Gate (500m Geo-Fence)`,
        true
      );
    },
    [booking, load, transmitGpsPoint]
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

      {/* Active 500m Geo-Fence Entry Browser Alert Banner */}
      {proximity500m.lastAlert && (
        <div className="p-4 rounded-2xl bg-emerald-950 text-emerald-100 border border-emerald-700 shadow-lg flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  {proximity500m.lastAlert.title}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">
                  • {proximity500m.lastAlert.deliveredViaBrowser ? 'Browser Notification Sent' : 'In-App Geo-Fence Alert'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 leading-snug">
                {proximity500m.lastAlert.body}
              </p>
              <span className="block text-[10px] font-mono tabular-nums text-emerald-400/80 mt-1">
                Triggered at {new Date(proximity500m.lastAlert.timestamp).toLocaleTimeString('en-IN')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setProximity500m((prev) => ({ ...prev, lastAlert: undefined }))}
            className="min-h-[36px] px-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-[11px] font-bold text-emerald-100 transition cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Destination ETA Banner (Google Maps Routes API Route Matrix — Shared Live with Shipper) */}
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#171318] border border-gray-800 text-white shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#E83E83]/15 border border-[#E83E83]/35 flex items-center justify-center text-[#FF85B7] shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Live Destination ETA
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    • Shared Live with Shipper
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  To {booking.delivery.city} ({booking.delivery.address})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualRefreshEta}
              disabled={isCalculatingEta}
              className="min-h-[44px] px-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-bold text-gray-100 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculatingEta ? 'animate-spin text-[#E83E83]' : ''}`} />
              <span>{isCalculatingEta ? 'Updating ETA...' : 'Refresh Live ETA'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-2xl bg-[#060309] border border-gray-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Est. Arrival
              </span>
              <span className="mt-0.5 block text-base sm:text-lg font-black font-mono tabular-nums text-emerald-400">
                {liveEta ? liveEta.formattedArrivalTime : isCalculatingEta ? 'Calculating...' : '--'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#060309] border border-gray-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Drive Time Left
              </span>
              <span className="mt-0.5 block text-base sm:text-lg font-black font-mono tabular-nums text-white">
                {liveEta ? liveEta.formattedDuration : isCalculatingEta ? '...' : '--'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#060309] border border-gray-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Road Distance
              </span>
              <span className="mt-0.5 block text-base sm:text-lg font-black font-mono tabular-nums text-[#FF85B7]">
                {liveEta ? `${liveEta.distanceKm} km` : '--'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#060309] border border-gray-800">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Live Traffic
              </span>
              <span
                className={`mt-0.5 block text-sm sm:text-base font-extrabold ${
                  liveEta?.trafficCondition === 'heavy'
                    ? 'text-rose-400'
                    : liveEta?.trafficCondition === 'moderate'
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {liveEta
                  ? liveEta.trafficCondition === 'heavy'
                    ? `Heavy (+${liveEta.trafficDelayMinutes}m)`
                    : liveEta.trafficCondition === 'moderate'
                    ? `Moderate (+${liveEta.trafficDelayMinutes}m)`
                    : 'Clear Highway'
                  : 'Checking...'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 pt-1 border-t border-gray-800/80">
            <span>
              Source:{' '}
              <strong className="text-gray-200">
                {liveEta?.source === 'google_routes_matrix'
                  ? 'Google Maps Live Traffic Route Matrix'
                  : 'GPS Corridor Estimate'}
              </strong>
            </span>
            <span className="font-mono tabular-nums">
              {liveEta?.calculatedAt
                ? `Updated ${new Date(liveEta.calculatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}`
                : 'Awaiting GPS fix'}
            </span>
          </div>
        </div>
      )}

      {/* Main Map Visualizer + Live Auto-GPS Controls */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-extrabold flex items-center gap-1.5 text-[#171318]">
            <Radio className={`w-4 h-4 ${autoGpsEnabled ? 'text-emerald-600' : 'text-[#E83E83]'}`} />
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

      {/* 500m Proximity Geo-Fence Browser Notification Utility Bar */}
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#171318] border border-gray-800 text-white shadow-xl space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0">
                {notificationPermission === 'denied' ? (
                  <BellOff className="w-4 h-4 text-rose-400" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black tracking-tight text-white">
                    500m Arrival Geo-Fence Alerts
                  </h3>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      notificationPermission === 'granted'
                        ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70'
                        : notificationPermission === 'denied'
                        ? 'bg-rose-950/70 text-rose-300 border-rose-700/70'
                        : 'bg-amber-950/70 text-amber-300 border-amber-700/70'
                    }`}
                  >
                    {notificationPermission === 'granted'
                      ? 'Browser Alerts Active'
                      : notificationPermission === 'denied'
                      ? 'Browser Alerts Blocked'
                      : notificationPermission === 'unsupported'
                      ? 'In-App Alerts Only'
                      : 'Permission Needed'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Fires a browser notification automatically when your truck enters within 500 m of Pickup or Delivery coordinates.
                </p>
              </div>
            </div>

            {notificationPermission === 'default' && (
              <button
                type="button"
                onClick={handleEnableBrowserNotifications}
                className="min-h-[44px] px-4 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Enable Browser Notifications</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                proximity500m.insidePickup
                  ? 'bg-emerald-950/45 border-emerald-700/80'
                  : 'bg-[#060309] border-gray-800'
              }`}
            >
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Pickup 500m Zone · {booking.pickup.city}
                </span>
                <span className="block font-mono tabular-nums font-black text-sm text-white mt-0.5">
                  {formatMetersOrKm(
                    proximity500m.distanceToPickupMeters ?? geofenceState.distanceToPickupMeters
                  )}{' '}
                  away
                </span>
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shrink-0 ${
                  proximity500m.insidePickup
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-gray-900 text-gray-400 border border-gray-800'
                }`}
              >
                {proximity500m.insidePickup ? 'Inside 500m' : 'Monitoring'}
              </span>
            </div>

            <div
              className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                proximity500m.insideDelivery
                  ? 'bg-pink-950/45 border-[#E83E83]/80'
                  : 'bg-[#060309] border-gray-800'
              }`}
            >
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Delivery 500m Zone · {booking.delivery.city}
                </span>
                <span className="block font-mono tabular-nums font-black text-sm text-white mt-0.5">
                  {formatMetersOrKm(
                    proximity500m.distanceToDeliveryMeters ?? geofenceState.distanceToDeliveryMeters
                  )}{' '}
                  away
                </span>
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg shrink-0 ${
                  proximity500m.insideDelivery
                    ? 'bg-[#E83E83] text-white'
                    : 'bg-gray-900 text-gray-400 border border-gray-800'
                }`}
              >
                {proximity500m.insideDelivery ? 'Inside 500m' : 'Monitoring'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-800/80">
            <span className="text-[11px] text-gray-400">
              Verify 500m entry notification:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSimulate500mZoneEntry('pickup')}
                className="min-h-[44px] px-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-bold text-emerald-300 transition cursor-pointer"
              >
                Simulate Pickup 500m Entry
              </button>
              <button
                type="button"
                onClick={() => void handleSimulate500mZoneEntry('delivery')}
                className="min-h-[44px] px-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-bold text-[#FF85B7] transition cursor-pointer"
              >
                Simulate Delivery 500m Entry
              </button>
            </div>
          </div>
        </div>
      )}

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
