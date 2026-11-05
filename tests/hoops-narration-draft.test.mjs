import test from 'node:test';
import assert from 'node:assert/strict';
import { narrationDraft } from '../scripts/hoops-narration-draft.mjs';
import { PLAYS } from '../js/games/hoops/playbook.js';

test('narration draft follows the exact play and action order', () => {
  const play = PLAYS.find(p => p.id === 'horns-pop');
  const draft = narrationDraft('horns-pop', 'zh');
  assert.equal(draft.script, play.steps.map(s => s.say.zh).join('\n') + '\n');
  assert.deepEqual(draft.steps.map(s => s.actionMs), [700, 1700, 900, 1450]);
  assert.throws(() => narrationDraft('unknown', 'zh'), /Unknown/);
});
