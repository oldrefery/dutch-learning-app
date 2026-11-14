'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toLocalDateKey } from '@woordenaar/domain'
import {
  calendarReferenceDate,
  createReviewCalendar,
  REVIEW_TIME_ZONE_COOKIE,
  type ReviewCalendar,
} from './calendar'

const ReviewCalendarContext = createContext<ReviewCalendar | null>(null)

export function useReviewCalendarDate(): Date {
  const calendar = useContext(ReviewCalendarContext)
  const dateKey = calendar?.dateKey ?? toLocalDateKey(new Date())
  return useMemo(() => calendarReferenceDate(dateKey), [dateKey])
}

/** Keep server aggregates and client selectors on the same day snapshot.
 * Refresh merges new props without remounting an active review controller. */
export function ReviewCalendarProvider({
  calendar,
  children,
}: {
  calendar: ReviewCalendar
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let lastRefresh = -Infinity
    const check = () => {
      clearTimeout(timer)
      const now = new Date()
      const local = createReviewCalendar(
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        now
      )
      const stale =
        local.dateKey !== calendar.dateKey ||
        local.timeZone !== calendar.timeZone
      if (stale && navigator.onLine && Date.now() - lastRefresh >= 30_000) {
        document.cookie = `${REVIEW_TIME_ZONE_COOKIE}=${local.timeZone}; Path=/; SameSite=Lax; Max-Age=31536000${location.protocol === 'https:' ? '; Secure' : ''}`
        // Do not loop if browser preferences reject cookies.
        if (
          document.cookie
            .split('; ')
            .includes(`${REVIEW_TIME_ZONE_COOKIE}=${local.timeZone}`)
        ) {
          lastRefresh = Date.now()
          router.refresh()
        }
      }
      // Calendar arithmetic accounts for 23/25-hour DST days. Periodic checks
      // also catch a time-zone/clock change while the page remains open.
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      )
      timer = setTimeout(
        check,
        Math.max(1, Math.min(60_000, midnight.getTime() - now.getTime()))
      )
    }
    check()
    const onVisible = () => {
      if (!document.hidden) check()
    }
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [calendar.dateKey, calendar.timeZone, pathname, router])

  return (
    <ReviewCalendarContext.Provider value={calendar}>
      {children}
    </ReviewCalendarContext.Provider>
  )
}

/** A prefetched server page can outlive the layout's midnight refresh. */
export function ReviewCalendarSnapshot({ dateKey }: { dateKey: string }) {
  const calendar = useContext(ReviewCalendarContext)
  const router = useRouter()
  useEffect(() => {
    if (calendar && calendar.dateKey !== dateKey) router.refresh()
  }, [calendar, dateKey, router])
  return null
}
