const CACHE_VERSION = 'v2';
const CACHE_NAME = 'foodlog-' + CACHE_VERSION;
const STATIC_ASSETS = ['/', '/food.css', '/food.js', '/manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Network-first strategy
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Don't cache API calls
  if (url.pathname.startsWith('/entries') || url.pathname.startsWith('/summary')) return;

  e.respondWith(
    fetch(e.request).then(function (response) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
      return response;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
