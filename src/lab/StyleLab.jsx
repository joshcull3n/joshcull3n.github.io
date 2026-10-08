import React, { useEffect, useRef, useState } from 'react'
import WaterGL from '../water/WaterGL.jsx'
import { DEFAULTS } from '../water/defaults.js'
import { GROUPS, groupedParams, MODULATABLE, PARAM_META } from '../water/params.js'
import { createLFO, SHAPES } from '../water/modulation.js'
import { PRESETS, randomLook } from './presets.js'
import './lab.css'

// The config as copied to the clipboard: params plus LFOs, with LFOs in the
// same [target, { ... }] shape presets.js uses, so a copied config can be
// pasted straight in as a preset. Numbers are rounded because randomize()
// produces long floats nobody wants to read.
const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)

function exportConfig(params, lfos) {
  const out = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, round(v)]))
  out.lfos = lfos.map(({ target, shape, rate, depth, phase, enabled }) => [
    target,
    {
      shape,
      rate: round(rate),
      depth: round(depth),
      phase: round(phase),
      // Only worth recording when it's off; on is the default.
      ...(enabled ? {} : { enabled: false }),
    },
  ])
  return out
}

// Multiples of 4, so the 4x4 Bayer dither repeats cleanly with the tile.
const TILE_SIZES = [64, 128, 256, 512, 1024, 2048]
const DEFAULT_TILE = 512

// Swap ink and paper: a squared-off bracket arrow, out to the right and back,
// with an open chevron head at each end pointing at the two pickers. Pixel art
// on a 10x26 grid at 1 screen px per cell, so strokes are 1px — the same
// weight as the pixel font. crispEdges keeps it unsmoothed. Each `M..z` is one
// horizontal run of filled cells.
const SWAP_ICON_PATH =
  'M4 0h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM0 4h10v1h-10zM1 5h1v1h-1zM9 5h1v1h-1zM2 6h1v1h-1zM9 6h1v1h-1zM3 7h1v1h-1zM9 7h1v1h-1zM4 8h1v1h-1zM9 8h1v1h-1zM9 9h1v1h-1zM9 10h1v1h-1zM9 11h1v1h-1zM9 12h1v1h-1zM9 13h1v1h-1zM9 14h1v1h-1zM9 15h1v1h-1zM9 16h1v1h-1zM4 17h1v1h-1zM9 17h1v1h-1zM3 18h1v1h-1zM9 18h1v1h-1zM2 19h1v1h-1zM9 19h1v1h-1zM1 20h1v1h-1zM9 20h1v1h-1zM0 21h10v1h-10zM1 22h1v1h-1zM2 23h1v1h-1zM3 24h1v1h-1zM4 25h1v1h-1z'

const SwapIcon = () => (
  <svg
    width="10"
    height="26"
    viewBox="0 0 10 26"
    shapeRendering="crispEdges"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    <path d={SWAP_ICON_PATH} fill="currentColor" />
  </svg>
)

// The defaults are the organic preset, and its amplitude LFO is part of that
// look — so the lab starts with it running, and reset brings it back.
const defaultLfos = () =>
  (PRESETS.organic.lfos ?? []).map(([target, overrides]) => createLFO(target, overrides))

// Whether the current settings still are a preset: every value it sets, and
// the same LFOs. Anything a preset doesn't set (pixel size, tile, and usually
// the seed) doesn't count. Floats get a little slack — a slider dragged away and back can
// land a rounding error off the original.
const near = (a, b) => (typeof a === 'number' ? Math.abs(a - b) < 1e-6 : a === b)

function presetMatches(preset, params, lfos) {
  const { lfos: presetLfos = [], ...look } = preset
  if (!Object.entries(look).every(([k, v]) => near(v, params[k]))) return false
  if (presetLfos.length !== lfos.length) return false
  return presetLfos.every(([target, overrides], i) => {
    const want = createLFO(target, overrides)
    return ['target', 'shape', 'rate', 'depth', 'phase', 'enabled'].every((k) =>
      near(want[k], lfos[i][k]),
    )
  })
}

const StyleLab = () => {
  const [params, setParams] = useState({ ...DEFAULTS })
  const [showPanel, setShowPanel] = useState(true)
  const [paused, setPaused] = useState(false)
  const [fps, setFps] = useState(0)
  const [glError, setGlError] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  // The size the toggle switches back on to — 512 at first, then whatever was
  // last picked, so toggling off and on doesn't lose your choice.
  const [lastTile, setLastTile] = useState(DEFAULT_TILE)
  const [lfos, setLfos] = useState(defaultLfos)
  // The last preset applied — the lab starts as organic. Whether the current
  // settings still match it is worked out on render (see presetMatches).
  const [activePreset, setActivePreset] = useState('organic')

  // WaterGL swaps itself for a notice if WebGL2 fails (or with ?nogl); glError
  // is set when that happens, and the lab drops its controls (see below).
  const tiling = params.tile > 0

  const set = (key, value) => setParams((prev) => ({ ...prev, [key]: value }))

  // A preset replaces the look (palette included) and the LFOs, but keeps the
  // viewer's pixel size, tile size and — unless the preset sets one — seed.
  const applyPreset = (name) => {
    const { lfos: presetLfos = [], ...look } = PRESETS[name]
    setParams((prev) => ({
      ...DEFAULTS,
      ...look,
      pixelSize: prev.pixelSize,
      tile: prev.tile,
      // Most presets work with any seed; ones rolled by random carry their own.
      seed: look.seed ?? prev.seed,
    }))
    setLfos(presetLfos.map(([target, overrides]) => createLFO(target, overrides)))
    setActivePreset(name)
  }

  // Rolls a whole new look, LFOs included. Keeps the palette, ink opacity and
  // pixel size; the seed is part of the roll.
  const randomize = () => {
    const { lfos: rolledLfos, ...look } = randomLook()
    setParams((prev) => ({ ...prev, ...look }))
    setLfos(rolledLfos.map(([target, overrides]) => createLFO(target, overrides)))
    setActivePreset(null)
  }

  const addLFO = () =>
    setLfos((prev) => [
      ...prev,
      // Stagger phases so a second LFO doesn't move in lockstep with the first.
      createLFO('volatility', { phase: (prev.length * 0.25) % 1 }),
    ])

  const updateLFO = (id, patch) =>
    setLfos((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const removeLFO = (id) => setLfos((prev) => prev.filter((l) => l.id !== id))

  // Params currently driven by an LFO — their sliders set the centre point
  // rather than the live value, so the UI marks them.
  const modulated = new Set(lfos.filter((l) => l.enabled && l.depth > 0).map((l) => l.target))

  const renderSlider = ({ key, label, min, max, step }) => (
    <div className="lab__row" key={key}>
      <label htmlFor={key}>
        {modulated.has(key) ? <span className="lab__mod-dot">~</span> : null}
        {label}
      </label>
      <span className="lab__value">{Number(params[key]).toFixed(step < 1 ? 2 : 0)}</span>
      <input
        id={key}
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onChange={(e) => set(key, parseFloat(e.target.value))}
      />
    </div>
  )

  // Sampled frame rate — the headline number for whether this is viable as an
  // always-on background rather than a demo.
  const frames = useRef(0)
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      frames.current += 1
      if (now - last >= 500) {
        setFps(Math.round((frames.current * 1000) / (now - last)))
        frames.current = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const water = (
    <div className="lab__water">
      <WaterGL params={params} lfos={lfos} paused={paused} onFallback={setGlError} />
    </div>
  )

  // Without WebGL2 there's no water to tune, so drop the controls and leave
  // just WaterGL's notice. Same position in the tree, so it stays mounted.
  if (glError) return <div className="lab">{water}</div>

  return (
    <div className="lab">
      {water}

      {/* Tile boundaries, drawn in CSS so they never touch the 1-bit output. */}
      {tiling && showGrid ? (
        <div
          className="lab__grid"
          style={{ backgroundSize: `${params.tile * params.pixelSize}px ${params.tile * params.pixelSize}px` }}
        />
      ) : null}

      <div className="lab__fps">
        {fps} fps
      </div>

      <button className="lab__toggle" onClick={() => setShowPanel((v) => !v)}>
        {showPanel ? 'hide' : 'controls'}
      </button>

      <div className={`lab__panel${showPanel ? '' : ' is-hidden'}`}>
        <h1 className="lab__title">water lab</h1>
        <p className="lab__hint">push the sliders past comfortable. find the edges.</p>

        <div className="lab__presets">
          <div className="lab__buttons">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                className={`lab__btn${
                  name === activePreset
                    ? presetMatches(PRESETS[name], params, lfos)
                      ? ' is-active'
                      : ' is-modified'
                    : ''
                }`}
                onClick={() => applyPreset(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="lab__buttons">
            <button className="lab__btn" onClick={randomize}>
              random
            </button>
          </div>
        </div>

        {/* Output first: how the water is drawn — colours, resolution, tiling —
            as opposed to what the water does, which is everything below. */}
        <fieldset className="lab__group">
          <legend className="lab__legend">output</legend>
          {/* Colour pickers on the left, invert beside them — it acts on both. */}
          <div className="lab__palette">
            <div className="lab__palette-pickers">
              <div className="lab__row">
                <label htmlFor="ink">ink</label>
                <input
                  id="ink"
                  type="color"
                  value={params.ink}
                  onChange={(e) => set('ink', e.target.value)}
                />
              </div>
              <div className="lab__row">
                <label htmlFor="paper">paper</label>
                <input
                  id="paper"
                  type="color"
                  value={params.paper}
                  onChange={(e) => set('paper', e.target.value)}
                />
              </div>
            </div>
            <button
              className="lab__btn lab__btn--mini"
              onClick={() => setParams((p) => ({ ...p, ink: p.paper, paper: p.ink }))}
              aria-label="swap ink and paper"
            >
              <SwapIcon />
            </button>
          </div>
          <div className="lab__spacer" />
          {groupedParams('output').map(renderSlider)}
          <div className="lab__row">
            <label htmlFor="tile">tile</label>
            <input
              id="tile"
              type="checkbox"
              checked={params.tile > 0}
              onChange={(e) => set('tile', e.target.checked ? lastTile : 0)}
            />
          </div>
          {params.tile > 0 ? (
            <>
              <div className="lab__row">
                <label htmlFor="tileSize">size (px)</label>
                <select
                  id="tileSize"
                  className="lab__select"
                  value={params.tile}
                  onChange={(e) => {
                    const size = Number(e.target.value)
                    setLastTile(size)
                    set('tile', size)
                  }}
                >
                  {TILE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lab__row">
                <label htmlFor="grid">show grid</label>
                <input
                  id="grid"
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
              </div>
            </>
          ) : null}
        </fieldset>

        {GROUPS.filter((group) => group !== 'output').map((group) => {
          const all = groupedParams(group)
          const basic = all.filter((p) => !p.advanced)
          const advanced = all.filter((p) => p.advanced)
          return (
            <fieldset className="lab__group" key={group}>
              <legend className="lab__legend">{group}</legend>
              {basic.map(renderSlider)}
              {advanced.length > 0 ? (
                <details className="lab__more">
                  <summary>more</summary>
                  {advanced.map(renderSlider)}
                </details>
              ) : null}
            </fieldset>
          )
        })}

        <fieldset className="lab__group">
          <legend className="lab__legend">modulation</legend>

          {lfos.length === 0 ? (
            <p className="lab__hint" style={{ margin: '6px 0' }}>
              no lfos. add one and point it at any parameter.
            </p>
          ) : null}

          {lfos.map((lfo, i) => (
            <div className="lab__lfo" key={lfo.id}>
              <div className="lab__lfo-head">
                <span className="lab__lfo-name">lfo {i + 1}</span>
                <label className="lab__lfo-enable">
                  <input
                    type="checkbox"
                    checked={lfo.enabled}
                    onChange={(e) => updateLFO(lfo.id, { enabled: e.target.checked })}
                  />
                  on
                </label>
                <button
                  className="lab__btn lab__btn--tiny"
                  onClick={() => removeLFO(lfo.id)}
                  aria-label={`remove lfo ${i + 1}`}
                >
                  ×
                </button>
              </div>

              <div className="lab__row">
                <label>target</label>
                <select
                  className="lab__select"
                  value={lfo.target}
                  onChange={(e) => updateLFO(lfo.id, { target: e.target.value })}
                >
                  {MODULATABLE.map((key) => (
                    <option key={key} value={key}>
                      {PARAM_META[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lab__row">
                <label>shape</label>
                <select
                  className="lab__select"
                  value={lfo.shape}
                  onChange={(e) => updateLFO(lfo.id, { shape: e.target.value })}
                >
                  {SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lab__row">
                <label>rate</label>
                <span className="lab__value">{lfo.rate.toFixed(2)} hz</span>
                <input
                  type="range"
                  min={0.01}
                  max={16}
                  step={0.01}
                  value={lfo.rate}
                  onChange={(e) => updateLFO(lfo.id, { rate: parseFloat(e.target.value) })}
                />
              </div>

              <div className="lab__row">
                <label>depth</label>
                <span className="lab__value">{Math.round(lfo.depth * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={lfo.depth}
                  onChange={(e) => updateLFO(lfo.id, { depth: parseFloat(e.target.value) })}
                />
              </div>

              <div className="lab__row">
                <label>phase</label>
                <span className="lab__value">{Math.round(lfo.phase * 360)}°</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={lfo.phase}
                  onChange={(e) => updateLFO(lfo.id, { phase: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          ))}

          <div className="lab__buttons">
            <button className="lab__btn" onClick={addLFO}>
              + add lfo
            </button>
          </div>
        </fieldset>

        <fieldset className="lab__group">
          <legend className="lab__legend">actions</legend>
          <div className="lab__buttons">
            <button className="lab__btn" onClick={() => setPaused((v) => !v)}>
              {paused ? 'play' : 'pause'}
            </button>
            <button
              className="lab__btn"
              onClick={() => set('seed', Math.floor(Math.random() * 100000))}
            >
              reseed
            </button>
            <button
              className="lab__btn"
              onClick={() => {
                setParams({ ...DEFAULTS })
                setLfos(defaultLfos())
                setActivePreset('organic')
              }}
            >
              reset
            </button>
            <button
              className="lab__btn"
              onClick={() => {
                navigator.clipboard?.writeText(JSON.stringify(exportConfig(params, lfos), null, 2))
              }}
            >
              copy config
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}

export default StyleLab
