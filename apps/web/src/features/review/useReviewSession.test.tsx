import { act, renderHook } from '@testing-library/react'
import { submitReviewAssessment } from './actions'
import { makeData, makeWord, successfulResult } from './__fixtures__/session'
import { useReviewSession } from './useReviewSession'
import type { ReviewSubmissionResult, ReviewSessionMode } from './types'

jest.mock('./actions', () => ({ submitReviewAssessment: jest.fn() }))
jest.mock('./correction-actions', () => ({ submitReviewCorrection: jest.fn() }))
jest.mock('./correction-refresh', () => ({
  loadReviewCorrectionState: jest.fn(),
}))
const persist = jest.mocked(submitReviewAssessment)
const setup = async (
  mode: ReviewSessionMode = 'recognition',
  data = makeData()
) => {
  const rendered = renderHook(() =>
    useReviewSession(data, 'all-due', null, 'test-user', mode)
  )
  await act(async () => {
    rendered.result.current.start()
    await jest.advanceTimersByTimeAsync(0)
  })
  return rendered
}
const selectCorrect = (result: {
  current: ReturnType<typeof useReviewSession>
}) => {
  const option = result.current.recognitionOptions?.find(
    candidate => candidate.isCorrect
  )
  if (!option) throw new Error('Missing correct option')
  return result.current.selectOption(option)
}
const flush = async () => {
  await act(async () => {})
}
const tick = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-06T12:00:00Z'))
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
  persist
    .mockReset()
    .mockImplementation(async input => successfulResult(input.wordId))
})
afterEach(() => {
  jest.useRealTimers()
})

test('fast correct recognition saves Good once and advances after 600ms', async () => {
  const { result } = await setup()
  act(() => {
    selectCorrect(result)
    selectCorrect(result)
  })
  await flush()
  expect(persist).toHaveBeenCalledTimes(1)
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'good', answeredCorrectly: true })
  )
  expect(result.current.currentIndex).toBe(0)
  tick(599)
  expect(result.current.currentIndex).toBe(0)
  tick(1)
  expect(result.current.currentIndex).toBe(1)
  tick(5000)
  expect(result.current.currentIndex).toBe(1)
  expect(result.current.summary?.assessed).toBe(1)
})

test('slow acknowledgement cannot advance before save', async () => {
  let resolve!: (value: ReviewSubmissionResult) => void
  persist.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const { result } = await setup()
  act(() => selectCorrect(result))
  tick(5000)
  expect(result.current.currentIndex).toBe(0)
  expect(result.current.pending).toBe(true)
  await act(async () => resolve(successfulResult('word-1')))
  tick(0)
  expect(result.current.currentIndex).toBe(1)
})

test('wrong choice opens details and waits for explicit Again', async () => {
  const { result } = await setup()
  const option = result.current.recognitionOptions!.find(
    candidate => !candidate.isCorrect
  )!
  act(() => result.current.selectOption(option))
  expect(result.current.detailsVisible).toBe(true)
  tick(5000)
  expect(persist).not.toHaveBeenCalled()
  await act(async () => result.current.submit('good'))
  expect(persist).not.toHaveBeenCalled()
  await act(async () => result.current.submit('again'))
  expect(result.current.currentIndex).toBe(1)
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'again', answeredCorrectly: false })
  )
})

test('details during success feedback cancel auto-advance until Continue', async () => {
  const { result } = await setup()
  act(() => selectCorrect(result))
  await flush()
  act(() => result.current.openDetails())
  tick(5000)
  act(() => result.current.closeDetails())
  tick(5000)
  expect(result.current.currentIndex).toBe(0)
  await act(async () => result.current.submit('good'))
  expect(result.current.currentIndex).toBe(1)
  expect(persist).toHaveBeenCalledTimes(1)
})

test('backgrounding pauses the timer and foregrounding does not resume it', async () => {
  const { result } = await setup()
  act(() => selectCorrect(result))
  await flush()
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  tick(1000)
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  tick(1000)
  expect(result.current.currentIndex).toBe(0)
  await act(async () => result.current.submit('good'))
  expect(result.current.currentIndex).toBe(1)
})

test('history preserves the exact pending question and options without new writes', async () => {
  const { result } = await setup()
  act(() => selectCorrect(result))
  await flush()
  tick(600)
  const pending = result.current.flow!.active
  act(() => result.current.goTo(-1))
  expect(result.current.historyEntry?.result).toMatchObject({
    assessment: 'good',
  })
  await act(async () => result.current.submit('easy'))
  act(() => result.current.openDetails())
  act(() => result.current.returnToCurrent())
  expect(result.current.flow!.active).toEqual({ ...pending, autoPaused: true })
  expect(result.current.flow!.active!.question).toBe(pending!.question)
  expect(persist).toHaveBeenCalledTimes(1)
})

test('peek allows only Again or Skip even after closing details', async () => {
  const { result } = await setup()
  act(() => result.current.openDetails())
  act(() => result.current.closeDetails())
  act(() => selectCorrect(result))
  await act(async () => result.current.submit('easy'))
  expect(persist).not.toHaveBeenCalled()
  expect(result.current.allowedAssessments).toEqual(['again'])
  act(() => result.current.skip())
  expect(result.current.summary).toMatchObject({ skipped: 1, assessed: 0 })
  expect(result.current.currentIndex).toBe(1)
})

test('manual recognition waits for a chosen rating', async () => {
  const data = makeData()
  const { result } = renderHook(() =>
    useReviewSession(data, 'all-due', null, 'test-user', 'recognition')
  )
  act(() => result.current.setManualRecognition(true))
  await act(async () => {
    result.current.start()
    await jest.advanceTimersByTimeAsync(0)
  })
  act(() => selectCorrect(result))
  tick(5000)
  expect(persist).not.toHaveBeenCalled()
  await act(async () => result.current.submit('hard'))
  expect(persist).toHaveBeenCalledWith(
    expect.objectContaining({ assessment: 'hard' })
  )
  expect(result.current.currentIndex).toBe(1)
})

test('preference changes affect the next question, not an in-flight answer', async () => {
  const { result } = await setup()
  act(() => result.current.setManualRecognition(true))
  act(() => selectCorrect(result))
  await flush()
  tick(600)
  act(() => selectCorrect(result))
  await flush()
  tick(1000)
  expect(result.current.currentIndex).toBe(1)
  expect(persist).toHaveBeenCalledTimes(1)
  expect(result.current.flow?.active?.manualRecognition).toBe(true)
})

test('uncertain submission locks its full retry payload and blocks exit/new rating', async () => {
  persist.mockRejectedValueOnce(new Error('Offline'))
  const { result } = await setup('meaning-recall')
  act(() => result.current.setRevealed(true))
  await act(async () => result.current.submit('easy'))
  const input = persist.mock.calls[0][0]
  expect(result.current.unsettled).toBe(true)
  act(() => {
    result.current.changeMode()
    result.current.start()
  })
  await act(async () => result.current.submit('good'))
  expect(persist).toHaveBeenCalledTimes(1)
  tick(2000)
  await act(async () => result.current.submit('easy'))
  expect(persist.mock.calls[1][0]).toBe(input)
  expect(result.current.currentIndex).toBe(1)
})

test('explicit save cannot move the question after details were opened during I/O', async () => {
  let resolve!: (value: ReviewSubmissionResult) => void
  persist.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const { result } = await setup('meaning-recall')
  act(() => result.current.setRevealed(true))
  act(() => {
    void result.current.submit('hard')
  })
  act(() => result.current.openDetails())
  await act(async () => resolve(successfulResult('word-1')))
  expect(result.current.currentIndex).toBe(0)
  expect(result.current.detailsVisible).toBe(true)
  expect(result.current.assessed).toBe(true)
})

test('completed session keeps read-only history and uses canonical SRS for the next session', async () => {
  const word = makeWord('word-1', 'house')
  const { result } = await setup('meaning-recall', makeData([word]))
  await act(async () => result.current.submit('good'))
  expect(persist).not.toHaveBeenCalled()
  act(() => result.current.setRevealed(true))
  await act(async () => result.current.submit('good'))
  expect(result.current.stage).toBe('complete')
  expect(result.current.dueCount).toBe(0)
  expect(result.current.sessionTotal).toBe(1)
  act(() => result.current.goTo(-1))
  expect(result.current.stage).toBe('review')
  expect(result.current.historyEntry?.result).toMatchObject({
    assessment: 'good',
  })
  expect(result.current.currentWord?.intervalDays).toBe(0)
  act(() => result.current.returnToCurrent())
  expect(result.current.stage).toBe('complete')
})

test('unmount cancels feedback and ignores late acknowledgements', async () => {
  let resolve!: (value: ReviewSubmissionResult) => void
  persist.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const { result, unmount } = await setup()
  act(() => selectCorrect(result))
  unmount()
  await act(async () => resolve(successfulResult('word-1')))
  tick(5000)
  expect(persist).toHaveBeenCalledTimes(1)
})

test('empty scope does not enter review', async () => {
  const { result } = await setup(
    'adaptive',
    makeData([makeWord('future', 'house', { nextReviewDate: '2999-01-01' })])
  )
  expect(result.current.stage).toBe('setup')
  expect(result.current.emptyMessage).toContain('No words are due')
})

test('restart after completing all due words returns to setup with an explanation', async () => {
  const { result } = await setup(
    'meaning-recall',
    makeData([makeWord('word-1', 'house')])
  )
  act(() => result.current.setRevealed(true))
  await act(async () => result.current.submit('good'))
  expect(result.current.stage).toBe('complete')
  await act(async () => {
    result.current.start()
    await jest.advanceTimersByTimeAsync(0)
  })
  expect(result.current.stage).toBe('setup')
  expect(result.current.emptyMessage).toContain('No words are due')
})

test.each<ReviewSubmissionResult>([
  { status: 'error', message: 'Save unavailable' },
  successfulResult('unexpected-word'),
])(
  'a rejected or mismatched acknowledgement remains retryable',
  async response => {
    persist.mockResolvedValueOnce(response)
    const { result } = await setup('meaning-recall')
    act(() => result.current.setRevealed(true))
    await act(async () => result.current.submit('good'))
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.summary?.assessed).toBe(0)
    expect(result.current.error).toBeTruthy()
    const original = persist.mock.calls[0][0]
    await act(async () => result.current.submit('good'))
    expect(persist.mock.calls[1][0]).toBe(original)
    expect(result.current.currentIndex).toBe(1)
  }
)
