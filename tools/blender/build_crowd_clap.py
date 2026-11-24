"""Bake three original seated clap targets from the approved rig to the existing
casual spectators. Transfer weights in their actual seated bind pose, preserve
the low body, and keep the mesh topology identical. Native CPU, no mocap.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
athlete_path,crowd_path,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=athlete_path)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
if rig.animation_data:
    rig.animation_data.action=None
    for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for b in rig.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update();rest={b.name:b.matrix.copy() for b in rig.pose.bones}
sys.path.insert(0,str(Path(__file__).parent))
from full_body_surface import full_body,BASE
full_surface=full_body(rig)
surfaces=[full_surface]+[bpy.data.objects[n] for n in ['AnatomicalBody','AnatomicalHead','JerseyLOD']]
def orient(name,head,direction):
    original=rest[name].to_3x3()
    rotation=(original@Vector((0,1,0))).normalized().rotation_difference(direction.normalized())
    rig.pose.bones[name].matrix=Matrix.Translation(head)@rotation.to_matrix().to_4x4()@original.to_4x4()
    bpy.context.view_layer.update()
def limb(upper,lower,end,target,pole):
    a=rig.pose.bones[upper].head.copy();la=(rest[lower].translation-rest[upper].translation).length
    lb=(rest[end].translation-rest[lower].translation).length
    axis=(target-a).normalized();distance=min((target-a).length,la+lb-.003)
    target=a+axis*distance;bend=(pole-axis*pole.dot(axis)).normalized()
    along=(la*la-lb*lb+distance*distance)/(2*distance)
    elbow=a+axis*along+bend*math.sqrt(max(0,la*la-along*along))
    orient(upper,a,elbow-a);orient(lower,elbow,target-elbow)
    rig.pose.bones[end].matrix=Matrix.Translation(target)@rest[end].to_3x3().to_4x4();bpy.context.view_layer.update()
def neutral(variant):
    for b in rig.pose.bones:b.matrix_basis.identity()
    rig.pose.bones['root'].location.z=-1.45;bpy.context.view_layer.update()
    for side,sign in [('r',-1),('l',1)]:
        limb('thigh_'+side,'calf_'+side,'foot_'+side,Vector((sign*(.43+variant*.05),-1.55-variant*.12,.29)),Vector((0,-1,0)))
        target=Vector((sign*(.48+variant*.07),-1.20-variant*.14,2.12+variant*.08))
        if variant==1 and side=='l':target=Vector((.38,-.90,2.65))
        limb('upperarm_'+side,'lowerarm_'+side,'hand_'+side,target,Vector((sign,0,0)))
        hand=rig.pose.bones['hand_'+side];fingers=rest['middle_01_'+side].translation-rest[hand.name].translation
        rotate=fingers.normalized().rotation_difference(Vector((0,-.25,-1)).normalized())
        hand.matrix=Matrix.Translation(hand.head)@rotate.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4();bpy.context.view_layer.update()
    head=rig.pose.bones['Head'];head.rotation_mode='QUATERNION'
    head.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector((.08*(variant-1),-.06,1)).normalized())
    bpy.context.view_layer.update()
bpy.ops.import_scene.gltf(filepath=crowd_path)
crowd=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Seated')]
stats=[]
for variant in range(3):
    neutral(variant);bind={b.name:(rig.matrix_world@b.matrix).inverted() for b in rig.pose.bones}
    deps=bpy.context.evaluated_depsgraph_get();points=[];weights=[]
    for surface in surfaces:
        if surface.name=='JerseyLOD':shirt_start=len(points)
        evaluated=bpy.data.meshes.new_from_object(surface.evaluated_get(deps),depsgraph=deps)
        assert len(evaluated.vertices)==len(surface.data.vertices),'weight transfer requires original topology'
        groups={g.index:g.name for g in surface.vertex_groups}
        for vertex,original in zip(evaluated.vertices,surface.data.vertices):
            points.append(surface.matrix_world@vertex.co)
            w=[(groups[g.group],g.weight) for g in original.groups if groups[g.group] in bind]
            total=sum(value for _,value in w);weights.append([(bone,value/total) for bone,value in w] if total else [('root',1.)])
        bpy.data.meshes.remove(evaluated)
    kd=KDTree(shirt_start);shirt_kd=KDTree(len(points)-shirt_start)
    for i,p in enumerate(points):
        (kd if i<shirt_start else shirt_kd).insert(p,i)
    kd.balance();shirt_kd.balance()
    arm_kd={}
    for side in ['l','r']:
        ids=[i for i,w in enumerate(weights[:shirt_start]) if sum(value for bone,value in w if bone.endswith('_'+side) and bone.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky')))>.18]
        assert ids,'approved source must contain real arm/finger weights'
        search=KDTree(len(ids))
        for i in ids:search.insert(points[i],i)
        search.balance();arm_kd[side]=search
    meshes=[o for o in crowd if o.name.startswith((f'Seated{variant}_',f'SeatedLow{variant}_'))]
    transferred={}
    for obj in meshes:
        obj.shape_key_add(name='Basis')
        transferred[obj.name]=[]
        for v in obj.data.vertices:
            p=obj.matrix_world@v.co
            search=shirt_kd if obj.name.split('_')[1]=='Jersey' and not obj.get('body_wrap') else kd
            # Hands rest next to knees; geometric nearest-body alone mistakes
            # low fingertips for legs. The source garment bake preserved only
            # arm-weighted skin in this low region, so constrain that search.
            if obj.name.split('_')[1]=='Skin' and p.z<2.5:search=arm_kd['l' if p.x>0 else 'r']
            w=weights[search.find(p)[1]]
            if obj.name.split('_')[1]=='Jersey':
                for side in ['l','r']:
                    attribute=obj.data.attributes.get('_SLEEVE_'+side.upper())
                    if attribute is None:continue
                    mix=max(0.,min(1.,attribute.data[v.index].value))
                    if mix>0:
                        w=[(bone,value*(1-mix)) for bone,value in w]+[('upperarm_'+side,mix)]
            transferred[obj.name].append(w)
    neutral_hands={side:rig.pose.bones['hand_'+side].matrix.copy() for side in ['l','r']}
    for name,spread in [('ClapLift',.32),('ClapOpen',.32),('ClapClosed',.08)]:
        neutral(variant)
        for side,sign in [('r',-1),('l',1)]:
            target=Vector((sign*spread,-.98,3.15))
            if name=='ClapLift':target=neutral_hands[side].translation.lerp(target,.5)
            limb('upperarm_'+side,'lowerarm_'+side,'hand_'+side,target,Vector((sign,0,-.2)))
            hand=rig.pose.bones['hand_'+side]
            fingers=(rest['middle_01_'+side].translation-rest[hand.name].translation).normalized()
            rotation=fingers.rotation_difference(Vector((0,0,1)))
            orientation=Matrix.Rotation(-sign*math.pi/2,4,'Z')@rotation.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4()
            if name=='ClapLift':orientation=neutral_hands[side].to_quaternion().slerp(orientation.to_quaternion(),.5).to_matrix().to_4x4()
            hand.matrix=Matrix.Translation(hand.head)@orientation;bpy.context.view_layer.update()
        transforms={b.name:rig.matrix_world@b.matrix@bind[b.name] for b in rig.pose.bones}
        for obj in meshes:
            key=obj.shape_key_add(name=name);inverse=obj.matrix_world.inverted();max_delta=0;lower_delta=0
            for vertex,w in zip(obj.data.vertices,transferred[obj.name]):
                p=obj.matrix_world@vertex.co;deformed=Vector((0,0,0))
                for bone,weight in w:deformed+=(transforms[bone]@p)*weight
                # Pants/shoes and the support surface remain exactly unchanged.
                arm=any(bone.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky')) for bone,weight in w if weight>.05)
                if obj.name.split('_')[1] in ['Shorts','Shoe'] or p.z<1.65 and not arm:deformed=p
                key.data[vertex.index].co=inverse@deformed
                delta=(deformed-p).length;max_delta=max(max_delta,delta)
                if obj.name.split('_')[1] in ['Shorts','Shoe']:lower_delta=max(lower_delta,delta)
            stats.append({'mesh':obj.name,'target':name,'max_delta_ft':max_delta,'lower_delta_ft':lower_delta})
for obj in list(bpy.context.scene.objects):
    if obj not in crowd:bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=False,export_skins=False,export_morph=True,export_morph_normal=True)
receipt={'athlete_sha256':hashlib.sha256(Path(athlete_path).read_bytes()).hexdigest(),'crowd_sha256':hashlib.sha256(Path(crowd_path).read_bytes()).hexdigest(),
 'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'builder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'targets':['ClapLift','ClapOpen','ClapClosed'],'stats':stats,'license':'CC0-1.0','quality':'UNVERIFIED',
 'full_base_sha256':hashlib.sha256(Path(BASE).read_bytes()).hexdigest(),
 'helper_sha256':hashlib.sha256(Path(__file__).with_name('full_body_surface.py').read_bytes()).hexdigest(),
 'method':'Original rig poses, full uncut canonical body for continuous shirt weight transfer, native linear skin bake to fixed-topology targets; no mocap or cloth simulation'}
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print('CLAP_TARGETS_COMPLETE',flush=True)
