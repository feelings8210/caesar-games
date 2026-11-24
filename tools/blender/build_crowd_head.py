import bpy,bmesh,sys,json,hashlib
from pathlib import Path
source,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
for rig in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
 if rig.animation_data:
  rig.animation_data.action=None
  for track in rig.animation_data.nla_tracks:track.mute=True
 for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.view_layer.update()
head=bpy.data.objects.get('AnatomicalHead');assert head and head.type=='MESH'
head.parent=None
for modifier in list(head.modifiers):head.modifiers.remove(modifier)
bm=bmesh.new();bm.from_mesh(head.data)
skin=next(i for i,m in enumerate(head.data.materials) if m.name=='Skin')
bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index!=skin],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,5.72),plane_no=(0,0,-1),clear_outer=True)
for vertex in bm.verts:vertex.co.z-=5.72
bm.to_mesh(head.data);bm.free();head.name='CrowdHead';head.vertex_groups.clear()
head.data.materials.clear();m=bpy.data.materials.new('CrowdSkin');m.diffuse_color=(.55,.38,.26,1);head.data.materials.append(m)
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
modifier=head.modifiers.new('AudienceLOD','DECIMATE');modifier.ratio=.045;bpy.ops.object.modifier_apply(modifier=modifier.name)
for polygon in head.data.polygons:polygon.material_index=0;polygon.use_smooth=True
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_skins=False,export_animations=False)
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'vertices':len(head.data.vertices),'polygons':len(head.data.polygons),'license':'CC0-1.0','quality':'UNVERIFIED','purpose':'Project audience-head study, not integrated into game','script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
