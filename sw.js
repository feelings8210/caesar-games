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

const BUILD_VERSION = 'v2.6.1';
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
  './js/games/hoops/runner.js',
  './js/games/hoops/families.js',
  './js/games/hoops/stats.js',
  './js/games/hoops/playbook.js',
  './js/games/hoops/playbook-mode.js',
  './js/games/hoops/court3d.js',
  './js/games/hoops/arena3d.js',
  './js/games/hoops/courtdesign.js',
  './js/games/hoops/athlete3d.js',
  './js/vendor/three/three.core.min.js',
  './js/vendor/three/three.module.min.js',
  './js/vendor/three/addons/GLTFLoader.js',
  './js/vendor/three/addons/BufferGeometryUtils.js',
  './js/vendor/three/addons/SkeletonUtils.js',
  './js/vendor/three/addons/RoomEnvironment.js',
  './assets/hoops/athlete.glb',
  './assets/hoops/hoop2.glb',
  './assets/hoops/court_lines.png',
  './js/vendor/three/addons/HDRLoader.js',
  './assets/hoops/env/env_1k.hdr',
  './assets/hoops/env/wood_diff_1k.jpg',
  './assets/hoops/env/wood_nor_1k.jpg',
  './assets/hoops/env/wood_rough_1k.jpg',
  './assets/hoops/sfx/backboard_01.mp3',
  './assets/hoops/sfx/backboard_02.mp3',
  './assets/hoops/sfx/block_01.mp3',
  './assets/hoops/sfx/block_02.mp3',
  './assets/hoops/sfx/buzzer_01.mp3',
  './assets/hoops/sfx/catch_01.mp3',
  './assets/hoops/sfx/catch_02.mp3',
  './assets/hoops/sfx/catch_03.mp3',
  './assets/hoops/sfx/cheer_01.mp3',
  './assets/hoops/sfx/cheer_02.mp3',
  './assets/hoops/sfx/cheer_03.mp3',
  './assets/hoops/sfx/crowd_loop.mp3',
  './assets/hoops/sfx/dribble_01.mp3',
  './assets/hoops/sfx/dribble_02.mp3',
  './assets/hoops/sfx/dribble_03.mp3',
  './assets/hoops/sfx/dribble_04.mp3',
  './assets/hoops/sfx/groan_01.mp3',
  './assets/hoops/sfx/groan_02.mp3',
  './assets/hoops/sfx/pass_01.mp3',
  './assets/hoops/sfx/pass_02.mp3',
  './assets/hoops/sfx/rim_01.mp3',
  './assets/hoops/sfx/rim_02.mp3',
  './assets/hoops/sfx/rim_03.mp3',
  './assets/hoops/sfx/squeak_01.mp3',
  './assets/hoops/sfx/squeak_02.mp3',
  './assets/hoops/sfx/squeak_03.mp3',
  './assets/hoops/sfx/squeak_04.mp3',
  './assets/hoops/sfx/swish_01.mp3',
  './assets/hoops/sfx/swish_02.mp3',
  './assets/hoops/sfx/swish_03.mp3',
  './assets/hoops/sfx/whistle_01.mp3',
  './assets/hoops/sfx/whistle_02.mp3',
  './assets/hoops/voice/zh/chapter_done.mp3',
  './assets/hoops/voice/zh/cue_decide.mp3',
  './assets/hoops/voice/zh/cue_look.mp3',
  './assets/hoops/voice/zh/cue_watch.mp3',
  './assets/hoops/voice/zh/fast_1.mp3',
  './assets/hoops/voice/zh/fast_2.mp3',
  './assets/hoops/voice/zh/fast_3.mp3',
  './assets/hoops/voice/zh/fast_4.mp3',
  './assets/hoops/voice/zh/level_01_rule.mp3',
  './assets/hoops/voice/zh/level_01_title.mp3',
  './assets/hoops/voice/zh/level_02_rule.mp3',
  './assets/hoops/voice/zh/level_02_title.mp3',
  './assets/hoops/voice/zh/level_03_rule.mp3',
  './assets/hoops/voice/zh/level_03_title.mp3',
  './assets/hoops/voice/zh/level_04_rule.mp3',
  './assets/hoops/voice/zh/level_04_title.mp3',
  './assets/hoops/voice/zh/level_05_rule.mp3',
  './assets/hoops/voice/zh/level_05_title.mp3',
  './assets/hoops/voice/zh/level_06_rule.mp3',
  './assets/hoops/voice/zh/level_06_title.mp3',
  './assets/hoops/voice/zh/level_07_rule.mp3',
  './assets/hoops/voice/zh/level_07_title.mp3',
  './assets/hoops/voice/zh/level_08_rule.mp3',
  './assets/hoops/voice/zh/level_08_title.mp3',
  './assets/hoops/voice/zh/level_09_rule.mp3',
  './assets/hoops/voice/zh/level_09_title.mp3',
  './assets/hoops/voice/zh/level_10_rule.mp3',
  './assets/hoops/voice/zh/level_10_title.mp3',
  './assets/hoops/voice/zh/pb_done.mp3',
  './assets/hoops/voice/zh/pb_done_3.mp3',
  './assets/hoops/voice/zh/pb_hint.mp3',
  './assets/hoops/voice/zh/pb_right_1.mp3',
  './assets/hoops/voice/zh/pb_right_2.mp3',
  './assets/hoops/voice/zh/pb_right_3.mp3',
  './assets/hoops/voice/zh/pb_watch_end.mp3',
  './assets/hoops/voice/zh/pb_wrong_1.mp3',
  './assets/hoops/voice/zh/pb_wrong_2.mp3',
  './assets/hoops/voice/zh/praise_backdoor.mp3',
  './assets/hoops/voice/zh/praise_box-out.mp3',
  './assets/hoops/voice/zh/praise_break-stay.mp3',
  './assets/hoops/voice/zh/praise_catch-sag.mp3',
  './assets/hoops/voice/zh/praise_closeout.mp3',
  './assets/hoops/voice/zh/praise_drive-kick.mp3',
  './assets/hoops/voice/zh/praise_drive-none.mp3',
  './assets/hoops/voice/zh/praise_drive-weak.mp3',
  './assets/hoops/voice/zh/praise_help-side.mp3',
  './assets/hoops/voice/zh/praise_last-shot.mp3',
  './assets/hoops/voice/zh/praise_pnr-drop.mp3',
  './assets/hoops/voice/zh/praise_pnr-roll.mp3',
  './assets/hoops/voice/zh/praise_switch.mp3',
  './assets/hoops/voice/zh/praise_two-on-one.mp3',
  './assets/hoops/voice/zh/rank_up.mp3',
  './assets/hoops/voice/zh/react_bad_1.mp3',
  './assets/hoops/voice/zh/react_bad_2.mp3',
  './assets/hoops/voice/zh/react_bad_3.mp3',
  './assets/hoops/voice/zh/react_bad_4.mp3',
  './assets/hoops/voice/zh/react_bad_5.mp3',
  './assets/hoops/voice/zh/react_bad_6.mp3',
  './assets/hoops/voice/zh/react_best_1.mp3',
  './assets/hoops/voice/zh/react_best_10.mp3',
  './assets/hoops/voice/zh/react_best_11.mp3',
  './assets/hoops/voice/zh/react_best_12.mp3',
  './assets/hoops/voice/zh/react_best_2.mp3',
  './assets/hoops/voice/zh/react_best_3.mp3',
  './assets/hoops/voice/zh/react_best_4.mp3',
  './assets/hoops/voice/zh/react_best_5.mp3',
  './assets/hoops/voice/zh/react_best_6.mp3',
  './assets/hoops/voice/zh/react_best_7.mp3',
  './assets/hoops/voice/zh/react_best_8.mp3',
  './assets/hoops/voice/zh/react_best_9.mp3',
  './assets/hoops/voice/zh/react_ok_1.mp3',
  './assets/hoops/voice/zh/react_ok_2.mp3',
  './assets/hoops/voice/zh/react_ok_3.mp3',
  './assets/hoops/voice/zh/react_ok_4.mp3',
  './assets/hoops/voice/zh/react_ok_5.mp3',
  './assets/hoops/voice/zh/react_ok_6.mp3',
  './assets/hoops/voice/zh/react_slow.mp3',
  './assets/hoops/voice/zh/retry.mp3',
  './assets/hoops/voice/zh/round_1.mp3',
  './assets/hoops/voice/zh/round_2.mp3',
  './assets/hoops/voice/zh/round_3.mp3',
  './assets/hoops/voice/zh/round_4.mp3',
  './assets/hoops/voice/zh/show_best.mp3',
  './assets/hoops/voice/zh/streak_10.mp3',
  './assets/hoops/voice/zh/streak_3.mp3',
  './assets/hoops/voice/zh/streak_5.mp3',
  './assets/hoops/voice/zh/streak_8.mp3',
  './assets/hoops/voice/en/chapter_done.mp3',
  './assets/hoops/voice/en/cue_decide.mp3',
  './assets/hoops/voice/en/cue_look.mp3',
  './assets/hoops/voice/en/cue_watch.mp3',
  './assets/hoops/voice/en/fast_1.mp3',
  './assets/hoops/voice/en/fast_2.mp3',
  './assets/hoops/voice/en/fast_3.mp3',
  './assets/hoops/voice/en/fast_4.mp3',
  './assets/hoops/voice/en/level_01_rule.mp3',
  './assets/hoops/voice/en/level_01_title.mp3',
  './assets/hoops/voice/en/level_02_rule.mp3',
  './assets/hoops/voice/en/level_02_title.mp3',
  './assets/hoops/voice/en/level_03_rule.mp3',
  './assets/hoops/voice/en/level_03_title.mp3',
  './assets/hoops/voice/en/level_04_rule.mp3',
  './assets/hoops/voice/en/level_04_title.mp3',
  './assets/hoops/voice/en/level_05_rule.mp3',
  './assets/hoops/voice/en/level_05_title.mp3',
  './assets/hoops/voice/en/level_06_rule.mp3',
  './assets/hoops/voice/en/level_06_title.mp3',
  './assets/hoops/voice/en/level_07_rule.mp3',
  './assets/hoops/voice/en/level_07_title.mp3',
  './assets/hoops/voice/en/level_08_rule.mp3',
  './assets/hoops/voice/en/level_08_title.mp3',
  './assets/hoops/voice/en/level_09_rule.mp3',
  './assets/hoops/voice/en/level_09_title.mp3',
  './assets/hoops/voice/en/level_10_rule.mp3',
  './assets/hoops/voice/en/level_10_title.mp3',
  './assets/hoops/voice/en/pb_done.mp3',
  './assets/hoops/voice/en/pb_done_3.mp3',
  './assets/hoops/voice/en/pb_hint.mp3',
  './assets/hoops/voice/en/pb_right_1.mp3',
  './assets/hoops/voice/en/pb_right_2.mp3',
  './assets/hoops/voice/en/pb_right_3.mp3',
  './assets/hoops/voice/en/pb_watch_end.mp3',
  './assets/hoops/voice/en/pb_wrong_1.mp3',
  './assets/hoops/voice/en/pb_wrong_2.mp3',
  './assets/hoops/voice/en/praise_backdoor.mp3',
  './assets/hoops/voice/en/praise_box-out.mp3',
  './assets/hoops/voice/en/praise_break-stay.mp3',
  './assets/hoops/voice/en/praise_catch-sag.mp3',
  './assets/hoops/voice/en/praise_closeout.mp3',
  './assets/hoops/voice/en/praise_drive-kick.mp3',
  './assets/hoops/voice/en/praise_drive-none.mp3',
  './assets/hoops/voice/en/praise_drive-weak.mp3',
  './assets/hoops/voice/en/praise_help-side.mp3',
  './assets/hoops/voice/en/praise_last-shot.mp3',
  './assets/hoops/voice/en/praise_pnr-drop.mp3',
  './assets/hoops/voice/en/praise_pnr-roll.mp3',
  './assets/hoops/voice/en/praise_switch.mp3',
  './assets/hoops/voice/en/praise_two-on-one.mp3',
  './assets/hoops/voice/en/rank_up.mp3',
  './assets/hoops/voice/en/react_bad_1.mp3',
  './assets/hoops/voice/en/react_bad_2.mp3',
  './assets/hoops/voice/en/react_bad_3.mp3',
  './assets/hoops/voice/en/react_bad_4.mp3',
  './assets/hoops/voice/en/react_bad_5.mp3',
  './assets/hoops/voice/en/react_bad_6.mp3',
  './assets/hoops/voice/en/react_best_1.mp3',
  './assets/hoops/voice/en/react_best_10.mp3',
  './assets/hoops/voice/en/react_best_11.mp3',
  './assets/hoops/voice/en/react_best_12.mp3',
  './assets/hoops/voice/en/react_best_2.mp3',
  './assets/hoops/voice/en/react_best_3.mp3',
  './assets/hoops/voice/en/react_best_4.mp3',
  './assets/hoops/voice/en/react_best_5.mp3',
  './assets/hoops/voice/en/react_best_6.mp3',
  './assets/hoops/voice/en/react_best_7.mp3',
  './assets/hoops/voice/en/react_best_8.mp3',
  './assets/hoops/voice/en/react_best_9.mp3',
  './assets/hoops/voice/en/react_ok_1.mp3',
  './assets/hoops/voice/en/react_ok_2.mp3',
  './assets/hoops/voice/en/react_ok_3.mp3',
  './assets/hoops/voice/en/react_ok_4.mp3',
  './assets/hoops/voice/en/react_ok_5.mp3',
  './assets/hoops/voice/en/react_ok_6.mp3',
  './assets/hoops/voice/en/react_slow.mp3',
  './assets/hoops/voice/en/retry.mp3',
  './assets/hoops/voice/en/round_1.mp3',
  './assets/hoops/voice/en/round_2.mp3',
  './assets/hoops/voice/en/round_3.mp3',
  './assets/hoops/voice/en/round_4.mp3',
  './assets/hoops/voice/en/show_best.mp3',
  './assets/hoops/voice/en/streak_10.mp3',
  './assets/hoops/voice/en/streak_3.mp3',
  './assets/hoops/voice/en/streak_5.mp3',
  './assets/hoops/voice/en/streak_8.mp3',
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
