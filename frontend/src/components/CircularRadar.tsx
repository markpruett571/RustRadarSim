import { useMemo, useEffect, useRef } from 'react'
import { SimulationConfig, TargetPosition } from '../types'

interface CircularRadarProps {
  data: number[][]
  config: SimulationConfig
  targets?: TargetPosition[]
}

function CircularRadar({ data, config, targets = [] }: CircularRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number>()
  const sweepAngleRef = useRef(0)
  const size = 500 // Canvas size

  // Find max value for normalization
  const maxValue = useMemo(() => {
    return Math.max(...data.flat(), 0.001) // Avoid division by zero
  }, [data])

  // Draw static background to offscreen canvas (only when data changes)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create offscreen canvas for background caching
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = size
    bgCanvas.height = size
    const bgCtx = bgCanvas.getContext('2d')
    if (!bgCtx) return

    const centerX = size / 2
    const centerY = size / 2
    const maxRadius = size / 2 - 30

    // Clear background canvas
    bgCtx.fillStyle = '#000011'
    bgCtx.fillRect(0, 0, size, size)

    // Draw range rings
    bgCtx.strokeStyle = '#333366'
    bgCtx.lineWidth = 1
    const numRings = 5
    for (let i = 1; i <= numRings; i++) {
      const radius = (maxRadius / numRings) * i
      bgCtx.beginPath()
      bgCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      bgCtx.stroke()
    }

    // Draw angle lines (every 45 degrees)
    bgCtx.strokeStyle = '#333366'
    bgCtx.lineWidth = 1
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = (angle * Math.PI) / 180
      bgCtx.beginPath()
      bgCtx.moveTo(centerX, centerY)
      bgCtx.lineTo(
        centerX + maxRadius * Math.cos(rad),
        centerY + maxRadius * Math.sin(rad)
      )
      bgCtx.stroke()
    }

    // Draw angle labels
    bgCtx.fillStyle = '#88aaff'
    bgCtx.font = 'bold 11px Arial'
    bgCtx.textAlign = 'center'
    bgCtx.textBaseline = 'middle'
    const directions = [
      { angle: 0, label: '0°' },
      { angle: 45, label: '45°' },
      { angle: 90, label: '90°' },
      { angle: 135, label: '135°' },
      { angle: 180, label: '180°' },
      { angle: 225, label: '225°' },
      { angle: 270, label: '270°' },
      { angle: 315, label: '315°' },
    ]
    for (const dir of directions) {
      const rad = (dir.angle * Math.PI) / 180
      const labelRadius = maxRadius + 18
      const x = centerX + labelRadius * Math.cos(rad)
      const y = centerY + labelRadius * Math.sin(rad)
      bgCtx.fillText(dir.label, x, y)
    }

    // Draw range labels
    bgCtx.fillStyle = '#88aaff'
    bgCtx.font = '10px Arial'
    bgCtx.textAlign = 'center'
    for (let i = 1; i <= numRings; i++) {
      const radius = (maxRadius / numRings) * i
      const rangePercent = Math.round((i / numRings) * 100)
      bgCtx.fillText(`${rangePercent}%`, centerX, centerY - radius + 3)
    }

    // Draw the radar data
    const nRangeBins = config.n_range_bins
    const nDopplerBins = config.n_doppler_bins
    const sectorAngleStep = (2 * Math.PI) / nDopplerBins
    
    for (let rangeIdx = 0; rangeIdx < nRangeBins; rangeIdx++) {
      const innerRadius = (rangeIdx / nRangeBins) * maxRadius
      const outerRadius = ((rangeIdx + 1) / nRangeBins) * maxRadius
      
      for (let dopplerIdx = 0; dopplerIdx < nDopplerBins; dopplerIdx++) {
        const value = data[rangeIdx][dopplerIdx]
        const normalized = Math.min(value / maxValue, 1.0)
        
        if (normalized < 0.01) continue
        
        const dopplerCenter = nDopplerBins / 2
        const angleOffset = ((dopplerIdx - dopplerCenter) / nDopplerBins) * 2 * Math.PI
        const startAngle = angleOffset - sectorAngleStep / 2
        const endAngle = angleOffset + sectorAngleStep / 2
        
        // Determine color based on intensity
        let r, g, b
        if (normalized < 0.33) {
          const t = normalized / 0.33
          r = Math.round(0 + t * 255)
          g = Math.round(255)
          b = Math.round(0)
        } else if (normalized < 0.66) {
          const t = (normalized - 0.33) / 0.33
          r = Math.round(255)
          g = Math.round(255 - t * 128)
          b = Math.round(0)
        } else {
          const t = (normalized - 0.66) / 0.34
          r = Math.round(255)
          g = Math.round(127 - t * 127)
          b = Math.round(0)
        }
        
        // Draw sector
        bgCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(normalized * 0.8, 0.8)})`
        bgCtx.beginPath()
        bgCtx.moveTo(centerX, centerY)
        bgCtx.arc(centerX, centerY, outerRadius, startAngle, endAngle)
        bgCtx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true)
        bgCtx.closePath()
        bgCtx.fill()
      }
    }
    
    // Clear the center area
    bgCtx.fillStyle = '#000011'
    bgCtx.beginPath()
    bgCtx.arc(centerX, centerY, 15, 0, 2 * Math.PI)
    bgCtx.fill()

    // Draw center crosshair
    bgCtx.strokeStyle = '#ffffff'
    bgCtx.lineWidth = 2
    bgCtx.beginPath()
    bgCtx.moveTo(centerX - 10, centerY)
    bgCtx.lineTo(centerX + 10, centerY)
    bgCtx.moveTo(centerX, centerY - 10)
    bgCtx.lineTo(centerX, centerY + 10)
    bgCtx.stroke()

    // Draw center dot
    bgCtx.fillStyle = '#ffffff'
    bgCtx.beginPath()
    bgCtx.arc(centerX, centerY, 3, 0, 2 * Math.PI)
    bgCtx.fill()

    // Store the background canvas
    backgroundCanvasRef.current = bgCanvas
  }, [data, config, maxValue, size])

  // Animation loop - only draws the sweep line
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = size / 2
    const centerY = size / 2
    const maxRadius = size / 2 - 30

    // Animation function
    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size)

      // Draw cached background
      if (backgroundCanvasRef.current) {
        ctx.drawImage(backgroundCanvasRef.current, 0, 0)
      }

      // Draw animated sweep line
      const sweepAngle = sweepAngleRef.current
      const sweepRad = (sweepAngle * Math.PI) / 180

      // Create gradient for sweep line
      const gradient = ctx.createLinearGradient(
        centerX,
        centerY,
        centerX + maxRadius * Math.cos(sweepRad),
        centerY + maxRadius * Math.sin(sweepRad)
      )
      gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)')
      gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.4)')
      gradient.addColorStop(1, 'rgba(0, 255, 0, 0)')

      // Draw sweep line
      ctx.strokeStyle = gradient
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(
        centerX + maxRadius * Math.cos(sweepRad),
        centerY + maxRadius * Math.sin(sweepRad)
      )
      ctx.stroke()

      // Draw sweep arc (trailing fade effect)
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)'
      ctx.lineWidth = 2
      ctx.beginPath()
      const arcStart = sweepRad - (15 * Math.PI) / 180
      const arcEnd = sweepRad
      ctx.arc(centerX, centerY, maxRadius, arcStart, arcEnd)
      ctx.stroke()

      // Draw moving targets
      if (targets.length > 0) {
        const maxRangeM = 50_000.0 // Maximum range in meters for scaling
        for (const target of targets) {
          // Convert range to radius (normalized to maxRadius)
          const normalizedRange = Math.min(target.range_m / maxRangeM, 1.0)
          const targetRadius = normalizedRange * maxRadius
          
          // Convert azimuth to radians
          const targetRad = (target.azimuth_deg * Math.PI) / 180
          
          // Calculate target position
          const targetX = centerX + targetRadius * Math.cos(targetRad)
          const targetY = centerY + targetRadius * Math.sin(targetRad)
          
          // Draw target (bright dot)
          ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(target.rcs, 1.0)})`
          ctx.beginPath()
          ctx.arc(targetX, targetY, 5, 0, 2 * Math.PI)
          ctx.fill()
          
          // Draw target ID label
          ctx.fillStyle = '#ff0000'
          ctx.font = '10px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(`T${target.id}`, targetX, targetY - 10)
          
          // Draw velocity vector (small line showing direction)
          const velLength = Math.min(Math.abs(target.vel_m_s) / 10, 20)
          const velRad = targetRad + (target.vel_m_s > 0 ? Math.PI : 0)
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(targetX, targetY)
          ctx.lineTo(
            targetX + velLength * Math.cos(velRad),
            targetY + velLength * Math.sin(velRad)
          )
          ctx.stroke()
        }
      }

      // Increment sweep angle
      sweepAngleRef.current = (sweepAngleRef.current + 0.5) % 360

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animate()

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [size, targets])

  return (
    <div className="circular-radar">
      <div className="radar-container">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          style={{
            display: 'block',
            margin: '0 auto',
            border: '2px solid #444',
            borderRadius: '8px',
            background: '#000011',
          }}
        />
      </div>
      <div className="radar-info">
        <p>Max Value: {maxValue.toFixed(4)}</p>
        <p>Range Bins: {config.n_range_bins} | Doppler Bins: {config.n_doppler_bins}</p>
        <p className="radar-legend">
          <span className="legend-item">
            <span className="legend-color" style={{ background: 'rgb(0, 255, 0)' }}></span>
            Low
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ background: 'rgb(255, 255, 0)' }}></span>
            Medium
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ background: 'rgb(255, 0, 0)' }}></span>
            High
          </span>
        </p>
      </div>
    </div>
  )
}

export default CircularRadar
