/* Caesar Games — Hoops IQ court design
 *
 * Paints the half court over the maple planks, arena style: honey maple,
 * crisp white lines, the key and centre circle painted in the team navy and
 * the CD mark in gold at centre court.
 *
 * Canvas space: x across (left = court x -25), y down from the baseline,
 * `px` pixels per foot. Seen from the broadcast camera, canvas up is the far
 * end, so everything is drawn upright.
 */

const LINE = '#F7F4EC';
const NAVY = '#173058';
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
  const lw = 0.19 * px;                         // two-inch lines, a touch bolder for the iPad

  g.save();
  // Painted key and centre circle in the team navy, the mark in gold.
  g.fillStyle = NAVY;
  g.fillRect(X(-8), Z(0), 16 * px, 19 * px);
  g.beginPath(); g.arc(X(0), Z(47), 6 * px, 0, Math.PI * 2); g.fill();
  if (mark) {
    const w = 7.4 * px;
    const m = tintedMark(mark, '#D9B97A', Math.round(w));
    g.drawImage(m, X(0) - w / 2, Z(47) - m.height / 2 - 0.3 * px, w, m.height);
  }

  // Lines.
  g.strokeStyle = LINE;
  g.lineWidth = lw;
  g.lineCap = 'butt';
  const line = (x0, z0, x1, z1) => { g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const e = lw / 2 / px;
  line(-25, e, 25, e);                                                       // baseline
  line(-25 + e, 0, -25 + e, 50); line(25 - e, 0, 25 - e, 50);                // sidelines
  line(-25, 47, 25, 47);                                                     // half court
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
  // Centre circle.
  g.beginPath(); g.arc(X(0), Z(47), 6 * px, 0, Math.PI * 2); g.stroke();
  g.restore();
}
