import { useApplicationStore } from '@/stores/useApplicationStore'
import { loadNativeReviewSession } from '../session'
import { prepareNativeReviewQuestionsAsync } from '../questions'
import { measureReviewPreparation } from '../preparationTelemetry'
import { makeSession, userId, vocabulary } from './fixtures'

jest.mock('../questions', () => ({
  ...jest.requireActual('../questions'),
  prepareNativeReviewQuestionsAsync: jest.fn(),
}))
jest.mock('../preparationTelemetry', () => ({
  measureReviewPreparation: jest.fn((_metadata, _signal, prepare) => prepare()),
}))
jest.mock('../persistence', () => ({
  createNativeReviewPersistence: jest.fn(),
}))
jest.mock('../correctionTransport', () => ({
  createNativeCorrectionTransport: jest.fn(),
}))
jest.mock('../controller', () => ({
  createNativeReviewController: jest.fn(() => ({
    getSnapshot: () => ({ userId: 'review-qa' }),
  })),
}))

beforeEach(() => {
  jest.clearAllMocks()
  useApplicationStore.setState({ words: vocabulary })
  jest.mocked(prepareNativeReviewQuestionsAsync).mockResolvedValue([])
})

it('measures a cold preparation once and excludes cached session resumes', async () => {
  const session = makeSession('adaptive')
  const signal = new AbortController().signal
  const first = await loadNativeReviewSession(
    session,
    userId,
    false,
    signal,
    jest.fn()
  )
  const resumed = await loadNativeReviewSession(
    session,
    userId,
    false,
    signal,
    jest.fn()
  )
  expect(resumed).toBe(first)
  expect(measureReviewPreparation).toHaveBeenCalledTimes(1)
  expect(measureReviewPreparation).toHaveBeenCalledWith(
    { wordCount: 3, vocabularyCount: 4, mode: 'adaptive' },
    signal,
    expect.any(Function)
  )
})

it('does not measure or prepare an already-cancelled cold session', async () => {
  const abort = new AbortController()
  abort.abort()
  expect(
    await loadNativeReviewSession(
      makeSession(),
      userId,
      false,
      abort.signal,
      jest.fn()
    )
  ).toBeNull()
  expect(measureReviewPreparation).not.toHaveBeenCalled()
  expect(prepareNativeReviewQuestionsAsync).not.toHaveBeenCalled()
})

it('does not cache cancelled preparation and measures the retry', async () => {
  const session = makeSession()
  const signal = new AbortController().signal
  jest.mocked(prepareNativeReviewQuestionsAsync).mockResolvedValueOnce(null)
  expect(
    await loadNativeReviewSession(session, userId, false, signal, jest.fn())
  ).toBeNull()
  expect(
    await loadNativeReviewSession(session, userId, false, signal, jest.fn())
  ).not.toBeNull()
  expect(measureReviewPreparation).toHaveBeenCalledTimes(2)
})

it('propagates a preparation error and measures the retry', async () => {
  const session = makeSession()
  const signal = new AbortController().signal
  const error = new Error('fixture')
  jest.mocked(prepareNativeReviewQuestionsAsync).mockRejectedValueOnce(error)
  await expect(
    loadNativeReviewSession(session, userId, false, signal, jest.fn())
  ).rejects.toBe(error)
  await loadNativeReviewSession(session, userId, false, signal, jest.fn())
  expect(measureReviewPreparation).toHaveBeenCalledTimes(2)
})
