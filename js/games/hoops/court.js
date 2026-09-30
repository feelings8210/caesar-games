/* Caesar Games — Hoops IQ court
 *
 * A top-down half court drawn in feet (x: sideline to sideline, -25..25;
 * y: baseline to half-court line, 0..47), basket at the top of the screen.
 * The view owns every moving thing on it and plays scripted "beats":
 *
 *   { ms, move: { o2: [x, y] | [[x, y], ...] }, pass: 'o3', shot: 'make',
 *     ball: 'd4', call: ['o5', {zh, en}], sfx: 'squeak', clockRate: 1 }
 *
 * Positions are canonical; the SVG is only a picture of them.
 */

import { hoopsAudio as sfx } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
export const HOOP = [0, 5.25];
const BALL_R = 0.75;

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const lerp = (a, b, e) => a + (b - a) * e;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = x => 1 - (1 - x) ** 3;

/** Sample a polyline at fraction e of its total length. */
function sample(pts, e) {
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

const radiusOf = id => [1.22, 1.28, 1.38, 1.5, 1.62][Number(id.slice(1)) - 1] || 1.35;

export class CourtView {
  constructor(mount, { text }) {
    this.text = text;              // (bilingual) => string, for in-court labels
    this.token = 0;
    this.pos = {};
    this.nodes = {};
    this.ball = { holder: null, at: [...HOOP], h: 0 };
    this.onFrame = null;

    this.svg = el('svg', { viewBox: '-27.5 -4 55 53.5', class: 'hc-svg', role: 'img' });
    mount.appendChild(this.svg);
    this._defs();
    this.gCourt = el('g', { class: 'hc-court' }, this.svg);
    this._drawCourt();
    this.gTrails = el('g', { class: 'hc-trails' }, this.svg);
    this.gMarkers = el('g', { class: 'hc-markers' }, this.svg);
    this.gPlayers = el('g', { class: 'hc-players' }, this.svg);
    this.gBall = el('g', { class: 'hc-ball-layer' }, this.svg);
    this.gFx = el('g', { class: 'hc-fx' }, this.svg);
    this._drawBall();
  }

  /* ---------------------------------------------------------------- *
   * Static drawing
   * ---------------------------------------------------------------- */

  _defs() {
    const defs = el('defs', {}, this.svg);
    // Maple planks: staggered seams and three close tones.
    const p = el('pattern', { id: 'hc-wood', width: 3.6, height: 14, patternUnits: 'userSpaceOnUse' }, defs);
    [['#D8C09A', 0], ['#D2B890', 1.2], ['#DBC5A1', 2.4]].forEach(([c, x], i) => {
      el('rect', { x, y: 0, width: 1.2, height: 14, fill: c }, p);
      const seam = [3.5, 10.2, 6.8][i];
      el('rect', { x, y: seam, width: 1.2, height: .06, fill: 'rgba(110,78,36,.16)' }, p);
      el('rect', { x: x + 1.17, y: 0, width: .03, height: 14, fill: 'rgba(110,78,36,.12)' }, p);
    });
    const glow = el('radialGradient', { id: 'hc-glow', cx: '50%', cy: '42%', r: '65%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#FFF8EA', 'stop-opacity': .38 }, glow);
    el('stop', { offset: '100%', 'stop-color': '#6B4A22', 'stop-opacity': .14 }, glow);
    const shade = el('radialGradient', { id: 'hc-shadow' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#0E1F3A', 'stop-opacity': .34 }, shade);
    el('stop', { offset: '100%', 'stop-color': '#0E1F3A', 'stop-opacity': 0 }, shade);
    const ball = el('radialGradient', { id: 'hc-ballfill', cx: '35%', cy: '32%', r: '70%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#E9955A' }, ball);
    el('stop', { offset: '100%', 'stop-color': '#B45A26' }, ball);
    const vig = el('radialGradient', { id: 'hc-vignette', cx: '50%', cy: '48%', r: '72%' }, defs);
    el('stop', { offset: '55%', 'stop-color': '#0E1F3A', 'stop-opacity': 0 }, vig);
    el('stop', { offset: '100%', 'stop-color': '#0E1F3A', 'stop-opacity': .42 }, vig);
  }

  _drawCourt() {
    const g = this.gCourt;
    el('rect', { x: -27.5, y: -4, width: 55, height: 53.5, rx: 1.4, fill: '#1B3358' }, g);
    el('text', { x: 0, y: -1.7, class: 'hc-apron-text', 'text-anchor': 'middle' }, g).textContent = 'CAESAR GAMES · HOOPS IQ';
    el('rect', { x: -25, y: 0, width: 50, height: 47, fill: 'url(#hc-wood)' }, g);
    el('rect', { x: -25, y: 0, width: 50, height: 47, fill: 'url(#hc-glow)' }, g);

    const line = { fill: 'none', stroke: 'rgba(255,255,255,.9)', 'stroke-width': .2 };
    // Painted lane and three-point area tint.
    el('path', { d: 'M -22 0 L -22 14.2 A 23.75 23.75 0 0 0 22 14.2 L 22 0 Z', fill: 'rgba(122,74,30,.07)' }, g);
    el('rect', { x: -8, y: 0, width: 16, height: 19, fill: 'rgba(122,74,30,.30)' }, g);
    el('rect', { x: -8, y: 0, width: 16, height: 19, fill: 'rgba(27,51,88,.10)' }, g);
    el('rect', { x: -8, y: 0, width: 16, height: 19, ...line }, g);
    el('rect', { x: -25, y: 0, width: 50, height: 47, ...line, 'stroke-width': .26 }, g);
    el('path', { d: 'M -22 0 L -22 14.2 A 23.75 23.75 0 0 0 22 14.2 L 22 0', ...line }, g);
    el('path', { d: 'M -6 19 A 6 6 0 0 0 6 19', ...line }, g);
    el('path', { d: 'M -6 19 A 6 6 0 0 1 6 19', ...line, 'stroke-dasharray': '1.1 .9', opacity: .75 }, g);
    el('path', { d: 'M -4 5.25 A 4 4 0 0 0 4 5.25', ...line, 'stroke-width': .14 }, g);
    el('path', { d: 'M -6 47 A 6 6 0 0 1 6 47', ...line }, g);
    el('path', { d: 'M -2 47 A 2 2 0 0 1 2 47', ...line, 'stroke-width': .14 }, g);
    [7, 8, 11, 14].forEach(y => {
      el('line', { x1: -8, y1: y, x2: -8.8, y2: y, ...line, 'stroke-width': .16 }, g);
      el('line', { x1: 8, y1: y, x2: 8.8, y2: y, ...line, 'stroke-width': .16 }, g);
    });

    // Basket: board, bracket, rim, net.
    const hoop = el('g', { class: 'hc-hoop' }, g);
    el('line', { x1: -3, y1: 4, x2: 3, y2: 4, stroke: '#F4F6F9', 'stroke-width': .36, 'stroke-linecap': 'round' }, hoop);
    el('line', { x1: 0, y1: 4, x2: 0, y2: 4.5, stroke: '#9AA6B6', 'stroke-width': .2 }, hoop);
    this.net = el('g', { class: 'hc-net' }, hoop);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      el('line', {
        x1: HOOP[0] + Math.cos(a) * .72, y1: HOOP[1] + Math.sin(a) * .72,
        x2: HOOP[0] + Math.cos(a + .6) * .32, y2: HOOP[1] + Math.sin(a + .6) * .32,
        stroke: 'rgba(255,255,255,.75)', 'stroke-width': .06
      }, this.net);
    }
    el('circle', { cx: HOOP[0], cy: HOOP[1], r: .32, fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': .05 }, this.net);
    this.rim = el('circle', { cx: HOOP[0], cy: HOOP[1], r: .75, fill: 'none', stroke: '#D0612A', 'stroke-width': .16 }, hoop);

    this.vignette = el('rect', { x: -27.5, y: -4, width: 55, height: 53.5, fill: 'url(#hc-vignette)', class: 'hc-vignette' }, this.svg);
  }

  _drawBall() {
    this.ballShadow = el('ellipse', { rx: BALL_R * 1.1, ry: BALL_R * .7, fill: 'url(#hc-shadow)' }, this.gBall);
    this.ballNode = el('g', { class: 'hc-ball' }, this.gBall);
    el('circle', { r: BALL_R, fill: 'url(#hc-ballfill)', stroke: '#7A3A15', 'stroke-width': .06 }, this.ballNode);
    this.seams = el('g', { stroke: '#4A2410', 'stroke-width': .05, fill: 'none', opacity: .8 }, this.ballNode);
    el('line', { x1: -BALL_R, y1: 0, x2: BALL_R, y2: 0 }, this.seams);
    el('path', { d: `M 0 ${-BALL_R} Q .35 0 0 ${BALL_R}` }, this.seams);
    el('path', { d: `M -.42 ${-BALL_R * .82} Q -.05 0 -.42 ${BALL_R * .82}` }, this.seams);
    el('path', { d: `M .42 ${-BALL_R * .82} Q .8 0 .42 ${BALL_R * .82}` }, this.seams);
  }

  /* ---------------------------------------------------------------- *
   * Scene
   * ---------------------------------------------------------------- */

  setScene(setup, you) {
    this.cancel();
    this.gPlayers.textContent = '';
    this.gTrails.textContent = '';
    this.gFx.textContent = '';
    this.clearMarkers();
    this.pos = {};
    this.nodes = {};
    this.you = you;
    const ids = Object.keys(setup).filter(k => /^[od]\d$/.test(k));
    // Defense drawn first so the attacking player reads on top at contact.
    ids.sort((a, b) => (a[0] === b[0] ? a.localeCompare(b) : a[0] === 'd' ? -1 : 1));
    for (const id of ids) {
      const r = radiusOf(id);
      const g = el('g', { class: `hc-player ${id[0] === 'o' ? 'is-offense' : 'is-defense'}`, 'data-id': id }, this.gPlayers);
      el('ellipse', { cx: .28, cy: .42, rx: r * 1.18, ry: r * 1.02, fill: 'url(#hc-shadow)' }, g);
      if (id === you) {
        el('circle', { r: r + .62, class: 'hc-you-ring' }, g);
        this.timerRing = el('circle', { r: r + 1.05, class: 'hc-timer-ring', pathLength: 100 }, g);
      }
      el('circle', { r, class: 'hc-body' }, g);
      el('circle', { r: r - .22, class: 'hc-inner' }, g);
      const num = el('text', { class: 'hc-num', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      num.textContent = id.slice(1);
      if (id === you) {
        const tag = el('g', { class: 'hc-you-tag', transform: `translate(0 ${r + 2.05})` }, g);
        el('rect', { x: -1.9, y: -.72, width: 3.8, height: 1.44, rx: .72 }, tag);
        this.youLabel = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, tag);
      }
      this.nodes[id] = g;
      this.pos[id] = [...setup[id]];
      this._place(id);
    }
    this.ball = { holder: setup.ball || null, at: setup.ballAt ? [...setup.ballAt] : [...HOOP], h: 0 };
    this._renderBall(0);
    this.setTimer(null);
  }

  setYouLabel(s) { if (this.youLabel) this.youLabel.textContent = s; }

  snapshot() {
    return {
      pos: Object.fromEntries(Object.entries(this.pos).map(([k, v]) => [k, [...v]])),
      ball: { ...this.ball, at: [...this.ball.at] }
    };
  }

  restore(snap) {
    this.cancel();
    this.gTrails.textContent = '';
    this.gFx.textContent = '';
    for (const [k, v] of Object.entries(snap.pos)) { this.pos[k] = [...v]; this._place(k); }
    this.ball = { ...snap.ball, at: [...snap.ball.at] };
    this._renderBall(0);
  }

  _place(id) {
    const [x, y] = this.pos[id];
    this.nodes[id].setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)})`);
  }

  _hand(id) {
    const [x, y] = this.pos[id];
    const r = radiusOf(id);
    // Carried on the side away from the basket's centre line, slightly forward.
    const side = x >= 0 ? 1 : -1;
    return [x + side * (r * .55), y - r * .55];
  }

  _renderBall(bounce) {
    const { holder, h } = this.ball;
    const at = holder && this.pos[holder] ? this._hand(holder) : this.ball.at;
    if (holder) this.ball.at = at;
    const s = 1 + h * .55 - bounce * .14;
    this.ballNode.setAttribute('transform', `translate(${at[0].toFixed(3)} ${(at[1] - h * 1.1).toFixed(3)}) scale(${s.toFixed(3)})`);
    this.ballShadow.setAttribute('cx', at[0] + .3 + h * .5);
    this.ballShadow.setAttribute('cy', at[1] + .4 + h * .4);
    this.ballShadow.setAttribute('opacity', String(Math.max(.25, 1 - h * .45)));
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
      const ms = (b.ms || 600) * (slow ? 1.7 : 1);
      const ease = slow ? easeOut : b.ease === 'linear' ? (x => x) : easeInOut;
      const tracks = {};
      for (const [id, dest] of Object.entries(b.move || {})) {
        if (!this.pos[id]) continue;
        const pts = Array.isArray(dest[0]) ? dest : [dest];
        tracks[id] = [[...this.pos[id]], ...pts];
      }

      let flight = null;
      const from = [...this.ball.at];
      if (b.pass) {
        flight = { kind: 'pass', from, target: b.pass, arc: b.lob ? .95 : .32 };
        this.ball.holder = null;
        sfx.pass();
        this._passLine(from, b.pass, ms);
      } else if (b.shot) {
        flight = { kind: 'shot', from, result: b.shot, arc: 1.25, blocked: false };
        this.ball.holder = null;
        sfx.release();
      } else if (b.ball) {
        flight = { kind: 'loose', from, target: b.ball, arc: .7, bounced: false };
        this.ball.holder = null;
      }

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
    let to;
    if (f.kind === 'shot') {
      to = HOOP;
      if (f.result === 'block' && raw >= .42) {
        if (!f.blocked) { f.blocked = true; f.pivot = [...this.ball.at]; f.pivotH = this.ball.h; sfx.block(); this._burst(f.pivot); }
        const k = (raw - .42) / .58;
        const out = [f.pivot[0] + 5, f.pivot[1] + 4];
        this.ball.at = [lerp(f.pivot[0], out[0], k), lerp(f.pivot[1], out[1], k)];
        this.ball.h = f.pivotH * (1 - k) + Math.sin(k * Math.PI) * .3;
        this.ball.spin = (this.ball.spin || 0) + 14;
        this._spin();
        return;
      }
    } else {
      to = this.pos[f.target] ? this._hand(f.target) : HOOP;
    }
    this.ball.at = [lerp(f.from[0], to[0], e), lerp(f.from[1], to[1], e)];
    this.ball.h = Math.sin(e * Math.PI) * f.arc;
    if (f.kind === 'loose' && raw > .55 && !f.bounced) { f.bounced = true; sfx.dribble(.55); }
    this.ball.spin = (this.ball.spin || 0) + 9;
    this._spin();
  }

  _spin() { this.seams.setAttribute('transform', `rotate(${this.ball.spin % 360})`); }

  _land(f) {
    if (!f) return;
    this.ball.h = 0;
    if (f.kind === 'pass' || f.kind === 'loose') {
      this.ball.holder = f.target;
      sfx.catch();
      this._pulse(f.target);
    } else if (f.kind === 'shot') {
      if (f.result === 'make') {
        this.ball.at = [HOOP[0], HOOP[1] + .6];
        sfx.swish();
        this.net.classList.remove('is-swish');
        void this.net.getBBox?.();
        this.net.classList.add('is-swish');
        this._ripple(HOOP);
      } else if (f.result === 'miss') {
        this.ball.at = [HOOP[0] + .9, HOOP[1] + 1.2];
        this.ball.h = .5;
        sfx.rim();
        this._burst(HOOP);
      }
    }
    this._renderBall(0);
  }

  /* ---------------------------------------------------------------- *
   * Effects
   * ---------------------------------------------------------------- */

  _trail(id, pts) {
    if (pts.length < 2 || dist(pts[0], pts[pts.length - 1]) < 2.5) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
    el('path', { d, class: `hc-trail ${id[0] === 'o' ? 'is-offense' : 'is-defense'}` }, this.gTrails);
    const trails = this.gTrails.children;
    while (trails.length > 14) trails[0].remove();
  }

  _passLine(from, target, ms) {
    const to = this.pos[target];
    if (!to) return;
    const line = el('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], class: 'hc-pass-line' }, this.gTrails);
    line.style.animationDuration = `${Math.max(ms, 400) + 900}ms`;
    setTimeout(() => line.remove(), ms + 1000);
  }

  _pulse(id) {
    const at = this.pos[id];
    if (!at) return;
    const c = el('circle', { cx: at[0], cy: at[1], r: radiusOf(id), class: 'hc-pulse' }, this.gFx);
    setTimeout(() => c.remove(), 700);
  }

  _burst(at) {
    const c = el('circle', { cx: at[0], cy: at[1], r: 1, class: 'hc-burst' }, this.gFx);
    setTimeout(() => c.remove(), 600);
  }

  _ripple(at) {
    const c = el('circle', { cx: at[0], cy: at[1], r: 1, class: 'hc-ripple' }, this.gFx);
    setTimeout(() => c.remove(), 1000);
  }

  call(id, label) {
    const at = this.pos[id];
    if (!at) return;
    const g = el('g', { class: 'hc-call', transform: `translate(${at[0]} ${at[1] - radiusOf(id) - 1.7})` }, this.gFx);
    const inner = el('g', {}, g);
    const text = this.text(label);
    const w = Math.max(3.2, text.length * (/[一-鿿]/.test(text) ? 1.25 : .72) + 1.4);
    el('rect', { x: -w / 2, y: -.85, width: w, height: 1.7, rx: .85 }, inner);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, inner).textContent = text;
    setTimeout(() => g.remove(), 1500);
  }

  /* ---------------------------------------------------------------- *
   * Decision layer
   * ---------------------------------------------------------------- */

  setFrozen(on) { this.svg.classList.toggle('is-frozen', !!on); }

  setTimer(fraction) {
    if (!this.timerRing) return;
    this.timerRing.classList.toggle('is-on', fraction !== null);
    if (fraction !== null) {
      this.timerRing.setAttribute('stroke-dasharray', `${(fraction * 100).toFixed(2)} 100`);
      this.timerRing.classList.toggle('is-urgent', fraction < .34);
    }
  }

  /** Where each option lives on the floor, for markers and hit-testing. */
  targetPoint(opt) {
    if (opt.kind === 'pass') return this.pos[opt.to];
    if (opt.kind === 'shoot') return HOOP;
    return opt.at;
  }

  showTargets(options, actor) {
    this.clearMarkers();
    const from = this.pos[actor];
    options.forEach((opt, i) => {
      const g = el('g', { class: `hc-target is-${opt.kind}`, 'data-opt': i }, this.gMarkers);
      const at = this.targetPoint(opt);
      if (opt.kind === 'pass') {
        el('circle', { cx: at[0], cy: at[1], r: radiusOf(opt.to) + .75, class: 'hc-target-ring' }, g);
        el('circle', { cx: at[0], cy: at[1], r: radiusOf(opt.to) + 2.2, class: 'hc-hit' }, g);
      } else if (opt.kind === 'shoot') {
        el('circle', { cx: at[0], cy: at[1], r: 2.1, class: 'hc-target-ring' }, g);
        el('circle', { cx: at[0], cy: at[1], r: 3.2, class: 'hc-hit' }, g);
        this._label(g, [at[0], at[1] + 3.3], opt.label);
      } else {
        const mid = [(from[0] + at[0]) / 2, (from[1] + at[1]) / 2];
        const len = dist(from, at);
        if (len > 2.5) {
          const k = (len - 1.9) / len;
          const tip = [from[0] + (at[0] - from[0]) * k, from[1] + (at[1] - from[1]) * k];
          el('path', { d: `M ${from[0]} ${from[1]} Q ${mid[0] + (at[1] - from[1]) * .08} ${mid[1] - (at[0] - from[0]) * .08} ${tip[0]} ${tip[1]}`, class: 'hc-target-path' }, g);
        }
        el('circle', { cx: at[0], cy: at[1], r: 1.35, class: 'hc-target-ghost' }, g);
        el('circle', { cx: at[0], cy: at[1], r: 2.8, class: 'hc-hit' }, g);
        const below = at[1] < 44;
        this._label(g, [at[0], at[1] + (below ? 2.7 : -2.7)], opt.label);
      }
    });
  }

  _label(g, [x, y], label) {
    if (!label) return;
    const text = this.text(label);
    const cjk = /[一-鿿]/.test(text);
    const w = text.length * (cjk ? 1.18 : .66) + 1.6;
    const cx = Math.max(-26 + w / 2, Math.min(26 - w / 2, x));
    const lg = el('g', { class: 'hc-target-label', transform: `translate(${cx} ${y})` }, g);
    el('rect', { x: -w / 2, y: -.85, width: w, height: 1.7, rx: .85 }, lg);
    el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, lg).textContent = text;
  }

  highlightTarget(i) {
    for (const node of this.gMarkers.children) node.classList.toggle('is-hot', Number(node.dataset.opt) === i);
  }

  clearMarkers() {
    this.gMarkers.textContent = '';
    this.dragLine = null;
  }

  dragTo(from, to) {
    if (!this.dragLine) this.dragLine = el('line', { class: 'hc-drag-line' }, this.gMarkers);
    this.dragLine.setAttribute('x1', from[0]); this.dragLine.setAttribute('y1', from[1]);
    this.dragLine.setAttribute('x2', to[0]); this.dragLine.setAttribute('y2', to[1]);
  }

  endDrag() { this.dragLine?.remove(); this.dragLine = null; }

  /** The clue the player should have read, shown after the decision. */
  showCue(cue) {
    const at = cue.at === 'clock' ? null : (typeof cue.at === 'string' ? this.pos[cue.at] : cue.at);
    if (!at) return;
    const r = typeof cue.at === 'string' ? radiusOf(cue.at) + 1.1 : 2;
    const g = el('g', { class: 'hc-cue' }, this.gFx);
    el('circle', { cx: at[0], cy: at[1], r, class: 'hc-cue-ring' }, g);
    el('circle', { cx: at[0], cy: at[1], r: r + .9, class: 'hc-cue-halo' }, g);
  }

  clearCue() { this.gFx.querySelectorAll('.hc-cue').forEach(n => n.remove()); }

  /** Client pixel → court feet. */
  toCourt(clientX, clientY) {
    const m = this.svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
}

export { dist, radiusOf };
