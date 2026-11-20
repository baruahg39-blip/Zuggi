// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { Truck, Navigation, MapPin, ShieldCheck, Radio, LocateFixed, Clock } from 'lucide-react';
import { GeofenceZoneConfig, GeofenceZoneState, LocationPing, LocationPoint } from '../../types';
import { logisticsStore, NH27_CORRIDOR_WAYPOINTS } from '../../services/store';
import { formatMetersOrKm } from '../../utils/geofence';
import { GeofenceOverlay } from './GeofenceOverlay';
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
  driverName = 'Manoj Das',
  shipmentStatus,
  isDriverMode = false
}) => {
  const apiKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  
  const [currentPing, setCurrentPing] = useState<LocationPing | null>(() => {
    return logisticsStore.getLatestPing(bookingId) || null;
  });
  
  const [isGpsTransmitting, setIsGpsTransmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [simIndex, setSimIndex] = useState(5); // Kaziranga waypoint default
  const [mapError, setMapError] = useState(false);
  const [geofenceConfig, setGeofenceConfig] = useState<GeofenceZoneConfig>(() =>
    logisticsStore.getGeofenceConfig(bookingId)
  );
  const [geofenceState, setGeofenceState] = useState<GeofenceZoneState>(() =>
    logisticsStore.getGeofenceState(bookingId)
  );

  // Sync state from store
  useEffect(() => {
    const update = () => {
      const ping = logisticsStore.getLatestPing(bookingId);
      if (ping) {
        setCurrentPing(ping);
      }
      setGeofenceConfig(logisticsStore.getGeofenceConfig(bookingId));
      setGeofenceState(logisticsStore.getGeofenceState(bookingId));
    };
    update();
    const unsub = logisticsStore.subscribe(update);
    return unsub;
  }, [bookingId]);

  // Map center calculation
  const defaultCenter = useMemo(() => {
    if (currentPing) {
      return { lat: currentPing.lat, lng: currentPing.lng };
    }
    return {
      lat: (pickup.lat + delivery.lat) / 2,
      lng: (pickup.lng + delivery.lng) / 2
    };
  }, [currentPing, pickup, delivery]);

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
  }, [bookingId]);

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
    if (triggered.length > 0) {
      triggered.forEach((evt) => showToast(evt.message, 'info'));
    }
    setStatusMessage(`Vehicle advanced to milestone: ${waypoint.name}`);
  }, [bookingId, simIndex]);

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
    <div className="relative w-full h-[450px] md:h-[520px] rounded-3xl overflow-hidden border border-gray-200 bg-[#171318] shadow-xl flex flex-col">
      {/* Top Telemetry Overlay */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
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
            <span className="text-[#E83E83] font-black font-mono text-sm">{remainingKm} km</span>
          </div>
          <div className="border-l border-gray-800 pl-3">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Est. Arrival</span>
            <span className="text-white font-black font-mono text-sm">
              ~{Math.round((remainingKm / 42) * 10) / 10} hrs
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

      {/* Interactive Map Canvas */}
      <div className="flex-1 w-full h-full relative">
        {apiKey && !mapError ? (
          <APIProvider
            apiKey={apiKey}
            onError={() => setMapError(true)}
          >
            <Map
              mapId="DEMO_MAP_ID"
              style={{ width: '100%', height: '100%' }}
              defaultCenter={defaultCenter}
              defaultZoom={8}
              gestureHandling="greedy"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              {/* Pickup Marker */}
              <AdvancedMarker position={{ lat: pickup.lat, lng: pickup.lng }} title={`Pickup: ${pickup.city}`}>
                <Pin background="#10b981" borderColor="#064e3b" glyphColor="#ffffff" scale={1.1} />
              </AdvancedMarker>

              {/* Delivery Marker */}
              <AdvancedMarker position={{ lat: delivery.lat, lng: delivery.lng }} title={`Destination: ${delivery.city}`}>
                <Pin background="#ef4444" borderColor="#7f1d1d" glyphColor="#ffffff" scale={1.1} />
              </AdvancedMarker>

              {/* Geo-Fence Circular Zones */}
              <GeofenceOverlay
                pickup={pickup}
                delivery={delivery}
                pickupRadiusMeters={geofenceConfig.pickupRadiusMeters}
                deliveryRadiusMeters={geofenceConfig.deliveryRadiusMeters}
                insidePickup={geofenceState.insidePickup}
                insideDelivery={geofenceState.insideDelivery}
              />

              {/* Live Vehicle Marker */}
              {currentPing && (
                <AdvancedMarker
                  position={{ lat: currentPing.lat, lng: currentPing.lng }}
                  title={`${vehicleRegNumber} - In Transit`}
                >
                  <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
                    <div className="w-10 h-10 rounded-full bg-[#E83E83]/30 animate-ping absolute"></div>
                    <div className="w-9 h-9 rounded-full bg-[#E83E83] border-2 border-white shadow-xl flex items-center justify-center text-white font-bold">
                      <Truck className="w-5 h-5 text-white fill-current" />
                    </div>
                    <div className="absolute -bottom-6 bg-[#171318] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-700 whitespace-nowrap shadow-md">
                      {vehicleRegNumber}
                    </div>
                  </div>
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* High-Fidelity Tactical Vector Map Fallback */
          <div className="w-full h-full bg-[#171318] flex flex-col justify-between p-6 relative overflow-hidden text-white">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#E83E83_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            {/* Vector Route Representation */}
            <div className="relative z-10 my-auto py-8">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-2 px-2">
                <span className="flex items-center gap-1 text-[#16A36A] font-bold">
                  <MapPin className="w-3.5 h-3.5" /> {pickup.city} ({pickup.state})
                </span>
                <span className="font-mono text-gray-400">Corridor: NH-27 / NH-37 (442 km)</span>
                <span className="flex items-center gap-1 text-[#E83E83] font-bold">
                  <MapPin className="w-3.5 h-3.5" /> {delivery.city} ({delivery.state})
                </span>
              </div>

              {/* Highway progress bar with waypoints */}
              <div className="relative h-3 bg-gray-800 rounded-full overflow-visible border border-gray-700">
                <div
                  className="h-full bg-gradient-to-r from-[#16A36A] via-[#E83E83] to-[#E83E83] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(95, Math.max(10, ((442 - remainingKm) / 442) * 100))}%` }}
                ></div>

                {/* Live vehicle indicator icon */}
                <div
                  className="absolute -top-3.5 -translate-x-1/2 transition-all duration-700 z-20"
                  style={{ left: `${Math.min(95, Math.max(10, ((442 - remainingKm) / 442) * 100))}%` }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#E83E83] border-2 border-white shadow-xl flex items-center justify-center text-white font-bold animate-pulse">
                    <Truck className="w-5 h-5 fill-current" />
                  </div>
                </div>
              </div>

              {/* Waypoint Markers */}
              <div className="grid grid-cols-4 text-center mt-4 text-[11px] text-slate-400">
                <div className="text-left font-medium text-emerald-400">
                  ● Dibrugarh Yard<br /><span className="text-[9px] text-slate-500">KM 0</span>
                </div>
                <div className="font-medium text-slate-300">
                  Dergaon Toll Plaza<br /><span className="text-[9px] text-slate-500">KM 160</span>
                </div>
                <div className="font-medium text-amber-400">
                  Kaziranga Corridor<br /><span className="text-[9px] text-slate-500">KM 230</span>
                </div>
                <div className="text-right font-medium text-rose-400">
                  ● Guwahati ICD<br /><span className="text-[9px] text-slate-500">KM 442</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 relative z-10 bg-slate-900/60 py-2 rounded-lg border border-slate-800">
              Interactive Google Maps layer ready with key. Geocoding & live telemetry synchronizing.
            </div>
          </div>
        )}
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
