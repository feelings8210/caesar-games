/* Caesar Games — service worker
 *
 * Strategy
 *   HTML / navigation : network-first, cache as fallback.  The app shell is
 *                       never trapped in the cache, so a deployed build always
 *                       reaches an online iPad.
 *   Same-origin assets: stale-while-revalidate.  Instant offline start, and
 *                       the next launch picks up whatever changed.
 *
 * The cache name carries the build version, so activating a new worker
 * discards every older cache in one pass.
 */

const BUILD_VERSION = 'v2.1.0';
const CACHE = `caesar-games-${BUILD_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/app.css',
  './css/board.css',
  './css/hoops.css',
  './js/app.js',
  './js/build.js',
  './js/pwa.js',
  './js/ui/board_view.js',
  './js/ui/motion.js',
  './js/engine/rules.js',
  './js/engine/session.js',
  './js/engine/ai.js',
  './js/engine/sound.js',
  './js/engine/persistence.js',
  './js/i18n/strings.js',
  './js/games/registry.js',
  './js/games/open/controller.js',
  './js/games/open/ai_worker.js',
  './js/games/open/board_view.js',
  './js/games/xiangqi/engine.js',
  './js/games/xiangqi/ai.js',
  './js/games/chess/adapter.js',
  './js/games/chess/ai.js',
  './js/games/gomoku/engine.js',
  './js/games/gomoku/ai.js',
  './js/games/hoops/audio.js',
  './js/games/hoops/court.js',
  './js/games/hoops/levels.js',
  './js/games/hoops/controller.js',
  './js/vendor/chessjs/chess.js',
  './js/vendor/chessjs/LICENSE',
  './assets/cd_home_mark_transparent.png',
  './assets/icon-120.png',
  './assets/icon-152.png',
  './assets/icon-167.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-1024.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A candidate worker may activate only with a complete travel cache. If an
    // asset is unavailable, installation fails and the prior known-good worker
    // remains in control.
    await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

const isNavigation = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Code and styles are network-first with a short timeout. This matters:
    // navigation is network-first, so serving a cached script alongside a
    // freshly fetched index.html could mix two builds together. A timeout
    // keeps a flaky or absent network from stalling the launch.
    const isCode = /\.(?:js|mjs|css|json)$/.test(url.pathname);

    if (isCode) {
      const cached = await cache.match(req);
      try {
        const res = await withTimeout(fetch(req), 2500);
        if (res && res.ok) { cache.put(req, res.clone()); return res; }
        if (cached) return cached;
        return res || Response.error();
      } catch {
        return cached || Response.error();
      }
    }

    // Images and everything else: cache-first, refreshed in the background.
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); },
                 e => { clearTimeout(timer); reject(e); });
  });
}
