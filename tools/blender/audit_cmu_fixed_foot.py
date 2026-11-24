"""Track fixed target shoe vertices against source feet, on a 3090 only.

The source foot bone is not a measured ground-contact marker. These are
candidate contact windows for review, not a verdict about sliding.
"""
import json
import os
from pathlib import Path

import bpy

OUT = Path(os.environ['MF_OUTPUT_DIR'])
SRC = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs/jump.bvh'
DST = os.environ.get('HOOPS_AUDIT_MODEL', '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a08/outputs/cmu-jump-retarget-candidate.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=DST)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'Shoe' for m in o.data.materials)]
if len(meshes) != 1:
    raise RuntimeError(f'Expected one mesh containing shoe material, got {len(meshes)}')
shoe = meshes[0]
indices = {}
for side in ('l', 'r'):
    groups = {g.index for g in shoe.vertex_groups if g.name in (f'foot_{side}', f'ball_{side}')}
    indices[side] = [v.index for v in shoe.data.vertices if sum(w.weight for w in v.groups if w.group in groups) >= .5]
    if not indices[side]:
        raise RuntimeError(f'No weighted vertices for {side}')
bpy.ops.import_anim.bvh(filepath=SRC, global_scale=.056444, frame_start=1, use_fps_scale=False, update_scene_fps=True)
source = bpy.context.active_object

def evaluate(frame):
    bpy.context.scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    obj = shoe.evaluated_get(depsgraph)
    mesh = obj.to_mesh()
    try:
        if len(mesh.vertices) != len(shoe.data.vertices):
            raise RuntimeError('Shoe mesh topology changed')
        points = {side: {i: list(obj.matrix_world @ mesh.vertices[i].co) for i in ids} for side, ids in indices.items()}
    finally:
        obj.to_mesh_clear()
    feet = {side: list(source.matrix_world @ source.pose.bones[f'{side}foot'].head) for side in ('l', 'r')}
    return points, feet

windows = []
for name, side, start, end in [('left_before_jump', 'l', 351, 376), ('right_before_jump', 'r', 361, 381),
                                ('left_after_landing', 'l', 451, 501), ('right_after_landing', 'r', 451, 501)]:
    points, _ = evaluate(start)
    vertex = min(points[side], key=lambda i: points[side][i][2])
    samples = []
    for frame in range(start, end + 1):
        points, feet = evaluate(frame)
        samples.append({'frame': frame, 'tracked_xyz': points[side][vertex],
                        'source_foot_xyz': feet[side], 'lowest_z': min(p[2] for p in points[side].values())})
    windows.append({'name': name, 'side': side, 'anchor_frame': start, 'vertex_index': vertex, 'samples': samples})
(OUT / 'fixed-foot.json').write_text(json.dumps({'fps': 120, 'mesh': shoe.name, 'windows': windows,
    'limitations': ['SOURCE_FOOT_BONE_NOT_CONTACT_MARKER', 'CONTACT_WINDOWS_UNVERIFIED', 'NO_BALL']}, indent=2) + '\n')
print('FIXED_FOOT_DONE', [(w['name'], w['vertex_index'], len(w['samples'])) for w in windows])
