import { ChessGame } from './adapter.js';

const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const STANDARD_BUDGET_MS = 1150;
const TIMEOUT = Symbol('timeout');

const now = () => globalThis.performance?.now?.() ?? Date.now();
const other = side => side === 'w' ? 'b' : 'w';

function positional(piece, square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const center = 7 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
  const advance = piece.side === 'w' ? rank : 7 - rank;
  if (piece.kind === 'p') return advance * 7 + center;
  if (piece.kind === 'n') return center * 7;
  if (piece.kind === 'b') return center * 4;
  if (piece.kind === 'r') return advance * 2;
  if (piece.kind === 'q') return center * 2;
  return 0;
}

function evaluate(game, side) {
  if (game.status === 'finished') {
    if (!game.winner) return 0;
    return game.winner === side ? 100000 : -100000;
  }

  let value = 0;
  const bishops = { w: 0, b: 0 };
  for (const [square, piece] of Object.entries(game.board)) {
    const sign = piece.side === side ? 1 : -1;
    value += sign * (VALUES[piece.kind] + positional(piece, square));
    if (piece.kind === 'b') bishops[piece.side]++;
    if (piece.kind === 'k') {
      const castled = ['g1', 'c1', 'g8', 'c8'].includes(square);
      value += sign * (castled ? 34 : 0);
    }
  }
  if (bishops[side] >= 2) value += 24;
  if (bishops[other(side)] >= 2) value -= 24;
  if (game.inCheck()) value += game.turn === side ? -42 : 42;
  return value;
}

function movePriority(game, move) {
  const board = game.board;
  const victim = board[move.to]?.kind;
  const attacker = board[move.from]?.kind;
  let priority = victim ? 10000 + (VALUES[victim] * 10) - VALUES[attacker] : 0;
  if (move.promotion) priority += VALUES[move.promotion] || 800;
  if (move.san?.includes('#')) priority += 100000;
  else if (move.san?.includes('+')) priority += 900;
  if (move.san?.startsWith('O-O')) priority += 140;
  return priority;
}

function ordered(game, preferred = null) {
  return game.legalMoves().sort((a, b) => {
    if (preferred) {
      const ap = a.from === preferred.from && a.to === preferred.to && a.promotion === preferred.promotion;
      const bp = b.from === preferred.from && b.to === preferred.to && b.promotion === preferred.promotion;
      if (ap !== bp) return ap ? -1 : 1;
    }
    return movePriority(game, b) - movePriority(game, a);
  });
}

function search(game, depth, alpha, beta, side, deadline, table, stats) {
  stats.nodes++;
  if ((stats.nodes & 31) === 0 && now() >= deadline) throw TIMEOUT;
  if (!depth || game.status === 'finished') return evaluate(game, side);

  const cacheKey = `${game.serialize().fen}|${depth}`;
  const cached = table.get(cacheKey);
  if (cached !== undefined) return cached;

  const maximize = game.turn === side;
  let best = maximize ? -Infinity : Infinity;
  let cutoff = false;
  for (const move of ordered(game)) {
    const next = game.clone();
    next.move(move.from, move.to, move.promotion);
    const value = search(next, depth - 1, alpha, beta, side, deadline, table, stats);
    if (maximize) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) {
      cutoff = true;
      break;
    }
  }
  // A cut node is only a bound, not an exact value.
  if (!cutoff) table.set(cacheKey, best);
  return best;
}

function rootSearch(game, depth, deadline, preferred, stats) {
  const side = game.turn;
  const table = new Map();
  let bestMove = null;
  let bestValue = -Infinity;
  let alpha = -Infinity;
  for (const move of ordered(game, preferred)) {
    if (now() >= deadline) throw TIMEOUT;
    const next = game.clone();
    next.move(move.from, move.to, move.promotion);
    const value = search(next, depth - 1, alpha, Infinity, side, deadline, table, stats);
    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
    alpha = Math.max(alpha, bestValue);
  }
  return { move: bestMove, value: bestValue };
}

export function chooseChessMove(serialized, difficulty = 'standard', diagnostics = null) {
  const game = new ChessGame(serialized);
  const moves = ordered(game);
  if (!moves.length) return null;

  if (difficulty === 'relaxed') {
    const ranked = moves.map(move => {
      const next = game.clone();
      next.move(move.from, move.to, move.promotion);
      return { move, value: evaluate(next, game.turn) };
    }).sort((a, b) => b.value - a.value);
    // Intentionally forgiving: a child can see varied, plausible replies.
    const pool = ranked.slice(0, Math.min(7, ranked.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  const started = now();
  const deadline = started + STANDARD_BUDGET_MS;
  const stats = { nodes: 0, depth: 0, elapsedMs: 0 };
  let best = { move: moves[0], value: -Infinity };
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
