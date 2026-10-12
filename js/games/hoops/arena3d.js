/* Caesar Games — Hoops IQ diorama set
 *
 * Everything around the court in the 3D view, built in code so it stays light
 * on an ordinary iPad: a navy apron with a gold inlay and the name behind the
 * baseline, stands of navy seats with aisles and black handrails behind a
 * scrolling LED ribbon on three sides, columned walls falling into a cool
 * haze, soft light shafts from above, and a cord net that sways.
 *
 * World space is court feet (x across, z from the baseline, y up); the court
 * floor itself (z 0..50) is drawn by Court3D at y = 0.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mergeGeometries } from '../../vendor/three/addons/BufferGeometryUtils.js';
import { buildCourtside } from './arena-courtside.js';
import { buildCrowdImpostors } from './arena-crowd-impostors.js';
import { buildArchitecture } from './arena-architecture.js';

const GROUND_Y = -2.4;

const MAT = {
  lacquer: () => new THREE.MeshStandardMaterial({ color: 0x14284A, roughness: 0.4, envMapIntensity: 0.3 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xC9A76A, roughness: 0.3, metalness: 1 }),
  ground: () => new THREE.MeshStandardMaterial({ color: 0x0D1015, roughness: 0.92 }),
  tread: () => new THREE.MeshStandardMaterial({ color: 0x41464E, roughness: 0.9 }),
  riser: () => new THREE.MeshStandardMaterial({ color: 0x23272E, roughness: 0.92 }),
  seat: () => new THREE.MeshStandardMaterial({ color: 0x303B4A, roughness: 0.6 }),
  step: () => new THREE.MeshStandardMaterial({ color: 0x5A5F67, roughness: 0.85 }),
  backing: () => new THREE.MeshStandardMaterial({ color: 0x14171C, roughness: 0.9 }),
  rail: () => new THREE.MeshStandardMaterial({ color: 0x15171B, roughness: 0.35, metalness: 0.8 }),
  wall: () => new THREE.MeshStandardMaterial({ color: 0x262B32, roughness: 0.95 }),
  pilaster: () => new THREE.MeshStandardMaterial({ color: 0x323740, roughness: 0.9 })
};

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Rounded-rectangle slab, top face at y = 0. */
function slab(x0, x1, z0, z1, depth, radius, mat) {
  const s = new THREE.Shape();
  const r = radius;
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  const bevel = 0.18;
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(Math.PI / 2);                       // shape xy → xz, extrude downward
  g.translate(0, -bevel, 0);
  return new THREE.Mesh(g, mat);
}

/** A thin gold frame (outer rectangle minus inner) lying flat at height y. */
function frame(x0, x1, z0, z1, w, y, mat) {
  const g = new THREE.Group();
  const h = 0.03;
  g.add(box(x1 - x0 + w * 2, h, w, mat, (x0 + x1) / 2, y, z0 - w / 2));
  g.add(box(x1 - x0 + w * 2, h, w, mat, (x0 + x1) / 2, y, z1 + w / 2));
  g.add(box(w, h, z1 - z0, mat, x0 - w / 2, y, (z0 + z1) / 2));
  g.add(box(w, h, z1 - z0, mat, x1 + w / 2, y, (z0 + z1) / 2));
  return g;
}

/** A straight rod between two points. */
function rod(a, b, r, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * One bank of stands. Built along local +x (length) rising toward local -z,
 * then placed by the caller. `aisles` are local x positions of stairways.
 */
function stand(length, mats, seats, led, aisles = [], rows = 6, humanScale = false, frontPlatform = false) {
  const g = new THREE.Group();
  const depth = 2.7, rise = 1.45, aw = 3.6;
  // Bench runs between the aisles.
  const cuts = aisles.map(a => [a - aw / 2, a + aw / 2]).sort((p, q) => p[0] - q[0]);
  const runs = [];
  let from = -length / 2;
  for (const [a, b] of cuts) { if (a > from) runs.push([from, a]); from = b; }
  if (from < length / 2) runs.push([from, length / 2]);
  for (let k = 0; k < rows; k++) {
    const top = GROUND_Y + 2.6 + rise * k;
    const z = -0.6 - depth * (k + 0.5);
    const h = top - GROUND_Y;
    g.add(box(length, h - 0.22, depth, mats.riser, 0, GROUND_Y + (h - 0.22) / 2, z));
    const tread=box(length, 0.22, frontPlatform&&k===0?depth+1:depth-.25, mats.tread, 0, top-.11, z+(frontPlatform&&k===0?.6:.12));
    tread.receiveShadow=frontPlatform;g.add(tread);
    for (const [a, b] of runs) {
      const n = Math.floor((b - a) / 1.9);
      for (let i = 0; i < n; i++) seats.push([g, a + (b - a) * (i + 0.5) / n, top + (humanScale && k===0 ? 1.5 : .55), z - depth / 2 + 0.95]);
    }
    for (const x of aisles) g.add(box(aw - 0.3, 0.06, depth - 0.4, mats.step, x, top + (frontPlatform&&k===0?-.03:.03), z + 0.1));
  }
  // Handrails up each aisle, following the rake.
  const z0 = -0.9, z1 = -0.6 - depth * rows + 0.4;
  const y0 = GROUND_Y + 2.6 + 2.4, y1 = GROUND_Y + 2.6 + rise * (rows - 1) + 2.4;
  for (const x of aisles) {
    for (const sx of [-1, 1]) {
      const xr = x + sx * (aw / 2 - 0.15);
      g.add(rod(new THREE.Vector3(xr, y0, z0), new THREE.Vector3(xr, y1, z1), 0.06, mats.rail));
      for (let k = 0; k < rows; k += 2) {
        const zz = -0.6 - depth * (k + 0.5), top = GROUND_Y + 2.6 + rise * k;
        const yr = y0 + (y1 - y0) * (zz - z0) / (z1 - z0);
        g.add(rod(new THREE.Vector3(xr, top, zz), new THREE.Vector3(xr, yr, zz), 0.045, mats.rail));
      }
    }
  }
  // Front wall carrying the LED ribbon, and its rail.
  const frontH = frontPlatform?4.7:3.4,frontZ=frontPlatform?.65:-.35;
  g.add(box(length, frontH, 0.3, mats.backing, 0, GROUND_Y + frontH / 2, frontZ));
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(length, 1.7), led);
  ribbon.position.set(0, GROUND_Y + frontH - 0.95, frontZ+.16);
  g.add(ribbon);
  const railY = GROUND_Y + frontH + 1.3;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 8), mats.rail);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, railY, frontZ-.05);
  if(!frontPlatform)g.add(rail);
  for (let x = -length / 2 + 1; x <= length / 2 - 1 + 1e-6; x += (length - 2) / Math.max(1, Math.round((length - 2) / 7))) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), mats.rail);
    post.position.set(x, railY - 0.65, frontZ-.05);
    if(!frontPlatform)g.add(post);else post.geometry.dispose();
  }
  // Back rail along the top row.
  const backRail = rail.clone();
  backRail.position.set(0, GROUND_Y + 2.6 + rise * (rows - 1) + 1.4, -0.6 - depth * rows + 0.3);
  g.add(backRail);
  return g;
}

/** Courtside LED ribbon: the name scrolling on a dark board, self-lit. */
function ledBoard() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 96;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 96);
  bg.addColorStop(0, '#0B1A33'); bg.addColorStop(1, '#122A52');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 96);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '800 54px "Helvetica Neue", Arial, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '10px';
  g.fillStyle = '#FFFFFF'; g.fillText('CAESAR GAMES', 300, 50);
  g.fillStyle = '#E2BE72'; g.fillText('HOOPS IQ', 790, 50);
  g.fillStyle = '#E2BE72'; g.fillRect(560, 40, 12, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(58 / 22, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xC8CCD4 });
  return { mat, update(dt) { tex.offset.x = (tex.offset.x + dt * 0.035) % 1; } };
}

/** A word painted flat on the apron, readable from the camera. */
function apronWord(text, x, z) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '800 150px "Helvetica Neue", Arial, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '18px';
  g.fillStyle = '#F4F2EC';
  g.fillText(text, 512, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 13 * 192 / 1024),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  return m;
}

/** Soft light shaft: an open cone, additive, fading at both ends and edges. */
function beam(from, to, radiusTop, radiusBottom, color, strength) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 28, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: `
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        vAlong = uv.y;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uStrength;
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
        float ends = smoothstep(0.0, 0.35, vAlong) * smoothstep(1.0, 0.8, vAlong);
        gl_FragColor = vec4(uColor * edge * ends * uStrength, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.renderOrder = 2;
  return m;
}

/** Cord net hanging from the rim: diamond lattice, sways and snaps on a swish. */
function net(center, rimY) {
  const strands = 12, rows = 6, top = 0.75, bottom = 0.42, depth = 1.55;
  const ring = (r, k) => {
    const pts = [];
    for (let i = 0; i < strands; i++) {
      const a = (i + (k % 2) * 0.5) / strands * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  };
  const rest = [];
  for (let k = 0; k <= rows; k++) {
    const f = k / rows;
    const r = top + (bottom - top) * Math.pow(f, 0.8);
    rest.push(ring(r, k).map(([x, z]) => [x, -depth * f, z]));
  }
  const segs = [];
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < strands; i++) {
      const a = rest[k][i];
      const b1 = rest[k + 1][i];
      const b2 = rest[k + 1][(i + (k % 2 ? 1 : strands - 1)) % strands];
      segs.push(a, b1, a, b2);
    }
  }
  const base = new Float32Array(segs.flat());
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
  const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xF4F1EA, transparent: true, opacity: 0.92 }));
  obj.position.set(center[0], rimY - 0.02, center[1]);
  let kick = 0, t = 0;
  return {
    obj,
    kick() { kick = 1; },
    update(dt) {
      t += dt;
      kick = Math.max(0, kick - dt * 1.4);
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const d = -base[i + 1] / depth;                  // 0 at the rim, 1 at the bottom
        const sway = Math.sin(t * 1.7 + base[i] * 2) * 0.03 + Math.sin(t * 9) * kick * 0.22;
        p[i] = base[i] + sway * d;
        p[i + 2] = base[i + 2] + Math.cos(t * 1.3 + base[i + 2] * 2) * 0.03 * d;
        p[i + 1] = base[i + 1] * (1 - kick * 0.35 * Math.sin(Math.min(1, (1 - kick) * 3) * Math.PI));
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

export function buildArena(scene, { hoop, rimY, populated = false, crowdHead = null, seatedAudience = null, refined = false, structure = false, casual = false, crowdAtlas = null, reactions = false }) {
  const mats = Object.fromEntries(Object.entries(MAT).map(([k, f]) => [k, f()]));
  const root = new THREE.Group();
  scene.add(root);

  // Floor of the room, the plinth and its gold inlay.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, 20);
  root.add(ground);
  const plinth = populated ? box(casual?66:58,.12,casual?124:114,mats.lacquer,0,-.08,47) : slab(-29, 29, -11, 53, 2.4, 1.2, mats.lacquer);
  plinth.position.y = populated ? -0.08 : -0.02;
  plinth.receiveShadow = true;
  root.add(plinth);
  if (!populated) root.add(frame(-28.2, 28.2, -10.2, 52.2, 0.1, -0.005, mats.gold));

  // Stands: behind the basket and along both sidelines; the camera side stays open.
  const seats = [];
  const led = ledBoard();
  const back = stand(populated ? 84 : 58, mats, seats, led.mat, populated ? [-24, 0, 24] : [0], populated ? 16 : 6, refined,casual);
  back.position.set(0, 0, -14);
  const left = stand(populated ? 124 : 58, mats, seats, led.mat, populated ? [-42,-14,14,42] : [-14,14], populated ? 14 : 6, refined,casual);
  left.rotation.y = Math.PI / 2;               // rows rise away from the court (-x)
  left.position.set(-33, 0, populated ? 47 : 23);
  const right = stand(populated ? 124 : 58, mats, seats, led.mat, populated ? [-42,-14,14,42] : [-14,14], populated ? 14 : 6, refined,casual);
  right.rotation.y = -Math.PI / 2;
  right.position.set(33, 0, populated ? 47 : 23);
  root.add(back, left, right);
  const architecture = populated && structure ? buildArchitecture(root,mats,led.mat) : null;
  if (populated) {
    // A second deck and lit concourse give the bowl a continuous silhouette.
    // Keep the camera-side upper deck open: it lies behind the broadcast lens.
    const upperBack = stand(136, mats, seats, led.mat, [-48,-24,0,24,48], 8, refined,false);
    upperBack.position.set(0, 25, -61);
    const upperRight = stand(146, mats, seats, led.mat, [-48,-24,0,24,48], 8, refined,false);
    upperRight.rotation.y = -Math.PI / 2;
    upperRight.position.set(76, 23, 47);
    root.add(upperBack, upperRight);
    if(structure){
      const upperLeft=stand(146,mats,seats,led.mat,[-48,-24,0,24,48],8,refined,false);
      upperLeft.rotation.y=Math.PI/2;upperLeft.position.set(-76,23,47);root.add(upperLeft);
    }
    for (const side of [-1,1]) {
      const corner = stand(29, mats, seats, led.mat, [0], 11, refined,casual);
      corner.rotation.y = -side * Math.PI / 4;
      corner.position.set(side * 41, 0, -12);
      root.add(corner);
    }
    const glass = new THREE.MeshStandardMaterial({color:0x786C53,emissive:0x493D28,emissiveIntensity:.45,roughness:.3});
    const glow = new THREE.MeshBasicMaterial({color:0xCAB78E,toneMapped:false});
    root.add(box(138,5,.8,mats.backing,0,23,-62));
    for (let x=-62;x<=62;x+=8) {
      root.add(box(6.7,3.2,.15,glass,x,23,-61.4));
      root.add(box(6.7,.09,.3,glow,x,24.5,-61.1));
      root.add(box(.15,4,.3,mats.rail,x-3.4,23,-61.1));
    }
    root.add(box(138,.35,2,mats.rail,0,20.5,-61));
    root.add(box(138,.25,2,mats.rail,0,25.5,-61));
  }
  if(crowdAtlas)seats.forEach(seat=>{if(!(refined&&seat[0].position.y<1&&seat[2]<2))seat[2]+=.95;});
  const seatMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.42, .18, 1.3), mats.seat, seats.length);
  const seatBack = new THREE.InstancedMesh(new THREE.BoxGeometry(1.42,.95,.2), mats.seat, seats.length);
  seatMesh.name='AudienceSeats'; seatBack.name='AudienceSeatBacks';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  seats.forEach(([g, x, y, z], i) => {
    v.set(x, y, z).applyMatrix4(g.matrixWorld);
    g.getWorldQuaternion(q);
    seatMesh.setMatrixAt(i, m4.compose(v, q, s));
    v.set(x,y+.4,z-.54).applyMatrix4(g.matrixWorld);
    seatBack.setMatrixAt(i,m4.compose(v,q,s));
  });
  root.add(seatMesh,seatBack);
  if(refined){
    const fabric=new THREE.MeshStandardMaterial({color:0x242B34,roughness:.95});
    // Padded end walls and numbered entrances break the uninterrupted row grid.
    for(const x of [-24,0,24]){
      const portal=box(3.4,5,.7,mats.backing,x,23,-57);root.add(portal);
      const c=document.createElement('canvas');c.width=128;c.height=64;
      const g=c.getContext('2d');g.fillStyle='#14171B';g.fillRect(0,0,128,64);
      g.fillStyle='#CCC9C0';g.font='600 40px Arial';g.textAlign='center';g.fillText(String(110+x/24),64,47);
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),new THREE.MeshBasicMaterial({map:tex}));sign.position.set(x,26.4,-56.6);root.add(sign);
    }
    root.add(box(84,.4,.35,fabric,0,1.3,-14.1));
  }

  // Distant spectators: code-native silhouettes, one instanced draw per part.
  // A stable layout avoids random crowd changes on every scene load.
  let spectators = null;
  const courtside = refined ? buildCourtside(root,seats,seatedAudience,{casual,reactions}) : null;
  let crowdArms = null, armRows = [], cheerTime = 10;
  const impostors=populated&&crowdAtlas?buildCrowdImpostors(root,seats,crowdAtlas,{seatedAudience}):null;
  if (populated && !impostors) {
    const people = seats.filter(([g,x,y], i) => i % 13 !== 0 && (g.position.y < 1 || i % 3 === 0) && !(refined && seatedAudience && g.position.y<1 && y<2 && i%17!==0));
    // Interleave across every stand so the low tier doesn't empty one end.
    people.sort((a, b) => Math.sin(a[1] * 91 + a[2] * 43 + a[3] * 17) - Math.sin(b[1] * 91 + b[2] * 43 + b[3] * 17));
    const torso = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.32, 0.75, 2, 5),
      new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.15 }), people.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 6, 4),
      new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.15 }), people.length);
    heads.name='AudienceDistantHeads';
    const detailed = people.map((seat,i)=>({seat,i})).filter(({seat})=>seat[0].position.y<1&&seat[2]<(refined?4:2));
    const nearIds = new Set(detailed.map(({i})=>i));
    let faceGeometry = crowdHead?.clone();
    if(faceGeometry) { faceGeometry.translate(0,-.369,0);faceGeometry.scale(.68,.68,.68); }
    const faces = faceGeometry ? new THREE.InstancedMesh(faceGeometry,heads.material,detailed.length) : null;
    if(faces)faces.name='AudienceFrontFaces';
    const fallback = faces ? new THREE.InstancedMesh(heads.geometry,heads.material,detailed.length) : null;
    if(fallback)fallback.name='AudienceFrontFallback';
    // Two bent legs in a single instanced draw; the old crowd had no seated pose.
    const legMat=new THREE.MeshStandardMaterial({roughness:1,envMapIntensity:.1});
    const legParts=[];
    for(const side of [-1,1]) {
      legParts.push(new THREE.BoxGeometry(.23,.24,.65).translate(side*.21,-.44,.37));
      legParts.push(new THREE.BoxGeometry(.23,.64,.23).translate(side*.21,-.84,.6));
      legParts.push(new THREE.BoxGeometry(.27,.17,.43).translate(side*.21,-1.21,.74));
    }
    const legGeometry=mergeGeometries(legParts);legParts.forEach(g=>g.dispose());
    const seated=people.map((seat,i)=>({seat,i})).filter(({seat})=>seat[0].position.y<1&&seat[2]<8);
    const seatedIds=new Set(seated.map(({i})=>i));
    const legs=new THREE.InstancedMesh(legGeometry,legMat,seated.length);legs.name='AudienceSeatedLegs';
    const hair = new THREE.InstancedMesh(new THREE.SphereGeometry(.26,6,3,0,Math.PI*2,0,Math.PI*.55),
      new THREE.MeshStandardMaterial({roughness:1,envMapIntensity:.1}),people.length);
    crowdArms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .11, 1, 5),
      new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: .15 }), people.length * 2);
    const shirts = [0x254574, 0x7E8A98, 0xC4BDAE, 0x8D3C35, 0x1B2330, 0x496474];
    const skins = [0xBD8A66, 0x815438, 0xD4A581, 0x5B3828];
    const col = new THREE.Color();
    let near=0, legIndex=0;
    people.forEach(([g, x, y, z], i) => {
      const jitter = Math.sin(i * 9.7) * (refined?.22:.14);
      const bodyScale = refined ? .88 + (Math.sin(i*73.31)*.5+.5)*.23 : 1;
      s.set(refined?bodyScale*(.9+(Math.sin(i*13.7)*.5+.5)*.25):1,bodyScale,bodyScale);
      v.set(x + jitter, y + .7, z + 0.2).applyMatrix4(g.matrixWorld);
      g.getWorldQuaternion(q);
      torso.setMatrixAt(i, m4.compose(v, q, s));
      const colourIndex=refined?Math.floor((Math.sin(i*127.1+31.7)*.5+.5)*shirts.length):i%shirts.length;
      torso.setColorAt(i, col.setHex(shirts[colourIndex]));
      if(seatedIds.has(i)) {
        legs.setMatrixAt(legIndex,m4.compose(v,q,s));
        legs.setColorAt(legIndex,col.setHex([0x262A30,0x344459,0x414449,0x282429][i%4]));legIndex++;
      }
      v.y += .88 * bodyScale;
      heads.setMatrixAt(i, m4.compose(v, q, nearIds.has(i)&&faces ? new THREE.Vector3(0,0,0) : s));
      heads.setColorAt(i, col.setHex(skins[refined?Math.floor((Math.sin(i*37.3)*.5+.5)*skins.length):i%skins.length]));
      if(faces&&nearIds.has(i)) {
        const faceQ=q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.sin(i*4.1)*.16));
        faces.setMatrixAt(near,m4.compose(v,faceQ,s));faces.setColorAt(near,col.setHex(skins[i%skins.length]));
        fallback.setMatrixAt(near,m4.compose(v,q,s));fallback.setColorAt(near,col);near++;
      }
      hair.setMatrixAt(i, m4.compose(v,q,s));
      hair.setColorAt(i,col.setHex([0x181616,0x473123,0x78685A,0x272220][i%4]));
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Vector3(x + side *  .32, y + .85, z + .2).applyMatrix4(g.matrixWorld);
        const down = new THREE.Vector3(x + side * .48, y + .38, z + .54).applyMatrix4(g.matrixWorld);
        const up = new THREE.Vector3(x + side * .68, y + 1.55, z + .2).applyMatrix4(g.matrixWorld);
        const index = i * 2 + (side === 1 ? 1 : 0);
        armRows.push({ index, shoulder, down, up, fan: i % 9 === 0 });
        const centre = shoulder.clone().lerp(down, .5), direction = down.clone().sub(shoulder);
        const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.clone().normalize());
        crowdArms.setMatrixAt(index, m4.compose(centre, rotation, new THREE.Vector3(1,direction.length(),1)));
        crowdArms.setColorAt(index, col.setHex(skins[i % skins.length]));
      }
    });
    spectators = new THREE.Group(); spectators.add(torso, heads, hair, crowdArms,legs);
    if(faces){spectators.add(faces,fallback);fallback.visible=false;}
    root.add(spectators);
  }
  s.set(1,1,1);

  // The name on the apron behind the baseline, either side of the basket.
  for (const [text, x] of [['CAESAR', -13.5], ['GAMES', 13.5]]) root.add(apronWord(text, x, -3.2));

  // Walls with pilasters, far enough to sit in the haze.
  const wallH = 70;
  const backWall = box(populated ? 220 : 150, wallH, 1, mats.wall, 0, GROUND_Y + wallH / 2, populated ? -80 : -36);
  root.add(backWall);
  for (const sx of [-1, 1]) root.add(box(1, wallH, 140, mats.wall, sx * (populated ? 90 : 55), GROUND_Y + wallH / 2, 34));
  for (let x = -60; x <= 60; x += 15) root.add(box(3.4, wallH, 2.6, mats.pilaster, x, GROUND_Y + wallH / 2, populated ? -79 : -34.6));
  for (const sx of [-1, 1]) for (let z = -20; z <= 80; z += 15) root.add(box(2.6, wallH, 3.4, mats.pilaster, sx * (populated ? 89 : 53.6), GROUND_Y + wallH / 2, z));

  // Light shafts from high behind the basket, fading out above the court so
  // they never haze the players.
  const beams = new THREE.Group();
  [[-16, -11, 0.9], [-5, -3, 1.0], [6, 4, 1.0], [17, 12, 0.9]].forEach(([x0, x1, k]) => {
    beams.add(beam(new THREE.Vector3(x0, 78, -30), new THREE.Vector3(x1, 6, 12), 1.4, 7.5, 0xE4ECF6, 0.17 * k));
  });
  root.add(beams);
  if (populated) {
    // Visible roof structure and banks of arena lamps replace museum shafts.
    beams.visible = false;
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xDBE8FF });
    for (const z of [-32]) {
      root.add(box(154, 0.7, 0.7, mats.rail, 0, 62, z));
      for (let x = -56; x <= 56; x += 14) root.add(box(4, 0.2, 1.2, lampMat, x, 61.3, z));
    }
  }

  // Swap the stand-in net for the cord net.
  hoop?.traverse(o => { if (o.name === 'Net') o.visible = false; });
  const cords = net(hoop?.userData.rim || [0, 5.25], rimY);
  if(refined)cords.obj.layers.enable(1);
  root.add(cords.obj);

  if (populated) {
    // Batch static arena structures by material. Seats/crowd, LED and net retain
    // their own dynamic buffers; hundreds of separate rails need no draw each.
    root.updateMatrixWorld(true);
    const groups = new Map();
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o === cords.obj || o.material === led.mat || o.parent === beams || Array.isArray(o.material)) return;
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(o);
    });
    for (const [material, objects] of groups) {
      if (objects.length < 2) continue;
      const geometries = objects.map(o => o.geometry.clone().applyMatrix4(o.matrixWorld));
      const merged = mergeGeometries(geometries);
      geometries.forEach(g => g.dispose());
      if (!merged) continue;
      objects.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
      const batch=new THREE.Mesh(merged,material);batch.receiveShadow=objects.some(o=>o.receiveShadow);root.add(batch);
    }
  }

  return {
    root,
    dispose:()=>{courtside?.dispose();impostors?.dispose();},
    setScore: data=>architecture?.setScore(data),
    swish: () => { cords.kick(); cheerTime = 0; courtside?.cheer(); },
    resetReactions:()=>courtside?.reset(),
    update(dt) {
      cords.update(dt); led.update(dt);
      courtside?.update();
      if (crowdArms && cheerTime < 3.5) {
        cheerTime += dt;
        const weight = Math.max(0, Math.min(1, cheerTime / .3, (3.5 - cheerTime) / .8));
        for (const row of armRows) {
          if (!row.fan) continue;
          const hand = row.down.clone().lerp(row.up, weight), direction = hand.clone().sub(row.shoulder);
          const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.clone().normalize());
          crowdArms.setMatrixAt(row.index, new THREE.Matrix4().compose(row.shoulder.clone().lerp(hand,.5), rotation, new THREE.Vector3(1,direction.length(),1)));
        }
        crowdArms.instanceMatrix.needsUpdate = true;
      }
    },
    setQuality(q) {
      courtside?.setQuality(q);
      impostors?.setQuality(q);
      beams.visible = !populated && q !== 'low';
      if (spectators) spectators.children.forEach(m => {
        m.count = q === 'low' ? Math.ceil(m.instanceMatrix.count / 2) : m.instanceMatrix.count;
        if(m.name==='AudienceFrontFaces')m.visible=q!=='low';
        if(m.name==='AudienceFrontFallback')m.visible=q==='low';
      });
    }
  };
}
