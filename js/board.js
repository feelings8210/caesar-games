/* Caesar Games — Complete Interactive Junqi Board Controller */
import { canPieceMove, resolveCombat, generateLegalSetup, createStandardArmy, validateSwapInSetup, CAMPS, HEADQUARTERS, RAILWAYS } from './engine/rules.js';
import { LocalJunqiAI } from './engine/ai.js';
import { sounds } from './engine/sound.js';
import { showHint } from './hint.js';
import { saveActiveGame, getLastUsedNames } from './engine/persistence.js';

export class JunqiBoard {
  constructor(containerId, appController) {
    this.container = document.getElementById(containerId);
    this.app = appController;

    this.gameId = `game_${Date.now()}`;
    this.gameMode = 'vs_computer'; // 'vs_computer', 'classic', 'flip'
    this.privacyMode = 'standard';
    this.aiDifficulty = 'standard';

    this.player1Name = 'Caesar';
    this.player2Name = 'Computer';
    this.humanName = 'Caesar';

    this.activeTurn = 'navy';
    this.assignedColors = { p1: 'navy', p2: 'red' };
    this.isExtraPrivacyRevealed = false;

    this.phase = 'setup'; // 'setup' or 'gameplay'
    this.setupStep = 'navy';
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
    this.winner = null;

    this.ai = new LocalJunqiAI(this.aiDifficulty);

    this.startNewGame('vs_computer');
  }

  startNewGame(mode = 'vs_computer', options = {}) {
    const lastNames = getLastUsedNames();

    this.gameId = options.gameId || `game_${Date.now()}`;
    this.gameMode = mode;
    this.privacyMode = options.privacy || 'standard';
    this.aiDifficulty = options.aiDifficulty || 'standard';

    this.player1Name = options.player1Name || lastNames.p1 || 'Caesar';
    this.player2Name = options.player2Name || (mode === 'vs_computer' ? 'Computer' : (lastNames.p2 || 'Daddy'));
    this.humanName = options.humanName || lastNames.human || 'Caesar';

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
    this.winner = null;
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
    this.assignedColors = { p1: null, p2: null };
    const navyArmy = createStandardArmy('navy');
    const redArmy = createStandardArmy('red');
    const total50 = [...navyArmy, ...redArmy];

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
    
    if (this.boardState['4-0']) {
      this.boardState['5-0'] = this.boardState['4-0'];
      delete this.boardState['4-0'];
    }

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
    if (!saved) return;
    this.gameId = saved.gameId || `game_${Date.now()}`;
    this.gameMode = saved.mode || 'vs_computer';
    this.privacyMode = saved.privacyMode || 'standard';
    this.player1Name = saved.player1Name || 'Caesar';
    this.player2Name = saved.player2Name || (this.gameMode === 'vs_computer' ? 'Computer' : 'Daddy');
    this.humanName = saved.humanName || 'Caesar';
    this.activeTurn = saved.activeTurn || 'navy';
    this.boardState = saved.boardState || {};
    this.assignedColors = saved.assignedColors || { p1: 'navy', p2: 'red' };
    this.capturedPieces = saved.capturedPieces || [];
    this.turnHistory = saved.turnHistory || [];
    this.aiDifficulty = saved.aiDifficulty || 'standard';
    this.isGameOver = saved.status === 'Finished';
    this.winner = saved.winner || null;
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

  getSerializableState() {
    return {
      gameId: this.gameId,
      gameMode: this.gameMode,
      privacyMode: this.privacyMode,
      player1Name: this.player1Name,
      player2Name: this.player2Name,
      humanName: this.humanName,
      aiDifficulty: this.aiDifficulty,
      activeTurn: this.activeTurn,
      boardState: this.boardState,
      assignedColors: this.assignedColors,
      capturedPieces: this.capturedPieces,
      turnHistory: this.turnHistory,
      isGameOver: this.isGameOver,
      winner: this.winner,
      lastBattle: this.lastBattle,
      lastMoveRecap: this.lastMoveRecap,
      flagDisclosed: this.flagDisclosed,
      phase: this.phase,
      setupStep: this.setupStep,
      initialSetupSessionState: this.initialSetupSessionState
    };
  }

  saveState() {
    saveActiveGame(this.getSerializableState());
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
    sounds.playReady();

    if (this.gameMode === 'vs_computer') {
      const redArmy = generateLegalSetup('red');
      Object.keys(this.boardState).forEach(k => {
        if (this.boardState[k].side === 'red') delete this.boardState[k];
      });
      Object.assign(this.boardState, redArmy);

      this.phase = 'gameplay';
      this.activeTurn = 'navy';
      this.saveState();
      this.render();
      showHint('GAME_STARTED', 'Setup locked! Make your first move.');
      return;
    }

    if (this.gameMode === 'classic') {
      if (this.setupStep === 'navy') {
        sounds.playPassCue();
        this.app.passManager.triggerTransition(`${this.player2Name} (Setup)`, () => {
          this.setupStep = 'red';
          this.initialSetupSessionState = JSON.parse(JSON.stringify(this.boardState));
          this.saveState();
          this.render();
        });
      } else if (this.setupStep === 'red') {
        sounds.playPassCue();
        this.app.passManager.triggerTransition(`${this.player1Name} (Start Game)`, () => {
          this.phase = 'gameplay';
          this.activeTurn = 'navy';
          this.saveState();
          this.render();
          showHint('GAME_STARTED', `Both setups locked! ${this.player1Name}'s turn to move.`);
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
          turnLabel.textContent = `${this.humanName}'s Setup — Tap 2 pieces to swap`;
        } else {
          const pName = this.setupStep === 'navy' ? this.player1Name : this.player2Name;
          statusDot.className = `status-dot ${this.setupStep}`;
          turnLabel.textContent = `${pName} Setup — Tap 2 pieces to swap`;
        }
      } else {
        if (this.gameMode === 'vs_computer') {
          if (this.activeTurn === 'navy') {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = `${this.humanName}'s Turn (Navy)`;
          } else {
            statusDot.className = 'status-dot red';
            turnLabel.textContent = `${this.player2Name} Thinking...`;
          }
        } else if (this.gameMode === 'classic') {
          if (this.activeTurn === 'navy') {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = `${this.player1Name}'s Turn`;
          } else {
            statusDot.className = 'status-dot red';
            turnLabel.textContent = `${this.player2Name}'s Turn`;
          }
        } else if (this.gameMode === 'flip') {
          if (!this.assignedColors.p1) {
            statusDot.className = 'status-dot navy';
            turnLabel.textContent = `${this.player1Name}'s Turn — Reveal any piece`;
          } else {
            if (this.activeTurn === 'navy') {
              statusDot.className = 'status-dot navy';
              turnLabel.textContent = `${this.player1Name} (${(this.assignedColors.p1||'navy').toUpperCase()})`;
            } else {
              statusDot.className = 'status-dot red';
              turnLabel.textContent = `${this.player2Name} (${(this.assignedColors.p2||'red').toUpperCase()})`;
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

    if (this.phase === 'setup') {
      const setupBar = document.createElement('div');
      setupBar.className = 'setup-controls-bar';

      let titleText = 'Arrange Your Army';
      if (this.gameMode === 'vs_computer') {
        titleText = `${this.humanName}'s Setup — Tap 2 pieces to swap`;
      } else if (this.setupStep === 'navy') {
        titleText = `${this.player1Name} Setup — Tap 2 pieces to swap`;
      } else {
        titleText = `${this.player2Name} Setup — Tap 2 pieces to swap`;
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

    const svgLayer = this.createSvgNetwork();
    boardWrapper.appendChild(svgLayer);

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

    // Rematch / Game Over Card Overlay
    if (this.isGameOver) {
      const winnerName = this.winner === 'navy' ? (this.gameMode === 'vs_computer' ? this.humanName : this.player1Name) : (this.gameMode === 'vs_computer' ? this.player2Name : this.player2Name);
      
      const gameOverBanner = document.createElement('div');
      gameOverBanner.className = 'mode-modal-backdrop active';
      gameOverBanner.style.zIndex = '150';
      gameOverBanner.innerHTML = `
        <div class="mode-modal-card" style="width: 440px; text-align: center; gap: 16px;">
          <div class="mode-icon">🏆</div>
          <h2 style="font-size: 24px; color: var(--color-navy-primary);">${winnerName} Victory!</h2>
          <p style="font-size: 14px; color: var(--color-text-muted);">Match completed in ${this.turnHistory.length} moves.</p>
          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
            <button id="btn-rematch-again" class="btn btn-gold">Play Again</button>
            <button id="btn-rematch-record" class="btn btn-secondary">View Record</button>
            <button id="btn-rematch-home" class="btn btn-primary">Home</button>
          </div>
        </div>
      `;

      this.container.appendChild(gameOverBanner);

      setTimeout(() => {
        const pBtn = document.getElementById('btn-rematch-again');
        const rBtn = document.getElementById('btn-rematch-record');
        const hBtn = document.getElementById('btn-rematch-home');
        if (pBtn) pBtn.onclick = () => this.startNewGame(this.gameMode, { player1Name: this.player1Name, player2Name: this.player2Name, humanName: this.humanName, aiDifficulty: this.aiDifficulty });
        if (rBtn) rBtn.onclick = () => this.app.showGameRecord(this.gameId);
        if (hBtn) hBtn.onclick = () => this.app.showSurface('home');
      }, 0);
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
      } else {
        if (piece.side === this.activeTurn) {
          isVisible = (this.privacyMode !== 'extra_privacy' || this.isExtraPrivacyRevealed);
        } else {
          isVisible = !!piece.revealed;
        }
      }

      if (piece.name === '军旗' && this.flagDisclosed[piece.side]) {
        pieceEl.classList.add('flag-disclosed');
        if (piece.side !== this.activeTurn) {
          isVisible = true;
        }
      }

      if (!isVisible) {
        pieceEl.classList.add('hidden-piece');
      } else {
        pieceEl.textContent = piece.name;
      }

      if (this.gameMode === 'flip' && piece.revealed && this.assignedColors.p2) {
        if (piece.side === this.assignedColors.p2) {
          pieceEl.classList.add('face-top-player');
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
        showHint('ILLEGAL_SETUP', `Tap a piece in your own territory to select it.`);
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
      showHint('ILLEGAL_SETUP', `Setup moves must stay inside your own territory.`);
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

      this.turnHistory.push({
        moveNumber: this.turnHistory.length + 1,
        side: this.activeTurn,
        playerName: this.activeTurn === 'navy' ? this.player1Name : this.player2Name,
        from: key,
        to: key,
        type: 'reveal',
        summaryText: `${this.activeTurn === 'navy' ? this.player1Name : this.player2Name} revealed ${piece.name}`
      });

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
    const actingName = attacker.side === 'navy' ? (this.gameMode === 'vs_computer' ? this.humanName : this.player1Name) : this.player2Name;

    let summaryText = `${actingName} moved ${fromKey} → ${toKey}`;

    if (!defender) {
      this.boardState[toKey] = attacker;
      delete this.boardState[fromKey];
      sounds.playMoveTok();
      this.lastBattle = null;
      summaryText = `${actingName} moved ${fromKey} → ${toKey}`;
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
        if (this.gameMode === 'flip') attacker.revealed = true;
        this.capturedPieces.push(defender);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `${attacker.name} Victory` };
        summaryText = `${actingName} captured opponent piece at ${toKey}`;
      } else if (outcome.winner === defender) {
        delete this.boardState[fromKey];
        if (this.gameMode === 'flip') defender.revealed = true;
        this.capturedPieces.push(attacker);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `${defender.name} Defended` };
        summaryText = `${actingName} piece defeated at ${toKey}`;
      } else {
        sounds.playBothRemoved();
        delete this.boardState[fromKey];
        delete this.boardState[toKey];
        this.capturedPieces.push(attacker, defender);
        this.lastBattle = { attackerSide: attacker.side, attackerName: attacker.name, defenderName: defender.name, result: `Mutual Destruction` };
        summaryText = `Mutual Destruction at ${toKey}!`;
      }

      if (outcome.gameOver) {
        this.isGameOver = true;
        this.winner = attacker.side;
        sounds.playVictory();
      }
    }

    this.turnHistory.push({
      moveNumber: this.turnHistory.length + 1,
      side: attacker.side,
      playerName: actingName,
      from: fromKey,
      to: toKey,
      combatOccurred: !!defender,
      summaryText: summaryText
    });

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

    if (this.isGameOver) {
      this.render();
      return;
    }

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
            this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `${this.player2Name} moved piece`, timestamp: Date.now() };
          } else {
            const outcome = resolveCombat(aiAttacker, aiDefender);
            if (outcome.fieldMarshalDefeatedSide) {
              this.flagDisclosed[outcome.fieldMarshalDefeatedSide] = true;
            }
            if (outcome.winner === aiAttacker) {
              this.boardState[aiMove.to] = aiAttacker;
              delete this.boardState[aiMove.from];
              this.capturedPieces.push(aiDefender);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `${this.player2Name} attacked ${aiMove.to}: Your piece was captured`, timestamp: Date.now() };
            } else if (outcome.winner === aiDefender) {
              delete this.boardState[aiMove.from];
              this.capturedPieces.push(aiAttacker);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `${this.player2Name} attacked ${aiMove.to}: Your piece defended`, timestamp: Date.now() };
            } else {
              sounds.playBothRemoved();
              delete this.boardState[aiMove.from];
              delete this.boardState[aiMove.to];
              this.capturedPieces.push(aiAttacker, aiDefender);
              this.lastMoveRecap = { from: aiMove.from, to: aiMove.to, actingSide: 'red', summaryText: `${this.player2Name} attacked ${aiMove.to}: Mutual Destruction`, timestamp: Date.now() };
            }

            if (outcome.gameOver) {
              this.isGameOver = true;
              this.winner = 'red';
              sounds.playVictory();
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
      const nextPlayerName = nextTurn === 'navy' ? this.player1Name : this.player2Name;
      sounds.playPassCue();
      this.app.passManager.triggerTransition(nextPlayerName, () => {
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
