/* Convert reviewed-script alignment tokens to step cues. Alignment is timing
 * evidence only: it cannot prove that audio was spoken correctly. */
import { PLAYS } from '../js/games/hoops/playbook.js';
import { validateContinuousNarration } from './hoops-video-capture.mjs';

const fold = s => (s.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]/gu) || []).join('');

export function alignedCues(playId, locale, tokens, report, { minCoverage = .95 } = {}) {
  const play = PLAYS.find(p => p.id === playId);
  if (!play || !['zh', 'en'].includes(locale)) throw new Error('Unknown play or locale');
  if (!Number.isFinite(minCoverage) || minCoverage < .95 || minCoverage > 1 || report?.verdict !== 'PASS' ||
      !Array.isArray(report.lines) || !report.lines.length || report.lines.some(l => !Number.isFinite(l.coverage) || l.coverage < minCoverage))
    throw new Error('Alignment report is missing or below the required coverage');
  if (!Array.isArray(tokens) || !tokens.length) throw new Error('No alignment tokens');
  let previousEnd = 0, text = '';
  const spans = tokens.map((token, i) => {
    if (typeof token.text !== 'string' || !Number.isFinite(token.startMs) || !Number.isFinite(token.endMs) ||
        token.startMs < previousEnd || token.endMs <= token.startMs || !Number.isFinite(token.confidence) || token.confidence < minCoverage)
      throw new Error(`Invalid or low-confidence alignment token ${i + 1}`);
    previousEnd = token.endMs;
    const chars = fold(token.text);
    if (!chars) throw new Error(`Empty alignment token ${i + 1}`);
    const start = text.length; text += chars;
    return { start, end: text.length, time: token.startMs };
  });
  let cursor = 0;
  const steps = play.steps.map((step, index) => {
    const chars = fold(step.say[locale]);
    if (!chars || text.slice(cursor, cursor + chars.length) !== chars) throw new Error(`Aligned text differs at step ${index + 1}`);
    const token = spans.find(s => s.start === cursor);
    if (!token) throw new Error(`Alignment token crosses step ${index + 1} boundary`);
    cursor += chars.length;
    if (!spans.some(s => s.end === cursor)) throw new Error(`Alignment token crosses step ${index + 1} boundary`);
    return { text: step.say[locale], startMs: token.time };
  });
  if (cursor !== text.length) throw new Error('Alignment contains extra words');
  validateContinuousNarration(play, { buffer: { duration: Infinity }, cuesMs: steps.map(s => s.startMs) });
  return steps;
}
