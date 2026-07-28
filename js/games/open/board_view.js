import { XQ_FACES } from '../xiangqi/engine.js';
import { motionMs } from '../../ui/motion.js';

const CHESS_FACES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export class OpenBoardView {
  constructor(mount, onTap = () => {}) {
    this.mount = mount;
    this.onTap = onTap;
    this.gameType = null;
    this.lastCheckSide = null;
  }

  render({
    gameType, board, selected, legalTargets = [], bottomSide, inCheck,
    lastMove = null, interactive = true
  }) {
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
        const node = this.node(canonical, selected, legalTargets, interactive, lastMove);
        node.style.left = `${6 + vc * 11}%`;
        node.style.top = `${5 + vr * 10}%`;
        const p = board[canonical];
        if (p) {
          const piece = document.createElement('span');
          piece.className = `open-piece xq-piece side-${p.side}`;
          if (p.side !== bottomSide) piece.classList.add('faces-top');
          if (inCheck && p.side === inCheck && p.kind === 'g') {
            piece.classList.add('is-check');
            if (inCheck !== this.lastCheckSide) piece.classList.add('is-check-pulse');
          }
          const face = document.createElement('span');
          face.className = 'open-piece-face';
          face.textContent = XQ_FACES[p.side][p.kind];
          piece.appendChild(face);
          node.appendChild(piece);
        }
        root.appendChild(node);
      }
    } else if (gameType === 'gomoku') {
      const geometry = document.createElement('div');
      geometry.className = 'gomoku-geometry';
      geometry.setAttribute('aria-hidden', 'true');
      for (const [row, col] of [[3,3], [3,11], [7,7], [11,3], [11,11]]) {
        const star = document.createElement('i');
        star.style.left = `${col * (100 / 14)}%`;
        star.style.top = `${row * (100 / 14)}%`;
        geometry.appendChild(star);
      }
      root.appendChild(geometry);
      for (let row = 0; row < 15; row++) for (let col = 0; col < 15; col++) {
        const canonical = `${row},${col}`;
        const vr = bottomSide === 'b' ? row : 14 - row;
        const vc = bottomSide === 'b' ? col : 14 - col;
        const node = this.node(canonical, selected, legalTargets, interactive, lastMove);
        node.classList.add('gomoku-node');
        node.style.left = `${4 + vc * (92 / 14)}%`;
        node.style.top = `${4 + vr * (92 / 14)}%`;
        const p = board[canonical];
        if (p) {
          const piece = document.createElement('span');
          piece.className = `open-piece gomoku-stone side-${p.side}`;
          piece.appendChild(document.createElement('span')).className = 'open-piece-face';
          node.appendChild(piece);
        }
        root.appendChild(node);
      }
    } else {
      for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
        const fileIndex = bottomSide === 'w' ? vc : 7 - vc;
        const rank = bottomSide === 'w' ? 8 - vr : vr + 1;
        const canonical = `${String.fromCharCode(97 + fileIndex)}${rank}`;
        const node = this.node(canonical, selected, legalTargets, interactive, lastMove);
        node.classList.add('chess-square', (fileIndex + rank) % 2 ? 'is-light' : 'is-dark');
        const p = board[canonical];
        if (p) {
          const piece = document.createElement('span');
          piece.className = `open-piece chess-piece side-${p.side}`;
          if (inCheck && p.side === inCheck && p.kind === 'k') {
            piece.classList.add('is-check');
            if (inCheck !== this.lastCheckSide) piece.classList.add('is-check-pulse');
          }
          const face = document.createElement('span');
          face.className = 'open-piece-face';
          face.textContent = CHESS_FACES[p.side][p.kind];
          piece.appendChild(face);
          node.appendChild(piece);
        }
        root.appendChild(node);
      }
    }
    const overlay = document.createElement('div');
    overlay.className = 'open-motion-layer';
    root.appendChild(overlay);
    this.mount.appendChild(root);
    this.lastCheckSide = inCheck || null;
  }

  node(canonical, selected, legalTargets, interactive, lastMove = null) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'open-node';
    node.dataset.key = canonical;
    node.setAttribute('aria-label', canonical);
    node.tabIndex = interactive ? 0 : -1;
    if (!interactive) node.disabled = true;
    if (selected === canonical) node.classList.add('is-selected');
    if (legalTargets.includes(canonical)) node.classList.add('is-legal');
    if (lastMove?.from === canonical) node.classList.add('is-last-from');
    if (lastMove?.to === canonical) node.classList.add('is-last-to');
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

  nudge(key) {
    const piece = this.mount.querySelector(
      `.open-node[data-key="${CSS.escape(key)}"] .open-piece`
    );
    if (!piece) return Promise.resolve();
    return piece.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-3px)', offset: .30 },
      { transform: 'translateX(2px)', offset: .62 },
      { transform: 'translateX(0)' }
    ], {
      duration: motionMs(125),
      easing: 'cubic-bezier(.36,.07,.19,.97)'
    }).finished.catch(() => {});
  }

  async animatePlacement(to, { onContact = () => {} } = {}) {
    const board = this.mount.querySelector('.open-board');
    const target = this.rectFor(to);
    const piece = this.mount.querySelector(
      `.open-node[data-key="${CSS.escape(to)}"] .open-piece`
    );
    if (!board || !target || !piece) {
      onContact();
      return;
    }
    const br = board.getBoundingClientRect();
    const layer = board.querySelector('.open-motion-layer');
    const flyer = piece.cloneNode(true);
    flyer.classList.add('open-flyer', 'gomoku-placement-flyer');
    flyer.style.left = `${target.left - br.left + target.width / 2}px`;
    flyer.style.top = `${target.top - br.top + target.height / 2}px`;
    layer.appendChild(flyer);
    piece.style.visibility = 'hidden';
    const duration = motionMs(310);
    const drop = flyer.animate([
      { transform: 'translate(-50%,-76%) scale(1.16)', opacity: .72, filter: 'brightness(1.08)' },
      { transform: 'translate(-50%,-56%) scale(1.07)', opacity: 1, offset: .62 },
      { transform: 'translate(-50%,-50%) scale(.965)', opacity: 1, offset: .82 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
    ], {
      duration,
      easing: 'cubic-bezier(.18,.72,.22,1)',
      fill: 'forwards'
    });
    await Promise.race([
      new Promise(resolve => setTimeout(resolve, duration * .8)),
      drop.finished.catch(() => {})
    ]);
    onContact();
    await Promise.race([
      drop.finished.catch(() => {}),
      new Promise(resolve => setTimeout(resolve, duration + 70))
    ]);
    flyer.remove();
    piece.style.visibility = '';
  }

  async animateFrom(movingSnapshot, to, {
    capture = false,
    capturedSnapshot = null,
    castleSnapshot = null,
    promotion = null,
    onContact = () => {}
  } = {}) {
    const board = this.mount.querySelector('.open-board');
    const target = this.rectFor(to);
    const piece = this.mount.querySelector(`.open-node[data-key="${CSS.escape(to)}"] .open-piece`);
    const startRect = movingSnapshot?.rect;
    if (!board || !target || !piece || !startRect) {
      onContact();
      return;
    }
    const br = board.getBoundingClientRect();
    const layer = board.querySelector('.open-motion-layer');
    const flyer = movingSnapshot.piece.cloneNode(true);
    flyer.classList.add('open-flyer');
    flyer.style.left = `${startRect.left - br.left + startRect.width / 2}px`;
    flyer.style.top = `${startRect.top - br.top + startRect.height / 2}px`;
    layer.appendChild(flyer);
    piece.style.visibility = 'hidden';

    let ghost = null;
    if (capture && capturedSnapshot) {
      ghost = capturedSnapshot.piece;
      ghost.classList.add('open-flyer', 'open-capture-ghost');
      ghost.style.left = `${capturedSnapshot.rect.left - br.left + capturedSnapshot.rect.width / 2}px`;
      ghost.style.top = `${capturedSnapshot.rect.top - br.top + capturedSnapshot.rect.height / 2}px`;
      layer.appendChild(ghost);
    }

    const dx = target.left - startRect.left;
    const dy = target.top - startRect.top;
    const travelDuration = motionMs(this.gameType === 'xiangqi' ? 330 : 300);
    const travel = flyer.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      {
        transform: 'translate(-50%,-58%) scale(1.07)',
        opacity: 1,
        offset: .16
      },
      {
        transform: `translate(calc(-50% + ${dx * .78}px), calc(-58% + ${dy * .78}px)) scale(1.07)`,
        opacity: 1,
        offset: .76
      },
      {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${capture ? 1.04 : 1.02})`,
        opacity: 1
      }
    ], {
      duration: travelDuration,
      easing: 'cubic-bezier(.2,.72,.28,1)',
      fill: 'forwards'
    });

    let rookFlyer = null;
    let rookPiece = null;
    let rookTravel = null;
    if (castleSnapshot?.from && castleSnapshot.to) {
      const rookTarget = this.rectFor(castleSnapshot.to);
      rookPiece = this.mount.querySelector(
        `.open-node[data-key="${CSS.escape(castleSnapshot.to)}"] .open-piece`
      );
      if (rookTarget && rookPiece) {
        const rr = castleSnapshot.from.rect;
        rookFlyer = castleSnapshot.from.piece.cloneNode(true);
        rookFlyer.classList.add('open-flyer', 'is-castle-rook');
        rookFlyer.style.left = `${rr.left - br.left + rr.width / 2}px`;
        rookFlyer.style.top = `${rr.top - br.top + rr.height / 2}px`;
        layer.appendChild(rookFlyer);
        rookPiece.style.visibility = 'hidden';
        const rdx = rookTarget.left - rr.left;
        const rdy = rookTarget.top - rr.top;
        const passByLift = Math.max(12, rr.height * .34);
        rookTravel = rookFlyer.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${rdx * .62}px), calc(-50% + ${rdy * .62 - passByLift}px)) scale(1.015)`,
            opacity: 1,
            offset: .62
          },
          { transform: `translate(calc(-50% + ${rdx}px), calc(-50% + ${rdy}px)) scale(1.01)`, opacity: 1 }
        ], {
          duration: travelDuration,
          easing: 'cubic-bezier(.2,.72,.28,1)',
          fill: 'forwards'
        });
      }
    }

    this.lastMotion = { from: startRect, to: target, dx, dy, travel, rookTravel };
    await Promise.race([
      Promise.all([
        travel.finished.catch(() => {}),
        rookTravel?.finished.catch(() => {})
      ]),
      new Promise(resolve => setTimeout(resolve, travelDuration + 80))
    ]);

    onContact();
    const finishAnimations = [];
    if (capture && ghost) {
      finishAnimations.push(ghost.animate([
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(.955)', offset: .34 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.84)', offset: 1 }
      ], {
        duration: motionMs(225),
        easing: 'cubic-bezier(.28,.02,.3,1)',
        fill: 'forwards'
      }).finished.catch(() => {}));
      finishAnimations.push(flyer.animate([
        { filter: 'brightness(1)', offset: 0 },
        { filter: 'brightness(1.12)', offset: .34 },
        { filter: 'brightness(1)', offset: 1 }
      ], {
        duration: motionMs(150),
        easing: 'ease-out'
      }).finished.catch(() => {}));
    }

    if (promotion) {
      flyer.className = `${piece.className} open-flyer is-promoting`;
      flyer.innerHTML = piece.innerHTML;
      finishAnimations.push(flyer.animate([
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.88)`, opacity: .72 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.07)`, opacity: 1, offset: .72 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 1 }
      ], {
        duration: motionMs(210),
        easing: 'cubic-bezier(.2,.76,.26,1)',
        fill: 'forwards'
      }).finished.catch(() => {}));
    } else if (!capture) {
      finishAnimations.push(flyer.animate([
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.02)` },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)` }
      ], {
        duration: motionMs(110),
        easing: 'cubic-bezier(.2,.72,.28,1)'
      }).finished.catch(() => {}));
    }

    await Promise.race([
      Promise.all(finishAnimations),
      new Promise(resolve => setTimeout(resolve, motionMs(capture ? 260 : promotion ? 225 : 125)))
    ]);
    flyer.remove();
    rookFlyer?.remove();
    ghost?.remove();
    piece.style.visibility = '';
    if (rookPiece) rookPiece.style.visibility = '';
  }

  pauseForCapture(progress = .5) {
    const motion = this.lastMotion;
    if (!motion?.travel) return false;
    const duration = motion.travel.effect.getTiming().duration;
    motion.travel.pause();
    motion.travel.currentTime = duration * progress;
    if (motion.rookTravel) {
      motion.rookTravel.pause();
      motion.rookTravel.currentTime = duration * progress;
    }
    return true;
  }
}
