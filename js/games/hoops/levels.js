/* Caesar Games — Hoops IQ, Chapter 1: Read the Defense
 *
 * Every level is one real game moment for a trained 12+ player:
 * watch the action, it freezes at the read, the player acts on the floor.
 *
 * Teaching model (see docs/HOOPS_IQ.md): See it → Recognize it → React.
 * Each level names one visual clue (`cue`), one if/then rule (`rule`), and
 * grades every option 3 (best read), 1 (playable) or 0 (wrong read).
 *
 * Court: feet, x -25..25 sideline to sideline, y 0 baseline .. 47 half line.
 * The rim is at (0, 5.25). Offense ids o1..o5, defense d1..d5; the number is
 * the position, which also sets the drawn size (guards small, bigs large).
 */

const T = (zh, en) => ({ zh, en });

export const CHAPTER = {
  id: 'read-the-defense',
  title: T('读懂防守', 'Read the Defense'),
  sub: T('十个比赛瞬间：看清楚，定格，做决定。', 'Ten game moments. Watch, freeze, decide.')
};

export const LEVELS = [
  /* 1 ------------------------------------------------------------- */
  {
    id: 'backdoor',
    title: T('反跑', 'Backdoor'),
    concept: T('被绕前防守时', 'Beating the overplay'),
    you: 'o2',
    decide: 6,
    setup: {
      o1: [-4, 30], o2: [16, 15], o3: [-22, 4], o4: [-18, 22], o5: [-9, 19],
      d1: [-3.5, 26.5], d2: [14, 15.5], d3: [-19, 6], d4: [-14.5, 19.5], d5: [-7, 16],
      ball: 'o1'
    },
    intro: [
      { ms: 900, move: { o1: [2, 28.5], d1: [1.8, 25], o2: [[18, 19], [18.6, 22]], d2: [[15.8, 19], [15.6, 23]] }, sfx: 'squeak' },
      { ms: 700, move: { o2: [19, 23], d2: [16.2, 24.2] } }
    ],
    prompt: T('你是 2 号，想在侧翼接球，但防守人贴在你和球之间。', 'You are #2. You want the ball on the wing, but your defender is between you and the ball.'),
    cue: { at: 'd2', text: T('他的手和脚都堵在传球路线上——他身后到篮下是空的。', 'His hand and foot are in the passing lane — the space behind him to the rim is empty.') },
    options: [
      {
        kind: 'spot', at: [4, 7], label: T('反跑篮下', 'Backdoor cut'), grade: 3, end: 'score',
        result: T('反跑、击地传球、上篮得分！', 'Backdoor, bounce pass, layup!'),
        why: T('他越想断球，身后就越空。一脚蹬地转身直插篮下，控卫击地传球就到了。', 'The harder he denies, the more open the space behind him. Plant, turn, sprint to the rim — the bounce pass is there.'),
        play: [
          { ms: 520, move: { o2: [[17, 19], [11, 12.5]], d2: [[16.5, 22], [14, 17]] }, sfx: 'squeak' },
          { ms: 480, pass: 'o2', move: { o2: [4.5, 7.5], d2: [9, 11.5], d5: [-3.5, 10] } },
          { ms: 520, shot: 'make', move: { o2: [2, 5.8], d2: [5, 8.5] } }
        ]
      },
      {
        kind: 'spot', at: [21.5, 28], label: T('继续往外要球', 'Fight out wider'), grade: 0, end: 'turnover',
        result: T('传球被断！', 'Pass stolen!'),
        why: T('你往外跑，他也跟着堵在路线上。控卫硬传，正好传到他手里。', 'You drift out, he stays in the lane. The forced pass goes straight to him.'),
        play: [
          { ms: 620, move: { o2: [21.5, 28], d2: [18.4, 27.8] } },
          { ms: 460, pass: 'd2', move: { d2: [16.5, 28.5] } },
          { ms: 760, move: { d2: [9, 43], o2: [16, 36] }, sfx: 'squeak' }
        ]
      },
      {
        kind: 'spot', at: [10, 29], label: T('拉高接球', 'Come high'), grade: 1, end: 'neutral',
        result: T('接到了，但离篮筐太远。', 'Caught it — but far from the rim.'),
        why: T('能接到球，进攻也没丢。可你离篮筐 25 英尺，防守已经重新站好，机会没了。', 'You got the ball and kept possession, but 25 feet out with the defense reset. The chance is gone.'),
        play: [
          { ms: 650, move: { o2: [10, 29], d2: [9.5, 25.5] } },
          { ms: 420, pass: 'o2' }
        ]
      }
    ],
    rule: T('被绕前，就反跑。', 'Overplayed? Go backdoor.')
  },

  /* 2 ------------------------------------------------------------- */
  {
    id: 'drive-kick',
    title: T('突破分球', 'Drive & kick'),
    concept: T('读补防', 'Reading the help'),
    you: 'o1',
    decide: 5,
    setup: {
      o1: [0, 29], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [-8, 5],
      d1: [0, 25.5], d2: [-14, 18.5], d3: [19, 5], d4: [-19, 5.5], d5: [-5, 6.5],
      ball: 'o1'
    },
    intro: [
      { ms: 450, move: { o1: [-1.5, 28.5], d1: [-1.4, 25.2] } },
      { ms: 850, move: { o1: [[4, 24], [7, 15.5]], d1: [[3, 22], [5, 18]], d3: [13, 8.5] }, sfx: 'squeak' },
      { ms: 550, move: { o1: [7, 13], d1: [5.2, 16.2], d3: [9, 10], d5: [-2, 7] } }
    ],
    prompt: T('你突破过了自己的防守人，正冲进三秒区。', 'You beat your man and you are attacking the lane.'),
    cue: { at: 'd3', text: T('3 号的防守人离开了底角来堵你——底角空了。', "#3's defender left the corner to stop you — the corner is open.") },
    options: [
      {
        kind: 'pass', to: 'o3', grade: 3, end: 'score',
        result: T('分给底角，三分命中！', 'Kick to the corner — three is good!'),
        why: T('补防的人从哪来，空位就在哪。底角三分是球场上最近的三分。', 'Where the help comes from, that is where the open man is. The corner three is the shortest three on the floor.'),
        play: [
          { ms: 520, pass: 'o3', move: { d3: [14, 7.5], o1: [7.5, 12] } },
          { ms: 800, shot: 'make', move: { d3: [19.5, 5] } }
        ]
      },
      {
        kind: 'shoot', label: T('上篮', 'Finish'), grade: 0, end: 'miss',
        result: T('被封盖！', 'Blocked!'),
        why: T('补防的人已经到了篮下，再加上 5 号的防守人，硬上就是撞墙。', 'The helper is already there, and the big is coming too. Forcing it means running into a wall.'),
        play: [
          { ms: 320, move: { o1: [5, 9.5], d3: [5.5, 8], d5: [1.5, 7] } },
          { ms: 520, shot: 'block' },
          { ms: 450, ball: 'd5', move: { d5: [4, 9] } }
        ]
      },
      {
        kind: 'pass', to: 'o2', grade: 1, end: 'neutral',
        result: T('安全转移，但错过了空位。', 'Safe swing — but you missed the open man.'),
        why: T('没有失误，可 2 号身边有人。真正的空位在另一侧底角。', 'No turnover, but #2 is guarded. The truly open player was in the other corner.'),
        play: [
          { ms: 700, pass: 'o2', move: { d2: [-15.5, 19.5], d3: [16, 6] } }
        ]
      },
      {
        kind: 'pass', to: 'o5', grade: 0, end: 'turnover',
        result: T('传球被碰掉！', 'Deflected!'),
        why: T('传给篮下要穿过 5 号的防守人，他就站在路线上。', 'The pass to the block goes right through the big defender standing in the lane.'),
        play: [
          { ms: 420, pass: 'd5', move: { d5: [-1, 7.5] } },
          { ms: 600, move: { d5: [-3, 16] } }
        ]
      }
    ],
    rule: T('谁来补防，谁的人就空了。', 'Whoever helps leaves someone open.')
  },

  /* 3 ------------------------------------------------------------- */
  {
    id: 'pnr-roll',
    title: T('挡拆：顺下', 'Pick & roll: the roll'),
    concept: T('大个子扑出来时', 'When the big steps up'),
    you: 'o1',
    decide: 5,
    setup: {
      o1: [-2, 30], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [6, 18],
      d1: [-2, 26.5], d2: [-14, 18], d3: [18.5, 6], d4: [-18, 6.5], d5: [5, 15],
      ball: 'o1'
    },
    intro: [
      { ms: 800, move: { o5: [1.2, 27.2], d5: [2.5, 22] }, call: ['o5', T('掩护！', 'Screen!')] },
      { ms: 700, move: { o1: [[2, 31], [6, 27]], d1: [[-0.5, 28.4], [0.8, 29.4]], d5: [5.8, 24.6] }, sfx: 'squeak' },
      { ms: 600, move: { o1: [8, 26.5], d5: [8.6, 24.3], o5: [1.5, 19.5], d1: [3, 29.2], d4: [-14, 7.5] } }
    ],
    prompt: T('5 号给你挡了一下，他的防守人扑上来堵你。', '#5 set the screen and his defender jumped out to stop you.'),
    cue: { at: 'd5', text: T('大个子防守人扑到了你面前，他本该守的篮下现在没人。', 'The big defender is out in front of you — the rim he should protect is empty.') },
    options: [
      {
        kind: 'pass', to: 'o5', grade: 3, end: 'score',
        result: T('顺下接球，扣篮！', 'Roll, catch, dunk!'),
        why: T('两个人都在防你，就等于 5 号没人防。趁弱侧还没补过来，马上给他。', 'Two defenders on you means nobody on #5. Get it to him before the weak side rotates.'),
        play: [
          { ms: 480, pass: 'o5', move: { o5: [0.8, 12.5], d4: [-8, 8] } },
          { ms: 520, shot: 'make', move: { o5: [0.4, 7], d4: [-3.5, 7.2] } }
        ]
      },
      {
        kind: 'shoot', label: T('急停三分', 'Pull-up three'), grade: 0, end: 'miss',
        result: T('被干扰，没进。', 'Contested — no good.'),
        why: T('大个子就在你面前举着手，这是全场最难的一投。', 'The big is right in your face with a hand up. It is the hardest shot on the floor.'),
        play: [
          { ms: 750, shot: 'miss', move: { d5: [8.3, 25.6], d4: [-3, 8] } },
          { ms: 480, ball: 'd4' }
        ]
      },
      {
        kind: 'spot', at: [14, 23.5], label: T('继续往边线运', 'Keep dribbling wide'), grade: 0, end: 'turnover',
        result: T('被包夹，传球被断！', 'Trapped — pass stolen!'),
        why: T('往边线跑正中防守下怀：边线就像第三个防守人，你被两个人夹住了。', 'Going wide plays into the trap: the sideline is a third defender and two players close on you.'),
        play: [
          { ms: 620, move: { o1: [14, 23.5], d5: [12.8, 21.8], d1: [15, 26.5] }, sfx: 'squeak', call: ['o1', T('被包夹！', 'Trapped!')] },
          { ms: 600, pass: 'd3', move: { d3: [17, 11] } }
        ]
      }
    ],
    rule: T('大个子扑出来，就找顺下。', 'Big steps up? Hit the roller.')
  },

  /* 4 ------------------------------------------------------------- */
  {
    id: 'pnr-drop',
    title: T('挡拆：急停', 'Pick & roll: pull-up'),
    concept: T('大个子退后时', 'When the big drops'),
    you: 'o1',
    decide: 5,
    setup: {
      o1: [-2, 30], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [6, 18],
      d1: [-2, 26.5], d2: [-14, 18], d3: [18.5, 6], d4: [-18, 6.5], d5: [5, 15],
      ball: 'o1'
    },
    intro: [
      { ms: 800, move: { o5: [1.2, 27.2], d5: [2, 20] }, call: ['o5', T('掩护！', 'Screen!')] },
      { ms: 700, move: { o1: [[2, 31], [5.5, 26]], d1: [[-0.5, 28.4], [0.5, 29.8]], d5: [2, 15] }, sfx: 'squeak' },
      { ms: 600, move: { o1: [6, 22], o5: [1.5, 19], d5: [1.8, 13], d1: [3.2, 27.5] } }
    ],
    prompt: T('同样的挡拆，这次 5 号的防守人没扑上来。', 'Same pick and roll — this time the big defender did not step up.'),
    cue: { at: 'd5', text: T('大个子退在罚球线下面护框，你和他之间有一大片空地。', 'The big sank below the free-throw line to guard the rim — there is open space between you and him.') },
    options: [
      {
        kind: 'shoot', label: T('急停跳投', 'Pull-up jumper'), grade: 3, end: 'score',
        result: T('急停跳投，命中！', 'Pull-up — splash!'),
        why: T('他退后是为了挡顺下和上篮，那就在他面前出手。这是一个没人干扰的中投。', 'He sits back to stop the roll and the layup — so shoot in front of him. It is an uncontested jumper.'),
        play: [
          { ms: 800, shot: 'make', move: { d1: [5.2, 24.5], d5: [3, 15] } }
        ]
      },
      {
        kind: 'spot', at: [3, 9.5], label: T('突到篮下', 'Drive to the rim'), grade: 0, end: 'miss',
        result: T('被大个子封盖！', 'Blocked by the big!'),
        why: T('你正好冲进了他在等你的地方。', 'You drove straight into the spot he was waiting in.'),
        play: [
          { ms: 580, move: { o1: [3, 10], d5: [2.2, 8.4] }, sfx: 'squeak' },
          { ms: 500, shot: 'block' },
          { ms: 450, ball: 'd5' }
        ]
      },
      {
        kind: 'pass', to: 'o5', grade: 1, end: 'neutral',
        result: T('接到了，但大个子挡在前面。', 'Caught — but the big is in front of him.'),
        why: T('没丢球，可 5 号接球时防守人就在他和篮筐之间，只能再倒一手。', 'No turnover, but #5 catches with his defender between him and the rim. The play has to restart.'),
        play: [
          { ms: 450, pass: 'o5', move: { o5: [1.2, 16.5] } },
          { ms: 450, move: { d5: [1.4, 13.5], d1: [4, 24] } }
        ]
      }
    ],
    rule: T('大个子退后，就在他面前出手。', 'Big drops back? Shoot in front of him.')
  },

  /* 5 ------------------------------------------------------------- */
  {
    id: 'switch',
    title: T('换防错位', 'Switch mismatch'),
    concept: T('小防大的机会', 'Little guy on a big'),
    you: 'o1',
    decide: 5,
    setup: {
      o1: [-2, 30], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [6, 18],
      d1: [-2, 26.5], d2: [-14, 18], d3: [18.5, 6], d4: [-18, 6.5], d5: [5, 15],
      ball: 'o1'
    },
    intro: [
      { ms: 800, move: { o5: [1.2, 27.2], d5: [2.5, 23.5] }, call: ['o5', T('掩护！', 'Screen!')] },
      { ms: 700, move: { o1: [[2, 31], [6, 27.5]], d5: [5.6, 24.8], d1: [1.2, 25] }, call: ['d5', T('换！', 'Switch!')], sfx: 'squeak' },
      { ms: 750, move: { o1: [7, 26.5], d5: [7, 23.6], o5: [[1.5, 20], [4, 8.2]], d1: [[1.8, 20], [3.5, 6.7]], d4: [-13.5, 8] } }
    ],
    prompt: T('防守换防了：现在对方大个子防你，他们的小个子后卫在防你们的 5 号。', 'They switched: their big now guards you, and their small guard is on your #5.'),
    cue: { at: 'd1', text: T('最小的防守人被 5 号卡在身后——5 号离篮筐只有 3 英尺。', 'Their smallest defender is sealed behind #5, who is three feet from the rim.') },
    options: [
      {
        kind: 'pass', to: 'o5', grade: 3, end: 'score',
        result: T('喂给内线，轻松得分！', 'Feed the post — easy bucket!'),
        why: T('大打小，而且已经卡好位。第一时间传进去，别等弱侧补防过来。', 'Big on small, already sealed. Get it in right away, before help arrives from the weak side.'),
        play: [
          { ms: 520, pass: 'o5', lob: true, move: { d4: [-8, 7.5] } },
          { ms: 520, shot: 'make', move: { o5: [2.4, 6.2], d1: [2.6, 5] } }
        ]
      },
      {
        kind: 'spot', at: [11, 13], label: T('突破大个子', 'Drive past the big'), grade: 1, end: 'neutral',
        result: T('突进去了，但协防到了，只能分出来。', 'You got by — then the help came and you had to kick it out.'),
        why: T('后卫打大个子也是错位，可突破需要时间，协防已经到位。最近、最快的是内线那个错位。', 'Guard vs big is a mismatch too, but a drive takes time and the help arrives. The closest, fastest mismatch was in the post.'),
        play: [
          { ms: 720, move: { o1: [11, 13.5], d5: [9.6, 15.6], d4: [-1, 8.5] }, sfx: 'squeak' },
          { ms: 620, pass: 'o3', move: { d3: [19.5, 5] } }
        ]
      },
      {
        kind: 'pass', to: 'o2', grade: 0, end: 'neutral',
        result: T('球转走了，错位也没了。', 'Ball swung — mismatch gone.'),
        why: T('你把球传离了错位，防守趁机换回来站好。', 'You passed away from the mismatch and the defense used that time to switch back.'),
        play: [
          { ms: 760, pass: 'o2' },
          { ms: 650, move: { d1: [2.5, 20], d5: [3.5, 8.5] }, call: ['d5', T('换回来！', 'Switch back!')] }
        ]
      }
    ],
    rule: T('换防出错位，第一时间喂进去。', 'Switch creates a mismatch? Feed it fast.')
  },

  /* 6 ------------------------------------------------------------- */
  {
    id: 'two-on-one',
    title: T('快攻二打一', '2-on-1 break'),
    concept: T('让防守人先做选择', 'Make the defender choose'),
    you: 'o1',
    decide: 4,
    setup: {
      o1: [0, 44], o2: [14, 43], d1: [0, 18], d2: [5, 49],
      ball: 'o1'
    },
    intro: [
      { ms: 900, move: { o1: [0, 32], o2: [12.5, 29], d1: [0, 17], d2: [3.5, 41] }, ease: 'linear' },
      { ms: 650, move: { o1: [0, 23.5], o2: [9.5, 19.5], d1: [0.6, 19.5], d2: [2.6, 33] } }
    ],
    prompt: T('快攻，二打一。唯一的防守人在罚球线等你。', 'Fast break, two on one. Their only defender is waiting at the free-throw line.'),
    cue: { at: 'd1', text: T('他已经向你迈步，身体正对着你——他选择了防你。', 'He has stepped up and squared to you — he has chosen to guard you.') },
    options: [
      {
        kind: 'pass', to: 'o2', grade: 3, end: 'score',
        result: T('一传一上篮，轻松得分！', 'One pass, one layup!'),
        why: T('他扑你，队友就空了。等他先动，你再传，他来不及回去。', 'He commits to you, so your teammate is free. Let him move first, then pass — he cannot get back.'),
        play: [
          { ms: 450, pass: 'o2', move: { o2: [6.5, 11], d1: [2.6, 15.6] } },
          { ms: 520, shot: 'make', move: { o2: [2.6, 6.6], d1: [3, 10.5] } }
        ]
      },
      {
        kind: 'spot', at: [0.4, 9], label: T('硬冲篮下', 'Bull to the rim'), grade: 0, end: 'turnover',
        result: T('撞人犯规！', 'Charge!'),
        why: T('他已经站好位置，你直接撞上去就是进攻犯规。二打一还单干，白送了机会。', 'He had position; running through him is an offensive foul. Going alone on a 2-on-1 throws the advantage away.'),
        play: [
          { ms: 460, move: { o1: [0.5, 20.6], d1: [0.6, 18.9] }, sfx: 'squeak' },
          { ms: 520, move: { o1: [0.8, 21.4] }, sfx: 'whistle', call: ['d1', T('撞人！', 'Charge!')] }
        ]
      },
      {
        kind: 'shoot', label: T('急停跳投', 'Pull-up'), grade: 1, end: 'miss',
        result: T('投了，没进。', 'Shot up — no good.'),
        why: T('不算失误，但二打一本该拿到上篮，你却投了一个有人干扰的中投。', 'Not a turnover, but a 2-on-1 should end in a layup, not a contested jumper.'),
        play: [
          { ms: 800, shot: 'miss', move: { d1: [0.6, 20.8], d2: [2, 25] } },
          { ms: 450, ball: 'd1', move: { d1: [1, 9] } }
        ]
      }
    ],
    rule: T('他扑你，就传；他不扑，就上篮。', 'He commits — pass. He stays — finish.')
  },

  /* 7 ------------------------------------------------------------- */
  {
    id: 'help-side',
    title: T('弱侧协防', 'Help-side defense'),
    concept: T('防守站位', 'Where to stand'),
    you: 'd4',
    side: 'defense',
    decide: 5,
    setup: {
      o1: [0, 28], o2: [17, 20], o3: [22, 3.5], o4: [-17, 20], o5: [-22, 3.5],
      d1: [0, 24.5], d2: [-1, 20], d3: [19.5, 5], d4: [-15.5, 18.8], d5: [-19.5, 5],
      ball: 'o1'
    },
    intro: [
      { ms: 450, move: { d2: [13, 18] } },
      { ms: 650, pass: 'o2', move: { d2: [15, 17.8], d1: [2.5, 24] } },
      { ms: 550, move: { o2: [17.5, 20.5], d5: [-15, 6] } }
    ],
    prompt: T('你是防守方的 4 号（红色）。球转到了另一侧，你还贴着你的人。现在该站哪？', 'You are red #4 on defense. The ball swung to the far side and you are still glued to your man. Where should you be?'),
    cue: { at: 'o2', text: T('球在另一侧。离球越远，你越能离开自己的人去帮忙。', 'The ball is on the far side. The farther you are from the ball, the farther you can sag off to help.') },
    options: [
      {
        kind: 'spot', at: [-4.5, 13], label: T('收到协防位', 'Sink to help'), grade: 3, end: 'stop',
        result: T('堵住突破，防守成功！', 'Drive stopped — great defense!'),
        why: T('站在球和你的人之间的"三角"上：一眼看见球，一眼看见人。他一突破，你一步就能补到。', 'Stand in the triangle between the ball and your man, seeing both. When he drives, you are one step away.'),
        play: [
          { ms: 520, move: { d4: [-4.5, 13] }, sfx: 'squeak' },
          { ms: 720, move: { o2: [[15, 13], [8, 8.5]], d2: [11.5, 11.5] }, sfx: 'squeak' },
          { ms: 480, move: { d4: [4.6, 7.4] }, call: ['d4', T('堵住！', 'Wall!')] },
          { ms: 520, pass: 'o1', move: { o2: [9, 9.5], d4: [-2, 12] } }
        ]
      },
      {
        kind: 'spot', at: [-16, 19.4], label: T('继续贴紧他', 'Stay glued'), grade: 0, end: 'allowed',
        result: T('对方突破上篮得分。', 'They drive and score.'),
        why: T('你的人离球很远，根本拿不到球。可你贴着他，篮下就没有任何人帮忙。', 'Your man is far from the ball and no threat right now. Glued to him, nobody is left to help at the rim.'),
        play: [
          { ms: 400, move: { d4: [-16, 19.4] } },
          { ms: 720, move: { o2: [[15, 13], [6, 7]], d2: [11, 11.5] }, sfx: 'squeak' },
          { ms: 520, shot: 'make', move: { o2: [2.8, 5.6] } }
        ]
      },
      {
        kind: 'spot', at: [-1.5, 6], label: T('躲到篮下', 'Hide under the rim'), grade: 1, end: 'stop',
        result: T('堵住了，但你的人差点空投。', 'Stopped — but your man nearly got a free three.'),
        why: T('帮到了忙，可站得离自己的人太远。球一旦分给他，你来不及扑出去——这次是运气好。', 'You helped, but you are too far from your own man. A kick-out and you would not get there in time — you got lucky.'),
        play: [
          { ms: 450, move: { d4: [-1.5, 6] } },
          { ms: 720, move: { o2: [[15, 13], [8, 8.5]], d2: [11.5, 11.5] }, sfx: 'squeak' },
          { ms: 480, pass: 'o4', move: { d4: [-6, 10] } },
          { ms: 800, shot: 'miss', move: { d4: [-13, 16.5] } },
          { ms: 450, ball: 'd5', move: { d5: [-4, 6.5] } }
        ]
      }
    ],
    rule: T('离球远，就离人远：看得见球，也看得见人。', 'Far from the ball? Sag off — see ball and man.')
  },

  /* 8 ------------------------------------------------------------- */
  {
    id: 'closeout',
    title: T('扑防', 'Closeout'),
    concept: T('补防之后回位', 'Recovering to a shooter'),
    you: 'd3',
    side: 'defense',
    decide: 4,
    setup: {
      o1: [0, 28], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [-7, 6],
      d1: [0, 24.5], d2: [-14, 18], d3: [17, 6], d4: [-18.5, 6], d5: [-4.5, 7.5],
      ball: 'o1'
    },
    intro: [
      { ms: 800, move: { o1: [[2, 22], [3.5, 14]], d1: [2.5, 17.5], d3: [7, 10] }, sfx: 'squeak' },
      { ms: 480, pass: 'o3', move: { o1: [3.5, 13] } },
      { ms: 420, move: { d3: [8.5, 9] } }
    ],
    prompt: T('你是红色 3 号。你刚补防完，球被分到了你的人手里——底角。', 'You are red #3. You just helped on the drive, and the ball was kicked to your man in the corner.'),
    cue: { at: 'o3', text: T('他接球就能投。你要冲过去，但最后几步放慢、举手，并封住底线。', 'He can shoot on the catch. Sprint to him, but chop your last steps, hand high, and take away the baseline.') },
    options: [
      {
        kind: 'spot', at: [18.8, 4.6], label: T('碎步扑防，举手', 'Chop & hand up'), grade: 3, end: 'stop',
        result: T('干扰成功，没进！', 'Contested — miss!'),
        why: T('冲一半，碎步一半：既能干扰投篮，又不会被他晃过去。站位稍偏底线，逼他往中路有协防的地方走。', 'Sprint, then chop: close enough to bother the shot, balanced enough not to get blown by. Shade the baseline so he must go middle into help.'),
        play: [
          { ms: 620, move: { d3: [[13.5, 7], [18.8, 4.6]] }, sfx: 'squeak', call: ['d3', T('举手！', 'Hand up!')] },
          { ms: 800, shot: 'miss' },
          { ms: 450, ball: 'd5', move: { d5: [-1, 7.5] } }
        ]
      },
      {
        kind: 'spot', at: [21.6, 6], label: T('全速冲到他身上', 'Sprint all the way'), grade: 0, end: 'allowed',
        result: T('被晃过，底线上篮。', 'Blown by — baseline layup.'),
        why: T('冲得太猛刹不住，他一个假投就让你飞过去了，底线一路畅通。', 'Too fast to stop: one pump fake and you fly past, and the baseline is wide open.'),
        play: [
          { ms: 520, move: { d3: [[14, 7], [21.6, 6]] }, sfx: 'squeak' },
          { ms: 380, move: { d3: [23, 8.5] }, call: ['o3', T('假投！', 'Pump fake!')] },
          { ms: 700, move: { o3: [[16, 2], [6, 3]] }, sfx: 'squeak' },
          { ms: 480, shot: 'make', move: { o3: [3, 4.2] } }
        ]
      },
      {
        kind: 'spot', at: [8.5, 9.4], label: T('留在篮下', 'Stay in the paint'), grade: 0, end: 'allowed',
        result: T('空位三分，命中。', 'Wide-open three — good.'),
        why: T('突破已经结束，你还守着篮下，底角射手就完全没人管了。', 'The drive is over. Staying in the paint leaves a shooter completely alone.'),
        play: [
          { ms: 850, shot: 'make', move: { d3: [9.5, 8.6] } }
        ]
      }
    ],
    rule: T('冲一半，碎步一半，手举高。', 'Sprint, chop your feet, hand high.')
  },

  /* 9 ------------------------------------------------------------- */
  {
    id: 'box-out',
    title: T('卡位', 'Box out'),
    concept: T('先找人，再找球', 'Body before ball'),
    you: 'd4',
    side: 'defense',
    decide: 4,
    setup: {
      o1: [0, 28], o2: [17, 20], o3: [-17, 20], o4: [-8, 7.5], o5: [7, 7],
      d1: [0, 24.5], d2: [15.5, 18], d3: [-14, 17], d4: [-6.2, 6.6], d5: [5.4, 6],
      ball: 'o2'
    },
    intro: [
      { ms: 500, move: { d2: [16, 19] } },
      { ms: 850, shot: 'miss', move: { d2: [16.3, 19.3] } },
      { ms: 380, move: { o4: [-6.8, 8.6] } }
    ],
    prompt: T('你是红色 4 号。对方投篮打铁了，你的人正准备冲抢篮板。', 'You are red #4. The shot is off the rim and your man is about to crash the glass.'),
    cue: { at: 'o4', text: T('球在空中时，先找到你要防的人，用身体把他挡在外面。', 'While the ball is in the air, find your man first and put your body on him.') },
    options: [
      {
        kind: 'spot', at: [-8.8, 10], label: T('转身找人卡位', 'Turn & box out'), grade: 3, end: 'stop',
        result: T('卡住了，篮板到手！', 'Boxed out — your rebound!'),
        why: T('先转身找到他、贴住他，把他挡在身后，球落下来自然是你的。', 'Turn, find him, make contact and keep him behind you. When the ball comes down it is yours.'),
        play: [
          { ms: 380, move: { d4: [-7, 7.6] }, sfx: 'squeak', call: ['d4', T('卡位！', 'Box out!')] },
          { ms: 360, move: { o4: [-7.6, 9.4] } },
          { ms: 650, ball: 'd4', move: { d4: [-6.8, 7.3] } }
        ]
      },
      {
        kind: 'spot', at: [-1.2, 4.2], label: T('冲到篮下等球', 'Run under the rim'), grade: 0, end: 'allowed',
        result: T('被抢了前场篮板，补篮得分。', 'Offensive rebound, putback.'),
        why: T('你站到了篮下，球弹得远，从你头顶飞过去，正好落到他手里。', 'You went under the rim, the ball bounced long over your head — right to him.'),
        play: [
          { ms: 420, move: { d4: [-1.2, 4.2], o4: [-5.4, 7.6] } },
          { ms: 650, ball: 'o4' },
          { ms: 500, shot: 'make', move: { o4: [-3, 5.8] } }
        ]
      },
      {
        kind: 'spot', at: [-11, 21], label: T('提前跑快攻', 'Leak out early'), grade: 0, end: 'allowed',
        result: T('他轻松抢到篮板，补篮得分。', 'Easy offensive board and putback.'),
        why: T('球还没落下你就跑了，篮下只剩他一个人。先拿到篮板，才有快攻。', 'You left before the ball came down and he had the paint to himself. Secure the rebound first — then run.'),
        play: [
          { ms: 520, move: { d4: [-11, 21], o4: [-4.8, 7] }, sfx: 'squeak' },
          { ms: 600, ball: 'o4' },
          { ms: 500, shot: 'make', move: { o4: [-2.6, 5.6] } }
        ]
      }
    ],
    rule: T('先找人，再找球。', 'Find a body, then the ball.')
  },

  /* 10 ------------------------------------------------------------ */
  {
    id: 'last-shot',
    title: T('最后一攻', 'Last possession'),
    concept: T('时间和比分', 'Clock and score'),
    you: 'o1',
    decide: 7,
    hud: { clock: 15.9, score: [88, 88] },
    setup: {
      o1: [0, 42], o2: [-17, 20], o3: [22, 3.5], o4: [-22, 3.5], o5: [8, 12],
      d1: [0, 36], d2: [-14, 18], d3: [18.5, 5.5], d4: [-18.5, 6], d5: [5.5, 10],
      ball: 'o1'
    },
    intro: [
      { ms: 1100, move: { o1: [0, 33], d1: [0, 29] }, clockRate: 1 },
      { ms: 700, move: { o1: [0, 31], d1: [0, 27.5] }, clockRate: 1 }
    ],
    prompt: T('比分 88 平，还剩约 14 秒，进攻计时已关。球在你手里，怎么打？', 'Tied 88–88, about 14 seconds left, no shot clock. The ball is yours. How do you play it?'),
    cue: { at: 'clock', text: T('比分平，时间在你手里：用完它，别给对手留一次进攻。', 'Tie game and the clock is yours: use it all and leave them no possession.') },
    options: [
      {
        kind: 'spot', at: [-1.5, 31.5], label: T('先耗时间，最后 5 秒进攻', 'Run the clock, go at 5'), grade: 3, end: 'score',
        result: T('还剩 2 秒命中，时间走完——绝杀！', 'Scores with 2 seconds left — time runs out, you win!'),
        why: T('最后一攻，出手时间最重要。留到最后几秒进攻：进了就赢，不进也是加时，对手没有机会。', 'On the last possession, timing matters most. Attack with a few seconds left: score and you win, miss and it is overtime — they never get the ball.'),
        play: [
          { ms: 2100, move: { o1: [[-1.5, 31.5], [1.5, 31], [-1, 30.5], [0, 30.5]], d1: [[-1.2, 27], [1.2, 26.8], [0, 26.8]] }, clockRate: 4.4, ease: 'linear' },
          { ms: 900, move: { o1: [[4, 22], [4, 10]], d1: [[3.5, 20], [3.2, 12]] }, clockRate: 1, sfx: 'squeak' },
          { ms: 750, shot: 'make', move: { d5: [3, 8] }, clockRate: 1 },
          { ms: 1400, clockRate: 2 }
        ]
      },
      {
        kind: 'spot', at: [4, 10], label: T('马上突破', 'Attack right now'), grade: 1, end: 'score',
        result: T('进了！可对手还有 12 秒。', 'Good! But they have 12 seconds left.'),
        why: T('两分到手，但出手太早，对手还有足够时间打一次进攻来扳平甚至反超。', 'You scored, but too early — they have plenty of time to answer and tie or win it.'),
        play: [
          { ms: 950, move: { o1: [[4, 22], [4, 10]], d1: [[3.5, 20], [3.2, 12]] }, clockRate: 1, sfx: 'squeak' },
          { ms: 650, shot: 'make', move: { d5: [3, 8] }, clockRate: 1 }
        ]
      },
      {
        kind: 'shoot', label: T('马上投三分', 'Quick three'), grade: 0, end: 'miss',
        result: T('没进，对手还有 12 秒反击。', 'Missed — they get 12 seconds to win it.'),
        why: T('又早又难的一投：不进，对手有整整一次进攻来赢球。', 'Early and difficult: miss it and they get a full possession to win the game.'),
        play: [
          { ms: 950, shot: 'miss', move: { d1: [0, 29.5] }, clockRate: 1 },
          { ms: 500, ball: 'd5', clockRate: 1 }
        ]
      }
    ],
    rule: T('平分最后一攻：先耗时间，最后几秒出手。', 'Tied, last shot: burn the clock, strike late.')
  }
];
