import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  chromium,
  webkit
} from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8107;
const origin = `http://127.0.0.1:${port}`;
const outputDir = path.resolve('review/v2.0.2-pre-travel');
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

const report = {
  build: 'v2.0.2',
  viewport: { width: 1180, height: 820 },
  generatedAt: new Date().toISOString(),
  engines: {}
};

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

  for (const [name, engine, launchOptions] of engines) {
    process.stdout.write(`${name}: Junqi E2E ... `);
    const browser = await engine.launch(launchOptions);
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));

    await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
    const junqi = await page.evaluate(async () => {
      const { runE2E } = await import('./tests/e2e.js');
      return runE2E();
    });
    console.log(`${junqi.pass} passed, ${junqi.fail} failed`);

    process.stdout.write(`${name}: Xiangqi + Chess E2E ... `);
    await page.goto(`${origin}/index.html?nosw=1`, { waitUntil: 'networkidle' });
    const openGames = await page.evaluate(async () => {
      const { runOpenE2E } = await import('./tests/e2e-open.js');
      return runOpenE2E();
    });
    console.log(`${openGames.pass} passed, ${openGames.fail} failed`);

    const geometry = await page.evaluate(() => {
      const boards = [...document.querySelectorAll('.bv-board, .open-board')];
      const rects = boards.map(board => board.getBoundingClientRect());
      const rect = rects.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      return {
        width: rect?.width || 0,
        height: rect?.height || 0,
        visiblePieces: [...document.querySelectorAll('.bv-piece, .xq-piece, .chess-piece')]
          .filter(piece => {
            const r = piece.getBoundingClientRect();
            const style = getComputedStyle(piece);
            return r.width > 0 && r.height > 0 && style.display !== 'none' &&
              style.visibility !== 'hidden';
          }).length
      };
    });

    await page.screenshot({
      path: path.join(outputDir, `${name}-final.png`),
      fullPage: true
    });
    report.engines[name] = { junqi, openGames, geometry, runtimeErrors };
    await browser.close();
  }
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  fs.writeFileSync(
    path.join(outputDir, 'BROWSER_E2E.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
}

const failed = Object.values(report.engines).some(result =>
  result.junqi.fail || result.openGames.fail || result.runtimeErrors.length ||
  result.geometry.width <= 0 || result.geometry.height <= 0 || result.geometry.visiblePieces <= 0);
if (failed) process.exitCode = 1;
