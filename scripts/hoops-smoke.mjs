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
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: Number(process.env.DSF || 1) });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const decide = Number(process.env.HOOPS_DECIDE || 90);
  await page.goto(`${origin}/?hoopsDecide=${decide}${process.env.HOOPS_2D ? '&hoops2d=1' : ''}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: `${outDir}/00-home.png` });

  await page.click('#btn-hoops');
  await page.waitForSelector('.hoops[data-view="menu"] .hp-level');
  await page.screenshot({ path: `${outDir}/01-menu.png` });

  const phase = () => page.getAttribute('#hoops-root', 'data-phase');
  const waitPhase = (p, timeout = 30000) =>
    page.waitForFunction(v => document.querySelector('#hoops-root').dataset.phase === v, p, { timeout });

  const levelCount = await page.locator('.hp-level').count();
  for (let i = 0; i < levelCount; i++) {
    if (i === 0) await page.click('.hp-level[data-index="0"]');
    await waitPhase('decide');
    if (i === 0 || i === 6) await page.screenshot({ path: `${outDir}/${String(i + 2).padStart(2, '0')}-L${i + 1}-push.png` });

    const best = await page.evaluate(async idx => {
      const { LEVELS } = await import('./js/games/hoops/levels.js');
      return LEVELS[idx].options.findIndex(o => o.grade === 3);
    }, i);
    await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
    if (i === 0 || i === 6) await page.screenshot({ path: `${outDir}/${String(i + 2).padStart(2, '0')}-L${i + 1}-decide.png` });
    const point = await page.evaluate(i => window.caesarApp.hoops.court.targetClientPoint(i), best);
    if (!point) throw new Error(`level ${i + 1}: no target point (phase ${await phase()})`);
    const [cx, cy] = point;

    if (i === 0) {
      // Drag yourself onto the spot.
      const [mx, my] = await page.evaluate(() => {
        const h = window.caesarApp.hoops;
        return h.court.actorClientPoint(h.level.you);
      });
      await page.mouse.move(mx, my);
      await page.mouse.down();
      await page.mouse.move((mx + cx) / 2, (my + cy) / 2, { steps: 6 });
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

  // Read & React: four best reads, then a deliberate wrong one ends the run.
  await page.click('.hp-tab[data-tab="read"]');
  await page.screenshot({ path: `${outDir}/24-read-menu.png` });
  await page.click('.hp-read-start');
  report.read = [];
  for (let r = 0; r < 5; r++) {
    await waitPhase('decide', 60000);
    if (r === 0) await page.screenshot({ path: `${outDir}/25-read-decide.png` });
    await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
    if (r === 1 && await page.isVisible('.hp-view')) {
      await page.click('.hp-view');
      await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
      await page.screenshot({ path: `${outDir}/26-read-player-view.png` });
      await page.click('.hp-view');
      await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
    }
    const pick = await page.evaluate(last => {
      const opts = window.caesarApp.hoops.level.options;
      return last ? opts.findIndex(o => o.grade === 0) : opts.findIndex(o => o.grade === 3);
    }, r === 4);
    const pt = await page.evaluate(i => window.caesarApp.hoops.court.targetClientPoint(i), pick);
    if (!pt) throw new Error(`read round ${r + 1}: no target point (phase ${await phase()})`);
    await page.mouse.click(pt[0], pt[1]);
    await waitPhase('review', 30000);
    await page.waitForTimeout(600);
    report.read.push(await page.evaluate(() => {
      const h = window.caesarApp.hoops;
      return { family: h.level.family, variant: h.level.id, mirrored: !!h.level.mirrored, streak: h.streak, over: h.readOver,
        summary: document.querySelector('.hp-summary').textContent, title: document.querySelector('.hp-title').textContent };
    }));
    if (r === 3) await page.screenshot({ path: `${outDir}/27-read-review.png` });
    if (r < 4) await page.click('.hp-next');
  }
  await page.screenshot({ path: `${outDir}/28-read-over.png` });
  await page.click('.hp-back');
  await page.click('.hp-tab[data-tab="stats"]');
  report.statsRows = await page.locator('.hp-stat-rows li').count();
  await page.screenshot({ path: `${outDir}/29-stats.png` });
  // Playbook: watch two steps of 5-out, then walk it as #1.
  await page.click('.hp-tab[data-tab="playbook"]');
  await page.screenshot({ path: `${outDir}/40-playbook-menu.png` });
  await page.click('[data-play="five-out"]');
  await page.waitForSelector('.hoops[data-phase="pb"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/41-pb-watch-step1.png` });
  for (let k = 0; k < 2; k++) {
    await page.click('.hp-pb-next');
    await page.waitForFunction(n => window.caesarApp.hoops.pb.step === n && !window.caesarApp.hoops.pb.busy, k + 1, { timeout: 60000 });
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/42-pb-watch-step3.png` });
  await page.click('.hp-pb-mode[data-pb-mode="walk"]');
  await page.click('[data-role="o1"]');
  const pb = () => page.evaluate(() => { const m = window.caesarApp.hoops.pb; return { step: m.step, waiting: m.waiting, done: m.done, task: m.waiting ? m.tasks[m.taskIndex] : null, score: m.score }; });
  for (let guard = 0; guard < 12; guard++) {
    await page.waitForFunction(() => { const m = window.caesarApp.hoops.pb; return m.waiting || m.done; }, null, { timeout: 60000 });
    const st = await pb();
    if (st.done) break;
    await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
    if (st.task.kind === 'pass') {
      const [x, y] = await page.evaluate(id => window.caesarApp.hoops.court.actorClientPoint(id), st.task.to);
      await page.mouse.click(x, y);
    } else {
      const [mx, my] = await page.evaluate(() => window.caesarApp.hoops.court.actorClientPoint('o1'));
      const [tx, ty] = await page.evaluate(at => window.caesarApp.hoops.court.courtClientPoint(at), st.task.at);
      await page.mouse.move(mx, my);
      await page.mouse.down();
      await page.mouse.move((mx + tx) / 2, (my + ty) / 2, { steps: 5 });
      await page.mouse.move(tx, ty, { steps: 5 });
      await page.mouse.up();
    }
    if (guard === 0) { await page.waitForTimeout(300); await page.screenshot({ path: `${outDir}/43-pb-walk.png` }); }
    await page.waitForFunction(s => { const m = window.caesarApp.hoops.pb; return m.done || m.step !== s.step || m.taskIndex > 0 || !m.waiting; }, st, { timeout: 60000 });
  }
  report.playbook = await pb();
  await page.screenshot({ path: `${outDir}/44-pb-done.png` });
  await page.click('.hp-back');
  await page.click('.hp-tab[data-tab="chapter"]');
  await page.click('#btn-language');
  await page.click('.hp-level[data-index="1"]');
  await waitPhase('decide');
  report.court = await page.getAttribute('#hoops-root', 'data-court');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${outDir}/21-L2-decide-zh.png` });
  await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled?.() ?? true, null, { timeout: 90000 });
  const shootIdx = await page.evaluate(() => window.caesarApp.hoops.level.options.findIndex(o => o.kind === 'shoot'));
  const [wx, wy] = await page.evaluate(i => window.caesarApp.hoops.court.targetClientPoint(i), shootIdx);
  await page.mouse.click(wx, wy);
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
  await waitPhase('review', (decide + 25) * 1000);
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
  console.log('ERRORS', JSON.stringify(errors.slice(0, 6)));
  server.kill();
}

report.errors = errors;
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
