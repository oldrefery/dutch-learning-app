import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { isPreparedBundle, type DiagnosticBundle } from './diagnostic-bundle.ts'
import { buildReport } from './diagnostic-report.ts'
import { parseDiagnosticReply } from './diagnostic.ts'
import {
  assertExecutionCurrent,
  bindExecutionHttp,
  isPreparedExecution,
  type DiagnosticExecution,
} from './diagnostic-execution.ts'
import {
  createGeminiTestAdapter,
  GEMINI_BASE,
  prepareGeminiRequest,
  requestDigest,
  parseGeminiMetadata,
  type GeminiPreparedRequest,
  type TestHttp,
} from './diagnostic-gemini.ts'
import {
  assertNotRejected,
  capture,
  captureControl,
  claimLease,
  countAttempts,
  lastCapture,
  openRun,
  releaseLease,
  renewLease,
  reserve,
  reserveControl,
  retryNotBefore,
  type ControlKey,
  type SqliteDatabase,
} from './diagnostic-store.ts'
import type { Captured } from './diagnostic-types.ts'

export interface DiagnosticRunnerOptions {
  bundle: DiagnosticBundle
  execution: DiagnosticExecution
  // Production CLI never supplies these test hooks.
  http?: TestHttp
  now?: () => Date
  wait?: (milliseconds: number) => Promise<void>
  jitter?: () => number
  timeoutMs?: number
  onReserved?: (
    kind: 'control' | 'generation',
    id: string,
    attempt?: number
  ) => void
}
const failure = (message: string): never => {
  throw new Error(`Invalid diagnostic runner: ${message}`)
}

const retryCapture = (
  result: Captured,
  retryAfter: number | undefined,
  attempt: number,
  now: number,
  jitter: number
): Captured => {
  if (result.outcome !== 'retry') return result
  const ms = Math.max(
    1000 * 2 ** (attempt - 1) + Math.floor(250 * jitter),
    retryAfter ?? 0
  )
  if (!Number.isFinite(ms) || ms > 5000)
    return { ...result, outcome: 'failed', reason: 'retry_delay_out_of_scope' }
  return { ...result, retry_not_before: now + ms }
}
const pinnedVersion = (db: SqliteDatabase): string | null => {
  const row = db
    .prepare(
      'SELECT model_version FROM captures WHERE model_version IS NOT NULL LIMIT 1'
    )
    .get() as { model_version: string } | undefined
  return row?.model_version ?? null
}
const waitForRetry = async (
  retryAt: number,
  clock: () => Date,
  wait: (ms: number) => Promise<void>,
  guard: () => void
) => {
  const ms = retryAt - clock().getTime()
  if (ms > 5000) return failure('retry_clock_bound')
  if (ms > 0) {
    guard()
    await wait(ms)
    guard()
  }
  if (clock().getTime() < retryAt) return failure('retry_wait_incomplete')
}

export const runGeminiDiagnostic = async (
  configuration: DiagnosticRunnerOptions
) => {
  const { bundle, execution, http, onReserved } = configuration
  if (!isPreparedBundle(bundle)) return failure('unvalidated_bundle')
  if (!isPreparedExecution(execution)) return failure('unprepared_execution')
  if (execution.bundleSha256 !== bundle.bindingSha256)
    return failure('bundle_binding')
  if (
    execution.origin === 'provider' &&
    (http ||
      configuration.timeoutMs ||
      configuration.now ||
      configuration.wait ||
      configuration.jitter ||
      onReserved)
  )
    return failure('provider_test_hooks_forbidden')
  const clock = configuration.now ?? (() => new Date()),
    wait = configuration.wait ?? (ms => delay(ms)),
    random = configuration.jitter ?? Math.random
  assertExecutionCurrent(execution, clock())
  const adapter = createGeminiTestAdapter({
    mode: 'test-only',
    http: bindExecutionHttp(execution, http),
    timeoutMs: configuration.timeoutMs,
  })
  const db = openRun(execution.runDir, bundle, clock(), execution),
    owner = randomUUID()
  const guard = () => {
    assertExecutionCurrent(execution, clock())
    renewLease(db, owner)
    assertNotRejected(db)
  }
  try {
    claimLease(db, owner)
    guard()
    const requests = bundle.meanings.map(item =>
      prepareGeminiRequest(bundle, item.id, execution.runId)
    )
    const control = async <T>(
      key: ControlKey,
      dispatch: () => Promise<T>,
      validate: (value: unknown) => T
    ): Promise<T> => {
      guard()
      const cached = reserveControl(db, bundle, key, owner, clock())
      if (cached !== null) return validate(JSON.parse(cached) as unknown)
      onReserved?.('control', key.id)
      guard()
      const result = validate(await dispatch())
      captureControl(db, key, JSON.stringify(result), owner)
      guard()
      return result
    }
    await control(
      {
        id: 'model_metadata',
        kind: 'model_metadata',
        requestSha256: requestDigest(`GET ${GEMINI_BASE}`),
      },
      adapter.modelMetadata,
      parseGeminiMetadata
    )
    for (const request of requests) {
      // Terminal/completed meanings need no further control or generation calls.
      const prior = lastCapture(db, request.itemId)
      if (prior && prior.outcome !== 'retry') continue
      if (countAttempts(db, request.itemId) >= bundle.maxAttempts) continue
      await control(
        {
          id: request.itemId,
          kind: 'count_tokens',
          requestSha256: request.sha256,
        },
        () => adapter.countTokens(request),
        value => {
          if (
            !Number.isSafeInteger(value) ||
            Number(value) < 0 ||
            Number(value) > bundle.maxInputTokens
          )
            return failure('input_token_bound')
          return value as number
        }
      )
      await generateMeaning(request)
    }
    guard()
    return buildReport(db, bundle)

    async function generateMeaning(request: GeminiPreparedRequest) {
      while (countAttempts(db, request.itemId) < bundle.maxAttempts) {
        const latest = lastCapture(db, request.itemId)
        if (latest && latest.outcome !== 'retry') break
        const retryAt = retryNotBefore(db, request.itemId)
        await waitForRetry(retryAt, clock, wait, guard)
        guard()
        const attempt = reserve(
          db,
          bundle,
          request.itemId,
          owner,
          clock().getTime()
        )
        if (attempt === null) break
        onReserved?.('generation', request.itemId, attempt)
        guard()
        const start = performance.now()
        const reply = await adapter.generate(request, pinnedVersion(db))
        const elapsed = Math.ceil(performance.now() - start)
        let result = parseDiagnosticReply(
          reply,
          request.diagnostic,
          bundle,
          elapsed
        )
        const jitter = random()
        if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1)
          return failure('jitter_bound')
        result = retryCapture(
          result,
          reply.kind === 'http_error' ? reply.retry_after_ms : undefined,
          attempt,
          clock().getTime(),
          jitter
        )
        // Capture billed/unknown outcome even if the approval expires during HTTP.
        capture(db, request.itemId, attempt, result, owner)
        guard()
      }
    }
  } finally {
    try {
      releaseLease(db, owner)
    } finally {
      db.close()
    }
  }
}
