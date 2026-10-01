/* Caesar Games — Hoops IQ beat runner
 *
 * The motion model shared by every court view (SVG and 3D). It owns the
 * canonical state — player positions in court feet and the ball — and plays
 * scripted beats:
 *
 *   { ms, move: { o2: [x, y] | [[x, y], ...] }, pass: 'o3', shot: 'make',
 *     ball: 'd4', call: ['o5', {zh, en}], sfx: 'squeak', clockRate: 1 }
 *
 * Views subclass it and draw that state through the hook methods at the
 * bottom; the runner never touches the DOM or a renderer itself.
 */

import { hoopsAudio as sfx } from './audio.js';

export const HOOP = [0, 5.25];
/** Review aid: ?hoopsSpeed=0.2 plays every beat in slow motion. */
export const PLAY_SPEED = (typeof location !== 'undefined' && Number(new URLSearchParams(location.search).get('hoopsSpeed'))) || 1;

export const lerp = (a, b, e) => a + (b - a) * e;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOut = x => 1 - (1 - x) ** 3;
export const radiusOf = id => [1.22, 1.28, 1.38, 1.5, 1.62][Number(id.slice(1)) - 1] || 1.35;

/** Sample a polyline at fraction e of its total length. */
export function sample(pts, e) {
  if (pts.length === 1) return pts[0];
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); lens.push(l); total += l; }
  if (!total) return pts[pts.length - 1];
  let d = e * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 1;
      return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
}

export class BeatRunner {
  constructor() {
    this.token = 0;
    this.pos = {};
    this.ball = { holder: null, at: [...HOOP], h: 0, flight: null, spin: 0 };
    this.onFrame = null;
  }

  /* ---------------------------------------------------------------- *
   * State
   * ---------------------------------------------------------------- */

  resetState(setup) {
    this.pos = {};
    for (const id of Object.keys(setup).filter(k => /^[od]\d$/.test(k))) this.pos[id] = [...setup[id]];
    this.ball = { holder: setup.ball || null, at: setup.ballAt ? [...setup.ballAt] : [...HOOP], h: 0, flight: null, spin: 0 };
  }

  snapshot() {
    return {
      pos: Object.fromEntries(Object.entries(this.pos).map(([k, v]) => [k, [...v]])),
      ball: { ...this.ball, at: [...this.ball.at], flight: null }
    };
  }

  restoreState(snap) {
    this.cancel();
    for (const [k, v] of Object.entries(snap.pos)) { this.pos[k] = [...v]; this._place(k); }
    this.ball = { ...snap.ball, at: [...snap.ball.at], flight: null };
    this._renderBall(0);
  }

  /** Where a player carries the ball, in court feet. */
  _hand(id) {
    const [x, y] = this.pos[id];
    const r = radiusOf(id);
    const side = x >= 0 ? 1 : -1;
    return [x + side * (r * .55), y - r * .55];
  }

  /* ---------------------------------------------------------------- *
   * Beats
   * ---------------------------------------------------------------- */

  cancel() { this.token++; }

  async play(beats, { slowLast = false } = {}) {
    const token = this.token;
    for (let i = 0; i < beats.length; i++) {
      if (token !== this.token) return false;
      await this._beat(beats[i], token, slowLast && i === beats.length - 1);
    }
    return token === this.token;
  }

  _beat(b, token, slow) {
    return new Promise(resolve => {
      const ms = (b.ms || 600) * (slow ? 1.7 : 1) / PLAY_SPEED;
      const ease = slow ? easeOut : b.ease === 'linear' ? (x => x) : easeInOut;
      const tracks = {};
      for (const [id, dest] of Object.entries(b.move || {})) {
        if (!this.pos[id]) continue;
        const pts = Array.isArray(dest[0]) ? dest : [dest];
        tracks[id] = [[...this.pos[id]], ...pts];
      }

      let flight = null;
      const from = [...this.ball.at];
      const fromH = this.ball.h || 0;
      if (b.pass) {
        flight = { kind: 'pass', from, fromH, target: b.pass, arc: b.lob ? .95 : .32, lob: !!b.lob };
        this.ball.holder = null;
        sfx.pass();
        this._passLine(from, b.pass, ms);
      } else if (b.shot) {
        flight = { kind: 'shot', from, fromH, result: b.shot, arc: 1.25, blocked: false };
        this.ball.holder = null;
        sfx.release();
      } else if (b.ball) {
        flight = { kind: 'loose', from, fromH, target: b.ball, arc: .7, bounced: false };
        this.ball.holder = null;
      }
      this.ball.flight = flight;

      if (b.sfx === 'squeak') sfx.squeak();
      if (b.sfx === 'whistle') sfx.whistle();
      if (b.call) this.call(b.call[0], b.call[1]);

      const holderMoves = this.ball.holder && tracks[this.ball.holder];
      const dribbleEvery = slow ? 560 : 400;
      let nextDribble = holderMoves ? 60 : Infinity;
      const trailPts = Object.fromEntries(Object.keys(tracks).map(id => [id, [[...this.pos[id]]]]));

      const start = performance.now();
      let last = start;
      const frame = now => {
        if (token !== this.token) return resolve();
        const elapsed = now - start;
        const raw = Math.min(1, elapsed / ms);
        const e = ease(raw);
        const dt = now - last;
        last = now;

        for (const [id, pts] of Object.entries(tracks)) {
          this.pos[id] = sample(pts, e);
          this._place(id);
          trailPts[id].push([...this.pos[id]]);
        }

        let bounce = 0;
        if (flight) this._fly(flight, raw);
        else if (holderMoves) {
          const phase = (elapsed % dribbleEvery) / dribbleEvery;
          bounce = Math.sin(phase * Math.PI);
          if (elapsed >= nextDribble) { sfx.dribble(slow ? .7 : 1); nextDribble += dribbleEvery; }
        }
        this._renderBall(bounce);
        if (this.onFrame) this.onFrame(dt, b);

        if (raw < 1) { requestAnimationFrame(frame); return; }
        this._land(flight);
        for (const [id, pts] of Object.entries(trailPts)) this._trail(id, pts);
        resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  _fly(f, raw) {
    const e = f.kind === 'shot' ? raw : easeInOut(raw);
    f.e = e;
    f.raw = raw;
    if (f.kind === 'shot' && f.result === 'block' && raw >= .42) {
      if (!f.blocked) {
        f.blocked = true;
        f.pivot = [...this.ball.at];
        f.pivotH = this.ball.h;
        sfx.block();
        this._burst(f.pivot);
      }
      const k = (raw - .42) / .58;
      f.k = k;
      const out = [f.pivot[0] + 5, f.pivot[1] + 4];
      this.ball.at = [lerp(f.pivot[0], out[0], k), lerp(f.pivot[1], out[1], k)];
      this.ball.h = f.pivotH * (1 - k) + Math.sin(k * Math.PI) * .3;
      this.ball.spin += 14;
      this._spin();
      return;
    }
    const to = f.kind === 'shot' ? HOOP : (this.pos[f.target] ? this._hand(f.target) : HOOP);
    this.ball.at = [lerp(f.from[0], to[0], e), lerp(f.from[1], to[1], e)];
    this.ball.h = Math.sin(e * Math.PI) * f.arc;
    if (f.kind === 'loose' && raw > .55 && !f.bounced) { f.bounced = true; sfx.dribble(.55); }
    this.ball.spin += 9;
    this._spin();
  }

  _land(f) {
    this.ball.flight = null;
    if (!f) return;
    this.ball.h = 0;
    this.ball.rest = null;
    if (f.kind === 'pass' || f.kind === 'loose') {
      this.ball.holder = f.target;
      sfx.catch();
      this._pulse(f.target);
    } else if (f.kind === 'shot') {
      if (f.result === 'make') {
        this.ball.at = [HOOP[0], HOOP[1] + .6];
        this.ball.rest = 'made';
        sfx.swish();
        this._swish();
      } else if (f.result === 'miss') {
        this.ball.at = [HOOP[0] + .9, HOOP[1] + 1.2];
        this.ball.h = .5;
        this.ball.rest = 'rim';
        sfx.rim();
        this._burst(HOOP);
      } else {
        this.ball.rest = 'loose';
      }
    }
    this._renderBall(0);
  }

  /* ---------------------------------------------------------------- *
   * View hooks — override in a subclass.
   * ---------------------------------------------------------------- */

  _place() {}
  _renderBall() {}
  _spin() {}
  _swish() {}
  _passLine() {}
  _trail() {}
  _pulse() {}
  _burst() {}
  call() {}
}
