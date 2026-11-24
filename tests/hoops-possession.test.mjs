import test from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, shotZone, openness, makeChance, resolveShot, seededRng } from '../js/games/hoops/shot-model.js';
import { HORNS_POSSESSION, HORNS_SETUP, pickCoverage, readLevel } from '../js/games/hoops/possession.js';

const ids = Object.keys(HORNS_SETUP).filter(k => /^[od]\d$/.test(k));

/** Replay beats on plain positions the way the controller predicts a release. */
function apply(state, beats) {
  const s = { pos: Object.fromEntries(Object.entries(state.pos).map(([k, v]) => [k, [...v]])), holder: state.holder, shots: [] };
  for (const b of beats || []) {
    for (const [id, dest] of Object.entries(b.move || {})) s.pos[id] = [...(Array.isArray(dest[0]) ? dest[dest.length - 1] : dest)];
    if (b.pass) s.holder = b.pass;
    if (b.ball) s.holder = b.ball;
    if (b.shot === 'model') s.shots.push(resolveShot(s.holder, s.pos[s.holder], s.pos, () => 0.5));
  }
  return s;
}
const start = () => ({ pos: Object.fromEntries(ids.map(id => [id, [...HORNS_SETUP[id]]])), holder: HORNS_SETUP.ball, shots: [] });

test('shot zones follow distance from the rim', () => {
  assert.equal(shotZone([0, 8]), 'rim');
  assert.equal(shotZone([0, 20]), 'mid');
  assert.equal(shotZone([22, 4]), 'three');
  assert.equal(shotZone([0, 28]), 'three');
});

test('openness finds the nearest defender only', () => {
  const o = openness([0, 20], { o1: [0, 20.5], d1: [0, 24], d2: [6, 20] });
  assert.equal(o.by, 'd1');
  assert.equal(o.feet, 4);
  assert.equal(o.tier, 'pressured');
});

test('being open matters more than the star rating', () => {
  const openAverage = makeChance('three', 3, 9);
  const contestedStar = makeChance('three', 5, 2);
  assert.ok(openAverage > contestedStar, `${openAverage} should beat ${contestedStar}`);
  assert.ok(makeChance('rim', 5, 12) <= 0.85);
  assert.ok(makeChance('three', 1, 0) >= 0.05);
});

test('resolveShot is deterministic with a seeded RNG and scores 3 from deep', () => {
  const pos = { o2: [22, 4], d2: [10, 4] };
  const a = resolveShot('o2', pos.o2, pos, seededRng(7));
  const b = resolveShot('o2', pos.o2, pos, seededRng(7));
  assert.deepEqual(a, b);
  assert.equal(a.points, 3);
  assert.equal(a.rating, ROSTER.o2.three);
});

test('every read node is well formed and every next read exists', () => {
  for (const cov of HORNS_POSSESSION.coverages) {
    assert.ok(cov.nodes[cov.start], `${cov.id} start`);
    for (const [nodeId, node] of Object.entries(cov.nodes)) {
      const lvl = readLevel(HORNS_POSSESSION, cov, nodeId);
      assert.ok(lvl.prompt.zh && lvl.prompt.en && lvl.rule.zh && lvl.cue.text.zh, `${nodeId} text`);
      assert.ok(ids.includes(node.you), `${nodeId} you`);
      assert.equal(node.options.filter(o => o.grade === 3).length, 1, `${nodeId} has one best read`);
      for (const opt of node.options) {
        if (opt.next) assert.ok(cov.nodes[opt.next], `${nodeId} → ${opt.next}`);
        const model = (opt.play || []).some(b => b.shot === 'model');
        if (model) assert.ok(opt.result.make?.zh && opt.result.miss?.zh, `${nodeId} model shot has make/miss text`);
        else assert.ok(opt.result.zh, `${nodeId} result text`);
        for (const b of [...(opt.play || []), ...(node.intro || [])]) for (const id of Object.keys(b.move || {})) assert.ok(ids.includes(id), `${nodeId} moves ${id}`);
      }
    }
  }
});

test('in every read the best option is the best shot the defense allows', () => {
  for (const cov of HORNS_POSSESSION.coverages) {
    const walk = (nodeId, state) => {
      const node = cov.nodes[nodeId];
      const here = nodeId === cov.start ? state : apply(state, node.intro);
      const chance = opt => {
        let s = apply(here, opt.play);
        // A shot the text calls a three must be released behind the line.
        const says3 = /three/i.test(`${opt.label?.en || ''} ${opt.result?.make?.en || ''}`);
        if (says3 && s.shots[0]) assert.equal(s.shots[0].zone, 'three', `${cov.id}/${nodeId}: ${opt.label?.en || opt.to} should be a three`);
        if (opt.next) s = walk(opt.next, s);
        return s.best ?? s.shots[0]?.chance ?? null;
      };
      const best = node.options.find(o => o.grade === 3);
      const bestChance = chance(best);
      assert.ok(bestChance !== null, `${cov.id}/${nodeId}: the best read ends in a shot`);
      for (const opt of node.options) {
        if (opt === best) continue;
        const c = chance(opt);
        if (c !== null) assert.ok(bestChance > c, `${cov.id}/${nodeId}: best ${bestChance.toFixed(2)} vs ${opt.label?.en || opt.to} ${c.toFixed(2)}`);
      }
      return { ...here, best: bestChance };
    };
    walk(cov.start, apply(start(), cov.intro));
  }
});

test('coverage choice avoids repeating the last one', () => {
  for (let k = 0; k < 20; k++) {
    const c = pickCoverage(HORNS_POSSESSION, 'drop', () => k / 20);
    assert.notEqual(c.id, 'drop');
  }
  const ids = new Set(Array.from({ length: 30 }, (_, k) => pickCoverage(HORNS_POSSESSION, null, () => k / 30).id));
  assert.equal(ids.size, HORNS_POSSESSION.coverages.length);
});
