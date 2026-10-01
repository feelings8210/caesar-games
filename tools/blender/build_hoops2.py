"""Hoops IQ 3D Assets v2 - Procedural Build Script for Blender 5.x.

This script creates and exports the v2 3D models according to TASK-06 (AC_fusion_1 concept):
  1. assets/hoops/models2/athlete.glb - Rigged, animated basketball player figurine
  2. assets/hoops/models2/hoop2.glb   - Basketball hoop & cantilever stanchion
  3. assets/hoops/models2/stage.glb   - Black lacquer plinth & architectural stands
  4. assets/hoops/models2/previews/  - Eevee preview renders:
       - broadcast.jpg (game broadcast view with stage, hoop, temporary floor, 10 players)
       - athlete_poses.jpg (6 poses side-by-side on light grey background)
       - hoop.jpg (macro close-up matching hoop_detail.jpg)

Source Downloads & Local Paths (All assets are CC0 Public Domain):
  - Quaternius Universal Animation Library [Standard]:
      Source: https://quaternius.itch.io/universal-animation-library
      Local:  /private/tmp/quaternius/ual1/Universal Animation Library[Standard]/
  - Quaternius Universal Animation Library 2 [Standard]:
      Source: https://quaternius.itch.io/universal-animation-library-2
      Local:  /private/tmp/quaternius/ual2/Universal Animation Library 2[Standard]/
  - Quaternius Universal Base Characters [Standard]:
      Source: https://quaternius.itch.io/universal-base-characters
      Local:  /private/tmp/quaternius/ubc/Universal Base Characters[Standard]/

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
from mathutils import Vector, Euler, Matrix

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / 'assets' / 'hoops' / 'models2'
PREVIEWS_DIR = MODELS_DIR / 'previews'

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
# 1. ATHLETE BUILDER (athlete.glb)
# ==============================================================================

def build_athlete(out_path):
    """Build and export athlete.glb with rigged animations, materials, sockets, and base."""
    reset()
    if not UAL1_GLB.exists():
        raise FileNotFoundError(f"Missing UAL1 source at {UAL1_GLB}")

    # Import base model & rig from UAL1
    bpy.ops.import_scene.gltf(filepath=str(UAL1_GLB))
    arm = bpy.data.objects.get('Armature')
    mesh_obj = bpy.data.objects.get('Mannequin')
    
    # Remove any extra objects (e.g. icosphere)
    for o in list(bpy.data.objects):
        if o not in [arm, mesh_obj]:
            bpy.data.objects.remove(o, do_unlink=True)

    # Calculate scale factor so standing height is exactly 6.6 feet (2.012 m)
    z_coords = [v.co.z for v in mesh_obj.data.vertices]
    orig_h = max(z_coords) - min(z_coords)
    scale_fac = 6.6 / orig_h  # approx 3.6091

    # Scale armature and apply scale
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    
    # Scale armature
    arm.scale = (scale_fac, scale_fac, scale_fac)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Decimate mesh to stay strictly within polygon budget (<= 5000 triangles)
    # Target ~4200 triangles
    poly_count = len(mesh_obj.data.polygons)
    target_ratio = 4200.0 / (poly_count * 2.0)
    target_ratio = min(1.0, max(0.2, target_ratio))
    
    mod_dec = mesh_obj.modifiers.new('Decimate', 'DECIMATE')
    mod_dec.ratio = target_ratio
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.modifier_move_to_index(modifier=mod_dec.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod_dec.name)

    # Setup materials on mesh: Skin, Jersey, Shorts, Shoe
    mat_skin = make_material('Skin', WARM_SILVER[:3], rough=0.35, metal=0.85)
    mat_jersey = make_material('Jersey', NAVY_COLOR[:3], rough=0.6, metal=0.0)
    mat_shorts = make_material('Shorts', NAVY_COLOR[:3], rough=0.6, metal=0.0)
    mat_shoe = make_material('Shoe', (0.9, 0.9, 0.9), rough=0.4, metal=0.1)

    mesh_obj.data.materials.clear()
    mesh_obj.data.materials.append(mat_skin)    # Slot 0: Skin
    mesh_obj.data.materials.append(mat_jersey)  # Slot 1: Jersey
    mesh_obj.data.materials.append(mat_shorts)  # Slot 2: Shorts
    mesh_obj.data.materials.append(mat_shoe)    # Slot 3: Shoe

    # Partition polygons based on vertex weights and vertical positions
    vg_names = {vg.index: vg.name for vg in mesh_obj.vertex_groups}
    v_mat_slot = []
    
    for v in mesh_obj.data.vertices:
        if not v.groups:
            v_mat_slot.append(0)
            continue
        top_g = max(v.groups, key=lambda g: g.weight).group
        bname = vg_names.get(top_g, '')
        z = v.co.z

        if bname in ['Head', 'neck_01'] or 'arm' in bname or 'hand' in bname or any(f in bname for f in ['index', 'middle', 'ring', 'pinky', 'thumb']):
            slot = 0 # Skin
        elif bname in ['clavicle_l', 'clavicle_r', 'spine_03', 'spine_02', 'spine_01']:
            slot = 1 # Jersey
        elif bname == 'pelvis':
            slot = 2 # Shorts
        elif bname in ['thigh_l', 'thigh_r']:
            # Knees are around z = 2.0 ft on the 6.6 ft athlete
            slot = 2 if z > 2.2 else 0
        elif bname in ['calf_l', 'calf_r']:
            slot = 0 if z > 0.55 else 3 # lower shin / shoe
        elif bname in ['foot_l', 'foot_r', 'ball_l', 'ball_r']:
            slot = 3 # Shoe
        else:
            slot = 0 # Skin
        v_mat_slot.append(slot)

    for p in mesh_obj.data.polygons:
        # Pick dominant slot
        slots = [v_mat_slot[vi] for vi in p.vertices]
        p.material_index = max(set(slots), key=slots.count)

    # ---------------- Sockets (Empty nodes parented to bones) -----------------
    # socket_ball: right hand palm
    s_ball = bpy.data.objects.new('socket_ball', None)
    bpy.context.collection.objects.link(s_ball)
    s_ball.parent = arm
    s_ball.parent_type = 'BONE'
    s_ball.parent_bone = 'hand_r'
    s_ball.location = (0.0, -0.05, 0.12)

    # socket_num_front: chest jersey surface + 0.02 ft
    s_front = bpy.data.objects.new('socket_num_front', None)
    bpy.context.collection.objects.link(s_front)
    s_front.parent = arm
    s_front.parent_type = 'BONE'
    s_front.parent_bone = 'spine_03'
    s_front.location = (0.0, -0.45, 0.05) # front is -Y

    # socket_num_back: back jersey surface + 0.02 ft
    s_back = bpy.data.objects.new('socket_num_back', None)
    bpy.context.collection.objects.link(s_back)
    s_back.parent = arm
    s_back.parent_type = 'BONE'
    s_back.parent_bone = 'spine_03'
    s_back.location = (0.0, 0.45, 0.05)  # back is +Y

    # ---------------- Separate Base Object -----------------
    # Base disc: radius 1.35 ft, thickness 0.16 ft, top at Z = 0
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.35, depth=0.16, location=(0, 0, -0.08))
    base_obj = bpy.context.object
    base_obj.name = 'Base'
    
    mat_base = make_material('Base', NAVY_COLOR[:3], rough=0.2, metal=0.1)
    mat_trim = make_material('Trim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    base_obj.data.materials.append(mat_base)
    base_obj.data.materials.append(mat_trim)

    # Assign Trim to side cylinder quads, Base to top/bottom caps
    for p in base_obj.data.polygons:
        if abs(p.normal.z) < 0.2:
            p.material_index = 1 # Trim
        else:
            p.material_index = 0 # Base

    # Bevel modifier on top rim
    mod_b = base_obj.modifiers.new('Bevel', 'BEVEL')
    mod_b.width = 0.025
    mod_b.segments = 2
    mod_b.limit_method = 'ANGLE'

    # ---------------- Actions Configuration -----------------
    # We require 14 canonical actions matching TASK-06 Section 3.1
    # Load any extra required actions from UAL2 (e.g. Idle_FoldArms_Loop for Screen, Yes for Celebrate)
    if UAL2_GLB.exists():
        curr_objs = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(UAL2_GLB))
        for o in list(bpy.data.objects):
            if o not in curr_objs:
                bpy.data.objects.remove(o, do_unlink=True)

    action_map = {
        'Idle': 'Idle_Loop',
        'TripleThreat': 'Pistol_Idle_Loop',   # athletic ready stance with hands at hip
        'Dribble': 'Spell_Simple_Idle_Loop',  # rhythmic hand pumping motion
        'Jog': 'Jog_Fwd_Loop',
        'Sprint': 'Sprint_Loop',
        'DefStance': 'Crouch_Idle_Loop',      # wide low defensive posture
        'DefSlideL': 'Crouch_Fwd_Loop',       # active low defensive crouch slide
        'DefSlideR': 'Crouch_Fwd_Loop',
        'Screen': 'Idle_FoldArms_Loop',       # arms crossed on chest
        'BoxOut': 'Crouch_Idle_Loop',         # low wide box out stance
        'Pass': 'Punch_Cross',                # quick arm extension forward (~15f)
        'Catch': 'Interact',                  # hands forward pulling in (~12f)
        'Shot': 'Jump_Start',                 # jump shot off ground with upward extension
        'Celebrate': 'Yes'                    # fist-pump celebrate
    }

    canonical_actions = {}
    for canon_name, src_name in action_map.items():
        src_act = bpy.data.actions.get(src_name)
        if not src_act:
            # Fallback to Idle_Loop if not found
            src_act = bpy.data.actions.get('Idle_Loop')
        
        # Make a copy for this action
        new_act = src_act.copy()
        new_act.name = canon_name
        canonical_actions[canon_name] = new_act

    # Clean up non-canonical actions from blend data so only the 14 actions exist
    for a in list(bpy.data.actions):
        if a.name not in canonical_actions:
            bpy.data.actions.remove(a, do_unlink=True)

    # Set default active action to Idle
    arm.animation_data.action = canonical_actions.get('Idle')

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


# ==============================================================================
# 2. BASKETBALL HOOP BUILDER (hoop2.glb)
# ==============================================================================

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


def render_previews(out_dir):
    """Render 3 preview stills using Blender Eevee: broadcast.jpg, athlete_poses.jpg, hoop.jpg."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------------------------
    # Preview 1: broadcast.jpg
    # Camera at (0, -62.5, 39.6), looking at (0, -19, 0.5), vertical FOV 38 deg.
    # Stage + hoop2 + temporary maple floor + 10 athlete figurines (5 off, 5 def).
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

    # Temporary maple court floor (X -25..25, Y 0..-50, raised to Z = 0.005..0.015 to prevent Z-fighting)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -25.0, 0.005))
    floor_obj = bpy.context.object
    floor_obj.scale = (50.0, 50.0, 0.01)
    mat_floor = make_material('TempFloor', srgb('#DCBB8A'), rough=0.25, metal=0.02)
    assign_material(floor_obj, mat_floor)

    # Painted court lines (Key, 3pt arc, free throw, center circle) raised to Z = 0.015
    mat_line = make_material('CourtLine', (0.98, 0.98, 0.98), rough=0.35)
    lines_mesh = bpy.data.meshes.new('CourtLines_Mesh')
    lines_obj = bpy.data.objects.new('CourtLines', lines_mesh)
    bpy.context.collection.objects.link(lines_obj)
    assign_material(lines_obj, mat_line)

    bm = bmesh.new()
    t = 0.167  # 2 inch line width
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

    # Perimeter boundary
    add_ribbon_rect(-25.0, 25.0, 0.0, -50.0)
    # Key (16 ft wide X -8..8, 19 ft long Y 0..-19)
    add_ribbon_rect(-8.0, 8.0, 0.0, -19.0)
    # Free throw circle (radius 6 ft at (0, -19))
    add_ribbon_arc(0, -19, 6.0, 0, math.pi * 2)
    # Center circle at (0, -50)
    add_ribbon_arc(0, -50, 6.0, 0, math.pi)
    # 3-Point arc: radius 23.75 from rim (0, -5.25), straight sidelines at X = +/-22 from Y=0 to -14
    bm.faces.new([bm.verts.new((-22.0 - t/2, 0, z_line)), bm.verts.new((-22.0 + t/2, 0, z_line)), bm.verts.new((-22.0 + t/2, -14, z_line)), bm.verts.new((-22.0 - t/2, -14, z_line))])
    bm.faces.new([bm.verts.new((22.0 - t/2, 0, z_line)), bm.verts.new((22.0 + t/2, 0, z_line)), bm.verts.new((22.0 + t/2, -14, z_line)), bm.verts.new((22.0 - t/2, -14, z_line))])
    a_corner = math.asin((14.0 - 5.25) / 23.75)
    add_ribbon_arc(0, -5.25, 23.75, -(math.pi / 2 + (math.pi/2 - a_corner)), -(math.pi / 2 - (math.pi/2 - a_corner)))

    bm.to_mesh(lines_mesh)
    bm.free()

    # Import athlete
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'athlete.glb'))
    arm_src = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    mesh_src = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Mannequin')][0]
    base_src = bpy.data.objects.get('Base')

    # Team materials
    off_jersey = make_material('Off_Jersey', NAVY_COLOR[:3], rough=0.45, metal=0.05)
    def_jersey = make_material('Def_Jersey', RED_COLOR[:3], rough=0.45, metal=0.05)
    off_skin = make_material('Off_Skin', WARM_SILVER[:3], rough=0.28, metal=0.9)
    def_skin = make_material('Def_Skin', BRONZE_COLOR[:3], rough=0.28, metal=0.9)
    mat_gold = make_material('GoldTrim', GOLD_COLOR[:3], rough=0.25, metal=0.95)

    # 10 Figurines positions & actions matching AC_fusion_1.jpg
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

        bpy.ops.object.select_all(action='DESELECT')
        mesh_src.select_set(True)
        bpy.context.view_layer.objects.active = mesh_src
        bpy.ops.object.duplicate()
        dup_mesh = bpy.context.active_object
        dup_mesh.name = f'Player_{pid}'

        for mod in list(dup_mesh.modifiers):
            if mod.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=mod.name)

        dup_mesh.location = (px, py, 0)
        dup_mesh.rotation_euler = (0, 0, frot)

        dup_mesh.data = dup_mesh.data.copy()
        if len(dup_mesh.data.materials) >= 4:
            skin_m = off_skin if is_off else def_skin
            j_m = off_jersey if is_off else def_jersey
            dup_mesh.data.materials[0] = skin_m
            dup_mesh.data.materials[1] = j_m
            dup_mesh.data.materials[2] = j_m
            dup_mesh.data.materials[3] = make_material('ShoeWhite', (0.9, 0.9, 0.92), rough=0.35)

        if base_src:
            bpy.ops.object.select_all(action='DESELECT')
            base_src.select_set(True)
            bpy.context.view_layer.objects.active = base_src
            bpy.ops.object.duplicate()
            dup_base = bpy.context.active_object
            dup_base.location = (px, py, 0)
            dup_base.data = dup_base.data.copy()
            j_m = off_jersey if is_off else def_jersey
            dup_base.data.materials[0] = j_m
            dup_base.data.materials[1] = mat_gold

    # Remove source templates
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm_src, mesh_src, base_src]:
        if o:
            bpy.data.objects.remove(o, do_unlink=True)

    # Ball at top of key handler's hands
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(0.0, -31.2, 4.8))
    assign_material(bpy.context.object, make_material('OrangeBall', srgb('#DE6B28'), rough=0.4, metal=0.05))

    # Theatrical luxury museum lighting matching AC_fusion_1.jpg
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
    key_l.data.color = (1.0, 0.94, 0.88)
    aim_object(key_l, (0, -22, 0))

    bpy.ops.object.light_add(type='AREA', location=(22, -18, 24))
    key_r = bpy.context.object
    key_r.data.energy = 16000
    key_r.data.size = 14
    key_r.data.color = (1.0, 0.94, 0.88)
    aim_object(key_r, (0, -22, 0))

    bpy.ops.object.light_add(type='SPOT', location=(0, -8, 22))
    spot_hoop = bpy.context.object
    spot_hoop.data.energy = 12000
    spot_hoop.data.spot_size = math.radians(50)
    spot_hoop.data.spot_blend = 0.5
    spot_hoop.data.color = (0.95, 0.97, 1.0)
    aim_object(spot_hoop, (0, -5.25, 8.0))

    # Camera: (0, -62.5, 39.6) looking at (0, -19, 0.5), vertical FOV 38 deg
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

    # Neutral studio world
    world = bpy.data.worlds.new('Studio_World')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.78, 0.78, 0.80, 1.0)
        bg.inputs['Strength'].default_value = 0.9

    # Studio seamless floor
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    assign_material(bpy.context.object, make_material('StudioFloor', (0.80, 0.80, 0.82), rough=0.55))

    # Import athlete
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'athlete.glb'))
    arm_src = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    mesh_src = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Mannequin')][0]
    base_src = bpy.data.objects.get('Base')

    # Materials for figures
    mat_skin_off = make_material('SkinOff', WARM_SILVER[:3], rough=0.28, metal=0.9)
    mat_skin_def = make_material('SkinDef', BRONZE_COLOR[:3], rough=0.28, metal=0.9)
    mat_j_off = make_material('JOff', NAVY_COLOR[:3], rough=0.45, metal=0.05)
    mat_j_def = make_material('JDef', RED_COLOR[:3], rough=0.45, metal=0.05)
    mat_gold = make_material('GoldTrim', GOLD_COLOR[:3], rough=0.25, metal=0.95)
    mat_ball = make_material('BallMat', srgb('#D46020'), rough=0.4, metal=0.05)

    poses = [
        ('Idle', 'Idle', 0, False, 0.0),
        ('TripleThreat', 'TripleThreat', 20, False, 0.0),
        ('Sprint', 'Sprint', 8, False, 0.0),
        ('DefSlideL', 'DefSlideL', 15, True, math.radians(-60)), # low athletic slide stance
        ('Shot', 'Shot', 14, False, 0.0),                       # jump shot apex
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

        bpy.ops.object.select_all(action='DESELECT')
        mesh_src.select_set(True)
        bpy.context.view_layer.objects.active = mesh_src
        bpy.ops.object.duplicate()
        dup_mesh = bpy.context.active_object
        dup_mesh.name = f'Posed_{label}'

        for mod in list(dup_mesh.modifiers):
            if mod.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=mod.name)

        dup_mesh.location = (cur_x, 0, 0)
        dup_mesh.rotation_euler = (0, 0, math.radians(-12) + extra_rot)

        dup_mesh.data = dup_mesh.data.copy()
        if len(dup_mesh.data.materials) >= 4:
            skin_m = mat_skin_def if is_defense else mat_skin_off
            j_m = mat_j_def if is_defense else mat_j_off
            dup_mesh.data.materials[0] = skin_m
            dup_mesh.data.materials[1] = j_m
            dup_mesh.data.materials[2] = j_m
            dup_mesh.data.materials[3] = make_material('ShoeWhite', (0.9, 0.9, 0.92), rough=0.35)

        if base_src:
            bpy.ops.object.select_all(action='DESELECT')
            base_src.select_set(True)
            bpy.context.view_layer.objects.active = base_src
            bpy.ops.object.duplicate()
            dup_base = bpy.context.active_object
            dup_base.location = (cur_x, 0, 0)
            dup_base.data = dup_base.data.copy()
            j_m = mat_j_def if is_defense else mat_j_off
            dup_base.data.materials[0] = j_m
            dup_base.data.materials[1] = mat_gold

        if label == 'Shot':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x - 0.25, -0.4, 6.2))
            assign_material(bpy.context.object, mat_ball)
        elif label == 'TripleThreat':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(cur_x - 0.55, -1.45, 5.03))
            assign_material(bpy.context.object, mat_ball)

    # Remove source templates
    bpy.ops.object.select_all(action='DESELECT')
    for o in [arm_src, mesh_src, base_src]:
        if o:
            bpy.data.objects.remove(o, do_unlink=True)

    # Studio 3-point lighting
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

    # Camera pulled back to frame all 6 athletes with generous margins
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
    # Preview 3: hoop.jpg (Macro close-up matching hoop_detail.jpg)
    # --------------------------------------------------------------------------
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

    # Import stage and hoop2
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'stage.glb'))
    bpy.ops.import_scene.gltf(filepath=str(MODELS_DIR / 'hoop2.glb'))

    # For hoop_detail.jpg close-up: remove heavy bleacher stands behind hoop
    # so glass transparency and clean cantilever profile are visible
    for o in list(bpy.data.objects):
        if 'Stands' in o.name or 'Crowd' in o.name:
            bpy.data.objects.remove(o, do_unlink=True)

    # Warm luxury table surface under plinth
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -5.0, -2.1))
    table = bpy.context.object
    table.scale = (80.0, 80.0, 0.2)
    mat_table = make_material('WarmTable', srgb('#8B6B4D'), rough=0.38, metal=0.05)
    assign_material(table, mat_table)

    # Enhance Glass material for EEVEE preview
    glass_mat = bpy.data.materials.get('Glass')
    if glass_mat and glass_mat.node_tree:
        bsdf = glass_mat.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            bsdf.inputs['Alpha'].default_value = 0.25
            if 'Transmission Weight' in bsdf.inputs:
                bsdf.inputs['Transmission Weight'].default_value = 0.85
            bsdf.inputs['Roughness'].default_value = 0.04
        glass_mat.blend_method = 'HASHED'

    # Rich museum studio lighting matching hoop_detail.jpg
    bpy.ops.object.light_add(type='AREA', location=(-12.0, -18.0, 15.0))
    key = bpy.context.object
    key.data.energy = 6000
    key.data.size = 10
    key.data.color = (1.0, 0.94, 0.88)
    aim_object(key, (0, -4.5, 10.5))

    bpy.ops.object.light_add(type='AREA', location=(10.0, -10.0, 13.0))
    fill = bpy.context.object
    fill.data.energy = 3200
    fill.data.size = 12
    fill.data.color = (0.92, 0.95, 1.0)
    aim_object(fill, (0, -1.0, 8.5))

    bpy.ops.object.light_add(type='AREA', location=(4.0, 10.0, 16.0))
    rim = bpy.context.object
    rim.data.energy = 5500
    rim.data.size = 8
    rim.data.color = (1.0, 0.92, 0.82)
    aim_object(rim, (0, 1.5, 10.0))

    bpy.ops.object.light_add(type='POINT', location=(-3.0, -8.0, 8.0))
    p_net = bpy.context.object
    p_net.data.energy = 2200
    p_net.data.color = (1.0, 0.88, 0.75)

    # Close-up camera framing backboard, rim, and cantilever arm (hoop_detail.jpg)
    cam_loc = Vector((-12.5, -14.0, 9.2))
    cam_target = Vector((0.0, -0.5, 8.8))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    aim_object(cam, cam_target)
    cam.data.lens = 46
    scene.camera = cam

    hoop_path = out_dir / 'hoop.jpg'
    scene.render.filepath = str(hoop_path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {hoop_path} ({os.path.getsize(hoop_path):,} bytes)")


# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

    athlete_glb = MODELS_DIR / 'athlete.glb'
    hoop_glb = MODELS_DIR / 'hoop2.glb'
    stage_glb = MODELS_DIR / 'stage.glb'

    print("Building athlete.glb...")
    build_athlete(athlete_glb)

    print("Building hoop2.glb...")
    build_hoop(hoop_glb)

    print("Building stage.glb...")
    build_stage(stage_glb)

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
