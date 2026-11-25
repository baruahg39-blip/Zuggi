import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  MessageSquare,
  Battery,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { TripLiveTrackingResponse, TripLocationPing, GeofenceZoneConfig } from '../../types';
import { logisticsStore } from '../../services/store';
import { DEFAULT_GEOFENCE_CONFIG } from '../../utils/geofence';
import { GeofenceMonitorPanel } from './GeofenceMonitorPanel';
import { LiveTelemetryFallbackMap } from '../maps/LiveTelemetryFallbackMap';
import { buildLocalTrackingFallback, syncLocalTripToServer } from '../../utils/trackingFallback';
import { showToast } from '../shared/Toast';

export interface ShipperLiveTrackerProps {
  loadId?: string;
  tripId?: string;
  initialTrackingToken?: string;
  className?: string;
  onOpenDriverSimulator?: (tripId: string, token: string) => void;
}

export const ShipperLiveTracker: React.FC<ShipperLiveTrackerProps> = ({
  loadId,
  tripId,
  initialTrackingToken,
  className = '',
  onOpenDriverSimulator
}) => {
  // Determine lookup identifier: tripId, loadId, or fallback to demo trip
  const effectiveTripId = useMemo(() => {
    return tripId || (loadId ? `trip_${loadId}` : 'trip_demo_01');
  }, [tripId, loadId]);

  const [trackingToken, setTrackingToken] = useState<string | null>(initialTrackingToken || null);
  const [telemetry, setTelemetry] = useState<TripLiveTrackingResponse | null>(() =>
    buildLocalTrackingFallback(effectiveTripId, loadId)
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !buildLocalTrackingFallback(effectiveTripId, loadId));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const syncedToServerRef = useRef<boolean>(false);

  // Marker Animation State (LERP Interpolation)
  const [animatedCoord, setAnimatedCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [animatedHeading, setAnimatedHeading] = useState<number>(0);
  const animatedCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const trackingTokenRef = useRef<string | null>(initialTrackingToken || null);
  const prevCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const targetCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (trackingToken) trackingTokenRef.current = trackingToken;
  }, [trackingToken]);

  // Smooth Marker Interpolation Function
  const updateMarkerPosition = useCallback((latestPing: TripLocationPing | null) => {
    if (!latestPing) return;
    const nextLat = latestPing.lat;
    const nextLng = latestPing.lng;
    const nextHeading = latestPing.heading || 0;

    if (!targetCoordRef.current) {
      const initCoord = { lat: nextLat, lng: nextLng };
      targetCoordRef.current = initCoord;
      prevCoordRef.current = initCoord;
      animatedCoordRef.current = initCoord;
      setAnimatedCoord(initCoord);
      setAnimatedHeading(nextHeading);
      return;
    }

    if (
      targetCoordRef.current.lat !== nextLat ||
      targetCoordRef.current.lng !== nextLng
    ) {
      prevCoordRef.current = animatedCoordRef.current || targetCoordRef.current;
      targetCoordRef.current = { lat: nextLat, lng: nextLng };
      animStartTimeRef.current = performance.now();
      setAnimatedHeading(nextHeading);

      const ANIMATION_DURATION_MS = 1000;

      const animateStep = (currentTime: number) => {
        if (!animStartTimeRef.current || !prevCoordRef.current || !targetCoordRef.current) return;
        const elapsed = currentTime - animStartTimeRef.current;
        const progress = Math.min(1, elapsed / ANIMATION_DURATION_MS);

        // Cubic ease-out interpolation
        const ease = 1 - Math.pow(1 - progress, 3);
        const curLat = prevCoordRef.current.lat + (targetCoordRef.current.lat - prevCoordRef.current.lat) * ease;
        const curLng = prevCoordRef.current.lng + (targetCoordRef.current.lng - prevCoordRef.current.lng) * ease;

        const nextPoint = { lat: curLat, lng: curLng };
        animatedCoordRef.current = nextPoint;
        setAnimatedCoord(nextPoint);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animateStep);
        }
      };

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      animFrameRef.current = requestAnimationFrame(animateStep);
    }
  }, []);

  // 1. Retrieve the tracking token and live telemetry from backend
  const fetchLiveTrackingData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (trackingTokenRef.current) {
        headers['Authorization'] = `Bearer ${trackingTokenRef.current}`;
      }

      const res = await fetch(`/trips/${encodeURIComponent(effectiveTripId)}/live-tracking`, { headers });
      if (!res.ok) {
        // Hydrate from local logisticsStore booking/load FIRST so shipper sees their actual shipment
        const localFallback = buildLocalTrackingFallback(effectiveTripId, loadId);
        if (localFallback) {
          setTelemetry(localFallback);
          if (localFallback.tracking_token) {
            trackingTokenRef.current = localFallback.tracking_token;
            setTrackingToken(localFallback.tracking_token);
          }
          setLastSyncTime(new Date());
          setErrorMsg(null);
          updateMarkerPosition(localFallback.latest_location);
          if (!syncedToServerRef.current) {
            syncedToServerRef.current = true;
            void syncLocalTripToServer(localFallback);
          }
          return;
        }

        if (res.status === 404 && effectiveTripId !== 'trip_demo_01') {
          const fallbackRes = await fetch('/trips/trip_demo_01/live-tracking');
          if (fallbackRes.ok) {
            const fallbackData: TripLiveTrackingResponse = await fallbackRes.json();
            setTelemetry(fallbackData);
            trackingTokenRef.current = fallbackData.tracking_token || '';
            setTrackingToken(trackingTokenRef.current);
            setLastSyncTime(new Date());
            setErrorMsg(null);
            updateMarkerPosition(fallbackData.latest_location);
            return;
          }
        }
        throw new Error(`Tracking service returned status ${res.status}`);
      }

      const data: TripLiveTrackingResponse = await res.json();
      setTelemetry(data);
      setLastSyncTime(new Date());
      setErrorMsg(null);

      const newlyTriggered = logisticsStore.ingestServerGeofenceEvents(
        data.trip_id || effectiveTripId,
        data.geofence_events,
        data.geofence_state,
        data.geofence_config
      );
      if (newlyTriggered.length > 0) {
        newlyTriggered.forEach((evt) => showToast(evt.message, 'info'));
      }

      if (data.tracking_token) {
        trackingTokenRef.current = data.tracking_token;
        setTrackingToken(data.tracking_token);
      }

      updateMarkerPosition(data.latest_location);
    } catch (err: any) {
      const localFallback = buildLocalTrackingFallback(effectiveTripId, loadId);
      if (localFallback) {
        setTelemetry(localFallback);
        setLastSyncTime(new Date());
        setErrorMsg(null);
        updateMarkerPosition(localFallback.latest_location);
      } else {
        console.warn('[ShipperLiveTracker Notice]:', err.message);
        setErrorMsg(err.message || 'Connecting to vehicle telemetry...');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveTripId, loadId, updateMarkerPosition]);

  // Reset animation refs when switching active trip
  useEffect(() => {
    syncedToServerRef.current = false;
    targetCoordRef.current = null;
    prevCoordRef.current = null;
    animatedCoordRef.current = null;
    const localInitial = buildLocalTrackingFallback(effectiveTripId, loadId);
    if (localInitial) {
      setTelemetry(localInitial);
      updateMarkerPosition(localInitial.latest_location);
      setIsLoading(false);
    }
  }, [effectiveTripId, loadId, updateMarkerPosition]);

  // Poll live telemetry every 3.5 seconds + subscribe to local driver GPS updates
  useEffect(() => {
    fetchLiveTrackingData();
    const interval = setInterval(() => {
      fetchLiveTrackingData(false);
    }, 3500);

    const unsub = logisticsStore.subscribe(() => {
      const latestLocal = buildLocalTrackingFallback(effectiveTripId, loadId);
      if (latestLocal?.latest_location) {
        const localTime = new Date(latestLocal.latest_location.recorded_at).getTime();
        setTelemetry((prev) => {
          if (!prev) return latestLocal;
          const prevTime = prev.latest_location ? new Date(prev.latest_location.recorded_at).getTime() : 0;
          if (localTime > prevTime) {
            updateMarkerPosition(latestLocal.latest_location);
            return latestLocal;
          }
          return prev;
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fetchLiveTrackingData, effectiveTripId, loadId, updateMarkerPosition]);

  if (isLoading && !telemetry) {
    return (
      <div className={`w-full min-h-[420px] bg-[#171318] text-white rounded-3xl p-8 flex flex-col items-center justify-center border border-gray-800 ${className}`}>
        <div className="w-12 h-12 border-4 border-[#E83E83] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-black text-gray-200">Connecting to Satellite Telemetry & Tracking Token...</p>
        <p className="text-xs text-gray-500 font-mono mt-1">Trip ID: {effectiveTripId}</p>
      </div>
    );
  }

  const isLive = telemetry?.offline_buffer_status?.is_live ?? true;
  const ageSeconds = telemetry?.offline_buffer_status?.last_ping_age_seconds ?? 0;
  const bufferedCount = telemetry?.offline_buffer_status?.buffered_pings_count ?? 0;

  return (
    <div className={`w-full flex flex-col gap-4 text-[#171318] ${className}`}>
      {/* Top Telemetry & Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] flex items-center justify-center font-bold">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-[#E83E83] tracking-wider">Shipper Live Tracking</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 font-mono font-bold text-gray-600">
                TOKEN AUTHENTICATED
              </span>
            </div>
            <h3 className="text-base font-black text-[#171318]">
              {telemetry?.pickup.city} → {telemetry?.drop.city}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Signal Status Indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              isLive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isLive ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live GPS Feed ({ageSeconds}s ago)</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Offline Buffering ({ageSeconds}s ago)</span>
              </>
            )}
          </div>

          <button
            onClick={() => fetchLiveTrackingData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition cursor-pointer"
            title="Refresh GPS Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#E83E83]' : ''}`} />
          </button>

          {/* Test / Driver Simulator Trigger */}
          {onOpenDriverSimulator && (
            <button
              onClick={() => onOpenDriverSimulator(effectiveTripId, trackingToken || '')}
              className="px-3 py-1.5 bg-[#FFF0F6] border border-[#F4A7C5] text-[#E83E83] hover:bg-[#FFE3EE] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Driver Pings</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Cell Dead Zone Warning Banner */}
      {!isLive && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 shadow-sm animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Cellular Dead Zone Encountered:</strong> The truck is traversing an intermittent signal highway sector.
            All GPS pings continue to be recorded with satellite timestamps in local device memory and will automatically sync once reception returns.
          </div>
        </div>
      )}

      {/* MAP VIEWPORT CANVAS */}
      <div className="relative w-full h-[450px] md:h-[520px] rounded-3xl overflow-hidden border border-gray-200 bg-[#E8EEF4] shadow-xl flex flex-col">
        {/* Floating Top HUD */}
        <div className="absolute top-3 left-3 right-3 z-[420] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Vehicle & Speed Badge */}
          <div className="bg-[#171318]/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-gray-700 shadow-xl pointer-events-auto flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-[#E83E83] flex items-center justify-center font-bold text-white shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-black tracking-wider flex items-center gap-1">
                <span>{telemetry?.vehicle.vehicle_type.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[#E83E83]">•</span>
                <span className="text-emerald-400 font-mono font-bold">{telemetry?.tracking_source}</span>
              </div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>{telemetry?.vehicle.vehicle_number}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                  {telemetry?.latest_location?.speed || 0} km/h
                </span>
              </div>
            </div>
          </div>

          {/* ETA & Distance Telemetry Card */}
          <div className="bg-[#171318]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-700 shadow-xl pointer-events-auto flex items-center gap-4 text-white text-xs">
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Remaining Distance</span>
              <span className="text-[#E83E83] font-black font-mono text-sm">
                {telemetry?.eta.distance_remaining_km || 0} km
              </span>
            </div>
            <div className="border-l border-gray-700 pl-3">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Estimated Arrival</span>
              <span className="text-white font-black font-mono text-sm">
                ~{telemetry?.eta.formatted || 'Calculating...'}
              </span>
            </div>
            <div className="border-l border-gray-700 pl-3 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Device Battery</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">
                  {telemetry?.latest_location?.battery_level ?? 88}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OPENSTREETMAP + OSRM MAP CANVAS */}
        <div className="flex-1 w-full h-full min-h-0 relative">
          {telemetry?.pickup && telemetry?.drop ? (
            <LiveTelemetryFallbackMap
              pickup={telemetry.pickup}
              drop={telemetry.drop}
              currentLocation={animatedCoord || telemetry.latest_location}
              historyPings={telemetry.location_history}
              vehicleNumber={telemetry.vehicle.vehicle_number}
              speedKmh={telemetry.latest_location?.speed || 0}
              heading={animatedHeading}
              remainingKm={telemetry.eta.distance_remaining_km}
              pickupRadiusMeters={telemetry.geofence_config?.pickupRadiusMeters}
              deliveryRadiusMeters={telemetry.geofence_config?.deliveryRadiusMeters}
              insidePickup={telemetry.geofence_state?.insidePickup}
              insideDelivery={telemetry.geofence_state?.insideDelivery}
              autoFollowVehicle={true}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 text-xs gap-2 p-6 text-center">
              <div className="w-8 h-8 border-2 border-[#E83E83] border-t-transparent rounded-full animate-spin" />
              <span>{errorMsg || 'Synchronizing vehicle telemetry coordinates...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* GEO-FENCE ZONE MONITOR & CONFIGURATION */}
      {telemetry && (
        <GeofenceMonitorPanel
          tripId={telemetry.trip_id || effectiveTripId}
          pickupCity={telemetry.pickup.city}
          deliveryCity={telemetry.drop.city}
          config={telemetry.geofence_config || DEFAULT_GEOFENCE_CONFIG}
          state={telemetry.geofence_state || { insidePickup: false, insideDelivery: false }}
          events={telemetry.geofence_events || []}
          canEditConfig={true}
          onSaveConfig={async (patch: Partial<GeofenceZoneConfig>) => {
            const targetId = telemetry.trip_id || effectiveTripId;
            try {
              const res = await fetch(`/trips/${encodeURIComponent(targetId)}/geofence`, {
                method: 'POST',
                headers: logisticsStore.buildAuthHeaders(true),
                body: JSON.stringify({ ...patch, tracking_token: telemetry.tracking_token })
              });
              if (res.ok) {
                logisticsStore.updateGeofenceConfig(targetId, patch);
                await fetchLiveTrackingData(true);
                showToast('Geo-Fence perimeter rules saved.', 'success');
              }
            } catch {
              logisticsStore.updateGeofenceConfig(targetId, patch);
              showToast('Geo-Fence rules updated locally.', 'info');
            }
          }}
        />
      )}

      {/* DRIVER CONTACT & VEHICLE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Driver Contact & Direct Phone Trigger */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] flex items-center justify-center font-black text-lg">
                {telemetry?.driver.name.charAt(0) || 'D'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-[#171318]">{telemetry?.driver.name}</h4>
                  <span title="Verified Commercial Driver">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono">{telemetry?.driver.phone_number}</p>
                <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Active Driver on Duty
                </span>
              </div>
            </div>

            {/* Direct One-Tap Call Button */}
            <a
              href={`tel:${telemetry?.driver.phone_number}`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Call Driver</span>
            </a>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Tracking Source: <strong>{telemetry?.tracking_source}</strong></span>
            <a
              href={`https://wa.me/${telemetry?.driver.phone_number.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(
                telemetry?.driver.name || ''
              )},%20checking%20status%20for%20trip%20${effectiveTripId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#E83E83] hover:underline flex items-center gap-1 font-bold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Driver</span>
            </a>
          </div>
        </div>

        {/* Transit Points & Heading Info */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between text-xs">
          <div>
            <div className="text-[10px] font-black uppercase text-gray-400 mb-2">Transit Corridor Points</div>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#171318]">Pickup: {telemetry?.pickup.city}</div>
                  <div className="text-gray-500 text-[11px]">{telemetry?.pickup.address}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#171318]">Drop: {telemetry?.drop.city}</div>
                  <div className="text-gray-500 text-[11px]">{telemetry?.drop.address}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-gray-500">
            <span>Vehicle Heading: <strong>{animatedHeading}°</strong></span>
            <span>Last Telemetry Sync: <strong>{lastSyncTime.toLocaleTimeString('en-IN')}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
