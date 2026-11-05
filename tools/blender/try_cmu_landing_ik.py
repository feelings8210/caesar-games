"""Experimental left-leg landing correction. Run only on a registered 3090.

The candidate window is manually chosen from a single trial; this is not an
automatic contact detector or approved gameplay asset. Bake IK to a new GLB.
"""
import json
import os
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(os.environ['MF_OUTPUT_DIR'])
INPUT = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-retarget/a08/outputs/cmu-jump-retarget-candidate.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 120  # glTF seconds must map to the source's 120 fps before import
bpy.ops.import_scene.gltf(filepath=INPUT)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'Shoe' for m in o.data.materials)]
if len(meshes) != 1:
    raise RuntimeError(f'Expected one shoe-containing mesh, got {len(meshes)}')
shoe = meshes[0]
groups = {g.index for g in shoe.vertex_groups if g.name in ('foot_l', 'ball_l')}
indices = [v.index for v in shoe.data.vertices if sum(w.weight for w in v.groups if w.group in groups) >= .5]
if not indices:
    raise RuntimeError('Left foot vertices missing')
scene = bpy.context.scene
calf = rig.pose.bones['calf_l']

def influence(frame):
    if frame < 441 or frame > 511:
        return 0.0
    return min(1.0, (frame - 441) / 10, (511 - frame) / 10)

# Sample the original pose before adding the constraint: a moving target
# preserves the original horizontal ankle path and only lowers it toward the
# floor. It does not claim to remove horizontal sliding.
targets = []
for frame in range(441, 512):
    scene.frame_set(frame)
    obj = shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = obj.to_mesh()
    try:
        if len(mesh.vertices) != len(shoe.data.vertices):
            raise RuntimeError('Shoe topology changed')
        bottom = min((obj.matrix_world @ mesh.vertices[i].co).z for i in indices)
    finally:
        obj.to_mesh_clear()
    ankle = rig.matrix_world @ calf.tail
    lower = min(.25, max(0.0, bottom))
    targets.append((frame, ankle - Vector((0, 0, lower)), bottom, influence(frame)))

helper = bpy.data.objects.new('ExperimentalLandingIK', None)
scene.collection.objects.link(helper)
for frame, pos, _, weight in targets:
    helper.location = pos
    helper.keyframe_insert('location', frame=frame)
constraint = calf.constraints.new('IK')
constraint.target = helper
constraint.chain_count = 2
constraint.use_rotation = False
for frame, _, _, weight in targets:
    constraint.influence = weight
    constraint.keyframe_insert('influence', frame=frame)

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=789, step=1, only_selected=True,
                 visual_keying=True, clear_constraints=True, use_current_action=False, bake_types={'POSE'})
bpy.ops.object.mode_set(mode='OBJECT')
bpy.data.objects.remove(helper, do_unlink=True)
rig.animation_data.action.name = 'CMU_Jump_Landing_IK_Trial'
for action in list(bpy.data.actions):
    if action != rig.animation_data.action:
        bpy.data.actions.remove(action, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for child in rig.children_recursive:
    child.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(OUT / 'candidate.glb'), export_format='GLB', use_selection=True, export_animations=True)
(OUT / 'trial.json').write_text(json.dumps({'window': [441, 511], 'full_influence': [451, 501],
    'samples': [{'frame': f, 'bottom_before': z, 'influence': w} for f, _, z, w in targets],
    'limitations': ['MANUAL_CONTACT_WINDOW', 'NO_HORIZONTAL_FOOT_LOCK', 'NO_BALL', 'VISUAL_QC_PENDING']}, indent=2) + '\n')
print('LANDING_IK_TRIAL_DONE')
