import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Radio,
  Send,
  Wifi,
  WifiOff,
  Navigation,
  Compass,
  Battery,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Loader2,
  Truck,
  MapPin,
  Play,
  Square
} from 'lucide-react';
import { NH27_CORRIDOR_WAYPOINTS, logisticsStore } from '../../services/store';
import { offsetCoordinateByMeters } from '../../utils/geofence';
import { showToast } from '../shared/Toast';

interface DriverGpsSimulatorModalProps {
  tripId: string;
  trackingToken: string;
  isOpen: boolean;
  onClose: () => void;
  onPingSent?: (latestPing: any) => void;
}

export const DriverGpsSimulatorModal: React.FC<DriverGpsSimulatorModalProps> = ({
  tripId,
  trackingToken,
  isOpen,
  onClose,
  onPingSent
}) => {
  const [waypointIndex, setWaypointIndex] = useState<number>(3); // start near Jorhat
  const [speedKmh, setSpeedKmh] = useState<number>(52);
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isSimulatingHighway, setIsSimulatingHighway] = useState<boolean>(false);
  const [isOfflineBuffering, setIsOfflineBuffering] = useState<boolean>(false);
  const [bufferedPings, setBufferedPings] = useState<any[]>([]);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [lastSentTime, setLastSentTime] = useState<string>('');
  const [serverLog, setServerLog] = useState<string>('Ready to transmit GPS telemetry.');
  const [tripGeo, setTripGeo] = useState<{
    pickup: { lat: number; lng: number; city: string };
    drop: { lat: number; lng: number; city: string };
    pickupRadiusMeters: number;
    deliveryRadiusMeters: number;
  }>({
    pickup: { lat: 27.4728, lng: 94.9120, city: 'Dibrugarh' },
    drop: { lat: 26.1445, lng: 91.7362, city: 'Guwahati' },
    pickupRadiusMeters: 800,
    deliveryRadiusMeters: 500
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const waypointIndexRef = useRef(waypointIndex);
  const batteryLevelRef = useRef(batteryLevel);
  const isOfflineRef = useRef(isOfflineBuffering);
  const bufferedCountRef = useRef(bufferedPings.length);

  waypointIndexRef.current = waypointIndex;
  batteryLevelRef.current = batteryLevel;
  isOfflineRef.current = isOfflineBuffering;
  bufferedCountRef.current = bufferedPings.length;

  useEffect(() => {
    if (!isOpen) return;
    fetch(`/trips/${encodeURIComponent(tripId)}/live-tracking`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.pickup && data?.drop) {
          setTripGeo({
            pickup: { lat: data.pickup.lat, lng: data.pickup.lng, city: data.pickup.city || 'Pickup' },
            drop: { lat: data.drop.lat, lng: data.drop.lng, city: data.drop.city || 'Drop' },
            pickupRadiusMeters: data.geofence_config?.pickupRadiusMeters || 800,
            deliveryRadiusMeters: data.geofence_config?.deliveryRadiusMeters || 500
          });
        }
      })
      .catch(() => {});
  }, [isOpen, tripId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const currentWaypoint = NH27_CORRIDOR_WAYPOINTS[waypointIndex] || NH27_CORRIDOR_WAYPOINTS[0];

  // Send single ping to server
  const sendSinglePingToServer = async (pingData: any) => {
    setIsSending(true);
    try {
      const res = await fetch(`/trips/${tripId}/location-ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${trackingToken}`
        },
        body: JSON.stringify(pingData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Server rejected ping');
      }

      const eventsTriggered = Array.isArray(data.geofence_events_triggered) ? data.geofence_events_triggered : [];
      logisticsStore.ingestServerGeofenceEvents(
        tripId,
        eventsTriggered,
        data.geofence_state,
        data.geofence_config
      );

      if (eventsTriggered.length > 0) {
        eventsTriggered.forEach((evt: any) => showToast(evt.message, 'info'));
        setServerLog(`GEO-FENCE TRIGGERED (${data.trip_status}): ${eventsTriggered.map((e: any) => e.message).join(' | ')}`);
      } else {
        setServerLog(`Server ingested live ping at (${pingData.lat.toFixed(4)}, ${pingData.lng.toFixed(4)}) - Speed: ${pingData.speed} km/h - Status: ${data.trip_status}`);
      }
      setLastSentTime(new Date().toLocaleTimeString('en-IN'));
      if (onPingSent) onPingSent(data.latest_ping);
    } catch (err: any) {
      setServerLog(`Transmission failed: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Trigger clean geo-fence boundary crossing test point (inside = 30% radius, outside = 250% radius)
  const triggerGeofenceBoundaryTest = (zone: 'pickup' | 'delivery', action: 'enter' | 'exit') => {
    const center = zone === 'pickup' ? tripGeo.pickup : tripGeo.drop;
    const radius = zone === 'pickup' ? tripGeo.pickupRadiusMeters : tripGeo.deliveryRadiusMeters;
    const offsetDist = action === 'enter' ? Math.round(radius * 0.25) : Math.round(radius * 2.6 + 250);
    const coords = offsetCoordinateByMeters(center.lat, center.lng, offsetDist, 0);
    const ping = {
      trip_id: tripId,
      lat: coords.lat,
      lng: coords.lng,
      speed: action === 'enter' ? 6 : 44,
      heading: zone === 'pickup' ? 240 : 195,
      battery_level: batteryLevel,
      recorded_at: new Date().toISOString()
    };
    setSpeedKmh(ping.speed);
    if (isOfflineBuffering) {
      setBufferedPings((prev) => [...prev, ping]);
      setServerLog(`Offline buffered geo-fence ${action.toUpperCase()} (${zone}) ping queued.`);
    } else {
      void sendSinglePingToServer(ping);
    }
  };

  // Flush offline buffered pings to server
  const flushBufferedPings = async () => {
    if (bufferedPings.length === 0) {
      showToast('No buffered pings to flush.', 'info');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`/trips/${tripId}/location-ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${trackingToken}`
        },
        body: JSON.stringify({ pings: bufferedPings })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Server failed to ingest buffer');
      }

      const eventsTriggered = Array.isArray(data.geofence_events_triggered) ? data.geofence_events_triggered : [];
      logisticsStore.ingestServerGeofenceEvents(
        tripId,
        eventsTriggered,
        data.geofence_state,
        data.geofence_config
      );
      if (eventsTriggered.length > 0) {
        eventsTriggered.forEach((evt: any) => showToast(evt.message, 'info'));
      }
      showToast(`Network restored! Flushed ${bufferedPings.length} buffered GPS pings to server.`, 'success');
      setServerLog(
        eventsTriggered.length > 0
          ? `Synced ${bufferedPings.length} offline pings & detected ${eventsTriggered.length} geo-fence crossing(s)!`
          : `Successfully batch-synced ${bufferedPings.length} offline pings! Shipper map updated.`
      );
      setBufferedPings([]);
      setIsOfflineBuffering(false);
      setLastSentTime(new Date().toLocaleTimeString('en-IN'));
      if (onPingSent) onPingSent(data.latest_ping);
    } catch (err: any) {
      showToast(`Batch flush error: ${err.message}`, 'error');
      setServerLog(`Batch flush failed: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Step vehicle forward along corridor (safe for intervals via refs)
  const handleStepForward = () => {
    const nextIdx = (waypointIndexRef.current + 1) % NH27_CORRIDOR_WAYPOINTS.length;
    waypointIndexRef.current = nextIdx;
    setWaypointIndex(nextIdx);
    const nextWp = NH27_CORRIDOR_WAYPOINTS[nextIdx];

    const nextBattery = Math.max(15, batteryLevelRef.current - 1);
    batteryLevelRef.current = nextBattery;

    const newPing = {
      trip_id: tripId,
      lat: nextWp.lat,
      lng: nextWp.lng,
      speed: Math.floor(40 + Math.random() * 25),
      heading: 250,
      battery_level: nextBattery,
      recorded_at: new Date().toISOString()
    };

    setSpeedKmh(newPing.speed);
    setBatteryLevel(nextBattery);

    if (isOfflineRef.current) {
      // Buffer in offline queue
      const nextCount = bufferedCountRef.current + 1;
      bufferedCountRef.current = nextCount;
      setBufferedPings((prev) => [...prev, newPing]);
      setServerLog(`Network offline: Buffered ping #${nextCount} at ${nextWp.name} (KM ${nextWp.km}) in local memory.`);
    } else {
      // Transmit directly
      sendSinglePingToServer(newPing);
    }
  };

  // Toggle automated highway stream
  const toggleHighwayStream = () => {
    if (isSimulatingHighway) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsSimulatingHighway(false);
    } else {
      setIsSimulatingHighway(true);
      timerRef.current = setInterval(() => {
        handleStepForward();
      }, 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-[#171318] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E83E83] flex items-center justify-center font-bold text-white shadow-md">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">Driver GPS Pinger & Offline Buffer</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-mono font-bold">
                  AUTH OK
                </span>
              </div>
              <p className="text-xs text-gray-400">Trip #{tripId.slice(-6).toUpperCase()} • Corridor NH-27</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              onClose();
            }}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#171318]">
          {/* Current Waypoint & Telemetry View */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current GPS Coordinate</span>
              <span className="text-xs font-mono font-bold text-[#E83E83]">
                {currentWaypoint.lat.toFixed(4)}, {currentWaypoint.lng.toFixed(4)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E83E83] shrink-0" />
              <div className="text-sm font-black text-[#171318]">
                {currentWaypoint.name} <span className="text-xs font-normal text-gray-500">(KM {currentWaypoint.km})</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-center">
                <span className="text-[10px] text-gray-400 block font-bold">Speed</span>
                <span className="text-sm font-black font-mono text-emerald-600">{speedKmh} km/h</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-center">
                <span className="text-[10px] text-gray-400 block font-bold">Battery</span>
                <span className="text-sm font-black font-mono text-gray-800">{batteryLevel}%</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-gray-200 text-center">
                <span className="text-[10px] text-gray-400 block font-bold">Heading</span>
                <span className="text-sm font-black font-mono text-gray-800">250° WSW</span>
              </div>
            </div>
          </div>

          {/* OFFLINE CELL DROP SIMULATION TOGGLE */}
          <div className={`p-4 rounded-2xl border transition ${
            isOfflineBuffering
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isOfflineBuffering ? (
                  <WifiOff className="w-5 h-5 text-amber-600" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-600" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {isOfflineBuffering ? 'Cellular Dead Zone Active (Buffering)' : 'Cellular Reception Active'}
                  </h4>
                  <p className="text-[11px] opacity-80">
                    {isOfflineBuffering
                      ? 'No internet connection. Pings are stored in device memory.'
                      : 'Real-time pings stream instantly to shipper map.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isOfflineBuffering) {
                    flushBufferedPings();
                  } else {
                    setIsOfflineBuffering(true);
                    showToast('Cell reception lost: entering offline buffer mode.', 'info');
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  isOfflineBuffering
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                }`}
              >
                {isOfflineBuffering ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Reconnect & Flush ({bufferedPings.length})</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Drop Signal</span>
                  </>
                )}
              </button>
            </div>

            {bufferedPings.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                <span>Buffered in local device queue:</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 font-mono">
                  {bufferedPings.length} Pings Queued
                </span>
              </div>
            )}
          </div>

          {/* SIMULATION ACTION BUTTONS */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStepForward}
                disabled={isSending}
                className="flex-1 py-3 px-4 bg-gray-900 hover:bg-black text-white rounded-xl font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Navigation className="w-4 h-4 text-[#E83E83]" />
                <span>Advance Next Waypoint (+1)</span>
              </button>

              <button
                type="button"
                onClick={toggleHighwayStream}
                className={`px-4 py-3 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer ${
                  isSimulatingHighway
                    ? 'bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200'
                    : 'bg-[#FFF0F6] text-[#E83E83] border border-[#F4A7C5] hover:bg-[#FFE3EE]'
                }`}
              >
                {isSimulatingHighway ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Auto</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Auto Drive (4s)</span>
                  </>
                )}
              </button>
            </div>

            {/* GEO-FENCE ZONE CROSSING SIMULATOR */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-500">
                <span>Test Geo-Fence Zone Transitions</span>
                <span className="font-mono text-[#E83E83]">{tripGeo.pickup.city} ↔ {tripGeo.drop.city}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => triggerGeofenceBoundaryTest('pickup', 'enter')}
                  className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                >
                  Enter Pickup
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => triggerGeofenceBoundaryTest('pickup', 'exit')}
                  className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                >
                  Exit Pickup
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => triggerGeofenceBoundaryTest('delivery', 'enter')}
                  className="py-2 px-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62c72] text-white font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                >
                  Enter Delivery
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => triggerGeofenceBoundaryTest('delivery', 'exit')}
                  className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                >
                  Exit Delivery
                </button>
              </div>
            </div>
          </div>

          {/* TELEMETRY CONSOLE & SERVER LOG */}
          <div className="p-3 bg-[#171318] rounded-2xl text-white font-mono text-[11px] space-y-1.5 border border-gray-800">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="font-bold text-[#E83E83]">Telemetry Pipeline Log</span>
              <span>Last Sync: {lastSentTime || 'None'}</span>
            </div>
            <div className="text-gray-300 leading-relaxed break-words bg-black/40 p-2 rounded-lg">
              {serverLog}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
