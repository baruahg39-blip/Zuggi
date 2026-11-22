import { TripLiveTrackingResponse, TripLocationPing, TripStatus } from '../types';
import { logisticsStore } from '../services/store';
import { DEFAULT_GEOFENCE_CONFIG, calculateDistanceMeters } from './geofence';

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
  return Math.round(R * c * 10) / 10;
}

function mapLoadStatusToTripStatus(status?: string): TripStatus {
  switch (status) {
    case 'at_pickup':
    case 'loading':
      return 'AT_PICKUP';
    case 'in_transit':
    case 'at_destination':
      return 'IN_TRANSIT';
    case 'delivered':
    case 'completed':
      return 'DELIVERED';
    default:
      return 'ASSIGNED';
  }
}

function resolveBookingAndLoad(tripId: string, loadId?: string) {
  const cleanLoadId = loadId || (tripId.startsWith('trip_') ? tripId.slice(5) : undefined);

  const directBooking = logisticsStore.getBookingById(tripId);
  const allBookings = logisticsStore.getBookings();
  const booking =
    directBooking ||
    allBookings.find(
      (b) =>
        b.id === tripId ||
        b.loadId === tripId ||
        (cleanLoadId ? b.loadId === cleanLoadId : false)
    );

  const load =
    (booking ? logisticsStore.getLoadById(booking.loadId) : undefined) ||
    (cleanLoadId ? logisticsStore.getLoadById(cleanLoadId) : undefined) ||
    logisticsStore.getLoadById(tripId);

  return { booking, load };
}

/**
 * Builds a complete TripLiveTrackingResponse from local logisticsStore state
 * whenever the backend does not have the trip in memory (e.g. newly booked load
 * or Render cold-start restart).
 */
export function buildLocalTrackingFallback(
  tripId: string,
  loadId?: string
): TripLiveTrackingResponse | null {
  const { booking, load } = resolveBookingAndLoad(tripId, loadId);
  if (!booking && !load) return null;

  const pickupPoint = booking?.pickup || load?.pickup;
  const deliveryPoint = booking?.delivery || load?.delivery;
  if (!pickupPoint || !deliveryPoint) return null;

  const vehicle = booking?.vehicleId ? logisticsStore.getVehicleById(booking.vehicleId) : undefined;
  const driverUser = booking?.driverId ? logisticsStore.getUserById(booking.driverId) : undefined;
  const quotes = load ? logisticsStore.getQuotations(load.id) : [];
  const acceptedQuote = booking
    ? quotes.find((q) => q.id === booking.quotationId)
    : quotes.find((q) => q.status === 'accepted');

  const resolvedTripId = booking?.id || tripId;
  const storeLatest = booking ? logisticsStore.getLatestPing(booking.id) : undefined;
  const storeHistory = booking ? logisticsStore.getLocationPings(booking.id) : [];

  const tripStatus = mapLoadStatusToTripStatus(booking?.status || load?.status);
  const nowIso = new Date().toISOString();

  // Compute realistic initial vehicle coordinate based on milestone if no GPS ping recorded yet
  let fallbackLat = pickupPoint.lat;
  let fallbackLng = pickupPoint.lng;
  let fallbackSpeed = 0;

  if (storeLatest) {
    fallbackLat = storeLatest.lat;
    fallbackLng = storeLatest.lng;
    fallbackSpeed = storeLatest.speedKmh || 0;
  } else if (tripStatus === 'IN_TRANSIT') {
    fallbackLat = pickupPoint.lat + (deliveryPoint.lat - pickupPoint.lat) * 0.42;
    fallbackLng = pickupPoint.lng + (deliveryPoint.lng - pickupPoint.lng) * 0.42;
    fallbackSpeed = 48;
  } else if (tripStatus === 'DELIVERED') {
    fallbackLat = deliveryPoint.lat;
    fallbackLng = deliveryPoint.lng;
    fallbackSpeed = 0;
  } else if (vehicle?.currentLocation) {
    fallbackLat = vehicle.currentLocation.lat;
    fallbackLng = vehicle.currentLocation.lng;
    fallbackSpeed = 28;
  }

  // Compute compass heading from pickup toward drop
  const dLon = ((deliveryPoint.lng - pickupPoint.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((deliveryPoint.lat * Math.PI) / 180);
  const x =
    Math.cos((pickupPoint.lat * Math.PI) / 180) * Math.sin((deliveryPoint.lat * Math.PI) / 180) -
    Math.sin((pickupPoint.lat * Math.PI) / 180) *
      Math.cos((deliveryPoint.lat * Math.PI) / 180) *
      Math.cos(dLon);
  const computedHeading = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);

  const latestPing: TripLocationPing = {
    trip_id: resolvedTripId,
    lat: fallbackLat,
    lng: fallbackLng,
    speed: fallbackSpeed,
    heading: storeLatest?.heading ?? computedHeading,
    battery_level: storeLatest?.batteryLevel ?? 89,
    recorded_at: storeLatest?.timestamp || nowIso,
    is_buffered: false
  };

  const mappedHistory: TripLocationPing[] =
    storeHistory.length > 0
      ? storeHistory.map((p) => ({
          trip_id: resolvedTripId,
          lat: p.lat,
          lng: p.lng,
          speed: p.speedKmh,
          heading: p.heading,
          battery_level: p.batteryLevel ?? 88,
          recorded_at: p.timestamp,
          is_buffered: false
        }))
      : [
          {
            trip_id: resolvedTripId,
            lat: pickupPoint.lat,
            lng: pickupPoint.lng,
            speed: 0,
            heading: computedHeading,
            battery_level: 95,
            recorded_at: booking?.createdAt || nowIso,
            is_buffered: false
          },
          ...(fallbackLat !== pickupPoint.lat || fallbackLng !== pickupPoint.lng ? [latestPing] : [])
        ];

  const remainingKm = Math.max(
    0,
    Math.round(haversineKm(latestPing.lat, latestPing.lng, deliveryPoint.lat, deliveryPoint.lng) * 1.25 * 10) / 10
  );
  const avgSpeed = latestPing.speed > 10 ? latestPing.speed : 42;
  const remainingMinutes = remainingKm <= 0.5 ? 0 : Math.max(5, Math.round((remainingKm / avgSpeed) * 60));
  const hrs = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;
  const formattedEta =
    remainingMinutes === 0 ? 'Arrived' : hrs > 0 ? `${hrs} hr ${mins} mins` : `${mins} mins`;

  const geofenceConfig = booking
    ? logisticsStore.getGeofenceConfig(booking.id)
    : { ...DEFAULT_GEOFENCE_CONFIG };
  const distanceToPickupMeters = calculateDistanceMeters(
    latestPing.lat,
    latestPing.lng,
    pickupPoint.lat,
    pickupPoint.lng
  );
  const distanceToDeliveryMeters = calculateDistanceMeters(
    latestPing.lat,
    latestPing.lng,
    deliveryPoint.lat,
    deliveryPoint.lng
  );
  const proximity = {
    insidePickup: distanceToPickupMeters <= geofenceConfig.pickupRadiusMeters,
    insideDelivery: distanceToDeliveryMeters <= geofenceConfig.deliveryRadiusMeters,
    distanceToPickupMeters,
    distanceToDeliveryMeters
  };

  const lastEpoch = new Date(latestPing.recorded_at).getTime();
  const ageSeconds = Math.max(0, Math.min(3600, Math.round((Date.now() - lastEpoch) / 1000)));

  return {
    trip_id: resolvedTripId,
    load_id: load?.id || booking?.loadId || resolvedTripId,
    status: tripStatus,
    tracking_token: booking?.trackingToken || `trk_local_${resolvedTripId.replace(/[^a-zA-Z0-9]/g, '').slice(-16)}`,
    pickup: {
      lat: pickupPoint.lat,
      lng: pickupPoint.lng,
      address: pickupPoint.address,
      city: pickupPoint.city,
      contact_name: pickupPoint.contactName,
      contact_phone: pickupPoint.contactPhone
    },
    drop: {
      lat: deliveryPoint.lat,
      lng: deliveryPoint.lng,
      address: deliveryPoint.address,
      city: deliveryPoint.city,
      contact_name: deliveryPoint.contactName,
      contact_phone: deliveryPoint.contactPhone
    },
    route_polyline: '',
    latest_location: latestPing,
    location_history: mappedHistory,
    driver: {
      id: driverUser?.id || booking?.driverId || 'drv_assigned',
      name: driverUser?.name || vehicle?.driverName || acceptedQuote?.driverName || 'Assigned Partner Driver',
      phone_number:
        driverUser?.phone || vehicle?.driverPhone || acceptedQuote?.transporterPhone || '+919678944132',
      is_active: true
    },
    vehicle: {
      id: vehicle?.id || booking?.vehicleId || 'veh_assigned',
      vehicle_number: vehicle?.registrationNumber || acceptedQuote?.vehicleRegNumber || 'AS-01-ZG-2026',
      vehicle_type: vehicle?.category || load?.requiredVehicleCategory || 'commercial_truck',
      gps_type: 'MOBILE_APP'
    },
    eta: (() => {
      if (booking?.liveEta && tripStatus !== 'DELIVERED') {
        return {
          minutes: Math.max(0, Math.round(booking.liveEta.durationSeconds / 60)),
          formatted: booking.liveEta.formattedDuration,
          distance_remaining_km: booking.liveEta.distanceKm,
          eta_iso: booking.liveEta.etaIso,
          formatted_arrival_time: booking.liveEta.formattedArrivalTime,
          traffic_condition: booking.liveEta.trafficCondition,
          traffic_delay_minutes: booking.liveEta.trafficDelayMinutes,
          source: booking.liveEta.source,
          calculated_at: booking.liveEta.calculatedAt
        };
      }
      return {
        minutes: remainingMinutes,
        formatted: formattedEta,
        distance_remaining_km: remainingKm,
        eta_iso: new Date(Date.now() + remainingMinutes * 60 * 1000).toISOString(),
        source: 'gps_estimate' as const,
        calculated_at: latestPing.recorded_at
      };
    })(),
    tracking_source: 'MOBILE_APP',
    offline_buffer_status: {
      is_live: ageSeconds <= 180,
      last_ping_age_seconds: ageSeconds,
      buffered_pings_count: 0
    },
    geofence_config: geofenceConfig,
    geofence_state: {
      insidePickup: proximity.insidePickup,
      insideDelivery: proximity.insideDelivery,
      distanceToPickupMeters: proximity.distanceToPickupMeters,
      distanceToDeliveryMeters: proximity.distanceToDeliveryMeters,
      lastCheckedAt: latestPing.recorded_at
    },
    geofence_events: booking ? logisticsStore.getGeofenceEvents(booking.id) : []
  };
}

/**
 * Silently registers a local booking/load trip on the Express server
 * (without dispatching duplicate SMS) so subsequent GPS pings, geofence rules,
 * and live tracking polling succeed even after a server restart.
 */
export async function syncLocalTripToServer(
  fallback: TripLiveTrackingResponse
): Promise<TripLiveTrackingResponse | null> {
  try {
    const res = await fetch(`/trips/${encodeURIComponent(fallback.trip_id)}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        load_id: fallback.load_id,
        vehicle_id: fallback.vehicle.id,
        vehicle_number: fallback.vehicle.vehicle_number,
        vehicle_type: fallback.vehicle.vehicle_type,
        driver_id: fallback.driver.id,
        driver_name: fallback.driver.name,
        driver_phone: fallback.driver.phone_number,
        tracking_token: fallback.tracking_token,
        tracking_source: fallback.tracking_source,
        status: fallback.status,
        pickup: fallback.pickup,
        drop: fallback.drop,
        latest_location: fallback.latest_location,
        location_history: fallback.location_history,
        geofence_config: fallback.geofence_config
      })
    });
    if (!res.ok) return null;
    const synced = await res.json();
    if (synced?.success && synced?.pickup && synced?.drop) {
      return synced as TripLiveTrackingResponse;
    }
    return null;
  } catch {
    return null;
  }
}
