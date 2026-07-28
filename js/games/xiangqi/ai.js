import { XiangqiGame, pseudoMoves, isInCheck } from './engine.js';

const VALUES = { g: 100000, r: 900, c: 450, h: 420, e: 210, a: 210, s: 100 };
const STANDARD_BUDGET_MS = 1100;
const TIMEOUT = Symbol('timeout');

const now = () => globalThis.performance?.now?.() ?? Date.now();
const other = side => side === 'r' ? 'b' : 'r';

function attackMap(game, side) {
  const attacked = new Set();
  for (const [from, piece] of Object.entries(game.board)) {
    if (piece.side !== side) continue;
    for (const to of pseudoMoves(game.board, from)) attacked.add(to);
  }
  return attacked;
}

function score(game, side) {
  if (game.status === 'finished') {
    if (!game.winner) return 0;
    return game.winner === side ? 1000000 : -1000000;
  }

  const enemy = other(side);
  const friendlyAttacks = attackMap(game, side);
  const enemyAttacks = attackMap(game, enemy);
  let total = 0;
  for (const [at, piece] of Object.entries(game.board)) {
    const [r, c] = at.split(',').map(Number);
    const sign = piece.side === side ? 1 : -1;
    const advance = piece.side === 'r' ? 9 - r : r;
    const center = 4 - Math.abs(4 - c);
    let positional = center * (piece.kind === 'h' ? 8 : piece.kind === 'c' ? 4 : 2);
    if (piece.kind === 's') positional += advance * 12 + (advance >= 5 ? center * 4 : 0);
    if (piece.kind === 'r') positional += center * 3;
    if (piece.kind === 'g') positional += Math.max(0, 2 - advance) * 18;
    total += sign * (VALUES[piece.kind] + positional);

    // A hanging piece is a concrete tactical liability. Deeper search decides
    // whether a nominal defender can actually recapture.
    const attacked = piece.side === side ? enemyAttacks.has(at) : friendlyAttacks.has(at);
    const defended = piece.side === side ? friendlyAttacks.has(at) : enemyAttacks.has(at);
    if (attacked) total -= sign * VALUES[piece.kind] * (defended ? 0.08 : 0.20);
  }
  if (game.inCheck(enemy)) total += 70;
  if (game.inCheck(side)) total -= 90;
  return total;
}

function movePriority(game, move) {
  const moving = game.board[move.from];
  const target = game.board[move.to];
  let priority = target ? 10000 + VALUES[target.kind] * 10 - VALUES[moving.kind] : 0;
  if (target?.kind === 'g') priority += 1000000;
  else {
    // Ordering must stay cheap: apply only the board delta and ask the pure
    // check detector, rather than invoking move() and generating every reply.
    const board = { ...game.board, [move.to]: moving };
    delete board[move.from];
    if (isInCheck(board, other(moving.side))) priority += 900;
  }
  const [r, c] = move.to.split(',').map(Number);
  priority += 4 - Math.abs(4 - c);
  if (moving.kind === 's') priority += moving.side === 'r' ? 9 - r : r;
  return priority;
}

function ordered(game, limit = Infinity, preferred = null) {
  const moves = game.legalMoves().map(move => ({ move, priority: movePriority(game, move) }));
  moves.sort((a, b) => {
    if (preferred) {
      const ap = a.move.from === preferred.from && a.move.to === preferred.to;
      const bp = b.move.from === preferred.from && b.move.to === preferred.to;
      if (ap !== bp) return ap ? -1 : 1;
    }
    return b.priority - a.priority;
  });
  return moves.slice(0, limit).map(entry => entry.move);
}

function search(game, depth, alpha, beta, side, deadline, stats) {
  stats.nodes++;
  if ((stats.nodes & 15) === 0 && now() >= deadline) throw TIMEOUT;
  if (!depth || game.status !== 'in_progress') return score(game, side);

  const maximize = game.turn === side;
  let best = maximize ? -Infinity : Infinity;
  const width = depth >= 3 ? 10 : depth === 2 ? 8 : 7;
  for (const move of ordered(game, width)) {
    const next = game.clone();
    next.move(move.from, move.to);
    const value = search(next, depth - 1, alpha, beta, side, deadline, stats);
    if (maximize) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function rootSearch(game, depth, deadline, preferred, stats) {
  const side = game.turn;
  let bestMove = null;
  let bestValue = -Infinity;
  let alpha = -Infinity;
  for (const move of ordered(game, depth >= 3 ? 14 : 18, preferred)) {
    if (now() >= deadline) throw TIMEOUT;
    const next = game.clone();
    next.move(move.from, move.to);
    const value = search(next, depth - 1, alpha, Infinity, side, deadline, stats);
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, bestValue);
  }
  return { move: bestMove, value: bestValue };
}

export function chooseXiangqiMove(serialized, difficulty = 'standard', diagnostics = null) {
  const game = new XiangqiGame(serialized);
  const legal = game.legalMoves();
  if (!legal.length) return null;

  if (difficulty === 'relaxed') {
    const ranked = legal.map(move => {
      const next = game.clone();
      next.move(move.from, move.to);
      return { move, value: score(next, game.turn) };
    }).sort((a, b) => b.value - a.value);
    const pool = ranked.slice(0, Math.min(6, ranked.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  const started = now();
  const deadline = started + STANDARD_BUDGET_MS;
  const stats = { nodes: 0, depth: 0, elapsedMs: 0 };
  let best = { move: legal[0], value: -Infinity };
  for (const depth of [2, 3, 4]) {
    try {
      const completed = rootSearch(game, depth, deadline, best.move, stats);
      if (completed.move) best = completed;
      stats.depth = depth;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  stats.elapsedMs = now() - started;
  if (diagnostics) Object.assign(diagnostics, stats);
  return best.move;
}
