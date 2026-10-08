// GLSL ES 3.00. The water renderer: every pixel, every frame, on the GPU.
// Browsers without WebGL2 get a notice instead (NoWebGL in WaterGL.jsx).

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
uniform float uTime;      // real seconds — only grain runs on this
// The water's own clock: real time integrated against speed, frame by frame,
// in JavaScript. Everything the water does runs on it, so speed scales all of it
// at once, and changing speed changes motion from now on rather than
// rescaling the whole history (which made the water teleport mid-drag).
uniform float uWaterTime;
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
// Tile size in logical px; 0 = endless. When set, every function of position
// repeats exactly every uTile px, so the screen shows a seamless tile repeated.
// Must be a multiple of 4 so the Bayer grid repeats with it.
uniform float uTile;

// ~37 degree rotation between octaves. Without it every octave shares the
// lattice's axes and the grain lines up into faint horizontals/verticals.
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.0001);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// --- tiling ---
//
// Every noise function takes a \`period\`: the number of lattice cells after
// which it repeats (0 = never). Wrapping the lattice index is what makes noise
// tile; it only works for a whole number of cells, so tile mode snaps each
// layer's frequency to fit (snapFreq). Offsets added to the input — seeds,
// time — are fine: a shifted periodic function is still periodic.
//
// The ~37 degree octave rotation can't survive this: it maps the wrap lattice
// onto a rotated one, and by the second octave nothing lines up. So in tile
// mode octaves just double.

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

// Cheap two-octave noise for the flow field — it only needs broad shapes.
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
  // Flip Y so the field's origin is top-left, like the page's.
  vec2 world = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

  // Tile mode: snap the scale so a whole number of field cells spans the tile.
  // \`cells\` is then the field's period, in uv units; 0 when not tiling.
  bool tiled = uTile > 0.0;
  float cells = tiled ? max(1.0, floor(uTile / uScale + 0.5)) : 0.0;
  float scale = tiled ? uTile / cells : uScale;

  // Wrap position into the tile first, so every tile on screen is literally
  // the same computation as tile 0 — exact repeats, rather than repeats that
  // are only exact up to float rounding (which flips the odd edge pixel at
  // large tile sizes). Safe for dFdx/dFdy: tiles are multiples of 4, so a
  // tile boundary never splits the 2x2 pixel quads derivatives are taken over.
  if (tiled) world = mod(world, uTile);

  // --- flow: a slow, broad, *evolving* vector field ---
  //
  // The sine warp only oscillates in place and drift only translates, so on
  // their own nothing ever changes the field: a plateau with no contours in
  // it stays empty forever, and the waves read as straight plane waves. The
  // flow field fixes both. Each component sums two layers moving in different
  // directions, so it morphs rather than slides. Range is roughly [-1, 1].
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

  // Bend: the waves see a world that's been pushed around by the flow, so
  // their fronts curve instead of running dead straight.
  vec2 waveWorld = world + flow * uBend * scale * 0.5;

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

    // Tile mode: snap each wave to a whole number of cycles across the tile.
    // A wave longer than the tile snaps to zero cycles — a uniform slosh —
    // which is close to how such a long wave reads across one tile anyway.
    if (tiled) {
      float q = 6.2831853 / uTile;
      kx = q * floor(kx / q + 0.5);
      ky = q * floor(ky / q + 0.5);
    }
    float ampI = amp / (1.0 + fi * 0.6);

    d.x += ampI * 1.0 * sin(dot(waveWorld, kx) + uWaterTime * (0.7 + fi * 0.31));
    d.y += ampI * 0.8 * sin(dot(waveWorld, ky) + uWaterTime * (0.9 + fi * 0.23));
  }

  // Rotate the displacement, by an angle with two independent parts:
  //   swirl — varies across the screen with the flow, so motion curls. At 1
  //           it already spans every direction; past that it just twists
  //           tighter, hence the slider stops at 1.5.
  //   spin  — grows with time, so the curl turns. Negative counter-rotates.
  // Rotating the wave directions themselves would shift phase in proportion
  // to distance from the origin — the far edge of the screen would strobe.
  // Rotating d is local, so it's the same everywhere.
  if (uSwirl > 0.0 || uSpin != 0.0) {
    float a = uSwirl * flow.x * 3.14159 + uSpin * uWaterTime * 0.15;
    float ca = cos(a), sa = sin(a);
    d = vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  }

  // --- warped sample position ---
  // The flow term is what actually carries contours into dead regions.
  vec2 uv = (world + d + uDrift * uWaterTime) / scale + flow * uFlow;

  // --- smooth field -> contour bands ---
  float banded = fbm(uv, cells) * uBands;

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
  float lt = uWaterTime;

  // Thickness swells and tapers *along* each line — sampled finer than the
  // field so the change happens within a stroke rather than across whole
  // regions, and offset per contour so neighbouring lines don't fatten in
  // sync. Multiplicative (0.33x..3x at full strength) so it can never go
  // negative.
  if (uLineVary > 0.0) {
    float kv = snapFreq(2.2, cells);
    float v = valueNoise(uv * kv + lineSeed * 53.0 + vec2(0.07, -0.05) * lt, kv * cells);
    width *= exp2(uLineVary * (v * 2.0 - 1.0) * 1.6);
  }

  // A contour map has no light source. Water line-art does: strokes gather on
  // the faces turned toward it and thin out on the ones turned away. This is
  // the single biggest cue that these are waves and not isolines.
  if (uFacing > 0.0) {
    vec2 lightDir = vec2(cos(uLightAngle), sin(uLightAngle));
    width *= 1.0 + uFacing * dot(normalize(grad + 1e-6), lightDir);
  }

  // A 1-bit line can't be thinner than a pixel: below that it doesn't get
  // thinner, it breaks up into scattered dots. So vary and facing can taper a
  // stroke down to a solid 1px hairline but no further — unless the base width
  // was set thinner than that on purpose.
  width = max(width, min(uLineWidth, 1.0));

  float intensity = clamp(1.0 - (distToEdge / slope) / max(width, 0.02), 0.0, 1.0);

  // Erode the strokes so lines break into runs and drop out in patches. Two
  // layers drifting in different directions make gaps open and close in place
  // rather than sliding along as a fixed pattern; the 1.5 restores the
  // contrast that averaging two noises takes away.
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

  // --- 1-bit threshold through an ordered dither ---
  ivec2 bc = ivec2(mod(gl_FragCoord.xy, 4.0));
  float bayer = BAYER[bc.y * 4 + bc.x] / 16.0;
  float threshold = 0.5 + (bayer - 0.5) * uDither;

  // --- noise: real random grain, re-rolled 24 times a second ---
  // Unlike the Bayer grid this has no pattern, so it reads as film grain
  // rather than texture. The frame index wraps to keep the hash inputs small
  // enough for float precision after the page has been open a while.
  float frame = mod(floor(uTime * 24.0), 997.0);
  // Wrapped to the tile in tile mode, so the grain repeats with everything else.
  vec2 cell = tiled ? mod(floor(gl_FragCoord.xy), uTile) : gl_FragCoord.xy;
  vec2 np = cell + frame * vec2(37.0, 113.0);

  // Grain jitters the threshold, so line edges fizz. The 2.4 lets it bite
  // well into solid strokes at the top of the slider, not just their soft
  // edges — at 1 the threshold swings past 1.0 often enough to pit the middle
  // of a stroke.
  if (uGrain > 0.0) threshold += (hash(np) - 0.5) * uGrain * 2.4;

  // Empty paper (intensity exactly 0) never turns on, whatever the threshold.
  // At dither 1 one Bayer cell has a threshold of exactly 0, so without this
  // the slightest negative grain lit 1 in 32 empty pixels at once — a cliff
  // between grain 0 and 0.01. Ink in empty space is speckle's job.
  bool on = intensity > 0.0 && intensity > threshold;

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
