// GLSL ES 3.00
// browsers without webgl2 wont work. they'll get a notice

export const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

export const FRAG = `#version 300 es
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
`
