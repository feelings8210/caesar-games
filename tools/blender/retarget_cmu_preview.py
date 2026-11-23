"""Experiment: CMU basketball mocap (ASF/AMC) on our athlete rig, rendered beside the current
game clip. Preview only -- nothing here is wired into the game.

  blender-5.2.2 -b -P retarget_cmu_preview.py -- <out_dir> <athlete.glb> <asf> <amc> <current.glb> <current_action>
        [--step 4] [--res 960x540] [--label name]

Method: forward kinematics of the AMC (CMU convention L = parent * C * R * C^-1) gives every
joint's position per frame; positions are scaled by leg length onto our rig and drive empties;
the rig follows with Damped Track per bone (direction only) and the pelvis copies the CMU root
rotation and location. Twist below the pelvis is not transferred (forearms, neck) -- a known
limit of this first pass. Output: frames/<label>_####.png, then ffmpeg on the worker.
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, ATHLETE, ASF, AMC, CUR_GLB, CUR_ACTION = argv[:6]
opt = {'step': 4, 'res': '960x540', 'label': 'clip'}
i = 6
while i < len(argv):
    k = argv[i].lstrip('-'); opt[k] = argv[i + 1]; i += 2
STEP = int(opt['step'])
os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)

# ----------------------------------------------------------------------------- ASF / AMC
def parse_asf(path):
    lines = [l.strip() for l in open(path, encoding='latin-1')]
    bones, hier, unit = {}, {}, 1.0
    i = 0
    sec = None
    cur = None
    while i < len(lines):
        l = lines[i]
        if l.startswith(':'):
            sec = l.split()[0]
            if sec == ':units':
                pass
        elif sec == ':units' and l.startswith('length'):
            unit = 1.0 / float(l.split()[1])
        elif sec == ':bonedata':
            if l == 'begin':
                cur = {'dof': [], 'axis': (0, 0, 0)}
            elif l == 'end':
                bones[cur['name']] = cur
            elif cur is not None:
                t = l.split()
                if t[0] == 'name': cur['name'] = t[1]
                elif t[0] == 'direction': cur['dir'] = Vector([float(v) for v in t[1:4]])
                elif t[0] == 'length': cur['len'] = float(t[1])
                elif t[0] == 'axis': cur['axis'] = tuple(float(v) for v in t[1:4])
                elif t[0] == 'dof': cur['dof'] = t[1:]
        elif sec == ':hierarchy':
            t = l.split()
            if t and t[0] not in ('begin', 'end'):
                hier[t[0]] = t[1:]
        i += 1
    for b in bones.values():
        b['C'] = Euler([math.radians(a) for a in b['axis']], 'XYZ').to_matrix()
        b['Ci'] = b['C'].inverted()
    return bones, hier, unit


def parse_amc(path):
    frames, cur = [], None
    for l in open(path, encoding='latin-1'):
        l = l.strip()
        if not l or l.startswith('#') or l.startswith(':'):
            continue
        t = l.split()
        if len(t) == 1 and t[0].isdigit():
            cur = {}; frames.append(cur)
        elif cur is not None:
            cur[t[0]] = [float(v) for v in t[1:]]
    return frames


def fk(bones, hier, unit, fr):
    """Joint positions (end of each bone, plus 'root') in CMU space, and the root matrix."""
    r = fr['root']
    root_pos = Vector(r[:3]) * unit
    root_m = Euler([math.radians(a) for a in r[3:6]], 'XYZ').to_matrix()
    pos, mats = {'root': root_pos}, {'root': root_m}
    stack = ['root']
    while stack:
        p = stack.pop()
        for c in hier.get(p, []):
            b = bones[c]
            rot = [0.0, 0.0, 0.0]
            vals = fr.get(c, [])
            for k_, d in enumerate(b['dof']):
                rot['xyz'.index(d[1])] = math.radians(vals[k_]) if k_ < len(vals) else 0.0
            m = mats[p] @ b['C'] @ Euler(rot, 'XYZ').to_matrix() @ b['Ci']
            mats[c] = m
            pos[c] = pos[p] + (m @ b['dir']) * b['len'] * unit
            stack.append(c)
    return pos, root_m


P = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))     # CMU (y up, faces +z) -> Blender (z up, faces -y)


def to_b(v):
    return P @ v

# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    return arm, new


def assign(arm, action):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = action
    if hasattr(ad, 'action_slot') and getattr(action, 'slots', None):
        ad.action_slot = action.slots[0]


cur_arm, cur_objs = import_glb(ATHLETE)          # left: current game clip
new_arm, new_objs = import_glb(ATHLETE)          # right: CMU retarget
src_arm, src_objs = import_glb(CUR_GLB)          # carries the current action
act = bpy.data.actions.get(CUR_ACTION) or next(a for a in bpy.data.actions if a.name.startswith(CUR_ACTION))
for o in src_objs:
    bpy.data.objects.remove(o, do_unlink=True)
for a in [cur_arm, new_arm]:
    if a.animation_data:
        a.animation_data.action = None
assign(cur_arm, act)
cur_range = [int(v) for v in act.frame_range]

# Place them side by side (Blender X), both facing the camera at -Y.
cur_arm.location.x -= 3.2
new_arm.location.x += 3.2
bpy.context.view_layer.update()

# Rig measurements (world, rest).
def bone_head(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local
rig_leg = (bone_head(new_arm, 'thigh_l') - bone_head(new_arm, 'calf_l')).length + (bone_head(new_arm, 'calf_l') - bone_head(new_arm, 'foot_l')).length
facing_flip = bone_head(new_arm, 'clavicle_l').x < bone_head(new_arm, 'clavicle_r').x
print('[retarget] rig leg', rig_leg, 'facing flip', facing_flip)

bones, hier, unit = parse_asf(ASF)
frames = parse_amc(AMC)[::STEP]
cmu_leg = (bones['lfemur']['len'] + bones['ltibia']['len']) * unit
S = rig_leg / cmu_leg
print('[retarget] frames', len(frames), 'cmu leg', cmu_leg, 'scale', S)

FLIP = Matrix.Rotation(math.pi, 3, 'Z') if facing_flip else Matrix.Identity(3)
p0, _ = fk(bones, hier, unit, frames[0])
ground = min(min(to_b(v).z for v in fk(bones, hier, unit, f)[0].values()) for f in frames)
origin = Vector((to_b(p0['root']).x, to_b(p0['root']).y, ground))
offset = new_arm.matrix_world.translation.copy()

TARGETS = {    # our bone -> CMU joint it points at
    'spine_01': 'upperback', 'spine_02': 'thorax', 'spine_03': 'lowerneck', 'neck_01': 'upperneck', 'Head': 'head',
    'clavicle_l': 'lclavicle', 'upperarm_l': 'lhumerus', 'lowerarm_l': 'lradius', 'hand_l': 'lhand',
    'clavicle_r': 'rclavicle', 'upperarm_r': 'rhumerus', 'lowerarm_r': 'rradius', 'hand_r': 'rhand',
    'thigh_l': 'lfemur', 'calf_l': 'ltibia', 'foot_l': 'lfoot', 'ball_l': 'ltoes',
    'thigh_r': 'rfemur', 'calf_r': 'rtibia', 'foot_r': 'rfoot', 'ball_r': 'rtoes',
}
emp = {}
for j in set(TARGETS.values()) | {'root'}:
    e = bpy.data.objects.new('cmu_' + j, None); scene.collection.objects.link(e); emp[j] = e
rot_e = bpy.data.objects.new('cmu_pelvis_rot', None); scene.collection.objects.link(rot_e)
rot_e.rotation_mode = 'QUATERNION'
pelvis_rest = (new_arm.matrix_world @ new_arm.data.bones['pelvis'].matrix_local).to_3x3()

for fi, fr in enumerate(frames):
    pos, rm = fk(bones, hier, unit, fr)
    f = fi + 1
    for j, e in emp.items():
        v = FLIP @ ((to_b(pos[j]) - origin) * S) + offset
        e.location = v
        e.keyframe_insert('location', frame=f)
    rb = FLIP @ (P @ rm @ P.inverted()) @ FLIP.inverted()
    rot_e.rotation_quaternion = (rb @ pelvis_rest).to_quaternion()
    rot_e.keyframe_insert('rotation_quaternion', frame=f)
n_new = len(frames)

pb = new_arm.pose.bones
c = pb['pelvis'].constraints.new('COPY_LOCATION'); c.target = emp['root']
c = pb['pelvis'].constraints.new('COPY_ROTATION'); c.target = rot_e
for bn, j in TARGETS.items():
    c = pb[bn].constraints.new('DAMPED_TRACK'); c.target = emp[j]; c.track_axis = 'TRACK_Y'

# Bake the retarget to keys, then drop the helpers.
bpy.ops.object.select_all(action='DESELECT')
new_arm.select_set(True); bpy.context.view_layer.objects.active = new_arm
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=n_new, only_selected=True, visual_keying=True,
                 clear_constraints=True, bake_types={'POSE'})
bpy.ops.object.mode_set(mode='OBJECT')
for e in list(emp.values()) + [rot_e]:
    bpy.data.objects.remove(e, do_unlink=True)

# Stage: floor, light, camera framing both.
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
fl = bpy.context.active_object
m = bpy.data.materials.new('floor'); m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.48, 0.32, 1)
fl.data.materials.append(m)
for loc, en in (((-6, -8, 12), 900), ((8, -4, 10), 500), ((0, 8, 10), 400)):
    ld = bpy.data.lights.new('L', 'AREA'); ld.size = 6; ld.energy = en
    lo = bpy.data.objects.new('L', ld); scene.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 3)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.055, 0.07, 1)
cd = bpy.data.cameras.new('cam'); cd.lens = 35
cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam)
cam.location = (0, -19, 5.2)
cam.rotation_euler = (Vector((0, 0, 3.6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

rw, rh = [int(v) for v in opt['res'].split('x')]
scene.render.resolution_x, scene.render.resolution_y = rw, rh
scene.render.fps = 30
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = eng; break
    except TypeError:
        continue
scene.view_settings.view_transform = 'AgX'

# Play both clips once at 30 fps: the current clip at its own rate, the CMU one at 120/STEP.
n_cur = cur_range[1] - cur_range[0] + 1
total = max(n_new, n_cur)
for f in range(1, total + 1):
    scene.frame_set(f)       # each clip holds its last key once it ends
    scene.render.filepath = os.path.join(OUT, 'frames', f"{opt['label']}_{f:04d}.png")
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError as e:
        print('[retarget] render failed, falling back to Workbench:', e)
        scene.render.engine = 'BLENDER_WORKBENCH'
        bpy.ops.render.render(write_still=True)
print('[retarget] done', {'cmu_frames': n_new, 'current_frames': n_cur, 'scale': S})
