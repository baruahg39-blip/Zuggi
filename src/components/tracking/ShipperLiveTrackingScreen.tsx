import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Truck,
  Phone,
  MessageSquare,
  Navigation,
  ShieldCheck,
  Wifi,
  WifiOff,
  Battery,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Crosshair,
  Maximize2
} from 'lucide-react';
import { TripLiveTrackingResponse, TripLocationPing, TripStatus, GeofenceZoneConfig } from '../../types';
import { logisticsStore } from '../../services/store';
import { DEFAULT_GEOFENCE_CONFIG } from '../../utils/geofence';
import { GeofenceOverlay } from '../maps/GeofenceOverlay';
import { GeofenceMonitorPanel } from './GeofenceMonitorPanel';
import { LiveTelemetryFallbackMap } from '../maps/LiveTelemetryFallbackMap';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { buildLocalTrackingFallback, syncLocalTripToServer } from '../../utils/trackingFallback';
import { showToast } from '../shared/Toast';

interface ShipperLiveTrackingScreenProps {
  tripId: string;
  loadId?: string;
  initialTrackingToken?: string;
  onBack?: () => void;
  onOpenDriverSimulator?: (tripId: string, token: string) => void;
}

const MILESTONES: { key: TripStatus; label: string; desc: string }[] = [
  { key: 'ASSIGNED', label: 'Trip Assigned', desc: 'Vehicle & driver locked' },
  { key: 'AT_PICKUP', label: 'At Loading Yard', desc: 'Arrived at pickup warehouse' },
  { key: 'IN_TRANSIT', label: 'On Road / In Transit', desc: 'Highway transport active' },
  { key: 'DELIVERED', label: 'Delivered', desc: 'Arrived at consignee depot' }
];

// Subcomponent: Map Controller for Route Polylines and Reactive Live Camera Updates
const MapRouteController: React.FC<{
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
  const breadcrumbLineRef = useRef<google.maps.Polyline | null>(null);
  const fittedTripKeyRef = useRef<string | null>(null);
  const lastPannedKeyRef = useRef<string | null>(null);
  const latestLocationRef = useRef<{ lat: number; lng: number } | null>(targetLocation);
  latestLocationRef.current = targetLocation;

  // Create polyline instances once per map instance
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
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map
    });

    polylineRef.current = plannedLine;
    breadcrumbLineRef.current = breadcrumbLine;

    return () => {
      plannedLine.setMap(null);
      breadcrumbLine.setMap(null);
      polylineRef.current = null;
      breadcrumbLineRef.current = null;
    };
  }, [map, mapsLib]);

  // Update planned corridor path in-place
  useEffect(() => {
    if (!polylineRef.current) return;
    let pathCoordinates: google.maps.LatLngLiteral[] = [];

    if (routePolyline && geometryLib?.encoding) {
      try {
        const decoded = geometryLib.encoding.decodePath(routePolyline);
        pathCoordinates = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      } catch {
        // fallback to corridor curve
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

  // Update live traveled breadcrumb trail in-place without recreating polyline on every 3.5s poll
  useEffect(() => {
    if (!breadcrumbLineRef.current) return;
    const historyCoords = (historyPings || []).map((p) => ({ lat: p.lat, lng: p.lng }));
    if (
      targetLocation &&
      (historyCoords.length === 0 ||
        historyCoords[historyCoords.length - 1].lat !== targetLocation.lat ||
        historyCoords[historyCoords.length - 1].lng !== targetLocation.lng)
    ) {
      historyCoords.push({ lat: targetLocation.lat, lng: targetLocation.lng });
    }
    breadcrumbLineRef.current.setPath(historyCoords.length > 1 ? historyCoords : []);
  }, [historyPings, targetLocation?.lat, targetLocation?.lng, map, mapsLib]);

  // Fit bounds once initially per trip (or when user clicks Fit Route)
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

  // Focus camera directly onto the freshest live vehicle location when requested
  useEffect(() => {
    if (!map || focusVehicleSignal === 0) return;
    const loc = latestLocationRef.current || { lat: pickup.lat, lng: pickup.lng };
    map.panTo({ lat: loc.lat, lng: loc.lng });
    const currentZoom = map.getZoom() || 8;
    if (currentZoom < 12) map.setZoom(12);
  }, [map, focusVehicleSignal, pickup.lat, pickup.lng]);

  return null;
};

export const ShipperLiveTrackingScreen: React.FC<ShipperLiveTrackingScreenProps> = ({
  tripId,
  loadId,
  initialTrackingToken,
  onBack,
  onOpenDriverSimulator
}) => {
  const { apiKey, canRenderGoogleMap, fallbackReason, reportMapError } = useGoogleMapsApiKey();

  const [trackingData, setTrackingData] = useState<TripLiveTrackingResponse | null>(() =>
    buildLocalTrackingFallback(tripId, loadId)
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !buildLocalTrackingFallback(tripId, loadId));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [fitRouteSignal, setFitRouteSignal] = useState<number>(0);
  const [focusVehicleSignal, setFocusVehicleSignal] = useState<number>(0);
  const syncedToServerRef = useRef<boolean>(false);

  // Stable initial map center per tripId so <GoogleMap defaultCenter> does not churn on live updates
  const initialMapCenter = useMemo(() => {
    const initial = buildLocalTrackingFallback(tripId, loadId);
    if (initial?.latest_location) {
      return { lat: initial.latest_location.lat, lng: initial.latest_location.lng };
    }
    if (initial?.pickup) {
      return { lat: initial.pickup.lat, lng: initial.pickup.lng };
    }
    return { lat: 26.1445, lng: 91.7362 };
  }, [tripId, loadId]);

  // Smooth Marker Animation State (LERP Interpolation)
  const [animatedCoord, setAnimatedCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [animatedHeading, setAnimatedHeading] = useState<number>(0);
  const animatedCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const prevCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const targetCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef<number | null>(null);

  const applyAnimatedLocation = useCallback((latestLocation: TripLocationPing | null | undefined) => {
    if (!latestLocation) return;
    const nextLat = latestLocation.lat;
    const nextLng = latestLocation.lng;
    const nextHeading = latestLocation.heading || 0;

    if (!targetCoordRef.current) {
      const initCoord = { lat: nextLat, lng: nextLng };
      targetCoordRef.current = initCoord;
      prevCoordRef.current = initCoord;
      animatedCoordRef.current = initCoord;
      setAnimatedCoord(initCoord);
      setAnimatedHeading(nextHeading);
    } else if (
      targetCoordRef.current.lat !== nextLat ||
      targetCoordRef.current.lng !== nextLng
    ) {
      prevCoordRef.current = animatedCoordRef.current || targetCoordRef.current;
      targetCoordRef.current = { lat: nextLat, lng: nextLng };
      animationStartTimeRef.current = performance.now();
      setAnimatedHeading(nextHeading);

      const DURATION = 1000;

      const animate = (currentTime: number) => {
        if (!animationStartTimeRef.current || !prevCoordRef.current || !targetCoordRef.current) return;
        const elapsed = currentTime - animationStartTimeRef.current;
        const progress = Math.min(1, elapsed / DURATION);
        const ease = 1 - Math.pow(1 - progress, 3);

        const interpolatedLat =
          prevCoordRef.current.lat + (targetCoordRef.current.lat - prevCoordRef.current.lat) * ease;
        const interpolatedLng =
          prevCoordRef.current.lng + (targetCoordRef.current.lng - prevCoordRef.current.lng) * ease;

        const nextPoint = { lat: interpolatedLat, lng: interpolatedLng };
        animatedCoordRef.current = nextPoint;
        setAnimatedCoord(nextPoint);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, []);

  // 1. Fetch live tracking data from backend API: GET /trips/:id/live-tracking
  const fetchLiveTracking = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsRefreshing(true);
      const res = await fetch(`/trips/${encodeURIComponent(tripId)}/live-tracking`);
      if (!res.ok) {
        // Hydrate from local logisticsStore booking/load if server restarted or booking was created client-side
        const localFallback = buildLocalTrackingFallback(tripId, loadId);
        if (localFallback) {
          setTrackingData(localFallback);
          setLastSyncTime(new Date());
          setSyncError(null);
          applyAnimatedLocation(localFallback.latest_location);
          if (!syncedToServerRef.current) {
            syncedToServerRef.current = true;
            void syncLocalTripToServer(localFallback);
          }
          return;
        }
        // Final fallback to demo trip only if no matching local load/booking exists
        if (res.status === 404 && tripId !== 'trip_demo_01') {
          const demoRes = await fetch('/trips/trip_demo_01/live-tracking');
          if (demoRes.ok) {
            const demoData: TripLiveTrackingResponse = await demoRes.json();
            setTrackingData(demoData);
            setLastSyncTime(new Date());
            setSyncError(null);
            applyAnimatedLocation(demoData.latest_location);
            return;
          }
        }
        throw new Error(`Tracking service returned HTTP ${res.status}`);
      }
      const data: TripLiveTrackingResponse = await res.json();
      setTrackingData(data);
      setLastSyncTime(new Date());
      setSyncError(null);

      const newlyTriggered = logisticsStore.ingestServerGeofenceEvents(
        data.trip_id || tripId,
        data.geofence_events,
        data.geofence_state,
        data.geofence_config
      );
      if (newlyTriggered.length > 0) {
        newlyTriggered.forEach((evt) => showToast(evt.message, 'info'));
      }

      applyAnimatedLocation(data.latest_location);
    } catch (err: any) {
      const localFallback = buildLocalTrackingFallback(tripId, loadId);
      if (localFallback) {
        setTrackingData(localFallback);
        setLastSyncTime(new Date());
        setSyncError(null);
        applyAnimatedLocation(localFallback.latest_location);
      } else {
        console.warn('[Tracking Sync Error]', err.message);
        setSyncError(err.message || 'Unable to sync live telemetry');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tripId, loadId, applyAnimatedLocation]);

  // Reset refs when trip changes
  useEffect(() => {
    syncedToServerRef.current = false;
    targetCoordRef.current = null;
    prevCoordRef.current = null;
    animatedCoordRef.current = null;
    const initialLocal = buildLocalTrackingFallback(tripId, loadId);
    if (initialLocal) {
      setTrackingData(initialLocal);
      applyAnimatedLocation(initialLocal.latest_location);
      setIsLoading(false);
    }
  }, [tripId, loadId, applyAnimatedLocation]);

  // Initial fetch, store subscription for instant driver GPS updates, and auto-polling every 3.5 seconds
  useEffect(() => {
    fetchLiveTracking();
    const interval = setInterval(() => {
      fetchLiveTracking(false);
    }, 3500);

    const unsub = logisticsStore.subscribe(() => {
      const latestLocal = buildLocalTrackingFallback(tripId, loadId);
      if (latestLocal?.latest_location) {
        const localTime = new Date(latestLocal.latest_location.recorded_at).getTime();
        setTrackingData((prev) => {
          if (!prev) return latestLocal;
          const prevTime = prev.latest_location ? new Date(prev.latest_location.recorded_at).getTime() : 0;
          if (localTime > prevTime) {
            applyAnimatedLocation(latestLocal.latest_location);
            return latestLocal;
          }
          return prev;
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [fetchLiveTracking, tripId, loadId, applyAnimatedLocation]);

  const currentStatusIndex = useMemo(() => {
    if (!trackingData) return 0;
    const idx = MILESTONES.findIndex((m) => m.key === trackingData.status);
    return idx >= 0 ? idx : 0;
  }, [trackingData]);

  if (isLoading && !trackingData) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center p-8 bg-[#171318] text-white rounded-3xl">
        <div className="w-12 h-12 border-4 border-[#E83E83] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-gray-300">Connecting to vehicle satellite tracking system...</p>
        <p className="text-xs text-gray-500 mt-1">Trip ID: {tripId}</p>
      </div>
    );
  }

  const isLiveSignal = trackingData?.offline_buffer_status?.is_live ?? true;
  const ageSeconds = trackingData?.offline_buffer_status?.last_ping_age_seconds ?? 0;
  const bufferedCount = trackingData?.offline_buffer_status?.buffered_pings_count ?? 0;

  return (
    <div className="w-full flex flex-col gap-4 text-[#171318]">
      {/* Top Header & Trip Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition cursor-pointer"
              title="Return"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#E83E83]">Live Freight Tracking</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-mono text-gray-600 font-bold">
                Trip #{tripId.slice(-6).toUpperCase()}
              </span>
            </div>
            <h2 className="text-lg font-black text-[#171318]">
              {trackingData?.pickup.city} → {trackingData?.drop.city}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Signal Status Indicator Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              isLiveSignal
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {isLiveSignal ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Signal ({ageSeconds}s ago)</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Buffering Offline ({ageSeconds}s ago)</span>
              </>
            )}
          </div>

          <button
            onClick={() => fetchLiveTracking(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition cursor-pointer flex items-center justify-center"
            title="Refresh GPS Feed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#E83E83]' : ''}`} />
          </button>

          {/* Test / Simulator Trigger button */}
          {onOpenDriverSimulator && (
            <button
              onClick={() =>
                onOpenDriverSimulator(
                  trackingData?.trip_id || tripId,
                  trackingData?.tracking_token || initialTrackingToken || 'trk_sec_993821739182371928371923'
                )
              }
              className="px-3 py-1.5 bg-[#FFF0F6] border border-[#F4A7C5] text-[#E83E83] rounded-xl text-xs font-bold hover:bg-[#FFE3EE] transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate GPS & Drops</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Buffering Explanatory Alert Banner (Displayed when in cell dead zone or pings synced) */}
      {!isLiveSignal ? (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-sm animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Cellular Dead Zone Encountered: </span>
            The vehicle is currently travelling through an intermittent signal corridor (e.g., hill passes or forest highway stretch).
            GPS pings are securely buffered in device memory with timestamps and will automatically batch-flush to your map once cellular service resumes.
          </div>
        </div>
      ) : bufferedCount > 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl flex items-center gap-2 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Cellular Restored:</strong> {bufferedCount} offline buffered GPS pings were synced to reconstitute the complete highway trail.
          </span>
        </div>
      ) : null}

      {/* MAIN TRACKING MAP CONTAINER */}
      <div className="relative w-full h-[460px] md:h-[540px] rounded-3xl overflow-hidden border border-gray-200 bg-[#E8EEF4] shadow-lg flex flex-col">
        {/* Floating Top Telemetry HUD */}
        <div className="absolute top-3 left-3 right-3 z-[420] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Vehicle & Speed Card */}
          <div className="bg-[#171318]/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-gray-700 shadow-xl pointer-events-auto flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-[#E83E83] flex items-center justify-center font-bold text-white shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-black tracking-wider flex items-center gap-1">
                <span>{trackingData?.vehicle.vehicle_type.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[#E83E83]">•</span>
                <span className="text-emerald-400 font-mono font-bold">{trackingData?.tracking_source}</span>
              </div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>{trackingData?.vehicle.vehicle_number}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">
                  {trackingData?.latest_location?.speed || 0} km/h
                </span>
              </div>
            </div>
          </div>

          {/* ETA & Remaining Distance Card */}
          <div className="bg-[#171318]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-700 shadow-xl pointer-events-auto flex items-center gap-4 text-white text-xs">
            <div>
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Remaining</span>
              <span className="text-[#E83E83] font-black font-mono text-sm">
                {trackingData?.eta.distance_remaining_km || 0} km
              </span>
            </div>
            <div className="border-l border-gray-700 pl-3">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Est. Transit Time</span>
              <span className="text-white font-black font-mono text-sm">
                ~{trackingData?.eta.formatted || 'Calculating...'}
              </span>
            </div>
            <div className="border-l border-gray-700 pl-3 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Battery</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">
                  {trackingData?.latest_location?.battery_level ?? 92}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* GOOGLE MAPS INTERACTIVE VIEW WITH LIVE ROAD MAP FALLBACK */}
        <div className="flex-1 w-full h-full min-h-0 relative">
          {canRenderGoogleMap ? (
            <>
              <APIProvider
                apiKey={apiKey}
                language="en"
                region="IN"
                libraries={['maps', 'marker', 'geometry']}
                onError={reportMapError}
              >
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  colorScheme="LIGHT"
                  mapTypeId="roadmap"
                  style={{ width: '100%', height: '100%' }}
                  defaultCenter={initialMapCenter}
                  defaultZoom={8}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  onDragstart={() => setAutoFollow(false)}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  {/* Pickup Marker (Green Pin) */}
                  {trackingData?.pickup && (
                    <AdvancedMarker
                      position={{ lat: trackingData.pickup.lat, lng: trackingData.pickup.lng }}
                      title={`Pickup: ${trackingData.pickup.city}`}
                    >
                      <Pin background="#10B981" borderColor="#064E3B" glyphColor="#ffffff" scale={1.1} />
                    </AdvancedMarker>
                  )}

                  {/* Drop Marker (Red Pin) */}
                  {trackingData?.drop && (
                    <AdvancedMarker
                      position={{ lat: trackingData.drop.lat, lng: trackingData.drop.lng }}
                      title={`Drop: ${trackingData.drop.city}`}
                    >
                      <Pin background="#EF4444" borderColor="#7F1D1D" glyphColor="#ffffff" scale={1.1} />
                    </AdvancedMarker>
                  )}

                  {/* Live Animated Moving Truck Marker (Interpolated) */}
                  {animatedCoord && (
                    <AdvancedMarker
                      position={animatedCoord}
                      title={`${trackingData?.vehicle.vehicle_number} (Live)`}
                    >
                      <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-transform">
                        {/* Pulsing Ripple Effect */}
                        <div className="w-12 h-12 rounded-full bg-[#E83E83]/30 animate-ping absolute"></div>
                        {/* Truck Icon rotating according to heading bearing */}
                        <div
                          className="w-10 h-10 rounded-full bg-[#E83E83] border-2 border-white shadow-2xl flex items-center justify-center text-white font-bold transition-transform duration-300"
                          style={{ transform: `rotate(${animatedHeading}deg)` }}
                        >
                          <Navigation className="w-5 h-5 fill-current text-white" />
                        </div>
                        {/* Callout Tag */}
                        <div className="absolute -bottom-6 bg-[#171318] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-700 whitespace-nowrap shadow-md flex items-center gap-1">
                          <span>{trackingData?.vehicle.vehicle_number}</span>
                          <span className="text-[#10B981]">•</span>
                          <span>{trackingData?.latest_location?.speed || 0} km/h</span>
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* Geo-Fence Circular Zones Overlay */}
                  {trackingData?.pickup && trackingData?.drop && (
                    <GeofenceOverlay
                      pickup={trackingData.pickup}
                      delivery={trackingData.drop}
                      pickupRadiusMeters={trackingData.geofence_config?.pickupRadiusMeters}
                      deliveryRadiusMeters={trackingData.geofence_config?.deliveryRadiusMeters}
                      insidePickup={trackingData.geofence_state?.insidePickup}
                      insideDelivery={trackingData.geofence_state?.insideDelivery}
                    />
                  )}

                  {/* Polyline and Reactive Live Camera Controller */}
                  {trackingData && (
                    <MapRouteController
                      tripKey={trackingData.trip_id || tripId}
                      pickup={trackingData.pickup}
                      drop={trackingData.drop}
                      targetLocation={
                        trackingData.latest_location
                          ? { lat: trackingData.latest_location.lat, lng: trackingData.latest_location.lng }
                          : animatedCoord
                      }
                      historyPings={trackingData.location_history}
                      routePolyline={trackingData.route_polyline}
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
                  title="Fit entire pickup-to-drop route"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fit Route</span>
                </button>
              </div>
            </>
          ) : trackingData?.pickup && trackingData?.drop ? (
            <LiveTelemetryFallbackMap
              pickup={trackingData.pickup}
              drop={trackingData.drop}
              currentLocation={animatedCoord || trackingData.latest_location}
              historyPings={trackingData.location_history}
              vehicleNumber={trackingData.vehicle.vehicle_number}
              speedKmh={trackingData.latest_location?.speed || 0}
              heading={animatedHeading}
              remainingKm={trackingData.eta.distance_remaining_km}
              pickupRadiusMeters={trackingData.geofence_config?.pickupRadiusMeters}
              deliveryRadiusMeters={trackingData.geofence_config?.deliveryRadiusMeters}
              insidePickup={trackingData.geofence_state?.insidePickup}
              insideDelivery={trackingData.geofence_state?.insideDelivery}
              reason={fallbackReason}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 text-xs gap-2 p-6 text-center">
              <div className="w-8 h-8 border-2 border-[#E83E83] border-t-transparent rounded-full animate-spin" />
              <span>{syncError || 'Synchronizing vehicle telemetry coordinates...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* MILESTONE PROGRESSION TRACKER */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="text-xs font-black uppercase text-gray-500 mb-3 tracking-wider">Milestone Lifecycle</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MILESTONES.map((m, idx) => {
            const isCompleted = idx < currentStatusIndex;
            const isCurrent = idx === currentStatusIndex;
            return (
              <div
                key={m.key}
                className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#FFF0F6] border-[#E83E83] text-[#E83E83]'
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Step {idx + 1}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E83E83] animate-ping"></span>
                  ) : null}
                </div>
                <div className="text-xs font-black leading-tight">{m.label}</div>
                <div className="text-[10px] opacity-80 mt-1 line-clamp-1">{m.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GEO-FENCE PERIMETER MONITOR & RULES */}
      {trackingData && (
        <GeofenceMonitorPanel
          tripId={trackingData.trip_id || tripId}
          pickupCity={trackingData.pickup.city}
          deliveryCity={trackingData.drop.city}
          config={trackingData.geofence_config || DEFAULT_GEOFENCE_CONFIG}
          state={trackingData.geofence_state || { insidePickup: false, insideDelivery: false }}
          events={trackingData.geofence_events || []}
          canEditConfig={true}
          onSaveConfig={async (patch: Partial<GeofenceZoneConfig>) => {
            const targetId = trackingData.trip_id || tripId;
            try {
              const res = await fetch(`/trips/${encodeURIComponent(targetId)}/geofence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
              });
              if (res.ok) {
                logisticsStore.updateGeofenceConfig(targetId, patch);
                await fetchLiveTracking(true);
                showToast('Geo-Fence zone radii & rules saved.', 'success');
              }
            } catch {
              logisticsStore.updateGeofenceConfig(targetId, patch);
              showToast('Geo-Fence rules updated locally.', 'info');
            }
          }}
        />
      )}

      {/* DRIVER CONTACT & VEHICLE DETAILS CARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Driver Profile & One-Tap Direct Call */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] flex items-center justify-center font-black text-lg">
                {trackingData?.driver.name.charAt(0) || 'D'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-[#171318]">{trackingData?.driver.name}</h4>
                  <span title="Verified Commercial Driver">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono font-medium">{trackingData?.driver.phone_number}</p>
                <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Active Driver on Duty
                </span>
              </div>
            </div>

            {/* Direct One-Tap Call Button */}
            <a
              href={`tel:${trackingData?.driver.phone_number}`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Call Driver</span>
            </a>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Tracking Source: <strong>{trackingData?.tracking_source}</strong></span>
            <a
              href={`https://wa.me/${trackingData?.driver.phone_number.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(
                trackingData?.driver.name || ''
              )},%20checking%20status%20for%20trip%20${tripId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#E83E83] hover:underline flex items-center gap-1 font-bold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Driver</span>
            </a>
          </div>
        </div>

        {/* Location & Facility Specs */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between text-xs">
          <div>
            <div className="text-[10px] font-black uppercase text-gray-400 mb-2">Transit Points</div>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#171318]">Pickup: {trackingData?.pickup.city}</div>
                  <div className="text-gray-500 text-[11px]">{trackingData?.pickup.address}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#171318]">Drop: {trackingData?.drop.city}</div>
                  <div className="text-gray-500 text-[11px]">{trackingData?.drop.address}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-gray-500">
            <span>Heading: <strong>{animatedHeading}° ({getCardinalDirection(animatedHeading)})</strong></span>
            <span>Last Telemetry Sync: <strong>{lastSyncTime.toLocaleTimeString('en-IN')}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to convert heading degrees into 8-wind compass direction
function getCardinalDirection(angle: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
  return directions[index];
}
