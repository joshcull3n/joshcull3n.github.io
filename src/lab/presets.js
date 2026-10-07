// Presets are complete characters, not nudges off the defaults — each one sets
// nearly every parameter that shapes the look. Anything left out falls back to
// DEFAULTS, so `default` always tracks whatever the defaults are tuned to.
// Every preset is white ink on black paper unless it says otherwise. Pixel
// size and seed belong to the viewer and are never touched.
//
// `lfos` is optional: [target, overrides] pairs handed to createLFO. Some looks
// are about how the water changes, not how it sits, and a static preset can't
// express that.

import { DEFAULTS } from '../water/engine.js'

const { ink, paper, pixelSize, seed, ...CHARACTER } = DEFAULTS

const preset = (overrides) => ({ ...CHARACTER, ink: '#ffffff', paper: '#000000', ...overrides })

export const PRESETS = {
  default: preset({}),

  // Rotation. Everything curls, and the light circles around it.
  eddy: preset({
    scale: 90, bands: 5, lineWidth: 1.6, lineVary: 0.7, breakup: 0.25, facing: 1.2,
    waves: 3, amplitude: 12, frequency: 0.07, volatility: 1.4, flow: 2.2, bend: 2, swirl: 2.6,
    speed: 1.2, driftX: 0, driftY: 0, dither: 0.1,
    lfos: [['lightAngle', { shape: 'saw', rate: 0.04, depth: 1 }]],
  }),

  // A river: everything pulled one way, lit from upstream.
  current: preset({
    scale: 110, bands: 4, lineWidth: 2, lineVary: 0.8, breakup: 0.35, facing: 1.4, lightAngle: 180,
    waves: 2, amplitude: 8, frequency: 0.05, volatility: 1.2, flow: 1, bend: 2.5, swirl: 0,
    speed: 1, driftX: 6, driftY: 1.2, dither: 0,
  }),

  // Chaos, but still water.
  squall: preset({
    scale: 60, bands: 6, octaves: 3, lineWidth: 1.8, lineVary: 1, breakup: 0.3, facing: 1,
    waves: 5, amplitude: 6, frequency: 0.07, volatility: 2.2, flow: 3, bend: 1, swirl: 1.5,
    speed: 2.5, driftX: -2, driftY: 1.5, dither: 0.1, ink: '#ff44eb',
    lfos: [['volatility', { shape: 'random', rate: 0.25, depth: 0.15 }]],
  }),

  // Grain. Heavy dither and every octave, so strokes dissolve into static.
  static: preset({
    scale: 30, bands: 4, octaves: 5, lineWidth: 3.5, lineVary: 1, breakup: 0.5, facing: 0.6,
    waves: 4, amplitude: 6, frequency: 0.12, volatility: 1, flow: 1.5, bend: 0.5, swirl: 0.8,
    speed: 1, dither: 1, speckle: 0.2,
  }),

  // static, white on blue.
  ocean: preset({
    scale: 30, bands: 4, octaves: 5, lineWidth: 3.5, lineVary: 1, breakup: 0.5, facing: 0.6,
    waves: 4, amplitude: 6, frequency: 0.12, volatility: 1, flow: 1.5, bend: 0.5, swirl: 0.8,
    speed: 1, dither: 1, paper: '#009eff',
  }),

  // Near-black. Lines only occasionally make it to the surface.
  abyss: preset({
    scale: 120, bands: 2, lineWidth: 1.5, lineVary: 0.9, breakup: 0.75, facing: 1.3,
    lightAngle: 270, waves: 2, amplitude: 6, frequency: 0.06, volatility: 1, flow: 2, bend: 0.6,
    swirl: 0.4, speed: 0.6, driftX: 0.2, driftY: 0.6, dither: 0,
    lfos: [['breakup', { rate: 0.03, depth: 0.3 }]],
  }),

  // Every water-ish term off — the plain topographic map, kept as an A/B.
  contour: preset({
    lineWidth: 1.3, lineVary: 0, breakup: 0, facing: 0, flow: 0, bend: 0, swirl: 0,
    dither: 0,
  }),
}

// --- random -----------------------------------------------------------------
//
// Uniform draws across each slider's full range are mostly garbage — static or
// an empty screen. These ranges are the region where the water still reads as
// water, with a couple of rules a uniform draw can't express.

const rand = (min, max) => min + Math.random() * (max - min)
const randInt = (min, max) => Math.floor(rand(min, max + 1))
// For params whose effect is multiplicative (scale, frequency), so small values
// get as many draws as large ones.
const randLog = (min, max) => Math.exp(rand(Math.log(min), Math.log(max)))
const pick = (list) => list[Math.floor(Math.random() * list.length)]
// Most rolls should be clean; texture is a seasoning, not the default.
const sometimes = (chance, roll) => (Math.random() < chance ? roll() : 0)

const LFO_TARGETS = ['lightAngle', 'bands', 'breakup', 'swirl', 'volatility', 'speckle', 'flow']

export function randomLook() {
  const frequency = randLog(0.03, 0.15)
  const volatility = rand(0.6, 2.4)
  // Warp strength = displacement x wave frequency. Past ~3 the warp folds
  // faster than a pixel and everything aliases into static, so pick the
  // strength directly and solve for amplitude.
  const strength = rand(0.3, 3)
  const amplitude = Math.min(40, strength / (frequency * Math.pow(volatility, 1.8)))

  const scale = Math.round(randLog(25, 160))
  const bands = rand(1.5, 8)
  // Thick lines x many bands x small scale fills the screen solid. Ink density
  // goes roughly as width * bands / scale, so cap the width to keep it sane.
  const lineWidth = Math.min(rand(0.8, 4), (0.4 * scale) / bands)

  return {
    scale,
    bands,
    octaves: randInt(2, 5),
    lineWidth,
    lineVary: rand(0, 1),
    breakup: rand(0, 0.7),
    facing: rand(0, 1.5),
    lightAngle: Math.round(rand(0, 360)),
    waves: randInt(2, 6),
    amplitude,
    frequency,
    volatility,
    flow: rand(0.5, 3),
    bend: rand(0, 2.5),
    swirl: rand(0, 2.5),
    speed: rand(0.4, 2.5),
    // Squared toward zero: mostly gentle drift, occasionally a real current.
    driftX: Math.sign(Math.random() - 0.5) * Math.pow(Math.random(), 2) * 4,
    driftY: Math.sign(Math.random() - 0.5) * Math.pow(Math.random(), 2) * 4,
    dither: sometimes(0.5, () => rand(0, 1)),
    grain: sometimes(0.4, () => rand(0, 0.5)),
    speckle: sometimes(0.4, () => rand(0, 0.5)),
    seed: randInt(0, 99999),
    lfos: Array.from({ length: randInt(0, 2) }, () => [
      pick(LFO_TARGETS),
      {
        shape: pick(['sine', 'triangle', 'random']),
        rate: rand(0.02, 0.15),
        depth: rand(0.1, 0.35),
        phase: Math.random(),
      },
    ]),
  }
}
