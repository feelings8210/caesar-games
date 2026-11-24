/* Screenshot every main screen (home, Hoops menu tabs, a level intro) for UI
 * review. Silent headless Chrome; output must be on /Volumes/MiniStorage.
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… node scripts/ui-screens.mjs <outDir> [WxH] [zh|en]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchRecorder } from './browser-recorder.mjs';
import { serveStatic } from './static-server.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || '');
const [W, H] = (process.argv[3] || '1180x820').split('x').map(Number);
const locale = process.argv[4] || 'zh';
if (!outDir.startsWith('/Volumes/MiniStorage/')) throw new Error('outDir must be on /Volumes/MiniStorage');
const server = await serveStatic(repo);
const rec = await launchRecorder({ outDir, width: W, height: H, record: false });
const { page } = rec;
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shot = async name => { await page.waitForTimeout(700); await page.screenshot({ path: `${outDir}/${W}x${H}-${name}.png` }); };
try {
  await page.goto(`${server.origin}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const loc = () => page.evaluate(async () => (await import('./js/i18n/strings.js')).getLocale());
  if (await loc() !== locale) await page.click('#btn-language');
  await shot('01-home');
  await page.click('#btn-hoops');
  await page.waitForSelector('.hoops[data-view="menu"]');
  for (const tab of ['chapter', 'read', 'playbook', 'stats']) {
    await page.click(`.hp-tab[data-tab="${tab}"]`);
    await shot(`02-hoops-${tab}`);
  }
  await page.click('.hp-tab[data-tab="chapter"]');
  await page.click('.hp-level[data-index="0"]');
  await page.waitForFunction(() => document.querySelector('#hoops-root').dataset.phase === 'title', null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${W}x${H}-03-level-title.png` });
} finally {
  await rec.finish('unused');
  await server.close();
  console.log(JSON.stringify({ errors }));
}
