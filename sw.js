// Cache-first service worker for offline play. Bump CACHE on every release
// that changes any listed asset.
const CACHE = 'voetbal-iq-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/main.css',
  'js/main.js',
  'js/i18n.js',
  'js/store.js',
  'js/sound.js',
  'js/drills/runner.js',
  'js/drills/decision.js',
  'js/drills/scanning.js',
  'js/drills/anticipation.js',
  'js/drills/memory.js',
  'js/engine/difficulty.js',
  'js/engine/scoring.js',
  'js/engine/session.js',
  'js/render/pitch.js',
  'js/render/anim.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
  );
});
