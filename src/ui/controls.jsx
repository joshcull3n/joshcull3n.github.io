import React, { useEffect, useRef, useState } from 'react'
import WaterGL from '../engine/WaterGL.jsx'
import { DEFAULTS } from '../engine/defaults.js'
import { GROUPS, groupedParams, MODULATABLE, PARAM_META } from '../engine/params.js'
import { createLFO, SHAPES } from '../engine/modulation.js'
import { PRESETS, randomLook } from './presets.js'
import './styles.css'

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
      ...(enabled ? {} : { enabled: false }),
    },
  ])
  return out
}

const TILE_SIZES = [64, 128, 256, 512, 1024, 2048]
const DEFAULT_TILE = 512

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

const defaultLfos = () =>
  (PRESETS.organic.lfos ?? []).map(([target, overrides]) => createLFO(target, overrides))

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

const Controls = () => {
  const [params, setParams] = useState({ ...DEFAULTS })
  const [showPanel, setShowPanel] = useState(true)
  const [paused, setPaused] = useState(false)
  const [fps, setFps] = useState(0)
  const [glError, setGlError] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [lastTile, setLastTile] = useState(DEFAULT_TILE)
  const [lfos, setLfos] = useState(defaultLfos)
  const [activePreset, setActivePreset] = useState('organic')

  const tiling = params.tile > 0
  const set = (key, value) => setParams((prev) => ({ ...prev, [key]: value }))

  // presets dont replace pixel and tile size
  const applyPreset = (name) => {
    const { lfos: presetLfos = [], ...look } = PRESETS[name]
    setParams((prev) => ({
      ...DEFAULTS,
      ...look,
      pixelSize: prev.pixelSize,
      tile: prev.tile,
      seed: look.seed ?? prev.seed,
    }))
    setLfos(presetLfos.map(([target, overrides]) => createLFO(target, overrides)))
    setActivePreset(name)
  }

  const randomize = () => {
    const { lfos: rolledLfos, ...look } = randomLook()
    setParams((prev) => ({ ...prev, ...look }))
    setLfos(rolledLfos.map(([target, overrides]) => createLFO(target, overrides)))
    setActivePreset(null)
  }

  const addLFO = () =>
    setLfos((prev) => [
      ...prev,
      createLFO('volatility', { phase: (prev.length * 0.25) % 1 }),
    ])

  const updateLFO = (id, patch) =>
    setLfos((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const removeLFO = (id) => setLfos((prev) => prev.filter((l) => l.id !== id))

  const modulated = new Set(lfos.filter((l) => l.enabled && l.depth > 0).map((l) => l.target))

  const renderSlider = ({ key, label, min, max, step }) => (
    <div className="row" key={key}>
      <label htmlFor={key}>
        {modulated.has(key) ? <span className="mod-dot">~</span> : null}
        {label}
      </label>
      <span className="value">{Number(params[key]).toFixed(step < 1 ? 2 : 0)}</span>
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
    <div className="water">
      <WaterGL params={params} lfos={lfos} paused={paused} onFallback={setGlError} />
    </div>
  )

  if (glError) return <div className="page">{water}</div>

  return (
    <div className="page">
      {water}

      {tiling && showGrid ? (
        <div
          className="grid"
          style={{ backgroundSize: `${params.tile * params.pixelSize}px ${params.tile * params.pixelSize}px` }}
        />
      ) : null}

      <div className="fps">
        {fps} fps
      </div>

      <button className="toggle" onClick={() => setShowPanel((v) => !v)}>
        {showPanel ? 'hide' : 'controls'}
      </button>

      <div className={`panel${showPanel ? '' : ' is-hidden'}`}>
        <h3>texture generator</h3>

        <div className="presets">
          <div className="buttons">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                className={`btn${
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

          <div className="buttons">
            <button className="btn" onClick={randomize}>
              random
            </button>
          </div>
        </div>

        <fieldset className="group">
          <legend className="legend">output</legend>
          <div className="palette">
            <div className="palette-pickers">
              <div className="row">
                <label htmlFor="ink">ink</label>
                <input id="ink"
                  type="color"
                  value={params.ink}
                  onChange={(e) => set('ink', e.target.value)}
                />
              </div>
              <div className="row">
                <label htmlFor="paper">paper</label>
                <input id="paper"
                  type="color"
                  value={params.paper}
                  onChange={(e) => set('paper', e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn--mini"
              onClick={() => setParams((p) => ({ ...p, ink: p.paper, paper: p.ink }))}
              aria-label="swap ink and paper"
            >
              <SwapIcon />
            </button>
          </div>
          <div className="spacer" />
          {groupedParams('output').map(renderSlider)}
          <div className="row">
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
              <div className="row">
                <label htmlFor="tileSize">size (px)</label>
                <select
                  id="tileSize"
                  className="select"
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
              <div className="row">
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
            <fieldset className="group" key={group}>
              <legend className="legend">{group}</legend>
              {basic.map(renderSlider)}
              {advanced.length > 0 ? (
                <details className="more">
                  <summary>more</summary>
                  {advanced.map(renderSlider)}
                </details>
              ) : null}
            </fieldset>
          )
        })}

        <fieldset className="group">
          <legend className="legend">modulation</legend>

          {lfos.length === 0 ? (
            <p className="hint" style={{ margin: '6px 0' }}>
              no lfos. add one and point it at any parameter.
            </p>
          ) : null}

          {lfos.map((lfo, i) => (
            <div className="lfo" key={lfo.id}>
              <div className="lfo-head">
                <span className="lfo-name">lfo {i + 1}</span>
                <label className="lfo-enable">
                  <input
                    type="checkbox"
                    checked={lfo.enabled}
                    onChange={(e) => updateLFO(lfo.id, { enabled: e.target.checked })}
                  />
                  on
                </label>
                <button
                  className="btn btn--tiny"
                  onClick={() => removeLFO(lfo.id)}
                  aria-label={`remove lfo ${i + 1}`}
                >
                  ×
                </button>
              </div>

              <div className="row">
                <label>target</label>
                <select
                  className="select"
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

              <div className="row">
                <label>shape</label>
                <select
                  className="select"
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

              <div className="row">
                <label>rate</label>
                <span className="value">{lfo.rate.toFixed(2)} hz</span>
                <input
                  type="range"
                  min={0.01}
                  max={16}
                  step={0.01}
                  value={lfo.rate}
                  onChange={(e) => updateLFO(lfo.id, { rate: parseFloat(e.target.value) })}
                />
              </div>

              <div className="row">
                <label>depth</label>
                <span className="value">{Math.round(lfo.depth * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={lfo.depth}
                  onChange={(e) => updateLFO(lfo.id, { depth: parseFloat(e.target.value) })}
                />
              </div>

              <div className="row">
                <label>phase</label>
                <span className="value">{Math.round(lfo.phase * 360)}°</span>
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

          <div className="buttons">
            <button className="btn" onClick={addLFO}>
              + add lfo
            </button>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend className="legend">actions</legend>
          <div className="buttons">
            <button className="btn" onClick={() => setPaused((v) => !v)}>
              {paused ? 'play' : 'pause'}
            </button>
            <button
              className="btn"
              onClick={() => set('seed', Math.floor(Math.random() * 100000))}
            >
              reseed
            </button>
            <button
              className="btn"
              onClick={() => {
                setParams({ ...DEFAULTS })
                setLfos(defaultLfos())
                setActivePreset('organic')
              }}
            >
              reset
            </button>
            <button
              className="btn"
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

export default Controls
