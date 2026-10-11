/* Caesar Games — Hoops IQ animated figurine
 *
 * One rigged athlete (athlete.glb) cloned per player. Loops (idle, jog,
 * sprint, defensive stance, screen, box-out…) cross-fade into each other;
 * one-shots (pass, catch, shot, celebrate) play over the loop and hand back.
 * Jersey numbers ride on chest and back sockets so they follow the torso.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { clone as cloneSkinned } from '../../vendor/three/addons/SkeletonUtils.js';
import { reach, gripPoint } from './basketball-pose.js';

const FADE = 0.22;
/** Loops that crouch deep enough to want some standing pose mixed in. */
const CROUCH = new Set(['DefStance', 'DefSlideL', 'DefSlideR']);
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
    this.palms={};
    const body=this.template.getObjectByName('AnatomicalBody');
    if(body?.isSkinnedMesh)for(const side of ['r','l']) {
      const hand=this.template.getObjectByName(`hand_${side}`),joint=body.skeleton.bones.indexOf(hand);
      if(joint<0)continue;
      const indices=body.geometry.attributes.skinIndex,weights=body.geometry.attributes.skinWeight,points=[];
      for(let i=0;i<indices.count;i++) {
        let weight=0;for(let k=0;k<4;k++)if(indices.getComponent(i,k)===joint)weight+=weights.getComponent(i,k);
        if(weight>.85)points.push(hand.worldToLocal(body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld)));
      }
      if(points.length>3) {
        const centre=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(points.length);
        this.palms[side]={centre,vertices:points.length,points};
      }
    }
    // Numbers ride on the chest bone, laid on the jersey's own chest and back
    // surfaces as measured in the bind pose (the exported sockets sit inside
    // the torso), squared up to face straight out of the figure.
    this.decals = [];
    const bone = this.template.getObjectByName('socket_num_front')?.parent || this.template.getObjectByName('spine_03');
    let jersey = null;
    this.template.traverse(o => { if (o.isSkinnedMesh && o.material?.name === 'Jersey' && o.name !== 'JerseyLOD') jersey = o; });
    if (bone && jersey) {
      const v = new THREE.Vector3();
      let front = -Infinity, back = Infinity, y0 = Infinity, y1 = -Infinity;
      const n = jersey.geometry.attributes.position.count;
      for (let i = 0; i < n; i++) {
        jersey.getVertexPosition(i, v);
        v.applyMatrix4(jersey.matrixWorld);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      }
      const cy = y0 + (y1 - y0) * 0.68;            // upper chest, below the neckline
      for (let i = 0; i < n; i++) {
        jersey.getVertexPosition(i, v);
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

  make(materialFor, numberMat, { pedestal = true, style = 0 } = {}) {
    return new Athlete(this, materialFor, numberMat, pedestal, style);
  }
}

class Athlete {
  constructor(kit, materialFor, numberMat, pedestal, style) {
    this.root = cloneSkinned(kit.template);
    this.poseBase = new Map();
    this.head = this.root.getObjectByName('Head');
    this.ownedGeometry = new Set();
    this.hairStyle = style % 2 ? 'HairCrop' : 'HairFull';
    this.identity = style ? [
      ['Head', [1 + (style - 3) * .025, 1, 1 + (3 - style) * .015]],
      ...['upperarm_l','upperarm_r'].map(name => [name,[.86 + style * .012,1,.86 + style * .012]]),
      ...['calf_l','calf_r'].map(name => [name,[.94,1,.94]])
    ].map(([name, scale]) => [this.root.getObjectByName(name), new THREE.Vector3(...scale)]) : [];
    for (const name of ['HairCrop', 'HairFull', 'HairCropLOD', 'HairFullLOD', 'HeadLOD']) {
      const hair = this.root.getObjectByName(name);
      if (hair) hair.visible = name === this.hairStyle;
    }
    for (const name of ['BodyLOD','JerseyLOD','ShortsLOD']) {
      const lod=this.root.getObjectByName(name);if(lod)lod.visible=false;
    }
    if (!pedestal) {
      const base = this.root.getObjectByName('Base');
      if (base) base.visible = false;
    }
    const surfaceNumbers=!!(style&&kit.palms.r&&kit.palms.l&&numberMat?.map);
    this.root.traverse(o => {
      if (!o.isMesh) return;
      const source=materialFor(o.material.name);
      o.material = source.clone();   // own copy, so one figure can fade
      o.material.onBeforeCompile=source.onBeforeCompile;
      o.material.customProgramCacheKey=source.customProgramCacheKey;
      if(surfaceNumbers&&o.material.name==='Jersey') {
        const compile=o.material.onBeforeCompile;
        o.material.onBeforeCompile=shader=>{
          compile(shader);
          shader.uniforms.hoopsNumber={value:numberMat.map};
          shader.fragmentShader='uniform sampler2D hoopsNumber;\n'+shader.fragmentShader.replace('#include <color_fragment>',
            `#include <color_fragment>
             vec2 numberUV=vec2(.5+vKitRest.x*(vKitRest.z>=0.0?1.0:-1.0)/1.25,(vKitRest.y-3.72)/1.4);
             if(numberUV.x>0.0&&numberUV.x<1.0&&numberUV.y>0.0&&numberUV.y<1.0&&abs(vKitRest.z)>.15){
               vec4 ink=texture2D(hoopsNumber,numberUV);
               diffuseColor.rgb=mix(diffuseColor.rgb,pow(ink.rgb,vec3(2.2)),ink.a);
             }`);
        };
        o.material.customProgramCacheKey=()=> 'hoops-kit-surface-numbers-1';
      }
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;           // skinned bounds lag behind the pose
    });
    for (const d of surfaceNumbers?[]:kit.decals) {
      const bone = this.root.getObjectByName(d.bone);
      if (!bone || !numberMat) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.size*(pedestal?1:1.5),d.size*(pedestal?1:1.35)), numberMat.clone());
      this.ownedGeometry.add(m.geometry);
      d.local.decompose(m.position, m.quaternion, m.scale);
      bone.add(m);
    }
    this.ballSocket = this.root.getObjectByName('socket_ball');
    this.rightArm = ['lowerarm_r', 'upperarm_r'].map(n => this.root.getObjectByName(n));
    this.leftArm = ['lowerarm_l', 'upperarm_l'].map(n => this.root.getObjectByName(n));
    this.leftHand = this.root.getObjectByName('hand_l');
    this.rightHand = this.root.getObjectByName('hand_r');
    this.grips = style && kit.palms.r && kit.palms.l ? ['r','l'].map(side => {
      const hand=this.root.getObjectByName(`hand_${side}`);
      const index=this.root.getObjectByName(`index_01_${side}`),pinky=this.root.getObjectByName(`pinky_01_${side}`),middle=this.root.getObjectByName(`middle_01_${side}`);
      if(!hand||!index||!pinky||!middle)return null;
      const anchor=new THREE.Object3D();anchor.name=`grip_ball_${side}`;hand.add(anchor);
      const normal=index.position.clone().cross(pinky.position).normalize();
      if(side==='l')normal.negate();
      const centre=kit.palms[side].centre.clone();
      const depths=kit.palms[side].points.map(p=>p.clone().sub(centre).dot(normal)).sort((a,b)=>a-b);
      return {anchor,centre,normal,skinOffset:Math.max(.03,depths[Math.floor(depths.length*.85)]),
        fingers:['index','middle','ring','pinky','thumb'].map(name=>({
          tip:this.root.getObjectByName(`${name}_04_leaf_${side}`),
          joints:[3,2,1].map(n=>this.root.getObjectByName(`${name}_0${n}_${side}`))
        })).filter(f=>f.tip&&f.joints.every(Boolean))};
    }) : null;
    if(this.grips?.[0])this.ballSocket=this.grips[0].anchor;
    this.fingerRest = [];
    this.root.traverse(o => { if (o.isBone && /^(index|middle|ring|pinky|thumb)_/.test(o.name)) this.fingerRest.push([o, o.quaternion.clone()]); });
    this.restFinger=new Map(this.fingerRest);
    this.feet = ['l', 'r'].map(side => ({ bone: this.root.getObjectByName(`foot_${side}`),
      joints: [`calf_${side}`, `thigh_${side}`].map(n => this.root.getObjectByName(n)), planted: null }));
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
    // Undo the previous frame's procedural layer before the mixer. Constant
    // animation tracks may skip writes, so leaving IK edits in place drifts.
    for (const [bone, quaternion] of this.poseBase) bone.quaternion.copy(quaternion);
    this.poseBase.clear();
    if (this.stand) {
      const goal = !this.oneShot && CROUCH.has(this.loopName) ? 0.6 : 0;
      const w = this.stand.getEffectiveWeight();
      this.stand.setEffectiveWeight(w + (goal - w) * (1 - Math.exp(-6 * dt)));
    }
    this.mixer.update(dt);
    // PropertyMixer may skip writes for unchanged scale tracks; assign absolute
    // identity dimensions rather than compounding them on every frame.
    for (const [bone, scale] of this.identity) if (bone) bone.scale.copy(scale);
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
    this._gripAnchors();
    return this.ballSocket.getWorldPosition(out);
  }

  _gripAnchors(radius=.45) {
    if(!this.grips)return;
    for(const grip of this.grips)if(grip) {
      grip.anchor.parent.updateWorldMatrix(true,false);
      grip.anchor.position.copy(gripPoint(grip.centre,grip.normal,grip.anchor.parent.matrixWorld,radius,grip.skinOffset));
    }
  }

  _gripFingers(grip, centre, radius) {
    if(!grip)return;
    for(const finger of grip.fingers) {
      this._savePose(finger.joints);
      for(const joint of finger.joints)joint.quaternion.copy(this.restFinger.get(joint));
      finger.joints.at(-1).updateWorldMatrix(false,true);
      const rotations=finger.joints.map(j=>j.quaternion.clone());
      const tip=finger.tip.getWorldPosition(new THREE.Vector3());
      const radial=tip.clone().sub(centre);
      if(radial.lengthSq()<1e-8)continue;
      const target=radial.normalize().multiplyScalar(radius+.025).add(centre);
      reach(finger.tip,finger.joints,target,8);
      // Keep the anatomical rest knuckle directions. This is a bounded contact
      // correction, not permission for the solver to spin fingers around.
      finger.joints.forEach((joint,i)=>{
        const angle=rotations[i].angleTo(joint.quaternion);
        if(angle>.85)joint.quaternion.copy(rotations[i].clone().slerp(joint.quaternion,.85/angle));
      });
      finger.joints.at(-1).updateWorldMatrix(false,true);
    }
  }

  reachBall(rightTarget, leftTarget = null, {grip=false,leftGrip=true,radius=.45}={}) {
    this._savePose([...this.rightArm, ...this.leftArm, this.rightHand, this.leftHand]);
    this._gripAnchors(radius);
    this.root.updateWorldMatrix(true, true);
    const palmReach=(effector,hand,arm,target)=>{
      if(!this.grips)return reach(effector,arm,target);
      const before=hand.quaternion.clone();
      reach(effector,[hand,...arm],target,24);
      const angle=before.angleTo(hand.quaternion);
      if(angle>1.2)hand.quaternion.copy(before.slerp(hand.quaternion,1.2/angle));
      hand.updateWorldMatrix(false,true);
      return reach(effector,arm,target,24);
    };
    const error = palmReach(this.ballSocket,this.rightHand,this.rightArm,rightTarget);
    if (leftTarget) {
      if(grip&&leftGrip&&this.grips?.[1])palmReach(this.grips[1].anchor,this.leftHand,this.leftArm,rightTarget);
      else reach(this.leftHand,this.leftArm,leftTarget);
    }
    if(grip&&this.grips) {
      this._gripFingers(this.grips[0],rightTarget,radius);
      if(leftTarget&&leftGrip)this._gripFingers(this.grips[1],rightTarget,radius);
    }
    this.contactError = error;
  }

  guardHands(rightTarget, leftTarget) {
    this._savePose([...this.rightArm, ...this.leftArm, ...this.fingerRest.map(([bone]) => bone)]);
    for (const [bone, rest] of this.fingerRest) bone.quaternion.slerp(rest, .85);
    this.root.updateWorldMatrix(true, true);
    reach(this.rightHand, this.rightArm, rightTarget);
    reach(this.leftHand, this.leftArm, leftTarget);
  }

  layupStride(fraction) {
    // The right knee rises on the right-hand finish and settles on landing.
    // Layer over the authored jump; never move or stretch the ankle directly.
    const strength=Math.sin(Math.PI*Math.max(0,Math.min(1,(fraction-.18)/.72)));
    if (strength<.01) return;
    const foot=this.feet[1];if(!foot?.bone) return;
    this._savePose(foot.joints);this.root.updateWorldMatrix(true,true);
    const rotations=foot.joints.map(j=>j.quaternion.clone());
    const target=foot.bone.getWorldPosition(new THREE.Vector3());
    const forward=new THREE.Vector3(0,0,.65*strength).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    target.add(forward);target.y+=1.05*strength;
    const error=reach(foot.bone,foot.joints,target,16);
    if(error>.08) {foot.joints.forEach((j,i)=>j.quaternion.copy(rotations[i]));this.root.updateWorldMatrix(true,true);}
  }

  balance(direction, angle) {
    const spine=this.root.getObjectByName('spine_01');
    if(!spine||direction.lengthSq()<.01||Math.abs(angle)<.001)return;
    this._savePose([spine]);
    const axis=new THREE.Vector3(0,1,0).cross(direction).normalize();
    const parent=spine.parent.getWorldQuaternion(new THREE.Quaternion());
    const delta=new THREE.Quaternion().setFromAxisAngle(axis,angle);
    delta.premultiply(parent.clone().invert()).multiply(parent);
    spine.quaternion.premultiply(delta).normalize();spine.updateWorldMatrix(false,true);
  }

  releaseFingers() {
    this._savePose(this.fingerRest.map(([bone])=>bone));
    for(const [bone,rest] of this.fingerRest)bone.quaternion.slerp(rest,.8);
    this.root.updateWorldMatrix(true,true);
  }

  _savePose(bones) {
    for (const bone of bones) if (bone && !this.poseBase.has(bone)) this.poseBase.set(bone,bone.quaternion.clone());
  }

  gaze(target, bodyYaw) {
    if (!this.head) return;
    this._savePose([this.head]);
    const at=this.head.getWorldPosition(new THREE.Vector3());
    const desired=Math.atan2(target.x-at.x,target.z-at.z);
    const delta=Math.max(-.45,Math.min(.45,Math.atan2(Math.sin(desired-bodyYaw),Math.cos(desired-bodyYaw))));
    const parent=this.head.parent.getWorldQuaternion(new THREE.Quaternion());
    const turn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),delta);
    turn.premultiply(parent.clone().invert()).multiply(parent);
    this.head.quaternion.premultiply(turn).normalize();
  }

  setQuality(quality) {
    const low = quality === 'low', lod = this.root.getObjectByName('HeadLOD');
    if (!lod) return;
    lod.visible = low;
    const head = this.root.getObjectByName('AnatomicalHead'); if (head) head.visible = !low;
    for(const [full,simplified] of [['AnatomicalBody','BodyLOD'],['JerseyHigh','JerseyLOD'],['ShortsHigh','ShortsLOD']]) {
      const mesh=this.root.getObjectByName(full),mobile=this.root.getObjectByName(simplified);
      if(mesh&&mobile){mesh.visible=!low;mobile.visible=low;}
    }
    for (const name of ['HairCrop', 'HairFull', 'HairCropLOD', 'HairFullLOD']) {
      const hair = this.root.getObjectByName(name);
      if (hair) hair.visible = name === this.hairStyle + (low ? 'LOD' : '');
    }
  }

  plantFeet(moving) {
    // Keep the authored swing; only stabilize its grounded section. Never lock
    // the foot during a jump, catch or celebration action.
    if (!moving || this.oneShot) { this.feet.forEach(f => f.planted = null); return; }
    this.root.updateWorldMatrix(true, true);
    for (const foot of this.feet) {
      const at = foot.bone.getWorldPosition(new THREE.Vector3());
      if (at.y > .65 || (foot.planted && at.distanceTo(foot.planted) > 2.2)) foot.planted = null;
      if (at.y < .5 && !foot.planted) foot.planted = at.clone();
      if (foot.planted) {
        this._savePose(foot.joints);
        const rotations = foot.joints.map(j => j.quaternion.clone());
        foot.error = reach(foot.bone, foot.joints, foot.planted, 12);
        if (foot.error > .08) {
          // The root can accelerate farther than a planted leg can reach.
          // Release that step instead of stretching or collapsing the knee.
          foot.joints.forEach((j, i) => j.quaternion.copy(rotations[i]));
          foot.planted = null; this.root.updateWorldMatrix(true, true);
        }
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    const materials = new Set(), skeletons = new Set();
    this.root.traverse(o => {
      if (o.material) for (const m of [o.material].flat()) materials.add(m);
      if (o.skeleton) skeletons.add(o.skeleton);
    });
    // Model geometry and number maps belong to the shared kit/court.
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of materials) m.dispose();
    for (const s of skeletons) s.dispose();
  }
}
