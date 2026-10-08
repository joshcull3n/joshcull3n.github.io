import React, { useEffect, useRef, useState } from 'react'
import { VERT, FRAG } from './shaders.js'
import { DEFAULTS, hexToRgb, inkRgb } from './defaults.js'
import { applyModulation } from './modulation.js'

const UNIFORMS = [
  'uResolution', 'uTime', 'uInk', 'uPaper', 'uScale', 'uBands', 'uLineWidth',
  'uAmplitude', 'uFrequency', 'uVolatility', 'uWaterTime', 'uDrift', 'uDither',
  'uSeed', 'uOctaves', 'uWaves', 'uLineVary', 'uBreakup', 'uFacing', 'uLightAngle',
  'uFlow', 'uBend', 'uSwirl', 'uSpin', 'uGrain', 'uSpeckle', 'uTile',
]

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader compile failed: ${log}`)
  }
  return shader
}

function buildProgram(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`program link failed: ${log}`)
  }
  return program
}

const rgb01 = (hex) => hexToRgb(hex).map((c) => c / 255)
// ?nogl in the URL behaves as if WebGL2 were missing — for checking the
// notice without hunting down a browser that lacks it.
const forceFallback = () => new URLSearchParams(window.location.search).has('nogl')

// What browsers without WebGL2 get. There's no point faking the water without
// it, so just say why there's nothing here.
const NoWebGL = ({ className, style }) => (
  <div
    className={className}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#000',
      color: 'rgba(255, 255, 255, 0.7)',
      fontFamily: "'Departure Mono', ui-monospace, monospace",
      fontSize: '13px',
      ...style,
    }}
  >
    your browser doesn&rsquo;t support webgl2
  </div>
)

/**
 * WebGL2 renderer for the 1-bit water.
 *
 * Still draws at a low logical resolution and lets CSS scale it up with
 * image-rendering: pixelated — the GPU makes the pixel count cheap, but the
 * chunky grid is the whole look, so it stays.
 *
 * Shows a notice instead (NoWebGL) if WebGL2 is unavailable.
 */
const WaterGL = ({ params, lfos, paused = false, onFallback, className, style }) => {
  const canvasRef = useRef(null)
  const paramsRef = useRef(params)
  const lfosRef = useRef(lfos)
  const pausedRef = useRef(paused)
  const [failed, setFailed] = useState(false)

  paramsRef.current = params
  lfosRef.current = lfos
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = forceFallback() ? null : canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) {
      setFailed(true)
      onFallback?.('WebGL2 unavailable')
      return
    }

    let program
    try {
      program = buildProgram(gl)
    } catch (err) {
      setFailed(true)
      onFallback?.(err.message)
      return
    }

    const loc = {}
    for (const name of UNIFORMS) loc[name] = gl.getUniformLocation(program, name)

    // WebGL2 requires a bound VAO to draw, even with no attributes.
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.useProgram(program)

    let frameId = null
    let elapsed = 0
    let waterTime = 0 // real time integrated against speed — see the shader
    let lastStamp = null

    const loop = (stamp) => {
      if (lastStamp === null) lastStamp = stamp
      const dt = pausedRef.current ? 0 : (stamp - lastStamp) / 1000
      lastStamp = stamp
      elapsed += dt

      const p = applyModulation({ ...DEFAULTS, ...paramsRef.current }, lfosRef.current, elapsed)
      waterTime += dt * p.speed
      const pixelSize = Math.max(1, p.pixelSize || 1)
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.ceil(rect.width / pixelSize))
      const h = Math.max(1, Math.ceil(rect.height / pixelSize))

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)

      gl.uniform2f(loc.uResolution, w, h)
      gl.uniform1f(loc.uTime, elapsed)
      gl.uniform3fv(loc.uInk, inkRgb(p).map((c) => c / 255))
      gl.uniform3fv(loc.uPaper, rgb01(p.paper))
      gl.uniform1f(loc.uScale, p.scale)
      gl.uniform1f(loc.uBands, p.bands)
      gl.uniform1f(loc.uLineWidth, p.lineWidth)
      gl.uniform1f(loc.uAmplitude, p.amplitude)
      gl.uniform1f(loc.uFrequency, p.frequency)
      gl.uniform1f(loc.uVolatility, p.volatility)
      gl.uniform1f(loc.uWaterTime, waterTime)
      gl.uniform2f(loc.uDrift, p.driftX, p.driftY)
      gl.uniform1f(loc.uDither, p.dither)
      gl.uniform1f(loc.uSeed, p.seed)
      gl.uniform1i(loc.uOctaves, p.octaves)
      gl.uniform1i(loc.uWaves, p.waves)
      gl.uniform1f(loc.uLineVary, p.lineVary)
      gl.uniform1f(loc.uBreakup, p.breakup)
      gl.uniform1f(loc.uFacing, p.facing)
      gl.uniform1f(loc.uLightAngle, (p.lightAngle * Math.PI) / 180)
      gl.uniform1f(loc.uFlow, p.flow)
      gl.uniform1f(loc.uBend, p.bend)
      gl.uniform1f(loc.uSwirl, p.swirl)
      gl.uniform1f(loc.uSpin, p.spin)
      gl.uniform1f(loc.uGrain, p.grain)
      gl.uniform1f(loc.uSpeckle, p.speckle)
      gl.uniform1f(loc.uTile, p.tile || 0)

      gl.drawArrays(gl.TRIANGLES, 0, 3)
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      gl.deleteProgram(program)
      gl.deleteVertexArray(vao)
    }
  }, [onFallback])

  if (failed) return <NoWebGL className={className} style={style} />

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  )
}

export default WaterGL
