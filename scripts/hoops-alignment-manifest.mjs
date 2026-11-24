/* Usage: node scripts/hoops-alignment-manifest.mjs play-id zh|en
 *   audio.wav expected-audio-sha256 captions.json align.json output.json
 * The audio and timing files must refer to the same reviewed recording. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { alignedCues } from './hoops-aligned-cues.mjs';
const [playId, locale, audio, expectedSha, captions, report, output] = process.argv.slice(2);
if (process.argv.length !== 9 || !/^[0-9a-f]{64}$/.test(expectedSha || '')) throw new Error('Expected play, language, audio, audio SHA256, captions, report and output');
const audioPath = path.resolve(audio), bytes = fs.readFileSync(audioPath);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== expectedSha) throw new Error('Audio SHA256 does not match');
const steps = alignedCues(playId, locale, JSON.parse(fs.readFileSync(captions)), JSON.parse(fs.readFileSync(report)));
const data = { playId, locale, audio: path.relative(path.dirname(path.resolve(output)), audioPath), steps,
  alignment: { audioSha256: hash, captionsSha256: createHash('sha256').update(fs.readFileSync(captions)).digest('hex'),
    reportSha256: createHash('sha256').update(fs.readFileSync(report)).digest('hex'), note: 'Timing only; narration content and source binding require independent review.' } };
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
console.log(`Wrote ${output}; verify actual audio and alignment before delivery.`);
