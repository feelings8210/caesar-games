/* All four visible actions select their own outcome, in both languages.
 * Keyboard controls work too; labels never contain answer grades. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});const report={checks:[],errors:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:458,height:504},serviceWorkers:'block',hasTouch:true});
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150');
 await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 for(const locale of ['en','zh']){
  if(locale==='zh')await page.click('#btn-language');
  for(let choice=0;choice<4;choice++){
   await page.evaluate(()=>window.caesarApp.hoops.startLevel(1));await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
   const before=await page.locator('.hp-choice-stage button').evaluateAll(bs=>bs.map(b=>({i:Number(b.dataset.choice),text:b.textContent,disabled:b.disabled})));
   if(choice===0)await page.screenshot({path:`${out}/actions-${locale}.png`});
   assert.ok(before.every(b=>!b.disabled&&!/正确|错误|correct|wrong/i.test(b.text)));
   await page.evaluate(()=>window.caesarApp.hoops.render());
   assert.deepEqual(await page.locator('.hp-choice-stage button').evaluateAll(bs=>bs.map(b=>Number(b.dataset.choice))),before.map(b=>b.i),'order must stay still while deciding');
   const button=page.locator(`.hp-choice-stage [data-choice="${choice}"]`);
   if(choice===3)await button.press('Enter');else await button.tap();
   await page.waitForFunction(()=>window.caesarApp.hoops.phase==='review');
   const actual=await page.evaluate(()=>({choice:window.caesarApp.hoops.choice,grade:window.caesarApp.hoops.level.options[window.caesarApp.hoops.choice]?.grade,
    disabled:[...document.querySelectorAll('.hp-choice-stage button')].every(b=>b.disabled)}));
   assert.equal(actual.choice,choice);assert.equal(actual.grade,[3,0,1,0][choice]);assert.ok(actual.disabled);
   report.checks.push({locale,before,...actual});console.log(`Action button verified: ${locale}, choice ${choice}`);
  }
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,cases:report.checks.length,failure:report.failure}));
