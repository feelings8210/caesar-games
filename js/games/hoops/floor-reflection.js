/* Projected satin-floor reflection of live court objects. Uses the reflected
 * camera/oblique plane approach documented by Three.js's MIT Reflector.
 * The floor keeps its original PBR wood/paint; empty reflection pixels do not
 * darken it. No downloaded media, screen-space history or copied player pose. */
import * as THREE from '../../vendor/three/three.module.min.js';

export class FloorReflection {
  constructor(renderer, scene, material, floors, getAthletes) {
    this.renderer=renderer;this.scene=scene;this.getAthletes=getAthletes;
    this.camera=new THREE.PerspectiveCamera();this.camera.layers.set(1);
    this.matrix=new THREE.Matrix4();this.lastFrame=-1;this.rendering=false;
    this.target=new THREE.WebGLRenderTarget(512,512,{
      type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,samples:0
    });
    this.uniforms={floorReflectionMap:{value:this.target.texture},floorReflectionMatrix:{value:this.matrix},
      floorReflectionStrength:{value:.32},floorReflectionTexel:{value:new THREE.Vector2(1/512,1/512)}};
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=shader=>{
      previous?.(shader);Object.assign(shader.uniforms,this.uniforms);
      shader.vertexShader='uniform mat4 floorReflectionMatrix;varying vec4 vFloorReflection;varying vec3 vFloorWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vFloorWorld=(modelMatrix*vec4(transformed,1.)).xyz;
        vFloorReflection=floorReflectionMatrix*vec4(vFloorWorld,1.);`);
      shader.fragmentShader=`uniform sampler2D floorReflectionMap;uniform vec2 floorReflectionTexel;
        uniform float floorReflectionStrength;varying vec4 vFloorReflection;varying vec3 vFloorWorld;\n`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        if(floorReflectionStrength>0.&&vFloorReflection.w>0.){
          vec2 p=vFloorReflection.xy/vFloorReflection.w;
          if(p.x>0.&&p.x<1.&&p.y>0.&&p.y<1.){
            vec2 blur=floorReflectionTexel*1.7;
            vec4 r=texture2D(floorReflectionMap,p)*.4;
            r+=texture2D(floorReflectionMap,p+vec2(blur.x,0.))*.15;
            r+=texture2D(floorReflectionMap,p-vec2(blur.x,0.))*.15;
            r+=texture2D(floorReflectionMap,p+vec2(0.,blur.y))*.15;
            r+=texture2D(floorReflectionMap,p-vec2(0.,blur.y))*.15;
            float angle=abs(normalize(cameraPosition-vFloorWorld).y);
            float weight=r.a*floorReflectionStrength*(.5+.5*pow(1.-angle,3.));
            outgoingLight=mix(outgoingLight,clamp(r.rgb/max(r.a,.001),vec3(0.),vec3(2.)),weight);
          }
        }
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=> 'hoops-live-floor-v1';material.needsUpdate=true;
    for(const floor of floors)if(floor)floor.onBeforeRender=(r,s,c)=>this.update(c);
    this.stats={calls:0,triangles:0,updates:0};this.enabled=true;this.strength=.32;
  }

  setQuality(quality, aspect=1) {
    const width=quality==='low'?256:512;
    const height=Math.max(128,Math.round(width/Math.max(.6,Math.min(2,aspect))));
    if(this.target.width!==width||this.target.height!==height){this.target.setSize(width,height);this.lastFrame=-1;}
    this.uniforms.floorReflectionTexel.value.set(1/width,1/height);
    this.quality=quality;
  }

  update(camera) {
    const r=this.renderer;
    if(this.disposed||this.rendering||this.lastFrame===r.info.render.frame)return;
    this.uniforms.floorReflectionStrength.value=this.enabled&&camera.position.y>.15?this.strength:0;
    if(!this.uniforms.floorReflectionStrength.value)return;
    camera.updateMatrixWorld();const mirror=this.camera;
    mirror.position.copy(camera.position);mirror.position.y=-mirror.position.y;
    const forward=camera.getWorldDirection(new THREE.Vector3()),look=camera.position.clone().add(forward);look.y=-look.y;
    mirror.up.set(0,1,0).transformDirection(camera.matrixWorld);mirror.up.y=-mirror.up.y;
    mirror.lookAt(look);mirror.near=camera.near;mirror.far=camera.far;mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    this.matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
      .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Clip the view at the actual floor plane, preserving projective x/y.
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0).applyMatrix4(mirror.matrixWorldInverse);
    const clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),e=mirror.projectionMatrix.elements;
    const corner=new THREE.Vector4((Math.sign(clip.x)+e[8])/e[0],(Math.sign(clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
    clip.multiplyScalar(2/clip.dot(corner));e[2]=clip.x;e[6]=clip.y;e[10]=clip.z+1-.001;e[14]=clip.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    const saved={target:r.getRenderTarget(),background:this.scene.background,clear:r.getClearColor(new THREE.Color()),
      alpha:r.getClearAlpha(),autoReset:r.info.autoReset,shadow:r.shadowMap.autoUpdate,xr:r.xr.enabled};
    const calls=r.info.render.calls,triangles=r.info.render.triangles,athletes=this.getAthletes();
    this.rendering=true;
    try {
      for(const a of athletes)a.setQuality('low');
      this.scene.background=null;r.setClearColor(0,0);r.info.autoReset=false;r.shadowMap.autoUpdate=false;r.xr.enabled=false;
      r.setRenderTarget(this.target);r.clear();r.render(this.scene,mirror);
      this.stats={calls:r.info.render.calls-calls,triangles:r.info.render.triangles-triangles,updates:this.stats.updates+1};
      this.lastFrame=r.info.render.frame;
    } finally {
      for(const a of athletes)a.setQuality(this.quality||'high');
      this.scene.background=saved.background;r.setClearColor(saved.clear,saved.alpha);
      r.info.autoReset=saved.autoReset;r.shadowMap.autoUpdate=saved.shadow;r.xr.enabled=saved.xr;
      r.setRenderTarget(saved.target);this.rendering=false;
    }
  }

  dispose(){this.disposed=true;this.uniforms.floorReflectionStrength.value=0;this.target.dispose();}
}
