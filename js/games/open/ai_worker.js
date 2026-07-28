import { chooseXiangqiMove } from '../xiangqi/ai.js';
import { chooseChessMove } from '../chess/ai.js';
import { chooseGomokuMove } from '../gomoku/ai.js';

self.onmessage = event => {
  const { id, gameType, serialized, difficulty } = event.data;
  try {
    const diagnostics = {};
    const move = gameType === 'xiangqi'
      ? chooseXiangqiMove(serialized, difficulty, diagnostics)
      : gameType === 'gomoku'
        ? chooseGomokuMove(serialized, difficulty, diagnostics)
        : chooseChessMove(serialized, difficulty, diagnostics);
    self.postMessage({ id, move, diagnostics });
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) });
  }
};
