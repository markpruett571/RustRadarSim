import { useState, useCallback } from 'react'
import { DroneAnalysis, TargetPosition } from '../types'

const ANALYSIS_API_URL = 'http://127.0.0.1:3001/api/analyze'

export function useAnalysis() {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (target: TargetPosition): Promise<DroneAnalysis | null> => {
    setAnalyzing(true)
    setError(null)

    try {
      // Check if we're online
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network.')
      }

      // Retry logic with exponential backoff
      let lastError: Error | null = null
      const maxAttempts = 3
      const baseDelay = 1000

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (attempt > 0) {
            const delay = baseDelay * Math.pow(2, attempt - 1)
            await new Promise(resolve => setTimeout(resolve, delay))
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

          try {
            const response = await fetch(ANALYSIS_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(target),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Analysis failed: ${response.status} ${errorText}`)
            }

            const analysis: DroneAnalysis = await response.json()
            setAnalyzing(false)
            return analysis
          } catch (err) {
            clearTimeout(timeoutId)
            if (err instanceof Error && err.name === 'AbortError') {
              throw new Error('Request timeout: Analysis took too long')
            }
            throw err
          }
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error')
          if (attempt === maxAttempts - 1) {
            break
          }
        }
      }

      throw lastError || new Error('Max retry attempts reached')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setAnalyzing(false)
      return null
    }
  }, [])

  return { analyze, analyzing, error }
}

