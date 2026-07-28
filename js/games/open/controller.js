import { XiangqiGame } from '../xiangqi/engine.js';
import { chooseXiangqiMove } from '../xiangqi/ai.js';
import { ChessGame } from '../chess/adapter.js';
import { chooseChessMove } from '../chess/ai.js';
import { OpenBoardView } from './board_view.js';
import { sounds } from '../../engine/sound.js';
import { t } from '../../i18n/strings.js';

const clone = value => JSON.parse(JSON.stringify(value));
const makeId = type => `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const other = side => side === 'r' ? 'b' : side === 'w' ? 'b' : side === 'b' ? 'w' : 'r';

export class OpenGameController {
  constructor(host, mount) {
    this.host = host;
    this.view = new OpenBoardView(mount, key => this.onTap(key));
    this.session = null;
    this.selected = null;
    this.aiToken = 0;
    this.aiTimer = null;
    this.aiWorker = null;
    this.busy = false;
  }

  create(gameType, options = {}) {
    this.dispose();
    const first = gameType === 'xiangqi' ? 'r' : 'w';
    const humanSide = options.humanSide || first;
    this.session = {
      gameId: makeId(gameType),
      gameType,
      mode: options.mode || 'two_player',
      player1Name: options.player1Name || t('players.p1'),
      player2Name: options.player2Name || (options.mode === 'vs_computer' ? t('players.computer') : t('players.p2')),
      aiDifficulty: options.aiDifficulty || 'standard',
      humanSide,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      engine: gameType === 'xiangqi' ? new XiangqiGame() : new ChessGame(),
      opening: null
    };
    this.session.opening = this.session.engine.serialize();
    this.persist();
    this.render();
    if (this.isAiTurn()) this.scheduleAi();
    return this.session;
  }

  resume(record) {
    this.dispose();
    const state = record.serializedState || {};
    this.session = {
      gameId: record.gameId, gameType: record.gameType,
      mode: record.mode, player1Name: record.player1Name,
      player2Name: record.player2Name, aiDifficulty: record.aiDifficulty || 'standard',
      humanSide: record.humanSide || (record.gameType === 'xiangqi' ? 'r' : 'w'),
      startedAt: record.startedAt, updatedAt: record.updatedAt,
      completedAt: record.completedAt || null,
      engine: record.gameType === 'xiangqi' ? new XiangqiGame(state) : new ChessGame(state),
      opening: clone(record.opening || state)
    };
    this.render();
    if (this.isAiTurn()) this.scheduleAi();
  }

  sideAt(key) { return this.session?.engine.board[key]?.side || null; }
  bottomSide() {
    if (this.session.mode === 'vs_computer') return this.session.humanSide;
    return this.session.gameType === 'xiangqi' ? 'r' : 'w';
  }
  playerForSide(side) {
    if (this.session.mode === 'vs_computer') {
      return side === this.session.humanSide ? this.session.player1Name : this.session.player2Name;
    }
    const first = this.session.gameType === 'xiangqi' ? 'r' : 'w';
    return side === first ? this.session.player1Name : this.session.player2Name;
  }
  isAiTurn() {
    return this.session?.mode === 'vs_computer' &&
      this.session.engine.status === 'in_progress' &&
      this.session.engine.turn !== this.session.humanSide;
  }

  async onTap(key) {
    const s = this.session;
    if (!s || this.busy || s.engine.status !== 'in_progress' || this.isAiTurn()) return;
    const pieceSide = this.sideAt(key);
    if (key === this.selected) {
      this.selected = null; sounds.tap(); this.render(); return;
    }
    if (pieceSide === s.engine.turn) {
      this.selected = key; sounds.select(); this.render(); return;
    }
    if (!this.selected) return;
    const legal = s.engine.legalTargets(this.selected);
    if (!legal.includes(key)) {
      sounds.invalid();
      void this.view.nudge(this.selected);
      this.host.flash(t('open.illegal'));
      return;
    }
    let promotion = null;
    if (s.gameType === 'chess' && s.engine.needsPromotion(this.selected, key)) {
      promotion = await this.host.choosePromotion();
      if (!promotion) return;
    }
    await this.commit(this.selected, key, promotion);
  }

  async commit(from, to, promotion) {
    const s = this.session;
    const movingSnapshot = this.view.captureSnapshot(from);
    const capturedSnapshot = this.view.captureSnapshot(to);
    let castleSnapshot = null;
    const movingPiece = s.engine.board[from];
    if (s.gameType === 'chess' && movingPiece?.kind === 'k' &&
        Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
      const rank = from[1];
      const kingSide = to[0] === 'g';
      castleSnapshot = {
        from: this.view.captureSnapshot(`${kingSide ? 'h' : 'a'}${rank}`),
        to: `${kingSide ? 'f' : 'd'}${rank}`
      };
    }
    this.busy = true;
    this.selected = null;
    const result = s.engine.move(from, to, promotion);
    if (!result.ok) {
      this.busy = false; sounds.invalid(); this.host.flash(t('open.illegal')); return;
    }
    s.updatedAt = Date.now();
    if (s.engine.status === 'finished') s.completedAt = Date.now();
    this.persist();
    this.render();
    await this.view.animateFrom(movingSnapshot, to, {
      ...result,
      capturedSnapshot,
      castleSnapshot,
      onContact: () => {
        if (this.session !== s) return;
        if (result.capture) sounds.battle(); else sounds.place();
      }
    });
    this.busy = false;
    if (this.session !== s) return;
    if (result.check) sounds.check();
    if (s.engine.status === 'finished') {
      sounds.victory(); this.host.onOpenGameEnd(); return;
    }
    if (this.isAiTurn()) this.scheduleAi();
  }

  scheduleAi() {
    const s = this.session;
    const token = ++this.aiToken;
    const gameId = s.gameId, gameType = s.gameType;
    this.render();
    this.aiTimer = setTimeout(async () => {
      this.aiTimer = null;
      if (!this.validAi(s, token, gameId, gameType)) return;
      const state = s.engine.serialize();
      const move = await this.chooseAiMove(gameType, state, s.aiDifficulty, token);
      if (!move || !this.validAi(s, token, gameId, gameType)) return;
      await this.commit(move.from, move.to, move.promotion);
    }, 120);
  }

  chooseAiMove(gameType, state, difficulty, token) {
    if (typeof Worker === 'undefined') {
      return Promise.resolve(gameType === 'xiangqi'
        ? chooseXiangqiMove(state, difficulty)
        : chooseChessMove(state, difficulty));
    }

    this.aiWorker?.terminate();
    const worker = new Worker(new URL('./ai_worker.js', import.meta.url), { type: 'module' });
    this.aiWorker = worker;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        worker.terminate();
        if (this.aiWorker === worker) this.aiWorker = null;
        resolve(null);
      }, 2200);
      worker.onmessage = event => {
        if (event.data.id !== token) return;
        clearTimeout(timer);
        worker.terminate();
        if (this.aiWorker === worker) this.aiWorker = null;
        resolve(event.data.error ? null : event.data.move);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        if (this.aiWorker === worker) this.aiWorker = null;
        resolve(null);
      };
      worker.postMessage({ id: token, gameType, serialized: state, difficulty });
    });
  }

  validAi(s, token, gameId, gameType) {
    return this.session === s && this.aiToken === token &&
      s.gameId === gameId && s.gameType === gameType && this.isAiTurn();
  }

  render() {
    const s = this.session;
    if (!s) return;
    const engine = s.engine;
    let checkSide = null;
    if (engine.inCheck()) checkSide = engine.turn;
    this.view.render({
      gameType: s.gameType, board: engine.board, selected: this.selected,
      legalTargets: this.selected ? engine.legalTargets(this.selected) : [],
      bottomSide: this.bottomSide(), inCheck: checkSide
    });
    this.host.renderOpenChrome({
      gameType: s.gameType,
      status: engine.status,
      turnName: this.playerForSide(engine.turn),
      turnSide: engine.turn,
      thinking: this.isAiTurn(),
      check: !!checkSide,
      moveCount: engine.history.length
    });
  }

  toRecord() {
    const s = this.session;
    const state = s.engine.serialize();
    return {
      schemaVersion: 4,
      gameId: s.gameId, gameType: s.gameType, mode: s.mode,
      players: [s.player1Name, s.player2Name],
      player1Name: s.player1Name, player2Name: s.player2Name,
      aiDifficulty: s.aiDifficulty, difficulty: s.mode === 'vs_computer' ? s.aiDifficulty : null,
      humanSide: s.humanSide, startedAt: s.startedAt, updatedAt: s.updatedAt,
      completedAt: s.completedAt, status: state.status,
      winner: state.winner, result: state.result, moveCount: state.history.length,
      rulesVersion: s.gameType === 'xiangqi' ? 'xiangqi-family-v1' : 'chess.js-1.4.0',
      serializedState: state, opening: clone(s.opening), history: clone(state.history)
    };
  }

  persist() { if (this.session) this.host.persistOpenRecord(this.toRecord()); }
  dispose() {
    this.aiToken++;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    if (this.aiWorker) this.aiWorker.terminate();
    this.aiWorker = null;
    this.aiTimer = null; this.selected = null; this.busy = false; this.session = null;
  }
}

export function replayOpenRecord(record, step) {
  const game = record.gameType === 'xiangqi'
    ? new XiangqiGame(record.opening)
    : new ChessGame(record.opening);
  for (const move of (record.history || []).slice(0, step)) {
    game.move(move.from, move.to, move.promotion);
  }
  return game;
}
