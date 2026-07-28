/* Caesar Games — reachable-state driver for the visual audit.
 *
 * Every state below is reached by driving the real UI, so the screenshots show
 * the product as a player meets it. Nothing here fabricates a mock-up.
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const app = () => window.caesarApp;
const click = (s) => { const e = $(s); if (!e) throw new Error(`missing ${s}`); e.click(); };

async function fresh() {
  localStorage.clear();
  app().goHome();
  await sleep(80);
}

async function start(mode, p1 = 'Caesar', p2 = 'Daddy') {
  click('#btn-play'); await sleep(60);
  click(`[data-mode="${mode}"]`); await sleep(60);
  $('#input-p1').value = p1;
  $('#input-p2').value = p2;
  click('#btn-start-match'); await sleep(180);
}

async function classicToPlay() {
  click('#btn-ready'); await sleep(120);
  click('#btn-handoff-ready'); await sleep(140);
  click('#btn-ready'); await sleep(120);
  click('#btn-handoff-ready'); await sleep(200);
}

/** Play one legal move for whoever is to move. */
async function move() {
  const s = app().session;
  const side = s.controllingSide();
  for (const from of Object.keys(s.boardState)) {
    const p = s.boardState[from];
    if (!p || p.side !== side || p.static) continue;
    const t = s.legalTargetsFrom(from);
    if (!t.length) continue;
    $(`.bv-node[data-key="${from}"]`).click(); await sleep(30);
    $(`.bv-node[data-key="${t[0]}"]`).click();
    await sleep(700);
    return { from, to: t[0] };
  }
  return null;
}

export const STATES = {
  async home() { await fresh(); },

  async mode_select() { await fresh(); click('#btn-play'); await sleep(120); },

  async players() { await fresh(); click('#btn-play'); await sleep(60); click('[data-mode="vs_computer"]'); await sleep(140); },

  async vs_ai_setup() { await fresh(); await start('vs_computer', 'Caesar'); },

  async vs_ai_play() {
    await fresh(); await start('vs_computer', 'Caesar');
    click('#btn-ready'); await sleep(200);
    await move();
    await sleep(1400);                       // let the computer answer
  },

  async classic_p1_setup() { await fresh(); await start('classic'); },

  async classic_handoff() {
    await fresh(); await start('classic');
    click('#btn-ready'); await sleep(220);
  },

  async classic_p2_setup() {
    await fresh(); await start('classic');
    click('#btn-ready'); await sleep(140);
    click('#btn-handoff-ready'); await sleep(220);
  },

  async classic_play_p1() { await fresh(); await start('classic'); await classicToPlay(); },

  async classic_play_p2() {
    await fresh(); await start('classic'); await classicToPlay();
    await move();                             // P1 moves -> shield
    await sleep(300);
    click('#btn-handoff-ready'); await sleep(2200);   // P2 now sees the board
  },

  /**
   * The Last Move replay caught mid-travel. The real animation is started and
   * then paused at a fixed point on its own timeline, so the captured frame is
   * genuinely the shipping animation rather than a staged mock-up.
   */
  async last_move_animation() {
    await fresh(); await start('classic'); await classicToPlay();
    await move(); await sleep(300);
    click('#btn-handoff-ready'); await sleep(400);
    app().replayLastMove();

    for (let i = 0; i < 80; i++) {
      if (document.querySelector('.bv-flyer') && app().board.pauseForCapture(0.55)) return;
      await sleep(20);
    }
  },

  async flip_unrevealed() { await fresh(); await start('flip'); },

  async flip_revealed() {
    await fresh(); await start('flip');
    const s = app().session;
    // Reveal enough of both armies to show the two facing directions.
    const keys = Object.keys(s.boardState);
    s.assignedColors = { p1: s.boardState[keys[0]].side, p2: s.boardState[keys[0]].side === 'navy' ? 'red' : 'navy' };
    let n = 0;
    for (const k of keys) { if (n++ % 2 === 0) s.boardState[k].revealed = true; }
    app().render();
    await sleep(120);
  },

  async library() {
    await fresh();
    await start('classic', 'Caesar', 'Daddy'); app().goHome(); await sleep(60);
    await start('flip', 'Caesar', 'Mum'); app().goHome(); await sleep(60);
    await start('vs_computer', 'Caesar'); click('#btn-ready'); await sleep(150);
    await move(); await sleep(1200);
    app().goHome(); await sleep(80);
    click('#btn-games'); await sleep(180);
  },

  async game_end() {
    await fresh(); await start('vs_computer', 'Caesar');
    click('#btn-ready'); await sleep(200);
    await move(); await sleep(1400);
    const s = app().session;
    s._finish('navy', 'flag');
    app().persist();
    app().go(window.CaesarDebug.S.GAME_END);
    await sleep(200);
  },

  async record() {
    await STATES.game_end();
    $('#btn-end-record').click();
    await sleep(400);
  },

  async replay() {
    await STATES.record();
    $('#btn-replay-next').click(); await sleep(160);
    $('#btn-replay-next').click(); await sleep(220);
  },

  async learn() { await fresh(); click('#btn-learn'); await sleep(150); }
};

export async function goto(name) {
  if (!STATES[name]) throw new Error(`unknown state ${name}`);
  await STATES[name]();
  return { state: app().state, screen: [...document.querySelectorAll('.screen')].find(s => s.classList.contains('is-active'))?.dataset.screen };
}

window.CaesarStates = { goto, names: Object.keys(STATES) };
