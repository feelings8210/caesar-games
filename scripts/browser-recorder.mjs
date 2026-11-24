/* Browser screen recorder for explainers and game captures.
 *
 *   import { launchRecorder } from './browser-recorder.mjs';
 *   const rec = await launchRecorder({ outDir, width: 1280, height: 720 });
 *   await rec.page.goto(url); ... drive the page ...
 *   const file = await rec.finish('take-01');   // -> <outDir>/take-01.webm
 *
 * Silent (--mute-audio), headless Chrome, VP8 WebM at 25 fps, exactly
 * width × height. Transcode for delivery with scripts/hoops-video-transcode.sh
 * or ffmpeg on the 3090.
 *
 * Why the odd window: headless Chrome on macOS keeps ~87 px of the window for
 * browser chrome. With an emulated viewport the recording then loses the
 * bottom 80 rows (grey padding). Using the real window as the viewport and
 * making it taller by that margin records the full page.
 *
 * Media must not land on the Mac system disk (media rules): outDir has to be
 * on /Volumes/MiniStorage (Mac), /srv/ (3090s) or D:\ai-render (the 3080 Ti
 * Windows box), or pass allowAnyDir for a non-media test.
 *
 * On the 3080 Ti: PLAYWRIGHT_MODULE=D:\ai-render\tools\browser-recorder\node_modules\playwright,
 * PLAYWRIGHT_BROWSERS_PATH=D:\ai-render\tools\browser-recorder\browsers, no CHROMIUM_PATH
 * (uses Playwright's own Chromium with the GPU through ANGLE).
 *
 * Env: PLAYWRIGHT_MODULE (path to a playwright package), CHROMIUM_PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const CHROME_UI_PX = 87;

export async function launchRecorder({ outDir, width = 1280, height = 720, record = true, allowAnyDir = false, args = [] } = {}) {
  const dir = path.resolve(outDir);
  const allowed = dir.startsWith('/Volumes/MiniStorage/') || dir.startsWith('/srv/') || /^d:\\ai-render\\/i.test(dir);
  if (record && !allowAnyDir && !allowed) {
    throw new Error(`Recorder output must be on /Volumes/MiniStorage, /srv or D:\\ai-render (got ${dir})`);
  }
  fs.mkdirSync(dir, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--mute-audio', `--window-size=${width},${height + CHROME_UI_PX}`, ...args]
  });
  const raw = path.join(dir, '.recorder-raw');
  const context = await browser.newContext({
    viewport: null,
    ...(record ? { recordVideo: { dir: raw, size: { width, height } } } : {})
  });
  const page = await context.newPage();
  let inner = await page.evaluate(() => [innerWidth, innerHeight]);
  if (inner[0] !== width || inner[1] !== height) {
    // The browser-chrome margin differs by platform: grow the window by what is missing.
    try {
      const cdp = await context.newCDPSession(page);
      const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: bounds.width + width - inner[0], height: bounds.height + height - inner[1] } });
      await page.waitForTimeout(150);
      inner = await page.evaluate(() => [innerWidth, innerHeight]);
    } catch (e) { console.warn('[recorder] could not resize the window:', e.message); }
    if (inner[0] !== width || inner[1] !== height) console.warn(`[recorder] page is ${inner.join('x')}, wanted ${width}x${height}`);
  }
  return {
    browser, context, page, inner,
    /** Close the take; returns the WebM path (null when not recording). */
    async finish(name) {
      const video = page.video();
      await context.close();
      await browser.close();
      if (!video) return null;
      const file = path.join(dir, `${name}.webm`);
      fs.renameSync(await video.path(), file);
      try { fs.rmdirSync(raw); } catch { /* other takes still there */ }
      return file;
    }
  };
}
