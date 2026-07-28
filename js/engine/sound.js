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
    this.materialWave = null;
    this.muted = this._readMuted();
    this.audit = [];
    this.material = 'junqi';
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

  /** Subtle material voicing; cue names and timing stay shared across games. */
  setMaterial(gameType) {
    this.material = ['xiangqi', 'chess', 'gomoku'].includes(gameType) ? gameType : 'junqi';
  }

  _profile() {
    return {
      junqi: { pitch: .94, decay: 1.08, transient: .90 },
      xiangqi: { pitch: 1.00, decay: 1.02, transient: .96 },
      chess: { pitch: 1.07, decay: .90, transient: 1.02 },
      gomoku: { pitch: .82, decay: 1.16, transient: .82 }
    }[this.material];
  }

  /** Must be called from a user gesture the first time (iOS requirement). */
  unlock() {
    this._ensure();
    return this.resume();
  }

  /** Best-effort wake after iOS interruption/backgrounding. */
  resume() {
    if (this.ctx?.state === 'closed') this._dropContext();
    const ctx = this._ensure();
    if (!ctx || ctx.state === 'running') return Promise.resolve(!!ctx);
    try {
      return Promise.resolve(ctx.resume()).then(() => ctx.state === 'running').catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  _dropContext() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.materialWave = null;
  }

  _ensure() {
    if (this.ctx?.state === 'closed') this._dropContext();
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
    this.master.gain.value = 0.42;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // One second of white noise, reused by every transient.
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.materialWave = this.ctx.createPeriodicWave(
      new Float32Array([0, 0, 0, 0, 0, 0]),
      new Float32Array([0, 1, .23, .08, .035, .012]),
      { disableNormalization: false }
    );

    return this.ctx;
  }

  _record(cue, played) {
    const entry = { cue, played, at: Date.now() };
    this.audit.push(entry);
    if (this.audit.length > 80) this.audit.shift();
    try { window.dispatchEvent(new CustomEvent('caesar-sound', { detail: entry })); } catch {}
  }

  getAudit() { return this.audit.map(entry => ({ ...entry })); }
  clearAudit() { this.audit.length = 0; }

  _ready(cue) {
    if (this.muted) {
      this._record(cue, false);
      return null;
    }
    const ctx = this._ensure();
    if (!ctx) {
      this._record(cue, false);
      return null;
    }
    if (ctx.state !== 'running') void this.resume();
    this._record(cue, true);
    return ctx;
  }

  _pitch(cents = 14) {
    return 2 ** (((Math.random() * 2 - 1) * cents) / 1200);
  }

  _level(amount = .035) {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  /** Filtered noise burst — the "strike" part of a physical impact. */
  _transient(ctx, t, { freq = 2400, q = 1.2, gain = 0.3, decay = 0.03, type = 'bandpass' }) {
    const profile = this._profile();
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq * profile.pitch * this._pitch(18);
    filt.Q.value = q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    const variedGain = gain * profile.transient * this._level();
    const variedDecay = decay * profile.decay * this._level(.06);
    env.gain.exponentialRampToValueAtTime(Math.max(variedGain, 0.0002), t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + variedDecay);

    src.connect(filt); filt.connect(env); env.connect(this.master);
    src.start(t, Math.random() * 0.2);
    src.stop(t + variedDecay + 0.02);
  }

  /** Inharmonic, damped modal body. The custom wave avoids pure-tone beeps. */
  _body(ctx, t, { freq = 320, gain = 0.22, decay = 0.09, type = 'material', detune = 0 }) {
    const profile = this._profile();
    const osc = ctx.createOscillator();
    if (type === 'material' && this.materialWave) osc.setPeriodicWave(this.materialWave);
    else osc.type = type;
    const variedFreq = freq * profile.pitch * this._pitch(12);
    const variedDecay = decay * profile.decay * this._level(.05);
    osc.frequency.setValueAtTime(variedFreq, t);
    if (detune) osc.frequency.exponentialRampToValueAtTime(
      Math.max(variedFreq + detune, 20), t + variedDecay);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(gain * this._level(), 0.0002), t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + variedDecay);

    osc.connect(env); env.connect(this.master);
    osc.start(t);
    osc.stop(t + variedDecay + 0.02);
  }

  /* -------------------------------------------------------------- *
   * Vocabulary
   * -------------------------------------------------------------- */

  /** Small hard-material click — picking a piece up. */
  select() {
    const ctx = this._ready('select'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 3200, q: 1.6, gain: 0.16, decay: 0.014 });
    this._body(ctx, t, { freq: 760, gain: 0.085, decay: 0.050, detune: -90 });
  }

  /** Clean tactile "tok" — setting a piece down. */
  place() {
    const ctx = this._ready('place'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1900, q: 0.9, gain: 0.28, decay: 0.022 });
    this._body(ctx, t, { freq: 300, gain: 0.24, decay: 0.085, detune: -90 });
    this._body(ctx, t, { freq: 152, gain: 0.14, decay: 0.10, detune: -40 });
  }

  /** UI button press — lighter than placing a piece. */
  tap() {
    const ctx = this._ready('tap'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 2600, q: 1.1, gain: 0.13, decay: 0.013 });
    this._body(ctx, t, { freq: 470, gain: 0.065, decay: 0.038, detune: -55 });
  }

  /** Restrained physical impact — one piece takes another. */
  battle() {
    const ctx = this._ready('capture'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1100, q: 0.7, gain: 0.34, decay: 0.05 });
    this._body(ctx, t, { freq: 190, gain: 0.30, decay: 0.16, detune: -70 });
    this._body(ctx, t, { freq: 95, gain: 0.20, decay: 0.20, detune: -30 });
  }

  /** Restrained higher wood cue — the board is in check. */
  check() {
    const ctx = this._ready('check'); if (!ctx) return;
    const t = ctx.currentTime + 0.045;
    this._transient(ctx, t, { freq: 2400, q: 1.3, gain: 0.16, decay: 0.025 });
    this._body(ctx, t, { freq: 610, gain: 0.10, decay: 0.12, detune: -60 });
    this._body(ctx, t, { freq: 355, gain: 0.055, decay: 0.16, detune: -30 });
  }

  /** Heavier paired impact — both pieces removed. */
  mutualLoss() {
    const ctx = this._ready('mutual-loss'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 900, q: 0.6, gain: 0.32, decay: 0.06 });
    this._body(ctx, t, { freq: 165, gain: 0.28, decay: 0.20, detune: -60 });
    this._transient(ctx, t + 0.075, { freq: 700, q: 0.6, gain: 0.26, decay: 0.07 });
    this._body(ctx, t + 0.075, { freq: 110, gain: 0.24, decay: 0.26, detune: -40 });
  }

  /** Quiet, dry "no" — never an alarm. */
  invalid() {
    const ctx = this._ready('invalid'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 420, q: 0.8, gain: 0.10, decay: 0.05, type: 'lowpass' });
    this._body(ctx, t, { freq: 128, gain: 0.11, decay: 0.075, detune: -22 });
  }

  /** Soft transition when the iPad changes hands. */
  pass() {
    const ctx = this._ready('pass'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1400, q: 0.5, gain: 0.10, decay: 0.16, type: 'lowpass' });
    this._body(ctx, t, { freq: 330, gain: 0.10, decay: 0.20, detune: 110 });
  }

  /** Gentle confirmation — a player is ready. */
  ready() {
    const ctx = this._ready('ready'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1700, q: .8, gain: .11, decay: .018 });
    this._body(ctx, t, { freq: 390, gain: 0.10, decay: 0.12 });
    this._transient(ctx, t + .075, { freq: 2100, q: .9, gain: .08, decay: .016 });
    this._body(ctx, t + 0.075, { freq: 520, gain: 0.075, decay: 0.17 });
  }

  /** Three warm settling knocks. Resolved, but deliberately not a fanfare. */
  victory() {
    const ctx = this._ready('victory'); if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [
      { f: 246.94, d: 0.00 },
      { f: 293.66, d: 0.15 },
      { f: 369.99, d: 0.32 }
    ];
    notes.forEach(({ f, d }) => {
      this._transient(ctx, t + d, { freq: 1250 + d * 500, q: .65, gain: .045, decay: .024 });
      this._body(ctx, t + d, { freq: f, gain: 0.095, decay: 0.34 });
      this._body(ctx, t + d, { freq: f * 1.47, gain: 0.022, decay: 0.20 });
    });
    // Quiet root underneath to give the cadence a floor.
    this._body(ctx, t + 0.32, { freq: 123.47, gain: 0.07, decay: 0.58 });
  }

  /** A piece turns face-up in Flip mode. */
  reveal() {
    const ctx = this._ready('reveal'); if (!ctx) return;
    const t = ctx.currentTime;
    this._transient(ctx, t, { freq: 1800, q: .75, gain: 0.12, decay: 0.045 });
    this._transient(ctx, t + .075, { freq: 2850, q: 1.1, gain: 0.14, decay: 0.022 });
    this._body(ctx, t + .07, { freq: 570, gain: 0.095, decay: 0.085, detune: 85 });
  }

  /** One coordinated handful of pieces settling after Quick Setup. */
  shuffle() {
    const ctx = this._ready('shuffle'); if (!ctx) return;
    const t = ctx.currentTime;
    [0, .045, .092].forEach((delay, index) => {
      this._transient(ctx, t + delay, {
        freq: 1500 + index * 190, q: .75, gain: .075 - index * .008, decay: .018
      });
      this._body(ctx, t + delay, {
        freq: 245 + index * 36, gain: .06, decay: .075, detune: -32
      });
    });
  }
}

export const sounds = new SoundEngine();
