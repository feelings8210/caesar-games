/* Actual chapter finishes: gather animation, one-hand versus jump set,
 * continuous shot framing, and finite skinned bounds. Local server on 8000. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=path.resolve(process.argv[2]||'review/hoops-finishes');fs.mkdirSync(out,{recursive:true});
const report={finishes:[],errors:[]};let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/?hoopsDecide=150&hoopsQuality=high&hoopsPreview=drive-kick');
  await page.click('#btn-hoops');await page.click('.hp-level[data-index="0"]');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  await page.evaluate(()=>{
    const c=window.caesarApp.hoops.court,tick=c._tick.bind(c);window.__finishFrames=[];
    c._tick=function(now){tick(now);const a=this.players[this.ball.holder]?.action;
      if(this.ball.preparing&&a?.kind==='shot')window.__finishFrames.push({phase:'gather',style:a.style,
        clip:this.players[this.ball.holder].athlete.oneShot?.getClip().name,ball:this.ballMesh.position.toArray(),
        contact:this.players[this.ball.holder].athlete.contactError});
      if(this.ball.flight?.kind==='shot'){const p=this.ballMesh.position.clone().project(this.camera);
        window.__finishFrames.push({phase:'flight',view:p.toArray(),ball:this.ballMesh.position.toArray()});}
    };
  });
  for(const [index,expected] of [[0,'layup'],[1,'jump'],[3,'jump'],[5,'layup']]){
    if(index!==0){await page.evaluate(i=>window.caesarApp.hoops.startLevel(i),index);await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');}
    const best=await page.evaluate(async i=>(await import('./js/games/hoops/levels.js')).LEVELS[i].options.findIndex(o=>o.grade===3),index);
    await page.evaluate(i=>{window.__finishFrames=[];window.caesarApp.hoops.choose(i);},best);
    await page.waitForFunction(()=>{const c=window.caesarApp.hoops.court,a=c.players[c.ball.holder]?.action;
      return c.ball.preparing&&a?.kind==='shot'&&(performance.now()-a.start)/a.releaseMs>.85;});
    await page.screenshot({path:`${out}/L${index+1}-gather.png`});
    await page.waitForFunction(()=>window.caesarApp.hoops.phase==='review');
    const frames=await page.evaluate(()=>window.__finishFrames);
    const gather=frames.filter(f=>f.phase==='gather'),flight=frames.filter(f=>f.phase==='flight');
    assert.ok(gather.length>5&&gather.every(f=>f.style===expected&&f.clip==='Shot'));
    assert.ok(flight.length>5&&flight.every(f=>Math.abs(f.view[0])<1&&Math.abs(f.view[1])<1&&f.view[2]<1),'complete shot must fit the finish camera');
    assert.ok(frames.every(f=>f.ball.every(Number.isFinite)&&f.ball[1]>=0&&f.ball[1]<22));
    report.finishes.push({level:index+1,style:expected,frames});
    await page.screenshot({path:`${out}/L${index+1}-review.png`});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{
  await browser?.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure},null,2));
