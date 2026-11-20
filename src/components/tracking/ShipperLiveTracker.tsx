import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Truck,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  Battery,
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Crosshair,
  Maximize2
} from 'lucide-react';
import { TripLiveTrackingResponse, TripLocationPing, GeofenceZoneConfig } from '../../types';
import { logisticsStore } from '../../services/store';
import { DEFAULT_GEOFENCE_CONFIG } from '../../utils/geofence';
import { GeofenceOverlay } from '../maps/GeofenceOverlay';
import { GeofenceMonitorPanel } from './GeofenceMonitorPanel';
import { LiveTelemetryFallbackMap } from '../maps/LiveTelemetryFallbackMap';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { buildLocalTrackingFallback, syncLocalTripToServer } from '../../utils/trackingFallback';
import { showToast } from '../shared/Toast';

export interface ShipperLiveTrackerProps {
  loadId?: string;
  tripId?: string;
  initialTrackingToken?: string;
  className?: string;
  onOpenDriverSimulator?: (tripId: string, token: string) => void;
}

// Subcomponent: Map Controller for Route Polylines and Reactive Live Camera Tracking
const TrackingMapController: React.FC<{
  tripKey: string;
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
  targetLocation: { lat: number; lng: number } | null;
  historyPings: TripLocationPing[];
  routePolyline?: string;
  autoFollow: boolean;
  fitRouteSignal: number;
  focusVehicleSignal: number;
}> = ({
  tripKey,
  pickup,
  drop,
  targetLocation,
  historyPings,
  routePolyline,
  autoFollow,
  fitRouteSignal,
  focusVehicleSignal
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const coreLib = useMapsLibrary('core');
  const geometryLib = useMapsLibrary('geometry');

  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const breadcrumbRef = useRef<google.maps.Polyline | null>(null);
  const fittedTripKeyRef = useRef<string | null>(null);
  const lastPannedKeyRef = useRef<string | null>(null);
  const latestLocationRef = useRef<{ lat: number; lng: number } | null>(targetLocation);
  latestLocationRef.current = targetLocation;

  useEffect(() => {
    if (!map || !mapsLib) return;

    const plannedLine = new mapsLib.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#E83E83',
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map
    });

    const breadcrumbLine = new mapsLib.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#10B981',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      map
    });

    polylineRef.current = plannedLine;
    breadcrumbRef.current = breadcrumbLine;

    return () => {
      plannedLine.setMap(null);
      breadcrumbLine.setMap(null);
      polylineRef.current = null;
      breadcrumbRef.current = null;
    };
  }, [map, mapsLib]);

  useEffect(() => {
    if (!polylineRef.current) return;
    let pathCoordinates: google.maps.LatLngLiteral[] = [];

    if (routePolyline && geometryLib?.encoding) {
      try {
        const decoded = geometryLib.encoding.decodePath(routePolyline);
        pathCoordinates = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      } catch {
        // fallback to standard coordinates
      }
    }

    if (pathCoordinates.length === 0) {
      const midLat = (pickup.lat + drop.lat) / 2 + 0.08;
      const midLng = (pickup.lng + drop.lng) / 2;
      pathCoordinates = [
        { lat: pickup.lat, lng: pickup.lng },
        { lat: midLat, lng: midLng },
        { lat: drop.lat, lng: drop.lng }
      ];
    }

    polylineRef.current.setPath(pathCoordinates);
  }, [map, mapsLib, geometryLib, pickup.lat, pickup.lng, drop.lat, drop.lng, routePolyline]);

  useEffect(() => {
    if (!breadcrumbRef.current) return;
    const historyCoords = (historyPings || []).map((p) => ({ lat: p.lat, lng: p.lng }));
    if (
      targetLocation &&
      (historyCoords.length === 0 ||
        historyCoords[historyCoords.length - 1].lat !== targetLocation.lat ||
        historyCoords[historyCoords.length - 1].lng !== targetLocation.lng)
    ) {
      historyCoords.push({ lat: targetLocation.lat, lng: targetLocation.lng });
    }
    breadcrumbRef.current.setPath(historyCoords.length > 1 ? historyCoords : []);
  }, [historyPings, targetLocation?.lat, targetLocation?.lng, map, mapsLib]);

  // Fit bounds once initially per trip (and when Fit Route is clicked)
  useEffect(() => {
    if (!map || !coreLib) return;
    if (fittedTripKeyRef.current === tripKey && fitRouteSignal === 0) return;

    const bounds = new coreLib.LatLngBounds();
    bounds.extend({ lat: pickup.lat, lng: pickup.lng });
    bounds.extend({ lat: drop.lat, lng: drop.lng });
    if (latestLocationRef.current) {
      bounds.extend({ lat: latestLocationRef.current.lat, lng: latestLocationRef.current.lng });
    }
    map.fitBounds(bounds, { top: 80, right: 60, bottom: 60, left: 60 });
    fittedTripKeyRef.current = tripKey;
  }, [map, coreLib, tripKey, fitRouteSignal, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // Smoothly pan camera whenever new live GPS coordinates arrive and auto-follow is enabled
  useEffect(() => {
    if (!map || !targetLocation || !autoFollow) return;
    const coordKey = `${tripKey}:${targetLocation.lat.toFixed(6)},${targetLocation.lng.toFixed(6)}`;
    if (lastPannedKeyRef.current === coordKey) return;
    const hadPriorCoord = lastPannedKeyRef.current !== null && lastPannedKeyRef.current.startsWith(`${tripKey}:`);
    lastPannedKeyRef.current = coordKey;
    if (hadPriorCoord) {
      map.panTo({ lat: targetLocation.lat, lng: targetLocation.lng });
    }
  }, [map, tripKey, targetLocation?.lat, targetLocation?.lng, autoFollow]);

  // Focus camera directly onto the live vehicle
  useEffect(() => {
    if (!map || focusVehicleSignal === 0) return;
    const loc = latestLocationRef.current || { lat: pickup.lat, lng: pickup.lng };
    map.panTo({ lat: loc.lat, lng: loc.lng });
    const currentZoom = map.getZoom() || 8;
    if (currentZoom < 12) map.setZoom(12);
  }, [map, focusVehicleSignal, pickup.lat, pickup.lng]);

  return null;
};

export const ShipperLiveTracker: React.FC<ShipperLiveTrackerProps> = ({
  loadId,
  tripId,
  initialTrackingToken,
  className = '',
  onOpenDriverSimulator
}) => {
  const { apiKey, canRenderGoogleMap, fallbackReason, reportMapError } = useGoogleMapsApiKey();

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
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [fitRouteSignal, setFitRouteSignal] = useState<number>(0);
  const [focusVehicleSignal, setFocusVehicleSignal] = useState<number>(0);
  const syncedToServerRef = useRef<boolean>(false);

  const initialMapCenter = useMemo(() => {
    const initial = buildLocalTrackingFallback(effectiveTripId, loadId);
    if (initial?.latest_location) {
      return { lat: initial.latest_location.lat, lng: initial.latest_location.lng };
    }
    if (initial?.pickup) {
      return { lat: initial.pickup.lat, lng: initial.pickup.lng };
    }
    return { lat: 26.1445, lng: 91.7362 };
  }, [effectiveTripId, loadId]);

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
            trackingTokenRef.current = fallbackData.tracking_token || 'trk_sec_993821739182371928371923';
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
              onClick={() => onOpenDriverSimulator(effectiveTripId, trackingToken || 'trk_sec_993821739182371928371923')}
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
      <div className="relative w-full h-[450px] md:h-[520px] rounded-3xl overflow-hidden border border-gray-200 bg-[#171318] shadow-xl flex flex-col">
        {/* Floating Top HUD */}
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
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

        {/* MAP CANVAS */}
        <div className="flex-1 w-full h-full relative">
          {canRenderGoogleMap ? (
            <>
              <APIProvider
                apiKey={apiKey}
                language="en"
                region="IN"
                onError={reportMapError}
              >
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  style={{ width: '100%', height: '100%' }}
                  defaultCenter={initialMapCenter}
                  defaultZoom={8}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  onDragstart={() => setAutoFollow(false)}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  {/* 1. Pickup Pin (Green) */}
                  {telemetry?.pickup && (
                    <AdvancedMarker
                      position={{ lat: telemetry.pickup.lat, lng: telemetry.pickup.lng }}
                      title={`Pickup: ${telemetry.pickup.city} (${telemetry.pickup.address})`}
                    >
                      <Pin background="#10B981" borderColor="#064E3B" glyphColor="#ffffff" scale={1.1} />
                    </AdvancedMarker>
                  )}

                  {/* 2. Drop Pin (Red) */}
                  {telemetry?.drop && (
                    <AdvancedMarker
                      position={{ lat: telemetry.drop.lat, lng: telemetry.drop.lng }}
                      title={`Destination: ${telemetry.drop.city} (${telemetry.drop.address})`}
                    >
                      <Pin background="#EF4444" borderColor="#7F1D1D" glyphColor="#ffffff" scale={1.1} />
                    </AdvancedMarker>
                  )}

                  {/* 3. Smooth Moving Animated Vehicle Marker */}
                  {animatedCoord && (
                    <AdvancedMarker
                      position={animatedCoord}
                      title={`${telemetry?.vehicle.vehicle_number} (Live)`}
                    >
                      <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                        <div className="w-12 h-12 rounded-full bg-[#E83E83]/30 animate-ping absolute"></div>
                        <div
                          className="w-10 h-10 rounded-full bg-[#E83E83] border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold transition-transform duration-300"
                          style={{ transform: `rotate(${animatedHeading}deg)` }}
                        >
                          <Navigation className="w-5 h-5 fill-current text-white" />
                        </div>
                        <div className="absolute -bottom-6 bg-[#171318] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-700 whitespace-nowrap shadow-md flex items-center gap-1">
                          <span>{telemetry?.vehicle.vehicle_number}</span>
                          <span className="text-[#10B981]">•</span>
                          <span>{telemetry?.latest_location?.speed || 0} km/h</span>
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Geo-Fence Circular Zones Overlay */}
                  {telemetry?.pickup && telemetry?.drop && (
                    <GeofenceOverlay
                      pickup={telemetry.pickup}
                      delivery={telemetry.drop}
                      pickupRadiusMeters={telemetry.geofence_config?.pickupRadiusMeters}
                      deliveryRadiusMeters={telemetry.geofence_config?.deliveryRadiusMeters}
                      insidePickup={telemetry.geofence_state?.insidePickup}
                      insideDelivery={telemetry.geofence_state?.insideDelivery}
                    />
                  )}

                  {/* Map Route Controller (Polyline & Reactive Live Camera) */}
                  {telemetry && (
                    <TrackingMapController
                      tripKey={telemetry.trip_id || effectiveTripId}
                      pickup={telemetry.pickup}
                      drop={telemetry.drop}
                      targetLocation={
                        telemetry.latest_location
                          ? { lat: telemetry.latest_location.lat, lng: telemetry.latest_location.lng }
                          : animatedCoord
                      }
                      historyPings={telemetry.location_history}
                      routePolyline={telemetry.route_polyline}
                      autoFollow={autoFollow}
                      fitRouteSignal={fitRouteSignal}
                      focusVehicleSignal={focusVehicleSignal}
                    />
                  )}
                </GoogleMap>
              </APIProvider>

              {/* Floating Camera Controls on Google Map */}
              <div className="absolute right-3 bottom-6 z-20 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAutoFollow(true);
                    setFocusVehicleSignal((n) => n + 1);
                  }}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold shadow-lg flex items-center gap-1.5 cursor-pointer transition ${
                    autoFollow
                      ? 'bg-[#E83E83] hover:bg-[#d62e73] text-white'
                      : 'bg-[#171318]/90 hover:bg-[#241E26] text-white border border-gray-700'
                  }`}
                  title="Focus camera and auto-follow live vehicle coordinates"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{autoFollow ? 'Following Truck' : 'Focus Truck'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoFollow(false);
                    setFitRouteSignal((n) => n + 1);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-[#171318]/90 hover:bg-[#241E26] text-white border border-gray-700 text-[11px] font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                  title="Fit entire route"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fit Route</span>
                </button>
              </div>
            </>
          ) : telemetry?.pickup && telemetry?.drop ? (
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
              reason={fallbackReason}
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
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
