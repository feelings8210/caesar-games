/* Caesar Games — app icon generation
 *
 * One high-resolution master, three candidate treatments, one production
 * selection, then exact-size exports.
 *
 * Hard rules:
 *   - the CD mark's aspect ratio (1499 x 925) is preserved exactly; the mark
 *     is only ever scaled uniformly, never stretched to fill a square;
 *   - the canvas is fully opaque (iOS does its own rounded-square masking);
 *   - no text, no gloss, no drop shadow, no Junqi imagery.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, resize, solid, composite, hex } from './png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARK = path.join(root, 'assets', 'cd_home_mark_transparent.png');
const OUT = path.join(root, 'assets');
const REVIEW = path.join(root, 'review', 'junqi-v1-recovery');

const MASTER = 1024;
/** Mark width as a fraction of the canvas — inside the 48–58% brief, chosen so
 *  the mark still clears iOS's rounded-square crop with room to breathe. */
const MARK_WIDTH_RATIO = 0.54;

const CANDIDATES = {
  navy:  { bg: '#12243F', tint: '#F4EFE4', label: 'Navy ground, ivory mark' },
  mist:  { bg: '#D8E0EA', tint: '#12243F', label: 'Mist ground, navy mark' },
  ivory: { bg: '#F2EDE3', tint: '#12243F', label: 'Ivory ground, navy mark' }
};

const SELECTED = 'navy';
const EXPORT_SIZES = [1024, 512, 192, 180, 167, 152, 120];

function buildIcon(mark, size, { bg, tint }) {
  const canvas = solid(size, size, hex(bg));
  const w = Math.round(size * MARK_WIDTH_RATIO);
  const h = Math.round(w * (mark.height / mark.width));   // aspect preserved, always
  const scaled = resize(mark, w, h);
  composite(canvas, scaled, Math.round((size - w) / 2), Math.round((size - h) / 2), hex(tint));
  return canvas;
}

const markRaw = decodePng(fs.readFileSync(MARK));
console.log(`source mark: ${markRaw.width}x${markRaw.height} (aspect ${(markRaw.width / markRaw.height).toFixed(3)}:1)`);

fs.mkdirSync(REVIEW, { recursive: true });

// Candidate masters, for visual review before selection.
for (const [name, spec] of Object.entries(CANDIDATES)) {
  const icon = buildIcon(markRaw, 512, spec);
  fs.writeFileSync(path.join(REVIEW, `icon-candidate-${name}.png`), encodePng(icon));
  console.log(`candidate: ${name} — ${spec.label}`);
}

// The previous icon, rendered the way iOS actually showed it: a 1.62:1 image
// forced into a square. Kept purely as the "before" reference.
{
  const stretched = resize(markRaw, 512, 512);            // deliberate distortion
  fs.writeFileSync(path.join(REVIEW, 'icon-candidate-previous.png'), encodePng(stretched));
  console.log('candidate: previous — CD mark stretched into a square (the defect)');
}

// Production exports from the selected treatment.
for (const size of EXPORT_SIZES) {
  const icon = buildIcon(markRaw, size, CANDIDATES[SELECTED]);
  fs.writeFileSync(path.join(OUT, `icon-${size}.png`), encodePng(icon));
}
console.log(`exported ${EXPORT_SIZES.join(', ')} from "${SELECTED}" (${CANDIDATES[SELECTED].label})`);

// Maskable variant: extra padding so Android/Chromium safe-zone cropping
// cannot clip the mark.
{
  const size = 512;
  const canvas = solid(size, size, hex(CANDIDATES[SELECTED].bg));
  const w = Math.round(size * 0.40);
  const h = Math.round(w * (markRaw.height / markRaw.width));
  const scaled = resize(markRaw, w, h);
  composite(canvas, scaled, Math.round((size - w) / 2), Math.round((size - h) / 2), hex(CANDIDATES[SELECTED].tint));
  fs.writeFileSync(path.join(OUT, 'icon-maskable-512.png'), encodePng(canvas));
  console.log('exported icon-maskable-512.png (40% mark, safe-zone padded)');
}
