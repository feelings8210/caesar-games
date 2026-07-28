/* Caesar Games — Main Application Coordinator */
import { JunqiBoard } from './board.js';
import { initHintListeners, showHint, initPracticeModule } from './hint.js';
import { PassIpadManager, initPassIpadListeners } from './pass_ipad.js';
import { sounds } from './engine/sound.js';
import { getLibrary, loadGameById, deleteGameById, getMostRecentActiveGame, getLastUsedNames, saveLastUsedNames, formatFriendlyDate } from './engine/persistence.js';
import { runAutomatedTests } from './engine/test.js';

class AppController {
  constructor() {
    this.currentSurface = 'home';
    this.board = null;
    this.passManager = new PassIpadManager(this);

    this.pendingMode = null;
    this.replayGame = null;
    this.replayStep = 0;
    this.replayTimer = null;

    this.init();
  }

  init() {
    this.bindNavigation();
    initHintListeners();
    initPassIpadListeners(this.passManager);
    initPracticeModule();

    this.board = new JunqiBoard('junqi-board-mount', this);

    const testSummary = runAutomatedTests();
    console.log('Automated tests executed:', testSummary);

    this.updateHomeMemoryStatus();

    const urlParams = new URLSearchParams(window.location.search);
    const surfaceParam = urlParams.get('surface');
    const modeParam = urlParams.get('mode');
    const modalParam = urlParams.get('modal');
    const hashParam = window.location.hash.replace('#', '');

    const initialSurface = surfaceParam || hashParam || 'home';
    this.switchSurface(initialSurface);

    if (modeParam === 'vs_computer') {
      this.board.startNewGame('vs_computer');
    } else if (modeParam === 'vs_computer_post_ai') {
      this.board.initVsComputerPostAiMove();
    } else if (modeParam === 'classic') {
      this.board.startNewGame('classic');
    } else if (modeParam === 'flip') {
      this.board.startNewGame('flip');
    } else if (modeParam === 'flip_midgame') {
      this.board.initFlipMidGame();
    }

    if (modalParam === 'true') {
      setTimeout(() => this.showModeSelectionModal(), 200);
    }

    if (urlParams.get('hint') === 'true' || hashParam === 'hint') {
      setTimeout(() => showHint('ENGINEER_RAILWAY'), 300);
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) this.switchSurface(hash);
    });
  }

  updateHomeMemoryStatus() {
    const resumeBtn = document.getElementById('btn-resume-junqi');
    const statusLine = document.getElementById('home-memory-status');

    const recentActive = getMostRecentActiveGame();
    const lib = getLibrary();

    if (resumeBtn) {
      if (recentActive) {
        resumeBtn.style.display = 'inline-flex';
        resumeBtn.textContent = 'Continue';
      } else {
        resumeBtn.style.display = 'none';
      }
    }

    if (statusLine) {
      if (recentActive) {
        const pTitle = `${recentActive.player1Name} vs ${recentActive.player2Name}`;
        statusLine.textContent = `${pTitle} · Continue`;
        statusLine.style.display = 'inline-block';
      } else if (lib.games && lib.games.length > 0) {
        statusLine.textContent = `${lib.games.length} ${lib.games.length === 1 ? 'game' : 'games'} recorded`;
        statusLine.style.display = 'inline-block';
      } else {
        statusLine.style.display = 'none';
      }
    }
  }

  switchSurface(surfaceId) {
    this.currentSurface = surfaceId;

    if (surfaceId === 'pass-ipad') {
      this.passManager.triggerTransition(`${this.board.activeTurn === 'navy' ? this.board.player1Name : this.board.player2Name}`);
      return;
    }

    const surfaces = document.querySelectorAll('.surface-view');
    surfaces.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`surface-${surfaceId}`);
    if (target) {
      target.classList.add('active');
      target.scrollTop = 0;
    }
  }

  bindNavigation() {
    const brandLink = document.getElementById('brand-header-link');
    if (brandLink) {
      brandLink.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'home';
        this.switchSurface('home');
        this.updateHomeMemoryStatus();
      });
    }

    const muteBtn = document.getElementById('btn-sound-toggle');
    if (muteBtn) {
      const isMuted = sounds.isMuted;
      muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound';
      muteBtn.addEventListener('click', () => {
        const muted = sounds.toggleMute();
        muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
      });
    }

    const playBtn = document.getElementById('btn-play-junqi');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        sounds.playTap();
        this.showModeSelectionModal();
      });
    }

    const resumeBtn = document.getElementById('btn-resume-junqi');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        sounds.playTap();
        const recent = getMostRecentActiveGame();
        if (recent) {
          this.board.loadState(recent);
          window.location.hash = 'board';
          this.switchSurface('board');
        }
      });
    }

    const gamesBtn = document.getElementById('btn-games-library');
    if (gamesBtn) {
      gamesBtn.addEventListener('click', () => {
        sounds.playTap();
        this.showGamesLibraryModal();
      });
    }

    const learnBtn = document.getElementById('btn-learn-rules');
    if (learnBtn) {
      learnBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'learn';
        this.switchSurface('learn');
      });
    }

    const boardRulesBtn = document.getElementById('btn-board-rules');
    if (boardRulesBtn) {
      boardRulesBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'learn';
        this.switchSurface('learn');
      });
    }

    const boardHintBtn = document.getElementById('btn-board-hint');
    if (boardHintBtn) {
      boardHintBtn.addEventListener('click', () => {
        sounds.playTap();
        showHint('ENGINEER_RAILWAY');
      });
    }

    const boardMenuBtn = document.getElementById('btn-board-menu');
    if (boardMenuBtn) {
      boardMenuBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'home';
        this.switchSurface('home');
        this.updateHomeMemoryStatus();
      });
    }

    const passBtn = document.getElementById('btn-trigger-pass');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        sounds.playTap();
        const nextName = this.board.activeTurn === 'navy' ? this.board.player2Name : this.board.player1Name;
        window.location.hash = 'pass-ipad';
        this.passManager.triggerTransition(nextName, () => {
          this.board.activeTurn = this.board.activeTurn === 'navy' ? 'red' : 'navy';
          this.board.saveState();
          this.board.render();
        });
      });
    }

    const learnBackBtn = document.getElementById('btn-learn-back');
    if (learnBackBtn) {
      learnBackBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'board';
        this.switchSurface('board');
      });
    }

    this.bindModeModalListeners();
    this.bindNameModalListeners();
    this.bindLibraryModalListeners();
    this.bindRecordModalListeners();
  }

  showModeSelectionModal() {
    const modal = document.getElementById('mode-selection-modal');
    if (modal) modal.classList.add('active');
  }

  hideModeSelectionModal() {
    const modal = document.getElementById('mode-selection-modal');
    if (modal) modal.classList.remove('active');
  }

  bindModeModalListeners() {
    const closeBtn = document.getElementById('btn-close-mode-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideModeSelectionModal());

    const modeVsComp = document.getElementById('btn-mode-vs-comp');
    if (modeVsComp) {
      modeVsComp.addEventListener('click', () => {
        sounds.playTap();
        this.hideModeSelectionModal();
        this.showNameSetupModal('vs_computer');
      });
    }

    const modeClassic = document.getElementById('btn-mode-2p-classic');
    if (modeClassic) {
      modeClassic.addEventListener('click', () => {
        sounds.playTap();
        this.hideModeSelectionModal();
        this.showNameSetupModal('classic');
      });
    }

    const modeFlip = document.getElementById('btn-mode-2p-flip');
    if (modeFlip) {
      modeFlip.addEventListener('click', () => {
        sounds.playTap();
        this.hideModeSelectionModal();
        this.showNameSetupModal('flip');
      });
    }
  }

  showNameSetupModal(mode) {
    this.pendingMode = mode;
    const modal = document.getElementById('player-names-modal');
    const titleEl = document.getElementById('name-modal-title');
    const p1Input = document.getElementById('input-p1-name');
    const p2Input = document.getElementById('input-p2-name');
    const p2Group = document.getElementById('group-p2-name');
    const aiGroup = document.getElementById('group-ai-difficulty');

    const lastNames = getLastUsedNames();

    if (mode === 'vs_computer') {
      titleEl.textContent = 'Vs Computer Setup';
      p1Input.value = lastNames.human || 'Caesar';
      p2Group.style.display = 'none';
      aiGroup.style.display = 'flex';
    } else {
      titleEl.textContent = '2 Players Setup';
      p1Input.value = lastNames.p1 || 'Caesar';
      p2Input.value = lastNames.p2 || 'Daddy';
      p2Group.style.display = 'flex';
      aiGroup.style.display = 'none';
    }

    if (modal) modal.classList.add('active');
  }

  hideNameSetupModal() {
    const modal = document.getElementById('player-names-modal');
    if (modal) modal.classList.remove('active');
  }

  bindNameModalListeners() {
    const closeBtn = document.getElementById('btn-close-name-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideNameSetupModal());

    const confirmBtn = document.getElementById('btn-start-game-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        sounds.playTap();
        const p1Name = document.getElementById('input-p1-name').value.trim() || 'Caesar';
        const p2Name = document.getElementById('input-p2-name').value.trim() || 'Daddy';
        const aiDiff = document.getElementById('select-ai-difficulty').value;

        if (this.pendingMode === 'vs_computer') {
          saveLastUsedNames({ human: p1Name, p1: p1Name });
          this.board.startNewGame('vs_computer', {
            player1Name: p1Name,
            player2Name: 'Computer',
            humanName: p1Name,
            aiDifficulty: aiDiff
          });
        } else {
          saveLastUsedNames({ p1: p1Name, p2: p2Name });
          this.board.startNewGame(this.pendingMode, {
            player1Name: p1Name,
            player2Name: p2Name,
            humanName: p1Name
          });
        }

        this.hideNameSetupModal();
        window.location.hash = 'board';
        this.switchSurface('board');
        this.updateHomeMemoryStatus();
      });
    }
  }

  showGamesLibraryModal() {
    const modal = document.getElementById('games-library-modal');
    const container = document.getElementById('games-list-container');
    if (!modal || !container) return;

    const lib = getLibrary();
    container.innerHTML = '';

    if (!lib.games || lib.games.length === 0) {
      container.innerHTML = `<p style="text-align: center; padding: 24px; color: var(--color-text-muted);">No recorded games yet. Play your first match!</p>`;
    } else {
      lib.games.forEach(g => {
        const item = document.createElement('div');
        item.className = 'game-item-card';

        const modeName = g.mode === 'vs_computer' ? 'Vs Computer' : (g.mode === 'classic' ? 'Classic' : 'Flip');
        const dateStr = formatFriendlyDate(g.updatedAt);
        const pTitle = `${g.player1Name} vs ${g.player2Name}`;
        const winnerBadge = g.status === 'Finished' ? ` · Winner: ${g.winner === 'navy' ? g.player1Name : g.player2Name}` : '';

        item.innerHTML = `
          <div class="game-item-details">
            <div class="game-item-title-row">
              <span class="game-item-players">${pTitle}</span>
              <span class="game-item-mode-badge">${modeName}</span>
            </div>
            <div class="game-item-meta">${dateStr} · ${g.moveCount} moves · <strong>${g.status}</strong>${winnerBadge}</div>
          </div>
          <div class="game-item-actions">
            ${g.status === 'In Progress' ? `<button class="btn-item-action primary btn-lib-resume" data-id="${g.gameId}">Resume</button>` : ''}
            ${g.status === 'Finished' ? `<button class="btn-item-action btn-lib-record" data-id="${g.gameId}">View Record</button>` : ''}
            <button class="btn-item-action btn-lib-again" data-id="${g.gameId}">Play Again</button>
            <button class="btn-item-action danger btn-lib-delete" data-id="${g.gameId}">Delete</button>
          </div>
        `;

        container.appendChild(item);
      });

      // Bind dynamic item buttons
      container.querySelectorAll('.btn-lib-resume').forEach(b => {
        b.onclick = () => {
          sounds.playTap();
          const game = loadGameById(b.dataset.id);
          if (game) {
            this.board.loadState(game);
            this.hideGamesLibraryModal();
            window.location.hash = 'board';
            this.switchSurface('board');
          }
        };
      });

      container.querySelectorAll('.btn-lib-record').forEach(b => {
        b.onclick = () => {
          sounds.playTap();
          this.hideGamesLibraryModal();
          this.showGameRecord(b.dataset.id);
        };
      });

      container.querySelectorAll('.btn-lib-again').forEach(b => {
        b.onclick = () => {
          sounds.playTap();
          const game = loadGameById(b.dataset.id);
          if (game) {
            this.hideGamesLibraryModal();
            this.board.startNewGame(game.mode, {
              player1Name: game.player1Name,
              player2Name: game.player2Name,
              humanName: game.humanName,
              aiDifficulty: game.aiDifficulty
            });
            window.location.hash = 'board';
            this.switchSurface('board');
          }
        };
      });

      container.querySelectorAll('.btn-lib-delete').forEach(b => {
        b.onclick = () => {
          if (confirm('Delete this game record?')) {
            sounds.playTap();
            deleteGameById(b.dataset.id);
            this.showGamesLibraryModal();
            this.updateHomeMemoryStatus();
          }
        };
      });
    }

    modal.classList.add('active');
  }

  hideGamesLibraryModal() {
    const modal = document.getElementById('games-library-modal');
    if (modal) modal.classList.remove('active');
  }

  bindLibraryModalListeners() {
    const closeBtn = document.getElementById('btn-close-library-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideGamesLibraryModal());
  }

  showGameRecord(gameId) {
    const game = loadGameById(gameId);
    if (!game) return;

    this.replayGame = game;
    this.replayStep = 0;

    const modal = document.getElementById('game-record-modal');
    const titleEl = document.getElementById('record-modal-title');
    const metaBar = document.getElementById('record-meta-bar');
    const historyList = document.getElementById('record-history-list');

    titleEl.textContent = `${game.player1Name} vs ${game.player2Name} — Match Record`;
    const modeName = game.mode === 'vs_computer' ? 'Vs Computer' : (game.mode === 'classic' ? 'Classic' : 'Flip');
    metaBar.innerHTML = `<span>Mode: <strong>${modeName}</strong></span> <span>Date: <strong>${formatFriendlyDate(game.startedAt)}</strong></span> <span>Status: <strong>${game.status}</strong></span>`;

    // Render public history table
    let html = `<table class="history-table"><thead><tr><th>Move #</th><th>Player</th><th>Action</th><th>Details</th></tr></thead><tbody>`;
    if (!game.turnHistory || game.turnHistory.length === 0) {
      html += `<tr><td colspan="4" style="text-align: center;">No moves recorded.</td></tr>`;
    } else {
      game.turnHistory.forEach((h, idx) => {
        html += `<tr><td>${idx + 1}</td><td>${h.playerName}</td><td>${h.from} → ${h.to}</td><td>${h.summaryText}</td></tr>`;
      });
    }
    html += `</tbody></table>`;
    historyList.innerHTML = html;

    this.updateReplayStepLabel();
    if (modal) modal.classList.add('active');
  }

  hideGameRecordModal() {
    const modal = document.getElementById('game-record-modal');
    if (modal) modal.classList.remove('active');
    if (this.replayTimer) clearInterval(this.replayTimer);
  }

  updateReplayStepLabel() {
    const label = document.getElementById('replay-step-label');
    if (!label || !this.replayGame) return;
    const total = (this.replayGame.turnHistory || []).length;
    label.textContent = `Move ${this.replayStep} / ${total}`;
  }

  bindRecordModalListeners() {
    const closeBtn = document.getElementById('btn-close-record-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideGameRecordModal());

    const prevBtn = document.getElementById('btn-replay-prev');
    const nextBtn = document.getElementById('btn-replay-next');
    const playBtn = document.getElementById('btn-replay-play');

    if (prevBtn) {
      prevBtn.onclick = () => {
        sounds.playTap();
        if (this.replayStep > 0) this.replayStep--;
        this.updateReplayStepLabel();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        sounds.playTap();
        const total = (this.replayGame.turnHistory || []).length;
        if (this.replayStep < total) this.replayStep++;
        this.updateReplayStepLabel();
      };
    }

    if (playBtn) {
      playBtn.onclick = () => {
        sounds.playTap();
        const total = (this.replayGame.turnHistory || []).length;
        if (this.replayTimer) {
          clearInterval(this.replayTimer);
          this.replayTimer = null;
          playBtn.textContent = '▶ Play';
        } else {
          playBtn.textContent = '⏸ Pause';
          this.replayTimer = setInterval(() => {
            if (this.replayStep < total) {
              this.replayStep++;
              this.updateReplayStepLabel();
            } else {
              clearInterval(this.replayTimer);
              this.replayTimer = null;
              playBtn.textContent = '▶ Play';
            }
          }, 1200);
        }
      };
    }
  }
}

function bootstrapApp() {
  if (!window.caesarApp) {
    window.caesarApp = new AppController();
    console.log('[Caesar Games] AppController successfully initialized!');
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
