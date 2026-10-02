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
    lacquer: new THREE.MeshStandardMaterial({ color: 0x08090C, roughness: 0.22, metalness: 0.15 }),
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
  // Black pad along the bottom edge.
  box(BOARD.w + 0.3, 0.32, 0.34, mat.black, hx, BOARD.bottom - 0.12, zf - 0.17);

  // Rim on its bracket.
  const ring = add(new THREE.TorusGeometry(0.75, 0.055, 10, 48), mat.rim, hx, rimY, hz);
  ring.rotation.x = Math.PI / 2;
  box(0.4, 0.16, hz - 0.75 - zf + 0.1, mat.rim, hx, rimY - 0.05, (zf + hz - 0.75) / 2 + 0.05);
  box(0.62, 0.42, 0.06, mat.rim, hx, rimY - 0.08, zf + 0.03);

  // Support: lacquer base behind the baseline, black post, steel arm.
  const baseZ0 = -9.4, baseZ1 = -3.2, baseH = 1.1, baseW = 4.2;
  const bz = (baseZ0 + baseZ1) / 2;
  box(baseW, baseH, baseZ1 - baseZ0, mat.lacquer, hx, baseH / 2, bz);
  box(baseW + 0.05, 0.06, baseZ1 - baseZ0 + 0.05, mat.gold, hx, baseH - 0.28, bz, false);
  const postZ = -6.3;
  add(new THREE.CylinderGeometry(0.36, 0.44, 6.2, 18), mat.black, hx, baseH + 3.1, postZ);
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
    const c = tintedMark(mark, '#D9B97A', 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const w = 1.1;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * c.height / c.width),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.05, metalness: 0.9, roughness: 0.3, depthWrite: false }));
    m.position.set(hx, 0.42, baseZ1 + 0.012);
    g.add(m);
  }
  return g;
}
