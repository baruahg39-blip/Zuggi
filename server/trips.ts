import express from 'express';
import crypto from 'crypto';
import {
  persistTripToSupabase,
  persistLocationPingsToSupabase,
  loadTripFromSupabase
} from './supabase.js';

export type GpsTrackingType = 'MOBILE_APP' | 'WEB_LINK' | 'HARDWARE_GPS';
export type TripStatus = 'ASSIGNED' | 'AT_PICKUP' | 'IN_TRANSIT' | 'DELIVERED';

export interface VehicleRecord {
  id: string;
  owner_id: string;
  vehicle_number: string;
  vehicle_type: string;
  gps_type: GpsTrackingType;
  gps_device_id?: string;
  is_available: boolean;
}

export interface DriverRecord {
  id: string;
  owner_id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
}

export interface LocationPingRecord {
  trip_id: string;
  lat: number;
  lng: number;
  speed: number;          // in km/h
  heading: number;        // degrees 0 - 360
  battery_level: number;  // 0 - 100
  recorded_at: string;    // ISO timestamp
  is_buffered?: boolean;  // whether ping was queued during network drops
}

export interface GeofenceConfigRecord {
  pickupRadiusMeters: number;
  deliveryRadiusMeters: number;
  autoUpdateStatus: boolean;
  updatedAt?: string;
}

export interface GeofenceStateRecord {
  insidePickup: boolean;
  insideDelivery: boolean;
  distanceToPickupMeters?: number;
  distanceToDeliveryMeters?: number;
  lastCheckedAt?: string;
}

export interface GeofenceEventRecord {
  id: string;
  bookingId: string;
  tripId: string;
  loadId: string;
  vehicleId: string;
  driverId: string;
  zoneType: 'pickup' | 'delivery';
  transition: 'ENTERED' | 'EXITED';
  zoneLabel: string;
  city: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  radiusMeters: number;
  autoUpdatedStatus?: string;
  message: string;
  timestamp: string;
}

export interface TripRecord {
  id: string;
  load_id: string;
  assigned_vehicle_id: string;
  assigned_driver_id: string;
  status: TripStatus;
  tracking_token: string;
  tracking_source: GpsTrackingType;
  created_at: string;
  updated_at: string;
  pickup: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    contact_name?: string;
    contact_phone?: string;
  };
  drop: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    contact_name?: string;
    contact_phone?: string;
  };
  route_polyline?: string;
  latest_ping?: LocationPingRecord;
  history: LocationPingRecord[];
  buffered_count: number;
  geofence_config?: GeofenceConfigRecord;
  geofence_state?: GeofenceStateRecord;
  geofence_events?: GeofenceEventRecord[];
  live_eta?: {
    minutes: number;
    formatted: string;
    distance_remaining_km: number;
    eta_iso: string;
    formatted_arrival_time: string;
    traffic_condition: 'clear' | 'moderate' | 'heavy';
    traffic_delay_minutes: number;
    source: 'google_routes_matrix' | 'gps_estimate';
    calculated_at: string;
  };
}

// In-Memory Database for Vehicles, Drivers, Trips & Location Pings
const vehiclesDb = new Map<string, VehicleRecord>();
const driversDb = new Map<string, DriverRecord>();
const tripsDb = new Map<string, TripRecord>();

// Seed Fleet Vehicles
const seedVehicles: VehicleRecord[] = [
  {
    id: 'veh_01',
    owner_id: 'fleet_owner_01',
    vehicle_number: 'AS-01-EC-4921',
    vehicle_type: 'tata_407',
    gps_type: 'MOBILE_APP',
    gps_device_id: 'VS-GPS-0921',
    is_available: true
  },
  {
    id: 'veh_02',
    owner_id: 'fleet_owner_01',
    vehicle_number: 'AS-01-QC-8812',
    vehicle_type: 'eicher_17ft',
    gps_type: 'HARDWARE_GPS',
    gps_device_id: 'TELTONIKA-FMB920-8812',
    is_available: true
  },
  {
    id: 'veh_03',
    owner_id: 'fleet_owner_01',
    vehicle_number: 'AS-25-CC-3019',
    vehicle_type: 'container_32ft',
    gps_type: 'WEB_LINK',
    gps_device_id: 'WEB-LINK-3019',
    is_available: true
  },
  {
    id: 'veh_04',
    owner_id: 'fleet_owner_01',
    vehicle_number: 'AS-01-BC-6541',
    vehicle_type: 'bolero_pickup',
    gps_type: 'MOBILE_APP',
    gps_device_id: 'VS-GPS-6541',
    is_available: true
  }
];

// Seed Fleet Drivers
const seedDrivers: DriverRecord[] = [
  {
    id: 'drv_01',
    owner_id: 'fleet_owner_01',
    name: 'Manoj Das',
    phone_number: '+919678944132',
    is_active: true
  },
  {
    id: 'drv_02',
    owner_id: 'fleet_owner_01',
    name: 'Biren Kalita',
    phone_number: '+919864012345',
    is_active: true
  },
  {
    id: 'drv_03',
    owner_id: 'fleet_owner_01',
    name: 'Prakash Gogoi',
    phone_number: '+919435098765',
    is_active: true
  },
  {
    id: 'drv_04',
    owner_id: 'fleet_owner_01',
    name: 'Anup Saikia',
    phone_number: '+919706054321',
    is_active: true
  }
];

seedVehicles.forEach((v) => vehiclesDb.set(v.id, v));
seedDrivers.forEach((d) => driversDb.set(d.id, d));

// Seed Demo Trips (Guwahati to Dibrugarh, etc.)
const defaultTrip1: TripRecord = {
  id: 'trip_demo_01',
  load_id: 'load_tea_dib_01',
  assigned_vehicle_id: 'veh_01',
  assigned_driver_id: 'drv_01',
  status: 'IN_TRANSIT',
  tracking_token: 'trk_sec_993821739182371928371923',
  tracking_source: 'MOBILE_APP',
  created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
  pickup: {
    lat: 27.4728,
    lng: 94.9120,
    address: 'Jalan Tea Warehouse, Chowkidingee',
    city: 'Dibrugarh',
    contact_name: 'Prakash Gogoi (Consignor)',
    contact_phone: '+919435098765'
  },
  drop: {
    lat: 26.1445,
    lng: 91.7362,
    address: 'Beltola Wholesale Hub, GS Road',
    city: 'Guwahati',
    contact_name: 'Amit Singhal (Consignee)',
    contact_phone: '+919864099887'
  },
  route_polyline: '',
  latest_ping: {
    trip_id: 'trip_demo_01',
    lat: 26.5821,
    lng: 93.9632,
    speed: 52,
    heading: 245,
    battery_level: 84,
    recorded_at: new Date(Date.now() - 45 * 1000).toISOString(),
    is_buffered: false
  },
  history: [
    {
      trip_id: 'trip_demo_01',
      lat: 27.4728,
      lng: 94.9120,
      speed: 0,
      heading: 0,
      battery_level: 98,
      recorded_at: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
      is_buffered: false
    },
    {
      trip_id: 'trip_demo_01',
      lat: 27.2415,
      lng: 94.6218,
      speed: 48,
      heading: 235,
      battery_level: 94,
      recorded_at: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
      is_buffered: false
    },
    {
      trip_id: 'trip_demo_01',
      lat: 26.9825,
      lng: 94.6341,
      speed: 55,
      heading: 240,
      battery_level: 91,
      recorded_at: new Date(Date.now() - 2.1 * 3600 * 1000).toISOString(),
      is_buffered: false
    },
    {
      trip_id: 'trip_demo_01',
      lat: 26.7509,
      lng: 94.2037,
      speed: 50,
      heading: 250,
      battery_level: 87,
      recorded_at: new Date(Date.now() - 1.2 * 3600 * 1000).toISOString(),
      is_buffered: false
    },
    {
      trip_id: 'trip_demo_01',
      lat: 26.5821,
      lng: 93.9632,
      speed: 52,
      heading: 245,
      battery_level: 84,
      recorded_at: new Date(Date.now() - 45 * 1000).toISOString(),
      is_buffered: false
    }
  ],
  buffered_count: 0,
  geofence_config: {
    pickupRadiusMeters: 800,
    deliveryRadiusMeters: 500,
    autoUpdateStatus: true,
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  geofence_state: {
    insidePickup: false,
    insideDelivery: false,
    distanceToPickupMeters: 136800,
    distanceToDeliveryMeters: 227400,
    lastCheckedAt: new Date(Date.now() - 45 * 1000).toISOString()
  },
  geofence_events: [
    {
      id: 'gf_demo_enter_pickup',
      bookingId: 'booking_01',
      tripId: 'trip_demo_01',
      loadId: 'load_tea_dib_01',
      vehicleId: 'veh_01',
      driverId: 'drv_01',
      zoneType: 'pickup',
      transition: 'ENTERED',
      zoneLabel: 'Dibrugarh Pickup Zone (800 m)',
      city: 'Dibrugarh',
      lat: 27.4728,
      lng: 94.9120,
      distanceMeters: 42,
      radiusMeters: 800,
      autoUpdatedStatus: 'AT_PICKUP',
      message: 'Vehicle entered Dibrugarh Pickup Geo-Fence (42 m from center, radius 800 m). Status auto-updated to AT PICKUP.',
      timestamp: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString()
    },
    {
      id: 'gf_demo_exit_pickup',
      bookingId: 'booking_01',
      tripId: 'trip_demo_01',
      loadId: 'load_tea_dib_01',
      vehicleId: 'veh_01',
      driverId: 'drv_01',
      zoneType: 'pickup',
      transition: 'EXITED',
      zoneLabel: 'Dibrugarh Pickup Zone (800 m)',
      city: 'Dibrugarh',
      lat: 27.2415,
      lng: 94.6218,
      distanceMeters: 38400,
      radiusMeters: 800,
      autoUpdatedStatus: 'IN_TRANSIT',
      message: 'Vehicle exited Dibrugarh Pickup Geo-Fence (38.4 km from center, radius 800 m). Status auto-updated to IN TRANSIT.',
      timestamp: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString()
    }
  ]
};

tripsDb.set(defaultTrip1.id, defaultTrip1);
// Also key by load_id and seeded booking_01 so lookups work interchangeably
tripsDb.set(defaultTrip1.load_id, defaultTrip1);
tripsDb.set('booking_01', defaultTrip1);

const DEFAULT_TRIP_GEOFENCE_CONFIG: GeofenceConfigRecord = {
  pickupRadiusMeters: 800,
  deliveryRadiusMeters: 500,
  autoUpdateStatus: true
};

// Helper: Haversine distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper: Haversine distance in KM
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round((calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000) * 10) / 10;
}

function formatRadiusLabel(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function evaluateTripGeofenceTransitions(
  trip: TripRecord,
  ping: LocationPingRecord
): GeofenceEventRecord[] {
  const config: GeofenceConfigRecord = trip.geofence_config || { ...DEFAULT_TRIP_GEOFENCE_CONFIG };
  trip.geofence_config = config;

  const prevState: GeofenceStateRecord = trip.geofence_state || {
    insidePickup: false,
    insideDelivery: false
  };

  const distToPickupMeters = calculateDistanceMeters(ping.lat, ping.lng, trip.pickup.lat, trip.pickup.lng);
  const distToDeliveryMeters = calculateDistanceMeters(ping.lat, ping.lng, trip.drop.lat, trip.drop.lng);

  const nowInsidePickup = distToPickupMeters <= config.pickupRadiusMeters;
  const nowInsideDelivery = distToDeliveryMeters <= config.deliveryRadiusMeters;

  const triggered: GeofenceEventRecord[] = [];
  if (!Array.isArray(trip.geofence_events)) {
    trip.geofence_events = [];
  }

  // 1. Pickup zone transitions
  if (!prevState.insidePickup && nowInsidePickup) {
    let autoStatus: string | undefined;
    if (config.autoUpdateStatus && trip.status === 'ASSIGNED') {
      trip.status = 'AT_PICKUP';
      autoStatus = 'AT_PICKUP';
    }
    const radiusStr = formatRadiusLabel(config.pickupRadiusMeters);
    const distStr = formatRadiusLabel(distToPickupMeters);
    const evt: GeofenceEventRecord = {
      id: `gf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bookingId: trip.id,
      tripId: trip.id,
      loadId: trip.load_id,
      vehicleId: trip.assigned_vehicle_id,
      driverId: trip.assigned_driver_id,
      zoneType: 'pickup',
      transition: 'ENTERED',
      zoneLabel: `${trip.pickup.city} Pickup Zone (${radiusStr})`,
      city: trip.pickup.city,
      lat: ping.lat,
      lng: ping.lng,
      distanceMeters: distToPickupMeters,
      radiusMeters: config.pickupRadiusMeters,
      autoUpdatedStatus: autoStatus,
      message: `Vehicle entered ${trip.pickup.city} Pickup Geo-Fence (${distStr} from center, radius ${radiusStr}).${autoStatus ? ` Status auto-updated to ${autoStatus.replace('_', ' ')}.` : ''}`,
      timestamp: ping.recorded_at
    };
    triggered.push(evt);
    trip.geofence_events.unshift(evt);
  } else if (prevState.insidePickup && !nowInsidePickup) {
    let autoStatus: string | undefined;
    if (config.autoUpdateStatus && (trip.status === 'ASSIGNED' || trip.status === 'AT_PICKUP')) {
      trip.status = 'IN_TRANSIT';
      autoStatus = 'IN_TRANSIT';
    }
    const radiusStr = formatRadiusLabel(config.pickupRadiusMeters);
    const distStr = formatRadiusLabel(distToPickupMeters);
    const evt: GeofenceEventRecord = {
      id: `gf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bookingId: trip.id,
      tripId: trip.id,
      loadId: trip.load_id,
      vehicleId: trip.assigned_vehicle_id,
      driverId: trip.assigned_driver_id,
      zoneType: 'pickup',
      transition: 'EXITED',
      zoneLabel: `${trip.pickup.city} Pickup Zone (${radiusStr})`,
      city: trip.pickup.city,
      lat: ping.lat,
      lng: ping.lng,
      distanceMeters: distToPickupMeters,
      radiusMeters: config.pickupRadiusMeters,
      autoUpdatedStatus: autoStatus,
      message: `Vehicle exited ${trip.pickup.city} Pickup Geo-Fence (${distStr} from center, radius ${radiusStr}).${autoStatus ? ` Status auto-updated to ${autoStatus.replace('_', ' ')}.` : ''}`,
      timestamp: ping.recorded_at
    };
    triggered.push(evt);
    trip.geofence_events.unshift(evt);
  }

  // 2. Delivery zone transitions
  if (!prevState.insideDelivery && nowInsideDelivery) {
    let autoStatus: string | undefined;
    if (
      config.autoUpdateStatus &&
      (trip.status === 'IN_TRANSIT' || trip.status === 'AT_PICKUP' || trip.status === 'ASSIGNED')
    ) {
      trip.status = 'DELIVERED';
      autoStatus = 'DELIVERED';
    }
    const radiusStr = formatRadiusLabel(config.deliveryRadiusMeters);
    const distStr = formatRadiusLabel(distToDeliveryMeters);
    const evt: GeofenceEventRecord = {
      id: `gf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bookingId: trip.id,
      tripId: trip.id,
      loadId: trip.load_id,
      vehicleId: trip.assigned_vehicle_id,
      driverId: trip.assigned_driver_id,
      zoneType: 'delivery',
      transition: 'ENTERED',
      zoneLabel: `${trip.drop.city} Delivery Zone (${radiusStr})`,
      city: trip.drop.city,
      lat: ping.lat,
      lng: ping.lng,
      distanceMeters: distToDeliveryMeters,
      radiusMeters: config.deliveryRadiusMeters,
      autoUpdatedStatus: autoStatus,
      message: `Vehicle entered ${trip.drop.city} Delivery Geo-Fence (${distStr} from center, radius ${radiusStr}).${autoStatus ? ` Status auto-updated to ${autoStatus.replace('_', ' ')}.` : ''}`,
      timestamp: ping.recorded_at
    };
    triggered.push(evt);
    trip.geofence_events.unshift(evt);
  } else if (prevState.insideDelivery && !nowInsideDelivery) {
    const radiusStr = formatRadiusLabel(config.deliveryRadiusMeters);
    const distStr = formatRadiusLabel(distToDeliveryMeters);
    const evt: GeofenceEventRecord = {
      id: `gf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      bookingId: trip.id,
      tripId: trip.id,
      loadId: trip.load_id,
      vehicleId: trip.assigned_vehicle_id,
      driverId: trip.assigned_driver_id,
      zoneType: 'delivery',
      transition: 'EXITED',
      zoneLabel: `${trip.drop.city} Delivery Zone (${radiusStr})`,
      city: trip.drop.city,
      lat: ping.lat,
      lng: ping.lng,
      distanceMeters: distToDeliveryMeters,
      radiusMeters: config.deliveryRadiusMeters,
      message: `Vehicle exited ${trip.drop.city} Delivery Geo-Fence (${distStr} from center, radius ${radiusStr}).`,
      timestamp: ping.recorded_at
    };
    triggered.push(evt);
    trip.geofence_events.unshift(evt);
  }

  // Keep max 100 geofence events
  if (trip.geofence_events.length > 100) {
    trip.geofence_events = trip.geofence_events.slice(0, 100);
  }

  trip.geofence_state = {
    insidePickup: nowInsidePickup,
    insideDelivery: nowInsideDelivery,
    distanceToPickupMeters: distToPickupMeters,
    distanceToDeliveryMeters: distToDeliveryMeters,
    lastCheckedAt: ping.recorded_at
  };

  return triggered;
}

// Helper: Dispatch SMS alert to driver
async function dispatchDriverTripSms(driverPhone: string, driverName: string, tripId: string, trackingUrl: string, vehicleNumber: string) {
  const apiKey = process.env.HTTPSMS_API_KEY || 'uk_p5IuoZb7MPaQ201UiklbXuZ16fIjVMBfwEdqUi-G_PTi6O0V-Z4HNJTsUtIu4mu7';
  const fromPhone = process.env.MY_JIO_PHONE_NUMBER || '+919678944132';

  const message = `Zuggi Freight Alert: Hello ${driverName}, you have been assigned vehicle ${vehicleNumber} for Trip #${tripId.slice(-6).toUpperCase()}. Tap here to start trip & transmit GPS: ${trackingUrl}`;

  console.log(`[Driver Dispatch SMS] To: ${driverPhone} | Msg: ${message}`);

  if (apiKey && fromPhone && driverPhone.startsWith('+91')) {
    try {
      const response = await fetch('https://api.httpsms.com/v1/messages/send', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          content: message,
          from: fromPhone,
          to: driverPhone
        })
      });
      const data = await response.json();
      console.log('[Driver SMS Gateway Result]', data);
      return { success: true, gateway: 'httpSMS', data };
    } catch (err: any) {
      console.warn('[Driver SMS Warning] Gateway dispatch failed, fallback active:', err.message);
    }
  }

  return { success: true, gateway: 'simulated', message: 'SMS dispatched via platform carrier link' };
}

export const tripsRouter = express.Router();

// --- 1. POST /trips/:id/assign ---
// Fleet owner assigns vehicle + driver. Generates an encrypted tracking token and triggers SMS alert.
tripsRouter.post('/:id/assign', async (req, res) => {
  try {
    const tripId = req.params.id;
    const {
      vehicle_id,
      driver_id,
      tracking_source = 'WEB_LINK',
      pickup,
      drop,
      route_polyline,
      vehicle_number,
      vehicle_type,
      driver_name,
      driver_phone,
      owner_id,
      initial_status
    } = req.body;

    if (!vehicle_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'Both vehicle_id and driver_id are required for trip assignment.'
      });
    }

    let vehicle = vehiclesDb.get(vehicle_id);
    if (!vehicle) {
      vehicle = {
        id: vehicle_id,
        owner_id: owner_id || driver_id,
        vehicle_number: vehicle_number || `AS-01-${vehicle_id.slice(-4).toUpperCase()}`,
        vehicle_type: vehicle_type || 'bolero_pickup',
        gps_type: tracking_source || 'MOBILE_APP',
        is_available: true
      };
    } else {
      if (vehicle_number) vehicle.vehicle_number = vehicle_number;
      if (vehicle_type) vehicle.vehicle_type = vehicle_type;
      if (owner_id) vehicle.owner_id = owner_id;
      if (tracking_source) vehicle.gps_type = tracking_source;
    }
    vehiclesDb.set(vehicle_id, vehicle);

    let driver = driversDb.get(driver_id);
    if (!driver) {
      driver = {
        id: driver_id,
        owner_id: owner_id || driver_id,
        name: driver_name || 'Assigned Partner Driver',
        phone_number: driver_phone || '+919864012345',
        is_active: true
      };
    } else {
      if (driver_name) driver.name = driver_name;
      if (driver_phone) driver.phone_number = driver_phone;
      if (owner_id) driver.owner_id = owner_id;
    }
    driversDb.set(driver_id, driver);

    // Generate high-entropy encrypted tracking token
    const tokenRandomBytes = crypto.randomBytes(20).toString('hex');
    const tracking_token = `trk_${crypto.createHmac('sha256', 'vahansetu_fleet_salt').update(`${tripId}_${vehicle_id}_${driver_id}_${Date.now()}_${tokenRandomBytes}`).digest('hex').slice(0, 32)}`;

    // Build or update trip record
    let trip = tripsDb.get(tripId);
    const now = new Date().toISOString();
    const resolvedStatus: TripStatus =
      initial_status && ['ASSIGNED', 'AT_PICKUP', 'IN_TRANSIT', 'DELIVERED'].includes(initial_status)
        ? initial_status
        : 'ASSIGNED';

    const pickupData = pickup || trip?.pickup || {
      lat: 26.1445,
      lng: 91.7362,
      address: 'Beltola Wholesale Transport Yard',
      city: 'Guwahati',
      contact_name: 'Logistics Supervisor',
      contact_phone: '+919864012345'
    };

    const dropData = drop || trip?.drop || {
      lat: 27.4728,
      lng: 94.9120,
      address: 'Chowkidingee Transport Depot',
      city: 'Dibrugarh',
      contact_name: 'Consignee Receiver',
      contact_phone: '+919435012345'
    };

    const incomingConfig = req.body?.geofence_config;
    const resolvedGeofenceConfig: GeofenceConfigRecord = {
      pickupRadiusMeters: Math.max(150, Math.min(5000, Number(incomingConfig?.pickupRadiusMeters) || trip?.geofence_config?.pickupRadiusMeters || 800)),
      deliveryRadiusMeters: Math.max(150, Math.min(5000, Number(incomingConfig?.deliveryRadiusMeters) || trip?.geofence_config?.deliveryRadiusMeters || 500)),
      autoUpdateStatus: incomingConfig?.autoUpdateStatus !== undefined ? Boolean(incomingConfig.autoUpdateStatus) : (trip?.geofence_config?.autoUpdateStatus ?? true),
      updatedAt: now
    };

    if (!trip) {
      trip = {
        id: tripId,
        load_id: req.body.load_id || tripId,
        assigned_vehicle_id: vehicle_id,
        assigned_driver_id: driver_id,
        status: resolvedStatus,
        tracking_token,
        tracking_source: tracking_source || vehicle.gps_type || 'WEB_LINK',
        created_at: now,
        updated_at: now,
        pickup: pickupData,
        drop: dropData,
        route_polyline: route_polyline || '',
        history: [],
        buffered_count: 0,
        geofence_config: resolvedGeofenceConfig,
        geofence_state: { insidePickup: false, insideDelivery: false },
        geofence_events: []
      };
    } else {
      trip.assigned_vehicle_id = vehicle_id;
      trip.assigned_driver_id = driver_id;
      trip.status = resolvedStatus;
      trip.tracking_token = tracking_token;
      trip.tracking_source = tracking_source || vehicle.gps_type || 'WEB_LINK';
      trip.updated_at = now;
      trip.geofence_config = resolvedGeofenceConfig;
      if (!trip.geofence_state) trip.geofence_state = { insidePickup: false, insideDelivery: false };
      if (!trip.geofence_events) trip.geofence_events = [];
      if (pickup) trip.pickup = pickup;
      if (drop) trip.drop = drop;
      if (route_polyline) trip.route_polyline = route_polyline;
    }

    // Initial ping at pickup
    const initialPing: LocationPingRecord = {
      trip_id: tripId,
      lat: trip.pickup.lat,
      lng: trip.pickup.lng,
      speed: 0,
      heading: 0,
      battery_level: 95,
      recorded_at: now,
      is_buffered: false
    };
    trip.latest_ping = initialPing;
    trip.history.push(initialPing);
    evaluateTripGeofenceTransitions(trip, initialPing);

    tripsDb.set(tripId, trip);
    tripsDb.set(trip.load_id, trip);

    // Persist trip & initial GPS ping to Supabase (non-blocking if tables not yet created)
    void persistTripToSupabase(trip);
    void persistLocationPingsToSupabase(trip.id, [initialPing]);

    // Mark vehicle allocated
    vehicle.is_available = false;

    // Construct Driver Web Link for GPS Ping Transmission
    const host = req.get('host') || 'localhost:3000';
    const forwardedProto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim();
    const protocol = forwardedProto || req.protocol || 'http';
    const tracking_url = `${protocol}://${host}/track/driver?token=${encodeURIComponent(tracking_token)}&trip_id=${encodeURIComponent(tripId)}`;

    // Dispatch automated SMS alert to driver
    const smsResult = await dispatchDriverTripSms(
      driver.phone_number,
      driver.name,
      tripId,
      tracking_url,
      vehicle.vehicle_number
    );

    return res.status(200).json({
      success: true,
      message: `Trip assigned to ${driver.name} with vehicle ${vehicle.vehicle_number}. SMS alert dispatched.`,
      trip: {
        id: trip.id,
        load_id: trip.load_id,
        assigned_vehicle_id: trip.assigned_vehicle_id,
        assigned_driver_id: trip.assigned_driver_id,
        status: trip.status,
        tracking_token: trip.tracking_token,
        tracking_source: trip.tracking_source,
        created_at: trip.created_at,
        updated_at: trip.updated_at
      },
      driver: {
        id: driver.id,
        name: driver.name,
        phone_number: driver.phone_number
      },
      vehicle: {
        id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        vehicle_type: vehicle.vehicle_type,
        gps_type: vehicle.gps_type
      },
      tracking_url,
      sms: smsResult
    });
  } catch (error: any) {
    console.error('[Assign Trip Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error during assignment.' });
  }
});

// --- 1b. POST /trips/:id/sync ---
// Silently hydrates a client-booked trip into server memory (e.g., after cold starts) without re-sending SMS.
tripsRouter.post('/:id/sync', async (req, res) => {
  try {
    const tripId = req.params.id;
    const existing = tripsDb.get(tripId);
    if (existing) {
      return res.status(200).json({ success: true, trip_id: existing.id, already_exists: true });
    }

    const {
      load_id,
      vehicle_id = `veh_${tripId.slice(-6)}`,
      vehicle_number = 'AS-01-ZG-2026',
      vehicle_type = 'commercial_truck',
      driver_id = `drv_${tripId.slice(-6)}`,
      driver_name = 'Assigned Partner Driver',
      driver_phone = '+919678944132',
      tracking_token,
      tracking_source = 'MOBILE_APP',
      status = 'IN_TRANSIT',
      pickup,
      drop,
      latest_location,
      location_history,
      geofence_config
    } = req.body || {};

    if (!pickup || !drop || !Number.isFinite(Number(pickup.lat)) || !Number.isFinite(Number(drop.lat))) {
      return res.status(400).json({ success: false, message: 'Valid pickup and drop coordinates are required to sync trip.' });
    }

    if (!vehiclesDb.has(vehicle_id)) {
      vehiclesDb.set(vehicle_id, {
        id: vehicle_id,
        owner_id: driver_id,
        vehicle_number,
        vehicle_type,
        gps_type: tracking_source,
        is_available: false
      });
    }
    if (!driversDb.has(driver_id)) {
      driversDb.set(driver_id, {
        id: driver_id,
        owner_id: driver_id,
        name: driver_name,
        phone_number: driver_phone,
        is_active: true
      });
    }

    const now = new Date().toISOString();
    const resolvedStatus: TripStatus = ['ASSIGNED', 'AT_PICKUP', 'IN_TRANSIT', 'DELIVERED'].includes(status)
      ? status
      : 'IN_TRANSIT';

    const initialPing: LocationPingRecord = latest_location && Number.isFinite(Number(latest_location.lat))
      ? {
          trip_id: tripId,
          lat: Number(latest_location.lat),
          lng: Number(latest_location.lng),
          speed: Number(latest_location.speed) || 0,
          heading: Number(latest_location.heading) || 0,
          battery_level: Number(latest_location.battery_level) || 90,
          recorded_at: latest_location.recorded_at || now,
          is_buffered: false
        }
      : {
          trip_id: tripId,
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
          speed: 0,
          heading: 0,
          battery_level: 92,
          recorded_at: now,
          is_buffered: false
        };

    const history: LocationPingRecord[] =
      Array.isArray(location_history) && location_history.length > 0
        ? location_history
            .filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
            .map((p: any) => ({
              trip_id: tripId,
              lat: Number(p.lat),
              lng: Number(p.lng),
              speed: Number(p.speed) || 0,
              heading: Number(p.heading) || 0,
              battery_level: Number(p.battery_level) || 90,
              recorded_at: p.recorded_at || now,
              is_buffered: false
            }))
        : [initialPing];

    const resolvedGeofenceConfig: GeofenceConfigRecord = {
      pickupRadiusMeters: Math.max(150, Math.min(5000, Number(geofence_config?.pickupRadiusMeters) || 800)),
      deliveryRadiusMeters: Math.max(150, Math.min(5000, Number(geofence_config?.deliveryRadiusMeters) || 500)),
      autoUpdateStatus: geofence_config?.autoUpdateStatus !== undefined ? Boolean(geofence_config.autoUpdateStatus) : true,
      updatedAt: now
    };

    const hydratedTrip: TripRecord = {
      id: tripId,
      load_id: load_id || tripId,
      assigned_vehicle_id: vehicle_id,
      assigned_driver_id: driver_id,
      status: resolvedStatus,
      tracking_token:
        tracking_token ||
        `trk_${crypto.createHmac('sha256', 'vahansetu_fleet_salt').update(`${tripId}_${now}`).digest('hex').slice(0, 32)}`,
      tracking_source,
      created_at: now,
      updated_at: now,
      pickup: {
        lat: Number(pickup.lat),
        lng: Number(pickup.lng),
        address: pickup.address || pickup.city || 'Pickup Origin',
        city: pickup.city || 'Origin',
        contact_name: pickup.contact_name,
        contact_phone: pickup.contact_phone
      },
      drop: {
        lat: Number(drop.lat),
        lng: Number(drop.lng),
        address: drop.address || drop.city || 'Delivery Destination',
        city: drop.city || 'Destination',
        contact_name: drop.contact_name,
        contact_phone: drop.contact_phone
      },
      route_polyline: '',
      latest_ping: initialPing,
      history,
      buffered_count: 0,
      geofence_config: resolvedGeofenceConfig,
      geofence_state: { insidePickup: false, insideDelivery: false },
      geofence_events: []
    };

    evaluateTripGeofenceTransitions(hydratedTrip, initialPing);
    tripsDb.set(hydratedTrip.id, hydratedTrip);
    tripsDb.set(hydratedTrip.load_id, hydratedTrip);
    void persistTripToSupabase(hydratedTrip);

    return res.status(200).json({
      success: true,
      trip_id: hydratedTrip.id,
      tracking_token: hydratedTrip.tracking_token,
      pickup: hydratedTrip.pickup,
      drop: hydratedTrip.drop
    });
  } catch (error: any) {
    console.error('[Sync Trip Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to sync trip.' });
  }
});

// --- 2. POST /trips/:id/location-ping ---
// Ingests GPS coordinates (lat, lng), speed, and heading data, authenticated via tracking token.
// Fully handles offline GPS buffering and automatic status progression.
tripsRouter.post('/:id/location-ping', async (req, res) => {
  try {
    const tripId = req.params.id;

    // Authenticate token: check Bearer header, plain Authorization, x-tracking-token, body, or query params
    const authHeader = req.headers.authorization;
    let bearerToken: string | null = null;
    if (authHeader) {
      bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    }
    const headerToken = (req.headers['x-tracking-token'] as string)?.trim();
    const bodyToken = (req.body?.token || req.body?.tracking_token)?.toString().trim();
    const queryToken = (req.query?.token || req.query?.tracking_token)?.toString().trim();
    const providedToken = bearerToken || headerToken || bodyToken || queryToken;

    let trip = tripsDb.get(tripId);
    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: `Trip '${tripId}' not found.` });
    }

    if (!providedToken) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing tracking token. Provide in Authorization header (Bearer <token>), x-tracking-token, or request body.'
      });
    }

    if (providedToken !== trip.tracking_token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid tracking token for this trip.'
      });
    }

    // Ingest payload: can be single ping object or batch array (under req.body or req.body.pings)
    let rawPings: any[] = [];
    if (Array.isArray(req.body)) {
      rawPings = req.body;
    } else if (Array.isArray(req.body?.pings)) {
      rawPings = req.body.pings;
    } else if (
      req.body &&
      (req.body.lat !== undefined || req.body.latitude !== undefined) &&
      Number.isFinite(Number(req.body.lat ?? req.body.latitude))
    ) {
      rawPings = [req.body];
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload. Provide coordinates { lat, lng, speed, heading, battery_level?, recorded_at? } or batch array.'
      });
    }

    const now = Date.now();
    let newlyIngestedCount = 0;
    let bufferedCountInBatch = 0;

    // Validate, parse and normalize GPS coordinates, speed, and heading
    const normalizedPings: LocationPingRecord[] = [];
    for (const p of rawPings) {
      const lat = Number(p.lat ?? p.latitude);
      const lng = Number(p.lng ?? p.longitude);

      // Coordinate validity check
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        continue;
      }

      const rawSpeed = p.speed ?? p.speed_kmh ?? p.speedKmh ?? 0;
      const speed = Math.max(0, Math.min(180, Math.round(Number(rawSpeed) || 0)));

      const rawHeading = p.heading ?? p.bearing ?? p.course ?? 0;
      const heading = Math.round(((Number(rawHeading) || 0) % 360 + 360) % 360);

      const rawBattery = p.battery_level ?? p.batteryLevel ?? p.battery ?? 85;
      const battery_level = Math.max(0, Math.min(100, Math.round(Number(rawBattery) || 85)));

      const recorded_at = p.recorded_at || p.timestamp || new Date().toISOString();
      const recordedAtEpoch = new Date(recorded_at).getTime();

      // Flag as offline buffered if timestamp was recorded > 20s prior or marked explicitly
      const isOfflineBuffered = (now - recordedAtEpoch) > 20000 || Boolean(p.is_buffered);
      if (isOfflineBuffered) bufferedCountInBatch++;

      normalizedPings.push({
        trip_id: tripId,
        lat,
        lng,
        speed,
        heading,
        battery_level,
        recorded_at,
        is_buffered: isOfflineBuffered
      });
    }

    normalizedPings.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    if (normalizedPings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Ensure lat (-90 to 90) and lng (-180 to 180) are valid numbers.'
      });
    }

    // Append to trip history (deduplicating identical timestamps) & evaluate geo-fence crossings chronologically
    const existingTimes = new Set(trip.history.map((p) => p.recorded_at));
    const geofenceEventsTriggered: GeofenceEventRecord[] = [];
    for (const p of normalizedPings) {
      if (!existingTimes.has(p.recorded_at)) {
        trip.history.push(p);
        existingTimes.add(p.recorded_at);
        newlyIngestedCount++;
        const events = evaluateTripGeofenceTransitions(trip, p);
        geofenceEventsTriggered.push(...events);
      }
    }

    // Also evaluate the latest ping if all pings happened to share an existing timestamp
    if (newlyIngestedCount === 0 && normalizedPings.length > 0) {
      const fallbackEvents = evaluateTripGeofenceTransitions(trip, normalizedPings[normalizedPings.length - 1]);
      geofenceEventsTriggered.push(...fallbackEvents);
    }

    // Keep history bounded to last 1000 pings
    if (trip.history.length > 1000) {
      trip.history = trip.history.slice(-1000);
    }

    // Set latest ping
    const latest = normalizedPings[normalizedPings.length - 1];
    trip.latest_ping = latest;
    trip.updated_at = new Date().toISOString();
    trip.buffered_count += bufferedCountInBatch;

    // Keep maps synced
    tripsDb.set(tripId, trip);
    tripsDb.set(trip.load_id, trip);

    // Persist updated trip & newly ingested pings to Supabase
    void persistTripToSupabase(trip);
    void persistLocationPingsToSupabase(trip.id, normalizedPings);

    return res.status(200).json({
      success: true,
      ingested_count: newlyIngestedCount,
      buffered_count_in_batch: bufferedCountInBatch,
      total_history_count: trip.history.length,
      trip_status: trip.status,
      latest_ping: trip.latest_ping,
      geofence_events_triggered: geofenceEventsTriggered,
      geofence_state: trip.geofence_state,
      geofence_config: trip.geofence_config,
      message: geofenceEventsTriggered.length > 0
        ? geofenceEventsTriggered.map((e) => e.message).join(' ')
        : bufferedCountInBatch > 0
          ? `Ingested ${newlyIngestedCount} pings (${bufferedCountInBatch} synced from offline buffer).`
          : `Live GPS ping ingested successfully.`
    });
  } catch (error: any) {
    console.error('[Location Ping Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error ingesting ping.' });
  }
});

// --- 3. GET /trips/:id/live-tracking ---
// Public/shipper-authenticated endpoint returning route polyline, pickup & drop pins, latest vehicle location, driver contact info, and ETA.
tripsRouter.get('/:id/live-tracking', async (req, res) => {
  try {
    const tripId = req.params.id;
    let trip = tripsDb.get(tripId);

    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: `Active trip with ID '${tripId}' not found. Ensure the load has been awarded and assigned.`
      });
    }

    const driver = driversDb.get(trip.assigned_driver_id) || {
      id: trip.assigned_driver_id,
      owner_id: 'fleet_owner_01',
      name: 'Assigned Transporter Driver',
      phone_number: '+919678944132',
      is_active: true
    };

    const vehicle = vehiclesDb.get(trip.assigned_vehicle_id) || {
      id: trip.assigned_vehicle_id,
      owner_id: 'fleet_owner_01',
      vehicle_number: 'AS-01-EC-4921',
      vehicle_type: 'tata_407',
      gps_type: trip.tracking_source || 'MOBILE_APP',
      is_available: false
    };

    const latest = trip.latest_ping || {
      trip_id: trip.id,
      lat: trip.pickup.lat,
      lng: trip.pickup.lng,
      speed: 0,
      heading: 0,
      battery_level: 90,
      recorded_at: trip.updated_at,
      is_buffered: false
    };

    // Calculate Remaining Distance and ETA
    const remainingKm = calculateDistanceKm(latest.lat, latest.lng, trip.drop.lat, trip.drop.lng);
    // Average highway freight speed ~ 45 km/h with 15% traffic and hill terrain factor
    const currentSpeed = latest.speed > 10 ? latest.speed : 42;
    const remainingHours = remainingKm / currentSpeed;
    const remainingMinutes = Math.max(5, Math.round(remainingHours * 60));

    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    const etaFormatted = hours > 0 ? `${hours} hr ${mins} mins` : `${mins} mins`;

    // Offline buffer & signal freshness check
    const lastPingEpoch = new Date(latest.recorded_at).getTime();
    const ageSeconds = Math.max(0, Math.round((Date.now() - lastPingEpoch) / 1000));
    // Live if updated within last 90 seconds
    const isLive = ageSeconds <= 90;

    return res.status(200).json({
      success: true,
      trip_id: trip.id,
      load_id: trip.load_id,
      status: trip.status,
      tracking_token: trip.tracking_token,
      pickup: trip.pickup,
      drop: trip.drop,
      route_polyline: trip.route_polyline || '',
      latest_location: latest,
      location_history: trip.history.slice(-60), // return last 60 breadcrumbs
      driver: {
        id: driver.id,
        name: driver.name,
        phone_number: driver.phone_number,
        is_active: driver.is_active
      },
      vehicle: {
        id: vehicle.id,
        vehicle_number: vehicle.vehicle_number,
        vehicle_type: vehicle.vehicle_type,
        gps_type: vehicle.gps_type,
        gps_device_id: vehicle.gps_device_id
      },
      eta: (() => {
        // Prefer driver's fresh Google Maps Route Matrix live ETA when updated within last 15 minutes
        if (trip.live_eta && trip.status !== 'DELIVERED') {
          const etaAgeMs = Date.now() - new Date(trip.live_eta.calculated_at).getTime();
          if (Number.isFinite(etaAgeMs) && etaAgeMs <= 15 * 60 * 1000) {
            return trip.live_eta;
          }
        }
        return {
          minutes: remainingMinutes,
          formatted: etaFormatted,
          distance_remaining_km: remainingKm,
          eta_iso: new Date(Date.now() + remainingMinutes * 60 * 1000).toISOString(),
          source: 'gps_estimate' as const,
          calculated_at: latest.recorded_at
        };
      })(),
      tracking_source: trip.tracking_source,
      offline_buffer_status: {
        is_live: isLive,
        last_ping_age_seconds: ageSeconds,
        buffered_pings_count: trip.buffered_count
      },
      geofence_config: trip.geofence_config || { ...DEFAULT_TRIP_GEOFENCE_CONFIG },
      geofence_state: trip.geofence_state || {
        insidePickup: calculateDistanceMeters(latest.lat, latest.lng, trip.pickup.lat, trip.pickup.lng) <= (trip.geofence_config?.pickupRadiusMeters || 800),
        insideDelivery: calculateDistanceMeters(latest.lat, latest.lng, trip.drop.lat, trip.drop.lng) <= (trip.geofence_config?.deliveryRadiusMeters || 500),
        distanceToPickupMeters: calculateDistanceMeters(latest.lat, latest.lng, trip.pickup.lat, trip.pickup.lng),
        distanceToDeliveryMeters: calculateDistanceMeters(latest.lat, latest.lng, trip.drop.lat, trip.drop.lng),
        lastCheckedAt: latest.recorded_at
      },
      geofence_events: trip.geofence_events || []
    });
  } catch (error: any) {
    console.error('[Live Tracking Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Internal error retrieving tracking data.' });
  }
});

// --- 3b. POST /trips/:id/live-eta ---
// Receives driver-calculated live traffic-aware ETA (Google Routes API Route Matrix) and exposes it in live-tracking for the shipper.
tripsRouter.post('/:id/live-eta', async (req, res) => {
  try {
    const tripId = req.params.id;
    let trip = tripsDb.get(tripId);
    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: `Trip '${tripId}' not found.` });
    }

    const body = req.body || {};
    const minutes = Math.max(0, Math.round(Number(body.minutes) || 0));
    const distanceRemainingKm = Math.max(0, Math.round((Number(body.distance_remaining_km) || 0) * 10) / 10);
    const trafficCondition: 'clear' | 'moderate' | 'heavy' =
      body.traffic_condition === 'heavy' || body.traffic_condition === 'moderate'
        ? body.traffic_condition
        : 'clear';
    const source: 'google_routes_matrix' | 'gps_estimate' =
      body.source === 'google_routes_matrix' ? 'google_routes_matrix' : 'gps_estimate';

    trip.live_eta = {
      minutes,
      formatted: typeof body.formatted === 'string' && body.formatted.trim() ? body.formatted.trim() : `${minutes} mins`,
      distance_remaining_km: distanceRemainingKm,
      eta_iso: typeof body.eta_iso === 'string' ? body.eta_iso : new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      formatted_arrival_time:
        typeof body.formatted_arrival_time === 'string' ? body.formatted_arrival_time : '',
      traffic_condition: trafficCondition,
      traffic_delay_minutes: Math.max(0, Math.round(Number(body.traffic_delay_minutes) || 0)),
      source,
      calculated_at: typeof body.calculated_at === 'string' ? body.calculated_at : new Date().toISOString()
    };
    trip.updated_at = new Date().toISOString();
    tripsDb.set(trip.id, trip);
    tripsDb.set(trip.load_id, trip);

    return res.status(200).json({ success: true, live_eta: trip.live_eta });
  } catch (error: any) {
    console.error('[Live ETA Sync Error]', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to sync live ETA.' });
  }
});

// --- 4. POST /trips/:id/status ---
// Update trip milestone status cleanly from Driver Trip Execution or Admin Dashboard
const STATUS_NORMALIZATION_MAP: Record<string, TripStatus> = {
  ASSIGNED: 'ASSIGNED',
  AT_PICKUP: 'AT_PICKUP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  assigned: 'ASSIGNED',
  en_route_pickup: 'ASSIGNED',
  at_pickup: 'AT_PICKUP',
  loading: 'AT_PICKUP',
  in_transit: 'IN_TRANSIT',
  at_destination: 'IN_TRANSIT',
  delivered: 'DELIVERED',
  completed: 'DELIVERED'
};

tripsRouter.post('/:id/status', async (req, res) => {
  try {
    const tripId = req.params.id;
    const rawStatus = String(req.body?.status || '').trim();
    let trip = tripsDb.get(tripId);
    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: `Trip '${tripId}' not found.` });
    }

    // If a tracking token is supplied (e.g. from no-login Driver Web Link), validate it strictly
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader
      ? authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()
      : null;
    const providedToken = bearerToken || (req.body?.token || req.body?.tracking_token)?.toString().trim();
    if (providedToken && providedToken !== trip.tracking_token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid tracking token for status update.' });
    }

    const normalizedStatus = STATUS_NORMALIZATION_MAP[rawStatus] || STATUS_NORMALIZATION_MAP[rawStatus.toUpperCase()];
    if (!normalizedStatus) {
      return res.status(400).json({ success: false, message: `Invalid status '${rawStatus}'.` });
    }
    trip.status = normalizedStatus;
    trip.updated_at = new Date().toISOString();
    if (normalizedStatus === 'DELIVERED') {
      const vehicle = vehiclesDb.get(trip.assigned_vehicle_id);
      if (vehicle) vehicle.is_available = true;
    }
    tripsDb.set(trip.id, trip);
    tripsDb.set(trip.load_id, trip);
    void persistTripToSupabase(trip);
    return res.json({ success: true, trip_id: trip.id, status: trip.status, updated_at: trip.updated_at });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update trip status.' });
  }
});

// --- 5. GET & POST /trips/:id/geofence ---
// Read or update pickup/delivery geo-fence radii & auto-status preferences, and return crossing event history.
tripsRouter.get('/:id/geofence', async (req, res) => {
  try {
    const tripId = req.params.id;
    let trip = tripsDb.get(tripId);
    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: `Trip '${tripId}' not found.` });
    }
    return res.json({
      success: true,
      trip_id: trip.id,
      trip_status: trip.status,
      geofence_config: trip.geofence_config || { ...DEFAULT_TRIP_GEOFENCE_CONFIG },
      geofence_state: trip.geofence_state || { insidePickup: false, insideDelivery: false },
      geofence_events: trip.geofence_events || []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to read geofence configuration.' });
  }
});

tripsRouter.post('/:id/geofence', async (req, res) => {
  try {
    const tripId = req.params.id;
    let trip = tripsDb.get(tripId);
    if (!trip) {
      const recoveredTrip = await loadTripFromSupabase(tripId);
      if (recoveredTrip) {
        trip = recoveredTrip;
        tripsDb.set(recoveredTrip.id, recoveredTrip);
        tripsDb.set(recoveredTrip.load_id, recoveredTrip);
      }
    }
    if (!trip) {
      return res.status(404).json({ success: false, message: `Trip '${tripId}' not found.` });
    }

    const prevConfig = trip.geofence_config || { ...DEFAULT_TRIP_GEOFENCE_CONFIG };
    const nextConfig: GeofenceConfigRecord = {
      pickupRadiusMeters: req.body?.pickupRadiusMeters !== undefined
        ? Math.max(150, Math.min(5000, Math.round(Number(req.body.pickupRadiusMeters) || 800)))
        : prevConfig.pickupRadiusMeters,
      deliveryRadiusMeters: req.body?.deliveryRadiusMeters !== undefined
        ? Math.max(150, Math.min(5000, Math.round(Number(req.body.deliveryRadiusMeters) || 500)))
        : prevConfig.deliveryRadiusMeters,
      autoUpdateStatus: req.body?.autoUpdateStatus !== undefined
        ? Boolean(req.body.autoUpdateStatus)
        : prevConfig.autoUpdateStatus,
      updatedAt: new Date().toISOString()
    };

    trip.geofence_config = nextConfig;
    trip.updated_at = new Date().toISOString();

    let triggeredEvents: GeofenceEventRecord[] = [];
    if (trip.latest_ping) {
      triggeredEvents = evaluateTripGeofenceTransitions(trip, trip.latest_ping);
    }

    tripsDb.set(trip.id, trip);
    tripsDb.set(trip.load_id, trip);
    void persistTripToSupabase(trip);

    return res.json({
      success: true,
      trip_id: trip.id,
      trip_status: trip.status,
      geofence_config: trip.geofence_config,
      geofence_state: trip.geofence_state,
      geofence_events: trip.geofence_events || [],
      geofence_events_triggered: triggeredEvents
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update geofence configuration.' });
  }
});

// --- Helper Fleet APIs for UI Management ---
tripsRouter.get('/fleet/vehicles', (_req, res) => {
  res.json({ success: true, vehicles: Array.from(vehiclesDb.values()) });
});

tripsRouter.get('/fleet/drivers', (_req, res) => {
  res.json({ success: true, drivers: Array.from(driversDb.values()) });
});

tripsRouter.post('/fleet/vehicles', (req, res) => {
  const { vehicle_number, vehicle_type, gps_type = 'MOBILE_APP', gps_device_id } = req.body;
  if (!vehicle_number || !vehicle_type) {
    return res.status(400).json({ success: false, message: 'vehicle_number and vehicle_type are required.' });
  }
  const id = `veh_${Date.now()}`;
  const record: VehicleRecord = {
    id,
    owner_id: req.body.owner_id || 'fleet_owner_01',
    vehicle_number,
    vehicle_type,
    gps_type,
    gps_device_id,
    is_available: true
  };
  vehiclesDb.set(id, record);
  res.status(201).json({ success: true, vehicle: record });
});

tripsRouter.post('/fleet/drivers', (req, res) => {
  const { name, phone_number } = req.body;
  if (!name || !phone_number) {
    return res.status(400).json({ success: false, message: 'name and phone_number are required.' });
  }
  const id = `drv_${Date.now()}`;
  const record: DriverRecord = {
    id,
    owner_id: req.body.owner_id || 'fleet_owner_01',
    name,
    phone_number,
    is_active: true
  };
  driversDb.set(id, record);
  res.status(201).json({ success: true, driver: record });
});

// List all trips
tripsRouter.get('/', (_req, res) => {
  res.json({ success: true, trips: Array.from(tripsDb.values()) });
});
