/* Caesar Games — Hoops IQ court design
 *
 * Paints the half court over the maple planks: a stained navy lane with a
 * gold pinstripe, a slightly deeper tone inside the arc, crisp cream lines,
 * the CD mark in the centre circle and the name along the baseline.
 *
 * Canvas space: x across (left = court x -25), y down from the baseline,
 * `px` pixels per foot. Seen from the broadcast camera, canvas up is the far
 * end, so everything is drawn upright.
 */

const NAVY = '#1B3358';
const GOLD = '#C9A76A';
const LINE = '#F3EEE4';
const HOOP_Z = 5.25;

/** The CD mark as a single-colour silhouette. */
export function tintedMark(img, color, width) {
  const h = Math.round(width * img.height / img.width);
  const c = document.createElement('canvas');
  c.width = width; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, width, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, width, h);
  return c;
}

export function drawCourt(g, S, mark) {
  const px = S / 50;
  const X = x => (x + 25) * px;
  const Z = z => z * px;
  const lw = 0.17 * px;                         // two-inch lines

  g.save();
  // Two-tone floor: a deeper maple inside the arc.
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(214,178,132,0.55)';
  arcRegion(g, X, Z, px);
  g.fill();
  g.globalCompositeOperation = 'source-over';

  // Stained lane: navy over the grain, with a gold pinstripe inside the lines.
  g.fillStyle = 'rgba(27,51,88,0.86)';
  g.fillRect(X(-8), Z(0), 16 * px, 19 * px);
  g.strokeStyle = GOLD;
  g.lineWidth = 0.09 * px;
  g.strokeRect(X(-7.45), Z(0.55), 14.9 * px, 17.9 * px);

  // Centre circle: navy disc, gold ring, the mark.
  g.fillStyle = 'rgba(27,51,88,0.9)';
  g.beginPath(); g.arc(X(0), Z(47), 6 * px, 0, Math.PI * 2); g.fill();
  g.strokeStyle = GOLD;
  g.lineWidth = 0.09 * px;
  g.beginPath(); g.arc(X(0), Z(47), 5.45 * px, 0, Math.PI * 2); g.stroke();
  if (mark) {
    const w = 7.2 * px;
    const m = tintedMark(mark, '#D8BC80', Math.round(w));
    g.drawImage(m, X(0) - w / 2, Z(47) - m.height / 2 - 0.25 * px, w, m.height);
  }

  // Lines.
  g.strokeStyle = LINE;
  g.lineWidth = lw;
  g.lineCap = 'butt';
  const line = (x0, z0, x1, z1) => { g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const e = lw / 2 / px;
  line(-25, e, 25, e);                                                       // baseline
  line(-25 + e, 0, -25 + e, 47); line(25 - e, 0, 25 - e, 47);                // sidelines
  line(-25, 47, -6, 47); line(6, 47, 25, 47);                                // half court, broken by the circle
  g.strokeRect(X(-8), Z(0), 16 * px, 19 * px);                              // lane
  // Three-point line: corners, then the arc.
  const cz = HOOP_Z + Math.sqrt(23.75 ** 2 - 22 ** 2);
  line(-22, 0, -22, cz); line(22, 0, 22, cz);
  const a0 = Math.atan2(cz - HOOP_Z, 22);
  g.beginPath(); g.arc(X(0), Z(HOOP_Z), 23.75 * px, a0, Math.PI - a0); g.stroke();
  // Free-throw circle: solid outside the lane, dashed inside.
  g.beginPath(); g.arc(X(0), Z(19), 6 * px, 0, Math.PI); g.stroke();
  g.setLineDash([1.3 * px, 1.0 * px]);
  g.beginPath(); g.arc(X(0), Z(19), 6 * px, Math.PI, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  // Restricted area and lane hash marks.
  g.beginPath(); g.arc(X(0), Z(HOOP_Z), 4 * px, 0, Math.PI); g.stroke();
  line(-4, HOOP_Z, -4, 4); line(4, HOOP_Z, 4, 4);
  for (const z of [7, 8, 11, 14]) { line(-8.8, z, -8, z); line(8, z, 8.8, z); }
  // Centre circle line and the small inner circle.
  g.beginPath(); g.arc(X(0), Z(47), 6 * px, 0, Math.PI * 2); g.stroke();

  // Name along the baseline, either side of the lane.
  g.fillStyle = NAVY;
  g.globalAlpha = 0.92;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(1.9 * px)}px "Iowan Old Style", "Palatino", Georgia, serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(0.6 * px)}px`;
  g.fillText('CAESAR', X(-14.6), Z(2.3));
  g.fillText('GAMES', X(14.6), Z(2.3));
  g.restore();
}

/** Inside of the three-point line, as a path. */
function arcRegion(g, X, Z, px) {
  const cz = HOOP_Z + Math.sqrt(23.75 ** 2 - 22 ** 2);
  const a0 = Math.atan2(cz - HOOP_Z, 22);
  g.beginPath();
  g.moveTo(X(-22), Z(0));
  g.lineTo(X(-22), Z(cz));
  g.arc(X(0), Z(HOOP_Z), 23.75 * px, Math.PI - a0, a0, true);
  g.lineTo(X(22), Z(0));
  g.closePath();
}
