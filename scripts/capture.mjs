/* Caesar Games — visual audit capture
 *
 * Drives the real app into each reachable state and screenshots it with
 * headless Chrome, then tiles the results into a contact sheet.
 *
 *   node scripts/capture.mjs [baseUrl] [outDir]
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, resize, solid, composite, hex } from './png.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const BASE = process.argv[2] || 'http://localhost:8099/index.html';
const OUT = process.argv[3] || path.join(root, 'review', 'junqi-v1-recovery', 'shots');

/** iPad landscape working size. */
const W = 1180, H = 820;

const SHOTS = [
  ['home', 'Home'],
  ['mode_select', 'Mode select'],
  ['players', 'Players & difficulty'],
  ['vs_ai_setup', 'Vs Computer — setup'],
  ['vs_ai_play', 'Vs Computer — play'],
  ['classic_p1_setup', 'Classic — P1 setup'],
  ['classic_handoff', 'Pass the iPad'],
  ['classic_p2_setup', 'Classic — P2 setup (P2 at bottom)'],
  ['classic_play_p1', 'Classic — P1 perspective'],
  ['classic_play_p2', 'Classic — P2 perspective'],
  ['last_move_animation', 'Last move — mid travel'],
  ['flip_unrevealed', 'Flip — all face down'],
  ['flip_revealed', 'Flip — both face directions'],
  ['library', 'Games library'],
  ['record', 'Match record'],
  ['replay', 'Replay — stepped forward'],
  ['game_end', 'Game end'],
  ['learn', 'Learn']
];

fs.mkdirSync(OUT, { recursive: true });

async function shoot(state, file) {
  const url = `${BASE}?state=${state}&nosw=1`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--window-size=${W},${H}`,
    '--force-device-scale-factor=1',
    '--virtual-time-budget=12000',
    `--screenshot=${file}`,
    url
  ];
  try {
    await run(CHROME, args, { timeout: 60000, maxBuffer: 1 << 24 });
  } catch (e) {
    // Chrome exits non-zero in some headless paths even after writing the file.
    if (!fs.existsSync(file)) throw e;
  }
  if (!fs.existsSync(file)) throw new Error(`no screenshot produced for ${state}`);
  return file;
}

/* ---------------- capture ---------------- */

const captured = [];
for (const [state, label] of SHOTS) {
  const file = path.join(OUT, `${state}.png`);
  process.stdout.write(`  ${state} … `);
  try {
    await shoot(state, file);
    const { size } = fs.statSync(file);
    console.log(`ok (${Math.round(size / 1024)} KB)`);
    captured.push({ state, label, file });
  } catch (e) {
    console.log(`FAILED — ${e.message}`);
  }
}

/* ---------------- contact sheet ---------------- */

const COLS = 3;
const CELL_W = 560;
const PAD = 26;
const LABEL_H = 34;
const HEADER_H = 96;

const cellH = Math.round(CELL_W * (H / W));
const rows = Math.ceil(captured.length / COLS);
const sheetW = PAD + COLS * (CELL_W + PAD);
const sheetH = HEADER_H + rows * (cellH + LABEL_H + PAD) + PAD;

const sheet = solid(sheetW, sheetH, hex('#EEF2F7'));

// Header band
for (let y = 0; y < HEADER_H; y++) for (let x = 0; x < sheetW; x++) {
  const i = (y * sheetW + x) * 4;
  sheet.data[i] = 0x12; sheet.data[i + 1] = 0x24; sheet.data[i + 2] = 0x3F;
}

// Brand mark in the header, aspect preserved.
try {
  const mark = decodePng(fs.readFileSync(path.join(root, 'assets', 'cd_home_mark_transparent.png')));
  const mw = 92, mh = Math.round(mw * (mark.height / mark.width));
  composite(sheet, resize(mark, mw, mh), PAD, Math.round((HEADER_H - mh) / 2), hex('#F4EFE4'));
} catch { /* header mark is decorative */ }

captured.forEach((shot, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = PAD + col * (CELL_W + PAD);
  const y = HEADER_H + row * (cellH + LABEL_H + PAD);

  // Label strip
  for (let yy = y; yy < y + LABEL_H && yy < sheetH; yy++) {
    for (let xx = x; xx < x + CELL_W; xx++) {
      const idx = (yy * sheetW + xx) * 4;
      sheet.data[idx] = 0xDD; sheet.data[idx + 1] = 0xE4; sheet.data[idx + 2] = 0xEC;
    }
  }

  const img = decodePng(fs.readFileSync(shot.file));
  const scaled = resize(img, CELL_W, cellH);
  composite(sheet, scaled, x, y + LABEL_H);
});

const sheetPath = path.join(root, 'review', 'junqi-v1-recovery', 'FINAL_CONTACT_SHEET.png');
fs.writeFileSync(sheetPath, encodePng(sheet));
console.log(`\ncontact sheet: ${sheetPath} (${sheetW}x${sheetH}, ${captured.length} states)`);

// Machine-readable index so the labels are not lost in the raster.
fs.writeFileSync(
  path.join(root, 'review', 'junqi-v1-recovery', 'shots', 'index.json'),
  JSON.stringify({ order: captured.map(c => ({ state: c.state, label: c.label })), cols: COLS }, null, 2)
);
