import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { webkit } from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const port = 8101;
const origin = `http://127.0.0.1:${port}`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.cwd(), stdio: ['ignore', 'ignore', 'inherit']
});

for (let i = 0; i < 80; i++) {
  try { const response = await fetch(`${origin}/index.html`); if (response.ok) break; }
  catch {}
  await new Promise(r => setTimeout(r, 50));
}

const browser = await webkit.launch({
  headless: true,
  executablePath: '/Users/cdmini/Library/Caches/ms-playwright/webkit-2287/pw_run.sh'
});
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(`${origin}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  localStorage.clear();
  sessionStorage.clear();
  const reg = await navigator.serviceWorker.ready;
  await reg.update();
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!navigator.serviceWorker.controller);

await page.locator('.game-tile[data-game-type="xiangqi"]').click();
await page.locator('[data-mode="two_player"]').click();
await page.locator('#btn-start-match').click();
await page.locator('.xiangqi-board').waitFor();
await page.locator('.open-node[data-key="6,0"]').click();
await page.locator('.open-node[data-key="5,0"]').click();
await page.waitForFunction(() => !window.caesarApp.openGame.busy);
const savedId = await page.evaluate(() => window.caesarApp.openGame.session.gameId);
await page.evaluate(() => window.caesarApp.goHome());

server.kill('SIGTERM');
await once(server, 'exit');
let unreachable = false;
try { await fetch(`${origin}/index.html`); } catch { unreachable = true; }
if (!unreachable) throw new Error('server remained reachable');

await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
await page.locator('#btn-continue').click();
await page.locator('.xiangqi-board').waitFor();
const result = await page.evaluate(saved => {
  const board = document.querySelector('.xiangqi-board').getBoundingClientRect();
  return {
    sameGame: window.caesarApp.openGame.session.gameId === saved,
    width: board.width,
    height: board.height,
    pieces: document.querySelectorAll('.xq-piece').length,
    caches: []
  };
}, savedId);
result.caches = await page.evaluate(() => caches.keys());
const nextMove = await page.evaluate(() => window.caesarApp.openGame.session.engine.legalMoves()[0]);
await page.locator(`.open-node[data-key="${nextMove.from}"]`).click();
await page.locator(`.open-node[data-key="${nextMove.to}"]`).click();
await page.waitForFunction(() => !window.caesarApp.openGame.busy);
result.offlineAction = await page.evaluate(() => window.caesarApp.openGame.session.engine.history.length >= 2);
console.log(JSON.stringify(result, null, 2));
await browser.close();

if (!result.sameGame || result.width <= 0 || result.height <= 0 ||
    result.pieces <= 0 || !result.offlineAction ||
    !result.caches.includes('caesar-games-v2.0.3')) {
  process.exitCode = 1;
}
