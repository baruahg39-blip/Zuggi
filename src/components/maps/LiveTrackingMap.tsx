import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigation, ShieldCheck, Radio, LocateFixed, Clock } from 'lucide-react';
import { GeofenceZoneConfig, GeofenceZoneState, LocationPing, LocationPoint } from '../../types';
import { logisticsStore, NH27_CORRIDOR_WAYPOINTS } from '../../services/store';
import { formatMetersOrKm } from '../../utils/geofence';
import { buildLocalTrackingFallback, syncLocalTripToServer } from '../../utils/trackingFallback';
import { LiveTelemetryFallbackMap } from './LiveTelemetryFallbackMap';
import { showToast } from '../shared/Toast';

interface LiveTrackingMapProps {
  bookingId: string;
  pickup: LocationPoint;
  delivery: LocationPoint;
  vehicleRegNumber?: string;
  driverName?: string;
  driverPhone?: string;
  shipmentStatus: string;
  isDriverMode?: boolean;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  bookingId,
  pickup,
  delivery,
  vehicleRegNumber = 'AS-01-QC-4910',
  driverName = 'Assigned Driver',
  shipmentStatus: _shipmentStatus,
  isDriverMode: _isDriverMode = false
}) => {

  const [currentPing, setCurrentPing] = useState<LocationPing | null>(() => {
    return logisticsStore.getLatestPing(bookingId) || null;
  });
  const [gpsHistory, setGpsHistory] = useState<LocationPing[]>(() =>
    logisticsStore.getLocationPings(bookingId)
  );

  const [isGpsTransmitting, setIsGpsTransmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [simIndex, setSimIndex] = useState(5); // Kaziranga waypoint default
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceZoneConfig>(() =>
    logisticsStore.getGeofenceConfig(bookingId)
  );
  const [geofenceState, setGeofenceState] = useState<GeofenceZoneState>(() =>
    logisticsStore.getGeofenceState(bookingId)
  );
  const [liveEta, setLiveEta] = useState(() => logisticsStore.getBookingById(bookingId)?.liveEta || null);

  // Sync live location state from store (resetting cleanly if bookingId changes)
  useEffect(() => {
    const update = () => {
      const ping = logisticsStore.getLatestPing(bookingId);
      setCurrentPing(ping || null);
      setGpsHistory(logisticsStore.getLocationPings(bookingId));
      setGeofenceConfig(logisticsStore.getGeofenceConfig(bookingId));
      setGeofenceState(logisticsStore.getGeofenceState(bookingId));
      setLiveEta(logisticsStore.getBookingById(bookingId)?.liveEta || null);
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [bookingId]);

  // Best-effort relay of driver ping to backend so Shipper view stays synced across devices
  const relayPingToServer = useCallback(async (ping: LocationPing) => {
    const booking = logisticsStore.getBookingById(bookingId);
    let token = booking?.trackingToken;

    if (!token) {
      const localFallback = buildLocalTrackingFallback(bookingId, booking?.loadId);
      if (localFallback) {
        await syncLocalTripToServer(localFallback);
        token = localFallback.tracking_token || logisticsStore.getBookingById(bookingId)?.trackingToken;
      }
    }
    if (!token) return;

    fetch(`/trips/${encodeURIComponent(bookingId)}/location-ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        lat: ping.lat,
        lng: ping.lng,
        speed: ping.speedKmh,
        heading: ping.heading,
        battery_level: ping.batteryLevel ?? 90,
        recorded_at: ping.timestamp
      })
    }).catch(() => {});
  }, [bookingId]);

  // Transmit genuine device GPS if authorized (Workflow C requirement)
  const handleTransmitGenuineDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsGpsTransmitting(true);
    setStatusMessage('Acquiring precise satellite GPS lock...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const genuinePing: LocationPing = {
          bookingId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 38,
          heading: pos.coords.heading || 45,
          timestamp: new Date().toISOString(),
          isGpsReliable: true,
          batteryLevel: 92,
          nearLandmark: 'Current Authorized Device Location (Live GPS)'
        };
        const triggered = logisticsStore.recordLocationPing(genuinePing);
        setCurrentPing(genuinePing);
        void relayPingToServer(genuinePing);
        setIsGpsTransmitting(false);
        if (triggered.length > 0) {
          triggered.forEach((evt) => showToast(evt.message, 'info'));
        }
        setStatusMessage(`Live location transmitted successfully at ${new Date().toLocaleTimeString('en-IN')}`);
      },
      (err) => {
        setIsGpsTransmitting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setStatusMessage('Location permission denied. Please enable GPS permissions in browser settings.');
        } else {
          setStatusMessage(`GPS fix unavailable: ${err.message}. Preserving last verified position.`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [bookingId, relayPingToServer]);

  // Advance along highway simulation corridor
  const handleAdvanceSimulation = useCallback(() => {
    const nextIdx = (simIndex + 1) % NH27_CORRIDOR_WAYPOINTS.length;
    setSimIndex(nextIdx);
    const waypoint = NH27_CORRIDOR_WAYPOINTS[nextIdx];

    const simPing: LocationPing = {
      bookingId,
      lat: waypoint.lat,
      lng: waypoint.lng,
      speedKmh: Math.floor(45 + Math.random() * 20),
      heading: 265,
      timestamp: new Date().toISOString(),
      isGpsReliable: true,
      batteryLevel: Math.max(20, 95 - nextIdx * 5),
      nearLandmark: `${waypoint.name} (KM ${waypoint.km})`
    };

    const triggered = logisticsStore.recordLocationPing(simPing);
    setCurrentPing(simPing);
    void relayPingToServer(simPing);
    if (triggered.length > 0) {
      triggered.forEach((evt) => showToast(evt.message, 'info'));
    }
    setStatusMessage(`Vehicle advanced to milestone: ${waypoint.name}`);
  }, [bookingId, simIndex, relayPingToServer]);

  // Calculate remaining distance estimate
  const remainingKm = useMemo(() => {
    if (!currentPing) return 180;
    const dLat = ((delivery.lat - currentPing.lat) * Math.PI) / 180;
    const dLon = ((delivery.lng - currentPing.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((currentPing.lat * Math.PI) / 180) *
        Math.cos((delivery.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.round(6371 * c * 1.3));
  }, [currentPing, delivery]);

  return (
    <div className="relative w-full h-[450px] md:h-[520px] rounded-3xl overflow-hidden border border-gray-200 bg-[#E8EEF4] shadow-xl flex flex-col">
      {/* Top Telemetry Overlay */}
      <div className="absolute top-3 left-3 right-3 z-[420] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-[#171318]/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-gray-700/80 shadow-lg pointer-events-auto flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-[#16A36A] animate-ping absolute opacity-75"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A36A]"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#E83E83]">
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE SATELLITE TRACKING</span>
            </div>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <span>{vehicleRegNumber}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono font-bold">
                {currentPing?.speedKmh || 48} km/h
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#171318]/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-gray-700/80 shadow-lg pointer-events-auto flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Remaining Dist</span>
            <span className="text-[#E83E83] font-black font-mono tabular-nums text-sm">
              {liveEta ? `${liveEta.distanceKm} km` : `${remainingKm} km`}
            </span>
          </div>
          <div className="border-l border-gray-800 pl-3">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Est. Arrival</span>
            <span className="text-white font-black font-mono tabular-nums text-sm">
              {liveEta
                ? `${liveEta.formattedArrivalTime} (${liveEta.formattedDuration})`
                : `~${Math.round((remainingKm / 42) * 10) / 10} hrs`}
            </span>
          </div>
          <div className="border-l border-gray-800 pl-3 hidden sm:block">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Geo-Fence Status</span>
            <span className={`font-bold block text-xs ${
              geofenceState.insidePickup
                ? 'text-emerald-400'
                : geofenceState.insideDelivery
                ? 'text-[#E83E83]'
                : 'text-gray-200'
            }`}>
              {geofenceState.insidePickup
                ? `Inside ${pickup.city} (${formatMetersOrKm(geofenceState.distanceToPickupMeters)})`
                : geofenceState.insideDelivery
                ? `Inside ${delivery.city} (${formatMetersOrKm(geofenceState.distanceToDeliveryMeters)})`
                : 'En-Route Corridor'}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive OpenStreetMap + OSRM Map Canvas */}
      <div className="flex-1 w-full h-full min-h-0 relative">
        <LiveTelemetryFallbackMap
          pickup={pickup}
          drop={delivery}
          currentLocation={currentPing ? { lat: currentPing.lat, lng: currentPing.lng } : null}
          historyPings={gpsHistory}
          vehicleNumber={vehicleRegNumber}
          speedKmh={currentPing?.speedKmh || 0}
          heading={currentPing?.heading || 0}
          remainingKm={liveEta ? liveEta.distanceKm : remainingKm}
          pickupRadiusMeters={geofenceConfig.pickupRadiusMeters}
          deliveryRadiusMeters={geofenceConfig.deliveryRadiusMeters}
          insidePickup={geofenceState.insidePickup}
          insideDelivery={geofenceState.insideDelivery}
          autoFollowVehicle={true}
        />
      </div>

      {/* Bottom Controls Bar */}
      <div className="bg-slate-950/95 border-t border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Updated: {currentPing?.timestamp ? new Date(currentPing.timestamp).toLocaleTimeString('en-IN') : 'Just now'}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <span>• Driver:</span>
            <span className="text-slate-200 font-semibold">{driverName}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Carrier</span>
          </div>
        </div>

        {/* Action Controls for Driver & QA Testing */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Real Device GPS Trigger (Workflow C) */}
          <button
            onClick={handleTransmitGenuineDeviceGps}
            disabled={isGpsTransmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
            title="Transmits authentic coordinates from authorized device"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isGpsTransmitting ? 'animate-spin' : ''}`} />
            <span>{isGpsTransmitting ? 'Fixing GPS...' : 'Transmit Device GPS'}</span>
          </button>

          {/* Simulate Highway Movement Stepper */}
          <button
            onClick={handleAdvanceSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-amber-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
            title="Simulate truck progression along Assam NH-27 Corridor"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Simulate Highway Progress</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-amber-950/90 text-amber-200 text-xs px-3 py-1.5 text-center border-t border-amber-800/80">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
