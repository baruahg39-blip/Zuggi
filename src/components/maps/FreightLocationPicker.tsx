import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  CheckCircle2,
  Clock,
  ArrowRight,
  Building,
  Phone,
  User as UserIcon,
  LocateFixed,
  Loader2,
  Route as RouteIcon,
  X
} from 'lucide-react';
import { showToast } from '../shared/Toast';
import { LiveTelemetryFallbackMap } from './LiveTelemetryFallbackMap';
import {
  GUWAHATI_DEFAULT_CENTER,
  OsmPlaceResult,
  fetchOsrmRoute,
  reverseGeocodeNominatim,
  searchPlacesPhoton
} from '../../services/osmMapService';

export interface LocationDetail {
  lat: number;
  lng: number;
  formatted_address: string;
  city: string;
  state?: string;
  pincode: string;
  landmark: string;
  contactName?: string;
  contactPhone?: string;
}

export interface RouteMeta {
  distance_km: number;
  duration_mins: number;
  polyline: string;
  route_coordinates?: Array<[number, number]>;
  source?: 'osrm' | 'haversine_fallback';
}

export interface FreightLocationPayload {
  pickup: LocationDetail;
  drop: LocationDetail;
  route_meta: RouteMeta;
}

interface FreightLocationPickerProps {
  initialPickup?: Partial<LocationDetail>;
  initialDrop?: Partial<LocationDetail>;
  onLocationSelected: (payload: FreightLocationPayload) => void;
  onLocationsChange?: (payload: FreightLocationPayload) => void;
  onCancel?: () => void;
  compact?: boolean;
}

const NE_QUICK_HUBS: Array<{ city: string; state: string; pincode: string; lat: number; lng: number; address: string }> = [
  { city: 'Guwahati', state: 'Assam', pincode: '781028', lat: 26.1445, lng: 91.7362, address: 'GS Road / Beltola Transport Hub, Guwahati, Assam' },
  { city: 'Jorhat', state: 'Assam', pincode: '785001', lat: 26.7509, lng: 94.2037, address: 'Gar-Ali Commercial Freight Hub, Jorhat, Assam' },
  { city: 'Dibrugarh', state: 'Assam', pincode: '786001', lat: 27.4728, lng: 94.9120, address: 'Chowkidingee Transport Hub, Dibrugarh, Assam' },
  { city: 'Silchar', state: 'Assam', pincode: '788001', lat: 24.8333, lng: 92.7789, address: 'Tarapur Goods Corridor, Silchar, Assam' },
  { city: 'Tezpur', state: 'Assam', pincode: '784001', lat: 26.6528, lng: 92.7926, address: 'Mission Chariali Truck Terminal, Tezpur, Assam' },
  { city: 'Shillong', state: 'Meghalaya', pincode: '793001', lat: 25.5788, lng: 91.8933, address: 'Mawblei Commercial Yard, Shillong, Meghalaya' },
  { city: 'Dimapur', state: 'Nagaland', pincode: '797112', lat: 25.9095, lng: 93.7265, address: 'Purana Bazar Logistics Depot, Dimapur, Nagaland' },
  { city: 'Tinsukia', state: 'Assam', pincode: '786125', lat: 27.4922, lng: 95.3468, address: 'Bordoloi Nagar Industrial Yard, Tinsukia, Assam' }
];

function formatMinutesReadable(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '--';
  const hrs = Math.floor(mins / 60);
  const rem = Math.round(mins % 60);
  if (hrs > 0) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  return `${rem} mins`;
}

export const FreightLocationPicker: React.FC<FreightLocationPickerProps> = ({
  initialPickup,
  initialDrop,
  onLocationSelected,
  onLocationsChange,
  compact = false
}) => {
  const [activeStep, setActiveStep] = useState<'pickup' | 'drop' | 'preview'>('pickup');

  const [pickup, setPickup] = useState<LocationDetail>({
    lat: initialPickup?.lat ?? GUWAHATI_DEFAULT_CENTER.lat,
    lng: initialPickup?.lng ?? GUWAHATI_DEFAULT_CENTER.lng,
    formatted_address: initialPickup?.formatted_address || 'Guwahati, Assam, India',
    city: initialPickup?.city || 'Guwahati',
    state: initialPickup?.state || 'Assam',
    pincode: initialPickup?.pincode || '781001',
    landmark: initialPickup?.landmark || '',
    contactName: initialPickup?.contactName || '',
    contactPhone: initialPickup?.contactPhone || ''
  });

  const [drop, setDrop] = useState<LocationDetail>({
    lat: initialDrop?.lat ?? 26.7509,
    lng: initialDrop?.lng ?? 94.2037,
    formatted_address: initialDrop?.formatted_address || 'Jorhat, Assam, India',
    city: initialDrop?.city || 'Jorhat',
    state: initialDrop?.state || 'Assam',
    pincode: initialDrop?.pincode || '785001',
    landmark: initialDrop?.landmark || '',
    contactName: initialDrop?.contactName || '',
    contactPhone: initialDrop?.contactPhone || ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<OsmPlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isRouting, setIsRouting] = useState(false);

  const [routeMeta, setRouteMeta] = useState<RouteMeta>({
    distance_km: 0,
    duration_mins: 0,
    polyline: '',
    route_coordinates: [],
    source: 'osrm'
  });

  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | null>(null);
  const [fitBoundsSeq, setFitBoundsSeq] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const onLocationsChangeRef = useRef(onLocationsChange);
  onLocationsChangeRef.current = onLocationsChange;

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Debounced Photon autocomplete biased to Guwahati, Assam (26.1445, 91.7362)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlacesPhoton(q, {
          lat: GUWAHATI_DEFAULT_CENTER.lat,
          lon: GUWAHATI_DEFAULT_CENTER.lng,
          limit: 6,
          signal: controller.signal
        });
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        // Silent abort
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Compute real OSRM driving route polyline, road distance (km), and ETA whenever Pickup or Drop coordinates change
  useEffect(() => {
    const controller = new AbortController();
    setIsRouting(true);

    fetchOsrmRoute(
      { lat: pickup.lat, lng: pickup.lng },
      { lat: drop.lat, lng: drop.lng },
      controller.signal
    )
      .then((res) => {
        if (controller.signal.aborted) return;
        setRouteMeta({
          distance_km: res.distanceKm,
          duration_mins: res.durationMins,
          polyline: '',
          route_coordinates: res.coordinates,
          source: res.source
        });
      })
      .catch(() => {
        // Ignore abort
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRouting(false);
      });

    return () => controller.abort();
  }, [pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // Continuously sync current pickup, drop, and OSRM route metrics back to parent form (CreateLoadModal)
  useEffect(() => {
    if (!onLocationsChangeRef.current) return;
    if (routeMeta.distance_km <= 0) return;
    onLocationsChangeRef.current({
      pickup,
      drop,
      route_meta: routeMeta
    });
  }, [pickup, drop, routeMeta]);

  // Reverse geocode coordinates via Nominatim when a user clicks the map or drags a pin
  const resolvePinCoordinates = useCallback(
    async (target: 'pickup' | 'drop', lat: number, lng: number, shouldFly = false) => {
      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
      }
      const controller = new AbortController();
      geocodeAbortRef.current = controller;

      // Immediately move pin visually for instant feedback
      const setter = target === 'pickup' ? setPickup : setDrop;
      setter((prev) => ({
        ...prev,
        lat,
        lng
      }));

      if (shouldFly) {
        setFlyToTarget({ lat, lng, zoom: 14, seq: Date.now() });
      }

      setIsGeocoding(true);
      try {
        const rev = await reverseGeocodeNominatim(lat, lng, controller.signal);
        if (controller.signal.aborted) return;
        setter((prev) => ({
          ...prev,
          lat,
          lng,
          formatted_address: rev.formatted_address,
          city: rev.city || prev.city,
          state: rev.state || prev.state || 'Assam',
          pincode: rev.pincode || ''
        }));
      } catch {
        // Ignore abort
      } finally {
        if (!controller.signal.aborted) setIsGeocoding(false);
      }
    },
    []
  );

  // Clicking anywhere on the map moves the active pin (Green = Pickup, Red = Drop-off)
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const target: 'pickup' | 'drop' = activeStep === 'drop' ? 'drop' : 'pickup';
      void resolvePinCoordinates(target, lat, lng, false);
    },
    [activeStep, resolvePinCoordinates]
  );

  // Dragging green Pickup marker directly on the Leaflet map
  const handlePickupDragEnd = useCallback(
    (lat: number, lng: number) => {
      void resolvePinCoordinates('pickup', lat, lng, false);
    },
    [resolvePinCoordinates]
  );

  // Dragging red Drop-off marker directly on the Leaflet map
  const handleDropDragEnd = useCallback(
    (lat: number, lng: number) => {
      void resolvePinCoordinates('drop', lat, lng, false);
    },
    [resolvePinCoordinates]
  );

  // Selecting an address from Photon autocomplete dropdown
  const handleSelectSuggestion = (place: OsmPlaceResult) => {
    const target: 'pickup' | 'drop' = activeStep === 'drop' ? 'drop' : 'pickup';
    const setter = target === 'pickup' ? setPickup : setDrop;

    setter((prev) => ({
      ...prev,
      lat: place.lat,
      lng: place.lng,
      formatted_address: place.address || place.label,
      city: place.city || place.label,
      state: place.state || 'Assam',
      pincode: place.pincode || ''
    }));

    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setFlyToTarget({ lat: place.lat, lng: place.lng, zoom: 14, seq: Date.now() });
  };

  // Detect current device GPS and pin it
  const handleUseMyGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('GPS location is not available on this device.', 'error');
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const target: 'pickup' | 'drop' = activeStep === 'drop' ? 'drop' : 'pickup';
        await resolvePinCoordinates(target, pos.coords.latitude, pos.coords.longitude, true);
        setIsLocatingGps(false);
        showToast(`${target === 'pickup' ? 'Pickup' : 'Drop-off'} pinned to your live GPS location.`, 'success');
      },
      () => {
        setIsLocatingGps(false);
        showToast('Could not detect GPS location. You can click or drag the pin on the map.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleQuickHubPick = (hub: (typeof NE_QUICK_HUBS)[number]) => {
    const target: 'pickup' | 'drop' = activeStep === 'drop' ? 'drop' : 'pickup';
    const setter = target === 'pickup' ? setPickup : setDrop;
    setter((prev) => ({
      ...prev,
      lat: hub.lat,
      lng: hub.lng,
      formatted_address: hub.address,
      city: hub.city,
      state: hub.state,
      pincode: hub.pincode
    }));
    setFlyToTarget({ lat: hub.lat, lng: hub.lng, zoom: 13, seq: Date.now() });
  };

  const handleConfirmAndApply = () => {
    if (!pickup.city.trim() || !drop.city.trim()) {
      showToast('Please select both Pickup and Drop-off locations on the map.', 'error');
      return;
    }
    onLocationSelected({
      pickup,
      drop,
      route_meta: routeMeta
    });
  };

  const activeDetail = activeStep === 'drop' ? drop : pickup;
  const setActiveDetail = activeStep === 'drop' ? setDrop : setPickup;

  return (
    <div className="space-y-3.5 text-slate-100">
      {/* Step Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setActiveStep('pickup');
            setFlyToTarget({ lat: pickup.lat, lng: pickup.lng, zoom: 13, seq: Date.now() });
          }}
          className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeStep === 'pickup'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 border border-white shrink-0" />
          <span className="truncate">1. Pickup ({pickup.city || 'Pin'})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveStep('drop');
            setFlyToTarget({ lat: drop.lat, lng: drop.lng, zoom: 13, seq: Date.now() });
          }}
          className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeStep === 'drop'
              ? 'bg-rose-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300 border border-white shrink-0" />
          <span className="truncate">2. Drop ({drop.city || 'Pin'})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveStep('preview');
            setFitBoundsSeq((s) => s + 1);
          }}
          className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeStep === 'preview'
              ? 'bg-[#E83E83] text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <RouteIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">3. Route ({routeMeta.distance_km || '...'} km)</span>
        </button>
      </div>

      {/* Photon Address Search Bar (biased to Guwahati, Assam) + GPS Button */}
      {activeStep !== 'preview' && (
        <div ref={searchContainerRef} className="relative space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeStep === 'pickup'
                    ? 'Search Pickup address, industrial yard, town or pincode (e.g. Beltola Guwahati)...'
                    : 'Search Drop-off city, warehouse, landmark or pincode (e.g. Dibrugarh, Shillong)...'
                }
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#E83E83]"
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-[#E83E83] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleUseMyGps}
              disabled={isLocatingGps}
              className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shrink-0 cursor-pointer transition disabled:opacity-60"
              title="Use my current GPS location"
            >
              {isLocatingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">My GPS</span>
            </button>
          </div>

          {/* Photon Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-[500] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-800">
              {suggestions.map((place, idx) => (
                <button
                  key={`${place.lat}_${place.lng}_${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(place)}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-slate-800 transition flex items-start gap-2.5 cursor-pointer"
                >
                  <MapPin
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      activeStep === 'pickup' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{place.label}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{place.address}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Quick Assam & Northeast Hub Shortcuts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] text-slate-500 font-semibold shrink-0">Quick Hubs:</span>
            {NE_QUICK_HUBS.map((hub) => (
              <button
                key={hub.city}
                type="button"
                onClick={() => handleQuickHubPick(hub)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[10px] font-bold text-slate-200 shrink-0 cursor-pointer transition"
              >
                {hub.city}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Leaflet OpenStreetMap Canvas with Draggable Green/Red Pins & Live OSRM Highway Polyline */}
      <div className={`relative w-full ${compact ? 'h-[260px]' : 'h-[320px] sm:h-[360px]'} rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-[#E8EEF4]`}>
        <LiveTelemetryFallbackMap
          pickup={pickup}
          drop={drop}
          currentLocation={null}
          pickerMode={activeStep}
          draggablePins={true}
          routeCoordinates={routeMeta.route_coordinates}
          onMapClick={handleMapClick}
          onPickupDragEnd={handlePickupDragEnd}
          onDropDragEnd={handleDropDragEnd}
          flyToTarget={flyToTarget}
          fitBoundsSeq={fitBoundsSeq}
        />

        {/* Top Instruction Pill */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 right-12 z-[420] flex flex-wrap items-center gap-2">
          <div className="bg-slate-950/90 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-700/90 shadow-lg flex items-center gap-2">
            {isGeocoding || isRouting ? (
              <Loader2 className="w-3.5 h-3.5 text-[#E83E83] animate-spin shrink-0" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span>
              {activeStep === 'pickup'
                ? 'Click map or drag the Green pin (A) to set exact Pickup'
                : activeStep === 'drop'
                ? 'Click map or drag the Red pin (B) to set exact Drop-off'
                : 'Drag either Green (A) or Red (B) pin to fine-tune highway route'}
            </span>
          </div>
        </div>

        {/* Bottom Floating OSRM Route Distance & Duration Badge */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[420]">
          <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/90 shadow-lg flex items-center gap-3 text-[11px] text-white">
            <span className="flex items-center gap-1 font-mono font-black text-amber-400">
              <RouteIcon className="w-3.5 h-3.5" />
              {routeMeta.distance_km > 0 ? `${routeMeta.distance_km} km` : 'Calculating...'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1 font-mono font-bold text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              {formatMinutesReadable(routeMeta.duration_mins)}
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-400">
              {routeMeta.source === 'osrm' ? 'OSRM Road Route' : 'Est. Road Distance'}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Location Editable Details (Pickup or Drop) */}
      {activeStep !== 'preview' ? (
        <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeStep === 'pickup' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span className={activeStep === 'pickup' ? 'text-emerald-400' : 'text-rose-400'}>
                {activeStep === 'pickup' ? 'Pinned Pickup Address' : 'Pinned Drop-off Address'}
              </span>
              {isGeocoding && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Resolving address...
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {activeDetail.lat.toFixed(4)}°N, {activeDetail.lng.toFixed(4)}°E
            </span>
          </div>

          <input
            type="text"
            value={activeDetail.formatted_address}
            onChange={(e) =>
              setActiveDetail((prev) => ({ ...prev, formatted_address: e.target.value }))
            }
            placeholder="Full street address, warehouse, or transport yard..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E83E83]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={activeDetail.city}
              onChange={(e) => setActiveDetail((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="City / Town *"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E83E83]"
            />
            <input
              type="text"
              value={activeDetail.landmark}
              onChange={(e) => setActiveDetail((prev) => ({ ...prev, landmark: e.target.value }))}
              placeholder="Landmark / Gate No."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E83E83]"
            />
            <input
              type="text"
              value={activeDetail.pincode}
              onChange={(e) =>
                setActiveDetail((prev) => ({
                  ...prev,
                  pincode: e.target.value.replace(/\D/g, '').slice(0, 6)
                }))
              }
              placeholder="Pincode"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#E83E83]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={activeDetail.contactName || ''}
                onChange={(e) =>
                  setActiveDetail((prev) => ({ ...prev, contactName: e.target.value }))
                }
                placeholder={activeStep === 'pickup' ? 'Pickup Contact Name' : 'Consignee Name'}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#E83E83]"
              />
            </div>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={activeDetail.contactPhone || ''}
                onChange={(e) =>
                  setActiveDetail((prev) => ({ ...prev, contactPhone: e.target.value }))
                }
                placeholder={activeStep === 'pickup' ? 'Pickup Phone' : 'Consignee Phone'}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#E83E83]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {activeStep === 'pickup' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveStep('drop');
                  setFlyToTarget({ lat: drop.lat, lng: drop.lng, zoom: 13, seq: Date.now() });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Confirm Pickup &amp; Pick Drop-off</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveStep('preview');
                  setFitBoundsSeq((s) => s + 1);
                }}
                className="px-4 py-2 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Preview Highway Route</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Step 3: Route Summary & Apply Bar */
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-emerald-500/30">
              <div className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                <Building className="w-3 h-3" /> Pickup (Pin A)
              </div>
              <div className="font-bold text-white mt-0.5">{pickup.city}</div>
              <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{pickup.formatted_address}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-rose-500/30">
              <div className="text-[10px] font-bold uppercase text-rose-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Drop-off (Pin B)
              </div>
              <div className="font-bold text-white mt-0.5">{drop.city}</div>
              <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{drop.formatted_address}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Road Distance</span>
                <span className="text-amber-400 font-mono font-black text-sm">
                  {routeMeta.distance_km} km
                </span>
              </div>
              <div className="border-l border-slate-700 pl-3">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Est. Drive Time</span>
                <span className="text-emerald-400 font-mono font-black text-sm">
                  {formatMinutesReadable(routeMeta.duration_mins)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmAndApply}
              className="px-4 py-2.5 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Route &amp; Continue</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
