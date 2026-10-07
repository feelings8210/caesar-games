/* Caesar Games — Hoops IQ, Playbook mode
 *
 * Two ways to learn a play on the same court:
 *   watch — step through with diagrams and narration (back, next, auto);
 *   walk  — pick a position; before each step, do your part yourself
 *           (drag to your spot, tap who you pass to). Two misses show the
 *           arrow. First-try accuracy becomes stars.
 */

import { CATEGORIES, PLAYS, stepDiagram, stepTasks, rolesOf } from './playbook.js';
import { hoopsAudio as sfx, drawVoice } from './audio.js';
import { t, getLocale } from '../../i18n/strings.js';
import { sounds } from '../../engine/sound.js';

const KEY = 'caesar_hoops_playbook_v1';
const L = obj => (obj ? obj[getLocale()] ?? obj.en : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function readBest() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function saveBest(map) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

export class PlaybookMode {
  constructor(game) {
    this.game = game;
    this.play = null;
    this.mode = 'watch';
    this.step = 0;
    this.best = readBest();
    this.token = 0;
    this.el = document.createElement('div');
    this.el.className = 'hp-pb';
    this.el.innerHTML = `
      <p class="hp-eyebrow hp-pb-cat"></p>
      <h2 class="hp-title hp-pb-title"></h2>
      <div class="hp-pb-modes" role="tablist">
        <button type="button" class="hp-pb-mode" data-pb-mode="watch"></button>
        <button type="button" class="hp-pb-mode" data-pb-mode="walk"></button>
      </div>
      <div class="hp-pb-roles"></div>
      <p class="hp-pb-say"></p>
      <p class="hp-pb-feedback"></p>
      <ol class="hp-pb-steps"></ol>
      <div class="hp-pb-controls">
        <button type="button" class="btn btn-quiet hp-pb-prev"></button>
        <button type="button" class="btn btn-primary hp-pb-next"></button>
        <button type="button" class="btn btn-quiet hp-pb-auto"></button>
      </div>
      <div class="hp-pb-done">
        <div class="hp-verdict"><span class="hp-stars"><i></i><i></i><i></i></span><strong class="hp-pb-score"></strong></div>
        <div class="hp-actions">
          <button type="button" class="btn btn-primary hp-pb-again"></button>
          <button type="button" class="btn btn-quiet hp-pb-other"></button>
          <button type="button" class="btn btn-quiet hp-pb-watch"></button>
        </div>
      </div>`;
    game.$('.hp-panel').appendChild(this.el);
    const on = (sel, fn) => this.el.querySelector(sel).addEventListener('click', () => { sounds.tap(); fn(); });
    this.el.querySelectorAll('.hp-pb-mode').forEach(b => b.addEventListener('click', () => {
      sounds.tap();
      if (b.dataset.pbMode === 'watch') this.startWatch(); else this.chooseRole();
    }));
    on('.hp-pb-prev', () => this.prev());
    on('.hp-pb-next', () => this.next());
    on('.hp-pb-auto', () => this.toggleAuto());
    on('.hp-pb-again', () => this.startWalk(this.role));
    on('.hp-pb-other', () => this.chooseRole());
    on('.hp-pb-watch', () => this.startWatch());
    this.el.querySelector('.hp-pb-roles').addEventListener('click', e => {
      const b = e.target.closest('[data-role]');
      if (!b) return;
      sounds.tap();
      this.startWalk(b.dataset.role);
    });
  }

  get court() { return this.game.court; }
  $(sel) { return this.el.querySelector(sel); }

  /* ---------------------------------------------------------------- *
   * Menu pane (rendered by the game into the Playbook tab)
   * ---------------------------------------------------------------- */

  renderMenu(box) {
    box.innerHTML = CATEGORIES.map(c => {
      const plays = PLAYS.filter(p => p.category === c.id);
      return `<section class="hp-pb-group"><h3>${L(c.title)}</h3><div class="hp-pb-cards">${plays.map(p => {
        const got = this.best[p.id] || 0;
        return `<button type="button" class="hp-pb-card${got ? ' is-done' : ''}" data-play="${p.id}">
          <strong>${L(p.title)}</strong><span>${L(p.sub)}</span>
          <em>${t('hoops.pb.steps', { n: p.steps.length })}<span class="hp-level-stars">${[0, 1, 2].map(k => `<i class="${k < got ? 'is-on' : ''}"></i>`).join('')}</span></em>
        </button>`;
      }).join('')}</div></section>`;
    }).join('');
    box.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => { sounds.tap(); this.open(b.dataset.play); }));
  }

  /* ---------------------------------------------------------------- *
   * Lifecycle
   * ---------------------------------------------------------------- */

  async open(id) {
    const g = this.game;
    this.play = PLAYS.find(p => p.id === id);
    g.flow++;
    await g._ensureCourt();
    this._bind();
    g.mode = 'playbook';
    g.current = null;
    g.view = 'play';
    g.phase = 'pb';
    g.$('.hp-banner').className = 'hp-banner';
    sfx.preload().then(() => { if (g.view === 'play') sfx.startCrowd(() => g.courtOnScreen()); });
    this.startWatch();
  }

  stop() {
    this.token++;
    this.auto = false;
    this.court?.clearDiagram?.();
  }

  _reset(you) {
    this.token++;
    this.auto = false;
    this.done = false;
    this.feedback = '';
    this.court.setScene(this.play.setup, you);
    this.court.setYouLabel(t('hoops.you'));
    this.court.el.classList.remove('has-hud');
    this.court.setFrozen(false);
    this.step = 0;
    this.snaps = [this.court.snapshot()];
  }

  /* ---------------------------------------------------------------- *
   * Watch
   * ---------------------------------------------------------------- */

  startWatch() {
    this.mode = 'watch';
    this.role = null;
    this._reset(null);
    this._showStep();
  }

  _showStep() {
    const end = this.step >= this.play.steps.length;
    this.court.clearDiagram();
    if (!end && this.mode === 'watch') this.court.showDiagram(stepDiagram(this.play, this.step));
    this.game.render();
  }

  async next() {
    if (this.mode !== 'watch' || this.busy) return;
    if (this.step >= this.play.steps.length) { this.startWatch(); return; }
    const token = this.token;
    this.busy = true;
    this.game.render();
    const done = await this.court.play(this.play.steps[this.step].beats);
    this.busy = false;
    if (!done || token !== this.token) return;
    this.step++;
    this.snaps[this.step] = this.court.snapshot();
    if (this.step >= this.play.steps.length) sfx.voice('pb_watch_end', getLocale());
    this._showStep();
  }

  prev() {
    if (this.mode !== 'watch' || this.step === 0) return;
    this.token++;
    this.auto = false;
    this.busy = false;
    this.step--;
    this.court.restore(this.snaps[this.step]);
    this._showStep();
  }

  async toggleAuto() {
    if (this.auto) { this.auto = false; this.game.render(); return; }
    if (this.step >= this.play.steps.length) this.startWatch();
    this.auto = true;
    const token = this.token;
    this.game.render();
    while (this.auto && token === this.token && this.step < this.play.steps.length) {
      await wait(900);
      if (!this.auto || token !== this.token) return;
      await this.next();
    }
    this.auto = false;
    this.game.render();
  }

  /* ---------------------------------------------------------------- *
   * Walk
   * ---------------------------------------------------------------- */

  chooseRole() {
    this.mode = 'walk';
    this.role = null;
    this._reset(null);
    this.game.render();
  }

  startWalk(role) {
    this.mode = 'walk';
    this.role = role;
    this._reset(role);
    this.score = { first: 0, total: 0 };
    this._walkStep();
  }

  async _walkStep() {
    const token = this.token;
    if (this.step >= this.play.steps.length) { this._finishWalk(); return; }
    this.tasks = stepTasks(this.play, this.step, this.role);
    this.taskIndex = 0;
    this.tries = 0;
    this.court.clearDiagram();
    this.feedback = '';
    if (!this.tasks.length) {
      // Not your move this step: watch it happen.
      this.waiting = false;
      this.game.render();
      await wait(500);
      if (token !== this.token) return;
      await this._playStep(token);
      return;
    }
    this.waiting = true;
    this.game.render();
  }

  async _playStep(token) {
    this.waiting = false;
    this.game.render();
    const done = await this.court.play(this.play.steps[this.step].beats);
    if (!done || token !== this.token) return;
    this.step++;
    this.snaps[this.step] = this.court.snapshot();
    await wait(350);
    if (token !== this.token) return;
    this._walkStep();
  }

  /** Check a learner action against the current task. */
  _attempt(action) {
    if (!this.waiting) return;
    const task = this.tasks[this.taskIndex];
    const ok = task.kind === 'move'
      ? action.kind === 'move' && dist(action.at, task.at) <= 4.5
      : action.kind === 'pass' && action.to === task.to;
    if (ok) {
      if (this.tries === 0) this.score.first++;
      this.score.total++;
      sfx.lockIn();
      if (Math.random() < 0.5) sfx.voice(drawVoice('pbRight'), getLocale());
      this.court._pulse?.(task.kind === 'pass' ? task.to : this.role);
      this.feedback = t('hoops.pb.right');
      this.taskIndex++;
      this.tries = 0;
      this.court.clearDiagram();
      if (this.taskIndex >= this.tasks.length) this._playStep(this.token);
      else this.game.render();
      return;
    }
    this.tries++;
    sounds.invalid();
    this.feedback = t(this.tries >= 2 ? 'hoops.pb.hint' : 'hoops.pb.wrong');
    if (this.tries === 2) this.score.total++;      // counted once, as a miss
    if (this.tries <= 2) sfx.voice(this.tries === 1 ? drawVoice('pbWrong') : 'pb_hint', getLocale());
    if (this.tries >= 2) {
      const pos = this.court.pos[this.role];
      const mark = task.kind === 'move'
        ? { type: 'cut', team: this.role[0], pts: [pos, task.at], hint: true }
        : { type: 'pass', team: this.role[0], pts: [pos, this.court.pos[task.to]], hint: true };
      this.court.showDiagram([mark]);
    }
    this.game.render();
  }

  _finishWalk() {
    const { first, total } = this.score;
    const rate = total ? first / total : 1;
    this.stars = rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : 1;
    if (this.stars > (this.best[this.play.id] || 0)) { this.best[this.play.id] = this.stars; saveBest(this.best); }
    this.done = true;
    this.waiting = false;
    for (let s = 0; s < this.stars; s++) setTimeout(() => sfx.star(s), 200 * (s + 1));
    if (this.stars === 3) sfx.cheer(0.7);
    sfx.voice(first === total ? 'pb_done_3' : 'pb_done', getLocale());
    this.game.render();
  }

  /* ---------------------------------------------------------------- *
   * Input (walk mode only)
   * ---------------------------------------------------------------- */

  _bind() {
    if (this._bound === this.court) return;
    this._bound = this.court;
    const el = this.court.el;
    let drag = null;
    const active = () => this.game.phase === 'pb' && this.mode === 'walk' && this.waiting;
    const teammateAt = (x, y) => Object.keys(this.court.pos)
      .find(id => id[0] === this.role[0] && id !== this.role && this.court.hitActor(x, y, id));

    el.addEventListener('pointerdown', e => {
      if (!active()) return;
      e.preventDefault();
      drag = { onMe: this.court.hitActor(e.clientX, e.clientY, this.role), x: e.clientX, y: e.clientY, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch { /* older WebKit */ }
    });
    el.addEventListener('pointermove', e => {
      if (!drag || !active()) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) drag.moved = true;
      if (drag.onMe && drag.moved) this.court.dragTo(this.court.pos[this.role], this.court.toCourt(e.clientX, e.clientY));
    });
    el.addEventListener('pointerup', e => {
      if (!drag || !active()) { drag = null; return; }
      this.court.endDrag();
      const d = drag;
      drag = null;
      const mate = teammateAt(e.clientX, e.clientY);
      // Dragging yourself is a move, even onto the spot a teammate is leaving;
      // it only reads as a pass when a pass is what this step asks for.
      const wantsPass = this.tasks[this.taskIndex]?.kind === 'pass';
      if (d.onMe && d.moved && !(mate && wantsPass)) this._attempt({ kind: 'move', at: this.court.toCourt(e.clientX, e.clientY) });
      else if (mate) this._attempt({ kind: 'pass', to: mate });
    });
    el.addEventListener('pointercancel', () => { drag = null; this.court.endDrag(); });
  }

  /* ---------------------------------------------------------------- *
   * Panel
   * ---------------------------------------------------------------- */

  render() {
    const p = this.play;
    if (!p) return;
    const cat = CATEGORIES.find(c => c.id === p.category);
    const n = p.steps.length;
    const end = this.step >= n;
    const walk = this.mode === 'walk';
    this.$('.hp-pb-cat').textContent = L(cat.title);
    this.$('.hp-pb-title').textContent = L(p.title);
    this.el.querySelectorAll('.hp-pb-mode').forEach(b => {
      b.textContent = t(`hoops.pb.${b.dataset.pbMode}`);
      b.classList.toggle('is-on', b.dataset.pbMode === this.mode);
    });

    const roles = this.$('.hp-pb-roles');
    roles.classList.toggle('is-hidden', !walk || !!this.role);
    if (walk && !this.role) {
      roles.innerHTML = `<p>${t('hoops.pb.pickRole')}</p><div>${rolesOf(p).map(r =>
        `<button type="button" class="hp-pb-role is-${r[0]}" data-role="${r}">${r.slice(1)}</button>`).join('')}</div>`;
    }

    let say = '';
    if (!walk) say = end ? t('hoops.pb.end') : L(p.steps[this.step].say);
    else if (this.role && !this.done) {
      say = this.waiting
        ? t('hoops.pb.yourTurn', { n: this.step + 1, p: this.role.slice(1) })
        : L(p.steps[Math.min(this.step, n - 1)].say);
    }
    this.$('.hp-pb-say').textContent = say;
    this.$('.hp-pb-say').classList.toggle('is-hidden', !say);
    const fb = this.$('.hp-pb-feedback');
    fb.textContent = walk && this.waiting ? this.feedback : '';
    fb.classList.toggle('is-hidden', !fb.textContent);

    this.$('.hp-pb-steps').innerHTML = p.steps.map((s, i) =>
      `<li class="${i < this.step ? 'is-past' : i === this.step && !end ? 'is-now' : ''}">${walk && i >= this.step && !this.done ? t('hoops.pb.stepN', { n: i + 1 }) : L(s.say)}</li>`).join('');
    this.$('.hp-pb-steps').classList.toggle('is-hidden', walk && !this.role);

    const controls = this.$('.hp-pb-controls');
    controls.classList.toggle('is-hidden', walk);
    this.$('.hp-pb-prev').textContent = t('hoops.pb.prev');
    this.$('.hp-pb-prev').disabled = this.step === 0;
    this.$('.hp-pb-next').textContent = t(end ? 'hoops.pb.replay' : 'hoops.pb.next');
    this.$('.hp-pb-next').disabled = !!this.busy;
    this.$('.hp-pb-auto').textContent = t(this.auto ? 'hoops.pb.pause' : 'hoops.pb.auto');

    const doneBox = this.$('.hp-pb-done');
    doneBox.classList.toggle('is-hidden', !(walk && this.done));
    if (walk && this.done) {
      this.$('.hp-pb-score').textContent = t('hoops.pb.score', { a: this.score.first, b: this.score.total });
      doneBox.querySelectorAll('.hp-stars i').forEach((s, k) => s.classList.toggle('is-on', k < this.stars));
      this.$('.hp-pb-again').textContent = t('hoops.pb.again');
      this.$('.hp-pb-other').textContent = t('hoops.pb.other');
      this.$('.hp-pb-watch').textContent = t('hoops.pb.watchAgain');
    }
  }
}
