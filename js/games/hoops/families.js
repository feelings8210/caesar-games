/* Caesar Games — Hoops IQ, Read & React
 *
 * A family is one play whose variants look identical until the read: same
 * setup, same opening beats, same option set. Only the defense's choice —
 * and so the right answer — differs. Rounds also mirror left/right at random.
 */

import { LEVELS, VARIANTS } from './levels.js';

const T = (zh, en) => ({ zh, en });
const ALL = [...LEVELS, ...VARIANTS];
const byId = id => ALL.find(l => l.id === id);

/** Skill tags, shared by chapter levels and variants (used by stats). */
export const TAGS = {
  catch: T('接球阅读', 'Catch reads'),
  'help-read': T('读补防', 'Reading the help'),
  pnr: T('挡拆阅读', 'Pick & roll reads'),
  advantage: T('以多打少', 'Numbers advantage'),
  'help-defense': T('协防站位', 'Help-side defense'),
  closeout: T('扑防', 'Closeouts'),
  rebound: T('卡位', 'Box out'),
  clock: T('时间比分', 'Clock & score')
};

export const FAMILIES = [
  {
    id: 'catch', tag: 'catch', you: 'o2',
    title: T('侧翼接球', 'Wing catch'),
    prompt: T('你是 2 号，在侧翼准备接球。读你的防守人，做出选择。', 'You are #2, getting open on the wing. Read your defender and make the call.'),
    variants: ['backdoor', 'catch-sag']
  },
  {
    id: 'drive', tag: 'help-read', you: 'o1',
    title: T('突破读补防', 'Drive & read the help'),
    prompt: T('你突破过了自己的防守人。读补防，做出选择。', 'You beat your man off the dribble. Read the help and make the call.'),
    variants: ['drive-kick', 'drive-weak', 'drive-none']
  },
  {
    id: 'pnr', tag: 'pnr', you: 'o1',
    title: T('挡拆阅读', 'Pick & roll read'),
    prompt: T('5 号来给你挡拆。读他的防守人怎么防，做出选择。', '#5 sets the pick. Read how his defender plays it and make the call.'),
    variants: ['pnr-roll', 'pnr-drop', 'switch']
  },
  {
    id: 'break', tag: 'advantage', you: 'o1',
    title: T('快攻二打一', '2-on-1 break'),
    prompt: T('快攻二打一。读唯一的防守人，做出选择。', 'Two on one on the break. Read the lone defender and make the call.'),
    variants: ['two-on-one', 'break-stay']
  }
].map(f => ({ ...f, variants: f.variants.map(byId) }));

/* ---------------------------------------------------------------- *
 * Mirroring: x → -x everywhere a court point appears.
 * ---------------------------------------------------------------- */

const flip = p => [-p[0], p[1]];
const flipDest = d => (Array.isArray(d[0]) ? d.map(flip) : flip(d));

function flipBeats(beats) {
  return beats.map(b => {
    if (!b.move) return b;
    return { ...b, move: Object.fromEntries(Object.entries(b.move).map(([id, d]) => [id, flipDest(d)])) };
  });
}

export function mirrorLevel(lvl) {
  const setup = { ...lvl.setup };
  for (const k of Object.keys(setup)) if (/^[od]\d$/.test(k)) setup[k] = flip(setup[k]);
  if (setup.ballAt) setup.ballAt = flip(setup.ballAt);
  return {
    ...lvl,
    setup,
    intro: flipBeats(lvl.intro),
    cue: Array.isArray(lvl.cue.at) ? { ...lvl.cue, at: flip(lvl.cue.at) } : lvl.cue,
    options: lvl.options.map(o => ({ ...o, at: o.at ? flip(o.at) : o.at, play: flipBeats(o.play) })),
    mirrored: true
  };
}

/* ---------------------------------------------------------------- *
 * Picking rounds: weaker skills come up more often.
 * ---------------------------------------------------------------- */

/** @param accuracy (tag) => 0..1 or null when unseen */
export function pickRound({ accuracy = () => null, streak = 0, last = null, rng = Math.random } = {}) {
  const weights = FAMILIES.map(f => {
    const a = accuracy(f.tag);
    const w = a === null ? 1.4 : 1 + (1 - a) * 2;
    return f.id === last ? w * 0.35 : w;   // avoid the same family back to back
  });
  let r = rng() * weights.reduce((s, w) => s + w, 0);
  let fam = FAMILIES[0];
  for (let i = 0; i < FAMILIES.length; i++) { r -= weights[i]; if (r <= 0) { fam = FAMILIES[i]; break; } }
  const variant = fam.variants[Math.floor(rng() * fam.variants.length)];
  // The window tightens every three straight reads, never below 2.5 s.
  const decide = Math.max(2.5, variant.decide - 0.4 * Math.floor(streak / 3));
  let lvl = { ...variant, title: fam.title, variantTitle: variant.title, prompt: fam.prompt, decide, family: fam.id };
  if (rng() < 0.5) lvl = mirrorLevel(lvl);
  return lvl;
}
