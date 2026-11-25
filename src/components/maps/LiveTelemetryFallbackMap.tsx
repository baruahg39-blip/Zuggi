import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Maximize2,
  ExternalLink,
  Compass,
  ShieldCheck
} from 'lucide-react';
import { formatMetersOrKm } from '../../utils/geofence';
import {
  GUWAHATI_DEFAULT_CENTER,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
  fetchOsrmRoute,
  haversineDistanceKm
} from '../../services/osmMapService';

export interface TelemetryPoint {
  lat: number;
  lng: number;
  city?: string;
  address?: string;
}

export interface LiveTelemetryFallbackMapProps {
  pickup: TelemetryPoint;
  drop: TelemetryPoint;
  currentLocation: { lat: number; lng: number } | null;
  historyPings?: Array<{ lat: number; lng: number }>;
  vehicleNumber?: string;
  speedKmh?: number;
  heading?: number;
  remainingKm?: number;
  pickupRadiusMeters?: number;
  deliveryRadiusMeters?: number;
  insidePickup?: boolean;
  insideDelivery?: boolean;
  /** Optional pre-computed OSRM road route coordinates [lat, lng][] */
  routeCoordinates?: Array<[number, number]>;
  /** Interactive location picker mode for FreightLocationPicker */
  pickerMode?: 'pickup' | 'drop' | 'preview';
  /** Allow dragging pickup (green) and drop (red) markers directly on map */
  draggablePins?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onPickupDragEnd?: (lat: number, lng: number) => void;
  onDropDragEnd?: (lat: number, lng: number) => void;
  onCenterChange?: (lat: number, lng: number) => void;
  flyToTarget?: { lat: number; lng: number; zoom?: number; seq: number } | null;
  fitBoundsSeq?: number;
  autoFollowVehicle?: boolean;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makePinIcon(label: string, color: string, subtitle?: string, isActive?: boolean): L.DivIcon {
  const safeLabel = escapeHtml(label);
  const safeSub = subtitle ? escapeHtml(subtitle.slice(0, 22)) : '';
  const ring = isActive ? `0 0 0 6px ${color}33, 0 4px 12px rgba(0,0,0,0.35)` : '0 4px 10px rgba(0,0,0,0.32)';
  return L.divIcon({
    className: 'zuggi-osm-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:auto;">
        ${
          safeSub
            ? `<div style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.28);margin-bottom:4px;border:1.5px solid #fff;">${safeSub}</div>`
            : ''
        }
        <div style="width:32px;height:32px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:${ring};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;">
          ${safeLabel}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
        <div style="width:8px;height:3px;background:rgba(0,0,0,0.28);border-radius:9999px;margin-top:1px;"></div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [0, 0]
  });
}

function makeTruckIcon(vehicleNumber: string, speedKmh: number, heading: number): L.DivIcon {
  const safeVeh = escapeHtml(vehicleNumber.slice(0, 15));
  return L.divIcon({
    className: 'zuggi-osm-truck',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);pointer-events:auto;">
        <div style="width:38px;height:38px;border-radius:9999px;background:#E83E83;border:2.5px solid #fff;box-shadow:0 0 0 6px rgba(232,62,131,0.25), 0 4px 14px rgba(232,62,131,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(${Math.round(heading)}deg);">
            <polygon points="12,2 20,21 12,17 4,21" />
          </svg>
        </div>
        <div style="margin-top:4px;background:#171318;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:9999px;border:1px solid rgba(232,62,131,0.65);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-family:ui-monospace,monospace;">
          ${safeVeh}${speedKmh > 0 ? ` • ${speedKmh} km/h` : ''}
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [0, 0]
  });
}

/**
 * Interactive 100% Free OpenStreetMap + Leaflet + OSRM Freight Map.
 * Default-centered on Guwahati, Assam (26.1445, 91.7362).
 * Supports:
 *  - Click-anywhere pin placement & draggable Green Pickup / Red Drop-off markers
 *  - Real OSRM highway/road GeoJSON route polylines
 *  - Live moving vehicle markers, GPS breadcrumb trails, and circular geo-fence overlays
 */
export const LiveTelemetryFallbackMap: React.FC<LiveTelemetryFallbackMapProps> = ({
  pickup,
  drop,
  currentLocation,
  historyPings = [],
  vehicleNumber = 'Assigned Vehicle',
  speedKmh = 0,
  heading = 0,
  remainingKm,
  pickupRadiusMeters = 800,
  deliveryRadiusMeters = 500,
  insidePickup = false,
  insideDelivery = false,
  routeCoordinates,
  pickerMode,
  draggablePins = false,
  onMapClick,
  onPickupDragEnd,
  onDropDragEnd,
  onCenterChange,
  flyToTarget,
  fitBoundsSeq = 0,
  autoFollowVehicle = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const isProgrammaticRef = useRef(false);
  const hasFittedRef = useRef(false);
  const lastFollowedCoordRef = useRef<string | null>(null);

  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onPickupDragEndRef = useRef(onPickupDragEnd);
  onPickupDragEndRef.current = onPickupDragEnd;
  const onDropDragEndRef = useRef(onDropDragEnd);
  onDropDragEndRef.current = onDropDragEnd;
  const pickerModeRef = useRef(pickerMode);
  pickerModeRef.current = pickerMode;

  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [autoOsrmCoords, setAutoOsrmCoords] = useState<Array<[number, number]>>([]);
  const [isFollowing, setIsFollowing] = useState(autoFollowVehicle);

  const safePickup = useMemo(
    () => ({
      lat: Number.isFinite(pickup.lat) ? pickup.lat : GUWAHATI_DEFAULT_CENTER.lat,
      lng: Number.isFinite(pickup.lng) ? pickup.lng : GUWAHATI_DEFAULT_CENTER.lng,
      city: pickup.city || 'Guwahati',
      address: pickup.address || ''
    }),
    [pickup.lat, pickup.lng, pickup.city, pickup.address]
  );

  const safeDrop = useMemo(
    () => ({
      lat: Number.isFinite(drop.lat) ? drop.lat : 26.7509,
      lng: Number.isFinite(drop.lng) ? drop.lng : 94.2037,
      city: drop.city || 'Drop',
      address: drop.address || ''
    }),
    [drop.lat, drop.lng, drop.city, drop.address]
  );

  const activeLocation = useMemo(() => {
    if (currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lng)) {
      return currentLocation;
    }
    return { lat: safePickup.lat, lng: safePickup.lng };
  }, [currentLocation, safePickup.lat, safePickup.lng]);

  // Automatically fetch real OSRM highway geometry in tracking mode when caller didn't pass routeCoordinates
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length >= 2) {
      setAutoOsrmCoords([]);
      return;
    }
    if (pickerMode && pickerMode !== 'preview') return;

    const controller = new AbortController();
    fetchOsrmRoute(
      { lat: safePickup.lat, lng: safePickup.lng },
      { lat: safeDrop.lat, lng: safeDrop.lng },
      controller.signal
    )
      .then((res) => {
        if (!controller.signal.aborted && res.coordinates.length >= 2) {
          setAutoOsrmCoords(res.coordinates);
        }
      })
      .catch(() => {
        // Ignore abort / offline
      });

    return () => controller.abort();
  }, [safePickup.lat, safePickup.lng, safeDrop.lat, safeDrop.lng, routeCoordinates, pickerMode]);

  const effectiveRouteCoords = useMemo(() => {
    if (routeCoordinates && routeCoordinates.length >= 2) return routeCoordinates;
    if (autoOsrmCoords.length >= 2) return autoOsrmCoords;
    return [];
  }, [routeCoordinates, autoOsrmCoords]);

  const progressMetrics = useMemo(() => {
    const totalRoadKm = Math.max(
      1,
      haversineDistanceKm(safePickup.lat, safePickup.lng, safeDrop.lat, safeDrop.lng) * 1.3
    );
    const computedRemKm =
      remainingKm !== undefined
        ? remainingKm
        : Math.round(haversineDistanceKm(activeLocation.lat, activeLocation.lng, safeDrop.lat, safeDrop.lng) * 1.3 * 10) / 10;
    const progressPct = Math.min(100, Math.max(4, Math.round(((totalRoadKm - computedRemKm) / totalRoadKm) * 100)));
    return { totalRoadKm: Math.round(totalRoadKm), computedRemKm, progressPct };
  }, [safePickup, safeDrop, activeLocation, remainingKm]);

  // 1. Initialize Leaflet map with free OpenStreetMap tiles (default Guwahati, Assam 26.1445, 91.7362)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialLat = pickerMode === 'drop' ? safeDrop.lat : pickerMode === 'pickup' ? safePickup.lat : activeLocation.lat;
    const initialLng = pickerMode === 'drop' ? safeDrop.lng : pickerMode === 'pickup' ? safePickup.lng : activeLocation.lng;
    const initialZoom = pickerMode && pickerMode !== 'preview' ? 13 : 8;

    const map = L.map(el, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true
    });

    const tileLayer = L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_TILE_ATTRIBUTION
    });
    tileLayer.on('load', () => setTilesLoaded(true));
    tileLayer.addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayLayerRef.current = layerGroup;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    map.on('dragstart', () => {
      setIsFollowing(false);
    });

    map.on('moveend', () => {
      if (isProgrammaticRef.current) {
        isProgrammaticRef.current = false;
        return;
      }
      if (pickerModeRef.current && pickerModeRef.current !== 'preview' && onCenterChangeRef.current) {
        const c = map.getCenter();
        onCenterChangeRef.current(c.lat, c.lng);
      }
    });

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 160);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize();
          })
        : null;
    if (resizeObserver) resizeObserver.observe(el);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      overlayLayerRef.current = null;
      hasFittedRef.current = false;
    };
  }, []);

  // 2. Programmatic fly-to when search result or GPS triggers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    isProgrammaticRef.current = true;
    map.setView([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom ?? 14, { animate: true });
  }, [flyToTarget]);

  // 3. Programmatic fit bounds trigger
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitBoundsSeq === 0) return;
    const pts: Array<[number, number]> =
      effectiveRouteCoords.length >= 2
        ? effectiveRouteCoords
        : [
            [safePickup.lat, safePickup.lng],
            [safeDrop.lat, safeDrop.lng]
          ];
    const bounds = L.latLngBounds(pts);
    if (!pickerMode) {
      bounds.extend([activeLocation.lat, activeLocation.lng]);
    }
    isProgrammaticRef.current = true;
    map.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
  }, [fitBoundsSeq]);

  // 4. Smoothly pan camera to live vehicle when auto-follow is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pickerMode || !isFollowing) return;
    const key = `${activeLocation.lat.toFixed(5)},${activeLocation.lng.toFixed(5)}`;
    if (lastFollowedCoordRef.current === key) return;
    const hadPrior = lastFollowedCoordRef.current !== null;
    lastFollowedCoordRef.current = key;
    if (hadPrior) {
      isProgrammaticRef.current = true;
      map.panTo([activeLocation.lat, activeLocation.lng], { animate: true });
    }
  }, [activeLocation.lat, activeLocation.lng, pickerMode, isFollowing]);

  // 5. Render markers (draggable in picker mode), OSRM highway polyline, GPS breadcrumb trail, and geo-fences
  useEffect(() => {
    const map = mapRef.current;
    const layer = overlayLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Geo-fence circular perimeters (only in tracking mode)
    if (!pickerMode) {
      L.circle([safePickup.lat, safePickup.lng], {
        radius: Math.max(150, pickupRadiusMeters),
        color: '#10B981',
        weight: insidePickup ? 2.5 : 1.5,
        dashArray: '5 4',
        fillColor: '#10B981',
        fillOpacity: insidePickup ? 0.22 : 0.1
      }).addTo(layer);

      L.circle([safeDrop.lat, safeDrop.lng], {
        radius: Math.max(150, deliveryRadiusMeters),
        color: '#E83E83',
        weight: insideDelivery ? 2.5 : 1.5,
        dashArray: '5 4',
        fillColor: '#E83E83',
        fillOpacity: insideDelivery ? 0.24 : 0.1
      }).addTo(layer);
    }

    // Highway Route Polyline (Real OSRM road route when available)
    if (effectiveRouteCoords.length >= 2) {
      // Soft outer casing for high contrast on OSM streets
      L.polyline(effectiveRouteCoords, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(layer);

      L.polyline(effectiveRouteCoords, {
        color: '#E83E83',
        weight: 4.5,
        opacity: 0.92,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(layer);
    } else if (!pickerMode || pickerMode === 'preview') {
      L.polyline(
        [
          [safePickup.lat, safePickup.lng],
          [safeDrop.lat, safeDrop.lng]
        ],
        {
          color: '#E83E83',
          weight: 4,
          opacity: 0.78,
          dashArray: '8 6'
        }
      ).addTo(layer);
    }

    // Actual traveled GPS breadcrumb trail
    if (!pickerMode) {
      const trailPts = historyPings
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => [p.lat, p.lng] as [number, number]);
      if (currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lng)) {
        trailPts.push([currentLocation.lat, currentLocation.lng]);
      }
      if (trailPts.length > 1) {
        L.polyline(trailPts, {
          color: '#10B981',
          weight: 4,
          opacity: 0.95
        }).addTo(layer);
      }
    }

    // Pickup marker (Green Pin — draggable when draggablePins is enabled)
    const pickupMarker = L.marker([safePickup.lat, safePickup.lng], {
      icon: makePinIcon(
        'A',
        '#16A34A',
        `Pickup: ${safePickup.city}`,
        pickerMode === 'pickup'
      ),
      draggable: Boolean(draggablePins),
      zIndexOffset: pickerMode === 'pickup' ? 300 : 150
    }).addTo(layer);

    if (draggablePins) {
      pickupMarker.on('dragend', () => {
        const ll = pickupMarker.getLatLng();
        onPickupDragEndRef.current?.(ll.lat, ll.lng);
      });
    } else {
      pickupMarker.bindPopup(
        `<strong>Pickup: ${escapeHtml(safePickup.city)}</strong><br/>${escapeHtml(safePickup.address || '')}${
          !pickerMode ? `<br/><small>Geo-fence: ${formatMetersOrKm(pickupRadiusMeters)}</small>` : ''
        }`
      );
    }

    // Drop marker (Red Pin — draggable when draggablePins is enabled)
    const shouldRenderDrop = !pickerMode || pickerMode !== 'pickup' || Boolean(drop.address) || draggablePins;
    if (shouldRenderDrop) {
      const dropMarker = L.marker([safeDrop.lat, safeDrop.lng], {
        icon: makePinIcon(
          'B',
          '#DC2626',
          `Drop: ${safeDrop.city}`,
          pickerMode === 'drop'
        ),
        draggable: Boolean(draggablePins),
        zIndexOffset: pickerMode === 'drop' ? 300 : 150
      }).addTo(layer);

      if (draggablePins) {
        dropMarker.on('dragend', () => {
          const ll = dropMarker.getLatLng();
          onDropDragEndRef.current?.(ll.lat, ll.lng);
        });
      } else {
        dropMarker.bindPopup(
          `<strong>Drop: ${escapeHtml(safeDrop.city)}</strong><br/>${escapeHtml(safeDrop.address || '')}${
            !pickerMode ? `<br/><small>Geo-fence: ${formatMetersOrKm(deliveryRadiusMeters)}</small>` : ''
          }`
        );
      }
    }

    // Live vehicle marker (in tracking mode)
    if (!pickerMode) {
      L.marker([activeLocation.lat, activeLocation.lng], {
        icon: makeTruckIcon(vehicleNumber, speedKmh, heading),
        zIndexOffset: 500
      })
        .bindPopup(
          `<strong>${escapeHtml(vehicleNumber)}</strong><br/>Speed: ${speedKmh} km/h • Heading: ${Math.round(heading)}°<br/><small>${activeLocation.lat.toFixed(5)}°N, ${activeLocation.lng.toFixed(5)}°E</small>`
        )
        .addTo(layer);
    }

    // Fit route bounds once on mount or when entering preview mode
    if (!hasFittedRef.current && (!pickerMode || pickerMode === 'preview')) {
      const pts: Array<[number, number]> =
        effectiveRouteCoords.length >= 2
          ? effectiveRouteCoords
          : [
              [safePickup.lat, safePickup.lng],
              [safeDrop.lat, safeDrop.lng]
            ];
      const bounds = L.latLngBounds(pts);
      if (!pickerMode) {
        bounds.extend([activeLocation.lat, activeLocation.lng]);
      }
      isProgrammaticRef.current = true;
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
      hasFittedRef.current = true;
    }
  }, [
    safePickup,
    safeDrop,
    drop.address,
    activeLocation,
    currentLocation,
    historyPings,
    vehicleNumber,
    speedKmh,
    heading,
    pickupRadiusMeters,
    deliveryRadiusMeters,
    insidePickup,
    insideDelivery,
    effectiveRouteCoords,
    pickerMode,
    draggablePins
  ]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleCenterVehicle = () => {
    if (!mapRef.current) return;
    setIsFollowing(true);
    isProgrammaticRef.current = true;
    mapRef.current.setView([activeLocation.lat, activeLocation.lng], 13, { animate: true });
  };

  const handleFitRoute = () => {
    if (!mapRef.current) return;
    setIsFollowing(false);
    const pts: Array<[number, number]> =
      effectiveRouteCoords.length >= 2
        ? effectiveRouteCoords
        : [
            [safePickup.lat, safePickup.lng],
            [safeDrop.lat, safeDrop.lng]
          ];
    const bounds = L.latLngBounds(pts);
    if (!pickerMode) {
      bounds.extend([activeLocation.lat, activeLocation.lng]);
    }
    isProgrammaticRef.current = true;
    mapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
  };

  const osmVehicleUrl = `https://www.openstreetmap.org/?mlat=${activeLocation.lat}&mlon=${activeLocation.lng}#map=14/${activeLocation.lat}/${activeLocation.lng}`;
  const osmRouteUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${safePickup.lat}%2C${safePickup.lng}%3B${safeDrop.lat}%2C${safeDrop.lng}`;

  return (
    <div className="relative w-full h-full bg-[#E8EEF4] text-[#171318] overflow-hidden select-none flex flex-col">
      {/* Real Interactive Road Map Canvas (OpenStreetMap + OSRM via Leaflet) */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full z-0"
          style={{ width: '100%', height: '100%', background: '#E8EEF4' }}
        />

        {!tilesLoaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#E8EEF4]/60 z-[5]">
            <div className="px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-sm text-[11px] font-bold text-[#171318]">
              Loading OpenStreetMap road map...
            </div>
          </div>
        )}

        {/* Right Floating Map Controls */}
        <div className={`absolute right-3 ${pickerMode ? 'bottom-4' : 'bottom-4'} z-[400] flex flex-col gap-1.5`}>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {!pickerMode && (
            <>
              <button
                type="button"
                onClick={handleCenterVehicle}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-md cursor-pointer transition ${
                  isFollowing
                    ? 'bg-[#E83E83] hover:bg-[#d62e73] border-pink-400/50 text-white'
                    : 'bg-white/95 hover:bg-white border-gray-300 text-[#E83E83]'
                }`}
                title="Focus & Follow Live Vehicle"
              >
                <Crosshair className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitRoute}
                className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
                title="Fit Entire Highway Route"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}
          {pickerMode && (
            <button
              type="button"
              onClick={handleFitRoute}
              className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
              title="Fit Pickup & Drop Route"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Live Corridor Bar (hidden in compact picker mode) */}
      {!pickerMode && (
        <div className="bg-[#171318]/95 border-t border-gray-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white z-[410]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OpenStreetMap • OSRM Live</span>
            </span>
            <span className="text-gray-300 font-mono truncate hidden sm:inline">
              {activeLocation.lat.toFixed(4)}°N, {activeLocation.lng.toFixed(4)}°E
            </span>
            <div className="hidden md:flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-[#E83E83] rounded-full transition-all duration-500"
                  style={{ width: `${progressMetrics.progressPct}%` }}
                />
              </div>
              <span className="text-gray-300 font-mono font-bold">{progressMetrics.progressPct}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={osmVehicleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold transition"
            >
              <Navigation className="w-3 h-3" />
              <span>Open Map</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={osmRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold transition"
            >
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>OSRM Route</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
