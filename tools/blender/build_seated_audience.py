"""Bake original seated poses from the approved fitted CC0 athlete.
Static, material-separated geometry for near audience instancing. No scan/mocap.
"""
import bpy, bmesh, sys, json, hashlib, math
from pathlib import Path
from mathutils import Vector, Matrix

source, out = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
rig.animation_data.action = None
for track in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(track)
for bone in rig.pose.bones: bone.matrix_basis.identity()
bpy.context.view_layer.update()
rest = {b.name: b.matrix.copy() for b in rig.pose.bones}
sources = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name in
           ['AnatomicalBody', 'AnatomicalHead', 'HairCrop', 'JerseyLOD', 'ShortsLOD', 'SuperHero_Male']]

def orient(name, head, direction):
    original = rest[name].to_3x3()
    rotation = (original @ Vector((0, 1, 0))).normalized().rotation_difference(direction.normalized())
    rig.pose.bones[name].matrix = Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ original.to_4x4()
    bpy.context.view_layer.update()

def limb(upper, lower, end, target, pole):
    a = rig.pose.bones[upper].head.copy()
    la = (rest[lower].translation - rest[upper].translation).length
    lb = (rest[end].translation - rest[lower].translation).length
    axis = (target-a).normalized(); dist = min((target-a).length, la+lb-.003)
    target = a + axis*dist
    bend = (pole-axis*pole.dot(axis)).normalized()
    along = (la*la-lb*lb+dist*dist)/(2*dist)
    elbow = a + axis*along + bend*math.sqrt(max(0, la*la-along*along))
    orient(upper, a, elbow-a); orient(lower, elbow, target-elbow)
    rig.pose.bones[end].matrix = Matrix.Translation(target) @ rest[end].to_3x3().to_4x4()
    bpy.context.view_layer.update()

created = []; counts = {}
for variant in range(3):
    for bone in rig.pose.bones: bone.matrix_basis.identity()
    rig.pose.bones['root'].location.z = -1.45
    bpy.context.view_layer.update()
    # Seat height 1.65 ft; shins nearly vertical, hands rest near the knees.
    for side, sign in [('r', -1), ('l', 1)]:
        limb('thigh_'+side, 'calf_'+side, 'foot_'+side,
             Vector((sign*(.43+variant*.05), -1.55-variant*.12, .48)), Vector((0,-1,0)))
        limb('upperarm_'+side, 'lowerarm_'+side, 'hand_'+side,
             Vector((sign*(.48+variant*.07), -1.20-variant*.14, 2.05+variant*.08)), Vector((sign,0,0)))
        hand=rig.pose.bones['hand_'+side]
        fingers=rest['middle_01_'+side].translation-rest['hand_'+side].translation
        rotate=fingers.normalized().rotation_difference(Vector((0,-.25,-1)).normalized())
        hand.matrix=Matrix.Translation(hand.head)@rotate.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4()
        bpy.context.view_layer.update()
    head = rig.pose.bones['Head']
    head.rotation_mode = 'QUATERNION'
    head.rotation_quaternion = Vector((0,0,1)).rotation_difference(Vector((.08*(variant-1),-.06,1)).normalized())
    bpy.context.view_layer.update()
    parts = {}
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in sources:
        evaluated = obj.evaluated_get(deps)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=deps)
        mesh.transform(obj.matrix_world)
        for material_index, material in enumerate(obj.data.materials):
            slot = material.name
            if obj.name=='AnatomicalHead' and slot=='Skin':slot='Face'
            piece = mesh.copy(); bm = bmesh.new(); bm.from_mesh(piece)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != material_index], context='FACES')
            bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts),dist=.00001)
            bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges),dist=.00001)
            bm.to_mesh(piece); bm.free()
            if not len(piece.polygons): bpy.data.meshes.remove(piece); continue
            part = bpy.data.objects.new(slot, piece); bpy.context.collection.objects.link(part)
            bpy.ops.object.select_all(action='DESELECT'); part.select_set(True); bpy.context.view_layer.objects.active=part
            dec = part.modifiers.new('AudienceLOD', 'DECIMATE')
            dec.ratio = .18 if slot=='Face' else .12 if slot == 'Skin' else .16 if slot == 'Jersey' else .24 if slot=='Shorts' else 1 if slot=='Shoe' else .2
            if slot.startswith('Eye'): dec.ratio=.06 if slot=='EyeSclera' else .2
            bpy.ops.object.modifier_apply(modifier=dec.name)
            for f in part.data.polygons: f.material_index=0; f.use_smooth=True
            part.data.materials.clear()
            parts.setdefault(slot, []).append(part)
        bpy.data.meshes.remove(mesh)
    for slot, objects in parts.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        obj=objects[0]; obj.name=f'Seated{variant}_{slot}'
        mat=bpy.data.materials.new(slot); mat.diffuse_color=(.65,.65,.65,1)
        obj.data.materials.clear(); obj.data.materials.append(mat)
        created.append(obj); counts[obj.name]=len(obj.data.polygons)
        low=obj.copy(); low.data=obj.data.copy(); low.name=f'SeatedLow{variant}_{slot}'
        bpy.context.collection.objects.link(low)
        bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active=low
        dec=low.modifiers.new('MobileAudienceLOD','DECIMATE'); dec.ratio=.8 if slot=='Shoe' else .58 if slot=='Face' else .3
        bpy.ops.object.modifier_apply(modifier=dec.name)
        created.append(low); counts[low.name]=len(low.data.polygons)
for obj in list(bpy.context.scene.objects):
    if obj not in created: bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=False)
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),
         'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),
         'builder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
         'polygons':counts,'license':'CC0-1.0','quality':'UNVERIFIED',
         'motion':'Original static seated poses, no external motion data'}
Path(out+'.json').write_text(json.dumps(receipt,indent=2)); print(json.dumps(receipt))
