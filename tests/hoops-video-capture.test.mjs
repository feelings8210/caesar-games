import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePlaybook, wrapCaption, containRect, captionBaselines, validateContinuousNarration } from '../scripts/hoops-video-capture.mjs';
import { PLAYS } from '../js/games/hoops/playbook.js';

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

test('three caption lines stay inside the bottom panel with descent room', () => {
  const lines = captionBaselines(360, 3, 30);
  assert.ok(lines[0] - 30 >= 225);
  assert.ok(lines[2] + 8 <= 360);
});
