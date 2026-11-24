"""Original balanced jump shot on the approved fitted athlete rig.
Animation-only GLB with a tiny skin carrier; no external mocap or player scan.
The timings are authored, not claimed measurements from an NBA clip.
"""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
source,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for bone in rig.pose.bones:bone.matrix_basis.identity();bone.rotation_mode='QUATERNION'
bpy.context.view_layer.update()
rest={b.name:b.matrix.copy() for b in rig.pose.bones}
sole_min={'r':float('inf'),'l':float('inf')}
for obj in bpy.context.scene.objects:
 if obj.type!='MESH' or not any(m.name=='Shoe' for m in obj.data.materials):continue
 evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh()
 for vertex in mesh.vertices:
  point=evaluated.matrix_world@vertex.co;side='r' if point.x<0 else 'l';sole_min[side]=min(sole_min[side],point.z)
 evaluated.to_mesh_clear()
assert all(math.isfinite(v) for v in sole_min.values()),'actual shoe surfaces are required'
for obj in list(bpy.context.scene.objects):
 if obj!=rig:bpy.data.objects.remove(obj,do_unlink=True)
bpy.context.scene.render.fps=60
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=78
action=bpy.data.actions.new('JumpShot_Authored');action.slots.new('OBJECT',rig.name)
rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
rig.animation_data.use_nla=False

def curve(points,t):
 for (a,x),(b,y) in zip(points,points[1:]):
  if t<=b:
   f=max(0,min(1,(t-a)/(b-a)));f=f*f*(3-2*f)
   return x+(y-x)*f
 return points[-1][1]

def vector_curve(points,t):
 return Vector(tuple(curve([(a,v[i]) for a,v in points],t) for i in range(3)))

def orient(name,head,direction):
 bone=rig.pose.bones[name]
 original=rest[name].to_3x3();old=original@Vector((0,1,0))
 rotation=old.normalized().rotation_difference(direction.normalized())
 bone.matrix=Matrix.Translation(head)@rotation.to_matrix().to_4x4()@original.to_4x4()
 bpy.context.view_layer.update()

def limb(upper,lower,end,target,pole):
 a=rig.pose.bones[upper].head.copy()
 la=(rest[lower].translation-rest[upper].translation).length
 lb=(rest[end].translation-rest[lower].translation).length
 vector=target-a;distance=vector.length;axis=vector.normalized()
 distance=max(abs(la-lb)+.002,min(distance,la+lb-.002))
 target=a+axis*distance
 bend=pole-axis*pole.dot(axis)
 if bend.length<.001:bend=Vector((1,0,0))-axis*axis.x
 along=(la*la-lb*lb+distance*distance)/(2*distance)
 knee=a+axis*along+bend.normalized()*math.sqrt(max(0,la*la-along*along))
 orient(upper,a,knee-a);orient(lower,knee,target-knee)
 # Flat soles/wrists use their original world orientation, not the shin twist.
 rig.pose.bones[end].matrix=Matrix.Translation(target)@rest[end].to_3x3().to_4x4()
 bpy.context.view_layer.update()
 return (rig.pose.bones[end].head-target).length

def root_height(t):
 start,land,peak=.275,.685,1.2
 speed=4*peak/(land-start)
 if t<.16:return curve([(0,-.10),(.16,-.34)],t)
 if t<start:
  u=(t-.16)/(start-.16);span=start-.16
  return (2*u**3-3*u*u+1)*(-.34)+(u**3-u*u)*span*speed
 if t<land:
  u=(t-start)/(land-start);return 4*peak*u*(1-u)
 if t<.765:
  u=(t-land)/(.765-land);span=.765-land
  return (u**3-2*u*u+u)*span*(-speed)+(-2*u**3+3*u*u)*(-.34)
 return curve([(.765,-.34),(1,-.18)],t)

samples=[]
for frame in range(79):
 t=frame/78;bpy.context.scene.frame_set(frame)
 for bone in rig.pose.bones:bone.matrix_basis.identity()
 h=root_height(t);rig.pose.bones['root'].location=Vector((0,0,h));bpy.context.view_layer.update()
 for side,x,forward in [('r',-.40,-.08),('l',.40,.23)]:
  swing=curve([(0,.12 if side=='l' else 0),(.12,0),(1,0)],t)
  target=Vector((x,forward,.304-sole_min[side]+max(0,h)+swing))
  limb('thigh_'+side,'calf_'+side,'foot_'+side,target,Vector((0,-1,0)))
 rise=curve([(0,0),(.17,0),(.38,.80),(.48,1),(.74,1),(1,.5)],t)
 wrist=Vector((-.35,-.35,3.35+3.35*rise+h))
 limb('upperarm_r','lowerarm_r','hand_r',wrist,Vector((-.25,-.8,-1)))
 separate=curve([(0,0),(.44,0),(.64,1),(1,1)],t)
 guide=Vector((.32,-.55,3.4+3.0*rise+h)).lerp(Vector((.78,-.25,4.4+h)),separate)
 limb('upperarm_l','lowerarm_l','hand_l',guide,Vector((1,-.25,0)))
 for side in ['r','l']:
  hand=rig.pose.bones['hand_'+side];finger=rest['middle_01_'+side].translation-rest[hand.name].translation
  desired=Vector((0,-1+rise*.8,.2+rise*.8))
  if side=='r':desired=desired.lerp(Vector((0,-.75,-.2)),curve([(0,0),(.48,0),(.64,1),(1,1)],t))
  else:desired=desired.lerp(Vector((0,-.2,-.7)),separate)
  rotation=finger.normalized().rotation_difference(desired.normalized())
  hand.matrix=Matrix.Translation(hand.head)@rotation.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4();bpy.context.view_layer.update()
 for bone in rig.pose.bones:
  bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('scale',frame=frame)
 if frame%6==0:samples.append({'t':t,'height':h,'right_foot':list(rig.pose.bones['foot_r'].head),'left_foot':list(rig.pose.bones['foot_l'].head),'right_hand':list(rig.pose.bones['hand_r'].head)})
rig.animation_data.action=None;rig.animation_data.use_nla=True
track=rig.animation_data.nla_tracks.new();track.name='JumpShot';track.strips.new('JumpShot',0,action)
# A three-vertex skin retains the joint hierarchy in an animation-only package.
mesh=bpy.data.meshes.new('AnimationCarrier');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)])
carrier=bpy.data.objects.new('AnimationCarrier',mesh);bpy.context.collection.objects.link(carrier)
carrier.parent=rig;carrier.vertex_groups.new(name='root').add([0,1,2],1,'REPLACE')
modifier=carrier.modifiers.new('Armature','ARMATURE');modifier.object=rig
track.mute=True
for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.scene.frame_set(0);bpy.context.view_layer.update();track.mute=False
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animation_mode='NLA_TRACKS',export_animations=True,export_skins=True,export_def_bones=False,export_force_sampling=True,export_yup=True)
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'duration_s':1.3,'fps':60,'release_phase':.48,'takeoff_phase':.275,'landing_phase':.685,'license':'CC0-1.0','quality':'UNVERIFIED','motion':'Original jump-shot curves on approved rig, not measured or extracted NBA motion','sole_bind_min':sole_min,'samples':samples}
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({k:v for k,v in receipt.items() if k!='samples'}))
