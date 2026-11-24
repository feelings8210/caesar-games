"""Measure animated hand surfaces during an isolated jump-shot candidate.

No ball was captured in the source; this is geometric evidence only and does
not claim a grip, release time, or an acceptable shooting motion.
"""
import json
import os
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(os.environ['MF_OUTPUT_DIR'])
MODEL = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/right-foot/a01/outputs/candidate.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=MODEL)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = bpy.data.objects.get('AnatomicalBody')
if body is None or body.type != 'MESH':
    raise RuntimeError('AnatomicalBody skin is missing')
indices = {}
for side in ('l', 'r'):
    groups = {g.index for g in body.vertex_groups if g.name == f'hand_{side}'}
    indices[side] = [v.index for v in body.data.vertices if sum(w.weight for w in v.groups if w.group in groups) > .85]
    if len(indices[side]) < 4:
        raise RuntimeError(f'Insufficient {side} hand vertices: {len(indices[side])}')
rows = []
for frame in range(301, 462):
    bpy.context.scene.frame_set(frame)
    obj = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = obj.to_mesh()
    try:
        if len(mesh.vertices) != len(body.data.vertices):
            raise RuntimeError('Hand mesh topology changed')
        points = {side: [obj.matrix_world @ mesh.vertices[i].co for i in ids] for side, ids in indices.items()}
        centres = {side: sum(p, Vector()) / len(p) for side, p in points.items()}
        near = min((a - b).length for a in points['l'] for b in points['r'])
    finally:
        obj.to_mesh_clear()
    bones = {side: list(rig.matrix_world @ rig.pose.bones[f'hand_{side}'].head) for side in ('l', 'r')}
    rows.append({'frame': frame, 'palm_centres': {s: list(v) for s, v in centres.items()},
                 'bone_heads': bones, 'palm_centre_distance': (centres['l'] - centres['r']).length,
                 'nearest_hand_vertices': near})
(OUT / 'hands.json').write_text(json.dumps({'fps': 120, 'unit': 'feet', 'game_ball_radius_ft': .45,
    'hand_vertex_counts': {s: len(v) for s, v in indices.items()}, 'rows': rows,
    'limitations': ['NO_CAPTURED_BALL', 'WEIGHTED_HAND_VERTICES_NOT_PALM_CONTACT', 'NO_RELEASE_LABEL', 'NO_VISUAL_QC']}, indent=2) + '\n')
print('HANDS_AUDIT_DONE', {s: len(v) for s, v in indices.items()}, len(rows))
