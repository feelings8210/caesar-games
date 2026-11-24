/* GPU evidence for the projected floor: isolated ball pixels against physical
 * mirror rays, below-floor clipping, live LOD/state restoration and frame cost.
 * Local server on 8000. Desktop evidence, not iPad or aesthetic acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
if(!process.argv[2])throw new Error('Pass a review output directory, preferably on MiniStorage');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],warnings:[]};let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
 await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150&hoopsQuality=high');
 await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
 await page.evaluate(()=>window.caesarApp.hoops.court.sleep());
 const gpu=await page.evaluate(async()=>{
  const T=await import('./js/vendor/three/three.module.min.js'),c=window.caesarApp.hoops.court,ref=c.floorReflection,r=c.renderer;
  const savedBall=c.ballMesh.position.clone(),hidden=[],layers=[];
  for(const p of Object.values(c.players)){hidden.push([p.root,p.root.visible]);p.root.visible=false;}
  c.scene.traverse(o=>{if((o.isMesh||o.isLine)&&o!==c.ballMesh){layers.push([o,o.layers.mask]);o.layers.disable(1);}});
  const gl=r.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
  const pixels=()=>{const p=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
  const savedState=()=>({target:r.getRenderTarget()===null,background:c.scene.background.getHex(),clear:r.getClearColor(new T.Color()).getHex(),alpha:r.getClearAlpha(),shadow:r.shadowMap.autoUpdate,xr:r.xr.enabled,autoReset:r.info.autoReset});
  const before=savedState(),rows=[];
  try {
   for(const quality of ['high','low']){
    c.quality=quality;c._applyQuality();
    for(const position of [[3,3,18],[8,5,23],[3,-2,18]]){
     c.ballMesh.position.set(...position);ref.enabled=false;r.render(c.scene,c.camera);const off=pixels();
     const count=ref.stats.updates;ref.enabled=true;r.render(c.scene,c.camera);const on=pixels();
     const actual=c.ballMesh.position.clone(),virtual=actual.clone();virtual.y=-virtual.y;
     const ray=virtual.clone().sub(c.camera.position),point=c.camera.position.clone().addScaledVector(ray,-c.camera.position.y/ray.y);
     const view=virtual.clone().project(c.camera),expected={x:(view.x+1)*width/2,y:(view.y+1)*height/2};
     const floorUV=new T.Vector4(...point.toArray(),1).applyMatrix4(ref.matrix);floorUV.multiplyScalar(1/floorUV.w);
     const sourceUV=actual.clone().project(ref.camera);
     const uvError=Math.hypot(floorUV.x-(sourceUV.x+1)/2,floorUV.y-(sourceUV.y+1)/2);
     let weight=0,sx=0,sy=0,changed=0,maxDelta=0;
     for(let i=0;i<on.length;i+=4){const d=Math.abs(on[i]-off[i])+Math.abs(on[i+1]-off[i+1])+Math.abs(on[i+2]-off[i+2]);if(d<=5)continue;
      const pixel=i/4;changed++;weight+=d;sx+=(pixel%width)*d;sy+=Math.floor(pixel/width)*d;maxDelta=Math.max(maxDelta,d);
     }
     const centroid=weight?{x:sx/weight,y:sy/weight}:null;
     rows.push({quality,position,changed,maxDelta,centroid,expected,uvError,updates:ref.stats.updates-count,
      centreError:centroid?Math.hypot(centroid.x-expected.x,centroid.y-expected.y):null});
    }
   }
  }finally{c.ballMesh.position.copy(savedBall);for(const [o,mask] of layers)o.layers.mask=mask;for(const [o,v] of hidden)o.visible=v;c.quality='high';c._applyQuality();ref.enabled=true;r.render(c.scene,c.camera);}
  return {rows,before,after:savedState()};
 });
 report.checks.push({name:'physical-mirror-pixels-and-state',...gpu});
 for(const row of gpu.rows){
  assert.equal(row.updates,1,'one reflection pass per main render, including both floor meshes');
  if(row.position[1]>0){assert.ok(row.changed>15&&row.maxDelta>5,'real reflected pixels must reach the visible floor');assert.ok(row.centreError<7,'reflected ball must follow its physical mirror ray');assert.ok(row.uvError<1e-5,'world floor projection must sample the reflected object');}
  else assert.equal(row.changed,0,'objects entirely below the floor must not appear in its reflection');
 }
 assert.deepEqual(gpu.after,gpu.before,'nested render must restore renderer and scene state');
 const tiers=[];
 for(const q of ['high','low'])for(const enabled of [false,true]){
  const data=await page.evaluate(({q,enabled})=>{const c=window.caesarApp.hoops.court;c.quality=q;c._applyQuality();c.floorReflection.enabled=enabled;c.renderer.render(c.scene,c.camera);return {calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,reflection:c.floorReflection.stats,target:[c.floorReflection.target.width,c.floorReflection.target.height],low:c.players.o1.athlete.root.getObjectByName('HeadLOD').visible};},{q,enabled});
  assert.equal(data.low,q==='low','reflection LOD must not change the visible actor tier');tiers.push({q,enabled,...data});
  await page.screenshot({path:`${out}/${enabled?'on':'off'}-${q}.png`});
 }
 report.checks.push({name:'tier-restoration-and-total-draws',tiers});
 const memory=await page.evaluate(()=>{const c=window.caesarApp.hoops.court;c.quality='high';c._applyQuality();c.floorReflection.enabled=true;const rows=[];for(let i=0;i<6;i++){c.setScene(window.caesarApp.hoops.level.setup,window.caesarApp.hoops.level.you);c.renderer.render(c.scene,c.camera);rows.push({...c.renderer.info.memory});}return rows;});
 assert.ok(memory.every(m=>m.geometries===memory[0].geometries&&m.textures===memory[0].textures),'repeated player rebuilds must not leak reflection resources');report.checks.push({name:'scene-memory',rows:memory});
 const frames=await page.evaluate(async()=>{
  const c=window.caesarApp.hoops.court,rows=[];
  for(const enabled of [false,true]){
   c.floorReflection.enabled=enabled;const dt=[],submission=[];let previous;
   for(let i=0;i<100;i++)await new Promise(resolve=>requestAnimationFrame(t=>{const start=performance.now();c.renderer.render(c.scene,c.camera);if(i>=25){dt.push(t-previous);submission.push(performance.now()-start);}previous=t;resolve();}));
   const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length*.5)];rows.push({enabled,medianFrameMs:median(dt),medianSubmissionMs:median(submission),samples:dt.length});
  }
  c.floorReflection.enabled=true;return rows;
 });report.checks.push({name:'desktop-scheduling-and-submission-not-gpu-timing',rows:frames});
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,checks:report.checks}));
