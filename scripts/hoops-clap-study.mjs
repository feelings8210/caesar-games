/* Study the actual imported clap targets in the current game renderer.
 * Not a game integration/Owner acceptance; inspect before installing. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});const report={errors:[],frames:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150&clapVersion='+(process.env.HOOPS_CLAP_VERSION||'v2'));await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');
 await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 report.meshes=await page.evaluate(async()=>{
  const T=await import('./js/vendor/three/three.module.min.js'),{GLTFLoader}=await import('./js/vendor/three/addons/GLTFLoader.js');
  const version=new URLSearchParams(location.search).get('clapVersion');
  const gltf=await new GLTFLoader().loadAsync('/review/hoops-nba-20261010/crowd-clap-study/crowd-clap-'+version+'.glb');
  const c=window.caesarApp.hoops.court;c.sleep();c.arena.root.visible=false;c.overlay.style.display='none';c.clearMarkers();
  for(const p of Object.values(c.players))p.root.visible=p.ring.visible=false;
  c.ballMesh.visible=false;c.floorReflection.enabled=false;
  const colours={Skin:0xB47B56,Face:0xB47B56,Jersey:0x354351,Shorts:0x354657,Hair:0x181412,Shoe:0x77736C,EyeSclera:0xD6C5AF,EyeIris:0x17120D,EyePupil:0x080706};
  const group=new T.Group();group.position.set(-7,0,9);c.scene.add(group);window.__clapStudy={group,meshes:[],T};
  const result=[];
  gltf.scene.traverse(o=>{if(!o.isMesh)return;const match=o.name.match(/^Seated(Low)?(\d)_/);if(!match)return;
   o.material=new T.MeshStandardMaterial({color:colours[o.name.split('_')[1]]||0xB47B56,roughness:.88});o.castShadow=true;
   window.__clapStudy.meshes.push(o);result.push({name:o.name,targets:o.morphTargetDictionary,matrix:o.matrix.toArray(),count:o.geometry.attributes.position.count});
  });group.add(gltf.scene);return result;
 });
 assert.ok(report.meshes.every(m=>Number.isInteger(m.targets?.ClapOpen)&&Number.isInteger(m.targets?.ClapClosed)));
 const hasLift=report.meshes.every(m=>Number.isInteger(m.targets?.ClapLift));
 const frames=hasLift?[['rest',[0,0,0]],['lift',[1,0,0]],['open',[0,1,0]],['touch',[0,0,1]],['mid-clap',[0,.5,.5]]]:[['rest',[0,0]],['lift',[.5,0]],['open',[1,0]],['touch',[0,1]],['mid-clap',[.5,.5]]];
 for(const quality of ['high','low'])for(const variant of [0,1,2])for(const [name,weights] of frames){
  const data=await page.evaluate(({quality,variant,weights,part})=>{
   const c=window.caesarApp.hoops.court,s=window.__clapStudy;const bounds=new s.T.Box3();
   for(const o of s.meshes){o.visible=o.name.startsWith(`Seated${quality==='low'?'Low':''}${variant}_`)&&(!part||o.name.endsWith('_'+part));o.morphTargetInfluences.splice(0,weights.length,...weights);}
   s.group.updateMatrixWorld(true);c.camera.position.set(-7,5,17);c.camera.lookAt(-7,2.5,9);c.renderer.render(c.scene,c.camera);
   let delta=0,lowerDelta=0;const v=new s.T.Vector3(),base=new s.T.Vector3();
   for(const o of s.meshes.filter(o=>o.visible))for(let i=0;i<o.geometry.attributes.position.count;i++){
    base.fromBufferAttribute(o.geometry.attributes.position,i);o.getVertexPosition(i,v);delta=Math.max(delta,v.distanceTo(base));
    if(/_(Shorts|Shoe)$/.test(o.name))lowerDelta=Math.max(lowerDelta,v.distanceTo(base));bounds.expandByPoint(v.clone().applyMatrix4(o.matrixWorld));
   }
   return {delta,lowerDelta,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
  },{quality,variant,weights,part:process.env.HOOPS_CLAP_PART||null});
  assert.ok(data.lowerDelta<1e-6);assert.ok(name==='rest'||data.delta>.1);
  report.frames.push({quality,variant,name,weights,...data});await page.locator('.hc3d-canvas').screenshot({path:`${out}/${quality}-${variant}-${name}.png`});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,frames:report.frames.length,errors:report.errors,failure:report.failure}));
