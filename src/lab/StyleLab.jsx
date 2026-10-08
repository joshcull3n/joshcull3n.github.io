import React, { useEffect, useRef, useState } from 'react'
import WaterCanvas from '../water/WaterCanvas.jsx'
import WaterGL from '../water/WaterGL.jsx'
import { DEFAULTS } from '../water/engine.js'
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

const StyleLab = () => {
  const [params, setParams] = useState({ ...DEFAULTS })
  const [showPanel, setShowPanel] = useState(true)
  const [paused, setPaused] = useState(false)
  const [fps, setFps] = useState(0)
  const [renderer, setRenderer] = useState('gl')
  const [glError, setGlError] = useState(null)
  const [lfos, setLfos] = useState([])

  const Renderer = renderer === 'gl' ? WaterGL : WaterCanvas

  const set = (key, value) => setParams((prev) => ({ ...prev, [key]: value }))

  // A preset replaces the look (palette included) and the LFOs, but keeps the
  // viewer's pixel size and seed.
  const applyPreset = (name) => {
    const { lfos: presetLfos = [], ...look } = PRESETS[name]
    setParams((prev) => ({
      ...DEFAULTS,
      ...look,
      pixelSize: prev.pixelSize,
      seed: prev.seed,
    }))
    setLfos(presetLfos.map(([target, overrides]) => createLFO(target, overrides)))
  }

  // Rolls a whole new look, LFOs included. Keeps the palette, ink opacity and
  // pixel size; the seed is part of the roll.
  const randomize = () => {
    const { lfos: rolledLfos, ...look } = randomLook()
    setParams((prev) => ({ ...prev, ...look }))
    setLfos(rolledLfos.map(([target, overrides]) => createLFO(target, overrides)))
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

  // Sampled frame rate — the headline number for whether this is viable as a
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

  return (
    <div className="lab">
      <div className="lab__water">
        <Renderer params={params} lfos={lfos} paused={paused} onFallback={setGlError} />
      </div>

      <div className="lab__fps">
        {fps} fps · {renderer === 'gl' ? 'webgl' : 'canvas'}
        {glError ? ' (gl failed)' : ''}
      </div>

      <button className="lab__toggle" onClick={() => setShowPanel((v) => !v)}>
        {showPanel ? 'hide' : 'controls'}
      </button>

      <div className={`lab__panel${showPanel ? '' : ' is-hidden'}`}>
        <h1 className="lab__title">water lab</h1>
        <p className="lab__hint">push the sliders past comfortable. find the edges.</p>

        <div className="lab__buttons">
          <button
            className="lab__btn"
            onClick={() => setRenderer((r) => (r === 'gl' ? 'cpu' : 'gl'))}
          >
            renderer: {renderer === 'gl' ? 'webgl' : 'canvas'}
          </button>
        </div>

        <div className="lab__buttons">
          {Object.keys(PRESETS).map((name) => (
            <button key={name} className="lab__btn" onClick={() => applyPreset(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="lab__buttons">
          <button className="lab__btn" onClick={randomize}>
            random
          </button>
        </div>

        <fieldset className="lab__group">
          <legend className="lab__legend">palette</legend>
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
          <div className="lab__buttons">
            <button
              className="lab__btn"
              onClick={() => setParams((p) => ({ ...p, ink: p.paper, paper: p.ink }))}
            >
              invert
            </button>
            <button
              className="lab__btn"
              onClick={() => setParams((p) => ({ ...p, ink: '#ffffff', paper: '#000000' }))}
            >
              mono
            </button>
          </div>
        </fieldset>

        {GROUPS.map((group) => {
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
                setLfos([])
              }}
            >
              reset
            </button>
            <button
              className="lab__btn"
              onClick={() => {
                const json = JSON.stringify(exportConfig(params, lfos), null, 2)
                console.log(json)
                navigator.clipboard?.writeText(json)
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
