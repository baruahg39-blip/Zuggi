import React, { useMemo, useState, useRef } from 'react';
import {
  MapPin,
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

/**
 * Pure React + SVG coordinate-projected live GPS tracking canvas.
 * Zero external non-Google map tiles (strictly compliant with Google Maps Platform ToS).
 * Automatically engages when Google Maps JS API key is not yet configured or fails auth,
 * ensuring shippers can always track their assigned vehicle, route, and geo-fences live.
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
  reason = 'missing_key'
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedPin, setSelectedPin] = useState<'pickup' | 'drop' | 'vehicle' | null>(null);
  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0
  });

  const activeLocation = currentLocation || { lat: pickup.lat, lng: pickup.lng };

  // Compute real geographic bounding box & equirectangular cosine-corrected projection onto 900x520 SVG space
  const projection = useMemo(() => {
    const W = 900;
    const H = 520;
    const padX = 115;
    const padY = 95;

    const allPoints = [
      { lat: pickup.lat, lng: pickup.lng },
      { lat: drop.lat, lng: drop.lng },
      { lat: activeLocation.lat, lng: activeLocation.lng },
      ...historyPings.map((p) => ({ lat: p.lat, lng: p.lng }))
    ].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const minLat = Math.min(...allPoints.map((p) => p.lat));
    const maxLat = Math.max(...allPoints.map((p) => p.lat));
    const minLng = Math.min(...allPoints.map((p) => p.lng));
    const maxLng = Math.max(...allPoints.map((p) => p.lng));

    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));

    const spanLat = Math.max(0.08, maxLat - minLat);
    const spanLngScaled = Math.max(0.08, (maxLng - minLng) * cosLat);

    const usableW = W - padX * 2;
    const usableH = H - padY * 2;
    const scale = Math.min(usableW / spanLngScaled, usableH / spanLat);

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const project = (lat: number, lng: number) => ({
      x: W / 2 + (lng - centerLng) * cosLat * scale,
      y: H / 2 - (lat - centerLat) * scale
    });

    const pickupPt = project(pickup.lat, pickup.lng);
    const dropPt = project(drop.lat, drop.lng);
    const vehiclePt = project(activeLocation.lat, activeLocation.lng);
    const trailPts = historyPings.map((p) => project(p.lat, p.lng));

    // Smooth curved corridor control point
    const midX = (pickupPt.x + dropPt.x) / 2;
    const midY = (pickupPt.y + dropPt.y) / 2;
    const dx = dropPt.x - pickupPt.x;
    const dy = dropPt.y - pickupPt.y;
    const distPx = Math.hypot(dx, dy) || 1;
    const curveOffset = Math.min(48, distPx * 0.12);
    const ctrlX = midX - (dy / distPx) * curveOffset;
    const ctrlY = midY + (dx / distPx) * curveOffset;

    const totalStraightKm = Math.max(1, haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) * 1.25);
    const computedRemKm =
      remainingKm !== undefined
        ? remainingKm
        : Math.round(haversineKm(activeLocation.lat, activeLocation.lng, drop.lat, drop.lng) * 1.25 * 10) / 10;
    const progressPct = Math.min(100, Math.max(4, Math.round(((totalStraightKm - computedRemKm) / totalStraightKm) * 100)));

    // Visual geofence circle radius in SVG px (bounded for clear visibility at highway zoom)
    const kmPerPx = 111 / Math.max(scale, 1);
    const pickupGeoPx = Math.max(16, Math.min(44, (pickupRadiusMeters / 1000) / Math.max(kmPerPx, 0.01)));
    const dropGeoPx = Math.max(16, Math.min(44, (deliveryRadiusMeters / 1000) / Math.max(kmPerPx, 0.01)));

    return {
      W,
      H,
      pickupPt,
      dropPt,
      vehiclePt,
      trailPts,
      ctrlX,
      ctrlY,
      totalStraightKm: Math.round(totalStraightKm),
      computedRemKm,
      progressPct,
      pickupGeoPx,
      dropGeoPx,
      minLat,
      maxLat,
      minLng,
      maxLng
    };
  }, [pickup, drop, activeLocation, historyPings, remainingKm, pickupRadiusMeters, deliveryRadiusMeters]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStateRef.current.active) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    setPan({
      x: Math.max(-320, Math.min(320, dragStateRef.current.origX + dx)),
      y: Math.max(-220, Math.min(220, dragStateRef.current.origY + dy))
    });
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
  };

  const handleCenterVehicle = () => {
    const cx = projection.W / 2 - projection.vehiclePt.x;
    const cy = projection.H / 2 - projection.vehiclePt.y;
    setZoom(1.45);
    setPan({ x: cx * 1.45, y: cy * 1.45 });
  };

  const handleFitRoute = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const trailPathD = useMemo(() => {
    const pts = [...projection.trailPts, projection.vehiclePt];
    if (pts.length < 2) return '';
    return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [projection.trailPts, projection.vehiclePt]);

  const googleMapsVehicleUrl = `https://www.google.com/maps/search/?api=1&query=${activeLocation.lat},${activeLocation.lng}`;
  const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${drop.lat},${drop.lng}&travelmode=driving`;

  return (
    <div className="relative w-full h-full bg-[#120F15] text-white overflow-hidden select-none flex flex-col">
      {/* Interactive SVG Geospatial Telemetry Map */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <svg
          viewBox={`0 0 ${projection.W} ${projection.H}`}
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <pattern id="zuggi-grid-minor" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
            </pattern>
            <pattern id="zuggi-grid-major" width="144" height="144" patternUnits="userSpaceOnUse">
              <rect width="144" height="144" fill="url(#zuggi-grid-minor)" />
              <path d="M 144 0 L 0 0 0 144" fill="none" stroke="rgba(232,62,131,0.12)" strokeWidth="1" />
            </pattern>
            <radialGradient id="zuggi-radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E83E83" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#E83E83" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="zuggi-route-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="55%" stopColor="#E83E83" />
              <stop offset="100%" stopColor="#F43F5E" />
            </linearGradient>
          </defs>

          {/* Tactical coordinate grid */}
          <rect width={projection.W} height={projection.H} fill="#120F15" />
          <rect width={projection.W} height={projection.H} fill="url(#zuggi-grid-major)" />

          {/* Transformed Geospatial Layer */}
          <g
            transform={`translate(${projection.W / 2 + pan.x}, ${projection.H / 2 + pan.y}) scale(${zoom}) translate(${-projection.W / 2}, ${-projection.H / 2})`}
          >
            {/* Subtle radar glow around live truck */}
            <circle
              cx={projection.vehiclePt.x}
              cy={projection.vehiclePt.y}
              r={88}
              fill="url(#zuggi-radar-glow)"
            />

            {/* Pickup Geo-Fence Perimeter */}
            <circle
              cx={projection.pickupPt.x}
              cy={projection.pickupPt.y}
              r={projection.pickupGeoPx}
              fill={insidePickup ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.11)'}
              stroke="#10B981"
              strokeWidth={insidePickup ? 2.5 : 1.5}
              strokeDasharray="4 3"
            />

            {/* Delivery Geo-Fence Perimeter */}
            <circle
              cx={projection.dropPt.x}
              cy={projection.dropPt.y}
              r={projection.dropGeoPx}
              fill={insideDelivery ? 'rgba(232,62,131,0.28)' : 'rgba(232,62,131,0.11)'}
              stroke="#E83E83"
              strokeWidth={insideDelivery ? 2.5 : 1.5}
              strokeDasharray="4 3"
            />

            {/* Planned Highway Corridor Curve */}
            <path
              d={`M ${projection.pickupPt.x} ${projection.pickupPt.y} Q ${projection.ctrlX} ${projection.ctrlY} ${projection.dropPt.x} ${projection.dropPt.y}`}
              fill="none"
              stroke="url(#zuggi-route-grad)"
              strokeOpacity="0.6"
              strokeWidth="4"
              strokeDasharray="9 7"
              strokeLinecap="round"
            />

            {/* Actual Traveled GPS Breadcrumb Trail */}
            {trailPathD && (
              <path
                d={trailPathD}
                fill="none"
                stroke="#10B981"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Breadcrumb Ping Dots */}
            {projection.trailPts.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={3}
                fill="#34D399"
                stroke="#064E3B"
                strokeWidth="1"
              />
            ))}

            {/* Pickup Origin Marker */}
            <g
              transform={`translate(${projection.pickupPt.x}, ${projection.pickupPt.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPin((prev) => (prev === 'pickup' ? null : 'pickup'));
              }}
            >
              <circle r="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle r="4" fill="#FFFFFF" />
              <g transform="translate(0, -24)">
                <rect
                  x="-54"
                  y="-12"
                  width="108"
                  height="20"
                  rx="6"
                  fill="rgba(16,185,129,0.92)"
                />
                <text
                  textAnchor="middle"
                  y="2"
                  fill="#052E16"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="system-ui, sans-serif"
                >
                  PICKUP: {(pickup.city || 'Origin').slice(0, 12)}
                </text>
              </g>
            </g>

            {/* Delivery Destination Marker */}
            <g
              transform={`translate(${projection.dropPt.x}, ${projection.dropPt.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPin((prev) => (prev === 'drop' ? null : 'drop'));
              }}
            >
              <circle r="11" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
              <circle r="4" fill="#FFFFFF" />
              <g transform="translate(0, 26)">
                <rect
                  x="-54"
                  y="-10"
                  width="108"
                  height="20"
                  rx="6"
                  fill="rgba(239,68,68,0.92)"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="system-ui, sans-serif"
                >
                  DROP: {(drop.city || 'Dest').slice(0, 12)}
                </text>
              </g>
            </g>

            {/* Live Moving Vehicle Marker */}
            <g
              transform={`translate(${projection.vehiclePt.x}, ${projection.vehiclePt.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPin((prev) => (prev === 'vehicle' ? null : 'vehicle'));
              }}
            >
              {/* Pulsing Radar Ring */}
              <circle r="22" fill="rgba(232,62,131,0.28)">
                <animate attributeName="r" values="14;32;14" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.65;0.05;0.65" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Rotating Directional Beacon */}
              <circle r="15" fill="#E83E83" stroke="#FFFFFF" strokeWidth="2.5" />
              <g transform={`rotate(${heading})`}>
                <polygon points="0,-8 6,6 0,3 -6,6" fill="#FFFFFF" />
              </g>
              {/* Vehicle Number & Speed Tag */}
              <g transform="translate(0, 28)">
                <rect
                  x="-64"
                  y="-10"
                  width="128"
                  height="20"
                  rx="10"
                  fill="#171318"
                  stroke="#E83E83"
                  strokeWidth="1.2"
                />
                <text
                  textAnchor="middle"
                  y="4"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="ui-monospace, monospace"
                >
                  {vehicleNumber.slice(0, 13)} • {speedKmh} km/h
                </text>
              </g>
            </g>
          </g>
        </svg>

        {/* Right Floating Map Controls */}
        <div className="absolute right-3 bottom-16 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.3).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-[#171318]/90 hover:bg-[#241E26] border border-gray-700 flex items-center justify-center text-white shadow-md cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.3).toFixed(2)))}
            className="w-8 h-8 rounded-lg bg-[#171318]/90 hover:bg-[#241E26] border border-gray-700 flex items-center justify-center text-white shadow-md cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
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
            className="w-8 h-8 rounded-lg bg-[#171318]/90 hover:bg-[#241E26] border border-gray-700 flex items-center justify-center text-white shadow-md cursor-pointer"
            title="Fit Entire Corridor"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Left Floating Pin Details Popover */}
        {selectedPin && (
          <div className="absolute left-3 bottom-16 z-20 max-w-xs bg-[#171318]/95 backdrop-blur-md border border-gray-700 rounded-xl p-3 text-xs shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-black uppercase text-[10px] tracking-wider text-[#E83E83] flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {selectedPin === 'pickup'
                  ? `Pickup Zone (${formatMetersOrKm(pickupRadiusMeters)})`
                  : selectedPin === 'drop'
                  ? `Delivery Zone (${formatMetersOrKm(deliveryRadiusMeters)})`
                  : `Live Vehicle: ${vehicleNumber}`}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPin(null)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            {selectedPin === 'pickup' && (
              <div className="text-gray-200 space-y-0.5">
                <div className="font-bold">{pickup.city || 'Pickup Origin'}</div>
                {pickup.address && <div className="text-[11px] text-gray-400">{pickup.address}</div>}
                <div className="text-[10px] font-mono text-emerald-400">
                  {pickup.lat.toFixed(4)}° N, {pickup.lng.toFixed(4)}° E
                </div>
              </div>
            )}
            {selectedPin === 'drop' && (
              <div className="text-gray-200 space-y-0.5">
                <div className="font-bold">{drop.city || 'Delivery Destination'}</div>
                {drop.address && <div className="text-[11px] text-gray-400">{drop.address}</div>}
                <div className="text-[10px] font-mono text-rose-400">
                  {drop.lat.toFixed(4)}° N, {drop.lng.toFixed(4)}° E
                </div>
              </div>
            )}
            {selectedPin === 'vehicle' && (
              <div className="text-gray-200 space-y-1">
                <div className="font-mono text-emerald-400 font-bold">
                  {activeLocation.lat.toFixed(5)}° N, {activeLocation.lng.toFixed(5)}° E
                </div>
                <div className="text-[11px] text-gray-300">
                  Speed: <strong>{speedKmh} km/h</strong> • Heading: <strong>{heading}°</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Live Corridor Bar + Direct Google Maps External Navigation */}
      <div className="bg-[#171318]/95 border-t border-gray-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Live GPS Radar</span>
          </span>
          <span className="text-gray-400 font-mono truncate hidden sm:inline">
            {activeLocation.lat.toFixed(4)}°N, {activeLocation.lng.toFixed(4)}°E
          </span>
          <div className="hidden md:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-[#E83E83] rounded-full transition-all duration-500"
                style={{ width: `${projection.progressPct}%` }}
              />
            </div>
            <span className="text-gray-300 font-mono font-bold">{projection.progressPct}%</span>
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
            <span>Open Vehicle in Google Maps</span>
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

      {/* Subtle status cue only when auth or quota failed */}
      {(reason === 'auth_error' || reason === 'quota_exceeded') && (
        <div className="bg-amber-950/90 border-t border-amber-800/70 px-3 py-1 text-[10px] text-amber-200 text-center">
          {reason === 'quota_exceeded'
            ? 'Google Maps tile quota temporarily reached — Live GPS Telemetry Radar active.'
            : 'Google Maps road tiles could not authenticate for this domain — Live GPS Telemetry Radar active.'}
        </div>
      )}
    </div>
  );
};
