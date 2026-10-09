import assert from 'node:assert/strict';
import test from 'node:test';
import { madeBallAt } from '../js/games/hoops/ball-motion.js';

test('made basket starts at the rim and falls through the net before reaching the floor', () => {
  assert.equal(madeBallAt(0).height, 10.3);
  assert.ok(madeBallAt(0.2).height < 10.3 && madeBallAt(0.2).height > 8);
  assert.ok(madeBallAt(0.5).height > 0.45);
  assert.equal(madeBallAt(0.5).contacts, 0);
});

test('each contact is continuous, rebounds diminish, and the settled ball stops moving', () => {
  let previous = madeBallAt(0), contacts = [], peaks = [0, 0, 0];
  for (let i = 1; i <= 2500; i++) {
    const at = madeBallAt(i / 1000);
    assert.ok(at.height >= 0.45 && Number.isFinite(at.height));
    assert.ok(Math.abs(at.height - previous.height) < 0.027, 'no position jump at contact');
    if (at.contacts > previous.contacts) contacts.push(at.contacts);
    if (at.contacts >= 1 && at.contacts <= 3) peaks[at.contacts - 1] = Math.max(peaks[at.contacts - 1], at.height);
    previous = at;
  }
  assert.deepEqual(contacts, [1, 2, 3, 4]);
  assert.ok(peaks[0] > peaks[1] && peaks[1] > peaks[2] && peaks[2] > 0.45);
  assert.deepEqual(madeBallAt(3), madeBallAt(100));
  assert.equal(madeBallAt(3).settled, true);
});

test('skipped frames and custom rim height still sample a valid trajectory', () => {
  assert.deepEqual(madeBallAt(-1), madeBallAt(0));
  const late = madeBallAt(1.7, 9, 0.4);
  assert.ok(late.contacts > 1 && late.height >= 0.4);
  assert.equal(madeBallAt(10, 9, 0.4).height, 0.4);
});
