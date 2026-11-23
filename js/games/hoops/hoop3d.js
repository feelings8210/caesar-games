/* Caesar Games — Hoops IQ basket
 *
 * A display-piece basket built in code: clear glass in a white frame with the
 * shooter's square, a black bottom pad, an orange rim on its bracket, a black
 * post rising from a lacquered base and bending forward in a graphite-steel
 * arm, two slim braces to the top of the board, and the CD mark in gold on
 * the front of the base.
 *
 * Court feet: baseline at z = 0, board face at z = 4, rim centre at
 * (hoop[0], rimY, hoop[1]). The net is the arena's cord net.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { tintedMark } from './courtdesign.js';

const BOARD = { w: 6, h: 3.5, bottom: 9.5, face: 4.0, depth: 0.09 };

export function buildHoop({ hoop = [0, 5.25], rimY = 10, mark = null } = {}) {
  const g = new THREE.Group();
  g.userData.rim = hoop;
  const mat = {
    glass: new THREE.MeshStandardMaterial({ color: 0xD8E6EC, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xF5F5F2, roughness: 0.35 }),
    black: new THREE.MeshStandardMaterial({ color: 0x14161A, roughness: 0.38, metalness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4A4F57, roughness: 0.3, metalness: 1 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xE0592A, roughness: 0.36, metalness: 0.45 }),
    lacquer: new THREE.MeshStandardMaterial({ color: 0x173058, roughness: 0.78 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xC9A76A, roughness: 0.3, metalness: 1 })
  };
  const add = (geo, m, x, y, z, shadow = true) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z, shadow) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, shadow);
  const [hx, hz] = hoop;
  const cy = BOARD.bottom + BOARD.h / 2;
  const zf = BOARD.face;

  // Glass and its white frame.
  box(BOARD.w, BOARD.h, BOARD.depth, mat.glass, hx, cy, zf - BOARD.depth / 2, false).renderOrder = 1;
  const fw = 0.17, fd = 0.16;
  box(BOARD.w + fw, fw, fd, mat.white, hx, BOARD.bottom + BOARD.h, zf - fd / 2);
  box(BOARD.w + fw, fw, fd, mat.white, hx, BOARD.bottom, zf - fd / 2);
  box(fw, BOARD.h, fd, mat.white, hx - BOARD.w / 2, cy, zf - fd / 2);
  box(fw, BOARD.h, fd, mat.white, hx + BOARD.w / 2, cy, zf - fd / 2);
  // Shooter's square: 24 × 18 in, its bottom line level with the rim.
  const lw = 0.15, sq = { w: 2, h: 1.5, y: rimY + 0.05 };
  for (const [w, h, x, y] of [
    [sq.w, lw, 0, sq.y + sq.h - lw / 2], [sq.w, lw, 0, sq.y + lw / 2],
    [lw, sq.h, -sq.w / 2 + lw / 2, sq.y + sq.h / 2], [lw, sq.h, sq.w / 2 - lw / 2, sq.y + sq.h / 2]
  ]) box(w, h, 0.02, mat.white, hx + x, y, zf + 0.012, false);
  // Black pad along the bottom edge and up the lower corners, as on arena goals.
  box(BOARD.w + 0.3, 0.32, 0.34, mat.black, hx, BOARD.bottom - 0.12, zf - 0.17);
  for (const sx of [-1, 1]) box(0.3, 1.25, 0.34, mat.black, hx + sx * (BOARD.w / 2 + 0.02), BOARD.bottom + 0.5, zf - 0.17);

  // Rim on its bracket.
  const ring = add(new THREE.TorusGeometry(0.75, 0.055, 10, 48), mat.rim, hx, rimY, hz);
  ring.rotation.x = Math.PI / 2;
  box(0.4, 0.16, hz - 0.75 - zf + 0.1, mat.rim, hx, rimY - 0.05, (zf + hz - 0.75) / 2 + 0.05);
  box(0.62, 0.42, 0.06, mat.rim, hx, rimY - 0.08, zf + 0.03);

  // Support: an arena stanchion. A tall sloped base and a padded post in
  // team navy (rounded, slightly glossy vinyl), a gold stripe across the
  // court-facing pad, then the steel arm out to the board.
  const baseZ1 = -3.0, baseH = 2.2, baseW = 4.6;
  const pad = new THREE.MeshPhysicalMaterial({ color: 0x163262, roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.45 });
  {
    // Side profile in (z, y): low at the back, tall and rounded at the front.
    const prof = new THREE.Shape();
    prof.moveTo(-10.2, 0); prof.lineTo(baseZ1, 0); prof.lineTo(baseZ1, 3.15);
    prof.quadraticCurveTo(baseZ1, 3.7, baseZ1 - 0.6, 3.72);
    prof.lineTo(-8.4, 3.05); prof.quadraticCurveTo(-10.2, 2.8, -10.2, 1.9); prof.lineTo(-10.2, 0);
    const geo = new THREE.ExtrudeGeometry(prof, { depth: baseW, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.2, bevelSegments: 4, curveSegments: 12 });
    geo.rotateY(-Math.PI / 2);
    geo.translate(hx + baseW / 2, 0, 0);
    add(geo, pad, 0, 0, 0);
    // Gold stripe and a dark kick plate on the court-facing pad.
    box(baseW + 0.42, 0.14, 0.06, mat.gold, hx, 2.75, baseZ1 + 0.21, false);
    box(baseW + 0.42, 0.42, 0.06, new THREE.MeshStandardMaterial({ color: 0x0C1424, roughness: 0.7 }), hx, 0.21, baseZ1 + 0.21, false);
  }
  // Shot clock on top of the board.
  box(1.9, 0.62, 0.5, mat.black, hx, BOARD.bottom + BOARD.h + 0.42, zf - 0.3);
  {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 84;
    const cg = c.getContext('2d');
    cg.fillStyle = '#050608'; cg.fillRect(0, 0, 256, 84);
    cg.fillStyle = '#FF3B2F';
    cg.font = '700 64px ui-monospace, Menlo, monospace';
    cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.fillText('24', 128, 46);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.55), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.set(hx, BOARD.bottom + BOARD.h + 0.42, zf - 0.04);
    g.add(face);
  }
  const postZ = -6.3;
  {
    // Padded post: a rounded square column from the base up to the arm.
    const w = 1.5, d = 1.35, r = 0.32, h = 5.0;
    const sec = new THREE.Shape();
    sec.moveTo(-w / 2 + r, -d / 2); sec.lineTo(w / 2 - r, -d / 2); sec.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    sec.lineTo(w / 2, d / 2 - r); sec.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); sec.lineTo(-w / 2 + r, d / 2);
    sec.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); sec.lineTo(-w / 2, -d / 2 + r); sec.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const geo = new THREE.ExtrudeGeometry(sec, { depth: h, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(hx, 3.0, postZ);
    add(geo, pad, 0, 0, 0);
    box(w + 0.2, 0.12, d + 0.2, mat.gold, hx, 3.0 + h - 0.35, postZ, false);
  }
  const arm = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hx, baseH + 5.6, postZ),
    new THREE.Vector3(hx, baseH + 7.6, postZ + 0.4),
    new THREE.Vector3(hx, 10.6, postZ + 2.6),
    new THREE.Vector3(hx, 11.9, 0.6),
    new THREE.Vector3(hx, 12.15, zf - 0.5)
  ]);
  add(new THREE.TubeGeometry(arm, 40, 0.26, 14, false), mat.steel, 0, 0, 0);
  box(1.3, 0.75, 0.26, mat.black, hx, 12.15, zf - 0.28);                  // mount, above the square
  // Braces from the arm to the board's top corners.
  const from = new THREE.Vector3(hx, 10.9, -2.0);
  for (const sx of [-1, 1]) {
    const to = new THREE.Vector3(hx + sx * 1.9, BOARD.bottom + BOARD.h - 0.2, zf - 0.2);
    const len = from.distanceTo(to);
    const rod = add(new THREE.CylinderGeometry(0.05, 0.05, len, 8), mat.black, 0, 0, 0);
    rod.position.copy(from).lerp(to, 0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }

  // The mark, in gold on the front of the base.
  if (mark) {
    const c = tintedMark(mark, '#F4F2EC', 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const w = 2.3;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * c.height / c.width),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, metalness: 0.9, roughness: 0.3, depthWrite: false }));
    m.position.set(hx, 1.45, baseZ1 + 0.23);
    g.add(m);
  }
  return g;
}
