/* Caesar Games — Junqi Rules Engine (V1)
 *
 * Canonical board: 12 rows (0 = Red back line, 11 = Navy back line) x 5 columns.
 * Board state is ALWAYS stored in canonical coordinates. Perspective is a
 * display-only concern handled by the view layer.
 *
 * The movement graph below is derived from the drawn board topology so that
 * "what you can see" and "where you may move" can never diverge.
 */

import { t } from '../i18n/strings.js';

export const ROWS = 12;
export const COLS = 5;

export const RULES_VERSION = 'junqi-v1.1';

export const PIECE_TYPES = {
  FIELD_MARSHAL:       { name: '司令', en: 'Field Marshal',       rank: 1,  count: 1 },
  CORPS_COMMANDER:     { name: '军长', en: 'Corps Commander',     rank: 2,  count: 1 },
  DIVISION_COMMANDER:  { name: '师长', en: 'Division Commander',  rank: 3,  count: 2 },
  BRIGADE_COMMANDER:   { name: '旅长', en: 'Brigade Commander',   rank: 4,  count: 2 },
  REGIMENT_COMMANDER:  { name: '团长', en: 'Regiment Commander',  rank: 5,  count: 2 },
  BATTALION_COMMANDER: { name: '营长', en: 'Battalion Commander', rank: 6,  count: 2 },
  COMPANY_COMMANDER:   { name: '连长', en: 'Company Commander',   rank: 7,  count: 3 },
  PLATOON_COMMANDER:   { name: '排长', en: 'Platoon Commander',   rank: 8,  count: 3 },
  ENGINEER:            { name: '工兵', en: 'Engineer',            rank: 9,  count: 3 },
  MINE:                { name: '地雷', en: 'Mine',                rank: 10, count: 3, static: true },
  BOMB:                { name: '炸弹', en: 'Bomb',                rank: 99, count: 2 },
  FLAG:                { name: '军旗', en: 'Flag',                rank: 0,  count: 1, static: true }
};

export const FIELD_MARSHAL = '司令';
export const ENGINEER = '工兵';
export const MINE = '地雷';
export const BOMB = '炸弹';
export const FLAG = '军旗';

export const CAMPS = new Set([
  '2-1', '2-3', '3-2', '4-1', '4-3',
  '7-1', '7-3', '8-2', '9-1', '9-3'
]);

export const HEADQUARTERS = new Set(['0-1', '0-3', '11-1', '11-3']);

/** Columns at which the two halves are joined across the front line. */
const FRONT_LINE_COLS = [0, 2, 4];
/** Columns 0 and 4 cross the front line on rail; column 2 crosses on road. */
const FRONT_LINE_RAIL_COLS = [0, 4];

export const key = (r, c) => `${r}-${c}`;
export const parseKey = (k) => k.split('-').map(Number);

export const sideOf = (r) => (r <= 5 ? 'red' : 'navy');
export const territoryRows = (side) => (side === 'navy' ? [6, 11] : [0, 5]);
export const homeRowsOf = (side) => (side === 'navy' ? [10, 11] : [0, 1]);
export const frontRowOf = (side) => (side === 'navy' ? 6 : 5);
export const hqKeysOf = (side) => (side === 'navy' ? ['11-1', '11-3'] : ['0-1', '0-3']);

export function inTerritory(side, k) {
  const [r] = parseKey(k);
  const [lo, hi] = territoryRows(side);
  return r >= lo && r <= hi;
}

/* ------------------------------------------------------------------ *
 * Board topology
 * ------------------------------------------------------------------ */

/** Positions that sit on a railway. Rows 1/5/6/10 plus the outer columns. */
export const RAILWAYS = (() => {
  const s = new Set();
  for (const r of [1, 5, 6, 10]) for (let c = 0; c < COLS; c++) s.add(key(r, c));
  for (let r = 1; r <= 10; r++) { s.add(key(r, 0)); s.add(key(r, 4)); }
  return s;
})();

function buildAdjacency() {
  const road = new Map();   // key -> Set of road-adjacent keys
  const rail = new Map();   // key -> Set of rail-adjacent keys
  const all = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) all.push(key(r, c));
  all.forEach(k => { road.set(k, new Set()); rail.set(k, new Set()); });

  const linkRoad = (a, b) => { road.get(a).add(b); road.get(b).add(a); };
  const linkRail = (a, b) => { rail.get(a).add(b); rail.get(b).add(a); };

  // Horizontal road links exist on every row.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 1; c++) linkRoad(key(r, c), key(r, c + 1));

  // Vertical road links inside each half.
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= 4; r++) linkRoad(key(r, c), key(r + 1, c));
    for (let r = 6; r <= 10; r++) linkRoad(key(r, c), key(r + 1, c));
  }

  // The front line is crossed only at columns 0, 2 and 4.
  for (const c of FRONT_LINE_COLS) linkRoad(key(5, c), key(6, c));

  // Campsite diagonals: each camp joins its four corner neighbours.
  for (const camp of CAMPS) {
    const [r, c] = parseKey(camp);
    for (const dr of [-1, 1]) for (const dc of [-1, 1]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      linkRoad(camp, key(nr, nc));
    }
  }

  // Railway segments: along rail rows, and down the two outer columns.
  for (const r of [1, 5, 6, 10]) for (let c = 0; c < COLS - 1; c++) linkRail(key(r, c), key(r, c + 1));
  for (const c of [0, 4]) for (let r = 1; r <= 9; r++) linkRail(key(r, c), key(r + 1, c));

  return { road, rail };
}

const ADJ = buildAdjacency();

export const roadNeighbors = (k) => [...(ADJ.road.get(k) || [])];
export const railNeighbors = (k) => [...(ADJ.rail.get(k) || [])];
export const isRoadAdjacent = (a, b) => !!ADJ.road.get(a)?.has(b);
export const isRailAdjacent = (a, b) => !!ADJ.rail.get(a)?.has(b);
export const isFrontLineRailBridge = (a, b) => {
  const [ar, ac] = parseKey(a), [br, bc] = parseKey(b);
  return ac === bc && FRONT_LINE_RAIL_COLS.includes(ac) && Math.min(ar, br) === 5 && Math.max(ar, br) === 6;
};

/* ------------------------------------------------------------------ *
 * Army construction & setup generation
 * ------------------------------------------------------------------ */

export function createStandardArmy(side) {
  const army = [];
  Object.values(PIECE_TYPES).forEach(pt => {
    for (let i = 0; i < pt.count; i++) {
      army.push({
        id: `${side}-${pt.name}-${i}`,
        side,
        name: pt.name,
        rank: pt.rank,
        static: !!pt.static,
        revealed: false
      });
    }
  });
  return army;
}

/** All legal (non-camp) setup slots for a side, ordered back line first. */
export function setupSlotsOf(side) {
  const [lo, hi] = territoryRows(side);
  const slots = [];
  for (let r = lo; r <= hi; r++) for (let c = 0; c < COLS; c++) {
    const k = key(r, c);
    if (!CAMPS.has(k)) slots.push(k);
  }
  return slots;
}

function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a formation that satisfies every placement restriction.
 * Constraint-first: Flag, then Mines, then bomb-safe filling of the front row.
 */
export function generateLegalSetup(side, rng = Math.random) {
  const army = createStandardArmy(side);
  const positions = {};

  const take = (predicate) => {
    const idx = army.findIndex(predicate);
    return idx === -1 ? null : army.splice(idx, 1)[0];
  };

  // 1. Flag into one of the two headquarters.
  const hqs = hqKeysOf(side);
  const flagSlot = hqs[Math.floor(rng() * hqs.length)];
  positions[flagSlot] = take(p => p.name === FLAG);

  // 2. Mines into the back two rows.
  const homeRows = homeRowsOf(side);
  let mineSlots = setupSlotsOf(side)
    .filter(k => homeRows.includes(parseKey(k)[0]) && !positions[k]);
  mineSlots = shuffle(mineSlots, rng);
  for (let i = 0; i < PIECE_TYPES.MINE.count; i++) {
    positions[mineSlots[i]] = take(p => p.name === MINE);
  }

  // 3. Everything else. Bombs may not stand on the front row, so the front row
  //    is filled from the non-bomb pool first.
  const frontRow = frontRowOf(side);
  const openSlots = shuffle(setupSlotsOf(side).filter(k => !positions[k]), rng);
  const frontSlots = openSlots.filter(k => parseKey(k)[0] === frontRow);
  const otherSlots = openSlots.filter(k => parseKey(k)[0] !== frontRow);

  const bombs = army.filter(p => p.name === BOMB);
  const rest = shuffle(army.filter(p => p.name !== BOMB), rng);

  frontSlots.forEach(k => { positions[k] = rest.pop(); });
  shuffle([...rest, ...bombs], rng).forEach((piece, i) => { positions[otherSlots[i]] = piece; });

  return positions;
}

/* ------------------------------------------------------------------ *
 * Setup legality
 * ------------------------------------------------------------------ */

export function validatePiecePlacementInSetup(piece, targetKey) {
  if (!piece) return { valid: true };
  const [r] = parseKey(targetKey);
  const side = piece.side;

  if (CAMPS.has(targetKey)) {
    return { valid: false, reason: t('rule.campEmpty') };
  }
  if (!inTerritory(side, targetKey)) {
    const [lo, hi] = territoryRows(side);
    return { valid: false, reason: t('rule.ownTerritory', { lo, hi }) };
  }
  if (piece.name === FLAG && !hqKeysOf(side).includes(targetKey)) {
    return { valid: false, reason: t('rule.flagInHq') };
  }
  if (piece.name === MINE && !homeRowsOf(side).includes(r)) {
    return { valid: false, reason: t('rule.minesBack') };
  }
  if (piece.name === BOMB && r === frontRowOf(side)) {
    return { valid: false, reason: t('rule.bombFront') };
  }
  return { valid: true };
}

export function validateSwapInSetup(pieceA, posA, pieceB, posB) {
  const a = validatePiecePlacementInSetup(pieceA, posB);
  if (!a.valid) return a;
  if (pieceB) {
    const b = validatePiecePlacementInSetup(pieceB, posA);
    if (!b.valid) return b;
  }
  return { valid: true };
}

/** Whole-formation check used before a player is allowed to lock in. */
export function validateFormation(boardState, side) {
  const problems = [];
  const mine = Object.entries(boardState).filter(([, p]) => p && p.side === side);

  if (mine.length !== 25) problems.push(t('rule.pieceCount', { n: mine.length }));

  const flag = mine.find(([, p]) => p.name === FLAG);
  if (!flag) problems.push(t('rule.flagMissing'));
  else if (!hqKeysOf(side).includes(flag[0])) problems.push(t('rule.flagInHq'));

  for (const [k, p] of mine) {
    const check = validatePiecePlacementInSetup(p, k);
    if (!check.valid) problems.push(check.reason);
  }

  const seen = new Set();
  for (const [, p] of mine) {
    if (seen.has(p.id)) problems.push(t('rule.duplicate'));
    seen.add(p.id);
  }

  return { valid: problems.length === 0, problems: [...new Set(problems)] };
}

/* ------------------------------------------------------------------ *
 * Combat
 * ------------------------------------------------------------------ */

export const COMBAT = {
  ATTACKER_WINS: 'attacker',
  DEFENDER_WINS: 'defender',
  BOTH_REMOVED: 'both'
};

/**
 * Pure combat resolution. Returns a plain result — no board mutation.
 * Order matters: Flag capture is decided before the Bomb rule so that a Bomb
 * reaching the Flag still ends the game.
 */
export function resolveCombat(attacker, defender) {
  let result, reason, gameOver = false;

  if (defender.name === FLAG) {
    result = COMBAT.ATTACKER_WINS; reason = 'Flag captured'; gameOver = true;
  } else if (attacker.name === BOMB || defender.name === BOMB) {
    result = COMBAT.BOTH_REMOVED; reason = 'Bomb — both pieces removed';
  } else if (defender.name === MINE) {
    if (attacker.name === ENGINEER) { result = COMBAT.ATTACKER_WINS; reason = 'Engineer disarmed the Mine'; }
    else { result = COMBAT.DEFENDER_WINS; reason = 'Mine destroyed the attacker'; }
  } else if (attacker.name === MINE) {
    // Mines are static and can never attack; defensive guard only.
    result = COMBAT.DEFENDER_WINS; reason = 'Mines cannot attack';
  } else if (attacker.rank === defender.rank) {
    result = COMBAT.BOTH_REMOVED; reason = 'Equal rank — both pieces removed';
  } else if (attacker.rank < defender.rank) {
    result = COMBAT.ATTACKER_WINS; reason = `${attacker.name} defeated ${defender.name}`;
  } else {
    result = COMBAT.DEFENDER_WINS; reason = `${defender.name} held against ${attacker.name}`;
  }

  const removed = [];
  if (result === COMBAT.ATTACKER_WINS) removed.push(defender);
  else if (result === COMBAT.DEFENDER_WINS) removed.push(attacker);
  else removed.push(attacker, defender);

  // Losing the Field Marshal discloses that player's Flag position.
  const marshalLost = removed.filter(p => p.name === FIELD_MARSHAL).map(p => p.side);

  return { result, reason, gameOver, removed, marshalLost };
}

/* ------------------------------------------------------------------ *
 * Movement
 * ------------------------------------------------------------------ */

function railStraightReachable(fromKey, toKey, boardState) {
  if (!RAILWAYS.has(fromKey) || !RAILWAYS.has(toKey)) return false;
  const [fr, fc] = parseKey(fromKey);
  const [tr, tc] = parseKey(toKey);
  if (fr !== tr && fc !== tc) return false;

  const stepR = Math.sign(tr - fr);
  const stepC = Math.sign(tc - fc);
  let r = fr + stepR, c = fc + stepC;
  let prev = fromKey;

  while (true) {
    const k = key(r, c);
    if (!isRailAdjacent(prev, k)) return false;
    if (k === toKey) return true;
    if (boardState[k]) return false;
    prev = k;
    r += stepR; c += stepC;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  }
}

function railEngineerReachable(fromKey, toKey, boardState) {
  if (!RAILWAYS.has(fromKey) || !RAILWAYS.has(toKey)) return false;
  const seen = new Set([fromKey]);
  const queue = [fromKey];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of railNeighbors(cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (n === toKey) return true;
      if (!boardState[n]) queue.push(n);   // may only pass through empty stations
    }
  }
  return false;
}

/**
 * Can `piece` at `fromKey` legally move to `toKey`?
 * Returns { allowed, reason }.
 */
export function canPieceMove(piece, fromKey, toKey, boardState) {
  if (!piece) return { allowed: false, reason: t('rule.noSelection') };
  if (fromKey === toKey) return { allowed: false, reason: t('rule.alreadyThere') };
  if (piece.static) {
    return {
      allowed: false,
      reason: piece.name === MINE
        ? t('rule.mineStatic')
        : t('rule.flagStatic')
    };
  }
  if (HEADQUARTERS.has(fromKey)) {
    return { allowed: false, reason: t('rule.hqLocked') };
  }

  const target = boardState[toKey];
  if (target && target.side === piece.side) {
    return { allowed: false, reason: t('rule.ownPiece') };
  }
  if (target && CAMPS.has(toKey)) {
    return { allowed: false, reason: t('rule.campSafe') };
  }

  if (isRoadAdjacent(fromKey, toKey)) return { allowed: true, via: 'road' };

  if (RAILWAYS.has(fromKey) && RAILWAYS.has(toKey)) {
    if (piece.name === ENGINEER) {
      if (railEngineerReachable(fromKey, toKey, boardState)) return { allowed: true, via: 'rail' };
      return { allowed: false, reason: t('rule.railBlocked') };
    }
    if (railStraightReachable(fromKey, toKey, boardState)) return { allowed: true, via: 'rail' };
    return { allowed: false, reason: t('rule.noCorner') };
  }

  return { allowed: false, reason: t('rule.notConnected') };
}

/** Every legal move for a side, given a (possibly redacted) board. */
export function legalMovesFor(side, boardState) {
  const moves = [];
  for (const from of Object.keys(boardState)) {
    const piece = boardState[from];
    if (!piece || piece.side !== side || piece.static) continue;
    if (HEADQUARTERS.has(from)) continue;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const to = key(r, c);
      if (to === from) continue;
      if (canPieceMove(piece, from, to, boardState).allowed) moves.push({ from, to, piece });
    }
  }
  return moves;
}

/** A side that still holds its Flag but cannot move has lost. */
export function hasLostByImmobility(side, boardState) {
  return legalMovesFor(side, boardState).length === 0;
}

export function findFlag(side, boardState) {
  return Object.keys(boardState).find(k => boardState[k]?.side === side && boardState[k].name === FLAG) || null;
}
