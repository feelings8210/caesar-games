/* Caesar Games — service worker registration
 *
 * Update policy:
 *  - Register, then ask for an update check once per launch.
 *  - When a new worker takes control, reload EXACTLY once. The reload is
 *    guarded by a session flag so a worker that claims clients on first
 *    install can never put the app into a refresh loop.
 */

import { BUILD } from './build.js';

const RELOAD_FLAG = 'caesar_sw_reloaded';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log(`[pwa] registered (${BUILD.version})`);

      // A worker controlling the page for the first time is not an update.
      const hadController = !!navigator.serviceWorker.controller;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;                       // first install — nothing to refresh
        if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
      });

      // Clear the guard once we are running under a stable controller.
      if (hadController) {
        setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
      }

      try { await reg.update(); } catch { /* offline — keep the installed build */ }
    } catch (err) {
      console.warn('[pwa] registration failed', err);
    }
  });
}
