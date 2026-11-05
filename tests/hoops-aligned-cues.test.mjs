import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYS } from '../js/games/hoops/playbook.js';
import { alignedCues } from '../scripts/hoops-aligned-cues.mjs';

const play = PLAYS.find(p => p.id === 'horns-pop');
const times = [250, 1800, 4200, 6000];
const tokens = () => play.steps.map((step, i) => ({ text: step.say.zh, startMs: times[i], endMs: times[i] + 500, confidence: .99 }));
const report = { verdict: 'PASS', lines: [{ coverage: .99 }] };

test('maps aligned original script to increasing tactical step cues', () => {
  assert.deepEqual(alignedCues(play.id, 'zh', tokens(), report).map(s => s.startMs), times);
});

test('rejects weak, changed or ambiguous alignment rather than guessing', () => {
  assert.throws(() => alignedCues(play.id, 'zh', tokens(), { verdict: 'WEAK', lines: [{ coverage: .9 }] }), /coverage/);
  const altered = tokens(); altered[1].text = '另一句话';
  assert.throws(() => alignedCues(play.id, 'zh', altered, report), /differs/);
  const crossed = tokens(); crossed[0].text += crossed[1].text; crossed.splice(1, 1);
  assert.throws(() => alignedCues(play.id, 'zh', crossed, report), /crosses/);
  const overlap = tokens(); overlap[1].startMs = overlap[0].endMs - 1;
  assert.throws(() => alignedCues(play.id, 'zh', overlap, report), /token/);
});
