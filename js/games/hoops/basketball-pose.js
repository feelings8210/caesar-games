import * as THREE from '../../vendor/three/three.module.min.js';

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Ball set points in the athlete's facing coordinates, in court feet.
 * The action has a gather, load and release; the same release phase owns sound. */
export function actionBall(kind, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  if (kind === 'pass') return mix([-.7, 3.5, .55], [-.15, 4.15, 1.65], smooth(t));
  if (kind === 'layup') {
    const gathered = [-.65, 3.65, .6], lifted = [-.65, 7.1, .85];
    return t < .35 ? mix([-.7,3.3,.6],gathered,smooth(t/.35))
      : mix(gathered,lifted,smooth((t-.35)/.65));
  }
  const loaded = [-.45, 3.1, .6], set = [-.32, 5.95, .72], release = [-.3, 6.35, .78];
  if (t < .35) return mix([-.7, 3.5, .55], loaded, smooth(t / .35));
  if (t < .85) return mix(loaded, set, smooth((t - .35) / .5));
  return mix(set, release, smooth((t - .85) / .15));
}

/** Give every arena pass/finish a preparation phase. Preserve explicitly
 * authored timing, and leave the shared 2D beat data untouched. */
export function basketballBeat(beat, holder) {
  if (!beat.pass && !beat.shot || beat.prepareMs || !holder) return beat;
  if (beat.pass) return { ...beat, ms: Math.max(beat.ms || 600, 680), prepareMs: 220 };
  const movement = beat.move?.[holder.id];
  const end = movement ? (Array.isArray(movement[0]) ? movement.at(-1) : movement) : holder.at;
  const close = Math.hypot(end[0],end[1]-5.25)<11;
  return { ...beat, ms: Math.max(beat.ms || 600, close ? 1150 : 1250),
    prepareMs: close ? 650 : 600, finish: close ? 'layup' : 'jump' };
}

/** Bounded CCD in world space. Converts each adjustment into parent space;
 * it can be layered after AnimationMixer without changing the exported rig. */
export function reach(effector, joints, target, iterations = 18) {
  if (!effector || joints.some(j => !j)) return Infinity;
  const at = new THREE.Vector3(), end = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const change = new THREE.Quaternion(), parent = new THREE.Quaternion();
  for (let n = 0; n < iterations; n++) {
    for (const joint of joints) {
      joint.getWorldPosition(at); effector.getWorldPosition(end);
      a.copy(end).sub(at); b.copy(target).sub(at);
      if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) continue;
      change.setFromUnitVectors(a.normalize(), b.normalize());
      // Limit each solver step; keep the elbow on its authored bending side.
      if (change.angleTo(new THREE.Quaternion()) > .45) change.slerp(new THREE.Quaternion(), .5);
      joint.parent.getWorldQuaternion(parent);
      change.premultiply(parent.clone().invert()).multiply(parent);
      joint.quaternion.premultiply(change).normalize();
      joint.updateWorldMatrix(false, true);
    }
    effector.getWorldPosition(end);
    if (end.distanceToSquared(target) < .0001) break;
  }
  return effector.getWorldPosition(end).distanceTo(target);
}
