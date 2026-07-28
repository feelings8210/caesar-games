import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  GomokuGame, GOMOKU_SIZE, GOMOKU_RULES_VERSION
} from '../js/games/gomoku/engine.js';
import { chooseGomokuMove } from '../js/games/gomoku/ai.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

test('documented board and rules version', () => {
  assert.equal(GOMOKU_SIZE, 15);
  assert.equal(GOMOKU_RULES_VERSION, 'gomoku-freestyle-15-v1');
  assert.equal(new GomokuGame().legalMoves().length, 225);
});

test('Black starts and turns alternate', () => {
  const game = new GomokuGame();
  assert.equal(game.turn, 'b');
  assert.equal(game.move(null, '7,7').ok, true);
  assert.equal(game.board['7,7'].side, 'b');
  assert.equal(game.turn, 'w');
});

test('occupied and out-of-board placements are rejected', () => {
  const game = new GomokuGame();
  game.move(null, '7,7');
  assert.equal(game.move(null, '7,7').ok, false);
  assert.equal(game.move(null, '15,0').ok, false);
  assert.equal(game.history.length, 1);
});

for (const [name, black] of [
  ['horizontal', ['4,3', '4,4', '4,5', '4,6', '4,7']],
  ['vertical', ['3,8', '4,8', '5,8', '6,8', '7,8']],
  ['diagonal down', ['2,2', '3,3', '4,4', '5,5', '6,6']],
  ['diagonal up', ['10,2', '9,3', '8,4', '7,5', '6,6']]
]) {
  test(`${name} five wins`, () => {
    const game = new GomokuGame();
    black.forEach((key, i) => {
      assert.equal(game.move(null, key).ok, true);
      if (i < black.length - 1) assert.equal(game.move(null, `14,${i}`).ok, true);
    });
    assert.equal(game.status, 'finished');
    assert.equal(game.winner, 'b');
    assert.equal(game.result, 'five');
  });
}

test('overline wins in freestyle rules', () => {
  const board = {};
  for (let col = 2; col < 7; col++) board[`5,${col}`] = { side: 'b', kind: 'stone' };
  const game = new GomokuGame({ board, turn: 'b' });
  game.move(null, '5,7');
  assert.equal(game.result, 'five');
});

test('serialization restores canonical state', () => {
  const game = new GomokuGame();
  game.move(null, '7,7');
  game.move(null, '7,8');
  assert.deepEqual(new GomokuGame(game.serialize()).serialize(), game.serialize());
});

test('Standard opens in the center', () => {
  assert.deepEqual(chooseGomokuMove(new GomokuGame().serialize(), 'standard'), {
    from: null, to: '7,7'
  });
});

test('Standard takes an immediate win', () => {
  const board = {};
  for (let col = 3; col < 7; col++) board[`7,${col}`] = { side: 'b', kind: 'stone' };
  const move = chooseGomokuMove(new GomokuGame({ board, turn: 'b' }).serialize(), 'standard');
  assert.ok(['7,2', '7,7'].includes(move.to));
});

test('Standard blocks an immediate loss', () => {
  const board = { '7,2': { side: 'b', kind: 'stone' } };
  for (let col = 3; col < 7; col++) board[`7,${col}`] = { side: 'w', kind: 'stone' };
  const move = chooseGomokuMove(new GomokuGame({ board, turn: 'b' }).serialize(), 'standard');
  assert.equal(move.to, '7,7');
});

test('both AI modes stay legal and bounded', () => {
  const game = new GomokuGame();
  for (let i = 0; i < 24; i++) {
    const legal = new Set(game.legalMoves().map(move => move.to));
    const difficulty = i % 2 ? 'relaxed' : 'standard';
    const started = performance.now();
    const move = chooseGomokuMove(game.serialize(), difficulty);
    assert.ok(performance.now() - started < 500);
    assert.ok(legal.has(move.to));
    game.move(null, move.to);
    if (game.status === 'finished') break;
  }
});

test('resignation is terminal, persisted and stops AI', () => {
  const game = new GomokuGame();
  game.move(null, '7,7');
  const result = game.resign('w');
  assert.equal(result.ok, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'b');
  assert.equal(game.result, 'resignation');
  const resumed = new GomokuGame(game.serialize());
  assert.equal(resumed.result, 'resignation');
  assert.equal(chooseGomokuMove(resumed.serialize(), 'standard'), null);
});

console.log(`Caesar Games — Gomoku rules & AI: ${passed} passed, 0 failed`);
