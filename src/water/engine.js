// 1-bit animated water.
//
// The technique is UV domain warping: the texture itself never moves. What
// moves is *where we sample it from*. Per the reference breakdown:
//
//   phase = dot(world, k) + time * speed
//   d.x   = sum(amplitude_x * sin(phase_x))
//   d.y   = sum(amplitude_y * sin(phase_y))      <- independent phases per axis
//   uv    = (world + d + drift * time) / size
//
// Sample a smooth noise field at that warped uv, slice it into contour bands,
// then threshold through a Bayer matrix to land on exactly two colors.

import { fbm, flowNoise, valueNoise } from './noise.js'

export const DEFAULTS = {
  // --- resolution ---
  pixelSize: 1, // on-screen size of one logical pixel — big = chunky, sparse

  // --- palette (1-bit: exactly two colors) ---
  ink: '#fff', // the lines
  paper: '#000000', // the void
  inkOpacity: 1, // blends the ink toward the paper — still exactly two colours

  // --- field shape ---
  scale: 100, // the `/ size` term — larger = broader shapes
  bands: 3, // contour density
  octaves: 4, // fbm detail — keep low, extra octaves just add noise

  // --- line quality ---
  // Uniform lines read as a topographic map. These three put the
  // non-uniformity back, but keyed to the field instead of to randomness.
  lineWidth: 2.5, // base contour thickness, in logical pixels
  lineVary: 0, // how much thickness wanders along and between lines
  breakup: 0.4, // erosion — strokes break into runs and drop out in patches
  facing: 0.85, // weight on slopes turned toward the light
  lightAngle: 135, // degrees; where that light comes from

  // --- wave warp ---
  waves: 4, // how many sines sum per axis
  amplitude: 10,
  frequency: 0.1,
  volatility: 1.6, // master chaos knob — scales amplitude superlinearly

  // --- flow ---
  // A slow evolving vector field. Without it the water only oscillates in
  // place, which leaves permanent dead patches and visibly straight waves.
  flow: 2.5, // how far the flow folds the field — fills dead regions
  bend: 0.6, // how much the flow curves the wavefronts
  swirl: 0.5, // how much the wave motion curls, varying across the screen
  spin: 0.5, // how fast that curl turns over time; negative counter-rotates

  // --- noise ---
  grain: 0, // random threshold jitter — line edges fizz
  speckle: 0, // random dots in the paper, clustered near lines like foam

  // --- motion ---
  speed: 0.5,
  driftX: 0.5,
  driftY: 0.2,

  // --- output ---
  dither: 0.2, // 0 = hard threshold, 1 = full Bayer dithering
  seed: 1337,
}

// 4x4 Bayer matrix, normalized to [0,1). This is what turns smooth contours
// into the dotted/stippled line quality instead of solid anti-aliased edges.
const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map((v) => v / 16)

// Math.sin is the hot path here (waves * 2 calls per pixel). A lookup table
// trades a little accuracy for comfortably staying inside the frame budget.
const SIN_BITS = 12
const SIN_COUNT = 1 << SIN_BITS
const SIN_MASK = SIN_COUNT - 1
const SIN_SCALE = SIN_COUNT / (Math.PI * 2)
const SIN_TABLE = new Float32Array(SIN_COUNT)
for (let i = 0; i < SIN_COUNT; i++) {
  SIN_TABLE[i] = Math.sin((i * Math.PI * 2) / SIN_COUNT)
}

function fastSin(x) {
  return SIN_TABLE[(x * SIN_SCALE) & SIN_MASK]
}

// Scratch buffers for the field pass, reused across frames so we're not
// allocating a few hundred KB sixty times a second. `vary` and `mask` hold the
// line-quality fields — they have to be sampled in pass 1 because that's the
// only place the warped uv still exists.
const scratch = { field: new Float32Array(0), vary: new Float32Array(0), mask: new Float32Array(0) }
function getBuffers(size) {
  if (scratch.field.length < size) {
    scratch.field = new Float32Array(size)
    scratch.vary = new Float32Array(size)
    scratch.mask = new Float32Array(size)
  }
  return scratch
}

// Per-contour identity. Doesn't need to match the shader's hash bit-for-bit,
// only to be stable and well spread.
function hashContour(n) {
  let h = Math.imul((n | 0) + 0x7f4a7c15, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// The ink as actually drawn: blended toward the paper by inkOpacity. Done once
// per frame rather than per pixel — every ink pixel gets the same colour, so
// the output stays 1-bit, just with a softer second colour.
export function inkRgb(p) {
  const ink = hexToRgb(p.ink)
  const paper = hexToRgb(p.paper)
  const a = p.inkOpacity ?? 1
  return ink.map((c, i) => Math.round(paper[i] + (c - paper[i]) * a))
}

// Per-pixel, per-frame hash for grain and speckle.
function pixelHash(x, y, frame) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(frame, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Precompute per-wave constants so the pixel loop stays tight. Each wave gets
// its own direction, frequency multiplier and temporal speed — that spread is
// what stops the result looking like one sliding diagonal.
function buildWaves(p) {
  const out = []
  const amp = p.amplitude * Math.pow(p.volatility, 1.8)

  for (let i = 0; i < p.waves; i++) {
    // Irrational-ish angle steps keep the directions from aligning.
    const angleX = i * 2.399963 + 0.4
    const angleY = i * 2.399963 + 1.9
    const mult = 1 + i * 0.85

    out.push({
      kxx: Math.cos(angleX) * p.frequency * mult,
      kxy: Math.sin(angleX) * p.frequency * mult,
      kyx: Math.cos(angleY) * p.frequency * mult,
      kyy: Math.sin(angleY) * p.frequency * mult,
      ampX: (amp / (1 + i * 0.6)) * 1.0,
      ampY: (amp / (1 + i * 0.6)) * 0.8,
      speedX: p.speed * (0.7 + i * 0.31),
      speedY: p.speed * (0.9 + i * 0.23),
    })
  }
  return out
}

/**
 * Render one frame into an ImageData buffer.
 *
 * @param {ImageData} imageData destination, sized w x h
 * @param {number} w logical width in pixels
 * @param {number} h logical height in pixels
 * @param {number} time seconds since start
 * @param {object} params merged over DEFAULTS
 */
export function renderFrame(imageData, w, h, time, params) {
  const p = { ...DEFAULTS, ...params }
  const data = imageData.data

  const [ir, ig, ib] = inkRgb(p)
  const [pr, pg, pb] = hexToRgb(p.paper)

  const waves = buildWaves(p)
  const nWaves = waves.length
  const invScale = 1 / p.scale
  const driftX = p.driftX * time
  const driftY = p.driftY * time
  const lineVary = p.lineVary || 0
  const breakup = p.breakup || 0
  const facing = p.facing || 0
  const lightX = Math.cos((p.lightAngle * Math.PI) / 180)
  const lightY = Math.sin((p.lightAngle * Math.PI) / 180)
  const cut = breakup * 0.78
  // Own clock for the line-quality fields — see the shader for why they
  // can't just ride in uv.
  const lt = time * p.speed
  const flowAmt = p.flow || 0
  const bendPx = (p.bend || 0) * p.scale * 0.5
  const swirl = p.swirl || 0
  const spin = p.spin || 0
  const ft = time * p.speed * 0.08
  const needFlow = flowAmt > 0 || bendPx > 0 || swirl > 0
  const grain = p.grain || 0
  const speckle = p.speckle || 0
  const frame = Math.floor(time * 24) % 997

  // --- pass 1: the warped noise field, one sample per pixel ---
  //
  // The line-quality fields ride along here. They need the warped uv, which
  // only exists inside this loop, and they're seeded off the nearest contour
  // index — also known here, since that's just a function of the field value.
  const { field, vary, mask } = getBuffers(w * h)

  let idx = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Flow field — see the shader for the reasoning; this mirrors it.
      let flx = 0
      let fly = 0
      if (needFlow) {
        const fx = x * invScale * 0.45
        const fy = y * invScale * 0.45
        flx =
          flowNoise(fx + ft, fy + 0.6 * ft, p.seed) +
          flowNoise(fx * 1.3 + 11.3 - 0.7 * ft, fy * 1.3 + 4.1 + ft, p.seed) -
          1
        fly =
          flowNoise(fx + 5.2 - 0.8 * ft, fy + 1.3 + ft, p.seed) +
          flowNoise(fx * 1.3 - 7.9 + ft, fy * 1.3 + 13.7 + 0.5 * ft, p.seed) -
          1
      }
      const wx = x + flx * bendPx
      const wy = y + fly * bendPx

      let dx = 0
      let dy = 0
      for (let k = 0; k < nWaves; k++) {
        const wv = waves[k]
        dx += wv.ampX * fastSin(wx * wv.kxx + wy * wv.kxy + time * wv.speedX)
        dy += wv.ampY * fastSin(wx * wv.kyx + wy * wv.kyy + time * wv.speedY)
      }

      if (swirl > 0 || spin !== 0) {
        const a = swirl * flx * Math.PI + spin * time * 0.15
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const rdx = ca * dx - sa * dy
        dy = sa * dx + ca * dy
        dx = rdx
      }

      const ux = (x + dx + driftX) * invScale + flx * flowAmt
      const uy = (y + dy + driftY) * invScale + fly * flowAmt
      const f = fbm(ux, uy, p.seed, p.octaves)
      field[idx] = f

      if (lineVary > 0 || breakup > 0) {
        const seed = hashContour(Math.round(f * p.bands))
        if (lineVary > 0) {
          vary[idx] = valueNoise(ux * 2.2 + seed * 53 + 0.07 * lt, uy * 2.2 + seed * 53 - 0.05 * lt, p.seed)
        }
        if (breakup > 0) {
          const mx = ux * 1.35 + seed * 113
          const my = uy * 1.35 + seed * 113
          const m =
            0.5 * (valueNoise(mx + 19 + 0.11 * lt, my + 7 + 0.06 * lt, p.seed) +
                   valueNoise(mx - 4 - 0.08 * lt, my + 31 + 0.1 * lt, p.seed))
          mask[idx] = Math.min(1, Math.max(0, 0.5 + (m - 0.5) * 1.5))
        }
      }

      idx += 1
    }
  }

  // --- pass 2: contours + dither, reading gradients straight from pass 1 ---
  //
  // The neighbouring field values ARE the gradient. No extra noise samples,
  // and it's more correct than sampling offsets in uv space, because the
  // difference already includes however much the sine warp stretched things.
  let i = 0
  idx = 0
  for (let y = 0; y < h; y++) {
    const bayerRow = (y & 3) * 4
    const up = y > 0 ? -w : 0
    const down = y < h - 1 ? w : 0

    for (let x = 0; x < w; x++) {
      const f = field[idx]

      const left = x > 0 ? -1 : 0
      const right = x < w - 1 ? 1 : 0
      const dfdx = (field[idx + right] - field[idx + left]) * 0.5 * p.bands
      const dfdy = (field[idx + down] - field[idx + up]) * 0.5 * p.bands

      // Slope in band-units per pixel. Dividing by it converts the distance
      // to a contour from band-units into pixels — that's the normalization
      // that holds lines to a constant width. Its *direction* is what the
      // facing term below shades with.
      let slope = Math.sqrt(dfdx * dfdx + dfdy * dfdy)
      if (slope < 1e-6) slope = 1e-6

      const banded = f * p.bands
      const distToEdge = Math.abs(banded - Math.round(banded))

      let width = p.lineWidth
      if (lineVary > 0) width *= Math.pow(2, lineVary * (vary[idx] * 2 - 1) * 1.6)
      if (facing > 0) width *= 1 + facing * ((dfdx * lightX + dfdy * lightY) / slope)
      // Floor at a 1px hairline — see the shader for why.
      const minWidth = Math.min(p.lineWidth, 1)
      if (width < minWidth) width = minWidth
      if (width < 0.02) width = 0.02

      let intensity = 1 - distToEdge / slope / width
      if (intensity < 0) intensity = 0
      else if (intensity > 1) intensity = 1

      if (breakup > 0) {
        const m = mask[idx]
        const t = m <= cut ? 0 : m >= cut + 0.14 ? 1 : (m - cut) / 0.14
        intensity *= t * t * (3 - 2 * t)
      }

      const bayer = BAYER4[bayerRow + (x & 3)]
      let threshold = 0.5 + (bayer - 0.5) * p.dither

      // Noise — mirrors the shader; see there for the reasoning.
      if (grain > 0) threshold += (pixelHash(x, y, frame) - 0.5) * grain * 1.2
      let on = intensity > threshold

      if (speckle > 0) {
        let near = 1 - distToEdge / slope / (Math.max(width, 0.5) * 8)
        if (near < 0) near = 0
        const density = speckle * speckle * (0.004 + 0.06 * near * near)
        if (pixelHash(x + 71, y + 19, frame) < density) on = true
      }

      data[i] = on ? ir : pr
      data[i + 1] = on ? ig : pg
      data[i + 2] = on ? ib : pb
      data[i + 3] = 255

      i += 4
      idx += 1
    }
  }
}
