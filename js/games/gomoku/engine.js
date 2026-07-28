/* Caesar Games — Freestyle Gomoku
 *
 * Family-table variant: 15×15 intersections, Black first, no captures and no
 * forbidden moves. The first player to make an unbroken line of five or more
 * stones horizontally, vertically or diagonally wins.
 */

export const GOMOKU_SIZE = 15;
export const GOMOKU_RULES_VERSION = 'gomoku-freestyle-15-v1';

const clone = value => JSON.parse(JSON.stringify(value));
const other = side => side === 'b' ? 'w' : 'b';

export const gomokuKey = (row, col) => `${row},${col}`;
export function parseGomokuKey(key) {
  const [row, col] = String(key).split(',').map(Number);
  return { row, col };
}

function inside(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) &&
    row >= 0 && row < GOMOKU_SIZE && col >= 0 && col < GOMOKU_SIZE;
}

export class GomokuGame {
  constructor(data = {}) {
    this.board = clone(data.board || {});
    this.turn = data.turn === 'w' ? 'w' : 'b';
    this.history = clone(data.history || []);
    this.status = data.status === 'finished' ? 'finished' : 'in_progress';
    this.winner = data.winner === 'b' || data.winner === 'w' ? data.winner : null;
    this.result = data.result || null;
  }

  inCheck() { return false; }

  legalMoves() {
    if (this.status !== 'in_progress') return [];
    const moves = [];
    for (let row = 0; row < GOMOKU_SIZE; row++) {
      for (let col = 0; col < GOMOKU_SIZE; col++) {
        const to = gomokuKey(row, col);
        if (!this.board[to]) moves.push({ from: null, to });
      }
    }
    return moves;
  }

  legalTargets() { return []; }

  lineLength(row, col, dr, dc, side) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (inside(r, c) && this.board[gomokuKey(r, c)]?.side === side) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    return count;
  }

  isWinningStone(key, side = this.board[key]?.side) {
    if (!side) return false;
    const { row, col } = parseGomokuKey(key);
    return [[1, 0], [0, 1], [1, 1], [1, -1]]
      .some(([dr, dc]) => this.lineLength(row, col, dr, dc, side) >= 5);
  }

  move(_from, to) {
    const { row, col } = parseGomokuKey(to);
    if (this.status !== 'in_progress' || !inside(row, col) || this.board[to]) {
      return { ok: false };
    }

    const side = this.turn;
    this.board[to] = { side, kind: 'stone' };
    const move = {
      n: this.history.length + 1,
      side,
      piece: 'stone',
      from: null,
      to,
      capture: false
    };
    this.history.push(move);

    if (this.isWinningStone(to, side)) {
      this.status = 'finished';
      this.winner = side;
      this.result = 'five';
    } else if (Object.keys(this.board).length === GOMOKU_SIZE * GOMOKU_SIZE) {
      this.status = 'finished';
      this.winner = null;
      this.result = 'draw';
    } else {
      this.turn = other(side);
    }

    return {
      ok: true,
      move,
      capture: false,
      check: false,
      promotion: null,
      winner: this.winner,
      result: this.result
    };
  }

  serialize() {
    return {
      board: clone(this.board),
      turn: this.turn,
      history: clone(this.history),
      status: this.status,
      winner: this.winner,
      result: this.result
    };
  }
}
