import { Chess } from '../../vendor/chessjs/chess.js';

export const CHESS_RULES_VERSION = 'chess.js-1.4.0';

const clone = value => JSON.parse(JSON.stringify(value));
const squareIndex = square => /^[a-h][1-8]$/.test(square || '')
  ? (8 - Number(square[1])) * 16 + square.charCodeAt(0) - 97
  : -1;

export class ChessGame {
  constructor(data = {}) {
    this.chess = new Chess();
    this.history = clone(data.history || []);
    if (data.fen) this.chess.load(data.fen);
    else if (this.history.length) {
      this.chess.reset();
      for (const move of this.history) this.chess.move({
        from: move.from, to: move.to, promotion: move.promotion || 'q'
      });
    }
    this.terminal = data.terminal ||
      (data.status === 'finished' &&
       ['resignation', 'draw_agreement'].includes(data.result) ? 'finished' : null);
    this.terminalWinner = data.winner || null;
    this.terminalResult = data.result || null;
  }

  get turn() { return this.chess.turn(); }
  get status() { return this.terminal || this.chess.isGameOver() ? 'finished' : 'in_progress'; }
  get winner() {
    if (this.terminal) return this.terminalWinner;
    if (!this.chess.isCheckmate()) return null;
    return this.turn === 'w' ? 'b' : 'w';
  }
  get result() {
    if (this.terminal) return this.terminalResult;
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isThreefoldRepetition()) return 'repetition';
    if (this.chess.isInsufficientMaterial()) return 'insufficient';
    if (this.chess.isDrawByFiftyMoves()) return 'fifty_move';
    if (this.chess.isDraw()) return 'draw';
    return null;
  }
  get board() {
    const out = {};
    for (const row of this.chess.board()) {
      for (const p of row) if (p) out[p.square] = { side: p.color, kind: p.type };
    }
    return out;
  }

  legalMoves() {
    if (this.terminal) return [];
    return this.chess.moves({ verbose: true }).map(m => ({
      from: m.from, to: m.to, promotion: m.promotion || null,
      capture: !!m.captured, san: m.san
    }));
  }
  legalTargets(from) { return this.legalMoves().filter(m => m.from === from).map(m => m.to); }
  needsPromotion(from, to) {
    return this.legalMoves().some(m => m.from === from && m.to === to && m.promotion);
  }
  inCheck() { return this.chess.inCheck(); }

  illegalReason(from, to) {
    if (this.legalMoves().some(move => move.from === from && move.to === to)) return null;
    const target = squareIndex(to);
    const pseudoLegal = this.chess._moves({ legal: false, square: from })
      .some(move => move.to === target);
    return pseudoLegal ? 'selfCheck' : 'illegal';
  }

  move(from, to, promotion) {
    if (this.terminal) return { ok: false, reason: 'gameOver' };
    const reason = this.illegalReason(from, to);
    if (reason) return { ok: false, reason };
    let move;
    try {
      move = this.chess.move({ from, to, promotion: promotion || 'q' });
    } catch {
      return { ok: false, reason: 'illegal' };
    }
    if (!move) return { ok: false, reason: 'illegal' };
    const entry = {
      n: this.history.length + 1, from: move.from, to: move.to,
      side: move.color, piece: move.piece, captured: move.captured || null,
      promotion: move.promotion || null, san: move.san, check: this.chess.inCheck()
    };
    this.history.push(entry);
    return {
      ok: true, ...entry, capture: !!move.captured,
      status: this.status, result: this.result
    };
  }

  acceptDraw(offeredBy = this.turn) {
    if (this.status !== 'in_progress' || !['w', 'b'].includes(offeredBy)) return { ok: false };
    const acceptedBy = offeredBy === 'w' ? 'b' : 'w';
    const entry = {
      n: this.history.length + 1,
      side: offeredBy,
      offerBy: offeredBy,
      acceptedBy,
      piece: null,
      from: null,
      to: null,
      drawAgreement: true,
      capture: false,
      check: false
    };
    this.history.push(entry);
    this.terminal = 'finished';
    this.terminalWinner = null;
    this.terminalResult = 'draw_agreement';
    return { ok: true, ...entry, status: 'finished', winner: null, result: 'draw_agreement' };
  }

  resign(side = this.turn) {
    if (this.status !== 'in_progress' || !['w', 'b'].includes(side)) return { ok: false };
    const winner = side === 'w' ? 'b' : 'w';
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
    this.terminal = 'finished';
    this.terminalWinner = winner;
    this.terminalResult = 'resignation';
    return { ok: true, ...entry, status: 'finished', winner, result: 'resignation' };
  }

  serialize() {
    return {
      fen: this.chess.fen(), pgn: this.chess.pgn(), history: clone(this.history),
      status: this.status, winner: this.winner, result: this.result,
      terminal: this.terminal
    };
  }
  clone() { return new ChessGame(this.serialize()); }
}
