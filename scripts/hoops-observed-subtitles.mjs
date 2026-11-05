/* Turn actual capture events into a subtitle sidecar. Times are browser-clock
 * observations and must be checked against the decoded output before use. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { PLAYS } from '../js/games/hoops/playbook.js';

export function observedSubtitles(report, play) {
  if (report?.schema !== 'caesar-hoops-capture-observation-v1' || report.playId !== play?.id ||
      !['zh', 'en'].includes(report.locale) || !Array.isArray(report.events) || !Array.isArray(report.captionTexts) ||
      report.captionTexts.length !== play.steps.length || report.captionTexts.some((t, i) => t !== play.steps[i].say[report.locale]))
    throw new Error('Invalid or stale capture report');
  const changes = report.events.filter(e => e.type === 'caption-start' || e.type === 'caption-clear');
  if (changes.length !== play.steps.length + 1 || changes.at(-1).type !== 'caption-clear') throw new Error('Incomplete caption events');
  const stamp = ms => {
    const n = Math.round(ms), h = Math.floor(n / 3600000), m = Math.floor(n / 60000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`;
  };
  return play.steps.map((step, i) => {
    const a = changes[i], b = changes[i + 1];
    if (a.type !== 'caption-start' || a.step !== i || !Number.isFinite(a.elapsedMs) || !Number.isFinite(b.elapsedMs) ||
        a.elapsedMs < 0 || b.elapsedMs <= a.elapsedMs) throw new Error(`Invalid caption event ${i + 1}`);
    const text = step.say[report.locale];
    if (typeof text !== 'string' || !text.trim() || /[\r\n]/.test(text)) throw new Error(`Invalid subtitle text ${i + 1}`);
    return `${i + 1}\n${stamp(a.elapsedMs)} --> ${stamp(b.elapsedMs)}\n${text}\n`;
  }).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [videoFile, reportFile, outputFile] = process.argv.slice(2);
  if (process.argv.length !== 5) throw new Error('Usage: node scripts/hoops-observed-subtitles.mjs video.webm report.json output.srt');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const sha = createHash('sha256').update(fs.readFileSync(videoFile)).digest('hex');
  if (sha !== report.videoSha256) throw new Error('Video does not match capture report');
  const srt = observedSubtitles(report, PLAYS.find(p => p.id === report.playId));
  fs.writeFileSync(outputFile, srt, { flag: 'wx' });
  console.log('Subtitle draft created; verify timing and text against the actual recording.');
}
