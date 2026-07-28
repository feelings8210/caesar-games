/* Caesar Games — Shared Junqi Core Rules Engine */

export const PIECE_TYPES = {
  FIELD_MARSHAL: { name: '司令', rank: 1, count: 1 },
  CORPS_COMMANDER: { name: '军长', rank: 2, count: 1 },
  DIVISION_COMMANDER: { name: '师长', rank: 3, count: 2 },
  BRIGADE_COMMANDER: { name: '旅长', rank: 4, count: 2 },
  REGIMENT_COMMANDER: { name: '团长', rank: 5, count: 2 },
  BATTALION_COMMANDER: { name: '营长', rank: 6, count: 2 },
  COMPANY_COMMANDER: { name: '连长', rank: 7, count: 3 },
  PLATOON_COMMANDER: { name: '排长', rank: 8, count: 3 },
  ENGINEER: { name: '工兵', rank: 9, count: 3 },
  MINE: { name: '地雷', rank: 10, count: 3, static: true },
  BOMB: { name: '炸弹', rank: 99, count: 2 },
  FLAG: { name: '军旗', rank: 0, count: 1, static: true }
};

export const CAMPS = new Set([
  '1-1', '1-3', '2-2', '3-1', '3-3', // Top half camps
  '7-1', '7-3', '8-2', '9-1', '9-3'  // Bottom half camps
]);

export const HEADQUARTERS = new Set([
  '0-1', '0-3',   // Top HQs
  '11-1', '11-3'  // Bottom HQs
]);

export const RAILWAYS = new Set([
  // Horizontal railways
  '1-0', '1-1', '1-2', '1-3', '1-4',
  '5-0', '5-1', '5-2', '5-3', '5-4',
  '6-0', '6-1', '6-2', '6-3', '6-4',
  '10-0', '10-1', '10-2', '10-3', '10-4',
  // Vertical outer border railways
  '0-0', '2-0', '3-0', '4-0', '7-0', '8-0', '9-0', '11-0',
  '0-4', '2-4', '3-4', '4-4', '7-4', '8-4', '9-4', '11-4'
]);

export function createStandardArmy(side) {
  const army = [];
  Object.values(PIECE_TYPES).forEach(pt => {
    for (let i = 0; i < pt.count; i++) {
      army.push({
        id: `${side}-${pt.name}-${i}`,
        side: side,
        name: pt.name,
        rank: pt.rank,
        static: !!pt.static,
        revealed: false
      });
    }
  });
  return army;
}

export function generateLegalSetup(side) {
  const army = createStandardArmy(side);
  const startRow = side === 'navy' ? 6 : 0;
  const positions = {};

  // Flag must be in HQ
  const hqKeys = side === 'navy' ? ['11-1', '11-3'] : ['0-1', '0-3'];
  const chosenHq = hqKeys[Math.floor(Math.random() * hqKeys.length)];
  const flagIdx = army.findIndex(p => p.name === '军旗');
  positions[chosenHq] = army.splice(flagIdx, 1)[0];

  // Mines must be in back 2 rows
  const mineRows = side === 'navy' ? [10, 11] : [0, 1];
  const validMineKeys = [];
  mineRows.forEach(r => {
    for (let c = 0; c < 5; c++) {
      const k = `${r}-${c}`;
      if (!positions[k] && !CAMPS.has(k)) validMineKeys.push(k);
    }
  });

  for (let i = 0; i < 3; i++) {
    const mineIdx = army.findIndex(p => p.name === '地雷');
    const randKeyIdx = Math.floor(Math.random() * validMineKeys.length);
    const k = validMineKeys.splice(randKeyIdx, 1)[0];
    positions[k] = army.splice(mineIdx, 1)[0];
  }

  // Bombs cannot be in front row
  const frontRow = side === 'navy' ? 6 : 5;

  // Place remaining pieces into available non-camp slots
  let pieceIndex = 0;
  for (let r = 0; r < 6; r++) {
    const actualRow = startRow + r;
    for (let c = 0; c < 5; c++) {
      const key = `${actualRow}-${c}`;
      if (positions[key] || CAMPS.has(key)) continue;
      
      // Ensure bomb not in front row
      if (actualRow === frontRow && army[pieceIndex] && army[pieceIndex].name === '炸弹') {
        // Swap bomb with non-bomb piece
        const nonBombIdx = army.findIndex(p => p.name !== '炸弹');
        if (nonBombIdx !== -1) {
          const temp = army[pieceIndex];
          army[pieceIndex] = army[nonBombIdx];
          army[nonBombIdx] = temp;
        }
      }

      if (pieceIndex < army.length) {
        positions[key] = army[pieceIndex++];
      }
    }
  }

  return positions;
}

export function validatePiecePlacementInSetup(piece, targetKey) {
  if (!piece) return { valid: true };
  const [r] = targetKey.split('-').map(Number);
  const side = piece.side;

  // 1. Cannot place in Camp (行营)
  if (CAMPS.has(targetKey)) {
    return { valid: false, reason: 'Camp nodes (行营) cannot hold pieces during setup.' };
  }

  // 2. Territory bounds
  if (side === 'navy' && (r < 6 || r > 11)) {
    return { valid: false, reason: 'Navy pieces must remain inside Navy territory (Rows 6–11).' };
  }
  if (side === 'red' && (r < 0 || r > 5)) {
    return { valid: false, reason: 'Red pieces must remain inside Red territory (Rows 0–5).' };
  }

  // 3. Flag (军旗) must be in HQ (大本营)
  const hqKeys = side === 'navy' ? ['11-1', '11-3'] : ['0-1', '0-3'];
  if (piece.name === '军旗') {
    if (!hqKeys.includes(targetKey)) {
      return { valid: false, reason: 'Flag (军旗) must be placed in a Headquarters (大本营) slot.' };
    }
  }

  // 4. Mines (地雷) must be in back 2 rows
  const mineRows = side === 'navy' ? [10, 11] : [0, 1];
  if (piece.name === '地雷') {
    if (!mineRows.includes(r)) {
      return { valid: false, reason: 'Mines (地雷) must be placed in the back two rows.' };
    }
  }

  // 5. Bombs (炸弹) cannot be in front row
  const frontRow = side === 'navy' ? 6 : 5;
  if (piece.name === '炸弹') {
    if (r === frontRow) {
      return { valid: false, reason: 'Bombs (炸弹) cannot be placed on the front line.' };
    }
  }

  return { valid: true };
}

export function validateSwapInSetup(pieceA, posA, pieceB, posB) {
  const checkA = validatePiecePlacementInSetup(pieceA, posB);
  if (!checkA.valid) return checkA;

  if (pieceB) {
    const checkB = validatePiecePlacementInSetup(pieceB, posA);
    if (!checkB.valid) return checkB;
  }

  return { valid: true };
}

export function resolveCombat(attacker, defender) {
  let outcome = null;

  // Bomb mutual destruction
  if (attacker.name === '炸弹' || defender.name === '炸弹') {
    outcome = { winner: null, loser: 'both', reason: 'Bomb mutual destruction' };
  }
  // Engineer disarms Mine
  else if (attacker.name === '工兵' && defender.name === '地雷') {
    outcome = { winner: attacker, loser: defender, reason: 'Engineer disarmed Mine' };
  }
  // Mine defeats non-engineer
  else if (defender.name === '地雷') {
    outcome = { winner: defender, loser: attacker, reason: 'Mine defeated attacker' };
  }
  // Flag capture
  else if (defender.name === '军旗') {
    outcome = { winner: attacker, loser: defender, reason: 'Flag captured', gameOver: true };
  }
  // Equal rank mutual destruction
  else if (attacker.rank === defender.rank) {
    outcome = { winner: null, loser: 'both', reason: 'Equal rank mutual destruction' };
  }
  // Higher rank (lower rank number) wins
  else if (attacker.rank < defender.rank) {
    outcome = { winner: attacker, loser: defender, reason: `${attacker.name} defeated ${defender.name}` };
  } else {
    outcome = { winner: defender, loser: attacker, reason: `${defender.name} defeated ${attacker.name}` };
  }

  // Field Marshal (司令) elimination check for Flag disclosure
  let fieldMarshalDefeatedSide = null;
  if (outcome.loser === attacker && attacker.name === '司令') {
    fieldMarshalDefeatedSide = attacker.side;
  } else if (outcome.loser === defender && defender.name === '司令') {
    fieldMarshalDefeatedSide = defender.side;
  } else if (outcome.loser === 'both') {
    if (attacker.name === '司令') fieldMarshalDefeatedSide = attacker.side;
    if (defender.name === '司令') fieldMarshalDefeatedSide = defender.side;
  }

  if (fieldMarshalDefeatedSide) {
    outcome.fieldMarshalDefeatedSide = fieldMarshalDefeatedSide;
  }

  return outcome;
}

export function canPieceMove(piece, fromKey, toKey, boardState) {
  if (!piece || piece.static) return { allowed: false, reason: 'Mines and Flags cannot move.' };

  const [fromR, fromC] = fromKey.split('-').map(Number);
  const [toR, toC] = toKey.split('-').map(Number);

  // Target inside Camp (行营) cannot be attacked
  const targetPiece = boardState[toKey];
  if (targetPiece && CAMPS.has(toKey) && targetPiece.side !== piece.side) {
    return { allowed: false, reason: 'This piece is protected by Campsite.' };
  }

  // Cannot capture own piece
  if (targetPiece && targetPiece.side === piece.side) {
    return { allowed: false, reason: 'Cannot capture your own piece.' };
  }

  // Check if orthogonal adjacent step (Road move)
  const dRow = Math.abs(fromR - toR);
  const dCol = Math.abs(fromC - toC);
  
  if (dRow + dCol === 1) {
    return { allowed: true };
  }

  // Diagonal move into/out of Campsite
  if (dRow === 1 && dCol === 1 && (CAMPS.has(fromKey) || CAMPS.has(toKey))) {
    return { allowed: true };
  }

  // Railway pathfinding
  if (RAILWAYS.has(fromKey) && RAILWAYS.has(toKey)) {
    if (piece.name === '工兵') {
      const pathOk = checkEngineerRailwayPath(fromKey, toKey, boardState);
      if (pathOk) return { allowed: true };
      return { allowed: false, reason: 'Railway path is blocked by another piece.' };
    } else {
      // Straight line railway check
      const straightOk = checkStraightRailwayPath(fromKey, toKey, boardState);
      if (straightOk) return { allowed: true };
      return { allowed: false, reason: 'Non-engineers can only move straight on clear railways.' };
    }
  }

  return { allowed: false, reason: 'Invalid move destination.' };
}

function checkStraightRailwayPath(fromKey, toKey, boardState) {
  const [fromR, fromC] = fromKey.split('-').map(Number);
  const [toR, toC] = toKey.split('-').map(Number);

  if (fromR !== toR && fromC !== toC) return false; // Must be straight line

  const stepR = fromR === toR ? 0 : (toR > fromR ? 1 : -1);
  const stepC = fromC === toC ? 0 : (toC > fromC ? 1 : -1);

  let currR = fromR + stepR;
  let currC = fromC + stepC;

  while (currR !== toR || currC !== toC) {
    const key = `${currR}-${currC}`;
    if (!RAILWAYS.has(key) || boardState[key]) return false; // Blocked or left railway
    currR += stepR;
    currC += stepC;
  }

  return true;
}

function checkEngineerRailwayPath(fromKey, toKey, boardState) {
  // BFS pathfinding on connected railways
  const queue = [fromKey];
  const visited = new Set([fromKey]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toKey) return true;

    const [r, c] = current.split('-').map(Number);
    const neighbors = [`${r-1}-${c}`, `${r+1}-${c}`, `${r}-${c-1}`, `${r}-${c+1}`];

    for (const n of neighbors) {
      if (RAILWAYS.has(n) && !visited.has(n)) {
        visited.add(n);
        // Destination can contain piece, intermediate nodes must be empty
        if (n === toKey || !boardState[n]) {
          queue.push(n);
        }
      }
    }
  }

  return false;
}
