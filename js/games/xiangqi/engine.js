/* Caesar Games — Xiangqi family-play V1 rules authority.
 * Canonical coordinates are row,col; row 0 is Black's back rank and row 9 is
 * Red's. Rendering orientation never mutates this state.
 */

export const XQ_RULES_VERSION = 'xiangqi-family-v1.1';
export const XQ_START = 'rheagaehr/9/1c5c1/s1s1s1s1s/9/9/S1S1S1S1S/1C5C1/9/RHEAGAEHR r';

const clone = value => JSON.parse(JSON.stringify(value));
const key = (r, c) => `${r},${c}`;
const inside = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
const palace = (side, r, c) => c >= 3 && c <= 5 &&
  (side === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2);

export function initialXiangqiBoard() {
  const board = {};
  const back = ['r', 'h', 'e', 'a', 'g', 'a', 'e', 'h', 'r'];
  back.forEach((kind, c) => {
    board[key(0, c)] = { side: 'b', kind };
    board[key(9, c)] = { side: 'r', kind };
  });
  [1, 7].forEach(c => {
    board[key(2, c)] = { side: 'b', kind: 'c' };
    board[key(7, c)] = { side: 'r', kind: 'c' };
  });
  [0, 2, 4, 6, 8].forEach(c => {
    board[key(3, c)] = { side: 'b', kind: 's' };
    board[key(6, c)] = { side: 'r', kind: 's' };
  });
  return board;
}

export const XQ_FACES = Object.freeze({
  r: { g: '帥', a: '仕', e: '相', h: '馬', r: '車', c: '炮', s: '兵' },
  b: { g: '將', a: '士', e: '象', h: '馬', r: '車', c: '砲', s: '卒' }
});

function generalSquare(board, side) {
  return Object.keys(board).find(k => board[k]?.side === side && board[k].kind === 'g') || null;
}

function rayMoves(board, from, dirs, cannon = false) {
  const [r0, c0] = from.split(',').map(Number);
  const piece = board[from];
  const out = [];
  for (const [dr, dc] of dirs) {
    let r = r0 + dr, c = c0 + dc, screened = false;
    while (inside(r, c)) {
      const at = key(r, c), target = board[at];
      if (!cannon) {
        if (!target) out.push(at);
        else { if (target.side !== piece.side) out.push(at); break; }
      } else if (!screened) {
        if (!target) out.push(at);
        else screened = true;
      } else if (target) {
        if (target.side !== piece.side) out.push(at);
        break;
      }
      r += dr; c += dc;
    }
  }
  return out;
}

export function pseudoMoves(board, from) {
  const piece = board[from];
  if (!piece) return [];
  const [r, c] = from.split(',').map(Number);
  const own = at => board[at]?.side === piece.side;
  const add = (out, rr, cc, test = true) => {
    const at = key(rr, cc);
    if (test && inside(rr, cc) && !own(at)) out.push(at);
  };
  const out = [];

  if (piece.kind === 'r') return rayMoves(board, from, [[1,0],[-1,0],[0,1],[0,-1]]);
  if (piece.kind === 'c') return rayMoves(board, from, [[1,0],[-1,0],[0,1],[0,-1]], true);

  if (piece.kind === 'g') {
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr, dc]) =>
      add(out, r + dr, c + dc, palace(piece.side, r + dr, c + dc)));
    const enemy = generalSquare(board, piece.side === 'r' ? 'b' : 'r');
    if (enemy) {
      const [er, ec] = enemy.split(',').map(Number);
      if (ec === c) {
        let blocked = false;
        for (let rr = Math.min(r, er) + 1; rr < Math.max(r, er); rr++) {
          if (board[key(rr, c)]) { blocked = true; break; }
        }
        if (!blocked) out.push(enemy);
      }
    }
    return out;
  }

  if (piece.kind === 'a') {
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr, dc]) =>
      add(out, r + dr, c + dc, palace(piece.side, r + dr, c + dc)));
    return out;
  }

  if (piece.kind === 'e') {
    [[2,2],[2,-2],[-2,2],[-2,-2]].forEach(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      const ownHalf = piece.side === 'r' ? rr >= 5 : rr <= 4;
      add(out, rr, cc, ownHalf && !board[key(r + dr / 2, c + dc / 2)]);
    });
    return out;
  }

  if (piece.kind === 'h') {
    const patterns = [
      [-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],
      [-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]
    ];
    patterns.forEach(([dr, dc, lr, lc]) =>
      add(out, r + dr, c + dc, !board[key(r + lr, c + lc)]));
    return out;
  }

  if (piece.kind === 's') {
    const forward = piece.side === 'r' ? -1 : 1;
    add(out, r + forward, c);
    const crossed = piece.side === 'r' ? r <= 4 : r >= 5;
    if (crossed) { add(out, r, c - 1); add(out, r, c + 1); }
  }
  return out;
}

export function isInCheck(board, side) {
  const general = generalSquare(board, side);
  if (!general) return true;
  const enemy = side === 'r' ? 'b' : 'r';
  return Object.keys(board).some(from =>
    board[from]?.side === enemy && pseudoMoves(board, from).includes(general));
}

export function legalMovesFor(board, side) {
  const moves = [];
  for (const from of Object.keys(board)) {
    if (board[from]?.side !== side) continue;
    for (const to of pseudoMoves(board, from)) {
      const next = clone(board);
      next[to] = next[from];
      delete next[from];
      if (!isInCheck(next, side)) moves.push({ from, to, capture: !!board[to] });
    }
  }
  return moves;
}

function terminalForTurn(board, side) {
  if (legalMovesFor(board, side).length) return null;
  return {
    winner: side === 'r' ? 'b' : 'r',
    result: isInCheck(board, side) ? 'checkmate' : 'stalemate'
  };
}

function positionKey(board, turn) {
  return `${turn}|${Object.keys(board).sort().map(k => {
    const p = board[k]; return `${k}:${p.side}${p.kind}`;
  }).join('|')}`;
}

export class XiangqiGame {
  constructor(data = {}) {
    this.board = clone(data.board || initialXiangqiBoard());
    this.turn = data.turn || 'r';
    this.history = clone(data.history || []);
    this.status = data.status || 'in_progress';
    this.winner = data.winner || null;
    this.result = data.result || null;
    this.positions = clone(data.positions || {});
    const opening = positionKey(this.board, this.turn);
    if (!Object.keys(this.positions).length) this.positions[opening] = 1;
    // Old saves may contain an in-progress position whose side to move already
    // has no legal reply. Normalize it on load so Continue can never restore a
    // dead, non-terminal board.
    if (this.status === 'in_progress') {
      const terminal = terminalForTurn(this.board, this.turn);
      if (terminal) {
        this.status = 'finished';
        this.winner = terminal.winner;
        this.result = terminal.result;
      }
    }
  }

  legalMoves(side = this.turn) {
    return this.status === 'in_progress' ? legalMovesFor(this.board, side) : [];
  }
  legalTargets(from) { return this.legalMoves().filter(m => m.from === from).map(m => m.to); }
  inCheck(side = this.turn) { return isInCheck(this.board, side); }

  move(from, to) {
    if (this.status !== 'in_progress') return { ok: false, reason: 'gameOver' };
    const legal = this.legalMoves().find(m => m.from === from && m.to === to);
    if (!legal) return { ok: false, reason: 'illegal' };
    const moving = this.board[from];
    const captured = this.board[to] || null;
    this.board[to] = moving;
    delete this.board[from];
    const actingSide = this.turn;
    this.turn = actingSide === 'r' ? 'b' : 'r';
    const givesCheck = isInCheck(this.board, this.turn);
    const entry = {
      n: this.history.length + 1, from, to, side: actingSide,
      piece: moving.kind, captured: captured?.kind || null, check: givesCheck
    };
    this.history.push(entry);

    if (captured?.kind === 'g') {
      this.status = 'finished'; this.winner = actingSide; this.result = 'general';
    } else {
      const terminal = terminalForTurn(this.board, this.turn);
      if (terminal) {
        this.status = 'finished';
        this.winner = terminal.winner;
        this.result = terminal.result;
      } else {
        const pk = positionKey(this.board, this.turn);
        this.positions[pk] = (this.positions[pk] || 0) + 1;
        if (this.positions[pk] >= 3) {
          this.status = 'finished'; this.winner = null; this.result = 'repetition';
        }
      }
    }
    return { ok: true, ...entry, capture: !!captured, status: this.status, result: this.result };
  }

  resign(side = this.turn) {
    if (this.status !== 'in_progress' || !['r', 'b'].includes(side)) return { ok: false };
    const winner = side === 'r' ? 'b' : 'r';
    const entry = {
      n: this.history.length + 1,
      side,
      piece: null,
      from: null,
      to: null,
      resign: true,
      capture: false,
      check: false
    };
    this.history.push(entry);
    this.status = 'finished';
    this.winner = winner;
    this.result = 'resignation';
    return { ok: true, ...entry, status: this.status, winner, result: this.result };
  }

  serialize() {
    return {
      board: clone(this.board), turn: this.turn, history: clone(this.history),
      status: this.status, winner: this.winner, result: this.result,
      positions: clone(this.positions)
    };
  }

  clone() { return new XiangqiGame(this.serialize()); }
}
