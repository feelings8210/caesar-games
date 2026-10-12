"""Restore the approved canonical uncut anatomical surface on the existing rig.
No new person/scan. Same proportions as build_arena_athlete.py before kit pruning.
"""
import bpy,bmesh,hashlib
from pathlib import Path
BASE='/srv/media-vault/datasets/universal-media-asset-library-v1/assets/models/blender-human-base-meshes/811f43accbb31a88/members/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend'
def full_body(rig):
    assert hashlib.sha256(Path(BASE).read_bytes()).hexdigest()=="3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137"
    with bpy.data.libraries.load(BASE,link=False) as (_,data):data.objects=['GEO-body_male_realistic']
    obj=data.objects[0];bpy.context.collection.objects.link(obj);obj.name='FullBodyWrap'
    obj.location=(0,0,0);obj.rotation_euler=(0,0,0)
    for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,1.46),plane_no=(0,0,1),clear_outer=True)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<.105],context='VERTS')
    for v in bm.verts:
        v.co.x*=3.8;v.co.y=v.co.y*3.8+.08;v.co.z=v.co.z*3.8+.06
        if v.co.z>5.35:
            t=min(1,(v.co.z-5.35)/.25);v.co.x*=1-.08*t;v.co.y=.08+(v.co.y-.08)*(1-.08*t)
        if 2.3<v.co.z<5.05 and abs(v.co.x)<.7:v.co.x*=.9;v.co.y=.08+(v.co.y-.08)*.88
    bm.to_mesh(obj.data);bm.free();obj.vertex_groups.clear()
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    assert all(v.groups for v in obj.data.vertices),'full surface must have native rig weights'
    return obj
