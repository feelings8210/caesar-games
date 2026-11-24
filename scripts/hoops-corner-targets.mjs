/* Actual corner receiver, marker, badge and tap agree on both sides.
 * Record real canvas dimensions through the play so decision freeze is stable. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=process.argv[2];if(!out)throw new Error('Pass an SSD output directory');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:458,height:504},serviceWorkers:'block',hasTouch:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150');await page.click('#btn-hoops');
 await page.click('.hp-level[data-index="1"]');await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 const sizes=process.env.HOOPS_CORNER_SMALL?[[458,504]]:[[458,504],[820,780],[1180,820],[390,844],[1024,768],[1024,1366]];
 for(const [width,height] of sizes)for(const mirrored of [false,true]){
  await page.setViewportSize({width,height});
  await page.evaluate(async mirrored=>{
   const h=window.caesarApp.hoops,c=h.court;
   if(!window.__cornerInstalled){const tick=c._tick.bind(c);c._tick=function(now){tick(now);const r=this.canvas.getBoundingClientRect();window.__cornerFrames.push({phase:h.phase,w:r.width,h:r.height,holder:this.ball.holder});};window.__cornerInstalled=true;}
   window.__cornerFrames=[];
   if(mirrored){const {LEVELS}=await import('./js/games/hoops/levels.js');const {mirrorLevel}=await import('./js/games/hoops/families.js');h.mode='chapter';h.index=1;h._run(mirrorLevel(LEVELS[1]),'Corner test');}
   else h.startLevel(1);
  },mirrored);
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
  const alignment=await page.evaluate(()=>{
   const c=window.caesarApp.hoops.court;c._layoutLabels();
   return c.targets.filter(t=>t.opt.kind==='pass').map(t=>{
    const player=c.players[t.opt.to],ring=t.group.children[0],r=c.labels[t.opt.to].getBoundingClientRect();
    const point=c.targetClientPoint(t.i),badge=[r.left+r.width/2,r.top+r.height/2],floor=c.courtClientPoint(c.targetPoint(t.opt));
    const centre=ring.getWorldPosition(player.root.position.clone());
    const outer=ring.geometry.parameters.outerRadius*1.14;
    return {id:t.opt.to,i:t.i,point,badge,floor,floorPicked:c.pickTarget(...floor),tagged:c.labels[t.opt.to].classList.contains('is-target'),
     centreError:Math.hypot(centre.x-player.root.position.x,centre.z-player.root.position.z),
     badgeError:Math.hypot(badge[0]-point[0],badge[1]-point[1]),picked:c.pickTarget(...badge),
     ringInCourt:Math.abs(centre.x)+outer<=25&&centre.z-outer>=0&&centre.z+outer<=47};
   });
  });
  const buttons=await page.evaluate(()=>[...document.querySelectorAll('.hp-choice')].filter(b=>b.getClientRects().length).map(b=>{
    const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {i:Number(b.dataset.choice),text:b.textContent,height:r.height,visible:r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth,
      clear:hit?.closest('button')===b,disabled:b.disabled};
  }));
  assert.equal(buttons.length,4);assert.ok(buttons.every(b=>b.visible&&b.clear&&!b.disabled&&b.height>=44),'all action buttons must be visible, clear and touch-sized');
  assert.ok(alignment.every(p=>p.centreError<1e-6&&p.badgeError<.8&&p.picked===p.i&&p.floorPicked===p.i&&p.tagged&&p.ringInCourt),'receiver, visible badge, floor ring and hit must align');
  const best=alignment.find(p=>p.id==='o3');
  await page.screenshot({path:`${out}/corner-${width}-${height}-${mirrored?'left':'right'}.png`});
  if(process.env.HOOPS_CORNER_BUTTON)await page.locator('.hp-choice[data-choice="0"]:visible').click();
  else await page.touchscreen.tap(...(process.env.HOOPS_CORNER_FLOOR?best.floor:best.badge));
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='review');
  const flow=await page.evaluate(()=>{
   const h=window.caesarApp.hoops,frames=window.__cornerFrames;
   const phases=['intro','decide','outcome','review'];
   const sizes=phases.map(phase=>({phase,frames:frames.filter(f=>f.phase===phase).map(f=>[f.w,f.h])}));
   return {choice:h.choice,grade:h.level.options[h.choice]?.grade,received:frames.some(f=>f.phase==='outcome'&&f.holder==='o3'),sizes,
    overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(flow.grade,3);assert.ok(flow.received,'the selected corner player must actually receive the ball');
  assert.equal(flow.overflow,false);
  const dimensions=flow.sizes.flatMap(s=>s.frames);assert.ok(dimensions.length>20);
  assert.ok(dimensions.every(([w,h])=>Math.abs(w-dimensions[0][0])<1&&Math.abs(h-dimensions[0][1])<1),'court size must remain stable through phases');
  report.checks.push({width,height,mirrored,alignment,buttons,choice:flow.choice,grade:flow.grade,received:flow.received,
    sizes:flow.sizes.map(s=>({phase:s.phase,count:s.frames.length,first:s.frames[0],last:s.frames.at(-1)}))});
  console.log(`Corner pass verified: ${width}x${height}, mirrored=${mirrored}`);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.checks.length,errors:report.errors,failure:report.failure}));
