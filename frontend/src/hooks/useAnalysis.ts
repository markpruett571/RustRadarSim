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
      const response = await fetch(ANALYSIS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(target),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Analysis failed: ${response.status} ${errorText}`)
      }

      const analysis: DroneAnalysis = await response.json()
      setAnalyzing(false)
      return analysis
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setAnalyzing(false)
      return null
    }
  }, [])

  return { analyze, analyzing, error }
}

