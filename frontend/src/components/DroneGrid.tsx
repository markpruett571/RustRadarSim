import { useEffect, useRef } from 'react'
import { TargetPosition } from '../types'

interface DroneGridProps {
  targets: TargetPosition[]
  maxRange?: number // Maximum range in meters for scaling
}

interface DroneHistory {
  id: number
  positions: Array<{ x: number; y: number; time: number }>
}

function DroneGrid({ targets, maxRange = 50_000 }: DroneGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<Map<number, DroneHistory>>(new Map())
  const size = 600 // Canvas size

  // Convert polar coordinates (range, azimuth) to Cartesian (x, y)
  const polarToCartesian = (range: number, azimuthDeg: number) => {
    const azimuthRad = (azimuthDeg * Math.PI) / 180
    const x = range * Math.cos(azimuthRad)
    const y = range * Math.sin(azimuthRad)
    return { x, y }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = size / 2
    const centerY = size / 2
    const scale = (size * 0.4) / maxRange // Scale factor to fit maxRange in canvas

    // Update history with current positions
    const now = Date.now()
    targets.forEach((target) => {
      const { x, y } = polarToCartesian(target.range_m, target.azimuth_deg)
      const scaledX = centerX + x * scale
      const scaledY = centerY - y * scale // Flip Y axis (screen coordinates)

      if (!historyRef.current.has(target.id)) {
        historyRef.current.set(target.id, {
          id: target.id,
          positions: [],
        })
      }

      const history = historyRef.current.get(target.id)!
      history.positions.push({ x: scaledX, y: scaledY, time: now })

      // Keep only last 50 positions for trail (about 5 seconds at 10fps)
      if (history.positions.length > 50) {
        history.positions.shift()
      }

      // Remove old positions (older than 5 seconds)
      const fiveSecondsAgo = now - 5000
      history.positions = history.positions.filter((pos) => pos.time > fiveSecondsAgo)
    })

    // Remove history for drones that are no longer present
    const activeIds = new Set(targets.map((t) => t.id))
    for (const [id] of historyRef.current) {
      if (!activeIds.has(id)) {
        historyRef.current.delete(id)
      }
    }

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size)

      // Draw background
      ctx.fillStyle = '#0a0a1a'
      ctx.fillRect(0, 0, size, size)

      // Draw grid
      ctx.strokeStyle = '#1a1a3a'
      ctx.lineWidth = 1

      // Draw concentric circles (range rings)
      const numRings = 5
      for (let i = 1; i <= numRings; i++) {
        const radius = (i / numRings) * (size * 0.4)
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.stroke()

        // Draw range labels
        const rangeKm = ((i / numRings) * maxRange) / 1000
        ctx.fillStyle = '#88aaff'
        ctx.font = '10px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${rangeKm.toFixed(0)} km`, centerX, centerY - radius + 3)
      }

      // Draw angle lines (every 30 degrees)
      ctx.strokeStyle = '#1a1a3a'
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180
        const radius = size * 0.4
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(
          centerX + radius * Math.cos(rad),
          centerY - radius * Math.sin(rad)
        )
        ctx.stroke()
      }

      // Draw cardinal directions
      ctx.fillStyle = '#88aaff'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const labelRadius = size * 0.42
      const directions = [
        { angle: 0, label: 'N' },
        { angle: 90, label: 'E' },
        { angle: 180, label: 'S' },
        { angle: 270, label: 'W' },
      ]
      directions.forEach((dir) => {
        const rad = (dir.angle * Math.PI) / 180
        const x = centerX + labelRadius * Math.cos(rad)
        const y = centerY - labelRadius * Math.sin(rad)
        ctx.fillText(dir.label, x, y)
      })

      // Draw drone trails (history)
      historyRef.current.forEach((history) => {
        if (history.positions.length < 2) return

        ctx.strokeStyle = `rgba(255, 100, 100, 0.3)`
        ctx.lineWidth = 2
        ctx.beginPath()

        for (let i = 0; i < history.positions.length - 1; i++) {
          const pos = history.positions[i]
          const nextPos = history.positions[i + 1]

          if (i === 0) {
            ctx.moveTo(pos.x, pos.y)
          }
          ctx.lineTo(nextPos.x, nextPos.y)
        }
        ctx.stroke()
      })

      // Draw drones
      targets.forEach((target) => {
        const { x, y } = polarToCartesian(target.range_m, target.azimuth_deg)
        const screenX = centerX + x * scale
        const screenY = centerY - y * scale

        // Draw drone as a circle with pulsing effect
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 200)
        const radius = 6 * pulse

        // Outer glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius + 5)
        gradient.addColorStop(0, `rgba(255, 50, 50, ${0.6 * pulse})`)
        gradient.addColorStop(1, 'rgba(255, 50, 50, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(screenX, screenY, radius + 5, 0, 2 * Math.PI)
        ctx.fill()

        // Main drone dot
        ctx.fillStyle = '#ff3232'
        ctx.beginPath()
        ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI)
        ctx.fill()

        // Draw velocity vector
        const velLength = Math.min(Math.abs(target.vel_m_s) * 2, 30)
        const velRad = (target.azimuth_deg * Math.PI) / 180 + (target.vel_m_s > 0 ? Math.PI : 0)
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(screenX, screenY)
        ctx.lineTo(
          screenX + velLength * Math.cos(velRad),
          screenY - velLength * Math.sin(velRad)
        )
        ctx.stroke()

        // Draw drone ID label
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 11px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`D${target.id}`, screenX, screenY - 15)
      })

      // Draw center (radar position)
      ctx.fillStyle = '#00ff00'
      ctx.beginPath()
      ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI)
      ctx.fill()

      // Draw center crosshair
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(centerX - 8, centerY)
      ctx.lineTo(centerX + 8, centerY)
      ctx.moveTo(centerX, centerY - 8)
      ctx.lineTo(centerX, centerY + 8)
      ctx.stroke()
    }

    // Start animation loop
    const interval = setInterval(() => {
      animate()
    }, 100) // Update at ~10fps

    // Initial draw
    animate()

    return () => {
      clearInterval(interval)
    }
  }, [targets, maxRange, size])

  return (
    <div className="drone-grid">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          display: 'block',
          margin: '0 auto',
          border: '2px solid #444',
          borderRadius: '8px',
          background: '#0a0a1a',
        }}
      />
      <div className="grid-info">
        <p>2D Position Plot - Range: 0 to {maxRange / 1000} km</p>
        <p className="grid-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#ff3232' }}></span>
            Drone Position
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ background: 'rgba(255, 100, 100, 0.3)' }}></span>
            Movement Trail
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ background: '#ffff00' }}></span>
            Velocity Vector
          </span>
        </p>
      </div>
    </div>
  )
}

export default DroneGrid

