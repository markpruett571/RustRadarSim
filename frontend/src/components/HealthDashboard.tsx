import { useState, useEffect } from 'react'
import './HealthDashboard.css'

interface HealthStatus {
  status: string
  version: string
  uptime_seconds: number
  checks: {
    api: string
    websocket: string
    analysis_service: string
  }
}

interface Metrics {
  uptime_seconds: number
  total_requests: number
  successful_requests: number
  failed_requests: number
  active_websocket_connections: number
  analysis_operations: number
  success_rate: number
}

const HEALTH_API_URL = 'http://127.0.0.1:3001/health'
const METRICS_API_URL = 'http://127.0.0.1:3001/metrics'

export default function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    try {
      const response = await fetch(HEALTH_API_URL)
      if (!response.ok) throw new Error('Health check failed')
      const data = await response.json()
      setHealth(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status')
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch(METRICS_API_URL)
      if (!response.ok) throw new Error('Metrics fetch failed')
      const data = await response.json()
      setMetrics(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchHealth(), fetchMetrics()])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  if (loading && !health && !metrics) {
    return (
      <div className="health-dashboard">
        <h2>System Health</h2>
        <div className="loading">Loading health status...</div>
      </div>
    )
  }

  return (
    <div className="health-dashboard">
      <div className="health-header">
        <h2>System Health & Metrics</h2>
        <button onClick={fetchAll} className="refresh-button" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="health-error">
          <p>Error: {error}</p>
        </div>
      )}

      {health && (
        <div className="health-section">
          <h3>Health Status</h3>
          <div className="health-grid">
            <div className="health-item">
              <span className="health-label">Status:</span>
              <span className={`health-value status-${health.status}`}>
                {health.status.toUpperCase()}
              </span>
            </div>
            <div className="health-item">
              <span className="health-label">Version:</span>
              <span className="health-value">{health.version}</span>
            </div>
            <div className="health-item">
              <span className="health-label">Uptime:</span>
              <span className="health-value">{formatUptime(health.uptime_seconds)}</span>
            </div>
          </div>

          <div className="health-checks">
            <h4>Service Checks</h4>
            <div className="check-grid">
              <div className={`check-item check-${health.checks.api}`}>
                <span>API</span>
                <span>{health.checks.api}</span>
              </div>
              <div className={`check-item check-${health.checks.websocket}`}>
                <span>WebSocket</span>
                <span>{health.checks.websocket}</span>
              </div>
              <div className={`check-item check-${health.checks.analysis_service}`}>
                <span>Analysis Service</span>
                <span>{health.checks.analysis_service}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {metrics && (
        <div className="metrics-section">
          <h3>Performance Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Total Requests</span>
              <span className="metric-value">{metrics.total_requests.toLocaleString()}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Successful</span>
              <span className="metric-value success">
                {metrics.successful_requests.toLocaleString()}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Failed</span>
              <span className="metric-value error">
                {metrics.failed_requests.toLocaleString()}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Success Rate</span>
              <span className="metric-value">
                {metrics.success_rate.toFixed(2)}%
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Active WebSocket Connections</span>
              <span className="metric-value">
                {metrics.active_websocket_connections}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Analysis Operations</span>
              <span className="metric-value">
                {metrics.analysis_operations.toLocaleString()}
              </span>
            </div>
          </div>

          {metrics.total_requests > 0 && (
            <div className="success-rate-bar">
              <div className="bar-label">Success Rate</div>
              <div className="bar-container">
                <div
                  className="bar-fill success"
                  style={{ width: `${metrics.success_rate}%` }}
                ></div>
                <span className="bar-text">{metrics.success_rate.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

