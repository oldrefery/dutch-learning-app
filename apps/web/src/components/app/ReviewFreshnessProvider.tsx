'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { usePathname } from 'next/navigation'
import { flushReviewFreshness } from '@/features/review/freshness-actions'

interface ReviewFreshness {
  beginAttempt: () => void
  flushAtBoundary: () => void
  settleAttempt: (outcome: 'confirmed' | 'unknown' | 'invalid') => void
}

const noop = () => {}
const DEFAULT_FRESHNESS: ReviewFreshness = {
  beginAttempt: noop,
  flushAtBoundary: noop,
  settleAttempt: noop,
}
const ReviewFreshnessContext = createContext<ReviewFreshness>(DEFAULT_FRESHNESS)

export function useReviewFreshness() {
  return useContext(ReviewFreshnessContext)
}

export function ReviewFreshnessProvider({
  children,
  userId,
}: {
  children: React.ReactNode
  userId: string
}) {
  const pathname = usePathname()
  const state = useRef({
    dirty: 0,
    flushing: false,
    inFlight: 0,
    requested: false,
  })
  const requestFlush = useRef<(() => void) | null>(null)
  const previousPathname = useRef(pathname)
  const flush = useCallback(() => {
    const current = state.current
    if (current.inFlight > 0) {
      current.requested = true
      return
    }
    if (!current.dirty || current.flushing) return
    const revision = current.dirty
    current.flushing = true
    void flushReviewFreshness(userId)
      .then(flushed => {
        if (flushed) current.dirty = Math.max(0, current.dirty - revision)
      })
      .finally(() => {
        current.flushing = false
        if (current.requested) {
          current.requested = false
          requestFlush.current?.()
        }
      })
  }, [userId])
  useEffect(() => {
    requestFlush.current = flush
  }, [flush])

  useEffect(() => {
    if (
      previousPathname.current.startsWith('/app/review') &&
      !pathname.startsWith('/app/review')
    )
      flush()
    previousPathname.current = pathname
  }, [flush, pathname])

  const value = useMemo<ReviewFreshness>(
    () => ({
      beginAttempt: () => {
        state.current.inFlight += 1
      },
      flushAtBoundary: flush,
      settleAttempt: outcome => {
        const current = state.current
        current.inFlight = Math.max(0, current.inFlight - 1)
        if (outcome !== 'invalid') current.dirty += 1
        if (current.requested && current.inFlight === 0) flush()
      },
    }),
    [flush]
  )

  return (
    <ReviewFreshnessContext.Provider value={value}>
      {children}
    </ReviewFreshnessContext.Provider>
  )
}
