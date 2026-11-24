"""CPU Cycles multiview atlas of our original seated GLB, not a new source.
Each tile is an orthographic native 3D render. Six appearances, eight yaw
angles, two pitches. No photo/video asset or diffusion generation.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
source,out=sys.argv[sys.argv.index('--')+1:]
out=Path(out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=scene.render.resolution_y=128;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world.color=(.20,.20,.20)
def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((0,-.65,2.5))-obj.location).to_track_quat('-Z','Y').to_euler()
area('SoftArenaKey',(-5,-7,10),1700,7);area('SoftArenaFill',(6,4,7),900,8)
camdata=bpy.data.cameras.new('AtlasCamera');cam=bpy.data.objects.new('AtlasCamera',camdata);scene.collection.objects.link(cam)
scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=6.4
centre=Vector((0,-.65,2.5));tile=128;cols=8;rows=12
atlas=bpy.data.images.new('CrowdMultiview',width=cols*tile,height=rows*tile,alpha=True)
pixels=[0.]*(cols*tile*rows*tile*4)
palettes=[{'Skin':(.63,.38,.22,1),'Face':(.63,.38,.22,1),'Jersey':(.18,.32,.48,1),'Shorts':(.07,.09,.12,1),'Hair':(.025,.019,.014,1),'Shoe':(.4,.39,.37,1)},
          {'Skin':(.38,.22,.13,1),'Face':(.38,.22,.13,1),'Jersey':(.47,.20,.15,1),'Shorts':(.12,.14,.16,1),'Hair':(.013,.010,.008,1),'Shoe':(.06,.055,.05,1)}]
for style in range(6):
    pose=style%3;palette=palettes[style//3].copy()
    palette['Jersey']=[(.08,.16,.25,1),(.28,.29,.28,1),(.45,.44,.40,1),(.22,.065,.045,1),(.06,.07,.085,1),(.12,.18,.11,1)][style]
    for obj in objects:
        obj.hide_render=not obj.name.startswith(f'Seated{pose}_')
        if not obj.hide_render:
            slot=obj.name.split('_')[1];colour=palette.get(slot,(.8,.78,.7,1) if slot=='EyeSclera' else (.02,.015,.01,1))
            mat=bpy.data.materials.new(f'Atlas{style}_{slot}');mat.use_nodes=True
            p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=colour;p.inputs['Roughness'].default_value=.86
            obj.data.materials.clear();obj.data.materials.append(mat)
    for pitch_index,pitch in enumerate([12,30]):
        row=style*2+pitch_index
        for yaw_index in range(8):
            yaw=math.radians(yaw_index*45);elevation=math.radians(pitch)
            cam.location=centre+Vector((math.sin(yaw)*math.cos(elevation),-math.cos(yaw)*math.cos(elevation),math.sin(elevation)))*18
            cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
            file=out/f'tile-{style}-{pitch_index}-{yaw_index}.png';scene.render.filepath=str(file);bpy.ops.render.render(write_still=True)
            rendered=bpy.data.images.load(str(file),check_existing=False);data=list(rendered.pixels[:])
            # Blender pixel rows start at the bottom; atlas row0 is the PNG top.
            for y in range(tile):
                dest=(((rows-1-row)*tile+y)*cols*tile+yaw_index*tile)*4
                pixels[dest:dest+tile*4]=data[y*tile*4:(y+1)*tile*4]
            bpy.data.images.remove(rendered)
atlas.pixels.foreach_set(pixels);atlas.filepath_raw=str(out/'crowd-atlas.png');atlas.file_format='PNG';atlas.save()
receipt={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),
  'builder_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
  'output_sha256':hashlib.sha256((out/'crowd-atlas.png').read_bytes()).hexdigest(),
  'tile':tile,'cols':cols,'rows':rows,'styles':6,'yaw_degrees':list(range(0,360,45)),
  'pitch_degrees':[12,30],'orthographic_size_ft':6.4,'centre_blender':list(centre),
  'license':'CC0-1.0 derivative + original project clothing','quality':'UNVERIFIED'}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2));print('ATLAS_RENDER_COMPLETE',flush=True)
