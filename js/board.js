/* Caesar Games — Complete Interactive Junqi Board Controller */
import { canPieceMove, resolveCombat, generateLegalSetup, createStandardArmy, validateSwapInSetup, CAMPS, HEADQUARTERS, RAILWAYS } from './engine/rules.js';
import { LocalJunqiAI } from './engine/ai.js';
import { sounds } from './engine/sound.js';
import { showHint } from './hint.js';
import { saveGameState } from './engine/persistence.js';

export class JunqiBoard {
  constructor(containerId, appController) {
    this.container = document.getElementById(containerId);
    this.app = appController;

    this.gameMode = 'vs_computer'; // 'vs_computer', 'classic', 'flip'
    this.privacyMode = 'standard'; // 'standard', 'extra_privacy'
    this.aiDifficulty = 'standard'; // 'relaxed', 'standard'

    this.activeTurn = 'navy'; // 'navy' or 'red'
    this.assignedColors = { p1: 'navy', p2: 'red' }; // In Flip mode, set on first reveal
    this.isExtraPrivacyRevealed = false;

    this.phase = 'setup'; // 'setup' or 'gameplay'
    this.setupStep = 'navy'; // 'navy' or 'red'
    this.initialSetupSessionState = null;
    this.selectedSetupCell = null;

    this.selectedCell = null;
    this.boardState = {};
    this.capturedPieces = [];
    this.turnHistory = [];
    this.lastBattle = null;
    this.lastMoveRecap = null;
    this.flagDisclosed = { navy: false, red: false };
    this.isGameOver = false;

    this.ai = new LocalJunqiAI(this.aiDifficulty);

    // Always initialize default active board state
    this.startNewGame('vs_computer');
  }

  startNewGame(mode = 'vs_computer', options = {}) {
    this.gameMode = mode;
    this.privacyMode = options.privacy || 'standard';
    this.aiDifficulty = options.aiDifficulty || 'standard';
    this.ai = new LocalJunqiAI(this.aiDifficulty);

    this.activeTurn = 'navy';
    this.selectedCell = null;
    this.selectedSetupCell = null;
    this.capturedPieces = [];
    this.turnHistory = [];
    this.lastBattle = null;
    this.lastMoveRecap = null;
    this.flagDisclosed = { navy: false, red: false };
    this.isGameOver = false;
    this.isExtraPrivacyRevealed = false;

    if (this.gameMode === 'flip') {
      this.phase = 'gameplay';
      this.setupStep = null;
      this.initFlipModeBoard();
    } else {
      this.phase = 'setup';
      this.setupStep = 'navy';
      this.initClassicBoardWithSetup();
    }

    this.saveState();
    this.render();
  }

  initClassicBoardWithSetup() {
    this.assignedColors = { p1: 'navy', p2: 'red' };
    const navyArmy = generateLegalSetup('navy');
    const redArmy = generateLegalSetup('red');
    this.boardState = { ...navyArmy, ...redArmy };
    this.initialSetupSessionState = JSON.parse(JSON.stringify(this.boardState));
  }

  initClassicBoard() {
    this.initClassicBoardWithSetup();
  }

  initFlipModeBoard() {
    this.assignedColors = { p1: null, p2: null }; // Determined on 1st reveal
    const navyArmy = createStandardArmy('navy');
    const redArmy = createStandardArmy('red');
    const total50 = [...navyArmy, ...redArmy];

    // Fisher-Yates Shuffle
    for (let i = total50.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [total50[i], total50[j]] = [total50[j], total50[i]];
    }

    const validPositions = [];
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        const k = `${r}-${c}`;
        if (!CAMPS.has(k)) validPositions.push(k);
      }
    }

    this.boardState = {};
    validPositions.forEach((posKey, idx) => {
      this.boardState[posKey] = {
        ...total50[idx],
        revealed: false
      };
    });
  }

  initVsComputerPostAiMove() {
    this.gameMode = 'vs_computer';
    this.phase = 'gameplay';
    this.initClassicBoard();
    
    // Execute 1 legal human move (Navy 4-0 to 5-0)
    if (this.boardState['4-0']) {
      this.boardState['5-0'] = this.boardState['4-0'];
      delete this.boardState['4-0'];
    }

    // Execute 1 legal AI move response (Red 7-0 to 6-0)
    if (this.boardState['7-0']) {
      this.boardState['6-0'] = this.boardState['7-0'];
      delete this.boardState['7-0'];
    }

    this.activeTurn = 'navy';
    this.lastBattle = null;
    this.render();
  }

  initFlipMidGame() {
    this.gameMode = 'flip';
    this.phase = 'gameplay';
    this.initFlipModeBoard();
    this.assignedColors = { p1: 'navy', p2: 'red' };

    // Reveal 6 pieces (3 Navy, 3 Red) across valid keys
    const keys = Object.keys(this.boardState);
    let navyCount = 0, redCount = 0;

    for (let k of keys) {
      const p = this.boardState[k];
      if (p.side === 'navy' && navyCount < 3) {
        p.revealed = true;
        navyCount++;
      } else if (p.side === 'red' && redCount < 3) {
        p.revealed = true;
        redCount++;
      }
    }

    // Move 1 revealed Navy piece to demonstrate movement in Flip mode
    const revealedNavyKey = Object.keys(this.boardState).find(k => this.boardState[k].side === 'navy' && this.boardState[k].revealed && k.startsWith('4-'));
    if (revealedNavyKey) {
      const targetKey = '5-2';
      this.boardState[targetKey] = this.boardState[revealedNavyKey];
      delete this.boardState[revealedNavyKey];
    }

    this.activeTurn = 'navy';
    this.render();
  }

  loadState(saved) {
    this.gameMode = saved.mode || 'vs_computer';
    this.privacyMode = saved.privacy || 'standard';
    this.activeTurn = saved.activeTurn || 'navy';
    this.boardState = saved.board || {};
    this.assignedColors = saved.assignedColors || { p1: 'navy', p2: 'red' };
    this.capturedPieces = saved.captured || [];
    this.turnHistory = saved.history || [];
    this.aiDifficulty = saved.aiDifficulty || 'standard';
    this.isGameOver = !!saved.isGameOver;
    this.lastBattle = saved.lastBattle || null;
    this.lastMoveRecap = saved.lastMoveRecap || null;
    this.flagDisclosed = saved.flagDisclosed || { navy: false, red: false };

    this.phase = saved.phase || 'gameplay';
    this.setupStep = saved.setupStep || 'navy';
    this.initialSetupSessionState = saved.initialSetupSessionState || null;
    this.selectedSetupCell = null;

    this.ai = new LocalJunqiAI(this.aiDifficulty);
    this.render();
  }

  saveState() {
    saveGameState({
      gameMode: this.gameMode,
      privacyMode: this.privacyMode,
      activeTurn: this.activeTurn,
      boardState: this.boardState,
      assignedColors: this.assignedColors,
      capturedPieces: this.capturedPieces,
      turnHistory: this.turnHistory,
      aiDifficulty: this.aiDifficulty,
      isGameOver: this.isGameOver,
      lastBattle: this.lastBattle,
      lastMoveRecap: this.lastMoveRecap,
      flagDisclosed: this.flagDisclosed,
      phase: this.phase,
      setupStep: this.setupStep,
      initialSetupSessionState: this.initialSetupSessionState
    });
  }

  quickSetup() {
    const currentSide = this.setupStep || 'navy';
    const newArmy = generateLegalSetup(currentSide);

    Object.keys(this.boardState).forEach(k => {
      if (this.boardState[k].side === currentSide) {
        delete this.boardState[k];
      }
    });

    Object.assign(this.boardState, newArmy);
    this.selectedSetupCell = null;
    sounds.playMoveTok();
    this.saveState();
    this.render();
  }

  resetSetup() {
    const currentSide = this.setupStep || 'navy';
    if (this.initialSetupSessionState) {
      Object.keys(this.boardState).forEach(k => {
        if (this.boardState[k].side === currentSide) {
          delete this.boardState[k];
        }
      });
      Object.keys(this.initialSetupSessionState).forEach(k => {
        if (this.initialSetupSessionState[k].side === currentSide) {
          this.boardState[k] = JSON.parse(JSON.stringify(this.initialSetupSessionState[k]));
        }
      });
    }
    this.selectedSetupCell = null;
    sounds.playTap();
    this.saveState();
    this.render();
  }

  lockSetup() {
    this.selectedSetupCell = null;

    if (this.gameMode === 'vs_computer') {
      // Computer formation is generated independently and remains hidden
      const redArmy = generateLegalSetup('red');
      Object.keys(this.boardState).forEach(k => {
        if (this.boardState[k].side === 'red') delete this.boardState[k];
      });
      Object.assign(this.boardState, redArmy);

      this.phase = 'gameplay';
      this.activeTurn = 'navy';
      sounds.playMoveTok();
      this.saveState();
      this.render();
      showHint('GAME_STARTED', 'Setup locked! Make your first move.');
      return;
    }

    if (this.gameMode === 'classic') {
      if (this.setupStep === 'navy') {
        sounds.playPassCue();
        this.app.passManager.triggerTransition('Player 2 (Setup)', () => {
          this.setupStep = 'red';
          this.initialSetupSessionState = JSON.parse(JSON.stringify(this.boardState));
          this.saveState();
          this.render();
        });
      } else if (this.setupStep === 'red') {
        sounds.playPassCue();
        this.app.passManager.triggerTransition('Player 1 (Start Game)', () => {
          this.phase = 'gameplay';
          this.activeTurn = 'navy';
          this.saveState();
          this.render();
          showHint('GAME_STARTED', 'Both setups locked! Player 1 (Navy) turn to move.');
        });
      }
    }
  }

  renderHeaderControls() {
    const passBtn = document.getElementById('btn-trigger-pass');
    if (passBtn) {
      if (this.gameMode === 'classic' && this.phase === 'gameplay') {
        passBtn.style.display = 'inline-flex';
      } else {
        passBtn.style.display = 'none';
      }
    }

    const statusDot = document.getElementById('status-dot');
    const turnLabel = document.getElementById('player-turn-label');

    if (statusDot && turnLabel) {
      if (this.phase === 'setup') {
        if (this.gameMode === 'vs_computer') {
          statusDot.className = 'status-dot navy';
          turnLabel.textContent = 'Your Setup — Tap 2 pieces to swap';
        } else {
          const pName = this.setupStep === 'navy' ? 'Player 1 (Navy)' : 'Player 2 (Red)';
          statusDot.className = `status-dot ${this.setupStep}`;
          turnLabel.textContent = `${pName} Setup — Tap 2 pieces to swap`;
        }
      } else {
        if (this.gameMode === 'vs_computer') {
          if (this.activeTurn === 'navy') {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = 'Your Turn (Navy)';
          } else {
            statusDot.className = 'status-dot red';
            turnLabel.textContent = 'Computer Thinking...';
          }
        } else if (this.gameMode === 'classic') {
          if (this.activeTurn === 'navy') {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = 'Player 1 Turn (Navy)';
          } else {
            statusDot.className = 'status-dot red';
            turnLabel.textContent = 'Player 2 Turn (Red)';
          }
        } else if (this.gameMode === 'flip') {
          if (!this.assignedColors.p1) {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = 'Player 1 Turn — Reveal any piece';
          } else {
            if (this.activeTurn === 'navy') {
              statusDot.className = 'status-dot navy';
              turnLabel.textContent = `Player 1 (${(this.assignedColors.p1||'navy').toUpperCase()})`;
            } else {
              statusDot.className = 'status-dot red';
              turnLabel.textContent = `Player 2 (${(this.assignedColors.p2||'red').toUpperCase()})`;
            }
          }
        }
      }
    }
  }

  triggerLastMoveReplay() {
    if (!this.lastMoveRecap) return;
    this.showRecapHighlights = true;
    this.render();

    setTimeout(() => {
      this.showRecapHighlights = false;
      this.render();
    }, 1800);
  }

  render() {
    this.renderHeaderControls();

    if (!this.container) return;
    this.container.innerHTML = '';

    // If in setup phase, prepend the touch-first Setup Control Bar
    if (this.phase === 'setup') {
      const setupBar = document.createElement('div');
      setupBar.className = 'setup-controls-bar';

      let titleText = 'Arrange Your Army';
      if (this.gameMode === 'vs_computer') {
        titleText = 'Your Setup — Tap 2 pieces to swap';
      } else if (this.setupStep === 'navy') {
        titleText = 'Player 1 Setup — Tap 2 pieces to swap';
      } else {
        titleText = 'Player 2 Setup — Tap 2 pieces to swap';
      }

      setupBar.innerHTML = `
        <div class="setup-title-badge">
          <span class="setup-icon">🛡️</span>
          <span class="setup-title-text">${titleText}</span>
        </div>
        <div class="setup-btn-group">
          <button id="btn-setup-quick" class="btn-setup-action">⚡ Quick Setup</button>
          <button id="btn-setup-reset" class="btn-setup-action">↺ Reset</button>
          <button id="btn-setup-lock" class="btn-setup-lock">✓ Ready</button>
        </div>
      `;

      this.container.appendChild(setupBar);

      setTimeout(() => {
        const qBtn = document.getElementById('btn-setup-quick');
        const rBtn = document.getElementById('btn-setup-reset');
        const lBtn = document.getElementById('btn-setup-lock');
        if (qBtn) qBtn.onclick = () => this.quickSetup();
        if (rBtn) rBtn.onclick = () => this.resetSetup();
        if (lBtn) lBtn.onclick = () => this.lockSetup();
      }, 0);
    }

    // Header Replay Button for Last Move
    const actionsGroup = document.querySelector('.board-actions-group');
    if (actionsGroup && this.phase === 'gameplay' && this.lastMoveRecap) {
      let replayBtn = document.getElementById('btn-replay-last-move');
      if (!replayBtn) {
        replayBtn = document.createElement('button');
        replayBtn.id = 'btn-replay-last-move';
        replayBtn.className = 'btn-ctrl';
        replayBtn.innerHTML = '<span>▶</span> Replay';
        replayBtn.onclick = () => this.triggerLastMoveReplay();
        actionsGroup.insertBefore(replayBtn, actionsGroup.firstChild);
      }
    }

    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'junqi-board-topology';

    // Render SVG lines network
    const svgLayer = this.createSvgNetwork();
    boardWrapper.appendChild(svgLayer);

    // Render Node Stations & Pieces
    const nodeLayer = document.createElement('div');
    nodeLayer.className = 'board-nodes-layer';

    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        const key = `${r}-${c}`;
        const nodeEl = this.createNodeElement(r, c, key);
        nodeLayer.appendChild(nodeEl);
      }
    }

    boardWrapper.appendChild(nodeLayer);

    // Extra Privacy Reveal Control
    if (this.phase === 'gameplay' && this.gameMode === 'classic' && this.privacyMode === 'extra_privacy' && !this.isGameOver) {
      const privacyControl = document.createElement('button');
      privacyControl.className = 'btn-extra-privacy-reveal';
      privacyControl.textContent = '👁 Hold to Reveal My Pieces';
      
      const setReveal = (val) => {
        this.isExtraPrivacyRevealed = val;
        this.render();
      };

      privacyControl.addEventListener('mousedown', () => setReveal(true));
      privacyControl.addEventListener('mouseup', () => setReveal(false));
      privacyControl.addEventListener('mouseleave', () => setReveal(false));
      privacyControl.addEventListener('touchstart', (e) => { e.preventDefault(); setReveal(true); });
      privacyControl.addEventListener('touchend', () => setReveal(false));

      boardWrapper.appendChild(privacyControl);
    }

    // Last Move / Battle Recap Overlay
    if (this.phase === 'gameplay' && (this.showRecapHighlights || this.lastBattle || this.lastMoveRecap)) {
      const recapData = this.lastMoveRecap;
      if (recapData) {
        const battleBanner = document.createElement('div');
        battleBanner.className = 'last-battle-banner';
        battleBanner.innerHTML = `
          <span class="battle-title">⚔ LAST MOVE RECAP</span>
          <span class="battle-text">${recapData.summaryText}</span>
        `;
        boardWrapper.appendChild(battleBanner);
      }
    }

    this.container.appendChild(boardWrapper);
  }

  createSvgNetwork() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'junqi-svg-network');
    svg.setAttribute('viewBox', '0 0 880 600');

    const colX = [80, 260, 440, 620, 800];
    const rowY = [32, 76, 120, 164, 208, 252, 348, 392, 436, 480, 524, 568];

    let html = `<rect x="70" y="260" width="740" height="80" fill="rgba(231, 237, 244, 0.45)" rx="8" />`;
    html += `<line x1="70" y1="260" x2="810" y2="260" class="svg-rail-border" />`;
    html += `<line x1="70" y1="340" x2="810" y2="340" class="svg-rail-border" />`;
    html += `<text x="260" y="304" class="svg-river-label" text-anchor="middle">前线 · 铁路桥</text>`;
    html += `<text x="440" y="304" class="svg-river-label" text-anchor="middle">前线 · 界河</text>`;
    html += `<text x="620" y="304" class="svg-river-label" text-anchor="middle">前线 · 铁路桥</text>`;

    for (let c = 0; c < 5; c++) {
      html += `<line x1="${colX[c]}" y1="${rowY[0]}" x2="${colX[c]}" y2="${rowY[5]}" class="${(c===0||c===4)?'svg-rail':'svg-road'}" />`;
      html += `<line x1="${colX[c]}" y1="${rowY[6]}" x2="${colX[c]}" y2="${rowY[11]}" class="${(c===0||c===4)?'svg-rail':'svg-road'}" />`;
    }

    [0, 2, 4].forEach(c => {
      const lineClass = (c === 0 || c === 4) ? 'svg-rail-bridge' : 'svg-road';
      html += `<line x1="${colX[c]}" y1="${rowY[5]}" x2="${colX[c]}" y2="${rowY[6]}" class="${lineClass}" />`;
    });

    const railRows = [1, 5, 6, 10];
    for (let r = 0; r < 12; r++) {
      const isRail = railRows.includes(r);
      html += `<line x1="${colX[0]}" y1="${rowY[r]}" x2="${colX[4]}" y2="${rowY[r]}" class="${isRail?'svg-rail':'svg-road'}" />`;
    }

    const drawDiags = (r, c) => {
      const cx = colX[c], cy = rowY[r];
      html += `<line x1="${cx-180}" y1="${rowY[r-1]}" x2="${cx+180}" y2="${rowY[r+1]}" class="svg-road-diag" />`;
      html += `<line x1="${cx+180}" y1="${rowY[r-1]}" x2="${cx-180}" y2="${rowY[r+1]}" class="svg-road-diag" />`;
    };

    [1,3].forEach(r => [1,3].forEach(c => drawDiags(r,c)));
    drawDiags(2,2);
    [7,9].forEach(r => [1,3].forEach(c => drawDiags(r,c)));
    drawDiags(8,2);

    svg.innerHTML = html;
    return svg;
  }

  createNodeElement(row, col, canonicalKey) {
    const node = document.createElement('div');
    node.className = 'board-node-station';
    node.dataset.key = canonicalKey;

    // ONE-IPAD PERSPECTIVE: Determine display grid coordinates based on active player
    const isRedActiveInClassic = (this.gameMode === 'classic') && (this.phase === 'setup' ? this.setupStep === 'red' : this.activeTurn === 'red');
    
    const displayRow = isRedActiveInClassic ? (11 - row) : row;
    const displayCol = isRedActiveInClassic ? (4 - col) : col;

    const colXPercent = [9.09, 29.54, 50, 70.45, 90.9];
    const rowYPercent = [5.3, 12.6, 20.0, 27.3, 34.6, 42.0, 58.0, 65.3, 72.6, 80.0, 87.3, 94.6];

    node.style.left = `${colXPercent[displayCol]}%`;
    node.style.top = `${rowYPercent[displayRow]}%`;

    if (CAMPS.has(canonicalKey)) node.classList.add('station-camp');
    else if (HEADQUARTERS.has(canonicalKey)) node.classList.add('station-hq');
    else node.classList.add('station-post');

    if (this.phase === 'gameplay' && this.selectedCell && this.isLegalTarget(canonicalKey)) {
      node.classList.add('legal-target');
    }

    if (this.showRecapHighlights && this.lastMoveRecap) {
      if (this.lastMoveRecap.from === canonicalKey) node.classList.add('recap-highlight-from');
      if (this.lastMoveRecap.to === canonicalKey) node.classList.add('recap-highlight-to');
    }

    const piece = this.boardState[canonicalKey];
    if (piece) {
      const pieceEl = document.createElement('div');
      pieceEl.className = `junqi-piece ${piece.side}`;

      let isVisible = false;
      if (this.phase === 'setup') {
        const currentSetupSide = this.setupStep || 'navy';
        isVisible = (piece.side === currentSetupSide);
      } else if (this.gameMode === 'flip') {
        isVisible = !!piece.revealed;
      } else if (this.gameMode === 'vs_computer') {
        isVisible = (piece.side === 'navy') || !!piece.revealed;
      } else { // Classic 2-Player Gameplay
        if (piece.side === this.activeTurn) {
          isVisible = (this.privacyMode !== 'extra_privacy' || this.isExtraPrivacyRevealed);
        } else {
          // Concealed opponent pieces stay face-down backs unless flag is disclosed
          isVisible = !!piece.revealed;
        }
      }

      // Check if Flag disclosed due to Field Marshal elimination
      if (piece.name === '军旗' && this.flagDisclosed[piece.side]) {
        pieceEl.classList.add('flag-disclosed');
        if (piece.side !== this.activeTurn) {
          isVisible = true; // Expose Flag position to opponent!
        }
      }

      if (!isVisible) {
        pieceEl.classList.add('hidden-piece');
      } else {
        pieceEl.textContent = piece.name;
      }

      // FLIP MODE ARMY FACE ORIENTATION
      if (this.gameMode === 'flip' && piece.revealed && this.assignedColors.p2) {
        if (piece.side === this.assignedColors.p2) {
          pieceEl.classList.add('face-top-player'); // Rotate 180° for top player army
        }
      }

      if (this.phase === 'setup') {
        if (this.selectedSetupCell === canonicalKey) {
          pieceEl.classList.add('selected');
        }
      } else {
        if (this.selectedCell === canonicalKey) {
          pieceEl.classList.add('selected');
        }
      }

      node.appendChild(pieceEl);
    }

    node.addEventListener('click', () => this.handleNodeClick(canonicalKey, piece));
    return node;
  }

  handleNodeClick(key, piece) {
    if (this.isGameOver) return;

    if (this.phase === 'setup') {
      this.handleSetupClick(key, piece);
      return;
    }

    if (this.selectedCell === key) {
      this.selectedCell = null;
      sounds.playTap();
      this.render();
      return;
    }

    if (this.gameMode === 'flip') {
      this.handleFlipModeClick(key, piece);
      return;
    }

    if (piece && piece.side === this.activeTurn) {
      this.selectedCell = key;
      sounds.playSelect();
      this.render();

      if (piece.name === '工兵') showHint('ENGINEER_RAILWAY');
      else if (piece.name === '地雷') showHint('MINE_STATIC');
      else if (piece.name === '军旗') showHint('HQ_FLAG');
      return;
    }

    if (this.selectedCell) {
      const selectedPiece = this.boardState[this.selectedCell];
      const check = canPieceMove(selectedPiece, this.selectedCell, key, this.boardState);

      if (!check.allowed) {
        sounds.playInvalid();
        showHint('ILLEGAL_MOVE', check.reason);
        return;
      }

      this.executeMove(this.selectedCell, key);
    }
  }

  handleSetupClick(key, piece) {
    const currentSide = this.setupStep || 'navy';

    if (!this.selectedSetupCell) {
      if (piece && piece.side === currentSide) {
        this.selectedSetupCell = key;
        sounds.playSelect();
        this.render();
      } else {
        sounds.playInvalid();
        showHint('ILLEGAL_SETUP', `Tap a piece in your own territory (${currentSide === 'navy' ? 'Navy / Bottom' : 'Red / Top'}) to select it.`);
      }
      return;
    }

    const posA = this.selectedSetupCell;
    const pieceA = this.boardState[posA];

    if (posA === key) {
      this.selectedSetupCell = null;
      sounds.playTap();
      this.render();
      return;
    }

    const posB = key;
    const pieceB = this.boardState[posB];

    const [targetR] = posB.split('-').map(Number);
    const inTerritory = currentSide === 'navy' ? (targetR >= 6 && targetR <= 11) : (targetR >= 0 && targetR <= 5);

    if (!inTerritory) {
      sounds.playInvalid();
      showHint('ILLEGAL_SETUP', `Setup moves must stay inside your own ${currentSide === 'navy' ? 'Navy (bottom)' : 'Red (top)'} territory.`);
      return;
    }

    const check = validateSwapInSetup(pieceA, posA, pieceB, posB);
    if (!check.valid) {
      sounds.playInvalid();
      showHint('ILLEGAL_SETUP', check.reason);
      return;
    }

    if (pieceB) {
      this.boardState[posA] = pieceB;
      this.boardState[posB] = pieceA;
    } else {
      this.boardState[posB] = pieceA;
      delete this.boardState[posA];
    }

    this.selectedSetupCell = null;
    sounds.playMoveTok();
    this.saveState();
    this.render();
  }

  handleFlipModeClick(key, piece) {
    if (!piece) {
      if (this.selectedCell) {
        const selectedPiece = this.boardState[this.selectedCell];
        const check = canPieceMove(selectedPiece, this.selectedCell, key, this.boardState);
        if (!check.allowed) {
          sounds.playInvalid();
          showHint('ILLEGAL_MOVE', check.reason);
          return;
        }
        this.executeMove(this.selectedCell, key);
      }
      return;
    }

    if (!piece.revealed) {
      piece.revealed = true;
      sounds.playMoveTok();

      if (!this.assignedColors.p1) {
        this.assignedColors.p1 = piece.side;
        this.assignedColors.p2 = piece.side === 'navy' ? 'red' : 'navy';
      }

      this.selectedCell = null;
      this.endTurn();
      return;
    }

    const currentArmyColor = (this.activeTurn === 'navy') ? (this.assignedColors.p1 || 'navy') : (this.assignedColors.p2 || 'red');
    if (piece.revealed && piece.side === currentArmyColor) {
      this.selectedCell = key;
      sounds.playSelect();
      this.render();
      return;
    }

    if (this.selectedCell) {
      const selectedPiece = this.boardState[this.selectedCell];
      const check = canPieceMove(selectedPiece, this.selectedCell, key, this.boardState);
      if (!check.allowed) {
        sounds.playInvalid();
        showHint('ILLEGAL_MOVE', check.reason);
        return;
      }
      this.executeMove(this.selectedCell, key);
    }
  }

  executeMove(fromKey, toKey) {
    const attacker = this.boardState[fromKey];
    const defender = this.boardState[toKey];

    let summaryText = `Opponent moved ${fromKey} → ${toKey}`;

    if (!defender) {
      this.boardState[toKey] = attacker;
      delete this.boardState[fromKey];
      sounds.playMoveTok();
      this.lastBattle = null;
      summaryText = `${attacker.side.toUpperCase()} moved ${fromKey} → ${toKey}`;
    } else {
      sounds.playCombat();
      const outcome = resolveCombat(attacker, defender);

      if (outcome.fieldMarshalDefeatedSide) {
        this.flagDisclosed[outcome.fieldMarshalDefeatedSide] = true;
        showHint('COMMANDER_FALLEN', `Field Marshal (司令) defeated! Flag position is now disclosed!`);
      }

      if (outcome.winner === attacker) {
        this.boardState[toKey] = attacker;
        delete this.boardState[fromKey];
        // In Classic (暗棋), attacker does NOT become revealed to opponent!
        if (this.gameMode === 'flip') attacker.revealed = true;
        this.capturedPieces.push(defender);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `${attacker.name} Victory` };
        summaryText = `Battle at ${toKey}: ${attacker.side.toUpperCase()} captured opponent piece!`;
      } else if (outcome.winner === defender) {
        delete this.boardState[fromKey];
        if (this.gameMode === 'flip') defender.revealed = true;
        this.capturedPieces.push(attacker);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `${defender.name} Defended` };
        summaryText = `Battle at ${toKey}: ${defender.side.toUpperCase()} defended successfully!`;
      } else {
        delete this.boardState[fromKey];
        delete this.boardState[toKey];
        this.capturedPieces.push(attacker, defender);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `Mutual Destruction` };
        summaryText = `Battle at ${toKey}: Mutual Destruction! Both pieces removed.`;
      }

      if (outcome.gameOver) {
        this.isGameOver = true;
        this.winner = attacker.side;
        sounds.playVictory();
        this.saveState();
        this.render();
        return;
      }
    }

    this.lastMoveRecap = {
      from: fromKey,
      to: toKey,
      actingSide: attacker.side,
      summaryText: summaryText,
      timestamp: Date.now()
    };

    this.selectedCell = null;
    this.endTurn();
  }

  endTurn() {
    this.saveState();

    if (this.gameMode === 'vs_computer' && this.activeTurn === 'navy') {
      this.activeTurn = 'red';
      this.render();

      setTimeout(() => {
        const aiMove = this.ai.selectMove('red', this.boardState);
        if (aiMove) {
          const aiAttacker = this.boardState[aiMove.from];
          const aiDefender = this.boardState[aiMove.to];
          if (!aiDefender) {
            this.boardState[aiMove.to] = aiAttacker;
            delete this.boardState[aiMove.from];
            this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `Computer moved piece`, timestamp: Date.now() };
          } else {
            const outcome = resolveCombat(aiAttacker, aiDefender);
            if (outcome.fieldMarshalDefeatedSide) {
              this.flagDisclosed[outcome.fieldMarshalDefeatedSide] = true;
            }
            if (outcome.winner === aiAttacker) {
              this.boardState[aiMove.to] = aiAttacker;
              delete this.boardState[aiMove.from];
              this.capturedPieces.push(aiDefender);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `Computer attacked ${aiMove.to}: Your piece was captured`, timestamp: Date.now() };
            } else if (outcome.winner === aiDefender) {
              delete this.boardState[aiMove.from];
              this.capturedPieces.push(aiAttacker);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `Computer attacked ${aiMove.to}: Your piece defended successfully`, timestamp: Date.now() };
            } else {
              delete this.boardState[aiMove.from];
              delete this.boardState[aiMove.to];
              this.capturedPieces.push(aiAttacker, aiDefender);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `Computer attacked ${aiMove.to}: Mutual Destruction`, timestamp: Date.now() };
            }
          }
        }
        this.activeTurn = 'navy';
        this.saveState();
        this.render();
      }, 700);
      return;
    }

    const nextTurn = this.activeTurn === 'navy' ? 'red' : 'navy';

    if (this.gameMode === 'classic') {
      sounds.playPassCue();
      this.app.passManager.triggerTransition(`Player ${nextTurn === 'navy' ? '1' : '2'}`, () => {
        this.activeTurn = nextTurn;
        this.saveState();
        this.render();
        this.triggerLastMoveReplay();
      });
    } else {
      this.activeTurn = nextTurn;
      this.saveState();
      this.render();
    }
  }

  isLegalTarget(targetKey) {
    if (!this.selectedCell) return false;
    const piece = this.boardState[this.selectedCell];
    const check = canPieceMove(piece, this.selectedCell, targetKey, this.boardState);
    return check.allowed;
  }
}
