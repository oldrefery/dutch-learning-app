import { useEffect, useLayoutEffect, useState } from 'react'

type Callback<Args extends unknown[], Result> = (...args: Args) => Result

function createLifetime<Args extends unknown[], Result>(
  initial: Callback<Args, Result>
) {
  let current: Callback<Args, Result> | null = initial
  return {
    dispatch: (...args: Args): Result | undefined => current?.(...args),
    update: (next: Callback<Args, Result>) => {
      current = next
    },
    release: () => {
      current = null
    },
  }
}

/** Stable RN-thread dispatch whose target is released when its owner unmounts. */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: Callback<Args, Result>
): (...args: Args) => Result | undefined {
  const [lifetime] = useState(() => createLifetime(callback))
  useLayoutEffect(() => {
    lifetime.update(callback)
  }, [callback, lifetime])
  useEffect(() => lifetime.release, [lifetime])
  return lifetime.dispatch
}
