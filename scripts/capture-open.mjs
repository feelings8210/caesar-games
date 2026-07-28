/* WebKit iPad-landscape visual audit for the three-game bilingual release.
 * All screenshots are produced from the running app and tiled into the release
 * contact sheet required by the project brief.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from '/Users/cdmini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { decodePng, encodePng, resize, solid, composite, hex } from './png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const out = path.join(root, 'review', 'xiangqi-chess-v1');
const shotsDir = path.join(out, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await webkit.launch({
  headless: true,
  executablePath: '/Users/cdmini/Library/Caches/ms-playwright/webkit-2287/pw_run.sh'
});
const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
const page = await context.newPage();
await page.goto(`${base}?nosw=1`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  localStorage.clear();
  sessionStorage.clear();
  for (const name of await caches.keys()) await caches.delete(name);
});
await page.reload({ waitUntil: 'networkidle' });

const captured = [];
async function shot(name) {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  captured.push(file);
  console.log(`captured ${name}`);
}
const tap = selector => page.locator(selector).click();
const waitBoard = type => page.locator(`.${type}-board`).waitFor({ state: 'visible' });

async function home() {
  await page.evaluate(() => window.caesarApp.goHome());
  await page.locator('[data-screen="home"].is-active').waitFor();
}
async function openMode(type) {
  await home();
  await tap(`.game-tile[data-game-type="${type}"]`);
  await page.locator('[data-dialog="mode"].is-open').waitFor();
}
async function startOpen(type, mode = 'two_player', { second = false } = {}) {
  await openMode(type);
  await tap(`[data-mode="${mode}"]`);
  await page.locator('[data-dialog="names"].is-open').waitFor();
  if (second) await tap('#field-side [data-side="second"]');
  await tap('#btn-start-match');
  await waitBoard(type);
}
async function move(from, to, promotion) {
  await tap(`.open-node[data-key="${from}"]`);
  await tap(`.open-node[data-key="${to}"]`);
  if (promotion) await tap(`[data-promotion="${promotion}"]`);
  await page.waitForFunction(() => !window.caesarApp.openGame.busy);
}

await shot('01_home_english');
await tap('#btn-language');
await shot('02_home_chinese');
await tap('#btn-language');

await openMode('xiangqi');
await shot('03_xiangqi_mode');
await tap('[data-mode="two_player"]');
await tap('#btn-start-match');
await waitBoard('xiangqi');
await shot('04_xiangqi_two_player');
await move('7,1', '0,1');
await shot('05_xiangqi_capture');

await page.evaluate(async () => {
  const { XiangqiGame } = await import('./js/games/xiangqi/engine.js');
  const P = (side, kind) => ({ side, kind });
  window.caesarApp.openGame.session.engine = new XiangqiGame({
    board: {
      '0,4': P('b','g'), '9,4': P('r','g'), '5,4': P('r','s'),
      '1,3': P('r','r'), '1,5': P('r','r'), '2,4': P('r','r')
    },
    turn: 'b'
  });
  window.caesarApp.openGame.render();
});
await shot('06_xiangqi_check');

await startOpen('xiangqi', 'vs_computer');
await move('6,0', '5,0');
await page.waitForFunction(() => window.caesarApp.openGame.session.engine.history.length >= 2);
await page.waitForFunction(() => !window.caesarApp.openGame.busy);
await shot('07_xiangqi_vs_computer');

await openMode('chess');
await shot('08_chess_mode');
await tap('[data-mode="two_player"]');
await tap('#btn-start-match');
await waitBoard('chess');
await shot('09_chess_two_player');
await move('e2','e4'); await move('d7','d5'); await move('e4','d5');
await shot('10_chess_capture');

await startOpen('chess', 'vs_computer');
await move('e2','e4');
await page.waitForFunction(() => window.caesarApp.openGame.session.engine.history.length >= 2);
await page.waitForFunction(() => !window.caesarApp.openGame.busy);
await shot('11_chess_vs_computer');

await page.evaluate(async () => {
  const { ChessGame } = await import('./js/games/chess/adapter.js');
  window.caesarApp.openGame.session.engine =
    new ChessGame({ fen: '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1' });
  window.caesarApp.openGame.render();
});
await shot('12_chess_check');

await page.evaluate(async () => {
  const { ChessGame } = await import('./js/games/chess/adapter.js');
  window.caesarApp.openGame.session.engine =
    new ChessGame({ fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' });
  window.caesarApp.openGame.render();
});
await tap('.open-node[data-key="a7"]');
await tap('.open-node[data-key="a8"]');
await page.locator('#promotion.is-open').waitFor();
await shot('13_chess_promotion');
await tap('[data-promotion="q"]');
await page.waitForFunction(() => !window.caesarApp.openGame.busy);

await home();
await page.evaluate(() => {
  window.caesarApp.startGame('vs_computer', {
    player1Name: 'Alex', player2Name: 'Computer', aiDifficulty: 'standard'
  });
  window.caesarApp.goHome();
});
await tap('#btn-games');
await page.locator('[data-dialog="library"].is-open').waitFor();
await shot('14_games_library');

const chessRow = page.locator('.game-row').filter({ hasText: 'Chess' }).first();
await chessRow.getByRole('button', { name: 'Record' }).click();
await page.locator('.replay-board .chess-board').waitFor();
await tap('#btn-replay-next');
await shot('15_chess_replay');

await home();
await context.setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event('offline')));
await page.locator('#network-status:not(.is-hidden)').waitFor();
await shot('16_offline_home');
await context.setOffline(false);

await browser.close();

const W = 1180, H = 820, COLS = 4, CELL_W = 360, PAD = 18, HEADER = 54;
const cellH = Math.round(CELL_W * H / W);
const rows = Math.ceil(captured.length / COLS);
const sheet = solid(PAD + COLS * (CELL_W + PAD), HEADER + rows * (cellH + PAD) + PAD, hex('#E8EDF3'));
for (let y = 0; y < HEADER; y++) for (let x = 0; x < sheet.width; x++) {
  const i = (y * sheet.width + x) * 4;
  sheet.data[i] = 0x12; sheet.data[i + 1] = 0x24; sheet.data[i + 2] = 0x3f;
}
captured.forEach((file, i) => {
  const x = PAD + (i % COLS) * (CELL_W + PAD);
  const y = HEADER + Math.floor(i / COLS) * (cellH + PAD);
  composite(sheet, resize(decodePng(fs.readFileSync(file)), CELL_W, cellH), x, y);
});
const contact = path.join(out, 'FINAL_CONTACT_SHEET.png');
fs.writeFileSync(contact, encodePng(sheet));
console.log(`contact sheet ${contact}`);
