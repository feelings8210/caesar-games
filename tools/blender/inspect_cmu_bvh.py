"""Run only on a registered 3090 Blender worker; inspect candidate BVH data.

Outputs sampled world-space bone endpoints, not a retargeted game animation.
Input paths and output directory come from the worker manifest/environment.
"""
import bpy
import json
import math
import os
from pathlib import Path

out = Path(os.environ['MF_OUTPUT_DIR'])
root = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs')
report = {'source': 'CMU subject 124, experimental ASF/AMC to BVH conversion', 'clips': []}
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
for filename in ('jump.bvh', 'layup.bvh'):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_anim.bvh(filepath=str(root / filename), global_scale=0.056444,
                            frame_start=1, use_fps_scale=False, update_scene_fps=True)
    arm = bpy.context.active_object
    if arm is None or arm.type != 'ARMATURE' or arm.animation_data is None:
        raise RuntimeError(f'BVH did not create an animated armature: {filename}')
    action = arm.animation_data.action
    start, end = (int(x) for x in action.frame_range)
    samples = []
    frames = list(range(start, end + 1, 5))
    if frames[-1] != end:
        frames.append(end)
    for f in frames:
        bpy.context.scene.frame_set(f)
        segments = []
        for bone in arm.pose.bones:
            a, b = arm.matrix_world @ bone.head, arm.matrix_world @ bone.tail
            xyz = [float(x) for v in (a, b) for x in v]
            if not all(math.isfinite(x) for x in xyz):
                raise RuntimeError(f'Non-finite pose: {filename}, frame {f}, {bone.name}')
            segments.append({'name': bone.name, 'head': xyz[:3], 'tail': xyz[3:]})
        samples.append({'frame': f, 'segments': segments})
    report['clips'].append({'file': filename, 'start': start, 'end': end,
                            'fps': bpy.context.scene.render.fps, 'bones': len(arm.pose.bones), 'samples': samples})
(out / 'cmu-bvh-pose-samples.json').write_text(json.dumps(report, indent=2) + '\n')
print('CMU_BVH_INSPECT_DONE', [(c['file'], c['start'], c['end'], c['bones']) for c in report['clips']])
