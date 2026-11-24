/* Caesar Games — Hoops IQ, live possessions (first: horns pick and pop).
 *
 * One possession = the same horns entry every time, then the defense picks a
 * coverage at random (drop, switch, hedge-and-trap). The player reads it and
 * chooses; some choices lead to a second read (the help rotates, a defender
 * closes out). Shots are not scripted makes: the shot model decides from how
 * open the shooter really is and his role card (shot-model.js).
 *
 * Read nodes use the same shape as chapter levels (prompt, cue, options with
 * grade 3 / 1 / 0, play beats, rule), so the existing freeze → decide →
 * review flow runs them. Extra option fields:
 *   next: '<node id>'   continue to another read after this option's play
 *   shot: 'model' (on a beat)  make / miss comes from the shot model
 *   result: { make, miss } for model shots
 * Court feet; rim at (0, 5.25).
 */

const T = (zh, en) => ({ zh, en });
const SCREEN = T('掩护！', 'Screen!');

export const HORNS_SETUP = {
  o1: [0, 28], o4: [-8, 19], o5: [8, 19], o2: [-22, 4], o3: [22, 4],
  d1: [0, 24.5], d4: [-7, 16.5], d5: [7, 16.5], d2: [-19.5, 6], d3: [19.5, 6],
  ball: 'o1'
};

// #5 steps up to screen; nothing tells the coverage yet.
const ENTRY = { ms: 800, move: { o5: [3, 25.5], d5: [4.5, 23], d1: [0.4, 25] }, screen: 'o5', call: ['o5', SCREEN] };

const COMMON = {
  tag: 'pnr',
  title: T('牛角：实战回合', 'Horns: live possession'),
  concept: T('读挡拆防守', 'Read the pick-and-roll coverage')
};

export const HORNS_POSSESSION = {
  id: 'horns-live',
  playId: 'horns-pop',
  ...COMMON,
  setup: HORNS_SETUP,
  coverages: [
    {
      id: 'drop',
      name: T('大个子退防', 'Drop coverage'),
      intro: [ENTRY, {
        ms: 900, sfx: 'squeak',
        move: { o1: [[5, 27], [10.5, 22.5]], d1: [[3.5, 27.3], [11.5, 25.2]], d5: [4, 14.5], o5: [-1.5, 27.5] }
      }],
      start: 'drop-read',
      nodes: {
        'drop-read': {
          you: 'o1', decide: 6,
          prompt: T('1 号借掩护向右运球。看 5 号的防守人去了哪里。', '#1 comes off the screen to the right. Watch where #5\'s defender goes.'),
          cue: { at: 'd5', text: T('大个子退到罚球线下面护框，掩护后外弹的 5 号身边没人。', 'The big dropped below the free-throw line to protect the rim — the popping #5 has nobody near him.') },
          rule: T('大个子退防，外弹的人最空。', 'Big drops? The popper is open.'),
          options: [
            {
              kind: 'pass', to: 'o5', grade: 3,
              result: { make: T('5 号外弹三分，命中！', '#5 pops and drains the three!'), miss: T('5 号空位三分没进——但这是最好的出手。', 'The open three rims out — still the best shot.') },
              why: T('大个子退下去护框，掩护人外弹就没人管。早一点把球交给他，就是一个空位三分。', 'The big sank to protect the rim, so the screener popping out is free. Get him the ball early for an open three.'),
              play: [{ ms: 450, pass: 'o5' }, { ms: 800, shot: 'model', move: { d5: [0.5, 22.5] } }]
            },
            {
              kind: 'shoot', label: T('急停中投', 'Pull-up jumper'), grade: 1,
              result: { make: T('急停中投，进了。', 'Pull-up — good.'), miss: T('急停中投被追上来的防守人干扰，没进。', 'The trailing defender bothers the pull-up — miss.') },
              why: T('急停也能打，但 1 号的防守人从后面追上来了；外弹的 5 号更空。', 'The pull-up is playable, but your defender is chasing from behind; the popping #5 is more open.'),
              play: [{ ms: 800, shot: 'model', move: { d1: [9.6, 24.3] } }]
            },
            {
              kind: 'spot', at: [6.5, 11], label: T('突破篮下', 'Drive to the rim'), grade: 0, end: 'miss',
              result: T('冲进大个子怀里，被封盖！', 'Straight into the big — blocked!'),
              why: T('大个子退下来，就是在篮下等你。', 'A dropping big is waiting for you at the rim.'),
              play: [{ ms: 560, move: { o1: [6.5, 11], d5: [5, 9.8] }, sfx: 'squeak' }, { ms: 500, shot: 'block' }, { ms: 450, ball: 'd5' }]
            },
            {
              kind: 'pass', to: 'o3', grade: 1, end: 'neutral',
              result: T('安全转移到底角，但防守已经回位。', 'Safe swing to the corner — the defense is set again.'),
              why: T('不算错，可外弹的 5 号才是这次挡拆造出来的空位。', 'Not wrong, but the popping #5 was the open man this action created.'),
              play: [{ ms: 750, pass: 'o3', move: { d3: [20.5, 7.5] } }]
            }
          ]
        }
      }
    },
    {
      id: 'switch',
      name: T('换防', 'Switch'),
      intro: [ENTRY, {
        ms: 900, sfx: 'squeak',
        move: { o1: [[5, 27], [10.5, 22.5]], d5: [[6.5, 25.5], [10, 20.5]], d1: [[1, 26.5], [-1, 26]], o5: [-1.5, 27.8] }
      }],
      start: 'switch-read',
      nodes: {
        'switch-read': {
          you: 'o1', decide: 6,
          prompt: T('他们换防了：大个子换到你面前。', 'They switched: the big is now in front of you.'),
          cue: { at: 'd5', text: T('换过来的是大个子，脚步比你慢。', 'The big who switched onto you is slower than you.') },
          rule: T('换防换来慢脚大个子：用速度过他。', 'Switch gives you a slow big? Beat him with speed.'),
          options: [
            {
              kind: 'spot', at: [7, 11.5], label: T('加速突破', 'Attack the big'), grade: 3, next: 'switch-help',
              result: T('一步过掉了大个子！', 'Blew right by the big!'),
              why: T('大个子在外线防不住速度。先过他，再看补防。', 'A big cannot stay with your speed out there. Beat him, then read the help.'),
              play: [{ ms: 650, move: { o1: [[9, 17], [7, 11.5]], d5: [[9.5, 17.5], [8.5, 14]] }, sfx: 'squeak' }]
            },
            {
              kind: 'shoot', label: T('急停跳投', 'Pull-up over him'), grade: 1,
              result: { make: T('顶着大个子投进了。', 'Over the big — good.'), miss: T('大个子长臂干扰，没进。', 'His long arms bother it — miss.') },
              why: T('能投，但他就在你面前；你的速度优势没用上。', 'You can shoot, but he is right in front of you — you did not use your speed.'),
              play: [{ ms: 800, shot: 'model', move: { d5: [10.2, 21.6] } }]
            },
            {
              kind: 'pass', to: 'o5', grade: 1, end: 'neutral',
              result: T('5 号接到球，但小个子贴着他。', '#5 catches with the small defender on him.'),
              why: T('5 号对小个子也有优势，可你自己面对慢脚大个子的机会更直接。', '#5 has a mismatch too, but your own chance against the slow big is more direct.'),
              play: [{ ms: 600, pass: 'o5', move: { d1: [-1.3, 26.4] } }]
            }
          ]
        },
        'switch-help': {
          you: 'o1', decide: 5,
          intro: [{ ms: 600, sfx: 'squeak', move: { d3: [[15, 8], [9.2, 9.6]], o1: [6.6, 10.6], d5: [8, 12.8] } }],
          prompt: T('你过掉了大个子，底角的防守人冲上来补防。', 'You beat the big — the corner defender rushes in to help.'),
          cue: { at: 'd3', text: T('他离开了底角的 3 号——底角现在没人。', 'He left #3 in the corner — the corner is empty now.') },
          rule: T('谁来补防，就传给他留下的人。', 'Whoever helps, pass to the man he left.'),
          options: [
            {
              kind: 'pass', to: 'o3', grade: 3,
              result: { make: T('底角三分，命中！', 'Corner three — splash!'), miss: T('空位底角没进——选择是对的。', 'Open corner three rims out — right choice.') },
              why: T('补防的人从哪来，空位就在哪。底角来补防，就传底角。', 'The open man is where the help came from. Help from the corner? Pass to the corner.'),
              play: [{ ms: 450, pass: 'o3' }, { ms: 800, shot: 'model', move: { d3: [16.5, 6.5] } }]
            },
            {
              kind: 'shoot', label: T('硬上篮', 'Force the layup'), grade: 1,
              result: { make: T('顶着补防上篮，进了！', 'Through the help — and in!'), miss: T('被补防干扰，上篮没进。', 'The help bothers the layup — miss.') },
              why: T('能硬上，但补防已经到了；底角的 3 号完全空着。', 'You can force it, but the help is there and #3 is wide open in the corner.'),
              play: [{ ms: 700, shot: 'model', move: { o1: [3.6, 7.6], d3: [4.9, 7.7] } }]
            },
            {
              kind: 'pass', to: 'o5', grade: 1, end: 'neutral',
              result: T('回传给 5 号，进攻重新组织。', 'Back out to #5 — reset.'),
              why: T('安全，但浪费了补防造出来的空位。', 'Safe, but it wastes the open man the help created.'),
              play: [{ ms: 750, pass: 'o5', move: { d1: [-1.2, 25.8] } }]
            }
          ]
        }
      }
    },
    {
      id: 'hedge',
      name: T('大个子上提包夹', 'Hedge and trap'),
      intro: [ENTRY, {
        ms: 900, sfx: 'squeak',
        move: { o1: [[5, 27], [9.5, 25]], d5: [[6, 25.5], [10.5, 25.8]], d1: [[3, 27.5], [8.6, 27]], o5: [-2.5, 27.6] }
      }],
      start: 'hedge-read',
      nodes: {
        'hedge-read': {
          you: 'o1', decide: 5,
          prompt: T('两个防守人一起扑向你——包夹！', 'Two defenders jump you — a trap!'),
          cue: { at: 'd5', text: T('大个子上来夹你，他原本要盯的 5 号没人管。', 'The big came up to trap you — the #5 he was guarding is free.') },
          rule: T('被包夹，第一时间传给外弹的人。', 'Trapped? Get it to the popper right away.'),
          options: [
            {
              kind: 'pass', to: 'o5', grade: 3, next: 'hedge-closeout',
              result: T('传出包夹，球到了 5 号手里。', 'Out of the trap to #5.'),
              why: T('两个人夹你，场上就有人没人防。外弹的 5 号离你最近，最安全。', 'Two on you means someone is free. The popping #5 is closest and safest.'),
              play: [{ ms: 500, pass: 'o5', move: { d5: [8.5, 24], d1: [7.6, 26] } }]
            },
            {
              kind: 'spot', at: [9, 17], label: T('硬闯包夹', 'Split the trap'), grade: 0, end: 'turnover',
              result: T('硬闯包夹，球被掏掉！', 'Tried to split it — stripped!'),
              why: T('两个人夹你时，硬冲最容易丢球。', 'Forcing it through two defenders is how you lose the ball.'),
              play: [{ ms: 500, move: { o1: [9.4, 23], d5: [9.8, 23.6], d1: [8.8, 23.9] } }, { ms: 450, ball: 'd1' }]
            },
            {
              kind: 'shoot', label: T('被夹着投篮', 'Shoot over the trap'), grade: 0,
              result: { make: T('居然投进了——但下次别这么投。', 'It went in — but do not count on it.'), miss: T('被两个人封着出手，没进。', 'Shot over two defenders — miss.') },
              why: T('两只手都在你脸前，这是全场最难的出手。', 'Two hands in your face — the hardest shot on the floor.'),
              play: [{ ms: 800, shot: 'model', move: { d5: [10.1, 25.5] } }]
            },
            {
              kind: 'pass', to: 'o3', grade: 1, end: 'neutral',
              result: T('把球甩到底角，防守来得及回位。', 'Skip to the corner — the defense recovers.'),
              why: T('能出球就好，但离你最近、最空的是外弹的 5 号。', 'Getting it out is good, but the nearest, most open man was the popping #5.'),
              play: [{ ms: 800, pass: 'o3', move: { d3: [20.5, 7] } }]
            }
          ]
        },
        'hedge-closeout': {
          you: 'o5', decide: 5,
          intro: [{ ms: 650, sfx: 'squeak', move: { d4: [-3, 22.6], o4: [-5, 9], d2: [-14, 8] } }],
          prompt: T('现在球在 5 号手里，你替他做决定。4 号的防守人冲出来扑他。', 'Now #5 has it — you decide for him. #4\'s defender rushes out at him.'),
          cue: { at: 'd4', text: T('他从篮下冲出来——4 号身后到篮筐是空的。', 'He left the paint — the way to the rim behind #4 is empty.') },
          rule: T('扑防的人从哪来，就把球传到他身后。', 'Pass to where the closeout came from.'),
          options: [
            {
              kind: 'pass', to: 'o4', grade: 3,
              result: { make: T('传给篮下的 4 号，轻松上篮！', 'To #4 under the rim — easy layup!'), miss: T('篮下空位没放进——但传球完全正确。', 'The open layup rolls off — the pass was perfect.') },
              why: T('他扑出来，就把 4 号留在了篮下。一传就是空位上篮。', 'His closeout left #4 alone at the rim. One pass, open layup.'),
              play: [{ ms: 450, pass: 'o4' }, { ms: 700, shot: 'model', move: { o4: [-3.5, 6.6], d2: [-9.6, 7] } }]
            },
            {
              kind: 'shoot', label: T('顶着扑防投三分', 'Three over the closeout'), grade: 1,
              result: { make: T('顶着扑防，三分命中。', 'Over the closeout — good.'), miss: T('扑防到了，三分偏出。', 'The closeout gets there — miss.') },
              why: T('5 号能投，但扑防已经到了；他留下的 4 号更空。', '#5 can shoot, but the closeout is there; the #4 he left is more open.'),
              play: [{ ms: 800, shot: 'model', move: { d4: [-2.3, 25] } }]
            },
            {
              kind: 'pass', to: 'o1', grade: 1, end: 'neutral',
              result: T('回传给 1 号，重新组织。', 'Back to #1 — reset.'),
              why: T('不丢球，可 4 号的空位上篮机会没了。', 'No turnover, but the open layup for #4 is gone.'),
              play: [{ ms: 700, pass: 'o1', move: { d1: [8, 25.5] } }]
            }
          ]
        }
      }
    }
  ]
};

/** Pick a coverage at random, avoiding the same one twice in a row. */
export function pickCoverage(possession, last = null, rng = Math.random) {
  const pool = possession.coverages.filter(c => c.id !== last);
  return (pool.length ? pool : possession.coverages)[Math.floor(rng() * (pool.length || possession.coverages.length))];
}

/** A read node as a chapter-level-shaped object the controller can run. */
export function readLevel(possession, coverage, nodeId) {
  const node = coverage.nodes[nodeId];
  if (!node) throw new Error(`Unknown read ${nodeId}`);
  const first = nodeId === coverage.start;
  return {
    id: `${possession.id}:${coverage.id}:${nodeId}`,
    tag: possession.tag, title: possession.title, concept: possession.concept,
    variantTitle: coverage.name, coverage: coverage.id, node: nodeId, first,
    setup: possession.setup,
    intro: first ? coverage.intro : (node.intro || []),
    you: node.you, decide: node.decide, prompt: node.prompt, cue: node.cue, rule: node.rule,
    options: node.options
  };
}
