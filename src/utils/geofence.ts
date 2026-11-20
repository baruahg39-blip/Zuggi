import { GeofenceEvent, GeofenceZoneConfig, GeofenceZoneState } from '../types';

export const DEFAULT_GEOFENCE_CONFIG: GeofenceZoneConfig = {
  pickupRadiusMeters: 800,
  deliveryRadiusMeters: 500,
  autoUpdateStatus: true
};

/**
 * Compute great-circle Haversine distance in meters between two WGS84 coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
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

export function formatMetersOrKm(meters?: number): string {
  if (meters === undefined || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Generates a coordinate slightly offset north-east by `distanceMeters` from a center point.
 * Useful for testing geofence entry/exit boundary crossings cleanly.
 */
export function offsetCoordinateByMeters(
  lat: number,
  lng: number,
  northMeters: number,
  eastMeters = 0
): { lat: number; lng: number } {
  const dLat = northMeters / 111320;
  const dLng = eastMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: Number((lat + dLat).toFixed(6)),
    lng: Number((lng + dLng).toFixed(6))
  };
}

export interface GeofenceEvaluationInput {
  bookingId: string;
  tripId?: string;
  loadId?: string;
  vehicleId?: string;
  driverId?: string;
  pickup: { lat: number; lng: number; city: string; address?: string };
  delivery: { lat: number; lng: number; city: string; address?: string };
  config: GeofenceZoneConfig;
  prevState: GeofenceZoneState;
  lat: number;
  lng: number;
  timestamp?: string;
}

export function evaluateGeofenceCrossing(input: GeofenceEvaluationInput): {
  nextState: GeofenceZoneState;
  transitions: Array<{
    zoneType: 'pickup' | 'delivery';
    transition: 'ENTERED' | 'EXITED';
    city: string;
    distanceMeters: number;
    radiusMeters: number;
    zoneLabel: string;
  }>;
} {
  const distToPickup = calculateDistanceMeters(input.lat, input.lng, input.pickup.lat, input.pickup.lng);
  const distToDelivery = calculateDistanceMeters(input.lat, input.lng, input.delivery.lat, input.delivery.lng);

  const nowInsidePickup = distToPickup <= input.config.pickupRadiusMeters;
  const nowInsideDelivery = distToDelivery <= input.config.deliveryRadiusMeters;

  const transitions: Array<{
    zoneType: 'pickup' | 'delivery';
    transition: 'ENTERED' | 'EXITED';
    city: string;
    distanceMeters: number;
    radiusMeters: number;
    zoneLabel: string;
  }> = [];

  if (!input.prevState.insidePickup && nowInsidePickup) {
    transitions.push({
      zoneType: 'pickup',
      transition: 'ENTERED',
      city: input.pickup.city,
      distanceMeters: distToPickup,
      radiusMeters: input.config.pickupRadiusMeters,
      zoneLabel: `${input.pickup.city} Pickup Zone (${formatMetersOrKm(input.config.pickupRadiusMeters)})`
    });
  } else if (input.prevState.insidePickup && !nowInsidePickup) {
    transitions.push({
      zoneType: 'pickup',
      transition: 'EXITED',
      city: input.pickup.city,
      distanceMeters: distToPickup,
      radiusMeters: input.config.pickupRadiusMeters,
      zoneLabel: `${input.pickup.city} Pickup Zone (${formatMetersOrKm(input.config.pickupRadiusMeters)})`
    });
  }

  if (!input.prevState.insideDelivery && nowInsideDelivery) {
    transitions.push({
      zoneType: 'delivery',
      transition: 'ENTERED',
      city: input.delivery.city,
      distanceMeters: distToDelivery,
      radiusMeters: input.config.deliveryRadiusMeters,
      zoneLabel: `${input.delivery.city} Delivery Zone (${formatMetersOrKm(input.config.deliveryRadiusMeters)})`
    });
  } else if (input.prevState.insideDelivery && !nowInsideDelivery) {
    transitions.push({
      zoneType: 'delivery',
      transition: 'EXITED',
      city: input.delivery.city,
      distanceMeters: distToDelivery,
      radiusMeters: input.config.deliveryRadiusMeters,
      zoneLabel: `${input.delivery.city} Delivery Zone (${formatMetersOrKm(input.config.deliveryRadiusMeters)})`
    });
  }

  const nextState: GeofenceZoneState = {
    insidePickup: nowInsidePickup,
    insideDelivery: nowInsideDelivery,
    distanceToPickupMeters: distToPickup,
    distanceToDeliveryMeters: distToDelivery,
    lastCheckedAt: input.timestamp || new Date().toISOString()
  };

  return { nextState, transitions };
}

export function buildGeofenceEventMessage(
  zoneType: 'pickup' | 'delivery',
  transition: 'ENTERED' | 'EXITED',
  city: string,
  distanceMeters: number,
  radiusMeters: number,
  autoUpdatedStatus?: string
): string {
  const verb = transition === 'ENTERED' ? 'entered' : 'exited';
  const zoneTitle = zoneType === 'pickup' ? 'Pickup Geo-Fence' : 'Delivery Geo-Fence';
  const statusSuffix = autoUpdatedStatus
    ? ` Status auto-updated to ${autoUpdatedStatus.replace(/_/g, ' ').toUpperCase()}.`
    : '';
  return `Vehicle ${verb} ${city} ${zoneTitle} (${formatMetersOrKm(distanceMeters)} from center, radius ${formatMetersOrKm(radiusMeters)}).${statusSuffix}`;
}
