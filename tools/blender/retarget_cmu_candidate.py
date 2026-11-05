"""Internal motion retarget candidate, execute on a registered 3090 only.

This is a rest-space rotation-transfer experiment, not an approved game asset.
It does not solve hand/ball contact or foot locking.
"""
import bpy
import json
import os
from pathlib import Path
from mathutils import Matrix, Vector

OUT = Path(os.environ['MF_OUTPUT_DIR'])
ROOT = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs')
MODEL = Path('/srv/ai-data/media-work/projects/caesar-hoops-20261010/athlete-neck-blend.glb')
MAP = {
    'lowerback': 'spine_01', 'upperback': 'spine_02',
    'thorax': 'spine_03', 'lowerneck': 'neck_01', 'head': 'Head',
    'lfemur': 'thigh_l', 'ltibia': 'calf_l', 'lfoot': 'foot_l', 'ltoes': 'ball_l',
    'rfemur': 'thigh_r', 'rtibia': 'calf_r', 'rfoot': 'foot_r', 'rtoes': 'ball_r',
    'lclavicle': 'clavicle_l', 'lhumerus': 'upperarm_l', 'lradius': 'lowerarm_l',
    'rclavicle': 'clavicle_r', 'rhumerus': 'upperarm_r', 'rradius': 'lowerarm_r',
}
bpy.ops.preferences.addon_enable(module='io_anim_bvh')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(MODEL))
target = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
target.animation_data_clear()
bpy.ops.import_anim.bvh(filepath=str(ROOT / 'jump.bvh'), global_scale=0.056444,
                        frame_start=1, use_fps_scale=False, update_scene_fps=True)
source = bpy.context.active_object
missing = [(s, t) for s, t in MAP.items() if s not in source.pose.bones or t not in target.pose.bones]
if missing:
    raise RuntimeError(f'Unmapped bones: {missing}')
start, end = map(int, source.animation_data.action.frame_range)
ordered = sorted(MAP.items(), key=lambda pair: len(target.data.bones[pair[1]].parent_recursive))
bpy.context.scene.frame_set(start)
def world_head(arm, name, rest=False):
    bone = arm.data.bones[name] if rest else arm.pose.bones[name]
    return arm.matrix_world @ (bone.head_local if rest else bone.head)

def body_frame(left, right):
    up = Vector((0, 0, 1))
    across = right - left
    across.z = 0
    if across.length < 0.01:
        raise RuntimeError('Hip axis is degenerate')
    across.normalize()
    forward = up.cross(across).normalized()
    return Matrix((across, forward, up)).transposed()

source_frame = body_frame(world_head(source, 'lfemur'), world_head(source, 'rfemur'))
target_frame = body_frame(world_head(target, 'thigh_l', True), world_head(target, 'thigh_r', True))
alignment = target_frame @ source_frame.transposed()
target_start = {name: (target.matrix_world.to_quaternion() @ target.data.bones[name].matrix_local.to_quaternion()).normalized() for name in MAP.values()}
target_direction = {name: (target.matrix_world.to_3x3() @ (target.data.bones[name].tail_local - target.data.bones[name].head_local)).normalized() for name in MAP.values()}
source_root_start = world_head(source, 'root')
target_pelvis_start = target.pose.bones['pelvis'].matrix.copy()
source_leg = sum(source.data.bones[n].length for n in ('lfemur', 'ltibia'))
target_leg = sum(target.data.bones[n].length for n in ('thigh_l', 'calf_l'))
if min(source_leg, target_leg) < 0.01:
    raise RuntimeError('Invalid leg length')
root_scale = target_leg / source_leg
for frame in range(start, end + 1, 2):
    bpy.context.scene.frame_set(frame)
    delta_root = alignment @ (world_head(source, 'root') - source_root_start)
    delta_armature = target.matrix_world.to_3x3().inverted() @ (delta_root * root_scale)
    # PoseBone.location is in bone-local axes, not armature axes. Assigning a
    # translated armature-space pose lets Blender convert through the parent
    # and the pelvis rest matrix before keying the local location channels.
    target.pose.bones['pelvis'].matrix = Matrix.Translation(delta_armature) @ target_pelvis_start
    target.pose.bones['pelvis'].keyframe_insert(data_path='location', frame=frame, group='pelvis')
    bpy.context.view_layer.update()
    for src_name, dst_name in ordered:
        src = source.pose.bones[src_name]
        dst = target.pose.bones[dst_name]
        # Both imported armatures share Blender's world axes; preserve the
        # target's own rest orientation, not the source's bone roll.
        direction = (source.matrix_world.to_3x3() @ (src.tail - src.head)).normalized()
        if direction.length < 0.9:
            raise RuntimeError(f'Zero direction at frame {frame}: {src_name}')
        direction = (alignment @ direction).normalized()
        delta = target_direction[dst_name].rotation_difference(direction)
        goal_world = (delta @ target_start[dst_name]).normalized()
        pose_matrix = dst.matrix.copy()
        # Maintain position/scale while replacing armature-space orientation.
        location, _, scale = pose_matrix.decompose()
        goal_arm = target.matrix_world.to_quaternion().inverted() @ goal_world
        dst.matrix = Matrix.LocRotScale(location, goal_arm, scale)
        bpy.context.view_layer.update()
        dst.rotation_mode = 'QUATERNION'
        dst.keyframe_insert(data_path='rotation_quaternion', frame=frame, group=dst_name)
if end % 2 == 0:
    raise RuntimeError('Unexpected frame endpoint; explicit final key needed')
if not target.animation_data or not target.animation_data.action:
    raise RuntimeError('No target action')
target.animation_data.action.name = 'CMU_Jump_Candidate'
bpy.data.objects.remove(source, do_unlink=True)
for action in list(bpy.data.actions):
    if action != target.animation_data.action:
        bpy.data.actions.remove(action, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
target.select_set(True)
for child in target.children_recursive:
    child.select_set(True)
bpy.context.view_layer.objects.active = target
file = OUT / 'cmu-jump-retarget-candidate.glb'
bpy.ops.export_scene.gltf(filepath=str(file), export_format='GLB', use_selection=True, export_animations=True)
report = {'source': 'CMU subject124 trial05; corrected conversion a02', 'fps': 120,
          'start': start, 'end': end, 'sample_every': 2, 'map': MAP, 'alignment': 'hip frame plus absolute bone direction, no twist transfer',
          'root_scale': root_scale, 'limitations': ['NO_FOOT_LOCK', 'NO_BALL_CONTACT', 'VISUAL_QC_PENDING']}
(OUT / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
print('RETARGET_CANDIDATE_DONE', file)
