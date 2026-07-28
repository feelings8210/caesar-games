/* Rendered UI release gates for Xiangqi, Chess, bilingual shell and cross-game
 * isolation. Run in the page: import(...).then(m => m.runOpenE2E()).
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const visible = el => {
  if (!el) return false;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
};
const tap = target => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!visible(el)) throw new Error(`not visible: ${target}`);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
};
async function waitFor(fn, label, timeout = 7000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    try { const value = fn(); if (value) return value; } catch {}
    await sleep(25);
  }
  throw new Error(`timeout: ${label}`);
}
const app = () => window.caesarApp;

async function home() {
  app().goHome();
  await waitFor(() => $('[data-screen="home"]').classList.contains('is-active'), 'home');
}

async function startOpen(gameType, mode = 'two_player', options = {}) {
  await home();
  tap(`[data-game-type="${gameType}"]`);
  await waitFor(() => $('[data-dialog="mode"]').classList.contains('is-open'), 'mode dialog');
  tap(`[data-mode="${mode}"]`);
  await waitFor(() => $('[data-dialog="names"]').classList.contains('is-open'), 'names dialog');
  if (options.difficulty) tap(`#field-difficulty [data-value="${options.difficulty}"]`);
  if (options.secondSide) tap('#field-side [data-side="second"]');
  tap('#btn-start-match');
  await waitFor(() => visible($('.open-board')), `${gameType} board`);
}

async function startJunqi() {
  await home();
  tap('.game-tile[data-game-type="junqi"]');
  await waitFor(() => $('[data-dialog="mode"]').classList.contains('is-open'), 'Junqi mode');
  tap('[data-mode="vs_computer"]');
  await waitFor(() => $('[data-dialog="names"]').classList.contains('is-open'), 'Junqi names');
  tap('#btn-start-match');
  await waitFor(() => visible($('.bv-board')), 'Junqi board');
}

async function startType(type) {
  if (type === 'junqi') return startJunqi();
  return startOpen(type);
}

async function uiMove(move) {
  tap(`.open-node[data-key="${move.from}"]`);
  await waitFor(() => $(`.open-node[data-key="${move.to}"]`).classList.contains('is-legal'), 'legal marker');
  tap(`.open-node[data-key="${move.to}"]`);
  await waitFor(() => !app().openGame.busy, 'move settles');
}

async function firstUiMove() {
  const move = app().openGame.session.engine.legalMoves()[0];
  await uiMove(move);
  return move;
}

export async function runOpenE2E({ verbose = false } = {}) {
  const results = [];
  let pass = 0, fail = 0;
  const test = async (name, fn) => {
    try {
      await fn(); pass++; results.push({ name, status: 'PASS' });
      if (verbose) console.log(`  ✓ ${name}`);
    } catch (error) {
      fail++; results.push({ name, status: 'FAIL', error: error.message });
      console.error(`  ✗ ${name}\n      ${error.message}`);
    }
  };
  const ok = (value, message) => { if (!value) throw new Error(message); };
  const equal = (a, b, message) => { if (a !== b) throw new Error(`${message}: ${a} !== ${b}`); };

  localStorage.clear();
  await home();

  await test('Home presents one quiet three-game shelf', async () => {
    equal($$('[data-game-type]').length, 3, 'game count');
    ['junqi','xiangqi','chess'].forEach(type => ok(visible($(`[data-game-type="${type}"]`)), `${type} visible`));
    ok($('.makers-mark').textContent.includes('Since 2026'), 'maker line preserved');
  });

  await test('English and Simplified Chinese localize shared Home', async () => {
    equal(document.documentElement.lang, 'en', 'starts English');
    tap('#btn-language');
    equal(document.documentElement.lang, 'zh-CN', 'switches Chinese');
    ok($('#btn-games').textContent.includes('棋局'), 'Games translated');
    ok($('#btn-continue').textContent.includes('继续'), 'Continue translated');
    tap('#btn-language');
    equal(document.documentElement.lang, 'en', 'switches back');
  });

  await test('Xiangqi 2 Players paints 9×10 intersections and 32 pieces', async () => {
    await startOpen('xiangqi');
    const rect = $('.open-board').getBoundingClientRect();
    ok(rect.width > 0 && rect.height > 0, `geometry ${rect.width}×${rect.height}`);
    equal($$('.open-node').length, 90, 'intersections');
    equal($$('.xq-piece').length, 32, 'pieces');
  });

  await test('Xiangqi top army faces its owner; board and hit targets stay upright', async () => {
    equal($$('.xq-piece.side-b.faces-top').length, 16, 'top faces');
    equal($$('.xq-piece.side-r.faces-top').length, 0, 'bottom faces');
    equal(getComputedStyle($('.xiangqi-board')).transform, 'none', 'board transform');
    equal(getComputedStyle($('.open-node')).transform.includes('matrix(-1'), false, 'hit target not rotated');
  });

  await test('Xiangqi tap selection exposes legal moves and commits a move', async () => {
    const before = app().openGame.session.engine.history.length;
    await firstUiMove();
    equal(app().openGame.session.engine.history.length, before + 1, 'history advanced');
  });

  await test('Xiangqi reaches and performs a legal capture through UI', async () => {
    let capture = null;
    for (let ply = 0; ply < 20; ply++) {
      const legal = app().openGame.session.engine.legalMoves();
      capture = legal.find(m => m.capture);
      if (capture) break;
      await uiMove(legal[Math.min(2, legal.length - 1)]);
    }
    ok(capture, 'capture becomes reachable');
    const pieces = $$('.xq-piece').length;
    await uiMove(capture);
    equal($$('.xq-piece').length, pieces - 1, 'captured piece removed');
  });

  await test('Xiangqi Vs Computer has distinct responsive Relaxed and Standard play', async () => {
    for (const difficulty of ['relaxed', 'standard']) {
      await startOpen('xiangqi', 'vs_computer', { difficulty });
      await firstUiMove();
      await waitFor(() => app().openGame.session.engine.history.length === 2 && !app().openGame.busy,
        `${difficulty} Xiangqi AI reply`, 10000);
      await firstUiMove();
      await waitFor(() => app().openGame.session.engine.history.length === 4 && !app().openGame.busy,
        `${difficulty} Xiangqi second reply`, 10000);
    }
  });

  await test('Continue restores the most recent Xiangqi position', async () => {
    const id = app().openGame.session.gameId;
    const count = app().openGame.session.engine.history.length;
    await home();
    tap('#btn-continue');
    await waitFor(() => visible($('.xiangqi-board')), 'continued Xiangqi');
    equal(app().openGame.session.gameId, id, 'same game id');
    equal(app().openGame.session.engine.history.length, count, 'same move count');
  });

  await test('Chess 2 Players paints 8×8 board and legal move markers', async () => {
    await startOpen('chess');
    equal($$('.chess-square').length, 64, 'squares');
    equal($$('.chess-piece').length, 32, 'pieces');
    const rect = $('.chess-board').getBoundingClientRect();
    ok(rect.width > 0 && rect.height > 0, `geometry ${rect.width}×${rect.height}`);
    await uiMove({ from: 'e2', to: 'e4' });
    equal(app().openGame.session.engine.history.length, 1, 'move committed');
  });

  await test('Chess capture is rendered and recorded', async () => {
    await uiMove({ from: 'd7', to: 'd5' });
    const pieces = $$('.chess-piece').length;
    await uiMove({ from: 'e4', to: 'd5' });
    equal($$('.chess-piece').length, pieces - 1, 'captured piece removed');
  });

  await test('Chess promotion requires an explicit human choice', async () => {
    const { ChessGame } = await import('../js/games/chess/adapter.js');
    app().openGame.session.engine = new ChessGame({ fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' });
    app().openGame.render();
    tap('.open-node[data-key="a7"]');
    tap('.open-node[data-key="a8"]');
    await waitFor(() => $('#promotion').classList.contains('is-open'), 'promotion chooser');
    equal($$('[data-promotion]').filter(visible).length, 4, 'four choices');
    tap('[data-promotion="n"]');
    await waitFor(() => !app().openGame.busy, 'promotion settles');
    equal(app().openGame.session.engine.board.a8.kind, 'n', 'selected Knight');
  });

  await test('Chess Vs Computer Relaxed replies and keeps human at bottom', async () => {
    await startOpen('chess', 'vs_computer', { difficulty: 'relaxed' });
    equal($('.open-board').dataset.bottomSide, 'w', 'White human bottom');
    await firstUiMove();
    await waitFor(() => app().openGame.session.engine.history.length >= 2, 'Relaxed AI reply', 10000);
    equal(app().openGame.session.engine.history.length, 2, 'one AI reply');
  });

  await test('Chess Vs Computer Standard supports human Black at bottom', async () => {
    await startOpen('chess', 'vs_computer', { difficulty: 'standard', secondSide: true });
    equal($('.open-board').dataset.bottomSide, 'b', 'Black human bottom');
    await waitFor(() => app().openGame.session.engine.history.length === 1 && !app().openGame.busy, 'opening AI move', 10000);
    await firstUiMove();
    await waitFor(() => app().openGame.session.engine.history.length === 3, 'Standard AI reply', 10000);
  });

  await test('Rapid navigation discards a stale AI job by game id and type', async () => {
    await startOpen('xiangqi', 'vs_computer', { secondSide: true });
    const oldId = app().openGame.session.gameId;
    await home();
    await startOpen('chess');
    const newId = app().openGame.session.gameId;
    await sleep(800);
    equal(app().openGame.session.gameId, newId, 'new game remains active');
    ok(newId !== oldId, 'new identity');
    equal(app().openGame.session.gameType, 'chess', 'type remains Chess');
  });

  await test('All six cross-game transitions create the requested isolated game', async () => {
    const pairs = [
      ['junqi','xiangqi'], ['junqi','chess'],
      ['xiangqi','junqi'], ['xiangqi','chess'],
      ['chess','junqi'], ['chess','xiangqi']
    ];
    for (const [from, to] of pairs) {
      await startType(from);
      await home();
      await startType(to);
      const active = app().session ? 'junqi' : app().openGame.session?.gameType;
      equal(active, to, `${from} → ${to}`);
    }
  });

  await test('Completed Chess supports Record, Rematch, Home and another game', async () => {
    await startOpen('chess');
    await uiMove({ from: 'f2', to: 'f3' });
    await uiMove({ from: 'e7', to: 'e5' });
    await uiMove({ from: 'g2', to: 'g4' });
    await uiMove({ from: 'd8', to: 'h4' });
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Chess result');
    const finishedId = app().openGame.session.gameId;
    tap('#btn-end-again');
    await waitFor(() => visible($('.chess-board')), 'Chess rematch');
    ok(app().openGame.session.gameId !== finishedId, 'Rematch gets new game id');
    await home();
    await startOpen('xiangqi');
    equal(app().openGame.session.gameType, 'xiangqi', 'completed Chess cannot leak into Xiangqi');
  });

  await test('Games Library labels all three game types and opens read-only replay', async () => {
    await startOpen('chess');
    await firstUiMove();
    await home();
    tap('.game-tile[data-game-type="junqi"]');
    await waitFor(() => $('[data-dialog="mode"]').classList.contains('is-open'), 'Junqi mode');
    tap('[data-mode="vs_computer"]');
    await waitFor(() => $('[data-dialog="names"]').classList.contains('is-open'), 'Junqi players');
    tap('#btn-start-match');
    await waitFor(() => visible($('.bv-board')), 'Junqi board');
    await home();
    tap('#btn-games');
    await waitFor(() => visible($('#library-list')), 'library');
    const text = $('#library-list').textContent;
    ['Junqi','Xiangqi','Chess'].forEach(label => ok(text.includes(label), `${label} label`));
    const chessRow = $$('.game-row').find(row =>
      row.textContent.includes('Chess') &&
      [...row.querySelectorAll('button')].some(b => b.textContent === 'Record'));
    ok(chessRow, 'Chess record row');
    const record = [...chessRow.querySelectorAll('button')].find(b => b.textContent === 'Record');
    tap(record);
    await waitFor(() => visible($('.replay-board .chess-board')), 'Chess replay');
    tap('#btn-replay-next');
    equal(app().replay.step, 1, 'replay stepped');
    ok(!app().openGame.session, 'replay is detached from live session');
  });

  console.log(`\n  Caesar Games — Xiangqi + Chess E2E: ${pass} passed, ${fail} failed\n`);
  return { pass, fail, results };
}
