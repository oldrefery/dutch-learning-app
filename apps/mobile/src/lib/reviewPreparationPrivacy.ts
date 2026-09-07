import type { ErrorEvent, TransactionEvent } from '@sentry/react-native'

const OP = 'review.prepare'
const MODES = new Set([
  'adaptive',
  'recognition',
  'meaning-recall',
  'dutch-production',
])
const OUTCOMES = new Set(['ready', 'cancelled', 'error'])
const PLATFORMS = new Set(['ios', 'android'])
const UPDATE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COUNTERS = [
  'review.word_count',
  'review.vocabulary_count',
  'review.duration_ms',
]

function preparationData(data: Record<string, unknown> = {}) {
  const mode = data['review.mode']
  const outcome = data['review.outcome']
  const platform = data['review.platform']
  const updateId = data['review.update_id']
  return {
    'review.platform':
      typeof platform === 'string' && PLATFORMS.has(platform)
        ? platform
        : 'unknown',
    'review.update_id':
      typeof updateId === 'string' &&
      (updateId === 'embedded' || UPDATE_ID.test(updateId))
        ? updateId
        : 'unknown',
    'review.mode':
      typeof mode === 'string' && MODES.has(mode) ? mode : 'unknown',
    'review.outcome':
      typeof outcome === 'string' && OUTCOMES.has(outcome)
        ? outcome
        : 'unknown',
    ...Object.fromEntries(
      COUNTERS.map(key => {
        const value = data[key]
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

/** Remove inherited account, breadcrumb and request context after SDK enrichment. */
export function scrubReviewPreparationEvent(event: ErrorEvent): ErrorEvent {
  if (event.tags?.module !== OP) return event
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    level: 'warning',
    message: 'Slow review preparation',
    tags: { module: OP },
    fingerprint: [OP, 'slow'],
    extra: preparationData(event.extra),
  }
}

export function scrubReviewPreparationTransaction(
  event: TransactionEvent
): TransactionEvent {
  if (event.transaction !== OP) return event
  const trace = event.contexts?.trace
  return {
    type: 'transaction',
    event_id: event.event_id,
    start_timestamp: event.start_timestamp,
    timestamp: event.timestamp,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    transaction: OP,
    contexts: trace
      ? {
          trace: {
            trace_id: trace.trace_id,
            span_id: trace.span_id,
            op: OP,
            status: trace.status,
            data: preparationData(trace.data),
          },
        }
      : undefined,
    spans: [],
  }
}
