/* Original venue geometry. The score displays share one small canvas and
 * update only when the training HUD changes. No extra scene render or lights. */
import * as THREE from '../../vendor/three/three.module.min.js';

export function buildArchitecture(root, mats, ribbon) {
  const group=new THREE.Group();group.name='ArenaArchitecture';root.add(group);
  const steel=new THREE.MeshStandardMaterial({color:0x41464C,roughness:.62,metalness:.65});
  const ceiling=new THREE.MeshStandardMaterial({color:0x30343B,roughness:.93});
  const lamp=new THREE.MeshBasicMaterial({color:0xD6D4CA,toneMapped:false});
  const addBox=(w,h,d,m,x,y,z,parent=group)=>{
    const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;
  };
  const rod=(a,b,r)=>{
    const d=b.clone().sub(a),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),steel);
    o.position.copy(a).lerp(b,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(o);
  };
  // Recessed ceiling bays, open triangular trusses and catwalk rails establish
  // depth above the seating bowl, rather than a single black vertical wall.
  addBox(178,.5,220,ceiling,0,58,38);
  for(let z=-62;z<=128;z+=19){
    addBox(176,.28,.32,steel,0,50,z);addBox(176,.28,.32,steel,0,54,z);
    for(let x=-84;x<84;x+=12){
      rod(new THREE.Vector3(x,50,z),new THREE.Vector3(x+6,54,z),.11);
      rod(new THREE.Vector3(x+6,54,z),new THREE.Vector3(x+12,50,z),.11);
    }
    addBox(174,.08,1.6,mats.rail,0,50.2,z);
    for(const x of [-60,-40,-20,0,20,40,60]){
      const housing=addBox(2.6,.7,1.8,mats.backing,x,49.5,z);
      const lens=addBox(2.1,.09,1.35,lamp,x,49.12,z);
      housing.rotation.z=x<0?-.16:.16;lens.rotation.z=housing.rotation.z;
    }
  }
  const acoustic=new THREE.MeshStandardMaterial({color:0x575853,roughness:1});
  const trim=new THREE.MeshBasicMaterial({color:0x827A63,toneMapped:false});
  for(let x=-78;x<=78;x+=12){
    const panel=addBox(10.8,9,.45,acoustic,x,45,-77.5);panel.rotation.y=x%24===0?.07:-.07;
    addBox(10.7,.06,.2,trim,x,40.5,-77.1);
  }
  for(const side of [-1,1])for(let z=-56;z<=128;z+=12){
    addBox(.45,9,10.8,acoustic,side*87.5,45,z);
    addBox(.2,.06,10.7,trim,side*87.1,40.5,z);
  }
  // Fascia beneath the upper tier turns around the visible bowl. Ribbon
  // pixels stay restrained; their placement carries the venue scale.
  const fascia=(length,x,y,z,yaw)=>{
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;group.add(g);
    addBox(length,2.2,1,mats.backing,0,0,0,g);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(length,1.15),ribbon);
    screen.position.z=.53;g.add(screen);
    addBox(length,.12,1.2,steel,0,1.1,0,g);
  };
  fascia(137,0,20.6,-60.8,0);
  fascia(144,73,19.5,47,-Math.PI/2);
  fascia(144,-73,19.5,47,Math.PI/2);

  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const display=new THREE.MeshBasicMaterial({map:texture,color:0xCCD0D4,toneMapped:false});
  for(const side of [-1,1]){
    const g=new THREE.Group();g.position.set(side*54,37,-63);g.rotation.y=-side*.36;group.add(g);
    addBox(19.4,8.5,.8,mats.backing,0,0,0,g);
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(18.4,6.9),display);screen.position.z=.43;g.add(screen);
    addBox(19.4,.16,1,steel,0,-4.25,0,g);
    for(const x of [-7,7])addBox(.15,23,.15,steel,x,15,-.25,g);
  }
  let previous='';
  const setScore=({home=0,away=0,clock='HOOPS IQ',note='TRAINING'}={})=>{
    const key=JSON.stringify([home,away,clock,note]);if(key===previous)return;previous=key;
    ctx.fillStyle='#09131E';ctx.fillRect(0,0,1024,384);
    ctx.fillStyle='#23436B';ctx.fillRect(0,74,480,212);
    ctx.fillStyle='#64312D';ctx.fillRect(544,74,480,212);
    ctx.textAlign='center';ctx.fillStyle='#E9E6DD';ctx.font='600 38px Arial';
    ctx.fillText('HOME',240,121);ctx.fillText('AWAY',784,121);
    ctx.font='700 136px Arial';ctx.fillText(String(home),240,260);ctx.fillText(String(away),784,260);
    ctx.fillStyle='#D8BB7D';ctx.font='600 36px Arial';ctx.fillText(clock,512,47);
    ctx.fillStyle='#B0B9C4';ctx.font='500 29px Arial';ctx.fillText(note,512,346);
    texture.needsUpdate=true;
  };
  setScore();return {group,setScore};
}
