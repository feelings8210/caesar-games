/* Actual deformed head vertices in both tiers, identity stability through animated poses, and private portrait studies. Not an art acceptance. */
import fs from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
if(!process.argv[2])throw Error('Pass an output directory, preferably on MiniStorage');const out=process.argv[2];fs.mkdirSync(out,{recursive:true});const report={players:[],errors:[]};
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined}),p=await b.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{

await p.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsQuality=high&hoopsDecide=150');await p.click('#btn-hoops');await p.click('.hp-level[data-index="1"]');await p.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');await p.evaluate(()=>window.caesarApp.hoops.court.sleep());
for(const id of ['o1','o2','o3','o4','o5','d1','d2','d3','d4','d5']){
 const data=await p.evaluate(async id=>{
  const T=await import('./js/vendor/three/three.module.min.js'),c=window.caesarApp.hoops.court,player=c.players[id],a=player.athlete;
  for(const who of Object.values(c.players)){who.root.visible=who===player;who.ring.visible=false;}
  player.root.position.set(0,0,14);player.root.rotation.y=0;a.oneShot=null;a.loopName=null;a.mixer.stopAllAction();a.setLoop('Idle');a.update(.2);a.setQuality('high');
  let face;a.root.getObjectByName('AnatomicalHead').traverse(o=>{if(o.isMesh&&o.material.name==='Skin')face=o;});
  const weights=face.morphTargetInfluences.slice();const moved=Array.from({length:face.geometry.attributes.position.count},(_,i)=>face.getVertexPosition(i,new T.Vector3()));
  face.morphTargetInfluences.fill(0);let delta=0;
  for(let i=0;i<moved.length;i++)delta=Math.max(delta,moved[i].distanceTo(face.getVertexPosition(i,new T.Vector3())));
  face.morphTargetInfluences.splice(0,weights.length,...weights);
  for(let i=0;i<100;i++)a.update(1/60);let lowFace;a.root.getObjectByName('HeadLOD').traverse(o=>{if(o.isMesh&&o.material.name==='Skin')lowFace=o;});const lowWeights=lowFace.morphTargetInfluences.slice();const lowPositions=Array.from({length:lowFace.geometry.attributes.position.count},(_,i)=>lowFace.getVertexPosition(i,new T.Vector3()));lowFace.morphTargetInfluences.fill(0);let lowDelta=0;for(let i=0;i<lowPositions.length;i++)lowDelta=Math.max(lowDelta,lowPositions[i].distanceTo(lowFace.getVertexPosition(i,new T.Vector3())));lowFace.morphTargetInfluences.splice(0,lowWeights.length,...lowWeights);a.setQuality('low');if(!lowFace.visible||JSON.stringify(lowWeights)!==JSON.stringify(weights))throw Error('LOD face identity lost');a.setQuality('high');
  const after=face.morphTargetInfluences.slice(),centre=a.head.getWorldPosition(new T.Vector3());centre.y+=.46*a.root.scale.y;
  c.camera.position.copy(centre).add(new T.Vector3(-2.3,.35,4.2));c.camera.lookAt(centre);c.camera.fov=24;c.camera.updateProjectionMatrix();c.renderer.render(c.scene,c.camera);
  return {id,variant:a.faceVariant,weights,lowWeights,lowDelta,after,actualMorphDelta:delta};
 },id);report.players.push(data);assert.ok(data.actualMorphDelta>.004);assert.ok(data.lowDelta>.004);assert.deepEqual(data.after,data.weights);
 await p.evaluate(()=>{document.querySelector('.hc3d-labels').style.display='none';});await p.locator('.hc3d-canvas').screenshot({path:`${out}/${id}.png`});
}
assert.equal(new Set(report.players.map(x=>JSON.stringify(x.weights))).size,10);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}console.log(JSON.stringify(report));
