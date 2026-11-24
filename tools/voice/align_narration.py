"""Align one narration recording to its script with the registered mf_align.py.

Usage (on a registered worker, MF_OUTPUT_DIR set by workers.py):
    python3 align_narration.py <audio.wav> <script.txt> <label>

The audio and script must be SHA-staged worker inputs. The whole script is
treated as one spoken line (one take, no cuts). Output: captions.json,
align.json and audit.json. This is timing evidence only; it does not prove
pronunciation, voice quality or that the voice may be delivered.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave

if len(sys.argv) != 4:
    raise SystemExit('Usage: align_narration.py audio.wav script.txt label')
OUT = Path(os.environ['MF_OUTPUT_DIR'])
AUDIO, SCRIPT, LABEL = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
ALIGNER = Path('/srv/ai-data/media-work/tools/mf/mf_align.py')
PYTHON = '/srv/ai-data/media-work/runtimes/faster-whisper-v0/.venv/bin/python'
text = ''.join(SCRIPT.read_text(encoding='utf-8').split())
if not text:
    raise RuntimeError('Empty script')
with wave.open(str(AUDIO), 'rb') as wav:
    duration = wav.getnframes() / wav.getframerate()
if duration <= 0:
    raise RuntimeError('Invalid audio')
with tempfile.TemporaryDirectory(prefix='align-narration-', dir=OUT) as temp:
    folder = Path(temp)
    (folder / 'lines').mkdir()
    shutil.copyfile(AUDIO, folder / 'lines' / 'c00.wav')
    (folder / 'timing.json').write_text(json.dumps(
        {'lines': [{'id': 'c00', 'text': text, 'dur': duration, 'start': 0}]}, ensure_ascii=False))
    result = subprocess.run([PYTHON, str(ALIGNER), '--out', str(folder), '--lang', 'zh', '--min-coverage', '.95'], check=False)
    for name in ('captions.json', 'align.json'):
        source = folder / name
        if source.is_file():
            shutil.copyfile(source, OUT / name)
(OUT / 'audit.json').write_text(json.dumps({
    'label': LABEL, 'aligner_exit_code': result.returncode,
    'audio_sha256': hashlib.sha256(AUDIO.read_bytes()).hexdigest(),
    'script_sha256': hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),
    'duration_sec': duration, 'script': text,
    'warning': 'Timing only; does not prove pronunciation, voice quality or delivery approval.'},
    ensure_ascii=False, indent=2) + '\n')
if result.returncode not in (0, 2):
    raise RuntimeError(f'Aligner failed: {result.returncode}')
print('NARRATION_ALIGNMENT_DONE')
