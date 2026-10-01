/* Caesar Games — Hoops IQ controller
 *
 * One level is one loop:
 *   title → intro (the play runs, slows, freezes) → decide (clock running)
 *   → outcome (the choice plays out) → review (verdict, clue, rule)
 *   ↳ optional demo of the best read, or retry from the intro.
 *
 * The court view owns motion; this file owns flow, text and progress.
 */

import { CourtView } from './court.js';
import { hoopsAudio as sfx } from './audio.js';
import { CHAPTER, LEVELS } from './levels.js';
import { FAMILIES, TAGS, pickRound } from './families.js';
import { recordRead, readSummary, tagAccuracy, bestStreak, saveBestStreak } from './stats.js';
import { t, getLocale } from '../../i18n/strings.js';
import { sounds } from '../../engine/sound.js';

const PROGRESS_KEY = 'caesar_hoops_progress_v1';
const wait = ms => new Promise(r => setTimeout(r, ms));
const L = obj => (obj ? obj[getLocale()] ?? obj.en : '');

function readProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return raw && typeof raw === 'object' && raw.stars ? raw : { stars: {} };
  } catch { return { stars: {} }; }
}

function writeProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function starsFor(grade, elapsed, decide) {
  if (grade === 3) return elapsed <= decide * 0.6 ? 3 : 2;
  return grade === 1 ? 1 : 0;
}

export function rankKey(total) {
  if (total >= 27) return 'hoops.rank.3';
  if (total >= 20) return 'hoops.rank.2';
  if (total >= 10) return 'hoops.rank.1';
  return 'hoops.rank.0';
}

export class HoopsGame {
  constructor(root) {
    this.root = root;
    this.view = 'menu';
    this.phase = 'idle';
    this.index = 0;
    this.flow = 0;               // bumps to cancel any in-flight sequence
    this.progress = readProgress();
    this.mode = 'chapter';       // 'chapter' | 'read'
    this.menuTab = 'chapter';    // 'chapter' | 'read' | 'stats'
    this.current = null;
    this._build();
    this.court = null;           // created on first level: 3D, or SVG fallback
  }

  $(sel) { return this.root.querySelector(sel); }

  /* ---------------------------------------------------------------- *
   * DOM
   * ---------------------------------------------------------------- */

  _build() {
    this.root.innerHTML = `
      <section class="hp-menu">
        <header class="hp-menu-head">
          <div>
            <p class="hp-eyebrow" data-k="chapter"></p>
            <h2 class="hp-chapter-title"></h2>
            <p class="hp-chapter-sub"></p>
          </div>
          <div class="hp-rank">
            <span class="hp-rank-label"></span>
            <strong class="hp-rank-name"></strong>
            <span class="hp-rank-stars"></span>
          </div>
        </header>
        <nav class="hp-tabs" role="tablist">
          <button type="button" class="hp-tab" data-tab="chapter" role="tab"></button>
          <button type="button" class="hp-tab" data-tab="read" role="tab"></button>
          <button type="button" class="hp-tab" data-tab="stats" role="tab"></button>
        </nav>
        <div class="hp-tabpane" data-pane="chapter"><div class="hp-levels"></div></div>
        <div class="hp-tabpane" data-pane="read">
          <div class="hp-read-card">
            <div class="hp-read-copy"><h3 class="hp-read-title"></h3><p class="hp-read-desc"></p></div>
            <div class="hp-read-side">
              <span class="hp-read-best"></span>
              <button class="btn btn-primary hp-read-start" type="button"></button>
            </div>
          </div>
          <ul class="hp-read-families"></ul>
        </div>
        <div class="hp-tabpane" data-pane="stats"><div class="hp-stats"></div></div>
      </section>
      <section class="hp-play">
        <div class="hp-stage">
          <div class="hp-court"></div>
          <div class="hp-hud is-hidden">
            <span class="hp-hud-score"></span>
            <strong class="hp-hud-clock"></strong>
            <span class="hp-hud-note"></span>
          </div>
          <div class="hp-title-card"><span></span><strong></strong></div>
          <div class="hp-banner"></div>
          <button class="hp-view is-hidden" type="button"></button>
        </div>
        <aside class="hp-panel" aria-live="polite">
          <button class="hp-back" type="button"></button>
          <p class="hp-eyebrow hp-level-eyebrow"></p>
          <h2 class="hp-title"></h2>
          <div class="hp-phase hp-watch"><span class="hp-dot"></span><span class="hp-watch-text"></span></div>
          <div class="hp-phase hp-decide">
            <p class="hp-prompt"></p>
            <p class="hp-howto"></p>
            <div class="hp-clock"><i></i></div>
          </div>
          <div class="hp-phase hp-review">
            <p class="hp-summary is-hidden"></p>
            <div class="hp-verdict">
              <span class="hp-stars"><i></i><i></i><i></i></span>
              <strong class="hp-verdict-text"></strong>
            </div>
            <p class="hp-result"></p>
            <p class="hp-why"></p>
            <div class="hp-note hp-cue"><span class="hp-note-label"></span><p></p></div>
            <div class="hp-note hp-rule"><span class="hp-note-label"></span><p></p></div>
            <div class="hp-actions">
              <button class="btn btn-primary hp-next" type="button"></button>
              <button class="btn btn-quiet hp-best" type="button"></button>
              <button class="btn btn-quiet hp-retry" type="button"></button>
            </div>
          </div>
        </aside>
      </section>`;

    const levels = this.$('.hp-levels');
    LEVELS.forEach((lvl, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hp-level';
      b.dataset.index = i;
      b.innerHTML = `<span class="hp-level-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="hp-level-title"></span><span class="hp-level-concept"></span>
        <span class="hp-level-stars"><i></i><i></i><i></i></span>`;
      b.addEventListener('click', () => {
        if (b.classList.contains('is-locked')) { sounds.invalid(); return; }
        sounds.tap();
        this.startLevel(i);
      });
      levels.appendChild(b);
    });

    this.$$('.hp-tab').forEach(b => b.addEventListener('click', () => {
      sounds.tap();
      this.menuTab = b.dataset.tab;
      this.render();
    }));
    this.$('.hp-read-start').addEventListener('click', () => { sounds.tap(); this.startRead(); });
    this.$('.hp-view').addEventListener('click', () => {
      sounds.tap();
      this.pov = !this.pov;
      this.court?.setShot?.(this.pov ? 'pov' : 'decide', false, true);
      this.render();
    });
    this.$('.hp-back').addEventListener('click', () => {
      sounds.tap();
      this.menuTab = this.mode === 'read' ? 'read' : 'chapter';
      this.showMenu();
    });
    this.$('.hp-retry').addEventListener('click', () => { sounds.tap(); this.startLevel(this.index); });
    this.$('.hp-best').addEventListener('click', () => { sounds.tap(); this.demoBest(); });
    this.$('.hp-next').addEventListener('click', () => {
      sounds.tap();
      if (this.mode === 'read') { if (this.readOver) this.startRead(); else this._nextRound(); return; }
      if (this.index + 1 < LEVELS.length) this.startLevel(this.index + 1);
      else this.showMenu();
    });
  }

  /* ---------------------------------------------------------------- *
   * Shell hooks
   * ---------------------------------------------------------------- */

  /** Called by the app whenever this screen is (re)rendered, e.g. language. */
  render() {
    this.root.dataset.view = this.view;
    this.root.dataset.phase = this.phase;
    if (this.view === 'menu') this._renderMenu();
    else this._renderPanel();
  }

  leave() {
    this.flow++;
    this.court?.cancel();
    this.court?.setFrozen(false);
    this.court?.sleep?.();
    cancelAnimationFrame(this._timerRaf);
    this.view = 'menu';
    this.phase = 'idle';
    this.root.dataset.phase = 'idle';
  }

  showMenu() {
    this.leave();
    this.render();
  }

  /* ---------------------------------------------------------------- *
   * Menu
   * ---------------------------------------------------------------- */

  totalStars() {
    return LEVELS.reduce((sum, l) => sum + (this.progress.stars[l.id] || 0), 0);
  }

  unlocked(i) {
    return i === 0 || (this.progress.stars[LEVELS[i - 1].id] ?? -1) >= 1;
  }

  _renderMenu() {
    const tab = this.menuTab;
    this.$$('.hp-tab').forEach(b => {
      b.classList.toggle('is-on', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      b.textContent = t(`hoops.tab.${b.dataset.tab}`);
    });
    this.$$('.hp-tabpane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === tab));
    this.$('.hp-menu [data-k="chapter"]').textContent = tab === 'chapter' ? t('hoops.chapter') : t('game.hoops.title');
    this.$('.hp-chapter-title').textContent = tab === 'chapter' ? L(CHAPTER.title) : t(`hoops.${tab}.title`);
    this.$('.hp-chapter-sub').textContent = tab === 'chapter' ? L(CHAPTER.sub) : t(`hoops.${tab}.sub`);
    if (tab === 'read') this._renderReadPane();
    if (tab === 'stats') this._renderStats();
    const total = this.totalStars();
    this.$('.hp-rank-label').textContent = t('hoops.rankLabel');
    this.$('.hp-rank-name').textContent = t(rankKey(total));
    this.$('.hp-rank-stars').textContent = t('hoops.starsOf', { n: total, total: LEVELS.length * 3 });
    this.root.querySelectorAll('.hp-level').forEach(b => {
      const i = Number(b.dataset.index);
      const lvl = LEVELS[i];
      const got = this.progress.stars[lvl.id] || 0;
      const open = this.unlocked(i);
      b.classList.toggle('is-locked', !open);
      b.classList.toggle('is-done', got > 0);
      b.querySelector('.hp-level-title').textContent = L(lvl.title);
      b.querySelector('.hp-level-concept').textContent = open ? L(lvl.concept) : t('hoops.locked');
      b.querySelectorAll('.hp-level-stars i').forEach((s, k) => s.classList.toggle('is-on', k < got));
      b.setAttribute('aria-label', `${t('hoops.level', { n: i + 1 })} · ${L(lvl.title)}`);
    });
  }

  _renderReadPane() {
    this.$('.hp-read-title').textContent = t('hoops.read.cardTitle');
    this.$('.hp-read-desc').textContent = t('hoops.read.desc');
    const best = bestStreak();
    this.$('.hp-read-best').textContent = best ? t('hoops.read.best', { n: best }) : t('hoops.read.noBest');
    this.$('.hp-read-start').textContent = t('hoops.read.start');
    this.$('.hp-read-families').innerHTML = FAMILIES.map(f => `<li><strong>${L(f.title)}</strong><span>${t('hoops.read.variants', { n: f.variants.length })}</span></li>`).join('');
  }

  _renderStats() {
    const s = readSummary();
    const box = this.$('.hp-stats');
    if (!s.total) { box.innerHTML = `<p class="hp-stats-empty">${t('hoops.stats.empty')}</p>`; return; }
    const pct = v => (v === null ? '—' : `${Math.round(v * 100)}%`);
    const head = `<div class="hp-stat-head">
      <div><strong>${s.total}</strong><span>${t('hoops.stats.reads')}</span></div>
      <div><strong>${pct(s.rate)}</strong><span>${t('hoops.stats.accuracy')}</span></div>
      <div><strong>${bestStreak()}</strong><span>${t('hoops.stats.bestStreak')}</span></div>
    </div>`;
    const rows = Object.keys(TAGS).filter(k => s.tags[k]).map(k => {
      const r = s.tags[k];
      const w = Math.round((r.rate || 0) * 100);
      const time = r.avgMs === null ? '—' : `${(r.avgMs / 1000).toFixed(1)} s`;
      const trend = r.trend === null ? '' : r.trend > 0.04 ? `<span class="hp-stat-trend is-up">↑ ${t('hoops.stats.better')}</span>`
        : r.trend < -0.04 ? `<span class="hp-stat-trend is-down">↓ ${t('hoops.stats.worse')}</span>` : '';
      return `<li title="${L(TAGS[k])}: ${pct(r.rate)} · ${r.n}">
        <span class="hp-stat-name">${L(TAGS[k])}<small>${t('hoops.stats.count', { n: r.n })}</small></span>
        <span class="hp-stat-bar"><i style="width:${w}%"></i></span>
        <span class="hp-stat-pct">${pct(r.rate)}</span>
        <span class="hp-stat-time">${time}</span>
        ${trend}
      </li>`;
    }).join('');
    box.innerHTML = `${head}<div class="hp-stat-cols"><span></span><span></span><span>${t('hoops.stats.accuracy')}</span><span>${t('hoops.stats.speed')}</span></div><ul class="hp-stat-rows">${rows}</ul>`;
  }

  /* ---------------------------------------------------------------- *
   * Level flow
   * ---------------------------------------------------------------- */

  get level() { return this.current; }

  startLevel(i) {
    this.mode = 'chapter';
    this.index = i;
    return this._run(LEVELS[i], t('hoops.level', { n: i + 1 }));
  }

  /** Read & React: endless rounds until a wrong read or a timeout. */
  startRead() {
    this.mode = 'read';
    this.streak = 0;
    this.round = 0;
    this.readOver = false;
    this.newBest = false;
    this.lastFamily = null;
    return this._nextRound();
  }

  _nextRound() {
    this.round++;
    const lvl = pickRound({ accuracy: tagAccuracy, streak: this.streak, last: this.lastFamily });
    this.lastFamily = lvl.family;
    return this._run(lvl, t('hoops.read.round', { n: this.round }));
  }

  async _run(lvl, cardTop) {
    const flow = ++this.flow;
    cancelAnimationFrame(this._timerRaf);
    await this._ensureCourt();
    if (flow !== this.flow) return;
    this.current = lvl;
    this.view = 'play';
    this.choice = null;
    this.stars = 0;
    this.demoShown = false;
    this.homeBonus = 0;

    this.clock = lvl.hud ? lvl.hud.clock : null;
    this.buzzed = false;
    this.court.setScene(lvl.setup, lvl.you);
    this.court.el.classList.toggle('has-hud', !!lvl.hud);
    this.court.setYouLabel(t('hoops.you'));
    this.court.setFrozen(false);
    this.$('.hp-banner').className = 'hp-banner';
    this._renderHud();
    this._setPhase('title');

    const card = this.$('.hp-title-card');
    card.querySelector('span').textContent = cardTop;
    card.querySelector('strong').textContent = L(lvl.title);
    card.classList.add('is-on');
    await wait(1100);
    if (flow !== this.flow) return;
    card.classList.remove('is-on');
    await wait(250);
    if (flow !== this.flow) return;

    this._setPhase('intro');
    const done = await this.court.play(lvl.intro, { slowLast: true });
    if (!done || flow !== this.flow) return;
    this.freezeSnap = this.court.snapshot();
    this.freezeClock = this.clock;
    this._enterDecide(flow);
  }

  _enterDecide(flow) {
    const lvl = this.level;
    sfx.freeze();
    this.pov = false;
    this.court.setFrozen(true);
    this._setPhase('decide');

    // ?hoopsDecide=N stretches the window for slow software-GL test browsers.
    const secs = Number(new URLSearchParams(location.search).get('hoopsDecide')) || lvl.decide;
    const total = secs * 1000;
    const start = performance.now();
    let lastSecond = Math.ceil(secs);
    const step = now => {
      if (flow !== this.flow || this.phase !== 'decide') return;
      const elapsed = now - start;
      const left = Math.max(0, total - elapsed);
      const frac = left / total;
      this.court.setTimer(frac);
      const bar = this.$('.hp-clock i');
      bar.style.transform = `scaleX(${frac.toFixed(4)})`;
      this.$('.hp-clock').classList.toggle('is-urgent', frac < .34);
      const sec = Math.ceil(left / 1000);
      if (sec < lastSecond) {
        lastSecond = sec;
        if (sec <= 3 && sec >= 1) sfx.tick(sec === 1);
      }
      if (left <= 0) { this.choose(-1, secs); return; }
      this._timerRaf = requestAnimationFrame(step);
    };
    this.decideStart = start;
    this._timerRaf = requestAnimationFrame(step);
  }

  async choose(i, forcedElapsed = null) {
    if (this.phase !== 'decide') return;
    const flow = this.flow;
    cancelAnimationFrame(this._timerRaf);
    const lvl = this.level;
    const elapsed = forcedElapsed ?? (performance.now() - this.decideStart) / 1000;
    const opt = lvl.options[i] || null;
    this.choice = i;
    this.stars = opt ? starsFor(opt.grade, elapsed, lvl.decide) : 0;
    const grade = opt ? opt.grade : 0;
    recordRead({ tag: lvl.tag, level: lvl.id, grade, ms: elapsed * 1000, mode: this.mode });
    if (this.mode === 'read') {
      if (grade === 3) this.streak++;
      else if (grade === 0) this.readOver = true;
      if (this.streak > bestStreak()) { saveBestStreak(this.streak); this.newBest = true; }
    }

    this.court.setTimer(null);
    this.court.clearMarkers();
    this.court.setFrozen(false);
    this._setPhase('outcome');

    if (opt) {
      sfx.lockIn();
      await wait(160);
      if (flow !== this.flow) return;
      const done = await this.court.play(opt.play);
      if (!done || flow !== this.flow) return;
      if (opt.end === 'score') { this.homeBonus = 2; this._renderHud(); }
      this._endCue(opt.end);
      this._banner(L(opt.result), opt.end);
    } else {
      sfx.whistle();
      this._banner(t('hoops.timeout'), 'turnover');
    }

    const key = lvl.id;
    if (this.mode !== 'chapter') {
      // Read & React keeps its own record; chapter stars are untouched.
    } else if (this.stars > (this.progress.stars[key] ?? -1)) {
      this.progress.stars[key] = this.stars;
      writeProgress(this.progress);
    } else if (!(key in this.progress.stars)) {
      this.progress.stars[key] = 0;
      writeProgress(this.progress);
    }

    await wait(opt ? 900 : 700);
    if (flow !== this.flow) return;
    this.court.showCue(lvl.cue);
    this.$('.hp-hud').classList.toggle('is-cue', lvl.cue.at === 'clock');
    this.$$('.hp-verdict .hp-stars i').forEach(s => s.classList.remove('is-on'));
    this._setPhase('review');
    for (let s = 0; s < this.stars; s++) {
      await wait(200);
      if (flow !== this.flow) return;
      this.$$('.hp-verdict .hp-stars i')[s]?.classList.add('is-on');
      sfx.star(s);
    }
  }

  async demoBest() {
    const flow = ++this.flow;
    const lvl = this.level;
    const best = lvl.options.find(o => o.grade === 3);
    this.court.restore(this.freezeSnap);
    this.clock = this.freezeClock;
    this.buzzed = false;
    this.homeBonus = 0;
    this._renderHud();
    this.court.clearCue();
    this.$('.hp-banner').className = 'hp-banner';
    this._setPhase('demo');
    this.court.showCue(lvl.cue);
    await wait(700);
    if (flow !== this.flow) return;
    const done = await this.court.play(best.play);
    if (!done || flow !== this.flow) return;
    if (best.end === 'score') { this.homeBonus = 2; this._renderHud(); }
    this._endCue(best.end);
    this._banner(L(best.result), best.end);
    await wait(900);
    if (flow !== this.flow) return;
    this.demoShown = true;
    this._setPhase('review');
    this.$$('.hp-verdict .hp-stars i').forEach((s, k) => s.classList.toggle('is-on', k < this.stars));
  }

  _endCue(end) {
    if (end === 'score' || end === 'stop') sfx.cheer(end === 'score' ? 1 : .8);
    else if (end === 'turnover') { sfx.whistle(); setTimeout(() => sfx.groan(), 250); }
    else if (end === 'allowed' || end === 'miss') sfx.groan();
  }

  _banner(text, end) {
    const b = this.$('.hp-banner');
    b.textContent = text;
    b.className = `hp-banner is-on is-${end}`;
  }

  $$(sel) { return [...this.root.querySelectorAll(sel)]; }

  /* ---------------------------------------------------------------- *
   * Panel
   * ---------------------------------------------------------------- */

  _setPhase(p) {
    this.phase = p;
    this.render();
  }

  _renderPanel() {
    const lvl = this.level;
    const p = this.phase;
    this.$('.hp-back').textContent = `‹ ${t('hoops.levels')}`;
    const read = this.mode === 'read';
    this.$('.hp-level-eyebrow').textContent = read
      ? `${t('hoops.read.round', { n: this.round })} · ${t('hoops.read.streak', { n: this.streak })}`
      : `${t('hoops.level', { n: this.index + 1 })} · ${L(lvl.concept)}`;
    // In Read & React the variant's name would give the answer away — show it only afterwards.
    this.$('.hp-title').textContent = read && p === 'review' && lvl.variantTitle ? L(lvl.variantTitle) : L(lvl.title);
    const view = this.$('.hp-view');
    view.classList.toggle('is-hidden', !(p === 'decide' && this.root.dataset.court === '3d'));
    view.textContent = t(this.pov ? 'hoops.view.court' : 'hoops.view.player');
    this.$('.hp-watch-text').textContent = t(p === 'demo' ? 'hoops.bestPlay' : 'hoops.watch');
    this.$('.hp-prompt').textContent = L(lvl.prompt);
    this.$('.hp-howto').textContent = t(lvl.side === 'defense' ? 'hoops.howToDefense' : 'hoops.howTo');
    this.court?.setYouLabel(t('hoops.you'));
    this._renderHud();

    const on = { title: 'watch', intro: 'watch', demo: 'watch', outcome: 'watch', decide: 'decide', review: 'review' }[p];
    this.$$('.hp-phase').forEach(n => n.classList.toggle('is-on', n.classList.contains(`hp-${on}`)));
    if (p === 'outcome') this.$('.hp-watch-text').textContent = t('hoops.watchResult');

    if (p === 'decide') this.court.showTargets(lvl.options, lvl.you);

    if (p === 'review') {
      const opt = lvl.options[this.choice] || null;
      const verdict = !opt ? 'hoops.bad' : opt.grade === 3 ? (this.stars === 3 ? 'hoops.fast' : 'hoops.best') : opt.grade === 1 ? 'hoops.ok' : 'hoops.bad';
      this.$('.hp-verdict').dataset.grade = opt ? opt.grade : 0;
      this.$('.hp-verdict-text').textContent = t(verdict);
      this.$('.hp-result').textContent = opt ? L(opt.result) : t('hoops.timeout');
      this.$('.hp-why').textContent = opt ? L(opt.why) : t('hoops.timeoutWhy');
      if (this.demoShown) {
        const best = lvl.options.find(o => o.grade === 3);
        this.$('.hp-result').textContent = `${t('hoops.bestPlay')} · ${L(best.label) || L(best.result)}`;
        this.$('.hp-why').textContent = L(best.why);
      }
      const cue = this.$('.hp-cue');
      cue.querySelector('.hp-note-label').textContent = t('hoops.key');
      cue.querySelector('p').textContent = L(lvl.cue.text);
      const rule = this.$('.hp-rule');
      rule.querySelector('.hp-note-label').textContent = t('hoops.rule');
      rule.querySelector('p').textContent = L(lvl.rule);

      const isBest = opt && opt.grade === 3;
      this.$('.hp-best').textContent = t('hoops.showBest');
      this.$('.hp-best').classList.toggle('is-hidden', isBest || this.demoShown);
      const next = this.$('.hp-next');
      const retry = this.$('.hp-retry');
      const summary = this.$('.hp-summary');
      retry.textContent = t('hoops.retry');
      if (read) {
        next.textContent = t(this.readOver ? 'hoops.read.again' : 'hoops.read.next');
        next.classList.remove('is-hidden');
        retry.classList.add('is-hidden');
        const g = opt ? opt.grade : 0;
        summary.textContent = this.readOver
          ? `${t('hoops.read.over', { n: this.streak })} · ${this.newBest ? t('hoops.read.newBest') : t('hoops.read.best', { n: bestStreak() })}`
          : g === 3 ? t('hoops.read.streakUp', { n: this.streak }) : t('hoops.read.keep', { n: this.streak });
        summary.dataset.state = this.readOver ? 'over' : g === 3 ? 'up' : 'keep';
        summary.classList.remove('is-hidden');
      } else {
        const last = this.index + 1 >= LEVELS.length;
        const passed = (this.progress.stars[lvl.id] || 0) >= 1;
        next.textContent = t(last ? 'hoops.finish' : 'hoops.next');
        next.classList.toggle('is-hidden', !passed);
        retry.classList.remove('is-hidden');
        retry.classList.toggle('btn-primary', !passed);
        retry.classList.toggle('btn-quiet', passed);
        summary.classList.add('is-hidden');
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Game clock (last-possession levels)
   * ---------------------------------------------------------------- */

  _tickClock(dt, beat) {
    if (this.clock === null || !beat.clockRate) return;
    const before = this.clock;
    this.clock = Math.max(0, this.clock - (dt / 1000) * beat.clockRate);
    if (before > 0 && this.clock === 0 && !this.buzzed) { this.buzzed = true; sfx.buzzer(); }
    this._renderHud();
  }

  _renderHud() {
    const hud = this.$('.hp-hud');
    const lvl = this.level;
    const show = this.view === 'play' && !!lvl?.hud;
    hud.classList.toggle('is-hidden', !show);
    if (!show) return;
    if (this.phase !== 'review' && this.phase !== 'demo') hud.classList.remove('is-cue');
    const [a, b] = lvl.hud.score;
    this.$('.hp-hud-score').textContent = `${t('hoops.home')} ${a + (this.homeBonus || 0)}  ·  ${t('hoops.away')} ${b}`;
    this.$('.hp-hud-clock').textContent = (this.clock ?? 0).toFixed(1);
    this.$('.hp-hud-note').textContent = t('hoops.clockOff');
  }

  /* ---------------------------------------------------------------- *
   * Input: tap a target, or drag yourself/the ball onto one.
   * ---------------------------------------------------------------- */

  _bindPointer() {
    const el = this.court.el;
    let drag = null;

    el.addEventListener('pointerdown', e => {
      if (this.phase !== 'decide') return;
      e.preventDefault();
      drag = { onMe: this.court.hitActor(e.clientX, e.clientY, this.level.you), x: e.clientX, y: e.clientY, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch { /* older WebKit */ }
    });

    el.addEventListener('pointermove', e => {
      if (!drag || this.phase !== 'decide') return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) drag.moved = true;
      if (drag.onMe && drag.moved) {
        this.court.dragTo(this.court.pos[this.level.you], this.court.toCourt(e.clientX, e.clientY));
        const hot = this.court.pickTarget(e.clientX, e.clientY, true);
        if (hot !== this._hot) { this._hot = hot; if (hot >= 0) sounds.select(); }
        this.court.highlightTarget(hot);
      }
    });

    const finish = e => {
      if (!drag || this.phase !== 'decide') { drag = null; return; }
      const pick = this.court.pickTarget(e.clientX, e.clientY, drag.onMe && drag.moved);
      this.court.endDrag();
      this.court.highlightTarget(-1);
      this._hot = -1;
      drag = null;
      if (pick >= 0) this.choose(pick);
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', () => {
      drag = null;
      this.court.endDrag();
      this.court.highlightTarget(-1);
    });
  }

  /** The 3D court when the device can run it, the SVG court otherwise. */
  _ensureCourt() {
    if (!this._courtPromise) this._courtPromise = (async () => {
      const mount = this.$('.hp-court');
      let court = null;
      if (!/[?&]hoops2d\b/.test(location.search)) {
        try {
          const mod = await import('./court3d.js');
          if (mod.webglAvailable()) {
            court = new mod.Court3D(mount, { text: L });
            await court.ready;
          }
        } catch (err) {
          console.warn('Hoops IQ: 3D court unavailable, using 2D', err);
          court?.destroy?.();
          court = null;
        }
      }
      if (!court) court = new CourtView(mount, { text: L });
      court.onFrame = (dt, beat) => this._tickClock(dt, beat);
      this.court = court;
      this.root.dataset.court = court instanceof CourtView ? '2d' : '3d';
      this._bindPointer();
      return court;
    })();
    return this._courtPromise;
  }
}
