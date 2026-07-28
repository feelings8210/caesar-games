/* Caesar Games — Sound
 *
 * A small physical-tabletop vocabulary, synthesized locally so the PWA stays
 * self-contained offline. Every cue is built the way a real percussive sound
 * behaves: a short noise transient (the strike) plus a fast-decaying resonant
 * body (the material). Pure oscillator tones read as "beeps"; this does not.
 *
 * Sound is decoration only — no game state is communicated by audio alone.
 */

const MUTE_KEY = 'caesar_games_muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = this._readMuted();
  }

  _readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
  }

  get isMuted() { return this.muted; }

  setMuted(v) {
    this.muted = !!v;
    try { localStorage.setItem(MUTE_KEY, String(this.muted)); } catch { /* private mode */ }
    return this.muted;
  }

  toggleMute() { return this.setMuted(!this.muted); }

  /** Must be called from a user gesture the first time (iOS requirement). */
  unlock() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();

    // Gentle bus compression keeps the cues close and unfatiguing.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // One second of white noise, reused by every transient.
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    return this.ctx;
  }

  _ready() {
    if (this.muted) return null;
    const ctx = this._ensure();
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Filtered noise burst — the "strike" part of a physical impact. */
  _transient(ctx, t, { freq = 2400, q = 1.2, gain = 0.3, decay = 0.03, type = 'bandpass' }) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    src.connect(filt); filt.connect(env); env.connect(this.master);
    src.start(t, Math.random() * 0.2);
    src.stop(t + decay + 0.02);
  }

  /** Damped sine — the resonant "body" that gives the material its character. */
  _body(ctx, t, { freq = 320, gain = 0.22, decay = 0.09, type = 'sine', detune = 0 }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.frequency.exponentialRampToValueAtTime(Math.max(freq + detune, 20), t + decay);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(env); env.connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  /* -------------------------------------------------------------- *
   * Vocabulary
   * -------------------------------------------------------------- */

  /** Small hard-material click — picking a piece up. */
  select() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 3200, q: 1.6, gain: 0.16, decay: 0.014 });
    this._body(ctx, t, { freq: 880, gain: 0.10, decay: 0.045, detune: -120 });
  }

  /** Clean tactile "tok" — setting a piece down. */
  place() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1900, q: 0.9, gain: 0.28, decay: 0.022 });
    this._body(ctx, t, { freq: 300, gain: 0.24, decay: 0.085, detune: -90 });
    this._body(ctx, t, { freq: 152, gain: 0.14, decay: 0.10, detune: -40 });
  }

  /** UI button press — lighter than placing a piece. */
  tap() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 2600, q: 1.1, gain: 0.13, decay: 0.013 });
    this._body(ctx, t, { freq: 520, gain: 0.09, decay: 0.04, detune: -80 });
  }

  /** Restrained physical impact — one piece takes another. */
  battle() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1100, q: 0.7, gain: 0.34, decay: 0.05 });
    this._body(ctx, t, { freq: 190, gain: 0.30, decay: 0.16, detune: -70 });
    this._body(ctx, t, { freq: 95, gain: 0.20, decay: 0.20, detune: -30 });
  }

  /** Restrained higher wood cue — the board is in check. */
  check() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime + 0.045;
    this._transient(ctx, t, { freq: 2400, q: 1.3, gain: 0.16, decay: 0.025 });
    this._body(ctx, t, { freq: 698.46, gain: 0.12, decay: 0.13, detune: -80 });
  }

  /** Heavier paired impact — both pieces removed. */
  mutualLoss() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 900, q: 0.6, gain: 0.32, decay: 0.06 });
    this._body(ctx, t, { freq: 165, gain: 0.28, decay: 0.20, detune: -60 });
    this._transient(ctx, t + 0.075, { freq: 700, q: 0.6, gain: 0.26, decay: 0.07 });
    this._body(ctx, t + 0.075, { freq: 110, gain: 0.24, decay: 0.26, detune: -40 });
  }

  /** Quiet, dry "no" — never an alarm. */
  invalid() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 420, q: 0.8, gain: 0.10, decay: 0.05, type: 'lowpass' });
    this._body(ctx, t, { freq: 128, gain: 0.11, decay: 0.075, detune: -22 });
  }

  /** Soft transition when the iPad changes hands. */
  pass() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1400, q: 0.5, gain: 0.10, decay: 0.16, type: 'lowpass' });
    this._body(ctx, t, { freq: 330, gain: 0.10, decay: 0.20, detune: 110 });
  }

  /** Gentle confirmation — a player is ready. */
  ready() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._body(ctx, t, { freq: 523.25, gain: 0.13, decay: 0.13 });
    this._body(ctx, t + 0.075, { freq: 784.0, gain: 0.11, decay: 0.20 });
  }

  /** Short resolved cadence. No fanfare. */
  victory() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [
      { f: 392.00, d: 0.00 },   // G4
      { f: 523.25, d: 0.11 },   // C5
      { f: 659.25, d: 0.22 }    // E5
    ];
    notes.forEach(({ f, d }) => {
      this._body(ctx, t + d, { freq: f, gain: 0.13, decay: 0.34, type: 'triangle' });
      this._body(ctx, t + d, { freq: f * 2, gain: 0.04, decay: 0.20 });
    });
    // Quiet root underneath to give the cadence a floor.
    this._body(ctx, t + 0.22, { freq: 261.63, gain: 0.09, decay: 0.55 });
  }

  /** A piece turns face-up in Flip mode. */
  reveal() {
    const ctx = this._ready(); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 2200, q: 1.0, gain: 0.18, decay: 0.02 });
    this._body(ctx, t, { freq: 640, gain: 0.13, decay: 0.07, detune: 140 });
  }
}

export const sounds = new SoundEngine();
