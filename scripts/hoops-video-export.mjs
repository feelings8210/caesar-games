/* Internal export prototype. Usage:
 * node scripts/hoops-video-export.mjs manifest.json output.webm
 * Manifest: {"playId":"horns-pop","locale":"zh","steps":[{"text":"...","audio":"clip.wav"}, ...]}
 * Or one uncut recording: {"audio":"narration.wav","steps":[{"text":"...","startMs":0}, ...]}.
 * Paths are relative to the manifest. Declared text must match the playbook;
 * this check cannot establish what is actually spoken in the audio.
 * Audio must already have passed the appropriate narration review. This tool
 * records silently to a file; it does not generate or approve narration. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { PLAYS } from '../js/games/hoops/playbook.js';
import { validateContinuousNarration } from './hoops-video-capture.mjs';

const [manifestArg, outputArg] = process.argv.slice(2);
if (!manifestArg || !outputArg || process.argv.length !== 4) throw new Error('Expected manifest.json and output.webm');
const manifestPath = path.resolve(manifestArg), outputPath = path.resolve(outputArg);
if (path.extname(outputPath).toLowerCase() !== '.webm') throw new Error('Output must use .webm');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const play = PLAYS.find(p => p.id === manifest.playId);
if (!play || !['zh', 'en'].includes(manifest.locale) || !Array.isArray(manifest.steps) || manifest.steps.length !== play.steps.length)
  throw new Error('Invalid play, locale, or number of narration clips');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const continuous = typeof manifest.audio === 'string' && !!manifest.audio;
manifest.steps.forEach((step, i) => {
  if (step.text !== play.steps[i].say[manifest.locale] ||
      (continuous ? !Number.isFinite(step.startMs) : typeof step.audio !== 'string' || !step.audio))
    throw new Error(`Narration text or audio path does not match step ${i + 1}`);
});
// Check inter-step timing before starting the browser; the last cue is
// checked again against the decoded recording's actual duration in capture.
if (continuous) validateContinuousNarration(play, { buffer: { duration: Infinity }, cuesMs: manifest.steps.map(s => s.startMs) });
const clips = (continuous ? [manifest.audio] : manifest.steps.map(step => step.audio)).map((audioPath, i) => {
  const file = path.resolve(path.dirname(manifestPath), audioPath);
  const bytes = fs.readFileSync(file);
  if (!bytes.length) throw new Error(`Empty audio at step ${i + 1}`);
  return { encoded: bytes.toString('base64'), sha256: sha256(bytes) };
});
if (manifest.alignment && (!continuous || manifest.alignment.audioSha256 !== clips[0].sha256))
  throw new Error('Aligned narration does not match the bound audio SHA256');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const handle = fs.openSync(outputPath, 'wx');
let reportHandle;
let success = false, browser, server;
try {
  reportHandle = fs.openSync(`${outputPath}.json`, 'wx');
  // The 3D court loads many ES modules at once. Python's small default accept
  // queue can reset module requests and silently make the game fall back to 2D.
  const serverCode = 'import functools,http.server,sys\nclass Server(http.server.ThreadingHTTPServer):\n request_queue_size=128\nh=functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])\ns=Server(("127.0.0.1",0),h)\nprint(s.server_port,flush=True)\ns.serve_forever()';
  server = spawn('python3', ['-u', '-c', serverCode, path.resolve(import.meta.dirname, '..')], { stdio: ['ignore', 'pipe', 'ignore'] });
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local server startup timed out')), 10000);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Local server exited: ${code}`)));
    server.stdout.once('data', data => { clearTimeout(timeout); resolve(Number(String(data).trim())); });
  });
  if (!Number.isInteger(port) || port < 1) throw new Error('Local server returned an invalid port');
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (['warning', 'error'].includes(msg.type())) warnings.push(msg.text()); });
  await page.goto(`${origin}/?hoopsQuality=low`);
  await page.waitForFunction(() => !!window.caesarApp, null, { timeout: 60000 });
  await page.click('#btn-hoops');
  const courtKind = await page.evaluate(async playId => {
    const game = window.caesarApp.hoops;
    await game.pb.open(playId);
    return game.root.dataset.court;
  }, manifest.playId);
  if (courtKind !== '3d') throw new Error(`3D court unavailable (${courtKind}): ${warnings.join('; ') || 'no browser warning'}`);
  const result = await page.evaluate(async ({ playId, locale, clips, continuous, cuesMs }) => {
    const { capturePlaybook } = await import('/scripts/hoops-video-capture.mjs');
    const game = window.caesarApp.hoops;
    await game.court.ready;
    const audio = new AudioContext(), events = [];
    try {
      const narration = [];
      for (const clip of clips) {
        const binary = atob(clip.encoded), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        narration.push(await audio.decodeAudioData(bytes.buffer));
      }
      const voice = continuous ? { continuousNarration: { buffer: narration[0], cuesMs } } : { narration };
      const video = await capturePlaybook({ court: game.court, play: game.pb.play, locale, ...voice, onEvent: event => events.push(event) });
      const bytes = new Uint8Array(await video.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      return { encoded: btoa(binary), type: video.type, events, narrationMs: narration.map(buffer => buffer.duration * 1000) };
    } finally { await audio.close(); game.leave(); }
  }, { playId: manifest.playId, locale: manifest.locale, clips, continuous, cuesMs: continuous ? manifest.steps.map(s => s.startMs) : [] });
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  const video = Buffer.from(result.encoded, 'base64');
  if (video.length < 1000) throw new Error('Recorded video is unexpectedly small');
  fs.writeFileSync(handle, video);
  const report = { schema: 'caesar-hoops-capture-observation-v1', playId: manifest.playId, locale: manifest.locale,
    manifestSha256: sha256(fs.readFileSync(manifestPath)), audioSha256: clips.map(c => c.sha256), videoSha256: sha256(video),
    narrationMs: result.narrationMs, cuesMs: continuous ? manifest.steps.map(s => s.startMs) : null, events: result.events,
    note: 'Browser event timestamps are observations, not verified encoded-media timestamps or narration QC.' };
  fs.writeFileSync(reportHandle, JSON.stringify(report, null, 2) + '\n'); success = true;
  console.log(JSON.stringify({ output: outputPath, bytes: video.length, type: result.type, narrationQC: 'not assessed' }));
} finally {
  await browser?.close();
  server?.kill();
  fs.closeSync(handle);
  if (reportHandle !== undefined) fs.closeSync(reportHandle);
  if (!success) fs.unlinkSync(outputPath);
  if (!success && reportHandle !== undefined) fs.unlinkSync(`${outputPath}.json`);
}
