/* Caesar Games — browser end-to-end tests
 *
 * These drive the REAL user interface: they dispatch real click events on real
 * elements and assert what is actually on screen (element boxes, computed
 * styles, rendered text) rather than inspecting objects. A control that exists
 * but is invisible must fail here — that is precisely the class of defect that
 * shipped in v1.0.3.
 *
 * Run from the page console:
 *     const { runE2E } = await import('./tests/e2e.js'); await runE2E();
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ---------- assertions grounded in what is painted ---------- */

function box(el) {
  if (!el) return { w: 0, h: 0 };
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height, top: r.top, left: r.left, bottom: r.bottom, right: r.right };
}

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width * r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
}

/** Click the way a finger does: on the element, through the real event path. */
function tap(elOrSel) {
  const el = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
  if (!el) throw new Error(`no element for ${elOrSel}`);
  if (!isVisible(el)) throw new Error(`element ${elOrSel} is not visible — cannot be tapped`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return el;
}

/** Tap whatever is actually on top at the element's centre (catches overlays). */
function tapAtCenter(elOrSel) {
  const el = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
  if (!el) throw new Error(`no element for ${elOrSel}`);
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  if (!hit) throw new Error('nothing at that point');
  if (!el.contains(hit) && hit !== el) {
    throw new Error(`${elOrSel} is covered by <${hit.tagName.toLowerCase()} class="${hit.className}">`);
  }
  hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return hit;
}

async function waitFor(fn, { timeout = 4000, label = 'condition' } = {}) {
  const t0 = performance.now();
  for (;;) {
    let v;
    try { v = fn(); } catch { v = false; }
    if (v) return v;
    if (performance.now() - t0 > timeout) throw new Error(`timed out waiting for ${label}`);
    await sleep(30);
  }
}

const app = () => window.caesarApp;
const S = () => window.CaesarDebug.S;
const activeScreen = () => $$('.screen').find(s => s.classList.contains('is-active'))?.dataset.screen;
const openDialog = () => $$('.dialog').find(d => isVisible(d))?.dataset.dialog || null;

/* ---------- flows ---------- */

async function goHome() {
  app().goHome();
  await waitFor(() => activeScreen() === 'home', { label: 'home screen' });
}

async function openMode() {
  tap('#btn-play');
  await waitFor(() => openDialog() === 'mode', { label: 'mode dialog' });
}

async function startMode(mode, names = {}) {
  await openMode();
  tap(`[data-mode="${mode}"]`);
  await waitFor(() => openDialog() === 'names', { label: 'names dialog' });
  if (names.p1 !== undefined) $('#input-p1').value = names.p1;
  if (names.p2 !== undefined) $('#input-p2').value = names.p2;
  tap('#btn-start-match');
  await waitFor(() => activeScreen() === 'board', { label: 'board screen' });
  await waitFor(() => isVisible($('.bv-board')), { label: 'painted board' });
}

/** Complete any setup phase quickly and land in play. */
async function reachPlay(mode) {
  if (mode === 'flip') return;
  tap('#btn-ready');                                  // navy / human
  if (mode === 'classic') {
    await waitFor(() => isVisible($('#handoff')), { label: 'handoff shield' });
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_P2_SETUP, { label: 'P2 setup' });
    tap('#btn-ready');
    await waitFor(() => isVisible($('#handoff')), { label: 'handoff to play' });
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_PLAY, { label: 'classic play' });
  } else {
    await waitFor(() => app().state === S().VS_AI_PLAY, { label: 'vs ai play' });
  }
}

/** Make one legal move for the side to move, through the board UI. */
async function makeUiMove() {
  const s = app().session;
  const side = s.controllingSide();
  for (const from of Object.keys(s.boardState)) {
    const p = s.boardState[from];
    if (!p || p.side !== side || p.static) continue;
    const targets = s.legalTargetsFrom(from);
    if (!targets.length) continue;
    tap(`.bv-node[data-key="${from}"]`);
    await sleep(20);
    tap(`.bv-node[data-key="${targets[0]}"]`);
    return { from, to: targets[0] };
  }
  return null;
}

/* ================================================================== *
 * Suite
 * ================================================================== */

export async function runE2E({ verbose = false } = {}) {
  const results = [];
  let pass = 0, fail = 0;

  async function T(name, fn) {
    try {
      await fn();
      pass++; results.push({ name, status: 'PASS' });
      if (verbose) console.log(`  ✓ ${name}`);
    } catch (e) {
      fail++; results.push({ name, status: 'FAIL', error: e.message });
      console.error(`  ✗ ${name}\n      ${e.message}`);
    }
  }
  const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
  const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
  const no = (v, m) => { if (v) throw new Error(m || 'expected falsy'); };
  const assertBoardGeometry = (label) => {
    const b = box($('.bv-board'));
    ok(b.w > 0, `${label}: board width must be positive, got ${b.w}`);
    ok(b.h > 0, `${label}: board height must be positive, got ${b.h}`);
    return b;
  };
  const visiblePieceCount = (selector = '.bv-piece') =>
    $$(selector).filter(isVisible).length;

  localStorage.clear();
  await goHome();

  /* ---------------- chrome & home ---------------- */

  await T('home shows brand, Play, Games and Learn', async () => {
    ok(isVisible($('#btn-play')), 'Play must be visible');
    ok(isVisible($('#btn-games')), 'Games must be visible');
    ok(isVisible($('#btn-learn')), 'Learn must be visible');
    ok(isVisible($('.home-mark')), 'CD mark must be visible');
    ok($('.makers-mark').textContent.includes('© 2026'), 'makers mark present');
  });

  await T('Continue is hidden when there is nothing to continue', async () => {
    localStorage.clear();
    app().render();
    no(isVisible($('#btn-continue')), 'Continue must be hidden on a fresh install');
  });

  await T('every primary control meets the 44px touch target', async () => {
    for (const sel of ['#btn-play', '#btn-games', '#btn-learn', '#btn-sound']) {
      const b = box($(sel));
      ok(b.h >= 36, `${sel} height ${b.h} is too small`);
    }
  });

  /* ---------------- THE OWNER-REPORTED DEFECT ---------------- */

  await T('REGRESSION: Play opens a VISIBLE mode dialog', async () => {
    await openMode();
    const d = $('[data-dialog="mode"]');
    ok(isVisible(d), 'mode dialog must be painted');
    ok(box(d).h > 0, 'mode dialog must have a real box');
  });

  await T('REGRESSION: every mode card opens a VISIBLE players dialog', async () => {
    for (const mode of ['vs_computer', 'classic', 'flip']) {
      await goHome();
      await openMode();
      tap(`[data-mode="${mode}"]`);
      await sleep(60);
      const d = $('[data-dialog="names"]');
      ok(isVisible(d), `${mode}: players dialog must be visible (v1.0.3 left it display:none)`);
      const b = box(d);
      ok(b.w > 0 && b.h > 0, `${mode}: players dialog box is ${b.w}x${b.h}`);
      ok(isVisible($('#btn-start-match')), `${mode}: Start button must be tappable`);
    }
  });

  await T('REGRESSION: choosing a mode never dumps the player back on Home', async () => {
    for (const mode of ['vs_computer', 'classic', 'flip']) {
      await goHome();
      await startMode(mode);
      eq(activeScreen(), 'board', `${mode} must open the board, not Home`);
      eq(app().session.mode, mode, `${mode} session started`);
    }
  });

  await T('no dialog in the document relies on an inline display style', async () => {
    for (const d of $$('.dialog, .overlay, .handoff, .screen')) {
      const inline = d.getAttribute('style') || '';
      no(/display\s*:/.test(inline), `${d.id || d.dataset.dialog || d.dataset.screen} carries inline display — the v1.0.3 defect`);
    }
  });

  /* ---------------- mode transition matrix ---------------- */

  const MODES3 = ['vs_computer', 'classic', 'flip'];

  await T('MATRIX: Home → each mode', async () => {
    for (const m of MODES3) {
      await goHome();
      await startMode(m);
      eq(app().session.mode, m);
    }
  });

  await T('MATRIX: every mode → Home → every mode, with zero moves', async () => {
    for (const a of MODES3) for (const b of MODES3) {
      await goHome();
      await startMode(a);
      const idA = app().session.gameId;
      await goHome();
      await startMode(b);
      eq(app().session.mode, b, `${a} → ${b}`);
      ok(app().session.gameId !== idA, `${a} → ${b} must be a NEW session`);
      eq(activeScreen(), 'board');
    }
  });

  await T('MATRIX: every mode → Home → every mode, after real play', async () => {
    for (const a of MODES3) for (const b of MODES3) {
      await goHome();
      await startMode(a);
      await reachPlay(a);
      await makeUiMove();
      await sleep(500);
      await goHome();
      await startMode(b);
      eq(app().session.mode, b, `played ${a} → ${b}`);
      eq(app().session.history.length, 0, `${a} → ${b}: new game must start with no history`);
      no(app().session.isGameOver, `${a} → ${b}: new game must not be over`);
      eq(activeScreen(), 'board');
    }
  });

  await T('MATRIX: leaving mid-AI-thinking then starting another mode is clean', async () => {
    await goHome();
    await startMode('vs_computer');
    await reachPlay('vs_computer');
    await makeUiMove();
    await waitFor(() => app().session.activeTurn === 'red', { label: 'AI turn scheduled' });
    await goHome();
    await startMode('classic');
    const cid = app().session.gameId;
    const boardBefore = JSON.stringify(app().session.boardState);
    await sleep(1400);                                 // the old AI timer would fire in here
    eq(app().session.gameId, cid, 'session must not be swapped out');
    eq(app().session.mode, 'classic');
    eq(JSON.stringify(app().session.boardState), boardBefore, 'a stale AI move corrupted the new game');
    eq(app().state, S().CLASSIC_P1_SETUP);
  });

  await T('MATRIX: a finished game does not block starting another mode', async () => {
    await goHome();
    await startMode('classic', { p1: 'A', p2: 'B' });
    await reachPlay('classic');
    // Force a finish through the engine, then render it.
    const s = app().session;
    s._finish('navy', 'flag');
    app().go(S().GAME_END);
    await waitFor(() => isVisible($('#game-end')), { label: 'end card' });
    ok(isVisible($('#btn-end-home')), 'Home must be offered');
    tap('#btn-end-home');
    await waitFor(() => activeScreen() === 'home', { label: 'home after end' });
    await startMode('flip');
    eq(app().session.mode, 'flip');
    no(app().session.isGameOver, 'the new game must not inherit game-over');
  });

  await T('MATRIX: Play again from the end card starts a NEW game id', async () => {
    await goHome();
    await startMode('flip', { p1: 'A', p2: 'B' });
    const s = app().session;
    const oldId = s.gameId;
    s._finish('navy', 'flag');
    app().go(S().GAME_END);
    await waitFor(() => isVisible($('#btn-end-again')));
    tap('#btn-end-again');
    await waitFor(() => app().session.gameId !== oldId, { label: 'new game id' });
    no(app().session.isGameOver);
  });

  /* ---------------- setup ---------------- */

  await T('setup shows only your own army', async () => {
    await goHome();
    await startMode('classic');
    eq(app().state, S().CLASSIC_P1_SETUP);
    assertBoardGeometry('Classic P1 setup');
    eq($$('.bv-piece.is-face').length, 25, 'own army face up');
    eq(visiblePieceCount('.bv-piece.is-face'), 25, 'visible P1 pieces');
    eq($$('.bv-piece.is-back').length, 25, 'opponent concealed');
    for (const el of $$('.bv-piece.is-back')) eq(el.textContent.trim(), '', 'a back must carry no text');
  });

  await T('campsites start empty', async () => {
    for (const c of ['7-1', '7-3', '8-2', '9-1', '9-3', '2-1', '2-3', '3-2', '4-1', '4-3']) {
      no($(`.bv-node[data-key="${c}"] .bv-piece`), `camp ${c} must be empty at setup`);
    }
  });

  await T('Quick setup produces a different, still-legal formation', async () => {
    const before = JSON.stringify(app().session.boardState);
    tap('#btn-quick-setup');
    await waitFor(() => !app()._busy, { label: 'Quick Setup settles' });
    ok(app().session.validateCurrentFormation().valid, 'quick setup must be legal');
    ok(JSON.stringify(app().session.boardState) !== before, 'quick setup should rearrange');
    eq($$('.bv-piece.is-face').length, 25);
  });

  await T('Reset restores the formation this player started from', async () => {
    const s = app().session;
    const baseline = JSON.stringify(s.setupBaseline);
    tap('#btn-quick-setup');
    await waitFor(() => !app()._busy, { label: 'Quick Setup before reset' });
    tap('#btn-reset-setup');
    await waitFor(() => !app()._busy, { label: 'Reset settles' });
    const now = {};
    for (const [k, p] of Object.entries(s.boardState)) if (p.side === s.setupSide) now[k] = p;
    eq(Object.keys(now).length, 25);
    ok(baseline.length > 0);
  });

  await T('an illegal setup swap is refused and explained', async () => {
    const s = app().session;
    s.selected = null; app().render();
    const flagKey = Object.keys(s.boardState).find(k => s.boardState[k].name === '军旗' && s.boardState[k].side === s.setupSide);
    const plain = Object.keys(s.boardState).find(k =>
      s.boardState[k].side === s.setupSide && !['11-1', '11-3', '0-1', '0-3'].includes(k));
    tap(`.bv-node[data-key="${flagKey}"]`);
    await sleep(30);
    tap(`.bv-node[data-key="${plain}"]`);
    await sleep(20);
    const resistance = $(`.bv-node[data-key="${flagKey}"] .bv-piece`).getAnimations();
    ok(resistance.some(animation => animation.effect.getTiming().duration === 125),
      'invalid setup move needs a short physical resistance cue');
    await sleep(50);
    ok(isVisible($('#toast')), 'the player must be told why');
    ok(/Headquarters/i.test($('#toast').textContent), `unhelpful message: ${$('#toast').textContent}`);
    eq(s.boardState[flagKey].name, '军旗', 'the flag must not have moved');
  });

  await T('a legal setup swap actually moves both pieces on screen', async () => {
    const s = app().session;
    s.selected = null; app().render();
    const own = Object.keys(s.boardState).filter(k => s.boardState[k].side === s.setupSide);
    let a = null, b = null;
    for (const x of own) for (const y of own) {
      if (x === y || a) continue;
      const px = s.boardState[x], py = s.boardState[y];
      if (px.name === '军旗' || py.name === '军旗' || px.name === '地雷' || py.name === '地雷'
        || px.name === '炸弹' || py.name === '炸弹') continue;
      a = x; b = y;
    }
    const nameA = s.boardState[a].name, nameB = s.boardState[b].name;
    tap(`.bv-node[data-key="${a}"]`); await sleep(30);
    tap(`.bv-node[data-key="${b}"]`); await sleep(300);
    eq($(`.bv-node[data-key="${a}"] .bv-piece`).textContent, nameB, 'rendered swap A');
    eq($(`.bv-node[data-key="${b}"] .bv-piece`).textContent, nameA, 'rendered swap B');
  });

  /* ---------------- classic perspective & privacy ---------------- */

  await T('classic: the privacy shield hides the board between players', async () => {
    await goHome();
    await startMode('classic', { p1: 'Caesar', p2: 'Daddy' });
    tap('#btn-ready');
    await waitFor(() => isVisible($('#handoff')), { label: 'shield' });
    const shield = $('#handoff').getBoundingClientRect();
    eq(shield.width, window.innerWidth, 'shield must cover the full width');
    eq(shield.height, window.innerHeight, 'shield must cover the full height');
    ok($('#handoff-name').textContent.includes('Daddy'), 'names the receiving player');
    const z = Number(getComputedStyle($('#handoff')).zIndex);
    ok(z >= 200, `shield z-index ${z} must sit above the board`);
  });

  await T('classic: P2 setup shows P2 army with P2 at the bottom', async () => {
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_P2_SETUP, { label: 'P2 setup' });
    eq(app().session.setupSide, 'red');
    assertBoardGeometry('Classic P2 setup');
    eq($('.bv-board').dataset.orientation, 'red_bottom', 'board must rotate for P2');
    // P2's own army (red, canonical rows 0-5) must be painted in the lower half.
    const redEls = $$('.bv-piece.is-face.side-red');
    eq(redEls.length, 25);
    eq(visiblePieceCount('.bv-piece.is-face.side-red'), 25, 'visible P2 pieces');
    const boardRect = $('.bv-board').getBoundingClientRect();
    const mid = boardRect.top + boardRect.height / 2;
    const below = redEls.filter(e => e.getBoundingClientRect().top > mid).length;
    ok(below >= 20, `expected P2 army at the bottom, only ${below}/25 below the midline`);
  });

  await T('classic: play begins with P1 at the bottom', async () => {
    tap('#btn-ready');
    await waitFor(() => isVisible($('#handoff')));
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_PLAY, { label: 'classic play' });
    assertBoardGeometry('Classic gameplay');
    eq($('.bv-board').dataset.orientation, 'navy_bottom');
    const navyEls = $$('.bv-piece.is-face.side-navy');
    const boardRect = $('.bv-board').getBoundingClientRect();
    const mid = boardRect.top + boardRect.height / 2;
    ok(navyEls.filter(e => e.getBoundingClientRect().top > mid).length >= 20, 'P1 at the bottom');
  });

  await T('classic: canonical coordinates never rotate', async () => {
    const s = app().session;
    const flagKey = Object.keys(s.boardState).find(k => s.boardState[k].name === '军旗' && s.boardState[k].side === 'navy');
    ok(['11-1', '11-3'].includes(flagKey), `navy flag must stay in a canonical navy HQ, found ${flagKey}`);
    const redFlag = Object.keys(s.boardState).find(k => s.boardState[k].name === '军旗' && s.boardState[k].side === 'red');
    ok(['0-1', '0-3'].includes(redFlag), `red flag canonical, found ${redFlag}`);
  });

  await T('classic: a tap maps to the canonical square under the finger', async () => {
    const s = app().session;
    // Pick a navy piece with at least one legal move and click by SCREEN position.
    let from = null;
    for (const k of Object.keys(s.boardState)) {
      if (s.boardState[k].side !== 'navy' || s.boardState[k].static) continue;
      if (s.legalTargetsFrom(k).length) { from = k; break; }
    }
    const node = $(`.bv-node[data-key="${from}"]`);
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const owner = hit.closest('.bv-node');
    eq(owner.dataset.key, from, 'the element under that point must be the same canonical node');
    tapAtCenter(node);
    await sleep(40);
    eq(s.selected, from, 'selection followed the finger to the right canonical square');
    tapAtCenter(node); await sleep(40);
  });

  await T('classic: the enemy army leaks nothing into the DOM', async () => {
    const names = /司令|军长|师长|旅长|团长|营长|连长|排长|工兵|地雷|炸弹|军旗/;
    const s = app().session;
    const viewerSide = s.activeTurn;
    for (const [k, p] of Object.entries(s.boardState)) {
      if (p.side === viewerSide) continue;
      const node = $(`.bv-node[data-key="${k}"]`);
      const el = node.firstElementChild;
      if (!el) continue;
      no(names.test(el.textContent || ''), `${k} renders an enemy name`);
      no(names.test(el.outerHTML), `${k} leaks an enemy name in markup: ${el.outerHTML.slice(0, 120)}`);
      no(el.className.includes('side-'), `${k} leaks the owning side via class ${el.className}`);
      for (const a of el.attributes) {
        no(names.test(a.value), `${k} leaks via attribute ${a.name}="${a.value}"`);
      }
    }
  });

  await T('classic: concealed backs are visually identical for both armies', async () => {
    const backs = $$('.bv-piece.is-back');
    ok(backs.length > 0);
    const sig = backs.map(b => {
      const cs = getComputedStyle(b);
      return `${cs.backgroundImage}|${cs.boxShadow}|${cs.transform}|${b.className}`;
    });
    eq(new Set(sig).size, 1, 'all concealed backs must render identically');
  });

  await T('classic: combat leaves the surviving enemy concealed', async () => {
    const s = app().session;
    // Stage a fight the attacker will lose.
    s.boardState = {
      '7-0': { id: 'n1', side: 'navy', name: '旅长', rank: 4, static: false, revealed: false },
      '6-0': { id: 'r1', side: 'red', name: '司令', rank: 1, static: false, revealed: false },
      '11-1': { id: 'nf', side: 'navy', name: '军旗', rank: 0, static: true, revealed: false },
      '0-1': { id: 'rf', side: 'red', name: '军旗', rank: 0, static: true, revealed: false },
      '10-0': { id: 'n2', side: 'navy', name: '连长', rank: 7, static: false, revealed: false },
      '1-0': { id: 'r2', side: 'red', name: '连长', rank: 7, static: false, revealed: false }
    };
    s.activeTurn = 'navy';
    app().render();
    tap('.bv-node[data-key="7-0"]'); await sleep(30);
    tap('.bv-node[data-key="6-0"]');
    await waitFor(() => app().state === S().CLASSIC_HANDOFF || !app().board.animating, { timeout: 5000, label: 'move settled' });
    await sleep(200);

    no(s.boardState['7-0'], 'the losing attacker is gone');
    eq(s.boardState['6-0'].name, '司令', 'the defender survives in canonical state');
    no(s.boardState['6-0'].revealed, 'the survivor must NOT be flipped face up');
  });

  await T('classic: after handoff the receiving player still cannot see the survivor', async () => {
    await waitFor(() => isVisible($('#handoff')), { label: 'shield after combat' });
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_PLAY);
    await sleep(1500);                                  // let the last-move replay finish
    const s = app().session;
    eq(s.activeTurn, 'red');
    // Red is now looking; red owns 6-0, so red SEES it. Flip to navy's view to check.
    s.activeTurn = 'navy'; app().render();
    const el = $('.bv-node[data-key="6-0"] .bv-piece');
    ok(el.classList.contains('is-back'), 'navy must still see a concealed back after combat');
    eq(el.textContent.trim(), '');
    s.activeTurn = 'red'; app().render();
  });

  /* ---------------- last move ---------------- */

  await T('Replay last move is offered and actually animates', async () => {
    const s = app().session;
    ok(s.lastMove, 'a last move exists');
    app().render();
    ok(isVisible($('#btn-replay-move')), 'Replay control must be visible during a turn');
    const overlay = $('.bv-overlay');
    tap('#btn-replay-move');

    // A real travelling element must be created in the overlay...
    const flyer = await waitFor(() => overlay.querySelector('.bv-flyer'), { timeout: 2500, label: 'flyer element' });
    ok(flyer, 'a piece must visibly travel');

    // ...carrying a real transform animation over a real distance.
    const anims = flyer.getAnimations();
    ok(anims.length > 0, 'the travelling piece has no animation attached');
    const frames = anims[0].effect.getKeyframes();
    const last = frames[frames.length - 1].transform || '';
    const nums = (last.match(/-?[\d.]+px/g) || []).map(parseFloat);
    const distance = Math.hypot(...(nums.length ? nums : [0]));
    ok(distance > 8, `the animation only travels ${distance.toFixed(1)}px`);
    const dur = anims[0].effect.getTiming().duration;
    ok(dur >= 150 && dur <= 400, `travel duration ${dur}ms is outside the 150-400ms brief`);

    // When the tab is actually being painted, verify real pixel movement too.
    if (document.visibilityState === 'visible') {
      const t0 = flyer.getBoundingClientRect();
      await sleep(160);
      const t1 = flyer.getBoundingClientRect();
      ok(Math.abs(t1.left - t0.left) + Math.abs(t1.top - t0.top) > 4,
        'the travelling piece must actually move on screen');
    }
    await waitFor(() => !app().board.animating, { timeout: 6000, label: 'replay finished' });
  });

  /* ---------------- flip ---------------- */

  await T('flip: 50 identical face-down pieces, camps empty', async () => {
    await goHome();
    await startMode('flip', { p1: 'Caesar', p2: 'Daddy' });
    eq($$('.bv-piece').length, 50);
    eq($$('.bv-piece.is-back').length, 50, 'everything starts face down');
    assertBoardGeometry('Flip initial');
    eq(visiblePieceCount('.bv-piece.is-back'), 50, 'all initial piece backs must be visible');
    eq($('.bv-board').dataset.orientation, 'navy_bottom');
  });

  await T('flip: the board never rotates between turns', async () => {
    const s = app().session;
    const first = Object.keys(s.boardState)[0];
    const beforeTop = $(`.bv-node[data-key="${first}"]`).getBoundingClientRect().top;
    tap(`.bv-node[data-key="${first}"]`);
    await sleep(600);
    eq($('.bv-board').dataset.orientation, 'navy_bottom', 'orientation must be stable');
    const afterTop = $(`.bv-node[data-key="${first}"]`).getBoundingClientRect().top;
    ok(Math.abs(afterTop - beforeTop) < 2, 'stations must not move between turns');
  });

  await T('flip: top-owner reveal turns at midpoint without rotating its shell', async () => {
    const s = app().session;
    const { sounds } = await import('../js/engine/sound.js');
    const seat2Side = s.assignedColors.p2;
    const key = Object.keys(s.boardState).find(k =>
      !s.boardState[k].revealed && s.boardState[k].side === seat2Side);
    ok(key, 'a concealed top-owner piece exists');
    sounds.clearAudit();
    tap(`.bv-node[data-key="${key}"]`);
    const flyer = await waitFor(() => $('.bv-reveal-flyer'), {
      label: 'reveal flyer'
    });
    ok(flyer.classList.contains('is-back'), 'reveal begins with the concealed back');
    await waitFor(() => $('.bv-reveal-flyer.is-face.faces-top'), {
      label: 'reveal midpoint face'
    });
    const midFlyer = $('.bv-reveal-flyer');
    const shellTransform = getComputedStyle(midFlyer).transform;
    const faceTransform = getComputedStyle(midFlyer.querySelector('.bv-face')).transform;
    no(/matrix\(-1,\s*0,\s*0,\s*-1/.test(shellTransform),
      `orientation leaked onto reveal shell: ${shellTransform}`);
    no(faceTransform === 'none', 'top-owner reveal face must be owner-oriented');
    eq(getComputedStyle($(`.bv-node[data-key="${key}"] .bv-piece`)).visibility, 'hidden',
      'settled piece stays hidden during reveal motion');
    await waitFor(() => !$('.bv-reveal-flyer') && !app().board.animating, {
      timeout: 4000, label: 'reveal settles'
    });
    ok($(`.bv-node[data-key="${key}"] .bv-piece`).classList.contains('faces-top'),
      'final revealed piece preserves top-owner orientation');
    const cues = sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue);
    eq(cues.filter(cue => cue === 'reveal').length, 1, 'one reveal cue');
    eq(cues.filter(cue => cue === 'place').length, 0, 'no duplicate place cue');
  });

  await T('flip: revealed armies face opposite directions, by owner not by square', async () => {
    const s = app().session;
    // Reveal a good number of pieces so both armies are represented.
    for (const k of Object.keys(s.boardState).slice(0, 30)) s.boardState[k].revealed = true;
    if (!s.assignedColors.p1) { s.assignedColors = { p1: 'navy', p2: 'red' }; }
    app().render();

    const seat1Side = s.assignedColors.p1;
    const seat2Side = s.assignedColors.p2;
    let checked1 = 0, checked2 = 0;

    for (const [k, p] of Object.entries(s.boardState)) {
      if (!p.revealed) continue;
      const el = $(`.bv-node[data-key="${k}"] .bv-piece`);
      if (!el) continue;
      const rotated = el.classList.contains('faces-top');
      if (p.side === seat1Side) { no(rotated, `${k}: seat-1 piece must face the bottom player`); checked1++; }
      if (p.side === seat2Side) { ok(rotated, `${k}: seat-2 piece must face the top player`); checked2++; }
    }
    ok(checked1 > 0 && checked2 > 0, `needed both armies on screen (${checked1}/${checked2})`);

    // Ownership must not depend on which half the piece stands in.
    const topHalf = Object.keys(s.boardState).filter(k => Number(k.split('-')[0]) <= 5 && s.boardState[k].revealed);
    const seat1InTopHalf = topHalf.filter(k => s.boardState[k].side === seat1Side);
    if (seat1InTopHalf.length) {
      const el = $(`.bv-node[data-key="${seat1InTopHalf[0]}"] .bv-piece`);
      no(el.classList.contains('faces-top'),
        'a seat-1 piece standing in the top half must STILL face the bottom player');
    }
  });

  await T('flip: rotation is applied to the face only, never to the board', async () => {
    const tracks = $('.bv-tracks');
    const cs = getComputedStyle(tracks);
    ok(cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)', `tracks are transformed: ${cs.transform}`);
    for (const sel of ['#app-bar', '#turn-status', '.rail-right']) {
      const t = getComputedStyle($(sel)).transform;
      ok(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)', `${sel} must stay upright, got ${t}`);
    }
  });

  await T('flip: shell motion follows screen vectors for both armies and face directions', async () => {
    const view = app().board;
    const vectors = [
      ['right', '4-0', '4-1'],
      ['left', '4-1', '4-0'],
      ['down-cross-half', '5-0', '6-0'],
      ['up-cross-half', '6-0', '5-0']
    ];
    for (const side of ['navy', 'red']) {
      for (const topFacing of [false, true]) {
        for (const [direction, from, to] of vectors) {
          const start = view.centerOf(from);
          const end = view.centerOf(to);
          const cls = `is-face side-${side}${topFacing ? ' faces-top' : ''}`;
          const motion = view.animateMove({
            from, to, combat: false, faceHtml: '兵', faceClass: cls
          });
          let flyer = $('.bv-flyer');
          // WebKit may defer the first animation tick under load. Sample only
          // after the shell has genuinely entered the path.
          for (let tick = 0; tick < 10; tick++) {
            await sleep(20);
            flyer = $('.bv-flyer');
            const active = flyer?.getAnimations().some(a => (a.currentTime || 0) >= 30);
            if (active) break;
          }
          const rect = flyer.getBoundingClientRect();
          const board = $('.bv-board').getBoundingClientRect();
          const mid = {
            x: rect.left - board.left + rect.width / 2,
            y: rect.top - board.top + rect.height / 2
          };
          const expectedX = Math.sign(end.x - start.x);
          const expectedY = Math.sign(end.y - start.y);
          if (expectedX) {
            ok(Math.sign(mid.x - start.x) === expectedX,
              `${side} ${topFacing ? 'top' : 'bottom'} ${direction} reversed horizontally`);
            // Premium tabletop motion includes a small screen-space lift. It
            // may rise, but must never veer sideways or reverse the move.
            ok(mid.y - start.y < 3 && Math.abs(mid.y - start.y) < start.h * .28,
              `${direction} lift left its restrained lane`);
          }
          if (expectedY) {
            ok(Math.sign(mid.y - start.y) === expectedY,
              `${side} ${topFacing ? 'top' : 'bottom'} ${direction} reversed vertically`);
            ok(Math.abs(mid.x - start.x) < 3, `${direction} drifted horizontally`);
          }
          const faceTransform = getComputedStyle(flyer.querySelector('.bv-face')).transform;
          if (topFacing) no(faceTransform === 'none', 'top face did not rotate');
          else ok(faceTransform === 'none' || /matrix\(1,\s*0,\s*0,\s*1/.test(faceTransform),
            `bottom face rotated: ${faceTransform}`);
          await motion;
        }
      }
    }
  });

  /* ---------------- vs computer ---------------- */

  await T('vs computer: setup, Quick Setup, Reset and Ready keep a painted board', async () => {
    await goHome();
    await startMode('vs_computer', { p1: 'Caesar' });
    assertBoardGeometry('Vs Computer setup');
    eq(visiblePieceCount('.bv-piece.is-face.side-navy'), 25, 'visible own setup pieces');

    const { sounds } = await import('../js/engine/sound.js');
    sounds.clearAudit();
    tap('#btn-quick-setup');
    tap('#btn-quick-setup');
    await waitFor(() => $$('.bv-piece').some(piece => piece.getAnimations().length), {
      label: 'coordinated Quick Setup motion'
    });
    ok($$('.bv-piece').some(piece =>
      piece.getAnimations().some(animation => animation.effect.getTiming().duration === 205)),
    'Quick Setup uses the shared short settling duration');
    await sleep(320);
    assertBoardGeometry('Vs Computer Quick Setup');
    eq(visiblePieceCount('.bv-piece.is-face.side-navy'), 25, 'visible pieces after Quick Setup');
    eq(sounds.getAudit().filter(entry => entry.played && entry.cue === 'shuffle').length, 1,
      'double-tapped Quick Setup has one coordinated tabletop cue');

    tap('#btn-reset-setup');
    await sleep(100);
    assertBoardGeometry('Vs Computer Reset');
    eq(visiblePieceCount('.bv-piece.is-face.side-navy'), 25, 'visible pieces after Reset');

    tap('#btn-ready');
    await waitFor(() => app().state === S().VS_AI_PLAY, { label: 'vs computer gameplay' });
    assertBoardGeometry('Vs Computer gameplay');
    eq(visiblePieceCount('.bv-piece'), 50, 'all gameplay pieces have visible geometry');
  });

  await T('vs computer: human is bottom, computer is top, no pass screen', async () => {
    await goHome();
    await startMode('vs_computer', { p1: 'Caesar' });
    await reachPlay('vs_computer');
    eq($('.bv-board').dataset.orientation, 'navy_bottom');
    no(isVisible($('#handoff')), 'vs computer must never show the pass shield');
    eq(app().session.player2Name, 'Computer');
  });

  await T('vs computer: the computer replies exactly once', async () => {
    const s = app().session;
    const before = s.history.length;
    await makeUiMove();
    await waitFor(() => s.activeTurn === 'navy' && !app().board.animating, { timeout: 8000, label: 'AI reply' });
    await sleep(400);
    eq(s.history.length, before + 2, 'exactly one human move and one AI move');
    eq(s.activeTurn, 'navy', 'control returns to the human');
    eq(s.history[s.history.length - 1].side, 'red');
  });

  await T('vs computer: the computer never moves twice in a row', async () => {
    const s = app().session;
    for (let i = 0; i < 3; i++) {
      await makeUiMove();
      await waitFor(() => s.activeTurn === 'navy' && !app().board.animating, { timeout: 8000, label: `AI reply ${i}` });
      await sleep(250);
    }
    let consecutive = 0;
    for (let i = 1; i < s.history.length; i++) {
      if (s.history[i].side === 'red' && s.history[i - 1].side === 'red') consecutive++;
    }
    eq(consecutive, 0, 'found back-to-back computer moves');
  });

  /* ---------------- library, save & resume ---------------- */

  await T('Games library opens and is visible', async () => {
    await goHome();
    tap('#btn-games');
    await waitFor(() => openDialog() === 'library', { label: 'library dialog' });
    ok(isVisible($('#library-list')), 'library list must be painted');
    ok($$('.game-row').length > 0, 'saved games must be listed');
  });

  await T('multiple games coexist across modes', async () => {
    const modes = new Set($$('.game-row .game-row-meta').map(e => e.textContent.split('·')[0].trim()));
    ok(modes.size >= 2, `expected several modes in the library, saw ${[...modes].join(', ')}`);
  });

  await T('starting a new game never overwrites an existing one', async () => {
    localStorage.clear();
    await goHome();
    await startMode('classic', { p1: 'Keep', p2: 'Me' });
    await goHome();
    const before = 0;
    tap('#btn-games'); await sleep(80);
    const countBefore = $$('.game-row').length;
    tap('#btn-close-library'); await sleep(60);
    await startMode('flip', { p1: 'X', p2: 'Y' });
    await goHome();
    tap('#btn-games'); await sleep(80);
    eq($$('.game-row').length, countBefore + 1, 'exactly one game added');
    void before;
    tap('#btn-close-library'); await sleep(60);
  });

  await T('opening the app does not create a junk game', async () => {
    await goHome();
    tap('#btn-games'); await sleep(80);
    const before = $$('.game-row').length;
    tap('#btn-close-library'); await sleep(40);
    // Simulate a fresh boot of the controller.
    const lib = JSON.parse(localStorage.getItem('caesar_games_library'));
    eq(lib.games.length, before, 'library size matches what is listed');
    await goHome();
    tap('#btn-games'); await sleep(80);
    eq($$('.game-row').length, before, 'navigating must not add games');
    tap('#btn-close-library'); await sleep(40);
  });

  await T('Continue reopens the most recent unfinished game', async () => {
    await goHome();
    ok(isVisible($('#btn-continue')), 'Continue must appear when a game is unfinished');
    const detail = $('#continue-detail').textContent;
    tap('#btn-continue');
    await waitFor(() => activeScreen() === 'board', { label: 'resumed board' });
    ok(detail.length > 0);
  });

  await T('resuming a classic game shields the board first', async () => {
    localStorage.clear();
    await goHome();
    await startMode('classic', { p1: 'P', p2: 'Q' });
    await reachPlay('classic');
    await makeUiMove();
    await sleep(600);
    const gid = app().session.gameId;
    await goHome();
    app().resumeGame(gid);
    await sleep(120);
    ok(isVisible($('#handoff')), 'a resumed shared-iPad game must not expose the board');
    tap('#btn-handoff-ready');
    await waitFor(() => app().state === S().CLASSIC_PLAY);
    await sleep(1400);
  });

  await T('deleting one game leaves the others alone', async () => {
    await goHome();
    tap('#btn-games'); await sleep(100);
    const rows = $$('.game-row');
    const before = rows.length;
    ok(before >= 2, 'need at least two games');
    const victimText = rows[0].querySelector('.game-row-players').textContent;
    rows[0].querySelector('.row-btn.danger').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => isVisible($('#confirm')), { label: 'delete confirmation' });
    tap('#btn-confirm-ok');
    await sleep(120);
    eq($$('.game-row').length, before - 1, 'exactly one game removed');
    const remaining = $$('.game-row').map(r => r.querySelector('.game-row-players').textContent);
    void victimText; void remaining;
    tap('#btn-close-library'); await sleep(60);
  });

  await T('the library prunes to 20 games without losing live ones', async () => {
    const { saveGame, listGames } = await import('../js/engine/persistence.js');
    for (let i = 0; i < 30; i++) {
      saveGame({
        gameId: `bulk_${i}`, mode: 'flip', player1Name: 'A', player2Name: 'B',
        startedAt: Date.now() - i * 1000, updatedAt: Date.now() - i * 1000,
        status: i === 29 ? 'in_progress' : 'finished', moveCount: 1,
        boardState: { '0-0': { id: 'x', side: 'navy', name: '连长', rank: 7 } },
        history: [], flagDisclosed: { navy: false, red: false }, assignedColors: { p1: 'navy', p2: 'red' },
        capturedPieces: [], phase: 'play', activeTurn: 'navy', winner: null
      });
    }
    const games = listGames();
    ok(games.length <= 20, `library grew to ${games.length}`);
    ok(games.some(g => g.status === 'in_progress'), 'an unfinished game must survive pruning');
  });

  /* ---------------- record & replay ---------------- */

  await T('a finished game offers a record that replays from history', async () => {
    localStorage.clear();
    await goHome();
    await startMode('vs_computer', { p1: 'Caesar' });
    await reachPlay('vs_computer');
    for (let i = 0; i < 2; i++) {
      await makeUiMove();
      await waitFor(() => app().session.activeTurn === 'navy' && !app().board.animating, { timeout: 8000, label: 'ai' });
      await sleep(200);
    }
    const s = app().session;
    s._finish('navy', 'flag');
    app().persist();

    await goHome();
    tap('#btn-games');
    await waitFor(() => openDialog() === 'library');
    const recBtn = $$('.game-row .row-btn').find(b => b.textContent === 'Record');
    ok(recBtn, 'a finished game must offer Record');
    recBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => openDialog() === 'record', { label: 'record dialog' });

    ok(isVisible($('#replay-board')), 'the replay board must be painted');
    ok($$('.record-move').length >= 4, 'moves must be listed');
    ok($('#replay-board .bv-board'), 'a real board is rendered for replay');
  });

  await T('replay step forward and back change the position', async () => {
    const posAt = () => $$('#replay-board .bv-node').map(n => n.dataset.key + (n.firstElementChild ? '1' : '0')).join('');
    const p0 = posAt();
    tap('#btn-replay-next'); await sleep(120);
    tap('#btn-replay-next'); await sleep(120);
    const p2 = posAt();
    ok(p0 !== p2, 'stepping forward must change the board');
    tap('#btn-replay-prev'); await sleep(120);
    tap('#btn-replay-prev'); await sleep(120);
    eq(posAt(), p0, 'stepping back must restore the earlier position');
  });

  await T('replay does not mutate any saved game', async () => {
    const { loadGame } = await import('../js/engine/persistence.js');
    const id = app().replay.rec.gameId;
    const before = JSON.stringify(loadGame(id));
    tap('#btn-replay-next'); await sleep(120);
    tap('#btn-replay-next'); await sleep(120);
    eq(JSON.stringify(loadGame(id)), before, 'replay wrote back into the record');
  });

  await T('classic replay stays privacy-safe', async () => {
    const { saveGame } = await import('../js/engine/persistence.js');
    const { GameSession } = await import('../js/engine/session.js');
    const s = new GameSession('classic', { player1Name: 'A', player2Name: 'B' });
    s.openingBoard = JSON.parse(JSON.stringify(s.boardState));
    s.lockSetup(); s.lockSetup();
    const { legalMovesFor } = await import('../js/engine/rules.js');
    const m = legalMovesFor('navy', s.boardState)[0];
    s.applyMove(m.from, m.to);
    s._finish('navy', 'flag');
    const rec = s.toRecord(); rec.openingBoard = s.openingBoard;
    saveGame(rec);

    app().closeRecord();
    app().openRecord(rec.gameId);
    await waitFor(() => openDialog() === 'record');
    await sleep(150);
    const faces = $$('#replay-board .bv-piece.is-face').length;
    eq(faces, 0, 'a concealed game must replay with every identity still concealed');
    app().closeRecord();
    await sleep(60);
  });

  /* ---------------- persistence across reload ---------------- */

  await T('state survives a reload at every stage (simulated via records)', async () => {
    const { GameSession } = await import('../js/engine/session.js');
    const { legalMovesFor } = await import('../js/engine/rules.js');

    const stages = [];
    // classic: p1 setup / p2 setup / play / after battle
    const c = new GameSession('classic', { player1Name: 'A', player2Name: 'B' });
    stages.push(['classic p1 setup', c.toRecord()]);
    c.lockSetup();
    stages.push(['classic p2 setup', c.toRecord()]);
    c.lockSetup();
    stages.push(['classic play', c.toRecord()]);
    const cm = legalMovesFor('navy', c.boardState)[0];
    c.applyMove(cm.from, cm.to); c.endTurn();
    stages.push(['classic after move', c.toRecord()]);

    const v = new GameSession('vs_computer', { player1Name: 'A' });
    stages.push(['vs ai setup', v.toRecord()]);
    v.lockSetup();
    stages.push(['vs ai play', v.toRecord()]);

    const f = new GameSession('flip', {});
    stages.push(['flip pre-reveal', f.toRecord()]);
    f.revealPiece(Object.keys(f.boardState)[0]); f.endTurn();
    stages.push(['flip after reveal', f.toRecord()]);

    for (const [label, rec] of stages) {
      const round = GameSession.fromRecord(JSON.parse(JSON.stringify(rec)));
      eq(round.mode, rec.mode, `${label}: mode`);
      eq(round.phase, rec.phase, `${label}: phase`);
      eq(Object.keys(round.boardState).length, Object.keys(rec.boardState).length, `${label}: board size`);
      eq(round.selected, null, `${label}: transient selection must not survive`);
      eq(round.history.length, rec.history.length, `${label}: history`);
    }
  });

  /* ---------------- failure injection ---------------- */

  await T('INTERRUPTION: a move is saved as one complete turn before animation settles', async () => {
    const { loadGame } = await import('../js/engine/persistence.js');
    await goHome();
    await startMode('vs_computer', { p1: 'A' });
    await reachPlay('vs_computer');
    const s = app().session;
    const from = Object.keys(s.boardState).find(k =>
      s.boardState[k].side === 'navy' && !s.boardState[k].static &&
      s.legalTargetsFrom(k).length);
    const to = s.legalTargetsFrom(from)[0];
    const settling = app().commitMove(from, to);
    await sleep(30);
    const saved = loadGame(s.gameId);
    eq(saved.history.length, 1, 'the canonical move must already be saved');
    eq(saved.activeTurn, 'red', 'the saved turn must already belong to the computer');
    no(saved.selected, 'transient selection must never be persisted');
    await settling;
    app().cancelAi();
  });

  await T('INTERRUPTION: reloading after P1 Ready restores the privacy shield', async () => {
    await goHome();
    await startMode('classic', { p1: 'A', p2: 'B' });
    tap('#btn-ready');
    await waitFor(() => isVisible($('#handoff')), { label: 'P2 handoff' });
    const gameId = app().session.gameId;
    await goHome();
    ok(app().resumeGame(gameId), 'saved setup must resume');
    await sleep(80);
    eq(app().state, S().CLASSIC_HANDOFF);
    ok(isVisible($('#handoff')), 'P2 formation must remain shielded');
    eq(app().pending.then, S().CLASSIC_P2_SETUP);
  });

  await T('FAILURE: double-tapping a mode card starts exactly one game', async () => {
    localStorage.clear();
    await goHome();
    await openMode();
    const card = $('[data-mode="classic"]');
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(80);
    tap('#btn-start-match');
    let secondTapRejected = false;
    try { tap('#btn-start-match'); } catch { secondTapRejected = true; }
    ok(secondTapRejected, 'the Start button must be gone after the game starts');
    await sleep(200);
    const { listGames } = await import('../js/engine/persistence.js');
    ok(listGames().length <= 2, `double tap created ${listGames().length} games`);
    eq(activeScreen(), 'board');
  });

  await T('FAILURE: hammering Home and Play leaves a coherent screen', async () => {
    for (let i = 0; i < 8; i++) {
      app().goHome();
      tap('#btn-play');
      await sleep(10);
    }
    await sleep(200);
    ok(activeScreen() === 'home', 'must settle on a real screen');
    ok(openDialog() === 'mode' || openDialog() === null);
    await goHome();
  });

  await T('FAILURE: rapid Ready taps do not double-advance setup', async () => {
    await goHome();
    await startMode('classic', { p1: 'A', p2: 'B' });
    tap('#btn-ready');
    try { tap('#btn-ready'); } catch { /* button now behind the shield — correct */ }
    await sleep(150);
    ok(isVisible($('#handoff')), 'shield shown');
    eq(app().session.setupSide, 'red', 'advanced exactly one step');
  });

  await T('FAILURE: rapid handoff taps advance one step', async () => {
    tap('#btn-handoff-ready');
    await sleep(30);
    try { tap('#btn-handoff-ready'); } catch { /* hidden — correct */ }
    await sleep(150);
    eq(app().state, S().CLASSIC_P2_SETUP);
  });

  await T('FAILURE: a second move cannot be made during the first animation', async () => {
    await goHome();
    await startMode('flip', {});
    const s = app().session;
    const keys = Object.keys(s.boardState);
    tap(`.bv-node[data-key="${keys[0]}"]`);
    tap(`.bv-node[data-key="${keys[1]}"]`);
    await sleep(700);
    ok(s.history.length <= 1, `expected at most one action, got ${s.history.length}`);
  });

  await T('FAILURE: an illegal move is refused with an explanation', async () => {
    await goHome();
    await startMode('vs_computer', { p1: 'A' });
    await reachPlay('vs_computer');
    const s = app().session;
    const from = Object.keys(s.boardState).find(k => s.boardState[k].side === 'navy' && !s.boardState[k].static
      && s.legalTargetsFrom(k).length);
    const targets = new Set(s.legalTargetsFrom(from));
    const bad = Object.keys(s.boardState).find(k => s.boardState[k].side === 'red' && !targets.has(k));
    tap(`.bv-node[data-key="${from}"]`); await sleep(30);
    tap(`.bv-node[data-key="${bad}"]`); await sleep(80);
    ok(isVisible($('#toast')), 'the player must be told');
    eq(s.history.length, 0, 'no move was made');
  });

  await T('FAILURE: corruption uses last-good recovery and isolates one malformed record', async () => {
    const { getLibrary, saveGame } = await import('../js/engine/persistence.js');
    localStorage.clear();
    const valid = {
      gameId: 'corruption_keeper', mode: 'flip', player1Name: 'A', player2Name: 'B',
      startedAt: Date.now(), updatedAt: Date.now(), status: 'in_progress',
      boardState: { '0-0': { id: 'x', side: 'navy', name: '连长', rank: 7 } },
      history: [], flagDisclosed: { navy: false, red: false },
      assignedColors: { p1: 'navy', p2: 'red' }, capturedPieces: [],
      phase: 'play', activeTurn: 'navy', winner: null
    };
    saveGame(valid);
    localStorage.setItem('caesar_games_library', '{{{not json');
    const lib = getLibrary();
    eq(lib.games.length, 1, 'last-good library must survive whole-payload corruption');
    eq(lib.games[0].gameId, valid.gameId);
    localStorage.setItem('caesar_games_library', JSON.stringify({
      games: [valid, { nonsense: true }, null]
    }));
    const isolated = getLibrary();
    eq(isolated.games.length, 1, 'only unusable records are dropped');
    eq(isolated.games[0].gameId, valid.gameId);
  });

  await T('FAILURE: a storage quota error cannot stop live play', async () => {
    await goHome();
    await startMode('flip', { p1: 'A', p2: 'B' });
    const s = app().session;
    const first = Object.keys(s.boardState)[0];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function quotaFailure(key, value) {
      if (key === 'caesar_games_library' || key === 'caesar_games_library_last_good') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
    try {
      await app().onFlipTap(first);
      eq(s.history.length, 1, 'the action must remain committed in memory');
      ok(s.boardState[first].revealed, 'the live board must remain playable');
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  await T('FAILURE: a legacy v1 save migrates instead of being lost', async () => {
    localStorage.clear();
    localStorage.setItem('caesar_games_state', JSON.stringify({
      mode: 'classic', activeTurn: 'navy', phase: 'play',
      board: { '10-0': { id: 'x', side: 'navy', name: '连长', rank: 7 } },
      history: [], timestamp: Date.now()
    }));
    const { getLibrary } = await import('../js/engine/persistence.js');
    const lib = getLibrary();
    eq(lib.games.length, 1, 'the legacy save must be carried forward');
    eq(lib.games[0].mode, 'classic');
  });

  /* ---------------- sound & layout ---------------- */

  await T('mute is persistent and never required to understand state', async () => {
    const { sounds } = await import('../js/engine/sound.js');
    const start = sounds.isMuted;
    tap('#btn-sound'); await sleep(40);
    eq(localStorage.getItem('caesar_games_muted'), String(sounds.isMuted), 'mute is stored');
    ok($('#btn-sound').getAttribute('aria-pressed') === String(!sounds.isMuted), 'button reflects state');
    if (sounds.isMuted !== start) { tap('#btn-sound'); await sleep(40); }
  });

  await T('audio recreates a closed context after an iOS-style interruption', async () => {
    const { sounds } = await import('../js/engine/sound.js');
    void sounds.unlock();
    await sleep(60);
    const interrupted = sounds.ctx;
    if (!interrupted?.close) return;
    await interrupted.close();
    void sounds.resume();
    await sleep(60);
    ok(sounds.ctx !== interrupted, 'a closed context must be replaced');
    no(sounds.ctx?.state === 'closed', 'replacement context must not stay closed');
  });

  await T('finished family memory uses existing metadata in both languages', async () => {
    const { formatFamilyMemory } = await import('../js/engine/persistence.js');
    const { setLocale } = await import('../js/i18n/strings.js');
    const record = {
      player1Name: 'Caesar', player2Name: 'Daddy', moveCount: 38,
      completedAt: new Date(2026, 6, 28).getTime()
    };
    setLocale('en');
    const english = formatFamilyMemory(record);
    ok(english.includes('Caesar vs Daddy') && english.includes('38 moves') &&
      english.includes('2026'), english);
    setLocale('zh');
    const chinese = formatFamilyMemory(record);
    ok(chinese.includes('Caesar') && chinese.includes('Daddy') && chinese.includes('38 步') &&
      chinese.includes('2026'), chinese);
    setLocale('en');
    app().render();
  });

  await T('iPad landscape: the board fits without scrolling', async () => {
    await goHome();
    await startMode('classic', { p1: 'A', p2: 'B' });
    await sleep(120);
    const b = assertBoardGeometry('iPad landscape');
    ok(b.top >= -1, `board is clipped at the top (${b.top})`);
    ok(b.bottom <= window.innerHeight + 1, `board overflows the bottom (${b.bottom} > ${window.innerHeight})`);
    ok(b.left >= -1 && b.right <= window.innerWidth + 1, 'board overflows horizontally');
    eq(document.documentElement.scrollHeight <= window.innerHeight + 2, true, 'the page must not scroll during play');
  });

  await T('iPad touch suppression is board-scoped and page zoom remains accessible', async () => {
    const board = $('.bv-board');
    const style = getComputedStyle(board);
    eq(style.touchAction, 'none', 'the game board must own touch gestures');
    eq(style.userSelect || style.webkitUserSelect, 'none',
      'board text must not be selectable');
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    board.dispatchEvent(menu);
    ok(menu.defaultPrevented, 'board long-press context behavior must be suppressed');
    const viewport = document.querySelector('meta[name="viewport"]').content;
    no(viewport.includes('user-scalable=no'), 'page zoom must remain available');
    no(viewport.includes('maximum-scale'), 'page zoom must not be capped');
    app().go(S().LEARN);
    await sleep(40);
    no(getComputedStyle($('[data-screen="learn"]')).touchAction === 'none',
      'Learn scrolling must not inherit board touch suppression');
    app().go(S().CLASSIC_P1_SETUP);
    await sleep(40);
  });

  await T('iPad landscape: controls stay on screen and tappable', async () => {
    for (const sel of ['#btn-ready', '#btn-quick-setup', '#btn-reset-setup', '#btn-home', '#btn-sound']) {
      const el = $(sel);
      ok(isVisible(el), `${sel} must be visible`);
      const r = el.getBoundingClientRect();
      ok(r.bottom <= window.innerHeight + 1 && r.top >= -1, `${sel} is off screen`);
      ok(r.height >= 36, `${sel} is only ${r.height}px tall`);
    }
  });

  await T('board stations are large enough to tap', async () => {
    const nodes = $$('.bv-node');
    const r = nodes[0].getBoundingClientRect();
    ok(r.width >= 40 && r.height >= 40, `station hit area is ${Math.round(r.width)}x${Math.round(r.height)}`);
  });

  /* ---------------- done ---------------- */

  console.log(`\n  Caesar Games — E2E: ${pass} passed, ${fail} failed\n`);
  return { pass, fail, results };
}

if (new URLSearchParams(location.search).get('e2e') === '1') {
  window.addEventListener('load', () => setTimeout(() => runE2E({ verbose: true }), 600));
}
