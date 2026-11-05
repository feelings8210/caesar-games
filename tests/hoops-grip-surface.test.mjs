import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSignedDistances } from '../scripts/hoops-grip-surface.mjs';
test('reports sampled penetration and proximity without treating them as acceptance', () => {
  assert.deepEqual(summarizeSignedDistances([-.1, -.01, .01, .2], .02),
    { count: 4, min: -.1, max: .2, nearestAbsolute: .01, insideBeyondTolerance: 1, nearSurface: 2, tolerance: .02 });
  assert.throws(() => summarizeSignedDistances([]), /Invalid/);
  assert.throws(() => summarizeSignedDistances([NaN]), /Invalid/);
});
