import { useCallback, useLayoutEffect, useRef } from 'react'

/** Stable RN-thread dispatch without retaining callbacks from older renders. */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = useRef(callback)
  useLayoutEffect(() => {
    latest.current = callback
  }, [callback])
  return useCallback((...args: Args) => latest.current(...args), [])
}
