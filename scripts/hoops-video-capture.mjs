/* Experimental browser capture of the actual 3D playbook court. Narration can
 * be supplied per step or as one continuous buffer with cue times; it does not create
 * or approve voices. Audio is connected only to the recording destination,
 * never to the computer speakers. No UI, publishing or upload is performed. */
import * as THREE from '../js/vendor/three/three.module.min.js';
import { broadcastFrame, framePosition } from '../js/games/hoops/camera-frame.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function wrapCaption(text, maxWidth, measure, locale) {
  const parts = locale === 'en' ? text.match(/\S+\s*/g) || [] : Array.from(text);
  const lines = []; let line = '';
  for (const part of parts) {
    if (line && measure(line + part) > maxWidth) { lines.push(line.trim()); line = ''; }
    line += part;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function containRect(sourceWidth, sourceHeight, width, height) {
  if (![sourceWidth, sourceHeight, width, height].every(x => Number.isFinite(x) && x > 0)) throw new Error('Invalid frame dimensions');
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function captureLayout(sourceWidth, sourceHeight, width, height) {
  const captionHeight = 135;
  if (!(height > captionHeight)) throw new Error('Frame too short for captions');
  return { court: containRect(sourceWidth, sourceHeight, width, height - captionHeight),
    caption: { x: 0, y: height - captionHeight, width, height: captionHeight } };
}

export function captionBaselines(height, lineCount, fontSize) {
  const barHeight = 135;
  const lineHeight = fontSize + 5;
  const first = height - barHeight + (barHeight - lineCount * lineHeight) / 2 + fontSize * .85;
  return Array.from({ length: lineCount }, (_, i) => first + i * lineHeight);
}

export function recordingChunks(onChunk = null) {
  if (onChunk !== null && typeof onChunk !== 'function') throw new Error('Invalid recording chunk handler');
  const chunks = [];
  let pending = Promise.resolve(), failure = null;
  return {
    add(blob) {
      if (!blob.size) return;
      if (!onChunk) chunks.push(blob);
      else pending = pending.then(() => { if (!failure) return onChunk(blob); }).catch(error => { failure ||= error; });
    },
    async finish(mime) {
      await pending;
      if (failure) throw failure;
      return onChunk ? null : new Blob(chunks, { type: mime });
    }
  };
}

// Educational captures keep the full play visible instead of cutting to the
// game's dramatic finish camera. Never change the shared authored beats.
export function teachingBeats(play) {
  return play.steps.map(step => step.beats.map(beat => beat.shot ? { ...beat, finishCamera: false } : beat));
}

// Look more along the court for the elevator door: the screeners' left/right
// gap is difficult to see from the normal near-sideline broadcast angle.
export function setTeachingFrame(court, play, beatsByStep) {
  court.setReadFrame?.({ intro: beatsByStep.flat(), options: [] });
  if (play.id !== 'elevator-shooter' || !court.arenaLook || !court._framingPositions) return;
  const fov = court.baseFov || 44, aspect = court._aspect || 1.2;
  const { target, points } = broadcastFrame(court._framingPositions, fov, aspect);
  const position = framePosition(points, target, new THREE.Vector3(-.25, .7, .75), fov, aspect, 1.12);
  court.goal.target.copy(target); court.goal.pos.copy(position);
  court.cam.target.copy(target); court.cam.pos.copy(position);
}

// Planned start time of every beat. A beat with a phrase cue waits for that
// phrase; one without starts when the previous beat ends (the first beat of a
// step starts with the step). Every beat must finish before the next step.
export function beatSchedule(play, cuesMs, beatCuesMs, durationMs) {
  if (beatCuesMs != null && (!Array.isArray(beatCuesMs) || beatCuesMs.length !== play.steps.length))
    throw new Error('Beat cues need one list per step');
  return play.steps.map((step, i) => {
    const own = beatCuesMs?.[i] ?? [];
    if (!Array.isArray(own) || own.length > step.beats.length) throw new Error(`Invalid beat cues at step ${i + 1}`);
    const end = cuesMs[i + 1] ?? durationMs;
    let t = cuesMs[i];
    return step.beats.map((beat, j) => {
      const cue = own[j];
      if (cue != null && (!Number.isFinite(cue) || cue < cuesMs[i] || cue >= end)) throw new Error(`Beat cue ${j + 1} is outside step ${i + 1}`);
      const start = Math.max(t, cue ?? t);
      if (!Number.isFinite(beat.ms) || start + beat.ms > end) throw new Error(`Action ${i + 1} cannot fit before the next cue`);
      t = start + beat.ms;
      return start;
    });
  });
}

export function validateContinuousNarration(play, continuous) {
  const duration = continuous?.buffer?.duration;
  const cues = continuous?.cuesMs;
  if (!(duration > 0) || !Array.isArray(cues) || cues.length !== play.steps.length ||
      cues.some((cue, i) => !Number.isFinite(cue) || cue < 0 || cue >= duration * 1000 || (i > 0 && cue <= cues[i - 1])))
    throw new Error('Continuous narration needs one increasing cue per step within the audio');
  return beatSchedule(play, cues, continuous.beatCuesMs, duration * 1000);
}

// Number badges and play calls are an HTML layer in the game, which a canvas
// recording would lose. Draw them into the video above each player.
export function drawPlayerBadges(ctx, court, rect, scale = 1) {
  const W = court._w || court.canvas.clientWidth, H = court._h || court.canvas.clientHeight;
  if (!W || !H || typeof court._project !== 'function') return;
  const toFrame = v => { const [x, y, z] = court._project(v); return { x: rect.x + x / W * rect.width, y: rect.y + y / H * rect.height, z }; };
  const r = 15 * scale;
  for (const [id, p] of Object.entries(court.players || {})) {
    const label = court.labels?.[id]?.textContent;
    if (!label || !p.root) continue;
    const at = toFrame(new THREE.Vector3(p.root.position.x, p.root.position.y + 7.6, p.root.position.z));
    if (at.z >= 1) continue;
    ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,22,42,.92)'; ctx.fill();
    ctx.lineWidth = 2.5 * scale; ctx.strokeStyle = p.side === 'd' ? '#FF7F70' : '#7FB2FF'; ctx.stroke();
    ctx.fillStyle = '#F4F6F9'; ctx.font = `750 ${Math.round(17 * scale)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, at.x, at.y + 1);
  }
  for (const call of court._calls || []) {
    const p = court.players?.[call.id];
    if (!p?.root) continue;
    const at = toFrame(new THREE.Vector3(p.root.position.x, p.root.position.y + 10.4, p.root.position.z));
    if (at.z >= 1) continue;
    const text = call.el?.textContent || '';
    ctx.font = `700 ${Math.round(18 * scale)}px sans-serif`;
    const w = ctx.measureText(text).width + 26 * scale, h = 32 * scale;
    ctx.fillStyle = 'rgba(226,190,114,.95)';
    ctx.beginPath(); ctx.roundRect(at.x - w / 2, at.y - h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#0E1F3A'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, at.x, at.y + 1);
  }
  ctx.textBaseline = 'alphabetic';
}

// The first time a CJK string is shaped at a new weight, the browser can stall
// for ~0.5 s looking up fallback fonts; recorded, that is a frozen picture.
// Render every caption and call once, off camera, before recording.
async function warmText(court, play, locale, ctx) {
  const calls = play.steps.flatMap(s => s.beats.filter(b => b.call).map(b => court.text?.(b.call[1]) ?? ''));
  const texts = [play.title[locale], ...play.steps.map(s => s.say[locale]), ...calls].join(' ');
  for (const font of ['600 30px sans-serif', '700 18px sans-serif', '750 17px sans-serif']) { ctx.font = font; ctx.measureText(texts); ctx.fillText(texts, 10, 60); }
  const probe = document.createElement('span');
  probe.className = 'hc3-call'; probe.textContent = calls.join(' ') || texts; probe.style.opacity = '0.01';
  (court.overlay || document.body).appendChild(probe);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  probe.remove();
}

export async function capturePlaybook({ court, play, locale, narration, continuousNarration, width = 1280, height = 720, fps = 30, badges = true, onEvent = () => {}, onChunk = null }) {
  if (!court?.renderer || !court?.canvas || !court?.scene || !court?.camera) throw new Error('A loaded 3D court is required');
  if (!play?.steps?.length || !['zh', 'en'].includes(locale)) throw new Error('Invalid play or language');
  captureLayout(1, 1, width, height);
  if (continuousNarration && narration) throw new Error('Choose continuous narration or separate clips');
  if (onChunk !== null && typeof onChunk !== 'function') throw new Error('Invalid recording chunk handler');
  const schedule = continuousNarration ? validateContinuousNarration(play, continuousNarration) : null;
  if (!continuousNarration && (!Array.isArray(narration) || narration.length !== play.steps.length || narration.some(b => !(b?.duration > 0)))) {
    throw new Error('One decoded narration clip is required per step');
  }
  if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Video capture is not supported');
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(s => MediaRecorder.isTypeSupported(s));
  if (!mime) throw new Error('No supported recording format');
  const AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextType) throw new Error('Web Audio is not available');
  const audio = new AudioContextType();
  const destination = audio.createMediaStreamDestination();
  // Keep the audio track continuously clocked during gaps. Without an
  // always-connected source, some MediaRecorder/browser combinations omit
  // silent packets and later narration plays ahead of the picture.
  const silence = audio.createConstantSource(), silenceGain = audio.createGain();
  silenceGain.gain.value = 0;
  silence.connect(silenceGain); silenceGain.connect(destination);
  const output = document.createElement('canvas');
  output.width = width; output.height = height;
  const ctx = output.getContext('2d');
  const picture = output.captureStream(fps);
  const combined = new MediaStream([...picture.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const chunks = recordingChunks(onChunk);
  const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 5000000 });
  const completed = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => chunks.add(event.data);
    recorder.onerror = event => reject(event.error || new Error('Recording failed'));
    recorder.onstop = () => chunks.finish(mime).then(resolve, reject);
  });
  const snapshot = court.snapshot();
  const beatsByStep = teachingBeats(play);
  let caption = '', alive = true, frame = 0, currentSource = null, startedAt = 0;
  const event = (type, step = null) => onEvent({ type, step, elapsedMs: Math.round(performance.now() - startedAt) });
  const draw = () => {
    if (!alive) return;
    // Draw immediately after rendering: WebGL's buffer need not be preserved.
    court.renderer.render(court.scene, court.camera);
    ctx.fillStyle = '#0b1628'; ctx.fillRect(0, 0, width, height);
    const { court: rect, caption: band } = captureLayout(court.canvas.width, court.canvas.height, width, height);
    ctx.drawImage(court.canvas, rect.x, rect.y, rect.width, rect.height);
    if (badges) drawPlayerBadges(ctx, court, rect, height / 720);
    ctx.fillStyle = '#070f1d'; ctx.fillRect(band.x, band.y, band.width, band.height);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    let fontSize = 30, lines;
    do {
      ctx.font = `600 ${fontSize}px sans-serif`;
      lines = wrapCaption(caption, width - 110, value => ctx.measureText(value).width, locale);
      if (lines.length <= 3 && lines.every(line => ctx.measureText(line).width <= width - 110)) break;
      fontSize -= 1;
    } while (fontSize >= 8);
    const baselines = captionBaselines(height, lines.length, fontSize);
    lines.forEach((value, i) => ctx.fillText(value, width / 2, baselines[i]));
    frame = requestAnimationFrame(draw);
  };
  try {
    await audio.resume();
    if (audio.state !== 'running') throw new Error('Audio context could not start');
    silence.start();
    court.cancel(); court.clearDiagram?.(); court.setScene(play.setup, null); court.setFrozen(false);
    setTeachingFrame(court, play, beatsByStep);
    await warmText(court, play, locale, ctx);
    recorder.start(1000); startedAt = performance.now(); event('record-start'); draw();
    caption = play.title[locale]; await pause(1200);
    if (continuousNarration) {
      const source = audio.createBufferSource(); currentSource = source;
      source.buffer = continuousNarration.buffer; source.connect(destination);
      const voiceDone = new Promise(resolve => { source.onended = () => { event('voice-end'); resolve(); }; });
      const startTime = audio.currentTime; source.start(); event('voice-start');
      for (let index = 0; index < play.steps.length; index++) {
        const cueTime = startTime + continuousNarration.cuesMs[index] / 1000;
        while (audio.currentTime < cueTime) await pause(Math.min(25, Math.max(1, (cueTime - audio.currentTime) * 1000)));
        if (audio.currentTime - cueTime > .25) throw new Error(`Action ${index + 1} missed its narration cue`);
        caption = play.steps[index].say[locale]; event('caption-start', index);
        for (let b = 0; b < beatsByStep[index].length; b++) {
          const beatTime = startTime + schedule[index][b] / 1000;
          while (audio.currentTime < beatTime) await pause(Math.min(25, Math.max(1, (beatTime - audio.currentTime) * 1000)));
          if (audio.currentTime - beatTime > .25) throw new Error(`Action ${index + 1} beat ${b + 1} missed its narration cue`);
          event('beat-start', index);
          const done = await court.play([beatsByStep[index][b]]);
          if (!done) throw new Error('Court playback was interrupted');
        }
        event('action-end', index);
        const deadline = startTime + (continuousNarration.cuesMs[index + 1] ?? source.buffer.duration * 1000) / 1000;
        if (audio.currentTime > deadline + .25) throw new Error(`Action ${index + 1} ran past its narration cue`);
      }
      await voiceDone; currentSource = null; source.disconnect();
    } else for (let index = 0; index < play.steps.length; index++) {
      const step = play.steps[index]; caption = step.say[locale]; event('caption-start', index);
      const source = audio.createBufferSource(); currentSource = source;
      source.buffer = narration[index]; source.connect(destination);
      const voiceDone = new Promise(resolve => { source.onended = () => { event('voice-end', index); resolve(); }; });
      source.start(); event('voice-start', index);
      const actionDone = court.play(beatsByStep[index]).then(done => { event('action-end', index); return done; });
      const [done] = await Promise.all([actionDone, voiceDone]);
      currentSource = null; source.disconnect();
      if (!done) throw new Error('Court playback was interrupted');
      await pause(500);
    }
    caption = ''; event('caption-clear'); await pause(700);
    alive = false; cancelAnimationFrame(frame); event('record-stop'); recorder.stop();
    return await completed;
  } finally {
    alive = false; cancelAnimationFrame(frame);
    if (currentSource) { try { currentSource.stop(); } catch {} currentSource.disconnect(); }
    try { silence.stop(); } catch {}
    silence.disconnect(); silenceGain.disconnect();
    if (recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); }
    combined.getTracks().forEach(track => track.stop());
    await audio.close().catch(() => {});
    court.cancel(); court.restoreState(snapshot);
  }
}
