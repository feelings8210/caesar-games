import * as THREE from '../../vendor/three/three.module.min.js';

/** Native-rendered seated humans for the middle/far bowl. Near actors retain
 * their real geometry. View angles select a tile; no per-frame CPU fan loop. */
export function buildCrowdImpostors(root, seats, texture, { seatedAudience = null } = {}) {
  const people=seats.filter(([g,x,y],i)=>i%13!==0 && (g.position.y<1||i%3===0) && !(seatedAudience&&g.position.y<1&&y<2&&i%17!==0));
  people.sort((a,b)=>Math.sin(a[1]*91+a[2]*43+a[3]*17)-Math.sin(b[1]*91+b[2]*43+b[3]*17));
  const plane=new THREE.PlaneGeometry(6.4,6.4);
  const geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index.clone();
  for(const name of ['position','normal','uv'])geometry.setAttribute(name,plane.attributes[name].clone());
  plane.dispose();
  const centres=[],yaws=[],styles=[],brightness=[];
  people.forEach(([g,x,y,z],i)=>{
    const p=new THREE.Vector3(x,y-1.535+2.5,z+.65).applyMatrix4(g.matrixWorld);
    centres.push(...p.toArray());yaws.push(new THREE.Euler().setFromQuaternion(g.getWorldQuaternion(new THREE.Quaternion())).y);
    styles.push(Math.floor((Math.sin(i*127.1+31.7)*.5+.5)*5.999));
    brightness.push(.20+(Math.sin(i*13.7)*.5+.5)*.18);
  });
  geometry.setAttribute('fanCentre',new THREE.InstancedBufferAttribute(new Float32Array(centres),3));
  geometry.setAttribute('fanYaw',new THREE.InstancedBufferAttribute(new Float32Array(yaws),1));
  geometry.setAttribute('fanStyle',new THREE.InstancedBufferAttribute(new Float32Array(styles),1));
  geometry.setAttribute('fanBrightness',new THREE.InstancedBufferAttribute(new Float32Array(brightness),1));
  geometry.instanceCount=people.length;
  texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  const material=new THREE.MeshBasicMaterial({map:texture,alphaTest:.35,side:THREE.DoubleSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute vec3 fanCentre;attribute float fanYaw;attribute float fanStyle;attribute float fanBrightness;
      varying vec2 vCrowdTile;varying float vFanBrightness;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 viewDelta=cameraPosition-fanCentre;
      float yaw=atan(viewDelta.x,viewDelta.z)-fanYaw;
      float col=mod(floor(yaw/0.78539816339+.5)+8.,8.);
      float pitch=atan(viewDelta.y,length(viewDelta.xz));
      float row=fanStyle*2.+step(.3665191429,pitch);
      vCrowdTile=vec2(col,row);vFanBrightness=fanBrightness*(1.-.6*smoothstep(3.,36.,fanCentre.y));`);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
      vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
      vec4 mvPosition=viewMatrix*vec4(fanCentre+right*position.x+up*position.y,1.);
      gl_Position=projectionMatrix*mvPosition;`);
    shader.fragmentShader='varying vec2 vCrowdTile;varying float vFanBrightness;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 tileUV=clamp(vMapUv,vec2(.00390625),vec2(.99609375));
      vec2 atlasUV=vec2((vCrowdTile.x+tileUV.x)/8.,(11.-vCrowdTile.y+tileUV.y)/12.);
      vec4 sampledDiffuseColor=texture2D(map,atlasUV);
      diffuseColor*=sampledDiffuseColor;diffuseColor.rgb*=vFanBrightness;`);
  };
  material.customProgramCacheKey=()=> 'hoops-crowd-multiview-v2';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='AudienceMultiview';mesh.frustumCulled=false;
  mesh.userData.fanCount=people.length;root.add(mesh);
  return {mesh,setQuality(q){geometry.instanceCount=q==='low'?Math.ceil(people.length/2):people.length;},dispose(){texture.dispose();}};
}
