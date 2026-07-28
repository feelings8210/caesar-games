import { XQ_FACES } from '../xiangqi/engine.js';

const CHESS_FACES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export class OpenBoardView {
  constructor(mount, onTap = () => {}) {
    this.mount = mount;
    this.onTap = onTap;
    this.gameType = null;
  }

  render({ gameType, board, selected, legalTargets = [], bottomSide, inCheck, interactive = true }) {
    this.gameType = gameType;
    this.mount.innerHTML = '';
    const root = document.createElement('div');
    root.className = `open-board ${gameType}-board`;
    root.dataset.gameType = gameType;
    root.dataset.bottomSide = bottomSide;

    if (gameType === 'xiangqi') {
      root.innerHTML = `
        <div class="xq-geometry" aria-hidden="true">
          <span class="xq-river">楚河&nbsp;&nbsp;&nbsp;&nbsp;漢界</span>
          <i class="xq-palace xq-palace-top"></i><i class="xq-palace xq-palace-bottom"></i>
        </div>`;
      for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
        const canonical = `${r},${c}`;
        const vr = bottomSide === 'r' ? r : 9 - r;
        const vc = bottomSide === 'r' ? c : 8 - c;
        const node = this.node(canonical, selected, legalTargets, interactive);
        node.style.left = `${6 + vc * 11}%`;
        node.style.top = `${5 + vr * 10}%`;
        const p = board[canonical];
        if (p) {
          const piece = document.createElement('span');
          piece.className = `open-piece xq-piece side-${p.side}`;
          if (p.side !== bottomSide) piece.classList.add('faces-top');
          if (inCheck && p.side === inCheck && p.kind === 'g') piece.classList.add('is-check');
          piece.textContent = XQ_FACES[p.side][p.kind];
          node.appendChild(piece);
        }
        root.appendChild(node);
      }
    } else {
      for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
        const fileIndex = bottomSide === 'w' ? vc : 7 - vc;
        const rank = bottomSide === 'w' ? 8 - vr : vr + 1;
        const canonical = `${String.fromCharCode(97 + fileIndex)}${rank}`;
        const node = this.node(canonical, selected, legalTargets, interactive);
        node.classList.add('chess-square', (fileIndex + rank) % 2 ? 'is-light' : 'is-dark');
        const p = board[canonical];
        if (p) {
          const piece = document.createElement('span');
          piece.className = `open-piece chess-piece side-${p.side}`;
          if (inCheck && p.side === inCheck && p.kind === 'k') piece.classList.add('is-check');
          piece.textContent = CHESS_FACES[p.side][p.kind];
          node.appendChild(piece);
        }
        root.appendChild(node);
      }
    }
    const overlay = document.createElement('div');
    overlay.className = 'open-motion-layer';
    root.appendChild(overlay);
    this.mount.appendChild(root);
  }

  node(canonical, selected, legalTargets, interactive) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'open-node';
    node.dataset.key = canonical;
    node.tabIndex = interactive ? 0 : -1;
    if (!interactive) node.disabled = true;
    if (selected === canonical) node.classList.add('is-selected');
    if (legalTargets.includes(canonical)) node.classList.add('is-legal');
    node.addEventListener('click', () => this.onTap(canonical));
    return node;
  }

  rectFor(key) {
    return this.mount.querySelector(`.open-node[data-key="${CSS.escape(key)}"]`)?.getBoundingClientRect() || null;
  }

  captureSnapshot(key) {
    const node = this.mount.querySelector(`.open-node[data-key="${CSS.escape(key)}"]`);
    const piece = node?.querySelector('.open-piece');
    return piece ? { rect: node.getBoundingClientRect(), piece: piece.cloneNode(true) } : null;
  }

  async animateFrom(startRect, to, { capture = false, capturedSnapshot = null } = {}) {
    const board = this.mount.querySelector('.open-board');
    const target = this.rectFor(to);
    const piece = this.mount.querySelector(`.open-node[data-key="${CSS.escape(to)}"] .open-piece`);
    if (!board || !target || !piece || !startRect) return;
    const br = board.getBoundingClientRect();
    const flyer = piece.cloneNode(true);
    flyer.classList.add('open-flyer');
    flyer.style.left = `${startRect.left - br.left + startRect.width / 2}px`;
    flyer.style.top = `${startRect.top - br.top + startRect.height / 2}px`;
    board.querySelector('.open-motion-layer').appendChild(flyer);
    let ghost = null;
    if (capture && capturedSnapshot) {
      ghost = capturedSnapshot.piece;
      ghost.classList.add('open-flyer', 'open-capture-ghost');
      ghost.style.left = `${capturedSnapshot.rect.left - br.left + capturedSnapshot.rect.width / 2}px`;
      ghost.style.top = `${capturedSnapshot.rect.top - br.top + capturedSnapshot.rect.height / 2}px`;
      board.querySelector('.open-motion-layer').appendChild(ghost);
      ghost.animate([
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(.96)', offset: .55 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.82)', offset: 1 }
      ], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    }
    const dx = target.left - startRect.left;
    const dy = target.top - startRect.top;
    const animation = flyer.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${capture ? 1.06 : 1.02})`, opacity: 1 }
    ], { duration: capture ? 230 : 190, easing: 'cubic-bezier(.2,.72,.28,1)' });
    await Promise.race([animation.finished.catch(() => {}), new Promise(r => setTimeout(r, 300))]);
    flyer.remove();
    ghost?.remove();
  }
}
