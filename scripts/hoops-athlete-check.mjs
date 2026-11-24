/* Checks actual imported skin influence and skin movement, rather than the
 * presence of bone names. Also saves gameplay-rendered held-ball close views.
 * Start the local server on 8000. This is desktop evidence, not art acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright');
const out=path.resolve(process.argv[2]||'review/hoops-athlete-check');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1180,height:820},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/?hoopsPreview=drive-kick&hoopsDecide=150&hoopsQuality=high');
  await page.click('#btn-hoops');await page.click('.hp-level[data-index="1"]');
  await page.waitForFunction(()=>window.caesarApp.hoops.phase==='decide');
  const binding=await page.evaluate(async()=>{
    const T=await import('./js/vendor/three/three.module.min.js');
    const c=window.caesarApp.hoops.court;c.sleep();const a=c.players.o1.athlete;
    const rows=[];
    for(const name of ['AnatomicalBody','BodyLOD']) {
      const mesh=a.root.getObjectByName(name),si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
      for(let i=0;i<sw.count;i++) {
        const total=Array.from({length:4},(_,k)=>sw.getComponent(i,k)).reduce((s,v)=>s+v,0);
        if(!Number.isFinite(total)||Math.abs(total-1)>.001)throw new Error(`Invalid skin weights: ${name}/${i}`);
      }
      for(const side of ['r','l'])for(const boneName of ['hand', 'index_01','middle_01','ring_01','pinky_01','thumb_01']) {
        const bone=a.root.getObjectByName(`${boneName}_${side}`),joint=mesh.skeleton.bones.indexOf(bone),indices=[];
        for(let i=0;i<si.count;i++) {
          let weight=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===joint)weight+=sw.getComponent(i,k);
          if(weight>.05)indices.push(i);
        }
        const before=indices.map(i=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
        const saved=bone.quaternion.clone();bone.rotateX(.3);a.root.updateWorldMatrix(true,true);
        const motion=indices.map((i,k)=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(before[k]));
        bone.quaternion.copy(saved);a.root.updateWorldMatrix(true,true);
        rows.push({mesh:name,bone:bone.name,weightedVertices:indices.length,maxSkinMotion:Math.max(0,...motion)});
      }
    }
    let headSkin;a.root.getObjectByName('AnatomicalHead').traverse(o=>{if(o.isSkinnedMesh&&o.material.name==='Skin')headSkin=o;});
    const position=headSkin.geometry.attributes.position,si=headSkin.geometry.attributes.skinIndex,sw=headSkin.geometry.attributes.skinWeight;
    const headJoint=headSkin.skeleton.bones.indexOf(a.head);let lower=0,blended=0;
    for(let i=0;i<position.count;i++)if(position.getY(i)<5.7){
      lower++;let neckWeight=0;
      for(let k=0;k<4;k++)if(si.getComponent(i,k)!==headJoint)neckWeight+=sw.getComponent(i,k);
      if(neckWeight>.1)blended++;
    }
    return {hands:rows,neck:{lowerVertices:lower,blendedVertices:blended}};
  });
  report.checks=binding.hands;report.neck=binding.neck;
  assert.ok(report.checks.every(r=>r.weightedVertices>3&&r.maxSkinMotion>.001),'each hand and finger must influence actual high/low skin');
  assert.ok(report.neck.lowerVertices>10&&report.neck.blendedVertices>10,'lower neck must move with the adjoining neck/body, rather than rigidly with the head');
  await page.evaluate(async()=>{
    const T=await import('./js/vendor/three/three.module.min.js');const c=window.caesarApp.hoops.court;
    const p=c.players.o1;c.frozen=false;
    for(const id in c.players){c.players[id].root.visible=id==='o1';c.players[id].ring.visible=false;c.labels[id].style.display='none';}
    c.youTag.style.display='none';p.root.position.set(0,0,14);p.root.rotation.y=0;
    c.ball.holder='o1';c.ball.flight=null;c.ball.preparing=false;p.speed=0;
    p.athlete.update(1/60);c._renderBall(0);const point=c.ballMesh.position.clone();
    p.athlete.reachBall(point,point.clone().add(new T.Vector3(.35,0,0)),{grip:true});
    p.root.updateWorldMatrix(true,true);
    c.camera.fov=35;c.camera.updateProjectionMatrix();
  });
  for(const [label,position,target] of [
    ['front',[-4,5.8,19],[-.45,4.6,14]],['side',[5,5.6,18],[0,4.3,14]],
    ['back',[4,5.8,9],[0,4.3,14]]
  ]) {
    await page.evaluate(({position,target})=>{const c=window.caesarApp.hoops.court;c.camera.position.set(...position);c.camera.lookAt(...target);c.renderer.render(c.scene,c.camera);},{position,target});
    await page.screenshot({path:`${out}/held-${label}.png`});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{
  await browser?.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure},null,2));
