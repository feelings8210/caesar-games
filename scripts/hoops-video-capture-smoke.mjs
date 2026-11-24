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
    const events = [];
    const blob = await capturePlaybook({ court: game.court, play: game.pb.play, locale: 'en', narration: clips, width: 640, height: 360, fps: 15, onEvent: event => events.push(event) });
    await ac.close(); game.leave();
    const video = document.createElement('video'); video.muted = true; video.src = URL.createObjectURL(blob);
    video.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:black;z-index:99999';
    document.body.appendChild(video);
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error('Recorded video could not be decoded')); });
    await video.play();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { bytes: blob.size, type: blob.type, width: video.videoWidth, height: video.videoHeight, encoded: btoa(binary), events };
  });
  fs.writeFileSync(`${out}/capture-test.webm`, Buffer.from(result.encoded, 'base64'));
  delete result.encoded;
  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/decoded-frame.png` });
  result.playbackSeconds = await page.evaluate(() => document.querySelector('video').currentTime);
  // Verify actual browser playback, including silent gaps between clips. A
  // decoded PCM array alone can conceal collapsed WebM packet timestamps.
  result.toneStarts = await page.evaluate(async () => {
    const video = document.querySelector('video'); video.pause(); video.currentTime = 0; video.muted = false;
    const ac = new AudioContext(), source = ac.createMediaElementSource(video), analyser = ac.createAnalyser(), gain = ac.createGain();
    gain.gain.value = 0; source.connect(analyser); analyser.connect(gain); gain.connect(ac.destination); analyser.fftSize = 2048;
    const bins = new Float32Array(analyser.frequencyBinCount), starts = [null, null, null, null];
    try {
      await ac.resume(); await video.play();
      while (!video.ended) {
        analyser.getFloatFrequencyData(bins);
        const energy = [450, 600, 750, 900].map(hz => bins[Math.round(hz * analyser.fftSize / ac.sampleRate)]);
        for (let i = 0; i < starts.length; i++) if (starts[i] === null && energy[i] > -45 && energy[i] > Math.max(...energy.filter((_, j) => i !== j)) + 6) starts[i] = video.currentTime;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      return starts;
    } finally { source.disconnect(); analyser.disconnect(); gain.disconnect(); await ac.close(); }
  });
  for (let i = 0; i < result.toneStarts.length; i++) {
    const expected = result.events.find(e => e.type === 'voice-start' && e.step === i).elapsedMs / 1000;
    if (result.toneStarts[i] === null || Math.abs(result.toneStarts[i] - expected) > .3)
      throw new Error(`Recorded tone ${i} is out of sync: ${result.toneStarts[i]} vs ${expected}`);
  }
  if (result.bytes < 1000 || result.width !== 640 || result.height !== 360 || result.playbackSeconds < 1 || errors.length) throw new Error(`Capture check failed: ${JSON.stringify({ result, errors })}`);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ result, errors, narration: 'synthetic test tones; host muted; not for delivery' }, null, 2));
  console.log(JSON.stringify({ result, errors }));
} finally {
  await browser.close();
}
