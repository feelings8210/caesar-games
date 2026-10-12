/* Original courtside set and near audience, using the project's approved
 * Blender seated geometry. Static instances share buffers; no remote assets. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { mergeGeometries } from '../../vendor/three/addons/BufferGeometryUtils.js';

const shirts = [0xD9D1C2,0x354351,0x812E28,0xA89984,0x262729,0x6C7880,0xC1B39D,0x243C58];
const skins = [0xB47B56,0x70472E,0xD4A17B,0x4E3021,0xBD8E6C];
const hash = n => { const v=Math.sin(n*127.1+31.7)*43758.5453; return v-Math.floor(v); };

export function buildCourtside(root, seats, template, {casual=false}={}) {
  const source=[];
  template?.updateMatrixWorld(true);
  template?.traverse(o=>{if(o.isMesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);source.push({name:o.name,g});}});
  const batches=new Map();
  const slots={Skin:0,Face:0,Jersey:1,Shorts:2,Hair:3,Shoe:4,EyeSclera:5,EyeIris:6,EyePupil:6};
  for(const {name,g} of source){
    const match=name.match(/^(Seated(?:Low)?\d)_/);if(!match){g.dispose();continue;}
    for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
    g.setAttribute('wardrobeSlot',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(slots[name.split('_')[1]]??0),1));
    if(!batches.has(match[1]))batches.set(match[1],[]);batches.get(match[1]).push(g);
  }
  const rows=[];
  // The closest row uses complete seated humans at human scale.
  seats.forEach(([stand,x,y,z],i)=>{
    if(stand.position.y>1||y>2||i%17===0)return;
    const p=new THREE.Vector3(x,y-(casual?1.535:1.45),z+.1).applyMatrix4(stand.matrixWorld);
    const floor=new THREE.Vector3(x,y-1.5,z).applyMatrix4(stand.matrixWorld).y;
    rows.push({p,q:stand.getWorldQuaternion(new THREE.Quaternion()),seed:i,role:'fan',floor});
  });
  const mat = new THREE.MeshStandardMaterial({roughness:.88,envMapIntensity:.18});
  const palette=values=>values.map(v=>new THREE.Color(v));
  mat.onBeforeCompile=shader=>{
    shader.uniforms.fanShirts={value:palette(shirts)};shader.uniforms.fanSkins={value:palette(skins)};
    shader.uniforms.fanPants={value:palette([0x292C31,0x354657,0x686253])};shader.uniforms.fanHair={value:palette([0x171413,0x433026,0x76685A])};
    shader.uniforms.benchColours={value:palette([0x254B79,0x863E32,0x43494B])};
    shader.vertexShader=`attribute float wardrobeSlot;attribute float fanSeed;attribute float fanRole;attribute float fanHeight;
      uniform vec3 fanShirts[8];uniform vec3 fanSkins[5];uniform vec3 fanPants[3];uniform vec3 fanHair[3];uniform vec3 benchColours[3];
      varying vec3 vFanColour;float fanRandom(float n){return fract(sin(n*127.1+31.7)*43758.5453);}\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
      vFanColour=fanSkins[int(floor(fanRandom(fanSeed+7.)*5.))];
      if(wardrobeSlot>.5&&wardrobeSlot<1.5)vFanColour=fanRole<.5?fanShirts[int(floor(fanRandom(fanSeed+9.)*8.))]:benchColours[int(fanRole)-1];
      if(wardrobeSlot>1.5&&wardrobeSlot<2.5)vFanColour=fanPants[int(floor(fanRandom(fanSeed+10.)*3.))];
      if(wardrobeSlot>2.5&&wardrobeSlot<3.5)vFanColour=fanHair[int(floor(fanRandom(fanSeed+11.)*3.))];
      if(wardrobeSlot>3.5&&wardrobeSlot<4.5)vFanColour=mod(fanSeed,3.)>.5?vec3(.65,.62,.57):vec3(.018);
      if(wardrobeSlot>4.5&&wardrobeSlot<5.5)vFanColour=vec3(.68,.57,.46);
      if(wardrobeSlot>5.5)vFanColour=vec3(.012,.009,.007);`);
    if(casual){
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(transformed.y>1.65)transformed.y=1.65+(transformed.y-1.65)*fanHeight;');
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(position.y>1.65)objectNormal.y/=fanHeight;');
    }
    shader.fragmentShader='varying vec3 vFanColour;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vFanColour;');
  };
  mat.customProgramCacheKey=()=> `hoops-seated-palette-v${casual?2:1}`;
  const shadow=casual?new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}):null;
  if(shadow){
    shadow.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float fanHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(transformed.y>1.65)transformed.y=1.65+(transformed.y-1.65)*fanHeight;');
    };
    shadow.customProgramCacheKey=()=> 'hoops-casual-shadow-v1';
  }
  const metal = new THREE.MeshStandardMaterial({color:0x222529,roughness:.48,metalness:.55});
  const upholstery = new THREE.MeshStandardMaterial({color:0x222D39,roughness:.85});
  const addBox=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);root.add(o);return o;};
  const chair=(x,z,yaw)=>{
    const group=new THREE.Group(); group.position.set(x,casual?-.02:0,z);group.rotation.y=yaw;root.add(group);
    const b=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);group.add(o);};
    const seatY=casual?1.51:1.42;
    b(1.65,.16,1.6,upholstery,0,seatY,0); b(1.65,1.2,.15,upholstery,0,casual?2.19:2.1,-.72);
    for(const s of [-1,1])for(const z of [-.6,.6])b(.08,casual?1.51:1.4,.08,metal,s*.68,casual?.755:.7,z);
  };
  // Team benches flank the midcourt scorer's desk on the same sideline.
  for(const [team,z0] of [['home',17],['away',62]])for(let i=0;i<7;i++){
    const z=z0+i*2.5;chair(30.5,z,-Math.PI/2);
    rows.push({p:new THREE.Vector3(30.5,.02,z),q:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2),seed:400+i,role:team});
  }
  const desk=new THREE.Group();desk.name='ScorersTable';root.add(desk);
  const desktop=new THREE.MeshStandardMaterial({color:0x33373C,roughness:.5});
  addBox(2.6,2.65,15,metal,29.8,1.33,47);
  addBox(3.1,.16,15.3,desktop,29.8,2.76,47);
  const board=document.createElement('canvas');board.width=1024;board.height=160;
  const ctx=board.getContext('2d');ctx.fillStyle='#101A27';ctx.fillRect(0,0,1024,160);
  ctx.fillStyle='#E3BC73';ctx.fillRect(0,0,1024,5);
  ctx.font='700 64px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#E6E8E6';ctx.fillText('HOOPS IQ',512,78);
  const texture=new THREE.CanvasTexture(board);texture.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(14.5,2.1),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,color:0xB9BEC4}));
  screen.rotation.y=-Math.PI/2;screen.position.set(28.48,1.5,47);root.add(screen);
  for(let i=0;i<4;i++){
    const z=41.5+i*3.6;chair(32.4,z,-Math.PI/2);
    rows.push({p:new THREE.Vector3(32.4,.02,z),q:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2),seed:500+i,role:'staff'});
    addBox(.13,.72,1.1,metal,29.5,3.17,z);
    addBox(.03,.53,.9,new THREE.MeshBasicMaterial({color:0x719097,toneMapped:false}),29.59,3.19,z);
    addBox(.5,.06,1,desktop,30.1,2.87,z);
  }
  // Baseline camera operators: compact original equipment, away from the lane.
  for(const x of [-20,-15,15,20]){
    chair(x,-9.8,0);
    rows.push({p:new THREE.Vector3(x,.03,-9.8),q:new THREE.Quaternion(),seed:600+x,role:'staff'});
    addBox(.8,.5,.65,metal,x,2.52,-8.3);
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,.5,10),metal);lens.rotation.x=Math.PI/2;lens.position.set(x,2.52,-7.8);root.add(lens);
  }
  // Bottles and equipment beside the benches anchor them to a working sideline.
  const bottleMat=new THREE.MeshStandardMaterial({color:0x6EAAA7,roughness:.25,metalness:.15});
  for(const z of [15,34,60,81]){
    addBox(2,1.5,2,upholstery,32, .75,z);
    for(let i=0;i<3;i++){
      const b=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,.65,8),bottleMat);b.position.set(31.5+i*.5,1.87,z);root.add(b);
    }
  }
  // One merged draw per pose/cohort; palette slots retain skin and clothing colour.
  const meshes=[]; const m4=new THREE.Matrix4(), scale=new THREE.Vector3();
  const detailed=row=>row.role!=='fan'||row.seed%8===0;
  for(const [name,parts] of batches){
    const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!merged)continue;
    const variant=Number(name.match(/^Seated(?:Low)?(\d)$/)?.[1]);
    if(!Number.isFinite(variant)){merged.dispose();continue;}
    const low=name.startsWith('SeatedLow');
    for(const cohort of low?['always','fallback']:['high']){
      const people=rows.filter(r=>Math.floor(hash(r.seed)*3)===variant && (cohort==='always'?!detailed(r):detailed(r)));
      if(!people.length)continue;
      const g=merged.clone(),mesh=new THREE.InstancedMesh(g,mat,people.length);
      mesh.name=`Courtside_${name}_${cohort}`;mesh.receiveShadow=true;mesh.userData.cohort=cohort;
      if(shadow){mesh.castShadow=true;mesh.customDepthMaterial=shadow;}
      g.setAttribute('fanSeed',new THREE.InstancedBufferAttribute(new Float32Array(people.map(p=>p.seed)),1));
      g.setAttribute('fanRole',new THREE.InstancedBufferAttribute(new Float32Array(people.map(p=>({fan:0,home:1,away:2,staff:3}[p.role]))),1));
      g.setAttribute('fanHeight',new THREE.InstancedBufferAttribute(new Float32Array(people.map(p=>p.role==='fan'?.88+hash(p.seed+2)*.14:1)),1));
      people.forEach((row,i)=>{
        const h=row.role==='fan'?.88+hash(row.seed+2)*.14:1;
        scale.set(casual?.86+hash(row.seed+4)*.14:h*(.91+hash(row.seed+4)*.15),casual?1:h,casual?1:h);
        if(casual&&row.role!=='fan')row.p.y=-.055;
        const q=row.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(hash(row.seed+5)-.5)*.22));
        mesh.setMatrixAt(i,m4.compose(row.p,q,scale));
      });root.add(mesh);meshes.push(mesh);
    }merged.dispose();
  }
  function setQuality(q){for(const m of meshes){
    m.visible=m.userData.cohort==='always'||(m.userData.cohort==='fallback'?q==='low':q!=='low');
    if(casual)m.castShadow=q!=='low'||m.userData.cohort==='fallback';
  }}
  setQuality('high');
  return {meshes,rows:rows.length,setQuality,dispose:()=>shadow?.dispose()};
}
