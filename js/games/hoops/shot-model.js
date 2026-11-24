/* Caesar Games — Hoops IQ, shot model for live possessions.
 *
 * Teaching goal: the read matters more than the star. A shot's chance comes
 * mostly from how open it is (distance to the nearest defender at release,
 * measured on the court), and only then from the shooter's role card. An
 * average shooter wide open beats a good shooter with a hand in his face.
 *
 * Numbers are simple game-design values, not NBA statistics.
 */

const T = (zh, en) => ({ zh, en });
export const RIM = [0, 5.25];

/** Role cards: 1–5 stars per shot zone plus passing. */
export const ROSTER = {
  o1: { role: T('组织者', 'Playmaker'), three: 3, mid: 4, rim: 3, pass: 5 },
  o2: { role: T('射手', 'Shooter'), three: 5, mid: 4, rim: 2, pass: 3 },
  o3: { role: T('射手', 'Shooter'), three: 4, mid: 3, rim: 3, pass: 3 },
  o4: { role: T('内线', 'Inside big'), three: 1, mid: 2, rim: 5, pass: 2 },
  o5: { role: T('外弹大个', 'Pick-and-pop big'), three: 4, mid: 3, rim: 4, pass: 3 }
};

export const ZONE_NAME = { three: T('三分', '3PT'), mid: T('中投', 'Mid-range'), rim: T('篮下', 'At the rim') };

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Shot zone from the release spot (feet). The corner three is 22 ft. */
export function shotZone(at) {
  const d = dist(at, RIM);
  if (d <= 6.5) return 'rim';
  return d >= 21.8 ? 'three' : 'mid';
}

/** Nearest defender (ids starting with "d") at release. */
export function openness(at, positions) {
  let best = Infinity, by = null;
  for (const [id, p] of Object.entries(positions || {})) {
    if (id[0] !== 'd' || !Array.isArray(p)) continue;
    const d = dist(at, p);
    if (d < best) { best = d; by = id; }
  }
  const tier = best < 3 ? 'contested' : best < 5 ? 'pressured' : best < 8 ? 'open' : 'wide';
  return { feet: best, by, tier };
}

export const TIER_NAME = {
  contested: T('严防', 'Contested'),
  pressured: T('有干扰', 'Pressured'),
  open: T('空位', 'Open'),
  wide: T('大空位', 'Wide open')
};

const BASE = { three: [.20, .05], mid: [.28, .05], rim: [.42, .06] };

/** Make chance from zone, 1–5 rating and distance to the nearest defender. */
export function makeChance(zone, rating, feet) {
  const [a, b] = BASE[zone];
  const r = Math.min(5, Math.max(1, Math.round(rating || 1)));
  const open = Math.min(1.15, Math.max(.45, .45 + .09 * (Number.isFinite(feet) ? feet : 12)));
  return Math.min(.85, Math.max(.05, (a + b * r) * open));
}

/** Resolve a shot. `rng` returns [0, 1); pass a seeded one in tests. */
export function resolveShot(shooter, at, positions, rng = Math.random) {
  const zone = shotZone(at);
  const card = ROSTER[shooter] || { three: 2, mid: 2, rim: 2 };
  const open = openness(at, positions);
  const chance = makeChance(zone, card[zone], open.feet);
  return { shooter, zone, rating: card[zone], role: card.role, open, chance, made: rng() < chance, points: zone === 'three' ? 3 : 2 };
}

/** Small deterministic RNG for tests and replays. */
export function seededRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
