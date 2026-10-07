// GLSL ES 3.00. The fragment shader is a direct transcription of the
// reference breakdown — the same five steps, just running per-fragment on the
// GPU instead of per-pixel on the CPU.

// No vertex buffer: gl_VertexID generates a fullscreen triangle.
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
uniform float uTime;
uniform vec3  uInk;
uniform vec3  uPaper;
uniform float uScale;
uniform float uBands;
uniform float uLineWidth;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uVolatility;
uniform float uSpeed;
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
uniform float uGrain;
uniform float uSpeckle;

// ~37 degree rotation between octaves. Without it every octave shares the
// lattice's axes and the grain lines up into faint horizontals/verticals.
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.0001);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Cheap two-octave noise for the flow field — it only needs broad shapes.
float flowNoise(vec2 p) {
  return valueNoise(p) * 0.65 + valueNoise(ROT * p * 2.03 + 3.7) * 0.35;
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  float total = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uOctaves) break;
    v += valueNoise(p) * amp;
    total += amp;
    p = ROT * p * 2.0 + vec2(1.7, 9.2);
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
  // Flip Y so the field matches the CPU renderer's top-left origin.
  vec2 world = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

  // --- flow: a slow, broad, *evolving* vector field ---
  //
  // The sine warp only oscillates in place and drift only translates, so on
  // their own nothing ever changes the field: a plateau with no contours in
  // it stays empty forever, and the waves read as straight plane waves. The
  // flow field fixes both. Each component sums two layers moving in different
  // directions, so it morphs rather than slides. Range is roughly [-1, 1].
  float ft = uTime * uSpeed * 0.08;
  vec2 fp = world / uScale * 0.45;
  vec2 flow = vec2(
    flowNoise(fp + vec2(ft, 0.6 * ft)) +
      flowNoise(fp * 1.3 + vec2(11.3, 4.1) + vec2(-0.7 * ft, ft)),
    flowNoise(fp + vec2(5.2, 1.3) + vec2(-0.8 * ft, ft)) +
      flowNoise(fp * 1.3 + vec2(-7.9, 13.7) + vec2(ft, 0.5 * ft))
  ) - 1.0;

  // Bend: the waves see a world that's been pushed around by the flow, so
  // their fronts curve instead of running dead straight.
  vec2 waveWorld = world + flow * uBend * uScale * 0.5;

  // --- sum the per-axis sine warp (independent phases per axis) ---
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
    float ampI = amp / (1.0 + fi * 0.6);

    d.x += ampI * 1.0 * sin(dot(waveWorld, kx) + uTime * uSpeed * (0.7 + fi * 0.31));
    d.y += ampI * 0.8 * sin(dot(waveWorld, ky) + uTime * uSpeed * (0.9 + fi * 0.23));
  }

  // Swirl: rotate the displacement locally, by an angle that follows the flow
  // and turns over time. Rotating the wave directions themselves would shift
  // phase in proportion to distance from the origin — the far edge of the
  // screen would strobe. Rotating d is local, so it's the same everywhere.
  if (uSwirl > 0.0) {
    float a = uSwirl * (flow.x * 3.14159 + uTime * 0.15);
    float ca = cos(a), sa = sin(a);
    d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }

  // --- warped sample position ---
  // The flow term is what actually carries contours into dead regions.
  vec2 uv = (world + d + uDrift * uTime) / uScale + flow * uFlow;

  // --- smooth field -> contour bands ---
  float banded = fbm(uv) * uBands;

  // Index of the *nearest* contour, not the band below it. Rounding rather
  // than flooring matters: floor() flips in the middle of a drawn line, so
  // anything seeded off it would seam straight down the stroke.
  float contour = floor(banded + 0.5);
  float distToEdge = abs(banded - contour);

  // Screen-space derivative, computed by the GPU for free. Its magnitude is
  // the gradient normalization that holds every contour to the same pixel
  // width; its *direction* is what we shade with below.
  vec2 grad = vec2(dFdx(banded), dFdy(banded));
  float slope = max(abs(grad.x) + abs(grad.y), 1e-6); // == fwidth(banded)

  // Each contour carries its own identity, so lines differ from one another
  // instead of all being drawn with the same pen.
  float lineSeed = hash(vec2(contour, 17.0));

  float width = uLineWidth;

  // The line-quality fields ride in warped uv so they follow the water, but
  // they also need motion of their own. uv moves *with* the field, so a mask
  // sampled purely in uv is frozen relative to the lines: whatever it erases
  // stays erased forever. These offsets let thick spots and gaps travel.
  float lt = uTime * uSpeed;

  // Thickness breathes *along* each line, offset per contour so neighbouring
  // lines don't fatten in sync.
  if (uLineVary > 0.0) {
    float v = valueNoise(uv * 0.55 + lineSeed * 53.0 + vec2(0.07, -0.05) * lt);
    width *= 1.0 + uLineVary * (v * 2.0 - 1.0) * 1.3;
  }

  // A contour map has no light source. Water line-art does: strokes gather on
  // the faces turned toward it and thin out on the ones turned away. This is
  // the single biggest cue that these are waves and not isolines.
  if (uFacing > 0.0) {
    vec2 lightDir = vec2(cos(uLightAngle), sin(uLightAngle));
    width *= 1.0 + uFacing * dot(normalize(grad + 1e-6), lightDir);
  }

  float intensity = clamp(1.0 - (distToEdge / slope) / max(width, 0.02), 0.0, 1.0);

  // Erode the strokes so lines break into runs and drop out in patches. Two
  // layers drifting in different directions make gaps open and close in place
  // rather than sliding along as a fixed pattern; the 1.5 restores the
  // contrast that averaging two noises takes away.
  if (uBreakup > 0.0) {
    vec2 mp = uv * 1.35 + lineSeed * 113.0;
    float m = 0.5 * (valueNoise(mp + vec2(19.0, 7.0) + vec2(0.11, 0.06) * lt)
                   + valueNoise(mp + vec2(-4.0, 31.0) + vec2(-0.08, 0.10) * lt));
    m = clamp(0.5 + (m - 0.5) * 1.5, 0.0, 1.0);
    float cut = uBreakup * 0.78;
    intensity *= smoothstep(cut, cut + 0.14, m);
  }

  // --- 1-bit threshold through an ordered dither ---
  ivec2 bc = ivec2(mod(gl_FragCoord.xy, 4.0));
  float bayer = BAYER[bc.y * 4 + bc.x] / 16.0;
  float threshold = 0.5 + (bayer - 0.5) * uDither;

  // --- noise: real random grain, re-rolled 24 times a second ---
  // Unlike the Bayer grid this has no pattern, so it reads as film grain
  // rather than texture. The frame index wraps to keep the hash inputs small
  // enough for float precision after the page has been open a while.
  float frame = mod(floor(uTime * 24.0), 997.0);
  vec2 np = gl_FragCoord.xy + frame * vec2(37.0, 113.0);

  // Grain jitters the threshold, so line edges fizz. The 1.2 lets it bite
  // into solid strokes too, not just their soft edges.
  if (uGrain > 0.0) threshold += (hash(np) - 0.5) * uGrain * 1.2;

  bool on = intensity > threshold;

  // Speckle is the only thing that can put ink in empty paper. Dense near the
  // contours, where it reads as foam and spray; a sparse dust everywhere else.
  if (uSpeckle > 0.0) {
    float px = distToEdge / slope;
    float near = clamp(1.0 - px / (max(width, 0.5) * 8.0), 0.0, 1.0);
    float density = uSpeckle * uSpeckle * (0.004 + 0.06 * near * near);
    if (hash(np + vec2(71.0, 19.0)) < density) on = true;
  }

  fragColor = vec4(on ? uInk : uPaper, 1.0);
}
`
