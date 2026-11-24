/* Regressions for active mute, cancelled voice loads, GPU lifetime and 2D input.
 * PLAYWRIGHT_MODULE / CHROMIUM_PATH override the local browser installation.
 * node scripts/hoops-regression.mjs [output directory]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const out = path.resolve(process.argv[2] || 'review/hoops-regression');
fs.mkdirSync(out, { recursive: true });
const origin = 'http://127.0.0.1:8125';
const server = spawn('python3', ['-m', 'http.server', '8125', '--bind', '127.0.0.1'], { stdio: 'ignore' });
const report = { checks: [], errors: [] };
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.addInitScript(() => {
    window.__qaSources = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__qaSources.push({ duration: this.buffer?.duration, loop: this.loop, at: performance.now() });
      return start.apply(this, args);
    };
    const compressor = AudioContext.prototype.createDynamicsCompressor;
    AudioContext.prototype.createDynamicsCompressor = function (...args) {
      const node = compressor.apply(this, args);
      window.__qaFinal = node;
      return node;
    };
  });
  await page.goto(`${origin}/?hoopsLook=arena&hoopsDecide=150`);
  await page.click('#btn-hoops');
  await page.click('.hp-level[data-index="0"]');
  await page.waitForFunction(() => window.caesarApp.hoops.phase === 'decide');
  for (const shot of ['pov', 'decide']) {
    await page.click('.hp-view');
    await page.waitForFunction(() => window.caesarApp.hoops.court.cameraSettled(), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.caesarApp.hoops.court.shot), shot);
  }
  report.checks.push({ name: 'player-view-and-return-settle', passed: true });
  await page.evaluate(async () => {
    const { sounds } = await import('./js/engine/sound.js');
    const { hoopsAudio, stopVoice } = await import('./js/games/hoops/audio.js');
    hoopsAudio.stopCrowd(); stopVoice();
    const analyser = sounds.ctx.createAnalyser();
    window.__qaFinal.connect(analyser);
    window.__qaRms = () => {
      const a = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(a);
      return Math.sqrt(a.reduce((sum, x) => sum + x * x, 0) / a.length);
    };
    hoopsAudio.voice('level_10_rule', 'en');
  });
  await page.waitForFunction(() => window.__qaRms() > 0.005);
  const audible = await page.evaluate(() => window.__qaRms());
  await page.click('#btn-sound');
  await page.waitForTimeout(400); // Allow the compressor's tail to clear.
  const muted = await page.evaluate(async () => {
    const { sounds } = await import('./js/engine/sound.js');
    return { rms: window.__qaRms(), gain: sounds.master.gain.value, muted: sounds.isMuted };
  });
  assert.ok(audible > 0.005 && muted.muted && muted.rms < 0.00001 && muted.gain === 0, 'active audio must become silent');
  report.checks.push({ name: 'active-mute', audible, ...muted });
  await page.click('#btn-sound');
  await page.waitForTimeout(1500); // Clear the toggle's UI cue and hall reverb.
  assert.ok(await page.evaluate(() => window.__qaRms() < 0.00001), 'unmute must not resurrect the coach line');
  report.checks.push({ name: 'unmute-does-not-replay', passed: true });

  await page.evaluate(async () => {
    const original = window.fetch;
    window.__qaGate = new Promise(r => window.__qaRelease = r);
    window.fetch = async function (input, ...args) {
      if (String(input).endsWith('/voice/en/level_09_rule.mp3')) {
        window.__qaFetchSeen = true; await window.__qaGate;
      }
      return original.call(this, input, ...args);
    };
    window.__qaRestoreFetch = () => { window.fetch = original; };
    const { hoopsAudio } = await import('./js/games/hoops/audio.js');
    window.__qaVoiceDone = hoopsAudio.voice('level_09_rule', 'en');
  });
  await page.waitForFunction(() => window.__qaFetchSeen);
  await page.click('#btn-home');
  await page.waitForTimeout(800);
  const count = await page.evaluate(() => window.__qaSources.length);
  await page.evaluate(async () => { window.__qaRelease(); await window.__qaVoiceDone; window.__qaRestoreFetch(); });
  const after = await page.evaluate(() => ({ screen: window.caesarApp.state, count: window.__qaSources.length, rms: window.__qaRms() }));
  assert.equal(after.screen, 'HOME'); assert.equal(after.count, count); assert.ok(after.rms < 0.00001);
  report.checks.push({ name: 'leave-cancels-pending-voice', ...after });

  await page.click('#btn-hoops'); await page.click('.hp-level[data-index="0"]');
  await page.waitForFunction(() => window.caesarApp.hoops.phase === 'decide');
  const contact = await page.evaluate(() => {
    const c = window.caesarApp.hoops.court, snap = c.snapshot();
    c.ball.holder = null;
    const f = { kind: 'pass', target: 'o3', from: [0, 20], fromY: 4, e: 1 };
    c.ball.flight = f; c._renderBall(0);
    const hand = c.players.o3.athlete.ballPosition(c.ballMesh.position.clone());
    const handError = hand.distanceTo(c.ballMesh.position);
    c.ball.flight = null; c.ball.rest = 'made'; c._swish(); c._renderBall(0);
    const rimY = c.ballMesh.position.y;
    c._madeBall.elapsed = 0.2; c._renderBall(0);
    const netY = c.ballMesh.position.y;
    c._madeBall.elapsed = 3; c._renderBall(0);
    const floorY = c.ballMesh.position.y;
    c.restore(snap);
    return { handError, rimY, netY, floorY };
  });
  assert.ok(contact.handError < 0.00001, 'pass endpoint must reach the receiver hand');
  assert.ok(contact.rimY === 10.3 && contact.netY > 8 && contact.netY < contact.rimY && contact.floorY === 0.45, 'made ball must fall through the net before settling');
  report.checks.push({ name: 'receiver-contact-and-net-drop', ...contact });

  const memory = await page.evaluate(() => {
    const h = window.caesarApp.hoops, c = h.court, rows = [];
    for (let i = 0; i < 30; i++) {
      c.setScene(h.level.setup, h.level.you);
      c.showTargets(h.level.options, h.level.you);
      c.showCue(h.level.cue);
      c.showDiagram([{ type: 'cut', team: 'o', pts: [[0, 20], [4, 7]] }]);
      c.renderer.render(c.scene, c.camera);
      rows.push({ ...c.renderer.info.memory });
    }
    return rows;
  });
  const warm = memory.slice(2);
  for (const key of ['geometries', 'textures']) assert.ok(Math.max(...warm.map(r => r[key])) - Math.min(...warm.map(r => r[key])) <= 2, `${key} must plateau across 30 scene replacements`);
  report.checks.push({ name: '30-scene-resource-plateau', memory });
  await page.screenshot({ path: `${out}/3d-after-30-scenes.png` });

  await page.goto(`${origin}/?hoops2d=1&hoopsDecide=150`);
  await page.click('#btn-hoops'); await page.click('.hp-level[data-index="0"]');
  await page.waitForFunction(() => window.caesarApp.hoops.phase === 'decide');
  for (const mirrored of [false, true]) {
    await page.evaluate(async mirror => {
      const { VARIANTS } = await import('./js/games/hoops/levels.js');
      const { mirrorLevel } = await import('./js/games/hoops/families.js');
      const h = window.caesarApp.hoops;
      h.mode = 'read'; h.streak = 0; h.round = 1; h.readOver = false;
      let level = VARIANTS.find(l => l.id === 'break-stay');
      if (mirror) level = mirrorLevel(level);
      h._run({ ...level, family: 'break' }, 'QA');
    }, mirrored);
    await page.waitForFunction(() => window.caesarApp.hoops.phase === 'decide');
    const point = await page.evaluate(() => window.caesarApp.hoops.court.targetClientPoint(1));
    await page.mouse.click(...point);
    await page.waitForFunction(() => window.caesarApp.hoops.phase === 'review');
    const choice = await page.evaluate(() => { const h = window.caesarApp.hoops; return { choice: h.choice, grade: h.level.options[h.choice].grade }; });
    assert.equal(choice.choice, 1); assert.equal(choice.grade, 3);
    report.checks.push({ name: '2d-best-target-centre', mirrored, ...choice });
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (e) {
  report.failure = e.stack;
  process.exitCode = 1;
} finally {
  await browser?.close(); server.kill();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
