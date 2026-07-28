import { ChessGame } from './adapter.js';

const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };

function evaluate(game, side) {
  if (game.status === 'finished') {
    if (!game.winner) return 0;
    return game.winner === side ? 100000 : -100000;
  }
  let value = 0;
  for (const [square, p] of Object.entries(game.board)) {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const center = 7 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
    const activity = ['n', 'b', 'q'].includes(p.kind) ? center * 2 : 0;
    value += (p.side === side ? 1 : -1) * (VALUES[p.kind] + activity);
  }
  if (game.inCheck()) value += game.turn === side ? -28 : 28;
  return value;
}

function ordered(game) {
  return game.legalMoves().sort((a, b) =>
    Number(b.capture) - Number(a.capture) || Number(b.san?.includes('+')) - Number(a.san?.includes('+')));
}

function search(game, depth, alpha, beta, side) {
  if (!depth || game.status === 'finished') return evaluate(game, side);
  const maximize = game.turn === side;
  let best = maximize ? -Infinity : Infinity;
  for (const move of ordered(game)) {
    const next = game.clone();
    next.move(move.from, move.to, move.promotion);
    const value = search(next, depth - 1, alpha, beta, side);
    if (maximize) { best = Math.max(best, value); alpha = Math.max(alpha, value); }
    else { best = Math.min(best, value); beta = Math.min(beta, value); }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseChessMove(serialized, difficulty = 'standard') {
  const game = new ChessGame(serialized);
  const moves = ordered(game);
  if (!moves.length) return null;
  const depth = difficulty === 'relaxed' ? 1 : 2;
  const ranked = moves.map(move => {
    const next = game.clone();
    next.move(move.from, move.to, move.promotion);
    return { move, value: search(next, depth - 1, -Infinity, Infinity, game.turn) };
  }).sort((a, b) => b.value - a.value);
  if (difficulty === 'relaxed') {
    const pool = ranked.slice(0, Math.min(6, ranked.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }
  return ranked[0].move;
}
