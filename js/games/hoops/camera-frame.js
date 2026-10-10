import * as THREE from '../../vendor/three/three.module.min.js';

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
