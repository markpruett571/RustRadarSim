import { useCallback, useState } from 'react'

interface RetryOptions {
  maxAttempts?: number
  delay?: number
  backoff?: boolean
}

export function useRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
) {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options
  const [retrying, setRetrying] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const execute = useCallback(async (): Promise<T> => {
    let lastError: Error | null = null
    
    for (let i = 0; i < maxAttempts; i++) {
      setAttempt(i + 1)
      
      if (i > 0) {
        setRetrying(true)
        const waitTime = backoff ? delay * Math.pow(2, i - 1) : delay
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      try {
        const result = await fn()
        setRetrying(false)
        setAttempt(0)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        if (i === maxAttempts - 1) {
          setRetrying(false)
          setAttempt(0)
          throw lastError
        }
      }
    }
    
    setRetrying(false)
    setAttempt(0)
    throw lastError || new Error('Max retry attempts reached')
  }, [fn, maxAttempts, delay, backoff])

  return { execute, retrying, attempt }
}

