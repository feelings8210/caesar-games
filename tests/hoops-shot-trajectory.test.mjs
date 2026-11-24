import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewShotPoint, reviewShotWithVelocity } from '../scripts/hoops-shot-trajectory.mjs';

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

test('shot release and arrival velocities remain continuous', () => {
  const start = [2, 8, 20], rim = [0, 10, 5], v0 = [1, 7, -4], v1 = [-2, -5, -3], duration = .9, dt = .00001;
  const point = t => reviewShotWithVelocity(start, rim, v0, v1, t, duration, 2);
  assert.deepEqual(point(0), start);
  assert.deepEqual(point(duration), rim);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs((point(dt)[i] - start[i]) / dt - v0[i]) < .002);
    assert.ok(Math.abs((rim[i] - point(duration - dt)[i]) / dt - v1[i]) < .002);
  }
  assert.throws(() => reviewShotWithVelocity(start, rim, v0, v1, 0, 0, 2), /Invalid/);
});
