import * as THREE from '../../vendor/three/three.module.min.js';

/** The learner sees the players and basket, with room for their bodies and
 * targets. Empty floor does not determine the size of the whole match. */
export function broadcastFrame(positions, fov, aspect) {
  const points=[];
  for(const [x,z] of Object.values(positions))for(const dx of [-1.5,1.5])for(const dz of [-1.5,1.5])for(const y of [0,7.7])
    points.push(new THREE.Vector3(x+dx,y,z+dz));
  for(const x of [-3.5,3.5])for(const y of [0,13.5])points.push(new THREE.Vector3(x,y,4));
  const bounds=new THREE.Box3().setFromPoints(points),target=bounds.getCenter(new THREE.Vector3());
  target.y=3.4;
  const direction=aspect<.9?new THREE.Vector3(-.25,.56,.79):new THREE.Vector3(-.91,.39,.14);
  return {position:framePosition(points,target,direction,fov,aspect,1.09),target,points};
}

/** Fit actual action landmarks, in both dimensions, at every screen aspect. */
export function framePosition(points, target, direction, fov, aspect, padding = 1.08) {
  const d = direction.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const up = d.clone().cross(right);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2), tanH = tanV * aspect;
  let distance = 0;
  for (const point of points) {
    const v = point.clone().sub(target), depth = v.dot(d);
    distance = Math.max(distance, depth + Math.abs(v.dot(right)) / tanH, depth + Math.abs(v.dot(up)) / tanV);
  }
  return d.multiplyScalar(distance * padding).add(target);
}
