const CACHE_NAME = 'doces-da-mari-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/doces-da-mari-logo.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon.png',
  '/pwa-192.png',
  '/pwa-512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Firebase, Google Fonts and WhatsApp must use the browser network stack
  // directly. Caching cross-origin requests can interrupt Firestore streams.
  if (url.origin !== self.location.origin) return;

  // For HTML page navigation, ALWAYS network first with cache fallback
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match('/index.html');
          const cachedRequest = await caches.match(event.request);
          return cachedPage || cachedRequest || new Response('Aplicativo offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Network first strategy for all assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      })
  );
});
