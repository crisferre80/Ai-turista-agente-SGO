/* Simple service worker for basic offline support and to meet PWA installability heuristics */
const CACHE_NAME = 'sant-ia-cache-v1';
const urlsToCache = [
  '/',
  '/favicon.ico',
  '/santi-avatar.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first for navigations, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // For other requests, try cache first then network. If network fetch fails, fallback to cached '/' or a simple offline response
  event.respondWith(
    caches.match(event.request).then((resp) => {
      if (resp) return resp;
      return fetch(event.request).catch(() => {
        return caches.match('/').then((fallback) => fallback || new Response('Offline', { status: 503, statusText: 'Service Worker Offline' }));
      });
    })
  );
});
