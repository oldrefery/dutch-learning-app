import { SyncHealthReporter } from '../syncHealth'
import { getLearningQueueHealth } from '@/db/learningQueueHealth'
import { Sentry } from '@/lib/sentry'

jest.mock('@/db/learningQueueHealth')
jest.mock('@/lib/sentry')

const HEALTH_MESSAGE = 'Learning synchronization health'
const HEALTH_FINGERPRINT = 'sync-health'
describe('bounded aggregate sync health reporting', () => {
  let health: SyncHealthReporter
  const record = (
    outcome: Parameters<SyncHealthReporter['record']>[1],
    user = 'private-user'
  ) => health.record(user, outcome, Date.now())
  beforeEach(() => {
    jest.useFakeTimers({ now: 0 })
    jest.clearAllMocks()
    health = new SyncHealthReporter()
    jest.mocked(getLearningQueueHealth).mockReset().mockResolvedValue({
      count: 0,
      reviews: 0,
      resets: 0,
      oldestAgeSeconds: null,
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('does not create issues for offline checks or healthy synchronization', async () => {
    await record('offline')
    jest.setSystemTime(86400000)
    await record('offline')
    await record('success')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(
      JSON.stringify(jest.mocked(Sentry.addBreadcrumb).mock.calls)
    ).not.toContain('private-user')
  })

  it.each(['session', 'protocol'] as const)(
    'reports %s immediately with a 15-minute cooldown',
    async outcome => {
      await record(outcome)
      jest.setSystemTime(899999)
      await record(outcome)
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
      jest.setSystemTime(900000)
      await record(outcome)
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
      expect(Sentry.captureMessage).toHaveBeenLastCalledWith(
        HEALTH_MESSAGE,
        expect.objectContaining({
          fingerprint: [HEALTH_FINGERPRINT, outcome],
          extra: expect.objectContaining({
            outage_ms: 900000,
            failed_attempts: 3,
          }),
        })
      )
    }
  )

  it('waits for three failures and five minutes before reporting a stalled series', async () => {
    await record('network')
    jest.setSystemTime(299999)
    await record('error')
    await record('rls')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    jest.setSystemTime(300000)
    await record('network')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ fingerprint: [HEALTH_FINGERPRINT, 'stalled'] })
    )
  })

  it('reports recovery once only for an alerted identity with a known empty queue', async () => {
    await record('protocol')
    jest
      .mocked(getLearningQueueHealth)
      .mockRejectedValueOnce(new Error('private database details'))
    await record('success')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    await record('success')
    await record('success')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
    expect(Sentry.captureMessage).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        level: 'info',
        fingerprint: [HEALTH_FINGERPRINT, 'recovered'],
      })
    )
    await record('protocol')
    await record('success', 'another-private-user')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2)
  })

  it.each([86399, 86400])(
    'reports old queues at the one-day boundary (%i seconds)',
    async age => {
      jest.mocked(getLearningQueueHealth).mockResolvedValue({
        count: 2,
        reviews: 1,
        resets: 1,
        oldestAgeSeconds: age,
      })
      await record('success')
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(age === 86400 ? 1 : 0)
    }
  )

  it('bounds queue diagnostics to one second and treats a timeout as unknown', async () => {
    jest
      .mocked(getLearningQueueHealth)
      .mockImplementation(() => new Promise(() => {}))
    const pending = record('protocol')
    await jest.advanceTimersByTimeAsync(1000)
    await pending
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        extra: expect.objectContaining({
          queue_count: null,
          duration_ms: 1000,
        }),
      })
    )
    expect(jest.getTimerCount()).toBe(0)
  })

  it('contains failures in telemetry without throwing to the synchronizer', async () => {
    jest.spyOn(Sentry, 'addBreadcrumb').mockImplementationOnce(() => {
      throw new Error('SDK failure')
    })
    await expect(record('session')).resolves.toBeUndefined()
    expect(jest.getTimerCount()).toBe(0)
  })
})
