/* Caesar Games — app icon review strip.
 * Renders the previous icon beside the candidates and the selected production
 * icon, each on an iOS-style rounded-square crop, for visual review. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, resize, solid, composite, hex } from './png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(root, 'review', 'junqi-v1-recovery');

const TILE = 300;
const PAD = 40;
const LABEL = 30;

const items = [
  ['icon-candidate-previous.png', 'BEFORE — stretched'],
  ['icon-candidate-mist.png', 'A — mist ground'],
  ['icon-candidate-ivory.png', 'B — ivory ground'],
  ['icon-candidate-navy.png', 'SELECTED — navy ground']
];

/** Apply an iOS-style superellipse mask so the crop is judged honestly. */
function roundCorners(img, bg) {
  const r = Math.round(img.width * 0.225);
  const { width: w, height: h, data } = img;
  const inside = (x, y) => {
    const cx = Math.min(x, w - 1 - x);
    const cy = Math.min(y, h - 1 - y);
    if (cx >= r || cy >= r) return true;
    const dx = r - cx, dy = r - cy;
    return Math.pow(dx, 4) + Math.pow(dy, 4) <= Math.pow(r, 4);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (inside(x, y)) continue;
    const i = (y * w + x) * 4;
    data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255;
  }
  return img;
}

const sheetW = PAD + items.length * (TILE + PAD);
const sheetH = PAD + LABEL + TILE + PAD;
const BG = hex('#E8EDF3');
const sheet = solid(sheetW, sheetH, BG);

items.forEach(([file, label], i) => {
  const src = decodePng(fs.readFileSync(path.join(REVIEW, file)));
  const tile = roundCorners(resize(src, TILE, TILE), BG);
  composite(sheet, tile, PAD + i * (TILE + PAD), PAD + LABEL);
  void label;
});

const out = path.join(REVIEW, 'ICON_REVIEW_STRIP.png');
fs.writeFileSync(out, encodePng(sheet));
console.log(`icon strip: ${out} (${sheetW}x${sheetH})`);
console.log('order: ' + items.map(([, l]) => l).join('  |  '));
