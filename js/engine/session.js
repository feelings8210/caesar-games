/* Caesar Games — Game Session
 *
 * A GameSession owns the canonical state of exactly one game. It knows nothing
 * about the DOM. Every session carries an identity and a `disposed` flag so
 * that asynchronous work started by one session (AI thinking, animations)
 * can never write into a session the player has since left.
 */

import {
  CAMPS, HEADQUARTERS, FLAG, FIELD_MARSHAL,
  createStandardArmy, generateLegalSetup, canPieceMove, resolveCombat,
  legalMovesFor, findFlag, validateFormation, validateSwapInSetup,
  parseKey, key, COMBAT, ROWS, COLS, RULES_VERSION
} from './rules.js';
import { t } from '../i18n/strings.js';

export const MODES = { VS_AI: 'vs_computer', CLASSIC: 'classic', FLIP: 'flip' };

export const PHASES = {
  SETUP: 'setup',       // Classic / Vs-AI pre-game arrangement
  PLAY: 'play',
  FINISHED: 'finished'
};

export const SCHEMA_VERSION = 4;

let sessionCounter = 0;
function newGameId() {
  sessionCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `g${Date.now().toString(36)}${sessionCounter.toString(36)}${rand}`;
}

export class GameSession {
  constructor(mode, options = {}) {
    this.schemaVersion = SCHEMA_VERSION;
    this.rulesVersion = RULES_VERSION;

    this.gameId = options.gameId || newGameId();
    this.mode = mode;
    this.disposed = false;

    this.player1Name = options.player1Name || 'Player 1';
    this.player2Name = options.player2Name || (mode === MODES.VS_AI ? 'Computer' : 'Player 2');
    this.aiDifficulty = options.aiDifficulty || 'standard';

    this.startedAt = options.startedAt || Date.now();
    this.updatedAt = this.startedAt;
    this.completedAt = null;

    this.activeTurn = 'navy';          // navy = Player 1, red = Player 2 / Computer
    this.boardState = {};
    this.capturedPieces = [];
    this.history = [];                 // privacy-safe public record
    this.flagDisclosed = { navy: false, red: false };
    this.isGameOver = false;
    this.winner = null;
    this.winReason = null;

    // Flip mode only: which canonical army each seat controls.
    this.assignedColors = { p1: null, p2: null };

    // Setup phase bookkeeping
    this.setupSide = 'navy';
    this.setupBaseline = null;

    // Transient (never persisted)
    this.selected = null;
    this.pendingHandoff = null;

    if (mode === MODES.FLIP) {
      this.phase = PHASES.PLAY;
      this.setupSide = null;
      this.assignedColors = { p1: null, p2: null };
      this._dealFlipBoard();
    } else {
      this.phase = PHASES.SETUP;
      this._dealSetupBoards();
    }
  }

  dispose() { this.disposed = true; }

  /* ---------------------------------------------------------------- *
   * Seats & naming
   * ---------------------------------------------------------------- */

  /** Which canonical army the given seat commands. */
  sideForSeat(seat) {
    if (this.mode === MODES.FLIP) {
      return seat === 1 ? this.assignedColors.p1 : this.assignedColors.p2;
    }
    return seat === 1 ? 'navy' : 'red';
  }

  seatForSide(side) {
    if (this.mode === MODES.FLIP) {
      if (this.assignedColors.p1 === side) return 1;
      if (this.assignedColors.p2 === side) return 2;
      return null;
    }
    return side === 'navy' ? 1 : 2;
  }

  nameForSide(side) {
    if (this.mode === MODES.FLIP) {
      const seat = this.seatForSide(side);
      if (seat === 1) return this.player1Name;
      if (seat === 2) return this.player2Name;
      return side === 'navy' ? this.player1Name : this.player2Name;
    }
    return side === 'navy' ? this.player1Name : this.player2Name;
  }

  /** In Flip the seat drives the turn; both seats share one static board. */
  get activeSeat() {
    if (this.mode !== MODES.FLIP) return this.activeTurn === 'navy' ? 1 : 2;
    return this.flipSeatTurn;
  }

  get isAiTurn() {
    return this.mode === MODES.VS_AI && this.phase === PHASES.PLAY && this.activeTurn === 'red' && !this.isGameOver;
  }

  get humanSide() { return this.mode === MODES.VS_AI ? 'navy' : null; }

  /* ---------------------------------------------------------------- *
   * Board construction
   * ---------------------------------------------------------------- */

  _dealSetupBoards() {
    this.boardState = { ...generateLegalSetup('navy'), ...generateLegalSetup('red') };
    this.setupSide = 'navy';
    this.setupBaseline = this._cloneSideFormation('navy');
  }

  _dealFlipBoard() {
    const pool = [...createStandardArmy('navy'), ...createStandardArmy('red')];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const slots = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      if (!CAMPS.has(k)) slots.push(k);
    }
    this.boardState = {};
    slots.forEach((k, i) => { this.boardState[k] = { ...pool[i], revealed: false }; });
    this.flipSeatTurn = 1;
    this.activeTurn = 'navy';
  }

  _cloneSideFormation(side) {
    const out = {};
    for (const [k, p] of Object.entries(this.boardState)) {
      if (p && p.side === side) out[k] = JSON.parse(JSON.stringify(p));
    }
    return out;
  }

  _replaceSideFormation(side, formation) {
    for (const k of Object.keys(this.boardState)) {
      if (this.boardState[k]?.side === side) delete this.boardState[k];
    }
    for (const [k, p] of Object.entries(formation)) {
      this.boardState[k] = JSON.parse(JSON.stringify(p));
    }
  }

  /* ---------------------------------------------------------------- *
   * Setup phase
   * ---------------------------------------------------------------- */

  quickSetup() {
    this._replaceSideFormation(this.setupSide, generateLegalSetup(this.setupSide));
    this.selected = null;
    this.touch();
  }

  resetSetup() {
    if (this.setupBaseline) this._replaceSideFormation(this.setupSide, this.setupBaseline);
    this.selected = null;
    this.touch();
  }

  /** Tap-to-swap. Returns { ok, reason, swapped:[a,b] }. */
  setupTap(k) {
    const piece = this.boardState[k];
    const side = this.setupSide;

    if (!this.selected) {
      if (!piece || piece.side !== side) {
        return { ok: false, reason: t('setup.pickOwn') };
      }
      this.selected = k;
      return { ok: true, selected: k };
    }

    if (this.selected === k) {
      this.selected = null;
      return { ok: true, deselected: true };
    }

    const from = this.selected;
    const a = this.boardState[from];
    const b = this.boardState[k] || null;

    if (b && b.side !== side) {
      return { ok: false, reason: t('setup.ownOnly') };
    }
    const check = validateSwapInSetup(a, from, b, k);
    if (!check.valid) return { ok: false, reason: check.reason };

    if (b) { this.boardState[from] = b; this.boardState[k] = a; }
    else { this.boardState[k] = a; delete this.boardState[from]; }

    this.selected = null;
    this.touch();
    return { ok: true, swapped: [from, k] };
  }

  /** Validate the current side's formation before locking it in. */
  validateCurrentFormation() {
    return validateFormation(this.boardState, this.setupSide);
  }

  /**
   * Lock the current side's formation.
   * Returns the next lifecycle intent so the controller can drive the UI.
   */
  lockSetup() {
    const check = this.validateCurrentFormation();
    if (!check.valid) return { ok: false, problems: check.problems };

    if (this.mode === MODES.VS_AI) {
      this._replaceSideFormation('red', generateLegalSetup('red'));
      this.phase = PHASES.PLAY;
      this.activeTurn = 'navy';
      this.selected = null;
      this.touch();
      return { ok: true, next: 'play' };
    }

    if (this.setupSide === 'navy') {
      this.setupSide = 'red';
      this.setupBaseline = this._cloneSideFormation('red');
      this.selected = null;
      this.touch();
      return { ok: true, next: 'handoff_to_setup', nextSide: 'red' };
    }

    this.phase = PHASES.PLAY;
    this.activeTurn = 'navy';
    this.selected = null;
    this.setupBaseline = null;
    this.touch();
    return { ok: true, next: 'handoff_to_play', nextSide: 'navy' };
  }

  /* ---------------------------------------------------------------- *
   * Play
   * ---------------------------------------------------------------- */

  /** The army the tapping player is allowed to command right now. */
  controllingSide() {
    if (this.mode === MODES.FLIP) {
      const seat = this.flipSeatTurn;
      return seat === 1 ? this.assignedColors.p1 : this.assignedColors.p2;
    }
    return this.activeTurn;
  }

  canMove(from, to) {
    return canPieceMove(this.boardState[from], from, to, this.boardState);
  }

  legalTargetsFrom(from) {
    const piece = this.boardState[from];
    if (!piece) return [];
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = key(r, c);
      if (k !== from && canPieceMove(piece, from, k, this.boardState).allowed) out.push(k);
    }
    return out;
  }

  /**
   * Apply a move to canonical state. Returns a MoveResult describing exactly
   * what happened, which the view layer animates. No DOM, no timers.
   */
  applyMove(from, to) {
    const attacker = this.boardState[from];
    const defender = this.boardState[to] || null;
    const actingSide = attacker.side;
    const actingName = this.nameForSide(actingSide);

    const result = {
      moveNumber: this.history.length + 1,
      from, to,
      actingSide,
      actingName,
      combat: false,
      outcome: null,
      removedFrom: [],       // canonical keys emptied by this move
      survivorAt: null,
      revealedKeys: [],
      summaryText: ''
    };

    if (!defender) {
      this.boardState[to] = attacker;
      delete this.boardState[from];
      result.survivorAt = to;
      result.summaryText = t('move.moved', { name: actingName, from, to });
    } else {
      const combat = resolveCombat(attacker, defender);
      result.combat = true;
      result.outcome = combat.result;

      if (combat.result === COMBAT.ATTACKER_WINS) {
        this.capturedPieces.push(defender);
        this.boardState[to] = attacker;
        delete this.boardState[from];
        result.removedFrom = [to];
        result.survivorAt = to;
        result.summaryText = t('move.took', { name: actingName, to });
      } else if (combat.result === COMBAT.DEFENDER_WINS) {
        this.capturedPieces.push(attacker);
        delete this.boardState[from];
        result.removedFrom = [from];
        result.survivorAt = to;
        result.summaryText = t('move.held', { name: actingName, to });
      } else {
        this.capturedPieces.push(attacker, defender);
        delete this.boardState[from];
        delete this.boardState[to];
        result.removedFrom = [from, to];
        result.summaryText = t('move.bothLost', { to });
      }

      // Flip mode: a piece that fights is face-up from then on.
      if (this.mode === MODES.FLIP) {
        if (this.boardState[to]) { this.boardState[to].revealed = true; result.revealedKeys.push(to); }
      }

      for (const side of combat.marshalLost) {
        this.flagDisclosed[side] = true;
        result.marshalLost = combat.marshalLost;
      }

      if (combat.gameOver) {
        this._finish(actingSide, 'flag');
        result.summaryText = t('move.flag', { name: actingName });
      }
    }

    this.history.push({
      n: result.moveNumber,
      side: actingSide,
      name: actingName,
      from, to,
      combat: result.combat,
      outcome: result.outcome,
      text: result.summaryText,
      at: Date.now()
    });

    this.lastMove = {
      from, to,
      actingSide,
      combat: result.combat,
      outcome: result.outcome,
      removedFrom: result.removedFrom,
      survivorAt: result.survivorAt,
      summaryText: result.summaryText
    };

    this.selected = null;
    this.touch();
    return result;
  }

  /** Flip mode: turn a face-down piece face-up. */
  revealPiece(k) {
    const piece = this.boardState[k];
    if (!piece || piece.revealed) return null;
    piece.revealed = true;

    if (!this.assignedColors.p1) {
      this.assignedColors.p1 = piece.side;
      this.assignedColors.p2 = piece.side === 'navy' ? 'red' : 'navy';
    }

    const seat = this.flipSeatTurn;
    const name = seat === 1 ? this.player1Name : this.player2Name;

    const result = {
      moveNumber: this.history.length + 1,
      from: k, to: k,
      type: 'reveal',
      actingSide: this.controllingSide(),
      actingName: name,
      revealedKeys: [k],
      summaryText: t('move.revealed', { name, at: k })
    };

    this.history.push({
      n: result.moveNumber,
      side: result.actingSide,
      name,
      from: k, to: k,
      reveal: true,
      text: result.summaryText,
      at: Date.now()
    });

    this.lastMove = { from: k, to: k, reveal: true, actingSide: result.actingSide, summaryText: result.summaryText };
    this.selected = null;
    this.touch();
    return result;
  }

  /** Advance the turn and evaluate end-of-game conditions. */
  endTurn() {
    if (this.isGameOver) return { gameOver: true };

    if (this.mode === MODES.FLIP) {
      this.flipSeatTurn = this.flipSeatTurn === 1 ? 2 : 1;
      const side = this.controllingSide();
      this.activeTurn = side || this.activeTurn;
    } else {
      this.activeTurn = this.activeTurn === 'navy' ? 'red' : 'navy';
    }

    const next = this.controllingSide();
    if (next && !this._sideStillHasFlag(next)) {
      this._finish(next === 'navy' ? 'red' : 'navy', 'flag');
      return { gameOver: true };
    }
    if (next && legalMovesFor(next, this.boardState).length === 0) {
      this._finish(next === 'navy' ? 'red' : 'navy', 'immobile');
      return { gameOver: true };
    }

    this.touch();
    return { gameOver: false, activeTurn: this.activeTurn };
  }

  _sideStillHasFlag(side) {
    return !!findFlag(side, this.boardState);
  }

  _finish(winnerSide, reason) {
    this.isGameOver = true;
    this.phase = PHASES.FINISHED;
    this.winner = winnerSide;
    this.winReason = reason;
    this.completedAt = Date.now();
    this.selected = null;
  }

  get winnerName() {
    if (!this.winner) return null;
    return this.nameForSide(this.winner);
  }

  touch() { this.updatedAt = Date.now(); }

  /* ---------------------------------------------------------------- *
   * Persistence
   * ---------------------------------------------------------------- */

  toRecord() {
    return {
      schemaVersion: SCHEMA_VERSION,
      rulesVersion: this.rulesVersion,
      gameId: this.gameId,
      gameType: 'junqi',
      mode: this.mode,
      players: [this.player1Name, this.player2Name],
      player1Name: this.player1Name,
      player2Name: this.player2Name,
      aiDifficulty: this.aiDifficulty,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      status: this.isGameOver ? 'finished' : 'in_progress',
      winner: this.winner,
      result: this.winReason,
      winReason: this.winReason,
      moveCount: this.history.length,
      phase: this.phase,
      activeTurn: this.activeTurn,
      flipSeatTurn: this.flipSeatTurn ?? null,
      setupSide: this.setupSide,
      setupBaseline: this.setupBaseline,
      boardState: this.boardState,
      assignedColors: this.assignedColors,
      capturedPieces: this.capturedPieces,
      history: this.history,
      flagDisclosed: this.flagDisclosed,
      lastMove: this.lastMove || null
    };
  }

  static fromRecord(rec) {
    const s = Object.create(GameSession.prototype);
    s.schemaVersion = SCHEMA_VERSION;
    s.rulesVersion = rec.rulesVersion || RULES_VERSION;
    s.gameId = rec.gameId;
    s.mode = rec.mode;
    s.disposed = false;
    s.player1Name = rec.player1Name || 'Player 1';
    s.player2Name = rec.player2Name || (rec.mode === MODES.VS_AI ? 'Computer' : 'Player 2');
    s.aiDifficulty = rec.aiDifficulty || 'standard';
    s.startedAt = rec.startedAt || Date.now();
    s.updatedAt = rec.updatedAt || s.startedAt;
    s.completedAt = rec.completedAt || null;
    s.phase = rec.phase || PHASES.PLAY;
    s.activeTurn = rec.activeTurn || 'navy';
    s.flipSeatTurn = rec.flipSeatTurn ?? 1;
    s.setupSide = rec.setupSide || 'navy';
    s.setupBaseline = rec.setupBaseline || null;
    s.boardState = rec.boardState || {};
    s.assignedColors = rec.assignedColors || { p1: null, p2: null };
    s.capturedPieces = rec.capturedPieces || [];
    s.history = rec.history || [];
    s.flagDisclosed = rec.flagDisclosed || { navy: false, red: false };
    s.isGameOver = rec.status === 'finished';
    s.winner = rec.winner || null;
    s.winReason = rec.winReason || null;
    s.lastMove = rec.lastMove || null;

    // Transient state is deliberately NOT restored.
    s.selected = null;
    s.pendingHandoff = null;
    return s;
  }
}

/* ------------------------------------------------------------------ *
 * Visibility — the single source of truth for concealment
 * ------------------------------------------------------------------ */

/**
 * Is `piece` face-up for the given viewer seat?
 *
 * Classic (暗棋): you see your own army; the opponent stays concealed before
 * AND after combat. The only disclosure is a Flag whose Field Marshal has
 * fallen. Vs Computer follows the same rule with the human always at seat 1.
 * Flip (翻棋): visibility is purely a property of the piece.
 */
export function isPieceVisibleTo(session, k, piece, viewerSeat) {
  if (!piece) return false;

  if (session.mode === MODES.FLIP) return !!piece.revealed;

  // Seat 0 / null is a spectator: record playback and replay. A spectator sees
  // only what was ever public — never a concealed identity.
  if (viewerSeat !== 1 && viewerSeat !== 2) {
    if (piece.revealed) return true;
    return piece.name === FLAG && !!session.flagDisclosed?.[piece.side];
  }

  const viewerSide = viewerSeat === 1 ? 'navy' : 'red';

  if (session.phase === PHASES.SETUP) {
    // During setup only the arranging player's own army is shown.
    return piece.side === session.setupSide;
  }

  if (piece.side === viewerSide) return true;

  // Disclosed enemy Flag (its Field Marshal has been eliminated).
  if (piece.name === FLAG && session.flagDisclosed[piece.side]) return true;

  return false;
}

/** Which seat is looking at the board right now. */
export function viewerSeatOf(session) {
  if (session.mode === MODES.VS_AI) return 1;              // human is always seat 1
  if (session.mode === MODES.FLIP) return session.flipSeatTurn || 1;
  if (session.phase === PHASES.SETUP) return session.setupSide === 'navy' ? 1 : 2;
  return session.activeTurn === 'navy' ? 1 : 2;
}

/**
 * Board orientation for the current viewer.
 * Classic rotates so the current player always sits at the bottom.
 * Vs Computer and Flip keep one stable orientation.
 */
export function boardOrientationOf(session) {
  if (session.mode === MODES.CLASSIC && viewerSeatOf(session) === 2) return 'red_bottom';
  return 'navy_bottom';
}
