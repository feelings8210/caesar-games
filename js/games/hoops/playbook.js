/* Caesar Games — Hoops IQ, Playbook
 *
 * Team systems taught as step-by-step walk-throughs. A play is a setup plus
 * steps; each step is narration and ordinary runner beats. Diagrams (cuts,
 * passes, dribbles, screens) and the "walk it" tasks for any position are
 * derived from the beats, so a new play is data only.
 *
 * Offense sets run "against air" (no defenders), as teams first learn them.
 * Defensive plays move the ball with the offense and ask the player to
 * move one defender to the right spot after every pass.
 *
 * Court feet as everywhere in Hoops IQ; inbounders stand just off the floor
 * (y < 0 on the baseline, |x| > 25 on the sideline).
 */

const T = (zh, en) => ({ zh, en });
const SCREEN = T('掩护！', 'Screen!');

export const CATEGORIES = [
  { id: 'offense', title: T('进攻体系', 'Offense') },
  { id: 'blob', title: T('底线发球', 'Baseline out of bounds') },
  { id: 'slob', title: T('边线发球', 'Sideline out of bounds') },
  { id: 'defense', title: T('防守体系', 'Defense') }
];

export const PLAYS = [
  /* ---------------------------------------------------------------- */
  {
    id: 'five-out',
    category: 'offense',
    title: T('五外：传切补位', '5-out: pass, cut, fill'),
    sub: T('传完就切，切完就补——五个人都在外线轮转。', 'Pass, cut to the rim, fill the spot — all five rotate on the perimeter.'),
    side: 'o',
    setup: { o1: [0, 28], o2: [17, 21], o3: [22, 4], o4: [-17, 21], o5: [-22, 4], ball: 'o1' },
    steps: [
      { say: T('1 号把球传给右侧翼的 2 号。', '#1 passes to #2 on the right wing.'),
        beats: [{ ms: 600, pass: 'o2' }] },
      { say: T('传完立刻切向篮下：这就是"传切"。', 'Right after the pass, #1 cuts hard to the rim — the give-and-go.'),
        beats: [{ ms: 900, move: { o1: [[2, 16], [3, 5]] } }] },
      { say: T('没接到球，1 号从篮下穿到左侧底角；5 号补到左侧翼，4 号补到弧顶。', 'No pass, so #1 clears to the left corner; #5 fills the left wing and #4 fills the top.'),
        beats: [{ ms: 1000, move: { o1: [[-10, 4], [-22, 4]], o5: [-17, 21], o4: [0, 28] } }] },
      { say: T('2 号把球回传给弧顶的 4 号，五个位置又站满了。', '#2 swings it back to #4 at the top — all five spots are filled again.'),
        beats: [{ ms: 600, pass: 'o4' }] },
      { say: T('4 号传给左侧翼的 5 号，再传切。节奏就是：传、切、补。', '#4 passes to #5 on the left wing and cuts again. The rhythm: pass, cut, fill.'),
        beats: [{ ms: 600, pass: 'o5' }, { ms: 900, move: { o4: [[-2, 16], [-3, 5]] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'horns-pnr',
    category: 'offense',
    title: T('牛角：挡拆', 'Horns: pick & roll'),
    sub: T('两个大个子站肘区，射手站底角，弧顶挡拆。', 'Bigs at both elbows, shooters in the corners, pick and roll at the top.'),
    side: 'o',
    setup: { o1: [0, 33], o4: [-8, 19], o5: [8, 19], o2: [-22, 4], o3: [22, 4], ball: 'o1' },
    steps: [
      { say: T('牛角站位：4、5 号在两个肘区，2、3 号在两个底角。1 号把球运到弧顶。', 'Horns set: #4 and #5 at the elbows, #2 and #3 in the corners. #1 brings it to the top.'),
        beats: [{ ms: 700, move: { o1: [0, 28] } }] },
      { say: T('5 号上提，在 1 号的右边做掩护。', '#5 steps up and sets the screen on #1\'s right.'),
        beats: [{ ms: 700, move: { o5: [2, 25.5] }, screen: 'o5', call: ['o5', SCREEN] }] },
      { say: T('1 号借掩护向右突破；5 号顺下；4 号拉到弧顶，给突破让出空间。', '#1 drives right off the screen; #5 rolls; #4 pops to the top to open the floor.'),
        beats: [{ ms: 1000, move: { o1: [[5, 27], [10, 21]], o5: [[1, 20], [1.5, 9]], o4: [[-6, 24], [-2, 28.5]] } }] },
      { say: T('读防守：顺下的 5 号空了就传给他。', 'Read it: if the roller is open, hit #5.'),
        beats: [{ ms: 550, pass: 'o5', move: { o5: [1, 7] } }] },
      { say: T('5 号上篮。如果篮下被补防，底角的 2、3 号就是下一个选择。', '#5 finishes. If help comes, the corners — #2 and #3 — are next.'),
        beats: [{ ms: 600, shot: 'make', move: { o5: [0.5, 6] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'pin-down',
    category: 'offense',
    title: T('射手绕掩护', 'Pin-down for the shooter'),
    sub: T('射手从篮下出发，借低位的掩护跑出来接球投篮。', 'The shooter starts under the rim and comes off a low screen for the catch and shoot.'),
    side: 'o',
    setup: { o1: [0, 28], o2: [0, 5.5], o4: [-7, 8], o5: [7, 8], o3: [20, 22], ball: 'o1' },
    steps: [
      { say: T('2 号是射手，站在篮下；4、5 号在两边低位准备掩护。', '#2, the shooter, waits under the rim; #4 and #5 are ready to screen on both blocks.'),
        beats: [{ ms: 600, move: { o1: [-3, 28] } }] },
      { say: T('4 号转身向下掩护，2 号借掩护绕到左侧翼。', '#4 turns and sets a down screen; #2 curls off it to the left wing.'),
        beats: [{ ms: 500, move: { o4: [-9, 10.5] }, screen: 'o4', call: ['o4', SCREEN] },
          { ms: 900, move: { o2: [[-4, 6], [-12, 13], [-17, 19.5]] } }] },
      { say: T('1 号传给 2 号，接球直接投。', '#1 hits #2, who shoots on the catch.'),
        beats: [{ ms: 600, pass: 'o2' }, { ms: 800, shot: 'make' }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'blob-stack',
    category: 'blob',
    title: T('一字排开（Stack）', 'Stack'),
    sub: T('四个人在罚球区一侧排成一列，听信号同时散开。', 'Four players line up on one side of the lane and break on the signal.'),
    side: 'o',
    setup: { o1: [8, -1.5], o5: [6, 5.5], o4: [6, 9], o3: [6, 12.5], o2: [6, 16], ball: 'o1' },
    steps: [
      { say: T('1 号在底线发球，其余四人在右侧罚球区边排成一列。', '#1 inbounds on the baseline; the other four line up along the right side of the lane.'),
        beats: [{ ms: 600, call: ['o1', T('一字！', 'Stack!')] }] },
      { say: T('拍球为号：2 号冲到弧顶接应，3 号切到右侧底角，4 号拉到左侧翼，5 号转身卡位要球。', 'On the slap: #2 sprints to the top as the safety, #3 cuts to the right corner, #4 pops to the left wing, #5 seals for the ball.'),
        beats: [{ ms: 1000, move: { o2: [[4, 20], [0, 27]], o3: [[10, 8], [20, 3.5]], o4: [[0, 12], [-16, 17]], o5: [3.5, 5.6] } }] },
      { say: T('第一选择是篮下卡位的 5 号。被堵就交给底角的 3 号，或者弧顶的 2 号安全接应。', 'First look: #5 sealed at the rim. If he is covered, #3 in the corner or #2 up top is the safe outlet.'),
        beats: [{ ms: 600, pass: 'o5' }, { ms: 550, shot: 'make', move: { o5: [1.5, 5.6] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'blob-box',
    category: 'blob',
    title: T('方块（Box）', 'Box'),
    sub: T('两个低位、两个肘区，用两个下掩护同时制造机会。', 'Two on the blocks, two at the elbows — two down screens at once.'),
    side: 'o',
    setup: { o1: [8, -1.5], o5: [6, 7], o4: [-6, 7], o3: [8, 18], o2: [-8, 18], ball: 'o1' },
    steps: [
      { say: T('方块站位：4、5 号在低位，2、3 号在肘区。', 'Box set: #4 and #5 on the blocks, #2 and #3 at the elbows.'),
        beats: [{ ms: 600, call: ['o1', T('方块！', 'Box!')] }] },
      { say: T('4 号向上给 2 号掩护，2 号绕到左侧底角；3 号向下给 5 号掩护，5 号上提到罚球线接应。', '#4 screens up for #2, who runs to the left corner; #3 screens down for #5, who steps up to the free-throw line.'),
        beats: [{ ms: 450, move: { o4: [-7, 12], o3: [6, 11] }, screen: ['o4', 'o3'], call: ['o4', SCREEN] },
          { ms: 1000, move: { o2: [[-7, 14], [-11, 6], [-20, 3.5]], o5: [[7.5, 12], [4, 19]] } }] },
      { say: T('掩护完的 3 号马上转身切向篮下——掩护人往往是最空的那个。', 'Right after screening, #3 turns and dives to the rim — the screener is often the open man.'),
        beats: [{ ms: 700, move: { o3: [2, 5.5] } }] },
      { say: T('发给篮下的 3 号上篮；被堵就找底角的 2 号三分，或者罚球线的 5 号。', 'Hit #3 at the rim; if not, #2 in the corner for three, or #5 at the line.'),
        beats: [{ ms: 600, pass: 'o3' }, { ms: 550, shot: 'make', move: { o3: [1, 5.6] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'slob-pnr',
    category: 'slob',
    title: T('先接应，再挡拆', 'Get it in, then pick & roll'),
    sub: T('边线发球先保证球安全进场，再马上打挡拆。', 'From the sideline: get the ball in safely first, then go straight into a pick and roll.'),
    side: 'o',
    setup: { o2: [26.5, 26], o1: [-4, 20], o5: [4, 24], o4: [-15, 12], o3: [12, 6], ball: 'o2' },
    steps: [
      { say: T('2 号在右侧边线发球，1 号要摆脱防守来接球。', '#2 takes it out on the right sideline; #1 has to get open to receive it.'),
        beats: [{ ms: 600, call: ['o2', T('发球！', 'Ball in!')] }] },
      { say: T('5 号给 1 号做掩护，1 号绕出来到右侧翼接球。', '#5 screens for #1, who comes around to the right wing for the catch.'),
        beats: [{ ms: 500, move: { o5: [1, 22] }, screen: 'o5', call: ['o5', SCREEN] },
          { ms: 900, move: { o1: [[-2, 22.5], [6, 27], [15, 27]] } }] },
      { say: T('2 号把球发给 1 号，然后进场跑到右侧底角；3 号换到左侧低位。', '#2 inbounds to #1 and runs in to the right corner; #3 moves across to the left block.'),
        beats: [{ ms: 600, pass: 'o1' }, { ms: 900, move: { o2: [[24, 18], [22, 4]], o3: [[10, 7], [-8, 5]] } }] },
      { say: T('5 号上来给 1 号挡拆：1 号向中路突破，5 号顺下。', '#5 comes up to set the ball screen: #1 attacks the middle, #5 rolls.'),
        beats: [{ ms: 700, move: { o5: [12.5, 25] }, screen: 'o5', call: ['o5', SCREEN] },
          { ms: 900, move: { o1: [[11, 26], [5, 18]], o5: [[10, 19], [3, 9]] } }] },
      { say: T('传给顺下的 5 号上篮。', 'Hit #5 on the roll for the layup.'),
        beats: [{ ms: 500, pass: 'o5' }, { ms: 550, shot: 'make', move: { o5: [1, 6] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'man-help',
    category: 'defense',
    title: T('人盯人：一传封、两传协', 'Man-to-man: deny one, help two'),
    sub: T('球每传一次，每个防守人都要重新站位。', 'Every pass, every defender moves.'),
    side: 'd',
    setup: {
      o1: [0, 28], o2: [17, 21], o3: [22, 4], o4: [-17, 21], o5: [-22, 4],
      d1: [0, 26], d2: [16, 19], d3: [20.5, 5], d4: [-16, 19], d5: [-20.5, 5],
      ball: 'o1'
    },
    steps: [
      { say: T('球在弧顶。防球的人贴紧；离球一传的 2、4 号防守人封住传球路线；离球两传的底角防守人收到篮下协防。', 'Ball at the top. On the ball: tight. One pass away (defending #2 and #4): deny the lane. Two passes away (the corners): sink to help.'),
        beats: [{ ms: 800, move: { d1: [0, 24.5], d2: [14.5, 21.5], d4: [-14.5, 21.5], d3: [12, 7], d5: [-12, 7] } }] },
      { say: T('球传到右侧翼：2 号的防守人防球；1 号和 3 号的防守人变成一传，封路线；左边两人变成两传，收到篮下。', 'Ball to the right wing: #2\'s defender takes the ball; #1\'s and #3\'s defenders are now one pass away — deny; the two on the left are two away — sink.'),
        beats: [{ ms: 600, pass: 'o2' }, { ms: 800, move: { d2: [15, 18], d1: [3, 25], d3: [19.5, 7], d4: [-6, 14], d5: [-6, 6] } }] },
      { say: T('球传到右侧底角：3 号的防守人防球并封底线；左下的 5 号防守人是"最低的人"，守住篮下。', 'Ball to the corner: #3\'s defender takes it and shuts the baseline; #5\'s defender is the low man and guards the rim.'),
        beats: [{ ms: 600, pass: 'o3' }, { ms: 800, move: { d3: [20, 5.5], d2: [18, 16.5], d1: [2, 17], d4: [-4, 12], d5: [-2, 6] } }] },
      { say: T('球转回弧顶：所有人回到第一步的位置。传球在空中时就要移动。', 'Ball back to the top: everyone recovers to step one. Move while the pass is in the air.'),
        beats: [{ ms: 600, pass: 'o2' }, { ms: 600, pass: 'o1' }, { ms: 800, move: { d1: [0, 24.5], d2: [14.5, 21.5], d3: [12, 7], d4: [-14.5, 21.5], d5: [-12, 7] } }] }
    ]
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'zone-23',
    category: 'defense',
    title: T('2-3 联防轮转', '2-3 zone shifts'),
    sub: T('两人在上、三人在下，整体随球移动，永远保护篮下。', 'Two up, three back — the whole zone slides with the ball and always protects the rim.'),
    side: 'd',
    setup: {
      o1: [0, 28], o2: [17, 20], o3: [22, 4], o4: [-17, 20], o5: [-22, 4],
      d1: [-6, 22], d2: [6, 22], d3: [-11, 9], d4: [11, 9], d5: [0, 8],
      ball: 'o1'
    },
    steps: [
      { say: T('基本站位：1、2 号防守人在罚球线两端，3、4 号在两侧低位，5 号在篮下中间。', 'Base: #1 and #2 at each end of the free-throw line, #3 and #4 on the blocks, #5 in the middle under the rim.'),
        beats: [{ ms: 600, move: { d1: [-5, 22], d2: [5, 22] } }] },
      { say: T('球到右侧翼：右上的 2 号防守人出去防球；1 号收到罚球线中间；4 号向底角方向移，5 号到强侧低位，3 号进到篮下。', 'Ball to the right wing: the top-right defender takes the ball; #1 slides to the middle of the line; #4 shades toward the corner, #5 to the ball-side block, #3 into the lane.'),
        beats: [{ ms: 600, pass: 'o2' }, { ms: 800, move: { d2: [14, 19], d1: [2, 20], d4: [14, 8], d5: [5, 7], d3: [-4, 9] } }] },
      { say: T('球到右侧底角：4 号防守人防底角；5 号挡在低位前面；2 号退回守侧翼和肘区；1 号守罚球线；3 号守弱侧篮下。', 'Ball to the corner: #4 takes the corner; #5 fronts the low post; #2 drops to cover the wing and elbow; #1 guards the free-throw line; #3 holds the weak-side rim.'),
        beats: [{ ms: 600, pass: 'o3' }, { ms: 800, move: { d4: [19, 5], d5: [7, 5.5], d2: [12, 14], d1: [2, 16], d3: [-3, 6] } }] },
      { say: T('球转回弧顶：整体回到基本站位。', 'Ball back to the top: the zone resets to its base.'),
        beats: [{ ms: 600, pass: 'o2' }, { ms: 600, pass: 'o1' }, { ms: 800, move: { d1: [-5, 22], d2: [5, 22], d3: [-11, 9], d4: [11, 9], d5: [0, 8] } }] }
    ]
  }
];

/* ---------------------------------------------------------------- *
 * Derived data: diagrams and walk-through tasks.
 * ---------------------------------------------------------------- */

const last = d => (Array.isArray(d[0]) ? d[d.length - 1] : d);
const pathOf = (from, d) => [from, ...(Array.isArray(d[0]) ? d : [d])];

/** Replay positions and ball holder up to (not including) step `n`. */
export function stateBefore(play, n) {
  const pos = Object.fromEntries(Object.entries(play.setup).filter(([k]) => /^[od]\d$/.test(k)).map(([k, v]) => [k, [...v]]));
  let holder = play.setup.ball || null;
  for (let i = 0; i < n; i++) {
    for (const b of play.steps[i].beats) {
      if (b.pass) holder = b.pass;
      for (const [id, d] of Object.entries(b.move || {})) pos[id] = [...last(d)];
    }
  }
  return { pos, holder };
}

/** Diagram marks for step `n`: cut / dribble / pass / screen polylines in court feet. */
export function stepDiagram(play, n) {
  const { pos, holder: h0 } = stateBefore(play, n);
  let holder = h0;
  const marks = [];
  for (const b of play.steps[n].beats) {
    if (b.pass && holder && pos[holder] && pos[b.pass]) {
      const to = b.move?.[b.pass] ? last(b.move[b.pass]) : pos[b.pass];
      marks.push({ type: 'pass', team: holder[0], pts: [pos[holder], to] });
      holder = b.pass;
    }
    const screens = [].concat(b.screen || []);
    for (const [id, d] of Object.entries(b.move || {})) {
      const pts = pathOf(pos[id], d);
      const type = screens.includes(id) ? 'screen' : id === holder ? 'dribble' : 'cut';
      marks.push({ type, team: id[0], id, pts });
      pos[id] = [...last(d)];
    }
  }
  return marks;
}

/** What player `pid` must do in step `n`, in order: passes they make and where they end up. */
export function stepTasks(play, n, pid) {
  const { pos } = stateBefore(play, n);
  let { holder } = stateBefore(play, n);
  const tasks = [];
  for (const b of play.steps[n].beats) {
    if (b.pass && holder === pid) tasks.push({ kind: 'pass', to: b.pass });
    if (b.pass) holder = b.pass;
    if (b.move?.[pid]) {
      const at = last(b.move[pid]);
      const prev = tasks[tasks.length - 1];
      if (prev && prev.kind === 'move') prev.at = at;
      else tasks.push({ kind: 'move', at, from: [...pos[pid]] });
      pos[pid] = [...at];
    }
  }
  // A step or two (a finish, a jab) is not a decision worth asking for.
  return tasks.filter(t => t.kind !== 'move' || Math.hypot(t.at[0] - t.from[0], t.at[1] - t.from[1]) >= 3);
}

/** Positions a learner can take: the side the play teaches, with something to do. */
export function rolesOf(play) {
  return Object.keys(play.setup)
    .filter(k => k[0] === play.side)
    .filter(k => play.steps.some((_, n) => stepTasks(play, n, k).length))
    .sort();
}
