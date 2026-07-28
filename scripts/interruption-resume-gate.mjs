import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  chromium,
  webkit
} from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8109;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.4-hotfix');
fs.mkdirSync(outputDir, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'ignore', 'ignore']
});
const engines = [
  ['chromium', chromium, {
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }],
  ['webkit', webkit, {
    headless: true,
    executablePath: '/Users/cdmini/Library/Caches/ms-playwright/webkit-2287/pw_run.sh'
  }]
];
const report = { build: 'v2.0.4', generatedAt: new Date().toISOString(), engines: {} };

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/index.html`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('local QA server did not start');
}

async function fresh(page) {
  await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
}

async function firstJunqiMove(page) {
  return page.evaluate(() => {
    const session = window.caesarApp.session;
    for (const [from, piece] of Object.entries(session.boardState)) {
      if (piece.side !== session.controllingSide() || piece.static) continue;
      const targets = session.legalTargetsFrom(from);
      if (targets.length) return { from, to: targets[0] };
    }
    return null;
  });
}

async function tapJunqiMove(page, move) {
  await page.locator(`.bv-node[data-key="${move.from}"]`).click();
  await page.locator(`.bv-node[data-key="${move.to}"]`).click();
}

try {
  await waitForServer();
  for (const [name, engine, launchOptions] of engines) {
    const result = { scenarios: {}, runtimeErrors: [] };
    report.engines[name] = result;
    const browser = await engine.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    page.on('pageerror', error => result.runtimeErrors.push(error.message));

    // P1 Ready is canonical before the privacy presentation begins.
    await fresh(page);
    const classicId = await page.evaluate(() => {
      window.caesarApp.startGame('classic', {
        player1Name: 'Caesar', player2Name: 'Daddy'
      });
      return window.caesarApp.session.gameId;
    });
    await page.locator('#btn-ready').click();
    await page.locator('#handoff.is-open').waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-continue').click();
    await page.locator('#handoff.is-open').waitFor();
    result.scenarios.ready = await page.evaluate(expectedId => ({
      sameGame: window.caesarApp.session.gameId === expectedId,
      state: window.caesarApp.state,
      setupSide: window.caesarApp.session.setupSide,
      next: window.caesarApp.pending.then,
      shieldVisible: document.querySelector('#handoff').classList.contains('is-open')
    }), classicId);
    check(result.scenarios.ready.sameGame && result.scenarios.ready.setupSide === 'red' &&
      result.scenarios.ready.shieldVisible, `${name}: Ready reload leaked P2 setup`);

    // Reload during the human move presentation. The saved transaction already
    // owns the AI turn; resume schedules exactly one local reply.
    await fresh(page);
    const humanAnimationId = await page.evaluate(() => {
      window.caesarApp.startGame('vs_computer', {
        player1Name: 'Caesar', player2Name: 'Computer', aiDifficulty: 'standard'
      });
      window.caesarApp.onReady();
      return window.caesarApp.session.gameId;
    });
    const humanMove = await firstJunqiMove(page);
    await tapJunqiMove(page, humanMove);
    await page.waitForFunction(gameId => {
      const record = JSON.parse(localStorage.getItem('caesar_games_library'))
        .games.find(game => game.gameId === gameId);
      return record?.history.length === 1 && record.activeTurn === 'red' &&
        window.caesarApp.board.animating;
    }, humanAnimationId);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-continue').click();
    await page.waitForFunction(gameId =>
      window.caesarApp.session?.gameId === gameId &&
      window.caesarApp.session.history.length === 2 &&
      window.caesarApp.session.activeTurn === 'navy' &&
      !window.caesarApp.board.animating, humanAnimationId, { timeout: 12000 });
    await page.waitForTimeout(1100);
    result.scenarios.humanAnimation = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.session.gameId === gameId,
      history: window.caesarApp.session.history.length,
      activeTurn: window.caesarApp.session.activeTurn,
      flyers: document.querySelectorAll('.bv-flyer').length
    }), humanAnimationId);
    check(result.scenarios.humanAnimation.history === 2 &&
      result.scenarios.humanAnimation.activeTurn === 'navy',
    `${name}: reload during human animation duplicated or lost the AI reply`);

    // Reload after the AI transaction is saved but while its flyer is active.
    await fresh(page);
    const aiAnimationId = await page.evaluate(() => {
      window.caesarApp.startGame('vs_computer', {
        player1Name: 'Caesar', player2Name: 'Computer', aiDifficulty: 'standard'
      });
      window.caesarApp.onReady();
      return window.caesarApp.session.gameId;
    });
    await tapJunqiMove(page, await firstJunqiMove(page));
    await page.waitForFunction(gameId => {
      const record = JSON.parse(localStorage.getItem('caesar_games_library'))
        .games.find(game => game.gameId === gameId);
      return record?.history.length === 2 && record.activeTurn === 'navy' &&
        window.caesarApp.board.animating;
    }, aiAnimationId, { timeout: 12000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-continue').click();
    await page.waitForTimeout(1600);
    result.scenarios.aiAnimation = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.session.gameId === gameId,
      history: window.caesarApp.session.history.length,
      activeTurn: window.caesarApp.session.activeTurn,
      animating: window.caesarApp.board.animating,
      flyers: document.querySelectorAll('.bv-flyer').length
    }), aiAnimationId);
    check(result.scenarios.aiAnimation.history === 2 &&
      result.scenarios.aiAnimation.activeTurn === 'navy' &&
      !result.scenarios.aiAnimation.animating && result.scenarios.aiAnimation.flyers === 0,
    `${name}: reload during AI animation restored transient or duplicate state`);

    // A capture is persisted before its target-removal animation. Reload may
    // show only the canonical board, never the capture ghost.
    await fresh(page);
    const captureId = await page.evaluate(async () => {
      const { XiangqiGame } = await import('./js/games/xiangqi/engine.js');
      const app = window.caesarApp;
      app.startOpenGame('xiangqi', {
        mode: 'two_player', player1Name: 'Caesar', player2Name: 'Daddy'
      });
      app.openGame.session.engine = new XiangqiGame({
        board: {
          '9,4': { side: 'r', kind: 'g' },
          '0,4': { side: 'b', kind: 'g' },
          '5,4': { side: 'r', kind: 's' },
          '4,0': { side: 'r', kind: 'r' },
          '3,0': { side: 'b', kind: 's' }
        },
        turn: 'r'
      });
      app.openGame.session.opening = app.openGame.session.engine.serialize();
      app.openGame.persist();
      app.openGame.render();
      return app.openGame.session.gameId;
    });
    await page.locator('.open-node[data-key="4,0"]').click();
    await page.locator('.open-node[data-key="3,0"]').click();
    await page.waitForFunction(() =>
      window.caesarApp.openGame.session.engine.history.length === 1 &&
      window.caesarApp.openGame.busy);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#btn-continue').click();
    await page.locator('.xiangqi-board').waitFor();
    result.scenarios.capture = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.openGame.session.gameId === gameId,
      history: window.caesarApp.openGame.session.engine.history.length,
      origin: window.caesarApp.openGame.session.engine.board['4,0'] || null,
      destination: window.caesarApp.openGame.session.engine.board['3,0'] || null,
      flyers: document.querySelectorAll('.open-flyer').length
    }), captureId);
    check(result.scenarios.capture.history === 1 && !result.scenarios.capture.origin &&
      result.scenarios.capture.destination?.kind === 'r' && result.scenarios.capture.flyers === 0,
    `${name}: capture reload restored a partial animation`);

    // A Gomoku placement is saved before its lift/settle presentation ends.
    // Reload restores one stone, never a duplicate flyer or lost turn.
    await fresh(page);
    const gomokuId = await page.evaluate(() => {
      const app = window.caesarApp;
      app.startOpenGame('gomoku', {
        mode: 'two_player', player1Name: 'Caesar', player2Name: 'Daddy'
      });
      return app.openGame.session.gameId;
    });
    await page.locator('.gomoku-node[data-key="7,7"]').click();
    await page.waitForFunction(() =>
      window.caesarApp.openGame.session.engine.history.length === 1 &&
      window.caesarApp.openGame.busy);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(gameId => window.caesarApp.resumeGame(gameId), gomokuId);
    await page.locator('.gomoku-board').waitFor();
    result.scenarios.gomokuPlacement = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.openGame.session.gameId === gameId,
      history: window.caesarApp.openGame.session.engine.history.length,
      center: window.caesarApp.openGame.session.engine.board['7,7'] || null,
      turn: window.caesarApp.openGame.session.engine.turn,
      flyers: document.querySelectorAll('.open-flyer').length
    }), gomokuId);
    check(result.scenarios.gomokuPlacement.sameGame &&
      result.scenarios.gomokuPlacement.history === 1 &&
      result.scenarios.gomokuPlacement.center?.side === 'b' &&
      result.scenarios.gomokuPlacement.turn === 'w' &&
      result.scenarios.gomokuPlacement.flyers === 0,
    `${name}: Gomoku placement reload was not canonical`);

    // Resigning while an opening AI job is pending cancels that job and the
    // terminal winner/reason survives reload without a post-resign move.
    await fresh(page);
    const resignationId = await page.evaluate(() => {
      const app = window.caesarApp;
      app.startOpenGame('xiangqi', {
        mode: 'vs_computer', player1Name: 'Caesar', player2Name: 'Computer',
        humanSide: 'b', aiDifficulty: 'standard'
      });
      return app.openGame.session.gameId;
    });
    await page.locator('#btn-resign').click();
    await page.locator('#confirm.is-open').waitFor();
    await page.locator('#btn-confirm-ok').click();
    await page.locator('#game-end.is-open').waitFor();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(gameId => window.caesarApp.resumeGame(gameId), resignationId);
    await page.locator('#game-end.is-open').waitFor();
    result.scenarios.resignation = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.openGame.session.gameId === gameId,
      status: window.caesarApp.openGame.session.engine.status,
      winner: window.caesarApp.openGame.session.engine.winner,
      result: window.caesarApp.openGame.session.engine.result,
      history: window.caesarApp.openGame.session.engine.history.length,
      resign: window.caesarApp.openGame.session.engine.history.at(-1)?.resign,
      flyers: document.querySelectorAll('.open-flyer').length
    }), resignationId);
    check(result.scenarios.resignation.sameGame &&
      result.scenarios.resignation.status === 'finished' &&
      result.scenarios.resignation.winner === 'r' &&
      result.scenarios.resignation.result === 'resignation' &&
      result.scenarios.resignation.history === 1 &&
      result.scenarios.resignation.resign &&
      result.scenarios.resignation.flyers === 0,
    `${name}: resignation did not cancel AI or survive reload`);

    // Replay state and timer are presentation-only and disappear on reload.
    await page.evaluate(gameId => {
      window.caesarApp.goHome();
      window.caesarApp.openRecord(gameId);
      window.caesarApp.replayToggle();
    }, resignationId);
    await page.locator('[data-dialog="record"].is-open').waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    result.scenarios.replay = await page.evaluate(() => ({
      state: window.caesarApp.state,
      replay: window.caesarApp.replay,
      recordOpen: document.querySelector('[data-dialog="record"]').classList.contains('is-open')
    }));
    check(!result.scenarios.replay.replay && !result.scenarios.replay.recordOpen,
      `${name}: replay presentation leaked into live state`);

    // A finishing move is canonical before the result transition/animation.
    await fresh(page);
    const finishedId = await page.evaluate(async () => {
      const app = window.caesarApp;
      app.startOpenGame('chess', {
        mode: 'two_player', player1Name: 'Caesar', player2Name: 'Daddy'
      });
      await app.openGame.commit('f2', 'f3', null);
      await app.openGame.commit('e7', 'e5', null);
      await app.openGame.commit('g2', 'g4', null);
      return app.openGame.session.gameId;
    });
    await page.locator('.open-node[data-key="d8"]').click();
    await page.locator('.open-node[data-key="h4"]').click();
    await page.waitForFunction(gameId => {
      const record = JSON.parse(localStorage.getItem('caesar_games_library'))
        .games.find(game => game.gameId === gameId);
      return record?.status === 'finished' && record.history.length === 4 &&
        window.caesarApp.openGame.busy;
    }, finishedId);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(gameId => window.caesarApp.resumeGame(gameId), finishedId);
    await page.locator('#game-end.is-open').waitFor();
    result.scenarios.gameEnd = await page.evaluate(gameId => ({
      sameGame: window.caesarApp.openGame.session.gameId === gameId,
      state: window.caesarApp.state,
      status: window.caesarApp.openGame.session.engine.status,
      history: window.caesarApp.openGame.session.engine.history.length,
      flyers: document.querySelectorAll('.open-flyer').length,
      memory: document.querySelector('#end-memory').textContent
    }), finishedId);
    check(result.scenarios.gameEnd.status === 'finished' &&
      result.scenarios.gameEnd.history === 4 &&
      result.scenarios.gameEnd.flyers === 0 &&
      result.scenarios.gameEnd.memory.includes('Caesar') &&
      result.scenarios.gameEnd.memory.includes('4 moves'),
    `${name}: game-end reload was not canonical`);

    await page.screenshot({
      path: path.join(outputDir, `${name}-interruption-final.png`),
      fullPage: true
    });
    await browser.close();
    console.log(`${name}: interruption/resume scenarios passed`);
  }
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  fs.writeFileSync(
    path.join(outputDir, 'INTERRUPTION_RESUME.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
}

const passed = Object.values(report.engines).every(engine =>
  Object.keys(engine.scenarios).length === 8 && engine.runtimeErrors.length === 0);
if (!passed) process.exitCode = 1;
