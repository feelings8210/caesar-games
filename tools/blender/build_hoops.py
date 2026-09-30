"""Hoops IQ 3D assets, built procedurally in Blender (bpy 5.x).

    python3 tools/blender/build_hoops.py            # export GLBs
    python3 tools/blender/build_hoops.py --preview  # also render preview stills

Units are feet. Court space: x sideline to sideline (-25..25), y baseline (0)
to half-court (47). Blender space: X = x, Y = -y, Z up. glTF export turns that
into three.js space: x = x, z = y, y up — so the game can use court feet as-is.

Figurines face Blender -Y, which becomes three.js +z. Material slot names are
the contract with the game: Jersey, Shorts, Skin, Shoe, Base, Trim.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'hoops'
PREVIEW_DIR = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ROOT / 'review' / 'hoops-3d'

NAVY = (0.0103, 0.0331, 0.0976)      # #1B3358 linear
RED = (0.2705, 0.0529, 0.0395)       # #8E4238 linear


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- helpers

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.5, metal=0.0, coat=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def bevel(obj, width, segments=3):
    mod = obj.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    return obj


def cyl(r, depth, loc, mat, verts=32, r2=None, rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    return assign(bpy.context.object, mat)


def sphere(r, loc, mat, scale=(1, 1, 1), seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    o = bpy.context.object
    o.scale = scale
    return assign(o, mat)


def limb(a, b, r, mat, verts=16):
    """A rounded capsule from point a to point b."""
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2
    d = b - a
    o = cyl(r, d.length, mid, mat, verts=verts)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return [o, sphere(r, a, mat, seg=16), sphere(r, b, mat, seg=16)]


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    j = bpy.context.object
    j.name = name
    j.data.name = name
    bpy.ops.object.shade_smooth()
    return j


# ---------------------------------------------------------------- figurine

def number_mesh(n, loc, rot, mat, size=0.62):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.object
    t.data.body = str(n)
    t.data.size = size
    t.data.extrude = 0.025
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    bpy.ops.object.convert(target='MESH')
    return assign(bpy.context.object, mat)


def figurine(name, pose, mats, style='mannequin', number=None):
    """A premium board-game miniature: round lacquer base, soft vinyl figure."""
    parts = []
    # Base: lacquered disc with a thin gold trim ring.
    base = cyl(1.25, 0.28, (0, 0, 0.14), mats['Base'], verts=48)
    bevel(base, 0.06)
    parts.append(base)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.2, minor_radius=0.035, location=(0, 0, 0.28))
    parts.append(assign(bpy.context.object, mats['Trim']))

    top = 0.28
    if pose == 'defense':
        stance, knee, hip = 0.62, 1.05, 1.75
        # A lower, wider stance and active hands.
        arm_l = [(-0.72, -0.05, 3.25), (-1.35, -0.35, 3.05), (-1.7, -0.55, 3.35)]
        arm_r = [(0.72, -0.05, 3.25), (1.35, -0.35, 3.05), (1.7, -0.55, 3.35)]
        lean = -0.12
    else:
        stance, knee, hip = 0.4, 1.2, 1.95
        arm_l = [(-0.66, 0.0, 3.45), (-0.88, -0.2, 2.75), (-0.8, -0.45, 2.2)]
        arm_r = [(0.66, 0.0, 3.45), (0.95, -0.25, 2.8), (0.85, -0.6, 2.3)]
        lean = -0.05

    for s in (-1, 1):
        foot = (s * stance, -0.1, top + 0.14)
        parts.append(sphere(0.2, foot, mats['Accent' if style == 'toy' else 'Shoe'], scale=(1.0, 1.55, 0.72)))
        parts += limb((s * stance, 0, top + 0.25), (s * stance * 0.8, lean * 2, top + knee), 0.17, mats['Skin'])
        parts += limb((s * stance * 0.8, lean * 2, top + knee), (s * 0.3, lean, top + hip), 0.2, mats['Skin'])

    # Shorts, jersey, neck, head.
    parts.append(bevel(cyl(0.6, 0.75, (0, lean, top + hip + 0.05), mats['Shorts'], r2=0.52), 0.12))
    torso = cyl(0.5, 1.55, (0, lean * 1.5, top + hip + 1.05), mats['Jersey'], r2=0.72)
    torso.scale = (1.0, 0.72, 1.0)
    parts.append(bevel(torso, 0.18, 4))
    parts.append(cyl(0.16, 0.3, (0, lean * 2, top + hip + 1.95), mats['Skin'], verts=16))
    head_c = (0, lean * 2.2, top + hip + 2.45 + (0.06 if style == 'toy' else 0))
    head_r = 0.58 if style == 'toy' else 0.5
    parts.append(sphere(head_r, head_c, mats['Skin'], scale=(0.95, 1.0, 1.08), seg=32))
    if style == 'toy':
        # Hair cap and a headband in the team accent.
        parts.append(sphere(head_r * 1.03, (head_c[0], head_c[1] + 0.03, head_c[2] + 0.12), mats['Hair'], scale=(0.97, 1.02, 0.78), seg=32))
        bpy.ops.mesh.primitive_torus_add(major_radius=head_r * 0.98, minor_radius=0.075, location=(head_c[0], head_c[1], head_c[2] + 0.1))
        parts.append(assign(bpy.context.object, mats['Accent']))
    if number is not None:
        chest = top + hip + 1.12
        parts.append(number_mesh(number, (0, lean * 1.5 - 0.47, chest), (math.radians(90), 0, 0), mats['Number']))
        parts.append(number_mesh(number, (0, lean * 1.5 + 0.47, chest + 0.05), (math.radians(90), 0, math.pi), mats['Number'], size=0.78))

    for arm in (arm_l, arm_r):
        sh, el, ha = [Vector(p) + Vector((0, 0, top - 0.28)) for p in arm]
        parts += limb(sh, el, 0.15, mats['Skin'])
        parts += limb(el, ha, 0.13, mats['Skin'])
        parts.append(sphere(0.17, ha, mats['Skin']))
        # Jersey shoulder cap so the sleeve reads as fabric.
        parts.append(sphere(0.24, sh, mats['Jersey'], scale=(1.1, 0.9, 0.8)))

    return join(parts, name)


def figure_materials(team, style='mannequin'):
    team_c = NAVY if team != 'red' else RED
    k = f'_{style}_{team}' if team else ''
    metal = style == 'metal'
    return {
        'Base': material('Base' + k, srgb('#14233D'), rough=0.28, coat=0.6),
        'Trim': material('Trim' + k, srgb('#C9A76A'), rough=0.3, metal=1.0),
        'Jersey': material('Jersey' + k, team_c, rough=0.18 if metal else 0.55, coat=0.9 if metal else 0),
        'Shorts': material('Shorts' + k, tuple(c * 0.55 for c in team_c), rough=0.2 if metal else 0.6, coat=0.9 if metal else 0),
        'Skin': material('Skin' + k, srgb('#B9B4AB') if metal else srgb('#E6D9C6'), rough=0.32 if metal else 0.48, metal=1.0 if metal else 0),
        'Shoe': material('Shoe' + k, srgb('#F4F3EF'), rough=0.4),
        'Hair': material('Hair' + k, srgb('#2B211B'), rough=0.6),
        'Accent': material('Accent' + k, srgb('#F4F3EF') if team != 'red' else srgb('#C9A76A'), rough=0.45),
        'Number': material('Number' + k, srgb('#C9A76A') if metal else srgb('#F4F3EF'), rough=0.3 if metal else 0.45, metal=1.0 if metal else 0),
    }


def compare():
    """Three figurine styles side by side, offense front / defense back."""
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 820
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('World'); scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*srgb('#0B1526'), 1)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -25, 0))
    f = bpy.context.object; f.scale = (50, 50, 1)
    bpy.ops.object.transform_apply(scale=True)
    f.data.materials.append(floor_material())
    for i, style in enumerate(['mannequin', 'toy', 'metal']):
        x = (i - 1) * 6.2
        o = figurine(f'O_{style}', 'offense', figure_materials('navy', style), style, number=2)
        o.location = (x - 1.35, -30, 0)
        d = figurine(f'D_{style}', 'defense', figure_materials('red', style), style, number=5)
        d.location = (x + 1.45, -29.6, 0)
        d.rotation_euler = (0, 0, math.pi * 0.92)
    bpy.ops.object.light_add(type='AREA', location=(-4, -38, 14))
    key = bpy.context.object; key.data.size = 14; key.data.energy = 5200; key.data.color = srgb('#FFE9CC')
    key.rotation_euler = (math.radians(50), 0, math.radians(-15))
    bpy.ops.object.light_add(type='AREA', location=(6, -20, 9))
    rim = bpy.context.object; rim.data.size = 10; rim.data.energy = 2600; rim.data.color = srgb('#BFD3FF')
    rim.rotation_euler = (math.radians(-60), 0, math.radians(160))
    bpy.ops.object.camera_add(location=(0, -47, 5.6))
    cam = bpy.context.object
    cam.rotation_euler = (Vector((0, -29.8, 2.3)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 58
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = 17
    cam.data.dof.aperture_fstop = 2.2
    scene.camera = cam
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(PREVIEW_DIR / 'compare_styles.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', scene.render.filepath)


# ---------------------------------------------------------------- hoop

def hoop(mats):
    """Stanchion behind the baseline, glass board at y=4, rim at y=5.25, 10 ft."""
    parts = []
    Y = lambda y: -y
    # Base block and padded pole.
    bpy.ops.mesh.primitive_cube_add(location=(0, Y(-6.2), 1.1))
    b = bpy.context.object; b.scale = (2.2, 1.9, 1.1)
    parts.append(bevel(assign(b, mats['Pad']), 0.25))
    parts.append(bevel(cyl(0.42, 9.5, (0, Y(-5.4), 6.4), mats['Pad'], verts=24), 0.08))
    # Arm reaching over the baseline to the board.
    parts += limb((0, Y(-5.4), 11.2), (0, Y(3.7), 12.2), 0.28, mats['Metal'])
    # Glass board with a white frame and inner target box.
    bpy.ops.mesh.primitive_cube_add(location=(0, Y(4.0), 11.75))
    g = bpy.context.object; g.scale = (3.0, 0.06, 1.75)
    parts.append(assign(g, mats['Glass']))
    for (sx, sz, x, z) in [(3.05, .08, 0, 13.5), (3.05, .08, 0, 10.0), (.08, 1.8, -3.0, 11.75), (.08, 1.8, 3.0, 11.75),
                           (1.0, .05, 0, 11.45), (.05, .75, -0.95, 10.75), (.05, .75, 0.95, 10.75)]:
        bpy.ops.mesh.primitive_cube_add(location=(x, Y(3.93), z))
        f = bpy.context.object; f.scale = (sx, 0.04, sz)
        parts.append(assign(f, mats['Frame']))
    # Rim and bracket.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.05, major_segments=48, location=(0, Y(5.25), 10.0))
    parts.append(assign(bpy.context.object, mats['Rim']))
    bpy.ops.mesh.primitive_cube_add(location=(0, Y(4.3), 9.95))
    br = bpy.context.object; br.scale = (0.28, 0.3, 0.05)
    parts.append(assign(br, mats['Rim']))
    # Net: a tapered open cylinder drawn as a lattice of thin cords.
    for i in range(12):
        a = i / 12 * math.tau
        top = Vector((math.cos(a) * 0.72, Y(5.25) + math.sin(a) * 0.72, 9.96))
        a2 = a + 0.5
        bot = Vector((math.cos(a2) * 0.42, Y(5.25) + math.sin(a2) * 0.42, 8.55))
        parts += limb(top, bot, 0.012, mats['Net'], verts=6)
        a3 = a - 0.5
        bot2 = Vector((math.cos(a3) * 0.42, Y(5.25) + math.sin(a3) * 0.42, 8.55))
        parts += limb(top, bot2, 0.012, mats['Net'], verts=6)
    return join(parts, 'Hoop')


def hoop_materials():
    return {
        'Pad': material('Pad', srgb('#1B3358'), rough=0.7),
        'Metal': material('Metal', srgb('#2A3444'), rough=0.35, metal=1.0),
        'Glass': material('Glass', srgb('#DDE6EE'), rough=0.05, alpha=0.28),
        'Frame': material('Frame', srgb('#F4F3EF'), rough=0.35),
        'Rim': material('Rim', srgb('#D0612A'), rough=0.35, metal=0.6),
        'Net': material('Net', srgb('#F4F3EF'), rough=0.8),
    }


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), use_selection=True, export_format='GLB',
                              export_apply=True, export_yup=True)
    print('exported', path, path.stat().st_size, 'bytes')


# ---------------------------------------------------------------- preview scene

def floor_material():
    m = bpy.data.materials.new('Floor')
    m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes
    bsdf = n.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.32
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = 0.35
    tc = n.new('ShaderNodeTexCoord')
    # Maple planks: stretched noise per plank for grain, a plank-id tone.
    mapping = n.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.0, 0.08, 1.0)
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 6.0
    noise.inputs['Detail'].default_value = 8.0
    ramp = n.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*srgb('#C9A878'), 1)
    ramp.color_ramp.elements[1].color = (*srgb('#E2C79C'), 1)
    nt.links.new(tc.outputs['Object'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    # Court markings on top.
    img = n.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(str(OUT / 'court_lines.png'))
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    nt.links.new(tc.outputs['UV'], img.inputs['Vector'])
    nt.links.new(img.outputs['Alpha'], mix.inputs['Factor'])
    nt.links.new(ramp.outputs['Color'], mix.inputs['A'])
    nt.links.new(img.outputs['Color'], mix.inputs['B'])
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m


def court_plinth():
    # Floor: a plane covering x -25..25, y 0..50 with UVs matching the texture.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -25, 0))
    f = bpy.context.object
    f.scale = (50, 50, 1)
    bpy.ops.object.transform_apply(scale=True)
    f.data.materials.append(floor_material())
    # Navy lacquer plinth under and around the floor, like a display model.
    bpy.ops.mesh.primitive_cube_add(location=(0, -20.3, -0.8))
    p = bpy.context.object
    p.scale = (28, 30.4, 0.78)
    bevel(p, 0.35, 4)
    assign(p, material('Plinth', srgb('#14233D'), rough=0.25, coat=0.8))
    # Gold inlay around the playing surface.
    bpy.ops.mesh.primitive_cube_add(location=(0, -23.5, -0.02))
    g = bpy.context.object
    g.scale = (26.2, 25.4, 0.01)
    assign(g, material('Inlay', srgb('#A8823F'), rough=0.35, metal=1.0))
    return f


def place(obj, x, y, face):
    o = obj.copy()
    o.data = obj.data.copy()
    bpy.context.collection.objects.link(o)
    o.location = (x, -y, 0)
    o.rotation_euler = (0, 0, face)
    return o


def facing(frm, to):
    dx, dy = to[0] - frm[0], to[1] - frm[1]
    # Figures face Blender -Y; court +y is Blender -Y.
    return math.atan2(dx, dy)


def preview():
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'

    world = bpy.data.worlds.new('World'); scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*srgb('#0B1526'), 1)
    bg.inputs['Strength'].default_value = 0.6

    court_plinth()
    hoop(hoop_materials())

    off = figurine('Off', 'offense', figure_materials('navy'))
    dfn = figurine('Def', 'defense', figure_materials('red'))

    # Level 3 freeze: pick and roll, the big has stepped up.
    pos = {'o1': (8, 26.5), 'o2': (-17, 20), 'o3': (22, 3.5), 'o4': (-22, 3.5), 'o5': (1.5, 19.5),
           'd1': (3, 29.2), 'd2': (-14, 18), 'd3': (18.5, 6), 'd4': (-14, 7.5), 'd5': (8.6, 24.3)}
    ball = pos['o1']
    for k, p in pos.items():
        if k[0] == 'o':
            face = facing(p, (0, 5.25)) if k != 'o1' else facing(p, pos['o5'])
            place(off, *p, face)
        else:
            man = pos['o' + k[1]]
            place(dfn, *p, facing(p, man if k != 'd5' else ball))
    bpy.data.objects.remove(off)
    bpy.data.objects.remove(dfn)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(ball[0] + 0.9, -(ball[1]) - 0.4, 2.2))
    assign(bpy.context.object, material('Ball', srgb('#C8662E'), rough=0.6))
    bpy.ops.object.shade_smooth()

    # Lights: a large warm softbox overhead, a cool rim from behind.
    bpy.ops.object.light_add(type='AREA', location=(-6, -10, 42))
    key = bpy.context.object.data; key.size = 30; key.energy = 42000; key.color = srgb('#FFE9CC')
    bpy.ops.object.light_add(type='AREA', location=(10, 30, 18), rotation=(math.radians(-60), 0, 0))
    rim = bpy.context.object.data; rim.size = 20; rim.energy = 9000; rim.color = srgb('#BFD3FF')

    shots = {
        'broadcast': ((0, -84, 44), (0, -14, 1.5), 42, (8, 26.5)),
        'freeze': ((21, -44, 11), (6.5, -23.5, 2.6), 55, (8, 26.5)),
    }
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for name, (loc, target, lens, focus) in shots.items():
        bpy.ops.object.camera_add(location=loc)
        cam = bpy.context.object
        direction = Vector(target) - Vector(loc)
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = (Vector((focus[0], -focus[1], 2.5)) - Vector(loc)).length
        cam.data.dof.aperture_fstop = 0.9 if name == 'broadcast' else 0.5
        scene.camera = cam
        scene.render.filepath = str(PREVIEW_DIR / f'preview_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', scene.render.filepath)


def main():
    if '--compare' in sys.argv:
        compare()
        return
    reset()
    off = figurine('Figurine_Offense', 'offense', figure_materials(None))
    dfn = figurine('Figurine_Defense', 'defense', figure_materials(None))
    dfn.location.x = 4
    export([off, dfn], OUT / 'figurines.glb')
    reset()
    h = hoop(hoop_materials())
    export([h], OUT / 'hoop.glb')
    if '--preview' in sys.argv:
        preview()


main()
