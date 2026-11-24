import assert from 'node:assert/strict';
import test from 'node:test';
import { BeatRunner } from '../js/games/hoops/runner.js';
import { sounds } from '../js/engine/sound.js';
import { hoopsAudio } from '../js/games/hoops/audio.js';

class Probe extends BeatRunner {
  constructor() { super(); this.frames = []; this.prepared = 0; }
  _prepareAction() { this.prepared++; }
  _renderBall(bounce) { this.frames.push({ bounce, holder: this.ball.holder, flight: this.ball.flight?.kind, progress: this.ball.flight?.raw }); }
}


async function withFrames(run) {
  const original = { performance: globalThis.performance, raf: globalThis.requestAnimationFrame, mute: sounds.isMuted };
  const queue = [];
  globalThis.performance = { now: () => 0 };
  globalThis.requestAnimationFrame = fn => queue.push(fn);
  sounds.setMuted(true);
  const advance = ms => { const fn = queue.shift(); assert.ok(fn, 'animation frame scheduled'); fn(ms); };
  try { await run(advance); }
  finally {
    globalThis.performance = original.performance;
    if (original.raf) globalThis.requestAnimationFrame = original.raf; else delete globalThis.requestAnimationFrame;
    sounds.setMuted(original.mute);
  }
}

test('prepared pass keeps possession until release and uses the remaining flight time', async () => withFrames(async advance => {
  const p = new Probe(); p.resetState({ o1: [0, 20], o2: [15, 8], ball: 'o1' });
  const done = p._beat({ ms: 1000, prepareMs: 250, pass: 'o2' }, p.token, false);
  assert.equal(p.prepared, 1);
  advance(100); assert.equal(p.ball.holder, 'o1'); assert.equal(p.ball.flight, null);
  advance(250); assert.equal(p.ball.holder, null); assert.equal(p.ball.flight.kind, 'pass'); assert.equal(p.ball.flight.raw, 0);
  advance(625); assert.equal(p.ball.flight.raw, 0.5);
  advance(1000); await done; assert.equal(p.ball.holder, 'o2'); assert.equal(p.ball.flight, null);
}));

test('legacy pass without preparation remains immediate', async () => withFrames(async advance => {
  const p = new Probe(); p.resetState({ o1: [0, 20], o2: [15, 8], ball: 'o1' });
  const done = p._beat({ ms: 500, pass: 'o2' }, p.token, false);
  assert.equal(p.ball.holder, null); assert.equal(p.ball.flight.kind, 'pass'); assert.equal(p.prepared, 0);
  advance(500); await done; assert.equal(p.ball.holder, 'o2');
}));

test('cancel during preparation does not release the ball later', async () => withFrames(async advance => {
  const p = new Probe(); p.resetState({ o1: [0, 20], ball: 'o1' });
  const done = p._beat({ ms: 1000, prepareMs: 600, shot: 'make' }, p.token, false);
  advance(200); p.cancel(); advance(1000); await done;
  assert.equal(p.ball.holder, 'o1'); assert.equal(p.ball.flight, null);
}));

test('dribble sounds occur on contact, with no burst of catch-up sounds after a skipped frame', async () => withFrames(async advance => {
  const p = new Probe(); p.resetState({ o1: [0, 20], ball: 'o1' });
  const original = hoopsAudio.dribble, contacts = [];
  hoopsAudio.dribble = () => contacts.push(p.frames.at(-1).bounce);
  try {
    const done = p._beat({ ms: 1000, move: { o1: [4, 15] } }, p.token, false);
    advance(60); assert.equal(contacts.length, 0);
    advance(200); assert.equal(contacts.length, 1); assert.equal(contacts[0], 1);
    advance(600); assert.equal(contacts.length, 2); assert.equal(contacts[1], 1);
    advance(1000); await done; assert.equal(contacts.length, 3);
    const q = new Probe(); q.resetState({ o1: [0, 20], ball: 'o1' });
    const skipped = q._beat({ ms: 2000, move: { o1: [4, 15] } }, q.token, false);
    const before = contacts.length; advance(1800); assert.equal(contacts.length, before + 1);
    advance(2000); await skipped; assert.equal(contacts.length, before + 1);
  } finally { hoopsAudio.dribble = original; }
}));
