/* Focused v2.0.5 Chromium smoke. Load this script in the rendered page, then
 * call window.runV205Smoke().
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = selector => document.querySelector(selector);
const visible = element => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 &&
    style.display !== 'none' && style.visibility !== 'hidden';
};
const tap = target => {
  const element = typeof target === 'string' ? $(target) : target;
  if (!visible(element)) throw new Error(`not visible: ${target}`);
  element.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, view: window
  }));
};
async function waitFor(fn, label, timeout = 4000) {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    try {
      const value = fn();
      if (value) return value;
    } catch {}
    await sleep(20);
  }
  throw new Error(`timeout: ${label}`);
}
const app = () => window.caesarApp;
const piece = (side, kind) => ({ side, kind });

async function start(gameType, mode = 'two_player') {
  app().goHome();
  app().startOpenGame(gameType, {
    mode,
    player1Name: 'Player 1',
    player2Name: mode === 'vs_computer' ? 'Computer' : 'Player 2',
    humanSide: gameType === 'xiangqi' ? 'r' : 'w'
  });
  await waitFor(() => visible($('.open-board')), `${gameType} board`);
}

window.runV205Smoke = async function runV205Smoke({ verbose = false } = {}) {
  const results = [];
  let pass = 0;
  let fail = 0;
  const test = async (name, fn) => {
    try {
      await fn();
      pass++;
      results.push({ name, status: 'PASS' });
      if (verbose) console.log(`  ✓ ${name}`);
    } catch (error) {
      fail++;
      results.push({ name, status: 'FAIL', error: error.message });
      console.error(`  ✗ ${name}\n      ${error.message}`);
    }
  };
  const ok = (value, message) => {
    if (!value) throw new Error(message);
  };
  const equal = (actual, expected, message) => {
    if (actual !== expected) throw new Error(`${message}: ${actual} !== ${expected}`);
  };

  localStorage.clear();

  await test('Xiangqi refusals use specific natural copy and Resign stays visible', async () => {
    await start('xiangqi');
    ok(visible($('#btn-resign')), 'Resign visible during active Xiangqi');
    const engine = app().openGame.session.engine;
    engine.board = {
      '9,4': piece('r', 'g'), '0,3': piece('b', 'g'),
      '5,4': piece('b', 'r'), '6,0': piece('r', 's')
    };
    engine.turn = 'r';
    engine.history = [];
    engine.status = 'in_progress';
    engine.winner = null;
    engine.result = null;
    app().openGame.render();
    tap('.open-node[data-key="6,0"]');
    tap('.open-node[data-key="5,0"]');
    equal($('#toast').textContent, 'Your General would still be in check.',
      'English Xiangqi self-check copy');
    equal(app().openGame.session.engine.board['6,0'].kind, 's', 'illegal piece stays put');

    engine.board = {
      '9,4': piece('r', 'g'), '0,4': piece('b', 'g'), '5,4': piece('r', 'r')
    };
    engine.turn = 'r';
    engine.history = [];
    app().openGame.render();
    tap('#btn-language');
    tap('.open-node[data-key="5,4"]');
    tap('.open-node[data-key="5,3"]');
    equal($('#toast').textContent, '将帅不能直接照面。', 'Chinese flying-General copy');
    tap('#btn-language');
  });

  await test('Chess self-check uses natural copy and Resign stays visible', async () => {
    await start('chess');
    ok(visible($('#btn-resign')), 'Resign visible during active Chess');
    const engine = app().openGame.session.engine;
    engine.chess.load('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
    engine.history = [];
    engine.terminal = null;
    engine.terminalWinner = null;
    engine.terminalResult = null;
    app().openGame.render();
    tap('.open-node[data-key="e2"]');
    tap('.open-node[data-key="d2"]');
    equal($('#toast').textContent, 'Your King would still be in check.',
      'English Chess self-check copy');
    equal(app().openGame.session.engine.board.e2.kind, 'r', 'illegal rook stays put');
  });

  await test('Xiangqi two-player draw offer accepts, persists, and replays', async () => {
    await start('xiangqi');
    ok(visible($('#btn-offer-draw')), 'Xiangqi draw control visible');
    tap('#btn-offer-draw');
    equal($('#confirm-title').textContent, 'Draw offered.', 'draw prompt copy');
    equal($('#btn-confirm-ok').textContent, 'Accept', 'accept copy');
    equal($('#btn-confirm-cancel').textContent, 'Keep Playing', 'decline copy');
    tap('#btn-confirm-ok');
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Xiangqi draw result');
    equal(app().openGame.session.engine.result, 'draw_agreement', 'Xiangqi draw result');
    equal(app().openGame.session.engine.history.at(-1).drawAgreement, true,
      'Xiangqi draw history');
    equal($('#end-reason').textContent, 'Draw by agreement.', 'Xiangqi draw reason');
    tap('#btn-end-record');
    await waitFor(() => $('#record-moves').textContent.includes('Draw agreed'), 'Xiangqi draw replay');
  });

  await test('Xiangqi two-player draw offer can be declined', async () => {
    await start('xiangqi');
    tap('#btn-offer-draw');
    tap('#btn-confirm-cancel');
    equal(app().openGame.session.engine.status, 'in_progress', 'Xiangqi continues');
    equal(app().openGame.session.engine.history.length, 0, 'decline adds no terminal event');
  });

  await test('Chess two-player draw offer accepts, persists, and replays', async () => {
    await start('chess');
    ok(visible($('#btn-offer-draw')), 'Chess draw control visible');
    tap('#btn-offer-draw');
    tap('#btn-confirm-ok');
    await waitFor(() => $('#game-end').classList.contains('is-open'), 'Chess draw result');
    equal(app().openGame.session.engine.result, 'draw_agreement', 'Chess draw result');
    equal(app().openGame.session.engine.history.at(-1).drawAgreement, true,
      'Chess draw history');
    tap('#btn-end-record');
    await waitFor(() => $('#record-moves').textContent.includes('Draw agreed'), 'Chess draw replay');
  });

  await test('Chess two-player draw offer can be declined', async () => {
    await start('chess');
    tap('#btn-offer-draw');
    tap('#btn-confirm-cancel');
    equal(app().openGame.session.engine.status, 'in_progress', 'Chess continues');
    equal(app().openGame.session.engine.history.length, 0, 'decline adds no terminal event');
  });

  await test('Vs Computer never exposes Offer Draw', async () => {
    for (const gameType of ['xiangqi', 'chess']) {
      await start(gameType, 'vs_computer');
      ok(!visible($('#btn-offer-draw')), `${gameType} AI draw control hidden`);
      ok(visible($('#btn-resign')), `${gameType} AI Resign remains visible`);
    }
  });

  return { pass, fail, results };
};
