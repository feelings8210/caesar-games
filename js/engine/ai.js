/* Caesar Games — Information-Bounded Local AI Computer Opponent */
import { canPieceMove } from './rules.js';

export class LocalJunqiAI {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty; // 'easy' or 'normal'
  }

  selectMove(aiSide, boardState) {
    const legalMoves = this.getAllLegalMoves(aiSide, boardState);
    if (legalMoves.length === 0) return null;

    if (this.difficulty === 'easy') {
      const randIdx = Math.floor(Math.random() * legalMoves.length);
      return legalMoves[randIdx];
    }

    // Normal difficulty: score moves based strictly on public/legitimate information
    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      const score = this.evaluateMove(move, boardState, aiSide);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  getAllLegalMoves(aiSide, boardState) {
    const moves = [];
    Object.keys(boardState).forEach(fromKey => {
      const piece = boardState[fromKey];
      if (piece && piece.side === aiSide && !piece.static) {
        for (let r = 0; r < 12; r++) {
          for (let c = 0; c < 5; c++) {
            const toKey = `${r}-${c}`;
            const check = canPieceMove(piece, fromKey, toKey, boardState);
            if (check.allowed) {
              moves.push({ from: fromKey, to: toKey, piece: piece });
            }
          }
        }
      }
    });
    return moves;
  }

  evaluateMove(move, boardState, aiSide) {
    let score = 0;
    const targetPiece = boardState[move.to];
    const [tRow, tCol] = move.to.split('-').map(Number);
    const [fRow, fCol] = move.from.split('-').map(Number);

    // AI is Red (top half, wants to advance down towards rows 6-11)
    const advanceBonus = (aiSide === 'red') ? (tRow - fRow) * 2 : (fRow - tRow) * 2;
    score += advanceBonus;

    // Attacking an opponent piece
    if (targetPiece && targetPiece.side !== aiSide) {
      // If target piece identity was previously revealed publicly
      if (targetPiece.revealed) {
        if (move.piece.rank < targetPiece.rank) {
          score += 50; // Guaranteed win
        } else if (move.piece.rank === targetPiece.rank) {
          score += 20; // Equal rank trade
        } else {
          score -= 40; // Loss
        }
      } else {
        // Unrevealed piece: base aggressive exploration score for non-key AI pieces
        if (move.piece.name === '工兵' || move.piece.rank >= 6) {
          score += 15;
        } else if (move.piece.name === '司令' || move.piece.name === '军长') {
          score -= 10; // Protect high-ranking officers from unknown traps
        }
      }
    }

    // Moving into Campsite bonus (safety)
    const isCamp = ['1-1','1-3','2-2','3-1','3-3','7-1','7-3','8-2','9-1','9-3'].includes(move.to);
    if (isCamp) score += 8;

    return score;
  }
}
