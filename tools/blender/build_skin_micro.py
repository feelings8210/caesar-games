"""Blender CPU compositor: project micro-height contrast from CC0 skin photo.
Observed hair-free patch, local high-pass, raw data PNG. Not a measured normal.
"""
import bpy,sys,json,hashlib
from pathlib import Path
source,out=sys.argv[sys.argv.index('--')+1:]
out=str(Path(out).resolve())
image=bpy.data.images.load(source);image.colorspace_settings.name='Non-Color'
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.render.compositor_device='CPU';scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Raw';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.image_settings.color_depth='8';scene.render.filepath=out
nodes=bpy.data.node_groups.new('SkinMicroContrast','CompositorNodeTree');scene.compositing_node_group=nodes
nodes.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
n=nodes.nodes;l=nodes.links
src=n.new('CompositorNodeImage');src.image=image
crop=n.new('CompositorNodeCrop');crop.inputs['X'].default_value=2400;crop.inputs['Y'].default_value=700;crop.inputs['Width'].default_value=768;crop.inputs['Height'].default_value=768
l.new(src.outputs['Image'],crop.inputs['Image'])
scale=n.new('CompositorNodeScale');scale.inputs['Type'].default_value='Absolute';scale.inputs['X'].default_value=512;scale.inputs['Y'].default_value=512;l.new(crop.outputs[0],scale.inputs['Image'])
bw=n.new('CompositorNodeRGBToBW');l.new(scale.outputs[0],bw.inputs[0])
blur=n.new('CompositorNodeBlur');blur.inputs['Size'].default_value=(9,9);l.new(bw.outputs[0],blur.inputs['Image'])
blur_bw=n.new('CompositorNodeRGBToBW');l.new(blur.outputs[0],blur_bw.inputs[0])
sub=n.new('ShaderNodeMath');sub.operation='SUBTRACT';l.new(bw.outputs[0],sub.inputs[0]);l.new(blur_bw.outputs[0],sub.inputs[1])
contrast=n.new('ShaderNodeMath');contrast.operation='MULTIPLY_ADD';contrast.use_clamp=True;contrast.inputs[1].default_value=2.5;contrast.inputs[2].default_value=.5;l.new(sub.outputs[0],contrast.inputs[0])
sink=n.new('NodeGroupOutput');l.new(contrast.outputs[0],sink.inputs[0])
bpy.ops.render.render(write_still=True)
check=bpy.data.images.load(out);check.colorspace_settings.name='Non-Color';v=list(check.pixels)[::4]
r={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(Path(out).read_bytes()).hexdigest(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'size':list(check.size),'min':min(v),'max':max(v),'mean':sum(v)/len(v),'crop_pixels':[2400,700,768,768],'method':'Blender CPU compositor, observed hair-free patch, grayscale minus Gaussian9, gain2.5+0.5 Raw data output','license':'CC0-1.0','quality':'UNVERIFIED','calibration':'Authored micro-height contrast, not measured skin normals or physical scale'}
Path(out+'.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
