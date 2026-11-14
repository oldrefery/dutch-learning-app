import { act, renderHook } from '@testing-library/react'
import { ReviewCalendarProvider } from '@/lib/review-calendar/ReviewCalendarProvider'
import { createReviewCalendar } from '@/lib/review-calendar/calendar'
import { submitReviewAssessment } from './actions'
import { makeData, makeWord, successfulResult } from './__fixtures__/session'
import { useReviewSession } from './useReviewSession'
import type { ReviewSubmissionResult } from './types'

const router = { refresh: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app/review',
}))
jest.mock('./actions', () => ({ submitReviewAssessment: jest.fn() }))
jest.mock('./correction-actions', () => ({ submitReviewCorrection: jest.fn() }))
jest.mock('./correction-refresh', () => ({
  loadReviewCorrectionState: jest.fn(),
}))
const persist = jest.mocked(submitReviewAssessment)
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 13, 23, 59, 59))
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
})
afterEach(() => jest.useRealTimers())

test.each(['pending', 'failed', 'saved'] as const)(
  'midnight refresh preserves a %s answer, session history and retry identity',
  async status => {
    let settle!: (value: ReviewSubmissionResult) => void
    persist.mockReset().mockImplementationOnce(
      () =>
        new Promise(resolve => {
          settle = resolve
        })
    )
    const data = makeData([
      makeWord('w1', 'house', {
        repetitionCount: 9,
        intervalDays: 232,
        easinessFactor: 2.3,
      }),
      makeWord('w2', 'tree', { repetitionCount: 5 }),
      makeWord('w3', 'book', {
        nextReviewDate: '2026-11-14',
        repetitionCount: 11,
      }),
    ])
    data.dictionaryContentEnabled = true
    data.events = [
      {
        wordId: 'w1',
        eventId: 'older',
        assessment: 'good',
        answeredCorrectly: true,
        reviewMode: 'meaning-recall',
        reviewedAt: '2026-01-01T12:00:00Z',
      },
    ]
    const original = JSON.stringify(data)
    let calendar = createReviewCalendar(zone)
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReviewCalendarProvider calendar={calendar}>
        {children}
      </ReviewCalendarProvider>
    )
    const { result, rerender } = renderHook(
      ({ snapshot }) =>
        useReviewSession(snapshot, 'all-due', null, 'owner', 'meaning-recall'),
      { initialProps: { snapshot: data }, wrapper }
    )
    expect(result.current.dueCount).toBe(2)
    await act(async () => {
      result.current.start()
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(result.current.sessionTotal).toBe(2)
    act(() => result.current.setRevealed(true))
    act(() => {
      void result.current.submit('good')
    })
    const input = persist.mock.calls[0][0]
    const success = successfulResult(input.wordId)
    success.update.nextReviewDate = '2026-11-20'
    if (status !== 'pending')
      await act(async () =>
        settle(
          status === 'saved' ? success : { status: 'error', message: 'Offline' }
        )
      )
    const flow = result.current.flow
    const question = result.current.flow?.active?.question
    await act(async () => jest.advanceTimersByTimeAsync(1000))
    expect(router.refresh).toHaveBeenCalledTimes(1)
    calendar = createReviewCalendar(zone)
    // A stale response during refresh must not overwrite a saved answer or retry.
    rerender({
      snapshot: { ...data, words: data.words.map(word => ({ ...word })) },
    })
    expect(result.current.flow).toBe(flow)
    expect(result.current.flow?.active?.question).toBe(question)
    expect(result.current.sessionTotal).toBe(2)
    expect(result.current.dueCount).toBe(status === 'saved' ? 2 : 3)
    expect(JSON.stringify(data)).toBe(original)
    expect(persist).toHaveBeenCalledTimes(1)
    if (status === 'pending') await act(async () => settle(success))
    if (status === 'failed') {
      persist.mockResolvedValueOnce(success)
      await act(async () => result.current.submit('good'))
      expect(persist.mock.calls[1][0]).toBe(input)
    }
    expect(result.current.summary?.assessed).toBe(1)
    expect(result.current.flow?.history).toHaveLength(1)
    expect(result.current.flow?.history[0].result).toMatchObject({
      eventId: input.eventId,
      assessment: 'good',
    })
    expect(
      result.current.dueWords.find(word => word.id === 'w3')?.repetitionCount
    ).toBe(11)
  }
)

test('a new session uses the exact calendar day displayed in its setup count', async () => {
  const data = makeData([
    makeWord('future', 'book', { nextReviewDate: '2026-11-14' }),
  ])
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ReviewCalendarProvider
      calendar={{ dateKey: '2026-11-14', timeZone: zone }}
    >
      {children}
    </ReviewCalendarProvider>
  )
  const { result } = renderHook(
    () => useReviewSession(data, 'all-due', null, 'owner', 'meaning-recall'),
    { wrapper }
  )
  expect(result.current.dueCount).toBe(1)
  await act(async () => {
    result.current.start()
    await jest.advanceTimersByTimeAsync(0)
  })
  expect(result.current.sessionTotal).toBe(1)
  expect(result.current.currentWord?.id).toBe('future')
  expect(persist).not.toHaveBeenCalled()
})
