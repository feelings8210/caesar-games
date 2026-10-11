/* Original material details in anatomical rest coordinates. Fine texture
 * fades with screen footprint, avoiding moire on distant mobile players. */
export function athleteSurface(material,slot,side) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSurfaceRest;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSurfaceRest=position;');
    shader.fragmentShader='varying vec3 vSurfaceRest;\n'+shader.fragmentShader;
    let detail='';
    if(slot==='Skin')detail=`
      float footprint=length(fwidth(vSurfaceRest));
      float fine=1.0-smoothstep(.006,.035,footprint);
      float grain=fract(sin(dot(floor(vSurfaceRest*220.0),vec3(127.1,311.7,74.7)))*43758.5453)*2.0-1.0;
      diffuseColor.rgb*=1.0+.018*grain*fine;
      float lip=exp(-pow(vSurfaceRest.x/.14,4.0)-pow((vSurfaceRest.y-5.88)/.055,4.0))*smoothstep(.34,.41,vSurfaceRest.z);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.85,.63,.61),lip*.32);`;
    if(slot==='Hair')detail=`
      float fine=1.0-smoothstep(.008,.06,length(fwidth(vSurfaceRest)));
      float crop=fract(sin(dot(floor(vSurfaceRest*260.0),vec3(127.1,311.7,74.7)))*43758.5453)*2.0-1.0;
      diffuseColor.rgb*=1.0+.22*crop*fine;`;
    if(slot==='Shoe')detail=`
      float sole=1.0-smoothstep(.04,.095,vSurfaceRest.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.14,.17),sole*.72);
      float lace=step(.15,vSurfaceRest.y)*(1.0-step(.40,vSurfaceRest.y))*step(.08,vSurfaceRest.z);
      lace*=smoothstep(.55,.85,sin(vSurfaceRest.z*69.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${side==='o'?'.17,.27,.42':'.75,.76,.72'}),lace*.48);`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
  };
  material.customProgramCacheKey=()=>`hoops-surface-${slot}-${side}-1`;
}
