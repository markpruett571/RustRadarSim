import { useState, useEffect, useCallback } from 'react'
import './App.css'
import CircularRadar from './components/CircularRadar'
import SimulationControls from './components/SimulationControls'
import { useWebSocket } from './hooks/useWebSocket'
import { SimulationResult, SimulationParams, WebSocketMessage, TargetPosition } from './types'

const API_URL = 'http://127.0.0.1:3001/api/simulate'

function App() {
  const [data, setData] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [targets, setTargets] = useState<TargetPosition[]>([])
  const [tracking, setTracking] = useState(false)
  const [params, setParams] = useState<SimulationParams>({
    fc: 10e9,
    fs: 1e6,
    prf: 500,
    num_pulses: 32,
    pulse_width: 50e-6,
    noise_sigma: 0.1,
  })

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

  // Fallback to HTTP if WebSocket is not available
  const fetchSimulation = useCallback(async (customParams: SimulationParams | null = null) => {
    setLoading(true)
    setError(null)
    setStatus(null)
    try {
      const queryParams = new URLSearchParams()
      const paramsToUse = customParams || params
      
      Object.entries(paramsToUse).forEach(([key, value]) => {
        queryParams.append(key, value.toString())
      })

      const response = await fetch(`${API_URL}?${queryParams}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json() as SimulationResult
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching simulation:', err)
    } finally {
      setLoading(false)
    }
  }, [params])

  const handleParamChange = (newParams: SimulationParams) => {
    setParams(newParams)
  }

  const handleRunSimulation = useCallback(() => {
    setError(null)
    setStatus(null)
    
    // Use WebSocket if connected, otherwise fall back to HTTP
    if (connected && send) {
      setLoading(true)
      const message: WebSocketMessage = {
        type: 'simulate',
        params: {
          fc: params.fc,
          fs: params.fs,
          prf: params.prf,
          num_pulses: params.num_pulses,
          pulse_width: params.pulse_width,
          noise_sigma: params.noise_sigma,
        }
      }
      const success = send(message)
      
      if (!success) {
        // Fallback to HTTP if WebSocket send failed
        fetchSimulation()
      }
    } else {
      // Use HTTP fallback
      fetchSimulation()
    }
  }, [connected, send, params, fetchSimulation])

  const handleStartTracking = useCallback(() => {
    if (!connected || !send) {
      setError('WebSocket not connected')
      return
    }

    setTracking(true)
    setTargets([])
    const message: WebSocketMessage = {
      type: 'start_tracking',
      params: {
        fc: params.fc,
        fs: params.fs,
        prf: params.prf,
        num_pulses: params.num_pulses,
        pulse_width: params.pulse_width,
        noise_sigma: params.noise_sigma,
      }
    }
    send(message)
  }, [connected, send, params])

  // Initial load - use HTTP for first load
  useEffect(() => {
    if (!data) {
      fetchSimulation()
    }
  }, [fetchSimulation, data])

  const displayError = error || wsError

  return (
    <div className="app">
      <header>
        <h1>Radar Simulation Dashboard</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '●' : '○'}
          </span>
          <span>{connected ? 'WebSocket Connected' : 'WebSocket Disconnected (using HTTP fallback)'}</span>
        </div>
      </header>
      
      <main>
        <SimulationControls
          params={params}
          onParamChange={handleParamChange}
          onRunSimulation={handleRunSimulation}
          loading={loading}
        />

        <div className="tracking-controls">
          <button 
            onClick={handleStartTracking} 
            disabled={!connected || tracking}
            className="track-button"
          >
            {tracking ? 'Tracking Active...' : 'Start Target Tracking'}
          </button>
          {tracking && (
            <p className="tracking-status">Tracking {targets.length} target(s)</p>
          )}
        </div>

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

        {data && !loading && (
          <div className="visualizations">
            <div className="chart-container">
              <h2>Circular Radar Display</h2>
              <CircularRadar data={data.range_doppler_map} config={data.config} targets={targets} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

