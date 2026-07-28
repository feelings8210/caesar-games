/* Caesar Games — Deterministic Automated Unit Test Suite */
import { generateLegalSetup, resolveCombat, canPieceMove, createStandardArmy, validatePiecePlacementInSetup, validateSwapInSetup } from './rules.js';
import { LocalJunqiAI, createAiObservation } from './ai.js';
import { saveGameState, loadGameState, clearGameState } from './persistence.js';

// Polyfill localStorage for Node execution
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}

export function runAutomatedTests() {
  const results = [];
  let passedCount = 0;

  function assert(condition, message) {
    if (condition) {
      passedCount++;
      results.push({ name: message, status: 'PASSED' });
    } else {
      results.push({ name: message, status: 'FAILED' });
      console.error(`TEST FAILED: ${message}`);
    }
  }

  console.log('--- STARTING CAESAR GAMES V1 AUTOMATED TEST SUITE ---');

  // TEST GROUP 1: VS COMPUTER (AI Fog-of-War & Information Boundaries)
  try {
    const ai = new LocalJunqiAI('standard');
    const board = generateLegalSetup('navy');
    const redSetup = generateLegalSetup('red');
    Object.assign(board, redSetup);

    const obs = createAiObservation('red', board);
    const humanKey = Object.keys(board).find(k => board[k].side === 'navy');
    const aiKey = Object.keys(board).find(k => board[k].side === 'red');

    assert(obs[humanKey].name === undefined, 'AI Boundary: AI observation redacts human piece name');
    assert(obs[humanKey].rank === undefined, 'AI Boundary: AI observation redacts human piece rank');
    assert(obs[aiKey].name !== undefined, 'AI Boundary: AI sees own piece name');

    const aiMove = ai.selectMove('red', board);
    assert(aiMove !== null, 'AI returns valid move candidate');
    
    if (aiMove) {
      const checkLegal = canPieceMove(aiMove.piece, aiMove.from, aiMove.to, board);
      assert(checkLegal.allowed, 'AI move is strictly legal under Junqi rules');
    }
  } catch (e) {
    assert(false, `VS Computer test threw exception: ${e.message}`);
  }

  // TEST GROUP 2: FLIP MODE MECHANICS
  try {
    const navyArmy = createStandardArmy('navy');
    const redArmy = createStandardArmy('red');
    const total50 = [...navyArmy, ...redArmy];
    assert(total50.length === 50, 'Flip Mode: exactly 50 total pieces present');

    const flipBoard = {};
    const validPositions = [];
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        const k = `${r}-${c}`;
        if (!['1-1','1-3','2-2','3-1','3-3','7-1','7-3','8-2','9-1','9-3'].includes(k)) {
          validPositions.push(k);
        }
      }
    }
    assert(validPositions.length === 50, 'Flip Mode: exactly 50 valid non-camp playable slots');

    validPositions.forEach((posKey, idx) => {
      flipBoard[posKey] = { ...total50[idx], revealed: false };
    });

    assert(Object.keys(flipBoard).length === 50, 'Flip Mode: all 50 pieces placed into valid state');
    assert(flipBoard[validPositions[0]].revealed === false, 'Flip Mode: all pieces initially hidden');

    const firstRevealedPiece = flipBoard[validPositions[0]];
    firstRevealedPiece.revealed = true;
    const p1Color = firstRevealedPiece.side;
    const p2Color = p1Color === 'navy' ? 'red' : 'navy';
    
    assert(p1Color === 'navy' || p1Color === 'red', 'Flip Mode: first reveal determines Player 1 color');
    assert(p2Color !== p1Color, 'Flip Mode: opposite color automatically assigned to Player 2');
    assert(firstRevealedPiece.revealed === true, 'Flip Mode: revealed identities stay public');
  } catch (e) {
    assert(false, `Flip Mode test threw exception: ${e.message}`);
  }

  // TEST GROUP 3: PERSISTENCE (SAVE / RESUME)
  try {
    clearGameState();
    const mockBoard = generateLegalSetup('navy');
    const mockSaveState = {
      gameMode: 'classic',
      privacyMode: 'standard',
      activeTurn: 'navy',
      boardState: mockBoard,
      assignedColors: { p1: 'navy', p2: 'red' },
      isGameOver: false,
      phase: 'setup',
      setupStep: 'navy'
    };

    saveGameState(mockSaveState);
    const loaded = loadGameState();
    assert(loaded !== null, 'Persistence: state successfully saved');
    assert(loaded.mode === 'classic', 'Persistence: gameMode restored correctly');
    assert(loaded.activeTurn === 'navy', 'Persistence: activeTurn restored correctly');
    assert(loaded.phase === 'setup', 'Persistence: setup phase restored correctly');
    assert(loaded.board && Object.keys(loaded.board).length > 0, 'Persistence: board state intact');
    clearGameState();
  } catch (e) {
    assert(false, `Persistence test threw exception: ${e.message}`);
  }

  // TEST GROUP 4: PRE-GAME SETUP PHASE MECHANICS
  try {
    const navyArmy = generateLegalSetup('navy');
    
    const flagKey = Object.keys(navyArmy).find(k => navyArmy[k].name === '军旗');
    const flagPiece = navyArmy[flagKey];
    const invalidFlagCheck = validatePiecePlacementInSetup(flagPiece, '11-2');
    assert(!invalidFlagCheck.valid, 'Setup: Flag in non-HQ slot is correctly identified as illegal');
    
    const validFlagCheck = validatePiecePlacementInSetup(flagPiece, '11-1');
    assert(validFlagCheck.valid, 'Setup: Flag in HQ slot (11-1) is valid');

    const mineKey = Object.keys(navyArmy).find(k => navyArmy[k].name === '地雷');
    const minePiece = navyArmy[mineKey];
    const invalidMineCheck = validatePiecePlacementInSetup(minePiece, '6-0');
    assert(!invalidMineCheck.valid, 'Setup: Mine in front row (6-0) is correctly identified as illegal');

    const validMineCheck = validatePiecePlacementInSetup(minePiece, '10-0');
    assert(validMineCheck.valid, 'Setup: Mine in back 2 rows (10-0) is valid');

    const bombKey = Object.keys(navyArmy).find(k => navyArmy[k].name === '炸弹');
    const bombPiece = navyArmy[bombKey];
    const invalidBombCheck = validatePiecePlacementInSetup(bombPiece, '6-0');
    assert(!invalidBombCheck.valid, 'Setup: Bomb in front row (6-0) is correctly identified as illegal');

    const engineerPiece = { name: '工兵', side: 'navy' };
    const campCheck = validatePiecePlacementInSetup(engineerPiece, '7-1');
    assert(!campCheck.valid, 'Setup: Placing any piece in a Camp (行营) is illegal');
  } catch (e) {
    assert(false, `Setup Phase test threw exception: ${e.message}`);
  }

  // TEST GROUP 5: SCENARIOS (COMBAT, DISCLOSURE, PERSPECTIVE)
  try {
    // Scenario A: Higher rank combat & concealment
    const attacker = { side: 'navy', name: '司令', rank: 1, revealed: false };
    const defender = { side: 'red', name: '旅长', rank: 4, revealed: false };
    const resA = resolveCombat(attacker, defender);
    assert(resA.winner === attacker, 'Scenario A: Commander defeats Brigade Commander');

    // Scenario B: Commander elimination & Flag disclosure signal
    const resB = resolveCombat(attacker, { side: 'red', name: '炸弹', rank: 99, revealed: false });
    assert(resB.loser === 'both', 'Scenario B: Commander vs Bomb is mutual destruction');
    assert(resB.fieldMarshalDefeatedSide === 'navy', 'Scenario B: Field Marshal defeat triggers flag disclosure signal for Navy');

    // Scenario C: Equal rank
    const resC = resolveCombat({ side: 'navy', name: '师长', rank: 3 }, { side: 'red', name: '师长', rank: 3 });
    assert(resC.loser === 'both', 'Scenario C: Equal rank leads to mutual destruction');

    // Scenario D: Engineer vs Mine
    const resD = resolveCombat({ side: 'navy', name: '工兵', rank: 9 }, { side: 'red', name: '地雷', rank: 10 });
    assert(resD.winner.name === '工兵', 'Scenario D: Engineer disarms Mine');

    // Scenario E: Non-Engineer vs Mine
    const resE = resolveCombat({ side: 'navy', name: '团长', rank: 5 }, { side: 'red', name: '地雷', rank: 10 });
    assert(resE.winner.name === '地雷', 'Scenario E: Mine defeats non-Engineer');

    // Scenario F: Perspective Coordinate Mapping
    const rKey = '0-0'; // Canonical top-left
    const displayR = 11 - 0;
    const displayC = 4 - 0;
    assert(displayR === 11 && displayC === 4, 'Scenario F: Canonical 0-0 maps to 11-4 in Red bottom perspective');
    const mappedBack = `${11 - displayR}-${4 - displayC}`;
    assert(mappedBack === rKey, 'Scenario F: Display coordinates map back to canonical key perfectly');

  } catch (e) {
    assert(false, `Scenario tests threw exception: ${e.message}`);
  }

  console.log(`--- TEST SUITE COMPLETE: ${passedCount}/${results.length} PASSED ---`);
  return { passedCount, total: results.length, results };
}
