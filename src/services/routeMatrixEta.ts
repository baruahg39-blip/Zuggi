import { BookingLiveEta } from '../types';

export interface RouteMatrixEtaRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  destinationCity: string;
}

export function formatDurationCompact(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 30) {
    return 'Arriving now';
  }
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins} mins`;
}

export function formatArrivalClock(etaIso: string): string {
  const etaDate = new Date(etaIso);
  if (Number.isNaN(etaDate.getTime())) return 'Updating...';

  const now = new Date();
  const isSameDay =
    etaDate.getFullYear() === now.getFullYear() &&
    etaDate.getMonth() === now.getMonth() &&
    etaDate.getDate() === now.getDate();

  const timeStr = etaDate.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (isSameDay) {
    return timeStr;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    etaDate.getFullYear() === tomorrow.getFullYear() &&
    etaDate.getMonth() === tomorrow.getMonth() &&
    etaDate.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return `Tomorrow, ${timeStr}`;
  }

  const dateStr = etaDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
  return `${dateStr}, ${timeStr}`;
}

export function computeHaversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function buildLocalFallbackEta(req: RouteMatrixEtaRequest): BookingLiveEta {
  const straightMeters = computeHaversineMeters(
    req.origin.lat,
    req.origin.lng,
    req.destination.lat,
    req.destination.lng
  );
  // Graceful 1.3x Haversine road multiplier when OSRM is temporarily unreachable
  const distanceMeters = Math.max(0, Math.round(straightMeters * 1.3));
  const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
  const durationSeconds = distanceMeters <= 250 ? 0 : Math.max(60, Math.round((distanceKm / 44) * 3600));
  const calculatedAt = new Date().toISOString();
  const etaIso = new Date(Date.now() + durationSeconds * 1000).toISOString();

  return {
    distanceMeters,
    distanceKm,
    durationSeconds,
    staticDurationSeconds: durationSeconds,
    trafficDelayMinutes: 0,
    trafficCondition: 'clear',
    etaIso,
    formattedDuration: formatDurationCompact(durationSeconds),
    formattedArrivalTime: formatArrivalClock(etaIso),
    originLat: req.origin.lat,
    originLng: req.origin.lng,
    destinationCity: req.destinationCity,
    calculatedAt,
    source: 'gps_estimate'
  };
}

/**
 * Computes live road distance & ETA to the destination via public OSRM routing
 * (via our /api/maps/route-matrix proxy, with 1.3x Haversine fallback if unreachable).
 */
export async function calculateLiveDestinationEta(
  req: RouteMatrixEtaRequest
): Promise<BookingLiveEta> {
  if (
    !Number.isFinite(req.origin.lat) ||
    !Number.isFinite(req.origin.lng) ||
    !Number.isFinite(req.destination.lat) ||
    !Number.isFinite(req.destination.lng)
  ) {
    return buildLocalFallbackEta(req);
  }

  try {
    const res = await fetch('/api/maps/route-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: req.origin.lat, lng: req.origin.lng },
        destination: { lat: req.destination.lat, lng: req.destination.lng }
      })
    });

    if (!res.ok) {
      return buildLocalFallbackEta(req);
    }

    const data = await res.json();
    if (!data?.success) {
      return buildLocalFallbackEta(req);
    }

    const durationSeconds = Math.max(0, Number(data.durationSeconds) || 0);
    const staticDurationSeconds = Math.max(0, Number(data.staticDurationSeconds) || durationSeconds);
    const distanceMeters = Math.max(0, Number(data.distanceMeters) || 0);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const etaIso =
      typeof data.etaIso === 'string'
        ? data.etaIso
        : new Date(Date.now() + durationSeconds * 1000).toISOString();
    const calculatedAt =
      typeof data.calculatedAt === 'string' ? data.calculatedAt : new Date().toISOString();
    const trafficCondition: 'clear' | 'moderate' | 'heavy' =
      data.trafficCondition === 'heavy' || data.trafficCondition === 'moderate'
        ? data.trafficCondition
        : 'clear';
    const source: 'osrm_route' | 'gps_estimate' =
      data.source === 'osrm_route' ? 'osrm_route' : 'gps_estimate';

    return {
      distanceMeters,
      distanceKm,
      durationSeconds,
      staticDurationSeconds,
      trafficDelayMinutes: Math.max(0, Math.round(Number(data.trafficDelayMinutes) || 0)),
      trafficCondition,
      etaIso,
      formattedDuration: formatDurationCompact(durationSeconds),
      formattedArrivalTime: formatArrivalClock(etaIso),
      originLat: req.origin.lat,
      originLng: req.origin.lng,
      destinationCity: req.destinationCity,
      calculatedAt,
      source
    };
  } catch {
    return buildLocalFallbackEta(req);
  }
}
