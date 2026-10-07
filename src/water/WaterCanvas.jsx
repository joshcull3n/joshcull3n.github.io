import React, { useEffect, useRef } from 'react'
import { renderFrame } from './engine.js'
import { applyModulation } from './modulation.js'

/**
 * Renders the 1-bit water at a low logical resolution and lets CSS scale it up
 * with image-rendering: pixelated — that upscale is what gives the chunky
 * pixels. Drawing at full device resolution would lose the whole look.
 *
 * Params are read through a ref inside the loop so dragging a slider retunes
 * the running animation instead of tearing down and restarting it.
 */
const WaterCanvas = ({ params, lfos, paused = false, className, style }) => {
  const canvasRef = useRef(null)
  const paramsRef = useRef(params)
  const lfosRef = useRef(lfos)
  const pausedRef = useRef(paused)

  paramsRef.current = params
  lfosRef.current = lfos
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    let frameId = null
    let imageData = null
    let logicalW = 0
    let logicalH = 0
    let startTime = null
    let elapsed = 0
    let lastStamp = null

    const resize = () => {
      const pixelSize = Math.max(1, paramsRef.current.pixelSize || 4)
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.ceil(rect.width / pixelSize))
      const h = Math.max(1, Math.ceil(rect.height / pixelSize))

      if (w !== logicalW || h !== logicalH) {
        logicalW = w
        logicalH = h
        canvas.width = w
        canvas.height = h
        imageData = ctx.createImageData(w, h)
      }
    }

    const loop = (stamp) => {
      if (startTime === null) startTime = stamp
      if (lastStamp === null) lastStamp = stamp

      // Accumulate our own clock so pausing freezes the water rather than
      // letting it jump forward when resumed.
      if (!pausedRef.current) elapsed += (stamp - lastStamp) / 1000
      lastStamp = stamp

      resize()
      if (imageData) {
        const p = applyModulation(paramsRef.current, lfosRef.current, elapsed)
        renderFrame(imageData, logicalW, logicalH, elapsed, p)
        ctx.putImageData(imageData, 0, 0)
      }

      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

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

export default WaterCanvas
