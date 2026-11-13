import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybookMode, autoReadDelay } from '../js/games/hoops/playbook-mode.js';
import { hoopsAudio } from '../js/games/hoops/audio.js';
import { sounds } from '../js/engine/sound.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('leaving while the court loads cannot reopen the playbook', async () => {
  const court = deferred();
  const game = { flow: 0, view: 'menu', _ensureCourt: () => court.promise };
  const mode = Object.create(PlaybookMode.prototype);
  mode.game = game;
  mode._bind = () => assert.fail('a cancelled open must not bind');
  mode.startWatch = () => assert.fail('a cancelled open must not start');
  const opening = mode.open('horns-pop');
  game.flow++; // leave invalidates the pending open
  court.resolve();
  await opening;
  assert.equal(game.view, 'menu');
});

test('a delayed audio preload cannot start crowd sound after leaving', async () => {
  const preload = deferred();
  const originalPreload = hoopsAudio.preload, originalStart = hoopsAudio.startCrowd;
  let starts = 0;
  try {
    hoopsAudio.preload = () => preload.promise;
    hoopsAudio.startCrowd = () => { starts++; };
    const game = { flow: 0, view: 'menu', _ensureCourt: async () => {},
      $: () => ({ className: '' }), courtOnScreen: () => game.view === 'play' };
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = game;
    mode._bind = () => {};
    mode.startWatch = () => {};
    await mode.open('horns-pop');
    game.flow++; // a later screen may also happen to have view === play
    preload.resolve();
    await preload.promise;
    assert.equal(starts, 0);
  } finally {
    hoopsAudio.preload = originalPreload;
    hoopsAudio.startCrowd = originalStart;
  }
});

test('a current visible playbook can start its crowd sound after preload', async () => {
  const preload = deferred();
  const originalPreload = hoopsAudio.preload, originalStart = hoopsAudio.startCrowd;
  let starts = 0;
  try {
    hoopsAudio.preload = () => preload.promise;
    hoopsAudio.startCrowd = stillWanted => { starts++; assert.equal(stillWanted(), true); };
    const game = { flow: 0, view: 'menu', _ensureCourt: async () => {},
      $: () => ({ className: '' }), courtOnScreen: () => game.view === 'play' };
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = game;
    mode._bind = () => {};
    mode.startWatch = () => {};
    await mode.open('horns-pop');
    preload.resolve();
    await preload.promise;
    assert.equal(starts, 1);
  } finally {
    hoopsAudio.preload = originalPreload;
    hoopsAudio.startCrowd = originalStart;
  }
});

test('each completed walk task counts once, even after repeated wrong answers', () => {
  const originals = { invalid: sounds.invalid, lockIn: hoopsAudio.lockIn, voice: hoopsAudio.voice };
  try {
    sounds.invalid = hoopsAudio.lockIn = hoopsAudio.voice = () => {};
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = { render() {}, court: { pos: { o1: [0, 0], o2: [5, 5] }, clearDiagram() {}, showDiagram() {} } };
    Object.assign(mode, { waiting: true, tasks: [{ kind: 'pass', to: 'o2' }, { kind: 'move', at: [5, 5] }],
      taskIndex: 0, tries: 0, role: 'o1', score: { first: 0, total: 0 } });
    let completed = 0;
    mode._playStep = () => { completed++; };
    mode._attempt({ kind: 'pass', to: 'o3' });
    mode._attempt({ kind: 'pass', to: 'o3' });
    mode._attempt({ kind: 'pass', to: 'o3' });
    mode._attempt({ kind: 'pass', to: 'o2' });
    assert.deepEqual(mode.score, { first: 0, total: 1 });
    mode._attempt({ kind: 'move', at: [5, 5] });
    assert.deepEqual(mode.score, { first: 1, total: 2 });
    assert.equal(completed, 1);
  } finally {
    sounds.invalid = originals.invalid;
    hoopsAudio.lockIn = originals.lockIn;
    hoopsAudio.voice = originals.voice;
  }
});

test('delayed star sounds are cancelled when the player leaves', () => {
  const originalTimeout = globalThis.setTimeout;
  const originals = { star: hoopsAudio.star, cheer: hoopsAudio.cheer, voice: hoopsAudio.voice };
  const pending = [];
  let starsPlayed = 0;
  try {
    globalThis.setTimeout = fn => { pending.push(fn); };
    hoopsAudio.star = () => { starsPlayed++; };
    hoopsAudio.cheer = hoopsAudio.voice = () => {};
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = { render() {}, courtOnScreen: () => true };
    Object.assign(mode, { score: { first: 2, total: 2 }, play: { id: 'horns-pop' },
      best: { 'horns-pop': 3 }, token: 1 });
    mode._finishWalk();
    assert.equal(pending.length, 3);
    pending[0]();
    mode.token++; // leave invalidates the remaining scheduled sounds
    pending.slice(1).forEach(fn => fn());
    assert.equal(starsPlayed, 1);
  } finally {
    globalThis.setTimeout = originalTimeout;
    hoopsAudio.star = originals.star;
    hoopsAudio.cheer = originals.cheer;
    hoopsAudio.voice = originals.voice;
  }
});

test('automatic demonstration gives longer explanations more reading time', () => {
  const make = text => ({ say: { zh: text, en: text }, beats: [{ ms: 700 }] });
  assert.ok(autoReadDelay(make('先看牛角站位，四号和五号在罚球线两侧。'), 'zh') > autoReadDelay(make('传球。'), 'zh'));
  assert.ok(autoReadDelay(make('Pass to the open player on the right wing.'), 'en') > autoReadDelay(make('Pass.'), 'en'));
});

test('pause and immediate resume do not leave two automatic playback loops', async () => {
  const originalTimeout = globalThis.setTimeout;
  const pending = [];
  try {
    globalThis.setTimeout = fn => { pending.push(fn); };
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = { render() {} };
    Object.assign(mode, { auto: false, autoRun: 0, token: 1, step: 0,
      play: { steps: [{ say: { zh: '传球', en: 'Pass' }, beats: [{ ms: 700 }] }] } });
    let plays = 0;
    mode.next = async () => { plays++; mode.step++; };
    const oldRun = mode.toggleAuto();
    await mode.toggleAuto();
    const newRun = mode.toggleAuto();
    assert.equal(pending.length, 2);
    pending[0]();
    await oldRun;
    assert.equal(plays, 0);
    assert.equal(mode.auto, true);
    pending[1]();
    await newRun;
    assert.equal(plays, 1);
    assert.equal(mode.auto, false);
  } finally { globalThis.setTimeout = originalTimeout; }
});

test('a manual advance during the reading delay starts a fresh delay for the next step', async () => {
  const originalTimeout = globalThis.setTimeout;
  const pending = [];
  try {
    globalThis.setTimeout = fn => { pending.push(fn); };
    const mode = Object.create(PlaybookMode.prototype);
    mode.game = { render() {} };
    const step = { say: { zh: '传球', en: 'Pass' }, beats: [{ ms: 700 }] };
    Object.assign(mode, { auto: false, autoRun: 0, token: 1, step: 0, play: { steps: [step, step] } });
    let plays = 0;
    mode.next = async () => { plays++; mode.step++; };
    const run = mode.toggleAuto();
    mode.step = 1; // manual next completed while the first timer was pending
    pending[0]();
    await Promise.resolve();
    assert.equal(plays, 0);
    assert.equal(pending.length, 2);
    pending[1]();
    await run;
    assert.equal(plays, 1);
  } finally { globalThis.setTimeout = originalTimeout; }
});
