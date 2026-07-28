/* Caesar Games — Pass the iPad Turn Transition */

export class PassIpadManager {
  constructor(appState) {
    this.appState = appState;
    this.currentPlayer = 'Player 1 (Navy)';
    this.nextPlayer = 'Player 2 (Red)';
    this.isTransitionActive = false;
  }

  triggerTransition(nextPlayerName, onReadyCallback) {
    this.nextPlayer = nextPlayerName || 'Player 2';
    this.onReadyCallback = onReadyCallback;
    this.isTransitionActive = true;

    const surface = document.getElementById('surface-pass-ipad');
    const titleEl = document.getElementById('pass-ipad-title');
    const descEl = document.getElementById('pass-ipad-desc');

    titleEl.textContent = `${this.nextPlayer}'s Turn`;
    descEl.textContent = `Please pass the iPad to ${this.nextPlayer}. Hidden information is safely hidden.`;

    surface.style.display = 'flex';
  }

  confirmReady() {
    const surface = document.getElementById('surface-pass-ipad');
    surface.style.display = 'none';
    this.isTransitionActive = false;

    if (this.onReadyCallback) {
      this.onReadyCallback();
    }
  }
}

export function initPassIpadListeners(passManager) {
  const readyBtn = document.getElementById('btn-pass-ready');
  if (readyBtn) {
    readyBtn.addEventListener('click', () => {
      passManager.confirmReady();
    });
  }
}
