import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePlaybook, wrapCaption } from '../scripts/hoops-video-capture.mjs';

test('capture refuses missing narration before creating a recording', async () => {
  const court = { renderer: {}, canvas: {}, scene: {}, camera: {} };
  const play = { steps: [{}, {}] };
  await assert.rejects(capturePlaybook({ court, play, locale: 'en', narration: [{ duration: 1 }] }), /one decoded narration/i);
  await assert.rejects(capturePlaybook({ court, play, locale: 'en', narration: [{ duration: 1 }, { duration: 0 }] }), /one decoded narration/i);
});

test('English captions wrap at word boundaries and Chinese captions wrap by character', () => {
  assert.deepEqual(wrapCaption('A screen and dribble', 10, x => x.length, 'en'), ['A screen', 'and', 'dribble']);
  assert.deepEqual(wrapCaption('牛角战术', 2, x => x.length, 'zh'), ['牛角', '战术']);
});
