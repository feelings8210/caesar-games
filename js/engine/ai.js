/* Caesar Games — Local Computer Opponent
 *
 * The AI is only ever handed a sanitized observation. An unrevealed human
 * piece must carry NO identifying information — not its name, not its rank,
 * and not its id (piece ids encode the rank, e.g. "navy-司令-0").
 */

import { canPieceMove, legalMovesFor, CAMPS, FLAG, ENGINEER, FIELD_MARSHAL, parseKey } from './rules.js';

/**
 * Build the AI's view of the board.
 * Opponent pieces the AI is not entitled to know are reduced to an opaque
 * token: position, side, and nothing else.
 */
export function createAiObservation(aiSide, boardState, flagDisclosed = {}) {
  const obs = {};
  let anon = 0;
  for (const [k, p] of Object.entries(boardState)) {
    if (!p) continue;
    if (p.side === aiSide) { obs[k] = { ...p }; continue; }

    const publiclyKnown = !!p.revealed || (p.name === FLAG && flagDisclosed[p.side]);
    if (publiclyKnown) { obs[k] = { ...p }; continue; }

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
  '营长': 28, '连长': 20, '排长': 14, '工兵': 16, '地雷': 30, '炸弹': 40, '军旗': 1000
};

export class LocalJunqiAI {
  constructor(difficulty = 'standard') {
    this.difficulty = difficulty === 'relaxed' ? 'relaxed' : 'standard';
  }

  /**
   * Choose a move for `aiSide`. `rawBoardState` is the canonical board; it is
   * immediately sanitized and never inspected directly.
   */
  selectMove(aiSide, rawBoardState, flagDisclosed = {}) {
    const obs = createAiObservation(aiSide, rawBoardState, flagDisclosed);
    const moves = legalMovesFor(aiSide, obs);
    if (!moves.length) return null;

    const scored = moves.map(m => ({ move: m, score: this.evaluate(m, obs, aiSide) }));

    if (this.difficulty === 'relaxed') {
      // Casual play: pick from the upper band rather than always the best line.
      scored.forEach(s => { s.score += (Math.random() - 0.5) * 30; });
    } else {
      scored.forEach(s => { s.score += (Math.random() - 0.5) * 2; });  // break ties
    }

    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  }

  evaluate(move, obs, aiSide) {
    const piece = move.piece;
    const target = obs[move.to];
    const [fr] = parseKey(move.from);
    const [tr] = parseKey(move.to);
    let score = 0;

    // Push toward the opponent's back line.
    score += (aiSide === 'red' ? (tr - fr) : (fr - tr)) * 2;

    if (target && target.side !== aiSide) {
      if (target.unknown) {
        // Trading an unknown is a gamble — send cheap pieces, hold the top brass.
        const mine = PIECE_VALUE[piece.name] ?? 20;
        if (piece.name === ENGINEER) score += 10;
        else if (mine <= 20) score += 12;
        else if (mine >= 80) score -= 25;
        else score += 2;
      } else if (target.name === FLAG) {
        score += 5000;
      } else if (piece.name === '炸弹') {
        score += (PIECE_VALUE[target.name] ?? 20) - 40;
      } else if (target.name === '地雷') {
        score += piece.name === ENGINEER ? 25 : -60;
      } else if (piece.rank < target.rank) {
        score += 40 + (PIECE_VALUE[target.name] ?? 20) * 0.4;
      } else if (piece.rank === target.rank) {
        score += 8 - (PIECE_VALUE[piece.name] ?? 20) * 0.1;
      } else {
        score -= 45;
      }
    }

    // Campsites are safe ground.
    if (CAMPS.has(move.to)) score += 10;

    // Don't wander the Field Marshal out early.
    if (piece.name === FIELD_MARSHAL && !target) score -= 6;

    return score;
  }
}
