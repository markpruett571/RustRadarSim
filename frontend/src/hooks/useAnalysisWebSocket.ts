import { useEffect, useRef, useState, useCallback } from 'react'
import { AnalysisWebSocketMessage } from '../types'

const ANALYSIS_WS_URL = 'ws://127.0.0.1:3001/ws/analyze'

export function useAnalysisWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(ANALYSIS_WS_URL)

      ws.onopen = () => {
        console.log('Analysis WebSocket connected')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
        setSocket(ws)
      }

      ws.onclose = () => {
        console.log('Analysis WebSocket disconnected')
        setConnected(false)
        setSocket(null)

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`Attempting to reconnect analysis WebSocket in ${delay}ms (attempt ${reconnectAttempts.current})`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setError('Failed to connect to analysis server after multiple attempts')
        }
      }

      ws.onerror = () => {
        console.error('Analysis WebSocket error')
        setError('Analysis WebSocket connection error')
      }

      return ws
    } catch (err) {
      console.error('Failed to create Analysis WebSocket:', err)
      setError('Failed to create Analysis WebSocket connection')
      return null
    }
  }, [])

  useEffect(() => {
    const ws = connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (ws) {
        ws.close()
      }
    }
  }, [connect])

  const send = useCallback((message: AnalysisWebSocketMessage): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      return true
    } else {
      console.warn('Analysis WebSocket is not connected')
      return false
    }
  }, [socket])

  const close = useCallback(() => {
    if (socket) {
      socket.close()
    }
  }, [socket])

  return { socket, connected, error, send, close }
}

