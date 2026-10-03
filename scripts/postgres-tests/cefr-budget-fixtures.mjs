import { createCefrRpcStore } from '../../supabase/functions/_shared/cefr-worker/store.ts'
import { randomUUID } from 'node:crypto'
import { syntheticWorker } from '../../supabase/functions/_shared/cefr-worker/synthetic-fixtures.ts'
import {
  methodFixture,
  hash,
  json,
  call,
  asService,
} from './cefr-queue-fixtures.mjs'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { owner, literal } from './fixtures.mjs'

export async function budgetFixture(db, options = {}) {
  const worker = await syntheticWorker({ methodRevision: randomUUID() })
  const method = await methodFixture(db, { concurrency: 8, worker, ...options })
  const id = randomUUID()
  const p = {
    requests: 10,
    tokens: 10000,
    cost: 10000,
    inputRate: 2,
    outputRate: 3,
    reasoningRate: 4,
    maxOutput: 64,
    validSeconds: 86400,
    ...options,
  }
  await db.sql(`INSERT INTO private.dictionary_cefr_budget_policies(policy_id,method_id,profile_sha256,qualification_sha256,
    approval_ref,pricing_ref,bounds_ref,approved_by,approved_at,valid_until,
    daily_requests,daily_tokens,daily_cost_microusd,max_input_tokens,max_output_tokens,max_reasoning_tokens,
    input_microusd_per_token,output_microusd_per_token,reasoning_microusd_per_token)
    VALUES('${id}','${method.id}','${hash(canonicalizeJson(method.profile))}','${method.qualification}',
      'TEST-ONLY-spending','TEST-ONLY-pricing','TEST-ONLY-bounds','${owner}',now(),now()+make_interval(secs=>${p.validSeconds}),
      ${p.requests},${p.tokens},${p.cost},100,${p.maxOutput},10,${p.inputRate},${p.outputRate},${p.reasoningRate});
    UPDATE private.dictionary_cefr_worker_control SET enabled=${options.active ?? true},policy_id='${id}' WHERE singleton;`)
  return { id, method, worker }
}
export const startSql = (policy, run = randomUUID()) =>
  `SELECT public.start_dictionary_cefr_run_v1('${policy}','${run}');`
export const start = (db, policy, run) => call(db, startSql(policy, run))
export const usage = patch => ({
  provider_request_id: `TEST-ONLY-${randomUUID()}`,
  input_tokens: 10,
  output_tokens: 5,
  reasoning_tokens: 0,
  ...patch,
})
export const account = (db, job, receipt = null) =>
  call(
    db,
    `SELECT public.account_dictionary_cefr_attempt_v1('${job.reservation_id}','${job.lease_token}',${receipt === null ? 'NULL' : json(receipt)});`
  )
export const dispatch = (db, job) =>
  call(
    db,
    `SELECT public.authorize_dictionary_cefr_dispatch_v1('${job.reservation_id}','${job.lease_token}');`
  )
export const finish = (
  db,
  job,
  result = { outcome: 'estimated', level: 'A2', confidence: 0.9 }
) =>
  call(
    db,
    `SELECT public.finish_dictionary_cefr_attempt_v1('${job.reservation_id}','${job.lease_token}',${literal(result.outcome)},
    ${result.level ? literal(result.level) : 'NULL'},${result.confidence ?? 'NULL'},${result.retryAfterSeconds ?? 'NULL'},${result.usage ? json(result.usage) : 'NULL'});`
  )
export const summarize = (db, run) =>
  call(db, `SELECT public.finish_dictionary_cefr_run_v1('${run}');`)
export const ledger = async db =>
  JSON.parse(
    await db.sql(
      `SELECT to_jsonb(u) FROM private.dictionary_cefr_daily_usage u WHERE utc_day=(clock_timestamp() AT TIME ZONE 'UTC')::DATE`
    )
  )
export const storeFor = db =>
  createCefrRpcStore(async (name, args, signal) => {
    if (signal.aborted) throw new Error('Synthetic RPC cancelled')
    const values = Object.entries(args)
      .map(([key, value]) => {
        if (!/^p_[a-z_]+$/.test(key))
          throw new Error('Invalid synthetic RPC key')
        return `${key} => ${typeof value === 'object' ? json(value) : typeof value === 'number' ? value : literal(value)}`
      })
      .join(',')
    return {
      data: await call(db, `SELECT public.${name}(${values});`),
      error: null,
    }
  })
export const serviceSql = asService
