// Default parameters and colour helpers for the water renderer.

// The defaults are the organic preset — keep the two in step if either changes.
export const DEFAULTS = {
  // --- resolution ---
  pixelSize: 1, // on-screen size of one logical pixel — big = chunky, sparse
  tile: 0, // tile size in logical px (multiple of 4); 0 = endless. WebGL only

  // --- palette (1-bit: exactly two colors) ---
  ink: '#ffccd4', // the lines
  paper: '#000000', // the void
  inkOpacity: 1, // blends the ink toward the paper — still exactly two colours

  // --- field shape ---
  scale: 30, // the `/ size` term — larger = broader shapes
  bands: 4, // contour density
  octaves: 5, // fbm detail — more octaves, more wrinkled shapes

  // --- line quality ---
  // Uniform lines read as a topographic map. These three put the
  // non-uniformity back, but keyed to the field instead of to randomness.
  lineWidth: 3.5, // base contour thickness, in logical pixels
  lineVary: 1, // how much thickness wanders along and between lines
  breakup: 0.5, // erosion — strokes break into runs and drop out in patches
  facing: 0.6, // weight on slopes turned toward the light
  lightAngle: 135, // degrees; where that light comes from

  // --- wave warp ---
  waves: 8, // how many sines sum per axis
  amplitude: 8.6,
  frequency: 0.01,
  volatility: 1.95, // master chaos knob — scales amplitude superlinearly

  // --- flow ---
  // A slow evolving vector field. Without it the water only oscillates in
  // place, which leaves permanent dead patches and visibly straight waves.
  flow: 1.5, // how far the flow folds the field — fills dead regions
  bend: 0.5, // how much the flow curves the wavefronts
  swirl: 0.8, // how much the wave motion curls, varying across the screen
  spin: 0.8, // how fast that curl turns over time; negative counter-rotates

  // --- noise ---
  grain: 0, // random threshold jitter — line edges fizz
  speckle: 0, // random dots in the paper, clustered near lines like foam

  // --- time ---
  speed: 1, // master clock for everything the water does
  driftX: 0.5,
  driftY: 0.2,

  // --- output ---
  dither: 0, // 0 = hard threshold, 1 = full Bayer dithering
  seed: 1337,
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

// The ink as actually drawn: blended toward the paper by inkOpacity. Done once
// per frame rather than per pixel — every ink pixel gets the same colour, so
// the output stays 1-bit, just with a softer second colour.
export function inkRgb(p) {
  const ink = hexToRgb(p.ink)
  const paper = hexToRgb(p.paper)
  const a = p.inkOpacity ?? 1
  return ink.map((c, i) => Math.round(paper[i] + (c - paper[i]) * a))
}
