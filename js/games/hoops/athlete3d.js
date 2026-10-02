/* Caesar Games — Hoops IQ animated figurine
 *
 * One rigged athlete (athlete.glb) cloned per player. Loops (idle, jog,
 * sprint, defensive stance, screen, box-out…) cross-fade into each other;
 * one-shots (pass, catch, shot, celebrate) play over the loop and hand back.
 * Jersey numbers ride on chest and back sockets so they follow the torso.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { clone as cloneSkinned } from '../../vendor/three/addons/SkeletonUtils.js';

const FADE = 0.22;
/** Loops that crouch deep enough to want some standing pose mixed in. */
const CROUCH = new Set(['DefStance', 'DefSlideL']);
/** Feet travelled per loop, from the animation library's root motion. */
export const STRIDE = { Jog: 17.7 / 0.92, Sprint: 19.85 / 0.67 };

export class AthleteKit {
  constructor(gltf) {
    this.template = gltf.scene;
    this.clips = Object.fromEntries(gltf.animations.map(a => [a.name, a]));
    // The pedestal's top face sat exactly on the floor and fought it for depth.
    const base = this.template.getObjectByName('Base');
    if (base) base.position.y += 0.1;
    this.template.updateMatrixWorld(true);
    // Numbers ride on the chest bone, laid on the jersey's own chest and back
    // surfaces as measured in the bind pose (the exported sockets sit inside
    // the torso), squared up to face straight out of the figure.
    this.decals = [];
    const bone = this.template.getObjectByName('socket_num_front')?.parent || this.template.getObjectByName('spine_03');
    let jersey = null;
    this.template.traverse(o => { if (o.isSkinnedMesh && o.material?.name === 'Jersey') jersey = o; });
    if (bone && jersey) {
      const v = new THREE.Vector3();
      let front = -Infinity, back = Infinity, y0 = Infinity, y1 = -Infinity;
      const n = jersey.geometry.attributes.position.count;
      for (let i = 0; i < n; i++) {
        jersey.getVertexPosition(i, v);
        jersey.applyBoneTransform(i, v);
        v.applyMatrix4(jersey.matrixWorld);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const cy = y0 + (y1 - y0) * 0.68;            // upper chest, below the neckline
      for (let i = 0; i < n; i++) {
        jersey.getVertexPosition(i, v);
        jersey.applyBoneTransform(i, v);
        v.applyMatrix4(jersey.matrixWorld);
        if (Math.abs(v.x) > 0.3 || Math.abs(v.y - cy) > 0.25) continue;
        front = Math.max(front, v.z); back = Math.min(back, v.z);
      }
      const toBone = bone.matrixWorld.clone().invert();
      const place = (z, yaw, size, dy) => {
        const m = new THREE.Matrix4().compose(new THREE.Vector3(0, cy + dy, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
        this.decals.push({ bone: bone.name, local: toBone.clone().multiply(m), size });
      };
      if (Number.isFinite(front)) place(front + 0.03, 0, 0.8, -0.1);
      if (Number.isFinite(back)) place(back - 0.03, Math.PI, 0.95, 0);
    }
  }

  make(materialFor, numberMat) {
    return new Athlete(this, materialFor, numberMat);
  }
}

class Athlete {
  constructor(kit, materialFor, numberMat) {
    this.root = cloneSkinned(kit.template);
    this.root.traverse(o => {
      if (!o.isMesh) return;
      o.material = materialFor(o.material.name).clone();   // own copy, so one figure can fade
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;           // skinned bounds lag behind the pose
    });
    for (const d of kit.decals) {
      const bone = this.root.getObjectByName(d.bone);
      if (!bone || !numberMat) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size, d.size), numberMat.clone());
      d.local.decompose(m.position, m.quaternion, m.scale);
      bone.add(m);
    }
    this.ballSocket = this.root.getObjectByName('socket_ball');
    this.opacity = 1;

    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [name, clip] of Object.entries(kit.clips)) {
      const a = this.mixer.clipAction(clip);
      if (['Pass', 'Catch', 'Shot', 'Celebrate'].includes(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[name] = a;
    }
    // A second idle, blended under the defensive crouches so they read as a
    // ready stance rather than a squat.
    if (kit.clips.Idle) {
      this.stand = this.mixer.clipAction(kit.clips.Idle.clone());
      this.stand.setEffectiveWeight(0).play();
    }
    this.loopName = null;
    this.want = 'Idle';
    this.oneShot = null;
    this.mixer.addEventListener('finished', e => {
      if (e.action !== this.oneShot) return;
      this.oneShot.fadeOut(FADE);
      this.oneShot = null;
      const loop = this.actions[this.want];
      if (loop) { loop.reset().fadeIn(FADE).play(); this.loopName = this.want; }
    });
    this.setLoop('Idle');
    // Start each figure at a different point in its loop.
    this.mixer.update(Math.random() * 2);
  }

  setLoop(name, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    this.want = name;
    next.timeScale = timeScale;
    if (this.oneShot || this.loopName === name) return;
    const prev = this.actions[this.loopName];
    next.reset().fadeIn(this.loopName ? FADE : 0).play();
    if (prev) prev.fadeOut(FADE);
    this.loopName = name;
  }

  trigger(name, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(0.1);
    const loop = this.actions[this.loopName];
    if (loop) loop.fadeOut(0.12);
    this.loopName = null;
    a.reset();
    a.timeScale = timeScale;
    a.fadeIn(0.12).play();
    this.oneShot = a;
  }

  update(dt) {
    if (this.stand) {
      const goal = !this.oneShot && CROUCH.has(this.loopName) ? 0.6 : 0;
      const w = this.stand.getEffectiveWeight();
      this.stand.setEffectiveWeight(w + (goal - w) * (1 - Math.exp(-6 * dt)));
    }
    this.mixer.update(dt);
  }

  /** Fade the whole figure (the player view looks through anyone in the way). */
  setOpacity(a) {
    if (Math.abs(a - this.opacity) < 0.01) return;
    this.opacity = a;
    const solid = a >= 0.99;
    this.root.traverse(o => {
      if (!o.isMesh) return;
      if (o.material.transparent !== !solid) o.material.needsUpdate = true;
      o.material.transparent = !solid;
      o.material.opacity = a;
      o.material.depthWrite = solid;
      o.castShadow = solid;
    });
  }

  ballPosition(out) {
    if (!this.ballSocket) return null;
    return this.ballSocket.getWorldPosition(out);
  }
}
