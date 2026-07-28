/* Caesar Games — Main Application Coordinator */
import { JunqiBoard } from './board.js';
import { initHintListeners, showHint, initPracticeModule } from './hint.js';
import { PassIpadManager, initPassIpadListeners } from './pass_ipad.js';
import { sounds } from './engine/sound.js';
import { hasSavedGame, loadGameState } from './engine/persistence.js';
import { runAutomatedTests } from './engine/test.js';

class AppController {
  constructor() {
    this.currentSurface = 'home';
    this.board = null;
    this.passManager = new PassIpadManager(this);

    this.init();
  }

  init() {
    this.bindNavigation();
    initHintListeners();
    initPassIpadListeners(this.passManager);
    initPracticeModule();

    // Initialize board instance
    this.board = new JunqiBoard('junqi-board-mount', this);

    // Run automated tests in background to verify game integrity
    const testSummary = runAutomatedTests();
    console.log('Automated tests executed:', testSummary);

    // Check saved game presence
    this.updateResumeButtonState();

    // Handle direct surface landing via URL parameters or hash
    const urlParams = new URLSearchParams(window.location.search);
    const surfaceParam = urlParams.get('surface');
    const modeParam = urlParams.get('mode');
    const modalParam = urlParams.get('modal');
    const hashParam = window.location.hash.replace('#', '');

    const initialSurface = surfaceParam || hashParam || 'home';
    this.switchSurface(initialSurface);

    // Mode routing
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

    // Modal routing
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

  updateResumeButtonState() {
    const resumeBtn = document.getElementById('btn-resume-junqi');
    if (resumeBtn) {
      if (hasSavedGame()) {
        resumeBtn.style.display = 'inline-flex';
      } else {
        resumeBtn.style.display = 'none';
      }
    }
  }

  switchSurface(surfaceId) {
    this.currentSurface = surfaceId;

    if (surfaceId === 'pass-ipad') {
      this.passManager.triggerTransition('Player 2');
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
    // Brand click returns to Home
    const brandLink = document.getElementById('brand-header-link');
    if (brandLink) {
      brandLink.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'home';
        this.switchSurface('home');
      });
    }

    // Mute toggle
    const muteBtn = document.getElementById('btn-sound-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = sounds.toggleMute();
        muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound';
      });
    }

    // Home Play -> opens Mode Selection Modal
    const playBtn = document.getElementById('btn-play-junqi');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        sounds.playTap();
        this.showModeSelectionModal();
      });
    }

    // Home Resume -> loads saved game state directly
    const resumeBtn = document.getElementById('btn-resume-junqi');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        sounds.playTap();
        const saved = loadGameState();
        if (saved) {
          this.board.loadState(saved);
          window.location.hash = 'board';
          this.switchSurface('board');
        }
      });
    }

    // Home Learn
    const learnBtn = document.getElementById('btn-learn-rules');
    if (learnBtn) {
      learnBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'learn';
        this.switchSurface('learn');
      });
    }

    // Board controls
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
        this.updateResumeButtonState();
      });
    }

    const passBtn = document.getElementById('btn-trigger-pass');
    if (passBtn) {
      passBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'pass-ipad';
        this.passManager.triggerTransition(`Player ${this.board.activeTurn === 'navy' ? '2' : '1'}`, () => {
          this.board.activeTurn = this.board.activeTurn === 'navy' ? 'red' : 'navy';
          this.board.saveState();
          this.board.render();
        });
      });
    }

    // Learn view back to board
    const learnBackBtn = document.getElementById('btn-learn-back');
    if (learnBackBtn) {
      learnBackBtn.addEventListener('click', () => {
        sounds.playTap();
        window.location.hash = 'board';
        this.switchSurface('board');
      });
    }

    // Mode Selection Modal Buttons
    this.bindModeModalListeners();
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
        this.board.startNewGame('vs_computer', { aiDifficulty: 'normal' });
        window.location.hash = 'board';
        this.switchSurface('board');
      });
    }

    const modeClassic = document.getElementById('btn-mode-2p-classic');
    if (modeClassic) {
      modeClassic.addEventListener('click', () => {
        sounds.playTap();
        this.hideModeSelectionModal();
        this.board.startNewGame('classic', { seating: 'side_by_side', privacy: 'standard' });
        window.location.hash = 'board';
        this.switchSurface('board');
      });
    }

    const modeFlip = document.getElementById('btn-mode-2p-flip');
    if (modeFlip) {
      modeFlip.addEventListener('click', () => {
        sounds.playTap();
        this.hideModeSelectionModal();
        this.board.startNewGame('flip');
        window.location.hash = 'board';
        this.switchSurface('board');
      });
    }
  }
}

// Immediate + Event-driven Bootstrap Fix for iOS Local File & WebApp previews
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
