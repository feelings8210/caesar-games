/* Caesar Games — PWA Service Worker for Offline iPad Play (Network-First PWA Update Strategy) */
const BUILD_VERSION = 'v1.0.3';
const CACHE_NAME = `caesar-games-${BUILD_VERSION}-pwa`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/style.css',
  './css/board.css',
  './css/learn.css',
  './js/app.js',
  './js/board.js',
  './js/hint.js',
  './js/pass_ipad.js',
  './js/engine/rules.js',
  './js/engine/ai.js',
  './js/engine/sound.js',
  './js/engine/persistence.js',
  './js/engine/test.js',
  './assets/cd_home_mark_transparent.png'
];

self.addEventListener('install', (event) => {
  console.log(`[Service Worker] Installing version ${BUILD_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] Activating version ${BUILD_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const isNavigation = event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    // Network-First Strategy for HTML / Navigation requests
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to offline cached HTML if network fails
        return caches.match('./index.html').then(cachedHtml => cachedHtml || caches.match(event.request));
      })
    );
  } else {
    // Network-First with Cache Fallback for JS/CSS/Assets to ensure fresh updates
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
