"""Create internal pose evidence from registered-worker Blender bone samples."""
from pathlib import Path
import json
import os
from PIL import Image, ImageDraw

src = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-inspect/a01/outputs/cmu-bvh-pose-samples.json')
out = Path(os.environ['MF_OUTPUT_DIR'])
data = json.loads(src.read_text())
for clip in data['clips']:
    card_w, card_h = 220, 230
    image = Image.new('RGB', (card_w * 7, card_h * 2), '#e9edf1')
    draw = ImageDraw.Draw(image)
    for i, sample in enumerate(clip['samples']):
        left, top = (i % 7) * card_w, (i // 7) * card_h
        draw.rounded_rectangle((left + 3, top + 3, left + card_w - 3, top + card_h - 3), 6, fill='#101f34')
        draw.text((left + 9, top + 8), f"frame {sample['frame']} / {clip['fps']} fps", fill='white')
        root = next(s['head'] for s in sample['segments'] if s['name'] == 'root')
        for side, axis in enumerate((0, 1)):
            cx, floor = left + 55 + side * 105, top + 200
            def point(v): return (cx + (v[axis] - root[axis]) * 70, floor - v[2] * 70)
            draw.line((left + 6 + side * 105, floor, left + 102 + side * 105, floor), fill='#596b7a', width=1)
            for seg in sample['segments']:
                color = '#edbd6a' if seg['name'].startswith('l') else '#82c4fa'
                draw.line((*point(seg['head']), *point(seg['tail'])), fill=color, width=3)
        draw.text((left + 30, top + 210), 'front', fill='#b9c7d6')
        draw.text((left + 139, top + 210), 'side', fill='#b9c7d6')
    path = out / (Path(clip['file']).stem + '-poses.png')
    image.save(path)
    print('POSE_SHEET', path)
