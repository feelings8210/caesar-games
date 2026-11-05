"""Isolated right-foot landing trajectory experiment, 3090 worker only.

The source foot bone is only a proxy for contact; this does not prove natural
footfall, hand/ball contact, or redistribution rights for the result.
"""
import json
import os
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

OUT = Path(os.environ['MF_OUTPUT_DIR'])
MODEL = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/landing-ik/a03/outputs/candidate.glb'
SOURCE = '/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs/jump.bvh'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 120
bpy.ops.import_scene.gltf(filepath=MODEL)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
shoe = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'Shoe' for m in o.data.materials))
groups = {g.index for g in shoe.vertex_groups if g.name in ('foot_r', 'ball_r')}
indices = [v.index for v in shoe.data.vertices if sum(w.weight for w in v.groups if w.group in groups) >= .5]
if not indices:
    raise RuntimeError('Missing right shoe vertices')
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
bpy.ops.import_anim.bvh(filepath=SOURCE, global_scale=.056444, frame_start=1, use_fps_scale=False, update_scene_fps=True)
source = bpy.context.active_object
scene = bpy.context.scene
calf, foot = rig.pose.bones['calf_r'], rig.pose.bones['foot_r']

def head(arm, name, rest=False):
    b = arm.data.bones[name] if rest else arm.pose.bones[name]
    return arm.matrix_world @ (b.head_local if rest else b.head)

def frame_basis(left, right):
    across = right - left
    across.z = 0
    if across.length < .01:
        raise RuntimeError('Degenerate hip frame')
    across.normalize()
    up = Vector((0, 0, 1))
    return Matrix((across, up.cross(across).normalized(), up)).transposed()

scene.frame_set(1)
alignment = frame_basis(head(rig, 'thigh_l', True), head(rig, 'thigh_r', True)) @ frame_basis(head(source, 'lfemur'), head(source, 'rfemur')).transposed()
scale = sum(rig.data.bones[n].length for n in ('thigh_l', 'calf_l')) / sum(source.data.bones[n].length for n in ('lfemur', 'ltibia'))

def sample(frame, vertex=None):
    scene.frame_set(frame)
    obj = shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = obj.to_mesh()
    try:
        if len(mesh.vertices) != len(shoe.data.vertices):
            raise RuntimeError('Shoe topology changed')
        if vertex is None:
            vertex = min(indices, key=lambda i: (obj.matrix_world @ mesh.vertices[i].co).z)
        point = obj.matrix_world @ mesh.vertices[vertex].co
    finally:
        obj.to_mesh_clear()
    return vertex, point, head(source, 'rfoot'), rig.matrix_world @ calf.tail, foot.matrix.to_quaternion().copy()

vertex, anchor, src_anchor, _, _ = sample(451)
targets = []
for f in range(441, 512):
    _, point, src, ankle, rot = sample(f, vertex)
    expected = anchor + (alignment @ (src - src_anchor)) * scale
    delta = expected - point
    delta.z = 0
    # Gradual transitions; restrict displacement to avoid runaway IK.
    weight = max(0.0, min(1.0, (f - 441) / 10, (511 - f) / 10))
    if delta.length > .5:
        raise RuntimeError(f'Excessive trajectory correction at {f}: {delta.length}')
    targets.append((f, ankle + delta, weight, rot, delta.length))

helper = bpy.data.objects.new('RightFootIK', None)
scene.collection.objects.link(helper)
for f, pos, _, _, _ in targets:
    helper.location = pos
    helper.keyframe_insert('location', frame=f)
constraint = calf.constraints.new('IK')
constraint.target = helper
constraint.chain_count = 2
constraint.use_rotation = False
for f, _, weight, _, _ in targets:
    constraint.influence = weight
    constraint.keyframe_insert('influence', frame=f)
for f, _, _, rot, _ in targets:
    scene.frame_set(f)
    bpy.context.view_layer.update()
    loc, _, size = foot.matrix.decompose()
    foot.matrix = Matrix.LocRotScale(loc, rot, size)
    bpy.context.view_layer.update()
    foot.rotation_mode = 'QUATERNION'
    foot.keyframe_insert('rotation_quaternion', frame=f, group=foot.name)

bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=789, step=1, only_selected=True, visual_keying=True,
                 clear_constraints=True, use_current_action=False, bake_types={'POSE'})
bpy.ops.object.mode_set(mode='OBJECT')
bpy.data.objects.remove(helper, do_unlink=True)
bpy.data.objects.remove(source, do_unlink=True)
rig.animation_data.action.name = 'CMU_Jump_RightFoot_Trial'
for action in list(bpy.data.actions):
    if action != rig.animation_data.action:
        bpy.data.actions.remove(action, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
for child in rig.children_recursive:
    child.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(OUT / 'candidate.glb'), export_format='GLB', use_selection=True, export_animations=True)
(OUT / 'trial.json').write_text(json.dumps({'window': [441, 511], 'full_weight': [451, 501], 'shoe_vertex': vertex,
    'root_scale': scale, 'max_correction_ft': max(x[4] for x in targets),
    'limitations': ['SOURCE_FOOT_IS_NOT_SOLE_CONTACT', 'MANUAL_WINDOW', 'NO_BALL', 'VISUAL_QC_PENDING']}, indent=2) + '\n')
print('RIGHT_FOOT_TRIAL_DONE')
