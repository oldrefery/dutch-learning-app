import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, beforeEach, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { seedUsers } from './fixtures.mjs'
import {
  entryFixture,
  holdTransaction,
  call,
  until,
  json,
} from './cefr-queue-fixtures.mjs'
import {
  budgetFixture,
  start,
  startSql,
  usage,
  account,
  dispatch,
  finish,
  summarize,
  ledger,
  storeFor,
  serviceSql,
} from './cefr-budget-fixtures.mjs'
import { createCefrWorkerHandler } from '../../supabase/functions/_shared/cefr-worker/handler.ts'

const DAILY_COUNT = 'SELECT count(*) FROM private.dictionary_cefr_daily_usage'
const ENABLE_CONTROL =
  'UPDATE private.dictionary_cefr_worker_control SET enabled=TRUE'
const ATTEMPT_COUNT =
  'SELECT count(*) FROM private.dictionary_cefr_attempt_usage'
let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  assert.equal(
    await db.sql('SELECT enabled FROM private.dictionary_cefr_worker_control'),
    'f'
  )
  assert.equal(
    await db.sql(
      'SELECT count(*) FROM private.dictionary_cefr_budget_policies'
    ),
    '0'
  )
})
beforeEach(async () => {
  await db.sql(`UPDATE private.dictionary_cefr_worker_control SET enabled=FALSE,policy_id=NULL;
    TRUNCATE private.dictionary_cefr_attempt_usage,private.dictionary_cefr_runs,private.dictionary_cefr_daily_usage;
    UPDATE public.dictionary_entries SET state='retired' WHERE state='published';`)
})
after(async () => {
  await db?.close()
})
const ready = async options => {
  const policy = await budgetFixture(db, options)
  const entry = await entryFixture(db)
  const run = await start(db, policy.id)
  assert.equal(run.jobs.length, 1)
  assert.equal((await dispatch(db, run.jobs[0])).allowed, true)
  return { ...policy, entry, run, job: run.jobs[0] }
}

for (const lock of ['head', 'cursor'])
  test(`policy expiry while completion waits for ${lock} cannot publish`, async () => {
    const { id, entry, job, run } = await ready({ validSeconds: 7 })
    const receipt = usage()
    const held = await holdTransaction(
      db,
      lock === 'head'
        ? `SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id='${entry.entry}' FOR UPDATE;`
        : 'SELECT 1 FROM private.dictionary_delivery_cursor FOR UPDATE;'
    )
    let pending
    try {
      const name = `cefr-policy-expiry-${randomUUID()}`
      pending = call(
        db,
        `SET application_name='${name}';
        SELECT public.finish_dictionary_cefr_attempt_v1('${job.reservation_id}','${job.lease_token}',
          'estimated','A2',0.9,NULL,${json(receipt)});`
      )
      await until(
        async () =>
          (await db.sql(
            `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
          )) === '1'
      )
      await db.sql(`SELECT pg_sleep(greatest(0,extract(epoch FROM valid_until-clock_timestamp()))+0.05)
        FROM private.dictionary_cefr_budget_policies WHERE policy_id='${id}'`)
      await held.finish()
      assert.equal((await pending).status, 'obsolete')
      assert.equal(
        await db.sql(
          `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
        ),
        '0'
      )
      assert.equal(
        await db.sql(
          `SELECT count(*) FROM public.dictionary_cefr_heads WHERE entry_id='${entry.entry}'`
        ),
        '0'
      )
      assert.equal(
        await db.sql(
          `SELECT count(*) FROM private.dictionary_content_changes WHERE entry_id='${entry.entry}' AND change_kind='cefr-head'`
        ),
        '0'
      )
      assert.equal((await ledger(db)).charged_tokens, 15)
      assert.equal((await ledger(db)).charged_cost_microusd, 35)
      assert.equal((await summarize(db, run.run_id)).obsolete, 1)
      assert.equal(
        (
          await finish(db, job, {
            outcome: 'estimated',
            level: 'A2',
            confidence: 0.9,
            usage: receipt,
          })
        ).status,
        'obsolete'
      )
    } finally {
      if (!held.session.child.stdin.writableEnded) {
        held.session.child.stdin.end('ROLLBACK;\n')
        await held.session.completed.catch(() => {})
      }
      await pending?.catch(() => {})
    }
  })

test('client roles cannot read ledgers, change controls or invoke accounting', async () => {
  const policy = await budgetFixture(db, { active: false })
  for (const role of ['anon', 'authenticated', 'service_role'])
    for (const table of [
      'budget_policies',
      'worker_control',
      'daily_usage',
      'runs',
      'attempt_usage',
    ])
      await assert.rejects(
        db.sql(
          `SET ROLE ${role}; SELECT * FROM private.dictionary_cefr_${table}`
        ),
        /permission denied/
      )
  for (const role of ['anon', 'authenticated'])
    for (const sql of [
      `SELECT public.authorize_dictionary_cefr_dispatch_v1('${randomUUID()}','${randomUUID()}')`,
      startSql(policy.id),
      `SELECT public.account_dictionary_cefr_attempt_v1('${randomUUID()}','${randomUUID()}')`,
      `SELECT public.finish_dictionary_cefr_attempt_v1('${randomUUID()}','${randomUUID()}','unknown')`,
      `SELECT public.finish_dictionary_cefr_run_v1('${randomUUID()}')`,
    ])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; ${sql}`),
        /permission denied/
      )
  await assert.rejects(db.sql(serviceSql(ENABLE_CONTROL)), /permission denied/)
  assert.equal((await start(db, policy.id)).status, 'disabled')
})

test('disabled, mismatched and empty work reserve zero requests', async () => {
  const p = await budgetFixture(db, { active: false })
  await entryFixture(db)
  assert.equal((await start(db, p.id)).status, 'disabled')
  assert.equal(await db.sql(ATTEMPT_COUNT), '0')
  await db.sql(ENABLE_CONTROL)
  assert.equal((await start(db, randomUUID())).status, 'disabled')
  await db.sql("UPDATE public.dictionary_entries SET state='retired'")
  const run = await start(db, p.id)
  assert.equal(run.status, 'no_work')
  assert.equal((await summarize(db, run.run_id)).claimed, 0)
  assert.equal(await db.sql(DAILY_COUNT), '0')
})

test('immutable pricing/bounds and profile binding fail closed', async () => {
  const p = await budgetFixture(db)
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_cefr_budget_policies SET daily_requests=999 WHERE policy_id='${p.id}'`
    ),
    /policy is immutable/
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_methods SET revoked_at=now() WHERE method_id='${p.method.id}'`
  )
  await entryFixture(db)
  assert.equal((await start(db, p.id)).status, 'unqualified')
  assert.equal(await db.sql(DAILY_COUNT), '0')
  await assert.rejects(
    budgetFixture(db, { inputRate: 'NULL' }),
    /not-null constraint/
  )
})

test('request, token and cost ceilings each cap claims without consuming rejected attempts', async () => {
  for (const limits of [{ requests: 1 }, { tokens: 174 }, { cost: 432 }]) {
    await db.sql(`TRUNCATE private.dictionary_cefr_attempt_usage,private.dictionary_cefr_runs,private.dictionary_cefr_daily_usage;
      UPDATE public.dictionary_entries SET state='retired' WHERE state='published';`)
    const p = await budgetFixture(db, limits)
    await entryFixture(db)
    await entryFixture(db)
    const run = await start(db, p.id)
    assert.equal(run.jobs.length, 1)
    assert.equal((await start(db, p.id)).status, 'budget_stop')
    const day = await ledger(db)
    assert.equal(day.requests, 1)
    assert.equal(day.charged_tokens, 174)
    assert.equal(day.charged_cost_microusd, 432)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM private.dictionary_cefr_jobs WHERE method_id='${p.method.id}' AND state='ready' AND attempt=0`
      ),
      '1'
    )
  }
})

test('overlapping runs serialize cap reservations and cannot spend the same remaining slot', async () => {
  const p = await budgetFixture(db, { requests: 1 })
  await entryFixture(db)
  await entryFixture(db)
  const held = await holdTransaction(db, serviceSql(startSql(p.id)))
  let pending
  try {
    const name = `cefr-budget-${randomUUID()}`
    pending = call(db, `SET application_name='${name}'; ${startSql(p.id)}`)
    await until(
      async () =>
        (await db.sql(
          `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
        )) === '1'
    )
    await held.finish()
    assert.equal((await pending).status, 'budget_stop')
    assert.equal((await ledger(db)).requests, 1)
    assert.equal(await db.sql(ATTEMPT_COUNT), '1')
  } finally {
    if (!held.session.child.stdin.writableEnded) {
      held.session.child.stdin.end('ROLLBACK;\n')
      await held.session.completed.catch(() => {})
    }
    await pending?.catch(() => {})
  }
})

test('reservation rollback leaves no lease, run, receipt or budget charge', async () => {
  const p = await budgetFixture(db)
  await entryFixture(db)
  await db.sql(`BEGIN; SET ROLE service_role; ${startSql(p.id)} ROLLBACK;`)
  for (const table of ['runs', 'attempt_usage', 'daily_usage'])
    assert.equal(
      await db.sql(`SELECT count(*) FROM private.dictionary_cefr_${table}`),
      '0'
    )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM private.dictionary_cefr_jobs WHERE method_id='${p.method.id}'`
    ),
    '0'
  )
})

test('unknown usage retains maximum; verified usage reconciles once and is immutable', async () => {
  const { job } = await ready()
  assert.equal((await account(db, job)).status, 'unknown')
  assert.equal((await ledger(db)).charged_tokens, 174)
  const receipt = usage()
  assert.equal((await account(db, job, receipt)).status, 'verified')
  const day = await ledger(db)
  assert.equal(day.requests, 1)
  assert.equal(day.charged_tokens, 15)
  assert.equal(day.charged_cost_microusd, 35)
  assert.equal(day.total_reserved_tokens, 174)
  assert.equal((await account(db, job, receipt)).status, 'verified')
  assert.deepEqual(await ledger(db), day)
  await assert.rejects(
    account(db, job, { ...receipt, input_tokens: 0 }),
    /usage changed/
  )
  assert.equal((await account(db, job)).status, 'verified')
  assert.deepEqual(await ledger(db), day)
})

test('verified reconciliation can free tokens and cost but never request count', async () => {
  const { id, job } = await ready({ tokens: 200, cost: 500, requests: 2 })
  await entryFixture(db)
  assert.equal((await start(db, id)).status, 'budget_stop')
  await account(db, job, usage())
  assert.equal((await start(db, id)).jobs.length, 1)
  await entryFixture(db)
  assert.equal((await start(db, id)).status, 'budget_stop')
  assert.equal((await ledger(db)).requests, 2)
})

test('out-of-bound usage preserves the reserve and trips the global kill switch', async () => {
  const { id, job } = await ready()
  assert.equal(
    (await account(db, job, usage({ input_tokens: 101 }))).status,
    'exceeded'
  )
  assert.equal((await ledger(db)).charged_tokens, 174)
  assert.equal((await start(db, id)).status, 'disabled')
  assert.equal((await finish(db, job)).status, 'obsolete')
  assert.equal(
    await db.sql('SELECT count(*) FROM public.dictionary_cefr_assessments'),
    '0'
  )
})

test('malformed or reused transport receipts cannot release charges', async () => {
  const { id, job } = await ready()
  for (const receipt of [
    { input_tokens: 0 },
    usage({ input_tokens: -1 }),
    usage({ input_tokens: 1.5 }),
    { ...usage(), extra: true },
  ])
    await assert.rejects(account(db, job, receipt), /Invalid verified/)
  assert.equal(
    (await account(db, { ...job, lease_token: randomUUID() }, usage())).status,
    'stale'
  )
  const receipt = usage()
  await account(db, job, receipt)
  await entryFixture(db)
  const next = (await start(db, id)).jobs[0]
  await dispatch(db, next)
  await assert.rejects(account(db, next, receipt), /unique constraint/)
  assert.equal((await ledger(db)).charged_tokens, 189)
})

test('crash, expired lease and retry keep conservative charges and bill attempts separately', async () => {
  const { id, job, run } = await ready({ requests: 3 })
  assert.equal((await start(db, id, run.run_id)).status, 'duplicate_run')
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id='${job.job_id}'`
  )
  assert.equal((await summarize(db, run.run_id)).status, 'abandoned')
  const next = (await start(db, id)).jobs[0]
  assert.equal(next.attempt, 2)
  assert.equal((await finish(db, job)).status, 'stale')
  assert.equal(
    (await finish(db, next, { outcome: 'retry', retryAfterSeconds: 1 })).status,
    'retry_wait'
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE job_id='${job.job_id}'`
  )
  const third = (await start(db, id)).jobs[0]
  assert.equal(third.attempt, 3)
  assert.equal((await finish(db, third, { outcome: 'retry' })).status, 'failed')
  const day = await ledger(db)
  assert.equal(day.requests, 3)
  assert.equal(day.charged_tokens, 522)
  assert.equal(day.charged_cost_microusd, 1296)
})

test('duplicate completion is idempotent and run summary contains validated counts/coverage', async () => {
  const { job, run } = await ready()
  const result = {
    outcome: 'estimated',
    level: 'A2',
    confidence: 0.9,
    usage: usage(),
  }
  const completed = await finish(db, job, result)
  assert.equal(completed.status, 'completed')
  assert.deepEqual(await finish(db, job, result), completed)
  await assert.rejects(
    finish(db, job, { ...result, level: 'B1' }),
    /completion changed/
  )
  const summary = await summarize(db, run.run_id)
  assert.equal(summary.status, 'finished')
  assert.equal(summary.completed, 1)
  assert.equal(summary.pending, 0)
  assert.equal(summary.observed_tokens, 15)
  assert.equal(summary.unknown_usage, 0)
  assert.equal(summary.remaining_eligible, 0)
})

test('UTC bucket is independent of session timezone and policy changes cannot reset a used day', async () => {
  const p = await budgetFixture(db, { requests: 1 })
  await entryFixture(db)
  const run = await call(
    db,
    `SET TIME ZONE 'Pacific/Kiritimati'; ${startSql(p.id)}`
  )
  const utc = await db.sql(
    "SELECT (clock_timestamp() AT TIME ZONE 'UTC')::DATE"
  )
  assert.equal(run.jobs[0].reservation_utc_day, utc)
  const replacement = await budgetFixture(db, { requests: 10 })
  assert.equal((await start(db, replacement.id)).status, 'budget_stop')
  assert.equal((await ledger(db)).requests, 1)
  assert.equal((await ledger(db)).policy_id, p.id)
})

test('fractional prices round upward and never use floating-point cost accounting', async () => {
  const { job } = await ready({
    inputRate: 0.1,
    outputRate: 0,
    reasoningRate: 0,
  })
  assert.equal((await ledger(db)).charged_cost_microusd, 10)
  await account(db, job, usage({ input_tokens: 1, output_tokens: 0 }))
  assert.equal((await ledger(db)).charged_cost_microusd, 1)
})

test('authorized request handler integrates reservation, fake provider, receipt and no-work paths', async () => {
  const p = await budgetFixture(db)
  await entryFixture(db)
  const secret = 'TEST_ONLY_' + 'a'.repeat(54)
  let calls = 0
  const handler = await createCefrWorkerHandler(
    {
      enabled: true,
      workerSecret: secret,
      policyId: p.id,
      profile: p.worker.inputs.profile,
      qualification: p.worker.qualified,
      timeoutMs: 100,
    },
    {
      store: storeFor(db),
      provider: request => {
        calls++
        return {
          kind: 'response',
          body: JSON.stringify({
            job_id: request.job_id,
            input_sha256: request.input_sha256,
            profile_sha256: request.profile_sha256,
            ambiguous: false,
            candidate: { level: 'A2', confidence: 0.9 },
          }),
          usage: usage(),
        }
      },
    }
  )
  const request = () =>
    new Request('https://example.invalid/cefr-worker', {
      method: 'POST',
      headers: { 'x-cefr-worker-secret': secret },
    })
  assert.equal(
    (
      await handler(
        new Request('https://example.invalid/cefr-worker', {
          method: 'POST',
          headers: { apikey: secret },
        })
      )
    ).status,
    403
  )
  assert.equal(await db.sql(ATTEMPT_COUNT), '0')
  const first = await handler(request())
  assert.equal(first.status, 200)
  assert.equal((await first.json()).summary.completed, 1)
  assert.equal((await ledger(db)).charged_tokens, 15)
  assert.equal((await (await handler(request())).json()).status, 'no_work')
  assert.equal(calls, 1)
})

test('dispatch permission is single-use and rechecks kill switch and lease', async () => {
  const p = await budgetFixture(db)
  await entryFixture(db)
  const run = await start(db, p.id)
  const job = run.jobs[0]
  assert.equal((await dispatch(db, job)).allowed, true)
  assert.equal((await dispatch(db, job)).allowed, false)
  await entryFixture(db)
  const next = (await start(db, p.id)).jobs[0]
  await db.sql(
    'UPDATE private.dictionary_cefr_worker_control SET enabled=FALSE'
  )
  assert.equal((await dispatch(db, next)).allowed, false)
  await db.sql(ENABLE_CONTROL)
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id='${next.job_id}'`
  )
  assert.equal((await dispatch(db, next)).allowed, false)
  assert.equal((await ledger(db)).requests, 2)
})

for (const [name, reply, expected] of [
  [
    '429',
    { kind: 'http_error', status: 429, retryAfterSeconds: 99999 },
    'retry_wait',
  ],
  ['503', { kind: 'http_error', status: 503 }, 'retry_wait'],
  ['401', { kind: 'http_error', status: 401 }, 'failed'],
  ['malformed', { kind: 'response', body: 'invalid json' }, 'needs_review'],
  ['transport', { kind: 'transport_error' }, 'retry_wait'],
  ['timeout', null, 'retry_wait'],
])
  test(`fake ${name} response retains conservative charge and persists ${expected}`, async () => {
    const p = await budgetFixture(db)
    await entryFixture(db)
    let calls = 0
    const secret = 'TEST_ONLY_' + 'b'.repeat(54)
    const handler = await createCefrWorkerHandler(
      {
        enabled: true,
        workerSecret: secret,
        policyId: p.id,
        profile: p.worker.inputs.profile,
        qualification: p.worker.qualified,
        timeoutMs: 200,
      },
      {
        store: storeFor(db),
        provider: () => {
          calls++
          return reply ?? new Promise(() => {})
        },
      }
    )
    const result = await handler(
      new Request('https://example.invalid/worker', {
        method: 'POST',
        headers: { 'x-cefr-worker-secret': secret },
      })
    )
    assert.equal(result.status, 200)
    assert.equal(calls, 1)
    assert.equal(
      await db.sql(
        `SELECT state FROM private.dictionary_cefr_jobs WHERE method_id='${p.method.id}'`
      ),
      expected
    )
    const day = await ledger(db)
    assert.equal(day.requests, 1)
    assert.equal(day.charged_tokens, 174)
    assert.equal(day.charged_cost_microusd, 432)
  })

test('a fresh UTC day has a fresh bucket while historical charges stay unchanged', async () => {
  const p = await budgetFixture(db, { requests: 1 })
  await db.sql(`INSERT INTO private.dictionary_cefr_daily_usage(utc_day,policy_id,requests,charged_tokens,charged_cost_microusd,total_reserved_tokens,total_reserved_cost_microusd)
    VALUES((clock_timestamp() AT TIME ZONE 'UTC')::DATE-1,'${p.id}',1,174,432,174,432)`)
  await entryFixture(db)
  assert.equal((await start(db, p.id)).jobs.length, 1)
  assert.equal(await db.sql(DAILY_COUNT), '2')
  assert.equal(
    await db.sql(
      "SELECT charged_tokens FROM private.dictionary_cefr_daily_usage WHERE utc_day=(clock_timestamp() AT TIME ZONE 'UTC')::DATE-1"
    ),
    '174'
  )
})

test('a dispatch waiting behind the control lock rechecks cancellation after commit', async () => {
  const p = await budgetFixture(db)
  await entryFixture(db)
  const job = (await start(db, p.id)).jobs[0]
  const held = await holdTransaction(
    db,
    'UPDATE private.dictionary_cefr_worker_control SET enabled=FALSE;'
  )
  let pending
  try {
    const name = `cefr-kill-${randomUUID()}`
    pending = call(
      db,
      `SET application_name='${name}'; SELECT public.authorize_dictionary_cefr_dispatch_v1('${job.reservation_id}','${job.lease_token}');`
    )
    await until(
      async () =>
        (await db.sql(
          `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
        )) === '1'
    )
    await held.finish()
    assert.equal((await pending).allowed, false)
    assert.equal(
      await db.sql(
        `SELECT (dispatch_started_at IS NULL)::TEXT FROM private.dictionary_cefr_attempt_usage WHERE reservation_id='${job.reservation_id}'`
      ),
      'true'
    )
  } finally {
    if (!held.session.child.stdin.writableEnded) {
      held.session.child.stdin.end('ROLLBACK;\n')
      await held.session.completed.catch(() => {})
    }
    await pending?.catch(() => {})
  }
})

test('configuration changes cannot publish an older policy response but still account verified usage', async () => {
  const old = await ready()
  await budgetFixture(db)
  assert.equal(
    (
      await finish(db, old.job, {
        outcome: 'estimated',
        level: 'A2',
        confidence: 0.9,
        usage: usage(),
      })
    ).status,
    'obsolete'
  )
  assert.equal((await ledger(db)).charged_tokens, 15)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${old.entry.entry}'`
    ),
    '0'
  )
})

test('a reserved output bound below the qualified generation limit cannot dispatch', async () => {
  const p = await budgetFixture(db, { maxOutput: 32 })
  await entryFixture(db)
  assert.equal((await start(db, p.id)).status, 'unqualified')
  assert.equal(await db.sql(ATTEMPT_COUNT), '0')
})

test('concurrent completion and reconciliation append once and refund once', async () => {
  const { job, entry } = await ready()
  const result = {
    outcome: 'estimated',
    level: 'A2',
    confidence: 0.9,
    usage: usage(),
  }
  const [first, second] = await Promise.all([
    finish(db, job, result),
    finish(db, job, result),
  ])
  assert.equal(first.status, 'completed')
  assert.deepEqual(second, first)
  assert.equal((await ledger(db)).charged_tokens, 15)
  assert.equal((await ledger(db)).charged_cost_microusd, 35)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
    ),
    '1'
  )
})
