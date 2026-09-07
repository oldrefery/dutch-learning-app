import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'
import { Sentry } from '@/lib/sentry'
import { getSentryRuntimeConfig } from '@/lib/sentryConfig'
import type { ReviewSessionMode } from '@/types/ReviewTypes'

export const REVIEW_PREPARATION_OP = 'review.prepare'
export const SLOW_REVIEW_PREPARATION_MS = 3000
const WARNING_INTERVAL_MS = 15 * 60 * 1000
let lastWarningAt = -Infinity

interface PreparationMetadata {
  wordCount: number
  vocabularyCount: number
  mode: ReviewSessionMode
}

/** Timing excludes cache hits, history loading and rendering the first card. */
export async function measureReviewPreparation<T>(
  metadata: PreparationMetadata,
  signal: AbortSignal,
  prepare: () => Promise<T | null>
): Promise<T | null> {
  let span: ReturnType<typeof Sentry.startInactiveSpan> | undefined
  let enabled = false
  const startedAt = performance.now()
  const attributes = {
    'review.word_count': metadata.wordCount,
    'review.vocabulary_count': metadata.vocabularyCount,
    'review.mode': metadata.mode,
    'review.platform': Platform.OS,
    'review.update_id': Updates.updateId ?? 'embedded',
  }
  try {
    const environment = getSentryRuntimeConfig().environment
    enabled =
      Constants.expoConfig?.extra?.qaBuild !== true &&
      (environment === 'production' || environment === 'preview')
    if (enabled) {
      span = Sentry.startInactiveSpan({
        name: REVIEW_PREPARATION_OP,
        op: REVIEW_PREPARATION_OP,
        parentSpan: null,
        forceTransaction: true,
        attributes,
      })
    }
  } catch {
    // Telemetry must not prevent a review from starting.
  }

  let outcome: 'ready' | 'cancelled' | 'error' = 'error'
  try {
    const result = await prepare()
    outcome = signal.aborted || result === null ? 'cancelled' : 'ready'
    return result
  } catch (error) {
    if (signal.aborted) outcome = 'cancelled'
    throw error
  } finally {
    const now = performance.now()
    const durationMs = Math.max(0, now - startedAt)
    try {
      span?.setAttributes({
        'review.outcome': outcome,
        'review.duration_ms': durationMs,
      })
      span?.setStatus(
        outcome === 'error'
          ? { code: 2, message: 'internal_error' }
          : { code: 1 }
      )
      if (
        enabled &&
        outcome === 'ready' &&
        durationMs >= SLOW_REVIEW_PREPARATION_MS &&
        now - lastWarningAt >= WARNING_INTERVAL_MS
      ) {
        lastWarningAt = now
        Sentry.captureMessage('Slow review preparation', {
          level: 'warning',
          tags: { module: REVIEW_PREPARATION_OP },
          fingerprint: [REVIEW_PREPARATION_OP, 'slow'],
          extra: {
            ...attributes,
            'review.outcome': outcome,
            'review.duration_ms': durationMs,
          },
        })
      }
    } catch {
      // Best effort, including SDK failures after preparation.
    } finally {
      try {
        span?.end()
      } catch {
        // Ending telemetry must not change the result of preparation.
      }
    }
  }
}
