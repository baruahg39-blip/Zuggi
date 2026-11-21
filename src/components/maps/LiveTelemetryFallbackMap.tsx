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
  reason?: 'missing_key' | 'auth_error' | 'quota_exceeded';
  /** Optional interactive location picker mode for FreightLocationPicker */
  pickerMode?: 'pickup' | 'drop' | 'preview';
  onCenterChange?: (lat: number, lng: number) => void;
  flyToTarget?: { lat: number; lng: number; zoom?: number; seq: number } | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makePinIcon(label: string, color: string, subtitle?: string): L.DivIcon {
  const safeLabel = escapeHtml(label);
  const safeSub = subtitle ? escapeHtml(subtitle.slice(0, 18)) : '';
  return L.divIcon({
    className: 'zuggi-osm-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:auto;">
        ${
          safeSub
            ? `<div style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.28);margin-bottom:3px;border:1.5px solid #fff;">${safeSub}</div>`
            : ''
        }
        <div style="width:28px;height:28px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.32);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;">
          ${safeLabel}
        </div>
        <div style="width:8px;height:4px;background:rgba(0,0,0,0.28);border-radius:9999px;margin-top:1px;"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [0, 0]
  });
}

function makeTruckIcon(vehicleNumber: string, speedKmh: number, heading: number): L.DivIcon {
  const safeVeh = escapeHtml(vehicleNumber.slice(0, 15));
  return L.divIcon({
    className: 'zuggi-osm-truck',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);pointer-events:auto;">
        <div style="width:36px;height:36px;border-radius:9999px;background:#E83E83;border:2.5px solid #fff;box-shadow:0 4px 14px rgba(232,62,131,0.5);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(${Math.round(heading)}deg);">
            <polygon points="12,2 20,21 12,17 4,21" />
          </svg>
        </div>
        <div style="margin-top:3px;background:#171318;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:9999px;border:1px solid rgba(232,62,131,0.65);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-family:ui-monospace,monospace;">
          ${safeVeh}${speedKmh > 0 ? ` • ${speedKmh} km/h` : ''}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [0, 0]
  });
}

/**
 * Interactive OpenStreetMap road map fallback powered by Leaflet.
 * Engages ONLY when Google Maps JavaScript API is unavailable (missing key,
 * domain referrer mismatch, or quota exceeded) using raw GPS/trip coordinates
 * so users always see real streets, highways, cities, pins, and geo-fences
 * instead of a blank dark screen.
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
  reason = 'missing_key',
  pickerMode,
  onCenterChange,
  flyToTarget
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const isProgrammaticRef = useRef(false);
  const hasFittedRef = useRef(false);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const pickerModeRef = useRef(pickerMode);
  pickerModeRef.current = pickerMode;

  const [tilesLoaded, setTilesLoaded] = useState(false);

  const safePickup = useMemo(
    () => ({
      lat: Number.isFinite(pickup.lat) ? pickup.lat : 26.1445,
      lng: Number.isFinite(pickup.lng) ? pickup.lng : 91.7362,
      city: pickup.city || 'Pickup',
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

  const progressMetrics = useMemo(() => {
    const totalStraightKm = Math.max(1, haversineKm(safePickup.lat, safePickup.lng, safeDrop.lat, safeDrop.lng) * 1.25);
    const computedRemKm =
      remainingKm !== undefined
        ? remainingKm
        : Math.round(haversineKm(activeLocation.lat, activeLocation.lng, safeDrop.lat, safeDrop.lng) * 1.25 * 10) / 10;
    const progressPct = Math.min(100, Math.max(4, Math.round(((totalStraightKm - computedRemKm) / totalStraightKm) * 100)));
    return { totalStraightKm: Math.round(totalStraightKm), computedRemKm, progressPct };
  }, [safePickup, safeDrop, activeLocation, remainingKm]);

  // 1. Initialize Leaflet map with bright OpenStreetMap street/highway tiles
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialLat = pickerMode === 'drop' ? safeDrop.lat : activeLocation.lat;
    const initialLng = pickerMode === 'drop' ? safeDrop.lng : activeLocation.lng;
    const initialZoom = pickerMode && pickerMode !== 'preview' ? 14 : 9;

    const map = L.map(el, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true
    });

    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    tileLayer.on('load', () => setTilesLoaded(true));
    tileLayer.addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayLayerRef.current = layerGroup;

    // Emit center changes in interactive location picker mode
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

    // Ensure Leaflet recalculates size after modal/tab transitions
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 180);

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

  // 2. Programmatic fly-to when search result or step changes in FreightLocationPicker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToTarget) return;
    isProgrammaticRef.current = true;
    map.setView([flyToTarget.lat, flyToTarget.lng], flyToTarget.zoom ?? 15, { animate: true });
  }, [flyToTarget]);

  // 3. Render markers, route corridor line, GPS breadcrumb trail, and geo-fences
  useEffect(() => {
    const map = mapRef.current;
    const layer = overlayLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const isPickingPin = pickerMode === 'pickup' || pickerMode === 'drop';

    if (isPickingPin) {
      // Show the opposite confirmed pin as a reference while user drags the center pin
      if (pickerMode === 'drop') {
        L.marker([safePickup.lat, safePickup.lng], {
          icon: makePinIcon('A', '#16A34A', `Pickup: ${safePickup.city}`)
        }).addTo(layer);
      } else if (pickerMode === 'pickup' && drop.address) {
        L.marker([safeDrop.lat, safeDrop.lng], {
          icon: makePinIcon('B', '#DC2626', `Drop: ${safeDrop.city}`)
        }).addTo(layer);
      }
      return;
    }

    // Geo-fence circular perimeters (only in tracking mode, not simple route preview)
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

    // Planned corridor path
    const midLat = (safePickup.lat + safeDrop.lat) / 2 + 0.03;
    const midLng = (safePickup.lng + safeDrop.lng) / 2;
    L.polyline(
      [
        [safePickup.lat, safePickup.lng],
        [midLat, midLng],
        [safeDrop.lat, safeDrop.lng]
      ],
      {
        color: '#E83E83',
        weight: 4,
        opacity: 0.8,
        dashArray: '8 6'
      }
    ).addTo(layer);

    // Actual traveled GPS breadcrumb trail
    const trailPts = historyPings
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lat, p.lng] as [number, number]);
    if (!pickerMode && currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lng)) {
      trailPts.push([currentLocation.lat, currentLocation.lng]);
    }
    if (trailPts.length > 1) {
      L.polyline(trailPts, {
        color: '#10B981',
        weight: 4,
        opacity: 0.92
      }).addTo(layer);
    }

    // Pickup marker
    L.marker([safePickup.lat, safePickup.lng], {
      icon: makePinIcon('A', '#16A34A', `Pickup: ${safePickup.city}`)
    })
      .bindPopup(
        `<strong>Pickup: ${escapeHtml(safePickup.city)}</strong><br/>${escapeHtml(safePickup.address || '')}<br/><small>Geo-fence: ${formatMetersOrKm(pickupRadiusMeters)}</small>`
      )
      .addTo(layer);

    // Drop marker
    L.marker([safeDrop.lat, safeDrop.lng], {
      icon: makePinIcon('B', '#DC2626', `Drop: ${safeDrop.city}`)
    })
      .bindPopup(
        `<strong>Drop: ${escapeHtml(safeDrop.city)}</strong><br/>${escapeHtml(safeDrop.address || '')}<br/><small>Geo-fence: ${formatMetersOrKm(deliveryRadiusMeters)}</small>`
      )
      .addTo(layer);

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
    if (!hasFittedRef.current || pickerMode === 'preview') {
      const bounds = L.latLngBounds([
        [safePickup.lat, safePickup.lng],
        [safeDrop.lat, safeDrop.lng]
      ]);
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
    pickerMode
  ]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleCenterVehicle = () => {
    if (!mapRef.current) return;
    isProgrammaticRef.current = true;
    mapRef.current.setView([activeLocation.lat, activeLocation.lng], 13, { animate: true });
  };

  const handleFitRoute = () => {
    if (!mapRef.current) return;
    const bounds = L.latLngBounds([
      [safePickup.lat, safePickup.lng],
      [safeDrop.lat, safeDrop.lng],
      [activeLocation.lat, activeLocation.lng]
    ]);
    isProgrammaticRef.current = true;
    mapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
  };

  const googleMapsVehicleUrl = `https://www.google.com/maps/search/?api=1&query=${activeLocation.lat},${activeLocation.lng}`;
  const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${safePickup.lat},${safePickup.lng}&destination=${safeDrop.lat},${safeDrop.lng}&travelmode=driving`;

  return (
    <div className="relative w-full h-full bg-[#E8EEF4] text-[#171318] overflow-hidden select-none flex flex-col">
      {/* Real Interactive Road Map Canvas (OpenStreetMap via Leaflet) */}
      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full z-0"
          style={{ width: '100%', height: '100%', background: '#E8EEF4' }}
        />

        {!tilesLoaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#E8EEF4]/60 z-[5]">
            <div className="px-3 py-1.5 rounded-full bg-white/95 border border-gray-200 shadow-sm text-[11px] font-bold text-[#171318]">
              Loading live street & highway map...
            </div>
          </div>
        )}

        {/* Right Floating Map Controls */}
        <div className={`absolute right-3 ${pickerMode ? 'bottom-24' : 'bottom-4'} z-[400] flex flex-col gap-1.5`}>
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
                className="w-8 h-8 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] border border-pink-400/50 flex items-center justify-center text-white shadow-md cursor-pointer"
                title="Focus on Live Vehicle"
              >
                <Crosshair className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleFitRoute}
                className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-gray-300 flex items-center justify-center text-[#171318] shadow-md cursor-pointer"
                title="Fit Entire Corridor"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom Live Corridor Bar (hidden in compact picker mode so FreightLocationPicker bar isn't covered) */}
      {!pickerMode && (
        <div className="bg-[#171318]/95 border-t border-gray-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white z-[410]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Live Road Map</span>
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
              href={googleMapsVehicleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E83E83] hover:bg-[#d62e73] text-white font-bold transition"
            >
              <Navigation className="w-3 h-3" />
              <span>Navigate in Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-semibold transition"
            >
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>Route</span>
            </a>
          </div>
        </div>
      )}

      {/* Subtle status cue only when quota reached */}
      {!pickerMode && reason === 'quota_exceeded' && (
        <div className="bg-amber-50 border-t border-amber-200 px-3 py-1 text-[10px] text-amber-900 text-center font-medium">
          OpenStreetMap road view active while Google Maps quota resets.
        </div>
      )}
    </div>
  );
};
