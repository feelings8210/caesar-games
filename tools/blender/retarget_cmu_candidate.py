"""Internal motion retarget candidate, execute on a registered 3090 only.

This is a rest-space rotation-transfer experiment, not an approved game asset.
It does not solve hand/ball contact or foot locking.
"""
import bpy
import json
import os
from pathlib import Path
from mathutils import Matrix

OUT = Path(os.environ['MF_OUTPUT_DIR'])
ROOT = Path('/srv/media-vault/projects/CAESAR_HOOPS_TACTICS/checkpoints/cmu-convert/a02/outputs')
MODEL = Path('/srv/ai-data/media-work/projects/caesar-hoops-20261010/athlete-neck-blend.glb')
MAP = {
    'root': 'pelvis', 'lowerback': 'spine_01', 'upperback': 'spine_02',
    'thorax': 'spine_03', 'lowerneck': 'neck_01', 'head': 'Head',
    'lfemur': 'thigh_l', 'ltibia': 'calf_l', 'lfoot': 'foot_l', 'ltoes': 'ball_l',
    'rfemur': 'thigh_r', 'rtibia': 'calf_r', 'rfoot': 'foot_r', 'rtoes': 'ball_r',
    'lclavicle': 'clavicle_l', 'lhumerus': 'upperarm_l', 'lradius': 'lowerarm_l', 'lwrist': 'hand_l',
    'rclavicle': 'clavicle_r', 'rhumerus': 'upperarm_r', 'rradius': 'lowerarm_r', 'rwrist': 'hand_r',
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
source_start = {name: (source.matrix_world @ source.pose.bones[name].matrix).to_quaternion().normalized() for name in MAP}
target_rest = {name: target.data.bones[name].matrix_local.to_quaternion() for name in MAP.values()}
for frame in range(start, end + 1, 2):
    bpy.context.scene.frame_set(frame)
    for src_name, dst_name in ordered:
        src = source.pose.bones[src_name]
        dst = target.pose.bones[dst_name]
        # Both imported armatures share Blender's world axes; preserve the
        # target's own rest orientation, not the source's bone roll.
        source_world = (source.matrix_world @ src.matrix).to_quaternion()
        delta = (source_world @ source_start[src_name].inverted()).normalized()
        target_bind = (target.matrix_world.to_quaternion() @ target_rest[dst_name]).normalized()
        goal_world = (delta @ target_bind).normalized()
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
          'start': start, 'end': end, 'sample_every': 2, 'map': MAP, 'alignment': 'source first frame to target rest',
          'limitations': ['NO_ROOT_TRANSLATION', 'NO_FOOT_LOCK', 'NO_BALL_CONTACT', 'VISUAL_QC_PENDING']}
(OUT / 'candidate.json').write_text(json.dumps(report, indent=2) + '\n')
print('RETARGET_CANDIDATE_DONE', file)
