import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { Sentry } from '@/lib/sentry'
import { getSentryRuntimeConfig } from '@/lib/sentryConfig'
import { measureReviewPreparation } from '../preparationTelemetry'

jest.mock('@/lib/sentry', () => ({
  Sentry: { startInactiveSpan: jest.fn(), captureMessage: jest.fn() },
}))
jest.mock('@/lib/sentryConfig', () => ({ getSentryRuntimeConfig: jest.fn() }))
jest.mock('expo-updates', () => ({ updateId: null }))

const metadata = {
  wordCount: 2500,
  vocabularyCount: 5000,
  mode: 'adaptive' as const,
}
const OP = 'review.prepare'
const span = { setAttributes: jest.fn(), setStatus: jest.fn(), end: jest.fn() }
let now = 0
let abort: AbortController
const run = (duration: number, result: object | null = {}) =>
  measureReviewPreparation(metadata, abort.signal, async () => {
    now += duration
    return result
  })

beforeEach(() => {
  jest.resetAllMocks()
  now += 1_000_000
  abort = new AbortController()
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  jest.mocked(getSentryRuntimeConfig).mockReturnValue({
    environment: 'production',
    release: 'test',
    dist: '83',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.01,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1,
  })
  Object.assign(Constants.expoConfig!, { extra: { qaBuild: false } })
  jest
    .mocked(Sentry.startInactiveSpan)
    .mockReturnValue(
      span as unknown as ReturnType<typeof Sentry.startInactiveSpan>
    )
})
afterEach(() => jest.restoreAllMocks())

it('records a standalone span with counters and preserves the result', async () => {
  const result = {}
  expect(await run(2999, result)).toBe(result)
  expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
    name: OP,
    op: OP,
    parentSpan: null,
    forceTransaction: true,
    attributes: {
      'review.word_count': 2500,
      'review.vocabulary_count': 5000,
      'review.mode': 'adaptive',
      'review.platform': Platform.OS,
      'review.update_id': 'embedded',
    },
  })
  expect(span.setAttributes).toHaveBeenCalledWith({
    'review.outcome': 'ready',
    'review.duration_ms': 2999,
  })
  expect(span.end).toHaveBeenCalledTimes(1)
  expect(Sentry.captureMessage).not.toHaveBeenCalled()
})

it('warns at the threshold and rate-limits warnings but not spans', async () => {
  await run(3000)
  await run(4000)
  expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  expect(Sentry.captureMessage).toHaveBeenCalledWith(
    'Slow review preparation',
    expect.objectContaining({
      level: 'warning',
      fingerprint: [OP, 'slow'],
      extra: expect.objectContaining({ 'review.duration_ms': 3000 }),
    })
  )
  now += 15 * 60 * 1000
  await run(3000)
  expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
  expect(span.end).toHaveBeenCalledTimes(3)
})

it.each(['null', 'aborted'] as const)(
  'records cancellation (%s) without a slow warning',
  async reason => {
    if (reason === 'aborted') abort.abort()
    await run(5000, reason === 'null' ? null : {})
    expect(span.setAttributes).toHaveBeenCalledWith({
      'review.outcome': 'cancelled',
      'review.duration_ms': 5000,
    })
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(span.end).toHaveBeenCalledTimes(1)
  }
)

it('preserves preparation errors without duplicating error capture', async () => {
  const error = new Error('fixture')
  await expect(
    measureReviewPreparation(metadata, abort.signal, async () => {
      throw error
    })
  ).rejects.toBe(error)
  expect(span.setStatus).toHaveBeenCalledWith({
    code: 2,
    message: 'internal_error',
  })
  expect(span.end).toHaveBeenCalledTimes(1)
  expect(Sentry.captureMessage).not.toHaveBeenCalled()
})

it.each(['development', 'test', 'qa'] as const)(
  'does not send telemetry for %s',
  async environment => {
    if (environment === 'qa')
      Object.assign(Constants.expoConfig!.extra!, { qaBuild: true })
    else
      jest
        .mocked(getSentryRuntimeConfig)
        .mockReturnValue({ ...getSentryRuntimeConfig(), environment })
    await run(5000)
    expect(Sentry.startInactiveSpan).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  }
)

it.each(['start', 'attributes', 'capture', 'end'] as const)(
  'ignores SDK failure during %s',
  async step => {
    const fail = () => {
      throw new Error('SDK fixture')
    }
    if (step === 'start')
      jest.mocked(Sentry.startInactiveSpan).mockImplementationOnce(fail)
    if (step === 'attributes') span.setAttributes.mockImplementationOnce(fail)
    if (step === 'capture')
      jest.mocked(Sentry.captureMessage).mockImplementationOnce(fail)
    if (step === 'end') span.end.mockImplementationOnce(fail)
    const result = {}
    expect(await run(5000, result)).toBe(result)
    if (step !== 'start') expect(span.end).toHaveBeenCalledTimes(1)
  }
)
