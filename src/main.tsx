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
};

createRoot(document.getElementById('root')!).render(<App />);
