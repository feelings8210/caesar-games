"""Make silent internal pose review from Blender worker sampling; not game art."""
import json
import os
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

src = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-inspect/a03/outputs/cmu-bvh-pose-samples.json')
out = Path(os.environ['MF_OUTPUT_DIR'])
for clip in json.loads(src.read_text())['clips']:
    path = out / (Path(clip['file']).stem + '-skeleton-review.mp4')
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
               '-s', '960x540', '-r', '24', '-i', '-', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', str(path)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for sample in clip['samples']:
            image = Image.new('RGB', (960, 540), '#0d1c30')
            draw = ImageDraw.Draw(image)
            draw.text((25, 20), f"{clip['file']} | frame {sample['frame']} / {clip['fps']} fps | front and side", fill='white')
            root = next(s['head'] for s in sample['segments'] if s['name'] == 'root')
            for idx, axis in enumerate((0, 1)):
                cx, floor = 240 + idx * 480, 465
                def point(v): return (cx + (v[axis] - root[axis]) * 170, floor - v[2] * 170)
                draw.line((cx - 200, floor, cx + 200, floor), fill='#728196', width=2)
                for seg in sample['segments']:
                    color = '#edbd6a' if seg['name'].startswith('l') else '#82c4fa'
                    draw.line((*point(seg['head']), *point(seg['tail'])), fill=color, width=5)
            process.stdin.write(image.tobytes())
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError('ffmpeg failed')
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
    print('SILENT_REVIEW', path)
