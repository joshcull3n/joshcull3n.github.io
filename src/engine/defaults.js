// default parameters and colour helpers for the water renderer

export const DEFAULTS = {
  pixelSize: 1,
  tile: 0,
  ink: '#ffccd4',
  paper: '#000000',
  inkOpacity: 1,
  scale: 30,
  bands: 4, // contour density
  octaves: 5, // more octaves means more wrinkled shapes
  lineWidth: 3.5,
  lineVary: 1,
  breakup: 0.5,
  facing: 0.6,
  lightAngle: 135,
  waves: 8, // how many sines sum per axis
  amplitude: 8.6,
  frequency: 0.01,
  volatility: 1.95,
  flow: 1.5,
  bend: 0.5,
  swirl: 0.8,
  spin: 0.8,
  grain: 0,
  speckle: 0,
  speed: 1,
  driftX: 0.5,
  driftY: 0.2,
  dither: 1,
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

export function inkRgb(p) {
  const ink = hexToRgb(p.ink)
  const paper = hexToRgb(p.paper)
  const a = p.inkOpacity ?? 1
  return ink.map((c, i) => Math.round(paper[i] + (c - paper[i]) * a))
}
