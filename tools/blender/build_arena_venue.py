"""CD Games Hoops IQ — arena venue built in Blender (look-dev + later bake/export).

Run only on a certified 3090 Blender (never on the Mac):
  blender-5.2.2 -b -P build_arena_venue.py -- <out_dir> <assets_json> [--samples N] [--res WxH] [--cams a,b] [--house W] [--no-render]

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
opt = {'samples': 256, 'res': '1600x900', 'cams': 'broadcast,courtside,wide,hero', 'render': True}
i = 2
while i < len(argv):
    a = argv[i]
    if a == '--samples': opt['samples'] = int(argv[i + 1]); i += 2
    elif a == '--res': opt['res'] = argv[i + 1]; i += 2
    elif a == '--cams': opt['cams'] = argv[i + 1]; i += 2
    elif a == '--house': opt['house'] = float(argv[i + 1]); i += 2
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
    # docs/ARENA_REFERENCE.md: pale warm maple, hue 36-43 deg, saturation 0.16-0.29
    # (a03 measured 19 deg, pinkish orange, so pull the hue toward yellow).
    hsv.inputs['Hue'].default_value = 0.53
    hsv.inputs['Saturation'].default_value = 1.1
    hsv.inputs['Value'].default_value = 1.15
    l.new(diff.outputs['Color'], hsv.inputs['Color'])
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    l.new(hsv.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*tint, 1)
    # 2.25-inch maple strips in random lengths, each its own shade, with seams and
    # staggered end joints (strips run along the court = Blender Y).
    def mth(op, a, b=None, clamp=False):
        m_ = n.new('ShaderNodeMath'); m_.operation = op; m_.use_clamp = clamp
        for k_, v_ in enumerate((a, b)):
            if v_ is None: continue
            if isinstance(v_, (int, float)): m_.inputs[k_].default_value = v_
            else: l.new(v_, m_.inputs[k_])
        return m_.outputs[0]
    def noise3(x_, y_, z_):
        c_ = n.new('ShaderNodeCombineXYZ')
        for k_, v_ in enumerate((x_, y_, z_)):
            if isinstance(v_, (int, float)): c_.inputs[k_].default_value = v_
            else: l.new(v_, c_.inputs[k_])
        w_ = n.new('ShaderNodeTexWhiteNoise'); w_.noise_dimensions = '3D'
        l.new(c_.outputs[0], w_.inputs['Vector'])
        return w_.outputs['Value']
    sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['Object'], sep.inputs[0])
    SW, SL = 2.25 / 12, 4.5
    xs = mth('DIVIDE', sep.outputs['X'], SW)
    bx = mth('FLOOR', xs)
    yy = mth('ADD', sep.outputs['Y'], mth('MULTIPLY', noise3(bx, 7.0, 0.0), SL * 1.7))
    ys = mth('DIVIDE', yy, SL * (0.75))
    by = mth('FLOOR', ys)
    shade = mth('ADD', 0.9, mth('MULTIPLY', noise3(bx, by, 3.0), 0.16))
    seam_x = mth('LESS_THAN', mth('FRACT', xs), 0.045)
    seam_y = mth('LESS_THAN', mth('FRACT', ys), 0.004)
    seam = mth('MAXIMUM', seam_x, seam_y)
    fac = mth('MULTIPLY', shade, mth('SUBTRACT', 1.0, mth('MULTIPLY', seam, 0.22)))
    fcol = n.new('ShaderNodeCombineXYZ')
    for k_ in range(3): l.new(fac, fcol.inputs[k_])
    mix2 = n.new('ShaderNodeMix'); mix2.data_type = 'RGBA'; mix2.blend_type = 'MULTIPLY'
    mix2.inputs['Factor'].default_value = 1.0
    l.new(mix.outputs['Result'], mix2.inputs['A'])
    l.new(fcol.outputs[0], mix2.inputs['B'])
    col_out = mix2.outputs['Result']
    if ASSETS.get('court_design') and os.path.exists(ASSETS['court_design']):
        # Our home-court design (tools/court/make_court_design.py) painted over the maple:
        # the texture spans x -35..35, z -12..106 ft; alpha = how much paint covers the wood.
        dmp = n.new('ShaderNodeMapping')
        dmp.inputs['Scale'].default_value = (1 / 70, 1 / 118, 1)
        dmp.inputs['Location'].default_value = (35 / 70, 106 / 118, 0)
        l.new(tc.outputs['Object'], dmp.inputs['Vector'])
        dt = n.new('ShaderNodeTexImage'); dt.image = image(ASSETS['court_design']); dt.extension = 'EXTEND'
        dt.interpolation = 'Cubic'
        l.new(dmp.outputs['Vector'], dt.inputs['Vector'])
        mix3 = n.new('ShaderNodeMix'); mix3.data_type = 'RGBA'; mix3.blend_type = 'MIX'
        l.new(dt.outputs['Alpha'], mix3.inputs['Factor'])
        l.new(col_out, mix3.inputs['A']); l.new(dt.outputs['Color'], mix3.inputs['B'])
        col_out = mix3.outputs['Result']
    l.new(col_out, b.inputs['Base Color'])
    nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.35
    l.new(nor.outputs['Color'], nm.inputs['Color'])
    l.new(nm.outputs['Normal'], b.inputs['Normal'])
    rr = n.new('ShaderNodeMapRange')
    rr.inputs['To Min'].default_value = 0.34
    rr.inputs['To Max'].default_value = 0.55
    l.new(rough.outputs['Color'], rr.inputs['Value'])
    l.new(rr.outputs['Result'], b.inputs['Roughness'])
    # Satin, not wet plastic (Owner 11-22: the glare and the plastic look): a thinner,
    # slightly blurred finish so lamp reflections are soft pools, not hot dots.
    b.inputs['Coat Weight'].default_value = 0.55
    b.inputs['Coat Roughness'].default_value = 0.17
    return m


def vertex_color_material(name, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    attr = n.new('ShaderNodeAttribute'); attr.attribute_name = 'Col'
    dim = n.new('ShaderNodeMix'); dim.data_type = 'RGBA'; dim.blend_type = 'MULTIPLY'
    dim.inputs['Factor'].default_value = 1.0; dim.inputs['B'].default_value = (0.6, 0.6, 0.6, 1)   # crowd sits in the dark
    m.node_tree.links.new(attr.outputs['Color'], dim.inputs['A'])
    m.node_tree.links.new(dim.outputs['Result'], n['Principled BSDF'].inputs['Base Color'])
    n['Principled BSDF'].inputs['Roughness'].default_value = rough
    return m


M = {
    'maple': floor_material('Maple', (1.0, 0.88, 0.66)),
    'stain': floor_material('MapleStained', (0.92, 0.78, 0.58)),
    'paint_navy': principled('PaintNavy', (0.011, 0.028, 0.08), 0.42, coat=0.55, coat_rough=0.17),
    'apron_navy': principled('ApronNavy', (0.015, 0.036, 0.1), 0.42, coat=0.55, coat_rough=0.17),   # floor/apron ~8x
    'paint_line': principled('PaintLine', (0.92, 0.91, 0.87), 0.45, coat=0.55, coat_rough=0.17),
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
    'led_gold': principled('LedGold', (0.0, 0.0, 0.0), 0.5, emit=(1.0, 0.68, 0.25), emit_strength=3.0),
    'lamp': principled('Lamp', (0, 0, 0), 0.5, emit=(1.0, 0.97, 0.92), emit_strength=9.0),   # lens glow; bright dots on the floor read as glare
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


# Geometry markings: only when no court-design texture is given (the texture now carries
# the stain, apron, lanes, lines, lettering and centre mark in one painted design).
if not (ASSETS.get('court_design') and os.path.exists(ASSETS['court_design'])):
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
    new_obj('Floor_Apron', bm, M['apron_navy'])

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
SEATS = []   # (matrix, occupied, near) -> instanced seats and 3D audience
step_bm, portal_bm = bmesh.new(), bmesh.new()
VOMS = []    # (mouth centre x/z, light height, outward) per vomitory


def paint(faces, color):
    for f in faces:
        for lp in f.loops:
            lp[crowd_col] = (*color, 1.0)


led_uv = led_bm.loops.layers.uv.new('UVMap')
glass_bm = bmesh.new()
LED_PANEL_FT, LED_PANELS = 24.0, 6     # make_led_ribbon.py: six 10:1 panels per texture repeat


def led_quad(a2, b2, o2, h_lo, h_hi, u0=0.0):
    """Court-facing LED face on segment a2->b2 (outward o2 points away from the court), UV-mapped so
    the ad text reads left-to-right for someone on the court; a black backing box gives it depth."""
    a2, b2, o2 = Vector(a2), Vector(b2), Vector(o2).normalized()
    L_ = (b2 - a2).length
    f2 = -o2 * 0.03
    vs = [led_bm.verts.new(G(*(p + f2), h)) for p, h in ((a2, h_lo), (b2, h_lo), (b2, h_hi), (a2, h_hi))]
    uvs = {vs[0]: (u0, 0), vs[1]: (u0 - L_ / (LED_PANEL_FT * LED_PANELS), 0),
           vs[2]: (u0 - L_ / (LED_PANEL_FT * LED_PANELS), 1), vs[3]: (u0, 1)}
    f = led_bm.faces.new(vs)
    f.normal_update()
    want = G(-o2.x, -o2.y) - G(0, 0)
    if f.normal.dot(want) < 0:
        f.normal_flip()
    for lp in f.loops:
        lp[led_uv].uv = uvs[lp.vert]
    u2 = (b2 - a2).normalized()
    box(portal_bm, (0, 0, 0), (L_, 0.2, h_hi - h_lo), Matrix.Translation(G(*((a2 + b2) / 2 + o2 * 0.08), (h_lo + h_hi) / 2)) @ Matrix.Rotation(-math.atan2(u2.y, u2.x), 4, 'Z'))


def wedge(bm, pf, pb, u2, hw, zf0, zf1, zb0, zb1):
    """Prism of half-width hw across u2 between front/back points pf, pb (game x/z); bottom and top
    heights given separately at the front and the back, so the top can follow a rake."""
    vs = []
    for w in (-hw, hw):
        for p, z0, z1 in ((pf, zf0, zf1), (pb, zb0, zb1)):
            q = p + u2 * w
            vs += [bm.verts.new(G(q.x, q.y, z0)), bm.verts.new(G(q.x, q.y, z1))]
    # vs: 0 f-lo, 1 f-hi, 2 b-lo, 3 b-hi on the -w side; 4..7 the same on +w.
    fs = [bm.faces.new([vs[i] for i in q]) for q in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (1, 3, 7, 5), (0, 4, 6, 2))]
    bmesh.ops.recalc_face_normals(bm, faces=fs)


def stand(a, b, outward, rows, depth, rise, h0, occupancy, ma=None, mb=None, glass=False):
    """Seating rows along the floor segment a->b (game x/z), climbing outward.

    ma/mb are the polygon miter vectors at each end: row k's ends slide along them, so neighbouring
    stands (sides, ends, corner wedges) meet seat-to-seat instead of leaving triangular black gaps."""
    a, b = Vector((a[0], a[1])), Vector((b[0], b[1]))
    o = Vector(outward).normalized()
    along = (b - a)
    length = along.length
    u = along.normalized()
    ka = Vector(ma).dot(u) if ma else 0.0      # start shift along u per foot of row offset
    kb = Vector(mb).dot(u) if mb else 0.0
    Rz = Matrix.Rotation(-math.atan2(u.y, u.x), 4, 'Z')

    def W(p2, h):
        return G(p2.x, p2.y, h)

    def riser(t0, t1, front, top):
        if t1 - t0 > 0.05:
            box(conc_bm, (0, 0, 0), (t1 - t0, depth, top), Matrix.Translation(W(a + u * ((t0 + t1) / 2) + o * (front + depth / 2), top / 2)) @ Rz)
    vom_any = length > 60 and h0 < 10
    VW = 7.0     # half width of the vomitory well
    mid_t = length / 2
    for r in range(rows):
        front = r * depth
        top = h0 + r * rise
        back_f = front + depth
        t0, t1 = ka * back_f, length + kb * back_f            # riser covers the row's back edge
        vom = vom_any and 2 <= r <= 9
        if vom:
            riser(t0, mid_t - VW, front, top)
            riser(mid_t + VW, t1, front, top)
        else:
            riser(t0, t1, front, top)
        fs = front + depth * 0.62
        s0, s1 = ka * fs, length + kb * fs
        n = max(1, int((s1 - s0) / 1.75))
        for s in range(n):
            t_ = s0 + (s + 0.5) * (s1 - s0) / n
            p2 = a + u * t_ + o * fs
            if n > 12 and s % 14 == 7:
                # Aisle: two steps per row and a handrail post, no seat.
                pa = a + u * t_ + o * front
                for k_ in (0, 1):
                    box(step_bm, (0, 0, 0), (1.7, depth / 2, 0.05), Matrix.Translation(W(pa + o * (depth * (0.25 + 0.5 * k_)), top + rise * 0.5 * k_ + 0.02)) @ Rz)
                box(rail_bm, (0, 0, 0), (0.09, 0.09, 3.0), Matrix.Translation(W(pa + o * depth * 0.5 + u * 1.0, top + 1.5)) @ Rz)
                continue
            if vom and abs(t_ - mid_t) < VW + 0.6:
                continue
            M_ = Matrix.Translation(W(p2, top)) @ Rz
            SEATS.append((M_, random.random() < occupancy, h0 < 10 and r < 7))
            stats['seats'] += 1
    if vom_any:
        # Vomitory well: floor at row-1 level, back wall at row 10 with a dark tunnel mouth, rail above.
        f2, f10 = 2 * depth, 10 * depth
        # Parapets either side follow the rake in one sloped wall (stepped boxes read as a staircase).
        for sx_ in (-VW - 0.3, VW + 0.3):
            pf, pb = a + u * (mid_t + sx_) + o * f2, a + u * (mid_t + sx_) + o * f10
            hf, hb = h0 + 2 * rise + 3.2, h0 + 9 * rise + 3.2
            wedge(conc_bm, pf, pb, u, 0.3, 0.0, hf, 0.0, hb)
            wedge(rail_bm, pf, pb, u, 0.1, hf + 0.15, hf + 0.3, hb + 0.15, hb + 0.3)
        flo = h0 + rise
        box(conc_bm, (0, 0, 0), (2 * VW, f10 - f2, flo), Matrix.Translation(W(a + u * mid_t + o * ((f2 + f10) / 2), flo / 2)) @ Rz)
        top10 = h0 + 10 * rise
        box(portal_bm, (0, 0, 0), (2 * VW - 2.0, 0.4, 8.0), Matrix.Translation(W(a + u * mid_t + o * (f10 - 0.15), flo + 4.0)) @ Rz)
        VOMS.append((a + u * mid_t + o * (f10 - 1.5), flo + 7.2, o))
        box(conc_bm, (0, 0, 0), (2 * VW, 0.6, top10 - flo - 8.0), Matrix.Translation(W(a + u * mid_t + o * (f10 + 0.1), flo + 8.0 + (top10 - flo - 8.0) / 2)) @ Rz)
        for sx_ in (-VW + 0.5, VW - 0.5):
            box(conc_bm, (0, 0, 0), (1.0, 0.6, 8.0), Matrix.Translation(W(a + u * (mid_t + sx_) + o * (f10 + 0.1), flo + 4.0)) @ Rz)
        box(rail_bm, (0, 0, 0), (2 * VW, 0.12, 0.12), Matrix.Translation(W(a + u * mid_t + o * (f10 + 0.2), top10 + 3.3)) @ Rz)
        for sx_ in (-VW + 0.3, 0.0, VW - 0.3):
            box(rail_bm, (0, 0, 0), (0.1, 0.1, 3.3), Matrix.Translation(W(a + u * (mid_t + sx_) + o * (f10 + 0.2), top10 + 1.65)) @ Rz)
    # Front: handrail (lower bowl) or glass balustrade (upper bowl), and the LED fascia below it.
    if glass:
        box(glass_bm, (0, 0, 0), (length, 0.06, 3.4), Matrix.Translation(W(a + along / 2 + o * 0.12, h0 + 1.7)) @ Rz)
        box(rail_bm, (0, 0, 0), (length, 0.16, 0.1), Matrix.Translation(W(a + along / 2 + o * 0.12, h0 + 3.45)) @ Rz)
    else:
        box(rail_bm, (0, 0, 0), (length, 0.08, 0.08), Matrix.Translation(W(a + along / 2 + o * 0.1, h0 + 3.2)) @ Rz)
    led_quad(a, b, o, h0 - 2.5, h0 - 0.1, random.randrange(LED_PANELS) / LED_PANELS)


def bowl(verts, **params):
    """Stands on every edge of a convex polygon (counter-clockwise in game x/z, outward = left of travel)."""
    V = [Vector(v) for v in verts]
    N = len(V)
    nrm = []
    for i in range(N):
        u_ = (V[(i + 1) % N] - V[i]).normalized()
        nrm.append(Vector((-u_.y, u_.x)))
    mit = [(nrm[i - 1] + nrm[i]) / (1 + nrm[i - 1].dot(nrm[i])) for i in range(N)]
    for i in range(N):
        stand(tuple(V[i]), tuple(V[(i + 1) % N]), tuple(nrm[i]), ma=mit[i], mb=mit[(i + 1) % N], **params)
    return V, mit


# Lower bowl: sides, ends and corner wedges as one polygon so the rows wrap the corners.
LOWER = dict(rows=20, depth=2.9, rise=1.2, h0=2.6, occupancy=0.93)
LOWER_POLY = [(-38, -8), (-38, 102), (-30, 112), (30, 112), (38, 102), (38, -8), (30, -18), (-30, -18)]
LV, LM = bowl(LOWER_POLY, **LOWER)
# Upper bowl: set back and steeper, glass balustrade on its front edge.
back = LOWER['rows'] * LOWER['depth'] + 8
UH = LOWER['h0'] + LOWER['rows'] * LOWER['rise'] + 9
UPPER = dict(rows=16, depth=2.7, rise=1.75, h0=UH, occupancy=0.82)
UPPER_POLY = [(-38 - back, -28), (-38 - back, 122), (-50, 112 + back), (50, 112 + back), (38 + back, 122),
              (38 + back, -28), (50, -18 - back), (-50, -18 - back)]
bowl(UPPER_POLY, glass=True, **UPPER)
new_obj('Bowl_Concrete', conc_bm, M['concrete'])
new_obj('Bowl_Rails', rail_bm, M['rail'])
new_obj('Bowl_Glass', glass_bm, M['glass'])


def seat_proto():
    """One stadium seat (pan, curved-ish back, pedestal), bevelled."""
    bm_ = bmesh.new()
    for c_, s_ in (((0, 0.05, 1.45), (1.55, 1.4, 0.22)), ((0, -0.68, 2.2), (1.55, 0.2, 1.35)), ((0, -0.1, 0.7), (0.3, 0.7, 1.3))):
        box(bm_, c_, s_)
    bmesh.ops.bevel(bm_, geom=list(bm_.edges), offset=0.06, segments=3, affect='EDGES', profile=0.5)
    me_ = bpy.data.meshes.new('SeatProto'); bm_.to_mesh(me_); bm_.free()
    for p_ in me_.polygons: p_.use_smooth = True
    me_.materials.append(M['seat'])
    return me_


def person_material(slot):
    """Per-instance colours: every seated fan gets their own shirt, skin and hair."""
    pal = {
        'Jersey': [(0.6, 0.6, 0.58), (0.02, 0.04, 0.12), (0.4, 0.3, 0.1), (0.025, 0.025, 0.03), (0.28, 0.035, 0.04),
                   (0.14, 0.15, 0.17), (0.7, 0.7, 0.7), (0.03, 0.07, 0.22), (0.1, 0.08, 0.06), (0.26, 0.27, 0.3), (0.05, 0.12, 0.06), (0.04, 0.04, 0.05)],
        'Skin': [(0.55, 0.33, 0.21), (0.28, 0.15, 0.08), (0.7, 0.47, 0.34), (0.16, 0.08, 0.04), (0.6, 0.4, 0.27), (0.42, 0.25, 0.14)],
        'Hair': [(0.02, 0.015, 0.01), (0.06, 0.035, 0.02), (0.25, 0.16, 0.07), (0.01, 0.01, 0.01), (0.35, 0.33, 0.3)],
        'Shorts': [(0.04, 0.05, 0.08), (0.08, 0.1, 0.16), (0.2, 0.17, 0.12), (0.03, 0.03, 0.03), (0.12, 0.12, 0.13)],
        'Shoe': [(0.7, 0.7, 0.68), (0.04, 0.04, 0.04), (0.3, 0.3, 0.32)],
    }
    key = 'Skin' if slot in ('Skin', 'Face') else slot
    m_ = bpy.data.materials.new(f'Fan_{slot}'); m_.use_nodes = True
    nt_ = m_.node_tree; bs_ = nt_.nodes['Principled BSDF']
    bs_.inputs['Roughness'].default_value = 0.55 if key == 'Skin' else 0.85
    if key not in pal:
        bs_.inputs['Base Color'].default_value = (0.75, 0.72, 0.68, 1) if slot == 'EyeSclera' else (0.02, 0.015, 0.01, 1)
        return m_
    oi = nt_.nodes.new('ShaderNodeObjectInfo')
    mul = nt_.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = {'Jersey': 1.0, 'Skin': 7.31, 'Hair': 5.17, 'Shorts': 3.73, 'Shoe': 2.29}[key]
    fr = nt_.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'
    nt_.links.new(oi.outputs['Random'], mul.inputs[0]); nt_.links.new(mul.outputs[0], fr.inputs[0])
    ramp = nt_.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    cols = pal[key]; els = ramp.color_ramp.elements
    els[0].position = 0.0; els[0].color = (*cols[0], 1)
    els[1].position = 1.0 / len(cols); els[1].color = (*cols[1], 1)
    for k_, c_ in enumerate(cols[2:], start=2):
        e_ = els.new(k_ / len(cols)); e_.color = (*c_, 1)
    nt_.links.new(fr.outputs[0], ramp.inputs['Fac'])
    nt_.links.new(ramp.outputs['Color'], bs_.inputs['Base Color'])
    return m_


def audience_collections(path):
    """Import our CC0-derived seated fans (assets/hoops/casual-audience.glb), bake each
    pose into plain meshes, face +Y (toward the court), feet at z=0. Returns
    {(pose, lod): collection}, lod 'hi' near the floor and 'lo' further up."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    dg = bpy.context.evaluated_depsgraph_get()
    mats = {}
    out = {}
    groups = {}
    for o in new:
        if o.type != 'MESH': continue
        head, _, slot = o.name.partition('_')
        lod = 'lo' if head.startswith('SeatedLow') else 'hi'
        pose = head.replace('SeatedLow', '').replace('Seated', '')
        if not pose.isdigit(): continue
        me_ = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me_.transform(o.matrix_world)
        slot = slot.split('.')[0]
        if slot not in mats: mats[slot] = person_material(slot)
        me_.materials.clear(); me_.materials.append(mats[slot])
        groups.setdefault((int(pose), lod), []).append((slot, me_))
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for key, parts in groups.items():
        xs, ys, zs = [], [], []
        for _, me_ in parts:
            for v in me_.vertices: xs.append(v.co.x); ys.append(v.co.y); zs.append(v.co.z)
        shift = Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))
        turn = Matrix.Rotation(math.pi, 4, 'Z')          # source faces -Y; seats face +Y
        col = bpy.data.collections.new(f'Fan_{key[0]}_{key[1]}')
        for slot, me_ in parts:
            me_.transform(turn @ shift)
            for p_ in me_.polygons: p_.use_smooth = True
            ob_ = bpy.data.objects.new(f'Fan_{key[0]}_{key[1]}_{slot}', me_); col.objects.link(ob_)
        out[key] = col
        stats.setdefault('fan_height_ft', round(max(zs) - min(zs), 2))
    return out


seat_me = seat_proto()
seat_col = bpy.data.collections.new('SeatInstances'); COLL.children.link(seat_col)
fan_col = bpy.data.collections.new('FanInstances'); COLL.children.link(fan_col)
FANS = audience_collections(ASSETS['audience']) if ASSETS.get('audience') and os.path.exists(ASSETS['audience']) else {}
poses = sorted({k[0] for k in FANS})
for k, (M_, occupied, near) in enumerate(SEATS):
    so = bpy.data.objects.new(f'Seat{k}', seat_me); so.matrix_world = M_; seat_col.objects.link(so)
    if occupied and poses:
        lod = 'hi' if near else 'lo'
        key = (random.choice(poses), lod)
        if key not in FANS: key = (key[0], 'hi' if lod == 'lo' else 'lo')
        fo = bpy.data.objects.new(f'Fan{k}', None)
        fo.instance_type = 'COLLECTION'; fo.instance_collection = FANS[key]
        fo.matrix_world = M_ @ Matrix.Translation((random.uniform(-0.06, 0.06), 0.15, 0.02)) @ Matrix.Rotation(random.uniform(-0.18, 0.18), 4, 'Z')
        fan_col.objects.link(fo)
        stats['people'] += 1
new_obj('Bowl_Steps', step_bm, M['concrete'])
# LED ribbons show segmented ad panels (team blue, white logo band, gold), not one flat glow.
mr = bpy.data.materials.new('LedRibbonPanels'); mr.use_nodes = True
nr = mr.node_tree.nodes; lr = mr.node_tree.links; br = nr['Principled BSDF']; br.inputs['Base Color'].default_value = (0, 0, 0, 1)
br.inputs['Roughness'].default_value = 0.45
if ASSETS.get('led') and os.path.exists(ASSETS['led']):
    # Our own ad panels (tools/blender/make_led_ribbon.py), UV-mapped per stand by led_quad().
    tir = nr.new('ShaderNodeTexImage'); tir.image = image(ASSETS['led']); tir.extension = 'REPEAT'
    lr.new(tir.outputs['Color'], br.inputs['Emission Color'])
else:
    br.inputs['Emission Color'].default_value = (0.05, 0.16, 0.6, 1)
br.inputs['Emission Strength'].default_value = 2.0
# Scorer's table front is an LED board too (faces the court from x = 29.4).
led_quad((29.4, 59.5), (29.4, 34.5), (1, 0), 0.3, 2.8, 0.0)
new_obj('Bowl_LedRibbon', led_bm, mr)
new_obj('Bowl_Vomitories', portal_bm, M['black'])

# Suites ring between the bowls: dark glass, warm lit interiors, mullions every 12 ft.
suite_bm, mull_bm = bmesh.new(), bmesh.new()
SB = LOWER['rows'] * LOWER['depth'] + 4
SZ = LOWER['h0'] + LOWER['rows'] * LOWER['rise'] + 3.8   # band 28.2-32.6 ft: clear of the upper fascia LED
SV = [v + m * SB for v, m in zip(LV, LM)]      # lower-bowl polygon pushed out to the suites line
for i_ in range(len(SV)):
    A_, B_ = SV[i_], SV[(i_ + 1) % len(SV)]; L_ = (B_ - A_).length; U_ = (B_ - A_).normalized()
    Rz_ = Matrix.Rotation(-math.atan2(U_.y, U_.x), 4, 'Z')
    box(suite_bm, (0, 0, 0), (L_, 0.3, 4.4), Matrix.Translation(G(*((A_ + B_) / 2), SZ)) @ Rz_)
    k_ = 0.0
    while k_ <= L_:
        pm = A_ + U_ * k_
        box(mull_bm, (0, 0, 0), (0.35, 0.6, 4.9), Matrix.Translation(G(pm.x, pm.y, SZ)) @ Rz_)
        k_ += 12.0
# Suites read as glossy dark glass with warm rooms behind it: each 12 ft bay gets its own brightness
# (some dim, some bright) and the light falls off toward the bottom of the window.
ms_ = principled('SuiteGlow', (0.004, 0.005, 0.007), 0.06, emit=(1.0, 0.68, 0.38), emit_strength=1.0)
ns_, ls_ = ms_.node_tree.nodes, ms_.node_tree.links
tc_ = ns_.new('ShaderNodeTexCoord')
dv_ = ns_.new('ShaderNodeVectorMath'); dv_.operation = 'DIVIDE'; dv_.inputs[1].default_value = (12.0, 12.0, 100.0)
fl_ = ns_.new('ShaderNodeVectorMath'); fl_.operation = 'FLOOR'
wn_ = ns_.new('ShaderNodeTexWhiteNoise'); wn_.noise_dimensions = '3D'
mp_ = ns_.new('ShaderNodeMapRange'); mp_.inputs['To Min'].default_value = 0.08; mp_.inputs['To Max'].default_value = 1.4
sz_ = ns_.new('ShaderNodeSeparateXYZ')
gr_ = ns_.new('ShaderNodeMapRange'); gr_.inputs['From Min'].default_value = SZ - 2.2; gr_.inputs['From Max'].default_value = SZ + 2.2
gr_.inputs['To Min'].default_value = 0.35; gr_.inputs['To Max'].default_value = 1.0
mu_ = ns_.new('ShaderNodeMath'); mu_.operation = 'MULTIPLY'
ls_.new(tc_.outputs['Object'], dv_.inputs[0]); ls_.new(dv_.outputs[0], fl_.inputs[0]); ls_.new(fl_.outputs[0], wn_.inputs['Vector'])
ls_.new(wn_.outputs['Value'], mp_.inputs['Value']); ls_.new(tc_.outputs['Object'], sz_.inputs[0]); ls_.new(sz_.outputs['Z'], gr_.inputs['Value'])
ls_.new(mp_.outputs['Result'], mu_.inputs[0]); ls_.new(gr_.outputs['Result'], mu_.inputs[1])
ls_.new(mu_.outputs[0], ns_['Principled BSDF'].inputs['Emission Strength'])
new_obj('Suites_Glass', suite_bm, ms_)
new_obj('Suites_Mullions', mull_bm, M['black'])

# Courtside: scorer's table and LED boards along the far sideline, team benches.
bm = bmesh.new(); box(bm, G(31, 47, 1.5), (3, 26, 3)); new_obj('ScorersTable', bm, M['table'])
bm = bmesh.new()
for zc in list(range(14, 34, 2)) + list(range(62, 82, 2)):
    box(bm, G(32, zc, 0.9), (1.6, 1.6, 0.25)); box(bm, G(32.7, zc, 1.6), (0.2, 1.6, 1.4))
new_obj('Benches', bm, M['seat'])

# --------------------------------------------------------------------------- roof, scoreboard, lights
bm = bmesh.new(); box(bm, G(0, 47, 112), (420, 460, 1)); new_obj('Ceiling', bm, M['ceiling'])
bm = bmesh.new()


def member(bm_, p0, p1, t=0.55):
    d_ = p1 - p0; L_ = d_.length
    Rm_ = d_.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    box(bm_, (0, 0, 0), (t, t, L_), Matrix.Translation((p0 + p1) / 2) @ Rm_)


for xi in range(-140, 141, 28):                 # Warren trusses across the bowl
    top_, bot_ = 104, 95
    zs_ = list(range(-150, 245, 10))
    member(bm, G(xi, zs_[0], top_), G(xi, zs_[-1], top_), 0.9)
    member(bm, G(xi, zs_[0], bot_), G(xi, zs_[-1], bot_), 0.9)
    for k_ in range(len(zs_) - 1):
        za, zb = zs_[k_], zs_[k_ + 1]
        member(bm, G(xi, za, bot_), G(xi, zb, top_) if k_ % 2 == 0 else G(xi, zb, bot_), 0.45)
        if k_ % 2: member(bm, G(xi, za, top_), G(xi, zb, bot_), 0.45)
        member(bm, G(xi, za, bot_), G(xi, za, top_), 0.4)
for zi in range(-140, 241, 35):                 # purlins
    member(bm, G(-150, zi, 104.5), G(150, zi, 104.5), 0.5)
# Catwalk ring around the light banks.
for side in (-1, 1):
    member(bm, G(side * 30, -14, 76.6), G(side * 30, 108, 76.6), 0.3)
    member(bm, G(side * 32.5, -14, 76.6), G(side * 32.5, 108, 76.6), 0.3)
    member(bm, G(side * 30, -14, 79.6), G(side * 30, 108, 79.6), 0.15)
    for zc in range(-14, 109, 6):
        member(bm, G(side * 30, zc, 76.6), G(side * 32.5, zc, 76.6), 0.2)
        member(bm, G(side * 30, zc, 79.6), G(side * 30, zc, 95), 0.15)
new_obj('Roof_Truss', bm, M['steel'])
bm = bmesh.new(); box(bm, G(0, 47, 50), (24, 24, 15)); new_obj('Scoreboard', bm, M['black'])
bm = bmesh.new()
for (cx, cz, sx, sz) in [(0, 47 - 12.05, 22, 0.1), (0, 47 + 12.05, 22, 0.1), (-12.05, 47, 0.1, 22), (12.05, 47, 0.1, 22)]:
    box(bm, G(cx, cz, 51), (sx, sz, 11))
scr = new_obj('Scoreboard_Screens', bm, M['screen'])
if ASSETS.get('screen') and os.path.exists(ASSETS['screen']):
    # Real picture on the four faces: box-projected game frame, emissive.
    ms = bpy.data.materials.new('ScreenImage'); ms.use_nodes = True
    nn = ms.node_tree.nodes; ll = ms.node_tree.links
    bs = nn['Principled BSDF']; bs.inputs['Base Color'].default_value = (0, 0, 0, 1)
    tci = nn.new('ShaderNodeTexCoord'); mpi = nn.new('ShaderNodeMapping')
    mpi.inputs['Scale'].default_value = (1 / 22, 1 / 22, 1 / 11); mpi.inputs['Location'].default_value = (0.5, 0.5, 0.5)
    ti = nn.new('ShaderNodeTexImage'); ti.image = image(ASSETS['screen']); ti.projection = 'BOX'; ti.projection_blend = 0.0
    ll.new(tci.outputs['Object'], mpi.inputs['Vector']); ll.new(mpi.outputs['Vector'], ti.inputs['Vector'])
    ll.new(ti.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0
    scr.location = G(0, 47, 51); scr.data.transform(Matrix.Translation(-G(0, 47, 51)))
    scr.data.materials.clear(); scr.data.materials.append(ms)
bm = bmesh.new()
for (cx, cz, sx, sz) in [(0, 47 - 12.1, 24.2, 0.1), (0, 47 + 12.1, 24.2, 0.1), (-12.1, 47, 0.1, 24.2), (12.1, 47, 0.1, 24.2)]:
    box(bm, G(cx, cz, 43.2), (sx, sz, 0.7))
new_obj('Scoreboard_Ring', bm, M['led_gold'])

# Catwalk light banks: visible fixtures plus the area lights that really light the court.
lamp_bm = bmesh.new()
HOUSE_W = opt.get('house', 45000.0)   # watts per house light (--house)
LIGHTS = []
for side in (-1, 1):
    for zc in range(-4, 99, 13):
        LIGHTS.append(G(side * 30, zc, 78))
for xc in range(-18, 19, 12):
    LIGHTS.append(G(xc, -22, 80)); LIGHTS.append(G(xc, 116, 80))
lens_bm = bmesh.new()
for k, p in enumerate(LIGHTS):
    aim0 = G(0, 47, 0) + (p - G(0, 47, 0)) * 0.35; aim0.z = 0
    Rm = (aim0 - p).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.create_cone(lamp_bm, cap_ends=True, segments=28, radius1=1.15, radius2=1.45, depth=2.0,
                          matrix=Matrix.Translation(p) @ Rm @ Matrix.Translation((0, 0, -0.2)))
    bmesh.ops.create_cone(lamp_bm, cap_ends=True, segments=16, radius1=0.35, radius2=0.35, depth=1.6,
                          matrix=Matrix.Translation(p) @ Rm @ Matrix.Translation((0, 0, -1.6)))   # yoke stem
    bmesh.ops.create_circle(lens_bm, cap_ends=True, segments=28, radius=1.3,
                            matrix=Matrix.Translation(p) @ Rm @ Matrix.Translation((0, 0, 0.82)))
    ld = bpy.data.lights.new(f'CourtLight{k}', 'AREA')
    ld.shape = 'DISK'; ld.size = 2.6
    ld.energy = 17000   # a10: unblocked lamps washed the maple white
    ld.spread = math.radians(60)   # stage lighting: beams on the court, the bowl stays dark (ARENA_REFERENCE)
    ld.color = (1.0, 0.96, 0.9)
    lo = bpy.data.objects.new(f'CourtLight{k}', ld); COLL.objects.link(lo)
    lo.location = p + (aim0 - p).normalized() * 1.05     # just in front of the lens (a09: the housing blocked it)
    aim = G(0, 47, 0) + (p - G(0, 47, 0)) * 0.35
    aim.z = 0
    lo.rotation_euler = (aim - p).to_track_quat('-Z', 'Y').to_euler()
for ob_ in (new_obj('Lamp_Housings', lamp_bm, M['steel'], smooth=True), new_obj('Lamp_Lenses', lens_bm, M['lamp'])):
    ob_.visible_shadow = False
# House light on the stands: from the catwalk over centre court, aimed outward at
# each side of the bowl so the crowd reads without lighting the floor (a06: fills
# aimed at the court left the crowd 37x darker than the floor; target ~8x).
for tgt in (G(-75, 47, 28), G(75, 47, 28), G(0, -45, 28), G(0, 139, 28)):
    p = G(0, 47, 84) + (tgt - G(0, 47, 84)) * 0.25
    ld = bpy.data.lights.new('HouseLight', 'AREA'); ld.size = 12; ld.energy = HOUSE_W
    ld.spread = math.radians(70); ld.color = (0.85, 0.9, 1.0)
    lo = bpy.data.objects.new('HouseLight', ld); COLL.objects.link(lo); lo.location = p
    lo.rotation_euler = (tgt - p).to_track_quat('-Z', 'Y').to_euler()

# Each vomitory tunnel is lit from inside (warm), so the mouths read as passages, not black holes.
for (m2, mh, o2) in VOMS:
    ld = bpy.data.lights.new('TunnelLight', 'AREA'); ld.shape = 'RECTANGLE'; ld.size = 10; ld.size_y = 1.5
    ld.energy = 1500; ld.color = (1.0, 0.8, 0.6); ld.spread = math.radians(110)
    lo = bpy.data.objects.new('TunnelLight', ld); COLL.objects.link(lo); lo.location = G(m2.x, m2.y, mh)
    aim = G(m2.x - o2.x * 10, m2.y - o2.y * 10, 0.5)
    lo.rotation_euler = (aim - lo.location).to_track_quat('-Z', 'Y').to_euler()

# Bevel every hard-surface prop: square-cut boxes read as cheap CG (Owner 11-22).
NO_BEVEL = ('Floor', 'Ground', 'Ceiling', 'Text', 'Word', 'Logo', 'Net', 'Lamp_Lenses', 'Scoreboard_Screens')
for ob in list(COLL.all_objects):
    if ob.type != 'MESH' or ob.data.users > 1 or any(ob.name.startswith(t) for t in NO_BEVEL): continue
    md = ob.modifiers.new('Bevel', 'BEVEL'); md.width = 0.05; md.segments = 3; md.limit_method = 'ANGLE'
    md.harden_normals = True
    for p_ in ob.data.polygons: p_.use_smooth = True
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
    'courtside': camera('Cam_Courtside', G(-35, 44, 6.0), G(0, 9, 7.5), lens=30),
    'wide': camera('Cam_Wide', G(-62, -38, 62), G(0, 47, 0), lens=22),
    # Promo hero: high corner of the lower bowl, across the court to the far basket and the scoreboard.
    'hero': camera('Cam_Hero', G(-58, -22, 34), G(4, 62, 9), lens=20),
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
