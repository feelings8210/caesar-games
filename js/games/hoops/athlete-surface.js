/* Original material details in anatomical rest coordinates. Fine texture
 * fades with screen footprint, avoiding moire on distant mobile players. */
export function athleteSurface(material,slot,side,{refined=false}={}) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vSurfaceRest;varying vec3 vSurfaceNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSurfaceRest=position;vSurfaceNormal=normal;');
    shader.fragmentShader='varying vec3 vSurfaceRest;varying vec3 vSurfaceNormal;\n'+shader.fragmentShader;
    let detail='';
    if(slot==='Skin')detail=`
      float footprint=length(fwidth(vSurfaceRest));
      float fine=1.0-smoothstep(.006,.035,footprint);
      float grain=fract(sin(dot(floor(vSurfaceRest*220.0),vec3(127.1,311.7,74.7)))*43758.5453)*2.0-1.0;
      diffuseColor.rgb*=1.0+.018*grain*fine;
      float lip=exp(-pow(vSurfaceRest.x/.14,4.0)-pow((vSurfaceRest.y-5.88)/.055,4.0))*smoothstep(.34,.41,vSurfaceRest.z);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.85,.63,.61),lip*.32);`;
    if(slot==='Skin'&&refined){
      if(material.bumpMap)shader.uniforms.skinMicroMap={value:material.bumpMap};
      shader.fragmentShader=`
        #ifdef USE_BUMPMAP
        uniform sampler2D skinMicroMap;
        float skinMicroHeight(vec3 p,vec3 n){
          vec3 w=pow(abs(normalize(n)),vec3(5.))+vec3(.0001);w/=w.x+w.y+w.z;
          return texture2D(skinMicroMap,p.zy*8.).r*w.x+texture2D(skinMicroMap,p.xz*8.).r*w.y+texture2D(skinMicroMap,p.xy*8.).r*w.z;
        }
        #endif\n`+shader.fragmentShader;
      detail=`
        float front=smoothstep(.28,.40,vSurfaceRest.z)*smoothstep(5.65,5.75,vSurfaceRest.y);
        float cheek=exp(-pow((abs(vSurfaceRest.x)-.19)/.11,2.)-pow((vSurfaceRest.y-5.99)/.12,2.))*front;
        float nose=exp(-pow(vSurfaceRest.x/.09,2.)-pow((vSurfaceRest.y-6.04)/.1,2.))*front;
        float ear=smoothstep(.26,.34,abs(vSurfaceRest.x))*exp(-pow((vSurfaceRest.y-6.07)/.18,2.));
        float warmth=min(1.,cheek*.75+nose*.45+ear*.8);
        diffuseColor.rgb*=vec3(1.+.06*warmth,1.-.035*warmth,1.-.06*warmth);
        float lip=exp(-pow(vSurfaceRest.x/.14,4.)-pow((vSurfaceRest.y-5.88)/.055,4.))*front;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.85,.63,.61),lip*.32);`;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        #ifdef USE_BUMPMAP
        float microHeight=skinMicroHeight(vSurfaceRest,vSurfaceNormal);
        normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(microHeight),dFdy(microHeight))*bumpScale,faceDirection);
        #endif`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
        float roughnessFactor=roughness;
        #ifdef USE_BUMPMAP
        roughnessFactor*=.74+(skinMicroHeight(vSurfaceRest,vSurfaceNormal)-.5)*.5;
        #endif
        float tzone=exp(-pow(vSurfaceRest.x/.16,2.)-pow((vSurfaceRest.y-6.15)/.2,2.))*smoothstep(.28,.42,vSurfaceRest.z);
        roughnessFactor=max(.3,roughnessFactor-.065*tzone);`);
    }
    if(slot==='Hair')detail=`
      float fine=1.0-smoothstep(.008,.06,length(fwidth(vSurfaceRest)));
      float crop=fract(sin(dot(floor(vSurfaceRest*260.0),vec3(127.1,311.7,74.7)))*43758.5453)*2.0-1.0;
      diffuseColor.rgb*=1.0+.22*crop*fine;`;
    if(slot==='Hair'&&refined)detail=`
      float fine=1.-smoothstep(.006,.035,length(fwidth(vSurfaceRest)));
      float crop=fract(sin(dot(floor(vSurfaceRest*290.),vec3(127.1,311.7,74.7)))*43758.5453)*2.-1.;
      diffuseColor.rgb*=1.+fine*.12*crop;`;
    if(slot==='EyeIris'&&refined)detail=`
      vec2 p=vec2(abs(vSurfaceRest.x)-.1251,vSurfaceRest.y-6.04707)/.024;
      float radius=length(p),angle=atan(p.y,p.x);
      float fine=1.-smoothstep(.03,.3,length(fwidth(p)));
      float fibre=sin(angle*37.+sin(angle*13.)*2.+radius*27.);
      float limbal=smoothstep(.72,1.,radius);
      diffuseColor.rgb*=1.+fine*.24*fibre;
      diffuseColor.rgb*=1.-limbal*.48;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.3,1.12,.75),(1.-smoothstep(.25,.55,radius))*.2);`;
    if(slot==='EyeSclera'&&refined)detail=`
      float corner=smoothstep(.025,.045,abs(abs(vSurfaceRest.x)-.1251));
      diffuseColor.rgb*=vec3(1.+corner*.04,1.-corner*.07,1.-corner*.07);`;
    if(slot==='Shoe')detail=`
      float sole=1.0-smoothstep(.04,.095,vSurfaceRest.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.14,.17),sole*.72);
      float lace=step(.15,vSurfaceRest.y)*(1.0-step(.40,vSurfaceRest.y))*step(.08,vSurfaceRest.z);
      lace*=smoothstep(.55,.85,sin(vSurfaceRest.z*69.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${side==='o'?'.17,.27,.42':'.75,.76,.72'}),lace*.48);`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
  };
  material.customProgramCacheKey=()=>`hoops-surface-${slot}-${side}-${refined?2:1}`;
}
