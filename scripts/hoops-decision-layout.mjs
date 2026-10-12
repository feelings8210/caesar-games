/* Decision hit areas and overlays at desktop/panel/iPad/phone sizes.
 * Browser evidence only: the iPad sizes do not claim device validation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const out = path.resolve(process.argv[2]); fs.mkdirSync(out,{recursive:true});
const report = {checks:[],errors:[]};
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const touch = !!process.env.HOOPS_LAYOUT_TOUCH;
  const page = await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block',hasTouch:touch});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150');
  await page.click('#btn-hoops');
  const levels = process.env.HOOPS_LAYOUT_LEVELS ? process.env.HOOPS_LAYOUT_LEVELS.split(',').map(n=>Number(n)-1) : Array.from({length:10},(_,i)=>i);
  for (const level of levels) {
    console.log(`Checking decision layout: level ${level+1}/10`);
    await page.evaluate(i=>window.caesarApp.hoops.startLevel(i),level);
    await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
    for (const [width,height] of [[1180,820],[820,780],[700,780],[1024,1366],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>window.caesarApp.hoops.court.cameraSettled());
      await page.waitForTimeout(180);
      const check=await page.evaluate(()=>{
        const c=window.caesarApp.hoops.court;
        c._layoutLabels();
        const r=e=>e.getBoundingClientRect().toJSON();
        const court=r(c.el),panel=r(document.querySelector('.hp-panel')),hud=r(document.querySelector('.hp-hud'));
        const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        const points=c.targets.map(t=>c.targetClientPoint(t.i));
        const protectedRects=points.map(([x,y])=>({left:x-24,right:x+24,top:y-24,bottom:y+24}));
        const labels=c.targets.filter(t=>t.label).map(t=>({i:t.i,text:t.label.textContent,visible:getComputedStyle(t.label).visibility==='visible',rect:r(t.label)}));
        return {court,panel,hud,points,labels,overflow:document.documentElement.scrollWidth>innerWidth,
          panelOverlap:overlaps(court,panel),hudOverlap:overlaps(court,hud),
          labelOcclusion:labels.some(l=>l.visible&&protectedRects.some(p=>overlaps(l.rect,p))),
          labelCollision:labels.some((l,i)=>labels.slice(i+1).some(b=>l.visible&&b.visible&&overlaps(l.rect,b.rect))),
          hitMismatch:points.map(([x,y],i)=>c.pickTarget(x,y)!==i)};
      });
      report.checks.push({level:level+1,width,height,...check});
      assert.equal(check.overflow,false,'horizontal overflow');
      assert.equal(check.panelOverlap,false,'coaching panel covers court');
      assert.equal(check.hudOverlap,false,'score graphic covers court');
      assert.equal(check.labelOcclusion,false,'option text covers a touch area');
      assert.equal(check.labelCollision,false,'option labels overlap');
      assert.ok(check.labels.every(l=>l.visible),'option labels must remain visible');
      assert.ok(check.hitMismatch.every(v=>!v),'target centre must select its own choice');
      if(level===1) await page.screenshot({path:`${out}/drive-kick-${width}.png`});
    }
    const best=await page.evaluate(()=>window.caesarApp.hoops.level.options.findIndex(o=>o.grade===3));
    const point=await page.evaluate(i=>window.caesarApp.hoops.court.targetClientPoint(i),best);
    if (touch) await page.touchscreen.tap(...point);
    else await page.mouse.click(...point);
    await page.waitForFunction(()=>window.caesarApp.hoops.phase==='review');
    assert.equal(await page.evaluate(()=>window.caesarApp.hoops.level.options[window.caesarApp.hoops.choice]?.grade),3);
  }
  assert.deepEqual(report.errors,[]); report.passed=true;
} catch(e) {report.failure=e.stack;process.exitCode=1;}
finally {await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.checks.length,errors:report.errors,failure:report.failure}));
