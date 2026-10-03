import {
  canonicalizeCefrInput,
  parseDictionaryContent,
} from '../../../../packages/domain/src/shared-dictionary.ts'
import {
  decideCandidate,
  isQualifiedProfile,
  type QualifiedMethod,
} from '../cefr-calibration/policy.ts'
import { profileDigest, validateProfile } from '../cefr-calibration/profile.ts'
import { record, sha256 } from '../cefr-calibration/validation.ts'

export interface LeasedCefrJob {
  job_id: string
  entry_id: string
  revision_id: string
  input_sha256: string
  qualification_sha256: string
  profile_sha256: string
  profile: unknown
  content: unknown
  lease_token: string
  lease_expires_at: string
  attempt: number
}

export interface CefrProviderRequest {
  job_id: string
  entry_id: string
  revision_id: string
  input_sha256: string
  profile_sha256: string
  canonical_input: string
  profile: ReturnType<typeof validateProfile>
}

// Transport adapters must enforce the response byte limit while reading the body.
// No transport, HTTP entrypoint, scheduler or spending authority ships here.
export type CefrProvider = (
  request: CefrProviderRequest,
  options: { signal: AbortSignal; maxResponseBytes: number }
) => CefrProviderReply | Promise<CefrProviderReply>

export type CefrProviderReply =
  | { kind: 'response'; body: string }
  | { kind: 'http_error'; status: number; retryAfterSeconds?: number }
  | { kind: 'transport_error' }

export type CefrAttemptResult =
  | { outcome: 'estimated'; level: string; confidence: number }
  | { outcome: 'unknown' | 'failed'; reason: string }
  | { outcome: 'retry'; reason: string; retryAfterSeconds?: number }

export interface EvaluationOptions {
  enabled?: boolean
  qualification: QualifiedMethod | null
  timeoutMs: number
  provider: CefrProvider
  now?: () => number
}

const bytes = (value: string) => new TextEncoder().encode(value).length
const MAX_INPUT_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 4096

const prepareRequest = async (
  job: LeasedCefrJob,
  options: EvaluationOptions
): Promise<CefrProviderRequest | null> => {
  if (
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    options.timeoutMs > 5000 ||
    !options.qualification ||
    options.qualification.qualification_sha256 !== job.qualification_sha256 ||
    !(await isQualifiedProfile(job.profile, options.qualification))
  )
    return null
  const expires = Date.parse(job.lease_expires_at)
  if (
    !Number.isFinite(expires) ||
    expires <= (options.now ?? Date.now)() + options.timeoutMs
  )
    return null
  const content = parseDictionaryContent(job.content)
  if (!content.success) return null
  const canonical = canonicalizeCefrInput(content.data)
  if (
    bytes(canonical) > MAX_INPUT_BYTES ||
    (await sha256(canonical)) !== job.input_sha256
  )
    return null
  const profile = validateProfile(job.profile)
  if ((await profileDigest(profile)) !== job.profile_sha256) return null
  if (expires <= (options.now ?? Date.now)() + options.timeoutMs) return null
  return {
    job_id: job.job_id,
    entry_id: job.entry_id,
    revision_id: job.revision_id,
    input_sha256: job.input_sha256,
    profile_sha256: job.profile_sha256,
    canonical_input: canonical,
    profile,
  }
}

const evaluateResponse = async (
  body: string,
  request: CefrProviderRequest,
  qualification: QualifiedMethod | null
): Promise<CefrAttemptResult> => {
  if (bytes(body) > MAX_RESPONSE_BYTES)
    return { outcome: 'unknown', reason: 'oversized_response' }
  let raw: Record<string, unknown>
  try {
    raw = record(JSON.parse(body))
  } catch {
    return { outcome: 'unknown', reason: 'malformed_response' }
  }
  if (
    raw.job_id !== request.job_id ||
    raw.input_sha256 !== request.input_sha256 ||
    raw.profile_sha256 !== request.profile_sha256
  )
    return { outcome: 'unknown', reason: 'response_binding_mismatch' }
  const decision = await decideCandidate(
    raw.candidate,
    { profile: request.profile, ambiguous: raw.ambiguous === true },
    qualification
  )
  return decision.status === 'estimated'
    ? {
        outcome: 'estimated',
        level: decision.level,
        confidence: decision.confidence,
      }
    : { outcome: 'unknown', reason: decision.reason }
}

// Evaluates already captured leases only. The future invocation layer must reserve
// durable budget before calling this function and settle through the fenced RPC.
// Disabled/empty input makes zero provider calls. It never approves a method.
export const evaluateCefrLeases = async (
  jobs: readonly LeasedCefrJob[],
  options: EvaluationOptions
): Promise<CefrAttemptResult[]> => {
  if (options.enabled !== true || jobs.length === 0) return []
  if (jobs.length > 8) throw new Error('CEFR batch exceeds concurrency bound')
  if (new Set(jobs.map(job => job.job_id)).size !== jobs.length)
    throw new Error('Duplicate CEFR lease in batch')
  // Capture all caller-owned data before the first asynchronous operation.
  const captured = structuredClone(jobs)
  const settings = { ...options }
  return await Promise.all(
    captured.map(async job => {
      let request: CefrProviderRequest | null
      try {
        request = await prepareRequest(job, settings)
      } catch {
        request = null
      }
      if (!request)
        return { outcome: 'failed', reason: 'invalid_or_unqualified_lease' }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => {
          resolve('timeout')
          controller.abort()
        }, settings.timeoutMs)
      })
      try {
        // Give the adapter its own copy so it cannot change response validation.
        const reply = await Promise.race([
          Promise.resolve().then(() =>
            settings.provider(structuredClone(request), {
              signal: controller.signal,
              maxResponseBytes: MAX_RESPONSE_BYTES,
            })
          ),
          timeout,
        ])
        if (reply === 'timeout') return { outcome: 'retry', reason: 'timeout' }
        if (reply.kind === 'transport_error')
          return { outcome: 'retry', reason: 'transport' }
        if (reply.kind === 'http_error') {
          if (
            reply.status !== 429 &&
            !(reply.status >= 500 && reply.status <= 599)
          )
            return { outcome: 'failed', reason: 'provider_rejected' }
          const retry = reply.retryAfterSeconds
          return {
            outcome: 'retry',
            reason: 'provider_unavailable',
            retryAfterSeconds:
              typeof retry === 'number' && Number.isFinite(retry)
                ? Math.max(0, Math.min(3600, Math.ceil(retry)))
                : undefined,
          }
        }
        return await evaluateResponse(
          reply.body,
          request,
          settings.qualification
        )
      } catch {
        // Unexpected adapter errors have unknown billing; do not log raw errors.
        return { outcome: 'retry', reason: 'transport' }
      } finally {
        clearTimeout(timer)
      }
    })
  )
}
