"""Build the local arena athlete from the existing rig + canonical CC0 head.
CPU only. Run Blender with --disable-autoexec. Canonical source is never edited.
Usage: blender -b --factory-startup --python build_arena_athlete.py -- ORIGINAL SOURCE OUTPUT
"""
import bpy,bmesh,sys,json,math,hashlib
from pathlib import Path
from mathutils import Vector
original,source,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=original)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks: track.mute=True
for p in rig.pose.bones: p.matrix_basis.identity()
bpy.context.view_layer.update()
# Round the existing sports kit without introducing an external clothing asset.
for garment in list(bpy.context.scene.objects):
 if garment.type!='MESH' or not any(m.name in ('Jersey','Shorts') for m in garment.data.materials):continue
 slot=next(m.name for m in garment.data.materials if m.name in ('Jersey','Shorts'))
 low=garment.copy();low.data=garment.data.copy();low.name=slot+'LOD';bpy.context.collection.objects.link(low);garment.name=slot+'High'
 bpy.ops.object.select_all(action='DESELECT');garment.select_set(True);bpy.context.view_layer.objects.active=garment
 sub=garment.modifiers.new('KitSilhouette','SUBSURF');sub.levels=1
 bpy.ops.object.modifier_move_up(modifier=sub.name)
 bpy.ops.object.modifier_apply(modifier=sub.name)
 for polygon in garment.data.polygons:polygon.use_smooth=True
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.name=='Skin' for m in o.data.materials))
bm=bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>5.57],context='VERTS')
bm.to_mesh(body.data); bm.free()
with bpy.data.libraries.load(source,link=False) as (a,b): b.objects=['GEO-body_male_realistic']
head=b.objects[0]; body_origin=head.location.copy(); bpy.context.collection.objects.link(head)
for modifier in list(head.modifiers): head.modifiers.remove(modifier)
head.location=(0,0,0); head.rotation_euler=(0,0,0)
bm=bmesh.new(); bm.from_mesh(head.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<1.435],context='VERTS')
for v in bm.verts: v.co=Vector((v.co.x*3.8,v.co.y*3.8+0.08,(v.co.z-1.435)*3.8+5.52))
bm.to_mesh(head.data); bm.free(); head.name='AnatomicalHead'
head.data.materials.clear(); head.data.materials.append(bpy.data.materials['Skin'])
head.vertex_groups.clear(); group=head.vertex_groups.new(name='Head'); group.add(list(range(len(head.data.vertices))),1,'REPLACE')
head.parent=rig; modifier=head.modifiers.new('Armature','ARMATURE'); modifier.object=rig
for p in head.data.polygons: p.use_smooth=True
# Canonical paired eyes from the same anatomical body, with original iris and
# pupil material regions authored on the forward sphere surface.
with bpy.data.libraries.load(source,link=False) as (a,b):b.objects=['GEO-body_male_realistic.eye.R','GEO-body_male_realistic.eye.L']
eye_materials=[]
for name,color,roughness in [('EyeSclera',(.82,.79,.74,1),.32),('EyeIris',(.105,.063,.028,1),.42),('EyePupil',(.003,.003,.004,1),.3)]:
 material=bpy.data.materials.new(name);material.diffuse_color=color;material.use_nodes=True
 principled=material.node_tree.nodes.get('Principled BSDF');principled.inputs['Base Color'].default_value=color;principled.inputs['Roughness'].default_value=roughness
 eye_materials.append(material)
eyes=[]
for eye in b.objects:
 bpy.context.collection.objects.link(eye);bpy.context.view_layer.update()
 matrix=eye.matrix_world.copy();centre=matrix.translation.copy();radius=.012
 for vertex in eye.data.vertices:
  point=matrix @ vertex.co;point-=body_origin
  vertex.co=Vector((point.x*3.8,point.y*3.8+.08,(point.z-1.435)*3.8+5.52))
 eye.parent=None;eye.matrix_world.identity();eye.data.materials.clear()
 for material in eye_materials:eye.data.materials.append(material)
 cy=(centre.y-body_origin.y)*3.8+.08
 for polygon in eye.data.polygons:
  y=sum(eye.data.vertices[i].co.y for i in polygon.vertices)/len(polygon.vertices)
  front=-(y-cy)/(radius*3.8);polygon.material_index=2 if front>.965 else 1 if front>.83 else 0;polygon.use_smooth=True
 eye.vertex_groups.clear();group=eye.vertex_groups.new(name='Head');group.add(list(range(len(eye.data.vertices))),1,'REPLACE');eyes.append(eye)
bpy.ops.object.select_all(action='DESELECT');head.select_set(True)
for eye in eyes:eye.select_set(True)
bpy.context.view_layer.objects.active=head;bpy.ops.object.join()

# Scalp follows anatomical topology, rather than a floating sphere over the head.
hair=head.copy(); hair.data=head.data.copy(); hair.name='HairCrop'; bpy.context.collection.objects.link(hair)
bm=bmesh.new(); bm.from_mesh(hair.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<6.12 or (v.co.y<-.18 and v.co.z<6.26)],context='VERTS')
for v in bm.verts:
 v.co.x*=1.025; v.co.y=(v.co.y-.02)*1.025+.02; v.co.z+=.025
bm.to_mesh(hair.data); bm.free()
mat=bpy.data.materials.new('Hair'); mat.diffuse_color=(.025,.021,.018,1);mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.93
hair.data.materials.clear();hair.data.materials.append(mat)
# Slightly fuller textured crop as a second topology variant.
hair2=hair.copy();hair2.data=hair.data.copy(); hair2.name='HairFull';bpy.context.collection.objects.link(hair2)
for v in hair2.data.vertices:
 v.co.x*=1.08; v.co.y*=1.08; v.co.z=6.1+(v.co.z-6.1)*1.2
 v.co+=v.normal*(.012*math.sin(v.index*13.17))
# Fit the rig into anatomical A rest space, rather than rotate skin
# vertices piecemeal; re-bake source world bone poses into the new bind space.
from mathutils import Matrix
oldrig=rig; clips=[(track.name,track.strips[0].action) for track in oldrig.animation_data.nla_tracks if track.strips]
newrig=oldrig.copy();newrig.data=oldrig.data.copy();newrig.name='ArenaRig';newrig.animation_data_clear();bpy.context.collection.objects.link(newrig)
bpy.ops.object.select_all(action='DESELECT');newrig.select_set(True);bpy.context.view_layer.objects.active=newrig;bpy.ops.object.mode_set(mode='EDIT')
for side in ['l','r']:
 pivot=newrig.data.edit_bones['upperarm_'+side].head.copy();angle=math.radians(57 if side=='l' else -57)
 transform=Matrix.Translation(pivot) @ Matrix.Rotation(angle,4,'Y') @ Matrix.Translation(-pivot)
 for bone in newrig.data.edit_bones:
  if bone.name.endswith('_'+side) and bone.name.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky')):
   bone.matrix=transform @ bone.matrix
bpy.ops.object.mode_set(mode='OBJECT')
transforms={b.name:newrig.data.bones[b.name].matrix_local @ b.matrix_local.inverted() for b in oldrig.data.bones}
for o in list(bpy.context.scene.objects):
 if o==newrig or o==oldrig:continue
 if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==oldrig for m in o.modifiers):
  for vertex in o.data.vertices:
   items=[(o.vertex_groups[g.group].name,g.weight) for g in vertex.groups if o.vertex_groups[g.group].name in transforms]
   total=sum(w for _,w in items)
   if total:
    point=Vector((0,0,0))
    for name,weight in items:point+=(transforms[name] @ vertex.co)*(weight/total)
    vertex.co=point
  for modifier in o.modifiers:
   if modifier.type=='ARMATURE' and modifier.object==oldrig:modifier.object=newrig
 if o.parent==oldrig:o.parent=newrig
with bpy.data.libraries.load(source,link=False) as (a,b):b.objects=['GEO-body_male_realistic']
skin=b.objects[0];bpy.context.collection.objects.link(skin);skin.location=(0,0,0);skin.rotation_euler=(0,0,0);skin.name='AnatomicalBody'
for modifier in list(skin.modifiers):skin.modifiers.remove(modifier)
bm=bmesh.new();bm.from_mesh(skin.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z>1.435 or v.co.z<.105],context='VERTS')
for v in bm.verts:
 v.co=Vector((v.co.x*3.8,v.co.y*3.8+.08,v.co.z*3.8+.06))
 if 2.3<v.co.z<5.05 and abs(v.co.x)<.7:v.co.x*=.9;v.co.y=.08+(v.co.y-.08)*.88
bm.to_mesh(skin.data);bm.free();skin.data.materials.clear();skin.data.materials.append(bpy.data.materials['Skin']);skin.vertex_groups.clear()
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);newrig.select_set(True);bpy.context.view_layer.objects.active=newrig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unbound=sum(1 for v in skin.data.vertices if not v.groups)
assert unbound==0, f'Native skin has {unbound} unbound vertices'
print('UNBOUND',unbound,'TOTAL',len(skin.data.vertices))
# Standard avatar optimization: skin fully covered by kit is not rendered.
# Use arm weights as protection, so A-rest arms crossing torso height survive.
arm_groups={g.index for g in skin.vertex_groups if g.name.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky','clavicle'))}
protected={v.index:sum(g.weight for g in v.groups if g.group in arm_groups)>.18 for v in skin.data.vertices}
bm=bmesh.new();bm.from_mesh(skin.data);bm.verts.ensure_lookup_table()
covered=[face for face in bm.faces if all(2.13<vertex.co.z<5.12 and not protected.get(vertex.index,True) for vertex in face.verts)]
bmesh.ops.delete(bm,geom=covered,context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(skin.data);bm.free()

for polygon in skin.data.polygons:polygon.use_smooth=True
bm=bmesh.new();bm.from_mesh(body.data);shoe_index=next(i for i,m in enumerate(body.data.materials) if m.name=='Shoe')
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=shoe_index],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
oldrig.animation_data.use_nla=False
newrig.animation_data_create()
for name,oldaction in clips:
 oldrig.animation_data.action=oldaction;oldrig.animation_data.action_slot=oldaction.slots[0]
 action=bpy.data.actions.new(name+'_Arena');action.slots.new('OBJECT',newrig.name);newrig.animation_data.action=action;newrig.animation_data.action_slot=action.slots[0]
 first,last=[int(round(x)) for x in oldaction.frame_range]
 for frame in range(first,last+1):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  desired={bone.name:bone.matrix.copy() for bone in oldrig.pose.bones}
  for bone in newrig.pose.bones:
   rest=bone.bone.matrix_local
   bone.matrix_basis=rest.inverted() @ (bone.parent.bone.matrix_local @ desired[bone.parent.name].inverted() if bone.parent else Matrix.Identity(4)) @ desired[bone.name]
   bone.rotation_mode='QUATERNION'
   bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('scale',frame=frame)
 newrig.animation_data.action=None
 track=newrig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,first,action);track.mute=True
oldrig.animation_data.action=None
# Export new rig only, with an identical semantic clip interface.
bpy.data.objects.remove(oldrig,do_unlink=True);rig=newrig

for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.view_layer.update()
# Mobile tier keeps the same rig and silhouette, with fewer head/hair triangles.
for source_object,name,ratio in [(skin,'BodyLOD',.5),(head,'HeadLOD',.3),(hair,'HairCropLOD',.4),(hair2,'HairFullLOD',.4)]:
 low=source_object.copy();low.data=source_object.data.copy();low.name=name;bpy.context.collection.objects.link(low)
 bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low
 modifier=low.modifiers.new('MobileDecimate','DECIMATE');modifier.ratio=ratio
 while list(low.modifiers).index(modifier)>0:bpy.ops.object.modifier_move_up(modifier=modifier.name)
 bpy.ops.object.modifier_apply(modifier=modifier.name)
# Restore every imported action and NLA track for the exporter.
for track in rig.animation_data.nla_tracks: track.mute=False
bpy.context.scene.frame_set(0)
args=dict(filepath=out,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_skins=True,export_yup=True)
props=bpy.ops.export_scene.gltf.get_rna_type().properties
args={k:v for k,v in args.items() if k in props}
bpy.ops.export_scene.gltf(**args)
receipt=dict(source_sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(),original_sha256=hashlib.sha256(Path(original).read_bytes()).hexdigest(),output_sha256=hashlib.sha256(Path(out).read_bytes()).hexdigest(),head_vertices=len(head.data.vertices),body_vertices=len(skin.data.vertices),rest_pose='anatomical A pose',animation_transfer='baked world bone matrices',output_bytes=Path(out).stat().st_size,license='CC0-1.0',source_asset_id='blender-human-base-meshes:3c121505651140ce',quality='UNVERIFIED',build_script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
