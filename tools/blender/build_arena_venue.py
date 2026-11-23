"""CD Games Hoops IQ — arena venue built in Blender (look-dev + later bake/export).

Run only on a certified 3090 Blender (never on the Mac):
  blender-5.2.2 -b -P build_arena_venue.py -- <out_dir> <assets_json> [--samples N] [--res WxH] [--cams a,b] [--no-render]

assets_json: {"floor_diff":…, "floor_nor":…, "floor_rough":…, "font":…, "logo":…}
Coordinates match the game: 1 Blender unit = 1 ft. Game (x, z from the near
baseline, height) maps to Blender (x, -z, height); the glTF exporter turns that
into the game's Y-up frame with z = distance from the baseline.

Everything is original geometry built here. Textures: Poly Haven
laminate_floor_02 (CC0) for wood grain; Anton (OFL) for lettering; the CD mark
is the project's own logo. No NBA marks, arenas or 2K assets.
"""
import bpy, bmesh, math, random, sys, os, json, time
# assembly: free 静态球馆建筑与篮架：没有运动关节、没有动画；挂父级只为把整只篮架整体转到远端底线。
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0])
ASSETS = json.load(open(argv[1]))
opt = {'samples': 256, 'res': '1600x900', 'cams': 'broadcast,courtside,wide', 'render': True}
i = 2
while i < len(argv):
    a = argv[i]
    if a == '--samples': opt['samples'] = int(argv[i + 1]); i += 2
    elif a == '--res': opt['res'] = argv[i + 1]; i += 2
    elif a == '--cams': opt['cams'] = argv[i + 1]; i += 2
    elif a == '--no-render': opt['render'] = False; i += 1
    else: i += 1
os.makedirs(OUT, exist_ok=True)
random.seed(7)
T0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COLL = scene.collection


def G(x, z, h=0.0):
    """Game court feet -> Blender."""
    return Vector((x, -z, h))


# --------------------------------------------------------------------------- materials
def principled(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, coat=0.0, coat_rough=0.08,
               emit=None, emit_strength=0.0, transmission=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = coat_rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
        b.inputs['IOR'].default_value = 1.5
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def image(path, colorspace='sRGB'):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def floor_material(name, tint):
    """Varnished maple: strip grain from the Poly Haven scan (tiles every 2.5 ft so
    its boards read as ~3 in strips), warmed to honey, deep clear coat."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes
    l = nt.links
    b = n['Principled BSDF']
    tc = n.new('ShaderNodeTexCoord')
    mp = n.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / 2.5, 1 / 2.5, 1)
    l.new(tc.outputs['Object'], mp.inputs['Vector'])
    diff = n.new('ShaderNodeTexImage'); diff.image = image(ASSETS['floor_diff'])
    nor = n.new('ShaderNodeTexImage'); nor.image = image(ASSETS['floor_nor'], 'Non-Color')
    rough = n.new('ShaderNodeTexImage'); rough.image = image(ASSETS['floor_rough'], 'Non-Color')
    for t in (diff, nor, rough):
        l.new(mp.outputs['Vector'], t.inputs['Vector'])
    hsv = n.new('ShaderNodeHueSaturation')
    hsv.inputs['Saturation'].default_value = 1.45
    hsv.inputs['Value'].default_value = 0.95
    l.new(diff.outputs['Color'], hsv.inputs['Color'])
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    l.new(hsv.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*tint, 1)
    l.new(mix.outputs['Result'], b.inputs['Base Color'])
    nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.35
    l.new(nor.outputs['Color'], nm.inputs['Color'])
    l.new(nm.outputs['Normal'], b.inputs['Normal'])
    rr = n.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = 0.28
    rr.inputs['To Max'].default_value = 0.5
    l.new(rough.outputs['Color'], rr.inputs['Value'])
    l.new(rr.outputs['Result'], b.inputs['Roughness'])
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = 0.06
    return m


def vertex_color_material(name, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    attr = n.new('ShaderNodeAttribute'); attr.attribute_name = 'Col'
    m.node_tree.links.new(attr.outputs['Color'], n['Principled BSDF'].inputs['Base Color'])
    n['Principled BSDF'].inputs['Roughness'].default_value = rough
    return m


M = {
    'maple': floor_material('Maple', (1.0, 0.80, 0.56)),
    'stain': floor_material('MapleStained', (0.80, 0.58, 0.36)),
    'paint_navy': principled('PaintNavy', (0.018, 0.045, 0.12), 0.35, coat=1.0, coat_rough=0.06),
    'paint_line': principled('PaintLine', (0.92, 0.91, 0.87), 0.4, coat=1.0, coat_rough=0.06),
    'paint_gold': principled('PaintGold', (0.78, 0.56, 0.24), 0.35, coat=1.0, coat_rough=0.06),
    'concrete': principled('Concrete', (0.06, 0.065, 0.075), 0.85),
    'seat': principled('Seat', (0.035, 0.06, 0.13), 0.55),
    'rail': principled('Rail', (0.12, 0.12, 0.13), 0.35, metal=1.0),
    'crowd': vertex_color_material('Crowd'),
    'glass': principled('Glass', (0.95, 0.98, 1.0), 0.02, transmission=1.0),
    'white': principled('White', (0.9, 0.9, 0.88), 0.35),
    'black': principled('Black', (0.015, 0.016, 0.02), 0.45),
    'rim': principled('Rim', (0.85, 0.22, 0.04), 0.35, metal=0.6),
    'net': principled('Net', (0.95, 0.95, 0.95), 0.6),
    'pad': principled('Pad', (0.02, 0.06, 0.16), 0.45, coat=0.5, coat_rough=0.3),
    'steel': principled('Steel', (0.28, 0.29, 0.31), 0.3, metal=1.0),
    'ceiling': principled('Ceiling', (0.02, 0.022, 0.026), 0.9),
    'led_blue': principled('LedBlue', (0.0, 0.0, 0.0), 0.5, emit=(0.08, 0.22, 0.75), emit_strength=6.0),
    'led_gold': principled('LedGold', (0.0, 0.0, 0.0), 0.5, emit=(1.0, 0.68, 0.25), emit_strength=8.0),
    'lamp': principled('Lamp', (0, 0, 0), 0.5, emit=(1.0, 0.97, 0.92), emit_strength=40.0),
    'screen': principled('Screen', (0, 0, 0), 0.4, emit=(0.06, 0.12, 0.3), emit_strength=4.0),
    'table': principled('Table', (0.02, 0.03, 0.06), 0.4),
}


# --------------------------------------------------------------------------- mesh helpers
def new_obj(name, bm, mat, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    COLL.objects.link(ob)
    me.materials.append(mat)
    return ob


_CUBE_FACES = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))


def box(bm, c, s, mat=None):
    """Axis box centred on c with size s, optionally moved by mat. Builds the
    verts directly: bmesh.ops touches every element of the mesh on each call,
    which made the 20 000-seat bowl quadratic (the first preview never left
    geometry). Returns the new faces."""
    vs = []
    for i in range(8):
        p = Vector((c[0] + s[0] * ((i >> 2 & 1) - 0.5), c[1] + s[1] * ((i >> 1 & 1) - 0.5), c[2] + s[2] * ((i & 1) - 0.5)))
        vs.append(bm.verts.new(mat @ p if mat is not None else p))
    return [bm.faces.new([vs[k] for k in f]) for f in _CUBE_FACES]


def _ico_template(radius):
    t = bmesh.new()
    bmesh.ops.create_icosphere(t, subdivisions=1, radius=radius)
    co = [v.co.copy() for v in t.verts]
    t.verts.index_update()
    fs = [tuple(v.index for v in f.verts) for f in t.faces]
    t.free()
    return co, fs


HEAD = _ico_template(0.38)


def ico(bm, offset, mat):
    co, fs = HEAD
    vs = [bm.verts.new(mat @ (c + Vector(offset))) for c in co]
    return [bm.faces.new([vs[k] for k in f]) for f in fs]


def flat_poly(bm, pts, h):
    vs = [bm.verts.new((p.x, p.y, h)) for p in pts]
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f])


def strip(bm, pts, w, h, closed=False):
    """A painted line of width w along a polyline (Blender XY)."""
    n = len(pts)
    left, right = [], []
    for k in range(n):
        a = pts[k - 1] if (k > 0 or closed) else pts[k]
        b = pts[(k + 1) % n] if (k < n - 1 or closed) else pts[k]
        d = (b - a); d.z = 0
        if d.length == 0: d = Vector((1, 0, 0))
        d.normalize()
        nrm = Vector((-d.y, d.x, 0)) * (w / 2)
        left.append(bm.verts.new((pts[k].x + nrm.x, pts[k].y + nrm.y, h)))
        right.append(bm.verts.new((pts[k].x - nrm.x, pts[k].y - nrm.y, h)))
    rng = range(n if closed else n - 1)
    for k in rng:
        k2 = (k + 1) % n
        bm.faces.new((left[k], right[k], right[k2], left[k2]))


def arc(cx, cz, r, a0, a1, steps=64):
    return [G(cx + r * math.cos(a0 + (a1 - a0) * t / steps), cz + r * math.sin(a0 + (a1 - a0) * t / steps)) for t in range(steps + 1)]


# --------------------------------------------------------------------------- floor
LW = 2 / 12            # two-inch lines
HOOP_Z = 5.25
CZ = HOOP_Z + math.sqrt(23.75 ** 2 - 22 ** 2)
A3 = math.atan2(CZ - HOOP_Z, 22)


def mirror_far(pts):
    """Same marking at the far end (court is 94 ft), turned around."""
    return [Vector((-p.x, -94 - p.y, p.z)) for p in pts]


bm = bmesh.new()
for (x0, x1, z0, z1) in [(-35, 35, -12, 106)]:
    flat_poly(bm, [G(x0, z0), G(x1, z0), G(x1, z1), G(x0, z1)], 0.0)
floor = new_obj('Floor_Maple', bm, M['maple'])
bm = bmesh.new(); box(bm, G(0, 47, -0.06), (600, 600, 0.1)); new_obj('Ground', bm, M['concrete'])

# Two-tone stain outside the arc, both halves.
bm = bmesh.new()
for far in (False, True):
    pts = [G(-25, 0), G(-22, 0), G(-22, CZ)] + arc(0, HOOP_Z, 23.75, math.pi - A3, A3, 72)[1:-1] + [G(22, CZ), G(22, 0), G(25, 0), G(25, 47), G(-25, 47)]
    flat_poly(bm, mirror_far(pts) if far else pts, 0.004)
new_obj('Floor_Stain', bm, M['stain'])

# Navy apron around the court.
bm = bmesh.new()
for (x0, x1, z0, z1) in [(-35, -25, -12, 106), (25, 35, -12, 106), (-25, 25, -12, 0), (-25, 25, 94, 106)]:
    flat_poly(bm, [G(x0, z0), G(x1, z0), G(x1, z1), G(x0, z1)], 0.006)
new_obj('Floor_Apron', bm, M['paint_navy'])

# Painted keys and centre circle.
bm = bmesh.new()
for far in (False, True):
    key = [G(-8, 0), G(8, 0), G(8, 19), G(-8, 19)]
    flat_poly(bm, mirror_far(key) if far else key, 0.008)
circ = [G(6 * math.cos(t * math.tau / 96), 47 + 6 * math.sin(t * math.tau / 96)) for t in range(96)]
flat_poly(bm, circ, 0.008)
new_obj('Floor_Paint', bm, M['paint_navy'])

# Gold pinstripe inside each lane.
bm = bmesh.new()
for far in (False, True):
    p = [G(-7.45, 0.55), G(7.45, 0.55), G(7.45, 18.45), G(-7.45, 18.45)]
    strip(bm, mirror_far(p) if far else p, 0.09, 0.011, closed=True)
new_obj('Floor_Pinstripe', bm, M['paint_gold'])

# Lines.
bm = bmesh.new()
H = 0.012
strip(bm, [G(-25 + LW / 2, LW / 2), G(25 - LW / 2, LW / 2), G(25 - LW / 2, 94 - LW / 2), G(-25 + LW / 2, 94 - LW / 2)], LW, H, closed=True)
strip(bm, [G(-25, 47), G(25, 47)], LW, H)
strip(bm, circ, LW, H, closed=True)
strip(bm, [G(2 * math.cos(t * math.tau / 64), 47 + 2 * math.sin(t * math.tau / 64)) for t in range(64)], LW, H, closed=True)
for far in (False, True):
    mk = (lambda pts: mirror_far(pts)) if far else (lambda pts: pts)
    strip(bm, mk([G(-8, 0), G(-8, 19), G(8, 19), G(8, 0)]), LW, H)
    strip(bm, mk([G(-22, 0), G(-22, CZ)] + arc(0, HOOP_Z, 23.75, math.pi - A3, A3, 96)[1:-1] + [G(22, CZ), G(22, 0)]), LW, H)
    strip(bm, mk(arc(0, 19, 6, 0, math.pi, 48)), LW, H)                      # FT circle, outside the lane
    for k in range(8):                                                       # dashed half inside the lane
        a0 = math.pi + k * math.pi / 8 + 0.06
        strip(bm, mk(arc(0, 19, 6, a0, a0 + math.pi / 8 - 0.12, 6)), LW, H)
    strip(bm, mk([G(-4, 4)] + arc(0, HOOP_Z, 4, math.pi, 0, 40)[0:] + [G(4, 4)]), LW, H)
    for z in (7, 8, 11, 14):
        strip(bm, mk([G(-8.8, z), G(-8, z)]), LW, H)
        strip(bm, mk([G(8, z), G(8.8, z)]), LW, H)
new_obj('Floor_Lines', bm, M['paint_line'])


def text_mesh(name, body, size, mat, at, rot_z, extrude=0.0, h=0.014):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    if ASSETS.get('font') and os.path.exists(ASSETS['font']):
        cu.font = bpy.data.fonts.load(ASSETS['font'], check_existing=True)
    cu.extrude = extrude
    ob = bpy.data.objects.new(name, cu)
    COLL.objects.link(ob)
    ob.location = (at.x, at.y, h)
    ob.rotation_euler = (0, 0, rot_z)
    ob.data.materials.append(mat)
    return ob


# Lettering on the apron: readable from the broadcast side (camera at -x).
text_mesh('Apron_Name_Near', 'CD GAMES', 5.0, M['paint_line'], G(-30, 47), -math.pi / 2)
text_mesh('Apron_Name_Far', 'HOOPS IQ', 5.0, M['paint_gold'], G(30, 47), -math.pi / 2)
for zc, rot in ((-6, 0.0), (100, math.pi)):
    text_mesh(f'Baseline_{zc}', 'CD GAMES', 3.2, M['paint_line'], G(0, zc), rot)

# Centre-court CD mark.
if ASSETS.get('logo') and os.path.exists(ASSETS['logo']):
    img = image(ASSETS['logo'])
    m = bpy.data.materials.new('LogoGold')
    m.use_nodes = True
    n = m.node_tree.nodes
    b = n['Principled BSDF']
    t = n.new('ShaderNodeTexImage'); t.image = img
    b.inputs['Base Color'].default_value = (0.82, 0.6, 0.28, 1)
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = 0.06
    m.node_tree.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    w = 9.5
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -47, 0.016))
    lg = bpy.context.active_object
    lg.name = 'Floor_Logo'
    lg.scale = (w, w * img.size[1] / max(1, img.size[0]), 1)
    lg.rotation_euler = (0, 0, -math.pi / 2)
    lg.data.materials.append(m)


# --------------------------------------------------------------------------- baskets
def basket(far=False):
    root = bpy.data.objects.new('Basket_Far' if far else 'Basket_Near', None)
    COLL.objects.link(root)
    parts = []

    def add(ob):
        ob.parent = root
        parts.append(ob)
        return ob

    # Glass, border, shooter's square, bottom pad.
    bm = bmesh.new(); box(bm, G(0, 4.0 - 0.045, 9.5 + 1.75), (6, 0.09, 3.5)); add(new_obj('Board_Glass', bm, M['glass']))
    bm = bmesh.new()
    fw = 2 / 12
    for (cx, cz, sx, sz) in [(0, 13 - fw / 2, 6, fw), (0, 9.5 + fw / 2, 6, fw), (-3 + fw / 2, 11.25, fw, 3.5), (3 - fw / 2, 11.25, fw, 3.5)]:
        box(bm, G(cx, 4.0 + 0.01, cz), (sx, 0.02, sz))
    sq_y = 10.05
    for (cx, cz, sx, sz) in [(0, sq_y + 1.5 - fw / 2, 2, fw), (0, sq_y + fw / 2, 2, fw), (-1 + fw / 2, sq_y + 0.75, fw, 1.5), (1 - fw / 2, sq_y + 0.75, fw, 1.5)]:
        box(bm, G(cx, 4.0 + 0.012, cz), (sx, 0.02, sz))
    add(new_obj('Board_Paint', bm, M['white']))
    bm = bmesh.new(); box(bm, G(0, 3.83, 9.38), (6.3, 0.34, 0.32))
    for sx in (-1, 1): box(bm, G(sx * 3.02, 3.83, 10.0), (0.3, 0.34, 1.25))
    add(new_obj('Board_Pad', bm, M['black']))
    # Shot-clock unit above the board.
    bm = bmesh.new(); box(bm, G(0, 3.7, 13.45), (2.2, 0.55, 0.7)); add(new_obj('ShotClock', bm, M['black']))
    bm = bmesh.new(); box(bm, G(0, 4.0, 13.45), (1.8, 0.02, 0.5)); add(new_obj('ShotClock_Face', bm, M['led_gold']))
    # Rim, bracket and net.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.05, major_segments=48, minor_segments=10, location=G(0, HOOP_Z, 10.0))
    rim = bpy.context.active_object; rim.name = 'Rim'; rim.data.materials.append(M['rim']); add(rim)
    bm = bmesh.new(); box(bm, G(0, (4.0 + HOOP_Z - 0.75) / 2, 9.95), (0.4, HOOP_Z - 0.75 - 4.0 + 0.1, 0.14)); box(bm, G(0, 4.05, 9.85), (0.6, 0.08, 0.42)); add(new_obj('Rim_Bracket', bm, M['rim']))
    bm = bmesh.new()
    rings = []
    for k in range(6):
        t = k / 5
        rad = 0.75 - 0.28 * t
        zc = 10.0 - 1.45 * t
        ring = []
        for s in range(12):
            a = (s + (0.5 if k % 2 else 0)) * math.tau / 12
            p = G(rad * math.cos(a), HOOP_Z + rad * math.sin(a), zc)
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for k in range(5):
        for s in range(12):
            a, b_ = rings[k][s], rings[k + 1][s]
            c = rings[k][(s + 1) % 12] if k % 2 else rings[k][(s - 1) % 12]
            bm.edges.new((a, b_)); bm.edges.new((c, b_))
    net = add(new_obj('Net', bm, M['net']))
    sk = net.modifiers.new('cord', 'SKIN')
    for v in net.data.skin_vertices[0].data: v.radius = (0.022, 0.022)
    # Stanchion: sloped padded base, padded post, steel arm.
    prof = [(-10.2, 0), (-3.0, 0), (-3.0, 3.15), (-3.6, 3.72), (-8.4, 3.05), (-10.2, 1.9)]
    bm = bmesh.new()
    left = [bm.verts.new(G(-2.3, z, h)) for z, h in prof]
    right = [bm.verts.new(G(2.3, z, h)) for z, h in prof]
    bm.faces.new(left); bm.faces.new(list(reversed(right)))
    for k in range(len(prof)):
        k2 = (k + 1) % len(prof)
        bm.faces.new((left[k], left[k2], right[k2], right[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    base = add(new_obj('Stanchion_Base', bm, M['pad']))
    bv = base.modifiers.new('round', 'BEVEL'); bv.width = 0.22; bv.segments = 4
    bm = bmesh.new(); box(bm, G(0, -6.3, 3.0 + 2.5), (1.5, 1.35, 5.0)); post = add(new_obj('Stanchion_Post', bm, M['pad']))
    bv = post.modifiers.new('round', 'BEVEL'); bv.width = 0.3; bv.segments = 4
    bm = bmesh.new(); box(bm, G(0, -2.79, 2.75), (4.9, 0.05, 0.14)); box(bm, G(0, -6.3, 7.65), (1.7, 1.55, 0.12)); add(new_obj('Stanchion_Gold', bm, M['paint_gold']))
    cu = bpy.data.curves.new('Arm', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.26; cu.bevel_resolution = 4
    sp = cu.splines.new('BEZIER')
    pts = [G(0, -6.3, 7.8), G(0, -5.9, 9.8), G(0, -3.7, 10.6), G(0, 0.6, 11.9), G(0, 3.5, 12.15)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    arm = bpy.data.objects.new('Stanchion_Arm', cu); COLL.objects.link(arm); cu.materials.append(M['steel']); add(arm)
    bm = bmesh.new(); box(bm, G(0, 3.72, 12.15), (1.3, 0.26, 0.75)); add(new_obj('Board_Mount', bm, M['black']))
    if far:
        root.matrix_world = Matrix.Translation((0, -94, 0)) @ Matrix.Rotation(math.pi, 4, 'Z')
    return root


basket(False)
basket(True)


# --------------------------------------------------------------------------- seating bowl
SHIRTS = [(0.9, 0.88, 0.82), (0.05, 0.12, 0.32), (0.75, 0.6, 0.25), (0.12, 0.12, 0.13), (0.55, 0.08, 0.1),
          (0.35, 0.38, 0.42), (0.85, 0.85, 0.86), (0.08, 0.2, 0.45), (0.25, 0.2, 0.15), (0.6, 0.62, 0.66)]
SKINS = [(0.55, 0.36, 0.25), (0.33, 0.2, 0.13), (0.72, 0.52, 0.4), (0.22, 0.13, 0.08), (0.62, 0.45, 0.33)]
crowd_bm = bmesh.new()
crowd_col = crowd_bm.loops.layers.color.new('Col')
conc_bm, seat_bm, rail_bm = bmesh.new(), bmesh.new(), bmesh.new()
led_bm = bmesh.new()
stats = {'seats': 0, 'people': 0}


def paint(faces, color):
    for f in faces:
        for lp in f.loops:
            lp[crowd_col] = (*color, 1.0)


def stand(a, b, outward, rows, depth, rise, h0, occupancy, led_top=False):
    """Seating rows along the floor segment a->b (game x/z), climbing outward."""
    a, b = Vector((a[0], a[1])), Vector((b[0], b[1]))
    o = Vector(outward).normalized()
    along = (b - a)
    length = along.length
    u = along.normalized()
    yaw = math.atan2(-o.x, o.y)          # seated people face back toward the court

    def W(p2, h):
        return G(p2.x, p2.y, h)
    for r in range(rows):
        front = r * depth
        top = h0 + r * rise
        c2 = a + along / 2 + o * (front + depth / 2)
        # Riser block (rectangular, oriented along u/o).
        cen = W(c2, top / 2)
        box(conc_bm, (0, 0, 0), (length, depth, top), Matrix.Translation(cen) @ Matrix.Rotation(-math.atan2(u.y, u.x), 4, 'Z'))
        n = int(length / 1.75)
        for s in range(n):
            p2 = a + u * ((s + 0.5) * length / n) + o * (front + depth * 0.62)
            M_ = Matrix.Translation(W(p2, top)) @ Matrix.Rotation(-math.atan2(u.y, u.x), 4, 'Z')
            box(seat_bm, (0, 0, 0.55), (1.5, 1.2, 0.18), M_)
            box(seat_bm, (0, -0.62, 1.15), (1.5, 0.18, 1.1), M_)
            stats['seats'] += 1
            if random.random() < occupancy:
                lean = random.uniform(-0.12, 0.12)
                tv = box(crowd_bm, (lean, -0.1, 1.55), (1.25 * random.uniform(0.9, 1.15), 0.75, 1.75), M_)
                legs = box(crowd_bm, (0, 0.55, 0.75), (1.1, 1.1, 0.4), M_)
                head = ico(crowd_bm, (lean, -0.05, 2.75), M_)
                shirt = random.choice(SHIRTS)
                k = random.uniform(0.75, 1.1)
                paint(tv, tuple(min(1, c * k) for c in shirt))
                paint(legs, random.choice([(0.08, 0.08, 0.1), (0.15, 0.17, 0.25), (0.3, 0.28, 0.25)]))
                paint(head, random.choice(SKINS))
                stats['people'] += 1
    # Handrail along the front row and the LED ribbon on the top fascia.
    box(rail_bm, (0, 0, 0), (length, 0.08, 0.08), Matrix.Translation(W(a + along / 2 + o * 0.1, h0 + 3.2)) @ Matrix.Rotation(-math.atan2(u.y, u.x), 4, 'Z'))
    box(led_bm, (0, 0, 0), (length, 0.15, 2.4), Matrix.Translation(W(a + along / 2 - o * 0.1, h0 - 1.3)) @ Matrix.Rotation(-math.atan2(u.y, u.x), 4, 'Z'))


# Lower bowl: sides, ends and corner wedges.
LOWER = dict(rows=20, depth=2.9, rise=1.2, h0=2.6, occupancy=0.93)
stand((-38, -8), (-38, 102), (-1, 0), **LOWER)
stand((38, 102), (38, -8), (1, 0), **LOWER)
stand((30, -18), (-30, -18), (0, -1), **LOWER)
stand((-30, 112), (30, 112), (0, 1), **LOWER)
for (a, b, o) in [((-38, -8), (-30, -18), (-1, -1)), ((30, -18), (38, -8), (1, -1)), ((38, 102), (30, 112), (1, 1)), ((-30, 112), (-38, 102), (-1, 1))]:
    stand(a, b, o, **LOWER)
# Upper bowl: set back and steeper.
back = LOWER['rows'] * LOWER['depth'] + 8
UH = LOWER['h0'] + LOWER['rows'] * LOWER['rise'] + 9
UPPER = dict(rows=16, depth=2.7, rise=1.75, h0=UH, occupancy=0.82)
stand((-38 - back, -8 - 20), (-38 - back, 102 + 20), (-1, 0), **UPPER)
stand((38 + back, 102 + 20), (38 + back, -8 - 20), (1, 0), **UPPER)
stand((30 + 20, -18 - back), (-30 - 20, -18 - back), (0, -1), **UPPER)
stand((-30 - 20, 112 + back), (30 + 20, 112 + back), (0, 1), **UPPER)
# Upper corners: without them the first preview looked straight into the black void.
for (a_, b_, o_) in [((-38 - back, -28), (-50, -18 - back), (-1, -1)), ((50, -18 - back), (38 + back, -28), (1, -1)),
                     ((38 + back, 122), (50, 112 + back), (1, 1)), ((-50, 112 + back), (-38 - back, 122), (-1, 1))]:
    stand(a_, b_, o_, **UPPER)
new_obj('Bowl_Concrete', conc_bm, M['concrete'])
new_obj('Bowl_Seats', seat_bm, M['seat'])
new_obj('Bowl_Rails', rail_bm, M['rail'])
new_obj('Bowl_Crowd', crowd_bm, M['crowd'])
new_obj('Bowl_LedRibbon', led_bm, M['led_blue'])

# Courtside: scorer's table and LED boards along the far sideline, team benches.
bm = bmesh.new(); box(bm, G(31, 47, 1.5), (3, 26, 3)); new_obj('ScorersTable', bm, M['table'])
bm = bmesh.new(); box(bm, G(29.45, 47, 1.5), (0.1, 25.6, 2.4)); new_obj('ScorersTable_LED', bm, M['led_gold'])
bm = bmesh.new()
for zc in list(range(14, 34, 2)) + list(range(62, 82, 2)):
    box(bm, G(32, zc, 0.9), (1.6, 1.6, 0.25)); box(bm, G(32.7, zc, 1.6), (0.2, 1.6, 1.4))
new_obj('Benches', bm, M['seat'])

# --------------------------------------------------------------------------- roof, scoreboard, lights
bm = bmesh.new(); box(bm, G(0, 47, 112), (420, 460, 1)); new_obj('Ceiling', bm, M['ceiling'])
bm = bmesh.new()
for xi in range(-150, 151, 25):
    box(bm, G(xi, 47, 96), (0.8, 380, 2.5))
for zi in range(-140, 241, 25):
    box(bm, G(0, zi, 98), (320, 0.8, 2.5))
new_obj('Roof_Truss', bm, M['steel'])
bm = bmesh.new(); box(bm, G(0, 47, 50), (24, 24, 15)); new_obj('Scoreboard', bm, M['black'])
bm = bmesh.new()
for (cx, cz, sx, sz) in [(0, 47 - 12.05, 22, 0.1), (0, 47 + 12.05, 22, 0.1), (-12.05, 47, 0.1, 22), (12.05, 47, 0.1, 22)]:
    box(bm, G(cx, cz, 51), (sx, sz, 11))
new_obj('Scoreboard_Screens', bm, M['screen'])
bm = bmesh.new()
for (cx, cz, sx, sz) in [(0, 47 - 12.1, 24.2, 0.1), (0, 47 + 12.1, 24.2, 0.1), (-12.1, 47, 0.1, 24.2), (12.1, 47, 0.1, 24.2)]:
    box(bm, G(cx, cz, 43.2), (sx, sz, 0.7))
new_obj('Scoreboard_Ring', bm, M['led_gold'])

# Catwalk light banks: visible fixtures plus the area lights that really light the court.
lamp_bm = bmesh.new()
LIGHTS = []
for side in (-1, 1):
    for zc in range(-4, 99, 13):
        LIGHTS.append(G(side * 30, zc, 78))
for xc in range(-18, 19, 12):
    LIGHTS.append(G(xc, -22, 80)); LIGHTS.append(G(xc, 116, 80))
for k, p in enumerate(LIGHTS):
    box(lamp_bm, p + Vector((0, 0, 0.6)), (4.5, 3.0, 0.3))
    ld = bpy.data.lights.new(f'CourtLight{k}', 'AREA')
    ld.shape = 'RECTANGLE'; ld.size = 4.5; ld.size_y = 3.0
    ld.energy = 26000
    ld.color = (1.0, 0.96, 0.9)
    lo = bpy.data.objects.new(f'CourtLight{k}', ld); COLL.objects.link(lo)
    lo.location = p
    aim = G(0, 47, 0) + (p - G(0, 47, 0)) * 0.35
    aim.z = 0
    lo.rotation_euler = (aim - p).to_track_quat('-Z', 'Y').to_euler()
new_obj('Lamp_Fixtures', lamp_bm, M['lamp'])
# Soft fill so the lower bowl reads but stays darker than the floor.
for p in (G(0, -60, 60), G(0, 154, 60), G(-90, 47, 60), G(90, 47, 60)):
    ld = bpy.data.lights.new('BowlFill', 'AREA'); ld.size = 40; ld.energy = 30000; ld.color = (0.8, 0.86, 1.0)
    lo = bpy.data.objects.new('BowlFill', ld); COLL.objects.link(lo); lo.location = p
    lo.rotation_euler = (G(0, 47, 10) - p).to_track_quat('-Z', 'Y').to_euler()

world = bpy.data.worlds.new('Arena'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.005, 0.007, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0


# --------------------------------------------------------------------------- cameras
def camera(name, pos, look, vfov=None, lens=None):
    cd = bpy.data.cameras.new(name)
    cd.clip_start = 0.5; cd.clip_end = 1500
    if vfov:
        cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(vfov)
    if lens:
        cd.lens = lens
    co = bpy.data.objects.new(name, cd); COLL.objects.link(co)
    co.location = pos
    co.rotation_euler = (look - pos).to_track_quat('-Z', 'Y').to_euler()
    return co


tgt = Vector((0, 3.4, 15))                 # game target (x, y-up, z)
d = Vector((-0.91, 0.39, 0.14)).normalized() * 80
gp = tgt + d
CAMS = {
    'broadcast': camera('Cam_Broadcast', G(gp.x, gp.z, gp.y), G(tgt.x, tgt.z, tgt.y), vfov=38),
    'courtside': camera('Cam_Courtside', G(-42, 44, 8.5), G(0, 9, 7), lens=32),
    'wide': camera('Cam_Wide', G(-62, -38, 62), G(0, 47, 0), lens=22),
}

# --------------------------------------------------------------------------- render
w, h = (int(v) for v in opt['res'].split('x'))
r = scene.render
r.engine = 'CYCLES'
r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
scene.cycles.samples = opt['samples']
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.device = 'GPU'
try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
scene.view_settings.exposure = -0.7   # a01 preview read washed out: navy apron looked sky blue
r.image_settings.file_format = 'PNG'

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'arena_venue.blend'))
result = {'build_s': round(time.time() - T0, 1), 'stats': stats, 'opts': opt, 'renders': {}}
if opt['render']:
    for name in opt['cams'].split(','):
        scene.camera = CAMS[name]
        t1 = time.time()
        r.filepath = os.path.join(OUT, f'lookdev_{name}.png')
        bpy.ops.render.render(write_still=True)
        result['renders'][name] = {'file': r.filepath, 'seconds': round(time.time() - t1, 1)}
        print(f'[arena] rendered {name} in {result["renders"][name]["seconds"]} s', flush=True)
result['total_s'] = round(time.time() - T0, 1)
json.dump(result, open(os.path.join(OUT, 'scene_result.json'), 'w'), indent=1)
print('[arena] done', json.dumps(result), flush=True)
