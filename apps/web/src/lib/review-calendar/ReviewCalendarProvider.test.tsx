import { act, render, screen } from '@testing-library/react'
import { toLocalDateKey } from '@woordenaar/domain'
import {
  ReviewCalendarSnapshot,
  ReviewCalendarProvider,
  useReviewCalendarDate,
} from './ReviewCalendarProvider'
import { createReviewCalendar, REVIEW_TIME_ZONE_COOKIE } from './calendar'

const refresh = jest.fn()
const router = { refresh }
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/review',
}))
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
function Consumer() {
  const today = useReviewCalendarDate()
  return <output>{toLocalDateKey(today)}</output>
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 13, 23, 59, 59))
  document.cookie = `${REVIEW_TIME_ZONE_COOKIE}=; Max-Age=0; Path=/`
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
})
afterEach(() => jest.useRealTimers())

test('midnight refreshes once and commits the shared day only with the server response', () => {
  const calendar = createReviewCalendar(zone)
  const { rerender, unmount } = render(
    <ReviewCalendarProvider calendar={calendar}>
      <Consumer />
    </ReviewCalendarProvider>
  )
  expect(refresh).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(1000))
  expect(refresh).toHaveBeenCalledTimes(1)
  // Never switch just the client counts ahead of the server aggregates.
  expect(screen.getByText('2026-11-13')).toBeInTheDocument()
  rerender(
    <ReviewCalendarProvider calendar={createReviewCalendar(zone)}>
      <Consumer />
    </ReviewCalendarProvider>
  )
  expect(screen.getByText('2026-11-14')).toBeInTheDocument()
  act(() => jest.advanceTimersByTime(60_000))
  expect(refresh).toHaveBeenCalledTimes(1)
  unmount()
  expect(jest.getTimerCount()).toBe(0)
})

test('first visit replaces the server time zone without hydration date drift', () => {
  const calendar = { dateKey: '2026-11-12', timeZone: 'UTC' }
  render(
    <ReviewCalendarProvider calendar={calendar}>
      <Consumer />
    </ReviewCalendarProvider>
  )
  expect(screen.getByText('2026-11-12')).toBeInTheDocument()
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(document.cookie).toContain(
    `${REVIEW_TIME_ZONE_COOKIE}=${createReviewCalendar(zone).timeZone}`
  )
  act(() => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(refresh).toHaveBeenCalledTimes(1)
})

test('returning after sleep refreshes, and an offline boundary waits for reconnect', () => {
  render(
    <ReviewCalendarProvider calendar={createReviewCalendar(zone)}>
      <Consumer />
    </ReviewCalendarProvider>
  )
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: false,
  })
  act(() => jest.advanceTimersByTime(1000))
  expect(refresh).not.toHaveBeenCalled()
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  })
  act(() => window.dispatchEvent(new Event('online')))
  expect(refresh).toHaveBeenCalledTimes(1)
  act(() => {
    jest.setSystemTime(new Date(2026, 10, 15, 10))
    window.dispatchEvent(new Event('focus'))
  })
  expect(refresh).toHaveBeenCalledTimes(2)
})

test('failed refresh retries at a bounded rate; same-day focus does not refresh', () => {
  render(
    <ReviewCalendarProvider calendar={createReviewCalendar(zone)}>
      <Consumer />
    </ReviewCalendarProvider>
  )
  act(() => window.dispatchEvent(new Event('focus')))
  expect(refresh).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(61_000))
  expect(refresh).toHaveBeenCalledTimes(2)
})

test('an older prefetched Collections page requests a fresh server aggregate', () => {
  const calendar = createReviewCalendar(zone)
  render(
    <ReviewCalendarProvider calendar={calendar}>
      <ReviewCalendarSnapshot dateKey="2026-11-12" />
    </ReviewCalendarProvider>
  )
  expect(refresh).toHaveBeenCalledTimes(1)
})
