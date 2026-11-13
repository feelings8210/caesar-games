import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePlaybook, wrapCaption, containRect, captureLayout, captionBaselines, validateContinuousNarration, recordingChunks, teachingBeats, setTeachingFrame } from '../scripts/hoops-video-capture.mjs';
import { PLAYS } from '../js/games/hoops/playbook.js';
import * as THREE from '../js/vendor/three/three.module.min.js';

test('capture refuses missing narration before creating a recording', async () => {
  const court = { renderer: {}, canvas: {}, scene: {}, camera: {} };
  const play = { steps: [{}, {}] };
  await assert.rejects(capturePlaybook({ court, play, locale: 'en', narration: [{ duration: 1 }] }), /one decoded narration/i);
  await assert.rejects(capturePlaybook({ court, play, locale: 'en', narration: [{ duration: 1 }, { duration: 0 }] }), /one decoded narration/i);
});

test('continuous narration rejects unordered cues and actions that cannot fit', () => {
  const play = PLAYS.find(p => p.id === 'horns-pop'), buffer = { duration: 8 };
  assert.doesNotThrow(() => validateContinuousNarration(play, { buffer, cuesMs: [250, 1800, 4200, 6000] }));
  assert.throws(() => validateContinuousNarration(play, { buffer, cuesMs: [250, 1800, 1700, 6000] }), /increasing/);
  assert.throws(() => validateContinuousNarration(play, { buffer, cuesMs: [250, 1800, 2500, 6000] }), /cannot fit/);
  assert.throws(() => validateContinuousNarration(play, { buffer, cuesMs: [250, 1800, 4200, 7900] }), /cannot fit/);
});

test('English captions wrap at word boundaries and Chinese captions wrap by character', () => {
  assert.deepEqual(wrapCaption('A screen and dribble', 10, x => x.length, 'en'), ['A screen', 'and', 'dribble']);
  assert.deepEqual(wrapCaption('牛角战术', 2, x => x.length, 'zh'), ['牛角', '战术']);
});

test('capture preserves court proportions in landscape and portrait outputs', () => {
  assert.deepEqual(containRect(1000, 1000, 1600, 900), { x: 350, y: 0, width: 900, height: 900 });
  assert.deepEqual(containRect(1600, 900, 900, 1600), { x: 0, y: 546.875, width: 900, height: 506.25 });
  assert.throws(() => containRect(0, 1, 1, 1), /dimensions/);
});

test('caption band never covers the captured court', () => {
  for (const [w, h] of [[1280, 720], [720, 1280], [640, 360]]) {
    const { court, caption } = captureLayout(1280, 720, w, h);
    assert.ok(court.x >= 0 && court.y >= 0);
    assert.ok(court.x + court.width <= w && court.y + court.height <= caption.y);
    assert.equal(caption.y + caption.height, h);
    assert.ok(Math.abs(court.width / court.height - 1280 / 720) < 1e-9);
  }
  assert.throws(() => captureLayout(1, 1, 720, 135), /too short/);
});

test('teaching captures retain the overall camera for shots without mutating the play', () => {
  const play = PLAYS.find(p => p.id === 'horns-pop');
  const original = JSON.stringify(play);
  const beats = teachingBeats(play);
  assert.equal(beats.at(-1).at(-1).finishCamera, false);
  assert.equal(JSON.stringify(play), original);
});

test('elevator teaching frame uses a distinct along-court viewing direction', () => {
  const play = PLAYS.find(p => p.id === 'elevator-shooter');
  const court = { arenaLook: true, _aspect: 1.5, baseFov: 36,
    goal: { pos: new THREE.Vector3(), target: new THREE.Vector3() },
    cam: { pos: new THREE.Vector3(), target: new THREE.Vector3() },
    setReadFrame() { this._framingPositions = Object.entries(play.setup).filter(([id]) => /^o\d$/.test(id)).map(([,p]) => p); } };
  setTeachingFrame(court, play, teachingBeats(play));
  const direction = court.cam.pos.clone().sub(court.cam.target).normalize();
  assert.ok(direction.z > .65 && direction.y > .5);
  assert.ok(court.cam.pos.equals(court.goal.pos));
});

test('three caption lines stay inside the bottom panel with descent room', () => {
  const lines = captionBaselines(360, 3, 30);
  assert.ok(lines[0] - 30 >= 225);
  assert.ok(lines[2] + 8 <= 360);
});

test('recording chunks are written in order and completion waits for the writer', async () => {
  const order = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const sink = recordingChunks(async blob => { const value = await blob.text(); if (value === 'a') await gate; order.push(value); });
  sink.add(new Blob(['a'])); sink.add(new Blob(['b']));
  const finished = sink.finish('video/webm');
  await Promise.resolve();
  assert.deepEqual(order, []);
  release();
  assert.equal(await finished, null);
  assert.deepEqual(order, ['a', 'b']);
});

test('a failed chunk write fails the capture and prevents subsequent writes', async () => {
  let count = 0;
  const sink = recordingChunks(() => { count++; throw new Error('disk full'); });
  sink.add(new Blob(['a'])); sink.add(new Blob(['b']));
  await assert.rejects(sink.finish('video/webm'), /disk full/);
  assert.equal(count, 1);
  const buffered = recordingChunks();
  buffered.add(new Blob(['old'])); buffered.add(new Blob([' mode']));
  assert.equal(await (await buffered.finish('video/webm')).text(), 'old mode');
});
