/* A controlled audible-bus test. During a real coach request, isolate the
 * coach source and measure a calibration signal through the court mix node.
 * This proves attenuation/restoration, not subjective audio quality. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=path.resolve(process.argv[2]||'review/hoops-audio-profile');fs.mkdirSync(out,{recursive:true});
const report={errors:[]};let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{
  const connect=BiquadFilterNode.prototype.connect;
  BiquadFilterNode.prototype.connect=function(destination,...args){
   if(this.type==='lowpass'&&this.frequency.value===20000&&destination instanceof GainNode)window.__courtMix=destination;
   return connect.call(this,destination,...args);
  };
  const sourceConnect=AudioBufferSourceNode.prototype.connect;
  AudioBufferSourceNode.prototype.connect=function(destination,...args){
   if(window.__isolateCoach&&!this.loop){window.__coachStarted=true;return destination;}
   return sourceConnect.call(this,destination,...args);
  };
 });
 await page.goto('http://127.0.0.1:8000/?hoopsDecide=150');await page.click('#btn-hoops');await page.click('.hp-level[data-index="0"]');
 await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
 await page.evaluate(async()=>{
  const {hoopsAudio,stopVoice}=await import('./js/games/hoops/audio.js');const {sounds}=await import('./js/engine/sound.js');
  stopVoice();hoopsAudio.stopCrowd();
  const osc=sounds.ctx.createOscillator(),gain=sounds.ctx.createGain(),analyser=sounds.ctx.createAnalyser();
  gain.gain.value=.025;osc.frequency.value=997;osc.connect(gain);gain.connect(window.__courtMix);sounds.master.connect(analyser);osc.start();window.__tone=osc;
  window.__rms=()=>{const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length);};
 });
 await page.waitForTimeout(600);
 report.before=await page.evaluate(()=>window.__rms());
 await page.evaluate(async()=>{window.__isolateCoach=true;(await import('./js/games/hoops/audio.js')).hoopsAudio.voice('level_10_rule','en');});
 await page.waitForFunction(()=>window.__coachStarted&&window.__courtMix.gain.value<.65);
 await page.waitForTimeout(200);report.during=await page.evaluate(()=>window.__rms());
 await page.waitForFunction(()=>window.__courtMix.gain.value>.97,null,{timeout:15000});
 report.afterNatural=await page.evaluate(()=>window.__rms());
 await page.evaluate(async()=>{window.__coachStarted=false;(await import('./js/games/hoops/audio.js')).hoopsAudio.voice('level_10_rule','en');});
 await page.waitForFunction(()=>window.__coachStarted&&window.__courtMix.gain.value<.65);
 await page.evaluate(async()=>{window.__isolateCoach=false;(await import('./js/games/hoops/audio.js')).stopVoice();});
 await page.waitForTimeout(500);report.after=await page.evaluate(()=>window.__rms());
 assert.ok(report.before>.001&&report.during/report.before<.65&&report.afterNatural/report.before>.9&&report.after/report.before>.9);
 await page.evaluate(()=>window.__tone.stop());assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
