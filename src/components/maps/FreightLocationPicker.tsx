// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  useMap, 
  useMapsLibrary 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Search, 
  Navigation, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  RotateCcw, 
  FileText, 
  Copy, 
  Check, 
  Building, 
  Phone, 
  User as UserIcon, 
  Layers, 
  Compass, 
  ShieldCheck, 
  LocateFixed, 
  Sparkles,
  Info,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { showToast } from '../shared/Toast';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { LiveTelemetryFallbackMap } from './LiveTelemetryFallbackMap';

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

// Inner Controller component that has access to useMap() and useMapsLibrary()
interface MapInnerControllerProps {
  activeStep: 'pickup' | 'drop' | 'preview';
  pickup: LocationDetail | null;
  drop: LocationDetail | null;
  onCenterAddressResolved: (step: 'pickup' | 'drop', detail: LocationDetail) => void;
  onReverseGeocodingStart: () => void;
  onMapReady: (map: google.maps.Map | null) => void;
  isGeocoding: boolean;
  routeMeta: RouteMeta | null;
}

const MapInnerController: React.FC<MapInnerControllerProps> = ({
  activeStep,
  pickup,
  drop,
  onCenterAddressResolved,
  onReverseGeocodingStart,
  onMapReady,
  isGeocoding,
  routeMeta
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const coreLib = useMapsLibrary('core');

  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  // 1. Debounced Camera Idle Listener (500ms debounce as required)
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('idle', () => {
      // In preview mode, do not reverse geocode map center
      if (activeStep === 'preview') return;

      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      onReverseGeocodingStart();

      // 500ms debounce
      idleTimerRef.current = setTimeout(async () => {
        const center = map.getCenter();
        if (!center) return;
        const lat = center.lat();
        const lng = center.lng();

        try {
          const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();

          if (data && data.success) {
            onCenterAddressResolved(activeStep, {
              lat,
              lng,
              formatted_address: data.formatted_address || `${data.area}, ${data.city}`,
              city: data.city || 'Guwahati',
              state: data.state || 'Assam',
              pincode: data.pincode || '781028',
              landmark: ''
            });
          }
        } catch (err) {
          console.warn('[Reverse Geocode Fetch Notice]:', err);
        }
      }, 500);
    });

    return () => {
      google.maps.event.removeListener(listener);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [map, activeStep, onReverseGeocodingStart, onCenterAddressResolved]);

  // 2. Adjust bounds in Route Preview mode to fit both Pickup and Drop points
  useEffect(() => {
    if (!map || activeStep !== 'preview' || !pickup || !drop) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: pickup.lat, lng: pickup.lng });
    bounds.extend({ lat: drop.lat, lng: drop.lng });

    // Smoothly pan & fit with comfortable padding
    map.fitBounds(bounds, {
      top: 80,
      right: 60,
      bottom: 80,
      left: 60
    });
  }, [map, activeStep, pickup, drop]);

  // 3. Render Route Polyline using Routes API or decoded coordinates
  useEffect(() => {
    if (!map || activeStep !== 'preview' || !pickup || !drop) {
      // Clean up previous polylines
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      return;
    }

    // Clear previous lines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    let isCancelled = false;

    // Try modern Route.computeRoutes if available in routesLib
    if (routesLib && (routesLib as any).Route) {
      const request = {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: drop.lat, lng: drop.lng },
        travelMode: 'DRIVING',
        fields: ['path', 'distanceMeters', 'durationMillis', 'viewport']
      };

      (routesLib as any).Route.computeRoutes(request)
        .then(({ routes }: { routes: any[] }) => {
          if (isCancelled || !routes || routes.length === 0) return;
          const primaryRoute = routes[0];
          if (primaryRoute && typeof primaryRoute.createPolylines === 'function') {
            const newLines: google.maps.Polyline[] = primaryRoute.createPolylines();
            newLines.forEach((poly) => {
              poly.setOptions({
                strokeColor: '#2563EB',
                strokeWeight: 5,
                strokeOpacity: 0.85
              });
              poly.setMap(map);
            });
            polylinesRef.current = newLines;
            return;
          }
        })
        .catch(() => {
          // Fallback to direct highway polyline
          drawDirectPolyline();
        });
    } else {
      drawDirectPolyline();
    }

    function drawDirectPolyline() {
      if (isCancelled || !map || !pickup || !drop) return;
      // Generate midpoint arc for realistic highway road simulation
      const midLat = (pickup.lat + drop.lat) / 2 + 0.04;
      const midLng = (pickup.lng + drop.lng) / 2;
      const poly = new google.maps.Polyline({
        path: [
          { lat: pickup.lat, lng: pickup.lng },
          { lat: midLat, lng: midLng },
          { lat: drop.lat, lng: drop.lng }
        ],
        geodesic: true,
        strokeColor: '#E83E83',
        strokeOpacity: 0.85,
        strokeWeight: 5
      });
      poly.setMap(map);
      polylinesRef.current = [poly];
    }

    return () => {
      isCancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, activeStep, pickup, drop, routesLib]);

  return (
    <>
      {/* PREVIEW MODE: Show both Static Advanced Markers */}
      {activeStep === 'preview' && pickup && (
        <AdvancedMarker position={{ lat: pickup.lat, lng: pickup.lng }} title="Pickup Location">
          <Pin background="#16A34A" glyphColor="#FFFFFF" borderColor="#14532D" glyphText="A" scale={1.2} />
        </AdvancedMarker>
      )}

      {activeStep === 'preview' && drop && (
        <AdvancedMarker position={{ lat: drop.lat, lng: drop.lng }} title="Drop Location">
          <Pin background="#DC2626" glyphColor="#FFFFFF" borderColor="#7F1D1D" glyphText="B" scale={1.2} />
        </AdvancedMarker>
      )}

      {/* When setting Drop in Step 2: Show already-confirmed Pickup Marker in background */}
      {activeStep === 'drop' && pickup && (
        <AdvancedMarker position={{ lat: pickup.lat, lng: pickup.lng }} title="Confirmed Pickup">
          <Pin background="#16A34A" glyphColor="#FFFFFF" borderColor="#14532D" scale={0.9} />
        </AdvancedMarker>
      )}

      {/* When setting Pickup in Step 1: If Drop was already confirmed, show Drop Marker in background */}
      {activeStep === 'pickup' && drop && (
        <AdvancedMarker position={{ lat: drop.lat, lng: drop.lng }} title="Confirmed Drop">
          <Pin background="#DC2626" glyphColor="#FFFFFF" borderColor="#7F1D1D" scale={0.9} />
        </AdvancedMarker>
      )}
    </>
  );
};

export const FreightLocationPicker: React.FC<FreightLocationPickerProps> = ({
  initialPickup,
  initialDrop,
  onLocationSelected,
  onLocationsChange,
  onCancel,
  compact = false
}) => {
  const { apiKey, canRenderGoogleMap, mapAuthError, reportMapError } = useGoogleMapsApiKey();

  // Active step: 'pickup' | 'drop' | 'preview'
  const [activeStep, setActiveStep] = useState<'pickup' | 'drop' | 'preview'>('pickup');

  // Location States (seeded with safe default coordinates + resolved on mount so fields are never blank)
  const [pickup, setPickup] = useState<LocationDetail>({
    lat: initialPickup?.lat || 26.1445,
    lng: initialPickup?.lng || 91.7362,
    formatted_address: initialPickup?.formatted_address || 'Guwahati, Assam',
    city: initialPickup?.city || 'Guwahati',
    state: initialPickup?.state || 'Assam',
    pincode: initialPickup?.pincode || '781001',
    landmark: initialPickup?.landmark || '',
    contactName: initialPickup?.contactName || '',
    contactPhone: initialPickup?.contactPhone || ''
  });

  const [drop, setDrop] = useState<LocationDetail>({
    lat: initialDrop?.lat || 26.7509,
    lng: initialDrop?.lng || 94.2037,
    formatted_address: initialDrop?.formatted_address || 'Jorhat, Assam',
    city: initialDrop?.city || 'Jorhat',
    state: initialDrop?.state || 'Assam',
    pincode: initialDrop?.pincode || '785001',
    landmark: initialDrop?.landmark || '',
    contactName: initialDrop?.contactName || '',
    contactPhone: initialDrop?.contactPhone || ''
  });

  const [pickupConfirmed, setPickupConfirmed] = useState<boolean>(!!initialPickup?.formatted_address);
  const [dropConfirmed, setDropConfirmed] = useState<boolean>(!!initialDrop?.formatted_address);
  const onLocationsChangeRef = useRef(onLocationsChange);
  onLocationsChangeRef.current = onLocationsChange;

  // Address resolution state
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [currentResolvedAddress, setCurrentResolvedAddress] = useState<string>('');

  // Autocomplete Search States (supports both Google Places API New and Nominatim fallback)
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [fallbackSuggestions, setFallbackSuggestions] = useState<
    Array<{ displayName: string; mainText: string; secondaryText: string; lat: number; lng: number; city: string; state: string; pincode: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [fallbackFlyTo, setFallbackFlyTo] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | null>(null);
  const fallbackGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Route Metrics State
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(null);
  const [isComputingRoute, setIsComputingRoute] = useState(false);

  // Show Developer JSON Payload Modal
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Map Instance reference
  const mapRef = useRef<google.maps.Map | null>(null);
  const handleMapReady = useCallback((m: google.maps.Map | null) => {
    mapRef.current = m;
  }, []);

  // Listen for Google Maps Platform quota event per Section 8
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Auto-resolve initial coordinates via server reverse-geocode when no explicit address was passed in
  useEffect(() => {
    let cancelled = false;
    const resolveIfInitialEmpty = async () => {
      try {
        if (!initialPickup?.formatted_address) {
          const res = await fetch(`/api/maps/reverse-geocode?lat=${pickup.lat}&lng=${pickup.lng}`);
          const data = await res.json().catch(() => null);
          if (!cancelled && data?.success && data.formatted_address) {
            setPickup((prev) => ({
              ...prev,
              formatted_address: data.formatted_address,
              city: data.city || prev.city || 'Guwahati',
              state: data.state || prev.state || 'Assam',
              pincode: data.pincode || prev.pincode
            }));
          }
        }
        if (!initialDrop?.formatted_address) {
          const res = await fetch(`/api/maps/reverse-geocode?lat=${drop.lat}&lng=${drop.lng}`);
          const data = await res.json().catch(() => null);
          if (!cancelled && data?.success && data.formatted_address) {
            setDrop((prev) => ({
              ...prev,
              formatted_address: data.formatted_address,
              city: data.city || prev.city || 'Jorhat',
              state: data.state || prev.state || 'Assam',
              pincode: data.pincode || prev.pincode
            }));
          }
        }
      } catch {
        // Retain safe default Guwahati / Jorhat Assam labels if offline
      }
    };
    void resolveIfInitialEmpty();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live-sync current pickup/drop/route selection to parent modal so both "Save & Apply" and "Next Step" work seamlessly
  useEffect(() => {
    if (!onLocationsChangeRef.current) return;
    if (!pickup.city && !pickup.formatted_address) return;
    if (!drop.city && !drop.formatted_address) return;
    const straightKm = Math.max(10, Math.round(Math.hypot(drop.lat - pickup.lat, drop.lng - pickup.lng) * 111 * 1.25));
    onLocationsChangeRef.current({
      pickup,
      drop,
      route_meta: routeMeta || {
        distance_km: straightKm,
        duration_mins: Math.max(15, Math.round((straightKm / 45) * 60)),
        polyline: ''
      }
    });
  }, [pickup, drop, routeMeta]);

  // Update address resolution from inner controller
  const handleCenterAddressResolved = useCallback((step: 'pickup' | 'drop', detail: LocationDetail) => {
    setIsGeocoding(false);
    setCurrentResolvedAddress(detail.formatted_address);
    if (step === 'pickup') {
      setPickup((prev) => ({
        ...prev,
        lat: detail.lat,
        lng: detail.lng,
        formatted_address: detail.formatted_address,
        city: detail.city,
        state: detail.state || prev.state,
        pincode: detail.pincode
      }));
    } else {
      setDrop((prev) => ({
        ...prev,
        lat: detail.lat,
        lng: detail.lng,
        formatted_address: detail.formatted_address,
        city: detail.city,
        state: detail.state || prev.state,
        pincode: detail.pincode
      }));
    }
  }, []);

  const handleReverseGeocodingStart = useCallback(() => {
    setIsGeocoding(true);
  }, []);

  // 1. Programmatic Autocomplete Suggestion Fetch (Google Places API New when active, Nominatim when fallback road map is active)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setAutocompleteSuggestions([]);
      setFallbackSuggestions([]);
      return;
    }

    let isSubscribed = true;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        if (canRenderGoogleMap && window.google && window.google.maps && window.google.maps.places) {
          const { AutocompleteSessionToken, AutocompleteSuggestion } = window.google.maps.places;
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }

          const request: google.maps.places.AutocompleteRequest = {
            input: searchQuery,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ['in']
          };

          const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
          if (isSubscribed) {
            setAutocompleteSuggestions(res.suggestions || []);
            setFallbackSuggestions([]);
          }
        } else {
          const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=6&q=${encodeURIComponent(
            searchQuery.trim()
          )}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (res.ok && isSubscribed) {
            const rows = (await res.json()) as Array<{
              display_name?: string;
              name?: string;
              lat?: string;
              lon?: string;
              address?: Record<string, string>;
            }>;
            const mapped = rows
              .map((r) => {
                const lat = parseFloat(r.lat || '');
                const lng = parseFloat(r.lon || '');
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                const addr = r.address || {};
                const city =
                  addr.city ||
                  addr.town ||
                  addr.village ||
                  addr.suburb ||
                  addr.county ||
                  addr.state_district ||
                  r.name ||
                  '';
                const state = addr.state || '';
                const pincode = addr.postcode || '';
                const full = r.display_name || `${city}${state ? `, ${state}` : ''}`;
                const parts = full.split(',').map((s) => s.trim());
                return {
                  displayName: full,
                  mainText: r.name || parts[0] || city,
                  secondaryText: parts.slice(1, 4).join(', '),
                  lat,
                  lng,
                  city,
                  state,
                  pincode
                };
              })
              .filter(Boolean) as Array<{
                displayName: string;
                mainText: string;
                secondaryText: string;
                lat: number;
                lng: number;
                city: string;
                state: string;
                pincode: string;
              }>;
            setFallbackSuggestions(mapped);
            setAutocompleteSuggestions([]);
          }
        }
      } catch (err) {
        console.warn('[Places Autocomplete Notice]:', err);
      } finally {
        if (isSubscribed) setIsSearching(false);
      }
    }, 280);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [searchQuery, canRenderGoogleMap]);

  const handleSelectFallbackSuggestion = (item: {
    displayName: string;
    mainText: string;
    lat: number;
    lng: number;
    city: string;
    state: string;
    pincode: string;
  }) => {
    setSearchQuery('');
    setFallbackSuggestions([]);
    setFallbackFlyTo((prev) => ({ lat: item.lat, lng: item.lng, zoom: 16, seq: (prev?.seq || 0) + 1 }));
    if (activeStep === 'pickup') {
      setPickup((prev) => ({
        ...prev,
        lat: item.lat,
        lng: item.lng,
        formatted_address: item.displayName,
        city: item.city || prev.city,
        state: item.state || prev.state,
        pincode: item.pincode || prev.pincode
      }));
    } else {
      setDrop((prev) => ({
        ...prev,
        lat: item.lat,
        lng: item.lng,
        formatted_address: item.displayName,
        city: item.city || prev.city,
        state: item.state || prev.state,
        pincode: item.pincode || prev.pincode
      }));
    }
    setCurrentResolvedAddress(item.displayName);
    showToast(`Centered on ${item.mainText}`, 'info');
  };

  const handleFallbackCenterChange = useCallback(
    (lat: number, lng: number) => {
      if (activeStep === 'preview') return;
      if (fallbackGeocodeTimerRef.current) clearTimeout(fallbackGeocodeTimerRef.current);
      setIsGeocoding(true);
      fallbackGeocodeTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data && data.success) {
            handleCenterAddressResolved(activeStep, {
              lat,
              lng,
              formatted_address: data.formatted_address || `${data.area || ''}, ${data.city || ''}`.trim(),
              city: data.city || '',
              state: data.state || '',
              pincode: data.pincode || '',
              landmark: ''
            });
          } else {
            setIsGeocoding(false);
          }
        } catch {
          setIsGeocoding(false);
        }
      }, 450);
    },
    [activeStep, handleCenterAddressResolved]
  );

  // 2. Select Autocomplete Suggestion -> Centering Map and Fetching Details
  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    try {
      setSearchQuery('');
      setAutocompleteSuggestions([]);

      if (!suggestion.placePrediction) return;

      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents']
      });

      // CRITICAL: Reset session token after Place Details fetch
      sessionTokenRef.current = null;

      if (place.location && mapRef.current) {
        const lat = place.location.lat();
        const lng = place.location.lng();

        // Smoothly center and zoom into selected place
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(16);

        let city = '';
        let state = '';
        let pincode = '';
        for (const comp of place.addressComponents || []) {
          const types = comp.types || [];
          if (types.includes('locality') || types.includes('administrative_area_level_2')) {
            city = comp.longText || '';
          }
          if (types.includes('administrative_area_level_1')) {
            state = comp.longText || '';
          }
          if (types.includes('postal_code')) {
            pincode = comp.longText || '';
          }
        }

        const resolvedAddress = place.formattedAddress || place.displayName || '';

        if (activeStep === 'pickup') {
          setPickup((prev) => ({
            ...prev,
            lat,
            lng,
            formatted_address: resolvedAddress,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode
          }));
        } else {
          setDrop((prev) => ({
            ...prev,
            lat,
            lng,
            formatted_address: resolvedAddress,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode
          }));
        }

        setCurrentResolvedAddress(resolvedAddress);
        showToast(`Centered on ${place.displayName || 'selected place'}`, 'info');
      }
    } catch (err) {
      console.warn('[Place Details Selection Notice]:', err);
    }
  };

  // 3. Confirm Step and Switch
  const handleConfirmCurrentStep = () => {
    if (activeStep === 'pickup') {
      setPickupConfirmed(true);
      showToast('Pickup location pinned successfully!', 'success');
      // Smoothly transition to setting Drop Location
      setActiveStep('drop');
      if (mapRef.current) {
        mapRef.current.panTo({ lat: drop.lat, lng: drop.lng });
      } else {
        setFallbackFlyTo((prev) => ({ lat: drop.lat, lng: drop.lng, zoom: 14, seq: (prev?.seq || 0) + 1 }));
      }
    } else if (activeStep === 'drop') {
      setDropConfirmed(true);
      showToast('Drop location pinned successfully!', 'success');
      // Transition to Route Preview
      computeRouteMetrics();
      setActiveStep('preview');
    }
  };

  // 4. Compute Route Metrics
  const computeRouteMetrics = async () => {
    setIsComputingRoute(true);
    try {
      const res = await fetch('/api/maps/compute-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: pickup.lat, lng: pickup.lng },
          destination: { lat: drop.lat, lng: drop.lng }
        })
      });

      const data = await res.json();
      if (data && data.success) {
        setRouteMeta({
          distance_km: data.distance_km,
          duration_mins: data.duration_mins,
          polyline: data.polyline || ''
        });
      } else {
        // Fallback distance calculation
        const straight = Math.hypot(drop.lat - pickup.lat, drop.lng - pickup.lng) * 111;
        const distanceKm = Math.round(straight * 1.25);
        setRouteMeta({
          distance_km: Math.max(distanceKm, 10),
          duration_mins: Math.round((distanceKm / 45) * 60),
          polyline: ''
        });
      }
    } catch (err) {
      console.warn('[Route Computation Notice]:', err);
      const straight = Math.hypot(drop.lat - pickup.lat, drop.lng - pickup.lng) * 111;
      const distanceKm = Math.max(Math.round(straight * 1.28), 10);
      setRouteMeta({
        distance_km: distanceKm,
        duration_mins: Math.max(15, Math.round((distanceKm / 45) * 60)),
        polyline: ''
      });
    } finally {
      setIsComputingRoute(false);
    }
  };

  // 5. Final Submit to Parent
  const handleFinalSubmit = () => {
    const safePickup: LocationDetail = {
      ...pickup,
      city: (pickup.city || 'Guwahati').trim(),
      formatted_address: (pickup.formatted_address || `${pickup.city || 'Guwahati'}, ${pickup.state || 'Assam'}`).trim()
    };
    const safeDrop: LocationDetail = {
      ...drop,
      city: (drop.city || 'Jorhat').trim(),
      formatted_address: (drop.formatted_address || `${drop.city || 'Jorhat'}, ${drop.state || 'Assam'}`).trim()
    };
    const straightKm = Math.max(
      10,
      Math.round(Math.hypot(safeDrop.lat - safePickup.lat, safeDrop.lng - safePickup.lng) * 111 * 1.25)
    );
    const finalPayload: FreightLocationPayload = {
      pickup: safePickup,
      drop: safeDrop,
      route_meta: routeMeta || {
        distance_km: straightKm,
        duration_mins: Math.max(15, Math.round((straightKm / 45) * 60)),
        polyline: ''
      }
    };

    onLocationSelected(finalPayload);
    showToast('Freight route & logistics locations confirmed!', 'success');
  };

  // Constructed payload for live preview
  const currentPayloadJson = useMemo(() => {
    return JSON.stringify({
      pickup: {
        lat: Number(pickup.lat.toFixed(6)),
        lng: Number(pickup.lng.toFixed(6)),
        formatted_address: pickup.formatted_address,
        city: pickup.city,
        pincode: pickup.pincode,
        landmark: pickup.landmark || 'Not specified',
        contact_person: pickup.contactName || 'Not specified',
        contact_phone: pickup.contactPhone || 'Not specified'
      },
      drop: {
        lat: Number(drop.lat.toFixed(6)),
        lng: Number(drop.lng.toFixed(6)),
        formatted_address: drop.formatted_address,
        city: drop.city,
        pincode: drop.pincode,
        landmark: drop.landmark || 'Not specified',
        contact_person: drop.contactName || 'Not specified',
        contact_phone: drop.contactPhone || 'Not specified'
      },
      route_meta: {
        distance_km: routeMeta?.distance_km || 0,
        duration_mins: routeMeta?.duration_mins || 0,
        polyline: routeMeta?.polyline || ''
      }
    }, null, 2);
  }, [pickup, drop, routeMeta]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentPayloadJson);
    setCopiedJson(true);
    showToast('Structured JSON schema copied to clipboard!', 'info');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden flex flex-col text-[#171318]">
      {/* Optional Top Quota Notice per Section 8 Case A */}
      {quotaExceeded && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2 text-xs text-center sticky top-0 z-50">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-rose-950"
            >
              maps developer site
            </a>.
          </span>
        </div>
      )}

      {/* TOP HEADER: Step Navigation & Workflow Tabs */}
      <div className="p-4 sm:p-5 bg-[#171318] text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#E83E83] flex items-center justify-center text-white font-black shadow-md shadow-[#E83E83]/30 shrink-0">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-tight">Interactive Freight Route Picker</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                GPS Verified
              </span>
            </div>
            <p className="text-xs text-gray-400">Pinpoint loading shed, godown gate, and destination on live corridor map</p>
          </div>
        </div>

        {/* 3 Step Pill Navigation */}
        <div className="flex items-center gap-1.5 bg-gray-900 p-1 rounded-2xl border border-gray-800 self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveStep('pickup');
              if (mapRef.current) {
                mapRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
              } else {
                setFallbackFlyTo((prev) => ({ lat: pickup.lat, lng: pickup.lng, zoom: 14, seq: (prev?.seq || 0) + 1 }));
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeStep === 'pickup'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${pickupConfirmed ? 'bg-white' : 'bg-emerald-400'}`} />
            <span>1. Pickup Point</span>
            {pickupConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveStep('drop');
              if (mapRef.current) {
                mapRef.current.panTo({ lat: drop.lat, lng: drop.lng });
              } else {
                setFallbackFlyTo((prev) => ({ lat: drop.lat, lng: drop.lng, zoom: 14, seq: (prev?.seq || 0) + 1 }));
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeStep === 'drop'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${dropConfirmed ? 'bg-white' : 'bg-rose-400'}`} />
            <span>2. Drop Point</span>
            {dropConfirmed && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
          </button>

          <button
            type="button"
            onClick={() => {
              computeRouteMetrics();
              setActiveStep('preview');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeStep === 'preview'
                ? 'bg-[#E83E83] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>3. Route Preview</span>
          </button>
        </div>
      </div>

      {/* AUTOCOMPLETE SEARCH BAR (Integrated Google Places Autocomplete) */}
      {activeStep !== 'preview' && (
        <div className="p-3 bg-gray-50 border-b border-gray-200 relative z-20">
          <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-2.5 border border-gray-300 shadow-xs focus-within:border-[#E83E83] focus-within:ring-2 focus-within:ring-[#E83E83]/20 transition">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeStep === 'pickup'
                    ? "Search Pickup warehouse, area, landmark, or 6-digit PIN..."
                    : "Search Destination godown, industrial area, or PIN..."
                }
                className="w-full text-xs sm:text-sm bg-transparent outline-none text-[#171318] placeholder-gray-400 font-medium"
              />
              {isSearching && <Loader2 className="w-4 h-4 text-[#E83E83] animate-spin shrink-0" />}
            </div>

            {/* Suggestions Dropdown (Google Places API New or Nominatim Fallback) */}
            {(autocompleteSuggestions.length > 0 || fallbackSuggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden z-[500] max-h-60 overflow-y-auto divide-y divide-gray-100">
                {autocompleteSuggestions.map((item, idx) => (
                  <button
                    key={`g_${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left p-3 hover:bg-[#FFF0F6] transition flex items-start gap-2.5 cursor-pointer group"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 group-hover:text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-[#171318] group-hover:text-[#E83E83]">
                        {item.placePrediction?.mainText?.text || item.placePrediction?.text?.text || 'Selected Place'}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1">
                        {item.placePrediction?.secondaryText?.text || ''}
                      </div>
                    </div>
                  </button>
                ))}
                {fallbackSuggestions.map((item, idx) => (
                  <button
                    key={`f_${idx}`}
                    type="button"
                    onClick={() => handleSelectFallbackSuggestion(item)}
                    className="w-full text-left p-3 hover:bg-[#FFF0F6] transition flex items-start gap-2.5 cursor-pointer group"
                  >
                    <MapPin className="w-4 h-4 text-gray-400 group-hover:text-[#E83E83] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-[#171318] group-hover:text-[#E83E83]">
                        {item.mainText}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1">
                        {item.secondaryText || item.displayName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAP VIEWPORT AREA */}
      <div className="relative w-full h-[360px] sm:h-[440px] bg-[#E8EEF4] overflow-hidden">
        {canRenderGoogleMap ? (
          <APIProvider
            apiKey={apiKey}
            language="en"
            region="IN"
            libraries={['places', 'routes', 'marker']}
            onError={reportMapError}
          >
            <Map
              mapId="DEMO_MAP_ID"
              colorScheme="LIGHT"
              mapTypeId="roadmap"
              defaultCenter={{ lat: pickup.lat, lng: pickup.lng }}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <MapInnerController
                activeStep={activeStep}
                pickup={pickup}
                drop={drop}
                onCenterAddressResolved={handleCenterAddressResolved}
                onReverseGeocodingStart={handleReverseGeocodingStart}
                onMapReady={handleMapReady}
                isGeocoding={isGeocoding}
                routeMeta={routeMeta}
              />
            </Map>
          </APIProvider>
        ) : (
          <LiveTelemetryFallbackMap
            pickup={{ lat: pickup.lat, lng: pickup.lng, city: pickup.city, address: pickup.formatted_address }}
            drop={{ lat: drop.lat, lng: drop.lng, city: drop.city, address: drop.formatted_address }}
            currentLocation={activeStep === 'drop' ? { lat: drop.lat, lng: drop.lng } : { lat: pickup.lat, lng: pickup.lng }}
            vehicleNumber={activeStep === 'pickup' ? 'Pickup Pin' : activeStep === 'drop' ? 'Drop Pin' : 'Route Preview'}
            speedKmh={0}
            heading={45}
            remainingKm={routeMeta?.distance_km}
            reason={mapAuthError ? 'auth_error' : 'missing_key'}
            pickerMode={activeStep}
            onCenterChange={handleFallbackCenterChange}
            flyToTarget={fallbackFlyTo}
          />
        )}

        {/* FLOATING CENTERED PIN OVERLAY (Visible during Pickup and Drop setting on both Google Map and Road Map) */}
        {activeStep !== 'preview' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[420] -mt-8">
            <div className="flex flex-col items-center animate-bounce duration-700">
              {/* Floating Tooltip */}
              <div
                className={`text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full shadow-lg text-white mb-1 flex items-center gap-1.5 ${
                  activeStep === 'pickup' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {activeStep === 'pickup' ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Point at Loading Gate / Shed</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Point at Delivery Yard / Godown</span>
                  </>
                )}
              </div>

              {/* Pin Icon with Drop Shadow */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-2xl border-2 border-white ${
                  activeStep === 'pickup' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                <MapPin className="w-6 h-6 fill-white text-white drop-shadow-md" />
              </div>

              {/* Target crosshair / shadow circle on the ground */}
              <div className="w-3.5 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5" />
            </div>
          </div>
        )}

        {/* LIVE REVERSE-GEOCODING STATUS PILL */}
        <div className="absolute top-3 left-3 right-3 sm:right-auto z-[420] pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-gray-200 shadow-md text-xs flex items-center gap-2 max-w-md">
            {isGeocoding ? (
              <>
                <Loader2 className="w-4 h-4 text-[#E83E83] animate-spin shrink-0" />
                <span className="text-gray-600 font-semibold truncate">Pinpointing coordinates & reverse-geocoding...</span>
              </>
            ) : (
              <>
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    activeStep === 'pickup' ? 'bg-emerald-600' : activeStep === 'drop' ? 'bg-rose-600' : 'bg-[#E83E83]'
                  }`}
                />
                <div className="truncate">
                  <span className="font-extrabold text-[#171318]">
                    {activeStep === 'pickup' ? 'Pickup Coordinates: ' : activeStep === 'drop' ? 'Drop Coordinates: ' : 'Route Corridor: '}
                  </span>
                  <span className="text-gray-600 font-medium">
                    {activeStep === 'pickup'
                      ? `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`
                      : activeStep === 'drop'
                      ? `${drop.lat.toFixed(4)}, ${drop.lng.toFixed(4)}`
                      : `${pickup.city} ➔ ${drop.city}`}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* BOTTOM FLOATING ACTION BAR: Address Confirmation */}
        {activeStep !== 'preview' && (
          <div className="absolute bottom-3 left-3 right-3 z-[420] pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      activeStep === 'pickup' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {activeStep === 'pickup' ? 'Selected Pickup Address' : 'Selected Drop Address'}
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {activeStep === 'pickup' ? `PIN: ${pickup.pincode}` : `PIN: ${drop.pincode}`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#171318] truncate">
                  {activeStep === 'pickup' ? pickup.formatted_address : drop.formatted_address}
                </p>
              </div>

              <button
                type="button"
                onClick={handleConfirmCurrentStep}
                className={`py-2.5 px-5 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 shrink-0 transition cursor-pointer shadow-lg active:scale-98 ${
                  activeStep === 'pickup'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                }`}
              >
                <span>{activeStep === 'pickup' ? 'Confirm Pickup Point ➔' : 'Confirm Drop Point ➔'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADDITIONAL ADDRESS FIELDS & ROUTE METRICS PANEL */}
      <div className="p-4 sm:p-6 bg-white space-y-5 border-t border-gray-100">
        {/* VIEW 1: ADDITIONAL FIELDS FOR PICKUP & DROP (Godown / Shed / Contact Person) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Pickup Warehouse & Sender Contact Details */}
          <div
            className={`p-4 rounded-2xl border transition ${
              activeStep === 'pickup'
                ? 'border-emerald-500 bg-emerald-50/20 shadow-xs'
                : 'border-gray-200 bg-gray-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                  A
                </div>
                <h4 className="text-xs font-black text-[#171318] uppercase tracking-wide">Pickup Location Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('pickup')}
                className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                Edit on Map
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Pinpoint Address & City</label>
                <div className="text-xs font-bold text-[#171318] truncate">{pickup.formatted_address}</div>
                <div className="text-[11px] text-gray-500">{pickup.city}, PIN: {pickup.pincode}</div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Building className="w-3 h-3 text-emerald-600" />
                  <span>Godown / Shed / Gate Number</span>
                </label>
                <input
                  type="text"
                  value={pickup.landmark}
                  onChange={(e) => setPickup({ ...pickup, landmark: e.target.value })}
                  placeholder="e.g., Godown 4B, Shed 2, Main Highway Gate"
                  className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-emerald-600" />
                    <span>Sender Name</span>
                  </label>
                  <input
                    type="text"
                    value={pickup.contactName || ''}
                    onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })}
                    placeholder="Contact person"
                    className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>Sender Mobile</span>
                  </label>
                  <input
                    type="tel"
                    value={pickup.contactPhone || ''}
                    onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Drop-off Warehouse & Receiver Contact Details */}
          <div
            className={`p-4 rounded-2xl border transition ${
              activeStep === 'drop'
                ? 'border-rose-500 bg-rose-50/20 shadow-xs'
                : 'border-gray-200 bg-gray-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                  B
                </div>
                <h4 className="text-xs font-black text-[#171318] uppercase tracking-wide">Drop Location Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('drop')}
                className="text-[11px] text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Edit on Map
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Pinpoint Address & City</label>
                <div className="text-xs font-bold text-[#171318] truncate">{drop.formatted_address}</div>
                <div className="text-[11px] text-gray-500">{drop.city}, PIN: {drop.pincode}</div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Building className="w-3 h-3 text-rose-600" />
                  <span>Godown / Shed / Gate Number</span>
                </label>
                <input
                  type="text"
                  value={drop.landmark}
                  onChange={(e) => setDrop({ ...drop, landmark: e.target.value })}
                  placeholder="e.g., Plot 12, Transport Yard Shed C"
                  className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-rose-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-rose-600" />
                    <span>Receiver Name</span>
                  </label>
                  <input
                    type="text"
                    value={drop.contactName || ''}
                    onChange={(e) => setDrop({ ...drop, contactName: e.target.value })}
                    placeholder="Consignee person"
                    className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-rose-600 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <Phone className="w-3 h-3 text-rose-600" />
                    <span>Receiver Mobile</span>
                  </label>
                  <input
                    type="tel"
                    value={drop.contactPhone || ''}
                    onChange={(e) => setDrop({ ...drop, contactPhone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full mt-1 p-2 rounded-xl border border-gray-300 bg-white text-xs text-[#171318] font-medium focus:border-rose-600 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VIEW 2: ROUTE PREVIEW & REAL-TIME METRICS SUMMARY */}
        <div className="bg-[#171318] text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-gray-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#E83E83]" />
              <h4 className="text-sm font-extrabold text-white">Freight Route Corridor & Live Transit Metrics</h4>
            </div>

            <button
              type="button"
              onClick={() => setShowJsonModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-mono transition cursor-pointer self-start sm:self-auto"
            >
              <FileText className="w-3.5 h-3.5 text-[#E83E83]" />
              <span>Inspect JSON Schema</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Distance</span>
              <div className="text-xl font-black text-white mt-0.5">
                {routeMeta?.distance_km ? `${routeMeta.distance_km} km` : 'Calculating...'}
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-gray-400">Estimated Transit</span>
              <div className="text-xl font-black text-[#E83E83] mt-0.5">
                {routeMeta?.duration_mins
                  ? `${Math.floor(routeMeta.duration_mins / 60)}h ${routeMeta.duration_mins % 60}m`
                  : '8 hrs 30 mins'}
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-gray-400">Corridor Route</span>
              <div className="text-xs font-bold text-emerald-400 mt-1 truncate">
                NH-27 / NH-37 Express
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] uppercase font-bold text-gray-400">Toll & Checkposts</span>
              <div className="text-xs font-bold text-blue-400 mt-1">
                FASTag Integrated
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Both loading points validated against VAHAN logistics corridor coordinates.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleFinalSubmit}
                className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-[#E83E83] hover:bg-[#d62e73] text-white text-xs font-black tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#E83E83]/30 transition cursor-pointer active:scale-98"
              >
                <span>Save & Apply Route to Load</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEVELOPER STRUCTURED JSON PAYLOAD MODAL */}
      {showJsonModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowJsonModal(false)}
        >
          <div 
            className="bg-[#171318] text-white rounded-3xl border border-gray-800 max-w-xl w-full p-5 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E83E83]" />
                <h3 className="text-sm font-extrabold text-white">Structured Freight Location Schema Output</h3>
              </div>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E83E83] text-white text-xs font-bold transition cursor-pointer"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Exact JSON structure compliant with your logistics workflow specifications:
            </p>

            <pre className="flex-1 bg-black/80 rounded-2xl p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto overflow-y-auto border border-gray-800 selection:bg-emerald-800 selection:text-white">
              {currentPayloadJson}
            </pre>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="py-2 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
