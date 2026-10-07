// Deterministic value noise. No dependencies, no Math.random — the same seed
// always produces the same field, so a given config can be shared as a URL.

// Integer hash -> [0, 1). Math.imul keeps every step in true 32-bit space;
// plain `*` would overflow into float and wreck the bit mixing.
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// Smoothstep: flattens the derivative at cell edges so the lattice doesn't show.
function fade(t) {
  return t * t * (3 - 2 * t)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Classic 2D value noise -> [0, 1]
export function valueNoise(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = fade(x - ix)
  const fy = fade(y - iy)

  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)

  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

// Fractal brownian motion — stacked octaves at doubling frequency and halving
// amplitude. This is what gives the field its blobby, organic shape.
export function fbm(x, y, seed, octaves = 3) {
  let value = 0
  let amplitude = 0.5
  let total = 0

  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x, y, seed + i * 1013) * amplitude
    total += amplitude
    amplitude *= 0.5
    // Rotate ~37 degrees per octave so the lattice axes don't line up into
    // visible horizontal/vertical grain. Same matrix as the shader.
    const nx = (0.8 * x - 0.6 * y) * 2 + 1.7
    y = (0.6 * x + 0.8 * y) * 2 + 9.2
    x = nx
  }

  return value / total
}

// Cheap two-octave noise for the flow field — it only needs broad shapes.
export function flowNoise(x, y, seed) {
  const rx = (0.8 * x - 0.6 * y) * 2.03 + 3.7
  const ry = (0.6 * x + 0.8 * y) * 2.03 + 3.7
  return valueNoise(x, y, seed) * 0.65 + valueNoise(rx, ry, seed) * 0.35
}
