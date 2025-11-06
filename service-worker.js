// service-worker.js
const CACHE_NAME = 'app-cache-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './auth.html',
  './styles.css',
  './src/editor/HTMLEditor/constants.js',
  './src/config.js',
  './src/main.js',
  './src/editor/HTMLEditor/index.js',
  './src/editor/HTMLEditor/core.js',
  './src/editor/HTMLEditor/ai.js',
  './src/editor/HTMLEditor/comments.js',
  './src/editor/HTMLEditor/blocks.js',
  './src/editor/HTMLEditor/auth.js',
  './src/editor/HTMLEditor/folders.js',
  './src/editor/HTMLEditor/notes.js',
  './src/editor/HTMLEditor/files.js',
  './src/editor/HTMLEditor/media.js',
  './src/editor/HTMLEditor/history.js',
  './src/editor/HTMLEditor/api.js',
  './src/state/currentUser.js',
  './src/state/globalDevices.js',
  './src/utils/index.js',
  './src/pages/auth.js',
  './icons/notai-192x192.png',
  './icons/notai-512x512.png',
];

// Install: pre-cache core, take control immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
});

// Activate: cleanup old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only delete old app-cache versions; keep domain caches like notes-cache/folders-cache
            .filter((k) => k.startsWith('app-cache') && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: network-first for navigations with offline fallbacks; cache-first for assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests (documents)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Optionally update cache in background
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('./index.html') || caches.match('./auth.html'),
          ),
        ),
    );
    return;
  }

  // Other requests: cache-first, fall back to network
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  );
});
