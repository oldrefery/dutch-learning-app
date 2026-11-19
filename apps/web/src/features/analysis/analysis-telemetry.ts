import { captureEvent, type ErrorEvent } from '@sentry/nextjs'

export type AnalysisMode = 'single' | 'batch'
type FailureStage = 'dictionary' | 'invoke' | 'response'
const message = 'Word analysis failed'

function failureReason(stage: FailureStage, error: unknown) {
  const detail = error instanceof Error ? error.message : ''
  if (detail.startsWith('Russian analysis must use Cyrillic:'))
    return 'russian_script'
  if (detail.startsWith('The analysis did not include an English translation'))
    return 'missing_english'
  if (detail.startsWith('The analysis did not include a Russian translation'))
    return 'missing_russian'
  if (detail === 'The analysis response was incomplete.') return 'incomplete'
  if (detail.startsWith('Gemini API error:')) return 'provider_error'
  return {
    dictionary: 'lookup_failed',
    invoke: 'request_failed',
    response: 'invalid_response',
  }[stage]
}

export function reportAnalysisFailure(
  mode: AnalysisMode,
  stage: FailureStage,
  error: unknown,
  metadata?: unknown,
  status?: number
) {
  if (status && [400, 401, 403, 429].includes(status)) return
  const meta = typeof metadata === 'object' && metadata !== null ? metadata : {}
  const source =
    stage === 'dictionary'
      ? 'dictionary'
      : 'source' in meta &&
          (meta.source === 'cache' || meta.source === 'gemini')
        ? meta.source
        : 'unknown'
  const model =
    source === 'gemini' &&
    'model' in meta &&
    typeof meta.model === 'string' &&
    /^gemini-\d+(?:\.\d+)?-flash(?:-\d{3})?$/.test(meta.model)
      ? meta.model
      : undefined
  const reason = failureReason(stage, error)
  captureEvent({
    message,
    level: 'error',
    fingerprint: ['web-word-analysis', reason],
    tags: {
      analysis_mode: mode,
      analysis_stage: stage,
      analysis_reason: reason,
      analysis_source: source,
      analysis_model: model,
      http_status:
        status && Number.isInteger(status) && status >= 100 && status <= 599
          ? status
          : undefined,
    },
  })
}

// SDK integrations can add URLs, breadcrumbs and user data after capture.
export function sanitizeAnalysisEvent(event: ErrorEvent): ErrorEvent {
  if (event.message !== message) return event
  const tags = event.tags ?? {}
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    release: event.release,
    environment: event.environment,
    platform: event.platform,
    level: 'error',
    message,
    fingerprint: event.fingerprint,
    tags: {
      analysis_mode: tags.analysis_mode,
      analysis_stage: tags.analysis_stage,
      analysis_reason: tags.analysis_reason,
      analysis_source: tags.analysis_source,
      analysis_model: tags.analysis_model,
      http_status: tags.http_status,
    },
  }
}
