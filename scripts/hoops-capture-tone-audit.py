"""CPU audit of a muted-host browser capture, on a registered 3090 worker.

Checks for four distinct synthetic audio test tones and extracts corresponding
video stills. It is a signal-path test, not narration or visual acceptance.
"""
import json
import os
from pathlib import Path
import subprocess
import numpy as np

INPUT = Path('/srv/ai-data/media-work/projects/CAESAR_HOOPS_TACTICS/inputs/objects') / os.environ['HOOPS_CAPTURE_SHA']
OUT = Path(os.environ['MF_OUTPUT_DIR'])
RATE = 16000
# WebM can have timestamp gaps between short sources. Preserve those gaps
# instead of concatenating decoded packets and inventing an audio sync failure.
result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(INPUT), '-vn', '-af', 'aresample=async=1:first_pts=0', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], check=True, capture_output=True)
samples = np.frombuffer(result.stdout, dtype='<f4')
tones = [450, 600, 750, 900]
intervals = []
window = 1600
for n, frequency in enumerate(tones):
    hits = []
    t = np.arange(window) / RATE
    phase = np.exp(-2j * np.pi * frequency * t)
    for pos in range(0, len(samples) - window + 1, window):
        chunk = samples[pos:pos + window]
        amplitude = abs(np.dot(chunk, phase)) * 2 / window
        if amplitude > .04:
            hits.append(pos / RATE)
    if len(hits) < 3:
        raise RuntimeError(f'Tone {frequency} missing or too short: {hits}')
    start, end = hits[0], hits[-1] + window / RATE
    if intervals and start <= intervals[-1]['end']:
        raise RuntimeError('Tone intervals overlap or are out of order')
    mid = (start + end) / 2
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(mid), '-i', str(INPUT), '-frames:v', '1', '-y', str(OUT / f'step-{n + 1}.png')], check=True)
    intervals.append({'step': n + 1, 'frequency_hz': frequency, 'start': start, 'end': end, 'frame_time': mid})
(OUT / 'tone-audit.json').write_text(json.dumps({'sample_rate': RATE, 'intervals': intervals, 'limitation': 'Synthetic tones, not speech; stills require visual inspection.'}, indent=2) + '\n')
print('TONE_AUDIT_DONE', intervals)
