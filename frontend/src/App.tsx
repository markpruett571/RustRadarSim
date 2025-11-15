import { useState, useEffect, useCallback } from 'react'
import './App.css'
import CircularRadar from './components/CircularRadar'
import DroneGrid from './components/DroneGrid'
import DetectionControls from './components/SimulationControls'
import { useWebSocket } from './hooks/useWebSocket'
import { useAnalysisWebSocket } from './hooks/useAnalysisWebSocket'
import { SimulationResult, WebSocketMessage, TargetPosition, DroneAnalysis, AnalysisWebSocketMessage } from './types'

function App() {
  const [data, setData] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetPosition[]>([])
  const [tracking, setTracking] = useState(false)
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null)
  const [analysisResult, setAnalysisResult] = useState<DroneAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)

  const { socket, connected, error: wsError, send } = useWebSocket()
  const { socket: analysisSocket, connected: analysisConnected, error: analysisError, send: sendAnalysis } = useAnalysisWebSocket()

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
            // Clear selection if selected drone is no longer in the list
            if (selectedDroneId !== null && !message.targets.some(t => t.id === selectedDroneId)) {
              setSelectedDroneId(null)
            }
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

  // Handle analysis WebSocket messages
  useEffect(() => {
    if (!analysisSocket) return

    analysisSocket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as AnalysisWebSocketMessage
        
        switch (message.type) {
          case 'analysis_result':
            setAnalysisResult(message.analysis)
            setAnalyzing(false)
            setAnalysisStatus(null)
            break
          case 'analysis_error':
            setAnalyzing(false)
            setAnalysisStatus(null)
            setError(message.message)
            break
          case 'analysis_status':
            setAnalysisStatus(message.message)
            break
          default:
            console.log('Unknown analysis message type:', (message as { type: string }).type)
        }
      } catch (err) {
        console.error('Error parsing analysis WebSocket message:', err)
        setError('Failed to parse analysis server message')
      }
    }
  }, [analysisSocket])

  const handleAnalyze = useCallback(() => {
    if (!analysisConnected || !sendAnalysis || selectedDroneId === null) {
      setError('Analysis WebSocket not connected or no drone selected')
      return
    }

    const selectedTarget = targets.find(t => t.id === selectedDroneId)
    if (!selectedTarget) {
      setError('Selected drone not found')
      return
    }

    setAnalyzing(true)
    setAnalysisResult(null)
    setAnalysisStatus(null)
    setError(null)

    const message: AnalysisWebSocketMessage = {
      type: 'analyze',
      drone_id: selectedDroneId,
      target: selectedTarget
    }
    sendAnalysis(message)
  }, [analysisConnected, sendAnalysis, selectedDroneId, targets])

  const displayError = error || wsError || analysisError

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Detected Drones ({targets.length})</h2>
              {selectedDroneId !== null && (
                <button 
                  onClick={handleAnalyze}
                  disabled={!analysisConnected || analyzing}
                  className="analyze-button"
                >
                  {analyzing ? 'Analyzing...' : 'Analyze Selected Drone'}
                </button>
              )}
            </div>
            {analysisStatus && (
              <div className="analysis-status">
                <p>{analysisStatus}</p>
              </div>
            )}
            <div className="drone-list">
              {targets.map((target) => {
                const isSelected = selectedDroneId === target.id
                return (
                  <div 
                    key={target.id} 
                    className={`drone-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDroneId(isSelected ? null : target.id)}
                  >
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
                )
              })}
            </div>
          </div>
        )}

        {analysisResult && (
          <div className="analysis-panel">
            <h2>Analysis Results - Drone #{analysisResult.drone_id}</h2>
            <div className="analysis-content">
              <div className="analysis-section">
                <h3>Threat Assessment</h3>
                <div className="threat-level">
                  <span className={`threat-badge threat-${analysisResult.threat_level}`}>
                    {analysisResult.threat_level.toUpperCase()}
                  </span>
                  <span className="confidence">Confidence: {(analysisResult.confidence * 100).toFixed(1)}%</span>
                </div>
                <p className="estimated-type">Estimated Type: {analysisResult.estimated_type}</p>
              </div>

              <div className="analysis-section">
                <h3>Trajectory Analysis</h3>
                <div className="trajectory-details">
                  <div className="trajectory-item">
                    <span className="trajectory-label">Heading:</span>
                    <span className="trajectory-value">{analysisResult.trajectory_analysis.heading_deg.toFixed(1)}°</span>
                  </div>
                  <div className="trajectory-item">
                    <span className="trajectory-label">Speed:</span>
                    <span className="trajectory-value">{analysisResult.trajectory_analysis.speed_m_s.toFixed(1)} m/s</span>
                  </div>
                  <div className="trajectory-item">
                    <span className="trajectory-label">Altitude Estimate:</span>
                    <span className="trajectory-value">{analysisResult.trajectory_analysis.altitude_estimate_m.toFixed(0)} m</span>
                  </div>
                </div>
              </div>

              <div className="analysis-section">
                <h3>Risk Assessment</h3>
                <div className="risk-metrics">
                  <div className="risk-item">
                    <span className="risk-label">Proximity Risk:</span>
                    <div className="risk-bar">
                      <div 
                        className="risk-bar-fill" 
                        style={{ width: `${analysisResult.risk_assessment.proximity_risk}%` }}
                      ></div>
                      <span className="risk-value">{analysisResult.risk_assessment.proximity_risk.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="risk-item">
                    <span className="risk-label">Velocity Risk:</span>
                    <div className="risk-bar">
                      <div 
                        className="risk-bar-fill" 
                        style={{ width: `${analysisResult.risk_assessment.velocity_risk}%` }}
                      ></div>
                      <span className="risk-value">{analysisResult.risk_assessment.velocity_risk.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="risk-item">
                    <span className="risk-label">Overall Risk:</span>
                    <div className="risk-bar">
                      <div 
                        className="risk-bar-fill risk-overall" 
                        style={{ width: `${analysisResult.risk_assessment.overall_risk}%` }}
                      ></div>
                      <span className="risk-value">{analysisResult.risk_assessment.overall_risk.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="analysis-section">
                <h3>Recommendations</h3>
                <ul className="recommendations-list">
                  {analysisResult.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {targets.length > 0 && (
          <div className="visualizations">
            <div className="chart-container">
              <h2>2D Position Grid</h2>
              <DroneGrid 
                targets={targets} 
                maxRange={50_000}
                selectedDroneId={selectedDroneId}
                onDroneSelect={setSelectedDroneId}
              />
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

