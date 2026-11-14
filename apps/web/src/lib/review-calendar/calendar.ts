export const REVIEW_TIME_ZONE_COOKIE = 'dw-review-time-zone'

export interface ReviewCalendar {
  dateKey: string
  timeZone: string
}

export function normalizeTimeZone(value: string | undefined): string {
  if (!value || value.length > 100) return 'UTC'
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
      .timeZone
  } catch {
    return 'UTC'
  }
}

export function calendarDateKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function createReviewCalendar(
  timeZone: string | undefined,
  now = new Date()
): ReviewCalendar {
  const zone = normalizeTimeZone(timeZone)
  return { dateKey: calendarDateKey(now, zone), timeZone: zone }
}

/** Adapt a calendar day to the domain's local-date API, never parse it as UTC. */
export function calendarReferenceDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`)
}
