import test from 'node:test';
import assert from 'node:assert/strict';
import { observedSubtitles, validateTranscodeReceipt } from '../scripts/hoops-observed-subtitles.mjs';
import { PLAYS } from '../js/games/hoops/playbook.js';
const play = PLAYS.find(p => p.id === 'horns-pop');
const report = () => ({ schema: 'caesar-hoops-capture-observation-v1', playId: play.id, locale: 'zh',
  captionTexts: play.steps.map(s => s.say.zh),
  events: [...play.steps.map((_, i) => ({ type: 'caption-start', step: i, elapsedMs: 1200 + i * 2000 })),
    { type: 'caption-clear', elapsedMs: 9200 }] });
test('uses observed caption changes and current play text', () => {
  const srt = observedSubtitles(report(), play);
  assert.match(srt, /00:00:01,200 --> 00:00:03,200/);
  assert.match(srt, /00:00:07,200 --> 00:00:09,200/);
  assert.ok(srt.includes(play.steps[3].say.zh));
});
test('rejects missing, reordered or overlapping observations', () => {
  const a = report(); a.events.pop(); assert.throws(() => observedSubtitles(a, play), /Incomplete/);
  const b = report(); b.events[1].step = 2; assert.throws(() => observedSubtitles(b, play), /Invalid/);
  const c = report(); c.events[2].elapsedMs = 0; assert.throws(() => observedSubtitles(c, play), /Invalid/);
  const d = report(); d.captionTexts[0] = '旧版文字'; assert.throws(() => observedSubtitles(d, play), /stale/);
});

test('MP4 subtitles require a matching completed transcode with the expected script', () => {
  const source = 'a'.repeat(64), script = 'b'.repeat(64), output = 'c'.repeat(64);
  const receipt = () => ({ schema: 1, status: 'TECHNICALLY_COMPLETE_QC_PENDING',
    attempt: { project: 'CAESAR_HOOPS_TACTICS', capability: 'media.ffmpeg',
      inputs: [{ path: '/source', sha256: source }, { path: '/script', sha256: script }],
      command: ['bash', '/script', '/source'] }, files: [{ relative: 'video.mp4', sha256: output }] });
  assert.doesNotThrow(() => validateTranscodeReceipt(receipt(), source, output, script));
  assert.throws(() => validateTranscodeReceipt(receipt(), source, 'd'.repeat(64), script), /does not bind/);
  assert.throws(() => validateTranscodeReceipt(receipt(), 'd'.repeat(64), output, script), /does not bind/);
  const changed = receipt(); changed.attempt.command[2] = '/other';
  assert.throws(() => validateTranscodeReceipt(changed, source, output, script), /does not bind/);
  const failed = receipt(); failed.status = 'FAILED';
  assert.throws(() => validateTranscodeReceipt(failed, source, output, script), /Invalid/);
});
