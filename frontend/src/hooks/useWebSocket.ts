import { useEffect, useRef, useState, useCallback } from 'react'
import { WebSocketMessage } from '../types'

const WS_URL = 'ws://127.0.0.1:3001/ws'

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
        setSocket(ws)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnected(false)
        setSocket(null)

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setError('Failed to connect to server after multiple attempts')
        }
      }

      ws.onerror = () => {
        console.error('WebSocket error')
        setError('WebSocket connection error')
      }

      return ws
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
      setError('Failed to create WebSocket connection')
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

  const send = useCallback((message: WebSocketMessage): boolean => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      return true
    } else {
      console.warn('WebSocket is not connected')
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

