import * as THREE from '../../vendor/three/three.module.min.js';

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Ball set points in the athlete's facing coordinates, in court feet.
 * The action has a gather, load and release; the same release phase owns sound. */
export function actionBall(kind, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  if (kind === 'pass') return mix([-.7, 3.5, .55], [-.15, 4.15, 1.65], smooth(t));
  if (kind === 'layup') {
    const gathered = [-.65, 3.65, .6], lifted = [-.65, 6.8, .85];
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

/** Round an authored change of direction inside its original convex hull.
 * Final tactical positions remain exact; the maximum corner cut is small. */
export function roundedRoute(points, radius=1.1) {
  if(points.length<3)return points.map(p=>[...p]);
  const route=[[...points[0]]];
  for(let i=1;i<points.length-1;i++) {
    const a=points[i-1],b=points[i],c=points[i+1];
    const before=Math.hypot(b[0]-a[0],b[1]-a[1]),after=Math.hypot(c[0]-b[0],c[1]-b[1]);
    if(before<.01||after<.01){route.push([...b]);continue;}
    const r=Math.min(radius,before*.2,after*.2);
    const enter=b.map((v,n)=>v+(a[n]-v)*r/before),exit=b.map((v,n)=>v+(c[n]-v)*r/after);
    route.push(enter);
    for(let n=1;n<=5;n++){const t=n/5;route.push(b.map((v,j)=>(1-t)**2*enter[j]+2*(1-t)*t*v+t*t*exit[j]));}
  }
  route.push([...points.at(-1)]);return route;
}

export function travelYaw(vx,vz,fallback) {
  return Math.hypot(vx,vz)>1.5?Math.atan2(vx,vz):fallback;
}

/** Sphere centre measured from the actual palm surface. Ancestor bone scales
 * can be nonuniform, so root scale alone cannot preserve the ball radius. */
export function gripPoint(centre,normal,matrixWorld,radius,skinDepth) {
  const scale=normal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(matrixWorld)).length();
  return centre.clone().addScaledVector(normal,radius/Math.max(.01,scale)+skinDepth);
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
      const angle=change.angleTo(new THREE.Quaternion());
      if (angle>.45)change.slerp(new THREE.Quaternion(),1-.45/angle);
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
