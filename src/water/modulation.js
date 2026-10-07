// LFO modulation. Each LFO has a shape, a rate, a depth and a target
// parameter; depth is a fraction of the target's full range, so 0.5 always
// means "swing across half this parameter's span" no matter what it controls.
//
// Modulation is applied inside the render loop rather than in React state —
// at 60fps, setState would be the single most expensive thing on the page.

import { PARAM_META } from './params.js'

export const SHAPES = ['sine', 'triangle', 'saw', 'square', 'random', 'steps']

// Deterministic hash for sample-and-hold, so a given step index is stable.
// The additive constant matters: without it n=0 hashes to exactly 0, which
// pins the first cycle of every random LFO to its target's minimum.
function hash1(n) {
  let h = Math.imul((n | 0) + 0x9e3779b9, 374761393)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

// phase -> [-1, 1]
function shapeValue(shape, phase) {
  switch (shape) {
    case 'triangle':
      return 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1
    case 'saw':
      return 2 * (phase - Math.floor(phase)) - 1
    case 'square':
      return phase - Math.floor(phase) < 0.5 ? 1 : -1
    case 'random': {
      // A new random target every cycle, glided through on a Catmull-Rom
      // curve. Plain sample-and-hold snaps the target param, which lurches the
      // whole picture; even a smoothstep blend stalls at every sample point,
      // so the motion pulses once per cycle. Catmull-Rom keeps the velocity
      // continuous. It can overshoot slightly, hence the clamp.
      const i = Math.floor(phase)
      const t = phase - i
      const p0 = hash1(i - 1) * 2 - 1
      const p1 = hash1(i) * 2 - 1
      const p2 = hash1(i + 1) * 2 - 1
      const p3 = hash1(i + 2) * 2 - 1
      const v =
        0.5 *
        (2 * p1 +
          (p2 - p0) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
          (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
      return v < -1 ? -1 : v > 1 ? 1 : v
    }
    case 'steps':
      // Hard sample & hold: one new random value per cycle, no glide.
      return hash1(Math.floor(phase)) * 2 - 1
    case 'sine':
    default:
      return Math.sin(phase * Math.PI * 2)
  }
}

export const createLFO = (target, overrides = {}) => ({
  id: `${target}-${Math.floor(Math.random() * 1e9).toString(36)}`,
  target,
  shape: 'sine',
  rate: 0.15, // Hz — slow by default; this is a background, not a strobe
  depth: 0.3, // fraction of the target param's range
  phase: 0, // 0..1 offset, for running several LFOs out of step
  enabled: true,
  ...overrides,
})

/**
 * Returns a new params object with every enabled LFO applied.
 * Base values are untouched, so turning an LFO off restores exactly what the
 * slider says.
 */
export function applyModulation(params, lfos, time) {
  if (!lfos || lfos.length === 0) return params

  let out = null

  for (const lfo of lfos) {
    if (!lfo.enabled || lfo.depth === 0) continue

    const meta = PARAM_META[lfo.target]
    if (!meta) continue

    if (out === null) out = { ...params }

    const span = meta.max - meta.min
    const signal = shapeValue(lfo.shape, time * lfo.rate + lfo.phase)

    let value = (out[lfo.target] ?? params[lfo.target]) + signal * lfo.depth * span * 0.5

    // Clamp into the param's legal range, then quantize integers.
    if (value < meta.min) value = meta.min
    else if (value > meta.max) value = meta.max
    if (meta.int) value = Math.round(value)

    out[lfo.target] = value
  }

  return out === null ? params : out
}
