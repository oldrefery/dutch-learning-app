import {
  isQualifiedProfile,
  type QualifiedMethod,
} from '../cefr-calibration/policy.ts'
import { profileDigest } from '../cefr-calibration/profile.ts'
import { record } from '../cefr-calibration/validation.ts'
import {
  evaluateCefrLeases,
  type CefrAttemptResult,
  type CefrProvider,
  type LeasedCefrJob,
} from './evaluate.ts'

export interface ReservedCefrJob extends LeasedCefrJob {
  reservation_id: string
  reservation_utc_day: string
}
export interface CefrWorkerStore {
  start(policyId: string, runId: string): Promise<unknown>
  authorize(job: ReservedCefrJob, signal?: AbortSignal): Promise<unknown>
  finish(job: ReservedCefrJob, result: CefrAttemptResult): Promise<unknown>
  summarize(runId: string): Promise<unknown>
}
export interface CefrWorkerConfiguration {
  enabled?: boolean
  workerSecret?: string
  policyId?: string
  profile?: unknown
  qualification?: QualifiedMethod | null
  timeoutMs?: number
}
export interface CefrWorkerServices {
  store: CefrWorkerStore
  provider: CefrProvider
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const response = (status: number, code: string, summary?: unknown) =>
  Response.json(
    { status: code, ...(summary ? { summary } : {}) },
    { status, headers: { 'cache-control': 'no-store' } }
  )

const parseJobs = (
  raw: unknown,
  profileHash: string,
  qualification: string
): ReservedCefrJob[] => {
  if (!Array.isArray(raw) || raw.length > 8)
    throw new Error('Invalid leased batch')
  const ids = new Set<string>(),
    reservations = new Set<string>()
  return raw.map(value => {
    const job = record(value)
    for (const field of [
      'job_id',
      'entry_id',
      'revision_id',
      'lease_token',
      'reservation_id',
    ])
      if (typeof job[field] !== 'string' || !UUID.test(job[field]))
        throw new Error('Invalid lease identity')
    if (
      typeof job.reservation_utc_day !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(job.reservation_utc_day)
    )
      throw new Error('Invalid reservation day')
    if (
      typeof job.input_sha256 !== 'string' ||
      !HASH.test(job.input_sha256) ||
      job.profile_sha256 !== profileHash ||
      job.qualification_sha256 !== qualification ||
      typeof job.attempt !== 'number' ||
      !Number.isSafeInteger(job.attempt) ||
      job.attempt < 1 ||
      typeof job.lease_expires_at !== 'string' ||
      !Number.isFinite(Date.parse(job.lease_expires_at))
    )
      throw new Error('Invalid lease binding')
    if (
      ids.has(job.job_id as string) ||
      reservations.has(job.reservation_id as string)
    )
      throw new Error('Duplicate lease')
    ids.add(job.job_id as string)
    reservations.add(job.reservation_id as string)
    return job as unknown as ReservedCefrJob
  })
}

// This factory receives server-owned configuration and adapters only. No runtime
// endpoint, environment secret, provider target or schedule is activated here.
export const createCefrWorkerHandler = async (
  configuration: CefrWorkerConfiguration,
  services: CefrWorkerServices
): Promise<(request: Request) => Promise<Response>> => {
  const config = {
    ...configuration,
    profile: structuredClone(configuration.profile),
  }
  const store = services.store,
    provider = services.provider
  const encoder = new TextEncoder()
  let key: CryptoKey | null = null,
    signature: ArrayBuffer | null = null
  if (
    typeof config.workerSecret === 'string' &&
    /^[A-Za-z0-9_-]{43,200}$/.test(config.workerSecret)
  ) {
    key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(config.workerSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(config.workerSecret)
    )
  }
  return async request => {
    // A public apikey or user JWT alone never enters the privileged workflow.
    const supplied = request.headers.get('x-cefr-worker-secret')
    if (!key || !signature) return response(503, 'unconfigured')
    if (
      !supplied ||
      supplied.length > 200 ||
      !(await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        encoder.encode(supplied)
      ))
    )
      return response(403, 'forbidden')
    if (request.method !== 'POST') return response(405, 'method_not_allowed')
    if (new URL(request.url).search || request.body !== null)
      return response(400, 'invalid_request')
    if (config.enabled !== true) return response(200, 'disabled')
    if (
      !config.policyId ||
      !UUID.test(config.policyId) ||
      !config.qualification ||
      !Number.isSafeInteger(config.timeoutMs) ||
      config.timeoutMs! < 1 ||
      config.timeoutMs! > 5000 ||
      !(await isQualifiedProfile(config.profile, config.qualification))
    )
      return response(503, 'unqualified')
    const runId = crypto.randomUUID()
    try {
      const started = record(await store.start(config.policyId, runId))
      const status = started.status
      if (
        ![
          'running',
          'no_work',
          'budget_stop',
          'day_changed',
          'disabled',
          'unqualified',
          'duplicate_run',
        ].includes(String(status))
      )
        throw new Error('Invalid dispatch result')
      const jobs = parseJobs(
        started.jobs,
        await profileDigest(config.profile),
        config.qualification.qualification_sha256
      )
      if (status !== 'running') {
        if (jobs.length !== 0) throw new Error('Unexpected dispatch')
        const summary =
          started.run_id === runId ? await store.summarize(runId) : undefined
        return response(200, String(status), summary)
      }
      if (started.run_id !== runId || jobs.length === 0)
        throw new Error('Invalid run identity')
      const results = await evaluateCefrLeases(jobs, {
        enabled: true,
        qualification: config.qualification,
        timeoutMs: config.timeoutMs!,
        provider: async (request, context) => {
          const lease = jobs.find(job => job.job_id === request.job_id)
          if (
            lease?.reservation_utc_day !== new Date().toISOString().slice(0, 10)
          )
            throw new Error('Reservation dispatch day changed')
          if (!lease) throw new Error('Missing reserved lease')
          const permission = record(
            await store.authorize(lease, context.signal)
          )
          if (
            permission.allowed !== true ||
            context.signal.aborted ||
            lease.reservation_utc_day !== new Date().toISOString().slice(0, 10)
          )
            throw new Error('Dispatch permission denied')
          return provider(request, context)
        },
      })
      // A failed persistence call leaves its conservative reservation and lease;
      // each other result still settles independently. No provider retry here.
      const outcomes = await Promise.allSettled(
        jobs.map((job, i) => store.finish(job, results[i]))
      )
      const summary = await store.summarize(runId)
      return outcomes.some(value => value.status === 'rejected')
        ? response(503, 'persistence_failure', summary)
        : response(200, 'finished', summary)
    } catch {
      // Never return credentials, provider text, personal data or raw errors.
      return response(503, 'worker_failure')
    }
  }
}
