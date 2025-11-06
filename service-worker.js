// service-worker.js
const CACHE_NAME = 'app-cache';
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (response) => response || fetch(event.request),
    ),
  );
});
