import { GomokuGame, GOMOKU_SIZE, gomokuKey, parseGomokuKey } from './engine.js';

const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const inside = (row, col) => row >= 0 && row < GOMOKU_SIZE && col >= 0 && col < GOMOKU_SIZE;
const other = side => side === 'b' ? 'w' : 'b';

function candidateKeys(game) {
  const occupied = Object.keys(game.board);
  if (!occupied.length) return [gomokuKey(7, 7)];
  const candidates = new Set();
  for (const key of occupied) {
    const { row, col } = parseGomokuKey(key);
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr;
      const c = col + dc;
      const next = gomokuKey(r, c);
      if (inside(r, c) && !game.board[next]) candidates.add(next);
    }
  }
  return [...candidates];
}

function ray(game, row, col, dr, dc, side, sign) {
  let length = 0;
  let r = row + dr * sign;
  let c = col + dc * sign;
  while (inside(r, c) && game.board[gomokuKey(r, c)]?.side === side) {
    length++;
    r += dr * sign;
    c += dc * sign;
  }
  return { length, open: inside(r, c) && !game.board[gomokuKey(r, c)] };
}

function lineScore(game, key, side) {
  const { row, col } = parseGomokuKey(key);
  let score = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const a = ray(game, row, col, dr, dc, side, -1);
    const b = ray(game, row, col, dr, dc, side, 1);
    const length = 1 + a.length + b.length;
    const openEnds = Number(a.open) + Number(b.open);
    if (length >= 5) score += 1_000_000;
    else if (length === 4 && openEnds === 2) score += 80_000;
    else if (length === 4 && openEnds === 1) score += 18_000;
    else if (length === 3 && openEnds === 2) score += 6_000;
    else if (length === 3 && openEnds === 1) score += 900;
    else if (length === 2 && openEnds === 2) score += 260;
    else score += length * length * (openEnds + 1) * 8;
  }
  return score;
}

function immediate(game, side, candidates) {
  for (const key of candidates) {
    game.board[key] = { side, kind: 'stone' };
    const wins = game.isWinningStone(key, side);
    delete game.board[key];
    if (wins) return key;
  }
  return null;
}

export function chooseGomokuMove(serialized, difficulty = 'standard', diagnostics = {}) {
  const game = serialized instanceof GomokuGame ? serialized : new GomokuGame(serialized);
  if (game.status !== 'in_progress') return null;
  const candidates = candidateKeys(game);
  const side = game.turn;
  const opponent = other(side);
  diagnostics.candidates = candidates.length;

  const winning = immediate(game, side, candidates);
  if (winning) {
    diagnostics.reason = 'win';
    return { from: null, to: winning };
  }
  const block = immediate(game, opponent, candidates);
  if (block) {
    diagnostics.reason = 'block';
    return { from: null, to: block };
  }

  const ranked = candidates.map(key => {
    const attack = lineScore(game, key, side);
    const defense = lineScore(game, key, opponent);
    const { row, col } = parseGomokuKey(key);
    const center = 30 - (Math.abs(row - 7) + Math.abs(col - 7));
    return { key, score: attack + defense * 1.12 + center };
  }).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  diagnostics.reason = difficulty === 'relaxed' ? 'varied-plan' : 'best-plan';
  diagnostics.bestScore = ranked[0]?.score || 0;
  if (difficulty === 'relaxed') {
    const pool = ranked.slice(0, Math.min(6, ranked.length));
    return { from: null, to: pool[Math.floor(Math.random() * pool.length)]?.key };
  }
  return { from: null, to: ranked[0]?.key };
}
