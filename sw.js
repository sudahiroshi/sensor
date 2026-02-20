const CACHE_NAME = 'sensorscope-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/sensors.js',
  './js/graph.js',
  './js/recorder.js',
  './js/exporter.js',
  './js/utils.js',
  './js/pages/welcome.js',
  './js/pages/dashboard.js',
  './js/pages/detail.js',
  './js/pages/recordings.js',
  './js/pages/settings.js',
  './manifest.json'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      // Cache successful GET responses
      if (event.request.method === 'GET' && event.request.url.startsWith(self.location.origin)) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Offline: fallback to cache
      return caches.match(event.request).then((cached) => {
        return cached || caches.match('./index.html');
      });
    })
  );
});
