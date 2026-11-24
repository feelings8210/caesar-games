/* Review-only skin-vertex/ball measurements. This samples vertices, not the
 * continuous hand surface: absence of penetration is not proof of contact. */
import * as THREE from '../js/vendor/three/three.module.min.js';

export function summarizeSignedDistances(distances, tolerance = .02) {
  if (!Array.isArray(distances) || !distances.length || distances.some(n => !Number.isFinite(n)) ||
      !Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid surface samples');
  const sorted = [...distances].sort((a, b) => a - b);
  return { count: sorted.length, min: sorted[0], max: sorted.at(-1),
    nearestAbsolute: Math.min(...sorted.map(Math.abs)),
    insideBeyondTolerance: sorted.filter(n => n < -tolerance).length,
    nearSurface: sorted.filter(n => Math.abs(n) <= tolerance).length, tolerance };
}

export function handSkinBallDistances(mesh, side, centre, radius) {
  if (!mesh?.isSkinnedMesh || !['l', 'r'].includes(side) || !centre?.isVector3 || !(radius > 0))
    throw new Error('Invalid hand mesh or ball');
  const a = mesh.geometry.attributes, bones = mesh.skeleton.bones;
  if (!a.skinIndex || !a.skinWeight) throw new Error('Missing skin weights');
  const relevant = new Set(bones.map((b, i) => ({ i, name: b.name })).filter(b =>
    b.name === `hand_${side}` || new RegExp(`^(thumb|index|middle|ring|pinky)_\\d+_${side}$`).test(b.name)).map(b => b.i));
  if (!relevant.size) throw new Error('Hand bones missing');
  mesh.updateWorldMatrix(true, false); mesh.skeleton.update();
  const point = new THREE.Vector3(), distances = [];
  for (let i = 0; i < a.skinIndex.count; i++) {
    let weight = 0;
    for (let k = 0; k < 4; k++) if (relevant.has(a.skinIndex.getComponent(i, k))) weight += a.skinWeight.getComponent(i, k);
    if (weight >= .5) distances.push(mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).distanceTo(centre) - radius);
  }
  return summarizeSignedDistances(distances);
}
