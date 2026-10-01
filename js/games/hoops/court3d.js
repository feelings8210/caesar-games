/* Caesar Games — Hoops IQ 3D court
 *
 * The same beat runner as the SVG court, drawn as a tabletop diorama with
 * three.js: satin-metal figurines on enamel bases, broadcast-style tracking
 * rings, and a small camera director (broadcast → freeze push-in → decide).
 *
 * World space is court feet: x = court x, z = court y (baseline z = 0),
 * y up. Text (numbers, labels, calls) lives in an HTML layer on top so it
 * stays sharp and follows the app language.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/addons/GLTFLoader.js';
import { RoomEnvironment } from '../../vendor/three/addons/RoomEnvironment.js';
import { BeatRunner, HOOP, dist, lerp } from './runner.js';

const ASSETS = new URL('../../../assets/hoops/', import.meta.url).href;
const RIM_Y = 10;
const HAND_Y = 2.45;
const BALL_R = 0.45;

const TEAM = {
  o: { jersey: 0x21457F, shorts: 0x15294A, base: 0x1B3358, body: 0xC9CDD3, ring: 0x7FB2FF },
  d: { jersey: 0x8E4238, shorts: 0x5A2620, base: 0x7A332B, body: 0x4B4E54, ring: 0xFF7F70 },
  you: { body: 0xD9B46A, ring: 0xF2C66D }
};
const GOLD = 0xE2BE72;

const damp = (cur, goal, k, dt) => cur + (goal - cur) * (1 - Math.exp(-k * dt));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export class Court3D extends BeatRunner {
  constructor(mount, { text }) {
    super();
    this.text = text;
    this.players = {};
    this.fx = [];
    this.labels = {};
    this.targets = [];
    this.frozen = false;
    this.active = false;

    this.el = document.createElement('div');
    this.el.className = 'hc3d';
    mount.appendChild(this.el);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'hc3d-canvas';
    this.el.appendChild(this.canvas);

    this.overlay = document.createElement('div');
    this.overlay.className = 'hc3d-labels';
    this.el.appendChild(this.overlay);
    const vignette = document.createElement('div');
    vignette.className = 'hc3d-vignette';
    this.el.appendChild(vignette);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0B1526);
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
    this.cam = { pos: new THREE.Vector3(0, 34, 72), target: new THREE.Vector3(0, 1.5, 17) };
    this.goal = { pos: this.cam.pos.clone(), target: this.cam.target.clone(), k: 2.6 };
    this.shot = 'broadcast';

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this._lights();
    this._plinth();
    this.ready = this._load();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.el);
    this._last = performance.now();
  }

  /* ---------------------------------------------------------------- *
   * Setup
   * ---------------------------------------------------------------- */

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xDFE8FF, 0x3A2A1A, 0.45));
    const key = new THREE.DirectionalLight(0xFFE9CC, 2.3);
    key.position.set(-12, 46, 8);
    key.target.position.set(0, 0, 21);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 5, far: 110 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    this.scene.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0xBFD3FF, 0.7);
    rim.position.set(10, 18, -30);
    this.scene.add(rim);
  }

  _plinth() {
    const lacquer = new THREE.MeshStandardMaterial({ color: 0x0F1B30, roughness: 0.55, metalness: 0 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(56, 1.6, 61), lacquer);
    plinth.position.set(0, -0.82, 20.3);
    plinth.receiveShadow = true;
    this.scene.add(plinth);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(52.4, 0.04, 51.8),
      new THREE.MeshStandardMaterial({ color: 0xA8823F, roughness: 0.35, metalness: 1 }));
    inlay.position.set(0, -0.03, 24.9);
    this.scene.add(inlay);
  }

  async _load() {
    const loader = new GLTFLoader();
    const [figs, hoop, lines] = await Promise.all([
      loader.loadAsync(ASSETS + 'figurines.glb'),
      loader.loadAsync(ASSETS + 'hoop.glb'),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = ASSETS + 'court_lines.png'; })
    ]);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({
      map: this._floorTexture(lines), roughness: 0.4, metalness: 0
    }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, 25);
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    hoop.scene.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material?.name === 'Glass') {
        o.material.transparent = true;
        o.material.opacity = 0.28;
        o.material.depthWrite = false;
        o.castShadow = false;
      }
    });
    this.scene.add(hoop.scene);

    this.figureParts = {};
    for (const name of ['Figurine_Offense', 'Figurine_Defense']) {
      const node = figs.scene.getObjectByName(name);
      const parts = [];
      node.traverse(o => { if (o.isMesh) parts.push({ geometry: o.geometry, slot: o.material.name }); });
      this.figureParts[name] = parts;
    }
    this.materials = {};
    this.ballMesh = this._makeBall();
    this.scene.add(this.ballMesh);
    this.loaded = true;
    if (this._pending) { const [s, y] = this._pending; this._pending = null; this.setScene(s, y); }
  }

  _floorTexture(lines) {
    const S = 2048;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const px = S / 50;
    // Maple planks along the length of the court, staggered joints.
    const plank = 0.42 * px;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < S; x += plank) {
      let y = -rnd() * 8 * px;
      while (y < S) {
        const len = (5 + rnd() * 7) * px;
        const t = rnd();
        const r = 214 + t * 16, gg = 180 + t * 18, b = 128 + t * 18;
        g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        g.fillRect(x, y, plank + 1, len);
        g.fillStyle = 'rgba(110,74,34,.10)';
        g.fillRect(x, y, plank, 1.2);
        for (let k = 0; k < 3; k++) {
          g.fillStyle = `rgba(120,80,40,${0.03 + rnd() * 0.04})`;
          g.fillRect(x + rnd() * plank, y, 1, len);
        }
        y += len;
      }
      g.fillStyle = 'rgba(110,74,34,.12)';
      g.fillRect(x, 0, 1, S);
    }
    g.drawImage(lines, 0, 0, S, S);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  _makeBall() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#C8662E';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#3A1C0C';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
    [64, 192].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); });
    [[32, 1], [224, -1]].forEach(([x, s]) => {
      g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + s * 30, 64, x, 128); g.stroke();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 18),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 }));
    m.castShadow = true;
    return m;
  }

  _material(slot, side, you) {
    const key = `${slot}:${side}:${you ? 1 : 0}`;
    if (this.materials[key]) return this.materials[key];
    const t = TEAM[side];
    let m;
    switch (slot) {
      case 'Jersey': m = new THREE.MeshStandardMaterial({ color: t.jersey, roughness: 0.22 }); break;
      case 'Shorts': m = new THREE.MeshStandardMaterial({ color: t.shorts, roughness: 0.26 }); break;
      case 'Skin': m = new THREE.MeshStandardMaterial({ color: you ? TEAM.you.body : t.body, metalness: 1, roughness: you ? 0.3 : 0.38 }); break;
      case 'Base': m = new THREE.MeshStandardMaterial({ color: t.base, roughness: 0.25, metalness: 0.05 }); break;
      case 'Trim': m = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3 }); break;
      default: m = new THREE.MeshStandardMaterial({ color: 0xF4F3EF, roughness: 0.45 });
    }
    this.materials[key] = m;
    return m;
  }

  _numberTexture(n) {
    this._numTex = this._numTex || {};
    if (this._numTex[n]) return this._numTex[n];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '800 104px -apple-system, "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(14,31,58,.55)';
    g.strokeText(String(n), 64, 70);
    g.fillStyle = '#F4F1E8';
    g.fillText(String(n), 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return (this._numTex[n] = tex);
  }

  _ring(inner, outer, color, opacity = 0.9, segments = 64) {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  /* ---------------------------------------------------------------- *
   * Scene
   * ---------------------------------------------------------------- */

  setScene(setup, you) {
    this.cancel();
    this.resetState(setup);
    this.you = you;
    if (!this.loaded) { this._pending = [setup, you]; return; }
    for (const p of Object.values(this.players)) this.scene.remove(p.root, p.ring);
    this.players = {};
    this.overlay.textContent = '';
    this.labels = {};
    this._clearFx();
    this.clearMarkers();
    this.clearCue();

    for (const id of Object.keys(this.pos)) {
      const side = id[0];
      const isYou = id === you;
      const root = new THREE.Group();
      const body = new THREE.Group();
      root.add(body);
      for (const { geometry, slot } of this.figureParts[side === 'o' ? 'Figurine_Offense' : 'Figurine_Defense']) {
        const mesh = new THREE.Mesh(geometry, this._material(slot, side, isYou));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        body.add(mesh);
      }
      const n = Number(id.slice(1));
      const chest = side === 'o' ? 3.3 : 3.1;
      const decalMat = new THREE.MeshStandardMaterial({ map: this._numberTexture(n), alphaTest: 0.5, roughness: 0.35 });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), decalMat);
      front.position.set(0, chest, 0.52);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), decalMat);
      back.position.set(0, chest + 0.05, -0.47);
      back.rotation.y = Math.PI;
      body.add(front, back);

      const ring = new THREE.Group();
      const glow = this._ring(1.72, 1.95, isYou ? TEAM.you.ring : TEAM[side].ring, 0.85);
      glow.position.y = 0.035;
      ring.add(glow);
      if (isYou) {
        this.timerRing = this._ring(2.2, 2.45, 0xF4F6F9, 0.95, 72);
        this.timerRing.position.y = 0.04;
        this.timerRing.rotation.z = Math.PI / 2;
        this.timerRing.visible = false;
        ring.add(this.timerRing);
      }
      this.scene.add(root, ring);
      const [x, z] = this.pos[id];
      root.position.set(x, 0, z);
      ring.position.set(x, 0, z);
      const p = { id, side, root, body, ring, yaw: side === 'o' ? Math.PI : 0, prev: [x, z], speed: 0, phase: Math.random() * 6 };
      this.players[id] = p;

      const chip = document.createElement('span');
      chip.className = `hc3-chip is-${side}${isYou ? ' is-you' : ''}`;
      chip.textContent = n;
      this.overlay.appendChild(chip);
      this.labels[id] = chip;
      if (isYou) {
        this.youTag = document.createElement('span');
        this.youTag.className = 'hc3-you';
        this.overlay.appendChild(this.youTag);
      }
    }
    for (const p of Object.values(this.players)) p.yaw = this._idleYaw(p);
    this.setShot('broadcast', true);
    this._renderBall(0);
    this.wake();
  }

  setYouLabel(s) { if (this.youTag) this.youTag.textContent = s; }

  restore(snap) {
    this._clearFx();
    this.restoreState(snap);
    for (const p of Object.values(this.players)) { p.prev = [...this.pos[p.id]]; p.speed = 0; }
  }

  _place(id) {
    const p = this.players[id];
    if (!p) return;
    const [x, z] = this.pos[id];
    p.root.position.x = x; p.root.position.z = z;
    p.ring.position.x = x; p.ring.position.z = z;
  }

  _renderBall(bounce) {
    if (!this.ballMesh) return;
    const b = this.ball;
    const f = b.flight;
    let at = b.at;
    let y;
    if (b.holder && this.pos[b.holder] && !f) {
      at = this._hand(b.holder);
      b.at = at;
      y = HAND_Y - bounce * (HAND_Y - BALL_R);
    } else if (f) {
      if (f.fromY === undefined) f.fromY = this._ballY ?? HAND_Y;
      const e = f.e ?? 0;
      if (f.kind === 'shot') {
        if (f.blocked) {
          if (f.pivotY === undefined) f.pivotY = this._ballY;
          y = lerp(f.pivotY, BALL_R, f.k) + Math.sin(f.k * Math.PI) * 2.2;
        } else {
          y = lerp(f.fromY, RIM_Y + 0.3, e) + Math.sin(e * Math.PI) * 6.5;
        }
      } else if (f.kind === 'pass') {
        y = lerp(f.fromY, HAND_Y, e) + Math.sin(e * Math.PI) * (f.lob ? 5 : 1.1);
      } else {
        y = lerp(f.fromY, HAND_Y, e) + Math.sin(e * Math.PI) * 3.2;
      }
    } else if (b.rest === 'rim') {
      y = RIM_Y + 0.6;
    } else {
      y = BALL_R;
    }
    this._ballY = y;
    this.ballMesh.position.set(at[0], y, at[1]);
  }

  _spin() { if (this.ballMesh) this.ballMesh.rotation.x += 0.35; }

  /* ---------------------------------------------------------------- *
   * Effects
   * ---------------------------------------------------------------- */

  _addFx(obj, dur, update) {
    this.scene.add(obj);
    this.fx.push({ obj, t0: performance.now(), dur, update });
  }

  _clearFx() {
    for (const f of this.fx) { this.scene.remove(f.obj); f.obj.geometry?.dispose(); }
    this.fx = [];
  }

  _trail(id, pts) {
    if (pts.length < 2 || dist(pts[0], pts[pts.length - 1]) < 2.5) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0.05, z)));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: id[0] === 'o' ? TEAM.o.ring : TEAM.d.ring, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false
    }));
    this._addFx(line, 1800, k => { line.material.opacity = 0.7 * (1 - k); });
  }

  _passLine(from, target) {
    const to = this.pos[target];
    if (!to) return;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], HAND_Y, from[1]), new THREE.Vector3(to[0], HAND_Y, to[1])
    ]);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: 0xFFFFFF, dashSize: 0.6, gapSize: 0.45, transparent: true, opacity: 0.8, toneMapped: false
    }));
    line.computeLineDistances();
    this._addFx(line, 1300, k => { line.material.opacity = 0.8 * (1 - k); });
  }

  _pulse(id) {
    const at = this.pos[id];
    if (!at) return;
    const r = this._ring(1.6, 1.85, 0xFFFFFF, 0.9);
    r.position.set(at[0], 0.06, at[1]);
    this._addFx(r, 650, k => { r.scale.setScalar(1 + k * 1.2); r.material.opacity = 0.9 * (1 - k); });
  }

  _burst(at) {
    const y = at === HOOP ? RIM_Y : (this._ballY ?? 3);
    this._sparks([at[0], y, at[1]], 0xF1D3A8, 18, 7);
  }

  _swish() {
    const r = this._ring(0.8, 1.0, 0xFFFFFF, 0.95);
    r.position.set(HOOP[0], RIM_Y - 0.1, HOOP[1]);
    this._addFx(r, 900, k => { r.scale.setScalar(1 + k * 3); r.material.opacity = 0.95 * (1 - k); });
    this._sparks([HOOP[0], RIM_Y, HOOP[1]], 0xF2C66D, 42, 11);
  }

  _sparks([x, y, z], color, n, speed) {
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      pos.set([x, y, z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      vel.push([Math.cos(a) * speed * (0.3 + Math.random() * 0.7), up * speed, Math.sin(a) * speed * (0.3 + Math.random() * 0.7)]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size: 0.32, transparent: true, opacity: 1, depthWrite: false, toneMapped: false
    }));
    let lastK = 0;
    this._addFx(pts, 900, k => {
      const dt = (k - lastK) * 0.9;
      lastK = k;
      const a = geo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        vel[i][1] -= 22 * dt;
        a[i * 3] += vel[i][0] * dt; a[i * 3 + 1] += vel[i][1] * dt; a[i * 3 + 2] += vel[i][2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      pts.material.opacity = 1 - k;
    });
  }

  call(id, label) {
    const at = this.pos[id];
    if (!at) return;
    const el = document.createElement('span');
    el.className = 'hc3-call';
    el.textContent = this.text(label);
    this.overlay.appendChild(el);
    const call = { el, id, t0: performance.now() };
    this._calls = this._calls || [];
    this._calls.push(call);
    setTimeout(() => { el.remove(); this._calls = this._calls.filter(c => c !== call); }, 1500);
  }

  /* ---------------------------------------------------------------- *
   * Camera director
   * ---------------------------------------------------------------- */

  /** Camera distance that fits a half-width (feet) across the view. */
  _fit(halfWidth) {
    const aspect = this._aspect || 1.2;
    const hTan = Math.tan(THREE.MathUtils.degToRad((this.baseFov || 38) / 2)) * aspect;
    return halfWidth / hTan;
  }

  _orbit(target, elevationDeg, distance) {
    const a = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(target.x, target.y + Math.sin(a) * distance, target.z + Math.cos(a) * distance);
  }

  /** Where "you" would be looking: the rim with the ball, else the ball. */
  _povLook() {
    const holder = this.ball.holder;
    if (holder === this.you) return new THREE.Vector3(HOOP[0], 7.5, HOOP[1]);
    if (holder && this.pos[holder]) return new THREE.Vector3(this.pos[holder][0], 3.4, this.pos[holder][1]);
    return this.ballMesh ? this.ballMesh.position.clone() : new THREE.Vector3(0, 3, 20);
  }

  setShot(name, snap = false, user = false) {
    if (user) this._userShot = true;
    this.shot = name;
    const g = this.goal;
    if (name === 'broadcast') {
      g.target.set(0, 1.5, 17);
      g.pos.copy(this._orbit(g.target, 31, this._fit(24.5)));
      g.k = 2.2;
    } else if (name === 'decide') {
      g.target.set(0, 0, 20);
      // Sidelines near the camera spread wider than the middle; fit with margin.
      g.pos.copy(this._orbit(g.target, 52, this._fit(31)));
      g.k = 2.4;
    } else if (name === 'push') {
      // Look at "you" from the middle of the floor so the read sits centre frame.
      const at = this.pos[this.you] || [0, 20];
      const side = at[0] >= 0 ? 1 : -1;
      g.target.set(at[0], 2.6, at[1]);
      g.pos.set(at[0] - side * 6, 10, at[1] + 16);
      g.k = 3.6;
    } else if (name === 'pov') {
      // Eye height, a step behind "you", looking where the player would look.
      const at = this.pos[this.you] || [0, 20];
      const look = this._povLook();
      const dir = new THREE.Vector2(look.x - at[0], look.z - at[1]);
      if (dir.lengthSq() < 1e-4) dir.set(0, -1);
      dir.normalize();
      g.pos.set(at[0] - dir.x * 1.6, 5.7, at[1] - dir.y * 1.6);
      g.target.copy(look);
      g.k = 4.2;
    }
    this.fovGoal = name === 'pov' ? 66 : (this.baseFov || 38);
    const me = this.players[this.you];
    if (me) me.root.visible = name !== 'pov';
    if (snap) { this.cam.pos.copy(g.pos); this.cam.target.copy(g.target); }
  }

  setFrozen(on) {
    const was = this.frozen;
    this.frozen = !!on;
    this.el.classList.toggle('is-frozen', this.frozen);
    clearTimeout(this._shotTimer);
    if (this.frozen && !was) {
      // Drop to the player's eyes, hold the read, then rise to see the floor.
      this._userShot = false;
      this.setShot('pov');
      this._shotTimer = setTimeout(() => { if (this.frozen && !this._userShot) this.setShot('decide'); }, 1500);
    } else if (!this.frozen && was) {
      this.setShot('broadcast');
    }
  }

  setTimer(fraction) {
    if (!this.timerRing) return;
    this.timerRing.visible = fraction !== null;
    if (fraction === null) return;
    const g = this.timerRing.geometry;
    const total = g.index.count;
    g.setDrawRange(0, Math.max(6, Math.floor((total * fraction) / 6) * 6));
    this.timerRing.material.color.setHex(fraction < 0.34 ? 0xE8A27C : 0xF4F6F9);
  }

  /* ---------------------------------------------------------------- *
   * Decision layer
   * ---------------------------------------------------------------- */

  targetPoint(opt) {
    if (opt.kind === 'pass') return this.pos[opt.to];
    if (opt.kind === 'shoot') return HOOP;
    return opt.at;
  }

  _target3(opt) {
    const p = this.targetPoint(opt);
    if (!p) return null;
    if (opt.kind === 'shoot') return new THREE.Vector3(p[0], RIM_Y, p[1]);
    if (opt.kind === 'pass') return new THREE.Vector3(p[0], 3, p[1]);
    return new THREE.Vector3(p[0], 0.2, p[1]);
  }

  showTargets(options, actor) {
    this.clearMarkers();
    this._options = options;
    const from = this.pos[actor];
    options.forEach((opt, i) => {
      const g = new THREE.Group();
      const at = this.targetPoint(opt);
      if (opt.kind === 'pass') {
        const r = this._ring(2.15, 2.5, GOLD, 0.9);
        r.position.set(at[0], 0.07, at[1]);
        g.add(r);
      } else if (opt.kind === 'shoot') {
        const t = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 8, 48),
          new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, toneMapped: false }));
        t.rotation.x = Math.PI / 2;
        t.position.set(at[0], RIM_Y, at[1]);
        g.add(t);
      } else {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 40),
          new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(at[0], 0.06, at[1]);
        const r = this._ring(1.35, 1.55, GOLD, 0.95);
        r.position.set(at[0], 0.07, at[1]);
        g.add(disc, r);
        if (from && dist(from, at) > 2.5) {
          const mid = [(from[0] + at[0]) / 2 + (at[1] - from[1]) * 0.08, (from[1] + at[1]) / 2 - (at[0] - from[0]) * 0.08];
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(from[0], 0.08, from[1]), new THREE.Vector3(mid[0], 0.08, mid[1]), new THREE.Vector3(at[0], 0.08, at[1]));
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)),
            new THREE.LineDashedMaterial({ color: GOLD, dashSize: 0.7, gapSize: 0.45, toneMapped: false }));
          line.computeLineDistances();
          g.add(line);
        }
      }
      g.userData.opt = i;
      this.scene.add(g);
      let label = null;
      if (opt.label) {
        label = document.createElement('span');
        label.className = 'hc3-target-label';
        label.textContent = this.text(opt.label);
        this.overlay.appendChild(label);
      }
      this.targets.push({ group: g, opt, label, i });
    });
  }

  highlightTarget(i) {
    for (const t of this.targets) {
      const hot = t.i === i;
      t.hot = hot;
      t.label?.classList.toggle('is-hot', hot);
    }
  }

  clearMarkers() {
    for (const t of this.targets) { this.scene.remove(t.group); t.label?.remove(); }
    this.targets = [];
    this.endDrag();
  }

  dragTo(from, to) {
    if (!this.dragLine) {
      this.dragLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: GOLD, toneMapped: false }));
      this.scene.add(this.dragLine);
    }
    this.dragLine.geometry.setFromPoints([new THREE.Vector3(from[0], 0.1, from[1]), new THREE.Vector3(to[0], 0.1, to[1])]);
  }

  endDrag() {
    if (this.dragLine) { this.scene.remove(this.dragLine); this.dragLine = null; }
  }

  showCue(cue) {
    this.clearCue();
    if (cue.at === 'clock') return;
    const at = typeof cue.at === 'string' ? this.pos[cue.at] : cue.at;
    if (!at) return;
    const r = this._ring(2.7, 2.95, 0xF1D3A8, 0.95);
    r.position.set(at[0], 0.08, at[1]);
    this.cueRing = r;
    this.cueId = typeof cue.at === 'string' ? cue.at : null;
    this.scene.add(r);
  }

  clearCue() { if (this.cueRing) { this.scene.remove(this.cueRing); this.cueRing = null; this.cueId = null; } }

  /* ---------------------------------------------------------------- *
   * Input helpers
   * ---------------------------------------------------------------- */

  _rect() { return this.canvas.getBoundingClientRect(); }

  _project(v) {
    const p = v.clone().project(this.camera);
    const r = this._w ? { width: this._w, height: this._h } : this._rect();
    return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height, p.z];
  }

  /** Client pixel → court feet on the floor plane. */
  toCourt(clientX, clientY) {
    const r = this._rect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
    return [hit.x, hit.z];
  }

  /** Nearest option by screen distance, or -1. */
  pickTarget(clientX, clientY, drag = false) {
    const reach = drag ? 90 : 56;
    const r = this._rect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    let best = -1;
    let bestD = Infinity;
    for (const t of this.targets) {
      const v = this._target3(t.opt);
      if (!v) continue;
      const [sx, sy] = this._project(v);
      let d = Math.hypot(sx - x, sy - y);
      if (t.label) {
        const lr = t.label.getBoundingClientRect();
        if (clientX >= lr.left && clientX <= lr.right && clientY >= lr.top && clientY <= lr.bottom) d = 0;
      }
      if (d < bestD) { bestD = d; best = t.i; }
    }
    return bestD <= reach ? best : -1;
  }

  /** Screen point of an option or a player, for tests and hints. */
  targetClientPoint(i) {
    const t = this.targets.find(x => x.i === i);
    const v = t && this._target3(t.opt);
    if (!v) return null;
    const r = this._rect();
    const [x, y] = this._project(v);
    return [r.left + x, r.top + y];
  }

  actorClientPoint(id) {
    const p = this.pos[id];
    if (!p) return null;
    const r = this._rect();
    const [x, y] = this._project(new THREE.Vector3(p[0], 2.5, p[1]));
    return [r.left + x, r.top + y];
  }

  hitActor(clientX, clientY, id) {
    const p = this.pos[id];
    if (!p) return false;
    const r = this._rect();
    const [sx, sy] = this._project(new THREE.Vector3(p[0], 2.5, p[1]));
    return Math.hypot(sx - (clientX - r.left), sy - (clientY - r.top)) <= 60;
  }

  /* ---------------------------------------------------------------- *
   * Frame loop
   * ---------------------------------------------------------------- */

  wake() {
    if (this.active) return;
    this.active = true;
    this._last = performance.now();
    this.renderer.setAnimationLoop(t => this._tick(t));
  }

  sleep() {
    this.active = false;
    this.renderer.setAnimationLoop(null);
  }

  _resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (!w || !h) return;
    this._w = w; this._h = h;
    this._aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.baseFov = w / h < 0.9 ? 50 : 38;
    if (this.shot !== 'pov') this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.setShot(this.shot);
  }

  _idleYaw(p) {
    const holder = this.ball.holder;
    let look;
    if (p.side === 'd') look = this.pos[holder] || HOOP;
    else look = holder && holder !== p.id ? this.pos[holder] : HOOP;
    const me = this.pos[p.id];
    return Math.atan2(look[0] - me[0], look[1] - me[1]);
  }

  _tick(now) {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (!this.loaded) return;
    const t = now / 1000;

    // Figurines: face where they move, hop a little when they travel.
    for (const p of Object.values(this.players)) {
      const [x, z] = this.pos[p.id];
      const vx = (x - p.prev[0]) / Math.max(dt, 1e-3);
      const vz = (z - p.prev[1]) / Math.max(dt, 1e-3);
      p.prev = [x, z];
      const speed = Math.hypot(vx, vz);
      p.speed = damp(p.speed, speed, 10, dt);
      const goalYaw = p.speed > 1.5 ? Math.atan2(vx, vz) : this._idleYaw(p);
      p.yaw += angleDelta(p.yaw, goalYaw) * (1 - Math.exp(-9 * dt));
      p.root.rotation.y = p.yaw;
      const moving = Math.min(1, p.speed / 12);
      p.phase += dt * (6 + p.speed * 0.9);
      p.body.position.y = Math.abs(Math.sin(p.phase)) * 0.32 * moving;
      p.body.rotation.x = 0.16 * moving;
      if (!moving && !this.frozen) p.body.position.y = Math.sin(t * 1.6 + p.phase) * 0.02 + 0.02;
    }

    // Camera: damped toward the current shot; follow the ball in play.
    const g = this.goal;
    const target = g.target.clone();
    if (this.shot === 'broadcast' && this.ballMesh) {
      target.x = lerp(target.x, this.ballMesh.position.x, 0.3);
      target.z = lerp(target.z, this.ballMesh.position.z, 0.2);
    }
    for (const k of ['x', 'y', 'z']) {
      this.cam.pos[k] = damp(this.cam.pos[k], g.pos[k], g.k, dt);
      this.cam.target[k] = damp(this.cam.target[k], target[k], g.k, dt);
    }
    const fov = damp(this.camera.fov, this.fovGoal || this.baseFov || 38, 3.5, dt);
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.target);

    // Effects and pulsing markers.
    this.fx = this.fx.filter(f => {
      const k = Math.min(1, (now - f.t0) / f.dur);
      f.update(k);
      if (k >= 1) { this.scene.remove(f.obj); f.obj.geometry?.dispose(); return false; }
      return true;
    });
    const pulse = 1 + Math.sin(t * 4.2) * 0.05;
    for (const tg of this.targets) {
      const s = tg.hot ? 1.14 : pulse;
      // Scale each marker about its own centre, not the world origin.
      tg.group.children.forEach(c => { if (!c.isLine) c.scale.setScalar(s); });
    }
    if (this.cueRing) {
      if (this.cueId && this.pos[this.cueId]) {
        this.cueRing.position.x = this.pos[this.cueId][0];
        this.cueRing.position.z = this.pos[this.cueId][1];
      }
      this.cueRing.rotation.z = t * 0.8;
      this.cueRing.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    }

    this.renderer.render(this.scene, this.camera);
    this._layoutLabels();
  }

  _layoutLabels() {
    const W = this._w || this._rect().width;
    const H = this._h || this._rect().height;
    const place = (el, v, dy = 0, clamp = false) => {
      let [x, y, z] = this._project(v);
      if (clamp) {
        // Keep option labels fully inside the court view.
        const hw = (el.offsetWidth || 80) / 2 + 8;
        const hh = (el.offsetHeight || 28) / 2 + 8;
        x = Math.min(W - hw, Math.max(hw, x));
        y = Math.min(H - hh, Math.max(hh, y));
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px) translate(-50%, -50%)`;
      el.style.visibility = z < 1 ? 'visible' : 'hidden';
    };
    for (const [id, chip] of Object.entries(this.labels)) {
      const [x, z] = this.pos[id];
      place(chip, new THREE.Vector3(x, 0.1, z + 2.6));
    }
    if (this.youTag && this.pos[this.you]) {
      const [x, z] = this.pos[this.you];
      place(this.youTag, new THREE.Vector3(x, 6.4, z));
    }
    for (const c of this._calls || []) {
      const p = this.pos[c.id];
      if (p) place(c.el, new THREE.Vector3(p[0], 7.4, p[1]));
    }
    for (const t of this.targets) {
      if (!t.label) continue;
      const v = this._target3(t.opt);
      if (t.opt.kind === 'shoot') v.y += 2.6;
      else v.z += 2.8;
      place(t.label, v, 0, true);
    }
  }

  destroy() {
    this.sleep();
    this._ro?.disconnect();
    this.renderer.dispose();
    this.el.remove();
  }
}
