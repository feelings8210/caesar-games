import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTimeline, subtitles } from '../scripts/hoops-video-timeline.mjs';

test('narration and actions fit each step without overlapping the next', () => {
  const t = makeTimeline('horns-pop', 'zh', [4000, 100, 3000, 5000]);
  assert.equal(t.steps[0].startMs, 1200);
  assert.equal(t.steps[0].audioEndMs, 5200);
  assert.equal(t.steps[1].startMs, 5700);
  assert.equal(t.steps[1].endMs, 7400); // screen and drive continue after short narration
  assert.equal(t.steps[2].startMs, 7900);
  assert.ok(t.steps.every(s => s.beats.every(b => b.endMs <= s.endMs)));
  assert.match(subtitles(t), /00:00:01,200 --> 00:00:05,200/);
  assert.match(subtitles(t), /牛角站位/);
});

test('missing or invalid speech durations fail closed', () => {
  assert.throws(() => makeTimeline('horns-pop', 'zh', [1000]), /one positive/);
  assert.throws(() => makeTimeline('horns-pop', 'zh', [1, 1, NaN, 1]), /one positive/);
  assert.throws(() => makeTimeline('wrong', 'zh', []), /Unknown play/);
});
