/* Isolated, silent diagnostic of the existing game player's loop clips.
 * Compares bone-attached anchors to selected deformed shoe mesh vertices.
 * This is evidence for comparison, not gait acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const [output, imageOutput, candidateOutput, videoOutput] = process.argv.slice(2);
if (!output || ![3, 4, 5, 6].includes(process.argv.length)) throw new Error('Usage: node scripts/hoops-gait-audit.mjs output.json [shoe-frame.png [candidate-frame.png [comparison.webm]]]');
const outputPath = path.resolve(output);
const handle = fs.openSync(outputPath, 'wx');
const require = createRequire(import.meta.url);
let browser, server, success = false, imageHandle, candidateHandle, videoHandle;
try {
  if (imageOutput) imageHandle = fs.openSync(path.resolve(imageOutput), 'wx');
  if (candidateOutput) candidateHandle = fs.openSync(path.resolve(candidateOutput), 'wx');
  if (videoOutput) videoHandle = fs.openSync(path.resolve(videoOutput), 'wx');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
  const serverCode = 'import functools,http.server,sys\nclass Server(http.server.ThreadingHTTPServer):\n request_queue_size=128\nh=functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])\ns=Server(("127.0.0.1",0),h)\nprint(s.server_port,flush=True)\ns.serve_forever()';
  server = spawn('python3', ['-u', '-c', serverCode, path.resolve(import.meta.dirname, '..')], { stdio: ['ignore', 'pipe', 'ignore'] });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server timeout')), 10000);
    server.once('error', reject); server.once('exit', code => reject(new Error(`Server exited ${code}`)));
    server.stdout.once('data', data => { clearTimeout(timer); resolve(Number(String(data).trim())); });
  });
  if (!Number.isInteger(port) || port < 1) throw new Error('Invalid server port');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await page.goto(`http://127.0.0.1:${port}/?hoopsQuality=low`);
  await page.waitForFunction(() => !!window.caesarApp, null, { timeout: 60000 });
  await page.click('#btn-hoops');
  const result = await page.evaluate(async ({ captureImage, compareCandidate, captureVideo }) => {
    const THREE = await import('/js/vendor/three/three.module.min.js');
    const { reach } = await import('/js/games/hoops/basketball-pose.js');
    const g = window.caesarApp.hoops;
    await g.pb.open('elevator-shooter');
    const court = g.court;
    const athlete = court.players.o2.athlete, rows = [], shoes = [];
    athlete.root.traverse(mesh => {
      if (!mesh.isSkinnedMesh || mesh.material?.name !== 'Shoe') return;
      const skinIndex = mesh.geometry.attributes.skinIndex, skinWeight = mesh.geometry.attributes.skinWeight;
      const indices = ['l', 'r'].map(side => {
        const selected = [];
        for (let i = 0; i < skinIndex.count; i++) {
          let weight = 0;
          for (let k = 0; k < 4; k++) {
            const bone = mesh.skeleton.bones[skinIndex.getComponent(i, k)];
            if (bone && new RegExp(`^(foot|ball|toe|calf)_${side}`).test(bone.name)) weight += skinWeight.getComponent(i, k);
          }
          if (weight > .5) selected.push(i);
        }
        return selected;
      });
      if (indices.every(side => side.length)) shoes.push({ mesh, indices });
    });
    if (!shoes.length) throw new Error('No usable shoe mesh');
    const meshHeights = () => shoes.map(({ mesh, indices }) => {
      const lowest = indices.map(side => {
        let best = null;
        for (const index of side) {
          const position = mesh.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
          if (!best || position.y < best.position[1]) best = { index, position: position.toArray() };
        }
        return best;
      });
      return { name: mesh.name, selectedVertexCounts: indices.map(side => side.length),
        minHeightFeet: lowest.map(v => v.position[1]), lowest };
    });
    // Sample the actual runner and animation loop before pausing the court for
    // isolated clips. Browser rAF frames are observations, not every rendered frame.
    const runtime = [];
    const compareCanvas = captureVideo ? document.createElement('canvas') : null;
    let compareContext, compareStream, compareRecorder, comparisonDone, videoFrames = 0;
    if (compareCanvas) {
      compareCanvas.width = 1920; compareCanvas.height = 480;
      compareContext = compareCanvas.getContext('2d');
      compareStream = compareCanvas.captureStream(0);
      const chunks = [];
      compareRecorder = new MediaRecorder(compareStream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 4000000 });
      comparisonDone = new Promise((resolve, reject) => {
        compareRecorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        compareRecorder.onerror = e => reject(e.error || new Error('Comparison recording failed'));
        compareRecorder.onstop = async () => {
          const bytes = new Uint8Array(await new Blob(chunks, { type: compareRecorder.mimeType }).arrayBuffer());
          let binary = '';
          for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
          resolve(btoa(binary));
        };
      });
      compareRecorder.start();
    }
    let sampling = true, sampleFrame = 0, closeup = null, candidatePng = null, previousTime = null;
    const closeCamera = () => {
      const p = court.players.o2.root.position, camera = court.camera.clone();
      camera.position.set(p.x + 8, 6.5, p.z + 12);
      camera.lookAt(p.x, 3.5, p.z); camera.updateProjectionMatrix();
      return camera;
    };
    const renderComparison = () => {
      const hidden = Object.values(court.players).filter(player => player.id !== 'o2')
        .flatMap(player => [player.root, player.ring].map(object => [object, object.visible]));
      try {
        for (const [object] of hidden) object.visible = false;
        court.renderer.render(court.scene, closeCamera());
      } finally { for (const [object, visible] of hidden) object.visible = visible; }
    };
    const smoothedOffsets = new Map();
    // Allow the renderer and model shaders to warm up before the timed run.
    for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
    const start = performance.now();
    const sample = () => {
      if (!sampling) return;
      athlete.root.updateWorldMatrix(true, true);
      const observation = { elapsedMs: performance.now() - start, loop: athlete.loopName,
        speedFeetPerSecond: court.players.o2.speed, position: [...court.pos.o2], selectedShoeVertices: meshHeights() };
      // Isolated same-frame experiment: vertically lift only an ankle whose
      // selected shoe vertices penetrate, retaining its original orientation.
      // Restore every joint immediately so the game never uses the candidate.
      const saved = athlete.feet.flatMap(foot => [...foot.joints, foot.bone].map(bone => [bone, bone.quaternion.clone()]));
      const kneeAngle = foot => {
        const hip = foot.joints[1].getWorldPosition(new THREE.Vector3());
        const knee = foot.joints[0].getWorldPosition(new THREE.Vector3());
        const ankle = foot.bone.getWorldPosition(new THREE.Vector3());
        return hip.sub(knee).angleTo(ankle.sub(knee)) * 180 / Math.PI;
      };
      const beforeKnees = athlete.feet.map(kneeAngle), errors = [];
      for (let i = 0; i < athlete.feet.length; i++) {
        const foot = athlete.feet[i], height = observation.selectedShoeVertices[0].minHeightFeet[i];
        if (height >= 0) { errors.push(null); continue; }
        const target = foot.bone.getWorldPosition(new THREE.Vector3());
        target.y += Math.min(.3, -height + .01);
        const world = foot.bone.getWorldQuaternion(new THREE.Quaternion());
        const error = reach(foot.bone, foot.joints, target, 18); errors.push(error);
        foot.bone.quaternion.copy(foot.bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
        athlete.root.updateWorldMatrix(true, true);
      }
      observation.ikExperiment = { errors, kneeBeforeDegrees: beforeKnees,
        kneeAfterDegrees: athlete.feet.map(kneeAngle), selectedShoeVertices: meshHeights() };
      if (compareCanvas) {
        renderComparison();
        compareContext.drawImage(court.canvas, 640, 0, 640, 450);
      }
      const captureThisFrame = captureImage && !closeup && observation.selectedShoeVertices[0].minHeightFeet[0] < -.08;
      if (captureThisFrame && compareCandidate) {
        renderComparison();
        candidatePng = court.canvas.toDataURL('image/png');
      }
      // Blend the correction relative to the current unmodified animation,
      // not absolute joint rotations from the previous pose. This is an
      // experiment and is undone before the next game frame.
      const now = observation.elapsedMs, dt = previousTime === null ? 0 : Math.max(0, (now - previousTime) / 1000);
      previousTime = now;
      for (const [bone, base] of saved) {
        const offset = base.clone().invert().multiply(bone.quaternion);
        const smoothed = smoothedOffsets.get(bone) || new THREE.Quaternion();
        smoothed.slerp(offset, 1 - Math.exp(-12 * dt));
        smoothedOffsets.set(bone, smoothed);
        bone.quaternion.copy(base).multiply(smoothed).normalize();
      }
      athlete.root.updateWorldMatrix(true, true);
      observation.smoothedIkExperiment = { kneeAfterDegrees: athlete.feet.map(kneeAngle), selectedShoeVertices: meshHeights() };
      if (compareCanvas) {
        renderComparison();
        compareContext.drawImage(court.canvas, 1280, 0, 640, 450);
      }
      for (const [bone, quaternion] of saved) bone.quaternion.copy(quaternion);
      athlete.root.updateWorldMatrix(true, true);
      runtime.push(observation);
      if (compareCanvas) {
        renderComparison();
        compareContext.drawImage(court.canvas, 0, 0, 640, 450);
        compareContext.fillStyle = '#0b1628'; compareContext.fillRect(0, 450, 1920, 30);
        compareContext.fillStyle = '#fff'; compareContext.font = '20px sans-serif';
        compareContext.fillText('Original', 20, 473); compareContext.fillText('Independent IK', 660, 473);
        compareContext.fillText('Smoothed IK', 1300, 473);
        compareStream.getVideoTracks()[0].requestFrame(); videoFrames++;
      }
      if (captureThisFrame) {
        const camera = closeCamera();
        const point = observation.selectedShoeVertices[0].lowest[0].position;
        const marker = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false, depthWrite: false }));
        marker.position.set(...point); marker.renderOrder = 10000;
        if (!compareCandidate) court.scene.add(marker);
        court.renderer.render(court.scene, camera);
        closeup = { elapsedMs: observation.elapsedMs, minHeightFeet: observation.selectedShoeVertices[0].minHeightFeet,
          lowest: observation.selectedShoeVertices[0].lowest, floorHeightFeet: court.floor.position.y,
          png: court.canvas.toDataURL('image/png'), candidatePng };
        court.scene.remove(marker); marker.geometry.dispose(); marker.material.dispose();
      }
      sampleFrame = requestAnimationFrame(sample);
    };
    sampleFrame = requestAnimationFrame(sample);
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      const completed = await court.play(g.pb.play.steps[1].beats.slice(0, 1));
      if (!completed) throw new Error('Actual cut was interrupted');
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally { sampling = false; cancelAnimationFrame(sampleFrame); }
    if (runtime.length < 5) throw new Error('Too few runtime observations');
    let comparisonVideo = null;
    if (compareRecorder) {
      compareRecorder.stop();
      try { comparisonVideo = await comparisonDone; } finally { compareStream.getTracks().forEach(track => track.stop()); }
    }
    court.sleep();
    for (const name of ['Idle', 'Jog', 'Sprint']) {
      athlete.mixer.stopAllAction();
      const action = athlete.actions[name];
      const soles = ['foot_l', 'foot_r'].map(side => athlete.soles.filter(point => point?.parent?.name === side));
      if (!action || soles.some(points => !points.length)) throw new Error(`Missing ${name} or sole anchors`);
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
      for (let i = 0; i < 24; i++) {
        action.time = action.getClip().duration * i / 24;
        athlete.mixer.update(0); athlete.root.updateWorldMatrix(true, true);
        const pelvis = athlete.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
        const spine = athlete.root.getObjectByName('spine_03').getWorldPosition(new THREE.Vector3());
        const torso = spine.sub(pelvis);
        const vertices = meshHeights();
        rows.push({ clip: name, phase: i / 24,
          torsoDegreesFromVertical: Math.acos(THREE.MathUtils.clamp(torso.y / torso.length(), -1, 1)) * 180 / Math.PI,
          soleAnchorMinHeightFeet: soles.map(points => Math.min(...points.map(point => point.getWorldPosition(new THREE.Vector3()).y))),
          selectedShoeVertices: vertices });
      }
    }
    return { schema: 'hoops-gait-surface-audit-v3', rows, runtime, closeup, comparisonVideo, videoFrames,
      limitations: 'Mesh vertices selected by >0.5 foot/ball/toe/calf weight, not all triangles or all shoe vertices; rAF observations are not all frames. No contact ground truth, visual or Owner assessment.' };
  }, { captureImage: !!imageOutput, compareCandidate: !!candidateOutput, captureVideo: !!videoOutput });
  if (videoOutput) {
    if (!result.comparisonVideo || result.videoFrames < 5) throw new Error('No comparison video captured');
    fs.writeFileSync(videoHandle, Buffer.from(result.comparisonVideo, 'base64'));
  }
  delete result.comparisonVideo;
  if (imageOutput) {
    if (!result.closeup?.png?.startsWith('data:image/png;base64,')) throw new Error('No closeup captured');
    fs.writeFileSync(imageHandle, Buffer.from(result.closeup.png.split(',')[1], 'base64'));
    delete result.closeup.png;
    if (candidateOutput) {
      if (!result.closeup.candidatePng?.startsWith('data:image/png;base64,')) throw new Error('No candidate frame captured');
      fs.writeFileSync(candidateHandle, Buffer.from(result.closeup.candidatePng.split(',')[1], 'base64'));
      delete result.closeup.candidatePng;
    }
  }
  fs.writeFileSync(handle, JSON.stringify(result, null, 2) + '\n');
  success = true;
  console.log(JSON.stringify({ output: outputPath, samples: result.rows.length }));
} finally {
  await browser?.close(); server?.kill(); fs.closeSync(handle);
  if (imageHandle !== undefined) fs.closeSync(imageHandle);
  if (candidateHandle !== undefined) fs.closeSync(candidateHandle);
  if (videoHandle !== undefined) fs.closeSync(videoHandle);
  if (!success) fs.unlinkSync(outputPath);
  if (!success && imageHandle !== undefined) fs.unlinkSync(path.resolve(imageOutput));
  if (!success && candidateHandle !== undefined) fs.unlinkSync(path.resolve(candidateOutput));
  if (!success && videoHandle !== undefined) fs.unlinkSync(path.resolve(videoOutput));
}
