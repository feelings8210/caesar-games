/* Hoops IQ live-possession check: plays the horns possession in silent
 * headless Chrome for each coverage (best reads, one wrong read with the
 * best-play demo, a forced pull-up), saves screenshots at every read and at
 * review, writes report.json, and with RECORD=1 a WebM per possession.
 *
 *   PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… node scripts/hoops-possession-check.mjs <outDir>
 *   env: RUNS=2,3 (subset)  VIEW=1280x720  RECORD=1  LOCALE=zh|en
 *
 * outDir must be on /Volumes/MiniStorage (media rules).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchRecorder } from './browser-recorder.mjs';
import { serveStatic } from './static-server.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || '');
const [VW, VH] = (process.env.VIEW || '1280x800').split('x').map(Number);
const locale = process.env.LOCALE || 'zh';
const server = await serveStatic(repo);
const { origin } = server;
const errors = [];
const report = [];

const ALL_RUNS = [
  { cov: 'drop', picks: ['best'] },
  { cov: 'switch', picks: ['best', 'best'] },
  { cov: 'hedge', picks: ['best', 'best'] },
  { cov: 'hedge', picks: ['best', 'worst'], demo: true },
  { cov: 'switch', picks: ['shoot'] }
];
const RUNS = process.env.RUNS ? ALL_RUNS.filter((_, i) => process.env.RUNS.split(',').includes(String(i + 1))) : ALL_RUNS;

let rec = null;
try {
  for (const [k, run] of RUNS.entries()) {
    const tag = `${String(k + 1).padStart(2, '0')}-${run.cov}-${run.picks.join('-')}`;
    rec = await launchRecorder({ outDir, width: VW, height: VH, record: !!process.env.RECORD });
    const { page } = rec;
    page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
    await page.goto(`${origin}/?hoopsDecide=12&hoopsCoverage=${run.cov}`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const loc = () => page.evaluate(async () => (await import('./js/i18n/strings.js')).getLocale());
    if (await loc() !== locale) { await page.click('#btn-language'); await page.waitForTimeout(200); }
    if (await loc() !== locale) throw new Error(`could not switch to ${locale}`);
    await page.click('#btn-hoops');
    await page.waitForSelector('.hoops[data-view="menu"]');
    await page.click('.hp-tab[data-tab="read"]');
    if (k === 0) { await page.waitForTimeout(800); await page.screenshot({ path: `${outDir}/00-menu-read-tab.png` }); }
    await page.click('.hp-live-start');
    const waitPhase = (p, timeout = 40000) => page.waitForFunction(v => document.querySelector('#hoops-root').dataset.phase === v, p, { timeout });
    const entry = { tag, reads: [] };
    for (const [r, pick] of run.picks.entries()) {
      await waitPhase('decide');
      await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/${tag}-read${r + 1}.png` });
      const idx = await page.evaluate(pick => {
        const o = window.caesarApp.hoops.level.options;
        if (pick === 'best') return o.findIndex(x => x.grade === 3);
        if (pick === 'shoot') return o.findIndex(x => x.kind === 'shoot');
        let w = 0; o.forEach((x, i) => { if (x.grade < o[w].grade) w = i; }); return w;
      }, pick);
      const info = await page.evaluate(() => ({ node: window.caesarApp.hoops.level.node, you: window.caesarApp.hoops.level.you, chips: [...document.querySelectorAll('.hc3-chip.is-you')].map(c => c.textContent) }));
      entry.reads.push({ ...info, pick, idx });
      const clicked = await page.evaluate(i => {
        const b = [...document.querySelectorAll(`button[data-choice="${i}"]`)].find(x => x.offsetParent && !x.disabled);
        if (!b) return false; b.click(); return true;
      }, idx);
      if (!clicked) throw new Error(`${tag}: no visible choice ${idx}`);
    }
    await waitPhase('review');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${tag}-review.png` });
    entry.review = await page.evaluate(() => ({
      title: document.querySelector('.hp-title').textContent,
      eyebrow: document.querySelector('.hp-level-eyebrow').textContent,
      result: document.querySelector('.hp-result').textContent,
      summary: document.querySelector('.hp-summary').innerText,
      next: document.querySelector('.hp-next').textContent,
      hud: document.querySelector('.hp-hud-score').textContent,
      shot: window.caesarApp.hoops.shotInfo || null
    }));
    if (run.demo) {
      await page.click('.hp-best');
      await waitPhase('demo');
      await waitPhase('review');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${outDir}/${tag}-after-demo.png` });
      entry.demoResult = await page.evaluate(() => document.querySelector('.hp-result').textContent);
    }
    if (k === 0) {
      // A second possession from the review button proves the loop and the running score.
      await page.click('.hp-next');
      await waitPhase('decide');
      entry.secondPossession = await page.evaluate(() => ({ eyebrow: document.querySelector('.hp-level-eyebrow').textContent, hud: document.querySelector('.hp-hud-score').textContent }));
    }
    entry.video = await rec.finish(tag);
    rec = null;
    report.push(entry);
  }
} catch (e) {
  errors.push(`fatal: ${e.stack || e.message}`);
} finally {
  if (rec) await rec.browser.close().catch(() => {});
  await server.close();
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify({ errors, possessions: report.map(r => [r.tag, r.review?.result]) }, null, 2));
}
