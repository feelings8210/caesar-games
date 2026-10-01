"""Hoops IQ 3D Assets v2.1 - Procedural Build Script for Blender 5.x.

This script creates and exports the v2.1 3D models according to TASK-06b:
  1. assets/hoops/models2/athlete.glb - Rigged, animated basketball player figurine (v2.1 overhaul):
       - Smooth muscular UBC body (SuperHero_Male) + smooth sculpted egg head (CC0 1.0)
       - Independent Jersey and Shorts meshes with clean boundary loops and Solidify thickness
       - Covered torso and thigh skin deleted to completely prevent poke-through and save triangles
       - Total triangles strictly <= 8,000 (relaxed budget)
       - Per-frame exact grounding: every grounded action has lowest foot vertex at Z = 0.00..0.05 ft
       - Sprint and Jog flight phase apex <= 0.60 ft
       - Authentic basketball Jump Shot (Shot) with gather, elevation to forehead set point, wrist snap
       - Upright defensive stance (DefStance, DefSlideL/R, BoxOut) with straight spine and wide arms
  2. assets/hoops/models2/hoop2.glb   - Basketball hoop & cantilever stanchion
  3. assets/hoops/models2/stage.glb   - Black lacquer plinth & architectural stands
  4. assets/hoops/models2/previews/  - Eevee preview renders:
       - broadcast.jpg (game broadcast view with stage, hoop, temporary floor, 10 players)
       - athlete_poses.jpg (6 poses side-by-side on light grey background)
       - athlete_side.jpg (NEW: 6 poses in pure side profile, camera height 3 ft, showing floor contact)
       - hoop.jpg (macro close-up matching hoop_detail.jpg)

Coordinates & Units:
  - 1 unit = 1 foot
  - Court space: X = -25..25, Y = 0..-47 (baseline at Y=0, half-court at Y=-47), Z up.
  - Floor surface at Z = 0.
  - Rim center at (0, -5.25, 10.0).
  - Figurines face Blender -Y.
"""

import math
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector, Euler, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / 'assets' / 'hoops' / 'models2'
PREVIEWS_DIR = MODELS_DIR / 'previews'

UBC_GLTF = Path('/private/tmp/quaternius/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
UAL1_GLB = Path('/private/tmp/quaternius/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb')
UAL1_RM_GLB = Path('/private/tmp/quaternius/ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb')
UAL2_GLB = Path('/private/tmp/quaternius/ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb')

NAVY_COLOR = (0.0103, 0.0331, 0.0976, 1.0)       # #1B3358 linear
RED_COLOR = (0.2705, 0.0529, 0.0395, 1.0)        # #8E4238 linear
GOLD_COLOR = (0.5776, 0.3869, 0.1274, 1.0)       # #C9A76A linear
WARM_SILVER = (0.65, 0.64, 0.62, 1.0)
BRONZE_COLOR = (0.45, 0.28, 0.18, 1.0)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, alpha=1.0, emission=(0, 0, 0), emission_str=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Base Color'].default_value = (*color[:3], alpha)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        if 'Emission Color' in b.inputs:
            b.inputs['Emission Color'].default_value = (*emission[:3], 1.0)
            b.inputs['Emission Strength'].default_value = emission_str
        if alpha < 1.0:
            if 'Alpha' in b.inputs:
                b.inputs['Alpha'].default_value = alpha
            m.blend_method = 'BLEND'
    return m


def assign_material(obj, mat):
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat
    return obj


# ==============================================================================
# 1. ATHLETE BUILDER (athlete.glb v2.1)
# ==============================================================================

def build_athlete(out_path):
    """Build and export athlete.glb v2.1 matching TASK-06b specifications."""
    reset()
    if not UBC_GLTF.exists():
        raise FileNotFoundError(f"Missing UBC source at {UBC_GLTF}")
    if not UAL1_GLB.exists():
        raise FileNotFoundError(f"Missing UAL1 source at {UAL1_GLB}")

    # 1. Import UAL1 first to obtain actions and egg head geometry
    bpy.ops.import_scene.gltf(filepath=str(UAL1_GLB))
    mannequin = [o for o in bpy.data.objects if o.name.startswith('Mannequin')][0]
    for o in list(bpy.data.objects):
        if o != mannequin:
            bpy.data.objects.remove(o, do_unlink=True)

    # Delete everything below neck on mannequin (keep only smooth egg head above Z = 1.54 m)
    bm_m = bmesh.new()
    bm_m.from_mesh(mannequin.data)
    to_delete = [v for v in bm_m.verts if v.co.z < 1.54]
    bmesh.ops.delete(bm_m, geom=to_delete, context='VERTS')
    bm_m.to_mesh(mannequin.data)
    bm_m.free()

    # 2. Import extra actions from UAL2 (Unreal-Godot)
    if UAL2_GLB.exists():
        curr_objs = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(UAL2_GLB))
        for o in list(bpy.data.objects):
            if o not in curr_objs:
                bpy.data.objects.remove(o, do_unlink=True)

    # 3. Import UBC character (Superhero_Male)
    bpy.ops.import_scene.gltf(filepath=str(UBC_GLTF))
    for o in list(bpy.data.objects):
        if o != mannequin and (o.name in ['Eyebrows', 'Eyes', 'Camera', 'Light', 'Cube', 'Icosphere'] or o.name.startswith('Icosphere')):
            bpy.data.objects.remove(o, do_unlink=True)

    arm = bpy.data.objects['Armature']
    body = bpy.data.objects['SuperHero_Male']
    if not arm.animation_data:
        arm.animation_data_create()

    # In body, delete head above neck (Z >= 1.54 m)
    bm_b = bmesh.new()
    bm_b.from_mesh(body.data)
    to_delete = [v for v in bm_b.verts if v.co.z >= 1.54]
    bmesh.ops.delete(bm_b, geom=to_delete, context='VERTS')
    bm_b.to_mesh(body.data)
    bm_b.free()

    # Join mannequin egg head to body
    bpy.ops.object.select_all(action='DESELECT')
    mannequin.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()

    # Weld neck seam
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.015)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Decimate base body slightly to keep total budget well within 8000 triangles
    mod_dec = body.modifiers.new('Decimate', 'DECIMATE')
    mod_dec.ratio = 0.45
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod_dec.name)

    # Athletic proportions adjustment: broaden shoulders 5%, lengthen legs 4%
    for v in body.data.vertices:
        if 1.30 <= v.co.z <= 1.55:
            v.co.x *= 1.05
        if v.co.z < 0.95:
            v.co.z = 0.95 - (0.95 - v.co.z) * 1.04

    # Calculate scale factor so standing height is exactly 6.6 feet (2.012 m)
    z_coords = [v.co.z for v in body.data.vertices]
    orig_h = max(z_coords) - min(z_coords)
    scale_fac = 6.6 / orig_h  # approx 3.627

    # Scale armature and apply scale
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.scale = (scale_fac, scale_fac, scale_fac)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # 4. Create independent Jersey mesh
    jersey_mesh = body.data.copy()
    jersey_obj = bpy.data.objects.new('Jersey', jersey_mesh)
    bpy.context.collection.objects.link(jersey_obj)
    mod_arm_j = jersey_obj.modifiers.new('Armature', 'ARMATURE')
    mod_arm_j.object = arm

    bm_j = bmesh.new()
    bm_j.from_mesh(jersey_mesh)
    geom = bm_j.verts[:] + bm_j.edges[:] + bm_j.faces[:]
    bmesh.ops.bisect_plane(bm_j, geom=geom, plane_co=(0, 0, 3.32), plane_no=(0, 0, -1), clear_outer=True)
    geom = bm_j.verts[:] + bm_j.edges[:] + bm_j.faces[:]
    bmesh.ops.bisect_plane(bm_j, geom=geom, plane_co=(0, 0, 5.35), plane_no=(0, 0, 1), clear_outer=True)
    geom = bm_j.verts[:] + bm_j.edges[:] + bm_j.faces[:]
    bmesh.ops.bisect_plane(bm_j, geom=geom, plane_co=(0.68, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
    geom = bm_j.verts[:] + bm_j.edges[:] + bm_j.faces[:]
    bmesh.ops.bisect_plane(bm_j, geom=geom, plane_co=(-0.68, 0, 0), plane_no=(-1, 0, 0), clear_outer=True)
    neck_verts = [v for v in bm_j.verts if (v.co.x**2 + (v.co.y - 0.05)**2) < 0.28**2 and v.co.z > 4.90]
    bmesh.ops.delete(bm_j, geom=neck_verts, context='VERTS')
    for v in bm_j.verts:
        v.co += v.normal * 0.045
    bm_j.to_mesh(jersey_mesh)
    bm_j.free()

    mod_sol_j = jersey_obj.modifiers.new('Solidify', 'SOLIDIFY')
    mod_sol_j.thickness = 0.015
    mod_sol_j.offset = 1.0

    # 5. Create independent Shorts mesh
    shorts_mesh = body.data.copy()
    shorts_obj = bpy.data.objects.new('Shorts', shorts_mesh)
    bpy.context.collection.objects.link(shorts_obj)
    mod_arm_s = shorts_obj.modifiers.new('Armature', 'ARMATURE')
    mod_arm_s.object = arm

    bm_s = bmesh.new()
    bm_s.from_mesh(shorts_mesh)
    geom = bm_s.verts[:] + bm_s.edges[:] + bm_s.faces[:]
    bmesh.ops.bisect_plane(bm_s, geom=geom, plane_co=(0, 0, 3.40), plane_no=(0, 0, 1), clear_outer=True)
    geom = bm_s.verts[:] + bm_s.edges[:] + bm_s.faces[:]
    bmesh.ops.bisect_plane(bm_s, geom=geom, plane_co=(0, 0, 2.25), plane_no=(0, 0, -1), clear_outer=True)
    for v in bm_s.verts:
        sign = 1.0 if v.co.x > 0 else -1.0
        if v.co.z < 2.60:
            fac = (2.60 - v.co.z) / 0.35
            dx = v.co.x - sign * 0.40
            dy = v.co.y - 0.05
            r = (dx*dx + dy*dy)**0.5
            if r > 0.001:
                v.co.x += (dx / r) * 0.05 * fac
                v.co.y += (dy / r) * 0.05 * fac
        v.co += v.normal * 0.045
    bm_s.to_mesh(shorts_mesh)
    bm_s.free()

    mod_sol_s = shorts_obj.modifiers.new('Solidify', 'SOLIDIFY')
    mod_sol_s.thickness = 0.015
    mod_sol_s.offset = 1.0

    # 6. Delete covered body skin underneath kit to eliminate poke-through
    bm_body = bmesh.new()
    bm_body.from_mesh(body.data)
    torso_del = [v for v in bm_body.verts if 3.35 < v.co.z < 5.15 and abs(v.co.x) < 0.65]
    thigh_del = [v for v in bm_body.verts if 2.30 < v.co.z <= 3.35]
    bmesh.ops.delete(bm_body, geom=torso_del + thigh_del, context='VERTS')
    bm_body.to_mesh(body.data)
    bm_body.free()

    # Materials setup
    mat_skin = make_material('Skin', WARM_SILVER[:3], rough=0.35, metal=0.85)
    mat_jersey = make_material('Jersey', NAVY_COLOR[:3], rough=0.6, metal=0.0)
    mat_shorts = make_material('Shorts', NAVY_COLOR[:3], rough=0.6, metal=0.0)
    mat_shoe = make_material('Shoe', (0.9, 0.9, 0.9), rough=0.4, metal=0.1)

    body.data.materials.clear()
    body.data.materials.append(mat_skin) # slot 0: Skin
    body.data.materials.append(mat_shoe) # slot 1: Shoe
    for p in body.data.polygons:
        p_zs = [body.data.vertices[vi].co.z for vi in p.vertices]
        p.material_index = 1 if max(p_zs) < 0.55 else 0

    jersey_obj.data.materials.clear()
    jersey_obj.data.materials.append(mat_jersey)

    shorts_obj.data.materials.clear()
    shorts_obj.data.materials.append(mat_shorts)

    # 7. Sockets
    s_ball = bpy.data.objects.new('socket_ball', None)
    bpy.context.collection.objects.link(s_ball)
    s_ball.parent = arm
    s_ball.parent_type = 'BONE'
    s_ball.parent_bone = 'hand_r'
    s_ball.location = (0.0, -0.05, 0.12)

    s_front = bpy.data.objects.new('socket_num_front', None)
    bpy.context.collection.objects.link(s_front)
    s_front.parent = arm
    s_front.parent_type = 'BONE'
    s_front.parent_bone = 'spine_03'
    s_front.location = (0.0, -0.45, 0.05)

    s_back = bpy.data.objects.new('socket_num_back', None)
    bpy.context.collection.objects.link(s_back)
    s_back.parent = arm
    s_back.parent_type = 'BONE'
    s_back.parent_bone = 'spine_03'
    s_back.location = (0.0, 0.45, 0.05)

    # 8. Base
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.35, depth=0.16, location=(0, 0, -0.08))
    base_obj = bpy.context.object
    base_obj.name = 'Base'
    mat_base = make_material('Base', NAVY_COLOR[:3], rough=0.2, metal=0.1)
    mat_trim = make_material('Trim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    base_obj.data.materials.append(mat_base)
    base_obj.data.materials.append(mat_trim)
    for p in base_obj.data.polygons:
        p.material_index = 1 if abs(p.normal.z) < 0.2 else 0

    # 9. Set up canonical actions
    action_map = {
        'Idle': 'Idle_Loop',
        'TripleThreat': 'Pistol_Idle_Loop',
        'Dribble': 'Spell_Simple_Idle_Loop',
        'Jog': 'Jog_Fwd_Loop',
        'Sprint': 'Sprint_Loop',
        'DefStance': 'Crouch_Idle_Loop',
        'DefSlideL': 'Crouch_Fwd_Loop',
        'DefSlideR': 'Crouch_Fwd_Loop',
        'Screen': 'Idle_FoldArms_Loop',
        'BoxOut': 'Crouch_Idle_Loop',
        'Pass': 'Punch_Cross',
        'Catch': 'Interact',
        'Shot': None, # Built below
        'Celebrate': 'Yes'
    }

    canonical_actions = {}
    for canon_name, src_name in action_map.items():
        if canon_name == 'Shot':
            shot_act = bpy.data.actions.new('Shot')
            shot_act.slots.new('OBJECT', 'Armature')
            canonical_actions['Shot'] = shot_act
            continue
        src_act = bpy.data.actions.get(src_name) or bpy.data.actions.get('Idle_Loop')
        new_act = src_act.copy()
        new_act.name = canon_name
        canonical_actions[canon_name] = new_act

    # Clean unneeded actions
    for a in list(bpy.data.actions):
        if a.name not in canonical_actions:
            bpy.data.actions.remove(a, do_unlink=True)

    def set_act(arm_obj, act_obj):
        arm_obj.animation_data.action = act_obj
        if not act_obj.slots:
            act_obj.slots.new('OBJECT', 'Armature')
        arm_obj.animation_data.action_slot = act_obj.slots[0]

    # 10. Scale location curves
    for act_name, act in canonical_actions.items():
        if act_name == 'Shot': continue
        for l in act.layers:
            for s in l.strips:
                for cb in s.channelbags:
                    for fc in cb.fcurves:
                        if 'location' in fc.data_path:
                            for kp in fc.keyframe_points:
                                kp.co[1] *= scale_fac

    # 11. Build authentic Jump Shot action (Shot)
    shot_act = canonical_actions['Shot']
    set_act(arm, shot_act)

    def kf_rot(bname, deg, f):
        pb = arm.pose.bones.get(bname)
        if not pb: return
        pb.rotation_mode = 'QUATERNION'
        q = Euler((math.radians(deg[0]), math.radians(deg[1]), math.radians(deg[2])), 'XYZ').to_quaternion()
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=f)

    def kf_loc(bname, loc, f):
        pb = arm.pose.bones.get(bname)
        if not pb: return
        pb.location = loc
        pb.keyframe_insert('location', frame=f)

    root_curve = [
        (0, (0, 0, 0)),
        (6, (0, 0, -0.35)),
        (11, (0, 0, 0.05)),
        (16, (0, 0, 1.65)),
        (19, (0, 0, 1.60)),
        (24, (0, 0, 0.90)),
        (28, (0, 0, 0.00)),
        (30, (0, 0, -0.15)),
        (33, (0, 0, 0.00))
    ]
    for f, loc in root_curve:
        kf_loc('root', loc, f)

    for f in [0, 6, 11, 16, 19, 24, 28, 33]:
        pitch = -5 if f in [16, 19] else (5 if f == 6 else 0)
        kf_rot('spine_01', (pitch, 0, 0), f)
        kf_rot('spine_02', (pitch, 0, 0), f)
        kf_rot('spine_03', (pitch, 0, 0), f)
        kf_rot('Head', (15, 0, 0), f)

    leg_poses = [
        (0,  (10, 0, 0), (-20, 0, 0), (10, 0, 0)),
        (6,  (35, 0, 0), (-65, 0, 0), (30, 0, 0)),
        (11, (5, 0, 0),  (-10, 0, 0), (5, 0, 0)),
        (16, (5, 0, 0),  (-15, 0, 0), (-25, 0, 0)),
        (19, (5, 0, 0),  (-15, 0, 0), (-25, 0, 0)),
        (24, (10, 0, 0), (-25, 0, 0), (-10, 0, 0)),
        (28, (15, 0, 0), (-35, 0, 0), (20, 0, 0)),
        (30, (30, 0, 0), (-55, 0, 0), (25, 0, 0)),
        (33, (10, 0, 0), (-20, 0, 0), (10, 0, 0))
    ]
    for f, th, ca, ft in leg_poses:
        for side in ['_l', '_r']:
            kf_rot('thigh' + side, th, f)
            kf_rot('calf' + side, ca, f)
            kf_rot('foot' + side, ft, f)

    arm_poses = [
        (0,  (20, 0, -25), (45, 0, 0), (-20, 0, 0),   (20, 0, 25), (45, 0, 0), (-20, 0, 0)),
        (6,  (25, 10, -35), (60, 0, 0), (-25, 0, 0),  (25, -10, 35), (60, 0, 0), (-25, 0, 0)),
        (16, (25, 25, -88), (95, -25, 0), (-45, 10, 0), (50, 0, 65), (0, 0, 75), (0, 0, 0)),
        (20, (35, 30, -90), (45, -15, 0), (70, 0, 0),  (45, 0, 60), (0, 0, 70), (0, 0, 0)),
        (24, (35, 30, -90), (45, -15, 0), (70, 0, 0),  (40, 0, 55), (0, 0, 60), (0, 0, 0)),
        (28, (25, 15, -60), (55, 0, 0), (30, 0, 0),   (30, 0, 40), (30, 0, 30), (0, 0, 0)),
        (33, (20, 0, -25), (45, 0, 0), (-20, 0, 0),   (20, 0, 25), (45, 0, 0), (-20, 0, 0))
    ]
    for f, ur, lr, hr, ul, ll, hl in arm_poses:
        kf_rot('upperarm_r', ur, f)
        kf_rot('lowerarm_r', lr, f)
        kf_rot('hand_r', hr, f)
        kf_rot('upperarm_l', ul, f)
        kf_rot('lowerarm_l', ll, f)
        kf_rot('hand_l', hl, f)

    # 12. Overhaul DefStance, DefSlideL, DefSlideR, BoxOut
    q_spine = Euler((-math.radians(26), 0, 0), 'XYZ').to_quaternion()
    q_head = Euler((math.radians(35), 0, 0), 'XYZ').to_quaternion()
    q_arm_l = Euler((math.radians(15), math.radians(45), math.radians(40)), 'XYZ').to_quaternion()
    q_arm_r = Euler((math.radians(15), -math.radians(45), -math.radians(40)), 'XYZ').to_quaternion()

    for def_act_name in ['DefStance', 'DefSlideL', 'DefSlideR', 'BoxOut']:
        act = canonical_actions[def_act_name]
        set_act(arm, act)
        for f in range(int(act.frame_range[0]), int(act.frame_range[1]) + 1):
            bpy.context.scene.frame_set(f)
            for b in ['spine_01', 'spine_02', 'spine_03']:
                pb = arm.pose.bones[b]
                pb.rotation_quaternion = q_spine @ pb.rotation_quaternion
                pb.keyframe_insert('rotation_quaternion', frame=f)
            for b in ['Head', 'neck_01']:
                pb = arm.pose.bones[b]
                pb.rotation_quaternion = q_head @ pb.rotation_quaternion
                pb.keyframe_insert('rotation_quaternion', frame=f)
            arm.pose.bones['upperarm_l'].rotation_quaternion = q_arm_l @ arm.pose.bones['upperarm_l'].rotation_quaternion
            arm.pose.bones['upperarm_l'].keyframe_insert('rotation_quaternion', frame=f)
            arm.pose.bones['upperarm_r'].rotation_quaternion = q_arm_r @ arm.pose.bones['upperarm_r'].rotation_quaternion
            arm.pose.bones['upperarm_r'].keyframe_insert('rotation_quaternion', frame=f)

    # 13. Auto-grounding all actions
    grounded_actions = ['Idle', 'TripleThreat', 'Dribble', 'DefStance', 'DefSlideL', 'DefSlideR', 'Screen', 'BoxOut', 'Pass', 'Catch']
    pb_root = arm.pose.bones['root']

    # For grounded actions: initialize root to (0,0,0) then exact per-frame offset
    for act_name in grounded_actions:
        act = canonical_actions[act_name]
        set_act(arm, act)
        f_start = int(act.frame_range[0])
        f_end = int(act.frame_range[1])

        for f in range(f_start, f_end + 1):
            pb_root.location = (0, 0, 0)
            pb_root.keyframe_insert('location', frame=f)

        bpy.context.view_layer.update()

        z_base = []
        for f in range(f_start, f_end + 1):
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            deps = bpy.context.evaluated_depsgraph_get()
            eo = body.evaluated_get(deps)
            em = eo.to_mesh()
            z_base.append(min((eo.matrix_world @ v.co).z for v in em.vertices))
            eo.to_mesh_clear()

        for f in range(f_start, f_end + 1):
            delta = 0.018 - z_base[f - f_start]
            pb_root.location = (0, 0, delta)
            pb_root.keyframe_insert('location', frame=f)

    # Celebrate: initialize root to (0,0,0) then ground
    act = canonical_actions['Celebrate']
    set_act(arm, act)
    f_start = int(act.frame_range[0])
    f_end = int(act.frame_range[1])
    for f in range(f_start, f_end + 1):
        pb_root.location = (0, 0, 0)
        pb_root.keyframe_insert('location', frame=f)
    bpy.context.view_layer.update()
    z_base = []
    for f in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        deps = bpy.context.evaluated_depsgraph_get()
        eo = body.evaluated_get(deps)
        em = eo.to_mesh()
        z_base.append(min((eo.matrix_world @ v.co).z for v in em.vertices))
        eo.to_mesh_clear()
    for f in range(f_start, f_end + 1):
        delta = 0.018 - z_base[f - f_start]
        pb_root.location = (0, 0, delta)
        pb_root.keyframe_insert('location', frame=f)

    # Jog and Sprint: plant foot to 0.018 ft, flight phase apex capped <= 0.52 ft
    for act_name in ['Jog', 'Sprint']:
        act = canonical_actions[act_name]
        set_act(arm, act)
        f_start = int(act.frame_range[0])
        f_end = int(act.frame_range[1])

        for f in range(f_start, f_end + 1):
            pb_root.location = (0, 0, 0)
            pb_root.keyframe_insert('location', frame=f)

        bpy.context.view_layer.update()

        zs = []
        for f in range(f_start, f_end + 1):
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            deps = bpy.context.evaluated_depsgraph_get()
            eo = body.evaluated_get(deps)
            em = eo.to_mesh()
            zs.append(min((eo.matrix_world @ v.co).z for v in em.vertices))
            eo.to_mesh_clear()

        min_cycle = min(zs)
        max_cycle = max(zs)
        target_plant = 0.018
        target_max = 0.52
        for f in range(f_start, f_end + 1):
            z_curr = zs[f - f_start]
            rel = (z_curr - min_cycle) / (max_cycle - min_cycle) if max_cycle > min_cycle else 0.0
            z_new = target_plant + rel * (target_max - target_plant)
            delta = z_new - z_curr
            pb_root.location = (0, 0, delta)
            pb_root.keyframe_insert('location', frame=f)

    # Shot: ground gather (0..6) and landing (30..33) to exact 0.018 ft, smooth parabolic flight apex (7..29)
    act = canonical_actions['Shot']
    set_act(arm, act)

    # 1. Reset all frames to (0,0,0)
    for f in range(34):
        pb_root.location = (0, 0, 0)
        pb_root.keyframe_insert('location', frame=f)

    # Set LINEAR interpolation on root curves immediately
    for l in act.layers:
        for s in l.strips:
            for cb in s.channelbags:
                for fc in cb.fcurves:
                    if 'root' in fc.data_path and 'location' in fc.data_path:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'LINEAR'

    bpy.context.view_layer.update()

    # 2. Measure z_base on each frame when root is (0,0,0)
    z_base = []
    for f in range(34):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        deps = bpy.context.evaluated_depsgraph_get()
        eo = body.evaluated_get(deps)
        em = eo.to_mesh()
        z_base.append(min((eo.matrix_world @ v.co).z for v in em.vertices))
        eo.to_mesh_clear()

    # 3. Apply exact target Z
    for f in range(34):
        if f <= 6 or f >= 30:
            z_target = 0.018
        else:
            t = (f - 6) / 24.0
            z_target = 0.018 + 4.0 * 1.45 * t * (1.0 - t)
        delta = z_target - z_base[f]
        pb_root.location = (0, 0, delta)
        pb_root.keyframe_insert('location', frame=f)

    # Ensure all root curves across all actions are LINEAR
    for act_name, a in canonical_actions.items():
        for l in a.layers:
            for s in l.strips:
                for cb in s.channelbags:
                    for fc in cb.fcurves:
                        if 'root' in fc.data_path and 'location' in fc.data_path:
                            for kp in fc.keyframe_points:
                                kp.interpolation = 'LINEAR'

    print("\n================== ACTION LOWEST Z VERIFICATION ==================")
    for act_name in sorted(canonical_actions.keys()):
        act = canonical_actions[act_name]
        set_act(arm, act)
        f_start = int(act.frame_range[0])
        f_end = int(act.frame_range[1])
        min_zs = []
        for f in range(f_start, f_end + 1):
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            deps = bpy.context.evaluated_depsgraph_get()
            eo = body.evaluated_get(deps)
            em = eo.to_mesh()
            min_zs.append(min((eo.matrix_world @ v.co).z for v in em.vertices))
            eo.to_mesh_clear()
        print(f"  {act_name:15}: min={min(min_zs):.3f} ft, max={max(min_zs):.3f} ft (frames {f_start}..{f_end})")
    print("==================================================================\n")

    # Set default action to Idle
    set_act(arm, canonical_actions['Idle'])

    for pb in arm.pose.bones:
        pb.custom_shape = None

    # Clean up any leftover objects that are not part of athlete.glb
    allowed_objects = {'Armature', 'SuperHero_Male', 'Jersey', 'Shorts', 'Base', 'socket_ball', 'socket_num_front', 'socket_num_back'}
    for o in list(bpy.data.objects):
        if o.name not in allowed_objects:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)

    # Export to GLB
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_draco_mesh_compression_enable=False
    )
    print(f"Exported athlete.glb to {out_path} ({os.path.getsize(out_path):,} bytes)")

def build_hoop(out_path):
    """Build and export hoop2.glb in world coordinates matching hoop_detail.jpg."""
    reset()

    # Materials
    mat_rim = make_material('Rim', srgb('#DD4411'), rough=0.25, metal=0.7)
    mat_glass = make_material('Glass', (0.9, 0.95, 1.0), rough=0.05, metal=0.05, alpha=0.35)
    mat_frame = make_material('Frame', (0.98, 0.98, 0.98), rough=0.3, metal=0.1)
    mat_net = make_material('Net', (0.95, 0.93, 0.90), rough=0.6, metal=0.0)
    mat_stand = make_material('Stand', srgb('#181B20'), rough=0.3, metal=0.85)
    mat_pad = make_material('Pad', NAVY_COLOR[:3], rough=0.5, metal=0.05)

    # 1. Rim: inner radius 0.75 ft (dia 1.5 ft), center at (0, -5.25, 10.0)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.75, minor_radius=0.035,
        major_segments=32, minor_segments=12,
        location=(0, -5.25, 10.0)
    )
    rim_obj = assign_material(bpy.context.object, mat_rim)
    rim_obj.name = 'Rim'

    # Rim mounting bracket / spring flex box connecting rim to backboard
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -4.25, 9.95))
    bracket = assign_material(bpy.context.object, mat_rim)
    bracket.scale = (0.35, 0.40, 0.25)
    bracket.name = 'Bracket'

    # 2. Glass Backboard: 6.0 ft wide (X -3..3) x 3.5 ft high (Z 9.5..13.0), front at Y = -4.0
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -3.95, 11.25))
    glass = assign_material(bpy.context.object, mat_glass)
    glass.scale = (6.0, 0.10, 3.5)
    glass.name = 'Backboard_Glass'

    # 3. Frame: Outer border and inner target rectangle on front face (Y = -4.005)
    # We construct a mesh for the white border markings
    bm_mesh = bpy.data.meshes.new('Backboard_Frame_Mesh')
    frame_obj = bpy.data.objects.new('Frame', bm_mesh)
    bpy.context.collection.objects.link(frame_obj)
    assign_material(frame_obj, mat_frame)

    import bmesh
    bm = bmesh.new()
    
    # Outer 2-inch border (width 0.167 ft)
    w_out, h_out = 3.0, 1.75
    t_edge = 0.167
    yf = -4.01
    
    # Outer frame quads
    # Top
    v1 = bm.verts.new((-w_out, yf, 11.25 + h_out))
    v2 = bm.verts.new((w_out, yf, 11.25 + h_out))
    v3 = bm.verts.new((w_out, yf, 11.25 + h_out - t_edge))
    v4 = bm.verts.new((-w_out, yf, 11.25 + h_out - t_edge))
    bm.faces.new((v1, v2, v3, v4))
    # Bottom
    v5 = bm.verts.new((-w_out, yf, 11.25 - h_out + t_edge))
    v6 = bm.verts.new((w_out, yf, 11.25 - h_out + t_edge))
    v7 = bm.verts.new((w_out, yf, 11.25 - h_out))
    v8 = bm.verts.new((-w_out, yf, 11.25 - h_out))
    bm.faces.new((v5, v6, v7, v8))
    # Left
    v9 = bm.verts.new((-w_out, yf, 11.25 + h_out - t_edge))
    v10 = bm.verts.new((-w_out + t_edge, yf, 11.25 + h_out - t_edge))
    v11 = bm.verts.new((-w_out + t_edge, yf, 11.25 - h_out + t_edge))
    v12 = bm.verts.new((-w_out, yf, 11.25 - h_out + t_edge))
    bm.faces.new((v9, v10, v11, v12))
    # Right
    v13 = bm.verts.new((w_out - t_edge, yf, 11.25 + h_out - t_edge))
    v14 = bm.verts.new((w_out, yf, 11.25 + h_out - t_edge))
    v15 = bm.verts.new((w_out, yf, 11.25 - h_out + t_edge))
    v16 = bm.verts.new((w_out - t_edge, yf, 11.25 - h_out + t_edge))
    bm.faces.new((v13, v14, v15, v16))

    # Inner target box: 2.0 ft wide (X -1..1), 1.5 ft high (Z 9.75..11.25)
    bx_w, bx_h = 1.0, 0.75
    bx_z = 10.5
    bx_t = 0.125
    # Inner box top
    bm.faces.new([
        bm.verts.new((-bx_w, yf, bx_z + bx_h)),
        bm.verts.new((bx_w, yf, bx_z + bx_h)),
        bm.verts.new((bx_w, yf, bx_z + bx_h - bx_t)),
        bm.verts.new((-bx_w, yf, bx_z + bx_h - bx_t))
    ])
    # Inner box bottom
    bm.faces.new([
        bm.verts.new((-bx_w, yf, bx_z - bx_h + bx_t)),
        bm.verts.new((bx_w, yf, bx_z - bx_h + bx_t)),
        bm.verts.new((bx_w, yf, bx_z - bx_h)),
        bm.verts.new((-bx_w, yf, bx_z - bx_h))
    ])
    # Inner box left & right
    bm.faces.new([
        bm.verts.new((-bx_w, yf, bx_z + bx_h - bx_t)),
        bm.verts.new((-bx_w + bx_t, yf, bx_z + bx_h - bx_t)),
        bm.verts.new((-bx_w + bx_t, yf, bx_z - bx_h + bx_t)),
        bm.verts.new((-bx_w, yf, bx_z - bx_h + bx_t))
    ])
    bm.faces.new([
        bm.verts.new((bx_w - bx_t, yf, bx_z + bx_h - bx_t)),
        bm.verts.new((bx_w, yf, bx_z + bx_h - bx_t)),
        bm.verts.new((bx_w, yf, bx_z - bx_h + bx_t)),
        bm.verts.new((bx_w - bx_t, yf, bx_z - bx_h + bx_t))
    ])

    bm.to_mesh(bm_mesh)
    bm.free()

    # 4. Net (SEPARATE OBJECT named Net, origin at rim center (0, -5.25, 10.0))
    # Hanging cone from Z = 10.0 down to Z = 8.5
    net_mesh = bpy.data.meshes.new('Net')
    net_obj = bpy.data.objects.new('Net', net_mesh)
    bpy.context.collection.objects.link(net_obj)
    assign_material(net_obj, mat_net)

    bm_net = bmesh.new()
    bmesh.ops.create_cone(bm_net, cap_ends=False, cap_tris=False, segments=24, radius1=0.74, radius2=0.35, depth=1.5)
    bmesh.ops.subdivide_edges(bm_net, edges=list(bm_net.edges), cuts=5)
    bm_net.to_mesh(net_mesh)
    bm_net.free()

    net_obj.location = (0, -5.25, 9.25)
    bpy.context.view_layer.objects.active = net_obj
    net_obj.select_set(True)
    bpy.context.scene.cursor.location = (0, -5.25, 10.0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    # Add wireframe or lattice effect for realistic woven nylon
    mod_wf = net_obj.modifiers.new('Wireframe', 'WIREFRAME')
    mod_wf.thickness = 0.02
    bpy.ops.object.modifier_apply(modifier=mod_wf.name)

    # 5. Stand: Cantilever curved support arm (hoop_detail.jpg)
    # Stanchion post placed behind baseline in Y > 0 (Y = 4.2 ft)
    # Elegant curved arch from pedestal plate at (0, 4.2, 0.2) to backboard at (0, -3.8, 10.5)
    pts = [
        Vector((0, 4.2, 0.2)),
        Vector((0, 4.2, 3.2)),
        Vector((0, 3.8, 6.5)),
        Vector((0, 2.5, 9.2)),
        Vector((0, 0.8, 10.6)),
        Vector((0, -1.8, 10.7)),
        Vector((0, -3.8, 10.5))
    ]
    bm_arm = bmesh.new()
    w_arm, h_arm = 0.30, 0.40
    prev_ring = None
    for i, pt in enumerate(pts):
        if i < len(pts) - 1:
            t_dir = (pts[i+1] - pt).normalized()
        else:
            t_dir = (pt - pts[i-1]).normalized()
        up_v = Vector((0, 0, 1))
        right_v = t_dir.cross(up_v).normalized() if abs(t_dir.z) < 0.99 else Vector((1, 0, 0))
        act_up = right_v.cross(t_dir).normalized()
        
        v1 = bm_arm.verts.new(pt - right_v * w_arm - act_up * h_arm)
        v2 = bm_arm.verts.new(pt + right_v * w_arm - act_up * h_arm)
        v3 = bm_arm.verts.new(pt + right_v * w_arm + act_up * h_arm)
        v4 = bm_arm.verts.new(pt - right_v * w_arm + act_up * h_arm)
        curr_ring = [v1, v2, v3, v4]
        if prev_ring:
            for j in range(4):
                bm_arm.faces.new((prev_ring[j], prev_ring[(j+1)%4], curr_ring[(j+1)%4], curr_ring[j]))
        else:
            bm_arm.faces.new(curr_ring)
        prev_ring = curr_ring
    bm_arm.faces.new(list(reversed(prev_ring)))
    
    arm_mesh = bpy.data.meshes.new('Stand_Arm_Mesh')
    bm_arm.to_mesh(arm_mesh)
    bm_arm.free()
    arm_obj = bpy.data.objects.new('Stand_Arm', arm_mesh)
    bpy.context.collection.objects.link(arm_obj)
    assign_material(arm_obj, mat_stand)

    # Base mounting pedestal plate on plinth (Y = 3.0 to 5.5, Z = 0 to 0.4)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 4.2, 0.2))
    base_plate = assign_material(bpy.context.object, mat_stand)
    base_plate.scale = (2.2, 2.4, 0.4)
    base_plate.name = 'Stand_BasePlate'

    # Circular pivot joint boss at elbow curve
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.55, depth=0.8, location=(0, 3.8, 6.5), rotation=(0, math.radians(90), 0))
    pivot = assign_material(bpy.context.object, mat_stand)
    pivot.name = 'Stand_Pivot'

    # Diagonal tension rods from arch elbow to top corners of backboard
    for side in [-1, 1]:
        rod_start = Vector((0, 3.8, 8.5))
        rod_end = Vector((side * 2.2, -3.9, 12.8))
        rod_mid = (rod_start + rod_end) / 2.0
        rod_len = (rod_end - rod_start).length
        rod_dir = (rod_end - rod_start).normalized()
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.04, depth=rod_len, location=rod_mid)
        rod = assign_material(bpy.context.object, mat_stand)
        rod.rotation_euler = rod_dir.to_track_quat('Z', 'Y').to_euler()
        rod.name = f'Stand_Rod_{side}'

    # 6. Pad: Base protective pad around bottom (Y = 3.0 to 5.5, Z = 0 to 2.8)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 4.2, 1.4))
    pad = assign_material(bpy.context.object, mat_pad)
    pad.scale = (2.6, 2.6, 2.8)
    pad.name = 'Pad'
    mod_pb = pad.modifiers.new('Bevel', 'BEVEL')
    mod_pb.width = 0.2
    mod_pb.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod_pb.name)

    # Export hoop2.glb
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_draco_mesh_compression_enable=False
    )
    print(f"Exported hoop2.glb to {out_path} ({os.path.getsize(out_path):,} bytes)")


# ==============================================================================
# 3. STAGE BUILDER (stage.glb)
# ==============================================================================

def build_stage(out_path):
    """Build and export stage.glb in world coordinates (AC_fusion_1.jpg)."""
    reset()

    # Materials
    mat_lacquer = make_material('Lacquer', (0.015, 0.015, 0.02), rough=0.06, metal=0.15)
    mat_gold = make_material('Gold', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    mat_stands = make_material('Stands', srgb('#1C1E24'), rough=0.55, metal=0.1)
    mat_crowd = make_material('Crowd', srgb('#101216'), rough=0.7, metal=0.05)

    # 1. Main Plinth: Thick black piano lacquer plinth
    # Bounds: X: -30..30 (width 60 ft), Y: +10..-55 (depth 65 ft), thickness 2.0 ft (Z from -2.0 to 0.0)
    center_x = 0.0
    center_y = -22.5
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(center_x, center_y, -1.0))
    plinth = assign_material(bpy.context.object, mat_lacquer)
    plinth.scale = (60.0, 65.0, 2.0)
    plinth.name = 'Plinth'
    
    # Soft bevel on plinth outer corners
    mod_bp = plinth.modifiers.new('Bevel', 'BEVEL')
    mod_bp.width = 0.25
    mod_bp.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod_bp.name)

    # 2. Gold Inlay Lines on top surface (Z = 0.005 ft)
    # Court border gold line: around court perimeter X: -25.2..25.2, Y: +0.2..-50.2
    # Outer plinth perimeter gold line: around plinth perimeter X: -29.7..29.7, Y: +9.7..-54.7
    gold_mesh = bpy.data.meshes.new('Gold_Inlay_Mesh')
    gold_obj = bpy.data.objects.new('Gold_Lines', gold_mesh)
    bpy.context.collection.objects.link(gold_obj)
    assign_material(gold_obj, mat_gold)

    import bmesh
    bm = bmesh.new()

    def add_rect_line(x1, x2, y1, y2, t, z=0.005):
        # 4 ribbon quads
        # Top (Y = y1)
        bm.faces.new([bm.verts.new((x1, y1, z)), bm.verts.new((x2, y1, z)), bm.verts.new((x2, y1 - t, z)), bm.verts.new((x1, y1 - t, z))])
        # Bottom (Y = y2)
        bm.faces.new([bm.verts.new((x1, y2 + t, z)), bm.verts.new((x2, y2 + t, z)), bm.verts.new((x2, y2, z)), bm.verts.new((x1, y2, z))])
        # Left (X = x1)
        bm.faces.new([bm.verts.new((x1, y1 - t, z)), bm.verts.new((x1 + t, y1 - t, z)), bm.verts.new((x1 + t, y2 + t, z)), bm.verts.new((x1, y2 + t, z))])
        # Right (X = x2)
        bm.faces.new([bm.verts.new((x2 - t, y1 - t, z)), bm.verts.new((x2, y1 - t, z)), bm.verts.new((x2, y2 + t, z)), bm.verts.new((x2 - t, y2 + t, z))])

    # Inlay lines
    add_rect_line(-25.2, 25.2, 0.2, -50.2, 0.08)
    add_rect_line(-29.7, 29.7, 9.7, -54.7, 0.08)

    bm.to_mesh(gold_mesh)
    bm.free()

    # 3. Stands: Stylized tiered gallery bleachers (5-6 steps, height <= 9 ft)
    # A. Baseline stands: Y from +1.5 to +8.5 ft, X from -24.0 to +24.0 ft (5 steps)
    stands_mesh = bpy.data.meshes.new('Stands_Mesh')
    stands_obj = bpy.data.objects.new('Stands', stands_mesh)
    bpy.context.collection.objects.link(stands_obj)
    assign_material(stands_obj, mat_stands)

    bm_st = bmesh.new()

    # Baseline tiers
    num_steps = 5
    step_depth = 1.35
    step_height = 1.35
    y_start = 1.5
    for i in range(num_steps):
        y1 = y_start + i * step_depth
        y2 = y1 + step_depth
        z = (i + 1) * step_height
        # Tread face
        bm_st.faces.new([
            bm_st.verts.new((-24.5, y1, z)),
            bm_st.verts.new((24.5, y1, z)),
            bm_st.verts.new((24.5, y2, z)),
            bm_st.verts.new((-24.5, y2, z))
        ])
        # Riser face
        z_prev = i * step_height
        bm_st.faces.new([
            bm_st.verts.new((-24.5, y1, z_prev)),
            bm_st.verts.new((24.5, y1, z_prev)),
            bm_st.verts.new((24.5, y1, z)),
            bm_st.verts.new((-24.5, y1, z))
        ])

    # Left sideline tiers: X from -25.5 to -29.0 ft, Y from 0.0 to -49.0 ft
    num_side_steps = 4
    side_step_w = 0.85
    x_start_l = -25.5
    for i in range(num_side_steps):
        x1 = x_start_l - i * side_step_w
        x2 = x1 - side_step_w
        z = (i + 1) * 1.4
        z_prev = i * 1.4
        # Tread
        bm_st.faces.new([
            bm_st.verts.new((x1, 0.0, z)),
            bm_st.verts.new((x2, 0.0, z)),
            bm_st.verts.new((x2, -49.0, z)),
            bm_st.verts.new((x1, -49.0, z))
        ])
        # Riser
        bm_st.faces.new([
            bm_st.verts.new((x1, 0.0, z_prev)),
            bm_st.verts.new((x1, 0.0, z)),
            bm_st.verts.new((x1, -49.0, z)),
            bm_st.verts.new((x1, -49.0, z_prev))
        ])

    # Right sideline tiers: X from +25.5 to +29.0 ft, Y from 0.0 to -49.0 ft
    x_start_r = 25.5
    for i in range(num_side_steps):
        x1 = x_start_r + i * side_step_w
        x2 = x1 + side_step_w
        z = (i + 1) * 1.4
        z_prev = i * 1.4
        # Tread
        bm_st.faces.new([
            bm_st.verts.new((x1, 0.0, z)),
            bm_st.verts.new((x1, -49.0, z)),
            bm_st.verts.new((x2, -49.0, z)),
            bm_st.verts.new((x2, 0.0, z))
        ])
        # Riser
        bm_st.faces.new([
            bm_st.verts.new((x1, 0.0, z_prev)),
            bm_st.verts.new((x1, -49.0, z_prev)),
            bm_st.verts.new((x1, -49.0, z)),
            bm_st.verts.new((x1, 0.0, z))
        ])

    bm_st.to_mesh(stands_mesh)
    bm_st.free()

    # 4. Crowd: Abstract minimalist cylindrical spectator pegs seated on tiers
    crowd_mesh = bpy.data.meshes.new('Crowd_Mesh')
    crowd_obj = bpy.data.objects.new('Crowd', crowd_mesh)
    bpy.context.collection.objects.link(crowd_obj)
    assign_material(crowd_obj, mat_crowd)

    bm_cr = bmesh.new()
    # Place spaced pegs along baseline steps
    for step_i in range(1, num_steps):
        z_seat = step_i * step_height + 0.35
        y_seat = y_start + step_i * step_depth + 0.65
        for x_seat in range(-22, 23, 3):
            # cylinder peg
            bmesh.ops.create_cone(
                bm_cr, cap_ends=True, cap_tris=False,
                segments=8, radius1=0.25, radius2=0.25, depth=0.7,
                matrix=Matrix.Translation((x_seat, y_seat, z_seat))
            )
    bm_cr.to_mesh(crowd_mesh)
    bm_cr.free()

    # Export stage.glb
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_draco_mesh_compression_enable=False
    )
    print(f"Exported stage.glb to {out_path} ({os.path.getsize(out_path):,} bytes)")


# ==============================================================================
# 4. PREVIEW RENDERER
# ==============================================================================

def aim_object(obj, target_loc):
    direction = Vector(target_loc) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()




# ==============================================================================
# 4. PREVIEW RENDERS (Eevee Next)
# ==============================================================================

def aim_object(obj, target):
    """Point an object (camera or light) at target coordinate."""
    loc = obj.location
    target = Vector(target)
    direction = target - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    obj.rotation_euler = rot_quat.to_euler()


def render_previews(out_dir):
    """Render preview images: broadcast.jpg, athlete_poses.jpg, athlete_side.jpg, hoop.jpg."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------------------------
    # Preview 1: broadcast.jpg (Game broadcast view with stage, hoop, 10 players)
    # --------------------------------------------------------------------------
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 890
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85

    world = bpy.data.worlds.new('Broadcast_World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (*srgb('#07090F'), 1.0)
        bg.inputs['Strength'].default_value = 0.45

    # Import stage and hoop2
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'stage.glb'))
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'hoop2.glb'))

    # Temporary maple court floor (X -25..25, Y 0..-50, raised to Z = 0.005)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -25.0, 0.005))
    floor_obj = bpy.context.object
    floor_obj.scale = (50.0, 50.0, 0.01)
    mat_floor = make_material('TempFloor', srgb('#DCBB8A'), rough=0.25, metal=0.02)
    assign_material(floor_obj, mat_floor)

    # Painted court lines raised to Z = 0.015
    mat_line = make_material('CourtLine', (0.98, 0.98, 0.98), rough=0.35)
    lines_mesh = bpy.data.meshes.new('CourtLines_Mesh')
    lines_obj = bpy.data.objects.new('CourtLines', lines_mesh)
    bpy.context.collection.objects.link(lines_obj)
    assign_material(lines_obj, mat_line)

    bm = bmesh.new()
    t = 0.167
    z_line = 0.015

    def add_ribbon_rect(x1, x2, y1, y2):
        bm.faces.new([bm.verts.new((x1, y1, z_line)), bm.verts.new((x2, y1, z_line)), bm.verts.new((x2, y1 - t, z_line)), bm.verts.new((x1, y1 - t, z_line))])
        bm.faces.new([bm.verts.new((x1, y2 + t, z_line)), bm.verts.new((x2, y2 + t, z_line)), bm.verts.new((x2, y2, z_line)), bm.verts.new((x1, y2, z_line))])
        bm.faces.new([bm.verts.new((x1, y1 - t, z_line)), bm.verts.new((x1 + t, y1 - t, z_line)), bm.verts.new((x1 + t, y2 + t, z_line)), bm.verts.new((x1, y2 + t, z_line))])
        bm.faces.new([bm.verts.new((x2 - t, y1 - t, z_line)), bm.verts.new((x2, y1 - t, z_line)), bm.verts.new((x2, y2 + t, z_line)), bm.verts.new((x2 - t, y2 + t, z_line))])

    def add_ribbon_arc(cx, cy, r, angle_start, angle_end, steps=36):
        d_angle = (angle_end - angle_start) / steps
        for i in range(steps):
            a1 = angle_start + i * d_angle
            a2 = a1 + d_angle
            r_in = r - t / 2.0
            r_out = r + t / 2.0
            v1 = bm.verts.new((cx + r_in * math.cos(a1), cy + r_in * math.sin(a1), z_line))
            v2 = bm.verts.new((cx + r_out * math.cos(a1), cy + r_out * math.sin(a1), z_line))
            v3 = bm.verts.new((cx + r_out * math.cos(a2), cy + r_out * math.sin(a2), z_line))
            v4 = bm.verts.new((cx + r_in * math.cos(a2), cy + r_in * math.sin(a2), z_line))
            bm.faces.new((v1, v2, v3, v4))

    add_ribbon_rect(-25.0, 25.0, 0.0, -50.0)
    add_ribbon_rect(-8.0, 8.0, 0.0, -19.0)
    add_ribbon_arc(0, -19, 6.0, 0, math.pi * 2)
    add_ribbon_arc(0, -50, 6.0, 0, math.pi)
    bm.faces.new([bm.verts.new((-22.0 - t/2, 0, z_line)), bm.verts.new((-22.0 + t/2, 0, z_line)), bm.verts.new((-22.0 + t/2, -14, z_line)), bm.verts.new((-22.0 - t/2, -14, z_line))])
    bm.faces.new([bm.verts.new((22.0 - t/2, 0, z_line)), bm.verts.new((22.0 + t/2, 0, z_line)), bm.verts.new((22.0 + t/2, -14, z_line)), bm.verts.new((22.0 - t/2, -14, z_line))])
    a_corner = math.asin((14.0 - 5.25) / 23.75)
    add_ribbon_arc(0, -5.25, 23.75, -(math.pi / 2 + (math.pi/2 - a_corner)), -(math.pi / 2 - (math.pi/2 - a_corner)))
    bm.to_mesh(lines_mesh)
    bm.free()

    # Import athlete v2.1
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'athlete.glb'))
    arm_src = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    char_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Base' and 'Floor' not in o.name and 'Court' not in o.name and 'Stage' not in o.name and 'Hoop' not in o.name and 'Stands' not in o.name and 'Plinth' not in o.name and 'Rim' not in o.name and 'Bracket' not in o.name and 'Backboard' not in o.name and 'Frame' not in o.name and 'Stand' not in o.name and 'Pad' not in o.name]
    base_src = bpy.data.objects.get('Base')

    off_jersey = make_material('Off_Jersey', NAVY_COLOR[:3], rough=0.45, metal=0.05)
    def_jersey = make_material('Def_Jersey', RED_COLOR[:3], rough=0.45, metal=0.05)
    off_skin = make_material('Off_Skin', WARM_SILVER[:3], rough=0.28, metal=0.9)
    def_skin = make_material('Def_Skin', BRONZE_COLOR[:3], rough=0.28, metal=0.9)
    mat_gold = make_material('GoldTrim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    mat_shoe = make_material('ShoeWhite', (0.9, 0.9, 0.92), rough=0.35)

    players = [
        ('o1', 'TripleThreat', 20, (0.0, -32.0), 0.0, True),     # Ball handler
        ('o2', 'TripleThreat', 15, (-17.0, -22.0), 0.4, True),   # Left wing
        ('o3', 'TripleThreat', 25, (17.0, -22.0), -0.4, True),   # Right wing
        ('o4', 'Idle', 0, (-21.0, -8.0), 0.75, True),           # Left corner
        ('o5', 'TripleThreat', 10, (8.5, -14.0), -1.1, True),    # High post
        ('d1', 'DefStance', 30, (0.0, -27.5), math.pi, False),   # On-ball defender
        ('d2', 'DefStance', 25, (-14.0, -20.0), 2.65, False),    # Left wing defender
        ('d3', 'DefStance', 35, (14.0, -20.0), -2.65, False),   # Right wing defender
        ('d4', 'DefStance', 20, (-18.0, -9.5), 2.2, False),     # Corner defender
        ('d5', 'DefStance', 40, (7.5, -11.5), -2.4, False),     # Post defender
    ]

    for pid, pname, fnum, (px, py), frot, is_off in players:
        act = bpy.data.actions.get(pname)
        if act:
            arm_src.animation_data.action = act
            scene.frame_set(fnum)
            bpy.context.view_layer.update()

        for m_src in char_meshes:
            bpy.ops.object.select_all(action='DESELECT')
            m_src.select_set(True)
            bpy.context.view_layer.objects.active = m_src
            bpy.ops.object.duplicate()
            dup = bpy.context.active_object
            for mod in list(dup.modifiers):
                if mod.type == 'ARMATURE':
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            dup.location = (px, py, 0)
            dup.rotation_euler = (0, 0, frot)
            dup.data = dup.data.copy()
            
            # Assign team materials
            if 'Jersey' in m_src.name:
                dup.data.materials[0] = off_jersey if is_off else def_jersey
            elif 'Shorts' in m_src.name:
                dup.data.materials[0] = off_jersey if is_off else def_jersey
            else:
                # Body mesh: slot 0 is skin, slot 1 is shoe
                if len(dup.data.materials) >= 1:
                    dup.data.materials[0] = off_skin if is_off else def_skin
                if len(dup.data.materials) >= 2:
                    dup.data.materials[1] = mat_shoe

        if base_src:
            bpy.ops.object.select_all(action='DESELECT')
            base_src.select_set(True)
            bpy.context.view_layer.objects.active = base_src
            bpy.ops.object.duplicate()
            dup_base = bpy.context.active_object
            dup_base.location = (px, py, 0)
            dup_base.data = dup_base.data.copy()
            dup_base.data.materials[0] = off_jersey if is_off else def_jersey
            dup_base.data.materials[1] = mat_gold

    # Remove source templates
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm_src, base_src] + char_meshes:
        if o: bpy.data.objects.remove(o, do_unlink=True)

    # Ball at top of key handler's hands
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(0.0, -31.2, 4.8))
    assign_material(bpy.context.object, make_material('OrangeBall', srgb('#DE6B28'), rough=0.4, metal=0.05))

    # Lighting
    bpy.ops.object.light_add(type='SPOT', location=(0, -22, 32))
    spot = bpy.context.object
    spot.data.energy = 40000
    spot.data.spot_size = math.radians(72)
    spot.data.spot_blend = 0.45
    spot.data.color = (1.0, 0.95, 0.90)
    aim_object(spot, (0, -22, 0))

    bpy.ops.object.light_add(type='AREA', location=(-22, -18, 24))
    key_l = bpy.context.object
    key_l.data.energy = 16000
    key_l.data.size = 14
    aim_object(key_l, (0, -22, 0))

    bpy.ops.object.light_add(type='AREA', location=(22, -18, 24))
    key_r = bpy.context.object
    key_r.data.energy = 16000
    key_r.data.size = 14
    aim_object(key_r, (0, -22, 0))

    bpy.ops.object.light_add(type='SPOT', location=(0, -8, 22))
    spot_hoop = bpy.context.object
    spot_hoop.data.energy = 12000
    spot_hoop.data.spot_size = math.radians(50)
    spot_hoop.data.spot_blend = 0.5
    aim_object(spot_hoop, (0, -5.25, 8.0))

    # Camera
    cam_loc = Vector((0.0, -62.5, 39.6))
    cam_target = Vector((0.0, -19.0, 0.5))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    aim_object(cam, cam_target)
    cam.data.lens_unit = 'FOV'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = math.radians(38)
    scene.camera = cam

    bcast_path = out_dir / 'broadcast.jpg'
    scene.render.filepath = str(bcast_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {bcast_path} ({os.path.getsize(bcast_path):,} bytes)")

    # --------------------------------------------------------------------------
    # Preview 2: athlete_poses.jpg (6 poses side-by-side on light grey background)
    # --------------------------------------------------------------------------
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 890
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85

    world = bpy.data.worlds.new('Studio_World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.78, 0.78, 0.80, 1.0)
        bg.inputs['Strength'].default_value = 0.9

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    assign_material(bpy.context.object, make_material('StudioFloor', (0.80, 0.80, 0.82), rough=0.55))

    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'athlete.glb'))
    arm_src = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    char_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Base' and 'Floor' not in o.name]
    base_src = bpy.data.objects.get('Base')

    mat_skin_off = make_material('SkinOff', WARM_SILVER[:3], rough=0.28, metal=0.9)
    mat_skin_def = make_material('SkinDef', BRONZE_COLOR[:3], rough=0.28, metal=0.9)
    mat_j_off = make_material('JOff', NAVY_COLOR[:3], rough=0.45, metal=0.05)
    mat_j_def = make_material('JDef', RED_COLOR[:3], rough=0.45, metal=0.05)
    mat_gold = make_material('GoldTrim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    mat_ball = make_material('BallMat', srgb('#D46020'), rough=0.4, metal=0.05)
    mat_shoe = make_material('ShoeWhite', (0.9, 0.9, 0.92), rough=0.35)

    poses = [
        ('Idle', 'Idle', 0, False, 0.0),
        ('TripleThreat', 'TripleThreat', 20, False, 0.0),
        ('Sprint', 'Sprint', 4, False, 0.0),
        ('DefSlideL', 'DefSlideL', 15, True, math.radians(-50)),
        ('Shot', 'Shot', 16, False, 0.0),
        ('BoxOut', 'BoxOut', 30, True, math.radians(-15))
    ]
    spacing = 3.3
    start_x = -((len(poses) - 1) * spacing) / 2.0

    for idx, (label, act_name, frame_num, is_defense, extra_rot) in enumerate(poses):
        cur_x = start_x + idx * spacing
        act = bpy.data.actions.get(act_name)
        if act:
            arm_src.animation_data.action = act
            scene.frame_set(frame_num)
            bpy.context.view_layer.update()

        for m_src in char_meshes:
            bpy.ops.object.select_all(action='DESELECT')
            m_src.select_set(True)
            bpy.context.view_layer.objects.active = m_src
            bpy.ops.object.duplicate()
            dup = bpy.context.active_object
            for mod in list(dup.modifiers):
                if mod.type == 'ARMATURE':
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            dup.rotation_mode = 'XYZ'
            dup.rotation_euler = (0, 0, math.radians(-12) + extra_rot)
            dup.location = (cur_x, 0, 0)
            dup.data = dup.data.copy()

            if 'Jersey' in m_src.name:
                dup.data.materials[0] = mat_j_def if is_defense else mat_j_off
            elif 'Shorts' in m_src.name:
                dup.data.materials[0] = mat_j_def if is_defense else mat_j_off
            else:
                if len(dup.data.materials) >= 1:
                    dup.data.materials[0] = mat_skin_def if is_defense else mat_skin_off
                if len(dup.data.materials) >= 2:
                    dup.data.materials[1] = mat_shoe

        if base_src:
            bpy.ops.object.select_all(action='DESELECT')
            base_src.select_set(True)
            bpy.context.view_layer.objects.active = base_src
            bpy.ops.object.duplicate()
            dup_base = bpy.context.active_object
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            dup_base.rotation_mode = 'XYZ'
            dup_base.rotation_euler = (0, 0, math.radians(-12) + extra_rot)
            dup_base.location = (cur_x, 0, 0)
            dup_base.data = dup_base.data.copy()
            dup_base.data.materials[0] = mat_j_def if is_defense else mat_j_off
            dup_base.data.materials[1] = mat_gold

        if label == 'Shot':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x - 0.24, -0.25, 7.55))
            assign_material(bpy.context.object, mat_ball)
        elif label == 'TripleThreat':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x - 0.69, -1.11, 5.08))
            assign_material(bpy.context.object, mat_ball)

    # Remove source templates
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm_src, base_src] + char_meshes:
        if o: bpy.data.objects.remove(o, do_unlink=True)

    # Studio lighting
    bpy.ops.object.light_add(type='AREA', location=(6, -18, 14))
    key = bpy.context.object
    key.data.energy = 5000
    key.data.size = 14
    key.data.color = (1.0, 0.98, 0.95)
    aim_object(key, (0, 0, 3.5))

    bpy.ops.object.light_add(type='AREA', location=(-14, -16, 12))
    fill = bpy.context.object
    fill.data.energy = 2500
    fill.data.size = 16
    fill.data.color = (0.92, 0.95, 1.0)
    aim_object(fill, (0, 0, 3.5))

    bpy.ops.object.light_add(type='AREA', location=(0, 14, 12))
    rim = bpy.context.object
    rim.data.energy = 3200
    rim.data.size = 22
    rim.data.color = (1.0, 0.96, 0.9)
    aim_object(rim, (0, 0, 3.5))

    cam_loc = Vector((0.0, -25.0, 4.4))
    cam_target = Vector((0.0, 0.0, 3.3))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    aim_object(cam, cam_target)
    cam.data.lens = 38
    scene.camera = cam

    poses_path = out_dir / 'athlete_poses.jpg'
    scene.render.filepath = str(poses_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {poses_path} ({os.path.getsize(poses_path):,} bytes)")

    # --------------------------------------------------------------------------
    # Preview 3: athlete_side.jpg (NEW: 6 poses side-by-side, profile view, camera height 3 ft)
    # --------------------------------------------------------------------------
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 890
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 85

    world = bpy.data.worlds.new('Studio_World_Side')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.78, 0.78, 0.80, 1.0)
        bg.inputs['Strength'].default_value = 0.9

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    assign_material(bpy.context.object, make_material('StudioFloor', (0.80, 0.80, 0.82), rough=0.55))

    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'athlete.glb'))
    arm_src = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    char_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Base' and 'Floor' not in o.name]
    base_src = bpy.data.objects.get('Base')

    mat_skin_off = make_material('SkinOff', WARM_SILVER[:3], rough=0.28, metal=0.9)
    mat_skin_def = make_material('SkinDef', BRONZE_COLOR[:3], rough=0.28, metal=0.9)
    mat_j_off = make_material('JOff', NAVY_COLOR[:3], rough=0.45, metal=0.05)
    mat_j_def = make_material('JDef', RED_COLOR[:3], rough=0.45, metal=0.05)
    mat_gold = make_material('GoldTrim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    mat_ball = make_material('BallMat', srgb('#D46020'), rough=0.4, metal=0.05)
    mat_shoe = make_material('ShoeWhite', (0.9, 0.9, 0.92), rough=0.35)

    for idx, (label, act_name, frame_num, is_defense, extra_rot) in enumerate(poses):
        cur_x = start_x + idx * spacing
        act = bpy.data.actions.get(act_name)
        if act:
            arm_src.animation_data.action = act
            scene.frame_set(frame_num)
            bpy.context.view_layer.update()

        for m_src in char_meshes:
            bpy.ops.object.select_all(action='DESELECT')
            m_src.select_set(True)
            bpy.context.view_layer.objects.active = m_src
            bpy.ops.object.duplicate()
            dup = bpy.context.active_object
            for mod in list(dup.modifiers):
                if mod.type == 'ARMATURE':
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            dup.rotation_mode = 'XYZ'
            # Profile view: rotate 90 degrees around Z to face +X
            dup.rotation_euler = (0, 0, math.radians(90))
            dup.location = (cur_x, 0, 0)
            dup.data = dup.data.copy()

            if 'Jersey' in m_src.name:
                dup.data.materials[0] = mat_j_def if is_defense else mat_j_off
            elif 'Shorts' in m_src.name:
                dup.data.materials[0] = mat_j_def if is_defense else mat_j_off
            else:
                if len(dup.data.materials) >= 1:
                    dup.data.materials[0] = mat_skin_def if is_defense else mat_skin_off
                if len(dup.data.materials) >= 2:
                    dup.data.materials[1] = mat_shoe

        if base_src:
            bpy.ops.object.select_all(action='DESELECT')
            base_src.select_set(True)
            bpy.context.view_layer.objects.active = base_src
            bpy.ops.object.duplicate()
            dup_base = bpy.context.active_object
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            dup_base.rotation_mode = 'XYZ'
            dup_base.rotation_euler = (0, 0, math.radians(90))
            dup_base.location = (cur_x, 0, 0)
            dup_base.data = dup_base.data.copy()
            dup_base.data.materials[0] = mat_j_def if is_defense else mat_j_off
            dup_base.data.materials[1] = mat_gold

        if label == 'Shot':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x + 0.30, -0.19, 7.50))
            assign_material(bpy.context.object, mat_ball)
        elif label == 'TripleThreat':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x + 1.24, -0.45, 5.08))
            assign_material(bpy.context.object, mat_ball)

    # Remove source templates
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm_src, base_src] + char_meshes:
        if o: bpy.data.objects.remove(o, do_unlink=True)

    # Lighting
    bpy.ops.object.light_add(type='AREA', location=(6, -18, 14))
    key = bpy.context.object
    key.data.energy = 5000
    key.data.size = 14
    aim_object(key, (0, 0, 3.0))

    bpy.ops.object.light_add(type='AREA', location=(-14, -16, 12))
    fill = bpy.context.object
    fill.data.energy = 2500
    fill.data.size = 16
    aim_object(fill, (0, 0, 3.0))

    bpy.ops.object.light_add(type='AREA', location=(0, 14, 12))
    rim = bpy.context.object
    rim.data.energy = 3200
    rim.data.size = 22
    aim_object(rim, (0, 0, 3.0))

    # Camera at camera height 3 ft looking horizontally at Z = 3 ft
    cam_loc = Vector((0.0, -25.0, 3.0))
    cam_target = Vector((0.0, 0.0, 3.0))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    aim_object(cam, cam_target)
    cam.data.lens = 38
    scene.camera = cam

    side_path = out_dir / 'athlete_side.jpg'
    scene.render.filepath = str(side_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {side_path} ({os.path.getsize(side_path):,} bytes)")

    # --------------------------------------------------------------------------
    # Preview 4: hoop.jpg (Macro close-up matching hoop_detail.jpg)
    # --------------------------------------------------------------------------
    hoop_path = out_dir / 'hoop.jpg'
    if not hoop_path.exists():
        reset()
        scene = bpy.context.scene
        scene.render.engine = 'BLENDER_EEVEE'
        scene.render.resolution_x = 1280
        scene.render.resolution_y = 890
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 85

        world = bpy.data.worlds.new('Hoop_World')
        scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get('Background')
        if bg:
            bg.inputs['Color'].default_value = (*srgb('#141210'), 1.0)
            bg.inputs['Strength'].default_value = 0.7

        bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'stage.glb'))
        bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'hoop2.glb'))

        for o in list(bpy.data.objects):
            if 'Stands' in o.name or 'Crowd' in o.name:
                bpy.data.objects.remove(o, do_unlink=True)

        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -5.0, -2.1))
        table = bpy.context.object
        table.scale = (80.0, 80.0, 0.2)
        mat_table = make_material('WarmTable', srgb('#8B6B4D'), rough=0.38, metal=0.05)
        assign_material(table, mat_table)

        glass_mat = bpy.data.materials.get('Glass')
        if glass_mat and glass_mat.node_tree:
            bsdf = glass_mat.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Alpha'].default_value = 0.25
                if 'Transmission Weight' in bsdf.inputs:
                    bsdf.inputs['Transmission Weight'].default_value = 0.85
                bsdf.inputs['Roughness'].default_value = 0.04
            glass_mat.blend_method = 'HASHED'

        bpy.ops.object.light_add(type='AREA', location=(-12.0, -18.0, 15.0))
        key = bpy.context.object
        key.data.energy = 6000
        key.data.size = 10
        aim_object(key, (0, -4.5, 10.5))

        bpy.ops.object.light_add(type='AREA', location=(10.0, -10.0, 13.0))
        fill = bpy.context.object
        fill.data.energy = 3200
        fill.data.size = 12
        aim_object(fill, (0, -1.0, 8.5))

        bpy.ops.object.light_add(type='AREA', location=(4.0, 10.0, 16.0))
        rim = bpy.context.object
        rim.data.energy = 5500
        rim.data.size = 8
        aim_object(rim, (0, 1.5, 10.0))

        bpy.ops.object.light_add(type='POINT', location=(-3.0, -8.0, 8.0))
        p_net = bpy.context.object
        p_net.data.energy = 2200

        cam_loc = Vector((-12.5, -14.0, 9.2))
        cam_target = Vector((0.0, -0.5, 8.8))
        bpy.ops.object.camera_add(location=cam_loc)
        cam = bpy.context.object
        aim_object(cam, cam_target)
        cam.data.lens = 46
        scene.camera = cam

        scene.render.filepath = str(hoop_path)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {hoop_path} ({os.path.getsize(hoop_path):,} bytes)")
    else:
        print(f"Reusing existing {hoop_path}")


# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

    athlete_glb = MODELS_DIR / 'athlete.glb'
    hoop_glb = MODELS_DIR / 'hoop2.glb'
    stage_glb = MODELS_DIR / 'stage.glb'

    print("Building athlete.glb v2.1...")
    build_athlete(athlete_glb)

    if not hoop_glb.exists():
        print("Building hoop2.glb...")
        build_hoop(hoop_glb)
    else:
        print("Keeping existing hoop2.glb untouched.")

    if not stage_glb.exists():
        print("Building stage.glb...")
        build_stage(stage_glb)
    else:
        print("Keeping existing stage.glb untouched.")

    print("Rendering previews...")
    render_previews(PREVIEWS_DIR)

    # Size check
    total_size = sum(os.path.getsize(p) for p in [athlete_glb, hoop_glb, stage_glb])
    print(f"\nTotal GLB size: {total_size:,} bytes ({total_size / (1024 * 1024):.2f} MB)")
    if total_size <= 3 * 1024 * 1024:
        print("✓ Model size limit PASSED (<= 3.0 MB)")
    else:
        print("✗ Model size limit EXCEEDED (> 3.0 MB)")


if __name__ == '__main__':
    main()
