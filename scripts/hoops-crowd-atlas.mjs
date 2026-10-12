/* Same-game-camera comparison and multiview/LOD/resource checks.
 * Desktop evidence; visual quality and iPad acceptance remain separate. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=process.argv[2];if(!out)throw new Error('Pass an SSD output directory');fs.mkdirSync(out,{recursive:true});
const report={errors:[],external:[],views:[],memory:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 for(const depth of ['legacy','multiview']){
  const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8000/')&&!r.url().startsWith('data:'))report.external.push(r.url());});
  await page.addInitScript(()=>{let seed=1031;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);});
  await page.goto(`http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150&hoopsCrowdDepth=${depth}`);
  await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
  await page.evaluate(()=>window.caesarApp.hoops.court.sleep());
  for(const quality of ['high','low']){
   const data=await page.evaluate(q=>{const c=window.caesarApp.hoops.court;c.quality=q;c._applyQuality();c.renderer.render(c.scene,c.camera);c._layoutLabels();const m=c.scene.getObjectByName('AudienceMultiview');return {calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,impostorCount:m?.geometry.instanceCount,fanCount:m?.userData.fanCount,map:m?[m.material.map.image.width,m.material.map.image.height]:null};},quality);
   report.views.push({depth,quality,...data});await page.screenshot({path:`${out}/${depth}-${quality}.png`});
  }
  if(depth==='multiview'){
   for(const [name,p,target] of [['mid-front',[0,9,-8],[0,6,-22]],['mid-side',[15,9,25],[40,9,25]],['high-angle',[-15,28,-3],[0,9,-24]],['backside',[0,10,-44],[0,8,-24]]]){
    await page.evaluate(({p,target})=>{const c=window.caesarApp.hoops.court;c.quality='high';c._applyQuality();c.camera.position.set(...p);c.camera.lookAt(...target);c.renderer.render(c.scene,c.camera);c._layoutLabels();},{p,target});
    await page.screenshot({path:`${out}/${name}.png`});
   }
   for(let i=0;i<6;i++){
    report.memory.push(await page.evaluate(()=>{const c=window.caesarApp.hoops.court;c.setScene(window.caesarApp.hoops.level.setup,window.caesarApp.hoops.level.you);c.renderer.render(c.scene,c.camera);return {...c.renderer.info.memory};}));
   }
   assert.deepEqual(report.memory.at(-1),report.memory.at(-2),'scene rebuild resources must plateau');
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.caesarApp.hoops.court.wake());
   await page.evaluate(()=>window.caesarApp.hoops.startLevel(1));await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
   await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`${out}/phone.png`});
  }
  await page.close();
 }
 const high=report.views.find(v=>v.depth==='multiview'&&v.quality==='high');
 const low=report.views.find(v=>v.depth==='multiview'&&v.quality==='low');
 assert.deepEqual(high.map,[1024,1536]);assert.ok(high.impostorCount>2000);
 assert.equal(low.impostorCount,Math.ceil(high.impostorCount/2));
 assert.ok(high.triangles<report.views.find(v=>v.depth==='legacy'&&v.quality==='high').triangles);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
