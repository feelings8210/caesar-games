"""Fix the leg/shoe join on the arena athlete: legs back onto their bones, then a crew sock.

  blender-5.2.2 -b -P fix_athlete_feet.py -- <athlete.glb> <out.glb> <out_dir> [--no-align]

Why the legs "broke" at the ankle in every clip (game and Blender agree on this, checked by
skinning the same vertices in three.js): in the bind pose the leg bones run straight down at
x = +-0.402 ft, but the body mesh's legs splay outwards (A pose) - about 0.14 ft off at the knee
and 0.25 ft at the ankle - while the shoe sits on the foot bone. Each clip swung the lower leg
around a pivot outside it and away from the shoe.

1. Align: shift leg vertices of AnatomicalBody / BodyLOD / ShortsHigh / ShortsLOD sideways in the
   bind pose onto the bone line. The offset is a smooth fit (zero at the hip, largest at the
   ankle, averaged over both legs) times each vertex's leg weight, so hips and crotch blend.
2. Sock: the leg skin still ends in a ragged, slanted rim at the shoe collar, so one tube per
   leg (material "Sock", the game's default off-white slot, no code change) runs from inside the
   collar to above the rim. It is built around a real game pose (Idle) and inverse-skinned into
   bind space; its bottom follows the shoe, its top the shin, blended across the ankle.
3. Audit: every 3rd frame of every clip, how far leg skin pokes out through the sock.

Writes out.glb, out_dir/feet_fix.json and close-up renders (sock hidden "old" / shown "new",
both with aligned legs) plus whole-player views. The game keeps using assets/hoops/*.glb until
the Owner accepts it.
"""
import bpy, bmesh, sys, os, json, math, hashlib
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

SRC, OUT_GLB, OUT = sys.argv[sys.argv.index('--') + 1:][:3]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
body = bpy.data.objects['AnatomicalBody']
shoe = next(o for o in scene.objects if o.type == 'MESH' and any(m and m.name == 'Shoe' for m in o.data.materials))
# ---- Step 1: put the leg geometry back on its bones (bind pose). ----
# In the bind pose the leg bones run straight down (x = +-0.402 ft) but the body mesh's legs
# splay outwards (A pose): ~0.16 ft off at the knee and ~0.25 ft at the ankle, while the shoe
# sits on the foot bone. Every clip therefore swung the lower leg around a pivot outside it and
# pulled it away from the shoe. Shift leg vertices sideways, by height, onto the bone line,
# weighted by how much the vertex follows that leg (crotch and hips blend out naturally).
ALIGN = '--no-align' not in sys.argv
LEG_MESHES = ['AnatomicalBody', 'BodyLOD', 'ShortsHigh', 'ShortsLOD']
def leg_weight(o, v, side):
    names = {f'{b}_{side}' for b in ('thigh', 'calf', 'foot', 'ball', 'ball_leaf')}
    return sum(g.weight for g in v.groups if o.vertex_groups[g.group].name in names)
align_rep = {}
if ALIGN:
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    fits = {}
    for side, sgn in (('l', 1.0), ('r', -1.0)):
        bx = (arm.matrix_world @ arm.data.bones['calf_' + side].head_local).x
        hip_z = (arm.matrix_world @ arm.data.bones['thigh_' + side].head_local).z
        Mb = body.matrix_world
        pts = [(Mb @ v.co) for v in body.data.vertices if leg_weight(body, v, side) > 0.8]
        pts = [p for p in pts if p.x * sgn > 0]
        zs = [0.45 + 0.1 * i for i in range(int((hip_z - 0.45) / 0.1) + 1)]
        known = []
        for z in zs:
            sl = sorted(p.x for p in pts if abs(p.z - z) < 0.05)
            if len(sl) >= 6: known.append((z, sl[len(sl) // 2]))
        # Smooth offset: least squares d(z) = a*u + b*u^2, u = hip_z - z (zero at the hip), so
        # the leg moves as one column. Raw per-slab offsets put kinks in the calf (a8).
        U = [(hip_z - z, (bx - c) * sgn) for z, c in known]      # mirrored to the left side
        s11 = sum(u ** 2 for u, _ in U); s12 = sum(u ** 3 for u, _ in U); s22 = sum(u ** 4 for u, _ in U)
        t1 = sum(u * d for u, d in U); t2 = sum(u * u * d for u, d in U)
        det = s11 * s22 - s12 * s12
        fits[side] = dict(bx=bx, hip_z=hip_z, ca=(t1 * s22 - t2 * s12) / det, cb=(s11 * t2 - s12 * t1) / det,
                          u_max=hip_z - known[0][0], raw={f'{z:.1f}': round(bx - c, 3) for z, c in known})
    # The body is symmetric; average both sides so measurement noise does not make the legs differ.
    ca = (fits['l']['ca'] + fits['r']['ca']) / 2; cb = (fits['l']['cb'] + fits['r']['cb']) / 2
    for side, sgn in (('l', 1.0), ('r', -1.0)):
        f = fits[side]; hip_z = f['hip_z']; u_max = f['u_max']
        def delta(z):
            u = max(0.0, min(u_max, hip_z - z))
            return (ca * u + cb * u * u) * sgn
        align_rep[side] = {'fit_side': [round(f['ca'], 4), round(f['cb'], 4)], 'fit_used': [round(ca, 4), round(cb, 4)],
                           'raw': f['raw'], 'offset_at': {f'{z:.1f}': round(delta(z), 3) for z in (0.5, 1.0, 1.9, 2.5, 3.0)}}
        for name in LEG_MESHES:
            o = bpy.data.objects.get(name)
            if not o: continue
            M = o.matrix_world; Mi = M.inverted()
            for v in o.data.vertices:
                w = leg_weight(o, v, side)
                if w <= 0: continue
                p = M @ v.co
                p.x += delta(p.z) * min(1.0, w)
                v.co = Mi @ p
            o.data.update()
    rep_align = align_rep
    print('[feet] align', json.dumps(align_rep), flush=True)
    arm.data.pose_position = 'POSE'; bpy.context.view_layer.update()

acts = {a.name: a for a in bpy.data.actions}
def find_act(n):
    return acts.get(n) or next((a for k, a in acts.items() if k.startswith(n)), None)
if not arm.animation_data: arm.animation_data_create()
for tr in arm.animation_data.nla_tracks: tr.mute = True
def set_pose(name, q):
    """name=None -> armature rest. Returns the frame used."""
    for tr in arm.animation_data.nla_tracks: tr.mute = True
    if name is None:
        arm.animation_data.action = None
        for p in arm.pose.bones: p.matrix_basis.identity()
        scene.frame_set(0); bpy.context.view_layer.update(); return 0
    a = find_act(name); arm.animation_data.action = a
    if len(getattr(a, 'slots', [])): arm.animation_data.action_slot = a.slots[0]
    f0, f1 = a.frame_range; fr = int(f0 + (f1 - f0) * q)
    scene.frame_set(fr); bpy.context.view_layer.update(); return fr
# The body and the shoe were bound in different rest poses (in the armature rest they stand
# apart), but they agree once a clip drives the rig. So the sock is built around a real game
# pose and then inverse-skinned back into bind space.
BUILD = ('Idle', 0.0)
set_pose(*BUILD)
dg = bpy.context.evaluated_depsgraph_get()

def world(o):
    ev = o.evaluated_get(dg); me = ev.to_mesh()
    pts = [ev.matrix_world @ v.co for v in me.vertices]
    faces = [list(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return pts, faces

BP, BF = world(body); SP, SF = world(shoe)
bvh_b = BVHTree.FromPolygons(BP, BF); bvh_s = BVHTree.FromPolygons(SP, SF)
rep = {'source_sha256': hashlib.sha256(open(SRC, 'rb').read()).hexdigest(), 'build_pose': BUILD, 'sides': {}, 'leg_align': align_rep}

def boundary_loops(o, P):
    bm = bmesh.new(); bm.from_mesh(o.data)
    seen, out = set(), []
    for e in bm.edges:
        if not e.is_boundary or e.index in seen: continue
        stack, comp = [e], []
        while stack:
            x = stack.pop()
            if x.index in seen: continue
            seen.add(x.index); comp.append(x)
            for v in x.verts:
                for y in v.link_edges:
                    if y.is_boundary and y.index not in seen: stack.append(y)
        out.append(sorted({v.index for x in comp for v in x.verts}))
    bm.free()
    return out
body_loops = boundary_loops(body, BP)

NA, NZ = 32, 20
TUCK = False
OFF = 0.028          # ft (~8 mm) outside the leg skin; 4 mm let skin poke through in game (a5)
INSET = 0.012        # ft inside the shoe wall
socks = []
for side in ('l', 'r'):
    pb_c = arm.pose.bones['calf_' + side]
    knee = arm.matrix_world @ pb_c.head; ank = arm.matrix_world @ pb_c.tail
    up = (knee - ank).normalized()
    # local frame: h along the shin, (e1, e2) across it
    e1 = up.cross(Vector((0, 1, 0))).normalized(); e2 = up.cross(e1).normalized()
    h = lambda p: (p - ank).dot(up)
    foot_c = arm.matrix_world @ arm.pose.bones['foot_' + side].head
    near_leg = lambda p: (p - ank - up * h(p)).length < 0.6 and -0.4 < h(p) < 2.0
    loops = [l for l in body_loops if all(near_leg(BP[i]) for i in l[:6])]
    end = min(loops, key=lambda l: sum(h(BP[i]) for i in l) / len(l))
    he = [h(BP[i]) for i in end]; h_lo, h_hi = min(he), max(he)
    sp = [p for p in SP if (p - foot_c).length < 1.2]
    shoe_top = max(h(p) for p in sp)
    h_bot = shoe_top - 0.13
    h_top = h_hi + 0.16
    legp = [p for p in BP if near_leg(p) and h_lo - 0.05 < h(p) < h_top + 0.1]
    def ring_hits(bvh, c, hh, tol):
        out = []
        for j in range(NA):
            a = 2 * math.pi * j / NA
            d = e1 * math.cos(a) + e2 * math.sin(a)
            loc, nrm, idx, dist = bvh.ray_cast(c, d, 0.8)
            out.append(dist if loc is not None and (tol is None or abs(h(loc) - hh) < tol) else None)
        return out
    # Centre line: fit through leg cross-sections above the slanted end, extend straight down.
    samples = []
    for k in range(8):
        hh = h_hi + 0.03 + (h_top + 0.05 - h_hi) * k / 7
        s_ = [p for p in legp if abs(h(p) - hh) < 0.035]
        if len(s_) >= 8:
            c = sum(s_, Vector()) / len(s_); samples.append((hh, c - up * h(c)))
    hs = [x for x, _ in samples]; mh = sum(hs) / len(hs)
    mc = sum((c for _, c in samples), Vector()) / len(samples)
    var = sum((x - mh) ** 2 for x in hs) or 1
    slope = sum(((x - mh) * (c - mc) for x, c in samples), Vector()) / var
    axis = lambda hh: mc + slope * (hh - mh) + up * hh
    # Reference radii: the lowest complete leg ring.
    h_ref = h_hi + 0.04
    r_ref = ring_hits(bvh_b, axis(h_ref), h_ref, 0.08)
    vals = [x for x in r_ref if x]; mean = sum(vals) / len(vals)
    r_ref = [x if x and x > 0.5 * mean else mean for x in r_ref]
    r_ref = [max(r_ref[j - 1], r_ref[j], r_ref[(j + 1) % NA]) for j in range(NA)]   # leg is not round
    rings = []
    for k in range(NZ):
        hh = h_bot + (h_top - h_bot) * k / (NZ - 1)
        c = axis(hh)
        leg = ring_hits(bvh_b, c, hh, 0.06)
        taper = 1.0 if hh >= h_ref else 0.86 + 0.14 * max(0.0, (hh - h_bot) / (h_ref - h_bot))
        # Shoe wall around the axis, per sector, from shoe vertices near the collar height
        # (the shoe is a single-layer shell, so its vertices are the wall itself).
        hc = min(hh, shoe_top - 0.01)
        wall = [None] * NA
        for p in sp:
            if abs(h(p) - hc) > 0.045: continue
            q = p - axis(h(p)); q = q - up * q.dot(up)
            j = int(round(math.atan2(q.dot(e2), q.dot(e1)) / (2 * math.pi) * NA)) % NA
            for jj in (j - 1, j, (j + 1) % NA):
                jj %= NA
                if wall[jj] is None or q.length < wall[jj]: wall[jj] = q.length
        wv = [x for x in wall if x]; wm = sorted(wv)[len(wv) // 2] if wv else None
        wall = [x if x and wm and x > 0.6 * wm else wm for x in wall]
        # Shrinking the sock to fit inside the collar exposed skin (a4): the leg is wider than
        # the shoe collar. So the sock keeps the leg's width and its lower edge laps over the
        # collar by a few millimetres. TUCK=True restores the a4 behaviour for comparison.
        inside = max(0.0, min(1.0, (shoe_top + 0.07 - hh) / 0.09)) if TUCK else 0.0
        r = []
        for j in range(NA):
            x = r_ref[j] * taper + OFF
            if leg[j] is not None and hh > shoe_top: x = max(x, leg[j] + OFF)
            if wall[j] is not None and inside > 0:
                x = x * (1 - inside) + min(x, wall[j] - INSET) * inside
            r.append(x)
        rings.append({'h': hh, 'c': c, 'r': r, 'leg': hh > h_lo})
    for _ in range(3):
        rs = [list(g['r']) for g in rings]
        for i, g in enumerate(rings):
            a_, b_ = max(0, i - 1), min(NZ - 1, i + 1)
            g['r'] = [(rs[a_][j] + rs[i][j] * 2 + rs[b_][j] + rs[i][(j - 1) % NA] + rs[i][(j + 1) % NA]) / 6 for j in range(NA)]
    verts = []
    for g in rings:
        for j in range(NA):
            a = 2 * math.pi * j / NA
            verts.append(g['c'] + (e1 * math.cos(a) + e2 * math.sin(a)) * g['r'][j])
    faces = [(k * NA + j, (k + 1) * NA + j, (k + 1) * NA + (j + 1) % NA, k * NA + (j + 1) % NA)
             for k in range(NZ - 1) for j in range(NA)]
    # Faces must point outwards: the game draws front faces only (Blender draws both, which hid
    # an inverted tube in a2-a10 renders while the game showed no sock at all).
    out_dot = 0.0
    for f in faces[::7]:
        a_, b_, c_ = verts[f[0]], verts[f[1]], verts[f[2]]
        nrm = (b_ - a_).cross(c_ - a_)
        ctr = sum((verts[i] for i in f), Vector()) / 4
        k_ = f[0] // NA
        radial = ctr - rings[k_]['c']; radial -= up * radial.dot(up)
        out_dot += nrm.normalized().dot(radial.normalized())
    if out_dot < 0: faces = [tuple(reversed(f)) for f in faces]
    socks.append({'side': side, 'verts': verts, 'faces': faces, 'shoe_top': shoe_top, 'h': h, 'flipped': out_dot < 0})
    rep['sides'][side] = {'shoe_top_h': round(shoe_top, 3), 'leg_end_h': [round(h_lo, 3), round(h_hi, 3)],
                          'sock_h': [round(h_bot, 3), round(h_top, 3)], 'leg_rings': sum(1 for g in rings if g['leg']),
                          'faces_flipped_outward': out_dot < 0}

# Skin weights: nearest shoe surface inside the collar, nearest leg surface above, blended.
def weights_at(o, pts, faces, bvh, p):
    hit = bvh.find_nearest(p)
    poly = faces[hit[2]]
    near = sorted(poly, key=lambda i: (pts[i] - hit[0]).length)[:3]
    fr = [1 / max(1e-3, (pts[i] - hit[0]).length) for i in near]; tot = sum(fr)
    w = {}
    for i, f in zip(near, fr):
        for g in o.data.vertices[i].groups:
            n = o.vertex_groups[g.group].name
            w[n] = w.get(n, 0) + g.weight * f / tot
    return w
allv, allf, allw = [], [], []
for s in socks:
    base = len(allv)
    for p in s['verts']:
        # Bottom follows the shoe (foot), top follows the shin, long blend across the ankle so a
        # bent ankle stretches the sock instead of opening a gap. (Nearest-surface weights, a6,
        # left the lower sock on the shin and it split from the shoe when the ankle flexed.)
        t = max(0.0, min(1.0, (s['h'](p) - (s['shoe_top'] - 0.05)) / 0.25)); t = t * t * (3 - 2 * t)
        w = {}
        if t < 1:
            for n, x in weights_at(shoe, SP, SF, bvh_s, p).items(): w[n] = w.get(n, 0) + x * (1 - t)
        if t > 0:
            for n, x in weights_at(body, BP, BF, bvh_b, p).items(): w[n] = w.get(n, 0) + x * t
        top4 = sorted(w.items(), key=lambda kv: -kv[1])[:4]; tot = sum(x for _, x in top4) or 1
        allw.append({n: x / tot for n, x in top4})
    allv += s['verts']; allf += [tuple(i + base for i in f) for f in s['faces']]

# Inverse skinning: the Armature modifier maps bind co -> posed by
#   premat^-1 . sum_i w_i (pose_i . rest_i^-1) . premat, premat = arm_world^-1 . obj_world.
OW = shoe.matrix_world.copy(); premat = arm.matrix_world.inverted() @ OW
D = {pb.name: pb.matrix @ pb.bone.matrix_local.inverted() for pb in arm.pose.bones}
bind = []
for p, w in zip(allv, allw):
    M = Matrix(((0, 0, 0, 0),) * 4)
    for n, x in w.items(): M = M + D[n] * x
    co_posed = OW.inverted() @ p
    bind.append(premat.inverted() @ M.inverted() @ premat @ co_posed)
me = bpy.data.meshes.new('Sock'); me.from_pydata(bind, [], allf); me.update()
for poly in me.polygons: poly.use_smooth = True
sock = bpy.data.objects.new('Sock', me)
scene.collection.objects.link(sock)
sock.parent = shoe.parent; sock.parent_type = shoe.parent_type; sock.matrix_parent_inverse = shoe.matrix_parent_inverse.copy()
sock.matrix_world = OW
mat = bpy.data.materials.new('Sock'); mat.use_nodes = True
bs = mat.node_tree.nodes['Principled BSDF']
bs.inputs['Base Color'].default_value = (0.86, 0.85, 0.82, 1); bs.inputs['Roughness'].default_value = 0.85
me.materials.append(mat)
groups = {}
for vi, w in enumerate(allw):
    for n, x in w.items():
        if n not in groups: groups[n] = sock.vertex_groups.new(name=n)
        groups[n].add([vi], x, 'REPLACE')
am = sock.modifiers.new('Armature', 'ARMATURE'); am.object = arm
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
ev = sock.evaluated_get(dg); m2 = ev.to_mesh()
err = max((ev.matrix_world @ v.co - p).length for v, p in zip(m2.vertices, allv)); ev.to_mesh_clear()
rep['sock_vertices'] = len(allv); rep['sock_groups'] = sorted(groups); rep['rebuild_error_ft'] = round(err, 5)
print('[feet] built', json.dumps(rep), flush=True)

# ---- Audit: does leg skin poke out of the sock in any clip? (every 3rd frame) ----
import numpy as np
def coords(o):
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()); me = ev.to_mesh()
    a = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', a); ev.to_mesh_clear()
    a = a.reshape(-1, 3); M = np.array(ev.matrix_world)
    return a @ M[:3, :3].T + M[:3, 3]
nper = NA * NZ
audit = {}
for act in sorted(acts.values(), key=lambda a: a.name):
    arm.animation_data.action = act
    if len(getattr(act, 'slots', [])): arm.animation_data.action_slot = act.slots[0]
    f0, f1 = (int(x) for x in act.frame_range)
    worst, bad, nf = 0.0, 0, 0
    for fr in range(f0, f1 + 1, 3):
        scene.frame_set(fr); bpy.context.view_layer.update()
        B = coords(body); S = coords(sock); nf += 1; fw = 0.0
        for si in range(2):
            R = S[si * nper:(si + 1) * nper].reshape(NZ, NA, 3)
            C = R.mean(1)
            U = np.gradient(C, axis=0); U /= np.linalg.norm(U, axis=1, keepdims=True)
            near = B[np.linalg.norm(B - C[NZ // 2], axis=1) < 1.2]
            if not len(near): continue
            # nearest ring by axial distance
            d = np.einsum('nkd,kd->nk', near[:, None, :] - C[None], U)
            k = np.abs(d).argmin(1)
            ok = (k >= 1) & (k <= NZ - 3) & (np.abs(d[np.arange(len(k)), k]) < (1.0 / NZ) * 1.2)
            for kk in np.unique(k[ok]):
                pts = near[ok & (k == kk)]
                q = pts - C[kk]; q -= np.outer(q @ U[kk], U[kk])
                e1 = R[kk, 0] - C[kk]; e1 -= (e1 @ U[kk]) * U[kk]; e1 /= np.linalg.norm(e1); e2 = np.cross(U[kk], e1)
                ang = np.arctan2(q @ e2, q @ e1) % (2 * np.pi)
                j = np.round(ang / (2 * np.pi) * NA).astype(int) % NA
                rr = R[kk] - C[kk]; rr -= np.outer(rr @ U[kk], U[kk]); sr = np.linalg.norm(rr, axis=1)
                pen = np.linalg.norm(q, axis=1) - sr[j]
                pen = pen[pen < 0.12]     # further out than 3.7 cm is the other leg or the thigh, not this shin
                if len(pen): fw = max(fw, float(pen.max()))
        worst = max(worst, fw); bad += fw > 0.01
    audit[act.name] = {'frames': nf, 'worst_ft': round(worst, 4), 'frames_over_3mm': bad}
rep['skin_through_sock'] = audit
print('[feet] audit', json.dumps(audit), flush=True)

# Export: same exporter settings as tools/blender/build_arena_athlete.py.
arm.data.pose_position = 'POSE'
if arm.animation_data:
    arm.animation_data.action = None
    for tr in arm.animation_data.nla_tracks: tr.mute = False
scene.frame_set(0)
args = dict(filepath=OUT_GLB, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
            export_force_sampling=True, export_skins=True, export_yup=True)
props = bpy.ops.export_scene.gltf.get_rna_type().properties
bpy.ops.export_scene.gltf(**{k: v for k, v in args.items() if k in props})
rep['output_sha256'] = hashlib.sha256(open(OUT_GLB, 'rb').read()).hexdigest()
rep['nla_tracks'] = [t.name for t in arm.animation_data.nla_tracks] if arm.animation_data else []
json.dump(rep, open(os.path.join(OUT, 'feet_fix.json'), 'w'), indent=1)
print('[feet] export', json.dumps(rep), flush=True)

# ---- Close-up renders: same poses, sock hidden (before) and shown (after). ----
for o in scene.objects:
    if o.type == 'MESH' and ('LOD' in o.name or o.name in ('Base', 'Icosphere', 'HairFull')): o.hide_render = True
sk = bpy.data.materials.get('Skin')
if sk:
    b = sk.node_tree.nodes['Principled BSDF']; b.inputs['Metallic'].default_value = 0.0
    b.inputs['Base Color'].default_value = (0.42, 0.26, 0.17, 1); b.inputs['Roughness'].default_value = 0.6
for sm in [m for m in bpy.data.materials if m.name.startswith('Shoe') and m.use_nodes]:
    b = sm.node_tree.nodes.get('Principled BSDF')
    if not b: continue
    for l in list(b.inputs['Base Color'].links): sm.node_tree.links.remove(l)
    b.inputs['Metallic'].default_value = 0.0; b.inputs['Base Color'].default_value = (0.05, 0.07, 0.11, 1)
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.35, 0.35, 0.37, 1)
for loc, en in (((6, -8, 8), 2500), ((-6, -5, 4), 1200)):
    ld = bpy.data.lights.new('l', 'AREA'); ld.energy = en; ld.size = 6
    lo = bpy.data.objects.new('l', ld); lo.location = loc; scene.collection.objects.link(lo)
    lo.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'AgX'
scene.render.resolution_x, scene.render.resolution_y = 700, 800
cd = bpy.data.cameras.new('c'); cd.lens = 85
cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam
POSES = [('Idle', 0.5), ('Sprint', 0.3), ('Sprint', 0.6), ('DefSlideL', 0.3), ('Shot', 0.3), ('BoxOut', 0.5)]
shots = []
for name, q in POSES:
    if not find_act(name): continue
    set_pose(name, q)
    for side in ('l', 'r'):
        foot = arm.matrix_world @ arm.pose.bones['foot_' + side].head
        tgt = foot + Vector((0, 0, 0.25))
        for view, d in (('front', (0.35, -1, 0.15)), ('out', ((1 if side == 'l' else -1), -0.2, 0.1))):
            cam.location = tgt + Vector(d).normalized() * 3.4
            cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
            for tag, show in (('old', False), ('new', True)):
                sock.hide_render = not show
                fn = os.path.join(OUT, f'{name}{int(q * 100)}_{side}_{view}_{tag}.png')
                scene.render.filepath = fn; bpy.ops.render.render(write_still=True)
                shots.append(fn)
# Game-distance look: whole player, new version only.
cd.lens = 50
for name, q in POSES:
    if not find_act(name): continue
    set_pose(name, q); sock.hide_render = False
    pel = arm.matrix_world @ arm.pose.bones['pelvis'].head
    for view, d in (('a', (0.6, -1, 0.25)), ('b', (-0.8, -0.5, 0.2))):
        cam.location = pel + Vector(d).normalized() * 11
        cam.rotation_euler = (pel - cam.location).to_track_quat('-Z', 'Y').to_euler()
        fn = os.path.join(OUT, f'full_{name}{int(q * 100)}_{view}.png')
        scene.render.filepath = fn; bpy.ops.render.render(write_still=True); shots.append(fn)
print('[feet] renders', len(shots), flush=True)
