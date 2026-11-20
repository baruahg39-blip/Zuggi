import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Truck,
  Navigation,
  MapPin,
  Phone,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Send,
  ExternalLink,
  Battery,
  ArrowLeft,
  Clock,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { logisticsStore } from '../../services/store';
import { showToast } from '../shared/Toast';

interface DriverWebTrackingPageProps {
  tripId: string;
  token: string;
  onExitToMainApp: () => void;
}

interface BufferedPing {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  battery_level: number;
  recorded_at: string;
  is_buffered?: boolean;
}

type TripStatusType = 'ASSIGNED' | 'AT_PICKUP' | 'IN_TRANSIT' | 'DELIVERED';

export const DriverWebTrackingPage: React.FC<DriverWebTrackingPageProps> = ({
  tripId,
  token,
  onExitToMainApp
}) => {
  const [tripData, setTripData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isStreamingGps, setIsStreamingGps] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastCoords, setLastCoords] = useState<{
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy?: number;
    recordedAt: string;
  } | null>(null);
  const [bufferedPings, setBufferedPings] = useState<BufferedPing[]>([]);
  const [sentPingCount, setSentPingCount] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(92);
  const [statusUpdating, setStatusUpdating] = useState<TripStatusType | null>(null);
  const [simStepIdx, setSimStepIdx] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<any>(null);
  const latestPositionRef = useRef<{ lat: number; lng: number; speed: number; heading: number } | null>(null);
  const storageKey = `vs_driver_gps_buffer_${tripId}`;

  // Load any previously queued offline pings for this trip
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setBufferedPings(parsed);
      }
    } catch {}
  }, [storageKey]);

  // Persist buffer changes to localStorage
  useEffect(() => {
    try {
      if (bufferedPings.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(bufferedPings));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
  }, [bufferedPings, storageKey]);

  // Read device battery level gracefully if supported
  useEffect(() => {
    const navAny = navigator as any;
    if (navAny?.getBattery) {
      navAny
        .getBattery()
        .then((batt: any) => {
          setBatteryLevel(Math.round((batt.level || 0.9) * 100));
        })
        .catch(() => {});
    }
  }, []);

  // Load trip metadata from backend
  const fetchTripDetails = useCallback(async () => {
    if (!tripId || !token) {
      setErrorMsg('Invalid driver tracking link: missing trip_id or tracking token.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/trips/${encodeURIComponent(tripId)}/live-tracking`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Trip link not found or expired.');
      }
      if (data.tracking_token && data.tracking_token !== token) {
        throw new Error('This tracking link is no longer active because a newer link or driver was assigned.');
      }
      setTripData(data);
      if (data.latest_location) {
        setLastCoords({
          lat: data.latest_location.lat,
          lng: data.latest_location.lng,
          speed: data.latest_location.speed || 0,
          heading: data.latest_location.heading || 0,
          recordedAt: data.latest_location.recorded_at
        });
        latestPositionRef.current = {
          lat: data.latest_location.lat,
          lng: data.latest_location.lng,
          speed: data.latest_location.speed || 0,
          heading: data.latest_location.heading || 0
        };
      }
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load trip assignment.');
    } finally {
      setLoading(false);
    }
  }, [tripId, token]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  // Transmit ping or queue offline if signal drops
  const transmitOrBufferPings = useCallback(
    async (pingsToSend: BufferedPing[]) => {
      if (pingsToSend.length === 0) return;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setBufferedPings((prev) => [...prev, ...pingsToSend.map((p) => ({ ...p, is_buffered: true }))]);
        return;
      }

      try {
        const res = await fetch(`/trips/${encodeURIComponent(tripId)}/location-ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ pings: pingsToSend, token })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Server rejected GPS ping');
        }
        setSentPingCount((prev) => prev + pingsToSend.length);
        const eventsTriggered = Array.isArray(data.geofence_events_triggered) ? data.geofence_events_triggered : [];
        if (eventsTriggered.length > 0) {
          eventsTriggered.forEach((evt: any) => showToast(evt.message, 'info'));
        }
        setTripData((prev: any) =>
          prev
            ? {
                ...prev,
                status: data.trip_status || prev.status,
                geofence_state: data.geofence_state || prev.geofence_state,
                geofence_config: data.geofence_config || prev.geofence_config,
                geofence_events:
                  eventsTriggered.length > 0
                    ? [...eventsTriggered, ...(prev.geofence_events || [])].slice(0, 50)
                    : prev.geofence_events
              }
            : prev
        );
      } catch {
        setBufferedPings((prev) => [...prev, ...pingsToSend.map((p) => ({ ...p, is_buffered: true }))]);
      }
    },
    [tripId, token]
  );

  // Flush offline buffer whenever signal returns
  const flushOfflineBuffer = useCallback(async () => {
    if (bufferedPings.length === 0) return;
    const toFlush = [...bufferedPings];
    try {
      const res = await fetch(`/trips/${encodeURIComponent(tripId)}/location-ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pings: toFlush.map((p) => ({ ...p, is_buffered: true })),
          token
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBufferedPings([]);
        setSentPingCount((prev) => prev + toFlush.length);
        const eventsTriggered = Array.isArray(data.geofence_events_triggered) ? data.geofence_events_triggered : [];
        if (eventsTriggered.length > 0) {
          eventsTriggered.forEach((evt: any) => showToast(evt.message, 'info'));
        }
        setTripData((prev: any) =>
          prev
            ? {
                ...prev,
                status: data.trip_status || prev.status,
                geofence_state: data.geofence_state || prev.geofence_state
              }
            : prev
        );
        showToast(`Synced ${toFlush.length} buffered offline GPS points!`, 'success');
      }
    } catch {}
  }, [bufferedPings, tripId, token]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineBuffer();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineBuffer]);

  // Start / stop real browser Geolocation GPS streaming
  useEffect(() => {
    if (!isStreamingGps) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const speedKmh = pos.coords.speed != null && pos.coords.speed >= 0
            ? Math.round(pos.coords.speed * 3.6)
            : 42;
          const headingDeg = pos.coords.heading != null && !Number.isNaN(pos.coords.heading)
            ? Math.round(pos.coords.heading)
            : 0;
          const recordedAt = new Date().toISOString();

          const coordsObj = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: speedKmh,
            heading: headingDeg
          };
          latestPositionRef.current = coordsObj;
          setLastCoords({
            ...coordsObj,
            accuracy: Math.round(pos.coords.accuracy || 15),
            recordedAt
          });

          transmitOrBufferPings([
            {
              ...coordsObj,
              battery_level: batteryLevel,
              recorded_at: recordedAt
            }
          ]);
        },
        (geoErr) => {
          showToast(`GPS notice: ${geoErr.message}. Use manual ping if indoors.`, 'info');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    // 8-second heartbeat ensures continuous signal even when stationary at loading dock
    heartbeatRef.current = setInterval(() => {
      if (latestPositionRef.current) {
        const nowIso = new Date().toISOString();
        transmitOrBufferPings([
          {
            ...latestPositionRef.current,
            battery_level: batteryLevel,
            recorded_at: nowIso
          }
        ]);
      }
    }, 8000);

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [isStreamingGps, batteryLevel, transmitOrBufferPings]);

  // Manual waypoint advance fallback (useful when indoors / desktop testing without GPS sensor)
  const handleManualNextWaypointPing = async () => {
    if (!tripData?.pickup || !tripData?.drop) return;
    const totalSteps = 10;
    const nextStep = Math.min(totalSteps, simStepIdx + 1);
    setSimStepIdx(nextStep);

    const t = nextStep / totalSteps;
    const lat = tripData.pickup.lat + (tripData.drop.lat - tripData.pickup.lat) * t;
    const lng = tripData.pickup.lng + (tripData.drop.lng - tripData.pickup.lng) * t;
    const dLat = tripData.drop.lat - tripData.pickup.lat;
    const dLng = tripData.drop.lng - tripData.pickup.lng;
    const heading = Math.round(((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360);
    const nowIso = new Date().toISOString();

    const ping: BufferedPing = {
      lat,
      lng,
      speed: nextStep === totalSteps ? 0 : 48,
      heading,
      battery_level: batteryLevel,
      recorded_at: nowIso
    };

    latestPositionRef.current = { lat, lng, speed: ping.speed, heading };
    setLastCoords({ lat, lng, speed: ping.speed, heading, accuracy: 12, recordedAt: nowIso });
    await transmitOrBufferPings([ping]);
    showToast(`Location ping transmitted (${Math.round(t * 100)}% route progress).`, 'success');
  };

  // Update trip milestone from Driver Link
  const handleMilestoneUpdate = async (newStatus: TripStatusType) => {
    setStatusUpdating(newStatus);
    try {
      const res = await fetch(`/trips/${encodeURIComponent(tripId)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus, token })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Status update failed');
      }

      setTripData((prev: any) => (prev ? { ...prev, status: newStatus } : prev));

      // Mirror into local browser logisticsStore if running on the same device
      const storeMilestone =
        newStatus === 'AT_PICKUP'
          ? 'at_pickup'
          : newStatus === 'IN_TRANSIT'
          ? 'in_transit'
          : 'delivered';
      logisticsStore.updateBookingMilestone(tripId, storeMilestone);

      showToast(`Trip milestone updated to ${newStatus.replace('_', ' ')}!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Unable to update milestone', 'error');
    } finally {
      setStatusUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F8] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center space-y-3 max-w-sm w-full">
          <Radio className="w-8 h-8 text-[#E83E83] mx-auto animate-pulse" />
          <h2 className="text-base font-black text-[#171318]">Connecting Trip Dispatch Link...</h2>
          <p className="text-xs text-[#77717A]">Verifying your encrypted vehicle token</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !tripData) {
    return (
      <div className="min-h-screen bg-[#F8F6F8] flex items-center justify-center p-5">
        <div className="bg-white rounded-3xl p-7 border border-rose-200 shadow-lg max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-[#171318]">Tracking Link Unavailable</h2>
          <p className="text-xs text-[#77717A] leading-relaxed">{errorMsg}</p>
          <button
            type="button"
            onClick={onExitToMainApp}
            className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#171318] text-white text-xs font-bold hover:bg-black transition cursor-pointer"
          >
            Go to Zuggi Home
          </button>
        </div>
      </div>
    );
  }

  const gmapsNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${lastCoords?.lat ?? tripData.pickup.lat},${lastCoords?.lng ?? tripData.pickup.lng}`
  )}&destination=${encodeURIComponent(`${tripData.drop.lat},${tripData.drop.lng}`)}&travelmode=driving`;

  const currentStatus: TripStatusType = tripData.status || 'ASSIGNED';

  return (
    <div className="min-h-screen bg-[#F8F6F8] text-[#171318] pb-28 lg:pb-12">
      {/* Compact Sticky Mobile Top App Bar (<= 56px height) */}
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-md border-b border-gray-200 px-3 sm:px-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onExitToMainApp}
          className="min-h-[44px] min-w-[44px] -ml-2 px-2 flex items-center gap-1.5 text-xs font-bold text-[#171318] hover:text-[#E83E83] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Main Portal</span>
        </button>

        <div className="text-center truncate px-2">
          <p className="text-xs sm:text-sm font-black truncate text-[#171318]">
            {tripData.vehicle?.vehicle_number || 'Trip Dispatch'} • Live GPS
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </span>
          )}
        </div>
      </header>

      {/* Responsive Desktop & Mobile Grid Container */}
      <main className="max-w-5xl mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Telemetry & Route Card */}
        <div className="lg:col-span-7 space-y-4">
          {/* Status Hero Card */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#77717A]">
                  Assigned Trip • No Login Needed
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-[#171318] mt-0.5">
                  {tripData.pickup?.city} → {tripData.drop?.city}
                </h1>
              </div>
              <span className="text-xs font-black uppercase tracking-wide text-[#E83E83] shrink-0">
                {currentStatus.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Live GPS Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-[#F8F6F8] border border-gray-200/80">
                <span className="text-[10px] font-bold text-[#77717A] uppercase block">Live Speed</span>
                <span className="text-lg font-black text-[#171318] tabular-nums">
                  {lastCoords?.speed ?? 0} km/h
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F6F8] border border-gray-200/80">
                <span className="text-[10px] font-bold text-[#77717A] uppercase block">Pings Sent</span>
                <span className="text-lg font-black text-emerald-700 tabular-nums">{sentPingCount}</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F6F8] border border-gray-200/80">
                <span className="text-[10px] font-bold text-[#77717A] uppercase block">Buffered</span>
                <span
                  className={`text-lg font-black tabular-nums ${
                    bufferedPings.length > 0 ? 'text-amber-700' : 'text-[#171318]'
                  }`}
                >
                  {bufferedPings.length}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F8F6F8] border border-gray-200/80">
                <span className="text-[10px] font-bold text-[#77717A] uppercase block">Battery</span>
                <span className="text-lg font-black text-[#171318] tabular-nums flex items-center gap-1">
                  <Battery className="w-4 h-4 text-emerald-600" />
                  {batteryLevel}%
                </span>
              </div>
            </div>

            {/* Coordinates & Signal Stream Indicator */}
            <div className="p-3.5 rounded-2xl bg-[#171318] text-white flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isStreamingGps ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'
                    }`}
                  />
                  <span>{isStreamingGps ? 'Live GPS Sharing Active' : 'GPS Sharing Paused'}</span>
                </div>
                <p className="text-[11px] font-mono text-gray-300 tabular-nums">
                  {lastCoords
                    ? `${lastCoords.lat.toFixed(5)}, ${lastCoords.lng.toFixed(5)} (Hdg ${lastCoords.heading}°)`
                    : 'Waiting for first location fix'}
                </p>
              </div>
              {lastCoords?.recordedAt && (
                <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  {new Date(lastCoords.recordedAt).toLocaleTimeString('en-IN')}
                </span>
              )}
            </div>

            {/* Offline Buffer Notice */}
            {bufferedPings.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <strong>{bufferedPings.length} offline GPS pings saved</strong> on your device. They auto-upload when mobile network returns.
                </div>
                <button
                  type="button"
                  onClick={flushOfflineBuffer}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  Sync Now
                </button>
              </div>
            )}
          </div>

          {/* Pickup & Drop Locations */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#77717A]">
              Loading & Unloading Points
            </h2>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-emerald-700 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Pickup Location
                  </span>
                  <p className="text-sm font-bold text-[#171318]">{tripData.pickup?.city}</p>
                  <p className="text-xs text-[#77717A]">{tripData.pickup?.address}</p>
                  {tripData.pickup?.contact_name && (
                    <p className="text-xs font-semibold text-[#171318] pt-1">
                      {tripData.pickup.contact_name} • {tripData.pickup.contact_phone}
                    </p>
                  )}
                </div>
                {tripData.pickup?.contact_phone && (
                  <a
                    href={`tel:${tripData.pickup.contact_phone}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 hover:bg-emerald-50"
                    title="Call Pickup Contact"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-rose-700 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Drop Destination
                  </span>
                  <p className="text-sm font-bold text-[#171318]">{tripData.drop?.city}</p>
                  <p className="text-xs text-[#77717A]">{tripData.drop?.address}</p>
                  {tripData.drop?.contact_name && (
                    <p className="text-xs font-semibold text-[#171318] pt-1">
                      {tripData.drop.contact_name} • {tripData.drop.contact_phone}
                    </p>
                  )}
                </div>
                {tripData.drop?.contact_phone && (
                  <a
                    href={`tel:${tripData.drop.contact_phone}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 hover:bg-rose-50"
                    title="Call Drop Consignee"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <a
              href={gmapsNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] py-3 px-4 rounded-2xl bg-[#F8F6F8] hover:bg-gray-100 border border-gray-200 text-[#171318] font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Navigation className="w-4 h-4 text-[#E83E83]" />
              <span>Open Turn-by-Turn Navigation in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            </a>
          </div>
        </div>

        {/* Right Column: Driver Info, Trip Milestones & Manual Test Ping */}
        <div className="lg:col-span-5 space-y-4">
          {/* Driver & Truck Assignment Card */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#E83E83] flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-[#171318] font-mono">
                    {tripData.vehicle?.vehicle_number}
                  </p>
                  <p className="text-xs text-[#77717A]">
                    Driver: <strong className="text-[#171318]">{tripData.driver?.name}</strong>
                  </p>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          {/* 3-Step Driver Milestone Updates */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#77717A]">
              Update Trip Status (Syncs Live to Shipper)
            </h2>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={statusUpdating !== null}
                onClick={() => handleMilestoneUpdate('AT_PICKUP')}
                className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                  currentStatus === 'AT_PICKUP'
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-[#F8F6F8] border-gray-200 text-[#171318] hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>1. Arrived at Pickup Point</span>
                </span>
                {currentStatus === 'AT_PICKUP' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
              </button>

              <button
                type="button"
                disabled={statusUpdating !== null}
                onClick={() => handleMilestoneUpdate('IN_TRANSIT')}
                className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                  currentStatus === 'IN_TRANSIT'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                    : 'bg-[#F8F6F8] border-gray-200 text-[#171318] hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>2. Cargo Loaded & Started Trip</span>
                </span>
                {currentStatus === 'IN_TRANSIT' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              <button
                type="button"
                disabled={statusUpdating !== null}
                onClick={() => handleMilestoneUpdate('DELIVERED')}
                className={`w-full min-h-[48px] px-4 py-3 rounded-2xl border text-left font-bold text-xs flex items-center justify-between transition cursor-pointer ${
                  currentStatus === 'DELIVERED'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-[#F8F6F8] border-gray-200 text-[#171318] hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <PackageCheck className="w-4 h-4" />
                  <span>3. Reached Destination & Delivered</span>
                </span>
                {currentStatus === 'DELIVERED' && <CheckCircle2 className="w-4 h-4 text-white" />}
              </button>
            </div>
          </div>

          {/* Desktop GPS Controls + Manual Waypoint Ping */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
            <button
              type="button"
              onClick={() => setIsStreamingGps((v) => !v)}
              className={`hidden lg:flex w-full h-12 rounded-2xl font-black text-sm items-center justify-center gap-2 transition cursor-pointer ${
                isStreamingGps
                  ? 'bg-[#171318] hover:bg-black text-white'
                  : 'bg-[#E83E83] hover:bg-[#d62f73] text-white shadow-lg shadow-[#E83E83]/20'
              }`}
            >
              {isStreamingGps ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isStreamingGps ? 'Pause Live GPS Sharing' : 'Start Live GPS Sharing'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualNextWaypointPing}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-[#FFF0F6] hover:bg-[#ffe3ef] border border-[#F4A7C5] text-[#E83E83] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Instant Highway GPS Ping Now</span>
            </button>
            <p className="text-[11px] text-[#77717A] leading-relaxed">
              Keep this page open in your phone browser during transit. Every location ping is authenticated with your encrypted trip token and updates the shipper’s live map.
            </p>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Thumb-Zone Primary CTA for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white to-white/80 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setIsStreamingGps((v) => !v)}
          className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] cursor-pointer ${
            isStreamingGps
              ? 'bg-[#171318] text-white'
              : 'bg-[#E83E83] text-white shadow-[#E83E83]/25'
          }`}
        >
          {isStreamingGps ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isStreamingGps ? 'Pause Live GPS Sharing' : 'Start Live GPS Sharing'}</span>
        </button>
      </div>
    </div>
  );
};
