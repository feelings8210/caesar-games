import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { framePosition, broadcastFrame } from '../js/games/hoops/camera-frame.js';
import { LEVELS } from '../js/games/hoops/levels.js';

test('lower game camera includes the basket and every full player in all chapters',()=>{
  for(const level of LEVELS)for(const aspect of [.65,1.18,1.5,2.1]) {
    const positions=Object.fromEntries(Object.entries(level.setup).filter(([id])=>id!=='ball'));
    const fov=aspect<.9?54:36,frame=broadcastFrame(positions,fov,aspect);
    const camera=new THREE.PerspectiveCamera(fov,aspect,1,400);
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
    for(const point of frame.points){const p=point.clone().project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1);}
    if(aspect>=.9){const ray=frame.position.clone().sub(frame.target);assert.ok(Math.atan2(ray.y,Math.hypot(ray.x,ray.z))<Math.PI/6);}
  }
});

test('shot landmarks stay within camera view on phone, iPad and wide desktop', () => {
  for (const aspect of [.65, 1, 1.5, 2.1]) for (const side of [-1, 1]) {
    const points = [new THREE.Vector3(side * 22, 0, 3.5), new THREE.Vector3(side * 22, 9, 3.5),
      new THREE.Vector3(0, 13, 5.25), new THREE.Vector3(side * 11, 17, 4.375)];
    const target = new THREE.Vector3(side * 11, 5, 4.375);
    const camera = new THREE.PerspectiveCamera(44, aspect, 1, 400);
    camera.position.copy(framePosition(points, target, new THREE.Vector3(.62, .3, .73), 44, aspect));
    camera.lookAt(target); camera.updateMatrixWorld(true);
    for (const point of points) {
      const projected = point.clone().project(camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1);
    }
  }
});
