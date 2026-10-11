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
 mesh=bmesh.new();mesh.from_mesh(garment.data)
 bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=.00001);mesh.to_mesh(garment.data);mesh.free()
 for polygon in garment.data.polygons:polygon.use_smooth=True
 slot=next(m.name for m in garment.data.materials if m.name in ('Jersey','Shorts'))
 if slot=='Jersey':
  cutters=[((0,.08,5.52),(.35,.35,1),0)]
  for side in [-1,1]:cutters.append(((side*.72,.08,4.8),(.32,.55,1),math.pi/2))
  for location,scale,angle in cutters:
   bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1,depth=.9 if angle==0 else 2,location=location)
   cutter=bpy.context.object;cutter.scale=scale;cutter.rotation_euler.x=angle
   bpy.context.view_layer.objects.active=garment
   cut=garment.modifiers.new('CleanKitOpening','BOOLEAN');cut.operation='DIFFERENCE';cut.solver='EXACT';cut.object=cutter
   bpy.ops.object.modifier_apply(modifier=cut.name);bpy.data.objects.remove(cutter,do_unlink=True)
  spine=garment.vertex_groups.get('spine_03') or garment.vertex_groups.new(name='spine_03')
  removed={g.index:g for g in garment.vertex_groups if g.name in ['Head','neck_01']}
  for vertex in garment.data.vertices:
   weight=sum(g.weight for g in vertex.groups if g.group in removed)
   for index,group in removed.items():
    if any(g.group==index for g in vertex.groups):group.remove([vertex.index])
   if weight:spine.add([vertex.index],weight,'ADD')
   if not vertex.groups:spine.add([vertex.index],1,'REPLACE')

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
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,1.435),plane_no=(0,0,-1),clear_outer=True)
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
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,6.163),plane_no=(0,-.215,-1),clear_outer=True)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,6.12),plane_no=(0,0,-1),clear_outer=True)
for v in bm.verts:
 v.co.x*=1.025; v.co.y=(v.co.y-.02)*1.025+.02; v.co.z+=.025
bm.to_mesh(hair.data); bm.free()
mat=bpy.data.materials.new('Hair'); mat.diffuse_color=(.025,.021,.018,1);mat.use_nodes=True
mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.93
hair.data.materials.clear();hair.data.materials.append(mat)
brow_parts=[]
for side in [-1,1]:
 brows=head.copy();brows.data=head.data.copy();brows.name='Brows';bpy.context.collection.objects.link(brows)
 bm=bmesh.new();bm.from_mesh(brows.data)
 planes=[((side*.055,0,0),(-side,0,0)),((side*.2,0,0),(side,0,0)),((0,-.2,0),(0,1,0)),((0,0,6.137),(side*.15,0,1)),((0,0,6.109),(-side*.15,0,-1))]
 for point,normal in planes:bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=point,plane_no=normal,clear_outer=True)
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
 bm.normal_update()
 for vertex in bm.verts:vertex.co+=vertex.normal*.006
 bm.to_mesh(brows.data);bm.free();brows.data.materials.clear();brows.data.materials.append(mat);brow_parts.append(brows)
bpy.ops.object.select_all(action='DESELECT');head.select_set(True)
for brows in brow_parts:brows.select_set(True)
bpy.context.view_layer.objects.active=head;bpy.ops.object.join()
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
# Hand landmarks measured on the canonical anatomical mesh, in court feet.
# The old hand/finger chains sat outside the mesh and received zero weights.
for side,sign in [('l',1),('r',-1)]:
 def point(x,y,z):return Vector((sign*x,y,z))
 elbow=point(1.18,.04,4.36);wrist=point(1.42,-.14,3.48)
 newrig.data.edit_bones['upperarm_'+side].tail=elbow
 forearm=newrig.data.edit_bones['lowerarm_'+side];forearm.head=elbow;forearm.tail=wrist
 hand=newrig.data.edit_bones['hand_'+side];hand.head=wrist;hand.tail=point(1.48,-.22,3.28)
 fingers={
 'index':[(1.50,-.445,3.15),(1.57,-.485,3.005),(1.61,-.51,2.85),(1.635,-.52,2.73)],
 'middle':[(1.54,-.33,3.12),(1.595,-.34,2.925),(1.63,-.355,2.73),(1.65,-.36,2.62)],
 'ring':[(1.55,-.225,3.12),(1.60,-.235,2.95),(1.63,-.245,2.79),(1.645,-.25,2.68)],
 'pinky':[(1.55,-.135,3.20),(1.605,-.145,3.06),(1.63,-.155,2.91),(1.64,-.16,2.82)],
 'thumb':[(1.37,-.255,3.30),(1.385,-.385,3.20),(1.405,-.48,3.13),(1.435,-.565,3.09)]}
 for name,landmarks in fingers.items():
  points=[point(*v) for v in landmarks]
  for n in range(1,5):
   bone=newrig.data.edit_bones[f'{name}_0{n}'+('_leaf' if n==4 else '')+'_'+side]
   bone.head=points[n-1];bone.tail=points[n] if n<4 else points[-1]+(points[-1]-points[-2]).normalized()*.045
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
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,1.46),plane_no=(0,0,1),clear_outer=True)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<.105],context='VERTS')
for v in bm.verts:
 v.co=Vector((v.co.x*3.8,v.co.y*3.8+.08,v.co.z*3.8+.06))
 if v.co.z>5.35:
  t=min(1,(v.co.z-5.35)/.25);v.co.x*=1-.08*t;v.co.y=.08+(v.co.y-.08)*(1-.08*t)
 if 2.3<v.co.z<5.05 and abs(v.co.x)<.7:v.co.x*=.9;v.co.y=.08+(v.co.y-.08)*.88
bm.to_mesh(skin.data);bm.free();skin.data.materials.clear();skin.data.materials.append(bpy.data.materials['Skin']);skin.vertex_groups.clear()
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);newrig.select_set(True);bpy.context.view_layer.objects.active=newrig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unbound=sum(1 for v in skin.data.vertices if not v.groups)
assert unbound==0, f'Native skin has {unbound} unbound vertices'
print('UNBOUND',unbound,'TOTAL',len(skin.data.vertices))
for name in ['hand_'+side for side in ['l','r']]+[f'{finger}_01_{side}' for side in ['l','r'] for finger in ['index','middle','ring','pinky','thumb']]:
 group=skin.vertex_groups[name];count=sum(any(g.group==group.index and g.weight>.05 for g in v.groups) for v in skin.data.vertices);print('HAND_BIND',name,count);assert count>3,f'{name} has no effective skin weights'
cloth_surface=skin.data.copy()
# Standard avatar optimization: skin fully covered by kit is not rendered.
# Use arm weights as protection, so A-rest arms crossing torso height survive.
arm_groups={g.index for g in skin.vertex_groups if g.name.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky','clavicle'))}
protected={v.index:sum(g.weight for g in v.groups if g.group in arm_groups)>.18 for v in skin.data.vertices}
bm=bmesh.new();bm.from_mesh(skin.data);bm.verts.ensure_lookup_table()
covered=[face for face in bm.faces if all(2.13<vertex.co.z<5.0 and not protected.get(vertex.index,True) for vertex in face.verts)]
bmesh.ops.delete(bm,geom=covered,context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(skin.data);bm.free()

for polygon in skin.data.polygons:polygon.use_smooth=True
bm=bmesh.new();bm.from_mesh(body.data);shoe_index=next(i for i,m in enumerate(body.data.materials) if m.name=='Shoe')
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=shoe_index],context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
# An authored sleeveless jersey has three openings and a predictable quad grid.
# Do not Boolean-subtract closed cutters from an open clipped torso: those
# operations created external cutter faces in the rejected v1-v3 candidates.
for name in ['JerseyHigh','JerseyLOD']:
 obj=bpy.data.objects.get(name)
 if obj:bpy.data.objects.remove(obj,do_unlink=True)
from mathutils.bvhtree import BVHTree
surface_points=[v.co.copy() for v in cloth_surface.vertices]
surface_faces=[list(p.vertices) for p in cloth_surface.polygons]
surface=BVHTree.FromPolygons(surface_points,surface_faces)
# Keep only the neck below the face, and match its weights to the adjoining
# canonical body. A head-only lower neck formed a flap in the side close view.
head.vertex_groups.clear()
head_groups={g.index:head.vertex_groups.new(name=g.name) for g in skin.vertex_groups}
head_index=skin.vertex_groups['Head'].index
for vertex in head.data.vertices:
 blend=max(0,min(1,(5.80-vertex.co.z)/.19))
 weights={head_index:1-blend}
 if blend>0:
  hit=surface.find_nearest(vertex.co)
  polygon=cloth_surface.polygons[hit[2]]
  nearby=sorted(polygon.vertices,key=lambda i:(surface_points[i]-hit[0]).length)[:3]
  fractions=[1/max(.001,(surface_points[i]-hit[0]).length) for i in nearby];total=sum(fractions)
  for index,fraction in zip(nearby,fractions):
   for group in cloth_surface.vertices[index].groups:weights[group.group]=weights.get(group.group,0)+group.weight*fraction/total*blend
 strongest=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for _,w in strongest)
 for group,weight in strongest:
  if weight>0:head_groups[group].add([vertex.index],weight/total,'REPLACE')

verts=[];faces=[];cols=40;rows=18
for back in [False,True]:
 for j in range(rows+1):
  v=j/rows
  for i in range(cols+1):
   u=2*i/cols-1;t=abs(u)
   if t<=.45:
    h=(5.32 if back else 5.07)+(5.42-(5.32 if back else 5.07))*(t/.45)**2
   elif t<=.85:h=5.44-.25*(t-.65)**2
   else:
    q=(t-.85)/.15;h=5.43-(5.43-4.60)*(q*q*(3-2*q))
   z=3.30+v*(h-3.30)
   width=.60+.10*min(1,max(0,(z-3.30)/1.4))
   x=u*width
   torso_depth=(.38 if back else .51)+.035*math.sin(v*math.pi)
   top_depth=.25 if back else .33
   q=max(0,(v-.75)/.25);depth=torso_depth*(1-q)+top_depth*q
   y=.08+(1 if back else -1)*math.sqrt(max(0,1-u*u))*depth
   # Fit the cloth outside the actual anatomical surface, not an assumed ellipse.
   hit=surface.ray_cast(Vector((x,2 if back else -2,z)),Vector((0,-1 if back else 1,0)))
   if hit[0] is not None:
    y=hit[0].y+(.075 if back else -.075)*math.sqrt(max(0,1-u*u))
   verts.append((x,y,z))
 offset=int(back)*(rows+1)*(cols+1)
 for j in range(rows):
  for i in range(cols):
   k=offset+j*(cols+1)+i;quad=(k,k+1,k+cols+2,k+cols+1)
   faces.append(tuple(reversed(quad)) if back else quad)
# Bridge the front/back shoulder panels, leaving a neckline and two armholes.
for i in range(cols):
 u0=abs(2*i/cols-1);u1=abs(2*(i+1)/cols-1)
 if min(u0,u1)>=.45-1e-6 and max(u0,u1)<=.85+1e-6:
  f=rows*(cols+1)+i;b=(rows+1)*(cols+1)+f
  faces.append((f+1,f,b,b+1))
mesh=bpy.data.meshes.new('BasketballJerseyMesh');mesh.from_pydata(verts,[],faces);mesh.update()
jersey=bpy.data.objects.new('JerseyHigh',mesh);bpy.context.collection.objects.link(jersey)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
assert not any(len(e.link_faces)>2 for e in bm.edges),'Nonmanifold cloth junction'
boundaries=[e for e in bm.edges if len(e.link_faces)==1];remaining=set(boundaries);openings=0
while remaining:
 openings+=1;stack=[remaining.pop()]
 while stack:
  edge=stack.pop()
  for vertex in edge.verts:
   for adjacent in vertex.link_edges:
    if adjacent in remaining:remaining.remove(adjacent);stack.append(adjacent)
assert openings==4,f'Expected neck, two armholes and hem, got {openings}'
assert max(abs(v.co.x) for v in bm.verts)<.75,'Cloth extends past torso'
print('JERSEY_BOUNDARY_CYCLES',openings,'VERTICES',len(bm.verts))
bm.to_mesh(mesh);bm.free();jersey.data.materials.append(bpy.data.materials['Jersey'])
uv=mesh.uv_layers.new(name='KitSurface')
for polygon in mesh.polygons:
 for loop_index in polygon.loop_indices:
  point=mesh.vertices[mesh.loops[loop_index].vertex_index].co
  uv.data[loop_index].uv=(.5+point.x/1.4,(point.z-3.3)/2.2)

# Transfer local surface weights from the matching body, including clavicles.
groups={g.index:jersey.vertex_groups.new(name=g.name) for g in skin.vertex_groups}
for vertex in mesh.vertices:
 nearest=surface.find_nearest(vertex.co)
 polygon=cloth_surface.polygons[nearest[2]]
 candidates=sorted(polygon.vertices,key=lambda i:(cloth_surface.vertices[i].co-nearest[0]).length)[:3]
 fractions=[1/max(.001,(cloth_surface.vertices[i].co-nearest[0]).length) for i in candidates]
 weights={}
 for index,fraction in zip(candidates,fractions):
  for group in cloth_surface.vertices[index].groups:weights[group.group]=weights.get(group.group,0)+group.weight*fraction
 strongest=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for _,w in strongest)
 assert total>0,'Unbound cloth vertex'
 for group,weight in strongest:groups[group].add([vertex.index],weight/total,'REPLACE')
jersey.parent=newrig;modifier=jersey.modifiers.new('Armature','ARMATURE');modifier.object=newrig
for polygon in mesh.polygons:polygon.material_index=0;polygon.use_smooth=True
low=jersey.copy();low.data=mesh.copy();low.name='JerseyLOD';bpy.context.collection.objects.link(low)
bpy.ops.object.select_all(action='DESELECT');jersey.select_set(True);bpy.context.view_layer.objects.active=jersey
modifier=jersey.modifiers.new('JerseySurface','SUBSURF');modifier.levels=1
while list(jersey.modifiers).index(modifier)>0:bpy.ops.object.modifier_move_up(modifier=modifier.name)
bpy.ops.object.modifier_apply(modifier=modifier.name)

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
   if bone.name.startswith(('hand_','index_','middle_','ring_','pinky_','thumb_')):bone.location=(0,0,0)
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
