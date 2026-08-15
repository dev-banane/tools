import { useCallback, useRef, useState } from 'react'

export type AsyncTask<Args extends unknown[], T> = {
  /** Kept while a new run is in flight and after failure. */
  data: T | null
  error: string | null
  loading: boolean
  hasRun: boolean
  stale: boolean
  run: (...args: Args) => Promise<T | null>
  reset: () => void
}

/** Drops out-of-order responses. */
export function useAsyncTask<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
): AsyncTask<Args, T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [stale, setStale] = useState(false)
  const runIdRef = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (...args: Args) => {
    const runId = ++runIdRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await fnRef.current(...args)
      if (runId !== runIdRef.current) return null
      setData(result)
      setHasRun(true)
      setStale(false)
      return result
    } catch (err) {
      if (runId !== runIdRef.current) return null
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStale(true)
      return null
    } finally {
      if (runId === runIdRef.current) setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    runIdRef.current++
    setData(null)
    setError(null)
    setLoading(false)
    setHasRun(false)
    setStale(false)
  }, [])

  return { data, error, loading, hasRun, stale, run, reset }
}
