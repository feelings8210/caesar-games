/* Caesar Games — Contextual Hint & Practice Module */

export const HINTS = {
  ENGINEER_RAILWAY: {
    title: "工兵 Railway Turning",
    text: "工兵 (Engineer) can turn corners along any connected railway tracks in a single turn.",
    type: "rule"
  },
  MINE_STATIC: {
    title: "地雷 Static Defense",
    text: "地雷 (Mine) is stationary and cannot move. Only 工兵 or 炸弹 can disarm a Mine.",
    type: "rule"
  },
  CAMP_SAFE: {
    title: "行营 Protection",
    text: "行营 (Campsite) protects any piece inside it from being attacked by opponent pieces.",
    type: "rule"
  },
  HQ_FLAG: {
    title: "大本营 & 军旗",
    text: "军旗 (Flag) must stay in 大本营 (Headquarters) and cannot be moved.",
    type: "rule"
  },
  ILLEGAL_MOVE: {
    title: "Action Not Permitted",
    text: "This move is not allowed under Junqi rules.",
    type: "illegal"
  }
};

export function showHint(hintKey, customMessage = null) {
  const backdrop = document.getElementById('hint-popover-backdrop');
  const titleEl = document.getElementById('hint-title');
  const bodyEl = document.getElementById('hint-body');

  const hintData = HINTS[hintKey] || {
    title: "Tactical Rule",
    text: customMessage || "Select a valid destination to complete your move."
  };

  titleEl.textContent = hintData.title;
  bodyEl.textContent = customMessage || hintData.text;

  backdrop.classList.add('active');
}

export function hideHint() {
  const backdrop = document.getElementById('hint-popover-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

export function initHintListeners() {
  const backdrop = document.getElementById('hint-popover-backdrop');
  const closeBtn = document.getElementById('btn-close-hint');
  
  if (closeBtn) closeBtn.addEventListener('click', hideHint);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) hideHint();
    });
  }
}

/* Practice Interactive Mini-Board Setup */
export function initPracticeModule() {
  const mount = document.getElementById('practice-board-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="practice-mini-container">
      <div class="practice-header">
        <span>🎮 Interactive Rule Practice</span>
        <div class="practice-tabs">
          <button class="btn-prac active" data-rule="eng">Engineer Turns</button>
          <button class="btn-prac" data-rule="mine">Mine Disarm</button>
          <button class="btn-prac" data-rule="camp">Camp Immunity</button>
        </div>
      </div>
      <div class="practice-canvas" id="practice-canvas">
        <p style="font-size: 13.5px; color: var(--color-slate); text-align: center; margin-top: 24px;">Tap <strong>工兵</strong> to test corner turns along the railway track!</p>
      </div>
    </div>
  `;

  mount.querySelectorAll('.btn-prac').forEach(btn => {
    btn.addEventListener('click', (e) => {
      mount.querySelectorAll('.btn-prac').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const rule = btn.dataset.rule;
      const canvas = document.getElementById('practice-canvas');

      if (rule === 'eng') {
        canvas.innerHTML = `<p style="font-size: 13.5px; color: var(--color-navy-primary); font-weight:600; text-align: center; margin-top: 24px;">🚂 Practice: 工兵 can turn along connected railways around corners!</p>`;
      } else if (rule === 'mine') {
        canvas.innerHTML = `<p style="font-size: 13.5px; color: var(--color-red-primary); font-weight:600; text-align: center; margin-top: 24px;">💣 Practice: 工兵 disarms 地雷 safely, while regular pieces perish!</p>`;
      } else {
        canvas.innerHTML = `<p style="font-size: 13.5px; color: var(--color-gold-dark); font-weight:600; text-align: center; margin-top: 24px;">⛺ Practice: Any piece in 行营 (Campsite) is 100% immune from attack!</p>`;
      }
    });
  });
}
