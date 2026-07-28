import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium, webkit } from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8104;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.1-hotfix');
fs.mkdirSync(outputDir, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'ignore', 'inherit']
});

try {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/index.html`);
      if (response.ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }

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
  const vectors = [
    ['right', '4-0', '4-1'],
    ['left', '4-1', '4-0'],
    ['down-cross-half', '5-0', '6-0'],
    ['up-cross-half', '6-0', '5-0']
  ];
  const results = [];

  for (const [engineName, engine, launchOptions] of engines) {
    const browser = await engine.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      window.caesarApp.startGame('flip', {
        player1Name: 'Bottom owner',
        player2Name: 'Top owner'
      });
    });

    for (const side of ['navy', 'red']) {
      for (const topFacing of [false, true]) {
        for (const [direction, from, to] of vectors) {
          await page.evaluate(({ side, topFacing, from, to }) => {
            const view = window.caesarApp.board;
            const start = view.centerOf(from);
            const end = view.centerOf(to);
            window.__hotfixMotion = { start, end };
            void view.animateMove({
              from,
              to,
              combat: false,
              faceHtml: '兵',
              faceClass: `is-face side-${side}${topFacing ? ' faces-top' : ''}`
            });
          }, { side, topFacing, from, to });

          await page.waitForFunction(() => {
            const flyer = document.querySelector('.bv-flyer');
            return flyer?.getAnimations().some(animation => (animation.currentTime || 0) >= 30);
          });

          const sample = await page.evaluate(() => {
            const flyer = document.querySelector('.bv-flyer');
            const rect = flyer.getBoundingClientRect();
            const board = document.querySelector('.bv-board').getBoundingClientRect();
            const mid = {
              x: rect.left - board.left + rect.width / 2,
              y: rect.top - board.top + rect.height / 2
            };
            const { start, end } = window.__hotfixMotion;
            return {
              expectedDx: Math.sign(end.x - start.x),
              expectedDy: Math.sign(end.y - start.y),
              midDx: +(mid.x - start.x).toFixed(2),
              midDy: +(mid.y - start.y).toFixed(2),
              shellTransform: getComputedStyle(flyer).transform,
              faceTransform: getComputedStyle(flyer.querySelector('.bv-face')).transform
            };
          });

          const pass =
            (!sample.expectedDx || Math.sign(sample.midDx) === sample.expectedDx) &&
            (!sample.expectedDy || Math.sign(sample.midDy) === sample.expectedDy) &&
            (sample.expectedDx ? Math.abs(sample.midDy) < 3 : Math.abs(sample.midDx) < 3);
          results.push({ engine: engineName, side, topFacing, direction, pass, ...sample });

          if (engineName === 'webkit' && topFacing &&
              ((side === 'navy' && direction === 'left') ||
               (side === 'red' && direction === 'down-cross-half'))) {
            await page.screenshot({
              path: path.join(outputDir, `WEBKIT_MID_${side}_${direction}.png`)
            });
          }
          await page.waitForFunction(() => !document.querySelector('.bv-flyer'));
        }
      }
    }
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    assertions: results.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length,
    results
  };
  fs.writeFileSync(
    path.join(outputDir, 'MOTION_PATH_RESULTS.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  console.log(JSON.stringify({
    assertions: summary.assertions,
    passed: summary.passed,
    failed: summary.failed,
    outputDir
  }, null, 2));
  if (summary.failed) process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await once(server, 'exit');
}
