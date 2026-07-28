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

  await test('Home presents one quiet four-game shelf', async () => {
    equal($$('[data-game-type]').length, 4, 'game count');
    ['junqi','xiangqi','chess','gomoku'].forEach(type =>
      ok(visible($(`[data-game-type="${type}"]`)), `${type} visible`));
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

  await test('Xiangqi normal move visibly travels and sounds once at contact', async () => {
    await startOpen('xiangqi');
    const { sounds } = await import('../js/engine/sound.js');
    sounds.clearAudit();
    const start = $('.open-node[data-key="6,0"]').getBoundingClientRect();
    const end = $('.open-node[data-key="5,0"]').getBoundingClientRect();
    const pending = app().openGame.commit('6,0', '5,0', null);
    const flyer = await waitFor(() => $('.open-flyer'), 'Xiangqi flyer');
    equal(getComputedStyle($('.open-node[data-key="5,0"] .open-piece')).visibility, 'hidden',
      'final-state piece hidden during travel');
    await waitFor(() => flyer.getAnimations().some(a => (a.currentTime || 0) >= 65),
      'Xiangqi midpoint');
    const mid = flyer.getBoundingClientRect();
    const startY = start.top + start.height / 2;
    const endY = end.top + end.height / 2;
    const midY = mid.top + mid.height / 2;
    ok(midY < startY - 2 && midY > endY + 2,
      `flyer must interpolate between stations (${startY}, ${midY}, ${endY})`);
    await pending;
    ok(app().openGame.session.engine.board['5,0'], 'piece reaches exact destination');
    ok(!app().openGame.session.engine.board['6,0'], 'origin clears');
    ok($('.open-node[data-key="6,0"]').classList.contains('is-last-from'),
      'Xiangqi Last Move marks FROM');
    ok($('.open-node[data-key="5,0"]').classList.contains('is-last-to'),
      'Xiangqi Last Move marks TO');
    equal($$('.open-flyer').length, 0, 'motion layer cleans up');
    const cues = sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue);
    equal(cues.filter(cue => cue === 'place').length, 1, 'one place cue');
    equal(cues.filter(cue => cue === 'capture').length, 0, 'no capture cue');
  });

  await test('Xiangqi capture holds the target until contact, then compresses it', async () => {
    const { XiangqiGame } = await import('../js/games/xiangqi/engine.js');
    const { sounds } = await import('../js/engine/sound.js');
    app().openGame.session.engine = new XiangqiGame({
      board: {
        '9,4': { side: 'r', kind: 'g' },
        '0,4': { side: 'b', kind: 'g' },
        '5,4': { side: 'r', kind: 's' },
        '4,0': { side: 'r', kind: 'r' },
        '3,0': { side: 'b', kind: 's' }
      },
      turn: 'r'
    });
    app().openGame.render();
    sounds.clearAudit();
    const pending = app().openGame.commit('4,0', '3,0', null);
    const ghost = await waitFor(() => $('.open-capture-ghost'), 'capture ghost');
    equal(ghost.getAnimations().length, 0, 'target stays physically present before contact');
    await waitFor(() => ghost.getAnimations().length > 0, 'capture contact compression');
    ok(ghost.getAnimations().some(a => a.effect.getTiming().duration === 225),
      'capture removal uses the readable compression/fade');
    await pending;
    equal(app().openGame.session.engine.board['3,0'].kind, 'r', 'capturer settles exactly');
    ok(!app().openGame.session.engine.board['4,0'], 'capture origin clears');
    const cues = sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue);
    equal(cues.filter(cue => cue === 'capture').length, 1, 'one capture cue');
    equal(cues.filter(cue => cue === 'place').length, 0, 'no duplicate place cue');
  });

  await test('Xiangqi reaches and performs a legal capture through UI', async () => {
    await startOpen('xiangqi');
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
    await waitFor(() => $$('.open-flyer').length === 0, 'capture presentation cleanup');
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
      const last = app().openGame.session.engine.history.at(-1);
      ok($(`.open-node[data-key="${last.from}"]`).classList.contains('is-last-from'),
        `${difficulty} AI FROM remains visible`);
      ok($(`.open-node[data-key="${last.to}"]`).classList.contains('is-last-to'),
        `${difficulty} AI TO remains visible`);
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
    const last = app().openGame.session.engine.history.at(-1);
    ok($(`.open-node[data-key="${last.from}"]`).classList.contains('is-last-from'),
      'resumed Xiangqi preserves FROM');
    ok($(`.open-node[data-key="${last.to}"]`).classList.contains('is-last-to'),
      'resumed Xiangqi preserves TO');
  });

  await test('Xiangqi check is visible while legal evasions remain enabled', async () => {
    const { XiangqiGame } = await import('../js/games/xiangqi/engine.js');
    await startOpen('xiangqi');
    app().openGame.session.engine = new XiangqiGame({
      board: {
        '0,4': { side: 'b', kind: 'g' },
        '9,4': { side: 'r', kind: 'g' },
        '5,4': { side: 'r', kind: 's' },
        '2,4': { side: 'r', kind: 'r' }
      },
      turn: 'b'
    });
    app().openGame.render();
    ok($('.open-node[data-key="0,4"] .xq-piece').classList.contains('is-check'),
      'checked General is visibly marked');
    ok($('#turn-status').textContent.includes('Check'), 'status names Check');
    tap('.open-node[data-key="0,4"]');
    ok($$('.open-node.is-legal').length > 0, 'legal General escape remains enabled');
  });

  await test('Xiangqi checkmate, stalemate and double-cannon mate reach the result UI', async () => {
    const { XiangqiGame } = await import('../js/games/xiangqi/engine.js');
    const scenarios = [
      {
        name: 'checkmate',
        from: '3,0', to: '2,0',
        board: {
          '0,4': { side: 'b', kind: 'g' }, '9,4': { side: 'r', kind: 'g' },
          '5,4': { side: 'r', kind: 's' }, '1,3': { side: 'r', kind: 'r' },
          '1,5': { side: 'r', kind: 'r' }, '2,4': { side: 'r', kind: 'r' },
          '3,0': { side: 'r', kind: 's' }
        },
        result: 'checkmate', copy: 'Checkmate'
      },
      {
        name: 'stalemate',
        from: '1,1', to: '1,0',
        board: {
          '0,4': { side: 'b', kind: 'g' }, '9,4': { side: 'r', kind: 'g' },
          '5,4': { side: 'r', kind: 's' }, '2,3': { side: 'r', kind: 'r' },
          '2,5': { side: 'r', kind: 'r' }, '1,1': { side: 'r', kind: 'r' }
        },
        result: 'stalemate', copy: 'Stalemate'
      },
      {
        name: 'double cannon',
        from: '4,4', to: '3,4',
        board: {
          '0,4': { side: 'b', kind: 'g' }, '9,4': { side: 'r', kind: 'g' },
          '1,3': { side: 'r', kind: 'r' }, '1,5': { side: 'r', kind: 'r' },
          '2,4': { side: 'r', kind: 'c' }, '4,4': { side: 'r', kind: 'c' }
        },
        result: 'checkmate', copy: 'Checkmate'
      }
    ];
    for (const scenario of scenarios) {
      await startOpen('xiangqi');
      app().openGame.session.engine = new XiangqiGame({
        board: scenario.board, turn: 'r'
      });
      app().openGame.session.opening = app().openGame.session.engine.serialize();
      app().openGame.persist();
      app().openGame.render();
      await app().openGame.commit(scenario.from, scenario.to, null);
      await waitFor(() => $('#game-end').classList.contains('is-open'), `${scenario.name} result`);
      equal(app().openGame.session.engine.result, scenario.result, `${scenario.name} canonical result`);
      equal(app().openGame.session.engine.winner, 'r', `${scenario.name} winner`);
      ok($('#end-reason').textContent.includes(scenario.copy), `${scenario.name} copy`);
      if (scenario.result === 'stalemate') {
        tap('#btn-language');
        ok($('#end-reason').textContent.includes('困毙'), 'stalemate uses bilingual 困毙 copy');
        tap('#btn-language');
      }
    }
  });

  await test('Legacy zero-reply Xiangqi save resumes directly into its terminal result', async () => {
    const { loadGame, saveGame } = await import('../js/engine/persistence.js');
    await startOpen('xiangqi');
    const id = app().openGame.session.gameId;
    const record = loadGame(id);
    await home();
    saveGame({
      ...record,
      status: 'in_progress',
      winner: null,
      result: null,
      completedAt: null,
      history: [],
      serializedState: {
        board: {
          '0,4': { side: 'b', kind: 'g' },
          '9,4': { side: 'r', kind: 'g' },
          '5,4': { side: 'r', kind: 's' },
          '2,3': { side: 'r', kind: 'r' },
          '2,5': { side: 'r', kind: 'r' },
          '1,0': { side: 'r', kind: 'r' }
        },
        turn: 'b',
        status: 'in_progress',
        winner: null,
        result: null,
        history: []
      }
    });
    ok(app().resumeGame(id), 'legacy record resumes');
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'normalized terminal result');
    equal(app().openGame.session.engine.result, 'stalemate', 'normalized canonical result');
    equal(app().openGame.session.engine.winner, 'r', 'normalized winner');
    const normalized = loadGame(id);
    equal(normalized.status, 'finished', 'normalized status persisted');
    equal(normalized.result, 'stalemate', 'normalized result persisted');
    ok(Boolean(normalized.completedAt), 'normalized completion time persisted');
  });

  await test('Chess 2 Players paints 8×8 board and legal move markers', async () => {
    await startOpen('chess');
    equal($$('.chess-square').length, 64, 'squares');
    equal($$('.chess-piece').length, 32, 'pieces');
    const rect = $('.chess-board').getBoundingClientRect();
    ok(rect.width > 0 && rect.height > 0, `geometry ${rect.width}×${rect.height}`);
    await uiMove({ from: 'e2', to: 'e4' });
    equal(app().openGame.session.engine.history.length, 1, 'move committed');
    ok($('.open-node[data-key="e2"]').classList.contains('is-last-from'),
      'Chess Last Move marks FROM');
    ok($('.open-node[data-key="e4"]').classList.contains('is-last-to'),
      'Chess Last Move marks TO');
    const id = app().openGame.session.gameId;
    await home();
    tap('#btn-continue');
    await waitFor(() => visible($('.chess-board')), 'resumed Chess');
    equal(app().openGame.session.gameId, id, 'same Chess game');
    ok($('.open-node[data-key="e2"]').classList.contains('is-last-from'),
      'resumed Chess preserves FROM');
    ok($('.open-node[data-key="e4"]').classList.contains('is-last-to'),
      'resumed Chess preserves TO');
  });

  await test('Chess capture is rendered and recorded', async () => {
    const { sounds } = await import('../js/engine/sound.js');
    await uiMove({ from: 'd7', to: 'd5' });
    sounds.clearAudit();
    const pieces = $$('.chess-piece').length;
    await uiMove({ from: 'e4', to: 'd5' });
    equal($$('.chess-piece').length, pieces - 1, 'captured piece removed');
    const cues = sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue);
    equal(cues.filter(cue => cue === 'capture').length, 1, 'one capture cue');
    equal(cues.filter(cue => cue === 'place').length, 0, 'no duplicate place cue');
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
    await waitFor(() => $('.open-flyer'), 'promotion travel');
    equal($('.open-flyer').textContent.trim(), '♙', 'pawn travels before transforming');
    await waitFor(() => !app().openGame.busy, 'promotion settles');
    equal(app().openGame.session.engine.board.a8.kind, 'n', 'selected Knight');
  });

  await test('Chess castling moves king and rook as one coherent action', async () => {
    const { ChessGame } = await import('../js/games/chess/adapter.js');
    const { sounds } = await import('../js/engine/sound.js');
    await startOpen('chess');
    app().openGame.session.engine = new ChessGame({
      fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1'
    });
    app().openGame.render();
    sounds.clearAudit();
    const pending = app().openGame.commit('e1', 'g1', null);
    await waitFor(() => $$('.open-flyer').length === 2, 'king and rook flyers');
    await waitFor(() => $$('.open-flyer').every(flyer =>
      flyer.getAnimations().some(a => (a.currentTime || 0) >= 55)), 'castling midpoint');
    equal(getComputedStyle($('.open-node[data-key="g1"] .open-piece')).visibility, 'hidden',
      'king target hidden during travel');
    equal(getComputedStyle($('.open-node[data-key="f1"] .open-piece')).visibility, 'hidden',
      'rook target hidden during travel');
    await pending;
    equal(app().openGame.session.engine.board.g1.kind, 'k', 'king exact destination');
    equal(app().openGame.session.engine.board.f1.kind, 'r', 'rook exact destination');
    ok(!app().openGame.session.engine.board.e1 && !app().openGame.session.engine.board.h1,
      'both origins clear');
    equal(sounds.getAudit().filter(entry => entry.played && entry.cue === 'place').length, 1,
      'castling has one coherent place cue');
  });

  await test('Invalid Chess move gives resistance and one quiet invalid cue', async () => {
    await startOpen('chess');
    const { sounds } = await import('../js/engine/sound.js');
    sounds.clearAudit();
    tap('.open-node[data-key="e2"]');
    tap('.open-node[data-key="e5"]');
    const piece = $('.open-node[data-key="e2"] .open-piece');
    await waitFor(() => piece.getAnimations().length, 'invalid resistance');
    ok(piece.getAnimations().some(a => a.effect.getTiming().duration === 125),
      'resistance lasts 100–150ms');
    equal(sounds.getAudit().filter(entry => entry.played && entry.cue === 'invalid').length, 1,
      'one invalid cue');
  });

  await test('Chess Vs Computer Relaxed replies and keeps human at bottom', async () => {
    await startOpen('chess', 'vs_computer', { difficulty: 'relaxed' });
    equal($('.open-board').dataset.bottomSide, 'w', 'White human bottom');
    await firstUiMove();
    await waitFor(() => app().openGame.session.engine.history.length >= 2, 'Relaxed AI reply', 10000);
    equal(app().openGame.session.engine.history.length, 2, 'one AI reply');
    const last = app().openGame.session.engine.history.at(-1);
    ok($(`.open-node[data-key="${last.from}"]`).classList.contains('is-last-from'),
      'Chess AI FROM remains visible');
    ok($(`.open-node[data-key="${last.to}"]`).classList.contains('is-last-to'),
      'Chess AI TO remains visible');
  });

  await test('Chess Vs Computer Standard supports human Black at bottom', async () => {
    await startOpen('chess', 'vs_computer', { difficulty: 'standard', secondSide: true });
    equal($('.open-board').dataset.bottomSide, 'b', 'Black human bottom');
    await waitFor(() => app().openGame.session.engine.history.length === 1 && !app().openGame.busy, 'opening AI move', 10000);
    await firstUiMove();
    await waitFor(() => app().openGame.session.engine.history.length === 3, 'Standard AI reply', 10000);
  });

  await test('Gomoku 2 Players paints 225 intersections and places tactile stones', async () => {
    await startOpen('gomoku');
    equal($$('.gomoku-node').length, 225, 'intersections');
    equal($$('.gomoku-stone').length, 0, 'empty opening');
    tap('.gomoku-node[data-key="7,7"]');
    await waitFor(() => !app().openGame.busy && $$('.gomoku-stone').length === 1,
      'first stone settles');
    equal(app().openGame.session.engine.history.length, 1, 'history advanced');
    equal(app().openGame.session.engine.board['7,7'].side, 'b', 'Black first');
    ok($('.gomoku-node[data-key="7,7"]').classList.contains('is-last-to'),
      'last placement remains readable');
  });

  await test('Gomoku rejects occupied intersections without changing state', async () => {
    const { sounds } = await import('../js/engine/sound.js');
    sounds.clearAudit();
    tap('.gomoku-node[data-key="7,7"]');
    await waitFor(() => sounds.getAudit().some(entry => entry.cue === 'invalid'),
      'invalid cue');
    equal(app().openGame.session.engine.history.length, 1, 'history unchanged');
  });

  await test('Gomoku five-in-row ends, records and replays', async () => {
    const game = app().openGame.session.engine;
    game.board = {};
    game.history = [];
    game.turn = 'b';
    game.status = 'in_progress';
    game.winner = null;
    game.result = null;
    app().openGame.render();
    for (let col = 3; col < 7; col++) {
      await app().openGame.commit(null, `7,${col}`, null);
      await app().openGame.commit(null, `9,${col}`, null);
    }
    await app().openGame.commit(null, '7,7', null);
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Gomoku result');
    equal(game.result, 'five', 'documented result');
    equal(game.winner, 'b', 'Black wins');
    ok($('#end-reason').textContent.includes('Five'), 'localized end reason');
    tap('#btn-end-record');
    await waitFor(() => visible($('.replay-board .gomoku-board')), 'Gomoku replay');
    tap('#btn-replay-next');
    equal(app().replay.step, 1, 'replay advances');
  });

  await test('Gomoku Relaxed and Standard AI both reply legally', async () => {
    for (const difficulty of ['relaxed', 'standard']) {
      await startOpen('gomoku', 'vs_computer', { difficulty });
      tap('.gomoku-node[data-key="7,7"]');
      await waitFor(() => app().openGame.session.engine.history.length === 2 &&
        !app().openGame.busy, `${difficulty} Gomoku reply`, 10000);
      equal(Object.keys(app().openGame.session.engine.board).length, 2, 'two legal stones');
      const last = app().openGame.session.engine.history.at(-1);
      ok($(`.gomoku-node[data-key="${last.to}"]`).classList.contains('is-last-to'),
        `${difficulty} Gomoku AI stone remains marked`);
    }
  });

  await test('Continue restores the most recent Gomoku position offline-ready', async () => {
    const id = app().openGame.session.gameId;
    const count = app().openGame.session.engine.history.length;
    await home();
    tap('#btn-continue');
    await waitFor(() => visible($('.gomoku-board')), 'continued Gomoku');
    equal(app().openGame.session.gameId, id, 'same game id');
    equal(app().openGame.session.engine.history.length, count, 'same move count');
    const last = app().openGame.session.engine.history.at(-1);
    ok($(`.gomoku-node[data-key="${last.to}"]`).classList.contains('is-last-to'),
      'resumed Gomoku preserves last stone');
  });

  await test('Resign requires confirmation and persists for Xiangqi, Chess and Gomoku', async () => {
    for (const gameType of ['xiangqi', 'chess', 'gomoku']) {
      await startOpen(gameType);
      tap('#btn-resign');
      await waitFor(() => $('#confirm').classList.contains('is-open'), `${gameType} confirm`);
      ok($('#confirm-title').textContent.includes('Resign'), `${gameType} confirmation title`);
      tap('#btn-confirm-cancel');
      equal(app().openGame.session.engine.status, 'in_progress', `${gameType} cancel is safe`);

      if (gameType === 'xiangqi') {
        tap('#btn-language');
        equal($('#btn-resign').textContent.trim(), '认输', 'Chinese Resign label');
        tap('#btn-language');
      }

      tap('#btn-resign');
      tap('#btn-confirm-ok');
      await waitFor(() => $('#game-end').classList.contains('is-open'), `${gameType} resign result`);
      equal(app().openGame.session.engine.status, 'finished', `${gameType} terminal`);
      equal(app().openGame.session.engine.result, 'resignation', `${gameType} result`);
      equal(app().openGame.session.engine.history.at(-1).resign, true, `${gameType} record`);
      ok($('#end-reason').textContent.includes('resignation'), `${gameType} result copy`);
      tap('#btn-end-record');
      await waitFor(() => visible($('.replay-board .open-board')), `${gameType} resignation replay`);
      ok($('#record-moves').textContent.includes('resigned'), `${gameType} record text`);
      tap('#btn-replay-next');
      equal(app().replay.step, 1, `${gameType} replay includes resignation`);
    }
  });

  await test('Junqi resignation reuses the safe shared confirmation and result flow', async () => {
    await startJunqi();
    tap('#btn-ready');
    await waitFor(() => app().session?.phase === 'play', 'Junqi play');
    tap('#btn-resign');
    await waitFor(() => $('#confirm').classList.contains('is-open'), 'Junqi confirm');
    tap('#btn-confirm-ok');
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Junqi resign result');
    equal(app().session.winReason, 'resignation', 'Junqi result');
    equal(app().session.winner, 'red', 'Junqi opponent wins');
    equal(app().session.history.at(-1).resign, true, 'Junqi resignation recorded');
  });

  await test('Rapid navigation discards a stale AI job by game id and type', async () => {
    await startOpen('xiangqi', 'vs_computer', { secondSide: true });
    const { sounds } = await import('../js/engine/sound.js');
    const oldId = app().openGame.session.gameId;
    sounds.clearAudit();
    await home();
    await startOpen('chess');
    const newId = app().openGame.session.gameId;
    await sleep(1800);
    equal(app().openGame.session.gameId, newId, 'new game remains active');
    ok(newId !== oldId, 'new identity');
    equal(app().openGame.session.gameType, 'chess', 'type remains Chess');
    const staleCues = sounds.getAudit().filter(entry =>
      entry.played && ['place', 'capture', 'check', 'victory'].includes(entry.cue));
    equal(staleCues.length, 0, 'stale AI emits no delayed board sound');
  });

  await test('All twelve cross-game transitions create the requested isolated game', async () => {
    const types = ['junqi', 'xiangqi', 'chess', 'gomoku'];
    const pairs = types.flatMap(from => types.filter(to => to !== from).map(to => [from, to]));
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
    const { sounds } = await import('../js/engine/sound.js');
    await uiMove({ from: 'f2', to: 'f3' });
    await uiMove({ from: 'e7', to: 'e5' });
    await uiMove({ from: 'g2', to: 'g4' });
    sounds.clearAudit();
    await uiMove({ from: 'd8', to: 'h4' });
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Chess result');
    const finishCues = sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue);
    equal(finishCues.filter(cue => cue === 'place').length, 1, 'finishing move placed once');
    equal(finishCues.filter(cue => cue === 'check').length, 1, 'check cue once');
    equal(finishCues.filter(cue => cue === 'victory').length, 1, 'warm victory cue once');
    const finishedId = app().openGame.session.gameId;
    tap('#btn-end-again');
    await waitFor(() => visible($('.chess-board')), 'Chess rematch');
    ok(app().openGame.session.gameId !== finishedId, 'Rematch gets new game id');
    await home();
    await startOpen('xiangqi');
    equal(app().openGame.session.gameType, 'xiangqi', 'completed Chess cannot leak into Xiangqi');
  });

  await test('Games Library labels all four game types and opens read-only replay', async () => {
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
    ['Junqi','Xiangqi','Chess','Gomoku'].forEach(label => ok(text.includes(label), `${label} label`));
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

  console.log(`\n  Caesar Games — Xiangqi + Chess + Gomoku E2E: ${pass} passed, ${fail} failed\n`);
  return { pass, fail, results };
}
