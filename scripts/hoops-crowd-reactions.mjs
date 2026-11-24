/* Actual made-basket event -> instanced near spectator poses. Desktop GPU
 * checks only: no iPad performance, listening or aesthetic acceptance claim. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=process.argv[2];if(!out)throw Error('Pass an output directory');
fs.mkdirSync(out,{recursive:true});
const report={errors:[],tiers:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 for(const quality of ['high','low']){
  const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150&hoopsQuality=${quality}`);
  await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  const setup=await page.evaluate(()=>{
   const c=window.caesarApp.hoops.court;
   window.__clapMeshes=[];c.arena.root.traverse(o=>{if(o.userData.reactionPeople)window.__clapMeshes.push(o);});
   window.__sampleClaps=()=>{
    const rows=[];
    for(const o of window.__clapMeshes.filter(o=>o.visible))for(let i=0;i<o.count;i++){
     const person=o.userData.reactionPeople[i],w=Array.from(o.morphTexture.image.data.slice(i*4+1,i*4+4));
     rows.push({mesh:o.name,seed:person.seed,role:person.role,w});
    }
    return {at:performance.now(),rows};
   };
   const old=c._swish.bind(c);c._swish=function(...args){old(...args);window.__madeAt=performance.now();};
   return {loaded:c.crowdReactions,meshes:window.__clapMeshes.map(o=>({name:o.name,count:o.count,targets:o.geometry.morphAttributes.position.length,relative:o.geometry.morphTargetsRelative,texture:o.morphTexture.image.width})),neutral:window.__sampleClaps()};
  });
  assert.ok(setup.loaded);assert.ok(setup.meshes.length>=6);
  assert.ok(setup.meshes.every(m=>m.targets===3&&m.texture===4));
  assert.ok(setup.neutral.rows.every(r=>r.w.every(v=>v===0)));
  await page.locator('.hp-choice[data-choice="0"]:visible').click();
  await page.waitForFunction(()=>window.__madeAt>0);
  const samples=[];
  for(const seconds of [.18,.8,1.7,4.3]){
   await page.waitForFunction(t=>(performance.now()-window.__madeAt)/1000>=t,seconds);
   samples.push(await page.evaluate(()=>window.__sampleClaps()));
   if(seconds===.8)await page.locator('.hc3d-canvas').screenshot({path:`${out}/${quality}-made-basket.png`});
  }
  assert.ok(samples[1].rows.filter(r=>r.w.some(v=>v>.05)).length>50);
  assert.ok(samples[1].rows.filter(r=>r.role==='staff'||r.role==='away').every(r=>r.w.every(v=>v===0)));
  assert.ok(new Set(samples[1].rows.filter(r=>r.role==='fan').map(r=>r.w.map(v=>v.toFixed(2)).join(','))).size>10);
  assert.ok(samples[3].rows.every(r=>r.w.every(v=>v===0)));
  const checks=await page.evaluate(async()=>{
   const T=await import('./js/vendor/three/three.module.min.js'),c=window.caesarApp.hoops.court;
   const meshes=window.__clapMeshes;let lowerDelta=0,upperDelta=0;
   for(const o of meshes){const g=o.geometry,p=g.attributes.position,slots=g.attributes.wardrobeSlot;
    for(let i=0;i<p.count;i++)for(const target of g.morphAttributes.position){
     const v=new T.Vector3().fromBufferAttribute(target,i);
     if(!g.morphTargetsRelative)v.sub(new T.Vector3().fromBufferAttribute(p,i));
     if(slots.getX(i)===2||slots.getX(i)===4)lowerDelta=Math.max(lowerDelta,v.length());
     else upperDelta=Math.max(upperDelta,v.length());
    }
   }
   c.arena.swish();c.arena.update(.01);c.setScene(window.caesarApp.hoops.level.setup,window.caesarApp.hoops.level.you);
   const reset=window.__sampleClaps().rows.every(r=>r.w.every(v=>v===0));
   const memory=[];for(let i=0;i<6;i++){c.setScene(window.caesarApp.hoops.level.setup,window.caesarApp.hoops.level.you);c.renderer.render(c.scene,c.camera);memory.push({...c.renderer.info.memory});}
   return {lowerDelta,upperDelta,reset,memory,calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles};
  });
  report.tiers.push({quality,setup,samples,checks});
  assert.ok(checks.lowerDelta<1e-6);assert.ok(checks.upperDelta>1);assert.ok(checks.reset);
  assert.deepEqual(checks.memory.slice(1),Array(5).fill(checks.memory[1]));
  // A study camera shows the same live arena/instances, not another model.
  await page.evaluate(()=>{const c=window.caesarApp.hoops.court;c.arena.swish();});
  await page.waitForTimeout(900);
  const shadows=await page.evaluate(()=>{
   const c=window.caesarApp.hoops.court;c.sleep();c.overlay.style.display='none';
   c.camera.position.set(-9,7,-5);c.camera.lookAt(-9,3,-16);
   const gl=c.renderer.getContext(),read=()=>{c.renderer.render(c.scene,c.camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
   const on=read(),casters=window.__clapMeshes.filter(o=>o.castShadow);casters.forEach(o=>o.castShadow=false);
   c.renderer.shadowMap.needsUpdate=true;const off=read();casters.forEach(o=>o.castShadow=true);c.renderer.shadowMap.needsUpdate=true;read();
   let changed=0;for(let i=0;i<on.length;i+=4)if(Math.max(Math.abs(on[i]-off[i]),Math.abs(on[i+1]-off[i+1]),Math.abs(on[i+2]-off[i+2]))>2)changed++;
   return {casters:casters.length,changed};
  });
  assert.ok(shadows.changed>20);checks.shadows=shadows;
  await page.locator('.hc3d-canvas').screenshot({path:`${out}/${quality}-near-clap.png`});
  const disposal=await page.evaluate(()=>{const c=window.caesarApp.hoops.court;let disposed=0;for(const o of window.__clapMeshes)o.morphTexture.addEventListener('dispose',()=>disposed++);const expected=window.__clapMeshes.length;c.destroy();return {expected,disposed};});
  assert.equal(disposal.disposed,disposal.expected);checks.disposal=disposal;
  await page.close();
 }
 const legacy=await browser.newPage({serviceWorkers:'block'});
 await legacy.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsCrowdReaction=legacy&hoopsDecide=150');
 await legacy.click('#btn-hoops');await legacy.click('.hp-level[data-index="1"]');await legacy.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 report.legacy=await legacy.evaluate(()=>({casual:window.caesarApp.hoops.court.casualAudience,reactions:window.caesarApp.hoops.court.crowdReactions}));
 assert.ok(report.legacy.casual);assert.equal(report.legacy.reactions,false);await legacy.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,tiers:report.tiers.map(t=>({quality:t.quality,people:t.setup.neutral.rows.length,...t.checks}))}));
