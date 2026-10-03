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

const GROUND_Y = -2.4;

const MAT = {
  lacquer: () => new THREE.MeshStandardMaterial({ color: 0x14284A, roughness: 0.4, envMapIntensity: 0.3 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xC9A76A, roughness: 0.3, metalness: 1 }),
  ground: () => new THREE.MeshStandardMaterial({ color: 0x0D1015, roughness: 0.92 }),
  tread: () => new THREE.MeshStandardMaterial({ color: 0x41464E, roughness: 0.9 }),
  riser: () => new THREE.MeshStandardMaterial({ color: 0x23272E, roughness: 0.92 }),
  seat: () => new THREE.MeshStandardMaterial({ color: 0x1D3A68, roughness: 0.6 }),
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
function stand(length, mats, seats, led, aisles = []) {
  const g = new THREE.Group();
  const rows = 6, depth = 2.7, rise = 1.45, aw = 3.6;
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
    g.add(box(length, 0.22, depth - 0.25, mats.tread, 0, top - 0.11, z + 0.12));
    for (const [a, b] of runs) {
      const n = Math.floor((b - a) / 1.9);
      for (let i = 0; i < n; i++) seats.push([g, a + (b - a) * (i + 0.5) / n, top + 0.55, z - depth / 2 + 0.95]);
    }
    for (const x of aisles) g.add(box(aw - 0.3, 0.06, depth - 0.4, mats.step, x, top + 0.03, z + 0.1));
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
  const frontH = 3.4;
  g.add(box(length, frontH, 0.3, mats.backing, 0, GROUND_Y + frontH / 2, -0.35));
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(length, 1.7), led);
  ribbon.position.set(0, GROUND_Y + frontH - 0.95, -0.19);
  g.add(ribbon);
  const railY = GROUND_Y + frontH + 1.3;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 8), mats.rail);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, railY, -0.4);
  g.add(rail);
  for (let x = -length / 2 + 1; x <= length / 2 - 1 + 1e-6; x += (length - 2) / Math.max(1, Math.round((length - 2) / 7))) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), mats.rail);
    post.position.set(x, railY - 0.65, -0.4);
    g.add(post);
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

export function buildArena(scene, { hoop, rimY }) {
  const mats = Object.fromEntries(Object.entries(MAT).map(([k, f]) => [k, f()]));
  const root = new THREE.Group();
  scene.add(root);

  // Floor of the room, the plinth and its gold inlay.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, 20);
  root.add(ground);
  const plinth = slab(-29, 29, -11, 53, 2.4, 1.2, mats.lacquer);
  plinth.position.y = -0.02;
  plinth.receiveShadow = true;
  root.add(plinth);
  root.add(frame(-28.2, 28.2, -10.2, 52.2, 0.1, -0.005, mats.gold));

  // Stands: behind the basket and along both sidelines; the camera side stays open.
  const seats = [];
  const led = ledBoard();
  const back = stand(58, mats, seats, led.mat, [0]);
  back.position.set(0, 0, -14);
  const left = stand(58, mats, seats, led.mat, [-14, 14]);
  left.rotation.y = Math.PI / 2;               // rows rise away from the court (-x)
  left.position.set(-33, 0, 23);
  const right = stand(58, mats, seats, led.mat, [-14, 14]);
  right.rotation.y = -Math.PI / 2;
  right.position.set(33, 0, 23);
  root.add(back, left, right);
  const seatMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.1, 1.3), mats.seat, seats.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  seats.forEach(([g, x, y, z], i) => {
    v.set(x, y, z).applyMatrix4(g.matrixWorld);
    g.getWorldQuaternion(q);
    seatMesh.setMatrixAt(i, m4.compose(v, q, s));
  });
  root.add(seatMesh);

  // The name on the apron behind the baseline, either side of the basket.
  for (const [text, x] of [['CAESAR', -13.5], ['GAMES', 13.5]]) root.add(apronWord(text, x, -3.2));

  // Walls with pilasters, far enough to sit in the haze.
  const wallH = 70;
  const backWall = box(150, wallH, 1, mats.wall, 0, GROUND_Y + wallH / 2, -36);
  root.add(backWall);
  for (const sx of [-1, 1]) root.add(box(1, wallH, 140, mats.wall, sx * 55, GROUND_Y + wallH / 2, 34));
  for (let x = -60; x <= 60; x += 15) root.add(box(3.4, wallH, 2.6, mats.pilaster, x, GROUND_Y + wallH / 2, -34.6));
  for (const sx of [-1, 1]) for (let z = -20; z <= 80; z += 15) root.add(box(2.6, wallH, 3.4, mats.pilaster, sx * 53.6, GROUND_Y + wallH / 2, z));

  // Light shafts from high behind the basket, fading out above the court so
  // they never haze the players.
  const beams = new THREE.Group();
  [[-16, -11, 0.9], [-5, -3, 1.0], [6, 4, 1.0], [17, 12, 0.9]].forEach(([x0, x1, k]) => {
    beams.add(beam(new THREE.Vector3(x0, 78, -30), new THREE.Vector3(x1, 6, 12), 1.4, 7.5, 0xE4ECF6, 0.17 * k));
  });
  root.add(beams);

  // Swap the stand-in net for the cord net.
  hoop?.traverse(o => { if (o.name === 'Net') o.visible = false; });
  const cords = net(hoop?.userData.rim || [0, 5.25], rimY);
  root.add(cords.obj);

  return {
    root,
    swish: () => cords.kick(),
    update(dt) { cords.update(dt); led.update(dt); },
    setQuality(q) { beams.visible = q !== 'low'; }
  };
}
