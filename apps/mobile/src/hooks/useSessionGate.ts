import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { subscribeToNetworkChanges } from '@/utils/network'

export const SESSION_CHECK_TIMEOUT_MS = 8000

type SessionGate =
  | { status: 'checking' | 'unavailable' | 'signed-out'; userId: null }
  | { status: 'signed-in'; userId: string }

/** Routing only. Server requests and access checks still enforce authorization. */
export function useSessionGate() {
  const [state, setState] = useState<SessionGate>({
    status: 'checking',
    userId: null,
  })
  const retryRef = useRef(() => {})
  const retry = useCallback(() => retryRef.current(), [])

  useEffect(() => {
    let active = true
    let revision = 0
    let needsRetry = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: ReturnType<typeof supabase.auth.getSession> | null = null
    const clearTimer = () => clearTimeout(timer)
    const check = () => {
      const request = ++revision
      needsRetry = true
      clearTimer()
      setState({ status: 'checking', userId: null })
      timer = setTimeout(() => {
        if (active && request === revision) {
          setState({ status: 'unavailable', userId: null })
        }
      }, SESSION_CHECK_TIMEOUT_MS)

      // Reuse a pending SDK refresh rather than queueing more auth-lock work.
      pending ??= supabase.auth.getSession().finally(() => {
        pending = null
      })
      void pending
        .then(({ data: { session }, error }) => {
          if (!active || request !== revision) return
          clearTimer()
          needsRetry = Boolean(error)
          if (error) setState({ status: 'unavailable', userId: null })
          else if (session?.user.id)
            setState({ status: 'signed-in', userId: session.user.id })
          else setState({ status: 'signed-out', userId: null })
        })
        .catch(() => {
          if (!active || request !== revision) return
          clearTimer()
          setState({ status: 'unavailable', userId: null })
        })
    }
    retryRef.current = check
    check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION(null) can follow a failed refresh, not just a logout.
      if (event !== 'SIGNED_OUT' && !session?.user.id) return
      revision += 1
      clearTimer()
      if (!active) return
      needsRetry = false
      setState(
        event === 'SIGNED_OUT'
          ? { status: 'signed-out', userId: null }
          : { status: 'signed-in', userId: session!.user.id }
      )
    })
    let wasConnected: boolean | undefined
    const unsubscribeNetwork = subscribeToNetworkChanges(connected => {
      if (active && needsRetry && connected && wasConnected === false) check()
      wasConnected = connected
    })

    return () => {
      active = false
      revision += 1
      clearTimer()
      retryRef.current = () => {}
      subscription.unsubscribe()
      unsubscribeNetwork()
    }
  }, [])

  return { ...state, retry }
}
