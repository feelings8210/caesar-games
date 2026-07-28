/* Caesar Games — Information-Bounded Local AI Computer Opponent */
import { canPieceMove } from './rules.js';

export function createAiObservation(aiSide, boardState) {
  const obs = {};
  Object.keys(boardState).forEach(k => {
    const p = boardState[k];
    if (!p) return;

    if (p.side === aiSide || p.revealed || p.flagDisclosed) {
      obs[k] = { ...p };
    } else {
      // Redact private identity (name & rank) for unrevealed opponent pieces
      obs[k] = {
        id: p.id,
        side: p.side,
        static: false,
        revealed: false
      };
    }
  });
  return obs;
}

export class LocalJunqiAI {
  constructor(difficulty = 'standard') {
    // Supported V1 difficulty levels: 'relaxed' or 'standard'
    this.difficulty = (difficulty === 'relaxed' || difficulty === 'easy') ? 'relaxed' : 'standard';
  }

  selectMove(aiSide, rawBoardState) {
    // Enforce Information Boundary: AI only observes legitimate public state
    const obsBoard = createAiObservation(aiSide, rawBoardState);

    const legalMoves = this.getAllLegalMoves(aiSide, obsBoard);
    if (legalMoves.length === 0) return null;

    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      let score = this.evaluateMove(move, obsBoard, aiSide);

      // Relaxed difficulty adds subtle evaluation noise / variance for casual play
      if (this.difficulty === 'relaxed') {
        score += (Math.random() - 0.5) * 15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  getAllLegalMoves(aiSide, obsBoard) {
    const moves = [];
    Object.keys(obsBoard).forEach(fromKey => {
      const piece = obsBoard[fromKey];
      if (piece && piece.side === aiSide && !piece.static) {
        for (let r = 0; r < 12; r++) {
          for (let c = 0; c < 5; c++) {
            const toKey = `${r}-${c}`;
            const check = canPieceMove(piece, fromKey, toKey, obsBoard);
            if (check.allowed) {
              moves.push({ from: fromKey, to: toKey, piece: piece });
            }
          }
        }
      }
    });
    return moves;
  }

  evaluateMove(move, obsBoard, aiSide) {
    let score = 0;
    const targetPiece = obsBoard[move.to];
    const [tRow, tCol] = move.to.split('-').map(Number);
    const [fRow, fCol] = move.from.split('-').map(Number);

    // Advancing towards opponent territory
    const advanceBonus = (aiSide === 'red') ? (tRow - fRow) * 2 : (fRow - tRow) * 2;
    score += advanceBonus;

    // Attacking an opponent piece
    if (targetPiece && targetPiece.side !== aiSide) {
      if (targetPiece.revealed) {
        if (move.piece.rank < targetPiece.rank) {
          score += 50; // Guaranteed win
        } else if (move.piece.rank === targetPiece.rank) {
          score += 20; // Equal rank trade
        } else {
          score -= 40; // Defeat
        }
      } else if (targetPiece.flagDisclosed && targetPiece.name === '军旗') {
        score += 200; // Winning move: capture disclosed flag!
      } else {
        // Unrevealed piece: conservative exploration
        if (move.piece.name === '工兵' || move.piece.rank >= 6) {
          score += 15;
        } else if (move.piece.name === '司令' || move.piece.name === '军长') {
          score -= 10; // Protect high-ranking officers
        }
      }
    }

    // Moving into Campsite (safety)
    const isCamp = ['1-1','1-3','2-2','3-1','3-3','7-1','7-3','8-2','9-1','9-3'].includes(move.to);
    if (isCamp) score += 8;

    return score;
  }
}
