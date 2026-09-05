import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return useSyncExternalStore<S | C>(
    subscribe,
    () => client,
    () => server
  )
}
