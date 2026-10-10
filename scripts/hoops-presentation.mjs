/* Realtime presentation checks: identity dimensions, actual LOD, full court,
 * shot framing, and return to the read. Desktop evidence, never iPad claims. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const out = path.resolve(process.argv[2] || 'review/hoops-presentation'); fs.mkdirSync(out,{recursive:true});
const origin='http://127.0.0.1:8127', server=spawn('python3',['-m','http.server','8127','--bind','127.0.0.1'],{stdio:'ignore'});
const report={checks:[],errors:[]};let browser;
try {
  for(let i=0;i<50;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(`${origin}/?hoopsPreview=drive-kick&hoopsDecide=150`);
  await page.click('#btn-hoops'); await page.click('.hp-level[data-index="1"]');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  const identity=await page.evaluate(()=>{
    const c=window.caesarApp.hoops.court,a=c.players.o1.athlete;
    for(let i=0;i<600;i++){a.update(1/60);a.gaze(c.ballMesh.position,c.players.o1.yaw);}
    const last=a.head.quaternion.clone();for(let i=0;i<60;i++){a.update(1/60);a.gaze(c.ballMesh.position,c.players.o1.yaw);}
    const gazeDrift=last.angleTo(a.head.quaternion);
    return { gazeDrift, head:a.root.getObjectByName('Head').scale.toArray(),arm:a.root.getObjectByName('upperarm_r').scale.toArray(),
      farCourt:c.scene.getObjectByName('FarCourt')?.position.z,farHoop:c.scene.getObjectByName('FarHoop')?.position.z,
      arena:c.arenaLook, previewUnlocked:window.caesarApp.hoops.unlocked(1),stars:window.caesarApp.hoops.progress.stars['drive-kick'] };
  });
  assert.ok(identity.arena&&identity.previewUnlocked&&identity.farCourt===70.5&&identity.farHoop===94);
  assert.ok(Math.abs(identity.arm[0]-.872)<1e-6&&Math.abs(identity.head[0]-.95)<1e-6,'identity must not shrink each frame');
  assert.equal(identity.stars,undefined,'preview must not fabricate progress');
  assert.ok(identity.gazeDrift<.2,'head gaze must not accumulate a full rotation');
  report.checks.push({name:'default-arena-and-stable-identity',...identity});
  const tiers=[];
  for(const quality of ['high','low']){
    tiers.push(await page.evaluate(q=>{
      const c=window.caesarApp.hoops.court;c.quality=q;c._applyQuality();c.renderer.render(c.scene,c.camera);
      const a=c.players.o1.athlete;
      return {quality:q,head:a.root.getObjectByName('AnatomicalHead').visible,lod:a.root.getObjectByName('HeadLOD').visible,
        calls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles};
    },quality));
    await page.screenshot({path:`${out}/${quality}-decide.png`});
  }
  assert.ok(tiers[0].head&&!tiers[0].lod&&!tiers[1].head&&tiers[1].lod);
  assert.ok(tiers[1].triangles<tiers[0].triangles*.7,'low tier must reduce real geometry, not just pixels');
  report.checks.push({name:'actual-head-and-crowd-lod',tiers});
  const sightLines=await page.evaluate(async()=>{
    const T=await import('./js/vendor/three/three.module.min.js'),c=window.caesarApp.hoops.court;
    c.setShot('broadcast',true);c.camera.position.copy(c.cam.pos);c.camera.lookAt(c.cam.target);
    c.scene.updateMatrixWorld(true);
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
    return Object.values(c.players).map(p=>{
      const head=p.athlete.head.getWorldPosition(new T.Vector3()),direction=head.clone().sub(c.camera.position);
      const ray=new T.Raycaster(c.camera.position,direction.clone().normalize(),0,direction.length()-.5);
      const hits=ray.intersectObject(c.arena.root,true).filter(h=>visible(h.object));
      return {id:p.id,blocked:hits.length>0};
    });
  });
  assert.ok(sightLines.every(p=>!p.blocked),'arena walls and columns must not block the broadcast view');
  report.checks.push({name:'arena-sight-lines',players:sightLines});
  await page.evaluate(()=>{
    const c=window.caesarApp.hoops.court;c.quality='high';c._applyQuality();window.__shotFrames=[];window.__frameTimes=[];window.__gatherClips=[];
    const tick=c._tick.bind(c);c._tick=function(now){tick(now);window.__frameTimes.push(now);
      if(this.ball.preparing&&this.players[this.ball.holder]?.action?.kind==='shot')window.__gatherClips.push(this.players[this.ball.holder].athlete.oneShot?.getClip().name);
      if(this.shot==='finish'&&this.ball.flight?.kind==='shot'){
      const p=this.ballMesh.position.clone().project(this.camera);window.__shotFrames.push({x:p.x,y:p.y,z:p.z});
    }};
  });
  const point=await page.evaluate(()=>window.caesarApp.hoops.court.targetClientPoint(0));await page.mouse.click(...point);
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='review');
  await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
  const shot=await page.evaluate(()=>{
    const times=window.__frameTimes;const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
    return {frames:window.__shotFrames,gatherClips:window.__gatherClips,shot:window.caesarApp.hoops.court.shot,score:window.caesarApp.hoops.homeBonus,
      desktopFrameMs:{median:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]}};
  });
  assert.ok(shot.frames.length>5);
  assert.ok(shot.gatherClips.length>5&&shot.gatherClips.every(name=>name==='Shot'),'late Catch must not replace the prepared Shot animation');
  assert.ok(shot.frames.every(p=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1),'shot ball must stay in view');
  assert.equal(shot.shot,'broadcast');assert.equal(shot.score,3);
  report.checks.push({name:'shot-framing-and-return',...shot});
  await page.screenshot({path:`${out}/review.png`});
  await page.setViewportSize({width:390,height:844});await page.click('.hp-retry');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  const phone=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
    targets:window.caesarApp.hoops.court.targets.map(t=>window.caesarApp.hoops.court.targetClientPoint(t.i))}));
  assert.equal(phone.overflow,false);report.checks.push({name:'phone-layout',...phone});
  await page.screenshot({path:`${out}/phone.png`});
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();server.kill();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure},null,2));
