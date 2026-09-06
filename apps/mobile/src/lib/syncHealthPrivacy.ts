import type { ErrorEvent } from '@sentry/react-native'

const SYNC_HEALTH_MODULE = 'sync-health'
const REASONS = new Set([
  'protocol',
  'session',
  'old_queue',
  'stalled',
  'recovered',
])
const COUNTERS = [
  'duration_ms',
  'outage_ms',
  'failed_attempts',
  'queue_count',
  'queue_reviews',
  'queue_resets',
  'queue_oldest_age_seconds',
  'expected_protocol',
]

/** Scope enrichment runs before beforeSend: keep this diagnostic allowlisted. */
export function scrubSyncHealthEvent(event: ErrorEvent): ErrorEvent {
  if (event.tags?.module !== SYNC_HEALTH_MODULE) return event
  const candidate = event.tags.sync_health
  const reason =
    typeof candidate === 'string' && REASONS.has(candidate)
      ? candidate
      : 'unknown'
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    level: reason === 'recovered' ? 'info' : 'warning',
    message: 'Learning synchronization health',
    tags: { module: SYNC_HEALTH_MODULE, sync_health: reason },
    fingerprint: [SYNC_HEALTH_MODULE, reason],
    extra: Object.fromEntries(
      COUNTERS.map(key => {
        const value = event.extra?.[key]
        return [
          key,
          typeof value === 'number' && Number.isFinite(value) && value >= 0
            ? value
            : null,
        ]
      })
    ),
  }
}
