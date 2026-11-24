/* Create a script draft and its provenance from the current playbook.
 * This does not register an episode, generate speech, or approve narration. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { PLAYS } from '../js/games/hoops/playbook.js';

export function narrationDraft(playId, locale) {
  const play = PLAYS.find(p => p.id === playId);
  if (!play || !['zh', 'en'].includes(locale)) throw new Error('Unknown play or locale');
  const steps = play.steps.map((step, index) => {
    const text = step.say[locale];
    if (typeof text !== 'string' || !text.trim() || !Array.isArray(step.beats) || !step.beats.length ||
        step.beats.some(b => !Number.isFinite(b.ms) || b.ms <= 0)) throw new Error(`Invalid step ${index + 1}`);
    return { index: index + 1, text, actionMs: step.beats.reduce((sum, b) => sum + b.ms, 0) };
  });
  // One paragraph: preserve the voice service's one-take short-form policy.
  return { playId, locale, title: play.title[locale], script: steps.map(s => s.text).join('\n') + '\n', steps };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [playId, locale, prefix] = process.argv.slice(2);
  if (process.argv.length !== 5) throw new Error('Usage: node scripts/hoops-narration-draft.mjs play-id zh|en output-prefix');
  const draft = narrationDraft(playId, locale);
  const scriptSha = createHash('sha256').update(draft.script).digest('hex');
  const sourceSha = createHash('sha256').update(fs.readFileSync(new URL('../js/games/hoops/playbook.js', import.meta.url))).digest('hex');
  const textFile = `${prefix}.txt`, jsonFile = `${prefix}.json`;
  fs.writeFileSync(textFile, draft.script, { flag: 'wx' });
  try {
    fs.writeFileSync(jsonFile, JSON.stringify({ schema: 'hoops-narration-draft-v1', ...draft, scriptSha256: scriptSha,
      playbookSha256: sourceSha, status: 'DRAFT_UNREVIEWED', note: 'Action durations are not narration timings.' }, null, 2) + '\n', { flag: 'wx' });
  } catch (error) { fs.unlinkSync(textFile); throw error; }
  console.log(`Draft: ${textFile}; provenance: ${jsonFile}`);
}
