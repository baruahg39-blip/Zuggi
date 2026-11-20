import { useEffect, useState, useCallback } from 'react';

export type MapsFallbackReason = 'missing_key' | 'auth_error' | 'quota_exceeded';

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const PLACEHOLDER_KEY_PATTERNS = [
  'your_google_maps_api_key',
  'your_api_key',
  'my_api_key',
  'replace_me'
];

function sanitizeApiKey(raw: string | undefined | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_KEY_PATTERNS.some((p) => lower.includes(p))) {
    return '';
  }
  return trimmed;
}

let cachedRuntimeKey: string | null = null;
let pendingFetch: Promise<string> | null = null;
let globalErrorReason: Exclude<MapsFallbackReason, 'missing_key'> | null = null;
const errorListeners = new Set<(reason: Exclude<MapsFallbackReason, 'missing_key'>) => void>();

function notifyGlobalError(reason: Exclude<MapsFallbackReason, 'missing_key'>) {
  // Preserve quota_exceeded specificity if already set
  if (globalErrorReason === 'quota_exceeded' && reason === 'auth_error') {
    return;
  }
  globalErrorReason = reason;
  errorListeners.forEach((fn) => fn(reason));
}

function installGlobalMapsTraps() {
  if (typeof window === 'undefined') return;
  const existing = window.gm_authFailure;
  if (!(existing as { __zuggiTrap?: boolean } | undefined)?.__zuggiTrap) {
    const trap = () => {
      notifyGlobalError('auth_error');
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

  const win = window as Window & { __zuggiQuotaListenerInstalled?: boolean };
  if (!win.__zuggiQuotaListenerInstalled) {
    win.__zuggiQuotaListenerInstalled = true;
    window.addEventListener('gmp-quota-exceeded', (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: 'quota_exceeded' | 'auth_error' }>).detail;
      const reason = detail?.reason === 'auth_error' ? 'auth_error' : 'quota_exceeded';
      notifyGlobalError(reason);
    });
  }
}

async function fetchRuntimeMapsKey(): Promise<string> {
  if (cachedRuntimeKey !== null) return cachedRuntimeKey;
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch('/api/config/maps', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : { apiKey: '' }))
    .then((data) => {
      const key = sanitizeApiKey(typeof data?.apiKey === 'string' ? data.apiKey : '');
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
 * (`import.meta.env.VITE_GOOGLE_MAPS_API_KEY`) with runtime `/api/config/maps`
 * fallback, and listens for Google Maps authentication and quota failures
 * (`gm_authFailure`, `OverQuotaMapError`, `QuotaExceededError`, `<APIProvider onError>`)
 * so tracking views switch cleanly to the live SVG telemetry radar instead of blocking.
 */
export function useGoogleMapsApiKey() {
  // Literal access is required so Vite statically replaces VITE_GOOGLE_MAPS_API_KEY at build time
  const buildTimeKey = sanitizeApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  const [apiKey, setApiKey] = useState<string>(buildTimeKey || cachedRuntimeKey || '');
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(!buildTimeKey && cachedRuntimeKey === null);
  const [errorReason, setErrorReason] = useState<Exclude<MapsFallbackReason, 'missing_key'> | null>(
    globalErrorReason
  );

  useEffect(() => {
    installGlobalMapsTraps();
    const onFail = (reason: Exclude<MapsFallbackReason, 'missing_key'>) => setErrorReason(reason);
    errorListeners.add(onFail);
    if (globalErrorReason) {
      setErrorReason(globalErrorReason);
    }

    if (!buildTimeKey) {
      let active = true;
      fetchRuntimeMapsKey().then((runtimeKey) => {
        if (!active) return;
        if (runtimeKey) setApiKey(runtimeKey);
        setIsCheckingKey(false);
      });
      return () => {
        active = false;
        errorListeners.delete(onFail);
      };
    }

    return () => {
      errorListeners.delete(onFail);
    };
  }, [buildTimeKey]);

  const reportMapError = useCallback((err?: unknown) => {
    const msg = String(err || '');
    const reason: Exclude<MapsFallbackReason, 'missing_key'> =
      msg.includes('Quota') || msg.includes('OVER_QUERY_LIMIT') ? 'quota_exceeded' : 'auth_error';
    notifyGlobalError(reason);
  }, []);

  const mapAuthError = errorReason === 'auth_error';
  const isQuotaExceeded = errorReason === 'quota_exceeded';
  const fallbackReason: MapsFallbackReason = errorReason || 'missing_key';
  const canRenderGoogleMap = Boolean(apiKey) && !errorReason;

  return {
    apiKey,
    isCheckingKey,
    mapAuthError,
    isQuotaExceeded,
    errorReason,
    fallbackReason,
    canRenderGoogleMap,
    reportMapError
  };
}
