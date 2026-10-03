import { createHash, randomUUID } from 'node:crypto'
import { parseCandidate } from '../../supabase/functions/_shared/cefr-calibration/metrics.ts'
import { isPreparedBundle, type DiagnosticBundle } from './diagnostic-bundle.ts'
import { buildReport } from './diagnostic-report.ts'
import {
  capture,
  claimLease,
  countAttempts,
  lastCapture,
  openRun,
  releaseLease,
  renewLease,
  reserve,
} from './diagnostic-store.ts'
import type {
  Captured,
  DiagnosticReply,
  DiagnosticRequest,
  DiagnosticRunOptions,
  DiagnosticUsage,
  FakeDiagnosticTransport,
} from './diagnostic-types.ts'
export { loadDiagnosticBundle } from './diagnostic-bundle.ts'
export { writeNewDiagnosticReport } from './diagnostic-report.ts'
export type { DiagnosticPaths } from './diagnostic-bundle.ts'
export type {
  DiagnosticReply,
  DiagnosticRequest,
  FakeDiagnosticTransport,
} from './diagnostic-types.ts'
const sha = (value: string): string =>
  createHash('sha256').update(value).digest('hex')
const bytes = (value: string): number => Buffer.byteLength(value, 'utf8')
const fail = (code: string): never => {
  throw new Error(`Invalid diagnostic run: ${code}`)
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('object_required')
  return value as Record<string, unknown>
}
const validProvenance = (
  reply: Extract<DiagnosticReply, { kind: 'response' }>
): boolean =>
  Boolean(reply.response_id && reply.model_version && reply.finish_reason) &&
  [reply.response_id, reply.model_version, reply.finish_reason].every(
    value => bytes(value) <= 200
  )

const empty = (
  outcome: Captured['outcome'],
  reason: string,
  elapsed_ms: number
): Captured => ({
  outcome,
  candidate: { kind: outcome === 'retry' ? 'missing' : 'invalid' },
  reason,
  response_sha256: null,
  response_id: null,
  model_version: null,
  finish_reason: null,
  usage: null,
  observed_microusd: null,
  elapsed_ms,
})
const validateUsage = (
  usage: DiagnosticUsage,
  bundle: DiagnosticBundle
): number => {
  for (const [name, max] of [
    ['input_tokens', bundle.maxInputTokens],
    ['output_tokens', bundle.maxOutputTokens],
    ['reasoning_tokens', bundle.maxReasoningTokens],
  ] as const) {
    const value = usage[name]
    if (!Number.isSafeInteger(value) || value < 0 || value > max)
      return fail('usage_exceeds_reservation')
  }
  return (
    usage.input_tokens * bundle.rates.input +
    usage.output_tokens * bundle.rates.output +
    usage.reasoning_tokens * bundle.rates.reasoning
  )
}
const candidateForReply = (
  raw: Record<string, unknown>,
  request: DiagnosticRequest
) =>
  raw.job_id === request.job_id &&
  raw.input_sha256 === request.input_sha256 &&
  raw.profile_sha256 === request.profile_sha256 &&
  typeof raw.ambiguous === 'boolean'
    ? parseCandidate(raw.candidate)
    : { kind: 'invalid' as const }

const parseReply = (
  reply: DiagnosticReply,
  request: DiagnosticRequest,
  bundle: DiagnosticBundle,
  elapsed_ms: number
): Captured => {
  if (bytes(JSON.stringify(reply)) > 16 * 1024)
    return empty('invalid', 'oversized_envelope', elapsed_ms)
  if (reply.kind === 'transport_error')
    return empty('retry', 'transport', elapsed_ms)
  if (reply.kind === 'http_error')
    return empty(
      reply.status === 429 || (reply.status >= 500 && reply.status <= 599)
        ? 'retry'
        : 'failed',
      `http_${reply.status}`,
      elapsed_ms
    )
  if (bytes(reply.body) > 4096)
    return empty('invalid', 'oversized_response', elapsed_ms)
  if (!validProvenance(reply))
    return empty('invalid', 'missing_provenance', elapsed_ms)
  const observed = reply.usage ? validateUsage(reply.usage, bundle) : null
  if (reply.finish_reason !== 'STOP')
    return empty('invalid', 'incomplete_response', elapsed_ms)
  let raw: Record<string, unknown>
  try {
    raw = object(JSON.parse(reply.body))
  } catch {
    return empty('invalid', 'malformed_response', elapsed_ms)
  }
  const candidate = candidateForReply(raw, request)
  const outcome =
    candidate.kind === 'known'
      ? 'known'
      : candidate.kind === 'abstain'
        ? 'abstain'
        : 'invalid'
  return {
    outcome,
    candidate,
    reason: outcome === 'invalid' ? 'invalid_or_unbound_candidate' : null,
    response_sha256: sha(reply.body),
    response_id: reply.response_id,
    model_version: reply.model_version,
    finish_reason: reply.finish_reason,
    usage: reply.usage ?? null,
    observed_microusd: observed,
    elapsed_ms,
  }
}
const invoke = async (
  request: DiagnosticRequest,
  transport: FakeDiagnosticTransport,
  bundle: DiagnosticBundle,
  timeoutMs: number
): Promise<Captured> => {
  const start = performance.now(),
    controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let reply: DiagnosticReply | 'timeout'
  try {
    reply = await Promise.race([
      transport.generate(structuredClone(request), {
        signal: controller.signal,
        maxResponseBytes: 4096,
      }),
      new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => {
          controller.abort()
          resolve('timeout')
        }, timeoutMs)
      }),
    ])
  } catch {
    reply = { kind: 'transport_error' }
  } finally {
    clearTimeout(timer)
  }
  const elapsed_ms = Math.ceil(performance.now() - start)
  return reply === 'timeout'
    ? empty('retry', 'timeout', elapsed_ms)
    : parseReply(reply, request, bundle, elapsed_ms)
}
const countTokensBounded = async (
  transport: FakeDiagnosticTransport,
  request: DiagnosticRequest,
  timeoutMs: number
): Promise<number> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      transport.countTokens(structuredClone(request)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Invalid diagnostic run: token_preflight_timeout')
            ),
          timeoutMs
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

const checkedTimeout = (options: DiagnosticRunOptions): number => {
  if (!isPreparedBundle(options.bundle)) return fail('unvalidated_bundle')
  if (options.transport.kind !== 'fake')
    return fail('only_fake_transport_available')
  const timeout = options.timeoutMs ?? 5000
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 5000)
    return fail('timeout_bound')
  return timeout
}

export const runDiagnostic = async (options: DiagnosticRunOptions) => {
  const timeoutMs = checkedTimeout(options)
  const now = (options.now ?? (() => new Date()))()
  const db = openRun(options.runDir, options.bundle, now)
  const owner = randomUUID()
  try {
    claimLease(db, owner)
    const runId = (
      db.prepare("SELECT value FROM meta WHERE key='run_id'").get() as {
        value: string
      }
    ).value
    for (const meaning of options.bundle.meanings) {
      while (countAttempts(db, meaning.id) < options.bundle.maxAttempts) {
        const latest = lastCapture(db, meaning.id)
        if (latest && latest.outcome !== 'retry') break
        const next = countAttempts(db, meaning.id) + 1
        const request: DiagnosticRequest = {
          job_id: `${runId}:${meaning.id}:${next}`,
          input_sha256: meaning.inputHash,
          profile_sha256: options.bundle.profileSha256,
          canonical_input: meaning.input,
          prompt: options.bundle.prompt,
          profile: structuredClone(options.bundle.profile),
        }
        // Fake-only token preflight; a live collector needs its own billed control-request authorization.
        renewLease(db, owner)
        const tokenCount = await countTokensBounded(
          options.transport,
          request,
          timeoutMs
        )
        if (
          !Number.isSafeInteger(tokenCount) ||
          tokenCount < 0 ||
          tokenCount > options.bundle.maxInputTokens
        )
          return fail('input_token_bound')
        renewLease(db, owner)
        const attempt = reserve(db, options.bundle, meaning.id, owner)
        if (attempt === null) break
        options.onReserved?.(meaning.id, attempt)
        const result = await invoke(
          request,
          options.transport,
          options.bundle,
          timeoutMs
        )
        capture(db, meaning.id, attempt, result, owner)
      }
    }
    return buildReport(db, options.bundle)
  } finally {
    try {
      releaseLease(db, owner)
    } finally {
      db.close()
    }
  }
}
