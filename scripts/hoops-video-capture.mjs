/* Experimental browser capture of the actual 3D playbook court. Narration must
 * be supplied as one decoded AudioBuffer per step; this module does not create
 * or approve voices. Audio is connected only to the recording destination,
 * never to the computer speakers. No UI, publishing or upload is performed. */
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

export async function capturePlaybook({ court, play, locale, narration, width = 1280, height = 720, fps = 30 }) {
  if (!court?.renderer || !court?.canvas || !court?.scene || !court?.camera) throw new Error('A loaded 3D court is required');
  if (!play?.steps?.length || !['zh', 'en'].includes(locale)) throw new Error('Invalid play or language');
  if (!Array.isArray(narration) || narration.length !== play.steps.length || narration.some(b => !(b?.duration > 0))) {
    throw new Error('One decoded narration clip is required per step');
  }
  if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('Video capture is not supported');
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(s => MediaRecorder.isTypeSupported(s));
  if (!mime) throw new Error('No supported recording format');
  const AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextType) throw new Error('Web Audio is not available');
  const audio = new AudioContextType();
  const destination = audio.createMediaStreamDestination();
  const output = document.createElement('canvas');
  output.width = width; output.height = height;
  const ctx = output.getContext('2d');
  const picture = output.captureStream(fps);
  const combined = new MediaStream([...picture.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const chunks = [];
  const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 5000000 });
  const completed = new Promise((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = event => reject(event.error || new Error('Recording failed'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });
  const snapshot = court.snapshot();
  let caption = '', alive = true, frame = 0, currentSource = null;
  const draw = () => {
    if (!alive) return;
    // Draw immediately after rendering: WebGL's buffer need not be preserved.
    court.renderer.render(court.scene, court.camera);
    ctx.fillStyle = '#0b1628'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(court.canvas, 0, 0, width, height);
    ctx.fillStyle = 'rgba(7,15,29,.86)'; ctx.fillRect(0, height - 135, width, 135);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    let fontSize = 30, lines;
    do {
      ctx.font = `600 ${fontSize}px sans-serif`;
      lines = wrapCaption(caption, width - 110, value => ctx.measureText(value).width, locale);
      if (lines.length <= 3 && lines.every(line => ctx.measureText(line).width <= width - 110)) break;
      fontSize -= 1;
    } while (fontSize >= 8);
    lines.forEach((value, i) => ctx.fillText(value, width / 2, height - 105 + (i + 1) * (fontSize + 5)));
    frame = requestAnimationFrame(draw);
  };
  try {
    await audio.resume();
    if (audio.state !== 'running') throw new Error('Audio context could not start');
    court.cancel(); court.clearDiagram?.(); court.setScene(play.setup, null); court.setFrozen(false);
    recorder.start(1000); draw();
    caption = play.title[locale]; await pause(1200);
    for (let index = 0; index < play.steps.length; index++) {
      const step = play.steps[index]; caption = step.say[locale];
      const source = audio.createBufferSource(); currentSource = source;
      source.buffer = narration[index]; source.connect(destination);
      const voiceDone = new Promise(resolve => { source.onended = resolve; });
      source.start();
      const [done] = await Promise.all([court.play(step.beats), voiceDone]);
      currentSource = null; source.disconnect();
      if (!done) throw new Error('Court playback was interrupted');
      await pause(500);
    }
    caption = ''; await pause(700);
    alive = false; cancelAnimationFrame(frame); recorder.stop();
    return await completed;
  } finally {
    alive = false; cancelAnimationFrame(frame);
    if (currentSource) { try { currentSource.stop(); } catch {} currentSource.disconnect(); }
    if (recorder.state !== 'inactive') { recorder.ondataavailable = null; recorder.stop(); }
    combined.getTracks().forEach(track => track.stop());
    await audio.close().catch(() => {});
    court.cancel(); court.restoreState(snapshot);
  }
}
