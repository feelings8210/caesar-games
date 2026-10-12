"""Native Blender CPU casual spectators from the approved fitted CC0 rig.
Fit connected sleeves, trousers and flat shoes in the evaluated seated pose.
No external garments or scans. Static drape, not a cloth simulation.
"""
import bpy,bmesh,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree

source,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
if rig.animation_data:
    rig.animation_data.action=None
    for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for bone in rig.pose.bones:bone.matrix_basis.identity()
bpy.context.view_layer.update();rest={b.name:b.matrix.copy() for b in rig.pose.bones}
head_mesh=bpy.data.objects['AnatomicalHead']
skin_vertices=set()
for face in head_mesh.data.polygons:
    if head_mesh.data.materials[face.material_index].name=='Skin':skin_vertices.update(face.vertices)
head_mesh.shape_key_add(name='Basis')
face_targets={n:head_mesh.shape_key_add(name=n) for n in ['JawWide','JawLong','NoseBridge','CheekWidth']}
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for i,vertex in enumerate(head_mesh.data.vertices):
    if i not in skin_vertices:continue
    x,y,z=vertex.co;protect=smooth(5.67,5.74,z)*(1-smooth(6.10,6.17,z))
    eye=math.exp(-((abs(x)-.1251)/.070)**2-((z-6.047)/.075)**2)
    safe=protect*(1-eye*.99);jaw=math.exp(-((z-5.82)/.17)**2)*safe;front=smooth(.12,.28,-y)
    face_targets['JawWide'].data[i].co+=Vector((x*.12*jaw,0,0))
    face_targets['JawLong'].data[i].co+=Vector((0,-.01*jaw*front,-.055*jaw))
    nose=math.exp(-(x/.09)**2-((z-6.015)/.10)**2)*front*safe
    face_targets['NoseBridge'].data[i].co+=Vector((x*.1*nose,-.035*nose,0))
    cheek=math.exp(-((abs(x)-.22)/.10)**2-((z-5.99)/.12)**2)*safe
    face_targets['CheekWidth'].data[i].co+=Vector((math.copysign(.027,x)*cheek,-.008*cheek*front,0))
hair=bpy.data.objects['HairCrop'];hair_base=[v.co.copy() for v in hair.data.vertices]

def orient(name,head,direction):
    original=rest[name].to_3x3()
    rotation=(original@Vector((0,1,0))).normalized().rotation_difference(direction.normalized())
    rig.pose.bones[name].matrix=Matrix.Translation(head)@rotation.to_matrix().to_4x4()@original.to_4x4()
    bpy.context.view_layer.update()

def limb(upper,lower,end,target,pole):
    a=rig.pose.bones[upper].head.copy()
    la=(rest[lower].translation-rest[upper].translation).length
    lb=(rest[end].translation-rest[lower].translation).length
    axis=(target-a).normalized();distance=min((target-a).length,la+lb-.003)
    target=a+axis*distance;bend=(pole-axis*pole.dot(axis)).normalized()
    along=(la*la-lb*lb+distance*distance)/(2*distance)
    elbow=a+axis*along+bend*math.sqrt(max(0,la*la-along*along))
    orient(upper,a,elbow-a);orient(lower,elbow,target-elbow)
    rig.pose.bones[end].matrix=Matrix.Translation(target)@rest[end].to_3x3().to_4x4()
    bpy.context.view_layer.update()

def new_mesh(name,vertices,faces):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh

def sleeves(mesh):
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    edges=set(e for e in bm.edges if e.is_boundary);loops=[]
    while edges:
        edge=edges.pop();start,current=edge.verts;loop=[start,current]
        while current!=start:
            remaining=[e for e in current.link_edges if e in edges]
            if not remaining:break
            edge=remaining[0];edges.remove(edge);current=edge.other_vert(current)
            if current!=start:loop.append(current)
        loops.append(loop)
    assert len(loops)==4
    armholes=[loop for loop in loops if abs(sum(v.co.x for v in loop)/len(loop))>.5]
    assert len(armholes)==2
    neck=[loop for loop in loops if loop not in armholes and sum(v.co.z for v in loop)/len(loop)>3.4][0]
    for v in bm.verts:
        v.co.x*=1.04
        if abs(v.co.x)<.34 and v.co.y<.08 and v.co.z>3.55:
            target=3.82+.10*(abs(v.co.x)/.34)**2
            v.co.z+=max(0,target-v.co.z)*min(1,(v.co.z-3.55)/.22)
        if v.co.z<2.35:
            v.co.z+=.40*max(0,min(1,(.20-v.co.y)/.5))*max(0,min(1,(2.35-v.co.z)/.5))
    for v in neck:
        if v.co.y<.08:v.co.z=max(v.co.z,3.82+.10*(abs(v.co.x)/.34)**2)
    for loop in armholes:
        side='l' if sum(v.co.x for v in loop)>0 else 'r'
        bone=rig.pose.bones['upperarm_'+side]
        axis=(bone.tail-bone.head).normalized();centre=sum((v.co for v in loop),Vector())/len(loop)
        cuff=bone.head.lerp(bone.tail,.54);radial=[]
        for v in loop:
            r=v.co-centre;r-=axis*r.dot(axis);radial.append(r.normalized())
        previous=loop
        for k in range(1,5):
            t=k/4;ring=[]
            for i,origin in enumerate(loop):
                target=cuff+radial[i]*(.34+.008*math.sin(i*2.7))
                ring.append(bm.verts.new(origin.co.lerp(target,t)))
            for i in range(len(loop)):
                j=(i+1)%len(loop);bm.faces.new((previous[i],previous[j],ring[j],ring[i]))
            previous=ring
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    return mesh

def trousers():
    n=24;vertices=[];faces=[];root_z=rig.pose.bones['root'].location.z
    def ring(points):
        indices=list(range(len(vertices),len(vertices)+len(points)));vertices.extend(points);return indices
    def bridge(a,b):
        for i in range(len(a)):
            j=(i+1)%len(a);faces.append((a[i],a[j],b[j],b[i]))
    waist=ring([(.64*math.cos(i*2*math.pi/n),.10+.48*math.sin(i*2*math.pi/n),
                  3.47+root_z-.14*math.sin(i*2*math.pi/n)) for i in range(n)])
    tops={}
    for side in ['l','r']:
        thigh=rig.pose.bones['thigh_'+side];calf=rig.pose.bones['calf_'+side]
        direction=(thigh.tail-thigh.head).normalized();x=Vector((1,0,0))
        stations=[(thigh.head.lerp(thigh.tail,t),direction,r) for t,r in [(.10,.33),(.35,.31),(.7,.28),(.95,.265)]]
        lower=(calf.tail-calf.head).normalized()
        stations+=[(calf.head.lerp(calf.tail,t),lower,r) for t,r in [(.15,.26),(.45,.24),(.75,.225),(.96,.215)]]
        previous=None
        for k,(centre,axis,radius) in enumerate(stations):
            normal=x.cross(axis).normalized();points=[]
            for i in range(n):
                angle=i*2*math.pi/n;fold=.008*math.sin(angle*3+k*1.2)
                p=centre+x*((radius+fold)*math.cos(angle))+normal*((radius+fold)*math.sin(angle));points.append(tuple(p))
            current=ring(points)
            if previous:bridge(previous,current)
            else:tops[side]=current
            previous=current
    quarter=n//4;half=n//2
    for side in ['l','r']:
        offset=-quarter if side=='l' else quarter
        for k in range(half):
            i=(offset+k)%n;j=(i+1)%n;faces.append((waist[i],waist[j],tops[side][j],tops[side][i]))
    for k in range(half):
        a=(quarter+k)%n;b=(a+1)%n;c=(quarter-k)%n;d=(c-1)%n
        faces.append((tops['l'][a],tops['l'][b],tops['r'][d],tops['r'][c]))
    for i in [quarter,3*quarter]:faces.append((waist[i],tops['l'][i],tops['r'][i]))
    return new_mesh('CasualTrousers',vertices,faces)

def shoes():
    vertices=[];faces=[];n=24
    for side in ['l','r']:
        foot=rig.pose.bones['foot_'+side].head;start=len(vertices)
        for z,rx,ry,cy in [(.035,.24,.57,-.34),(.11,.245,.57,-.34),(.25,.22,.50,-.29),(.36,.155,.25,-.03)]:
            for i in range(n):
                angle=i*2*math.pi/n;vertices.append((foot.x+rx*math.cos(angle),foot.y+cy+ry*math.sin(angle),z))
        for k in range(3):
            for i in range(n):
                j=(i+1)%n;faces.append((start+k*n+i,start+k*n+j,start+(k+1)*n+j,start+(k+1)*n+i))
        faces.append(tuple(start+i for i in reversed(range(n))));faces.append(tuple(start+3*n+i for i in range(n)))
    return new_mesh('CasualShoes',vertices,faces)

sources=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name in ['AnatomicalBody','AnatomicalHead','HairCrop','JerseyLOD']]
created=[];counts={};contacts=[];clearances=[]
for variant in range(3):
    for bone in rig.pose.bones:bone.matrix_basis.identity()
    rig.pose.bones['root'].location.z=-1.45;bpy.context.view_layer.update()
    face_weights=[[-.4,.2,.4,.3],[.65,-.15,.2,-.2],[.1,.65,-.2,.7]][variant]
    for i,target in enumerate(face_targets.values()):target.value=face_weights[i]
    for v,base in zip(hair.data.vertices,hair_base):
        v.co=base.copy()
        if base.z>6.46:v.co.z=6.46+(base.z-6.46)*[1,.85,1.25][variant]
    hair.data.update()
    for side,sign in [('r',-1),('l',1)]:
        limb('thigh_'+side,'calf_'+side,'foot_'+side,Vector((sign*(.43+variant*.05),-1.55-variant*.12,.29)),Vector((0,-1,0)))
        target=Vector((sign*(.48+variant*.07),-1.20-variant*.14,2.12+variant*.08))
        if variant==1 and side=='l':target=Vector((.38,-.90,2.65))
        limb('upperarm_'+side,'lowerarm_'+side,'hand_'+side,target,Vector((sign,0,0)))
        hand=rig.pose.bones['hand_'+side];fingers=rest['middle_01_'+side].translation-rest['hand_'+side].translation
        rotate=fingers.normalized().rotation_difference(Vector((0,-.25,-1)).normalized())
        hand.matrix=Matrix.Translation(hand.head)@rotate.to_matrix().to_4x4()@rest[hand.name].to_3x3().to_4x4();bpy.context.view_layer.update()
    head=rig.pose.bones['Head'];head.rotation_mode='QUATERNION'
    head.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector((.08*(variant-1),-.06,1)).normalized())
    bpy.context.view_layer.update();parts={};deps=bpy.context.evaluated_depsgraph_get()
    body=bpy.data.objects['AnatomicalBody']
    posed_body=bpy.data.meshes.new_from_object(body.evaluated_get(deps),depsgraph=deps)
    posed_body.transform(body.matrix_world)
    surface=BVHTree.FromPolygons([v.co for v in posed_body.vertices],[list(f.vertices) for f in posed_body.polygons])
    def fit_cloth(mesh,margin=.045):
        tested=0;penetrating=0
        for v in mesh.vertices:
            if abs(v.co.x)<.52 or v.co.z<2.4:continue
            point,normal,_,distance=surface.find_nearest(v.co)
            if point is None or distance>.25:continue
            signed=(v.co-point).dot(normal);tested+=1;penetrating+=signed<-.002
            if signed<margin:v.co=point+normal*margin
        mesh.update();return {'tested':tested,'penetrating_before_fit':penetrating}
    for obj in sources:
        arm_groups={g.index for g in obj.vertex_groups if g.name.startswith(('upperarm','lowerarm','hand','thumb','index','middle','ring','pinky','clavicle'))}
        protected={v.index for v in obj.data.vertices if sum(w.weight for w in v.groups if w.group in arm_groups)>.18}
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps),depsgraph=deps);mesh.transform(obj.matrix_world)
        if obj.name=='JerseyLOD':mesh=sleeves(mesh)
        for material_index,material in enumerate(obj.data.materials):
            slot=material.name
            if obj.name=='AnatomicalHead' and slot=='Skin':slot='Face'
            piece=mesh.copy();bm=bmesh.new();bm.from_mesh(piece)
            remove=[f for f in bm.faces if f.material_index!=material_index]
            if obj.name=='AnatomicalBody':
                remove += [f for f in bm.faces if all(v.index not in protected and abs(v.co.x)<.95 and v.co.z<2.35 for v in f.verts)]
                for side in ['l','r']:
                    upper=rig.pose.bones['upperarm_'+side];delta=upper.tail-upper.head
                    def under_sleeve(v):
                        t=(v.co-upper.head).dot(delta)/delta.length_squared
                        return -.25<t<.47 and (v.co-upper.head-delta*t).length<.50
                    remove += [f for f in bm.faces if all(under_sleeve(v) for v in f.verts)]
            bmesh.ops.delete(bm,geom=list(set(remove)),context='FACES')
            bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
            bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001);bm.to_mesh(piece);bm.free()
            if len(piece.polygons):parts.setdefault(slot,[]).append(piece)
            else:bpy.data.meshes.remove(piece)
        bpy.data.meshes.remove(mesh)
    parts['Shorts']=[trousers()];parts['Shoe']=[shoes()]
    contacts.append({'pose':variant,'shoe_sole_z':.035,'foot_bones':[list(rig.pose.bones['foot_'+s].head) for s in ['l','r']]})
    for slot,pieces in parts.items():
        objects=[]
        for mesh in pieces:
            obj=bpy.data.objects.new(slot,mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=objects[0]
        if slot=='Jersey':
            sub=obj.modifiers.new('StaticGarmentSurface','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
            fit_cloth(obj.data)
        dec=obj.modifiers.new('AudienceLOD','DECIMATE')
        dec.ratio=.18 if slot=='Face' else .12 if slot=='Skin' else .045 if slot=='Jersey' else .65 if slot=='Shorts' else .8 if slot=='Shoe' else .2
        if slot.startswith('Eye'):dec.ratio=.06 if slot=='EyeSclera' else .2
        bpy.ops.object.modifier_apply(modifier=dec.name);obj.name=f'Seated{variant}_{slot}'
        if slot=='Jersey':
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.smooth_vert(bm,verts=[v for v in bm.verts if not v.is_boundary],factor=.28,use_axis_x=True,use_axis_y=True,use_axis_z=True)
            bm.to_mesh(obj.data);bm.free()
        if slot=='Jersey':clearances.append({'mesh':obj.name,**fit_cloth(obj.data)})
        for f in obj.data.polygons:f.material_index=0;f.use_smooth=True
        mat=bpy.data.materials.new(slot);mat.diffuse_color=(.65,.65,.65,1);obj.data.materials.clear();obj.data.materials.append(mat)
        low=obj.copy();low.data=obj.data.copy();low.name=f'SeatedLow{variant}_{slot}';bpy.context.collection.objects.link(low)
        if slot=='Jersey':
            bpy.context.view_layer.objects.active=obj
            solid=obj.modifiers.new('FabricEdges','SOLIDIFY');solid.thickness=.006;solid.offset=-1;bpy.ops.object.modifier_apply(modifier=solid.name)
        created.append(obj);counts[obj.name]=len(obj.data.polygons)
        bpy.ops.object.select_all(action='DESELECT');low.select_set(True);bpy.context.view_layer.objects.active=low
        dec=low.modifiers.new('MobileAudienceLOD','DECIMATE');dec.ratio=.75 if slot=='Shoe' else .58 if slot=='Face' else .6 if slot=='Jersey' else .3
        bpy.ops.object.modifier_apply(modifier=dec.name)
        if slot=='Jersey':clearances.append({'mesh':low.name,**fit_cloth(low.data)})
        if slot=='Jersey':
            solid=low.modifiers.new('FabricEdges','SOLIDIFY');solid.thickness=.006;solid.offset=-1;bpy.ops.object.modifier_apply(modifier=solid.name)
        created.append(low);counts[low.name]=len(low.data.polygons)
    bpy.data.meshes.remove(posed_body)
for obj in list(bpy.context.scene.objects):
    if obj not in created:bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=False,export_skins=False)
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),
 'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),
 'builder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'polygons':counts,'license':'CC0-1.0','quality':'UNVERIFIED','contacts':contacts,'clearances':clearances,
 'method':'Connected sleeves fitted after pose evaluation; original trousers and flat shoes; static drape, not cloth simulation'}
Path(out+'.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
