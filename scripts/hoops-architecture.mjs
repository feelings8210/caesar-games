/* Normal UI camera comparison, score/clock integration and a labelled roof study. Desktop evidence, not an art or iPad acceptance. */
import fs from 'node:fs';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
if(!process.argv[2])throw Error('Pass an output directory, preferably on MiniStorage');const out=process.argv[2];fs.mkdirSync(out,{recursive:true});const report={views:[],errors:[]};
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{for(const legacy of [true,false]){
const p=await b.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await p.goto(`http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsQuality=high&hoopsDecide=150${legacy?'&hoopsStructure=legacy&hoopsSkin=legacy':''}`);await p.click('#btn-hoops');await p.click('.hp-level[data-index="1"]');await p.waitForFunction(()=>window.caesarApp.hoops.phase==='decide'&&window.caesarApp.hoops.court.cameraSettled());
for(const shot of ['decide','pov']){
 if(shot==='pov')await p.click('.hp-view');await p.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());await p.screenshot({path:`${out}/${legacy?'legacy':'new'}-${shot}.png`});
 report.views.push(await p.evaluate(s=>{const c=window.caesarApp.hoops.court;return {shot:s,structure:c.structureLook,skin:c.skinLook,calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles};},shot));
}
await p.evaluate(()=>{const c=window.caesarApp.hoops.court;c.sleep();c.camera.position.set(0,10,12);c.camera.lookAt(0,30,-62);c.camera.fov=65;c.camera.updateProjectionMatrix();c.renderer.render(c.scene,c.camera);document.querySelector('.hc3d-labels').style.display='none';});await p.screenshot({path:`${out}/${legacy?'legacy':'new'}-structure-study.png`});
if(!legacy){const score=await p.evaluate(()=>{const h=window.caesarApp.hoops;h.current={...h.level,hud:{score:[88,86]}};h.homeBonus=2;h.clock=12.4;h._renderHud();const c=h.court;let t;c.arena.root.traverse(o=>{if(o.isMesh&&o.material.map?.image?.width===1024&&o.material.map.image.height===384)t=o.material.map;});return {hud:h.$('.hp-hud-score').textContent,clock:h.$('.hp-hud-clock').textContent,textureVersion:t?.version};});assert.ok(score.hud.includes('90')&&score.hud.includes('86'));assert.ok(score.textureVersion>1);report.score=score;await p.evaluate(()=>{const c=window.caesarApp.hoops.court;c.renderer.render(c.scene,c.camera);});await p.screenshot({path:`${out}/score-study.png`});}
await p.close();}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await b.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}console.log(JSON.stringify(report));
