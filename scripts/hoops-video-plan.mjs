/* Usage: node scripts/hoops-video-plan.mjs play-id zh durations.json output-prefix
 * durations.json is an array of measured narration lengths in milliseconds.
 * Outputs a timeline and SRT only; no video or voice is produced. */
import fs from 'node:fs';
import { makeTimeline, subtitles } from './hoops-video-timeline.mjs';

const [playId, locale, durationsFile, prefix] = process.argv.slice(2);
if (!playId || !locale || !durationsFile || !prefix) {
  console.error('Usage: node scripts/hoops-video-plan.mjs play-id zh|en durations.json output-prefix');
  process.exit(2);
}
const timeline = makeTimeline(playId, locale, JSON.parse(fs.readFileSync(durationsFile, 'utf8')));
fs.writeFileSync(`${prefix}.json`, `${JSON.stringify(timeline, null, 2)}\n`, { flag: 'wx' });
try {
  fs.writeFileSync(`${prefix}.srt`, subtitles(timeline), { flag: 'wx' });
} catch (err) {
  fs.unlinkSync(`${prefix}.json`);
  throw err;
}
console.log(`Timeline: ${prefix}.json; subtitles: ${prefix}.srt`);
