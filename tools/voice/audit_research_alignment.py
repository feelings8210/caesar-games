"""Run the registered aligner on an existing RESEARCH-ONLY narration.

This produces timing diagnostics only. The prior voice failed QC and must not
be delivered or used as final narration. Execute on a registered worker.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

OUT = Path(os.environ['MF_OUTPUT_DIR'])
ROOT = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/caesar_hoops_horns_pop_20261105_a01/a-7202b32090ae2a450caa/outputs')
AUDIO, SPEC = ROOT / 'flow_full.wav', ROOT / 'spec.json'
ALIGNER = Path('/srv/ai-data/media-work/tools/mf/mf_align.py')
PYTHON = '/srv/ai-data/media-work/runtimes/faster-whisper-v0/.venv/bin/python'
spec = json.loads(SPEC.read_text())
chunks = spec['chunks']
if len(chunks) != 1 or not chunks[0].get('text'):
    raise RuntimeError('Expected one known research narration segment')
with wave.open(str(AUDIO), 'rb') as wav:
    duration = wav.getnframes() / wav.getframerate()
if duration <= 0:
    raise RuntimeError('Invalid research audio')
with tempfile.TemporaryDirectory(prefix='align-research-', dir=OUT) as temp:
    folder = Path(temp)
    (folder / 'lines').mkdir()
    shutil.copyfile(AUDIO, folder / 'lines' / 'c00.wav')
    (folder / 'timing.json').write_text(json.dumps({'lines': [{'id': 'c00', 'text': chunks[0]['text'], 'dur': duration, 'start': 0}]}, ensure_ascii=False))
    result = subprocess.run([PYTHON, str(ALIGNER), '--out', str(folder), '--lang', 'zh', '--min-coverage', '.95'], check=False)
    for name in ('captions.json', 'align.json'):
        source = folder / name
        if source.is_file(): shutil.copyfile(source, OUT / name)
    (OUT / 'audit.json').write_text(json.dumps({'research_only': True, 'deliverable': False, 'aligner_exit_code': result.returncode,
        'audio_sha256': hashlib.sha256(AUDIO.read_bytes()).hexdigest(), 'spec_sha256': hashlib.sha256(SPEC.read_bytes()).hexdigest(),
        'duration_sec': duration, 'script': chunks[0]['text'],
        'warning': 'Prior voice failed QC; alignment does not prove content or pronunciation.'}, ensure_ascii=False, indent=2) + '\n')
    if result.returncode not in (0, 2):
        raise RuntimeError(f'Aligner failed: {result.returncode}')
print('RESEARCH_ALIGNMENT_DIAGNOSTIC_DONE')
