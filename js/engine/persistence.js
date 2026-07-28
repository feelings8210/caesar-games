/* Caesar Games — Local Game Library
 *
 * Everything lives in localStorage. No backend, no accounts, no cloud.
 * A game record is only ever written when a player actually starts a game;
 * simply opening the app must never create or evict anything.
 */

import { SCHEMA_VERSION } from './session.js';
import { getLocale, t } from '../i18n/strings.js';

const LIBRARY_KEY = 'caesar_games_library';
const LEGACY_KEYS = ['caesar_games_state'];
const PREFS_KEY = 'caesar_games_prefs';
export const MAX_SAVED_GAMES = 20;

const emptyLibrary = () => ({ schemaVersion: SCHEMA_VERSION, games: [] });

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
    const lib = JSON.parse(raw);
    if (!lib || !Array.isArray(lib.games)) return emptyLibrary();
    // Drop anything structurally unusable rather than crashing on it.
    lib.games = lib.games
      .filter(g => g && g.gameId && g.mode && (g.boardState || g.serializedState))
      .map(g => ({
        ...g,
        gameType: g.gameType || 'junqi',
        players: g.players || [g.player1Name || 'Player 1', g.player2Name || 'Player 2']
      }));
    lib.schemaVersion = SCHEMA_VERSION;
    return lib;
  } catch (e) {
    console.warn('[library] unreadable, starting fresh', e);
    return emptyLibrary();
  }
}

function writeLibrary(lib) {
  const s = storage();
  if (!s) return lib;
  // Keep the newest MAX_SAVED_GAMES, preferring to retain unfinished games.
  lib.games.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (lib.games.length > MAX_SAVED_GAMES) {
    const keep = [];
    const overflow = [];
    for (const g of lib.games) {
      if (keep.length < MAX_SAVED_GAMES) keep.push(g); else overflow.push(g);
    }
    // If we had to drop an unfinished game while a finished one survived,
    // swap so live games always win.
    for (const dropped of overflow) {
      if (dropped.status !== 'in_progress') continue;
      const idx = keep.map((g, i) => [g, i]).reverse().find(([g]) => g.status === 'finished')?.[1];
      if (idx !== undefined) keep[idx] = dropped;
    }
    lib.games = keep;
  }
  try { s.setItem(LIBRARY_KEY, JSON.stringify(lib)); }
  catch (e) { console.warn('[library] write failed', e); }
  return lib;
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
  const lib = getLibrary();
  const idx = lib.games.findIndex(g => g.gameId === record.gameId);
  if (idx === -1) lib.games.unshift(record); else lib.games[idx] = record;
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
