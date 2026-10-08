export const PARAM_META = {
  // field
  scale: { label: 'scale', min: 6, max: 160, step: 1, group: 'field' },
  bands: { label: 'bands', min: 1, max: 16, step: 0.1, group: 'field' },
  octaves: { label: 'octaves', min: 1, max: 5, step: 1, group: 'field', int: true },

  // line quality
  lineWidth: { label: 'width (px)', min: 0.3, max: 5, step: 0.05, group: 'line' },
  lineVary: { label: 'vary', min: 0, max: 1, step: 0.01, group: 'line' },
  breakup: { label: 'breakup', min: 0, max: 1, step: 0.01, group: 'line' },
  // `advanced` params hidden behind a "more" dropdown
  facing: { label: 'facing', min: 0, max: 1.5, step: 0.01, group: 'line', advanced: true },
  lightAngle: { label: 'light angle', min: 0, max: 360, step: 1, group: 'line', advanced: true },

  // waves
  volatility: { label: 'volatility', min: 0, max: 6, step: 0.05, group: 'waves' },
  amplitude: { label: 'amplitude', min: 0, max: 40, step: 0.1, group: 'waves' },
  frequency: { label: 'frequency', min: 0.005, max: 0.4, step: 0.005, group: 'waves' },
  waves: { label: 'wave count', min: 1, max: 8, step: 1, group: 'waves', int: true },

  // flow
  flow: { label: 'flow', min: 0, max: 3, step: 0.01, group: 'flow' },
  bend: { label: 'bend', min: 0, max: 3, step: 0.01, group: 'flow' },
  swirl: { label: 'swirl', min: 0, max: 1.5, step: 0.01, group: 'flow' },
  spin: { label: 'spin', min: -3, max: 3, step: 0.01, group: 'flow' },

  // noise
  grain: { label: 'grain', min: 0, max: 1, step: 0.01, group: 'noise' },
  speckle: { label: 'speckle', min: 0, max: 1, step: 0.01, group: 'noise' },

  // time
  speed: { label: 'speed', min: 0, max: 6, step: 0.05, group: 'time' },
  driftX: { label: 'drift x', min: -8, max: 8, step: 0.05, group: 'time' },
  driftY: { label: 'drift y', min: -8, max: 8, step: 0.05, group: 'time' },

  // output
  inkOpacity: { label: 'ink opacity', min: 0, max: 1, step: 0.01, group: 'output' },
  pixelSize: {
    label: 'pixel size',
    min: 1,
    max: 16,
    step: 1,
    group: 'output',
    int: true,
    modulatable: false, // too expensive and ugly to modulate
  },
  dither: { label: 'dither', min: 0, max: 1, step: 0.02, group: 'output' },
}

export const GROUPS = ['field', 'line', 'waves', 'flow', 'noise', 'time', 'output']

export const groupedParams = (group) =>
  Object.entries(PARAM_META)
    .filter(([, meta]) => meta.group === group)
    .map(([key, meta]) => ({ key, ...meta }))

export const MODULATABLE = Object.entries(PARAM_META)
  .filter(([, meta]) => meta.modulatable !== false)
  .map(([key]) => key)
