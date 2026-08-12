import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Cache only the published PWA. Registering a service worker inside the
// Google AI Studio editor can keep an old preview alive after code changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch((error) => {
      console.warn('Não foi possível ativar o modo offline:', error);
    });
  });
}
