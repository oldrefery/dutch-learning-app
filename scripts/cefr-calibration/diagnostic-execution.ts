import { createHash } from 'node:crypto'
import {
  constants,
  closeSync,
  fstatSync,
  openSync,
  readSync,
  readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { isPreparedBundle, type DiagnosticBundle } from './diagnostic-bundle.ts'
import { GEMINI_BASE } from './diagnostic-gemini-http.ts'

const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex')
// Runtime dependency closure, including this validator and the CLI. Documentation
// and private operator files are excluded to avoid circular approval digests.
const implementationPaths = [
  'diagnostic-bundle.ts',
  'diagnostic-execution.ts',
  'diagnostic-gemini-http.ts',
  'diagnostic-gemini.ts',
  'diagnostic-live.ts',
  'diagnostic-report.ts',
  'diagnostic-runner.ts',
  'diagnostic-store.ts',
  'diagnostic-types.ts',
  'diagnostic.ts',
  '../../packages/domain/src/shared-dictionary.ts',
  '../../supabase/functions/_shared/cefr-calibration/fixture.ts',
  '../../supabase/functions/_shared/cefr-calibration/profile.ts',
  '../../supabase/functions/_shared/cefr-calibration/metrics.ts',
  '../../supabase/functions/_shared/cefr-calibration/validation.ts',
].sort()
export const diagnosticImplementationSha256 = (): string =>
  sha(
    JSON.stringify(
      implementationPaths.map(path => [
        path,
        sha(readFileSync(new URL(path, import.meta.url))),
      ])
    )
  )
const fail = (code: string): never => {
  throw new Error(`Invalid diagnostic execution: ${code}`)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('object_required')
  return value as Record<string, unknown>
}
const reference = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 300)
    return fail('reference_required')
  return value
}
const integer = (value: unknown, max: number): number => {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    return fail('budget_required')
  return value as number
}
const approvalWindow = (raw: Record<string, unknown>, now: Date) => {
  const utcDay = now.toISOString().slice(0, 10),
    expiresAt = Date.parse(String(raw.expires_at))
  if (
    raw.utc_day !== utcDay ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime() ||
    expiresAt > Date.parse(`${utcDay}T23:59:59.999Z`)
  )
    return fail('approval_window')
  return { utcDay, expiresAt }
}
const privateBytes = (path: string, max: number): Buffer => {
  let fd: number | undefined
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = fstatSync(fd)
    if (
      !stat.isFile() ||
      stat.mode & 0o077 ||
      stat.size > max ||
      (process.getuid && stat.uid !== process.getuid())
    )
      return fail('private_file_required')
    const buffer = Buffer.alloc(max + 1)
    let length = 0,
      size = 0
    do {
      size = readSync(fd, buffer, length, buffer.length - length, null)
      length += size
    } while (size && length <= max)
    if (length > max) return fail('file_bound')
    return buffer.subarray(0, length)
  } catch {
    return fail('private_file_required')
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

export interface DiagnosticExecution {
  readonly origin: 'injected_http' | 'provider'
  readonly sha256: string
  readonly bundleSha256: string
  readonly draftSha256: string
  readonly implementationSha256: string
  readonly runDir: string
  readonly runId: string
  readonly utcDay: string
  readonly expiresAt: number
  readonly countCost: number
  readonly metadataCost: number
  readonly approvalRef: string
  readonly accountRef: string
  readonly billingRef: string
}
interface PrivateExecution {
  authorizationPath: string
  credentialPath: string
  authorizationSha: string
  credentialSha: string
  key: string
}
const executions = new WeakMap<DiagnosticExecution, PrivateExecution>()
export const isPreparedExecution = (execution: DiagnosticExecution): boolean =>
  executions.has(execution)

// Explicit private operator registry; committed drafts cannot authorize execution.
// Account/key ownership and billing evidence must be established outside this parser.
export const loadDiagnosticExecution = (options: {
  bundle: DiagnosticBundle
  draftPath: string
  authorizationPath: string
  credentialPath: string
  runDir: string
  now?: Date
}): DiagnosticExecution => {
  if (!isPreparedBundle(options.bundle)) return fail('unvalidated_bundle')
  const bytes = privateBytes(options.authorizationPath, 64 * 1024)
  const raw = object(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  )
  if (
    raw.namespace !== 'dictionary-cefr-execution-v1' ||
    raw.approved !== true ||
    raw.execution_enabled !== true ||
    !['test-only', 'human-approved'].includes(String(raw.approval_kind))
  )
    return fail('approval_required')
  const origin =
    raw.approval_kind === 'test-only' ? 'injected_http' : 'provider'
  const bundle = options.bundle,
    now = options.now ?? new Date()
  const draftBytes = privateBytes(options.draftPath, 64 * 1024)
  const draft = object(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(draftBytes))
  )
  const bindings = object(draft.artifact_binding)
  if (
    draft.namespace !== 'dictionary-cefr-live-request-proposal-v1' ||
    bindings.bundle_sha256 !== bundle.bindingSha256 ||
    raw.bundle_sha256 !== bundle.bindingSha256 ||
    raw.draft_sha256 !== sha(draftBytes) ||
    raw.implementation_sha256 !== diagnosticImplementationSha256() ||
    raw.implementation_revision !== 'd11-gemini-runner-v1'
  )
    return fail('artifact_binding')
  const runDir = resolve(options.runDir)
  if (
    raw.run_dir !== runDir ||
    typeof raw.run_id !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      raw.run_id
    )
  )
    return fail('run_binding')
  const { utcDay, expiresAt } = approvalWindow(raw, now)
  const account = object(raw.account),
    pricing = object(raw.pricing)
  if (account.personal !== true || account.paid_tier !== true)
    return fail('personal_paid_account_required')
  const accountRef = reference(account.account_ref)
  reference(account.project_ref)
  reference(account.verification_ref)
  if (
    origin === 'provider' &&
    [
      accountRef,
      account.project_ref,
      account.verification_ref,
      raw.approval_ref,
    ].some(x => String(x).startsWith('TEST-ONLY'))
  )
    return fail('test_registry_cannot_authorize_provider')
  const rates = object(pricing.rates_microusd_per_token)
  if (
    rates.input !== bundle.rates.input ||
    rates.output !== bundle.rates.output ||
    rates.reasoning !== bundle.rates.reasoning ||
    pricing.model !== 'gemini-3.5-flash' ||
    pricing.service_tier !== 'standard' ||
    pricing.api_use_ceiling_microusd !== bundle.ceiling ||
    pricing.pricing_ref !==
      'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash'
  )
    return fail('price_binding')
  const countCost = integer(pricing.count_request_max_microusd, bundle.ceiling)
  const metadataCost = integer(
    pricing.metadata_request_max_microusd,
    bundle.ceiling
  )
  const billingRef = reference(pricing.control_billing_verification_ref)
  if (
    bundle.maxRequests * bundle.costPerAttempt +
      bundle.meanings.length * countCost +
      metadataCost >
    bundle.ceiling
  )
    return fail('combined_cost_bound')
  if (
    pricing.total_reserved_tokens !==
    bundle.maxRequests * bundle.tokensPerAttempt +
      bundle.meanings.length * bundle.maxInputTokens
  )
    return fail('combined_token_bound')
  if (
    !Array.isArray(raw.sources) ||
    raw.sources.length !== bundle.meanings.length
  )
    return fail('source_approval_required')
  const sources = new Map(
    raw.sources.map(value => {
      const row = object(value)
      reference(row.approval_ref)
      return [row.item_id, row] as const
    })
  )
  if (
    sources.size !== bundle.meanings.length ||
    bundle.meanings.some(
      item => sources.get(item.id)?.input_sha256 !== item.inputHash
    )
  )
    return fail('source_binding')
  const key = new TextDecoder('utf-8', { fatal: true })
    .decode(privateBytes(options.credentialPath, 4096))
    .trim()
  if (
    !/^[A-Za-z0-9_-]{20,200}$/.test(key) ||
    raw.credential_sha256 !== sha(key) ||
    (origin === 'injected_http'
      ? key !== 'TEST-ONLY-NOT-A-CREDENTIAL'
      : key.startsWith('TEST-ONLY'))
  )
    return fail('credential_binding')
  const execution = Object.freeze({
    origin,
    sha256: sha(bytes),
    bundleSha256: bundle.bindingSha256,
    draftSha256: sha(draftBytes),
    implementationSha256: diagnosticImplementationSha256(),
    runDir,
    runId: raw.run_id,
    utcDay,
    expiresAt,
    countCost,
    metadataCost,
    approvalRef: reference(raw.approval_ref),
    accountRef,
    billingRef,
  })
  executions.set(execution, {
    authorizationPath: options.authorizationPath,
    credentialPath: options.credentialPath,
    authorizationSha: sha(bytes),
    credentialSha: sha(key),
    key,
  })
  return execution
}

export const assertExecutionCurrent = (
  execution: DiagnosticExecution,
  now: Date
): void => {
  const saved = executions.get(execution)
  if (!saved) return fail('unprepared_execution')
  if (
    now.toISOString().slice(0, 10) !== execution.utcDay ||
    now.getTime() >= execution.expiresAt
  )
    return fail('execution_expired')
  if (
    diagnosticImplementationSha256() !== execution.implementationSha256 ||
    sha(privateBytes(saved.authorizationPath, 64 * 1024)) !==
      saved.authorizationSha ||
    sha(
      new TextDecoder('utf-8', { fatal: true })
        .decode(privateBytes(saved.credentialPath, 4096))
        .trim()
    ) !== saved.credentialSha
  )
    return fail('execution_revoked_or_changed')
}
export const bindExecutionHttp = (
  execution: DiagnosticExecution,
  injected?: (url: string, init: RequestInit) => Promise<Response>
) => {
  const saved = executions.get(execution)
  if (!saved) return fail('unprepared_execution')
  if (execution.origin === 'injected_http' && !injected)
    return fail('test_http_required')
  const http = injected ?? fetch
  return async (url: string, init: RequestInit): Promise<Response> => {
    assertExecutionCurrent(execution, new Date())
    if (
      ![
        GEMINI_BASE,
        `${GEMINI_BASE}:countTokens`,
        `${GEMINI_BASE}:generateContent`,
      ].includes(url) ||
      init.redirect !== 'error'
    )
      return fail('endpoint_binding')
    return http(url, {
      ...init,
      headers: { ...init.headers, 'x-goog-api-key': saved.key },
    })
  }
}
