import type { Candidate } from '../../supabase/functions/_shared/cefr-calibration/metrics.ts'
import type { MethodProfile } from '../../supabase/functions/_shared/cefr-calibration/profile.ts'
import type { DiagnosticBundle } from './diagnostic-bundle.ts'

export interface DiagnosticRequest {
  job_id: string
  input_sha256: string
  profile_sha256: string
  canonical_input: string
  prompt: string
  profile: MethodProfile
}
export interface DiagnosticUsage {
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
}
export type DiagnosticReply =
  | {
      kind: 'response'
      body: string
      response_id: string
      model_version: string
      finish_reason: string
      usage?: DiagnosticUsage
    }
  | { kind: 'http_error'; status: number; retry_after_ms?: number }
  | { kind: 'transport_error'; timeout?: true }
  | { kind: 'receipt_error' }
export interface FakeDiagnosticTransport {
  kind: 'fake'
  countTokens(request: DiagnosticRequest): Promise<number>
  generate(
    request: DiagnosticRequest,
    options: { signal: AbortSignal; maxResponseBytes: number }
  ): Promise<DiagnosticReply>
}
export interface DiagnosticRunOptions {
  runDir: string
  bundle: DiagnosticBundle
  transport: FakeDiagnosticTransport
  timeoutMs?: number
  now?: () => Date
  // A crash injected here leaves the reservation charged and uncaptured.
  onReserved?: (itemId: string, attempt: number) => void
}
export interface Captured {
  outcome: 'known' | 'abstain' | 'invalid' | 'retry' | 'failed'
  candidate: Candidate
  reason: string | null
  response_sha256: string | null
  response_id: string | null
  model_version: string | null
  finish_reason: string | null
  usage: DiagnosticUsage | null
  observed_microusd: number | null
  elapsed_ms: number
  retry_not_before?: number
}
