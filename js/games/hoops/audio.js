/* Caesar Games — Hoops IQ sound
 *
 * A gym, synthesized. Every cue rides the shared SoundEngine (its context,
 * master bus, noise buffer and mute switch) and adds a short hall reverb so
 * the ball, sneakers and whistle sound like they share one room.
 *
 * Like the rest of the app, sound is decoration: nothing a player must know is
 * carried by audio alone.
 */

import { sounds } from '../../engine/sound.js';

const MEDIA = new URL('../../../assets/hoops/', import.meta.url).href;
// Recorded variants per cue (deliver/sfx, all CC0 — see assets/hoops/CREDITS.md).
const SAMPLES = { dribble: 4, squeak: 4, catch: 3, pass: 2, swish: 3, rim: 3, backboard: 2, block: 2, whistle: 2, buzzer: 1, cheer: 3, groan: 2 };
const VOICE_KEY = 'caesar_hoops_voice';

let bus = null;
const bank = {};                 // cue -> AudioBuffer[]
const voiceCache = new Map();    // url -> Promise<AudioBuffer|null>
let preloading = null;
let crowd = null;                // { src, gain }
let voiceNow = null;
const lastPick = {};

function ready(cue) {
  const ctx = sounds._ready(`hoops.${cue}`);
  if (!ctx || !sounds.master || !sounds.noise) return null;
  if (bus?.ctx !== ctx) bus = buildBus(ctx);
  return ctx;
}

function buildBus(ctx) {
  // out → muffle (low-pass, closes on the freeze) → master, plus a hall send.
  const out = ctx.createGain();
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 20000;
  muffle.Q.value = 0.5;
  out.connect(muffle);
  muffle.connect(sounds.master);
  const voice = ctx.createGain();
  voice.gain.value = 1.15;
  voice.connect(sounds.master);

  // A generated impulse: dense early reflections, ~1.3 s decaying tail.
  const seconds = 1.3;
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 4200;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  muffle.connect(verb); verb.connect(tone); tone.connect(wet); wet.connect(sounds.master);
  return { ctx, out, muffle, voice };
}

const vary = (v, amt = 0.06) => v * (1 + (Math.random() * 2 - 1) * amt);

function env(ctx, t, { gain, attack = 0.003, decay = 0.1, hold = 0 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
  if (hold) g.gain.setValueAtTime(Math.max(gain, 0.0002), t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  g.connect(bus.out);
  return g;
}

function noise(ctx, t, { type = 'bandpass', freq = 1200, to = null, q = 1, gain = 0.1, attack, decay = 0.05, hold = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = sounds.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(vary(freq), t);
  const end = t + (attack ?? 0.003) + hold + decay;
  if (to) f.frequency.exponentialRampToValueAtTime(to, end);
  src.connect(f); f.connect(env(ctx, t, { gain: vary(gain), attack, decay, hold }));
  src.start(t, Math.random() * 0.3);
  src.stop(end + 0.05);
}

function tone(ctx, t, { type = 'sine', freq = 440, to = null, gain = 0.1, attack, decay = 0.1, hold = 0, filter = null }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const end = t + (attack ?? 0.003) + hold + decay;
  if (to) osc.frequency.exponentialRampToValueAtTime(to, end);
  const e = env(ctx, t, { gain, attack, decay, hold });
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    osc.connect(f); f.connect(e);
  } else {
    osc.connect(e);
  }
  osc.start(t);
  osc.stop(end + 0.05);
  return osc;
}

/** One recorded variant, never the same one twice in a row; false if not loaded. */
function sample(ctx, name, gain = 0.7, rate = 1) {
  const list = bank[name];
  if (!list?.length) return false;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastPick[name]) i = (i + 1) % list.length;
  lastPick[name] = i;
  const src = ctx.createBufferSource();
  src.buffer = list[i];
  src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * 0.035);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(bus.out);
  src.start();
  return true;
}

async function fetchBuffer(ctx, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    return await ctx.decodeAudioData(data);
  } catch { return null; }
}

export function voiceEnabled() {
  try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; }
}

export function setVoiceEnabled(on) {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  if (!on) stopVoice();
}

export function stopVoice() {
  try { voiceNow?.stop(); } catch { /* already ended */ }
  voiceNow = null;
}

function setCrowdLevel(level, seconds = 0.4) {
  if (!crowd || !bus) return;
  const now = bus.ctx.currentTime;
  crowd.gain.gain.cancelScheduledValues(now);
  crowd.gain.gain.setTargetAtTime(sounds.isMuted ? 0 : level, now, seconds / 3);
}

export const hoopsAudio = {
  /** Load every recorded cue once; synthesized cues cover the gap until then. */
  preload() {
    if (preloading) return preloading;
    const ctx = sounds._ensure?.();
    if (!ctx) return Promise.resolve();
    preloading = Promise.all(Object.entries(SAMPLES).map(async ([name, n]) => {
      const files = Array.from({ length: n }, (_, i) => `${MEDIA}sfx/${name}_${String(i + 1).padStart(2, '0')}.mp3`);
      const bufs = (await Promise.all(files.map(f => fetchBuffer(ctx, f)))).filter(Boolean);
      if (bufs.length) bank[name] = bufs;
    })).then(async () => {
      bank.crowd = [await fetchBuffer(ctx, `${MEDIA}sfx/crowd_loop.mp3`)].filter(Boolean);
    });
    return preloading;
  },

  /** A low arena murmur under the play, while the court is on screen. */
  startCrowd() {
    const ctx = ready('crowd');
    if (!ctx || crowd || !bank.crowd?.length) return;
    const src = ctx.createBufferSource();
    src.buffer = bank.crowd[0];
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain); gain.connect(bus.out);
    src.start();
    crowd = { src, gain };
    setCrowdLevel(0.16, 1.2);
    // The app's sound switch only gates new cues; keep the bed in step with it.
    crowd.watch = setInterval(() => setCrowdLevel(voiceNow ? 0.05 : 0.16, 0.3), 600);
  },

  stopCrowd() {
    if (!crowd) return;
    clearInterval(crowd.watch);
    const c = crowd;
    crowd = null;
    try {
      c.gain.gain.setTargetAtTime(0, c.src.context.currentTime, 0.15);
      c.src.stop(c.src.context.currentTime + 0.6);
    } catch { /* context gone */ }
  },

  /** Time slows: the room closes in, then opens again on the decision. */
  muffle(on) {
    if (!bus) return;
    const f = bus.muffle.frequency;
    const now = bus.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(on ? 720 : 20000, now + (on ? 0.35 : 0.25));
    setCrowdLevel(on ? 0.09 : 0.16);
  },

  /** Coach line in the current language; resolves when it finishes. */
  async voice(id, locale) {
    if (!id || !voiceEnabled()) return;
    const ctx = ready(`voice.${id}`);
    if (!ctx) return;
    const url = `${MEDIA}voice/${locale === 'zh' ? 'zh' : 'en'}/${id}.mp3`;
    if (!voiceCache.has(url)) voiceCache.set(url, fetchBuffer(ctx, url));
    const buf = await voiceCache.get(url);
    if (!buf || sounds.isMuted || !voiceEnabled()) return;
    stopVoice();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus.voice);
    voiceNow = src;
    setCrowdLevel(0.05, 0.2);
    await new Promise(res => { src.onended = res; src.start(); });
    if (voiceNow === src) { voiceNow = null; setCrowdLevel(0.16, 0.6); }
  },

  /** Leather on hardwood: a low pitched thump with a small slap on top. */
  dribble(level = 1) {
    const ctx = ready('dribble'); if (!ctx) return;
    if (sample(ctx, 'dribble', 0.75 * level)) return;
    const t = ctx.currentTime;
    tone(ctx, t, { freq: vary(105, .08), to: 52, gain: 0.42 * level, decay: 0.12 });
    noise(ctx, t, { type: 'lowpass', freq: 650, gain: 0.26 * level, decay: 0.035 });
    noise(ctx, t, { freq: 2600, q: 1.4, gain: 0.05 * level, decay: 0.014 });
  },

  /** Rubber on a clean floor — a fast chirp with a bright edge. */
  squeak() {
    const ctx = ready('squeak'); if (!ctx) return;
    if (sample(ctx, 'squeak', 0.45)) return;
    const t = ctx.currentTime;
    const f = vary(1650, .12);
    const osc = tone(ctx, t, { type: 'triangle', freq: f, to: f * 1.45, gain: 0.045, attack: 0.02, decay: 0.11 });
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vary(55, .2);
    depth.gain.value = 180;
    lfo.connect(depth); depth.connect(osc.frequency);
    lfo.start(t); lfo.stop(t + 0.16);
    noise(ctx, t, { freq: 3200, q: 7, gain: 0.05, attack: 0.02, decay: 0.1 });
  },

  pass() {
    const ctx = ready('pass'); if (!ctx) return;
    if (sample(ctx, 'pass', 0.6)) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 2200, q: 1.2, gain: 0.08, decay: 0.02 });
    noise(ctx, t, { freq: 520, to: 1700, q: 0.8, gain: 0.07, attack: 0.05, decay: 0.16 });
  },

  catch() {
    const ctx = ready('catch'); if (!ctx) return;
    if (sample(ctx, 'catch', 0.7)) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 1300, q: 0.9, gain: 0.22, decay: 0.025 });
    tone(ctx, t, { freq: 190, to: 120, gain: 0.2, decay: 0.06 });
  },

  release() {
    const ctx = ready('release'); if (!ctx) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 1900, q: 1.1, gain: 0.07, decay: 0.02 });
    noise(ctx, t + 0.02, { freq: 700, to: 2400, q: 0.7, gain: 0.04, attack: 0.08, decay: 0.3 });
  },

  /** Nothing but net: a soft airy "shhk". */
  swish() {
    const ctx = ready('swish'); if (!ctx) return;
    if (sample(ctx, 'swish', 0.85)) return;
    const t = ctx.currentTime;
    noise(ctx, t, { type: 'highpass', freq: 3300, gain: 0.2, attack: 0.012, decay: 0.26 });
    noise(ctx, t + 0.04, { freq: 6200, q: 1.8, gain: 0.08, attack: 0.01, decay: 0.18 });
    noise(ctx, t + 0.13, { freq: 900, q: 0.8, gain: 0.03, decay: 0.08 });
  },

  /** Iron: inharmonic partials ringing out, plus the backboard behind it. */
  rim() {
    const ctx = ready('rim'); if (!ctx) return;
    if (sample(ctx, Math.random() < 0.3 && bank.backboard ? 'backboard' : 'rim', 0.7)) return;
    const t = ctx.currentTime;
    const base = vary(470, .05);
    [[1, .09, .55], [2.37, .06, .4], [3.9, .045, .3], [5.7, .03, .2], [8.1, .015, .14]]
      .forEach(([m, g, d]) => tone(ctx, t, { freq: base * m, gain: g, decay: d }));
    noise(ctx, t, { freq: 2600, q: 1.5, gain: 0.2, decay: 0.02 });
    tone(ctx, t + 0.01, { freq: 150, to: 110, gain: 0.14, decay: 0.12 });
  },

  block() {
    const ctx = ready('block'); if (!ctx) return;
    if (sample(ctx, 'block', 0.75)) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 1100, q: 0.8, gain: 0.34, decay: 0.05 });
    tone(ctx, t, { freq: 210, to: 140, gain: 0.2, decay: 0.07 });
  },

  /** Referee's pea whistle — the pea gives it the trill. */
  whistle() {
    const ctx = ready('whistle'); if (!ctx) return;
    if (sample(ctx, 'whistle', 0.55)) return;
    const t = ctx.currentTime;
    const dur = 0.42;
    const osc = ctx.createOscillator();
    osc.frequency.value = vary(2950, .02);
    const trem = ctx.createGain();
    trem.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 36;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.45;
    lfo.connect(lfoDepth); lfoDepth.connect(trem.gain);
    osc.connect(trem);
    trem.connect(env(ctx, t, { gain: 0.07, attack: 0.02, hold: dur - 0.1, decay: 0.08 }));
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    noise(ctx, t, { freq: 3000, q: 5, gain: 0.018, attack: 0.02, hold: dur - 0.1, decay: 0.08 });
  },

  /** A crowd rising: three vowel bands, scattered applause, a few shouts. */
  cheer(size = 1) {
    const ctx = ready('cheer'); if (!ctx) return;
    if (sample(ctx, 'cheer', 0.55 * size)) return;
    const t = ctx.currentTime;
    [650, 1250, 2500].forEach((f, i) =>
      noise(ctx, t, { freq: f, q: 0.9, gain: (0.05 - i * 0.012) * size, attack: 0.3, hold: 0.6, decay: 1.1 }));
    const claps = Math.round(40 * size);
    for (let i = 0; i < claps; i++) {
      const at = t + 0.15 + Math.random() * 1.7;
      noise(ctx, at, { type: 'highpass', freq: 1400, gain: 0.02 + Math.random() * 0.04, decay: 0.018 });
    }
    for (let i = 0; i < 5; i++) {
      const at = t + 0.05 + Math.random() * 0.8;
      const f = 260 + Math.random() * 180;
      tone(ctx, at, { type: 'sawtooth', freq: f, to: f * 1.25, gain: 0.012 * size, attack: 0.05, decay: 0.35, filter: 1300 });
    }
  },

  groan() {
    const ctx = ready('groan'); if (!ctx) return;
    if (sample(ctx, 'groan', 0.55)) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 560, to: 300, q: 1.1, gain: 0.07, attack: 0.18, hold: 0.2, decay: 0.8 });
    tone(ctx, t, { type: 'sawtooth', freq: 170, to: 118, gain: 0.014, attack: 0.15, hold: 0.2, decay: 0.7, filter: 700 });
  },

  buzzer() {
    const ctx = ready('buzzer'); if (!ctx) return;
    if (sample(ctx, 'buzzer', 0.5)) return;
    const t = ctx.currentTime;
    tone(ctx, t, { type: 'sawtooth', freq: 196, gain: 0.07, attack: 0.01, hold: 0.8, decay: 0.08, filter: 1500 });
    tone(ctx, t, { type: 'square', freq: 207.5, gain: 0.04, attack: 0.01, hold: 0.8, decay: 0.08, filter: 1200 });
  },

  /** Decision clock. The last second ticks lower. */
  tick(last = false) {
    const ctx = ready('tick'); if (!ctx) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: last ? 2400 : 3800, q: 3, gain: 0.1, decay: 0.012 });
    tone(ctx, t, { freq: last ? 1180 : 1900, gain: 0.035, decay: 0.03 });
  },

  /** The moment slows to a stop — like a tape machine losing power. */
  freeze() {
    const ctx = ready('freeze'); if (!ctx) return;
    const t = ctx.currentTime;
    noise(ctx, t, { type: 'lowpass', freq: 3200, to: 180, gain: 0.08, attack: 0.02, decay: 0.38 });
    tone(ctx, t, { type: 'triangle', freq: 520, to: 90, gain: 0.045, attack: 0.02, decay: 0.36 });
  },

  lockIn() {
    const ctx = ready('lock'); if (!ctx) return;
    const t = ctx.currentTime;
    noise(ctx, t, { freq: 2100, q: 1.2, gain: 0.1, decay: 0.018 });
    tone(ctx, t, { freq: 392, gain: 0.07, decay: 0.12 });
    tone(ctx, t + 0.06, { freq: 587, gain: 0.05, decay: 0.16 });
  },

  /** A small bell per star, rising. */
  star(i = 0) {
    const ctx = ready('star'); if (!ctx) return;
    const t = ctx.currentTime;
    const f = [784, 988, 1175][i] || 1175;
    [[1, .08, .9], [2, .03, .5], [2.76, .022, .4], [5.4, .008, .2]]
      .forEach(([m, g, d]) => tone(ctx, t, { freq: f * m, gain: g, decay: d }));
  }
};
