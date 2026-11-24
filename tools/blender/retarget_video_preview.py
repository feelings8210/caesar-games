"""Video keypoints (SAM 3D Body, tools/motion/video_to_keypoints.py) -> our athlete rig, preview renders.

  blender-5.2.2 -b -P retarget_video_preview.py -- <out_dir> <athlete.glb> <keypoints.npz>
        [--pct 50] [--trim 0:217] [--res 1920x1080]

Writes frames/cam_####.png (the original phone camera, transparent film, same framing as the
video) and frames/side_####.png (a side view following the player), plus retarget.json.
tools/motion/compose_video_compare.py then stacks them next to the source footage.

Method: keypoints are in the phone camera frame (OpenCV axes, metres). We fit the floor plane to
the lowest foot points, rotate it level, scale the whole scene about the camera so the leg length
matches our rig (the picture does not change), then drive the rig like retarget_cmu_preview.py:
pelvis location+rotation from the hips, DAMPED_TRACK for the limbs. Twist (forearm, neck) is not
transferred. A foot that would go below the floor lifts the whole body for that frame.
Experiment only: nothing here is wired into the game.
"""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, ATHLETE, NPZ = argv[:3]
opt = {'pct': '50', 'trim': '', 'res': '1920x1080'}
i = 3
while i < len(argv):
    opt[argv[i].lstrip('-')] = argv[i + 1]; i += 2
os.makedirs(os.path.join(OUT, 'frames'), exist_ok=True)

D = np.load(NPZ)
P = D['kp3d'] + D['cam_t'][:, None, :]          # (N,70,3) camera frame, metres
FOCAL = float(np.median(D['focal']))
FPS = float(D['fps'])
if opt['trim']:
    a_, b_ = (int(v) for v in opt['trim'].split(':'))
    P = P[a_:b_]
N = len(P)
B = np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)   # Blender axes: x right, y forward, z up

def gsmooth(x, sigma):
    if sigma <= 0: return x
    r = int(3 * sigma); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    pad = np.concatenate([x[:1].repeat(r, 0), x, x[-1:].repeat(r, 0)], 0)
    out = np.zeros_like(x)
    for j, w in enumerate(k):
        out += w * pad[j:j + len(x)]
    return out

# Keypoint indices (sam_3d_body/metadata/mhr70.py).
NOSE, LEAR, REAR, LSH, RSH, LEL, REL, LHIP, RHIP, LKN, RKN, LAN, RAN = 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
LBT, LST, LHE, RBT, RST, RHE = 15, 16, 17, 18, 19, 20
RWR, LWR, RMCP, LMCP, LACR, RACR, NECK = 41, 62, 32, 53, 67, 68, 69
FOOT = [LAN, RAN, LBT, LST, LHE, RBT, RST, RHE]

# Smooth: limbs lightly, the root (depth is the noisiest axis) harder.
root = (B[:, LHIP] + B[:, RHIP]) / 2
B = gsmooth(B - root[:, None], 1.5) + gsmooth(root, 3.5)[:, None]

# Floor plane: per frame the lowest foot point; fit a plane to the frames where it is lowest.
n = np.array([0.0, 0.0, 1.0])
for _ in range(4):
    h = B[:, FOOT] @ n
    k = h.argmin(1)
    low = B[np.arange(N), np.array(FOOT)[k]]
    hl = low @ n
    sel = low[hl <= np.quantile(hl, 0.6)]
    c = sel.mean(0)
    _, _, vt = np.linalg.svd(sel - c)
    n = vt[2] if vt[2][2] > 0 else -vt[2]
R = Vector(n.tolist()).rotation_difference(Vector((0, 0, 1))).to_matrix()
Rn = np.array(R)
B = B @ Rn.T
cam = np.zeros(3)
z0 = float(np.median(np.min(B[:, FOOT, 2], 1)[np.min(B[:, FOOT, 2], 1) <= np.quantile(np.min(B[:, FOOT, 2], 1), 0.6)]))
B[..., 2] -= z0; cam[2] -= z0

# Rig.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ATHLETE)
objs = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in objs if o.type == 'ARMATURE')
for o in objs:
    if o.type == 'MESH' and ('LOD' in o.name or o.name in ('Base', 'Icosphere', 'HairFull')):
        o.hide_render = True; o.hide_viewport = True
sk = bpy.data.materials.get('Skin')
if sk:
    bs = sk.node_tree.nodes['Principled BSDF']
    bs.inputs['Metallic'].default_value = 0.0; bs.inputs['Roughness'].default_value = 0.55
    bs.inputs['Base Color'].default_value = (0.42, 0.26, 0.17, 1)
if arm.animation_data: arm.animation_data.action = None
bpy.context.view_layer.update()

def bh(name):
    return arm.matrix_world @ arm.data.bones[name].head_local
rig_leg = (bh('thigh_l') - bh('calf_l')).length + (bh('calf_l') - bh('foot_l')).length
vid_leg = np.median(np.linalg.norm(B[:, LHIP] - B[:, LKN], axis=1) + np.linalg.norm(B[:, LKN] - B[:, LAN], axis=1))
S = rig_leg / vid_leg
# Scale about the camera (picture unchanged), then put the floor back at z = 0.
B = cam + (B - cam) * S
shift = cam[2] * (1 - S)
B[..., 2] -= shift; cam = cam.copy(); cam[2] -= shift
# No foot below the floor: lift the body for those frames (smoothed so it does not pop).
minz = B[:, FOOT, 2].min(1)
lift = gsmooth(np.clip(-minz, 0, None)[:, None], 2.0)[:, 0]
lift = np.maximum(lift, np.clip(-minz, 0, None))
B[..., 2] += lift[:, None]

def V(a): return Vector((float(a[0]), float(a[1]), float(a[2])))

# Pelvis rotation: frame from the hip line and the trunk, relative to the same frame at rest.
def frame(left, right, up_from, up_to):
    x = (left - right).normalized()
    up = (up_to - up_from)
    y = up.cross(x).normalized()        # forward-ish
    z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()
rest_mid = (bh('thigh_l') + bh('thigh_r')) / 2
F_rest = frame(bh('thigh_l'), bh('thigh_r'), rest_mid, bh('neck_01'))
pelvis_rest = (arm.matrix_world @ arm.data.bones['pelvis'].matrix_local).to_3x3()
pelvis_off = F_rest.inverted() @ (bh('pelvis') - rest_mid)

TARGETS = {
    'spine_01': 'neck', 'spine_02': 'neck', 'spine_03': 'neck', 'neck_01': 'ears', 'Head': 'crown',
    'clavicle_l': 'lacr', 'upperarm_l': 'lel', 'lowerarm_l': 'lwr', 'hand_l': 'lmcp',
    'clavicle_r': 'racr', 'upperarm_r': 'rel', 'lowerarm_r': 'rwr', 'hand_r': 'rmcp',
    'thigh_l': 'lkn', 'calf_l': 'lan', 'foot_l': 'ltoe', 'ball_l': 'ltoe2',
    'thigh_r': 'rkn', 'calf_r': 'ran', 'foot_r': 'rtoe', 'ball_r': 'rtoe2',
}
def points(b):
    ears = (b[LEAR] + b[REAR]) / 2
    lt = (b[LBT] + b[LST]) / 2; rt = (b[RBT] + b[RST]) / 2
    return {
        'neck': b[NECK], 'ears': ears, 'crown': ears + (ears - b[NECK]) * 0.8,
        'lacr': b[LSH], 'lel': b[LEL], 'lwr': b[LWR], 'lmcp': b[LMCP],
        'racr': b[RSH], 'rel': b[REL], 'rwr': b[RWR], 'rmcp': b[RMCP],
        'lkn': b[LKN], 'lan': b[LAN], 'ltoe': lt, 'ltoe2': lt + (lt - b[LHE]) * 0.3,
        'rkn': b[RKN], 'ran': b[RAN], 'rtoe': rt, 'rtoe2': rt + (rt - b[RHE]) * 0.3,
    }
emp = {}
for j in set(TARGETS.values()) | {'root'}:
    e = bpy.data.objects.new('kp_' + j, None); scene.collection.objects.link(e); emp[j] = e
rot_e = bpy.data.objects.new('kp_pelvis_rot', None); scene.collection.objects.link(rot_e)
rot_e.rotation_mode = 'QUATERNION'
arm.location = (0, 0, 0)
for fi in range(N):
    f = fi + 1
    b = B[fi]
    for j, v in points(b).items():
        emp[j].location = V(v); emp[j].keyframe_insert('location', frame=f)
    mid = (V(b[LHIP]) + V(b[RHIP])) / 2
    F = frame(V(b[LHIP]), V(b[RHIP]), mid, V(b[NECK]))
    Rw = F @ F_rest.inverted()
    emp['root'].location = mid + F @ pelvis_off; emp['root'].keyframe_insert('location', frame=f)
    rot_e.rotation_quaternion = (Rw @ pelvis_rest).to_quaternion(); rot_e.keyframe_insert('rotation_quaternion', frame=f)

pb = arm.pose.bones
c = pb['pelvis'].constraints.new('COPY_LOCATION'); c.target = emp['root']
c = pb['pelvis'].constraints.new('COPY_ROTATION'); c.target = rot_e
for bn, j in TARGETS.items():
    c = pb[bn].constraints.new('DAMPED_TRACK'); c.target = emp[j]; c.track_axis = 'TRACK_Y'
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.nla.bake(frame_start=1, frame_end=N, only_selected=True, visual_keying=True,
                 clear_constraints=True, bake_types={'POSE'})
bpy.ops.object.mode_set(mode='OBJECT')
for e in list(emp.values()) + [rot_e]:
    bpy.data.objects.remove(e, do_unlink=True)

# Stage.
W_, H_ = (int(v) for v in opt['res'].split('x'))   # source video size (portrait phone clips too)
r = scene.render
r.resolution_x, r.resolution_y, r.resolution_percentage = W_, H_, int(opt['pct'])
r.fps = int(round(FPS))
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        r.engine = eng; break
    except TypeError:
        continue
scene.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.32, 0.32, 0.34, 1)
for loc, en in (((-20, -30, 40), 6000), ((30, 10, 30), 3000)):
    ld = bpy.data.lights.new('L', 'AREA'); ld.size = 20; ld.energy = en
    lo = bpy.data.objects.new('L', ld); scene.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (Vector((0, 40, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, float(B[:, :, 1].mean()), 0))
floor = bpy.context.active_object
fm = bpy.data.materials.new('floor'); fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.42, 0.27, 1)
floor.data.materials.append(fm)

# Camera 1: the phone. Looks along +Y (before the floor rotation), up +Z.
cd = bpy.data.cameras.new('phone'); cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36
cd.lens = FOCAL / W_ * 36; cd.clip_end = 2000
cam1 = bpy.data.objects.new('phone', cd); scene.collection.objects.link(cam1)
base = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0))).transposed()    # cam X=+x, cam Y(up)=+z, cam Z(back)=-y
cam1.matrix_world = Matrix.Translation(V(cam)) @ (R @ base).to_4x4()
# Camera 2: side view, following the player.
cd2 = bpy.data.cameras.new('side'); cd2.lens = 40
cam2 = bpy.data.objects.new('side', cd2); scene.collection.objects.link(cam2)
rootp = gsmooth(((B[:, LHIP] + B[:, RHIP]) / 2), 8.0)
side_dir = Vector((1.0, -0.35, 0.0)).normalized()
for fi in range(N):
    tgt = V(rootp[fi]); tgt.z = 2.9
    cam2.location = tgt + side_dir * 17 + Vector((0, 0, 1.6))
    cam2.rotation_euler = (tgt - cam2.location).to_track_quat('-Z', 'Y').to_euler()
    cam2.keyframe_insert('location', frame=fi + 1); cam2.keyframe_insert('rotation_euler', frame=fi + 1)

scene.frame_start, scene.frame_end = 1, N
info = {'frames': N, 'fps': FPS, 'scale': float(S), 'rig_leg_ft': float(rig_leg), 'video_leg_m': float(vid_leg),
        'floor_normal_cam': n.tolist(), 'lift_frames': int((lift > 0.01).sum()), 'lift_max_ft': float(lift.max()),
        'focal_px': FOCAL, 'pct': int(opt['pct'])}
json.dump(info, open(os.path.join(OUT, 'retarget.json'), 'w'), indent=1)
print('[vret] retarget', json.dumps(info), flush=True)

def render_pass(cam_obj, tag, transparent):
    scene.camera = cam_obj
    r.film_transparent = transparent
    floor.hide_render = transparent
    for f in range(1, N + 1):
        scene.frame_set(f)
        r.filepath = os.path.join(OUT, 'frames', f'{tag}_{f:04d}.png')
        bpy.ops.render.render(write_still=True)
render_pass(cam1, 'cam', True)
render_pass(cam2, 'side', False)
print('[vret] done', flush=True)
