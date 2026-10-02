'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TransferTicket {
  ownerId: string
  epoch: number
}

/** Sign-out permanently invalidates this mounted view, including owner ABA. */
export function useTransferSession(ownerId: string) {
  const state = useRef({
    epoch: 0,
    ownerId,
    active: false,
    alive: false,
    invalid: false,
  })
  const [session, setSession] = useState({ ready: false, active: false })
  useEffect(() => {
    const current = {
      epoch: state.current.epoch + 1,
      ownerId,
      active: false,
      alive: true,
      invalid: false,
    }
    state.current = current
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event, session) => {
      if (!current.alive) return
      if (event === 'SIGNED_OUT' || session?.user.id !== ownerId) {
        current.invalid = true
        current.epoch += 1
      }
      current.active = !current.invalid && session?.user.id === ownerId
      setSession({ ready: true, active: current.active })
    })
    return () => {
      current.alive = false
      current.active = false
      current.epoch += 1
      subscription.unsubscribe()
    }
  }, [ownerId])

  const capture = useCallback((): TransferTicket | null => {
    const current = state.current
    return current.alive && current.active && current.ownerId === ownerId
      ? { epoch: current.epoch, ownerId }
      : null
  }, [ownerId])
  const isCurrent = useCallback(
    (ticket: TransferTicket) => {
      const current = state.current
      return (
        current.alive &&
        current.active &&
        ticket.ownerId === ownerId &&
        current.ownerId === ownerId &&
        ticket.epoch === current.epoch
      )
    },
    [ownerId]
  )
  return { ...session, capture, isCurrent }
}
