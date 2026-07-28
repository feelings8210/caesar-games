import { XiangqiGame } from './engine.js';

const VALUES = { g: 100000, r: 900, c: 450, h: 420, e: 210, a: 210, s: 100 };

function score(game, side) {
  if (game.status === 'finished') {
    if (!game.winner) return 0;
    return game.winner === side ? 1000000 : -1000000;
  }
  let total = 0;
  for (const [at, p] of Object.entries(game.board)) {
    const [r, c] = at.split(',').map(Number);
    const advance = p.side === 'r' ? 9 - r : r;
    const center = 4 - Math.abs(4 - c);
    const positional = (p.kind === 's' ? advance * 7 : center * 2);
    total += (p.side === side ? 1 : -1) * (VALUES[p.kind] + positional);
  }
  const other = side === 'r' ? 'b' : 'r';
  if (game.inCheck(other)) total += 35;
  if (game.inCheck(side)) total -= 35;
  return total;
}

function ordered(game) {
  return game.legalMoves().sort((a, b) => Number(b.capture) - Number(a.capture));
}

function search(game, depth, alpha, beta, maximizingSide) {
  if (!depth || game.status !== 'in_progress') return score(game, maximizingSide);
  const maximize = game.turn === maximizingSide;
  let best = maximize ? -Infinity : Infinity;
  for (const move of ordered(game)) {
    const next = game.clone();
    next.move(move.from, move.to);
    const value = search(next, depth - 1, alpha, beta, maximizingSide);
    if (maximize) { best = Math.max(best, value); alpha = Math.max(alpha, best); }
    else { best = Math.min(best, value); beta = Math.min(beta, best); }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseXiangqiMove(serialized, difficulty = 'standard') {
  const game = new XiangqiGame(serialized);
  const moves = ordered(game);
  if (!moves.length) return null;
  const ranked = moves.map(move => {
    const next = game.clone();
    next.move(move.from, move.to);
    return { move, next, value: score(next, game.turn) };
  }).sort((a, b) => b.value - a.value);
  if (difficulty === 'relaxed') {
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }
  // Standard looks through a selective second ply. Restricting the beam keeps
  // an iPad responsive while still making the level genuinely deeper than
  // Relaxed's one-ply, randomized choice.
  const beam = ranked.slice(0, Math.min(10, ranked.length));
  for (const candidate of beam) {
    const replies = ordered(candidate.next).slice(0, 10);
    if (!replies.length) { candidate.value = score(candidate.next, game.turn); continue; }
    let worst = Infinity;
    for (const reply of replies) {
      const after = candidate.next.clone();
      after.move(reply.from, reply.to);
      worst = Math.min(worst, score(after, game.turn));
    }
    candidate.value = worst;
  }
  beam.sort((a, b) => b.value - a.value);
  return beam[0].move;
}
