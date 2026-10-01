import assert from 'node:assert/strict';
import { CHAPTER, LEVELS, VARIANTS } from '../js/games/hoops/levels.js';
import { FAMILIES, TAGS, mirrorLevel, pickRound } from '../js/games/hoops/families.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

const bilingual = (v, where) => {
  assert.ok(v && typeof v.zh === 'string' && v.zh.trim(), `${where} missing zh`);
  assert.ok(typeof v.en === 'string' && v.en.trim(), `${where} missing en`);
};

const onCourt = ([x, y], where) => {
  assert.ok(Number.isFinite(x) && Number.isFinite(y), `${where} not a point`);
  assert.ok(x >= -25.5 && x <= 25.5 && y >= -1 && y <= 49.5, `${where} off the floor: ${x},${y}`);
};

function checkBeats(beats, lvl, where) {
  assert.ok(Array.isArray(beats) && beats.length, `${where} has no beats`);
  beats.forEach((b, i) => {
    const at = `${where}[${i}]`;
    assert.ok(b.ms > 0, `${at} needs ms`);
    for (const [id, dest] of Object.entries(b.move || {})) {
      assert.ok(id in lvl.setup, `${at} moves unknown ${id}`);
      const pts = Array.isArray(dest[0]) ? dest : [dest];
      pts.forEach((p, k) => onCourt(p, `${at}.${id}#${k}`));
    }
    for (const key of ['pass', 'ball']) {
      if (b[key]) assert.ok(b[key] in lvl.setup, `${at} ${key} to unknown ${b[key]}`);
    }
    if (b.shot) assert.ok(['make', 'miss', 'block'].includes(b.shot), `${at} bad shot ${b.shot}`);
    if (b.call) { assert.ok(b.call[0] in lvl.setup, `${at} call on unknown`); bilingual(b.call[1], `${at} call`); }
  });
}

test('chapter copy is bilingual', () => {
  bilingual(CHAPTER.title, 'chapter.title');
  bilingual(CHAPTER.sub, 'chapter.sub');
});

test('chapter has ten levels with unique ids', () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, 10);
});

[...LEVELS, ...VARIANTS].forEach((lvl, n) => {
  const where = `level ${n + 1} (${lvl.id})`;

  test(`${where}: copy`, () => {
    ['title', 'concept', 'prompt', 'rule'].forEach(k => bilingual(lvl[k], `${where}.${k}`));
    bilingual(lvl.cue.text, `${where}.cue`);
  });

  test(`${where}: setup`, () => {
    assert.ok(lvl.you in lvl.setup, 'you is on the floor');
    assert.ok(lvl.setup.ball in lvl.setup, 'ball has a holder');
    Object.entries(lvl.setup).filter(([k]) => /^[od]\d$/.test(k)).forEach(([k, p]) => onCourt(p, `${where}.${k}`));
    assert.ok(lvl.decide >= 3 && lvl.decide <= 10, 'decision window is sane');
    const cueAt = lvl.cue.at;
    assert.ok(cueAt === 'clock' ? !!lvl.hud : cueAt in lvl.setup, 'cue points at something real');
  });

  test(`${where}: intro`, () => checkBeats(lvl.intro, lvl, `${where}.intro`));

  test(`${where}: options`, () => {
    assert.ok(lvl.options.length >= 2 && lvl.options.length <= 4, 'two to four options');
    assert.equal(lvl.options.filter(o => o.grade === 3).length, 1, 'exactly one best read');
    assert.ok(lvl.options.some(o => o.grade < 3), 'at least one alternative');
    lvl.options.forEach((o, i) => {
      const at = `${where}.options[${i}]`;
      assert.ok([0, 1, 3].includes(o.grade), `${at} grade`);
      assert.ok(['score', 'stop', 'miss', 'turnover', 'allowed', 'neutral'].includes(o.end), `${at} end`);
      bilingual(o.result, `${at}.result`);
      bilingual(o.why, `${at}.why`);
      if (o.kind === 'pass') {
        assert.ok(o.to in lvl.setup && o.to[0] === lvl.you[0] && o.to !== lvl.you, `${at} passes to a teammate`);
      } else if (o.kind === 'spot') {
        onCourt(o.at, `${at}.at`);
        bilingual(o.label, `${at}.label`);
      } else {
        assert.equal(o.kind, 'shoot', `${at} kind`);
        bilingual(o.label, `${at}.label`);
      }
      checkBeats(o.play, lvl, `${at}.play`);
    });
  });

  test(`${where}: targets are far enough apart to tap`, () => {
    const pts = lvl.options.map(o => (o.kind === 'pass' ? lvl.setup[o.to] : o.kind === 'shoot' ? [0, 5.25] : o.at));
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        assert.ok(d >= 2.4, `options ${i} and ${j} overlap (${d.toFixed(1)} ft)`);
      }
    }
  });
});

const targetKey = o => `${o.kind}:${o.to || ''}:${o.at ? o.at.join(',') : ''}:${o.label ? o.label.en : ''}`;

test('every level and variant carries a known skill tag', () => {
  for (const l of [...LEVELS, ...VARIANTS]) assert.ok(l.tag in TAGS, `${l.id} tag ${l.tag}`);
});

FAMILIES.forEach(f => {
  test(`family ${f.id}: variants are indistinguishable until the read`, () => {
    assert.ok(f.variants.length >= 2, 'at least two variants');
    const [first, ...rest] = f.variants;
    for (const v of rest) {
      assert.deepEqual(v.setup, first.setup, `${v.id} setup`);
      assert.equal(v.you, first.you, `${v.id} you`);
      assert.deepEqual(v.intro[0], first.intro[0], `${v.id} opening beat`);
      assert.deepEqual(v.options.map(targetKey).sort(), first.options.map(targetKey).sort(), `${v.id} option set`);
    }
    const bestKeys = f.variants.map(v => targetKey(v.options.find(o => o.grade === 3)));
    assert.ok(new Set(bestKeys).size >= 2, 'the right answer actually changes between variants');
  });
});

test('mirrored levels stay on the floor and keep their answers', () => {
  for (const l of [...LEVELS, ...VARIANTS]) {
    const m = mirrorLevel(l);
    for (const [k, p] of Object.entries(m.setup)) if (/^[od]\d$/.test(k)) onCourt(p, `${l.id} mirror ${k}`);
    assert.equal(m.options.findIndex(o => o.grade === 3), l.options.findIndex(o => o.grade === 3));
  }
});

test('round picker returns a playable, tightening round', () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const r = pickRound({ streak: i, rng });
    assert.ok(r.family && r.options.length && r.decide >= 2.5, 'round shape');
  }
});

console.log(`hoops: ${passed} passed`);
