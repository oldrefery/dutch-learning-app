import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import { useSegments } from 'expo-router'
import { Sentry } from '@/lib/sentry'
import {
  createRuntimeDiagnostics,
  HEARTBEAT_INTERVAL_MS,
} from '@/lib/runtimeDiagnostics'

export function useRuntimeDiagnostics(): void {
  const segments = useSegments()
  const initialSegments = useRef<readonly string[]>(segments)
  const diagnostics = useRef<ReturnType<
    typeof createRuntimeDiagnostics
  > | null>(null)

  useEffect(() => {
    if (Platform.OS === 'web') return
    const recorder = createRuntimeDiagnostics(Sentry, {
      state: AppState.currentState,
      segments: initialSegments.current,
      now: () => performance.now(),
    })
    diagnostics.current = recorder
    let timer: ReturnType<typeof setInterval> | null = null
    const updateTimer = (state: string) => {
      if (timer !== null) clearInterval(timer)
      timer =
        state === 'active'
          ? setInterval(() => recorder.tick(), HEARTBEAT_INTERVAL_MS)
          : null
    }
    const stateSubscription = AppState.addEventListener('change', state => {
      recorder.stateChanged(state)
      updateTimer(state)
    })
    const memorySubscription = AppState.addEventListener(
      'memoryWarning',
      () => {
        recorder.memoryWarning()
      }
    )
    updateTimer(AppState.currentState)
    return () => {
      recorder.stop()
      diagnostics.current = null
      if (timer !== null) clearInterval(timer)
      stateSubscription.remove()
      memorySubscription.remove()
    }
  }, [])

  useEffect(() => {
    diagnostics.current?.routeChanged(segments)
  }, [segments])
}
