/* Build a deterministic teaching-video timeline from the actual playbook.
 * Narration durations are measured from finished audio, not guessed from text.
 * This module does not create video or approve the audio. */
import { PLAYS } from '../js/games/hoops/playbook.js';

export function makeTimeline(playId, locale, narrationMs, { introMs = 1200, gapMs = 500, outroMs = 1200 } = {}) {
  const play = PLAYS.find(item => item.id === playId);
  if (!play) throw new Error(`Unknown play: ${playId}`);
  if (!['zh', 'en'].includes(locale)) throw new Error('Locale must be zh or en');
  if (!Array.isArray(narrationMs) || narrationMs.length !== play.steps.length ||
      narrationMs.some(n => !Number.isFinite(n) || n <= 0)) {
    throw new Error('Provide one positive measured narration duration for each step');
  }
  if ([introMs, gapMs, outroMs].some(n => !Number.isFinite(n) || n < 0)) throw new Error('Invalid timing');
  let cursor = introMs;
  const steps = play.steps.map((step, index) => {
    const startMs = cursor;
    const beats = step.beats.map(beat => {
      const result = { startMs: cursor, endMs: cursor + beat.ms, beat };
      cursor = result.endMs;
      return result;
    });
    const audioEndMs = startMs + narrationMs[index];
    const endMs = Math.max(cursor, audioEndMs);
    cursor = endMs + gapMs;
    return { index, text: step.say[locale], startMs, audioEndMs, endMs, beats };
  });
  return { schema: 'caesar-hoops-video-timeline-v1', playId, locale, title: play.title[locale],
    setup: play.setup, introMs, gapMs, outroMs, steps, durationMs: cursor - gapMs + outroMs };
}

export function subtitles(timeline) {
  const stamp = value => {
    const ms = Math.round(value), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
    const s = Math.floor(ms / 1000) % 60, f = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(f).padStart(3, '0')}`;
  };
  return timeline.steps.map((s, i) => `${i + 1}\n${stamp(s.startMs)} --> ${stamp(s.audioEndMs)}\n${s.text}\n`).join('\n');
}
