"""Measure one leg's reach and shoe height before/after experimental IK on 3090."""
import json
import os
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(os.environ['MF_OUTPUT_DIR'])
MODELS = {
    'baseline': os.environ.get('HOOPS_BASE_MODEL', '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a08/outputs/cmu-jump-retarget-candidate.glb'),
    'ik': os.environ.get('HOOPS_AUDIT_MODEL', '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/landing-ik/a02/outputs/candidate.glb'),
}
results = {}
side = os.environ.get('HOOPS_AUDIT_SIDE', 'l')
if side not in ('l', 'r'):
    raise RuntimeError('Invalid audit side')
for label, file in MODELS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 120
    bpy.ops.import_scene.gltf(filepath=file)
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    shoe = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'Shoe' for m in o.data.materials))
    groups = {g.index for g in shoe.vertex_groups if g.name in (f'foot_{side}', f'ball_{side}')}
    indices = [v.index for v in shoe.data.vertices if sum(w.weight for w in v.groups if w.group in groups) >= .5]
    if not indices:
        raise RuntimeError(f'No {side} foot vertices')
    records = []
    for frame in range(431, 522):
        bpy.context.scene.frame_set(frame)
        thigh, calf, foot = (rig.pose.bones[f'{n}_{side}'] for n in ('thigh', 'calf', 'foot'))
        hip = rig.matrix_world @ thigh.head
        knee = rig.matrix_world @ calf.head
        ankle = rig.matrix_world @ calf.tail
        foot_tail = rig.matrix_world @ foot.tail
        obj = shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = obj.to_mesh()
        try:
            bottom = min((obj.matrix_world @ mesh.vertices[i].co).z for i in indices)
        finally:
            obj.to_mesh_clear()
        upper, lower = (hip - knee).length, (knee - ankle).length
        desired = ankle - Vector((0, 0, max(0, bottom)))
        records.append({'frame': frame, 'hip': list(hip), 'knee': list(knee), 'ankle': list(ankle),
                        'foot_tail': list(foot_tail), 'bottom': bottom, 'leg_length': upper + lower,
                        'hip_to_ankle': (hip - ankle).length, 'hip_to_grounded_ankle': (hip - desired).length})
    results[label] = records
(OUT / 'reach.json').write_text(json.dumps({'units': 'candidate feet', 'side': side, 'results': results}, indent=2) + '\n')
print('REACH_AUDIT_DONE')
