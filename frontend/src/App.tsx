import { useState, useEffect, useCallback } from 'react'
import './App.css'
import DroneGrid from './components/DroneGrid'
import DetectionControls from './components/SimulationControls'
import HealthDashboard from './components/HealthDashboard'
import { useWebSocket } from './hooks/useWebSocket'
import { useAnalysis } from './hooks/useAnalysis'
import { TargetPosition, DroneAnalysis, WebSocketMessage } from './types'

function App() {
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetPosition[]>([])
  const [tracking, setTracking] = useState(false)
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null)
  const [analysisResult, setAnalysisResult] = useState<DroneAnalysis | null>(null)

  const { socket, connected, error: wsError, send } = useWebSocket()
  const { analyze, analyzing, error: analysisError } = useAnalysis()

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        
        switch (message.type) {
          case 'targets':
            setTargets(message.targets)
            // Clear selection if selected drone is no longer in the list
            if (selectedDroneId !== null && !message.targets.some(t => t.id === selectedDroneId)) {
              setSelectedDroneId(null)
            }
            break
          case 'error':
            setError(message.message)
            setStatus(null)
            break
          case 'status':
            setStatus(message.message)
            break
          default:
            console.log('Unknown message type:', (message as { type: string }).type)
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
        setError('Failed to parse server message')
      }
    }
  }, [socket, selectedDroneId])

  const handleStartDetection = useCallback(() => {
    if (!connected || !send) {
      setError('WebSocket not connected')
      return
    }

    setTracking(true)
    setTargets([])
    setError(null)
    // Start tracking
    const message: WebSocketMessage = {
      type: 'start_tracking'
    }
    send(message)
  }, [connected, send])

  // Auto-start detection when WebSocket connects
  useEffect(() => {
    if (connected && !tracking) {
      handleStartDetection()
    }
  }, [connected, tracking, handleStartDetection])

  const handleAnalyze = useCallback(async () => {
    if (selectedDroneId === null) {
      setError('No drone selected')
      return
    }

    const selectedTarget = targets.find(t => t.id === selectedDroneId)
    if (!selectedTarget) {
      setError('Selected drone not found')
      return
    }

    setAnalysisResult(null)
    setError(null)

    const result = await analyze(selectedTarget)
    if (result) {
      setAnalysisResult(result)
    }
  }, [analyze, selectedDroneId, targets])

  return (
    <div className="app">
      <header>
        <h1>Drone Detection Radar System</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '●' : '○'}
          </span>
          <span>{connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}</span>
        </div>
      </header>
      
      <main>
        <HealthDashboard />
        
        <DetectionControls
          onStartDetection={handleStartDetection}
          tracking={tracking}
          connected={connected}
          />

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
    
        {(error || wsError || analysisError) && (
          <div className="error">
            <p>Error: {error || wsError || analysisError}</p>
          </div>
        )}

        {status && (
          <div className="status">
            <p>{status}</p>
          </div>
        )}

        {targets.length > 0 && (
          <div className="drone-info-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Detected Drones ({targets.length})</h2>
              {selectedDroneId !== null && (
                <button 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="analyze-button"
                >
                  {analyzing ? 'Analyzing...' : 'Analyze Selected Drone'}
                </button>
              )}
            </div>
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

        {(selectedDroneId !== null || analyzing || analysisResult) && (
          <div className="analysis-panel">
            {analyzing && !analysisResult ? (
              <div className="analysis-loading">
                <h2>Analyzing Drone #{selectedDroneId}</h2>
                <div className="analysis-skeleton">
                  <div className="skeleton-section">
                    <div className="skeleton-header"></div>
                    <div className="skeleton-badge"></div>
                    <div className="skeleton-text"></div>
                  </div>
                  <div className="skeleton-section">
                    <div className="skeleton-header"></div>
                    <div className="skeleton-grid">
                      <div className="skeleton-item"></div>
                      <div className="skeleton-item"></div>
                      <div className="skeleton-item"></div>
                    </div>
                  </div>
                  <div className="skeleton-section">
                    <div className="skeleton-header"></div>
                    <div className="skeleton-bars">
                      <div className="skeleton-bar"></div>
                      <div className="skeleton-bar"></div>
                      <div className="skeleton-bar"></div>
                    </div>
                  </div>
                  <div className="skeleton-section">
                    <div className="skeleton-header"></div>
                    <div className="skeleton-list">
                      <div className="skeleton-list-item"></div>
                      <div className="skeleton-list-item"></div>
                      <div className="skeleton-list-item"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : analysisResult ? (
              <>
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
              </>
            ) : (
              <div className="analysis-placeholder">
                <h2>Analysis Panel</h2>
                <p>Select a drone and click "Analyze Selected Drone" to view detailed analysis results.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App

