/* Caesar Games — rules & session tests
 *
 * These are written FROM docs/JUNQI_V1_RULESET.md, not from the implementation.
 * Where a test encodes a rule the document does not state explicitly, the rule
 * is named in the test title so it can be argued with.
 *
 * Run: node tests/rules.test.mjs
 */

import {
  PIECE_TYPES, CAMPS, HEADQUARTERS, RAILWAYS, COMBAT,
  createStandardArmy, generateLegalSetup, canPieceMove, resolveCombat,
  validatePiecePlacementInSetup, validateFormation, legalMovesFor,
  isRoadAdjacent, key, hqKeysOf, homeRowsOf, frontRowOf, setupSlotsOf
} from '../js/engine/rules.js';
import { GameSession, MODES, PHASES, isPieceVisibleTo, viewerSeatOf, boardOrientationOf } from '../js/engine/session.js';
import { createAiObservation, LocalJunqiAI } from '../js/engine/ai.js';
import { displayPos } from '../js/ui/board_view.js';

let pass = 0, fail = 0;
const failures = [];

function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(`${name}\n      ${e.message}`); }
}
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, m = '') => { if (!v) throw new Error(m || 'expected truthy'); };
const no = (v, m = '') => { if (v) throw new Error(m || 'expected falsy'); };

const piece = (side, name, over = {}) => ({
  id: `${side}-${name}-x`, side, name,
  rank: Object.values(PIECE_TYPES).find(p => p.name === name).rank,
  static: !!Object.values(PIECE_TYPES).find(p => p.name === name).static,
  revealed: false, ...over
});

/* ================================================================== *
 * 1. Inventory
 * ================================================================== */

t('army has exactly 25 pieces', () => eq(createStandardArmy('navy').length, 25));

t('inventory matches the ruleset table', () => {
  const army = createStandardArmy('navy');
  const count = n => army.filter(p => p.name === n).length;
  eq(count('司令'), 1, 'Field Marshal');
  eq(count('军长'), 1, 'Corps Commander');
  eq(count('师长'), 2, 'Division');
  eq(count('旅长'), 2, 'Brigade');
  eq(count('团长'), 2, 'Regiment');
  eq(count('营长'), 2, 'Battalion');
  eq(count('连长'), 3, 'Company');
  eq(count('排长'), 3, 'Platoon');
  eq(count('工兵'), 3, 'Engineer');
  eq(count('地雷'), 3, 'Mine');
  eq(count('炸弹'), 2, 'Bomb');
  eq(count('军旗'), 1, 'Flag');
});

t('rank order runs Field Marshal (1) down to Engineer (9)', () => {
  const order = ['司令', '军长', '师长', '旅长', '团长', '营长', '连长', '排长', '工兵'];
  const ranks = order.map(n => Object.values(PIECE_TYPES).find(p => p.name === n).rank);
  for (let i = 1; i < ranks.length; i++) ok(ranks[i] > ranks[i - 1], `${order[i]} must outrank-number ${order[i - 1]}`);
});

t('mines and flags are static', () => {
  ok(PIECE_TYPES.MINE.static);
  ok(PIECE_TYPES.FLAG.static);
});

/* ================================================================== *
 * 2. Board topology
 * ================================================================== */

t('there are 10 campsites and 4 headquarters', () => {
  eq(CAMPS.size, 10);
  eq(HEADQUARTERS.size, 4);
});

t('camp coordinates keep navy fixed and move every red camp one row toward center', () => {
  const oldRed = ['1-1', '1-3', '2-2', '3-1', '3-3'];
  const red = ['2-1', '2-3', '3-2', '4-1', '4-3'];
  const navy = ['7-1', '7-3', '8-2', '9-1', '9-3'];
  eq([...CAMPS].sort().join(' '), [...red, ...navy].sort().join(' '), 'exact camp set');
  for (let i = 0; i < oldRed.length; i++) {
    const [oldRow, oldCol] = oldRed[i].split('-').map(Number);
    const [newRow, newCol] = red[i].split('-').map(Number);
    eq(newRow, oldRow + 1, `${oldRed[i]} row toward center`);
    eq(newCol, oldCol, `${oldRed[i]} column unchanged`);
    no(CAMPS.has(oldRed[i]), `${oldRed[i]} must no longer be a camp`);
  }
  for (const k of navy) ok(CAMPS.has(k), `${k} navy camp unchanged`);
});

t('rotated view maps corrected physical camps without changing their canonical keys', () => {
  for (const k of ['2-1', '2-3', '3-2', '4-1', '4-3']) {
    const [r, c] = k.split('-').map(Number);
    const normal = displayPos(r, c, 'navy_bottom');
    const rotated = displayPos(r, c, 'red_bottom');
    const expected = displayPos(11 - r, 4 - c, 'navy_bottom');
    eq(rotated.x, expected.x, `${k} rotated x`);
    eq(rotated.y, expected.y, `${k} rotated y`);
    ok(normal.y < rotated.y, `${k} crosses presentation midpoint when rotated`);
    ok(CAMPS.has(k), `${k} remains the canonical camp key`);
  }
});

t('headquarters rows are not railway', () => {
  for (const k of ['0-0', '0-4', '11-0', '11-4']) no(RAILWAYS.has(k), `${k} must not be railway`);
});

t('rows 1, 5, 6, 10 are fully railway', () => {
  for (const r of [1, 5, 6, 10]) for (let c = 0; c < 5; c++) ok(RAILWAYS.has(key(r, c)), `${r}-${c}`);
});

t('outer columns are railway between rows 1 and 10', () => {
  for (let r = 1; r <= 10; r++) { ok(RAILWAYS.has(key(r, 0))); ok(RAILWAYS.has(key(r, 4))); }
});

t('the front line is crossed only at columns 0, 2 and 4', () => {
  ok(isRoadAdjacent('5-0', '6-0'), 'col 0 bridge');
  ok(isRoadAdjacent('5-2', '6-2'), 'col 2 road');
  ok(isRoadAdjacent('5-4', '6-4'), 'col 4 bridge');
  no(isRoadAdjacent('5-1', '6-1'), 'col 1 must NOT cross the front line');
  no(isRoadAdjacent('5-3', '6-3'), 'col 3 must NOT cross the front line');
});

t('campsites connect diagonally to their four corners', () => {
  ok(isRoadAdjacent('3-2', '2-1'));
  ok(isRoadAdjacent('3-2', '4-3'));
  ok(isRoadAdjacent('8-2', '7-1'));
  ok(isRoadAdjacent('8-2', '9-3'));
  ok(isRoadAdjacent('2-1', '1-0'), 'camp 2-1 joins corner 1-0');
});

t('non-camp squares have no diagonal connections', () => {
  no(isRoadAdjacent('4-0', '5-1'), 'plain diagonal must not exist');
  no(isRoadAdjacent('10-2', '11-1'), 'plain diagonal must not exist');
});

/* ================================================================== *
 * 3. Setup legality
 * ================================================================== */

t('flag may only be placed in a headquarters', () => {
  ok(validatePiecePlacementInSetup(piece('navy', '军旗'), '11-1').valid);
  ok(validatePiecePlacementInSetup(piece('navy', '军旗'), '11-3').valid);
  no(validatePiecePlacementInSetup(piece('navy', '军旗'), '11-0').valid);
  no(validatePiecePlacementInSetup(piece('navy', '军旗'), '10-2').valid);
});

t('mines may only sit in the back two rows', () => {
  for (const r of homeRowsOf('navy')) ok(validatePiecePlacementInSetup(piece('navy', '地雷'), key(r, 0)).valid);
  no(validatePiecePlacementInSetup(piece('navy', '地雷'), '9-0').valid);
  for (const r of homeRowsOf('red')) ok(validatePiecePlacementInSetup(piece('red', '地雷'), key(r, 0)).valid);
  no(validatePiecePlacementInSetup(piece('red', '地雷'), '2-0').valid);
});

t('bombs may not stand on the front row', () => {
  no(validatePiecePlacementInSetup(piece('navy', '炸弹'), key(frontRowOf('navy'), 2)).valid);
  ok(validatePiecePlacementInSetup(piece('navy', '炸弹'), '7-0').valid);
  no(validatePiecePlacementInSetup(piece('red', '炸弹'), key(frontRowOf('red'), 2)).valid);
});

t('campsites must stay empty during setup', () => {
  for (const c of CAMPS) no(validatePiecePlacementInSetup(piece('navy', '连长'), c).valid, c);
});

t('pieces may not leave their own territory', () => {
  no(validatePiecePlacementInSetup(piece('navy', '连长'), '5-0').valid);
  no(validatePiecePlacementInSetup(piece('red', '连长'), '6-0').valid);
});

t('generateLegalSetup produces 25 pieces in 25 distinct legal slots (x400)', () => {
  for (let i = 0; i < 400; i++) {
    for (const side of ['navy', 'red']) {
      const setup = generateLegalSetup(side);
      const keys = Object.keys(setup);
      eq(keys.length, 25, `${side} slot count`);
      const slots = new Set(setupSlotsOf(side));
      for (const k of keys) ok(slots.has(k), `${k} is not a legal setup slot`);
      const check = validateFormation(setup, side);
      ok(check.valid, `illegal formation: ${check.problems.join('; ')}`);
    }
  }
});

t('generateLegalSetup never duplicates or drops a piece (x400)', () => {
  const expected = {};
  createStandardArmy('navy').forEach(p => { expected[p.name] = (expected[p.name] || 0) + 1; });
  for (let i = 0; i < 400; i++) {
    const setup = generateLegalSetup('navy');
    const seenIds = new Set();
    const counts = {};
    for (const p of Object.values(setup)) {
      ok(!seenIds.has(p.id), `piece ${p.id} placed twice`);
      seenIds.add(p.id);
      counts[p.name] = (counts[p.name] || 0) + 1;
    }
    for (const [name, n] of Object.entries(expected)) eq(counts[name] || 0, n, `count of ${name}`);
  }
});

/* ================================================================== *
 * 4. Movement
 * ================================================================== */

const emptyBoard = () => ({});

t('a piece steps one station along a road', () => {
  const b = { '8-0': piece('navy', '连长') };
  ok(canPieceMove(b['8-0'], '8-0', '8-1', b).allowed);
  ok(canPieceMove(b['8-0'], '8-0', '7-0', b).allowed);
});

t('a piece may not jump two road stations', () => {
  const b = { '8-1': piece('navy', '连长') };
  no(canPieceMove(b['8-1'], '8-1', '8-3', b).allowed);
});

t('mines and flags never move', () => {
  const b = { '10-0': piece('navy', '地雷'), '11-1': piece('navy', '军旗') };
  no(canPieceMove(b['10-0'], '10-0', '9-0', b).allowed);
  no(canPieceMove(b['11-1'], '11-1', '10-1', b).allowed);
});

t('a piece inside a headquarters can never leave (standard Junqi; doc is silent)', () => {
  const b = { '11-1': piece('navy', '连长') };
  no(canPieceMove(b['11-1'], '11-1', '10-1', b).allowed);
});

t('a non-engineer runs straight down a clear railway', () => {
  const b = { '7-0': piece('navy', '连长') };
  ok(canPieceMove(b['7-0'], '7-0', '10-0', b).allowed, 'straight down col 0');
  ok(canPieceMove(b['7-0'], '7-0', '2-0', b).allowed, 'across the front line on the rail bridge');
});

t('a blocked railway stops a straight run', () => {
  const b = { '7-0': piece('navy', '连长'), '9-0': piece('navy', '排长') };
  no(canPieceMove(b['7-0'], '7-0', '10-0', b).allowed);
  ok(canPieceMove(b['7-0'], '7-0', '8-0', b).allowed);
});

t('a non-engineer may not turn a railway corner', () => {
  const b = { '10-0': piece('navy', '连长') };
  no(canPieceMove(b['10-0'], '10-0', '7-4', b).allowed, 'requires a corner');
});

t('the engineer turns railway corners when the path is clear', () => {
  const b = { '10-0': piece('navy', '工兵') };
  ok(canPieceMove(b['10-0'], '10-0', '10-4', b).allowed, 'along row 10');
  ok(canPieceMove(b['10-0'], '10-0', '6-4', b).allowed, 'corner: row 10 -> col 4 -> row 6');
});

t('the engineer cannot pass through an occupied railway station', () => {
  const b = { '10-0': piece('navy', '工兵'), '10-2': piece('red', '连长'), '9-0': piece('red', '连长') };
  no(canPieceMove(b['10-0'], '10-0', '10-4', b).allowed, 'blocked at 10-2 and 9-0');
  ok(canPieceMove(b['10-0'], '10-0', '10-2', b).allowed, 'may still attack the blocker itself');
});

t('a piece in a campsite cannot be attacked', () => {
  const b = { '8-1': piece('navy', '连长'), '7-1': piece('red', '排长') };
  no(canPieceMove(b['8-1'], '8-1', '7-1', b).allowed, '7-1 is a camp');
});

t('a piece may still move into an empty campsite', () => {
  const b = { '8-1': piece('navy', '连长') };
  ok(canPieceMove(b['8-1'], '8-1', '7-1', b).allowed);
});

t('red camp safety follows corrected cells and leaves old cells attackable', () => {
  const corrected = {
    '2-0': piece('red', '连长'),
    '2-1': piece('navy', '排长')
  };
  no(canPieceMove(corrected['2-0'], '2-0', '2-1', corrected).allowed, 'new red camp is safe');

  const old = {
    '1-0': piece('red', '连长'),
    '1-1': piece('navy', '排长')
  };
  ok(canPieceMove(old['1-0'], '1-0', '1-1', old).allowed, 'old red camp is attackable');
});

t('a piece cannot capture its own side', () => {
  const b = { '8-0': piece('navy', '连长'), '8-1': piece('navy', '排长') };
  no(canPieceMove(b['8-0'], '8-0', '8-1', b).allowed);
});

t('unconnected stations reject the move', () => {
  const b = { '3-1': piece('red', '连长') };
  no(canPieceMove(b['3-1'], '3-1', '8-2', b).allowed);
});

/* ================================================================== *
 * 5. Combat
 * ================================================================== */

t('the higher rank wins', () => {
  const r = resolveCombat(piece('navy', '司令'), piece('red', '军长'));
  eq(r.result, COMBAT.ATTACKER_WINS);
});

t('the defender holds against a lower rank', () => {
  const r = resolveCombat(piece('navy', '排长'), piece('red', '师长'));
  eq(r.result, COMBAT.DEFENDER_WINS);
});

t('equal ranks remove each other', () => {
  const r = resolveCombat(piece('navy', '团长'), piece('red', '团长'));
  eq(r.result, COMBAT.BOTH_REMOVED);
  eq(r.removed.length, 2);
});

t('a bomb removes itself and its target, attacking or defending', () => {
  eq(resolveCombat(piece('navy', '炸弹'), piece('red', '司令')).result, COMBAT.BOTH_REMOVED);
  eq(resolveCombat(piece('navy', '司令'), piece('red', '炸弹')).result, COMBAT.BOTH_REMOVED);
});

t('a bomb also clears a mine', () => {
  eq(resolveCombat(piece('navy', '炸弹'), piece('red', '地雷')).result, COMBAT.BOTH_REMOVED);
});

t('the engineer disarms a mine; anyone else dies on it', () => {
  eq(resolveCombat(piece('navy', '工兵'), piece('red', '地雷')).result, COMBAT.ATTACKER_WINS);
  eq(resolveCombat(piece('navy', '司令'), piece('red', '地雷')).result, COMBAT.DEFENDER_WINS);
  eq(resolveCombat(piece('navy', '排长'), piece('red', '地雷')).result, COMBAT.DEFENDER_WINS);
});

t('a mine survives the attacker it destroys', () => {
  const r = resolveCombat(piece('navy', '司令'), piece('red', '地雷'));
  eq(r.removed.length, 1);
  eq(r.removed[0].name, '司令');
});

t('capturing the flag ends the game', () => {
  const r = resolveCombat(piece('navy', '排长'), piece('red', '军旗'));
  eq(r.result, COMBAT.ATTACKER_WINS);
  ok(r.gameOver);
});

t('a bomb reaching the flag still ends the game', () => {
  const r = resolveCombat(piece('navy', '炸弹'), piece('red', '军旗'));
  ok(r.gameOver, 'the flag is destroyed either way');
});

t('losing the field marshal marks that side for flag disclosure', () => {
  const a = resolveCombat(piece('navy', '军长'), piece('red', '司令'));   // attacker loses
  eq(a.marshalLost.length, 0, 'red marshal defends and survives');

  const b = resolveCombat(piece('navy', '司令'), piece('red', '炸弹'));
  eq(b.marshalLost[0], 'navy');

  const c = resolveCombat(piece('red', '司令'), piece('navy', '地雷'));
  eq(c.marshalLost[0], 'red');

  const d = resolveCombat(piece('navy', '司令'), piece('red', '司令'));
  eq(d.marshalLost.length, 2, 'both marshals fall');
});

/* ================================================================== *
 * 6. Concealment (暗棋 semantics)
 * ================================================================== */

t('classic: the opponent stays concealed AFTER ordinary combat', () => {
  const s = new GameSession(MODES.CLASSIC, { player1Name: 'A', player2Name: 'B' });
  s.phase = PHASES.PLAY;
  s.boardState = {
    '7-0': piece('navy', '旅长'),
    '6-0': piece('red', '司令')
  };
  s.activeTurn = 'navy';
  s.applyMove('7-0', '6-0');                 // navy attacks and loses

  const survivor = s.boardState['6-0'];
  eq(survivor.side, 'red');
  // Navy (seat 1) must NOT be able to see what survived.
  no(isPieceVisibleTo(s, '6-0', survivor, 1), 'red survivor must remain concealed to navy');
  ok(isPieceVisibleTo(s, '6-0', survivor, 2), 'red still sees its own piece');
});

t('classic: combat does not set revealed on the survivor', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  s.boardState = { '7-0': piece('navy', '司令'), '6-0': piece('red', '排长') };
  s.applyMove('7-0', '6-0');
  no(s.boardState['6-0'].revealed, 'classic never flips a piece face-up');
});

t('classic: a disclosed flag becomes visible to the opponent only', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  const flag = piece('red', '军旗');
  s.boardState = { '0-1': flag };
  no(isPieceVisibleTo(s, '0-1', flag, 1), 'concealed before disclosure');
  s.flagDisclosed.red = true;
  ok(isPieceVisibleTo(s, '0-1', flag, 1), 'visible after the red marshal falls');
});

t('setup: only the arranging player sees their own army', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  eq(s.phase, PHASES.SETUP);
  eq(s.setupSide, 'navy');
  for (const [k, p] of Object.entries(s.boardState)) {
    eq(isPieceVisibleTo(s, k, p, 1), p.side === 'navy', `${k} during navy setup`);
  }
  s.setupSide = 'red';
  for (const [k, p] of Object.entries(s.boardState)) {
    eq(isPieceVisibleTo(s, k, p, 2), p.side === 'red', `${k} during red setup`);
  }
});

t('vs computer: the human never sees a computer piece', () => {
  const s = new GameSession(MODES.VS_AI, {});
  s.phase = PHASES.PLAY;
  for (const [k, p] of Object.entries(s.boardState)) {
    if (p.side === 'red') no(isPieceVisibleTo(s, k, p, 1), `${k} must stay hidden`);
  }
});

/* ================================================================== *
 * 7. Perspective
 * ================================================================== */

t('classic rotates the view so the player to move sits at the bottom', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  s.activeTurn = 'navy';
  eq(boardOrientationOf(s), 'navy_bottom');
  eq(viewerSeatOf(s), 1);
  s.activeTurn = 'red';
  eq(boardOrientationOf(s), 'red_bottom');
  eq(viewerSeatOf(s), 2);
});

t('vs computer and flip keep one stable orientation', () => {
  const ai = new GameSession(MODES.VS_AI, {});
  ai.phase = PHASES.PLAY;
  ai.activeTurn = 'red';
  eq(boardOrientationOf(ai), 'navy_bottom', 'human stays at the bottom while the AI moves');

  const flip = new GameSession(MODES.FLIP, {});
  flip.flipSeatTurn = 2;
  eq(boardOrientationOf(flip), 'navy_bottom', 'flip board never rotates');
});

t('rotating the view never changes canonical state', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  const before = JSON.stringify(s.boardState);
  s.activeTurn = 'red'; boardOrientationOf(s); viewerSeatOf(s);
  s.activeTurn = 'navy'; boardOrientationOf(s); viewerSeatOf(s);
  eq(JSON.stringify(s.boardState), before);
});

/* ================================================================== *
 * 8. Flip mode
 * ================================================================== */

t('flip deals 50 pieces to every non-camp station, all face down', () => {
  const s = new GameSession(MODES.FLIP, {});
  eq(Object.keys(s.boardState).length, 50);
  for (const [k, p] of Object.entries(s.boardState)) {
    no(CAMPS.has(k), 'camps stay empty');
    no(p.revealed, 'everything starts face down');
    no(isPieceVisibleTo(s, k, p, 1), 'face-down pieces are invisible to both seats');
    no(isPieceVisibleTo(s, k, p, 2), 'face-down pieces are invisible to both seats');
  }
});

t('flip: the first piece turned over fixes both armies', () => {
  const s = new GameSession(MODES.FLIP, {});
  const first = Object.keys(s.boardState)[0];
  const side = s.boardState[first].side;
  s.revealPiece(first);
  eq(s.assignedColors.p1, side);
  eq(s.assignedColors.p2, side === 'navy' ? 'red' : 'navy');
});

t('flip: a revealed piece is owned by a seat, whichever half it stands in', () => {
  const s = new GameSession(MODES.FLIP, {});
  s.assignedColors = { p1: 'navy', p2: 'red' };
  eq(s.seatForSide('navy'), 1);
  eq(s.seatForSide('red'), 2);
  // Ownership is a property of the piece, never of the square it occupies.
  const p = piece('red', '连长', { revealed: true });
  s.boardState['11-0'] = p;                       // a red piece deep in navy's half
  eq(s.seatForSide(p.side), 2, 'still belongs to seat 2');
});

t('flip: fighting turns the survivor face up', () => {
  const s = new GameSession(MODES.FLIP, {});
  s.assignedColors = { p1: 'navy', p2: 'red' };
  s.boardState = {
    '8-0': piece('navy', '司令', { revealed: true }),
    '8-1': piece('red', '排长', { revealed: true })
  };
  s.applyMove('8-0', '8-1');
  ok(s.boardState['8-1'].revealed);
});

/* ================================================================== *
 * 9. AI information boundary
 * ================================================================== */

t('the AI observation redacts name, rank AND id of unrevealed pieces', () => {
  const board = { ...generateLegalSetup('navy'), ...generateLegalSetup('red') };
  const obs = createAiObservation('red', board);
  for (const [k, o] of Object.entries(obs)) {
    if (board[k].side === 'red') { ok(o.name, 'AI sees its own pieces'); continue; }
    eq(o.name, undefined, `${k} name leaked`);
    eq(o.rank, undefined, `${k} rank leaked`);
    ok(!/司令|军长|师长|旅长|团长|营长|连长|排长|工兵|地雷|炸弹|军旗/.test(o.id || ''),
      `${k} id leaks the piece identity: ${o.id}`);
    ok(o.unknown, 'flagged as unknown');
  }
});

t('the AI observation exposes a disclosed enemy flag', () => {
  const board = { '0-1': piece('red', '军旗'), '11-1': piece('navy', '军旗') };
  const obs = createAiObservation('red', board, { navy: true });
  eq(obs['11-1'].name, '军旗', 'disclosure is public information');
});

t('the AI only ever produces legal moves', () => {
  const ai = new LocalJunqiAI('standard');
  for (let i = 0; i < 40; i++) {
    const board = { ...generateLegalSetup('navy'), ...generateLegalSetup('red') };
    const move = ai.selectMove('red', board);
    ok(move, 'a move exists at the opening');
    ok(canPieceMove(board[move.from], move.from, move.to, board).allowed,
      `illegal AI move ${move.from} -> ${move.to}`);
    eq(board[move.from].side, 'red', 'AI moved its own piece');
  }
});

t('Standard AI decision is invariant when hidden enemy identities are swapped', () => {
  const boardA = { ...generateLegalSetup('navy'), ...generateLegalSetup('red') };
  const hidden = Object.keys(boardA).filter(k => boardA[k].side === 'navy');
  const boardB = JSON.parse(JSON.stringify(boardA));
  const [a, b] = hidden.slice(0, 2);
  [boardB[a], boardB[b]] = [
    { ...boardB[b], id: boardA[a].id },
    { ...boardB[a], id: boardA[b].id }
  ];
  // Positions, sides, and public reveal state are identical. Only secrets vary.
  const ai = new LocalJunqiAI('standard');
  const first = ai.selectMove('red', boardA);
  const second = ai.selectMove('red', boardB);
  eq(`${first.from}:${first.to}`, `${second.from}:${second.to}`,
    'hidden identity changed the AI decision');
});

t('Standard AI reports that its decision used the sanitized observation only', () => {
  const board = { ...generateLegalSetup('navy'), ...generateLegalSetup('red') };
  const diagnostics = {};
  new LocalJunqiAI('standard').selectMove('red', board, {}, diagnostics);
  ok(diagnostics.observationOnly);
  ok(diagnostics.candidates > 0);
});

/* ================================================================== *
 * 10. Session lifecycle
 * ================================================================== */

t('every new session gets a distinct id', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(new GameSession(MODES.CLASSIC, {}).gameId);
  eq(ids.size, 50);
});

t('setup swaps are rejected when they would break a rule', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  const flagKey = Object.keys(s.boardState).find(k => s.boardState[k].name === '军旗' && s.boardState[k].side === 'navy');
  const target = Object.keys(s.boardState).find(k => s.boardState[k]?.side === 'navy' && !HEADQUARTERS.has(k));
  s.selected = flagKey;
  const res = s.setupTap(target);
  no(res.ok, 'moving the flag out of HQ must be refused');
  ok(/Headquarters/.test(res.reason), `unhelpful reason: ${res.reason}`);
});

t('setup swap succeeds for a legal pair and keeps the formation valid', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  const own = Object.keys(s.boardState).filter(k => s.boardState[k].side === 'navy');
  let swapped = false;
  for (const a of own) {
    for (const b of own) {
      if (a === b) continue;
      s.selected = a;
      const res = s.setupTap(b);
      if (res.ok && res.swapped) { swapped = true; break; }
      s.selected = null;
    }
    if (swapped) break;
  }
  ok(swapped, 'at least one legal swap must exist');
  ok(validateFormation(s.boardState, 'navy').valid);
});

t('lockSetup refuses an illegal formation', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  const flagKey = Object.keys(s.boardState).find(k => s.boardState[k].name === '军旗' && s.boardState[k].side === 'navy');
  delete s.boardState[flagKey];                  // sabotage
  const res = s.lockSetup();
  no(res.ok);
  ok(res.problems.length > 0);
});

t('classic setup order is P1, then P2, then play', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  eq(s.setupSide, 'navy');
  let res = s.lockSetup();
  ok(res.ok); eq(res.next, 'handoff_to_setup'); eq(s.setupSide, 'red');
  res = s.lockSetup();
  ok(res.ok); eq(res.next, 'handoff_to_play'); eq(s.phase, PHASES.PLAY); eq(s.activeTurn, 'navy');
});

t('vs computer generates the opponent formation on lock-in', () => {
  const s = new GameSession(MODES.VS_AI, {});
  const res = s.lockSetup();
  ok(res.ok); eq(res.next, 'play'); eq(s.phase, PHASES.PLAY);
  eq(Object.values(s.boardState).filter(p => p.side === 'red').length, 25);
  ok(validateFormation(s.boardState, 'red').valid);
});

t('a side with no legal move loses', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  s.activeTurn = 'red';
  // Navy keeps only an immovable flag; red keeps a mover.
  s.boardState = { '11-1': piece('navy', '军旗'), '3-2': piece('red', '连长') };
  eq(legalMovesFor('navy', s.boardState).length, 0);
  s.endTurn();                                    // hands over to navy
  ok(s.isGameOver);
  eq(s.winner, 'red');
  eq(s.winReason, 'immobile');
});

t('losing the flag ends the game immediately', () => {
  const s = new GameSession(MODES.CLASSIC, {});
  s.phase = PHASES.PLAY;
  s.boardState = { '1-1': piece('navy', '连长'), '0-1': piece('red', '军旗') };
  s.applyMove('1-1', '0-1');
  ok(s.isGameOver);
  eq(s.winner, 'navy');
  eq(s.winReason, 'flag');
});

t('a session round-trips through its record without losing state', () => {
  const s = new GameSession(MODES.CLASSIC, { player1Name: 'Caesar', player2Name: 'Daddy' });
  s.lockSetup(); s.lockSetup();
  const moves = legalMovesFor('navy', s.boardState);
  s.applyMove(moves[0].from, moves[0].to);

  const rec = s.toRecord();
  const back = GameSession.fromRecord(JSON.parse(JSON.stringify(rec)));

  eq(back.gameId, s.gameId);
  eq(back.mode, s.mode);
  eq(back.player1Name, 'Caesar');
  eq(back.activeTurn, s.activeTurn);
  eq(JSON.stringify(back.boardState), JSON.stringify(s.boardState));
  eq(back.history.length, s.history.length);
  eq(back.selected, null, 'transient selection must NOT be restored');
});

t('Junqi resignation is terminal, recorded and preserved on resume', () => {
  const s = new GameSession(MODES.CLASSIC, { player1Name: 'Caesar', player2Name: 'Daddy' });
  s.phase = PHASES.PLAY;
  s.activeTurn = 'navy';
  const result = s.resign('navy');
  ok(result.ok);
  ok(s.isGameOver);
  eq(s.winner, 'red');
  eq(s.winReason, 'resignation');
  eq(s.history.at(-1).resign, true);
  const resumed = GameSession.fromRecord(s.toRecord());
  ok(resumed.isGameOver);
  eq(resumed.winner, 'red');
  eq(resumed.winReason, 'resignation');
});

t('the public history never records a concealed identity', () => {
  const s = new GameSession(MODES.CLASSIC, { player1Name: 'A', player2Name: 'B' });
  s.phase = PHASES.PLAY;
  s.boardState = { '7-0': piece('navy', '旅长'), '6-0': piece('red', '司令') };
  s.applyMove('7-0', '6-0');
  const names = /司令|军长|师长|旅长|团长|营长|连长|排长|工兵|地雷|炸弹/;
  for (const h of s.history) {
    no(names.test(h.text), `history leaks a piece name: "${h.text}"`);
  }
});

/* ================================================================== */

console.log(`\n  Caesar Games — rules & session\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}\n`);
}
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
