"""Measure evaluated shoe vertices and source feet; only on a 3090 worker.

This records evidence; it does not assert that a motion is acceptable.
"""
import bpy
import json
import os
from pathlib import Path

OUT = Path(os.environ['MF_OUTPUT_DIR'])
SRC = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs/jump.bvh'
DST = os.environ.get('HOOPS_AUDIT_MODEL', '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a08/outputs/cmu-jump-retarget-candidate.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=DST)
target = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
shoe_sets = {'l': [], 'r': []}
mesh_description = []
for obj in bpy.context.scene.objects:
    if obj.type != 'MESH' or not any(m and m.name == 'Shoe' for m in obj.data.materials):
        continue
    groups = {side: {g.index for g in obj.vertex_groups if g.name in (f'foot_{side}', f'ball_{side}')} for side in ('l', 'r')}
    selected = {side: [] for side in ('l', 'r')}
    for v in obj.data.vertices:
        weights = {side: sum(w.weight for w in v.groups if w.group in groups[side]) for side in ('l', 'r')}
        side = max(weights, key=weights.get)
        if weights[side] >= .5:
            selected[side].append(v.index)
    mesh_description.append({'mesh': obj.name, 'vertices': len(obj.data.vertices), 'left': len(selected['l']), 'right': len(selected['r'])})
    for side in ('l', 'r'):
        if selected[side]:
            shoe_sets[side].append((obj, selected[side]))
if not all(shoe_sets.values()):
    raise RuntimeError(f'Missing identified shoe geometry: {mesh_description}')
bpy.ops.import_anim.bvh(filepath=SRC, global_scale=.056444, frame_start=1,
                        use_fps_scale=False, update_scene_fps=True)
source = bpy.context.active_object

def source_foot(name):
    bone = source.pose.bones[name]
    pos = source.matrix_world @ bone.head
    return list(pos)

rows = []
for frame in range(1, 790, 5):
    bpy.context.scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    shoes = {}
    for side in ('l', 'r'):
        points = []
        for obj, indices in shoe_sets[side]:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            try:
                if len(mesh.vertices) != len(obj.data.vertices):
                    raise RuntimeError(f'Topology changed: {obj.name}')
                points.extend(evaluated.matrix_world @ mesh.vertices[i].co for i in indices)
            finally:
                evaluated.to_mesh_clear()
        low = min(p.z for p in points)
        near = [p for p in points if p.z <= low + .03]
        shoes[side] = {'min_z': low, 'contact_xy': [sum(p.x for p in near)/len(near), sum(p.y for p in near)/len(near)], 'near_count': len(near)}
    rows.append({'frame': frame, 'source': {'l': source_foot('lfoot'), 'r': source_foot('rfoot')}, 'shoe': shoes})
(OUT / 'shoe-contact.json').write_text(json.dumps({'fps': 120, 'sample_every': 5, 'shoe_meshes': mesh_description, 'rows': rows}, indent=2) + '\n')
print('SHOE_CONTACT_DONE', len(rows), mesh_description)
