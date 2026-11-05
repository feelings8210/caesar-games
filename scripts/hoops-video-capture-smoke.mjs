/* Development check: local server required. Captures synthetic test tones
 * directly into the file while Chromium's host output is muted. Verifies a
 * real recorded WebM can decode. Never use the tones as a deliverable. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const out = process.argv[2];
if (!out) throw new Error('Supply an evidence output directory');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { try { localStorage.setItem('caesar_games_muted', 'true'); } catch {} });
  await page.goto(process.env.HOOPS_URL || 'http://127.0.0.1:8197/?hoopsQuality=low');
  await page.waitForFunction(() => !!window.caesarApp, null, { timeout: 60000 });
  await page.click('#btn-hoops');
  const result = await page.evaluate(async () => {
    const { capturePlaybook } = await import('/scripts/hoops-video-capture.mjs');
    const game = window.caesarApp.hoops;
    await game.pb.open('horns-pop'); await game.court.ready;
    const ac = new AudioContext();
    const clips = game.pb.play.steps.map((_, index) => {
      const buffer = ac.createBuffer(1, Math.round(ac.sampleRate * .6), ac.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = .15 * Math.sin(2 * Math.PI * (450 + index * 150) * i / ac.sampleRate);
      return buffer;
    });
    const blob = await capturePlaybook({ court: game.court, play: game.pb.play, locale: 'en', narration: clips, width: 640, height: 360, fps: 15 });
    await ac.close(); game.leave();
    const video = document.createElement('video'); video.muted = true; video.src = URL.createObjectURL(blob);
    video.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:black;z-index:99999';
    document.body.appendChild(video);
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Recorded video could not be decoded')); });
    await video.play();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { bytes: blob.size, type: blob.type, width: video.videoWidth, height: video.videoHeight, encoded: btoa(binary) };
  });
  fs.writeFileSync(`${out}/capture-test.webm`, Buffer.from(result.encoded, 'base64'));
  delete result.encoded;
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/decoded-frame.png` });
  result.playbackSeconds = await page.evaluate(() => document.querySelector('video').currentTime);
  if (result.bytes < 1000 || result.width !== 640 || result.height !== 360 || result.playbackSeconds < 1 || errors.length) throw new Error(`Capture check failed: ${JSON.stringify({ result, errors })}`);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ result, errors, narration: 'synthetic test tones; host muted; not for delivery' }, null, 2));
  console.log(JSON.stringify({ result, errors }));
} finally {
  await browser.close();
}
