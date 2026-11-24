"""Original two-step right-hand layup on the approved fitted athlete rig.
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
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=75
action=bpy.data.actions.new('LayupR_Authored');action.slots.new('OBJECT',rig.name)
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

# Blender forward is -Y; game forward is +Z after native glTF export.
# An in-place clip: tactical root translation remains owned by the runner.
right=[(0,(-.40,-.10,.304)),(.10,(-.40,-.58,.304)),(.21,(-.40,.38,.304)),(.30,(-.40,.76,.62)),(.40,(-.40,.45,1.38)),(.52,(-.40,.15,1.55)),(.65,(-.40,.14,1.50)),(.78,(-.40,-.15,.75)),(.91,(-.40,-.12,.304)),(1,(-.40,.3077,.304))]
left=[(0,(.40,.88,.52)),(.11,(.40,.70,.58)),(.23,(.40,-.65,.304)),(.33,(.40,-.10,.304)),(.39,(.40,.25,.55)),(.52,(.40,.85,.32)),(.65,(.40,.80,.32)),(.78,(.40,.27,.45)),(.90,(.40,.10,.304)),(1,(.40,.3077,.304))]
def root_height(t):
 takeoff,landing,peak=.35,.85,1.34
 speed=4*peak/(landing-takeoff)
 if t<.27:return curve([(0,-.12),(.18,-.18),(.27,-.32)],t)
 if t<takeoff:
  u=(t-.27)/(takeoff-.27);span=takeoff-.27
  return (2*u**3-3*u*u+1)*(-.32)+(u**3-u*u)*span*speed
 if t<landing:
  u=(t-takeoff)/(landing-takeoff);return 4*peak*u*(1-u)
 if t<.93:
  u=(t-landing)/(.93-landing);span=.93-landing
  return (u**3-2*u*u+u)*span*(-speed)+(-2*u**3+3*u*u)*(-.35)
 return curve([(.93,-.35),(1,-.25)],t)

samples=[]
for frame in range(76):
 t=frame/75;bpy.context.scene.frame_set(frame)
 for bone in rig.pose.bones:bone.matrix_basis.identity()
 h=root_height(t);root=rig.pose.bones['root'];root.location=Vector((0,0,h))
 bpy.context.view_layer.update()
 # Grounded foot targets stay at floor height; airborne targets ride the rise.
 r=vector_curve(right,t);l=vector_curve(left,t)
 r.z+=max(0,h);l.z+=max(0,h)
 r.z-=sole_min['r'];l.z-=sole_min['l']
 for side,target in [('r',r),('l',l)]:limb('thigh_'+side,'calf_'+side,'foot_'+side,target,Vector((0,-1,0)))
 roll=curve([(0,0),(.33,0),(.40,.25),(.52,.10),(.72,.04),(.90,0),(1,0)],t)
 if roll>0:
  foot=rig.pose.bones['foot_l'];foot.matrix=Matrix.Translation(foot.head)@Matrix.Rotation(roll,4,'X')@rest['foot_l'].to_3x3().to_4x4()
  bpy.context.view_layer.update()
 # Upper body carries the ball before separating the guide hand.
 up=curve([(0,0),(.22,.05),(.56,1),(.70,.95),(.92,.25),(1,0)],t)
 target=Vector((-.65,-.62-.16*up,3.7+3.0*up+h))
 limb('upperarm_r','lowerarm_r','hand_r',target,Vector((-1,0,0)))
 separate=curve([(0,0),(.31,0),(.48,1),(1,1)],t)
 support=Vector((.37,-.65,3.7+2.8*up+h)).lerp(Vector((.92,-.35,4.15+h)),separate)
 limb('upperarm_l','lowerarm_l','hand_l',support,Vector((1,0,0)))
 for side in ['r','l']:
  hand=rig.pose.bones['hand_'+side];finger=rest['middle_01_'+side].translation-rest['hand_'+side].translation
  lift=up if side=='r' else up*.65
  desired=Vector((0,-1+lift*.8,.25+lift*.75))
  if side=='l':desired=desired.lerp(Vector((0,-.25,-.75)),separate)
  else:desired=desired.lerp(Vector((0,-.65,.25)),curve([(0,0),(.565,0),(.72,1),(.95,.9),(1,0)],t))
  change=finger.normalized().rotation_difference(desired.normalized())
  hand.matrix=Matrix.Translation(hand.head)@change.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4()
  bpy.context.view_layer.update()
 for bone in rig.pose.bones:
  bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_quaternion',frame=frame);bone.keyframe_insert('scale',frame=frame)
 if frame%5==0:samples.append({'t':t,'root_z':h,'right_ankle':list(rig.pose.bones['foot_r'].head),'left_ankle':list(rig.pose.bones['foot_l'].head),'right_knee':list(rig.pose.bones['calf_r'].head),'right_hand':list(rig.pose.bones['hand_r'].head)})
rig.animation_data.action=None;rig.animation_data.use_nla=True
track=rig.animation_data.nla_tracks.new();track.name='LayupR';track.strips.new('LayupR',0,action)
# A three-vertex skin retains the joint hierarchy in an animation-only package.
mesh=bpy.data.meshes.new('AnimationCarrier');mesh.from_pydata([(0,0,0),(.001,0,0),(0,.001,0)],[],[(0,1,2)])
carrier=bpy.data.objects.new('AnimationCarrier',mesh);bpy.context.collection.objects.link(carrier)
carrier.parent=rig;carrier.vertex_groups.new(name='root').add([0,1,2],1,'REPLACE')
modifier=carrier.modifiers.new('Armature','ARMATURE');modifier.object=rig
track.mute=True
for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.scene.frame_set(0);bpy.context.view_layer.update();track.mute=False
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animation_mode='NLA_TRACKS',export_animations=True,export_skins=True,export_def_bones=False,export_force_sampling=True,export_yup=True)
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'duration_s':1.25,'fps':60,'license':'CC0-1.0','quality':'UNVERIFIED','motion':'Original keyframes and two-bone solves; not extracted NBA motion','takeoff_phase':.35,'landing_phase':.85,'landing_compression_ft':.35,'end_compression_ft':.25,'root_motion':'Continuous authored ballistic rise/fall with Hermite push and landing compression','sole_bind_min':sole_min,'samples':samples}
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print(json.dumps({k:v for k,v in receipt.items() if k!='samples'}))
