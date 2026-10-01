/* Caesar Games — Application Controller
 *
 * One explicit lifecycle. Every screen change goes through `go()`, which is
 * the only place allowed to change what the player sees. Entering a state
 * tears down anything transient from the previous one, so a game can never
 * inherit timers, selections or overlays from a game the player has left.
 *
 * Visibility is expressed with classes only. Nothing in this app sets
 * `element.style.display` — an inline display rule that a class could not
 * override is what silently broke mode selection in the previous build.
 */

import { GameSession, MODES, PHASES, viewerSeatOf, boardOrientationOf, isPieceVisibleTo } from './engine/session.js';
import { LocalJunqiAI } from './engine/ai.js';
import { sounds } from './engine/sound.js';
import { BoardView } from './ui/board_view.js';
import {
  getPrefs, savePrefs, saveGame, loadGame, deleteGame,
  mostRecentResumable, listGames, formatFriendlyDate, formatFamilyMemory
} from './engine/persistence.js';
import { COMBAT, FLAG, PIECE_TYPES } from './engine/rules.js';
import { BUILD } from './build.js';
import { t, plural, localizeDom, getLocale, setLocale } from './i18n/strings.js';
import { GAME_TYPES, gameMeta, firstSideOf } from './games/registry.js';
import { OpenGameController, replayOpenRecord } from './games/open/controller.js';
import { OpenBoardView } from './games/open/board_view.js';
import { HoopsGame } from './games/hoops/controller.js';

export const S = {
  HOME: 'HOME',
  MODE_SELECT: 'MODE_SELECT',
  PLAYER_SETUP: 'PLAYER_SETUP',
  CLASSIC_P1_SETUP: 'CLASSIC_P1_SETUP',
  CLASSIC_HANDOFF: 'CLASSIC_HANDOFF',
  CLASSIC_P2_SETUP: 'CLASSIC_P2_SETUP',
  CLASSIC_PLAY: 'CLASSIC_PLAY',
  VS_AI_SETUP: 'VS_AI_SETUP',
  VS_AI_PLAY: 'VS_AI_PLAY',
  FLIP_PLAY: 'FLIP_PLAY',
  GAME_END: 'GAME_END',
  GAME_LIBRARY: 'GAME_LIBRARY',
  RECORD: 'RECORD',
  REPLAY: 'REPLAY',
  LEARN: 'LEARN',
  HOOPS: 'HOOPS',
  OPEN_PLAY: 'OPEN_PLAY',
  OPEN_END: 'OPEN_END'
};

const BOARD_STATES = new Set([
  S.CLASSIC_P1_SETUP, S.CLASSIC_P2_SETUP, S.CLASSIC_PLAY,
  S.VS_AI_SETUP, S.VS_AI_PLAY, S.FLIP_PLAY, S.GAME_END
  , S.OPEN_PLAY, S.OPEN_END
]);

const SETUP_STATES = new Set([S.CLASSIC_P1_SETUP, S.CLASSIC_P2_SETUP, S.VS_AI_SETUP]);

const MODE_LABEL = () => ({
  [MODES.VS_AI]: t('mode.vsComputer'),
  [MODES.CLASSIC]: t('mode.classic'),
  [MODES.FLIP]: t('mode.flip'),
  two_player: t('mode.twoPlayers')
});
const modeLabel = (m) => MODE_LABEL()[m] || m;
const gameLabel = gameType => t(gameMeta(gameType).titleKey);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export class App {
  constructor() {
    this.state = S.HOME;
    this.session = null;
    this.pending = {};            // payload for the current state
    this.ai = new LocalJunqiAI('standard');

    this._aiToken = 0;
    this._aiTimer = null;
    this._busy = false;           // guards against double taps mid-transition

    this.replay = null;
    this.selectedGameType = GAME_TYPES.JUNQI;

    this.board = new BoardView($('#board-mount'), {
      onNodeTap: (k) => this.onNodeTap(k)
    });
    this.openGame = new OpenGameController(this, $('#board-mount'));
    this.hoops = new HoopsGame($('#hoops-root'));

    this.bindChrome();
    this.go(S.HOME);
  }

  /* ================================================================ *
   * State machine
   * ================================================================ */

  /** The only way to change what is on screen. */
  go(next, payload = {}) {
    const prev = this.state;

    // Leaving a board state cancels everything transient it owned.
    if (BOARD_STATES.has(prev) && !BOARD_STATES.has(next)) {
      this.board.cancelAnimations();
    }
    if (prev !== next) this.cancelAi();
    if (prev === S.HOOPS && next !== S.HOOPS) this.hoops.leave();
    if (prev !== next && (prev === S.OPEN_PLAY || prev === S.OPEN_END)) this.openGame.aiToken++;

    this.state = next;
    this.pending = payload;
    this.render();
  }

  /** Derive the correct state for a session that was just created or loaded. */
  stateForSession(session, { resuming = false } = {}) {
    if (session.isGameOver) return S.GAME_END;
    switch (session.mode) {
      case MODES.VS_AI:
        return session.phase === PHASES.SETUP ? S.VS_AI_SETUP : S.VS_AI_PLAY;
      case MODES.FLIP:
        return S.FLIP_PLAY;
      case MODES.CLASSIC:
        if (session.phase === PHASES.SETUP) {
          return session.setupSide === 'navy' ? S.CLASSIC_P1_SETUP : S.CLASSIC_P2_SETUP;
        }
        // Resuming a shared-iPad game must not expose the board to whoever
        // happens to be holding it — always shield first.
        return resuming ? S.CLASSIC_HANDOFF : S.CLASSIC_PLAY;
      default:
        return S.HOME;
    }
  }

  /* ---------------- session lifecycle ---------------- */

  startGame(mode, options) {
    this.leaveSession();                       // saves + disposes anything open
    this.selectedGameType = GAME_TYPES.JUNQI;
    sounds.setMaterial(GAME_TYPES.JUNQI);
    const session = new GameSession(mode, options);
    session.openingBoard = JSON.parse(JSON.stringify(session.boardState));
    this.session = session;
    this.ai = new LocalJunqiAI(session.aiDifficulty);
    this.persist();
    this.go(this.stateForSession(session));
  }

  resumeGame(gameId) {
    const rec = gameId ? loadGame(gameId) : mostRecentResumable();
    if (!rec) return false;

    // Construct a complete candidate before replacing the current session.
    // One malformed record must never destroy a healthy live game.
    let session;
    try {
      session = (rec.gameType || GAME_TYPES.JUNQI) === GAME_TYPES.JUNQI
        ? GameSession.fromRecord(rec)
        : this.openGame.sessionFromRecord(rec);
    } catch (error) {
      console.warn('[resume] skipped malformed game', rec.gameId, error);
      return false;
    }

    this.leaveSession();
    if ((rec.gameType || GAME_TYPES.JUNQI) !== GAME_TYPES.JUNQI) {
      this.board.destroy();
      this.selectedGameType = rec.gameType;
      sounds.setMaterial(rec.gameType);
      this.openGame.resumeSession(session);
      this.go(session.engine.status === 'finished' ? S.OPEN_END : S.OPEN_PLAY);
      return true;
    }

    session.openingBoard = rec.openingBoard || null;
    sounds.setMaterial(GAME_TYPES.JUNQI);
    this.session = session;
    this.ai = new LocalJunqiAI(session.aiDifficulty);

    const next = this.stateForSession(session, { resuming: true });
    if (session.mode === MODES.CLASSIC &&
        session.phase === PHASES.SETUP &&
        session.setupSide === 'red') {
      this.go(S.CLASSIC_HANDOFF, {
        then: S.CLASSIC_P2_SETUP,
        forSide: 'red'
      });
    } else if (next === S.CLASSIC_HANDOFF) {
      this.go(S.CLASSIC_HANDOFF, { then: S.CLASSIC_PLAY, forSide: session.activeTurn, replayLastMove: true });
    } else {
      this.go(next);
    }
    if (session.isAiTurn) this.scheduleAiTurn();
    return true;
  }

  /** Save and release the current session without destroying its record. */
  leaveSession() {
    this.cancelAi();
    this.board.cancelAnimations();
    this._busy = false;
    if (this.session) {
      this.persist();
      this.session.dispose();
      this.session = null;
    }
    if (this.openGame?.session) {
      this.openGame.persist();
      this.openGame.dispose();
    }
  }

  startOpenGame(gameType, options) {
    this.leaveSession();
    this.board.destroy();
    this.selectedGameType = gameType;
    this.openGame.create(gameType, options);
    this.go(S.OPEN_PLAY);
  }

  persistOpenRecord(record) { saveGame(record); }

  onOpenGameEnd() {
    if (this.openGame.session) this.openGame.persist();
    this.go(S.OPEN_END);
  }

  persist() {
    if (!this.session) return;
    const rec = this.session.toRecord();
    if (this.session.openingBoard) rec.openingBoard = this.session.openingBoard;
    saveGame(rec);
  }

  /* ---------------- AI boundary ---------------- */

  cancelAi() {
    this._aiToken += 1;
    if (this._aiTimer) { clearTimeout(this._aiTimer); this._aiTimer = null; }
  }

  scheduleAiTurn() {
    const session = this.session;
    if (!session || session.disposed || !session.isAiTurn) return;

    const token = ++this._aiToken;
    const sameJob = () =>
      this.session === session && !session.disposed && token === this._aiToken;
    const stillValid = () => sameJob() && session.isAiTurn;

    this._aiTimer = setTimeout(async () => {
      this._aiTimer = null;
      if (!stillValid()) return;

      const move = this.ai.selectMove('red', session.boardState, session.flagDisclosed);
      if (!move) { session.endTurn(); this.persist(); this.render(); return; }

      const result = session.applyMove(move.from, move.to);
      const faceHtml = this.flyerHtmlFor(session, result);
      if (!session.isGameOver) session.endTurn();
      this.persist();
      await this.presentMove(session, result, token, faceHtml);
      if (!sameJob()) return;
      this.afterTurn();
    }, 620);
  }

  /* ================================================================ *
   * Input
   * ================================================================ */

  async onNodeTap(k) {
    const session = this.session;
    if (!session || this._busy || this.board.animating) return;
    if (session.isGameOver) return;

    if (SETUP_STATES.has(this.state)) return this.onSetupTap(k);
    if (this.state === S.FLIP_PLAY) return this.onFlipTap(k);
    if (this.state === S.CLASSIC_PLAY || this.state === S.VS_AI_PLAY) return this.onPlayTap(k);
  }

  onSetupTap(k) {
    const session = this.session;
    const before = session.selected;
    const res = session.setupTap(k);

    if (!res.ok) {
      sounds.invalid();
      void this.board.nudge(session.selected || k);
      this.flash(res.reason);
      return;
    }
    if (res.selected) { sounds.select(); this.render(); return; }
    if (res.deselected) { sounds.tap(); this.render(); return; }

    if (res.swapped) {
      sounds.place();
      this.board.animateSwap(res.swapped[0], res.swapped[1]).then(() => {
        this.persist();
        this.render();
      });
      return;
    }
    void before;
    this.render();
  }

  async onPlayTap(k) {
    const session = this.session;
    const piece = session.boardState[k];
    const side = session.controllingSide();

    if (session.selected === k) { session.selected = null; sounds.tap(); this.render(); return; }

    if (piece && piece.side === side) {
      const check = piece.static
        ? { allowed: false, reason: t(piece.name === FLAG ? 'rule.flagStatic' : 'rule.mineStatic') }
        : { allowed: true };
      if (!check.allowed) {
        sounds.invalid();
        void this.board.nudge(k);
        this.flash(check.reason);
        return;
      }
      session.selected = k;
      sounds.select();
      this.render();
      return;
    }

    if (!session.selected) return;

    const check = session.canMove(session.selected, k);
    if (!check.allowed) {
      sounds.invalid();
      void this.board.nudge(session.selected);
      this.flash(check.reason);
      return;
    }

    await this.commitMove(session.selected, k);
  }

  async onFlipTap(k) {
    const session = this.session;
    const piece = session.boardState[k];
    const side = session.controllingSide();

    if (piece && !piece.revealed) {
      // A reveal is a whole turn: hold the input gate until it has resolved,
      // otherwise a second tap lands before the turn has changed hands.
      this._busy = true;
      const concealed = this.board.capturePiece(k);
      session.revealPiece(k);
      if (!session.isGameOver) session.endTurn();
      this.persist();
      this.render();
      await this.board.animateReveal(k, concealed, () => {
        if (this.session === session && !session.disposed) sounds.reveal();
      });
      this._busy = false;
      if (this.session !== session || session.disposed) return;
      this.afterTurn();
      return;
    }

    if (session.selected === k) { session.selected = null; sounds.tap(); this.render(); return; }

    if (piece && piece.revealed && side && piece.side === side) {
      if (piece.static) {
        sounds.invalid();
        void this.board.nudge(k);
        this.flash(t(piece.name === FLAG ? 'rule.flagStatic' : 'rule.mineStatic'));
        return;
      }
      session.selected = k;
      sounds.select();
      this.render();
      return;
    }

    if (!session.selected) return;
    const check = session.canMove(session.selected, k);
    if (!check.allowed) {
      sounds.invalid();
      void this.board.nudge(session.selected);
      this.flash(check.reason);
      return;
    }
    await this.commitMove(session.selected, k);
  }

  /** Commit to canonical state first, then play the presentation. */
  async commitMove(from, to) {
    const session = this.session;
    this._busy = true;
    const result = session.applyMove(from, to);
    // Capture what the acting player is allowed to see before advancing the
    // canonical turn. Presentation may finish later; the saved transaction may
    // not.
    const faceHtml = this.flyerHtmlFor(session, result);
    if (!session.isGameOver) session.endTurn();
    this.persist();

    await this.presentMove(session, result, this._aiToken, faceHtml);
    this._busy = false;

    if (this.session !== session || session.disposed) return;
    this.afterTurn();
  }

  /** Sound + motion for a move that has already been applied. */
  async presentMove(session, result, token, capturedFace = null) {
    const orientationBefore = this.board.orientation;

    const faceHtml = capturedFace || this.flyerHtmlFor(session, result);
    await this.board.animateMove({
      from: result.from,
      to: result.to,
      combat: result.combat,
      outcome: result.outcome,
      removedFrom: result.removedFrom,
      faceHtml: faceHtml.html,
      faceClass: faceHtml.cls,
      onContact: () => {
        if (this.session !== session || session.disposed) return;
        if (result.combat) {
          if (result.outcome === COMBAT.BOTH_REMOVED) sounds.mutualLoss();
          else sounds.battle();
        } else {
          sounds.place();
        }
      }
    });

    void orientationBefore; void token;
  }

  /** What the travelling piece looks like — concealment rules still apply. */
  flyerHtmlFor(session, result) {
    const viewerSeat = viewerSeatOf(session);
    const survivor = result.survivorAt ? session.boardState[result.survivorAt] : null;
    const moved = survivor || { side: result.actingSide, name: '', revealed: false };
    const visible = survivor
      ? isPieceVisibleTo(session, result.survivorAt, survivor, viewerSeat)
      : false;

    if (visible) {
      let cls = `is-face side-${moved.side}`;
      if (session.mode === MODES.FLIP && session.seatForSide(moved.side) === 2) cls += ' faces-top';
      return { cls, html: moved.name };
    }
    return { cls: 'is-back', html: '<span class="bv-back-mark"></span>' };
  }

  /** Turn hand-over, end-of-game checks, and the Classic privacy shield. */
  afterTurn() {
    const session = this.session;
    if (!session) return;

    if (session.isGameOver) {
      this.persist();
      sounds.victory();
      this.go(S.GAME_END);
      return;
    }

    if (session.mode === MODES.CLASSIC) {
      sounds.pass();
      this.go(S.CLASSIC_HANDOFF, { then: S.CLASSIC_PLAY, forSide: session.activeTurn, replayLastMove: true });
      return;
    }

    if (session.mode === MODES.VS_AI && session.isAiTurn) {
      this.render();
      this.scheduleAiTurn();
      return;
    }

    this.render();
  }

  /* ================================================================ *
   * Setup controls
   * ================================================================ */

  async onQuickSetup() {
    if (this._busy) return;
    const session = this.session;
    this._busy = true;
    const previous = this.board.captureFormation();
    session.quickSetup();
    this.persist();
    this.render();
    try {
      await this.board.animateFormation(previous);
      if (this.session === session && !session.disposed) sounds.shuffle();
    } finally {
      if (this.session === session) this._busy = false;
    }
  }

  async onResetSetup() {
    if (this._busy) return;
    const session = this.session;
    this._busy = true;
    const previous = this.board.captureFormation();
    session.resetSetup();
    this.persist();
    this.render();
    try {
      await this.board.animateFormation(previous);
      if (this.session === session && !session.disposed) sounds.place();
    } finally {
      if (this.session === session) this._busy = false;
    }
  }

  onReady() {
    const session = this.session;
    const res = session.lockSetup();
    if (!res.ok) {
      sounds.invalid();
      this.flash(res.problems[0] || t('rule.formationIllegal'));
      return;
    }
    sounds.ready();
    this.persist();

    if (res.next === 'play') { this.go(S.VS_AI_PLAY); return; }
    if (res.next === 'handoff_to_setup') {
      this.go(S.CLASSIC_HANDOFF, { then: S.CLASSIC_P2_SETUP, forSide: 'red' });
      return;
    }
    this.go(S.CLASSIC_HANDOFF, { then: S.CLASSIC_PLAY, forSide: 'navy' });
  }

  onHandoffReady() {
    const { then, replayLastMove } = this.pending;
    sounds.ready();
    this.go(then || S.CLASSIC_PLAY);
    if (replayLastMove && this.session?.lastMove) {
      setTimeout(() => this.replayLastMove(), 220);
    }
  }

  /** Replay the opponent's last move so the receiving player can follow it. */
  async replayLastMove() {
    const session = this.session;
    const lm = session?.lastMove;
    if (!lm || this.board.animating) return;
    if (lm.reveal) { await this.board.pulse([lm.to], 'is-pulse', 620); return; }

    // Put the moved piece back at its origin for the duration of the replay.
    const survivor = lm.survivorAt ? session.boardState[lm.survivorAt] : null;
    const viewerSeat = viewerSeatOf(session);
    const visible = survivor ? isPieceVisibleTo(session, lm.survivorAt, survivor, viewerSeat) : false;
    let cls = 'is-back', html = '<span class="bv-back-mark"></span>';
    if (visible) {
      cls = `is-face side-${survivor.side}`;
      if (session.mode === MODES.FLIP && session.seatForSide(survivor.side) === 2) cls += ' faces-top';
      html = survivor.name;
    }

    await this.board.pulse([lm.from], 'is-replay-origin', 300);
    await this.board.animateMove({
      from: lm.from, to: lm.to,
      combat: lm.combat,
      outcome: lm.outcome,
      removedFrom: [],
      faceHtml: html, faceClass: cls,
      onContact: () => {
        if (this.session !== session || session.disposed) return;
        if (lm.combat) sounds.battle(); else sounds.place();
      }
    });
    this.render();
  }

  /* ================================================================ *
   * Rendering
   * ================================================================ */

  render() {
    const st = this.state;
    const session = this.session;
    if (st !== S.GAME_END && st !== S.OPEN_END) $('#game-end').classList.remove('is-open');

    // Screens
    $$('.screen').forEach(el => el.classList.toggle('is-active', el.dataset.screen === this.screenFor(st)));

    // Dialogs
    const dialog = this.dialogFor(st);
    $$('.dialog').forEach(el => el.classList.toggle('is-open', el.dataset.dialog === dialog));
    document.body.classList.toggle('has-dialog', !!dialog);

    // Privacy shield
    $('#handoff').classList.toggle('is-open', st === S.CLASSIC_HANDOFF);

    // App bar
    this.renderChrome();

    if (BOARD_STATES.has(st) && session) this.renderBoard();
    if ((st === S.OPEN_PLAY || st === S.OPEN_END) && this.openGame.session) this.openGame.render();
    if (st === S.HOME) this.renderHome();
    if (st === S.MODE_SELECT) this.renderModeSelect();
    if (st === S.PLAYER_SETUP) this.renderPlayerSetup();
    if (st === S.CLASSIC_HANDOFF) this.renderHandoff();
    if (st === S.GAME_END || st === S.OPEN_END) this.renderGameEnd();
    if (st === S.GAME_LIBRARY) this.renderLibrary();
    if (st === S.RECORD || st === S.REPLAY) this.renderRecord();
    if (st === S.LEARN) this.renderLearn();
    if (st === S.HOOPS) this.hoops.render();
  }

  screenFor(st) {
    if (st === S.LEARN) return 'learn';
    if (st === S.HOOPS) return 'hoops';
    if (BOARD_STATES.has(st)) return 'board';
    return 'home';
  }

  dialogFor(st) {
    if (st === S.MODE_SELECT) return 'mode';
    if (st === S.PLAYER_SETUP) return 'names';
    if (st === S.GAME_LIBRARY) return 'library';
    if (st === S.RECORD || st === S.REPLAY) return 'record';
    return null;
  }

  renderChrome() {
    const st = this.state;
    const onBoard = BOARD_STATES.has(st);
    $('#app-bar').dataset.context = onBoard || st === S.HOOPS ? 'game' : 'home';
    $('#btn-home').classList.toggle('is-hidden', !onBoard && st !== S.LEARN && st !== S.HOOPS);

    const muteBtn = $('#btn-sound');
    muteBtn.setAttribute('aria-pressed', String(!sounds.isMuted));
    muteBtn.querySelector('.btn-label').textContent = t(sounds.isMuted ? 'bar.soundOff' : 'bar.soundOn');
    $('#btn-language').textContent = getLocale() === 'en' ? '中文' : 'EN';
    $('#btn-language').setAttribute('aria-label', t('bar.language'));
  }

  /* ---------------- home ---------------- */

  renderHome() {
    const resumable = mostRecentResumable();
    const games = listGames();

    const cont = $('#btn-continue');
    cont.classList.toggle('is-hidden', !resumable);
    if (resumable) {
      $('#continue-detail').textContent =
        `${gameLabel(resumable.gameType || GAME_TYPES.JUNQI)} · ${resumable.player1Name} ${t('misc.vsSeparator')} ${resumable.player2Name}`;
    }

    const memory = $('#home-memory');
    if (games.length) {
      memory.textContent = plural('home.memory', games.length);
      memory.classList.remove('is-hidden');
    } else {
      memory.classList.add('is-hidden');
    }
  }

  renderModeSelect() {
    const isJunqi = this.selectedGameType === GAME_TYPES.JUNQI;
    $('#mode-title').textContent = t('mode.for', { game: gameLabel(this.selectedGameType) });
    const two = $('#mode-two-player');
    two.dataset.mode = isJunqi ? MODES.CLASSIC : 'two_player';
    two.querySelector('h3').textContent = t(isJunqi ? 'mode.classic' : 'mode.twoPlayers');
    two.querySelector('p').textContent = t(isJunqi ? 'mode.classic.desc' : 'mode.twoPlayers.desc');
    $('#mode-flip').classList.toggle('is-hidden', !isJunqi);
  }

  renderPlayerSetup() {
    const mode = this.pending.mode;
    const gameType = this.pending.gameType || this.selectedGameType;
    const prefs = getPrefs();
    const isAi = mode === MODES.VS_AI;
    const isOpen = gameType !== GAME_TYPES.JUNQI;

    $('#names-title').textContent = `${gameLabel(gameType)} · ${modeLabel(mode)}`;
    $('#names-sub').textContent = t(isOpen
      ? (isAi ? 'players.sub.openAi' : 'players.sub.openTwo')
      : (isAi ? 'players.sub.ai' : 'players.sub.two'));

    $('#field-p2').classList.toggle('is-hidden', isAi);
    $('#field-difficulty').classList.toggle('is-hidden', !isAi);
    $('#field-side').classList.toggle('is-hidden', !isOpen || !isAi);

    $('#input-p1').value = prefs.p1 || '';
    $('#input-p2').value = prefs.p2 || '';
    $('#input-p1').placeholder = t(isAi ? 'players.you' : 'players.p1');
    $$('#field-difficulty .choice').forEach(b =>
      b.classList.toggle('is-selected', b.dataset.value === (prefs.aiDifficulty || 'standard')));
    if (isOpen) {
      const isGomoku = gameType === GAME_TYPES.GOMOKU;
      const first = gameType === GAME_TYPES.XIANGQI
        ? t('players.red')
        : t(isGomoku ? 'players.black' : 'players.white');
      const second = t(isGomoku ? 'players.white' : 'players.black');
      const remembered = gameType === GAME_TYPES.XIANGQI
        ? prefs.xiangqiSide
        : isGomoku ? prefs.gomokuSide : prefs.chessSide;
      $('[data-side="first"]').textContent = first;
      $('[data-side="second"]').textContent = second;
      const secondSide = isGomoku ? 'w' : 'b';
      $$('#field-side .choice').forEach((b, i) =>
        b.classList.toggle('is-selected', i === (remembered === secondSide ? 1 : 0)));
    }
  }

  renderHandoff() {
    const session = this.session;
    const side = this.pending.forSide || session?.activeTurn || 'navy';
    const name = session ? session.nameForSide(side) : 'Player';
    const isSetup = this.pending.then === S.CLASSIC_P2_SETUP;

    $('#handoff-name').textContent = name;
    $('#handoff-action').textContent = t(isSetup ? 'handoff.toSetup' : 'handoff.toPlay');
    $('#handoff-title').textContent = t('handoff.title');
  }

  /* ---------------- board ---------------- */

  renderBoard() {
    const session = this.session;
    const st = this.state;
    delete $('#board-mount').dataset.openGame;
    const orientation = boardOrientationOf(session);
    const viewerSeat = viewerSeatOf(session);
    const isSetup = SETUP_STATES.has(st);

    const legalTargets = session.selected && !isSetup ? session.legalTargetsFrom(session.selected) : [];

    this.board.render(session, {
      orientation,
      viewerSeat,
      legalTargets,
      highlight: session.lastMove && !isSetup
        ? { from: session.lastMove.from, to: session.lastMove.to }
        : null
    });

    // Status line
    const statusEl = $('#turn-status');
    const dot = $('#turn-dot');
    let label, sideClass;

    if (isSetup) {
      const side = session.setupSide;
      sideClass = side;
      const who = session.mode === MODES.VS_AI ? (session.player1Name || t('players.you')) : session.nameForSide(side);
      label = t('setup.arrange', { name: who });
    } else if (session.isGameOver) {
      sideClass = session.winner;
      label = t('end.wins', { name: session.winnerName });
    } else if (session.mode === MODES.VS_AI && session.activeTurn === 'red') {
      sideClass = 'red';
      label = t('play.thinking', { name: session.player2Name });
    } else if (session.mode === MODES.FLIP) {
      const side = session.controllingSide();
      sideClass = side || 'navy';
      const seat = session.flipSeatTurn;
      const who = seat === 1 ? session.player1Name : session.player2Name;
      label = session.assignedColors.p1 ? t('play.turn', { name: who }) : t('play.flipFirst', { name: who });
    } else {
      const side = session.activeTurn;
      sideClass = side;
      label = t('play.turn', { name: session.nameForSide(side) });
    }

    statusEl.textContent = label;
    dot.className = `turn-dot side-${sideClass}`;

    // Contextual controls
    $('#setup-controls').classList.toggle('is-hidden', !isSetup);
    $('#play-controls').classList.toggle('is-hidden', isSetup);
    $('#btn-replay-move').classList.toggle('is-hidden',
      isSetup || !session.lastMove || session.isGameOver);
    $('#btn-offer-draw').classList.add('is-hidden');
    $('#btn-resign').classList.toggle('is-hidden', isSetup || session.isGameOver);

    const counter = $('#move-counter');
    counter.textContent = session.history.length
      ? t('record.moveCount', { n: session.history.length })
      : '';

    $('#board-hint').textContent = this.hintFor(session, st);
    $('#mode-tag').textContent = modeLabel(session.mode);
  }

  renderOpenChrome({ gameType, status, turnName, turnSide, thinking, check, moveCount }) {
    const mount = $('#board-mount');
    mount.dataset.openGame = gameType;
    $('#setup-controls').classList.add('is-hidden');
    $('#play-controls').classList.remove('is-hidden');
    $('#btn-replay-move').classList.add('is-hidden');
    const canOfferDraw = status === 'in_progress' &&
      this.openGame.session.mode === 'two_player' &&
      [GAME_TYPES.XIANGQI, GAME_TYPES.CHESS].includes(gameType);
    $('#btn-offer-draw').classList.toggle('is-hidden', !canOfferDraw);
    $('#btn-resign').classList.toggle('is-hidden', status !== 'in_progress');
    $('#move-counter').textContent = moveCount ? t('record.moveCount', { n: moveCount }) : '';
    $('#turn-status').textContent = thinking
      ? t('play.thinking', { name: turnName })
      : `${t('play.turn', { name: turnName })}${check ? ` · ${t('play.check')}` : ''}`;
    const visualSide = turnSide === 'r' || turnSide === 'w' ? 'red' : 'navy';
    $('#turn-dot').className = `turn-dot side-${visualSide}`;
    $('#board-hint').textContent = thinking
      ? ''
      : t(gameType === GAME_TYPES.GOMOKU ? 'play.hint.place' : 'play.hint.select');
    $('#mode-tag').textContent = `${gameLabel(gameType)} · ${modeLabel(this.openGame.session.mode)}`;
  }

  hintFor(session, st) {
    if (SETUP_STATES.has(st)) return t('setup.hint');
    if (session.isGameOver) return '';
    if (session.mode === MODES.FLIP && !session.assignedColors.p1) return t('play.hint.flipFirst');
    if (session.mode === MODES.FLIP) return t('play.hint.flip');
    if (session.selected) return t('play.hint.move');
    return t('play.hint.select');
  }

  renderGameEnd() {
    if (this.state === S.OPEN_END) {
      this.openGame.render();
      const s = this.openGame.session;
      const engine = s.engine;
      const winnerName = engine.winner ? this.openGame.playerForSide(engine.winner) : null;
      $('#end-winner').textContent = winnerName
        ? t('end.wins', { name: winnerName })
        : t('end.draws');
      $('#end-detail').textContent = t('end.detail', {
        p1: s.player1Name, p2: s.player2Name, n: engine.history.length
      });
      const reasonKeys = {
        checkmate: 'end.byCheckmate', stalemate: 'end.byStalemate',
        repetition: 'end.byRepetition', insufficient: 'end.byInsufficient',
        fifty_move: 'end.byFifty', no_legal_move: 'end.byNoLegal',
        general: 'end.byGeneral', five: 'end.byFive',
        resignation: 'end.byResignation', draw_agreement: 'end.byAgreement',
        draw: 'end.draws'
      };
      $('#end-reason').textContent = t(reasonKeys[engine.result] || 'end.byNoLegal');
      $('#end-memory').textContent = formatFamilyMemory(this.openGame.toRecord());
      $('#game-end').classList.add('is-open');
      return;
    }
    this.renderBoard();
    const session = this.session;
    $('#end-winner').textContent = t('end.wins', { name: session.winnerName });
    $('#end-detail').textContent = t('end.detail', {
      p1: session.player1Name, p2: session.player2Name, n: session.history.length });
    $('#end-reason').textContent = t(session.winReason === 'flag'
      ? 'end.byFlag'
      : session.winReason === 'resignation' ? 'end.byResignation' : 'end.byImmobile');
    $('#end-memory').textContent = formatFamilyMemory(session.toRecord());
    $('#game-end').classList.add('is-open');
  }

  renderLearn() {
    const type = this.selectedGameType || GAME_TYPES.JUNQI;
    $('#learn-title').textContent = t(`learn.${type}.title`);
    const grid = $('#learn-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const card = document.createElement('section');
      card.className = 'learn-card';
      const title = document.createElement('h3');
      const body = document.createElement('p');
      title.textContent = t(`learn.${type}.${i}.title`);
      body.textContent = t(`learn.${type}.${i}.body`);
      card.append(title, body);
      grid.appendChild(card);
    }
  }

  /* ---------------- library / record ---------------- */

  renderLibrary() {
    const list = $('#library-list');
    const games = listGames();
    list.innerHTML = '';

    if (!games.length) {
      list.innerHTML = `<p class="empty-note">${t('library.empty')}</p>`;
      return;
    }

    for (const g of games) {
      const item = document.createElement('article');
      item.className = 'game-row';
      const finished = g.status === 'finished';
      const gameType = g.gameType || GAME_TYPES.JUNQI;
      const firstSide = firstSideOf(gameType);
      const winner = finished && g.winner
        ? (g.winner === firstSide ? g.player1Name : g.player2Name)
        : null;

      const meta = [
        formatFriendlyDate(g.updatedAt),
        plural('library.moves', g.moveCount),
        finished
          ? (winner ? t('library.won', { name: winner }) : t('library.draw'))
          : t('library.inProgress')
      ].join(' · ');

      item.innerHTML = `
        <div class="game-row-main">
          <p class="game-row-players">${escapeHtml(g.player1Name)} <span>${t('misc.vsSeparator')}</span> ${escapeHtml(g.player2Name)}</p>
          <p class="game-row-meta">${escapeHtml(modeLabel(g.mode))} · ${escapeHtml(gameLabel(gameType))} · ${escapeHtml(meta)}</p>
        </div>
        <div class="game-row-actions"></div>`;

      const actions = item.querySelector('.game-row-actions');
      if (!finished) actions.appendChild(this.rowButton(t('library.resume'), 'primary', () => this.resumeGame(g.gameId)));
      if (g.moveCount > 0) actions.appendChild(this.rowButton(t('library.record'), 'quiet', () => this.openRecord(g.gameId)));
      actions.appendChild(this.rowButton(t('library.again'), 'quiet', () => {
        const options = {
          mode: g.mode, player1Name: g.player1Name, player2Name: g.player2Name,
          aiDifficulty: g.aiDifficulty, humanSide: g.humanSide
        };
        if (gameType === GAME_TYPES.JUNQI) this.startGame(g.mode, options);
        else this.startOpenGame(gameType, options);
      }));
      actions.appendChild(this.rowButton(t('library.delete'), 'danger', () => {
        this.confirmDelete(g);
      }));

      list.appendChild(item);
    }
  }

  rowButton(label, kind, onClick) {
    const b = document.createElement('button');
    b.className = `row-btn ${kind}`;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => { sounds.tap(); onClick(); });
    return b;
  }

  confirmDelete(g) {
    this.confirmAction({
      title: t('library.deleteTitle'),
      text: t('library.deleteAsk', { p1: g.player1Name, p2: g.player2Name }),
      confirm: t('library.deleteConfirm'),
      cancel: t('library.deleteCancel'),
      action: () => {
        deleteGame(g.gameId);
        this.renderLibrary();
      }
    });
  }

  confirmAction({ title, text, confirm, cancel, action }) {
    this._confirmAction = action;
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#btn-confirm-ok').textContent = confirm;
    $('#btn-confirm-cancel').textContent = cancel;
    $('#confirm').classList.add('is-open');
  }

  requestResign() {
    let side, name, winnerName;
    if (this.openGame.session) {
      const s = this.openGame.session;
      if (s.engine.status !== 'in_progress') return;
      side = s.mode === 'vs_computer' ? s.humanSide : s.engine.turn;
      name = this.openGame.playerForSide(side);
      const winner = side === 'r' ? 'b' : side === 'w' ? 'b' : side === 'b'
        ? (s.gameType === GAME_TYPES.XIANGQI ? 'r' : 'w') : null;
      winnerName = this.openGame.playerForSide(winner);
    } else {
      const s = this.session;
      if (!s || s.isGameOver || s.phase !== PHASES.PLAY) return;
      side = s.mode === MODES.VS_AI ? 'navy' : s.controllingSide();
      name = s.nameForSide(side);
      winnerName = s.nameForSide(side === 'navy' ? 'red' : 'navy');
    }
    this.confirmAction({
      title: t('resign.title'),
      text: t('resign.ask', { name, winner: winnerName }),
      confirm: t('resign.confirm'),
      cancel: t('resign.cancel'),
      action: () => this.performResign(side)
    });
  }

  performResign(side) {
    this.cancelAi();
    if (this.openGame.session) {
      this.openGame.resign(side);
      return;
    }
    const session = this.session;
    if (!session?.resign(side).ok) return;
    this.persist();
    sounds.victory();
    this.go(S.GAME_END);
  }

  requestDraw() {
    const s = this.openGame.session;
    if (!s || s.mode !== 'two_player' ||
        ![GAME_TYPES.XIANGQI, GAME_TYPES.CHESS].includes(s.gameType) ||
        s.engine.status !== 'in_progress') return;
    const offeredBy = s.engine.turn;
    this.confirmAction({
      title: t('draw.offered'),
      text: '',
      confirm: t('draw.accept'),
      cancel: t('draw.keepPlaying'),
      action: () => this.openGame.acceptDraw(offeredBy)
    });
  }

  openRecord(gameId) {
    const rec = loadGame(gameId);
    if (!rec) return;
    this.replay = { rec, step: 0, timer: null, board: null };
    this.go(S.RECORD);
  }

  renderRecord() {
    const { rec } = this.replay;
    const memory = $('#record-memory');
    memory.textContent = rec.status === 'finished' ? formatFamilyMemory(rec) : '';
    memory.classList.toggle('is-hidden', rec.status !== 'finished');
    if ((rec.gameType || GAME_TYPES.JUNQI) !== GAME_TYPES.JUNQI) {
      this.renderOpenRecord();
      return;
    }
    $('#record-title').textContent = `${rec.player1Name} ${t('misc.vsSeparator')} ${rec.player2Name}`;
    $('#record-meta').textContent = [
      modeLabel(rec.mode),
      formatFriendlyDate(rec.startedAt),
      plural('library.moves', rec.moveCount),
      rec.status === 'finished'
        ? t('library.won', { name: rec.winner === 'navy' ? rec.player1Name : rec.player2Name })
        : t('record.unfinished')
    ].join(' · ');

    const list = $('#record-moves');
    list.innerHTML = '';
    const moves = rec.history || [];
    if (!moves.length) {
      list.innerHTML = `<p class="empty-note">${t('record.noMoves')}</p>`;
    } else {
      moves.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'record-move';
        row.classList.toggle('is-current', i + 1 === this.replay.step);
        row.innerHTML =
          `<span class="rm-n">${m.n}</span>` +
          `<span class="rm-who side-${m.side}">${escapeHtml(m.name)}</span>` +
          `<span class="rm-text">${escapeHtml(m.text)}</span>`;
        row.addEventListener('click', () => this.replaySeek(i + 1));
        list.appendChild(row);
      });
    }

    $('#replay-step').textContent = t('record.step', { n: this.replay.step, total: moves.length });
    $('#btn-replay-play').textContent = t(this.replay.timer ? 'record.pause' : 'record.play');
    this.renderReplayBoard();
  }

  renderOpenRecord() {
    const { rec, step } = this.replay;
    const firstSide = firstSideOf(rec.gameType);
    const winnerName = rec.winner
      ? (rec.winner === firstSide ? rec.player1Name : rec.player2Name)
      : null;
    $('#record-title').textContent = `${rec.player1Name} ${t('misc.vsSeparator')} ${rec.player2Name}`;
    $('#record-meta').textContent = [
      gameLabel(rec.gameType), modeLabel(rec.mode), formatFriendlyDate(rec.startedAt),
      plural('library.moves', rec.moveCount),
      rec.status === 'finished'
        ? (winnerName ? t('library.won', { name: winnerName }) : t('library.draw'))
        : t('record.unfinished')
    ].join(' · ');

    const list = $('#record-moves');
    list.innerHTML = '';
    const moves = rec.history || [];
    if (!moves.length) list.innerHTML = `<p class="empty-note">${t('record.noMoves')}</p>`;
    moves.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'record-move';
      row.classList.toggle('is-current', i + 1 === step);
      const who = m.side === firstSide ? rec.player1Name : rec.player2Name;
      const moveText = m.drawAgreement
        ? t('record.drawAgreed')
        : m.resign
        ? t('record.resigned', { name: who })
        : rec.gameType === GAME_TYPES.GOMOKU
          ? t('record.moveOpen', { piece: t('gomoku.stone'), from: '—', to: m.to })
          : (m.san || t('record.moveOpen', { piece: m.piece, from: m.from, to: m.to }));
      row.innerHTML = `<span class="rm-n">${i + 1}</span>` +
        `<span class="rm-who">${escapeHtml(who)}</span>` +
        `<span class="rm-text">${escapeHtml(moveText)}</span>`;
      row.addEventListener('click', () => this.replaySeek(i + 1));
      list.appendChild(row);
    });
    $('#replay-step').textContent = t('record.step', { n: step, total: moves.length });
    $('#btn-replay-play').textContent = t(this.replay.timer ? 'record.pause' : 'record.play');
    this.renderReplayBoard();
  }

  /** Rebuild the position at `step` from the opening board plus history. */
  replayPositionAt(step) {
    const { rec } = this.replay;
    if (!rec.openingBoard) return null;
    const board = JSON.parse(JSON.stringify(rec.openingBoard));
    const moves = (rec.history || []).slice(0, step);

    for (const m of moves) {
      if (m.reveal) { if (board[m.from]) board[m.from].revealed = true; continue; }
      const attacker = board[m.from];
      const defender = board[m.to];
      if (!attacker) continue;
      if (!defender) { board[m.to] = attacker; delete board[m.from]; continue; }
      if (m.outcome === COMBAT.ATTACKER_WINS) { board[m.to] = attacker; delete board[m.from]; }
      else if (m.outcome === COMBAT.DEFENDER_WINS) { delete board[m.from]; }
      else { delete board[m.from]; delete board[m.to]; }
      if (rec.mode === MODES.FLIP && board[m.to]) board[m.to].revealed = true;
    }
    return board;
  }

  renderReplayBoard() {
    const mount = $('#replay-board');
    const { rec, step } = this.replay;
    if ((rec.gameType || GAME_TYPES.JUNQI) !== GAME_TYPES.JUNQI) {
      const game = replayOpenRecord(rec, step);
      if (!this.replay.openView) this.replay.openView = new OpenBoardView(mount);
      this.replay.openView.render({
        gameType: rec.gameType, board: game.board, selected: null, legalTargets: [],
        bottomSide: rec.mode === 'vs_computer'
          ? (rec.humanSide || firstSideOf(rec.gameType))
          : firstSideOf(rec.gameType),
        inCheck: game.inCheck?.() ? game.turn : null,
        lastMove: game.history.at(-1) || null,
        interactive: false
      });
      return;
    }
    const board = this.replayPositionAt(step);

    if (!board) {
      mount.innerHTML = `<p class="empty-note">${t('record.unavailable')}</p>`;
      return;
    }

    if (!this.replay.view) {
      mount.innerHTML = '';
      this.replay.view = new BoardView(mount, { onNodeTap: () => {} });
    }

    // Replay stays privacy-safe: identities that were never public stay hidden.
    const shadow = GameSession.fromRecord({ ...rec, boardState: board });
    shadow.openingBoard = rec.openingBoard;
    const move = (rec.history || [])[step - 1];

    // Vs Computer: the human always knew their own army, so showing it back to
    // them leaks nothing and makes the record readable. Two-player games stay
    // fully concealed — either army would leak to the other player.
    const viewerSeat = rec.mode === MODES.VS_AI ? 1 : 0;

    this.replay.view.render(shadow, {
      orientation: 'navy_bottom',
      viewerSeat,
      legalTargets: [],
      highlight: move ? { from: move.from, to: move.to } : null
    });
  }

  replaySeek(step) {
    const total = (this.replay.rec.history || []).length;
    this.replay.step = Math.max(0, Math.min(total, step));
    this.renderRecord();
  }

  replayToggle() {
    const total = (this.replay.rec.history || []).length;
    if (this.replay.timer) {
      clearInterval(this.replay.timer);
      this.replay.timer = null;
    } else {
      this.replay.timer = setInterval(() => {
        if (this.replay.step >= total) {
          clearInterval(this.replay.timer);
          this.replay.timer = null;
          this.renderRecord();
          return;
        }
        this.replay.step += 1;
        this.renderRecord();
      }, 900);
    }
    this.renderRecord();
  }

  closeRecord() {
    if (this.replay?.timer) clearInterval(this.replay.timer);
    if (this.replay?.view) this.replay.view.destroy();
    if (this.replay?.openView) this.replay.openView = null;
    this.replay = null;
    this.go(S.GAME_LIBRARY);
  }

  /* ================================================================ *
   * Chrome bindings
   * ================================================================ */

  flash(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  bindChrome() {
    const on = (sel, fn, { silent = false } = {}) => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        if (!silent) sounds.tap();
        fn(e);
      });
    };

    // iOS may suspend or interrupt Web Audio whenever the app backgrounds.
    // Re-unlock on every real gesture and also make a best-effort wake when the
    // page becomes visible; the next gesture remains the authoritative path.
    document.addEventListener('pointerdown', () => { void sounds.unlock(); }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void sounds.resume();
    });
    window.addEventListener('pageshow', () => { void sounds.resume(); });

    const boardSurface = $('#board-mount');
    boardSurface.addEventListener('contextmenu', event => {
      if (event.target.closest('.bv-board, .open-board')) event.preventDefault();
    });
    boardSurface.addEventListener('dragstart', event => {
      if (event.target.closest('.bv-board, .open-board')) event.preventDefault();
    });

    on('#btn-sound', () => {
      sounds.setMuted(!sounds.isMuted);
      if (!sounds.isMuted) sounds.tap();
      this.renderChrome();
    }, { silent: true });

    on('#btn-language', () => {
      const next = getLocale() === 'en' ? 'zh' : 'en';
      setLocale(next);
      savePrefs({ language: next });
      localizeDom();
      this.render();
    });

    on('#brand', () => this.goHome());
    on('#btn-home', () => this.goHome());

    $$('[data-game-type]').forEach(card => {
      card.addEventListener('click', () => {
        sounds.tap();
        this.selectedGameType = card.dataset.gameType;
        this.go(S.MODE_SELECT);
      });
    });
    on('#btn-continue', () => { if (!this.resumeGame(null)) this.flash(t('misc.noContinue')); });
    on('#btn-games', () => this.go(S.GAME_LIBRARY));
    on('#btn-learn', () => this.go(S.LEARN));
    on('#btn-hoops', () => this.go(S.HOOPS));
    on('#btn-learn-back', () => this.goHome());

    $$('[data-mode]').forEach(card => {
      card.addEventListener('click', () => {
        sounds.tap();
        this.go(S.PLAYER_SETUP, {
          mode: card.dataset.mode,
          gameType: this.selectedGameType
        });
      });
    });

    on('#btn-close-mode', () => this.go(S.HOME));
    on('#btn-close-names', () => this.go(S.MODE_SELECT));
    on('#btn-close-library', () => this.goHome());
    on('#btn-close-record', () => this.closeRecord());

    $$('#field-difficulty .choice').forEach(b => {
      b.addEventListener('click', () => {
        sounds.tap();
        $$('#field-difficulty .choice').forEach(x => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
      });
    });
    $$('#field-side .choice').forEach(b => {
      b.addEventListener('click', () => {
        sounds.tap();
        $$('#field-side .choice').forEach(x => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
      });
    });

    on('#btn-start-match', () => this.confirmPlayers());

    on('#btn-quick-setup', () => this.onQuickSetup(), { silent: true });
    on('#btn-reset-setup', () => this.onResetSetup(), { silent: true });
    on('#btn-ready', () => this.onReady(), { silent: true });

    on('#btn-handoff-ready', () => this.onHandoffReady(), { silent: true });
    on('#btn-replay-move', () => this.replayLastMove(), { silent: true });
    on('#btn-offer-draw', () => this.requestDraw());
    on('#btn-resign', () => this.requestResign());

    on('#btn-end-again', () => {
      if (this.state === S.OPEN_END) {
        const s = this.openGame.session;
        this.startOpenGame(s.gameType, {
          mode: s.mode, player1Name: s.player1Name, player2Name: s.player2Name,
          aiDifficulty: s.aiDifficulty, humanSide: s.humanSide
        });
        return;
      }
      const s = this.session;
      this.startGame(s.mode, {
        player1Name: s.player1Name, player2Name: s.player2Name, aiDifficulty: s.aiDifficulty
      });
    });
    on('#btn-end-record', () => {
      $('#game-end').classList.remove('is-open');
      this.openRecord(this.state === S.OPEN_END
        ? this.openGame.session.gameId
        : this.session.gameId);
    });
    on('#btn-end-home', () => this.goHome());

    on('#btn-replay-prev', () => this.replaySeek(this.replay.step - 1), { silent: true });
    on('#btn-replay-next', () => this.replaySeek(this.replay.step + 1), { silent: true });
    on('#btn-replay-play', () => this.replayToggle(), { silent: true });

    on('#btn-confirm-cancel', () => {
      this._confirmAction = null;
      $('#confirm').classList.remove('is-open');
    });
    on('#btn-confirm-ok', () => {
      const action = this._confirmAction;
      this._confirmAction = null;
      $('#confirm').classList.remove('is-open');
      action?.();
    });

    $$('[data-promotion]').forEach(button => {
      button.addEventListener('click', () => {
        sounds.tap();
        $('#promotion').classList.remove('is-open');
        if (this._promotionResolve) this._promotionResolve(button.dataset.promotion);
        this._promotionResolve = null;
      });
    });

    // Backdrop dismissal for dialogs that are safe to close.
    $$('.dialog').forEach(d => {
      d.addEventListener('click', (e) => {
        if (e.target !== d) return;
        if (d.dataset.dialog === 'mode') this.go(S.HOME);
        else if (d.dataset.dialog === 'names') this.go(S.MODE_SELECT);
        else if (d.dataset.dialog === 'library') this.goHome();
        else if (d.dataset.dialog === 'record') this.closeRecord();
      });
    });

    setLocale(getPrefs().language || 'en');
    localizeDom();
    $('#build-tag').textContent = BUILD.version;
    $('#learn-build').textContent = `${BUILD.version} · ${BUILD.date}`;
  }

  confirmPlayers() {
    const mode = this.pending.mode;
    const gameType = this.pending.gameType || GAME_TYPES.JUNQI;
    const isAi = mode === MODES.VS_AI;
    const p1 = ($('#input-p1').value || '').trim() || t(isAi ? 'players.you' : 'players.p1');
    const p2 = isAi ? t('players.computer') : (($('#input-p2').value || '').trim() || t('players.p2'));
    const difficulty = $('#field-difficulty .choice.is-selected')?.dataset.value || 'standard';

    savePrefs({ p1, p2: isAi ? getPrefs().p2 : p2, aiDifficulty: difficulty });
    if (gameType === GAME_TYPES.JUNQI) {
      this.startGame(mode, { player1Name: p1, player2Name: p2, aiDifficulty: difficulty });
      return;
    }
    const firstSide = firstSideOf(gameType);
    const secondSide = gameType === GAME_TYPES.GOMOKU ? 'w' : 'b';
    const humanSide = $('[data-side].is-selected')?.dataset.side === 'second' ? secondSide : firstSide;
    savePrefs(gameType === GAME_TYPES.XIANGQI
      ? { xiangqiSide: humanSide }
      : gameType === GAME_TYPES.GOMOKU
        ? { gomokuSide: humanSide }
        : { chessSide: humanSide });
    this.startOpenGame(gameType, {
      mode, player1Name: p1, player2Name: p2, aiDifficulty: difficulty, humanSide
    });
  }

  choosePromotion() {
    $('#promotion').classList.add('is-open');
    return new Promise(resolve => { this._promotionResolve = resolve; });
  }

  goHome() {
    $('#game-end').classList.remove('is-open');
    if (this.replay?.timer) clearInterval(this.replay.timer);
    if (this.replay?.view) this.replay.view.destroy();
    this.replay = null;
    this.leaveSession();
    delete $('#board-mount').dataset.openGame;
    this.go(S.HOME);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------------ */

function boot() {
  if (window.caesarApp) return;
  window.caesarApp = new App();
  window.CaesarDebug = { S, MODES, PIECE_TYPES };
  console.log(`[Caesar Games] ${BUILD.version} ready`);

  // Visual-audit hook. Only ever active with an explicit ?state= parameter,
  // so it costs nothing in normal use but keeps screenshot review repeatable.
  const wanted = new URLSearchParams(location.search).get('state');
  if (wanted) {
    import('../tests/states.js')
      .then(m => m.goto(wanted))
      .then(() => { window.__stateReady = true; })
      .catch(err => { window.__stateError = String(err); console.error('[state]', err); });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
