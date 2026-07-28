/* Caesar Games — Local Game Library
 *
 * Everything lives in localStorage. No backend, no accounts, no cloud.
 * A game record is only ever written when a player actually starts a game;
 * simply opening the app must never create or evict anything.
 */

import { SCHEMA_VERSION } from './session.js';
import { getLocale, t, plural } from '../i18n/strings.js';

const LIBRARY_KEY = 'caesar_games_library';
const LIBRARY_BACKUP_KEY = 'caesar_games_library_last_good';
const LEGACY_KEYS = ['caesar_games_state'];
const PREFS_KEY = 'caesar_games_prefs';
export const MAX_SAVED_GAMES = 20;

const emptyLibrary = () => ({ schemaVersion: SCHEMA_VERSION, games: [] });
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

function normalizeRecord(record) {
  if (!isObject(record) || typeof record.gameId !== 'string' || !record.gameId ||
      typeof record.mode !== 'string' || !record.mode) return null;

  const gameType = record.gameType || 'junqi';
  if (!['junqi', 'xiangqi', 'chess'].includes(gameType)) return null;
  const validMode = gameType === 'junqi'
    ? ['vs_computer', 'classic', 'flip'].includes(record.mode)
    : ['vs_computer', 'two_player'].includes(record.mode);
  if (!validMode) return null;
  if (gameType === 'junqi' &&
      (!isObject(record.boardState) ||
       !Object.keys(record.boardState).length ||
       !Object.values(record.boardState).every(piece =>
         isObject(piece) && ['navy', 'red'].includes(piece.side) &&
         typeof piece.name === 'string'))) return null;
  if (gameType === 'xiangqi' &&
      (!isObject(record.serializedState) || !isObject(record.serializedState.board) ||
       !Object.keys(record.serializedState.board).length ||
       !Object.values(record.serializedState.board).every(piece =>
         isObject(piece) && ['r', 'b'].includes(piece.side) &&
         ['g', 'a', 'e', 'h', 'r', 'c', 's'].includes(piece.kind)))) return null;
  if (gameType === 'chess' &&
      (!isObject(record.serializedState) ||
       (typeof record.serializedState.fen !== 'string' &&
        !Array.isArray(record.serializedState.history)))) return null;

  try {
    const safe = JSON.parse(JSON.stringify(record));
    safe.gameType = gameType;
    safe.player1Name = String(safe.player1Name || safe.players?.[0] || 'Player 1');
    safe.player2Name = String(safe.player2Name || safe.players?.[1] || 'Player 2');
    safe.players = [safe.player1Name, safe.player2Name];
    safe.history = Array.isArray(safe.history) ? safe.history : [];
    safe.moveCount = Number.isFinite(safe.moveCount) ? safe.moveCount : safe.history.length;
    safe.status = safe.status === 'finished' ? 'finished' : 'in_progress';
    safe.startedAt = Number.isFinite(safe.startedAt) ? safe.startedAt : Date.now();
    safe.updatedAt = Number.isFinite(safe.updatedAt) ? safe.updatedAt : safe.startedAt;
    return safe;
  } catch {
    return null;
  }
}

function parseLibrary(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!isObject(parsed) || !Array.isArray(parsed.games)) {
    throw new Error('Invalid library shape');
  }
  return parsed;
}

function normalizeLibrary(lib) {
  const games = (lib?.games || []).map(normalizeRecord).filter(Boolean);
  return { schemaVersion: SCHEMA_VERSION, games };
}

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch { return null; }
}

/* ------------------------------------------------------------------ *
 * Preferences (names, sound, difficulty)
 * ------------------------------------------------------------------ */

export function getPrefs() {
  const s = storage();
  const fallback = {
    p1: '', p2: '', aiDifficulty: 'standard', language: 'en',
    xiangqiSide: 'r', chessSide: 'w'
  };
  if (!s) return fallback;
  try {
    const raw = s.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}

export function savePrefs(patch) {
  const s = storage();
  if (!s) return;
  try { s.setItem(PREFS_KEY, JSON.stringify({ ...getPrefs(), ...patch })); } catch { /* quota */ }
}

/* ------------------------------------------------------------------ *
 * Library
 * ------------------------------------------------------------------ */

export function getLibrary() {
  const s = storage();
  if (!s) return emptyLibrary();
  try {
    const raw = s.getItem(LIBRARY_KEY);
    if (!raw) return migrateLegacy(s);
    return normalizeLibrary(parseLibrary(raw));
  } catch (e) {
    console.warn('[library] primary unreadable, trying last-good copy', e);
    try {
      const backup = parseLibrary(s.getItem(LIBRARY_BACKUP_KEY));
      return backup ? normalizeLibrary(backup) : emptyLibrary();
    } catch (backupError) {
      console.warn('[library] last-good copy unreadable', backupError);
      return emptyLibrary();
    }
  }
}

function writeLibrary(lib) {
  const s = storage();
  const prepared = normalizeLibrary(lib);
  if (!s) return prepared;
  // Keep the newest MAX_SAVED_GAMES, preferring to retain unfinished games.
  prepared.games.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (prepared.games.length > MAX_SAVED_GAMES) {
    const keep = [];
    const overflow = [];
    for (const g of prepared.games) {
      if (keep.length < MAX_SAVED_GAMES) keep.push(g); else overflow.push(g);
    }
    // If we had to drop an unfinished game while a finished one survived,
    // swap so live games always win.
    for (const dropped of overflow) {
      if (dropped.status !== 'in_progress') continue;
      const idx = keep.map((g, i) => [g, i]).reverse().find(([g]) => g.status === 'finished')?.[1];
      if (idx !== undefined) keep[idx] = dropped;
    }
    prepared.games = keep;
  }
  let serialized;
  try { serialized = JSON.stringify(prepared); }
  catch (e) {
    console.warn('[library] serialization failed', e);
    return prepared;
  }
  try {
    // localStorage replaces one value atomically. Build and validate the whole
    // candidate first, then keep the same complete payload as last-good
    // recovery. A backup failure never invalidates the primary write.
    s.setItem(LIBRARY_KEY, serialized);
    try { s.setItem(LIBRARY_BACKUP_KEY, serialized); } catch { /* quota */ }
  }
  catch (e) { console.warn('[library] write failed', e); }
  return prepared;
}

function migrateLegacy(s) {
  const lib = emptyLibrary();
  for (const k of LEGACY_KEYS) {
    try {
      const raw = s.getItem(k);
      if (!raw) continue;
      const old = JSON.parse(raw);
      const board = old?.board || old?.boardState;
      if (!board) continue;
      lib.games.push({
        schemaVersion: SCHEMA_VERSION,
        gameId: `legacy_${k}`,
        gameType: 'junqi',
        mode: old.mode || 'vs_computer',
        player1Name: old.player1Name || 'Player 1',
        player2Name: old.player2Name || 'Player 2',
        aiDifficulty: old.aiDifficulty || 'standard',
        startedAt: old.timestamp || Date.now(),
        updatedAt: old.timestamp || Date.now(),
        completedAt: null,
        status: old.isGameOver ? 'finished' : 'in_progress',
        winner: old.winner || null,
        moveCount: (old.history || []).length,
        phase: old.phase || 'play',
        activeTurn: old.activeTurn || 'navy',
        boardState: board,
        assignedColors: old.assignedColors || { p1: null, p2: null },
        capturedPieces: old.captured || [],
        history: old.history || [],
        flagDisclosed: old.flagDisclosed || { navy: false, red: false },
        lastMove: null
      });
    } catch { /* ignore unreadable legacy blobs */ }
  }
  return lib.games.length ? writeLibrary(lib) : lib;
}

/** Insert or update one game. Never touches any other game. */
export function saveGame(record) {
  const safeRecord = normalizeRecord(record);
  if (!safeRecord) {
    console.warn('[library] refused malformed game record');
    return record;
  }
  const lib = getLibrary();
  const idx = lib.games.findIndex(g => g.gameId === safeRecord.gameId);
  if (idx === -1) lib.games.unshift(safeRecord); else lib.games[idx] = safeRecord;
  writeLibrary(lib);
  return record;
}

export function loadGame(gameId) {
  return getLibrary().games.find(g => g.gameId === gameId) || null;
}

export function deleteGame(gameId) {
  const lib = getLibrary();
  const before = lib.games.length;
  lib.games = lib.games.filter(g => g.gameId !== gameId);
  writeLibrary(lib);
  return lib.games.length < before;
}

/** The game "Continue" should reopen: most recently touched unfinished game. */
export function mostRecentResumable() {
  const live = getLibrary().games.filter(g => g.status === 'in_progress');
  if (!live.length) return null;
  live.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return live[0];
}

export function listGames() {
  const games = getLibrary().games.slice();
  games.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return games;
}

export function clearLibrary() {
  const s = storage();
  if (!s) return;
  s.removeItem(LIBRARY_KEY);
  s.removeItem(LIBRARY_BACKUP_KEY);
  LEGACY_KEYS.forEach(k => s.removeItem(k));
}

export function formatFriendlyDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const locale = getLocale() === 'zh' ? 'zh-CN' : 'en-US';
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `${t('date.today')} · ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `${t('date.yesterday')} · ${time}`;
  return `${d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} · ${time}`;
}

export function formatFamilyMemory(record) {
  if (!record) return '';
  const locale = getLocale() === 'zh' ? 'zh-CN' : 'en-US';
  const date = new Date(record.completedAt || record.updatedAt || record.startedAt);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = date.toLocaleDateString(locale, {
    year: 'numeric',
    month: getLocale() === 'zh' ? 'numeric' : 'short',
    day: 'numeric'
  });
  const players = `${record.player1Name || record.players?.[0] || 'Player 1'} ` +
    `${t('misc.vsSeparator')} ${record.player2Name || record.players?.[1] || 'Player 2'}`;
  return `${players} · ${plural('library.moves', record.moveCount || 0)} · ${formatted}`;
}
