// LFO modulation
// each LFO has a shape, a rate, a depth and a target parameter
// - modulation is applied inside the render loop rather than in React state

import { PARAM_META } from './params.js'

export const SHAPES = ['sine', 'triangle', 'saw', 'square', 'random', 'steps']

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
      // transitions using catmull-rom curve
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
  rate: 0.15, // Hz
  depth: 0.3, // fraction of the target param's range
  phase: 0, // only useful with multiple LFOs
  enabled: true,
  ...overrides,
})

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

    if (value < meta.min) value = meta.min
    else if (value > meta.max) value = meta.max
    if (meta.int) value = Math.round(value)

    out[lfo.target] = value
  }

  return out === null ? params : out
}
