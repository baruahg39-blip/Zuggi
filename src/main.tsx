import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Register service worker for instant PWA / WebAPK installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Silently ignore transient proxy or offline service worker fetch errors
      });
  });
}

// Global handler for Google Maps authentication & quota tracking
// Source: Google Maps Platform Code Assist
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(
    new CustomEvent('gmp-quota-exceeded', { detail: { reason: 'auth_error' } })
  );
};

// Suppress benign WebSocket closure and external reCAPTCHA messages in proxy environment
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason || '');
  if (msg.includes('WebSocket') || msg.includes('reCAPTCHA') || msg.includes('auth/operation-not-allowed')) {
    event.preventDefault();
  }
});

const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('WebSocket') || msg.includes('reCAPTCHA') || msg.includes('auth/operation-not-allowed')) {
    return;
  }
  origError.apply(console, args);
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(
      new CustomEvent('gmp-quota-exceeded', { detail: { reason: 'quota_exceeded' } })
    );
  } else if (
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('BillingNotEnabledMapError')
  ) {
    window.dispatchEvent(
      new CustomEvent('gmp-quota-exceeded', { detail: { reason: 'auth_error' } })
    );
  }
};

createRoot(document.getElementById('root')!).render(<App />);
