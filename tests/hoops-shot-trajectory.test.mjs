import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewShotPoint } from '../scripts/hoops-shot-trajectory.mjs';

test('review shot arc starts at release, rises and reaches the rim', () => {
  const hand = [2, 8, 20], rim = [0, 10, 5];
  assert.deepEqual(reviewShotPoint(hand, rim, 0, 1, 6), hand);
  assert.deepEqual(reviewShotPoint(hand, rim, 1, 1, 6), rim);
  assert.deepEqual(reviewShotPoint(hand, rim, .5, 1, 6), [1, 15, 12.5]);
  assert.deepEqual(reviewShotPoint(hand, rim, -1, 1, 6), hand);
  assert.deepEqual(reviewShotPoint(hand, rim, 2, 1, 6), rim);
  assert.throws(() => reviewShotPoint(hand, rim, 0, 0, 6), /Invalid/);
  assert.throws(() => reviewShotPoint(hand, [0, NaN, 0], 0, 1, 6), /Invalid/);
});
