import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

let cachedRuntimeKey: string | null = null;
let pendingFetch: Promise<string> | null = null;
let globalAuthFailed = false;
const authFailureListeners = new Set<() => void>();

function installAuthFailureTrap() {
  if (typeof window === 'undefined') return;
  const existing = window.gm_authFailure;
  if ((existing as { __zuggiTrap?: boolean } | undefined)?.__zuggiTrap) return;

  const trap = () => {
    globalAuthFailed = true;
    authFailureListeners.forEach((fn) => fn());
    if (typeof existing === 'function') {
      try {
        existing();
      } catch {
        // ignore upstream handler errors
      }
    }
  };
  (trap as { __zuggiTrap?: boolean }).__zuggiTrap = true;
  window.gm_authFailure = trap;
}

async function fetchRuntimeMapsKey(): Promise<string> {
  if (cachedRuntimeKey !== null) return cachedRuntimeKey;
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch('/api/config/maps', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : { apiKey: '' }))
    .then((data) => {
      const key = typeof data?.apiKey === 'string' ? data.apiKey.trim() : '';
      cachedRuntimeKey = key;
      return key;
    })
    .catch(() => {
      cachedRuntimeKey = '';
      return '';
    })
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
}

/**
 * Resolves the Google Maps Platform browser API key from Vite build-time env
 * or the runtime `/api/config/maps` endpoint, and watches for Google Maps
 * authentication/referrer failures (`gm_authFailure`) so UI can fall back cleanly.
 */
export function useGoogleMapsApiKey() {
  const buildTimeKey =
    ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  const [apiKey, setApiKey] = useState<string>(buildTimeKey || cachedRuntimeKey || '');
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(!buildTimeKey && cachedRuntimeKey === null);
  const [mapAuthError, setMapAuthError] = useState<boolean>(globalAuthFailed);

  useEffect(() => {
    installAuthFailureTrap();
    const onFail = () => setMapAuthError(true);
    authFailureListeners.add(onFail);

    if (!buildTimeKey) {
      let active = true;
      fetchRuntimeMapsKey().then((runtimeKey) => {
        if (!active) return;
        if (runtimeKey) setApiKey(runtimeKey);
        setIsCheckingKey(false);
      });
      return () => {
        active = false;
        authFailureListeners.delete(onFail);
      };
    }

    return () => {
      authFailureListeners.delete(onFail);
    };
  }, [buildTimeKey]);

  const reportMapError = useCallback(() => {
    globalAuthFailed = true;
    setMapAuthError(true);
    authFailureListeners.forEach((fn) => fn());
  }, []);

  const canRenderGoogleMap = Boolean(apiKey) && !mapAuthError;

  return {
    apiKey,
    isCheckingKey,
    mapAuthError,
    canRenderGoogleMap,
    reportMapError
  };
}
