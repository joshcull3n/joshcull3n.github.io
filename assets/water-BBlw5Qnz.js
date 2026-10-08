import{i as e,n as t,r as n,t as r}from"./jsx-runtime-FZ9Kv8Lg.js";var i=e(n(),1),a=e(t(),1),o=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`,s=`#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;      // real seconds
uniform float uWaterTime; // += delta * speed. so changing speed doesnt cause skipping
uniform vec3  uInk;
uniform vec3  uPaper;
uniform float uScale;
uniform float uBands;
uniform float uLineWidth;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uVolatility;
uniform vec2  uDrift;
uniform float uDither;
uniform float uSeed;
uniform int   uOctaves;
uniform int   uWaves;
uniform float uLineVary;
uniform float uBreakup;
uniform float uFacing;
uniform float uLightAngle;
uniform float uFlow;
uniform float uBend;
uniform float uSwirl;
uniform float uSpin;
uniform float uGrain;
uniform float uSpeckle;
uniform float uTile;

// 37 degree rotation between octaves. without it every octave shares the
// lattice's axes and the grain lines up
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.0001);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// --- tiling ---
// fyi: in tile mode, octaves just double. no rotation

float snapFreq(float f, float period) {
  return period > 0.0 ? max(1.0, floor(f * period + 0.5)) / period : f;
}

float lattice(vec2 i, float period) {
  return hash(period > 0.0 ? mod(i, period) : i);
}

float valueNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = lattice(i, period);
  float b = lattice(i + vec2(1.0, 0.0), period);
  float c = lattice(i + vec2(0.0, 1.0), period);
  float d = lattice(i + vec2(1.0, 1.0), period);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float flowNoise(vec2 p, float period) {
  if (period > 0.0) {
    return valueNoise(p, period) * 0.65 + valueNoise(p * 2.0 + 3.7, period * 2.0) * 0.35;
  }
  return valueNoise(p, 0.0) * 0.65 + valueNoise(ROT * p * 2.03 + 3.7, 0.0) * 0.35;
}

float fbm(vec2 p, float period) {
  float v = 0.0;
  float amp = 0.5;
  float total = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uOctaves) break;
    v += valueNoise(p, period) * amp;
    total += amp;
    if (period > 0.0) {
      p = p * 2.0 + vec2(1.7, 9.2);
      period *= 2.0;
    } else {
      p = ROT * p * 2.0 + vec2(1.7, 9.2);
    }
    amp *= 0.5;
  }
  return v / total;
}

const float BAYER[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

void main() {
  vec2 world = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

  bool tiled = uTile > 0.0;
  float cells = tiled ? max(1.0, floor(uTile / uScale + 0.5)) : 0.0;
  float scale = tiled ? uTile / cells : uScale;

  if (tiled) world = mod(world, uTile);

  float ft = uWaterTime * 0.08;
  float kf = snapFreq(0.45, cells);
  float pf = kf * cells; // flow period
  float k13 = snapFreq(1.3, pf);
  float p13 = k13 * pf;
  vec2 fp = world / scale * kf;
  vec2 flow = vec2(
    flowNoise(fp + vec2(ft, 0.6 * ft), pf) +
      flowNoise(fp * k13 + vec2(11.3, 4.1) + vec2(-0.7 * ft, ft), p13),
    flowNoise(fp + vec2(5.2, 1.3) + vec2(-0.8 * ft, ft), pf) +
      flowNoise(fp * k13 + vec2(-7.9, 13.7) + vec2(ft, 0.5 * ft), p13)
  ) - 1.0;
  vec2 waveWorld = world + flow * uBend * scale * 0.5;

  // sum the per-axis sine warp (independent phases per axis)
  float amp = uAmplitude * pow(max(uVolatility, 0.0), 1.8);
  vec2 d = vec2(0.0);

  for (int i = 0; i < 8; i++) {
    if (i >= uWaves) break;
    float fi = float(i);
    float angleX = fi * 2.399963 + 0.4;
    float angleY = fi * 2.399963 + 1.9;
    float mult = 1.0 + fi * 0.85;

    vec2 kx = vec2(cos(angleX), sin(angleX)) * uFrequency * mult;
    vec2 ky = vec2(cos(angleY), sin(angleY)) * uFrequency * mult;

    // tile mode: snap each wave to a whole number of cycles across the tile
    if (tiled) {
      float q = 6.2831853 / uTile;
      kx = q * floor(kx / q + 0.5);
      ky = q * floor(ky / q + 0.5);
    }
    float ampI = amp / (1.0 + fi * 0.6);

    d.x += ampI * 1.0 * sin(dot(waveWorld, kx) + uWaterTime * (0.7 + fi * 0.31));
    d.y += ampI * 0.8 * sin(dot(waveWorld, ky) + uWaterTime * (0.9 + fi * 0.23));
  }

  if (uSwirl > 0.0 || uSpin != 0.0) {
    float a = uSwirl * flow.x * 3.14159 + uSpin * uWaterTime * 0.15;
    float ca = cos(a), sa = sin(a);
    d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }

  vec2 uv = (world + d + uDrift * uWaterTime) / scale + flow * uFlow;
  float banded = fbm(uv, cells) * uBands;
  float contour = floor(banded + 0.5);
  float distToEdge = abs(banded - contour);
  vec2 grad = vec2(dFdx(banded), dFdy(banded));
  float slope = max(abs(grad.x) + abs(grad.y), 1e-6); // == fwidth(banded)
  float lineSeed = hash(vec2(contour, 17.0));
  float width = uLineWidth;
  float lt = uWaterTime;

  if (uLineVary > 0.0) {
    float kv = snapFreq(2.2, cells);
    float v = valueNoise(uv * kv + lineSeed * 53.0 + vec2(0.07, -0.05) * lt, kv * cells);
    width *= exp2(uLineVary * (v * 2.0 - 1.0) * 1.6);
  }

  if (uFacing > 0.0) {
    vec2 lightDir = vec2(cos(uLightAngle), sin(uLightAngle));
    width *= 1.0 + uFacing * dot(normalize(grad + 1e-6), lightDir);
  }

  // below 1px a line breaks up into scattered dots
  width = max(width, min(uLineWidth, 1.0));
  float intensity = clamp(1.0 - (distToEdge / slope) / max(width, 0.02), 0.0, 1.0);

  if (uBreakup > 0.0) {
    float kb = snapFreq(1.35, cells);
    float pb = kb * cells;
    vec2 mp = uv * kb + lineSeed * 113.0;
    float m = 0.5 * (valueNoise(mp + vec2(19.0, 7.0) + vec2(0.11, 0.06) * lt, pb)
                   + valueNoise(mp + vec2(-4.0, 31.0) + vec2(-0.08, 0.10) * lt, pb));
    m = clamp(0.5 + (m - 0.5) * 1.5, 0.0, 1.0);
    float cut = uBreakup * 0.78;
    intensity *= smoothstep(cut, cut + 0.14, m);
  }

  ivec2 bc = ivec2(mod(gl_FragCoord.xy, 4.0));
  float bayer = BAYER[bc.y * 4 + bc.x] / 16.0;
  float threshold = 0.5 + (bayer - 0.5) * uDither;

  // noise. re-rolled 24 times a second 
  float frame = mod(floor(uTime * 24.0), 997.0);
  vec2 cell = tiled ? mod(floor(gl_FragCoord.xy), uTile) : gl_FragCoord.xy;
  vec2 np = cell + frame * vec2(37.0, 113.0);

  if (uGrain > 0.0) threshold += (hash(np) - 0.5) * uGrain * 2.4;

  bool on = intensity > 0.0 && intensity > threshold;

  if (uSpeckle > 0.0) {
    float px = distToEdge / slope;
    float near = clamp(1.0 - px / (max(width, 0.5) * 8.0), 0.0, 1.0);
    float density = uSpeckle * uSpeckle * (0.004 + 0.06 * near * near);
    if (hash(np + vec2(71.0, 19.0)) < density) on = true;
  }

  fragColor = vec4(on ? uInk : uPaper, 1.0);
}
`,c={pixelSize:1,tile:0,ink:`#ffccd4`,paper:`#000000`,inkOpacity:1,scale:30,bands:4,octaves:5,lineWidth:3.5,lineVary:1,breakup:.5,facing:.6,lightAngle:135,waves:8,amplitude:8.6,frequency:.01,volatility:1.95,flow:1.5,bend:.5,swirl:.8,spin:.8,grain:0,speckle:0,speed:1,driftX:.5,driftY:.2,dither:1,seed:1337};function l(e){let t=e.replace(`#`,``),n=t.length===3?t.split(``).map(e=>e+e).join(``):t,r=parseInt(n,16);return[r>>16&255,r>>8&255,r&255]}function u(e){let t=l(e.ink),n=l(e.paper),r=e.inkOpacity??1;return t.map((e,t)=>Math.round(n[t]+(e-n[t])*r))}var d={scale:{label:`scale`,min:6,max:160,step:1,group:`field`},bands:{label:`bands`,min:1,max:16,step:.1,group:`field`},octaves:{label:`octaves`,min:1,max:5,step:1,group:`field`,int:!0},lineWidth:{label:`width (px)`,min:.3,max:5,step:.05,group:`line`},lineVary:{label:`vary`,min:0,max:1,step:.01,group:`line`},breakup:{label:`breakup`,min:0,max:1,step:.01,group:`line`},facing:{label:`facing`,min:0,max:1.5,step:.01,group:`line`,advanced:!0},lightAngle:{label:`light angle`,min:0,max:360,step:1,group:`line`,advanced:!0},volatility:{label:`volatility`,min:0,max:6,step:.05,group:`waves`},amplitude:{label:`amplitude`,min:0,max:40,step:.1,group:`waves`},frequency:{label:`frequency`,min:.005,max:.4,step:.005,group:`waves`},waves:{label:`wave count`,min:1,max:8,step:1,group:`waves`,int:!0},flow:{label:`flow`,min:0,max:3,step:.01,group:`flow`},bend:{label:`bend`,min:0,max:3,step:.01,group:`flow`},swirl:{label:`swirl`,min:0,max:1.5,step:.01,group:`flow`},spin:{label:`spin`,min:-3,max:3,step:.01,group:`flow`},grain:{label:`grain`,min:0,max:1,step:.01,group:`noise`},speckle:{label:`speckle`,min:0,max:1,step:.01,group:`noise`},speed:{label:`speed`,min:0,max:6,step:.05,group:`time`},driftX:{label:`drift x`,min:-8,max:8,step:.05,group:`time`},driftY:{label:`drift y`,min:-8,max:8,step:.05,group:`time`},inkOpacity:{label:`ink opacity`,min:0,max:1,step:.01,group:`output`},pixelSize:{label:`pixel size`,min:1,max:16,step:1,group:`output`,int:!0,modulatable:!1},dither:{label:`dither`,min:0,max:1,step:.02,group:`output`}},f=[`field`,`line`,`waves`,`flow`,`noise`,`time`,`output`],p=e=>Object.entries(d).filter(([,t])=>t.group===e).map(([e,t])=>({key:e,...t})),m=Object.entries(d).filter(([,e])=>e.modulatable!==!1).map(([e])=>e),h=[`sine`,`triangle`,`saw`,`square`,`random`,`steps`];function g(e){let t=Math.imul((e|0)+2654435769,374761393);return t=Math.imul(t^t>>>13,1274126177),((t^t>>>16)>>>0)/4294967296}function _(e,t){switch(e){case`triangle`:return 4*Math.abs(t-Math.floor(t+.5))-1;case`saw`:return 2*(t-Math.floor(t))-1;case`square`:return t-Math.floor(t)<.5?1:-1;case`random`:{let e=Math.floor(t),n=t-e,r=g(e-1)*2-1,i=g(e)*2-1,a=g(e+1)*2-1,o=g(e+2)*2-1,s=.5*(2*i+(a-r)*n+(2*r-5*i+4*a-o)*n*n+(3*i-r-3*a+o)*n*n*n);return s<-1?-1:s>1?1:s}case`steps`:return g(Math.floor(t))*2-1;default:return Math.sin(t*Math.PI*2)}}var v=(e,t={})=>({id:`${e}-${Math.floor(Math.random()*1e9).toString(36)}`,target:e,shape:`sine`,rate:.15,depth:.3,phase:0,enabled:!0,...t});function y(e,t,n){if(!t||t.length===0)return e;let r=null;for(let i of t){if(!i.enabled||i.depth===0)continue;let t=d[i.target];if(!t)continue;r===null&&(r={...e});let a=t.max-t.min,o=_(i.shape,n*i.rate+i.phase),s=(r[i.target]??e[i.target])+o*i.depth*a*.5;s<t.min?s=t.min:s>t.max&&(s=t.max),t.int&&(s=Math.round(s)),r[i.target]=s}return r===null?e:r}var b=r(),x=`uResolution.uTime.uInk.uPaper.uScale.uBands.uLineWidth.uAmplitude.uFrequency.uVolatility.uWaterTime.uDrift.uDither.uSeed.uOctaves.uWaves.uLineVary.uBreakup.uFacing.uLightAngle.uFlow.uBend.uSwirl.uSpin.uGrain.uSpeckle.uTile`.split(`.`);function S(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`shader compile failed: ${t}`)}return r}function C(e){let t=S(e,e.VERTEX_SHADER,o),n=S(e,e.FRAGMENT_SHADER,s),r=e.createProgram();if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),e.deleteShader(t),e.deleteShader(n),!e.getProgramParameter(r,e.LINK_STATUS)){let t=e.getProgramInfoLog(r);throw e.deleteProgram(r),Error(`program link failed: ${t}`)}return r}var w=e=>l(e).map(e=>e/255),T=()=>new URLSearchParams(window.location.search).has(`nogl`),E=({className:e,style:t})=>(0,b.jsx)(`div`,{className:e,style:{display:`flex`,alignItems:`center`,justifyContent:`center`,width:`100%`,height:`100%`,background:`#000`,color:`rgba(255, 255, 255, 0.7)`,fontFamily:`'Departure Mono', ui-monospace, monospace`,fontSize:`13px`,...t},children:`your browser doesn’t support webgl2`}),D=({params:e,lfos:t,paused:n=!1,onFallback:r,className:a,style:o})=>{let s=(0,i.useRef)(null),l=(0,i.useRef)(e),d=(0,i.useRef)(t),f=(0,i.useRef)(n),[p,m]=(0,i.useState)(!1);return l.current=e,d.current=t,f.current=n,(0,i.useEffect)(()=>{let e=s.current;if(!e)return;let t=T()?null:e.getContext(`webgl2`,{antialias:!1,alpha:!1});if(!t){m(!0),r?.(`WebGL2 unavailable`);return}let n;try{n=C(t)}catch(e){m(!0),r?.(e.message);return}let i={};for(let e of x)i[e]=t.getUniformLocation(n,e);t.useProgram(n);let a=null,o=0,p=0,h=null,g=n=>{h===null&&(h=n);let r=f.current?0:(n-h)/1e3;h=n,o+=r;let s=y({...c,...l.current},d.current,o);p+=r*s.speed;let m=Math.max(1,s.pixelSize||1),_=e.getBoundingClientRect(),v=Math.max(1,Math.ceil(_.width/m)),b=Math.max(1,Math.ceil(_.height/m));(e.width!==v||e.height!==b)&&(e.width=v,e.height=b),t.viewport(0,0,v,b),t.uniform2f(i.uResolution,v,b),t.uniform1f(i.uTime,o),t.uniform3fv(i.uInk,u(s).map(e=>e/255)),t.uniform3fv(i.uPaper,w(s.paper)),t.uniform1f(i.uScale,s.scale),t.uniform1f(i.uBands,s.bands),t.uniform1f(i.uLineWidth,s.lineWidth),t.uniform1f(i.uAmplitude,s.amplitude),t.uniform1f(i.uFrequency,s.frequency),t.uniform1f(i.uVolatility,s.volatility),t.uniform1f(i.uWaterTime,p),t.uniform2f(i.uDrift,s.driftX,s.driftY),t.uniform1f(i.uDither,s.dither),t.uniform1f(i.uSeed,s.seed),t.uniform1i(i.uOctaves,s.octaves),t.uniform1i(i.uWaves,s.waves),t.uniform1f(i.uLineVary,s.lineVary),t.uniform1f(i.uBreakup,s.breakup),t.uniform1f(i.uFacing,s.facing),t.uniform1f(i.uLightAngle,s.lightAngle*Math.PI/180),t.uniform1f(i.uFlow,s.flow),t.uniform1f(i.uBend,s.bend),t.uniform1f(i.uSwirl,s.swirl),t.uniform1f(i.uSpin,s.spin),t.uniform1f(i.uGrain,s.grain),t.uniform1f(i.uSpeckle,s.speckle),t.uniform1f(i.uTile,s.tile||0),t.drawArrays(t.TRIANGLES,0,3),a=requestAnimationFrame(g)};return a=requestAnimationFrame(g),()=>{a!==null&&cancelAnimationFrame(a),t.deleteProgram(n)}},[r]),p?(0,b.jsx)(E,{className:a,style:o}):(0,b.jsx)(`canvas`,{ref:s,className:a,style:{display:`block`,width:`100%`,height:`100%`,imageRendering:`pixelated`,...o}})},O={scale:100,bands:3,octaves:4,lineWidth:2.5,lineVary:0,breakup:.4,facing:.85,lightAngle:135,waves:4,amplitude:10,frequency:.1,volatility:1.6,flow:2.5,bend:.6,swirl:.5,spin:1,grain:0,speckle:0,speed:.5,driftX:1,driftY:.4,dither:.2,inkOpacity:1},k=e=>({...O,ink:`#ffffff`,paper:`#000000`,...e}),A={organic:k({scale:30,bands:4,octaves:5,lineWidth:3.5,lineVary:1,breakup:.5,facing:.6,lightAngle:135,waves:8,amplitude:8.6,frequency:.01,volatility:1.95,flow:1.5,bend:.5,swirl:.8,spin:.8,grain:0,speckle:0,speed:1,driftX:.5,driftY:.2,dither:1,inkOpacity:1,ink:`#ffccd4`,lfos:[[`amplitude`,{shape:`sine`,rate:.12,depth:.37,phase:0}]]}),drift:k({}),ocean:k({scale:30,bands:4,octaves:5,lineWidth:3.5,lineVary:1,breakup:.5,facing:.6,waves:4,amplitude:6,frequency:.12,volatility:1,flow:1.5,bend:.5,swirl:.8,spin:.8,speed:1,driftX:.5,driftY:.2,dither:.4,paper:`#009eff`}),eddy:k({scale:121,bands:3.9,octaves:5,lineWidth:.844,lineVary:.24,breakup:.693,facing:1.169,lightAngle:257,waves:2,amplitude:32.364,frequency:.148,volatility:.652,flow:2.449,bend:2.418,swirl:.127,spin:-1.821,grain:.47,speckle:0,speed:1.782,driftX:.653,driftY:.669,dither:.135,inkOpacity:1,lfos:[[`bands`,{shape:`triangle`,rate:.064,depth:.314,phase:.187}]]}),current:k({scale:110,bands:4,lineWidth:2,lineVary:.8,breakup:.35,facing:1.4,lightAngle:180,waves:2,amplitude:8,frequency:.05,volatility:1.2,flow:1,bend:2.5,swirl:0,spin:0,speed:1,driftX:6,driftY:1.2,dither:0}),paramour:k({scale:60,bands:6,octaves:3,lineWidth:1.8,lineVary:1,breakup:.3,facing:1,waves:5,amplitude:6,frequency:.07,volatility:2.2,flow:3,bend:1,swirl:1.5,spin:.6,speed:2.5,driftX:-.8,driftY:.6,dither:.1,ink:`#ff5ccb`,lfos:[[`volatility`,{shape:`random`,rate:.25,depth:.15}]]}),static:k({scale:30,bands:2.4,octaves:5,lineWidth:3.5,lineVary:1,breakup:.5,facing:.6,lightAngle:135,waves:4,amplitude:6,frequency:.12,volatility:1,flow:1.5,bend:.5,swirl:.8,spin:.8,grain:.3,speckle:.2,speed:1,driftX:.5,driftY:.2,dither:1,inkOpacity:1}),abyss:k({scale:120,bands:2,lineWidth:1.5,lineVary:.9,breakup:.75,facing:1.3,lightAngle:270,waves:2,amplitude:6,frequency:.06,volatility:1,flow:2,bend:.6,swirl:.4,spin:.667,speed:.6,driftX:.333,driftY:1,dither:0,lfos:[[`breakup`,{rate:.03,depth:.3}]]}),ether:k({scale:52,bands:1,octaves:5,lineWidth:5,lineVary:1,breakup:0,facing:0,lightAngle:0,waves:1,amplitude:0,frequency:.01,volatility:0,flow:3,bend:0,swirl:0,spin:0,grain:0,speckle:0,speed:.5,driftX:0,driftY:0,dither:1,inkOpacity:1}),contour:k({lineWidth:1.3,lineVary:0,breakup:0,facing:0,flow:0,bend:0,swirl:0,spin:0,dither:0})},j=(e,t)=>e+Math.random()*(t-e),M=(e,t)=>Math.floor(j(e,t+1)),N=(e,t)=>Math.exp(j(Math.log(e),Math.log(t))),P=e=>e[Math.floor(Math.random()*e.length)],F=(e,t)=>Math.random()<e?t():0,I=[`lightAngle`,`bands`,`breakup`,`swirl`,`spin`,`volatility`,`speckle`,`flow`];function L(){let e=N(.03,.15),t=j(.6,2.4),n=j(.3,3),r=Math.min(40,n/(e*t**1.8)),i=Math.round(N(25,160)),a=j(1.5,8),o=Math.min(j(.8,4),.4*i/a);return{scale:i,bands:a,octaves:M(2,5),lineWidth:o,lineVary:j(0,1),breakup:j(0,.7),facing:j(0,1.5),lightAngle:Math.round(j(0,360)),waves:M(2,6),amplitude:r,frequency:e,volatility:t,flow:j(.5,3),bend:j(0,2.5),swirl:j(0,1.5),spin:Math.sign(Math.random()-.5)*Math.random()**2*2.5,speed:j(.4,2.5),driftX:Math.sign(Math.random()-.5)*Math.random()**2*4,driftY:Math.sign(Math.random()-.5)*Math.random()**2*4,dither:F(.5,()=>j(0,1)),grain:F(.4,()=>j(0,.5)),speckle:F(.4,()=>j(0,.5)),seed:M(0,99999),lfos:Array.from({length:M(0,2)},()=>[P(I),{shape:P([`sine`,`triangle`,`random`]),rate:j(.02,.15),depth:j(.1,.35),phase:Math.random()}])}}var R=e=>typeof e==`number`?Math.round(e*1e3)/1e3:e;function z(e,t){let n=Object.fromEntries(Object.entries(e).map(([e,t])=>[e,R(t)]));return n.lfos=t.map(({target:e,shape:t,rate:n,depth:r,phase:i,enabled:a})=>[e,{shape:t,rate:R(n),depth:R(r),phase:R(i),...a?{}:{enabled:!1}}]),n}var B=[64,128,256,512,1024,2048],V=512,H=`M4 0h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM0 4h10v1h-10zM1 5h1v1h-1zM9 5h1v1h-1zM2 6h1v1h-1zM9 6h1v1h-1zM3 7h1v1h-1zM9 7h1v1h-1zM4 8h1v1h-1zM9 8h1v1h-1zM9 9h1v1h-1zM9 10h1v1h-1zM9 11h1v1h-1zM9 12h1v1h-1zM9 13h1v1h-1zM9 14h1v1h-1zM9 15h1v1h-1zM9 16h1v1h-1zM4 17h1v1h-1zM9 17h1v1h-1zM3 18h1v1h-1zM9 18h1v1h-1zM2 19h1v1h-1zM9 19h1v1h-1zM1 20h1v1h-1zM9 20h1v1h-1zM0 21h10v1h-10zM1 22h1v1h-1zM2 23h1v1h-1zM3 24h1v1h-1zM4 25h1v1h-1z`,U=()=>(0,b.jsx)(`svg`,{width:`10`,height:`26`,viewBox:`0 0 10 26`,shapeRendering:`crispEdges`,"aria-hidden":`true`,style:{display:`block`},children:(0,b.jsx)(`path`,{d:H,fill:`currentColor`})}),W=()=>(A.organic.lfos??[]).map(([e,t])=>v(e,t)),G=(e,t)=>typeof e==`number`?Math.abs(e-t)<1e-6:e===t;function K(e,t,n){let{lfos:r=[],...i}=e;return!Object.entries(i).every(([e,n])=>G(n,t[e]))||r.length!==n.length?!1:r.every(([e,t],r)=>{let i=v(e,t);return[`target`,`shape`,`rate`,`depth`,`phase`,`enabled`].every(e=>G(i[e],n[r][e]))})}a.createRoot(document.getElementById(`root`)).render((0,b.jsx)(()=>{let[e,t]=(0,i.useState)({...c}),[n,r]=(0,i.useState)(!0),[a,o]=(0,i.useState)(!1),[s,l]=(0,i.useState)(0),[u,g]=(0,i.useState)(null),[_,y]=(0,i.useState)(!0),[x,S]=(0,i.useState)(V),[C,w]=(0,i.useState)(W),[T,E]=(0,i.useState)(`organic`),O=e.tile>0,k=(e,n)=>t(t=>({...t,[e]:n})),j=e=>{let{lfos:n=[],...r}=A[e];t(e=>({...c,...r,pixelSize:e.pixelSize,tile:e.tile,seed:r.seed??e.seed})),w(n.map(([e,t])=>v(e,t))),E(e)},M=()=>{let{lfos:e,...n}=L();t(e=>({...e,...n})),w(e.map(([e,t])=>v(e,t))),E(null)},N=()=>w(e=>[...e,v(`volatility`,{phase:e.length*.25%1})]),P=(e,t)=>w(n=>n.map(n=>n.id===e?{...n,...t}:n)),F=e=>w(t=>t.filter(t=>t.id!==e)),I=new Set(C.filter(e=>e.enabled&&e.depth>0).map(e=>e.target)),R=({key:t,label:n,min:r,max:i,step:a})=>(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsxs)(`label`,{htmlFor:t,children:[I.has(t)?(0,b.jsx)(`span`,{className:`mod-dot`,children:`~`}):null,n]}),(0,b.jsx)(`span`,{className:`value`,children:Number(e[t]).toFixed(a<1?2:0)}),(0,b.jsx)(`input`,{id:t,type:`range`,min:r,max:i,step:a,value:e[t],onChange:e=>k(t,parseFloat(e.target.value))})]},t),H=(0,i.useRef)(0);(0,i.useEffect)(()=>{let e,t=performance.now(),n=r=>{H.current+=1,r-t>=500&&(l(Math.round(H.current*1e3/(r-t))),H.current=0,t=r),e=requestAnimationFrame(n)};return e=requestAnimationFrame(n),()=>cancelAnimationFrame(e)},[]);let G=(0,b.jsx)(`div`,{className:`water`,children:(0,b.jsx)(D,{params:e,lfos:C,paused:a,onFallback:g})});return u?(0,b.jsx)(`div`,{className:`page`,children:G}):(0,b.jsxs)(`div`,{className:`page`,children:[G,O&&_?(0,b.jsx)(`div`,{className:`grid`,style:{backgroundSize:`${e.tile*e.pixelSize}px ${e.tile*e.pixelSize}px`}}):null,(0,b.jsxs)(`div`,{className:`fps`,children:[s,` fps`]}),(0,b.jsx)(`button`,{className:`toggle`,onClick:()=>r(e=>!e),children:n?`hide`:`controls`}),(0,b.jsxs)(`div`,{className:`panel${n?``:` is-hidden`}`,children:[(0,b.jsx)(`h3`,{children:`texture generator`}),(0,b.jsxs)(`div`,{className:`presets`,children:[(0,b.jsx)(`div`,{className:`buttons`,children:Object.keys(A).map(t=>(0,b.jsx)(`button`,{className:`btn${t===T?K(A[t],e,C)?` is-active`:` is-modified`:``}`,onClick:()=>j(t),children:t},t))}),(0,b.jsx)(`div`,{className:`buttons`,children:(0,b.jsx)(`button`,{className:`btn`,onClick:M,children:`random`})})]}),(0,b.jsxs)(`fieldset`,{className:`group`,children:[(0,b.jsx)(`legend`,{className:`legend`,children:`output`}),(0,b.jsxs)(`div`,{className:`palette`,children:[(0,b.jsxs)(`div`,{className:`palette-pickers`,children:[(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{htmlFor:`ink`,children:`ink`}),(0,b.jsx)(`input`,{id:`ink`,type:`color`,value:e.ink,onChange:e=>k(`ink`,e.target.value)})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{htmlFor:`paper`,children:`paper`}),(0,b.jsx)(`input`,{id:`paper`,type:`color`,value:e.paper,onChange:e=>k(`paper`,e.target.value)})]})]}),(0,b.jsx)(`button`,{className:`btn btn--mini`,onClick:()=>t(e=>({...e,ink:e.paper,paper:e.ink})),"aria-label":`swap ink and paper`,children:(0,b.jsx)(U,{})})]}),(0,b.jsx)(`div`,{className:`spacer`}),p(`output`).map(R),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{htmlFor:`tile`,children:`tile`}),(0,b.jsx)(`input`,{id:`tile`,type:`checkbox`,checked:e.tile>0,onChange:e=>k(`tile`,e.target.checked?x:0)})]}),e.tile>0?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{htmlFor:`tileSize`,children:`size (px)`}),(0,b.jsx)(`select`,{id:`tileSize`,className:`select`,value:e.tile,onChange:e=>{let t=Number(e.target.value);S(t),k(`tile`,t)},children:B.map(e=>(0,b.jsx)(`option`,{value:e,children:e},e))})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{htmlFor:`grid`,children:`show grid`}),(0,b.jsx)(`input`,{id:`grid`,type:`checkbox`,checked:_,onChange:e=>y(e.target.checked)})]})]}):null]}),f.filter(e=>e!==`output`).map(e=>{let t=p(e),n=t.filter(e=>!e.advanced),r=t.filter(e=>e.advanced);return(0,b.jsxs)(`fieldset`,{className:`group`,children:[(0,b.jsx)(`legend`,{className:`legend`,children:e}),n.map(R),r.length>0?(0,b.jsxs)(`details`,{className:`more`,children:[(0,b.jsx)(`summary`,{children:`more`}),r.map(R)]}):null]},e)}),(0,b.jsxs)(`fieldset`,{className:`group`,children:[(0,b.jsx)(`legend`,{className:`legend`,children:`modulation`}),C.length===0?(0,b.jsx)(`p`,{className:`hint`,style:{margin:`6px 0`},children:`no lfos. add one and point it at any parameter.`}):null,C.map((e,t)=>(0,b.jsxs)(`div`,{className:`lfo`,children:[(0,b.jsxs)(`div`,{className:`lfo-head`,children:[(0,b.jsxs)(`span`,{className:`lfo-name`,children:[`lfo `,t+1]}),(0,b.jsxs)(`label`,{className:`lfo-enable`,children:[(0,b.jsx)(`input`,{type:`checkbox`,checked:e.enabled,onChange:t=>P(e.id,{enabled:t.target.checked})}),`on`]}),(0,b.jsx)(`button`,{className:`btn btn--tiny`,onClick:()=>F(e.id),"aria-label":`remove lfo ${t+1}`,children:`×`})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{children:`target`}),(0,b.jsx)(`select`,{className:`select`,value:e.target,onChange:t=>P(e.id,{target:t.target.value}),children:m.map(e=>(0,b.jsx)(`option`,{value:e,children:d[e].label},e))})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{children:`shape`}),(0,b.jsx)(`select`,{className:`select`,value:e.shape,onChange:t=>P(e.id,{shape:t.target.value}),children:h.map(e=>(0,b.jsx)(`option`,{value:e,children:e},e))})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{children:`rate`}),(0,b.jsxs)(`span`,{className:`value`,children:[e.rate.toFixed(2),` hz`]}),(0,b.jsx)(`input`,{type:`range`,min:.01,max:16,step:.01,value:e.rate,onChange:t=>P(e.id,{rate:parseFloat(t.target.value)})})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{children:`depth`}),(0,b.jsxs)(`span`,{className:`value`,children:[Math.round(e.depth*100),`%`]}),(0,b.jsx)(`input`,{type:`range`,min:0,max:1,step:.01,value:e.depth,onChange:t=>P(e.id,{depth:parseFloat(t.target.value)})})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`label`,{children:`phase`}),(0,b.jsxs)(`span`,{className:`value`,children:[Math.round(e.phase*360),`°`]}),(0,b.jsx)(`input`,{type:`range`,min:0,max:1,step:.01,value:e.phase,onChange:t=>P(e.id,{phase:parseFloat(t.target.value)})})]})]},e.id)),(0,b.jsx)(`div`,{className:`buttons`,children:(0,b.jsx)(`button`,{className:`btn`,onClick:N,children:`+ add lfo`})})]}),(0,b.jsxs)(`fieldset`,{className:`group`,children:[(0,b.jsx)(`legend`,{className:`legend`,children:`actions`}),(0,b.jsxs)(`div`,{className:`buttons`,children:[(0,b.jsx)(`button`,{className:`btn`,onClick:()=>o(e=>!e),children:a?`play`:`pause`}),(0,b.jsx)(`button`,{className:`btn`,onClick:()=>k(`seed`,Math.floor(Math.random()*1e5)),children:`reseed`}),(0,b.jsx)(`button`,{className:`btn`,onClick:()=>{t({...c}),w(W()),E(`organic`)},children:`reset`}),(0,b.jsx)(`button`,{className:`btn`,onClick:()=>{navigator.clipboard?.writeText(JSON.stringify(z(e,C),null,2))},children:`copy config`})]})]})]})]})},{}));