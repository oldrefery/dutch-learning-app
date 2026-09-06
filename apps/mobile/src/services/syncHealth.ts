import { Sentry } from '@/lib/sentry'
import {
  getLearningQueueHealth,
  type LearningQueueHealth,
} from '@/db/learningQueueHealth'

export type SyncOutcome =
  'success' | 'offline' | 'session' | 'protocol' | 'network' | 'rls' | 'error'
const REPORT_INTERVAL_MS = 15 * 60 * 1000
const STALL_MS = 5 * 60 * 1000
const OLD_QUEUE_SECONDS = 24 * 60 * 60

/** Session-local aggregates, not an analytics stream or a durable outage clock. */
export class SyncHealthReporter {
  private identity: string | null = null
  private failures = 0
  private failedSince: number | null = null
  private alerted = false
  private reported = new Map<string, number>()

  async record(
    userId: string,
    outcome: SyncOutcome,
    startedAt: number
  ): Promise<void> {
    // Observability must never change the result of synchronization.
    try {
      let queue: LearningQueueHealth | null = null
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        queue = await Promise.race([
          getLearningQueueHealth(userId),
          new Promise<null>(resolve => {
            timer = setTimeout(() => resolve(null), 1000)
          }),
        ])
      } catch {
        /* Unavailable is not empty. */
      } finally {
        clearTimeout(timer)
      }
      this.report(userId, outcome, startedAt, queue)
    } catch {
      /* Best effort, including SDK failures. */
    }
  }

  private report(
    userId: string,
    outcome: SyncOutcome,
    startedAt: number,
    queue: LearningQueueHealth | null
  ): void {
    const now = Date.now()
    if (this.identity !== userId) {
      this.identity = userId
      this.failures = 0
      this.failedSince = null
      this.alerted = false
      this.reported.clear()
    }
    if (outcome !== 'success') {
      this.failedSince ??= startedAt
      this.failures += 1
    }
    const outageMs =
      this.failedSince === null ? 0 : Math.max(0, now - this.failedSince)
    const data = {
      duration_ms: Math.max(0, now - startedAt),
      outage_ms: outageMs,
      failed_attempts: this.failures,
      queue_count: queue?.count ?? null,
      queue_reviews: queue?.reviews ?? null,
      queue_resets: queue?.resets ?? null,
      queue_oldest_age_seconds: queue?.oldestAgeSeconds ?? null,
      expected_protocol: 2,
    }
    Sentry.addBreadcrumb({
      category: 'sync.health',
      message: outcome,
      level: 'info',
      data,
    })
    const reason = this.reason(outcome, outageMs, queue)
    if (outcome === 'success') {
      this.failures = 0
      this.failedSince = null
    }
    if (!reason) return
    const last = this.reported.get(reason)
    if (last !== undefined && now >= last && now - last < REPORT_INTERVAL_MS)
      return
    this.reported.set(reason, now)
    this.alerted = reason !== 'recovered'
    Sentry.captureMessage('Learning synchronization health', {
      level: reason === 'recovered' ? 'info' : 'warning',
      tags: { module: 'sync-health', sync_health: reason },
      fingerprint: ['sync-health', reason],
      extra: data,
    })
  }

  private reason(
    outcome: SyncOutcome,
    outageMs: number,
    queue: LearningQueueHealth | null
  ): string | null {
    if (outcome === 'offline') return null
    if (outcome === 'protocol' || outcome === 'session') return outcome
    if (
      queue &&
      queue.count > 0 &&
      (queue.oldestAgeSeconds ?? 0) >= OLD_QUEUE_SECONDS
    )
      return 'old_queue'
    if (outcome !== 'success' && this.failures >= 3 && outageMs >= STALL_MS)
      return 'stalled'
    if (outcome === 'success' && queue?.count === 0 && this.alerted)
      return 'recovered'
    return null
  }
}
