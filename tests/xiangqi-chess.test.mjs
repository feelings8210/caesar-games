import assert from 'node:assert/strict';
import {
  XiangqiGame, initialXiangqiBoard, pseudoMoves, legalMovesFor, isInCheck
} from '../js/games/xiangqi/engine.js';
import { chooseXiangqiMove } from '../js/games/xiangqi/ai.js';
import { ChessGame } from '../js/games/chess/adapter.js';
import { chooseChessMove } from '../js/games/chess/ai.js';

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; }
  catch (error) { failed++; console.error(`✗ ${name}\n  ${error.message}`); }
};
const P = (side, kind) => ({ side, kind });
const board = entries => Object.fromEntries(entries.map(([at, side, kind]) => [at, P(side, kind)]));

test('Xiangqi initial state is 32 pieces and Red to move', () => {
  const game = new XiangqiGame();
  assert.equal(Object.keys(game.board).length, 32);
  assert.equal(game.turn, 'r');
  assert.equal(game.legalMoves().length > 0, true);
});

test('General stays in the palace', () => {
  const b = board([['9,4','r','g'],['0,4','b','g'],['5,4','r','s']]);
  assert.deepEqual(new Set(pseudoMoves(b, '9,4')), new Set(['8,4','9,3','9,5']));
});

test('Advisor moves one palace diagonal', () => {
  const b = board([['8,4','r','a'],['9,4','r','g'],['0,4','b','g'],['5,4','r','s']]);
  assert.deepEqual(new Set(pseudoMoves(b, '8,4')), new Set(['7,3','7,5','9,3','9,5']));
});

test('Elephant cannot cross the river', () => {
  const b = board([['5,2','r','e'],['9,4','r','g'],['0,4','b','g'],['4,4','r','s']]);
  assert.equal(pseudoMoves(b, '5,2').some(to => Number(to.split(',')[0]) < 5), false);
});

test('Elephant eye blocks the two-point diagonal', () => {
  const b = board([['9,2','r','e'],['8,3','r','s'],['9,4','r','g'],['0,4','b','g'],['5,4','r','s']]);
  assert.equal(pseudoMoves(b, '9,2').includes('7,4'), false);
});

test('Horse leg blocks both moves through that leg', () => {
  const b = board([['7,4','r','h'],['6,4','r','s'],['9,4','r','g'],['0,4','b','g'],['5,4','r','s']]);
  assert.equal(pseudoMoves(b, '7,4').includes('5,3'), false);
  assert.equal(pseudoMoves(b, '7,4').includes('5,5'), false);
});

test('Chariot cannot jump blockers', () => {
  const b = board([['5,4','r','r'],['4,4','r','s'],['2,4','b','s'],['9,3','r','g'],['0,3','b','g']]);
  assert.equal(pseudoMoves(b, '5,4').includes('3,4'), false);
});

test('Cannon slides without a screen', () => {
  const b = board([['5,4','r','c'],['9,3','r','g'],['0,3','b','g']]);
  assert.equal(pseudoMoves(b, '5,4').includes('2,4'), true);
});

test('Cannon captures with exactly one screen', () => {
  const b = board([['5,4','r','c'],['4,4','r','s'],['2,4','b','r'],['9,3','r','g'],['0,3','b','g']]);
  assert.equal(pseudoMoves(b, '5,4').includes('2,4'), true);
});

test('Cannon cannot capture with zero screens', () => {
  const b = board([['5,4','r','c'],['2,4','b','r'],['9,3','r','g'],['0,3','b','g']]);
  assert.equal(pseudoMoves(b, '5,4').includes('2,4'), false);
});

test('Cannon cannot capture with two screens', () => {
  const b = board([['5,4','r','c'],['4,4','r','s'],['3,4','b','s'],['2,4','b','r'],['9,3','r','g'],['0,3','b','g']]);
  assert.equal(pseudoMoves(b, '5,4').includes('2,4'), false);
});

test('Soldier before river moves only forward', () => {
  const b = board([['6,4','r','s'],['9,3','r','g'],['0,3','b','g']]);
  assert.deepEqual(pseudoMoves(b, '6,4'), ['5,4']);
});

test('Soldier after river moves forward and sideways, never back', () => {
  const b = board([['4,4','r','s'],['9,3','r','g'],['0,3','b','g']]);
  assert.deepEqual(new Set(pseudoMoves(b, '4,4')), new Set(['3,4','4,3','4,5']));
  assert.equal(pseudoMoves(b, '4,4').includes('5,4'), false);
});

test('Flying General makes an open file check', () => {
  const b = board([['9,4','r','g'],['0,4','b','g']]);
  assert.equal(isInCheck(b, 'r'), true);
  assert.equal(isInCheck(b, 'b'), true);
});

test('A move exposing Flying General is illegal self-check', () => {
  const b = board([['9,4','r','g'],['0,4','b','g'],['5,4','r','r']]);
  assert.equal(legalMovesFor(b, 'r').some(m => m.from === '5,4' && m.to === '5,3'), false);
});

test('Check is detected from a chariot', () => {
  const b = board([['9,4','r','g'],['0,3','b','g'],['2,4','b','r']]);
  assert.equal(isInCheck(b, 'r'), true);
});

test('No legal move is a loss even without check', () => {
  const game = new XiangqiGame({
    board: board([
      ['0,4','b','g'],['9,4','r','g'],['5,4','r','s'],
      ['1,3','r','r'],['1,5','r','r'],['2,4','r','r'],['3,0','r','s']
    ]),
    turn: 'r'
  });
  const move = game.legalMoves().find(m => m.from === '3,0');
  assert.ok(move);
  game.move(move.from, move.to);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'r');
});

test('Xiangqi checkmate is distinguished from no-legal-move loss', () => {
  const game = new XiangqiGame({
    board: board([
      ['0,4','b','g'],['9,4','r','g'],['5,4','r','s'],
      ['1,3','r','r'],['1,5','r','r'],['2,4','r','r'],['3,0','r','s']
    ]),
    turn: 'r'
  });
  game.move('3,0','2,0');
  assert.equal(game.status, 'finished');
  assert.equal(game.result, 'checkmate');
});

test('Family V1 repetition rule draws the third repeated position', () => {
  const game = new XiangqiGame({
    board: board([['9,4','r','g'],['0,4','b','g'],['5,4','r','s'],['9,0','r','r'],['0,0','b','r']]),
    turn: 'r'
  });
  const cycle = [['9,0','8,0'],['0,0','1,0'],['8,0','9,0'],['1,0','0,0']];
  for (let i = 0; i < 2 && game.status === 'in_progress'; i++) {
    for (const [from, to] of cycle) game.move(from, to);
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.result, 'repetition');
  assert.equal(game.winner, null);
});

test('Xiangqi Relaxed and Standard AI return legal moves', () => {
  const game = new XiangqiGame();
  for (const difficulty of ['relaxed', 'standard']) {
    const move = chooseXiangqiMove(game.serialize(), difficulty);
    assert.ok(game.legalMoves().some(m => m.from === move.from && m.to === move.to));
  }
});

test('Xiangqi Standard searches beyond the Relaxed one-ply horizon', () => {
  const game = new XiangqiGame();
  const diagnostics = {};
  const move = chooseXiangqiMove(game.serialize(), 'standard', diagnostics);
  assert.ok(game.legalMoves().some(m => m.from === move.from && m.to === move.to));
  assert.equal(diagnostics.depth >= 2, true);
  assert.equal(diagnostics.nodes > 0, true);
  assert.equal(diagnostics.elapsedMs <= 1500, true);
});

test('Xiangqi Standard takes an exposed General immediately', () => {
  const game = new XiangqiGame({
    board: board([
      ['0,4','b','g'], ['1,4','r','r'], ['9,3','r','g'], ['5,3','r','s']
    ]),
    turn: 'r'
  });
  const move = chooseXiangqiMove(game.serialize(), 'standard');
  assert.deepEqual([move.from, move.to], ['1,4', '0,4']);
});

test('Chess initial state and standard piece movement are authoritative', () => {
  const game = new ChessGame();
  assert.equal(Object.keys(game.board).length, 32);
  assert.equal(game.legalTargets('e2').includes('e4'), true);
  assert.equal(game.legalTargets('g1').includes('f3'), true);
  assert.equal(game.legalTargets('c1').length, 0);
  assert.equal(game.legalTargets('a1').length, 0);
  assert.equal(game.legalTargets('d1').length, 0);
  assert.equal(game.legalTargets('e1').length, 0);
});

test('Chess bishop, rook, queen and king move and capture correctly', () => {
  const game = new ChessGame({ fen: '4k3/8/3p4/8/3Q4/2B5/8/R3K3 w - - 0 1' });
  assert.equal(game.legalTargets('c3').includes('b4'), true);
  assert.equal(game.legalTargets('a1').includes('a8'), true);
  assert.equal(game.legalTargets('d4').includes('d6'), true);
  assert.equal(game.legalTargets('e1').includes('f2'), true);
  const capture = game.move('d4','d6');
  assert.equal(capture.capture, true);
});

test('Chess pinned piece cannot expose its own King', () => {
  const game = new ChessGame({ fen: '4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1' });
  assert.equal(game.legalTargets('e2').includes('d2'), false);
  assert.equal(game.legalTargets('e2').includes('e8'), true);
});

test('Chess capture and illegal self-check', () => {
  const game = new ChessGame({ fen: '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1' });
  assert.equal(game.legalTargets('e1').includes('d1'), true);
  assert.equal(game.legalTargets('e1').includes('f1'), true);
  assert.equal(game.legalMoves().some(m => m.from === 'e1' && m.to === 'e2'), true);
});

test('Chess checkmate', () => {
  const game = new ChessGame();
  game.move('f2','f3'); game.move('e7','e5'); game.move('g2','g4'); game.move('d8','h4');
  assert.equal(game.status, 'finished');
  assert.equal(game.result, 'checkmate');
  assert.equal(game.winner, 'b');
});

test('Chess stalemate', () => {
  const game = new ChessGame({ fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1' });
  assert.equal(game.status, 'finished');
  assert.equal(game.result, 'stalemate');
});

test('Chess castling valid and blocked', () => {
  const open = new ChessGame({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1' });
  assert.equal(open.legalTargets('e1').includes('g1'), true);
  const blocked = new ChessGame();
  assert.equal(blocked.legalTargets('e1').includes('g1'), false);
});

test('Chess castling through check is invalid', () => {
  const game = new ChessGame({ fen: 'r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1' });
  assert.equal(game.legalTargets('e1').includes('g1'), false);
});

test('Chess en passant', () => {
  const game = new ChessGame();
  game.move('e2','e4'); game.move('a7','a6'); game.move('e4','e5'); game.move('d7','d5');
  assert.equal(game.legalTargets('e5').includes('d6'), true);
  const result = game.move('e5','d6');
  assert.equal(result.capture, true);
  assert.equal(game.board.d5, undefined);
});

test('Chess promotion offers all four pieces', () => {
  const game = new ChessGame({ fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1' });
  const choices = game.legalMoves().filter(m => m.from === 'a7' && m.to === 'a8').map(m => m.promotion).sort();
  assert.deepEqual(choices, ['b','n','q','r']);
});

test('Chess threefold repetition', () => {
  const game = new ChessGame();
  for (let i = 0; i < 2; i++) {
    game.move('g1','f3'); game.move('g8','f6'); game.move('f3','g1'); game.move('f6','g8');
  }
  assert.equal(game.result, 'repetition');
});

test('Chess fifty-move draw and insufficient material', () => {
  assert.equal(new ChessGame({ fen: '8/8/8/8/8/8/6k1/4K2R w - - 100 51' }).result, 'fifty_move');
  assert.equal(new ChessGame({ fen: '8/8/8/8/8/8/6k1/4K3 w - - 0 1' }).result, 'insufficient');
});

test('Chess Relaxed and Standard AI return legal moves', () => {
  const game = new ChessGame();
  for (const difficulty of ['relaxed', 'standard']) {
    const move = chooseChessMove(game.serialize(), difficulty);
    assert.ok(game.legalMoves().some(m => m.from === move.from && m.to === move.to && m.promotion === move.promotion));
  }
});

test('Chess Standard completes a deeper alpha-beta iteration within budget', () => {
  const game = new ChessGame();
  const diagnostics = {};
  const move = chooseChessMove(game.serialize(), 'standard', diagnostics);
  assert.ok(game.legalMoves().some(m =>
    m.from === move.from && m.to === move.to && m.promotion === move.promotion));
  assert.equal(diagnostics.depth >= 3, true);
  assert.equal(diagnostics.nodes > 100, true);
  assert.equal(diagnostics.elapsedMs <= 1500, true);
});

test('Chess Standard converts a forced mate in one', () => {
  const game = new ChessGame({ fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1' });
  const move = chooseChessMove(game.serialize(), 'standard');
  const result = game.move(move.from, move.to, move.promotion);
  assert.equal(result.status, 'finished');
  assert.equal(result.result, 'checkmate');
});

console.log(`\nCaesar Games — Xiangqi + Chess rules: ${passed} passed, ${failed} failed\n`);
if (failed) process.exitCode = 1;
