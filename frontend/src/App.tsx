import { useState, useEffect, useCallback } from 'react'
import './App.css'
import CircularRadar from './components/CircularRadar'
import DroneGrid from './components/DroneGrid'
import DetectionControls from './components/SimulationControls'
import { useWebSocket } from './hooks/useWebSocket'
import { SimulationResult, WebSocketMessage, TargetPosition } from './types'

function App() {
  const [data, setData] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetPosition[]>([])
  const [tracking, setTracking] = useState(false)

  const { socket, connected, error: wsError, send } = useWebSocket()

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        
        switch (message.type) {
          case 'result':
            setData({
              range_doppler_map: message.range_doppler_map,
              range_profile: message.range_profile,
              config: message.config,
            })
            setLoading(false)
            setStatus(null)
            break
          case 'error':
            setError(message.message)
            setLoading(false)
            setStatus(null)
            break
          case 'status':
            setStatus(message.message)
            break
          case 'targets':
            setTargets(message.targets)
            break
          default:
            console.log('Unknown message type:', (message as { type: string }).type)
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
        setError('Failed to parse server message')
      }
    }
  }, [socket])

  const handleStartDetection = useCallback(() => {
    if (!connected || !send) {
      setError('WebSocket not connected')
      return
    }

    setTracking(true)
    setTargets([])
    setError(null)
    // Start tracking with default parameters (backend will use fixed values)
    const message: WebSocketMessage = {
      type: 'start_tracking',
      params: {}
    }
    send(message)
  }, [connected, send])

  // Auto-start detection when WebSocket connects
  useEffect(() => {
    if (connected && !tracking) {
      handleStartDetection()
    }
  }, [connected, tracking, handleStartDetection])

  const displayError = error || wsError

  return (
    <div className="app">
      <header>
        <h1>Drone Detection Radar System</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '●' : '○'}
          </span>
          <span>{connected ? 'WebSocket Connected' : 'WebSocket Disconnected (using HTTP fallback)'}</span>
        </div>
      </header>
      
      <main>
        <DetectionControls
          onStartDetection={handleStartDetection}
          tracking={tracking}
          connected={connected}
        />

        {displayError && (
          <div className="error">
            <p>Error: {displayError}</p>
          </div>
        )}

        {status && (
          <div className="status">
            <p>{status}</p>
          </div>
        )}

        {loading && !status && (
          <div className="loading">
            <p>Running simulation...</p>
          </div>
        )}

        {targets.length > 0 && (
          <div className="drone-info-panel">
            <h2>Detected Drones ({targets.length})</h2>
            <div className="drone-list">
              {targets.map((target) => (
                <div key={target.id} className="drone-item">
                  <div className="drone-header">
                    <span className="drone-id">Drone #{target.id}</span>
                    <span className="drone-status">● Active</span>
                  </div>
                  <div className="drone-details">
                    <div className="drone-detail">
                      <span className="detail-label">Range:</span>
                      <span className="detail-value">{(target.range_m / 1000).toFixed(2)} km</span>
                    </div>
                    <div className="drone-detail">
                      <span className="detail-label">Azimuth:</span>
                      <span className="detail-value">{target.azimuth_deg.toFixed(1)}°</span>
                    </div>
                    <div className="drone-detail">
                      <span className="detail-label">Velocity:</span>
                      <span className="detail-value">{target.vel_m_s.toFixed(1)} m/s</span>
                    </div>
                    <div className="drone-detail">
                      <span className="detail-label">RCS:</span>
                      <span className="detail-value">{target.rcs.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {targets.length > 0 && (
          <div className="visualizations">
            <div className="chart-container">
              <h2>2D Position Grid</h2>
              <DroneGrid targets={targets} maxRange={50_000} />
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="visualizations">
            <div className="chart-container">
              <h2>Radar Display</h2>
              <CircularRadar data={data.range_doppler_map} config={data.config} targets={targets} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

