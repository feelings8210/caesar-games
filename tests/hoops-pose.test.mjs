import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three/three.module.min.js';
import { actionBall, basketballBeat, reach, roundedRoute, travelYaw, gripPoint } from '../js/games/hoops/basketball-pose.js';

test('shot set points stay continuous through gather and reach above the forehead at release', () => {
  const start = actionBall('shot', 0), end = actionBall('shot', 1);
  assert.ok(start[1] < 4 && end[1] > 6);
  let previous = start;
  for (let i = 1; i <= 1000; i++) {
    const point = actionBall('shot', i / 1000);
    assert.ok(point.every(Number.isFinite));
    assert.ok(Math.hypot(...point.map((x, n) => x - previous[n])) < .025);
    previous = point;
  }
  assert.deepEqual(actionBall('shot', -1), start);
  assert.deepEqual(actionBall('shot', 3), end);
});

test('chest pass pushes forward from a controlled set point', () => {
  const start = actionBall('pass', 0), end = actionBall('pass', 1);
  assert.ok(end[2] - start[2] > 1);
  assert.ok(end[1] < 4.5);
});

test('all arena finishes prepare before release, preserving authored timing and source data', () => {
  const close={ms:520,shot:'make',move:{o2:[2,5.8]}};
  const layup=basketballBeat(close,{id:'o2',at:[6.5,11]});
  assert.equal(layup.finish,'layup');assert.ok(layup.prepareMs>=600&&layup.ms-layup.prepareMs>=500);
  assert.equal(close.ms,520);assert.equal(close.prepareMs,undefined);
  const jump=basketballBeat({ms:800,shot:'make'},{id:'o1',at:[20,25]});
  assert.equal(jump.finish,'jump');assert.ok(jump.ms>jump.prepareMs);
  const authored={ms:1450,prepareMs:720,shot:'make'};
  assert.equal(basketballBeat(authored,{id:'o1',at:[20,25]}),authored);
  const pass=basketballBeat({ms:420,pass:'o2'},{id:'o1',at:[0,20]});
  assert.ok(pass.prepareMs>0&&pass.ms-pass.prepareMs>=450);
  assert.ok(actionBall('layup',1)[0]<-.5&&actionBall('layup',1)[1]>6);
});

test('arm solver reaches in world space under a rotated and scaled player root', () => {
  const root = new THREE.Group(); root.rotation.y = .7; root.scale.setScalar(1.08); root.position.set(12, 0, 7);
  const shoulder = new THREE.Bone(), elbow = new THREE.Bone(), wrist = new THREE.Bone();
  shoulder.position.set(0, 4, 0); elbow.position.set(0, -1, 0); wrist.position.set(0, -1, 0);
  root.add(shoulder); shoulder.add(elbow); elbow.add(wrist); root.updateMatrixWorld(true);
  const target = root.localToWorld(new THREE.Vector3(.8, 3, .7));
  assert.ok(reach(wrist, [elbow, shoulder], target, 24) < .02);
  assert.ok([shoulder, elbow].every(b => Math.abs(b.quaternion.length() - 1) < 1e-10));
});

test('rounding cuts preserves tactical endpoints and cannot leave the route bounds',()=>{
  const authored=[[0,0],[0,12],[10,12]],before=JSON.stringify(authored),route=roundedRoute(authored);
  assert.deepEqual(route[0],authored[0]);assert.deepEqual(route.at(-1),authored.at(-1));
  assert.equal(JSON.stringify(authored),before);
  assert.ok(route.every(p=>p.every(Number.isFinite)&&p[0]>=0&&p[0]<=10&&p[1]>=0&&p[1]<=12));
  assert.ok(route.some(p=>p[0]>0&&p[0]<1&&p[1]>11&&p[1]<12));
  assert.ok(roundedRoute([[0,0],[0,0],[1,0]]).every(p=>p.every(Number.isFinite)));
});

test('a stopped player faces the play instead of spinning to atan2(0,0)',()=>{
  assert.equal(travelYaw(0,0,Math.PI),Math.PI);
  assert.equal(travelYaw(.1,.1,-.8),-.8);
  assert.equal(travelYaw(12,0,-.8),Math.PI/2);
});

test('palm-to-ball contact keeps its radius under rotated nonuniform bone scales',()=>{
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(2,5,7),new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.8,-.2)),new THREE.Vector3(.83,.95,1.12));
  const centre=new THREE.Vector3(.01,.14,-.025),normal=new THREE.Vector3(.9,.1,.4).normalize();
  const skin=centre.clone().addScaledVector(normal,.08).applyMatrix4(matrix);
  const ball=gripPoint(centre,normal,matrix,.45,.08).applyMatrix4(matrix);
  assert.ok(Math.abs(skin.distanceTo(ball)-.45)<1e-10);
});
