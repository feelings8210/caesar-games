import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  chromium,
  webkit
} from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8105;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.5-hotfix/polish');
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

const assertions = [];
const assert = (engine, name, pass, detail = {}) => {
  assertions.push({ engine, name, pass: !!pass, ...detail });
};
const shot = (page, engine, scene, phase) => page.screenshot({
  path: path.join(outputDir, `${engine.toUpperCase()}_${scene}_${phase}.png`)
});

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/index.html`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!ready) throw new Error('local QA server did not start');

  for (const [engineName, engine, launchOptions] of engines) {
    const browser = await engine.launch(launchOptions);
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
    const page = await context.newPage();
    await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });

    // Xiangqi: initial, true interpolated midpoint, exact final state.
    await page.evaluate(() => {
      localStorage.clear();
      window.caesarApp.startOpenGame('xiangqi', { mode: 'two_player' });
    });
    await shot(page, engineName, 'XQ_NORMAL', 'INITIAL');
    const xqEnds = await page.evaluate(() => {
      const center = key => {
        const r = document.querySelector(`.open-node[data-key="${key}"]`).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      window.__qaMove = window.caesarApp.openGame.commit('6,0', '5,0', null);
      return { start: center('6,0'), end: center('5,0') };
    });
    await page.waitForFunction(() => document.querySelector('.open-flyer')?.getAnimations()
      .some(animation => (animation.currentTime || 0) >= 65));
    const xqMid = await page.evaluate(() => {
      const r = document.querySelector('.open-flyer').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await shot(page, engineName, 'XQ_NORMAL', 'MID');
    await page.waitForFunction(() => !window.caesarApp.openGame.busy);
    await shot(page, engineName, 'XQ_NORMAL', 'FINAL');
    const xqFinal = await page.evaluate(() => {
      const engine = window.caesarApp.openGame.session.engine;
      return {
        destination: engine.board['5,0']?.kind || null,
        origin: engine.board['6,0'] || null,
        flyers: document.querySelectorAll('.open-flyer').length
      };
    });
    assert(engineName, 'Xiangqi normal move interpolates in the intended direction',
      xqMid.y < xqEnds.start.y && xqMid.y > xqEnds.end.y,
      { start: xqEnds.start, midpoint: xqMid, end: xqEnds.end });
    assert(engineName, 'Xiangqi normal move settles to exact canonical state',
      xqFinal.destination === 's' && !xqFinal.origin && xqFinal.flyers === 0, xqFinal);

    // Xiangqi: target remains until contact, then leaves with compression/fade.
    await page.evaluate(async () => {
      const { XiangqiGame } = await import('./js/games/xiangqi/engine.js');
      window.caesarApp.openGame.session.engine = new XiangqiGame({
        board: {
          '9,4': { side: 'r', kind: 'g' },
          '0,4': { side: 'b', kind: 'g' },
          '5,4': { side: 'r', kind: 's' },
          '4,0': { side: 'r', kind: 'r' },
          '3,0': { side: 'b', kind: 's' }
        },
        turn: 'r'
      });
      window.caesarApp.openGame.render();
    });
    await shot(page, engineName, 'XQ_CAPTURE', 'INITIAL');
    await page.evaluate(() => {
      window.__qaMove = window.caesarApp.openGame.commit('4,0', '3,0', null);
    });
    await page.waitForFunction(() => {
      const flyer = document.querySelector('.open-flyer:not(.open-capture-ghost)');
      return flyer?.getAnimations().some(animation => (animation.currentTime || 0) >= 65);
    });
    const xqContactBefore = await page.evaluate(() => {
      const ghost = document.querySelector('.open-capture-ghost');
      return {
        ghostPresent: !!ghost,
        ghostAnimations: ghost?.getAnimations().length || 0,
        opacity: ghost ? getComputedStyle(ghost).opacity : null
      };
    });
    await shot(page, engineName, 'XQ_CAPTURE', 'MID');
    await page.waitForFunction(() =>
      document.querySelector('.open-capture-ghost')?.getAnimations().length > 0);
    const xqContact = await page.evaluate(() => {
      const ghost = document.querySelector('.open-capture-ghost');
      return ghost.getAnimations().map(animation => animation.effect.getTiming().duration);
    });
    assert(engineName, 'Xiangqi capture target remains intact before contact',
      xqContactBefore.ghostPresent && xqContactBefore.ghostAnimations === 0 &&
        Number(xqContactBefore.opacity) > .95, xqContactBefore);
    assert(engineName, 'Xiangqi contact triggers readable compression/fade',
      xqContact.includes(225), { durations: xqContact });
    await page.waitForFunction(() => !window.caesarApp.openGame.busy);
    await shot(page, engineName, 'XQ_CAPTURE', 'FINAL');

    // Chess normal move: lighter timing, still true interpolation.
    await page.evaluate(() => {
      window.caesarApp.startOpenGame('chess', { mode: 'two_player' });
    });
    await shot(page, engineName, 'CHESS_NORMAL', 'INITIAL');
    const chessEnds = await page.evaluate(() => {
      const center = key => {
        const r = document.querySelector(`.open-node[data-key="${key}"]`).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const points = { start: center('e2'), end: center('e4') };
      window.__qaMove = window.caesarApp.openGame.commit('e2', 'e4', null);
      return points;
    });
    await page.waitForFunction(() => document.querySelector('.open-flyer')?.getAnimations()
      .some(animation => (animation.currentTime || 0) >= 55));
    const chessMid = await page.evaluate(() => {
      const r = document.querySelector('.open-flyer').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await shot(page, engineName, 'CHESS_NORMAL', 'MID');
    await page.waitForFunction(() => !window.caesarApp.openGame.busy);
    await shot(page, engineName, 'CHESS_NORMAL', 'FINAL');
    const chessNormalFinal = await page.evaluate(() => {
      const board = window.caesarApp.openGame.session.engine.board;
      return {
        destination: board.e4?.kind || null,
        origin: board.e2 || null,
        flyers: document.querySelectorAll('.open-flyer').length
      };
    });
    assert(engineName, 'Chess normal move interpolates without teleport',
      chessMid.y < chessEnds.start.y && chessMid.y > chessEnds.end.y,
      { start: chessEnds.start, midpoint: chessMid, end: chessEnds.end });
    assert(engineName, 'Chess normal move settles exactly',
      chessNormalFinal.destination === 'p' && !chessNormalFinal.origin &&
        chessNormalFinal.flyers === 0, chessNormalFinal);

    // Chess capture: target holds until contact and disappears cleanly.
    await page.evaluate(async () => {
      const { ChessGame } = await import('./js/games/chess/adapter.js');
      window.caesarApp.openGame.session.engine = new ChessGame({
        fen: '4k3/8/8/8/8/n7/8/R3K3 w Q - 0 1'
      });
      window.caesarApp.openGame.render();
    });
    await shot(page, engineName, 'CHESS_CAPTURE', 'INITIAL');
    await page.evaluate(() => {
      window.__qaMove = window.caesarApp.openGame.commit('a1', 'a3', null);
    });
    await page.waitForFunction(() => {
      const flyer = document.querySelector('.open-flyer:not(.open-capture-ghost)');
      return flyer?.getAnimations().some(animation => (animation.currentTime || 0) >= 55);
    });
    const chessCaptureMid = await page.evaluate(() => {
      const ghost = document.querySelector('.open-capture-ghost');
      return {
        ghostPresent: !!ghost,
        ghostAnimations: ghost?.getAnimations().length || 0,
        opacity: ghost ? getComputedStyle(ghost).opacity : null
      };
    });
    await shot(page, engineName, 'CHESS_CAPTURE', 'MID');
    await page.waitForFunction(() =>
      document.querySelector('.open-capture-ghost')?.getAnimations().length > 0);
    await page.waitForFunction(() => !window.caesarApp.openGame.busy);
    await shot(page, engineName, 'CHESS_CAPTURE', 'FINAL');
    const chessCaptureFinal = await page.evaluate(() => {
      const board = window.caesarApp.openGame.session.engine.board;
      return {
        destination: board.a3?.kind || null,
        origin: board.a1 || null,
        flyers: document.querySelectorAll('.open-flyer').length
      };
    });
    assert(engineName, 'Chess capture holds the target until physical contact',
      chessCaptureMid.ghostPresent && chessCaptureMid.ghostAnimations === 0 &&
        Number(chessCaptureMid.opacity) > .95, chessCaptureMid);
    assert(engineName, 'Chess capture settles to exact canonical state',
      chessCaptureFinal.destination === 'r' && !chessCaptureFinal.origin &&
        chessCaptureFinal.flyers === 0, chessCaptureFinal);

    // Chess: castling moves both physical pieces in one motion.
    await page.evaluate(async () => {
      window.caesarApp.startOpenGame('chess', { mode: 'two_player' });
      const { ChessGame } = await import('./js/games/chess/adapter.js');
      window.caesarApp.openGame.session.engine = new ChessGame({
        fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1'
      });
      window.caesarApp.openGame.render();
    });
    await shot(page, engineName, 'CHESS_CASTLE', 'INITIAL');
    await page.evaluate(() => {
      window.__qaMove = window.caesarApp.openGame.commit('e1', 'g1', null);
    });
    await page.waitForFunction(() => {
      const flyers = [...document.querySelectorAll('.open-flyer')];
      return flyers.length === 2 && flyers.every(flyer =>
        flyer.getAnimations().some(animation => (animation.currentTime || 0) >= 55));
    });
    const castleMid = await page.evaluate(() => {
      const flyers = [...document.querySelectorAll('.open-flyer')];
      const centers = flyers.map(flyer => {
        const rect = flyer.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      return {
        flyers: flyers.length,
        separation: centers.length === 2
          ? Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y)
          : 0,
        kingHidden: getComputedStyle(
          document.querySelector('.open-node[data-key="g1"] .open-piece')
        ).visibility,
        rookHidden: getComputedStyle(
          document.querySelector('.open-node[data-key="f1"] .open-piece')
        ).visibility
      };
    });
    await shot(page, engineName, 'CHESS_CASTLE', 'MID');
    await page.waitForFunction(() => !window.caesarApp.openGame.busy);
    await shot(page, engineName, 'CHESS_CASTLE', 'FINAL');
    const castleFinal = await page.evaluate(() => {
      const board = window.caesarApp.openGame.session.engine.board;
      return {
        king: board.g1?.kind || null,
        rook: board.f1?.kind || null,
        oldKing: board.e1 || null,
        oldRook: board.h1 || null,
        flyers: document.querySelectorAll('.open-flyer').length
      };
    });
    assert(engineName, 'Chess castling has simultaneous king and rook travel',
      castleMid.flyers === 2 && castleMid.kingHidden === 'hidden' &&
        castleMid.rookHidden === 'hidden' && castleMid.separation > 16, castleMid);
    assert(engineName, 'Chess castling settles both pieces exactly',
      castleFinal.king === 'k' && castleFinal.rook === 'r' &&
        !castleFinal.oldKing && !castleFinal.oldRook && castleFinal.flyers === 0,
      castleFinal);

    // Junqi Flip: top-owner face changes only at the narrow midpoint.
    const revealKey = await page.evaluate(() => {
      window.caesarApp.startGame('flip', {
        player1Name: 'Bottom owner',
        player2Name: 'Top owner'
      });
      const session = window.caesarApp.session;
      session.assignedColors = { p1: 'navy', p2: 'red' };
      session.flipSeatTurn = 2;
      const key = Object.keys(session.boardState).find(k =>
        session.boardState[k].side === 'red' && !session.boardState[k].revealed);
      window.caesarApp.render();
      return key;
    });
    await shot(page, engineName, 'JUNQI_REVEAL', 'INITIAL');
    await page.evaluate(key => { void window.caesarApp.onFlipTap(key); }, revealKey);
    await page.waitForFunction(() =>
      document.querySelector('.bv-reveal-flyer.is-face.faces-top'));
    const revealMid = await page.evaluate(key => {
      const flyer = document.querySelector('.bv-reveal-flyer');
      return {
        shell: getComputedStyle(flyer).transform,
        face: getComputedStyle(flyer.querySelector('.bv-face')).transform,
        settledVisibility: getComputedStyle(
          document.querySelector(`.bv-node[data-key="${key}"] .bv-piece`)
        ).visibility
      };
    }, revealKey);
    await shot(page, engineName, 'JUNQI_REVEAL', 'MID');
    await page.waitForFunction(() =>
      !document.querySelector('.bv-reveal-flyer') && !window.caesarApp._busy);
    await shot(page, engineName, 'JUNQI_REVEAL', 'FINAL');
    const revealFinal = await page.evaluate(key => ({
      facesTop: document.querySelector(
        `.bv-node[data-key="${key}"] .bv-piece`
      ).classList.contains('faces-top'),
      flyers: document.querySelectorAll('.bv-reveal-flyer').length
    }), revealKey);
    assert(engineName, 'Junqi top-owner reveal keeps orientation off the moving shell',
      !/matrix\(-1,\s*0,\s*0,\s*-1/.test(revealMid.shell) &&
        revealMid.face !== 'none' && revealMid.settledVisibility === 'hidden',
      revealMid);
    assert(engineName, 'Junqi reveal settles with owner orientation and no duplicate',
      revealFinal.facesTop && revealFinal.flyers === 0, revealFinal);

    // All four screen-space directions for a top-facing piece.
    const vectors = [
      ['right', '4-0', '4-1'],
      ['left', '4-1', '4-0'],
      ['down', '5-0', '6-0'],
      ['up', '6-0', '5-0']
    ];
    for (const [direction, from, to] of vectors) {
      const endpoints = await page.evaluate(({ from, to }) => {
        const view = window.caesarApp.board;
        const start = view.centerOf(from);
        const end = view.centerOf(to);
        window.__qaMove = view.animateMove({
          from,
          to,
          combat: false,
          faceHtml: '兵',
          faceClass: 'is-face side-red faces-top'
        });
        return { start, end };
      }, { from, to });
      await page.waitForFunction(() => document.querySelector('.bv-flyer')?.getAnimations()
        .some(animation => (animation.currentTime || 0) >= 35));
      const midpoint = await page.evaluate(() => {
        const flyer = document.querySelector('.bv-flyer');
        const r = flyer.getBoundingClientRect();
        const b = document.querySelector('.bv-board').getBoundingClientRect();
        return {
          x: r.left - b.left + r.width / 2,
          y: r.top - b.top + r.height / 2,
          face: getComputedStyle(flyer.querySelector('.bv-face')).transform
        };
      });
      const expectedDx = Math.sign(endpoints.end.x - endpoints.start.x);
      const expectedDy = Math.sign(endpoints.end.y - endpoints.start.y);
      const actualDx = Math.sign(midpoint.x - endpoints.start.x);
      const actualDy = Math.sign(midpoint.y - endpoints.start.y);
      assert(engineName, `Junqi top-facing travel ${direction} follows screen vector`,
        (!expectedDx || actualDx === expectedDx) &&
          (!expectedDy || actualDy === expectedDy) &&
          midpoint.face !== 'none',
        { endpoints, midpoint });
      await page.waitForFunction(() => !document.querySelector('.bv-flyer'));
    }

    // Mute remains persistent through reload and game switching; muted cues
    // still leave a visual action and are explicitly audited as not played.
    await page.evaluate(async () => {
      const { sounds } = await import('./js/engine/sound.js');
      sounds.setMuted(true);
    });
    await page.reload({ waitUntil: 'networkidle' });
    const muteReload = await page.evaluate(async () => {
      const { sounds } = await import('./js/engine/sound.js');
      window.caesarApp.startOpenGame('xiangqi', { mode: 'two_player' });
      sounds.clearAudit();
      await window.caesarApp.openGame.commit('6,0', '5,0', null);
      const first = {
        muted: sounds.isMuted,
        audit: sounds.getAudit(),
        final: window.caesarApp.openGame.session.engine.board['5,0']?.kind || null
      };
      window.caesarApp.startOpenGame('chess', { mode: 'two_player' });
      return { ...first, afterSwitch: sounds.isMuted };
    });
    assert(engineName, 'Mute persists through reload and game switch without hiding state',
      muteReload.muted && muteReload.afterSwitch && muteReload.final === 's' &&
        muteReload.audit.some(entry => entry.cue === 'place' && !entry.played),
      muteReload);
    await context.close();

    // JavaScript WAAPI timings, CSS transitions, and final state all collapse
    // in a real reduced-motion browser context.
    const reduced = await browser.newContext({
      viewport: { width: 1180, height: 820 },
      reducedMotion: 'reduce'
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
    const reducedResult = await reducedPage.evaluate(async () => {
      window.caesarApp.startOpenGame('xiangqi', { mode: 'two_player' });
      const view = window.caesarApp.openGame.view;
      const moving = view.captureSnapshot('6,0');
      const result = window.caesarApp.openGame.session.engine.move('6,0', '5,0');
      window.caesarApp.openGame.render();
      const started = performance.now();
      const pending = view.animateFrom(moving, '5,0', result);
      const duration = view.lastMotion?.travel?.effect.getTiming().duration ?? null;
      await pending;
      return {
        elapsed: performance.now() - started,
        duration,
        transition: getComputedStyle(
          document.querySelector('.open-piece')
        ).transitionDuration,
        final: window.caesarApp.openGame.session.engine.board['5,0']?.kind || null,
        flyers: document.querySelectorAll('.open-flyer').length
      };
    });
    assert(engineName, 'Reduced motion collapses JS and CSS motion while preserving final state',
      reducedResult.duration === 1 && reducedResult.elapsed < 120 &&
        reducedResult.transition.includes('0.001s') &&
        reducedResult.final === 's' && reducedResult.flyers === 0,
      reducedResult);
    await reduced.close();
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    assertions: assertions.length,
    passed: assertions.filter(item => item.pass).length,
    failed: assertions.filter(item => !item.pass).length,
    screenshots: fs.readdirSync(outputDir).filter(name => name.endsWith('.png')).sort(),
    results: assertions
  };
  fs.writeFileSync(
    path.join(outputDir, 'POLISH_QA.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify({
    assertions: report.assertions,
    passed: report.passed,
    failed: report.failed,
    screenshots: report.screenshots.length,
    outputDir
  }, null, 2));
  if (report.failed) process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit');
}
