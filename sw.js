// ==========================================================================
// SERVICE WORKER - OFFLINE & ASSET CACHE
// Enables reliable offline and low-network access for Indian farmers
// ==========================================================================

const CACHE_NAME = 'smart-farm-prod-v3.5';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/i18n.js',
  './js/weather.js',
  './js/location.js',
  './js/storage.js',
  './manifest.json'
];

// Install: Cache all static app shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic live APIs, cache-first for static shell assets
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Network-first for live weather and geocoding APIs
  if (requestUrl.hostname.includes('open-meteo.com') || requestUrl.hostname.includes('openstreetmap.org')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first fallback to network for static files
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.status === 200 && requestUrl.origin === location.origin) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('./index.html');
    })
  );
});