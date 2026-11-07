export type TransportReason =
  | 'response-received'
  | 'http-error'
  | 'timeout'
  | 'fetch-failed'
  | 'missing-response-body'
  | 'response-too-large'
  | 'response-read-failed'
  | 'response-decode-failed'
  | 'response-processing-failed'

export interface ProviderObservation {
  attempt_sha256: string
  outcome: 'returned' | 'provider-failed' | 'provider-outcome-unknown'
  reason: TransportReason
  http_status: number | null
  google_status: string | null
  elapsed_ms: number
}

// Supabase function_logs is operator-only and retention-limited. This event is
// diagnostic evidence, never authority to retry, settle spend or publish content.
export const logProviderObservation = (
  workflow: 'analysis' | 'creation',
  observation: ProviderObservation
): void => {
  console.info(
    JSON.stringify({
      event: 'dictionary-provider-transport-v1',
      workflow,
      attempt_sha256: observation.attempt_sha256,
      outcome: observation.outcome,
      reason: observation.reason,
      http_status: observation.http_status,
      google_status: observation.google_status,
      elapsed_ms: observation.elapsed_ms,
    })
  )
}
