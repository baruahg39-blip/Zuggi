import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, LocateFixed, X } from 'lucide-react';

export interface SelectedPlace {
  label: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

interface LocationAutocompleteInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (place: SelectedPlace) => void;
  placeholder?: string;
  theme?: 'light' | 'dark';
  showGpsButton?: boolean;
  cityOnly?: boolean;
}

interface NominatimItem {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
  };
}

function parseNominatimPlace(item: NominatimItem, cityOnly = false): SelectedPlace {
  const addr = item.address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.state_district ||
    addr.county ||
    item.display_name.split(',')[0]?.trim() ||
    '';
  const district = addr.state_district || addr.county || city;
  const state = addr.state || 'Assam';
  const pincode = addr.postcode || '';

  const shortParts = [
    addr.road || addr.neighbourhood || addr.suburb,
    city,
    state
  ].filter((p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx);

  const label = cityOnly
    ? [city, state].filter(Boolean).join(', ')
    : shortParts.length >= 2
      ? shortParts.join(', ')
      : item.display_name.split(',').slice(0, 3).map((s) => s.trim()).join(', ');

  return {
    label,
    address: item.display_name,
    city,
    district,
    state,
    pincode,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon)
  };
}

export const LocationAutocompleteInput: React.FC<LocationAutocompleteInputProps> = ({
  value,
  onChangeText,
  onSelectPlace,
  placeholder = 'Type any area, town, city, landmark or pincode...',
  theme = 'light',
  showGpsButton = true,
  cityOnly = false
}) => {
  const [suggestions, setSuggestions] = useState<SelectedPlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced live India-wide location search via OpenStreetMap Nominatim
  useEffect(() => {
    const q = value.trim();
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=6&q=${encodeURIComponent(
          q
        )}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) return;
        const data: NominatimItem[] = await res.json();
        const parsed = (Array.isArray(data) ? data : []).map((item) => parseNominatimPlace(item, cityOnly));
        setSuggestions(parsed);
        if (parsed.length > 0) setIsOpen(true);
      } catch {
        // Silent abort / offline fallback (user can still type any free-text location)
      } finally {
        setIsSearching(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, cityOnly]);

  const handleUseCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`;
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (res.ok) {
            const item: NominatimItem = await res.json();
            const parsed = parseNominatimPlace(item, cityOnly);
            skipNextFetchRef.current = true;
            onChangeText(parsed.label);
            onSelectPlace(parsed);
            setIsOpen(false);
          }
        } catch {
          // Fallback to coordinates if reverse geocoding is offline
          const fallback: SelectedPlace = {
            label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            address: `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            city: 'Current Location',
            district: 'Current Location',
            state: 'Assam',
            pincode: '',
            lat: latitude,
            lng: longitude
          };
          skipNextFetchRef.current = true;
          onChangeText(fallback.label);
          onSelectPlace(fallback);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const isDark = theme === 'dark';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <MapPin
          className={`w-4 h-4 absolute left-3 pointer-events-none ${
            isDark ? 'text-slate-400' : 'text-[#E83E83]'
          }`}
        />
        <input
          type="text"
          value={value}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onChange={(e) => {
            onChangeText(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-9 ${
            showGpsButton ? 'pr-16' : 'pr-8'
          } py-2.5 rounded-xl border text-xs font-medium focus:outline-none transition ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-amber-500'
              : 'bg-white border-gray-300 text-[#171318] placeholder-gray-400 focus:ring-2 focus:ring-[#E83E83] focus:border-[#E83E83]'
          }`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isSearching && (
            <Loader2 className={`w-3.5 h-3.5 animate-spin ${isDark ? 'text-amber-400' : 'text-[#E83E83]'}`} />
          )}
          {value && !isSearching && (
            <button
              type="button"
              onClick={() => {
                onChangeText('');
                setSuggestions([]);
                setIsOpen(false);
              }}
              aria-label="Clear location"
              className={`p-1 rounded-lg transition cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {showGpsButton && (
            <button
              type="button"
              onClick={handleUseCurrentGps}
              disabled={isLocating}
              title="Use my current GPS location"
              className={`p-1 rounded-lg transition cursor-pointer ${
                isDark
                  ? 'text-emerald-400 hover:bg-slate-800'
                  : 'text-[#E83E83] hover:bg-[#FFF0F6]'
              }`}
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          className={`absolute z-40 left-0 right-0 mt-1.5 rounded-xl border shadow-2xl overflow-hidden max-h-60 overflow-y-auto ${
            isDark
              ? 'bg-slate-900 border-slate-700 divide-y divide-slate-800'
              : 'bg-white border-gray-200 divide-y divide-gray-100'
          }`}
        >
          {suggestions.map((place, idx) => (
            <button
              key={`${place.lat}_${place.lng}_${idx}`}
              type="button"
              onClick={() => {
                skipNextFetchRef.current = true;
                onChangeText(place.label);
                onSelectPlace(place);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left flex items-start gap-2.5 transition cursor-pointer ${
                isDark ? 'hover:bg-slate-800 text-slate-100' : 'hover:bg-[#FFF0F6] text-[#171318]'
              }`}
            >
              <MapPin
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-[#E83E83]'}`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{place.label}</div>
                <div
                  className={`text-[10px] truncate mt-0.5 ${
                    isDark ? 'text-slate-400' : 'text-gray-500'
                  }`}
                >
                  {place.address}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
