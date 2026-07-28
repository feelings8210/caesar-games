/* Caesar Games — State Persistence Manager (Dual LocalStorage + Native App Bridge) */

const SAVE_KEY = 'caesar_games_state';

export function saveGameState(state) {
  try {
    const serialized = JSON.stringify({
      mode: state.gameMode,             // 'vs_computer', 'classic', 'flip'
      seating: state.seatingMode,         // 'side_by_side', 'face_to_face'
      privacy: state.privacyMode,         // 'standard', 'extra_privacy'
      activeTurn: state.activeTurn,       // 'navy', 'red'
      board: state.boardState,
      assignedColors: state.assignedColors, // { p1: 'navy', p2: 'red' }
      captured: state.capturedPieces || [],
      history: state.turnHistory || [],
      aiDifficulty: state.aiDifficulty || 'normal',
      isGameOver: !!state.isGameOver,
      winner: state.winner || null,
      lastBattle: state.lastBattle || null,
      timestamp: Date.now()
    });
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVE_KEY, serialized);
    }

    // Sync to Native App-Owned UserDefaults Bridge if running inside iOS Native Container
    if (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.caesarNativeStore) {
      window.webkit.messageHandlers.caesarNativeStore.postMessage({
        action: 'saveState',
        data: serialized
      });
    }

    return true;
  } catch (e) {
    console.error('Failed to save game state:', e);
    return false;
  }
}

export function loadGameState() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load game state:', e);
    return null;
  }
}

export function clearGameState() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SAVE_KEY);
  }
}

export function hasSavedGame() {
  const saved = loadGameState();
  return saved && !saved.isGameOver && saved.board && Object.keys(saved.board).length > 0;
}
