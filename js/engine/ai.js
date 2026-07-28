/* Caesar Games — Local Computer Opponent
 *
 * Standard uses only the sanitized observation produced below. Unknown enemy
 * identities are represented by a public probability pool; no canonical
 * hidden name, rank, static flag, or identity reaches the decision code.
 */

import {
  canPieceMove, legalMovesFor, CAMPS, FLAG, ENGINEER, FIELD_MARSHAL,
  MINE, BOMB, COMBAT, PIECE_TYPES, RAILWAYS, resolveCombat, parseKey
} from './rules.js';

export function createAiObservation(aiSide, boardState, flagDisclosed = {}) {
  const obs = {};
  let anon = 0;
  for (const [k, p] of Object.entries(boardState)) {
    if (!p) continue;
    if (p.side === aiSide) {
      obs[k] = { ...p };
      continue;
    }

    const publiclyKnown = !!p.revealed || (p.name === FLAG && flagDisclosed[p.side]);
    if (publiclyKnown) {
      obs[k] = { ...p };
      continue;
    }

    anon += 1;
    obs[k] = {
      id: `unknown-${anon}`,
      side: p.side,
      unknown: true,
      static: false,
      revealed: false
    };
  }
  return obs;
}

const PIECE_VALUE = {
  '司令': 100, '军长': 80, '师长': 60, '旅长': 45, '团长': 35,
  '营长': 28, '连长': 20, '排长': 14, '工兵': 18, '地雷': 30,
  '炸弹': 42, '军旗': 1000
};

const enemyOf = side => side === 'red' ? 'navy' : 'red';
const cloneBoard = board => Object.fromEntries(
  Object.entries(board).map(([k, p]) => [k, p ? { ...p } : p])
);
const distance = (a, b) => {
  const [ar, ac] = parseKey(a), [br, bc] = parseKey(b);
  return Math.abs(ar - br) + Math.abs(ac - bc);
};

function remainingEnemyPool(obs, enemySide) {
  const counts = new Map(Object.values(PIECE_TYPES).map(p => [p.name, p.count]));
  for (const piece of Object.values(obs)) {
    if (piece?.side === enemySide && !piece.unknown && counts.has(piece.name)) {
      counts.set(piece.name, Math.max(0, counts.get(piece.name) - 1));
    }
  }
  return Object.values(PIECE_TYPES).flatMap(type =>
    Array.from({ length: counts.get(type.name) || 0 }, () => ({
      side: enemySide, name: type.name, rank: type.rank, static: !!type.static
    }))
  );
}

function expectedUnknownCapture(attacker, pool) {
  if (!pool.length) return 0;
  let total = 0;
  for (const defender of pool) {
    const combat = resolveCombat(attacker, defender);
    const targetValue = PIECE_VALUE[defender.name] || 20;
    const attackerValue = PIECE_VALUE[attacker.name] || 20;
    if (combat.gameOver) total += 5000;
    else if (combat.result === COMBAT.ATTACKER_WINS) total += targetValue;
    else if (combat.result === COMBAT.BOTH_REMOVED) total += targetValue - attackerValue;
    else total -= attackerValue;
  }
  return total / pool.length;
}

function knownCombatValue(attacker, defender) {
  const result = resolveCombat(attacker, defender);
  if (result.gameOver) return 100000;
  const mine = PIECE_VALUE[attacker.name] || 20;
  const theirs = PIECE_VALUE[defender.name] || 20;
  if (result.result === COMBAT.ATTACKER_WINS) return theirs;
  if (result.result === COMBAT.BOTH_REMOVED) return theirs - mine;
  return -mine;
}

function boardAfterAssumedSurvival(obs, move) {
  const next = cloneBoard(obs);
  delete next[move.from];
  next[move.to] = { ...move.piece };
  return next;
}

function tacticalExposure(board, aiSide, movedTo) {
  const enemy = enemyOf(aiSide);
  let worst = 0;
  let pressure = 0;
  for (const reply of legalMovesFor(enemy, board)) {
    const target = board[reply.to];
    if (!target || target.side !== aiSide) continue;
    const targetValue = PIECE_VALUE[target.name] || 20;
    let threat;
    if (reply.piece.unknown) {
      // Unknown attackers are possible pressure, not clairvoyant certainty.
      threat = targetValue * 0.24;
    } else {
      const result = resolveCombat(reply.piece, target);
      threat = result.result === COMBAT.DEFENDER_WINS ? 0 :
        result.result === COMBAT.BOTH_REMOVED
          ? Math.max(0, targetValue - (PIECE_VALUE[reply.piece.name] || 20))
          : targetValue;
    }
    pressure += threat * 0.04;
    if (reply.to === movedTo) worst = Math.max(worst, threat);
  }
  return worst + Math.min(18, pressure);
}

function positionalValue(move, obs, aiSide) {
  const piece = move.piece;
  const target = obs[move.to];
  const [fr, fc] = parseKey(move.from);
  const [tr, tc] = parseKey(move.to);
  const forward = aiSide === 'red' ? tr - fr : fr - tr;
  let value = forward * 2.2;

  if (CAMPS.has(move.to)) value += 13;
  if (RAILWAYS.has(move.to)) value += piece.name === ENGINEER ? 8 : 3;
  value += 2 - Math.abs(2 - tc);
  if (piece.name === FIELD_MARSHAL && !target) value -= 8;

  const enemyFlag = Object.entries(obs).find(([, p]) =>
    p?.side !== aiSide && !p.unknown && p.name === FLAG);
  if (enemyFlag) {
    value += (distance(move.from, enemyFlag[0]) - distance(move.to, enemyFlag[0])) * 24;
  }

  if (piece.name === ENGINEER) {
    const mines = Object.entries(obs).filter(([, p]) =>
      p?.side !== aiSide && !p.unknown && p.name === MINE);
    for (const [at] of mines) {
      value += (distance(move.from, at) - distance(move.to, at)) * 5;
    }
  }

  const ownFlag = Object.entries(obs).find(([, p]) => p?.side === aiSide && p.name === FLAG);
  if (ownFlag && distance(move.from, ownFlag[0]) <= 2 && distance(move.to, ownFlag[0]) > 2) {
    value -= 8;
  }
  return value;
}

export class LocalJunqiAI {
  constructor(difficulty = 'standard') {
    this.difficulty = difficulty === 'relaxed' ? 'relaxed' : 'standard';
  }

  selectMove(aiSide, rawBoardState, flagDisclosed = {}, diagnostics = null) {
    const started = globalThis.performance?.now?.() ?? Date.now();
    const obs = createAiObservation(aiSide, rawBoardState, flagDisclosed);
    const moves = legalMovesFor(aiSide, obs);
    if (!moves.length) return null;

    const pool = remainingEnemyPool(obs, enemyOf(aiSide));
    const scored = moves.map(move => {
      const target = obs[move.to];
      let score = positionalValue(move, obs, aiSide);
      if (target && target.side !== aiSide) {
        score += target.unknown
          ? expectedUnknownCapture(move.piece, pool)
          : knownCombatValue(move.piece, target);
      }

      if (this.difficulty === 'standard') {
        const assumed = boardAfterAssumedSurvival(obs, move);
        score -= tacticalExposure(assumed, aiSide, move.to);
        score += Math.min(16, legalMovesFor(aiSide, assumed).length * 0.12);
      } else {
        score += (Math.random() - 0.5) * 34;
      }
      return { move, score };
    });

    scored.sort((a, b) =>
      b.score - a.score ||
      a.move.from.localeCompare(b.move.from) ||
      a.move.to.localeCompare(b.move.to));
    if (diagnostics) {
      diagnostics.candidates = moves.length;
      diagnostics.elapsedMs = (globalThis.performance?.now?.() ?? Date.now()) - started;
      diagnostics.observationOnly = true;
    }
    return scored[0].move;
  }
}
