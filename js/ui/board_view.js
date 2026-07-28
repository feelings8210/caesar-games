/* Caesar Games — Board View
 *
 * Renders the canonical board and owns all board motion.
 *
 * Two invariants this file must never break:
 *   1. Canonical state never rotates. Orientation is applied only when
 *      converting a canonical key to a screen position.
 *   2. Every node carries its CANONICAL key in data-key, so a tap maps back
 *      to canonical coordinates with no arithmetic and therefore no drift.
 *
 * The drawn track network is generated from the rules adjacency graph, so the
 * board can never show a connection the engine won't honour.
 */

import {
  ROWS, COLS, CAMPS, HEADQUARTERS, RAILWAYS, key, parseKey,
  roadNeighbors, railNeighbors, isRailAdjacent
} from '../engine/rules.js';
import { isPieceVisibleTo, MODES, PHASES } from '../engine/session.js';
import { motionMs } from './motion.js';

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/* Board proportions. Stations are spaced so a piece is about 1.5x wider than
 * tall, the way a real Junqi tile sits on the board — and so the board fills
 * more of an iPad's landscape width instead of reading as a narrow column. */
const VB_W = 600;
const VB_H = 1010;

const COL_MARGIN = 0.6;
const COL_SPAN = (COLS - 1) + COL_MARGIN * 2;         // 5.2
const ROW_MARGIN = 0.75;
const FRONT_GAP = 0.62;                                // extra space at the front line
const ROW_SPAN = (ROWS - 1) + FRONT_GAP + ROW_MARGIN * 2;

const rowUnit = (r) => (r <= 5 ? r : r + FRONT_GAP);

/** Canonical -> unit square (0..1), before orientation. */
function unitPos(r, c) {
  return {
    x: (COL_MARGIN + c) / COL_SPAN,
    y: (ROW_MARGIN + rowUnit(r)) / ROW_SPAN
  };
}

/** Canonical -> display position for a given orientation. */
export function displayPos(r, c, orientation) {
  const rr = orientation === 'red_bottom' ? (ROWS - 1 - r) : r;
  const cc = orientation === 'red_bottom' ? (COLS - 1 - c) : c;
  return unitPos(rr, cc);
}

const CELL_W_PCT = (1 / COL_SPAN) * 100;
const CELL_H_PCT = (1 / ROW_SPAN) * 100;

/* ------------------------------------------------------------------ *
 * Track network (generated from the rules graph)
 * ------------------------------------------------------------------ */

function buildTrackSvg(orientation) {
  const pt = (k) => {
    const [r, c] = parseKey(k);
    const u = displayPos(r, c, orientation);
    return { x: u.x * VB_W, y: u.y * VB_H };
  };

  const roadSeen = new Set();
  const railSeen = new Set();
  const roads = [];
  const rails = [];

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const k = key(r, c);
    for (const n of roadNeighbors(k)) {
      const id = [k, n].sort().join('|');
      if (roadSeen.has(id) || isRailAdjacent(k, n)) continue;   // rails drawn separately
      roadSeen.add(id);
      roads.push([pt(k), pt(n)]);
    }
    for (const n of railNeighbors(k)) {
      const id = [k, n].sort().join('|');
      if (railSeen.has(id)) continue;
      railSeen.add(id);
      rails.push([pt(k), pt(n)]);
    }
  }

  let svg = '';

  // Front line band, drawn first so tracks sit on top of it.
  const bandTop = ((ROW_MARGIN + 5) / ROW_SPAN) * VB_H;
  const bandBottom = ((ROW_MARGIN + rowUnit(6)) / ROW_SPAN) * VB_H;
  svg += `<rect class="bv-frontline" x="0" y="${bandTop}" width="${VB_W}" height="${bandBottom - bandTop}" />`;
  svg += `<line class="bv-frontline-edge" x1="16" y1="${bandTop}" x2="${VB_W - 16}" y2="${bandTop}" />`;
  svg += `<line class="bv-frontline-edge" x1="16" y1="${bandBottom}" x2="${VB_W - 16}" y2="${bandBottom}" />`;
  svg += `<text class="bv-frontline-label" x="${VB_W / 2}" y="${(bandTop + bandBottom) / 2 + 5}" text-anchor="middle">前 线</text>`;

  for (const [a, b] of roads) {
    svg += `<line class="bv-road" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  }
  for (const [a, b] of rails) {
    svg += `<line class="bv-rail-bed" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
    svg += `<line class="bv-rail-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  }

  // Station furniture
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const k = key(r, c);
    const p = pt(k);
    if (CAMPS.has(k)) {
      svg += `<circle class="bv-camp" cx="${p.x}" cy="${p.y}" r="21" />`;
      svg += `<circle class="bv-camp-inner" cx="${p.x}" cy="${p.y}" r="14" />`;
    } else if (HEADQUARTERS.has(k)) {
      svg += `<rect class="bv-hq" x="${p.x - 30}" y="${p.y - 21}" width="60" height="42" rx="7" />`;
    }
  }

  return svg;
}

/* ------------------------------------------------------------------ *
 * BoardView
 * ------------------------------------------------------------------ */

export class BoardView {
  /**
   * @param {HTMLElement} mount
   * @param {{onNodeTap:(key:string)=>void}} handlers
   */
  constructor(mount, handlers = {}) {
    this.mount = mount;
    this.handlers = handlers;
    this.orientation = 'navy_bottom';
    this.nodes = new Map();          // canonical key -> node element
    this.animating = false;
    this._built = false;
    this._activeAnimations = new Set();
  }

  destroy() {
    this.cancelAnimations();
    this.mount.innerHTML = '';
    this.nodes.clear();
    this._built = false;
  }

  cancelAnimations() {
    for (const cancel of this._activeAnimations) { try { cancel(); } catch { /* noop */ } }
    this._activeAnimations.clear();
    this.animating = false;
  }

  /* ---------------- structure ---------------- */

  _build(orientation) {
    this.mount.innerHTML = '';
    this.nodes.clear();

    const board = document.createElement('div');
    board.className = 'bv-board';
    board.dataset.orientation = orientation;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'bv-tracks');
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = buildTrackSvg(orientation);
    board.appendChild(svg);

    const layer = document.createElement('div');
    layer.className = 'bv-nodes';

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      const node = document.createElement('div');
      node.className = 'bv-node';
      node.dataset.key = k;                       // CANONICAL — never transformed
      if (CAMPS.has(k)) node.classList.add('is-camp');
      if (HEADQUARTERS.has(k)) node.classList.add('is-hq');
      if (RAILWAYS.has(k)) node.classList.add('is-rail');

      const u = displayPos(r, c, orientation);
      node.style.left = `${u.x * 100}%`;
      node.style.top = `${u.y * 100}%`;
      node.style.width = `${CELL_W_PCT}%`;
      node.style.height = `${CELL_H_PCT}%`;

      node.addEventListener('click', () => {
        if (this.animating) return;
        this.handlers.onNodeTap?.(k);
      });

      layer.appendChild(node);
      this.nodes.set(k, node);
    }

    board.appendChild(layer);

    this.overlay = document.createElement('div');
    this.overlay.className = 'bv-overlay';
    board.appendChild(this.overlay);

    this.mount.appendChild(board);
    this.boardEl = board;
    this.orientation = orientation;
    this._built = true;
  }

  /* ---------------- rendering ---------------- */

  /**
   * @param {GameSession} session
   * @param {{orientation:string, viewerSeat:number, legalTargets:string[], highlight:object}} view
   */
  render(session, view) {
    const orientation = view.orientation || 'navy_bottom';
    if (!this._built || orientation !== this.orientation) this._build(orientation);

    const legal = new Set(view.legalTargets || []);
    const selected = session.selected;

    for (const [k, node] of this.nodes) {
      node.classList.toggle('is-legal', legal.has(k));
      node.classList.toggle('is-selected', selected === k);
      node.classList.toggle('is-origin', view.highlight?.from === k);
      node.classList.toggle('is-destination', view.highlight?.to === k);

      const piece = session.boardState[k];
      const existing = node.firstElementChild;

      if (!piece) { if (existing) existing.remove(); continue; }

      const el = existing || document.createElement('div');
      this._paintPiece(el, session, k, piece, view.viewerSeat, orientation);
      if (!existing) node.appendChild(el);
    }
  }

  _paintPiece(el, session, k, piece, viewerSeat, orientation) {
    const visible = isPieceVisibleTo(session, k, piece, viewerSeat);

    const classes = ['bv-piece'];
    if (visible) {
      classes.push('is-face', `side-${piece.side}`);
      if (piece.name === '军旗' && session.flagDisclosed[piece.side]) {
        const viewerSide = viewerSeat === 1 ? 'navy' : 'red';
        if (piece.side !== viewerSide) classes.push('is-disclosed');
      }
    } else {
      classes.push('is-back');
    }

    // Flip mode: a revealed piece faces its OWNER, wherever it stands.
    if (session.mode === MODES.FLIP && visible) {
      const seat = session.seatForSide(piece.side);
      if (seat === 2) classes.push('faces-top');
    }

    el.className = classes.join(' ');

    if (visible) {
      el.innerHTML = '';
      const face = document.createElement('span');
      face.className = 'bv-face';
      face.textContent = piece.name;
      el.appendChild(face);
      el.setAttribute('aria-label', piece.name);
      el.dataset.pieceId = piece.id;
    } else {
      // A concealed piece must carry no identifying data in the DOM at all.
      el.textContent = '';
      el.removeAttribute('aria-label');
      delete el.dataset.pieceId;
      el.innerHTML = '<span class="bv-face"><span class="bv-back-mark" aria-hidden="true"></span></span>';
    }
  }

  /* ---------------- geometry helpers ---------------- */

  centerOf(k) {
    const node = this.nodes.get(k);
    if (!node || !this.boardEl) return null;
    const nb = node.getBoundingClientRect();
    const bb = this.boardEl.getBoundingClientRect();
    return { x: nb.left - bb.left + nb.width / 2, y: nb.top - bb.top + nb.height / 2, w: nb.width, h: nb.height };
  }

  /* ---------------- motion ---------------- */

  capturePiece(k) {
    return this.nodes.get(k)?.firstElementChild?.cloneNode(true) || null;
  }

  captureFormation() {
    const positions = new Map();
    for (const piece of this.boardEl?.querySelectorAll('.bv-piece[data-piece-id]') || []) {
      positions.set(piece.dataset.pieceId, piece.getBoundingClientRect());
    }
    return positions;
  }

  async animateFormation(previous) {
    if (!previous?.size) return;
    const animations = [];
    let order = 0;
    for (const piece of this.boardEl?.querySelectorAll('.bv-piece[data-piece-id]') || []) {
      const before = previous.get(piece.dataset.pieceId);
      if (!before) continue;
      const after = piece.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      const duration = motionMs(205);
      const delay = motionMs(Math.min(54, order * 3), 0);
      animations.push(piece.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.97)`, opacity: .82 },
        { transform: 'translate(0,0) scale(1)', opacity: 1 }
      ], {
        duration,
        delay,
        easing: 'cubic-bezier(.22,.76,.28,1)',
        fill: 'both'
      }).finished.catch(() => {}));
      order++;
    }
    await Promise.race([
      Promise.all(animations),
      new Promise(resolve => setTimeout(resolve, motionMs(285)))
    ]);
  }

  nudge(k) {
    const piece = this.nodes.get(k)?.firstElementChild;
    if (!piece) return Promise.resolve();
    const animation = piece.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-3px)', offset: .30 },
      { transform: 'translateX(2px)', offset: .62 },
      { transform: 'translateX(0)' }
    ], {
      duration: motionMs(125),
      easing: 'cubic-bezier(.36,.07,.19,.97)'
    });
    return animation.finished.catch(() => {});
  }

  async animateReveal(k, concealedSnapshot, onMidpoint = () => {}) {
    const target = this.nodes.get(k)?.firstElementChild;
    const center = this.centerOf(k);
    if (!target || !center || !concealedSnapshot) {
      onMidpoint();
      return;
    }

    target.style.visibility = 'hidden';
    const flyer = concealedSnapshot;
    flyer.classList.add('bv-reveal-flyer');
    flyer.style.width = `${center.w * .82}px`;
    flyer.style.height = `${center.h * .78}px`;
    flyer.style.left = `${center.x}px`;
    flyer.style.top = `${center.y}px`;
    this.overlay.appendChild(flyer);

    const squeeze = flyer.animate([
      { transform: 'translate(-50%,-50%) translateY(0) scaleX(1) scaleY(1)' },
      { transform: 'translate(-50%,-50%) translateY(-7%) scaleX(.06) scaleY(1.04)' }
    ], {
      duration: motionMs(105),
      easing: 'cubic-bezier(.55,.02,.78,.38)',
      fill: 'forwards'
    });
    await squeeze.finished.catch(() => {});

    flyer.className = `${target.className} bv-reveal-flyer`;
    flyer.innerHTML = target.innerHTML;
    onMidpoint();

    const expand = flyer.animate([
      { transform: 'translate(-50%,-50%) translateY(-7%) scaleX(.06) scaleY(1.04)' },
      { transform: 'translate(-50%,-50%) translateY(-2%) scaleX(1.035) scaleY(.985)', offset: .78 },
      { transform: 'translate(-50%,-50%) translateY(0) scaleX(1) scaleY(1)' }
    ], {
      duration: motionMs(120),
      easing: 'cubic-bezier(.18,.78,.24,1)',
      fill: 'forwards'
    });
    await expand.finished.catch(() => {});
    flyer.remove();
    target.style.visibility = '';
  }

  /**
   * Animate a piece travelling from one station to another.
   *
   * Purely presentational — canonical state has already been committed. The
   * whole sequence is raced against a hard timeout so that a throttled or
   * backgrounded tab can never leave the game waiting on an animation that
   * will not finish.
   *
   * @returns {Promise<void>} resolves when the motion has finished
   */
  animateMove({
    from, to, combat, outcome, removedFrom = [],
    faceHtml = null, faceClass = '', onContact = () => {}
  }) {
    const a = this.centerOf(from);
    const b = this.centerOf(to);
    if (!a || !b) return Promise.resolve();

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const travel = motionMs(Math.round(Math.min(260, Math.max(160, distance * 0.75))));
    const total = travel + motionMs(combat ? 260 : 70);

    this.animating = true;

    // Hide the real pieces the flyer stands in for.
    const destPiece = this.nodes.get(to)?.firstElementChild;
    const origPiece = this.nodes.get(from)?.firstElementChild;
    if (destPiece) destPiece.style.visibility = 'hidden';
    if (origPiece) origPiece.style.visibility = 'hidden';

    // The shell owns screen-space translation. Orientation belongs only to
    // its child face; composing rotate + translate on this element reverses
    // the apparent vector for top-facing pieces.
    const base = 'translate(-50%, -50%)';

    const flyer = document.createElement('div');
    flyer.className = `bv-flyer ${faceClass}`;
    flyer.innerHTML = '<span class="bv-face"></span>';
    if (faceHtml !== null) flyer.firstElementChild.innerHTML = faceHtml;
    flyer.style.width = `${a.w}px`;
    flyer.style.height = `${a.h}px`;
    flyer.style.left = `${a.x}px`;
    flyer.style.top = `${a.y}px`;
    flyer.style.transform = base;
    this.overlay.appendChild(flyer);

    // Web Animations API: starts deterministically, no reflow dance required.
    const travelAnim = flyer.animate(
      [
        { transform: base },
        { transform: `${base} translate(${dx}px, ${dy}px)` }
      ],
      { duration: travel, easing: 'cubic-bezier(0.32, 0.72, 0.28, 1)', fill: 'forwards' }
    );
    this.lastTravel = { dx, dy, duration: travel };

    return new Promise((resolve) => {
      let done = false;
      const timers = [];

      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        try { travelAnim.cancel(); } catch { /* already gone */ }
        flyer.remove();
        if (destPiece) destPiece.style.visibility = '';
        if (origPiece) origPiece.style.visibility = '';
        this.animating = false;
        this._activeAnimations.delete(cancel);
        resolve();
      };
      const cancel = () => finish();
      this._activeAnimations.add(cancel);

      timers.push(setTimeout(() => {
        onContact();
        if (!combat) {
          const settle = flyer.animate([
            { transform: `${base} translate(${dx}px, ${dy}px) scale(1.025)` },
            { transform: `${base} translate(${dx}px, ${dy}px) scale(1)` }
          ], { duration: motionMs(65), easing: 'cubic-bezier(.2,.72,.28,1)' });
          timers.push(setTimeout(() => {
            try { settle.cancel(); } catch { /* already gone */ }
            finish();
          }, motionMs(65)));
          return;
        }

        // Contact pause, impact, then the losing piece leaves the board.
        flyer.classList.add('is-impact');
        if (destPiece) { destPiece.style.visibility = ''; destPiece.classList.add('is-struck'); }

        timers.push(setTimeout(() => {
          for (const k of removedFrom) {
            const p = this.nodes.get(k)?.firstElementChild;
            if (p) { p.style.visibility = ''; p.classList.add('is-removed'); }
          }
          timers.push(setTimeout(finish, motionMs(175)));
        }, motionMs(60)));
      }, travel));

      // Safety net: presentation must never outlive its budget.
      timers.push(setTimeout(finish, total + 600));

      // Exposed so the visual-audit harness can hold a true mid-travel frame.
      this._captureHold = { timers, flyer, travelAnim };
    });
  }

  /**
   * Freeze an in-flight move at a point on its own timeline.
   * Used only by the screenshot harness, so the captured frame is the real
   * shipping animation rather than a staged approximation.
   */
  pauseForCapture(progress = 0.55) {
    const hold = this._captureHold;
    if (!hold) return false;
    hold.timers.forEach(clearTimeout);
    const d = hold.travelAnim.effect.getTiming().duration;
    hold.travelAnim.pause();
    hold.travelAnim.currentTime = d * progress;
    return true;
  }

  /** A short emphasis pulse used by "Replay last move" and setup swaps. */
  pulse(keys, className = 'is-pulse', ms = 520) {
    const els = keys.map(k => this.nodes.get(k)).filter(Boolean);
    els.forEach(e => e.classList.add(className));
    return new Promise(res => setTimeout(() => {
      els.forEach(e => e.classList.remove(className));
      res();
    }, motionMs(ms)));
  }

  /** Visible swap of two pieces during setup. */
  async animateSwap(a, b) {
    const pa = this.centerOf(a);
    const pb = this.centerOf(b);
    if (!pa || !pb) return;
    const ea = this.nodes.get(a)?.firstElementChild;
    const eb = this.nodes.get(b)?.firstElementChild;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;

    const run = (el, x, y) => {
      if (!el) return Promise.resolve();
      const anim = el.animate(
        [{ transform: 'translate(0,0)' }, { transform: `translate(${x}px, ${y}px)` }],
        { duration: motionMs(180), easing: 'cubic-bezier(0.32,0.72,0.28,1)' }
      );
      return new Promise(res => setTimeout(() => { try { anim.cancel(); } catch { /* gone */ } res(); }, motionMs(200)));
    };
    await Promise.all([run(ea, dx, dy), run(eb, -dx, -dy)]);
  }
}

export { VB_W, VB_H };
