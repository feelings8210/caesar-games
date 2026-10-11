/* Check the baked layup against actual shoe skin in high/low tiers and recover
 * its pose after a render stall. Desktop evidence; never an iPad art verdict. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=path.resolve(process.argv[2]||'review/hoops-motion');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/?hoopsDecide=150&hoopsQuality=high');
 await page.click('#btn-hoops');await page.click('.hp-level[data-index="0"]');
 await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 const motion=await page.evaluate(async()=>{
  const T=await import('./js/vendor/three/three.module.min.js'),c=window.caesarApp.hoops.court;c.cancel();c.sleep();
  const a=c.players.o2.athlete,clip=c.kit.clips.LayupR;
  const missing=clip.tracks.map(t=>t.name.split('.')[0]).filter(n=>!a.root.getObjectByName(n));
  const skinMinimum=()=>{
   let min=Infinity;a.root.updateWorldMatrix(true,true);
   a.root.traverse(o=>{if(o.isSkinnedMesh&&o.material?.name==='Shoe')
    for(let i=0;i<o.geometry.attributes.position.count;i++)min=Math.min(min,o.getVertexPosition(i,new T.Vector3()).applyMatrix4(o.matrixWorld).y);
   });return min;
  };
  const tiers=[];
  for(const quality of ['high','low']) {
   a.setQuality(quality);a.mixer.stopAllAction();const action=a.actions.LayupR;action.reset().setEffectiveWeight(1).play();
   const frames=[];
   for(let frame=0;frame<=75;frame++) {
    a.mixer.setTime(Math.min(clip.duration-.00001,frame/60));a.root.updateWorldMatrix(true,true);
    const phase=frame/75;frames.push({phase,shoeSkinMin:skinMinimum(),markerMin:a.soleHeight()});
   }
   tiers.push({quality,frames});
  }
  // Fade is already established before the simulated stall; the next render
  // gets a tiny delta but the ball runner is at the authored release phase.
  a.mixer.stopAllAction();a.setQuality('high');a.trigger('LayupR',clip.duration/1.15);
  a.update(.14,.12);a.update(.001,650/1150);
  const recovered={time:a.oneShot.time,expected:clip.duration*650/1150,shoeSkinMin:skinMinimum()};
  a.mixer.stopAllAction();a.oneShot=null;a.loopName=null;a.setLoop('Idle');
  a.trigger('LayupR',clip.duration/1.15);a.update(.001,650/1150);
  const startupStall={time:a.oneShot.time,expected:clip.duration*650/1150,shoeSkinMin:skinMinimum()};
  c.renderer.render(c.scene,c.camera);
  return {clip:clip.name,duration:clip.duration,missing,tiers,recovered,startupStall};
 });
 report.checks.push(motion);
 assert.equal(motion.clip,'LayupR');assert.deepEqual(motion.missing,[]);
 for(const tier of motion.tiers) {
  assert.ok(tier.frames.every(f=>Number.isFinite(f.shoeSkinMin)&&f.shoeSkinMin>-.035),'actual shoe skin must not cross the floor');
  assert.ok(tier.frames.some(f=>f.shoeSkinMin>1),'layup must leave the ground');
  assert.ok(tier.frames.at(-1).shoeSkinMin<.05,'actual skin must return to floor');
  assert.ok(tier.frames.every(f=>Math.abs(f.shoeSkinMin-f.markerMin)<.06),'contact markers must follow the actual deformed shoe');
 }
 assert.ok(Math.abs(motion.recovered.time-motion.recovered.expected)<.001&&motion.recovered.shoeSkinMin>.8,'baked pose must recover to airborne release after a stalled render');
 assert.ok(Math.abs(motion.startupStall.time-motion.startupStall.expected)<.001&&motion.startupStall.shoeSkinMin>.8,'a stall during fade-in must not keep release blended into a grounded pose');
 await page.screenshot({path:`${out}/recovered-release.png`});
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure}));
