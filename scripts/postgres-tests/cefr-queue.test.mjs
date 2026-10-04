import { evaluateCefrLeases } from '../../supabase/functions/_shared/cefr-worker/evaluate.ts'
import { syntheticWorker } from '../../supabase/functions/_shared/cefr-worker/synthetic-fixtures.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, beforeEach, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, owner, seedUsers, seedWord } from './fixtures.mjs'
import {
  asService,
  call,
  claim,
  enqueue,
  entryFixture,
  methodFixture,
  replaceRevision,
  reviewerSql,
  settle,
  settleSql,
  holdTransaction,
  until,
} from './cefr-queue-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  assert.equal(
    await db.sql('SELECT count(*) FROM private.dictionary_cefr_methods'),
    '0'
  )
  assert.equal(
    await db.sql('SELECT count(*) FROM private.dictionary_cefr_jobs'),
    '0'
  )
})
beforeEach(async () => {
  // Isolate selection without deleting immutable synthetic history.
  await db.sql(
    "UPDATE public.dictionary_entries SET state='retired' WHERE state='published'"
  )
})
after(async () => {
  await db?.close()
})

const ready = async options => {
  const method = await methodFixture(db, options)
  const entry = await entryFixture(db)
  await enqueue(db, method.id)
  const jobs = await claim(db, method.id)
  const job = jobs.find(item => item.entry_id === entry.entry)
  assert.ok(job)
  return { method, entry, job }
}

test('ordinary clients cannot see private jobs, mutate approvals or invoke queue RPCs', async () => {
  const method = await methodFixture(db, { enabled: false })
  for (const role of ['anon', 'authenticated']) {
    for (const sql of [
      'SELECT * FROM private.dictionary_cefr_jobs',
      'SELECT * FROM private.dictionary_cefr_methods',
      `SELECT public.enqueue_dictionary_cefr_jobs_v1('${method.id}')`,
      `SELECT public.claim_dictionary_cefr_jobs_v1('${method.id}')`,
      `SELECT public.settle_dictionary_cefr_job_v1('${randomUUID()}','${randomUUID()}',1,repeat('a',64),repeat('b',64),'unknown')`,
    ])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; ${sql}`),
        /permission denied/
      )
  }
  await assert.rejects(
    db.sql(
      asService(
        `UPDATE private.dictionary_cefr_methods SET enabled=true WHERE method_id='${method.id}'`
      )
    ),
    /permission denied/
  )
  assert.equal(await enqueue(db, method.id), 0)
  assert.deepEqual(await claim(db, method.id), [])
})

test('method approval is immutable and requires matching provider-specific provenance', async () => {
  const method = await methodFixture(db)
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_cefr_methods SET confidence_threshold=0 WHERE method_id='${method.id}'`
    ),
    /approval is immutable/
  )
  await db.sql(
    `UPDATE private.dictionary_sources SET source_kind='editorial' WHERE source_id='${method.source}'`
  )
  assert.equal(await enqueue(db, method.id), 0)
  await db.sql(
    `UPDATE private.dictionary_sources SET source_kind='provider',approved_content_sha256=repeat('e',64) WHERE source_id='${method.source}'`
  )
  assert.deepEqual(await claim(db, method.id), [])
})

test('selection excludes drafts, retired entries, corrupt inputs, reviewed heads and private cards', async () => {
  const method = await methodFixture(db)
  const eligible = await entryFixture(db)
  const excluded = []
  for (const options of [
    { state: 'draft' },
    { state: 'retired' },
    { badHash: true },
  ])
    excluded.push(await entryFixture(db, options))
  const reviewed = await entryFixture(db)
  await db.sql(reviewerSql(reviewed))
  excluded.push(reviewed)
  const word = await seedWord(db)
  const before = await db.sql(
    `SELECT to_jsonb(w) FROM public.words w WHERE word_id='${word}'`
  )
  const first = await enqueue(db, method.id)
  assert.ok(first >= 1)
  assert.equal(await enqueue(db, method.id), 0)
  const selected = JSON.parse(
    await db.sql(
      `SELECT coalesce(jsonb_agg(entry_id),'[]') FROM private.dictionary_cefr_jobs WHERE method_id='${method.id}'`
    )
  )
  assert.ok(selected.includes(eligible.entry))
  for (const item of excluded) assert.ok(!selected.includes(item.entry))
  assert.equal(
    await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id='${word}'`
    ),
    before
  )
})

test('completion atomically appends one model estimate and retries return the same assessment', async () => {
  const { method, entry, job } = await ready({ concurrency: 8 })
  const result = await settle(db, job)
  assert.equal(result.status, 'completed')
  assert.deepEqual(await settle(db, job), result)
  const assessment = JSON.parse(
    await db.sql(
      `SELECT to_jsonb(a) FROM public.dictionary_cefr_assessments a WHERE assessment_id='${result.assessment_id}'`
    )
  )
  assert.equal(assessment.status, 'estimated')
  assert.equal(assessment.source_id, method.source)
  assert.equal(assessment.locked, false)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
    ),
    '1'
  )
  await assert.rejects(
    settle(db, job, 'estimated', { level: 'C2' }),
    /payload changed/
  )
})

test('changed input and changed assessment head obsolete captured work', async () => {
  const first = await ready({ concurrency: 8 })
  await replaceRevision(db, first.entry)
  assert.equal((await settle(db, first.job)).status, 'obsolete')
  const second = await ready({ concurrency: 8 })
  await db.sql(reviewerSql(second.entry))
  assert.equal((await settle(db, second.job)).status, 'obsolete')
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${second.entry.entry}' AND status='estimated'`
    ),
    '0'
  )
})

test('a media-only revision keeps the same linguistic assessment applicable', async () => {
  const { entry, job } = await ready({ concurrency: 8 })
  await replaceRevision(db, entry, { mediaOnly: true })
  assert.equal((await settle(db, job)).status, 'completed')
})

test('expired/replaced leases and mismatched qualification cannot write', async () => {
  const { method, job } = await ready({ concurrency: 8 })
  assert.equal(
    (await settle(db, { ...job, qualification_sha256: 'a'.repeat(64) })).status,
    'stale'
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id='${job.job_id}'`
  )
  assert.equal((await settle(db, job)).status, 'stale')
  const replacement = (await claim(db, method.id)).find(
    item => item.job_id === job.job_id
  )
  assert.ok(replacement)
  assert.equal(replacement.attempt, job.attempt + 1)
  assert.notEqual(replacement.lease_token, job.lease_token)
  assert.equal((await settle(db, job)).status, 'stale')
  assert.equal((await settle(db, replacement)).status, 'completed')
})

test('retry-after is bounded, retries consume attempts, unknown output needs review', async () => {
  const { method, job } = await ready({ concurrency: 8, attempts: 2 })
  assert.equal(
    (
      await settle(db, job, 'retry', {
        level: null,
        confidence: null,
        retry: 99999,
      })
    ).status,
    'retry_wait'
  )
  assert.equal(
    await db.sql(
      `SELECT (next_attempt_at <= clock_timestamp()+interval '1 hour')::text FROM private.dictionary_cefr_jobs WHERE job_id='${job.job_id}'`
    ),
    'true'
  )
  assert.ok(
    !(await claim(db, method.id)).some(item => item.job_id === job.job_id)
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE job_id='${job.job_id}'`
  )
  const replacement = (await claim(db, method.id)).find(
    item => item.job_id === job.job_id
  )
  assert.equal((await settle(db, replacement, 'retry')).status, 'failed')
  const unknown = await ready({ concurrency: 8 })
  assert.equal(
    (
      await settle(db, unknown.job, 'unknown', {
        level: null,
        confidence: null,
      })
    ).status,
    'needs_review'
  )
})

test('low confidence and disabled profiles cannot create assessments', async () => {
  const { method, job } = await ready({ concurrency: 8 })
  await assert.rejects(
    settle(db, job, 'estimated', { confidence: 0.5 }),
    /Invalid or unqualified/
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_methods SET enabled=false WHERE method_id='${method.id}'`
  )
  assert.equal((await settle(db, job)).status, 'obsolete')
})

test('overlapping claims never exceed configured capacity or duplicate a lease', async () => {
  const method = await methodFixture(db, { concurrency: 1 })
  await entryFixture(db)
  await enqueue(db, method.id)
  const held = await holdTransaction(
    db,
    asService(`SELECT public.claim_dictionary_cefr_jobs_v1('${method.id}');`)
  )
  let pending
  try {
    const name = `cefr-claim-${randomUUID()}`
    pending = call(
      db,
      `SET application_name='${name}'; SELECT public.claim_dictionary_cefr_jobs_v1('${method.id}');`
    )
    await until(
      async () =>
        (await db.sql(
          `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
        )) === '1'
    )
    await held.finish()
    assert.deepEqual(await pending, [])
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM private.dictionary_cefr_jobs WHERE method_id='${method.id}' AND state='leased'`
      ),
      '1'
    )
  } finally {
    if (!held.session.child.stdin.writableEnded) {
      held.session.child.stdin.end('ROLLBACK;\n')
      await held.session.completed.catch(() => {})
    }
    await pending?.catch(() => {})
  }
})

test('a concurrent reviewer wins without an orphan worker assessment', async () => {
  const { entry, job } = await ready({ concurrency: 8 })
  const held = await holdTransaction(db, reviewerSql(entry))
  let pending
  try {
    const name = `cefr-review-${randomUUID()}`
    pending = call(db, `SET application_name='${name}'; ${settleSql(job)}`)
    await until(
      async () =>
        (await db.sql(
          `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
        )) === '1'
    )
    await held.finish()
    assert.equal((await pending).status, 'obsolete')
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}' AND status='estimated'`
      ),
      '0'
    )
    assert.equal(
      await db.sql(
        asUser(
          owner,
          `SELECT cefr_level FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
        )
      ),
      'B2'
    )
  } finally {
    if (!held.session.child.stdin.writableEnded) {
      held.session.child.stdin.end('ROLLBACK;\n')
      await held.session.completed.catch(() => {})
    }
    await pending?.catch(() => {})
  }
})

test('unknown assessment can be superseded without changing its immutable history', async () => {
  const method = await methodFixture(db)
  const entry = await entryFixture(db)
  const previous = randomUUID()
  await db.sql(reviewerSql(entry, previous, 'unknown'))
  assert.equal(await enqueue(db, method.id), 1)
  const [job] = await claim(db, method.id)
  assert.equal(job.expected_assessment_id, previous)
  const result = await settle(db, job)
  assert.equal(result.status, 'completed')
  assert.equal(
    await db.sql(
      `SELECT supersedes_assessment_id FROM public.dictionary_cefr_assessments WHERE assessment_id='${result.assessment_id}'`
    ),
    previous
  )
  assert.equal(
    await db.sql(
      `SELECT status FROM public.dictionary_cefr_assessments WHERE assessment_id='${previous}'`
    ),
    'unknown'
  )
})

test('retirement, provider revocation and last-attempt expiry prevent completion', async () => {
  const retired = await ready()
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${retired.entry.entry}'`
  )
  assert.equal((await settle(db, retired.job)).status, 'obsolete')
  const revoked = await ready()
  await db.sql(
    `UPDATE private.dictionary_cefr_methods SET revoked_at=now() WHERE method_id='${revoked.method.id}'`
  )
  assert.equal((await settle(db, revoked.job)).status, 'obsolete')
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_cefr_methods SET revoked_at=NULL WHERE method_id='${revoked.method.id}'`
    ),
    /approval is immutable/
  )
  const expired = await ready({ concurrency: 8, attempts: 1 })
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_id='${expired.job.job_id}'`
  )
  assert.ok(
    !(await claim(db, expired.method.id)).some(
      j => j.job_id === expired.job.job_id
    )
  )
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_cefr_jobs WHERE job_id='${expired.job.job_id}'`
    ),
    'failed'
  )
})

test('concurrent duplicate completions append exactly one assessment', async () => {
  const { job, entry } = await ready()
  const [first, second] = await Promise.all([settle(db, job), settle(db, job)])
  assert.equal(first.status, 'completed')
  assert.deepEqual(first, second)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
    ),
    '1'
  )
})

for (const lock of ['head', 'cursor'])
  test(`a lease expiring while completion waits for ${lock} cannot write`, async () => {
    const { entry, job } = await ready()
    await db.sql(
      `UPDATE private.dictionary_cefr_jobs SET lease_expires_at=clock_timestamp()+interval '2 seconds' WHERE job_id='${job.job_id}'`
    )
    const held = await holdTransaction(
      db,
      lock === 'head'
        ? `SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id='${entry.entry}' FOR UPDATE;`
        : 'SELECT 1 FROM private.dictionary_delivery_cursor FOR UPDATE;'
    )
    let pending
    try {
      const name = `cefr-expiry-${randomUUID()}`
      pending = call(db, `SET application_name='${name}'; ${settleSql(job)}`)
      await until(
        async () =>
          (await db.sql(
            `SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock'`
          )) === '1'
      )
      await until(
        async () =>
          (await db.sql(
            `SELECT (lease_expires_at < clock_timestamp())::text FROM private.dictionary_cefr_jobs WHERE job_id='${job.job_id}'`
          )) === 'true'
      )
      await held.finish()
      assert.equal((await pending).status, 'stale')
      assert.equal(
        await db.sql(
          `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}'`
        ),
        '0'
      )
    } finally {
      if (!held.session.child.stdin.writableEnded) {
        held.session.child.stdin.end('ROLLBACK;\n')
        await held.session.completed.catch(() => {})
      }
      await pending?.catch(() => {})
    }
  })

test('fake provider integrates qualified selection, bounded retries and fenced completion', async () => {
  const worker = await syntheticWorker()
  const { method, job, entry } = await ready({ worker })
  let calls = 0
  const options = {
    enabled: true,
    qualification: worker.qualified,
    timeoutMs: 100,
    provider: request => {
      calls++
      if (calls === 1)
        return { kind: 'http_error', status: 429, retryAfterSeconds: 2 }
      return {
        kind: 'response',
        body: JSON.stringify({
          job_id: request.job_id,
          input_sha256: request.input_sha256,
          profile_sha256: request.profile_sha256,
          ambiguous: false,
          candidate: { level: 'A2', confidence: 0.9 },
        }),
      }
    },
  }
  const [retry] = await evaluateCefrLeases([job], options)
  assert.equal(retry.outcome, 'retry')
  assert.equal(
    (
      await settle(db, job, retry.outcome, {
        level: null,
        confidence: null,
        retry: retry.retryAfterSeconds,
      })
    ).status,
    'retry_wait'
  )
  await db.sql(
    `UPDATE private.dictionary_cefr_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE job_id='${job.job_id}'`
  )
  const leases = await claim(db, method.id)
  const [result] = await evaluateCefrLeases(leases, options)
  assert.equal(result.outcome, 'estimated')
  assert.equal(
    (await settle(db, leases[0], result.outcome, result)).status,
    'completed'
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.dictionary_cefr_assessments WHERE entry_id='${entry.entry}' AND status='estimated' AND NOT locked`
    ),
    '1'
  )
  assert.equal(await enqueue(db, method.id), 0)
  assert.deepEqual(
    await evaluateCefrLeases(await claim(db, method.id), options),
    []
  )
  assert.equal(calls, 2)
})

test('missing mandatory method profile fields fail closed instead of passing a nullable CHECK', async () => {
  for (const field of [
    'namespace',
    'input_schema_version',
    'generation_config',
  ]) {
    const worker = await syntheticWorker()
    delete worker.inputs.profile[field]
    await assert.rejects(methodFixture(db, { worker }), /check constraint/)
  }
})
