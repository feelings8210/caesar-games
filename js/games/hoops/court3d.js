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
import { HDRLoader } from '../../vendor/three/addons/HDRLoader.js';
import { BeatRunner, HOOP, PLAY_SPEED, dist, lerp } from './runner.js';
import { buildArena } from './arena3d.js';
import { drawCourt, tintedMark } from './courtdesign.js';
import { buildHoop } from './hoop3d.js';
import { AthleteKit, STRIDE } from './athlete3d.js';
import { madeBallAt } from './ball-motion.js';
import { hoopsAudio } from './audio.js';
import { actionBall, basketballBeat, roundedRoute, travelYaw, landingStep } from './basketball-pose.js';
import { framePosition, broadcastFrame } from './camera-frame.js';
import { athleteSurface } from './athlete-surface.js';
import { FloorReflection } from './floor-reflection.js';

const ASSETS = new URL('../../../assets/hoops/', import.meta.url).href;
const RIM_Y = 10;
const HAND_Y = 2.45;
const BALL_R = 0.45;
/** Floor markings always win the depth test against the boards they lie on. */
const ABOVE_FLOOR = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 };
const TRAIL_N = 20, TRAIL_LIFE = 0.3;

const TEAM = {
  o: { jersey: 0x21457F, shorts: 0x15294A, base: 0x1B3358, body: 0xC9CDD3, ring: 0x7FB2FF },
  d: { jersey: 0x8E4238, shorts: 0x5A2620, base: 0x7A332B, body: 0x9C6B45, ring: 0xFF7F70 },
  you: { body: 0xD9B46A, ring: 0xF2C66D }
};
const GOLD = 0xE2BE72;

const damp = (cur, goal, k, dt) => cur + (goal - cur) * (1 - Math.exp(-k * dt));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Remove transient objects and their private buffers/materials, not shared maps. */
function disposeObject(obj) {
  obj.removeFromParent();
  const geometries = new Set(), materials = new Set();
  obj.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) for (const m of [o.material].flat()) materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}

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
    // Quality starts high and steps down once if the first frames run slow.
    const forced = new URLSearchParams(location.search).get('hoopsQuality');
    this.arenaLook = new URLSearchParams(location.search).get('hoopsLook') !== 'classic';
    this.venueLook = this.arenaLook && new URLSearchParams(location.search).get('hoopsVenue') !== 'legacy';
    this.skinLook = this.arenaLook && new URLSearchParams(location.search).get('hoopsSkin') !== 'legacy';
    this.structureLook = this.venueLook && new URLSearchParams(location.search).get('hoopsStructure') !== 'legacy';
    this.crowdLook = this.venueLook && new URLSearchParams(location.search).get('hoopsCrowd') !== 'legacy';
    this.quality = forced === 'low' ? 'low' : 'high';
    this._qualityLocked = !!forced;
    this._probe = [];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2));
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
    this.scene.background = new THREE.Color(0x0B0E13);
    this.scene.fog = new THREE.Fog(0x0E1218, this.arenaLook ? 100 : 80, this.arenaLook ? 245 : 200);
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
    this.cam = { pos: new THREE.Vector3(0, 34, 72), target: new THREE.Vector3(0, 1.5, 17) };
    this.goal = { pos: this.cam.pos.clone(), target: this.cam.target.clone(), k: 2.6 };
    this.shot = 'broadcast';

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem = pmrem;
    this.roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.roomEnv;
    this.scene.environmentIntensity = 0.55;

    this._lights();
    this.ready = this._load();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.el);
    this._last = performance.now();
  }

  /* ---------------------------------------------------------------- *
   * Setup
   * ---------------------------------------------------------------- */

  _lights() {
    this.scene.add(new THREE.HemisphereLight(this.arenaLook ? 0xECEEF0 : 0xDCE6F5, 0x1E2228, this.venueLook ? .4 : this.arenaLook ? 0.65 : 0.32));
    // A museum spot over the table: full light on the court, falling off over the stands.
    const key = new THREE.SpotLight(0xFFF0DC, 2.45, 0, 0.46, 0.5, 0);
    if(this.venueLook){key.color.setHex(0xFFF5E7);key.intensity=2.15;key.angle=.58;key.penumbra=.8;}
    key.position.set(-14, 84, 6);
    key.target.position.set(0, 0, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { near: 40, far: 130 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    this.scene.add(key, key.target);
    this.key = key;
    const rim = new THREE.DirectionalLight(0xBFD3FF, 0.7);
    if(this.venueLook){rim.color.setHex(0xE4E7EE);rim.intensity=.42;}
    rim.position.set(10, 18, -30);
    this.scene.add(rim);
    if (this.arenaLook) {
      const fill = new THREE.DirectionalLight(0xE7EDFF, 0.9);
      if(this.venueLook){fill.color.setHex(0xECE7DE);fill.intensity=.55;}
      fill.position.set(-28, 28, 30); this.scene.add(fill);
    }
  }

  async _load() {
    const loader = new GLTFLoader();
    const image = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const optional = p => p.catch(() => null);    // environment art is a bonus, never a blocker
    const tex = new THREE.TextureLoader();
    let casualUsed=false,reactionsUsed=false;
    const casual=()=>loader.loadAsync(ASSETS+'casual-audience.glb').then(g=>{casualUsed=true;return g;});
    const [figs, mark, wood, nor, rough, hdr, crowd, motions, jumps, seated, skinMicro, crowdAtlas] = await Promise.all([
      this.skinLook ? loader.loadAsync(ASSETS+'athlete-faces.glb').catch(()=>loader.loadAsync(ASSETS+'athlete-arena.glb')) : loader.loadAsync(ASSETS + (this.arenaLook ? 'athlete-arena.glb' : 'athlete.glb')),
      optional(image(ASSETS + '../cd_home_mark_transparent.png')),
      optional(image(ASSETS + 'env/wood_diff_1k.jpg')),
      optional(tex.loadAsync(ASSETS + 'env/wood_nor_1k.jpg')),
      optional(tex.loadAsync(ASSETS + 'env/wood_rough_1k.jpg')),
      optional(new HDRLoader().loadAsync(ASSETS + 'env/env_1k.hdr')),
      this.arenaLook ? optional(loader.loadAsync(ASSETS + 'crowd-head.glb')) : null,
      this.arenaLook ? optional(loader.loadAsync(ASSETS + 'basketball-actions.glb')) : null,
      this.arenaLook ? optional(loader.loadAsync(ASSETS + 'jump-shot.glb')) : null,
      this.venueLook ? optional(this.crowdLook
        ? (new URLSearchParams(location.search).get('hoopsCrowdReaction')==='legacy'?casual():loader.loadAsync(ASSETS+'casual-reactions.glb').then(g=>{casualUsed=reactionsUsed=true;return g;}).catch(casual)).catch(()=>loader.loadAsync(ASSETS+'seated-audience.glb'))
        : loader.loadAsync(ASSETS+'seated-audience.glb')) : null,
      this.skinLook ? optional(tex.loadAsync(ASSETS + 'skin-micro.png')) : null,
      this.crowdLook && new URLSearchParams(location.search).get('hoopsCrowdDepth') !== 'legacy' ? optional(tex.loadAsync(ASSETS + 'crowd-atlas.png')) : null
    ]);
    if(skinMicro){skinMicro.wrapS=skinMicro.wrapT=THREE.MirroredRepeatWrapping;skinMicro.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());this._skinMicro=skinMicro;}
    this.casualAudience=casualUsed;
    this.crowdReactions=reactionsUsed;

    if (hdr) {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = this.pmrem.fromEquirectangular(hdr).texture;
      this.scene.environmentIntensity = 0.7;
      if(this.venueLook)this.scene.environmentIntensity=.38;
      hdr.dispose();
    }

    // The floor mirrors the soft studio room, not the photo's hot lamps
    // (iPad GPUs blow those up into a white sheen), and only faintly: any
    // more lays a grey haze over the honey of the wood.
    // Specular held low too, or the overhead spot and the backlight leave white
    // smears across the near boards.
    const floorMat = new THREE.MeshPhysicalMaterial({ map: this._floorTexture(mark, wood), roughness: 0.42, metalness: 0,
      envMap: this.roomEnv, envMapIntensity: 0.3, specularIntensity: 0.35, clearcoat: 0.45, clearcoatRoughness: 0.16 });
    // Planks run along the court; the scans run across, so turn the detail maps.
    for (const [m, key] of [[nor, 'normalMap'], [rough, 'roughnessMap']]) {
      if (!m) continue;
      m.wrapS = m.wrapT = THREE.RepeatWrapping;
      m.repeat.set(7.5, 7.5);
      m.center.set(0.5, 0.5);
      m.rotation = Math.PI / 2;
      m.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      floorMat[key] = m;
    }
    if (nor) floorMat.normalScale.set(0.35, 0.35);
    if(nor&&this.venueLook)floorMat.normalScale.set(.12,.12);
    if (rough) floorMat.roughness = 0.78;                // satin: the spot leaves a soft sheen
    if (this.arenaLook) { floorMat.clearcoat = .2; floorMat.clearcoatRoughness = .4; floorMat.specularIntensity = .16; }
    if(this.venueLook){floorMat.clearcoat=.16;floorMat.clearcoatRoughness=.4;floorMat.specularIntensity=.12;floorMat.roughness=.7;floorMat.envMapIntensity=.22;}
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, 25);
    this.floor.receiveShadow = true;
    if (this.arenaLook) {
      // A real court continues beyond the lesson, without a model pedestal.
      this.floor.geometry.dispose(); this.floor.geometry = new THREE.PlaneGeometry(50,47);
      const uv = this.floor.geometry.attributes.uv;
      for(let i=0;i<uv.count;i++) uv.setY(i,.06 + uv.getY(i)*.94);
      this.floor.position.z = 23.5;
      const other = new THREE.Mesh(this.floor.geometry, floorMat);
      other.name = 'FarCourt';
      other.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI).multiply(this.floor.quaternion);
      other.position.set(0,0,70.5); other.receiveShadow=true; this.scene.add(other);
      if (mark) {
        const image = tintedMark(mark,'#D9B97A',512), texture = new THREE.CanvasTexture(image);
        texture.colorSpace=THREE.SRGBColorSpace;
        const logo = new THREE.Mesh(new THREE.PlaneGeometry(7.4,7.4*image.height/image.width),
          new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.85,depthWrite:false,...ABOVE_FLOOR}));
        logo.rotation.x=-Math.PI/2;logo.position.set(0,.012,47);this.scene.add(logo);
      }
    }
    this.scene.add(this.floor);

    const hoop = buildHoop({ hoop: HOOP, rimY: RIM_Y, mark });
    if(this.venueLook)hoop.traverse(o=>o.layers.enable(1));
    this.scene.add(hoop);
    if (this.arenaLook) { const farHoop=buildHoop({hoop:HOOP,rimY:RIM_Y,mark});farHoop.name='FarHoop';farHoop.rotation.y=Math.PI;farHoop.position.z=94;if(this.venueLook)farHoop.traverse(o=>o.layers.enable(1));this.scene.add(farHoop); }
    let crowdHead=null;
    crowd?.scene.traverse(o=>{if(o.isMesh)crowdHead=o.geometry;});
    this.arena = buildArena(this.scene, { hoop, rimY: RIM_Y, populated: this.arenaLook, crowdHead,
      seatedAudience:seated?.scene,refined:this.venueLook,structure:this.structureLook,casual:casualUsed,crowdAtlas,reactions:reactionsUsed });
    if(crowd)disposeObject(crowd.scene);
    if(seated)disposeObject(seated.scene);
    this._applyQuality();

    this.kit = new AthleteKit(figs);
    if(motions) {
      for(const clip of motions.animations)this.kit.clips[clip.name]=clip;
      disposeObject(motions.scene);
    }
    if(jumps){for(const clip of jumps.animations)this.kit.clips[clip.name]=clip;disposeObject(jumps.scene);}
    this.materials = {};
    this.ballMesh = this._makeBall();
    if(this.venueLook)this.ballMesh.layers.enable(1);
    this.scene.add(this.ballMesh);
    this.trail = this._makeTrail();
    this.trail.visible = !this.arenaLook;
    this.scene.add(this.trail);
    if(this.venueLook){
      this.scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});
      this.floorReflection=new FloorReflection(this.renderer,this.scene,floorMat,
        [this.floor,this.scene.getObjectByName('FarCourt')],()=>Object.values(this.players).map(p=>p.athlete));
      this.floorReflection.enabled=new URLSearchParams(location.search).get('hoopsReflection')!=='off';
      this.floorReflection.setQuality(this.quality,this.camera.aspect);
    }
    this.loaded = true;
    if (this._pending) { const [s, y] = this._pending; this._pending = null; this.setScene(s, y); }
  }

  _floorTexture(mark, wood) {
    const S = 2048;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const px = S / 50;
    if (wood) {
      this._woodFloor(g, S, wood);
      drawCourt(g, S, mark, { centreMark: !this.arenaLook });
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return t;
    }
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
    drawCourt(g, S, mark, { centreMark: !this.arenaLook });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  /** Scanned oak, toned to honey maple and turned to run along the court. */
  _woodFloor(g, S, wood) {
    const T = 1024;
    const tile = document.createElement('canvas');
    tile.width = tile.height = T;
    const tg = tile.getContext('2d');
    tg.translate(T / 2, T / 2);
    tg.rotate(Math.PI / 2);
    tg.drawImage(wood, -T / 2, -T / 2, T, T);
    const img = tg.getImageData(0, 0, T, T);
    const d = img.data;
    let r = 0, gr = 0, b = 0;
    for (let i = 0; i < d.length; i += 64) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 64;
    // Honey maple, with the grain and plank-to-plank variation drawn out.
    const mean = [r / n, gr / n, b / n], tone = this.venueLook ? [184,155,112] : this.arenaLook ? [175, 153, 114] : [186, 133, 80], k = this.venueLook ? .82 : this.arenaLook ? 0.52 : 1.3;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) d[i + c] = tone[c] + (d[i + c] - mean[c]) * k;
    }
    tg.putImageData(img, 0, 0);
    const step = S / 7.5;
    for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) g.drawImage(tile, x, y, step + 1, step + 1);
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
    if (this.arenaLook) {
      const surface=document.createElement('canvas');surface.width=surface.height=64;
      const ctx=surface.getContext('2d');ctx.fillStyle='#777';ctx.fillRect(0,0,64,64);ctx.fillStyle='#AAA';
      for(let y=0;y<64;y+=4)for(let x=0;x<64;x+=4){ctx.beginPath();ctx.arc(x+(y%8?2:0),y,1.3,0,Math.PI*2);ctx.fill();}
      const bump=new THREE.CanvasTexture(surface);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(8,4);
      m.material.bumpMap=bump;m.material.bumpScale=.003;m.material.roughness=.74;
    }
    m.castShadow = true;
    return m;
  }

  _material(slot, side, you, number = 1) {
    const key = `${slot}:${side}:${you ? 1 : 0}:${this.arenaLook ? number : 0}`;
    if (this.materials[key]) return this.materials[key];
    const t = TEAM[side];
    let m;
    switch (slot) {
      case 'Jersey': m = new THREE.MeshStandardMaterial({ color: t.jersey, roughness: 0.22 }); break;
      case 'Shorts': m = new THREE.MeshStandardMaterial({ color: t.shorts, roughness: 0.26 }); break;
      case 'Skin': m = this.arenaLook
        ? new THREE.MeshPhysicalMaterial(this.skinLook?{roughness:.64,clearcoat:.02,clearcoatRoughness:.55,specularIntensity:.45,ior:1.4}:{roughness:.66,clearcoat:.12,clearcoatRoughness:.4})
        : new THREE.MeshStandardMaterial({ color: you ? TEAM.you.body : t.body, metalness: 1, roughness: you ? 0.3 : 0.38 }); break;
      case 'Base': m = new THREE.MeshStandardMaterial({ color: t.base, roughness: 0.25, metalness: 0.05, ...ABOVE_FLOOR }); break;
      case 'Trim': m = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.3, ...ABOVE_FLOOR }); break;
      case 'Hair': m = this.skinLook?new THREE.MeshPhysicalMaterial({color:number%3===0?0x35281E:0x171514,roughness:.8,anisotropy:.3,anisotropyRotation:Math.PI/2,specularIntensity:.55,envMapIntensity:.3}):new THREE.MeshStandardMaterial({ color: number % 3 === 0 ? 0x35281E : 0x171514, roughness: 0.95 }); break;
      case 'EyeSclera': m = this.skinLook?new THREE.MeshPhysicalMaterial({color:0xD6CEC0,roughness:.28,clearcoat:.45,clearcoatRoughness:.12,ior:1.376}):new THREE.MeshStandardMaterial({color:0xD6CEC0,roughness:.32}); break;
      case 'EyeIris': m = this.skinLook?new THREE.MeshPhysicalMaterial({color:number%4===0?0x556251:0x49321E,roughness:.32,clearcoat:.6,clearcoatRoughness:.1,ior:1.376}):new THREE.MeshStandardMaterial({color:number%4===0?0x556251:0x49321E,roughness:.42}); break;
      case 'EyePupil': m = this.skinLook?new THREE.MeshPhysicalMaterial({color:0x080809,roughness:.2,clearcoat:.6,clearcoatRoughness:.1,ior:1.376}):new THREE.MeshStandardMaterial({color:0x080809,roughness:.3}); break;
      default: m = new THREE.MeshStandardMaterial({ color: 0xF4F3EF, roughness: 0.45 });
    }
    if (this.arenaLook) {
      if (slot === 'Skin') {
        const skins = [0xA36E4C, 0xD6A17C, 0x72452F, 0xBE885F, 0x8E5C40];
        m.color.setHex(skins[(number - 1 + (side === 'd' ? 2 : 0)) % skins.length]);
        m.metalness = 0; m.roughness = this.skinLook ? .64 : .66; m.envMapIntensity = this.skinLook ? .4 : .35;
        if(this.skinLook&&this._skinMicro){m.bumpMap=this._skinMicro;m.bumpScale=.0015;}
      }
      if (slot === 'Jersey' || slot === 'Shorts') { m.roughness = 0.85; m.envMapIntensity = 0.2; }
      if (slot === 'Jersey' || slot === 'Shorts') {
        if (!this._clothNormal) {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
          const ctx = canvas.getContext('2d'), image = ctx.createImageData(64,64);
          for (let y=0;y<64;y++) for(let x=0;x<64;x++) {
            const i=(y*64+x)*4;
            image.data[i]=128+Math.sin(x*Math.PI/2)*18; image.data[i+1]=128+Math.sin(y*Math.PI/2)*18;
            image.data[i+2]=252; image.data[i+3]=255;
          }
          ctx.putImageData(image,0,0); this._clothNormal=new THREE.CanvasTexture(canvas);
          this._clothNormal.wrapS=this._clothNormal.wrapT=THREE.RepeatWrapping; this._clothNormal.repeat.set(9,9);
        }
        m.normalMap=this._clothNormal; m.normalScale.set(.14,.14);
        m.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 vKitRest;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKitRest=position;');
          shader.fragmentShader='varying vec3 vKitRest;\n'+shader.fragmentShader.replace('#include <color_fragment>',
            '#include <color_fragment>\nfloat sideTrim=smoothstep(.53,.55,abs(vKitRest.x))*(1.0-smoothstep(.62,.65,abs(vKitRest.x)));\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.80,.63),sideTrim*.94);');
        };
        m.customProgramCacheKey=()=> 'hoops-kit-trim-1';
      }
      if (slot === 'Shoe') { m.color.setHex(side === 'o' ? 0xE8E6E0 : 0x252D39); m.roughness = 0.8; }
      if(['Skin','Hair','Shoe'].includes(slot)||this.skinLook&&['EyeSclera','EyeIris'].includes(slot))athleteSurface(m,slot,side,{refined:this.skinLook});
    }
    m.name=slot;
    this.materials[key] = m;
    return m;
  }

  _numberTexture(n, side = 'o') {
    this._numTex = this._numTex || {};
    const key = this.arenaLook ? `${side}:${n}` : n;
    if (this._numTex[key]) return this._numTex[key];
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
    if (this.arenaLook) {
      g.clearRect(0,0,128,128);
      g.fillStyle='#F4F1E8';g.font='800 18px Arial, sans-serif';
      g.fillText(side==='o'?'CAESAR':'RIVALS',64,25);
      g.font='800 78px Arial, sans-serif';g.lineWidth=3;g.strokeText(String(n),64,78);g.fillText(String(n),64,78);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return (this._numTex[key] = tex);
  }

  _ring(inner, outer, color, opacity = 0.9, segments = 64) {
    const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, ...ABOVE_FLOOR }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  /* ---------------------------------------------------------------- *
   * Scene
   * ---------------------------------------------------------------- */

  setScene(setup, you) {
    this.arena?.resetReactions();
    this.cancel();
    this.resetState(setup);
    this._framingPositions=null;
    this.you = you;
    this._lean = null;
    this._trailPts = [];
    this._receivingId = null; this._shooter = null; this._celebrated = null;
    if (!this.loaded) { this._pending = [setup, you]; return; }
    this._clearPlayers();
    this.players = {};
    this.overlay.textContent = '';
    this.labels = {};
    this._clearFx();
    this.clearMarkers();
    this.clearCue();
    this.clearDiagram();

    for (const id of Object.keys(this.pos)) {
      const side = id[0];
      const isYou = id === you;
      const n = Number(id.slice(1));
      const decalMat = new THREE.MeshStandardMaterial({ map: this._numberTexture(n,side), alphaTest: 0.5, roughness: 0.75 });
      const athlete = this.kit.make(slot => this._material(slot, side, isYou, n), decalMat, { pedestal: !this.arenaLook, style: this.arenaLook ? n : 0,faceVariant:this.skinLook?n+(side==='d'?5:0):0 });
      decalMat.dispose();
      const root = new THREE.Group();
      root.add(athlete.root);
      if(this.venueLook)athlete.root.traverse(o=>o.layers.enable(1));
      if (this.arenaLook) {
        const scale = [0.95, 0.98, 1, 1.04, 1.08][n - 1] || 1;
        athlete.root.scale.set(scale, scale, scale);
      }
      athlete.setLoop(side === 'd' ? 'DefStance' : 'Idle');
      athlete.setQuality(this.quality);

      const ring = new THREE.Group();
      const glow = this._ring(1.72, this.arenaLook ? 1.8 : 1.95, isYou ? TEAM.you.ring : TEAM[side].ring, isYou ? 0.85 : 0.6);
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
      if (this.arenaLook) ring.visible = isYou;
      const p = { id, side, root, athlete, ring, yaw: side === 'o' ? Math.PI : 0, prev: [x, z], speed: 0 };
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
    this._screeners = new Set();
    this._seenHolder = this.ball.holder;
    this._seenFlight = null;
    // Open on the display case, low and wide, then glide down to the game
    // camera while the title card is up.
    this.setShot('broadcast', true);
    if(!this.arenaLook)this.cam.pos.set(0, 30, 96);
    this.cam.target.set(0, 2, 20);
    this.goal.k = 1.6;
    this._renderBall(0);
    this.wake();
  }

  _clearPlayers() {
    clearTimeout(this._celebrateTimer);
    for (const p of Object.values(this.players)) {
      p.root.removeFromParent();
      p.athlete.dispose();
      disposeObject(p.ring);
    }
    this.players = {};
    this.timerRing = null;
    this.youTag = null;
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

  /** A short comet tail behind a ball in the air, so passes and shots read at a glance. */
  _makeTrail() {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(BALL_R, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), TRAIL_N);
    m.frustumCulled = false;
    m.count = 0;
    m.renderOrder = 3;
    m.setColorAt(0, new THREE.Color());
    this._trailPts = [];
    this._simT = 0;
    return m;
  }

  _updateTrail(dt) {
    if (!this.trail || this.frozen) return;
    this._simT += dt * PLAY_SPEED;
    const now = this._simT, bp = this.ballMesh.position;
    const last = this._trailPts[this._trailPts.length - 1];
    if (this.ball.flight && Number.isFinite(bp.x) && (!last || now - last.t > TRAIL_LIFE / TRAIL_N)) {
      this._trailPts.push({ t: now, p: bp.clone() });
    }
    this._trailPts = this._trailPts.filter(s => now - s.t < TRAIL_LIFE).slice(-TRAIL_N);
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
    this._trailPts.forEach((s, i) => {
      const k = 1 - (now - s.t) / TRAIL_LIFE;           // 1 = fresh, 0 = gone
      sc.setScalar(0.35 + 0.55 * k);
      this.trail.setMatrixAt(i, mat.compose(s.p, q, sc));
      this.trail.setColorAt(i, col.setRGB(1, 0.62, 0.3).multiplyScalar(0.55 * k * k));
    });
    this.trail.count = this._trailPts.length;
    this.trail.instanceMatrix.needsUpdate = true;
    if (this.trail.instanceColor) this.trail.instanceColor.needsUpdate = true;
  }

  _renderBall(bounce) {
    if (!this.ballMesh) return;
    const b = this.ball;
    if (this.arenaLook) {
      const projected = this.ballMesh.position.clone().project(this.camera);
      hoopsAudio.setCourtPosition(projected.x, this.ballMesh.position.distanceTo(this.camera.position));
    } else hoopsAudio.setCourtPosition(0, 0, false);
    const f = b.flight;
    let at = b.at;
    let y;
    const held = b.holder && !f && this.players[b.holder];
    if (held && this.arenaLook) {
      this._dribbleBounce = bounce;
      const action = held.action;
      const moving = held.speed > 2.5;
      let local = moving ? [-.8, 3.4 - bounce * (3.4 - BALL_R), .65] : [-.65,3.8,.7];
      if (b.preparing && action) {
        const fraction = (performance.now() - action.start) / action.releaseMs;
        local = actionBall(action.clip==='JumpShot'?'jump-shot':action.style === 'layup' ? 'layup' : action.kind, fraction);
      }
      const point = held.root.localToWorld(new THREE.Vector3(...local));
      point.y = Math.max(BALL_R, point.y);
      if (b.preparing && action) {
        const root = held.athlete.root.getObjectByName('root');
        point.y += root?.getWorldPosition(new THREE.Vector3()).y || 0;
        const t = Math.min(1, (performance.now() - action.start) / Math.min(120, action.releaseMs));
        point.lerp(action.from, 1 - t);
      }
      b.at = [point.x, point.z]; this._ballY = point.y;
      this.ballMesh.position.copy(point);
      return;
    }
    if (held && (b.preparing || held.speed < 2.5) && !bounce && held.athlete.ballPosition(this.ballMesh.position)) {
      b.at = [this.ballMesh.position.x, this.ballMesh.position.z];
      this._ballY = this.ballMesh.position.y;
      return;
    }
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
        const receiver = this.players[f.target]?.athlete;
        const hand = receiver?.ballPosition(new THREE.Vector3());
        if (hand && this.arenaLook) {
          at = [lerp(f.from[0], hand.x, e), lerp(f.from[1], hand.z, e)];
          b.at = at;
        }
        y = lerp(f.fromY, hand?.y ?? HAND_Y, e) + Math.sin(e * Math.PI) * (f.lob ? 5 : 1.1);
      } else {
        y = lerp(f.fromY, HAND_Y, e) + Math.sin(e * Math.PI) * 3.2;
      }
    } else if (b.rest === 'made' && this._madeBall) {
      const drop = madeBallAt(this._madeBall.elapsed, RIM_Y + 0.3, BALL_R);
      at = [HOOP[0], HOOP[1] + drop.forward];
      y = drop.height;
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
    this._madeBall = null;
    for (const f of this.fx) disposeObject(f.obj);
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
    this.arena?.swish();
    if (this.arenaLook) {
      this._madeBall = { elapsed: 0, contacts: 0 };
      return;
    }
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

  /** Where "you" would look to read the play: the middle of the action,
   *  i.e. every other player plus the rim (weighted double), so the whole
   *  read stays in frame wherever you stand or whichever way you just ran. */
  _povLook() {
    const at = this.pos[this.you] || [0, 20];
    let sx = HOOP[0] * 2, sz = HOOP[1] * 2, n = 2;
    for (const [id, p] of Object.entries(this.pos)) {
      if (id === this.you || !/^[od]\d$/.test(id)) continue;
      sx += p[0]; sz += p[1]; n++;
    }
    let dx = sx / n - at[0], dz = sz / n - at[1];
    if (Math.hypot(dx, dz) < 2) { dx = HOOP[0] - at[0]; dz = HOOP[1] - at[1]; }
    const len = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3(at[0] + dx / len * 30, 3.2, at[1] + dz / len * 30);
  }

  setShot(name, snap = false, user = false) {
    if (user) this._userShot = true;
    this.shot = name;
    const g = this.goal;
    if (name === 'broadcast' || name === 'decide') {
      // One calm game camera for watching and deciding: the freeze never moves it.
      // Framed on where the play happens (baseline to the top of the arc),
      // corners included; the empty backcourt end stays mostly out of shot.
      g.target.set(0, 0.5, 15);
      g.pos.copy(this._orbit(g.target, 44, this._fit(25)));
      if (this.arenaLook) {
        const framing=broadcastFrame(this._framingPositions||this.pos,this.baseFov||44,this._aspect||1.2);
        g.target.copy(framing.target);g.pos.copy(framing.position);
      }
      g.k = 2.4;
    } else if (name === 'finish' && this.arenaLook) {
      const shooter = this.pos[this._shooter] || this.pos[this.you] || [0, 20];
      g.target.set((shooter[0] + HOOP[0]) / 2, 5, (shooter[1] + HOOP[1]) / 2);
      const points = [new THREE.Vector3(shooter[0], 0, shooter[1]), new THREE.Vector3(shooter[0], 9, shooter[1]),
        new THREE.Vector3(HOOP[0], 13, HOOP[1]), new THREE.Vector3((shooter[0] + HOOP[0]) / 2, 17, (shooter[1] + HOOP[1]) / 2)];
      // Push in from the same side of the court; reversing sides mid-shot
      // makes the basket and defensive relationships switch screen direction.
      const direction=this._aspect<.9?new THREE.Vector3(-.25,.56,.79):new THREE.Vector3(-.91,.39,.14);
      g.pos.copy(framePosition(points,g.target,direction,this.baseFov||44,this._aspect||1.2,1.1));
      g.k = 4.8;
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
      g.pos.set(at[0] - dir.x * 2.6, 6.6, at[1] - dir.y * 2.6);
      g.target.copy(look);
      g.k = 2.6;
    }
    this.fovGoal = name === 'pov' ? 66 : (this.baseFov || 38);
    const me = this.players[this.you];
    if (me) me.root.visible = name !== 'pov';
    if (snap) { this.cam.pos.copy(g.pos); this.cam.target.copy(g.target); }
  }

  /** Include authored runs and every decision spot before the opening beat,
   * so a mirrored read cannot move a target below the screen. */
  setReadFrame(level) {
    this._framingPositions=Object.values(this.pos).map(p=>[...p]);
    for(const beat of level.intro||[])for(const path of Object.values(beat.move||{}))
      this._framingPositions.push(...(Array.isArray(path[0])?path:[path]).map(p=>[...p]));
    for(const option of level.options||[])if(option.at)this._framingPositions.push([...option.at]);
    if(this.arenaLook)this.setShot('broadcast',true);
  }

  setFrozen(on) {
    const was = this.frozen;
    this.frozen = !!on;
    this.el.classList.toggle('is-frozen', this.frozen);
    clearTimeout(this._shotTimer);
    if (this.frozen && this.arenaLook && this.ball.holder) {
      const player = this.players[this.ball.holder];
      if (player) {
        player.speed = 0; this._renderBall(0);
        const target = this.ballMesh.position.clone();
        const guide = player.root.localToWorld(new THREE.Vector3(.35,0,0)).sub(player.root.position).add(target);
        player.athlete.reachBall(target,guide,{grip:true});
      }
    }
    // The camera stays put on the freeze; player view is the learner's choice.
    if (!this.frozen && was && this.shot === 'pov') this.setShot('broadcast');
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
      if(opt.kind==='pass')this.labels[opt.to]?.classList.add('is-target');
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
    for (const t of this.targets) { disposeObject(t.group); t.label?.remove(); }
    for(const chip of Object.values(this.labels||{}))chip.classList.remove('is-target');
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
    if (this.dragLine) { disposeObject(this.dragLine); this.dragLine = null; }
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

  clearCue() { if (this.cueRing) { disposeObject(this.cueRing); this.cueRing = null; this.cueId = null; } }

  /* ---------------------------------------------------------------- *
   * Play diagrams (playbook): flat ribbons on the floor
   * ---------------------------------------------------------------- */

  /** Resample a polyline every `step` feet. */
  _resample(pts, step = 0.5) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / step));
      for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    }
    return out;
  }

  _ribbonGeo(pts, width, y = 0.1) {
    const pos = [];
    const idx = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (-(b[1] - a[1]) / L) * width / 2;
      const nz = ((b[0] - a[0]) / L) * width / 2;
      pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  _diagramMat(color, opacity = 0.95) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  }

  /** marks: [{ type: 'cut'|'dribble'|'pass'|'screen', team: 'o'|'d', pts: [[x, y], ...], hint? }] */
  showDiagram(marks) {
    this.clearDiagram();
    const group = new THREE.Group();
    for (const m of marks) {
      if (!m.pts || m.pts.length < 2) continue;
      const color = m.hint ? GOLD : m.type === 'pass' ? 0xFFFFFF : m.team === 'd' ? 0xFF8F80 : 0xF6E3BC;
      const mat = this._diagramMat(color);
      let pts = this._resample(m.pts, 0.4);
      const total = pts.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
      if (total < 0.8) continue;
      // Stop short of the end so the head sits on the line.
      const end = pts[pts.length - 1];
      const pre = pts[Math.max(0, pts.length - 4)];
      const dir = [end[0] - pre[0], end[1] - pre[1]];
      const dl = Math.hypot(dir[0], dir[1]) || 1;
      const ux = dir[0] / dl, uz = dir[1] / dl;
      const trim = m.type === 'screen' ? 0 : 1.0;
      while (pts.length > 2 && Math.hypot(pts[pts.length - 1][0] - end[0], pts[pts.length - 1][1] - end[1]) < trim) pts.pop();
      if (trim) pts.push([end[0] - ux * trim, end[1] - uz * trim]);

      if (m.type === 'pass') {
        // Dashes: 0.9 ft on, 0.6 ft off.
        let run = [];
        let acc = 0;
        for (let i = 0; i < pts.length; i++) {
          if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          const on = (acc % 1.5) < 0.9;
          if (on) run.push(pts[i]);
          if ((!on || i === pts.length - 1) && run.length > 1) { group.add(new THREE.Mesh(this._ribbonGeo(run, 0.28), mat)); run = []; }
          if (!on) run = [];
        }
      } else if (m.type === 'dribble') {
        const zig = pts.map((p, i) => {
          if (i === 0 || i === pts.length - 1) return p;
          const a = pts[i - 1], b = pts[i + 1];
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const off = (i % 2 ? 1 : -1) * 0.35;
          return [p[0] - (b[1] - a[1]) / L * off, p[1] + (b[0] - a[0]) / L * off];
        });
        group.add(new THREE.Mesh(this._ribbonGeo(zig, 0.22), mat));
      } else {
        group.add(new THREE.Mesh(this._ribbonGeo(pts, 0.3), mat));
      }

      if (m.type === 'screen') {
        // The T: a bar across the end of the screener's path.
        const bar = [[end[0] - uz * 1.1, end[1] + ux * 1.1], [end[0] + uz * 1.1, end[1] - ux * 1.1]];
        group.add(new THREE.Mesh(this._ribbonGeo(bar, 0.36), mat));
      } else {
        const head = new THREE.BufferGeometry();
        const tip = [end[0], end[1]];
        const base = [end[0] - ux * 1.4, end[1] - uz * 1.4];
        head.setAttribute('position', new THREE.Float32BufferAttribute([
          tip[0], 0.11, tip[1],
          base[0] - uz * 0.75, 0.11, base[1] + ux * 0.75,
          base[0] + uz * 0.75, 0.11, base[1] - ux * 0.75
        ], 3));
        group.add(new THREE.Mesh(head, mat));
      }
    }
    this.diagram = group;
    this.scene.add(group);
  }

  clearDiagram() {
    if (!this.diagram) return;
    disposeObject(this.diagram);
    this.diagram = null;
  }

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
      if (t.label && t.label.style.visibility !== 'hidden') {
        const lr = t.label.getBoundingClientRect();
        if (clientX >= lr.left && clientX <= lr.right && clientY >= lr.top && clientY <= lr.bottom) d = 0;
      }
      if (d < bestD) { bestD = d; best = t.i; }
    }
    return bestD <= reach ? best : -1;
  }

  /** How long the player-eye read is held before the clock starts. */

  /** True once the camera has reached its shot (used by tests). */
  cameraSettled() {
    return this.cam.pos.distanceTo(this.goal.pos) < 0.05 && Math.abs(this.camera.fov - (this.fovGoal || this.baseFov || 38)) < 0.1;
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

  courtClientPoint([x, y]) {
    const r = this._rect();
    const [sx, sy] = this._project(new THREE.Vector3(x, 0.1, y));
    return [r.left + sx, r.top + sy];
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
    this.floorReflection?.setQuality(this.quality,this.camera.aspect);
    this.baseFov = this.arenaLook ? (w / h < 0.9 ? 54 : 36) : (w / h < 0.9 ? 50 : 38);
    if (this.shot !== 'pov') this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.setShot(this.shot);
  }

  _beat(b, token, slow) {
    for (const id of [b.screen].flat().filter(Boolean)) this._screeners?.add(id);
    if (this.arenaLook) b = basketballBeat(b, this.ball.holder ? {id:this.ball.holder,at:this.pos[this.ball.holder]} : null);
    if(this.arenaLook&&b.move) {
      const move={...b.move};
      for(const [id,path] of Object.entries(move))if(this.pos[id]&&Array.isArray(path[0])&&path.length>1)
        move[id]=roundedRoute([this.pos[id],...path]).slice(1);
      b={...b,move};
    }
    if (this.arenaLook && b.sfx==='squeak') b={...b,sfx:undefined};
    return super._beat(b, token, slow);
  }

  _prepareAction(b, flight, ms) {
    const who = this.players[this.ball.holder];
    const name = b.pass ? 'Pass' : b.shot ? (b.finish==='layup'?(this.kit.clips.LayupR?'LayupR':'Shot'):(this.kit.clips.JumpShot?'JumpShot':'Shot')) : null;
    const clip = this.kit.clips[name];
    if (!who || !clip) return;
    if (this.arenaLook) who.action = {
      kind: b.pass ? 'pass' : 'shot', target: b.pass,
      style: b.finish || 'jump',
      clip:name,
      start: performance.now(), duration: ms,
      releaseMs: ms * (b.prepareMs || 0) / (b.ms || 600),
      from: new THREE.Vector3(this.ball.at[0], this._ballY ?? 3.4, this.ball.at[1])
    };
    if (this.arenaLook && b.pass) this._receivingId = b.pass;
    who.athlete.trigger(name, clip.duration / (ms * PLAY_SPEED / 1000));
    flight.prepared = true;
    if (b.shot) { this._receivingId = null; this._shooter = who.id; who.airborne=false; who.landingDone=false; if (this.arenaLook&&b.finishCamera!==false) this.setShot('finish'); }
  }

  /** One-shots from what the ball just did: passes, catches, shots. */
  _cueActions() {
    const b = this.ball;
    const f = b.flight;
    if (f && f !== this._seenFlight && !f.prepared) {
      const who = this.players[this._seenHolder];
      if (who && f.kind === 'pass') who.athlete.trigger('Pass', 1.7);
      if (who && f.kind === 'shot') { this._receivingId = null; who.athlete.trigger('Shot', 1.25); this._shooter = who.id; }
    }
    if (this.arenaLook && f?.kind === 'pass') this._receivingId = f.target;
    if (b.holder && b.holder !== this._seenHolder && this._seenFlight && !b.preparing) this.players[b.holder]?.athlete.trigger('Catch', 2.2);
    if (b.rest === 'made' && this._shooter && this._celebrated !== this._seenFlight) {
      this._celebrated = this._seenFlight;
      const s = this.players[this._shooter];
      if (s?.side === 'o') this._celebrateTimer = setTimeout(() => {
        if (this.players[s.id] === s && this.active) s.athlete.trigger('Celebrate', 1.2);
      }, 350);
    }
    this._seenFlight = f || (b.holder ? null : this._seenFlight);
    if (b.holder) this._seenHolder = b.holder;
  }

  _pickLoop(p) {
    const sp = this.arenaLook&&p.isStill ? 0 : p.speed;
    if (sp > 2.5) this._screeners?.delete(p.id);
    const shotUp = this.ball.flight?.kind === 'shot' && p.id !== this._shooter && dist(this.pos[p.id], HOOP) < 16;
    const strideScale=this.arenaLook?p.athlete.root.scale.y:1;
    if (sp > 18) p.athlete.setLoop('Sprint', Math.min(1.3, Math.max(0.7, sp / (STRIDE.Sprint*strideScale))));
    else if (sp > 2.5 && p.side === 'd' && sp < 11) p.athlete.setLoop(this.arenaLook && p.slideRight ? 'DefSlideR' : 'DefSlideL', Math.min(1.5, Math.max(0.8, sp / 6)));
    else if (sp > 2.5) p.athlete.setLoop('Jog', Math.min(1.4, Math.max(0.6, sp / (STRIDE.Jog*strideScale))));
    else if (shotUp) p.athlete.setLoop('BoxOut');
    else if (this._screeners?.has(p.id)) p.athlete.setLoop('Screen');
    else if (this.ball.holder === p.id) p.athlete.setLoop('TripleThreat');
    else p.athlete.setLoop(p.side === 'd' ? 'DefStance' : 'Idle');
  }

  /** Median frame time over the first couple of seconds decides the tier, once. */
  _probeQuality(dt) {
    if (this._qualityLocked || !dt) return;
    this._probe.push(dt);
    if (this._probe.length < 90) return;
    this._qualityLocked = true;
    const sorted = this._probe.slice(20).sort((a, b) => a - b);
    if (sorted[sorted.length >> 1] > 1 / 40) { this.quality = 'low'; this._applyQuality(); }
  }

  _applyQuality() {
    const low = this.quality === 'low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2));
    const size = low ? 1024 : 2048;
    if (this.key.shadow.mapSize.x !== size) {
      this.key.shadow.mapSize.set(size, size);
      this.key.shadow.map?.dispose();
      this.key.shadow.map = null;
    }
    this.arena?.setQuality(this.quality);
    for (const player of Object.values(this.players)) player.athlete.setQuality(this.quality);
    if (this.el) this.el.dataset.quality = this.quality;
    this._resize?.();
  }

  _idleYaw(p) {
    const holder = this.ball.holder;
    let look;
    if (this.arenaLook && p.id === this._receivingId && (this.ball.flight?.kind === 'pass' || this.ball.preparing && this.ball.holder !== p.id)) look = this.pos[this._seenHolder] || HOOP;
    else if (this.arenaLook && p.action?.kind === 'pass' && performance.now() - p.action.start < p.action.duration) look = this.pos[p.action.target] || HOOP;
    else if (p.side === 'd') look = this.pos[holder] || (this.arenaLook && this.ball.flight?.kind === 'shot' ? this.pos[this._shooter] : null) || HOOP;
    else look = holder && holder !== p.id ? this.pos[holder] : HOOP;
    const me = this.pos[p.id];
    return Math.atan2(look[0] - me[0], look[1] - me[1]);
  }

  _tick(now) {
    // rAF timestamps can trail performance.now(); never let time run backwards.
    const dt = Math.max(0, Math.min(0.1, (now - this._last) / 1000));
    this._last = now;
    if (!this.loaded) return;
    const t = now / 1000;
    this._probeQuality(dt);
    this.arena.update(dt);

    this._cueActions();
    let brakingPlayer=null,largestBrake=0;
    // Figurines: face where they move, pick a loop from what they are doing.
    for (const p of Object.values(this.players)) {
      const [x, z] = this.pos[p.id];
      const vx = (x - p.prev[0]) / Math.max(dt, 1e-3);
      const vz = (z - p.prev[1]) / Math.max(dt, 1e-3);
      p.prev = [x, z];
      const speed = Math.hypot(vx, vz);
      if(speed>1.5)p.lastMoveAt=now;
      p.isStill=speed<1.5&&now-(p.lastMoveAt||0)>90;
      const braking=((p.rawSpeed || 0)-speed)/Math.max(dt,1e-3);
      if(!this.frozen&&this.arenaLook&&(p.rawSpeed||0)>7&&braking>45&&braking>largestBrake) {brakingPlayer=p;largestBrake=braking;}
      p.rawSpeed=speed;
      const beforeSpeed=p.speed;
      p.speed = damp(p.speed, speed, 10, dt);
      p.acceleration=damp(p.acceleration||0,(p.speed-beforeSpeed)/Math.max(dt,1e-3),12,dt);
      const slide = this.arenaLook && p.side === 'd' && p.speed < 11;
      const goalYaw = !slide ? travelYaw(vx,vz,this._idleYaw(p)) : this._idleYaw(p);
      p.slideRight = vx*Math.cos(p.yaw)-vz*Math.sin(p.yaw)>0;
      if (!this.frozen) p.yaw += angleDelta(p.yaw, goalYaw) * (1 - Math.exp(-9 * dt));
      p.root.rotation.y = p.yaw;
      this._pickLoop(p);
      if (!this.frozen) p.athlete.update(dt * PLAY_SPEED,p.action?.kind==='shot'?(now-p.action.start)/p.action.duration:null);
      if(!this.frozen&&this.arenaLook&&speed>1.5&&!p.athlete.oneShot)
        p.athlete.balance(new THREE.Vector3(vx,0,vz).normalize(),Math.max(-.06,Math.min(.07,p.acceleration*.0025)));
    }
    if (this.arenaLook && !this.frozen) {
      const finisher=this.players[this._shooter];
      if(finisher&&this.ball.flight?.kind==='shot') {
        const elapsed=now-(finisher.action?.start||now)-(finisher.action?.releaseMs||0);
        finisher.athlete.releaseFingers(Math.min(1,Math.max(0,elapsed/160)));
      }
      if(finisher?.action?.style==='layup'&&finisher.athlete.oneShot?.getClip().name!=='LayupR'&&now-finisher.action.start<finisher.action.duration)
        finisher.athlete.layupStride((now-finisher.action.start)/finisher.action.duration);
      const receiver = this.players[this._receivingId];
      if (receiver && (this.ball.flight?.kind === 'pass' || this.ball.preparing && this.ball.holder !== receiver.id)) {
        const target = receiver.root.localToWorld(new THREE.Vector3(-.65,3.8,.7));
        const guide = receiver.root.localToWorld(new THREE.Vector3(.35,0,0)).sub(receiver.root.position).add(target);
        receiver.athlete.reachBall(target,guide,{grip:true});
      }
      for (const player of Object.values(this.players)) {
        if (player.side !== 'd' || player.speed > 14) continue;
        const shooter = this.pos[this._shooter];
        const contest = (this.ball.flight?.kind === 'shot' || this.ball.preparing && this.players[this.ball.holder]?.action?.kind==='shot') && shooter && dist(this.pos[player.id], shooter) < 11;
        const y = contest ? 6 : 3.8;
        player.athlete.guardHands(player.root.localToWorld(new THREE.Vector3(-1.3, y, .65)), player.root.localToWorld(new THREE.Vector3(1.3, y, .65)));
      }
      const holder = this.players[this.ball.holder];
      if (holder) {
        this._renderBall(this.ball.preparing || holder.speed < 2.5 ? 0 : this._dribbleBounce || 0);
        const handTarget = this.ballMesh.position.clone();
        if (!this.ball.preparing && holder.speed > 2.5) handTarget.y = Math.max(handTarget.y + .15, 3.2);
        const guide = holder.root.localToWorld(new THREE.Vector3(.35, 0, 0)).sub(holder.root.position).add(handTarget);
        const releaseProgress = holder.action ? (now-holder.action.start)/holder.action.releaseMs : 0;
        const oneHand = this.ball.preparing && holder.action?.style==='layup' && releaseProgress>.55;
        let balance=guide;
        if(oneHand) {
          const free=holder.root.localToWorld(new THREE.Vector3(.9,4.1,.25));
          free.y+=holder.athlete.root.getObjectByName('root')?.getWorldPosition(new THREE.Vector3()).y||0;
          // Let the guide wrist leave its contact point continuously, keeping
          // the free arm relative to the rising torso rather than the floor.
          const wrist=holder.athlete.leftHand.getWorldPosition(new THREE.Vector3());
          const grip=holder.athlete.grips?.[1]?.anchor.getWorldPosition(new THREE.Vector3());
          const heldWrist=grip?handTarget.clone().sub(grip.sub(wrist)):guide;
          const t=Math.min(1,Math.max(0,(releaseProgress-.55)/.3));
          balance=heldWrist.lerp(free,t*t*(3-2*t));
        }
        holder.athlete.reachBall(handTarget, oneHand || this.ball.preparing || holder.speed < 2.5 ? balance : null,
          {grip:this.ball.preparing||holder.speed<2.5,leftGrip:!oneHand});
      }
      for (const player of Object.values(this.players)) player.athlete.plantFeet(player.speed > 2.5);
      if(finisher?.action?.kind==='shot')
        finisher.athlete.plantLayupFeet((now-finisher.action.start)/finisher.action.duration);
      if(finisher&&!finisher.landingDone) {
        const height=finisher.athlete.soleHeight();
        const contact=landingStep(finisher.airborne,height);finisher.airborne=contact.airborne;
        if(contact.landed) {
          finisher.landingDone=true;
          const point=finisher.root.position.clone().project(this.camera);
          hoopsAudio.setCourtPosition(point.x,finisher.root.position.distanceTo(this.camera.position));
          hoopsAudio.squeak(.35);
        }
      }
      if(brakingPlayer&&now-(this._shoeSoundAt||0)>220&&brakingPlayer.athlete.feet.some(f=>f.bone?.getWorldPosition(new THREE.Vector3()).y<.75)) {
        const point=brakingPlayer.root.position.clone().project(this.camera);
        hoopsAudio.setCourtPosition(point.x,brakingPlayer.root.position.distanceTo(this.camera.position));
        hoopsAudio.squeak();this._shoeSoundAt=now;
      }
      for (const player of Object.values(this.players)) {
        const aiming=player.id===this._shooter&&(this.ball.preparing||this.ball.flight?.kind==='shot');
        const target=aiming?new THREE.Vector3(HOOP[0],RIM_Y,HOOP[1]):this.ballMesh.position.clone();
        if(!aiming)target.y=Math.max(4.5,target.y);
        player.athlete.gaze(target,player.yaw);
      }
    }
    if (this.ball.holder && !this.ball.flight && this.players[this.ball.holder]?.speed < 2.5) this._renderBall(0);
    if (this._madeBall && this.ball.rest === 'made' && !this.ball.holder && !this.ball.flight && !this.frozen) {
      this._madeBall.elapsed += dt * PLAY_SPEED;
      const drop = madeBallAt(this._madeBall.elapsed, RIM_Y + 0.3, BALL_R);
      if (drop.contacts > this._madeBall.contacts) {
        // One current contact, never a burst of catch-up sounds after a pause.
        hoopsAudio.dribble(Math.max(0.12, 0.55 * 0.5 ** (drop.contacts - 1)));
        this._madeBall.contacts = drop.contacts;
      }
      this._renderBall(0);
    }
    this._updateTrail(dt);

    // Camera: damped toward the current shot; follow the ball in play.
    const g = this.goal;
    const target = g.target.clone();
    if ((this.shot === 'broadcast' || this.shot === 'decide') && this.ballMesh) {
      // A gentle lean toward the ball, never a chase — and frozen means frozen.
      const bp = this.ballMesh.position;
      if (!this.frozen && Number.isFinite(bp.x) && Number.isFinite(bp.z)) this._lean = this.arenaLook
        ? [Math.max(-1.2,Math.min(1.2,bp.x*.06)),Math.max(-.8,Math.min(.8,(bp.z-target.z)*.04))]
        : [bp.x * 0.12, (bp.z - target.z) * 0.08];
      const [lx, lz] = this._lean || [0, 0];
      target.x += lx;
      target.z += lz;
    }
    for (const k of ['x', 'y', 'z']) {
      this.cam.pos[k] = damp(this.cam.pos[k], g.pos[k], g.k, dt);
      this.cam.target[k] = damp(this.cam.target[k], target[k], g.k, dt);
    }
    const fovGoal = this.fovGoal || this.baseFov || 38;
    const fov = damp(this.camera.fov, fovGoal, 3.5, dt);
    // Finish the transition when its per-frame step becomes subpixel; stopping
    // at the previous value left a persistent gap from the requested lens.
    const nextFov = Math.abs(fov - this.camera.fov) > 0.01 ? fov : fovGoal;
    if (nextFov !== this.camera.fov) { this.camera.fov = nextFov; this.camera.updateProjectionMatrix(); }
    if (![this.cam.pos.x, this.cam.pos.y, this.cam.pos.z, this.cam.target.x, this.cam.target.y, this.cam.target.z].every(Number.isFinite)) {
      if (!this._nanReported) { this._nanReported = true; console.error('Hoops IQ camera: non-finite', JSON.stringify({ pos: this.cam.pos, target: this.cam.target, ball: this.ballMesh?.position, holder: this.ball.holder, shot: this.shot })); }
      this.cam.pos.copy(this.goal.pos);
      this.cam.target.copy(this.goal.target);
    }
    // The look-at point always stays over the table.
    this.cam.target.x = Math.max(-30, Math.min(30, this.cam.target.x));
    this.cam.target.z = Math.max(-15, Math.min(70, this.cam.target.z));
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.target);

    // Effects and pulsing markers.
    this.fx = this.fx.filter(f => {
      const k = Math.min(1, (now - f.t0) / f.dur);
      f.update(k);
      if (k >= 1) { disposeObject(f.obj); return false; }
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

    // In the player view, anyone right in front of the lens turns see-through.
    const pov = this.shot === 'pov';
    for (const p of Object.values(this.players)) {
      let goal = 1;
      if (pov && p.id !== this.you) {
        const d = Math.hypot(p.root.position.x - this.camera.position.x, p.root.position.z - this.camera.position.z);
        goal = d < 7 ? 0.22 : d < 11 ? 0.22 + (d - 7) / 4 * 0.78 : 1;
      }
      p.fade = damp(p.fade ?? 1, goal, 8, dt);
      p.athlete.setOpacity(p.fade > 0.99 ? 1 : p.fade);
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
    const pov = this.shot === 'pov';
    for (const [id, chip] of Object.entries(this.labels)) {
      // A pass choice sits on the receiver, at the exact same world point as
      // hit testing. The old outward floor offset pushed corner badges over
      // the sideline and made them look like an off-court destination.
      const [x, z] = this.pos[id];
      const out = x >= 0 ? 1 : -1;
      const pass=this.targets.find(t=>t.opt.kind==='pass'&&t.opt.to===id);
      place(chip,pass?this._target3(pass.opt):new THREE.Vector3(x+out*2.5,.1,z+1.1));
      if (pov && id === this.you) chip.style.visibility = 'hidden';
    }
    if (this.youTag) this.youTag.style.display = pov ? 'none' : '';
    if (!pov && this.youTag && this.pos[this.you]) {
      const [x, z] = this.pos[this.you];
      place(this.youTag, new THREE.Vector3(x, 8.0, z));
    }
    for (const c of this._calls || []) {
      const p = this.pos[c.id];
      if (p) place(c.el, new THREE.Vector3(p[0], 9.0, p[1]));
    }
    if (!this.targets.some(t => t.label)) return;
    // Labels must leave the touch centres and player numbers visible. World
    // offsets alone cannot do this when the side panel changes the camera crop.
    const occupied = this.targets.map(t => {
      const [x, y] = this._project(this._target3(t.opt));
      return { left: x - 24, right: x + 24, top: y - 24, bottom: y + 24 };
    });
    const bounds = this.overlay.getBoundingClientRect();
    for (const el of [...Object.values(this.labels), this.youTag, ...this.el.parentElement.querySelectorAll('.hp-view')]) {
      if (!el || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
      const r = el.getBoundingClientRect();
      occupied.push({ left: r.left - bounds.left - 6, right: r.right - bounds.left + 6,
        top: r.top - bounds.top - 6, bottom: r.bottom - bounds.top + 6 });
    }
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const t of this.targets) {
      if (!t.label) continue;
      const [ax, ay, z] = this._project(this._target3(t.opt));
      const hw = t.label.offsetWidth / 2, hh = t.label.offsetHeight / 2;
      let chosen = null;
      const offsets = [[0, -24-hh], [0, 24+hh], [24+hw, 0], [-24-hw, 0]];
      for (const radius of [60, 90, 125, 165]) {
        for (const [dx, dy] of [[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]]) offsets.push([dx*radius,dy*radius]);
      }
      for (const [dx, dy] of offsets) {
        const x = Math.max(hw+8, Math.min(W-hw-8, ax+dx));
        const y = Math.max(hh+8, Math.min(H-hh-8, ay+dy));
        const rect = {left:x-hw-4,right:x+hw+4,top:y-hh-4,bottom:y+hh+4};
        if (!occupied.some(r => overlaps(rect,r))) { chosen={x,y,rect}; break; }
      }
      t.label.style.visibility = chosen && z < 1 ? 'visible' : 'hidden';
      if (chosen) {
        t.label.style.transform = `translate(${chosen.x.toFixed(1)}px, ${chosen.y.toFixed(1)}px) translate(-50%, -50%)`;
        occupied.push(chosen.rect);
      }
    }
  }

  destroy() {
    this.sleep();
    this._ro?.disconnect();
    this.arena?.dispose();
    this.floorReflection?.dispose();
    this.renderer.dispose();
    this.el.remove();
  }
}
