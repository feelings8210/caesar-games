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

/** Our signature: a horns set "etched" into the wood in a faint darker stain --
 *  1 up top, 4 and 5 at the elbows, corner shooters; 4 screens, 1 drives, 4 rolls,
 *  1 hits the roller. Matches tools/court/make_court_design.py. */
function etchedHorns(g, X, Z, px) {
  g.save();
  g.strokeStyle = g.fillStyle = 'rgba(64,36,14,.15)';
  g.lineWidth = 0.26 * px; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [x, z] of [[0, 31.5], [-8.5, 20.5], [8.5, 20.5], [-21.5, 4], [21.5, 4]]) {
    g.beginPath(); g.arc(X(x), Z(z), 1.35 * px, 0, Math.PI * 2); g.stroke();
  }
  const head = (x, z, ang, size = 1.1) => {
    g.beginPath(); g.moveTo(X(x), Z(z));
    g.lineTo(X(x - size * Math.cos(ang - .45)), Z(z - size * Math.sin(ang - .45)));
    g.lineTo(X(x - size * Math.cos(ang + .45)), Z(z - size * Math.sin(ang + .45)));
    g.closePath(); g.fill();
  };
  g.beginPath(); g.moveTo(X(-7.6), Z(21.8)); g.bezierCurveTo(X(-6.5), Z(25.5), X(-4.5), Z(28.5), X(-2.6), Z(30.2)); g.stroke();
  g.beginPath(); g.moveTo(X(-3.7), Z(31.4)); g.lineTo(X(-1.5), Z(29)); g.stroke();
  g.beginPath(); g.moveTo(X(-1), Z(30));
  for (let k = 1; k <= 9; k++) { const t = k / 9; g.lineTo(X(-1 - 12 * t), Z(30 - 9 * t + (k % 2 ? .55 : -.55))); }
  g.stroke(); head(-13.4, 20.6, Math.atan2(-9, -12));
  g.beginPath(); g.moveTo(X(-2.4), Z(28.6)); g.bezierCurveTo(X(-1), Z(22), X(-1.6), Z(15), X(-2.6), Z(10.6)); g.stroke();
  head(-2.7, 10, Math.atan2(-4, -.6));
  g.setLineDash([.9 * px, .7 * px]);
  g.beginPath(); g.moveTo(X(-12.6), Z(19.6)); g.bezierCurveTo(X(-9), Z(15.8), X(-6), Z(13), X(-3.8), Z(11.4)); g.stroke();
  g.setLineDash([]); head(-3.3, 11, Math.atan2(-1.6, 2.2));
  g.restore();
}

export function drawCourt(g, S, mark, { centreMark = true } = {}) {
  const px = S / 50;
  const X = x => (x + 25) * px;
  const Z = z => z * px;
  const lw = 0.19 * px;                         // two-inch lines, a touch bolder for the iPad

  g.save();
  // Two-tone stain: the floor outside the three-point arc runs a shade
  // darker, as on modern arena courts, so the arc reads from any camera.
  {
    const czA = HOOP_Z + Math.sqrt(23.75 ** 2 - 22 ** 2);
    const a0 = Math.atan2(czA - HOOP_Z, 22);
    g.beginPath();
    g.moveTo(X(-25), Z(0)); g.lineTo(X(-22), Z(0)); g.lineTo(X(-22), Z(czA));
    g.arc(X(0), Z(HOOP_Z), 23.75 * px, Math.PI - a0, a0, true);
    g.lineTo(X(22), Z(0)); g.lineTo(X(25), Z(0)); g.lineTo(X(25), Z(50)); g.lineTo(X(-25), Z(50)); g.closePath();
    g.fillStyle = 'rgba(92,52,20,.16)';
    g.fill();
  }
  etchedHorns(g, X, Z, px);
  // Painted key and centre circle in the team navy, the mark in gold.
  const key = g.createLinearGradient(0, Z(0), 0, Z(19));
  key.addColorStop(0, '#132A50'); key.addColorStop(1, '#1C3A6A');
  g.fillStyle = key;
  g.fillRect(X(-8), Z(0), 16 * px, 19 * px);
  // Tonal chevrons pointing at the rim (same home-court design as the Blender venue,
  // tools/court/make_court_design.py).
  g.save();
  g.beginPath(); g.rect(X(-8), Z(0), 16 * px, 19 * px); g.clip();
  g.strokeStyle = 'rgba(52,86,150,.30)'; g.lineWidth = 0.75 * px;
  for (let k = -1; k < 9; k++) {
    const z = 1.2 + k * 2.6;
    g.beginPath(); g.moveTo(X(-8.5), Z(z + 4.2)); g.lineTo(X(0), Z(z)); g.lineTo(X(8.5), Z(z + 4.2)); g.stroke();
  }
  g.restore();
  // A gold pinstripe just inside the lane.
  g.strokeStyle = 'rgba(217,185,122,.85)';
  g.lineWidth = 0.09 * px;
  g.strokeRect(X(-7.45), Z(0.55), 14.9 * px, 17.9 * px);
  g.fillStyle = NAVY;
  g.beginPath(); g.arc(X(0), Z(47), 6 * px, 0, Math.PI * 2); g.fill();
  if (mark && centreMark) {
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
