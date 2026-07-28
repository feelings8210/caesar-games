/* Caesar Games — Multi-Game Local Library & State Persistence (Schema V2) */

const V1_SAVE_KEY = 'caesar_games_state';
const LIBRARY_KEY = 'caesar_games_library';
const CURRENT_SCHEMA_VERSION = 2;
const MAX_SAVED_GAMES = 20;

function getStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getLastUsedNames() {
  const lib = getLibrary();
  return lib.lastUsedNames || { p1: 'Caesar', p2: 'Daddy', human: 'Caesar' };
}

export function saveLastUsedNames(names) {
  const lib = getLibrary();
  lib.lastUsedNames = { ...lib.lastUsedNames, ...names };
  saveLibrary(lib);
}

export function getLibrary() {
  const storage = getStorage();
  if (!storage) return { schemaVersion: CURRENT_SCHEMA_VERSION, lastUsedNames: { p1: 'Caesar', p2: 'Daddy', human: 'Caesar' }, games: [] };

  try {
    const raw = storage.getItem(LIBRARY_KEY);
    let lib = raw ? JSON.parse(raw) : null;

    if (!lib) {
      lib = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        lastUsedNames: { p1: 'Caesar', p2: 'Daddy', human: 'Caesar' },
        games: []
      };
      // Check if legacy V1 single save exists to migrate seamlessly
      lib = migrateV1Save(storage, lib);
      saveLibrary(lib);
    }

    return lib;
  } catch (e) {
    console.error('Error reading game library:', e);
    return { schemaVersion: CURRENT_SCHEMA_VERSION, lastUsedNames: { p1: 'Caesar', p2: 'Daddy', human: 'Caesar' }, games: [] };
  }
}

function saveLibrary(lib) {
  const storage = getStorage();
  if (!storage) return;

  try {
    // Keep at most 20 games, sorted by updatedAt descending
    if (lib.games && lib.games.length > MAX_SAVED_GAMES) {
      lib.games.sort((a, b) => b.updatedAt - a.updatedAt);
      lib.games = lib.games.slice(0, MAX_SAVED_GAMES);
    }
    storage.setItem(LIBRARY_KEY, JSON.stringify(lib));
  } catch (e) {
    console.error('Failed to write game library to storage:', e);
  }
}

function migrateV1Save(storage, lib) {
  try {
    const v1Raw = storage.getItem(V1_SAVE_KEY);
    if (!v1Raw) return lib;

    const v1State = JSON.parse(v1Raw);
    if (!v1State || !v1State.board) return lib;

    const migratedGame = {
      gameId: 'game_legacy_v1',
      mode: v1State.mode || 'vs_computer',
      privacyMode: v1State.privacy || 'standard',
      player1Name: 'Caesar',
      player2Name: v1State.mode === 'vs_computer' ? 'Computer' : 'Daddy',
      humanName: 'Caesar',
      aiDifficulty: v1State.aiDifficulty || 'standard',
      startedAt: v1State.timestamp || Date.now(),
      updatedAt: v1State.timestamp || Date.now(),
      completedAt: v1State.isGameOver ? (v1State.timestamp || Date.now()) : null,
      moveCount: (v1State.history || []).length,
      status: v1State.isGameOver ? 'Finished' : 'In Progress',
      winner: v1State.winner || null,
      activeTurn: v1State.activeTurn || 'navy',
      phase: v1State.phase || 'gameplay',
      setupStep: v1State.setupStep || 'navy',
      boardState: v1State.board,
      assignedColors: v1State.assignedColors || { p1: 'navy', p2: 'red' },
      capturedPieces: v1State.captured || [],
      turnHistory: v1State.history || [],
      flagDisclosed: v1State.flagDisclosed || { navy: false, red: false },
      lastMoveRecap: v1State.lastMoveRecap || null
    };

    lib.games.push(migratedGame);
    return lib;
  } catch (e) {
    console.error('V1 Migration failed:', e);
    return lib;
  }
}

export function saveActiveGame(state) {
  const lib = getLibrary();
  const gameId = state.gameId || `game_${Date.now()}`;
  const now = Date.now();

  const existingIdx = lib.games.findIndex(g => g.gameId === gameId);
  const gameRecord = {
    gameId: gameId,
    mode: state.gameMode || 'vs_computer',
    privacyMode: state.privacyMode || 'standard',
    player1Name: state.player1Name || 'Caesar',
    player2Name: state.player2Name || (state.gameMode === 'vs_computer' ? 'Computer' : 'Daddy'),
    humanName: state.humanName || 'Caesar',
    aiDifficulty: state.aiDifficulty || 'standard',
    startedAt: existingIdx !== -1 ? lib.games[existingIdx].startedAt : now,
    updatedAt: now,
    completedAt: state.isGameOver ? now : null,
    moveCount: (state.turnHistory || []).length,
    status: state.isGameOver ? 'Finished' : 'In Progress',
    winner: state.winner || null,
    activeTurn: state.activeTurn || 'navy',
    phase: state.phase || 'gameplay',
    setupStep: state.setupStep || 'navy',
    boardState: state.boardState || {},
    assignedColors: state.assignedColors || { p1: 'navy', p2: 'red' },
    capturedPieces: state.capturedPieces || [],
    turnHistory: state.turnHistory || [],
    flagDisclosed: state.flagDisclosed || { navy: false, red: false },
    lastMoveRecap: state.lastMoveRecap || null
  };

  if (existingIdx !== -1) {
    lib.games[existingIdx] = gameRecord;
  } else {
    lib.games.unshift(gameRecord);
  }

  // Update last used names
  lib.lastUsedNames = {
    p1: gameRecord.player1Name,
    p2: gameRecord.player2Name,
    human: gameRecord.humanName
  };

  saveLibrary(lib);
  return gameRecord;
}

export function getMostRecentActiveGame() {
  const lib = getLibrary();
  const activeGames = lib.games.filter(g => g.status === 'In Progress');
  if (activeGames.length === 0) return null;
  activeGames.sort((a, b) => b.updatedAt - a.updatedAt);
  return activeGames[0];
}

export function loadGameById(gameId) {
  const lib = getLibrary();
  return lib.games.find(g => g.gameId === gameId) || null;
}

export function deleteGameById(gameId) {
  const lib = getLibrary();
  lib.games = lib.games.filter(g => g.gameId !== gameId);
  saveLibrary(lib);
  return true;
}

export function hasSavedGames() {
  const lib = getLibrary();
  return lib.games && lib.games.length > 0;
}

export function formatFriendlyDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today · ${timeStr}`;
  if (isYesterday) return `Yesterday · ${timeStr}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()} · ${timeStr}`;
}

// Legacy compatibility exports
export function saveGameState(state) {
  return saveActiveGame(state);
}

export function loadGameState() {
  const recent = getMostRecentActiveGame();
  if (!recent) return null;
  return {
    mode: recent.mode,
    privacy: recent.privacyMode,
    activeTurn: recent.activeTurn,
    board: recent.boardState,
    assignedColors: recent.assignedColors,
    captured: recent.capturedPieces,
    history: recent.turnHistory,
    aiDifficulty: recent.aiDifficulty,
    isGameOver: recent.status === 'Finished',
    winner: recent.winner,
    phase: recent.phase,
    setupStep: recent.setupStep,
    flagDisclosed: recent.flagDisclosed,
    lastMoveRecap: recent.lastMoveRecap
  };
}

export function clearGameState() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(LIBRARY_KEY);
    storage.removeItem(V1_SAVE_KEY);
  }
}

export function hasSavedGame() {
  return !!getMostRecentActiveGame();
}
