import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { webkit } from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8108;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.2-pre-travel');
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caesar-cold-start-'));
fs.mkdirSync(outputDir, { recursive: true });

const launchOptions = {
  headless: true,
  executablePath: '/Users/cdmini/Library/Caches/ms-playwright/webkit-2287/pw_run.sh'
};
const viewport = { width: 1180, height: 820 };
const report = {
  gate: 'fully closed WebKit process, unreachable origin, fresh offline process',
  build: 'v2.0.2',
  cache: 'caesar-games-v2.0.2',
  generatedAt: new Date().toISOString(),
  online: {},
  offline: {},
  runtimeErrors: []
};

let server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'ignore', 'ignore']
});
let onlineContext;
let offlineContext;

const boardEvidence = async page => page.evaluate(() => {
  const boards = [...document.querySelectorAll('.bv-board, .open-board')]
    .map(board => board.getBoundingClientRect())
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const board = boards[0];
  return {
    width: board?.width || 0,
    height: board?.height || 0,
    visiblePieces: [...document.querySelectorAll('.bv-piece, .xq-piece, .chess-piece')]
      .filter(piece => {
        const rect = piece.getBoundingClientRect();
        const style = getComputedStyle(piece);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden';
      }).length
  };
});

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

async function moveOpen(page) {
  const move = await page.evaluate(() =>
    window.caesarApp.openGame.session.engine.legalMoves()[0]);
  await page.locator(`.open-node[data-key="${move.from}"]`).click();
  await page.locator(`.open-node[data-key="${move.to}"]`).click();
  await page.waitForFunction(() => !window.caesarApp.openGame.busy);
  return move;
}

async function moveJunqi(page) {
  const move = await page.evaluate(() => {
    const session = window.caesarApp.session;
    for (const [from, piece] of Object.entries(session.boardState)) {
      if (piece.side !== session.controllingSide() || piece.static) continue;
      const targets = session.legalTargetsFrom(from);
      if (targets.length) return { from, to: targets[0] };
    }
    return null;
  });
  if (!move) throw new Error('no legal Junqi move');
  await page.locator(`.bv-node[data-key="${move.from}"]`).click();
  await page.locator(`.bv-node[data-key="${move.to}"]`).click();
  return move;
}

try {
  await waitForServer();
  onlineContext = await webkit.launchPersistentContext(profileDir, {
    ...launchOptions,
    viewport
  });
  const onlinePage = onlineContext.pages()[0] || await onlineContext.newPage();
  onlinePage.on('pageerror', error => report.runtimeErrors.push(`online: ${error.message}`));
  await onlinePage.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
  await onlinePage.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    for (const name of await caches.keys()) await caches.delete(name);
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await onlinePage.reload({ waitUntil: 'networkidle' });
  await onlinePage.waitForFunction(() => !!navigator.serviceWorker.controller);

  const ids = await onlinePage.evaluate(async () => {
    const app = window.caesarApp;
    app.startOpenGame('xiangqi', {
      mode: 'two_player', player1Name: 'Caesar', player2Name: 'Daddy'
    });
    const xqMove = app.openGame.session.engine.legalMoves()[0];
    await app.openGame.commit(xqMove.from, xqMove.to, null);
    const xiangqi = app.openGame.session.gameId;
    app.goHome();

    app.startOpenGame('chess', {
      mode: 'two_player', player1Name: 'Caesar', player2Name: 'Daddy'
    });
    const chessMove = app.openGame.session.engine.legalMoves()[0];
    await app.openGame.commit(chessMove.from, chessMove.to, chessMove.promotion);
    const chess = app.openGame.session.gameId;
    app.goHome();

    app.startGame('vs_computer', {
      player1Name: 'Caesar', player2Name: 'Computer', aiDifficulty: 'standard'
    });
    const junqi = app.session.gameId;
    app.goHome();
    return { junqi, xiangqi, chess };
  });

  report.online = await onlinePage.evaluate(savedIds => ({
    ids: savedIds,
    build: document.querySelector('#build-tag')?.textContent,
    cacheNames: [],
    savedGames: JSON.parse(localStorage.getItem('caesar_games_library')).games.length,
    controller: !!navigator.serviceWorker.controller
  }), ids);
  report.online.cacheNames = await onlinePage.evaluate(() => caches.keys());
  await onlinePage.screenshot({ path: path.join(outputDir, 'webkit-online-preflight.png') });

  // Closing a persistent context terminates its owning browser process.
  await onlineContext.close();
  onlineContext = null;
  report.online.processFullyClosed = true;

  server.kill('SIGTERM');
  await once(server, 'exit');
  server = null;
  try {
    await fetch(`${origin}/index.html`);
    report.online.originUnreachableAfterShutdown = false;
  } catch {
    report.online.originUnreachableAfterShutdown = true;
  }

  // New persistent-context launch = a fresh WebKit process using only the
  // previously installed PWA storage. It is offline before navigation begins.
  offlineContext = await webkit.launchPersistentContext(profileDir, {
    ...launchOptions,
    viewport
  });
  const offlinePage = offlineContext.pages()[0] || await offlineContext.newPage();
  offlinePage.on('pageerror', error => report.runtimeErrors.push(`offline: ${error.message}`));
  await offlinePage.goto(`${origin}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000
  });
  await offlinePage.locator('[data-screen="home"].is-active').waitFor();
  report.offline.freshProcess = true;
  report.offline.homeLoaded = true;
  report.offline.build = await offlinePage.locator('#build-tag').textContent();
  report.offline.cacheNames = await offlinePage.evaluate(() => caches.keys());
  report.offline.onlySameOriginResources = await offlinePage.evaluate(() =>
    performance.getEntriesByType('resource').every(entry =>
      new URL(entry.name, location.href).origin === location.origin));

  await offlinePage.locator('#btn-games').click();
  await offlinePage.locator('[data-dialog="library"].is-open').waitFor();
  report.offline.libraryRows = await offlinePage.locator('.game-row').count();
  await offlinePage.locator('#btn-close-library').click();

  // Continue is the most recently saved Junqi setup. Ready and move through
  // the actual UI, then wait for the local AI to reply with the network absent.
  await offlinePage.locator('#btn-continue').click();
  await offlinePage.locator('.bv-board').waitFor();
  report.offline.junqiBefore = await boardEvidence(offlinePage);
  await offlinePage.locator('#btn-ready').click();
  await offlinePage.waitForFunction(() =>
    window.caesarApp.state === window.CaesarDebug.S.VS_AI_PLAY);
  await offlinePage.evaluate(async () => {
    const { sounds } = await import('./js/engine/sound.js');
    sounds.setMuted(false);
    sounds.clearAudit();
  });
  await moveJunqi(offlinePage);
  await offlinePage.waitForFunction(() =>
    window.caesarApp.session.history.length >= 2 &&
    window.caesarApp.session.activeTurn === 'navy' &&
    !window.caesarApp.board.animating, null, { timeout: 12000 });
  report.offline.junqi = {
    ...(await boardEvidence(offlinePage)),
    history: await offlinePage.evaluate(() => window.caesarApp.session.history.length),
    aiResponded: await offlinePage.evaluate(() =>
      window.caesarApp.session.history.some(move => move.side === 'red'))
  };
  report.offline.sound = await offlinePage.evaluate(async () => {
    const { sounds } = await import('./js/engine/sound.js');
    return {
      muted: sounds.isMuted,
      contextState: sounds.ctx?.state || 'unavailable',
      playedCues: sounds.getAudit().filter(entry => entry.played).map(entry => entry.cue)
    };
  });

  await offlinePage.evaluate(gameId => {
    window.caesarApp.goHome();
    window.caesarApp.resumeGame(gameId);
  }, ids.xiangqi);
  await offlinePage.locator('.xiangqi-board').waitFor();
  await moveOpen(offlinePage);
  report.offline.xiangqi = {
    ...(await boardEvidence(offlinePage)),
    history: await offlinePage.evaluate(() =>
      window.caesarApp.openGame.session.engine.history.length)
  };

  await offlinePage.evaluate(gameId => {
    window.caesarApp.goHome();
    window.caesarApp.resumeGame(gameId);
  }, ids.chess);
  await offlinePage.locator('.chess-board').waitFor();
  await moveOpen(offlinePage);
  report.offline.chess = {
    ...(await boardEvidence(offlinePage)),
    history: await offlinePage.evaluate(() =>
      window.caesarApp.openGame.session.engine.history.length)
  };
  await offlinePage.screenshot({ path: path.join(outputDir, 'webkit-cold-start-offline.png') });
} finally {
  if (onlineContext) await onlineContext.close();
  if (offlineContext) await offlineContext.close();
  if (server?.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  fs.writeFileSync(
    path.join(outputDir, 'COLD_START_OFFLINE.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  fs.rmSync(profileDir, { recursive: true, force: true });
}

const boards = [report.offline.junqi, report.offline.xiangqi, report.offline.chess];
const passed =
  report.online.build?.includes('v2.0.2') &&
  report.online.cacheNames?.includes('caesar-games-v2.0.2') &&
  report.online.savedGames >= 3 &&
  report.online.processFullyClosed &&
  report.online.originUnreachableAfterShutdown &&
  report.offline.freshProcess &&
  report.offline.homeLoaded &&
  report.offline.build?.includes('v2.0.2') &&
  report.offline.cacheNames?.includes('caesar-games-v2.0.2') &&
  report.offline.libraryRows >= 3 &&
  report.offline.onlySameOriginResources &&
  boards.every(board => board?.width > 0 && board?.height > 0 && board?.visiblePieces > 0) &&
  report.offline.junqi.aiResponded &&
  report.offline.xiangqi.history >= 2 &&
  report.offline.chess.history >= 2 &&
  report.offline.sound?.playedCues.length > 0 &&
  report.runtimeErrors.length === 0;

console.log(JSON.stringify({ passed, report }, null, 2));
if (!passed) process.exitCode = 1;
