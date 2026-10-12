"""Original facial proportions as morph targets on approved CC0 anatomy.
Keep eyes, neck seam, scalp and the existing skeletal/animation architecture.
No player scan, likeness extraction, or external motion data.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:];out=str(Path(out).resolve())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.view_layer.update();rows=[]
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for name in ['AnatomicalHead','HeadLOD']:
 obj=bpy.data.objects[name];skin=set()
 for face in obj.data.polygons:
  if obj.data.materials[face.material_index].name=='Skin':skin.update(face.vertices)
 basis=obj.shape_key_add(name='Basis')
 targets={n:obj.shape_key_add(name=n) for n in ['JawWide','JawLong','NoseBridge','CheekWidth']}
 for i,vertex in enumerate(obj.data.vertices):
  if i not in skin:continue
  p=vertex.co;x,y,z=p
  protect=smooth(5.67,5.74,z)*(1-smooth(6.10,6.17,z))
  eye=math.exp(-((abs(x)-.1251)/.070)**2-((z-6.047)/.075)**2)
  safe=protect*(1-eye*.99)
  jaw=math.exp(-((z-5.82)/.17)**2)*safe
  front=smooth(.12,.28,-y)
  targets['JawWide'].data[i].co+=Vector((x*.12*jaw,0,0))
  targets['JawLong'].data[i].co+=Vector((0,-.01*jaw*front,-.055*jaw))
  nose=math.exp(-(x/.09)**2-((z-6.015)/.10)**2)*front*safe
  targets['NoseBridge'].data[i].co+=Vector((x*.1*nose,-.035*nose,0))
  cheek=math.exp(-((abs(x)-.22)/.10)**2-((z-5.99)/.12)**2)*safe
  targets['CheekWidth'].data[i].co+=Vector((math.copysign(.027,x)*cheek,-.008*cheek*front,0))
 rows.append({'mesh':name,'vertices':len(obj.data.vertices),'skin_vertices':len(skin),'targets':list(targets)})
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.context.scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animation_mode='NLA_TRACKS',export_animations=True,export_skins=True,export_force_sampling=True,export_yup=True,export_morph=True,export_morph_normal=True)
r={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'output_bytes':Path(out).stat().st_size,'meshes':rows,'license':'CC0-1.0','quality':'UNVERIFIED','method':'Original rest-space facial proportion morphs, with eye/neck/scalp protection; no scans or NBA likeness data'}
Path(out+'.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
