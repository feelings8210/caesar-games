/* Compare current/legacy venue, actual seated LOD integration and geometry.
 * Local server on 8000; desktop evidence, never an art/iPad acceptance. */
import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
if(!process.argv[2])throw new Error('Pass a review output directory, preferably on MiniStorage');
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const report={errors:[],views:[]};
try{
for(const venue of ['legacy','refined']) {
 const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&m.text().includes('Shader Error'))report.errors.push(m.text());});
 await page.goto(`http://127.0.0.1:8000/?hoopsPreview=backdoor&hoopsDecide=150&hoopsQuality=high${venue==='legacy'?'&hoopsVenue=legacy':''}`);
 await page.click('#btn-hoops');await page.click('.hp-level[data-index="0"]');
 await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
 await page.evaluate(()=>window.caesarApp.hoops.court.sleep());
 for(const quality of ['high','low']) {
  const data=await page.evaluate(q=>{const c=window.caesarApp.hoops.court;c.quality=q;c._applyQuality();c.renderer.render(c.scene,c.camera);let crowds=[];c.arena.root.traverse(o=>{if(o.name.startsWith('Courtside_'))crowds.push({name:o.name,count:o.count,visible:o.visible,triangles:o.geometry.index.count/3});});return {calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,crowds};},quality);
  report.views.push({venue,quality,...data});await page.screenshot({path:`${out}/${venue}-${quality}.png`});
 }
 if(venue==='refined') {
  await page.evaluate(()=>{const c=window.caesarApp.hoops.court;c.quality='high';c._applyQuality();c.camera.position.set(-9,7,-5);c.camera.lookAt(-9,3,-16);c.renderer.render(c.scene,c.camera);});
  await page.screenshot({path:`${out}/front-row.png`});
  await page.evaluate(()=>{const c=window.caesarApp.hoops.court;c.camera.position.set(15,8,22);c.camera.lookAt(30,2,27);c.renderer.render(c.scene,c.camera);});
  await page.screenshot({path:`${out}/bench.png`});
  assert.ok(dataFor(report,'refined','high').crowds.some(o=>o.visible&&o.count>10));
  assert.ok(dataFor(report,'refined','low').crowds.some(o=>o.visible&&o.name.includes('Low')));
 }
 await page.close();
}
assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/capture-report.json`,JSON.stringify(report,null,2));}
function dataFor(r,v,q){return r.views.find(o=>o.venue===v&&o.quality===q);}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,views:report.views.map(({venue,quality,calls,triangles})=>({venue,quality,calls,triangles}))}));
