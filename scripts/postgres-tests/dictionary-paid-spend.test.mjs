import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers, literal, asUser } from './fixtures.mjs'
import {
  paidRelease,
  paidState,
  grantPair,
  reservePair,
  finishPaidAnalysis,
  claimPaid,
  usage,
  settlePaid,
  modelLimits,
} from './dictionary-paid.fixture.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('installation is empty/default-off and existing user entitlements are not granted', async () => {
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_paid_releases;'),
    '0'
  )
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_paid_cohort;'),
    '0'
  )
  await assert.rejects(grantPair(db), /analysis-permission-required/)
})
test('a complete generation/judge pair reserves once and claim never reissues a fetch permission', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db)
  assert.deepEqual(await paidState(db, release), {
    held: '16584',
    settled: '0',
    calls: 1,
    enabled: true,
  })
  const first = await claimPaid(db, f)
  assert.equal(first.allowed, true)
  assert.deepEqual(await claimPaid(db, f), { allowed: false })
  assert.equal((await paidState(db, release)).calls, 1)
  await assert.rejects(
    claimPaid(db, f, { hash: 'f'.repeat(64) }),
    /paid-attempt-conflict/
  )
  assert.deepEqual(await settlePaid(db, first.attempt_id, usage()), {
    state: 'settled',
  })
  assert.deepEqual(await settlePaid(db, first.attempt_id, usage()), {
    state: 'settled',
  })
  assert.deepEqual(await paidState(db, release), {
    held: '8292',
    settled: '25',
    calls: 1,
    enabled: true,
  })
  await assert.rejects(
    settlePaid(
      db,
      first.attempt_id,
      usage(undefined, { promptTokenCount: 21, totalTokenCount: 31 })
    ),
    /paid-settlement-conflict/
  )
})
test('parallel actors share the last funds and an aborted reservation cannot spend twice', async () => {
  const release = await paidRelease(db, {
    limit: '16584',
    actors: [owner, other],
  })
  const outcomes = await Promise.allSettled([
    grantPair(db),
    grantPair(db, { actor: other, workflow: 'creation' }),
  ])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
  assert.match(
    outcomes.find(x => x.status === 'rejected').reason.message,
    /rate-limit-exceeded/
  )
  assert.equal((await paidState(db, release)).held, '16584')
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_paid_attempts WHERE release_id='${release}';`
    ),
    '2'
  )
})
test('unknown response retains the whole phase and cannot be claimed or automatically refunded', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    claim = await claimPaid(db, f)
  assert.deepEqual(await settlePaid(db, claim.attempt_id, null), {
    state: 'unknown',
  })
  assert.equal((await paidState(db, release)).held, '16584')
  assert.deepEqual(await claimPaid(db, f), { allowed: false })
  await assert.rejects(
    db.sql(
      `SET ROLE service_role; SELECT public.close_dictionary_paid_unissued_v1('${claim.attempt_id}','${'e'.repeat(64)}');`
    ),
    /paid-attempt-not-unissued/
  )
})
test('invalid/over-bound usage freezes new dispatch without pretending the bill was undone', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    claim = await claimPaid(db, f)
  assert.deepEqual(
    await settlePaid(
      db,
      claim.attempt_id,
      usage(undefined, { promptTokenCount: 101, totalTokenCount: 111 })
    ),
    { state: 'unknown' }
  )
  assert.deepEqual(await paidState(db, release), {
    held: '16584',
    settled: '0',
    calls: 1,
    enabled: false,
  })
  await assert.rejects(grantPair(db), /shared-analysis-disabled/)
})
test('expiry and disabled binding reject calls; closing an unissued slice is permanent and idempotent', async () => {
  await paidRelease(db, {
    until: '2026-01-01T00:00:00Z',
    from: '2025-12-01T00:00:00Z',
  })
  await assert.rejects(grantPair(db), /shared-analysis-disabled/)
  const release = await paidRelease(db),
    f = await grantPair(db)
  const judge = await db.sql(
    `SELECT attempt_id FROM private.dictionary_paid_attempts WHERE release_id='${release}' AND phase='judgement';`
  )
  await finishPaidAnalysis(db, f)
  await db.sql(
    `SET ROLE service_role; SELECT public.close_dictionary_paid_unissued_v1('${judge}','${'e'.repeat(64)}');`
  )
  await db.sql(
    `SET ROLE service_role; SELECT public.close_dictionary_paid_unissued_v1('${judge}','${'e'.repeat(64)}');`
  )
  assert.equal((await paidState(db, release)).held, '8292')
  assert.deepEqual(
    await claimPaid(db, f, {
      key: 'semantic:' + f.key,
      model: 'gemini-judge-fixture',
    }),
    { allowed: false }
  )
})
test('checked monetary arithmetic rejects an overflowing profile before an envelope exists', async () => {
  const limits = modelLimits('gemini-generator-fixture', {
    input_nanousd_per_token: '9223372036854775807',
  })
  await assert.rejects(
    db.sql(
      `SELECT private.dictionary_paid_model_ceiling(${literal(JSON.stringify(limits))}::JSONB);`
    ),
    /paid-money-overflow/
  )
})
test('rolled-back grant holds no funds and month cutoff cannot silently renew', async () => {
  const release = await paidRelease(db)
  await reservePair({ sql: sql => db.sql('BEGIN;' + sql + 'ROLLBACK;') })
  assert.equal((await paidState(db, release)).held, '0')
  assert.equal(
    await db.sql(
      "SELECT '2026-11-01 00:00 Europe/Amsterdam'::TIMESTAMPTZ='2026-10-31 23:00+00'::TIMESTAMPTZ;"
    ),
    't'
  )
})
test('budget row locking rechecks revocation after a concurrent writer commits', async () => {
  const release = await paidRelease(db),
    connection = db.connect()
  let pending
  try {
    connection.child.stdin.write(
      `BEGIN; SELECT release_id FROM private.dictionary_paid_releases WHERE release_id='${release}' FOR UPDATE; SELECT 'LOCKED';\n`
    )
    for (let i = 0; i < 100 && !connection.output().includes('LOCKED'); i++)
      await setTimeout(20)
    assert.ok(connection.output().includes('LOCKED'))
    pending = grantPair(db)
    const observed = Promise.allSettled([pending])
    connection.child.stdin.end(
      `UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id='${release}'; COMMIT;\n`
    )
    await connection.completed
    const [result] = await observed
    assert.equal(result.status, 'rejected')
    assert.match(result.reason.message, /shared-analysis-disabled/)
    assert.equal((await paidState(db, release)).held, '0')
  } finally {
    if (!connection.child.stdin.writableEnded)
      connection.child.stdin.end('ROLLBACK;')
    await connection.completed.catch(() => {})
    if (pending) await pending.catch(() => {})
  }
})
test('reviewed unknown settlement requires a separate administrator and preserves its immutable evidence', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    claim = await claimPaid(db, f)
  await settlePaid(db, claim.attempt_id, null)
  const reviewer = randomUUID(),
    review = 'f'.repeat(64),
    evidence = 'e'.repeat(64),
    body = literal(JSON.stringify(usage())) + '::JSONB'
  const rpc = `SELECT public.reconcile_dictionary_paid_attempt_v1('${claim.attempt_id}','${evidence}',${body},'${review}');`
  await assert.rejects(db.sql(asUser(owner, rpc)), /administrator-required/)
  await db.sql(`INSERT INTO auth.users(id,email) VALUES('${reviewer}','paid-reviewer@example.invalid');
    INSERT INTO private.dictionary_administrators(user_id,enabled,audit_reference) VALUES('${reviewer}',TRUE,'fixture://paid-reviewer');`)
  assert.deepEqual(JSON.parse(await db.sql(asUser(reviewer, rpc))), {
    state: 'settled',
  })
  assert.deepEqual(JSON.parse(await db.sql(asUser(reviewer, rpc))), {
    state: 'settled',
  })
  assert.equal((await paidState(db, release)).settled, '25')
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_paid_reconciliations WHERE attempt_id='${claim.attempt_id}';`
    ),
    '1'
  )
  await assert.rejects(
    db.sql('DELETE FROM private.dictionary_paid_reconciliations;'),
    /immutable-paid-review/
  )
  await db.sql(`DELETE FROM auth.users WHERE id='${reviewer}';`)
  assert.equal(
    await db.sql(
      `SELECT reviewer_id IS NULL FROM private.dictionary_paid_reconciliations WHERE attempt_id='${claim.attempt_id}';`
    ),
    't'
  )
  assert.equal((await paidState(db, release)).calls, 1)
})
test('an isolated ledger reservation for a new fence retains the earlier unknown liability', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    claim = await claimPaid(db, f)
  await settlePaid(db, claim.attempt_id, null)
  await reservePair(db, { entry: f.entry, fence: '2' })
  assert.equal((await paidState(db, release)).held, '33168')
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_paid_attempts WHERE attempt_id='${claim.attempt_id}';`
    ),
    'unknown'
  )
})
test('Auth deletion redacts the actor but never deletes or releases an issued liability', async () => {
  const release = await paidRelease(db, { actors: [other] }),
    f = await grantPair(db, { actor: other })
  await claimPaid(db, f)
  const before = await paidState(db, release)
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  assert.deepEqual(await paidState(db, release), before)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_paid_attempts WHERE release_id='${release}' AND actor_id IS NULL;`
    ),
    '2'
  )
})
