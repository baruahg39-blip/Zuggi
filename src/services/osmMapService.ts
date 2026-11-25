export const GUWAHATI_DEFAULT_CENTER = { lat: 26.1445, lng: 91.7362 } as const;
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export interface OsmPlaceResult {
  label: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  source: 'nominatim' | 'coordinate_fallback';
}

export interface OsrmRouteResult {
  distanceKm: number;
  durationMins: number;
  coordinates: Array<[number, number]>; // [lat, lng] for Leaflet Polyline
  source: 'osrm' | 'haversine_fallback';
  description: string;
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function parsePhotonFeature(feature: any, cityOnly = false): (OsmPlaceResult & { countryCode?: string }) | null {
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties || {};
  const lng = Number(coords?.[0]);
  const lat = Number(coords?.[1]);
  if (!isValidCoord(lat, lng)) return null;

  const name = String(props.name || props.street || '').trim();
  const street = String(props.street || '').trim();
  const locality = String(props.locality || props.suburb || props.district || '').trim();
  const city = String(props.city || props.town || props.village || props.county || locality || name || '').trim();
  const district = String(props.county || props.district || city).trim();
  const state = String(props.state || 'Assam').trim();
  const pincode = String(props.postcode || '').trim();
  const country = String(props.country || 'India').trim();
  const countryCode = String(props.countrycode || '').toLowerCase();

  const dedupe = (items: string[]) => items.filter((p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx);
  const fullParts = dedupe([name, street, locality, city, state, pincode, country]);
  const shortParts = cityOnly ? dedupe([city || name, state]) : dedupe([name || locality, city, state]);

  return {
    label: shortParts.join(', ') || fullParts.slice(0, 3).join(', '),
    address: fullParts.join(', '),
    city: city || name || 'Guwahati',
    district: district || city || 'Guwahati',
    state,
    pincode,
    lat,
    lng,
    countryCode
  };
}

function parseNominatimSearchItem(item: any, cityOnly = false): OsmPlaceResult | null {
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  if (!isValidCoord(lat, lng)) return null;

  const addr = item?.address || {};
  const displayName = String(item?.display_name || '');
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.state_district ||
    addr.county ||
    displayName.split(',')[0]?.trim() ||
    '';
  const district = addr.state_district || addr.county || city;
  const state = addr.state || 'Assam';
  const pincode = addr.postcode || '';

  const dedupe = (items: string[]) => items.filter((p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx);
  const shortParts = dedupe([addr.road || addr.neighbourhood || addr.suburb || '', city, state]);
  const label = cityOnly
    ? dedupe([city, state]).join(', ')
    : shortParts.length >= 2
      ? shortParts.join(', ')
      : displayName
          .split(',')
          .slice(0, 3)
          .map((s: string) => s.trim())
          .join(', ');

  return {
    label,
    address: displayName,
    city,
    district,
    state,
    pincode,
    lat,
    lng
  };
}

/**
 * Free address search autocomplete via Photon API biased toward Guwahati, Assam / Northeast India.
 * Automatically falls back to our server proxy and Nominatim if Photon is temporarily unreachable.
 */
export async function searchPlacesPhoton(
  query: string,
  options?: {
    lat?: number;
    lon?: number;
    limit?: number;
    cityOnly?: boolean;
    signal?: AbortSignal;
  }
): Promise<OsmPlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const biasLat = options?.lat ?? GUWAHATI_DEFAULT_CENTER.lat;
  const biasLon = options?.lon ?? GUWAHATI_DEFAULT_CENTER.lng;
  const limit = options?.limit ?? 6;
  const cityOnly = options?.cityOnly ?? false;

  // 1. Direct Photon API call biased to Guwahati, Assam (26.1445, 91.7362)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${biasLat}&lon=${biasLon}&limit=${limit}`;
    const res = await fetch(url, {
      signal: options?.signal,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const parsed = features
        .map((f: any) => parsePhotonFeature(f, cityOnly))
        .filter(Boolean) as Array<OsmPlaceResult & { countryCode?: string }>;

      const indian = parsed.filter((p) => !p.countryCode || p.countryCode === 'in');
      const finalList = (indian.length > 0 ? indian : parsed).slice(0, limit).map(({ countryCode: _c, ...rest }) => rest);
      if (finalList.length > 0) {
        return finalList;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 2. Fallback to same-origin server proxy (/api/maps/autocomplete -> Photon / Nominatim / NE hubs)
  try {
    const proxyUrl = `/api/maps/autocomplete?q=${encodeURIComponent(q)}&lat=${biasLat}&lon=${biasLon}&limit=${limit}`;
    const res = await fetch(proxyUrl, {
      signal: options?.signal,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.results) && data.results.length > 0) {
        return data.results.map((r: OsmPlaceResult) =>
          cityOnly
            ? { ...r, label: [r.city, r.state].filter(Boolean).join(', ') || r.label }
            : r
        );
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 3. Direct Nominatim search fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=${limit}&q=${encodeURIComponent(q)}`;
    const res = await fetch(nomUrl, {
      signal: options?.signal,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const items = await res.json();
      return (Array.isArray(items) ? items : [])
        .map((item: any) => parseNominatimSearchItem(item, cityOnly))
        .filter(Boolean) as OsmPlaceResult[];
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  return [];
}

/**
 * Free reverse geocoding via Nominatim (with server proxy & coordinate fallback).
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult> {
  // 1. Primary: server proxy (sends compliant User-Agent to Nominatim & handles offline fallback)
  try {
    const res = await fetch(
      `/api/maps/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { signal, headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.formatted_address) {
        return {
          lat,
          lng,
          formatted_address: String(data.formatted_address),
          street: String(data.street || data.area || data.city || ''),
          area: String(data.area || data.city || ''),
          city: String(data.city || 'Guwahati'),
          state: String(data.state || 'Assam'),
          pincode: String(data.pincode || ''),
          source: data.source === 'nominatim' ? 'nominatim' : 'coordinate_fallback'
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 2. Direct Nominatim reverse-geocoding API
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const osm = await res.json();
      const addr = osm?.address || {};
      const road = addr.road || addr.pedestrian || addr.highway || '';
      const area = addr.suburb || addr.neighbourhood || addr.locality || addr.village || '';
      const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || 'Guwahati';
      const state = addr.state || 'Assam';
      const pincode = addr.postcode || '';
      const formatted_address =
        osm?.display_name || [road, area, city, state, pincode].filter(Boolean).join(', ');

      return {
        lat,
        lng,
        formatted_address,
        street: road || area || city,
        area: area || city,
        city,
        state,
        pincode,
        source: 'nominatim'
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  return {
    lat,
    lng,
    formatted_address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Assam`,
    street: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    area: 'Assam',
    city: 'Guwahati',
    state: 'Assam',
    pincode: '',
    source: 'coordinate_fallback'
  };
}

// Lightweight in-memory route cache so switching steps/views doesn't spam OSRM
const routeCache = new Map<string, { expiresAt: number; result: OsrmRouteResult }>();

function makeRouteCacheKey(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): string {
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
}

/**
 * Computes actual highway/road distance (km), transit duration (mins), and Leaflet [lat, lng][] polyline
 * via public OSRM routing API (with 1.3x Haversine straight-line fallback ONLY if OSRM is unreachable).
 */
export async function fetchOsrmRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  signal?: AbortSignal
): Promise<OsrmRouteResult> {
  const key = makeRouteCacheKey(origin, destination);
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // 1. Direct public OSRM API call
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, {
      signal,
      headers: { Accept: 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      if (route && Number.isFinite(route.distance)) {
        const distanceKm = Math.max(1, Math.round((Number(route.distance) / 1000) * 10) / 10);
        const durationMins = Math.max(5, Math.round(Number(route.duration || 0) / 60) || Math.round((distanceKm / 45) * 60));
        const rawCoords: Array<[number, number]> = Array.isArray(route.geometry?.coordinates)
          ? route.geometry.coordinates
          : [];
        const coordinates: Array<[number, number]> = rawCoords
          .filter((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
          .map((pt) => [pt[1], pt[0]]);

        const legSummary = route.legs?.[0]?.summary || 'National Highway Commercial Corridor';
        const result: OsrmRouteResult = {
          distanceKm,
          durationMins,
          coordinates: coordinates.length >= 2 ? coordinates : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
          source: 'osrm',
          description: `OSRM Road Route via ${legSummary}`
        };
        routeCache.set(key, { expiresAt: Date.now() + 5 * 60 * 1000, result });
        return result;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 2. Fallback to same-origin server OSRM proxy (/api/maps/compute-route)
  try {
    const res = await fetch('/api/maps/compute-route', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Number.isFinite(Number(data.distance_km))) {
        const coords: Array<[number, number]> =
          Array.isArray(data.route_coordinates) && data.route_coordinates.length >= 2
            ? data.route_coordinates
            : [
                [origin.lat, origin.lng],
                [destination.lat, destination.lng]
              ];
        const result: OsrmRouteResult = {
          distanceKm: Math.max(1, Math.round(Number(data.distance_km) * 10) / 10),
          durationMins: Math.max(5, Math.round(Number(data.duration_mins) || 0)),
          coordinates: coords,
          source: data.source === 'osrm' ? 'osrm' : 'haversine_fallback',
          description: String(data.description || 'Highway Commercial Corridor')
        };
        routeCache.set(key, { expiresAt: Date.now() + 5 * 60 * 1000, result });
        return result;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
  }

  // 3. Final graceful Haversine straight-line fallback multiplier (1.3x) ONLY if OSRM is unreachable
  const straightKm = haversineDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
  const distanceKm = Math.max(1, Math.round(straightKm * 1.3 * 10) / 10);
  const durationMins = Math.max(5, Math.round((distanceKm / 44) * 60));

  return {
    distanceKm,
    durationMins,
    coordinates: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng]
    ],
    source: 'haversine_fallback',
    description: 'Estimated Highway Corridor (1.3x Haversine fallback)'
  };
}
