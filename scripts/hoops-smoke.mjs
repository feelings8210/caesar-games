/* Hoops IQ browser smoke: plays every level in Chromium, tapping the best
 * read on each (dragging on level 1), and captures review screenshots.
 *
 *   node scripts/hoops-smoke.mjs [outDir]
 *
 * Uses the globally installed Playwright; set CHROMIUM_PATH to override the
 * browser binary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');

const port = 8123;
const origin = `http://127.0.0.1:${port}`;
const outDir = path.resolve(process.argv[2] || 'review/hoops-v2.1.0');
fs.mkdirSync(outDir, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const errors = [];
const report = { levels: [] };

try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* booting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: `${outDir}/00-home.png` });

  await page.click('#btn-hoops');
  await page.waitForSelector('.hoops[data-view="menu"] .hp-level');
  await page.screenshot({ path: `${outDir}/01-menu.png` });

  const phase = () => page.getAttribute('#hoops-root', 'data-phase');
  const waitPhase = (p, timeout = 12000) =>
    page.waitForFunction(v => document.querySelector('#hoops-root').dataset.phase === v, p, { timeout });

  const levelCount = await page.locator('.hp-level').count();
  for (let i = 0; i < levelCount; i++) {
    if (i === 0) await page.click('.hp-level[data-index="0"]');
    await waitPhase('decide');
    if (i === 0 || i === 6) await page.screenshot({ path: `${outDir}/${String(i + 2).padStart(2, '0')}-L${i + 1}-decide.png` });

    const best = await page.evaluate(async idx => {
      const { LEVELS } = await import('./js/games/hoops/levels.js');
      return LEVELS[idx].options.findIndex(o => o.grade === 3);
    }, i);
    const target = page.locator(`.hc-target[data-opt="${best}"] .hc-hit`);
    const box = await target.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (i === 0) {
      // Drag yourself onto the spot.
      const me = await page.locator('.hc-player .hc-you-ring').boundingBox();
      await page.mouse.move(me.x + me.width / 2, me.y + me.height / 2);
      await page.mouse.down();
      await page.mouse.move((me.x + cx) / 2, (me.y + cy) / 2, { steps: 6 });
      await page.mouse.move(cx, cy, { steps: 6 });
      await page.mouse.up();
    } else {
      await page.mouse.click(cx, cy);
    }

    await waitPhase('review');
    await page.waitForTimeout(900);
    const stars = await page.locator('.hp-verdict .hp-stars i.is-on').count();
    const verdict = await page.textContent('.hp-verdict-text');
    report.levels.push({ level: i + 1, best, stars, verdict });
    if ([0, 2, 6, 9].includes(i)) await page.screenshot({ path: `${outDir}/L${i + 1}-review.png` });
    await page.click('.hp-next');
  }

  // Wrong read, then the demo of the best read (level 2, Chinese UI).
  await page.waitForSelector('.hoops[data-view="menu"]');
  await page.screenshot({ path: `${outDir}/20-menu-complete.png` });
  await page.click('#btn-language');
  await page.click('.hp-level[data-index="1"]');
  await waitPhase('decide');
  await page.screenshot({ path: `${outDir}/21-L2-decide-zh.png` });
  const wrong = page.locator('.hc-target.is-shoot .hc-hit');
  const wb = await wrong.boundingBox();
  await page.mouse.click(wb.x + wb.width / 2, wb.y + wb.height / 2);
  await waitPhase('review');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/22-L2-wrong-zh.png` });
  await page.click('.hp-best');
  await waitPhase('demo');
  await waitPhase('review');
  await page.screenshot({ path: `${outDir}/23-L2-demo-zh.png` });

  // Let the decision clock run out.
  await page.click('.hp-retry');
  await waitPhase('decide');
  await waitPhase('review', 15000);
  report.timeoutVerdict = await page.textContent('.hp-verdict-text');

  // Home and back resets cleanly mid-level.
  await page.click('.hp-retry');
  await waitPhase('intro');
  await page.click('#btn-home');
  await page.waitForSelector('[data-screen="home"].is-active');
  report.leftMidLevelPhase = await phase();

  // Phone portrait.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#btn-hoops');
  await page.click('.hp-level[data-index="2"]');
  await waitPhase('decide');
  await page.screenshot({ path: `${outDir}/30-phone-decide.png` });
  report.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  report.soundCues = await page.evaluate(() => [...new Set(
    (window.__cues || []))]);
  await browser.close();
} finally {
  server.kill();
}

report.errors = errors;
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
