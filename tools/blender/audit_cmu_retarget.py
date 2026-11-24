"""Compare CMU and candidate motion geometry on a registered 3090 worker.

Normalized distances are a diagnostic, not game or artistic acceptance.
"""
import bpy
import json
import os
from pathlib import Path

OUT = Path(os.environ['MF_OUTPUT_DIR'])
SRC = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs/jump.bvh'
DST = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a07/outputs/cmu-jump-retarget-candidate.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=DST)
target = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
bpy.ops.import_anim.bvh(filepath=SRC, global_scale=.056444, frame_start=1,
                        use_fps_scale=False, update_scene_fps=True)
source = bpy.context.active_object

def point(obj, name):
    return obj.matrix_world @ obj.pose.bones[name].head

def stats(obj, left, right, shoulder_l, shoulder_r, feet, head):
    l, r = point(obj, left), point(obj, right)
    sl, sr = point(obj, shoulder_l), point(obj, shoulder_r)
    width = (sl - sr).length
    if width < 1e-5:
        raise RuntimeError('Degenerate shoulder width')
    return {'hand_gap_shoulder_widths': (l - r).length / width,
            'hand_height_head': [l.z - point(obj, head).z, r.z - point(obj, head).z],
            'foot_height': [point(obj, f).z for f in feet], 'shoulder_width': width}

rows = []
for frame in range(1, 790, 5):
    bpy.context.scene.frame_set(frame)
    rows.append({'frame': frame, 'time': (frame - 1) / 120,
                 'source': stats(source, 'lhand', 'rhand', 'lhumerus', 'rhumerus', ['lfoot', 'rfoot'], 'head'),
                 'candidate': stats(target, 'hand_l', 'hand_r', 'upperarm_l', 'upperarm_r', ['foot_l', 'foot_r'], 'Head')})
(OUT / 'retarget-geometry.json').write_text(json.dumps({'source_fps': 120, 'sampling': 5, 'rows': rows}, indent=2) + '\n')
print('RETARGET_GEOMETRY_DONE', len(rows))
