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

test('times each beat cue from the phrase that names it', () => {
  // Phrase-level tokens as the aligner produces them: split step text at each beat cue.
  const phrases = play.steps.flatMap((step, i) => {
    const cuts = [0, ...step.beats.map(b => b.cue && step.say.zh.indexOf(b.cue.zh)).filter(n => n > 0), step.say.zh.length];
    return cuts.slice(1).map((end, k) => ({ text: step.say.zh.slice(cuts[k], end), step: i, k }));
  });
  let t = 0;
  const toks = phrases.map(p => { t = Math.max(t, [100, 9000, 14000, 20000][p.step]) + (p.k ? 1500 : 0); return { text: p.text, startMs: t, endMs: t + 900, confidence: .99 }; });
  const steps = alignedCues(play.id, 'zh', toks, report);
  const start = text => toks.find(x => x.text.startsWith(text)).startMs;
  assert.deepEqual(steps[1].beatsMs, [null, start('一号借着掩护')]);
  assert.deepEqual(steps[3].beatsMs, [start('一号就可以回传'), start('让五号接球投篮')]);
  assert.equal(steps.estimatedBeatCues, undefined);
  // One token per step: cue time is estimated inside it and reported as such.
  const coarse = alignedCues(play.id, 'zh', tokens(), report);
  assert.ok(coarse[3].beatsMs[0] > times[3] && coarse[3].beatsMs[1] < times[3] + 500);
  assert.deepEqual(coarse.estimatedBeatCues, ['2.2', '3.1', '4.1', '4.2']);
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
