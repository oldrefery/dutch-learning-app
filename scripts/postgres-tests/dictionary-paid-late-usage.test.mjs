import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers, literal, asUser } from './fixtures.mjs'
import {
  GENERATOR,
  JUDGE,
  PAID_POLICY,
  paidRelease,
  paidState,
  grantPair,
  claimPaid,
  usage,
} from './dictionary-paid.fixture.mjs'
import { content, judge } from './dictionary-creation-publication.fixture.mjs'
import { json, service } from './dictionary-creation-dispatch.fixture.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
const absent = Symbol('absent')
const packet = (model, value) => ({
  content: content(),
  provider_response: {
    modelVersion: model,
    ...(value === absent ? {} : { usageMetadata: value }),
  },
})
const ledger = release =>
  json(
    db,
    `SELECT JSONB_AGG(TO_JSONB(a) ORDER BY phase) FROM private.dictionary_paid_attempts a WHERE release_id='${release}';`
  )

async function journalPhase(f, phase, result, requestId) {
  const raw = literal(JSON.stringify(result)),
    id = literal(requestId)
  if (f.workflow === 'analysis') {
    const rpc =
      phase === 'generation'
        ? 'journal_dictionary_analysis_result_v1'
        : 'journal_dictionary_semantic_result_v1'
    return json(
      db,
      service(
        `SELECT public.${rpc}('${owner}','${f.operation}','1',${raw}::JSONB,${id});`
      )
    )
  }
  const table =
    phase === 'generation'
      ? 'dictionary_creation_generation_attempts'
      : 'dictionary_creation_judge_attempts'
  const rpc =
    phase === 'generation'
      ? 'record_dictionary_creation_result_v1'
      : 'record_dictionary_creation_judgement_v1'
  const hash = await db.sql(
    `SELECT input_sha256 FROM private.${table} WHERE run_id='${f.run}';`
  )
  return json(
    db,
    service(
      `SELECT public.${rpc}('${f.run}','1','${hash}',${raw}::JSONB,${id});`
    )
  )
}
async function prepared(workflow, phase) {
  const release = await paidRelease(db),
    f = { ...(await grantPair(db, { workflow })), workflow }
  await claimPaid(db, f)
  if (phase === 'judgement') {
    const result = packet(GENERATOR, usage())
    await journalPhase(f, 'generation', result, randomUUID())
    if (workflow === 'analysis') {
      const hash = await db.sql(
        `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(result.content))}::JSONB);`
      )
      assert.equal(
        (
          await json(
            db,
            service(
              `SELECT public.start_dictionary_semantic_check_v1('${owner}','${f.operation}','1','paid-ledger-fixture','${PAID_POLICY}','${JUDGE}','${'c'.repeat(64)}','${hash}','${'a'.repeat(64)}');`
            )
          )
        ).dispatch,
        true
      )
    } else assert.ok((await judge(db, f)).dispatch)
    const key =
      workflow === 'analysis' ? 'semantic:' + f.key : `${f.run}:judgement:1`
    assert.equal((await claimPaid(db, f, { key, model: JUDGE })).allowed, true)
  }
  return { release, f }
}
async function retainedResult(f, phase) {
  if (f.workflow === 'analysis') {
    const table =
      phase === 'generation'
        ? 'dictionary_analysis_results'
        : 'dictionary_semantic_checks'
    return json(
      db,
      `SELECT result FROM private.${table} WHERE actor_id='${owner}' AND operation_id='${f.operation}';`
    )
  }
  const table =
    phase === 'generation'
      ? 'dictionary_creation_generation_attempts'
      : 'dictionary_creation_judge_attempts'
  return json(
    db,
    `SELECT result FROM private.${table} WHERE run_id='${f.run}';`
  )
}
const readAttempt = id =>
  json(
    db,
    `SELECT TO_JSONB(a) FROM private.dictionary_paid_attempts a WHERE attempt_id='${id}';`
  )
async function quarantine(f, phase) {
  if (f.workflow === 'analysis') {
    const rpc =
      phase === 'generation'
        ? 'record_dictionary_analysis_failure_v1'
        : 'record_dictionary_semantic_failure_v1'
    await db.sql(
      service(
        `SELECT public.${rpc}('${owner}','${f.operation}','1','provider-outcome-unknown',NULL);`
      )
    )
  } else {
    const table =
      phase === 'generation'
        ? 'dictionary_creation_generation_attempts'
        : 'dictionary_creation_judge_attempts'
    const rpc =
      phase === 'generation'
        ? 'record_dictionary_creation_failure_v1'
        : 'fail_dictionary_creation_judgement_v1'
    const hash = await db.sql(
      `SELECT input_sha256 FROM private.${table} WHERE run_id='${f.run}';`
    )
    await db.sql(
      service(
        `SELECT public.${rpc}('${f.run}','1','${hash}',FALSE,'${'a'.repeat(64)}');`
      )
    )
  }
}
for (const workflow of ['analysis', 'creation'])
  for (const phase of ['generation', 'judgement']) {
    for (const [shape, value] of [
      ['array', []],
      ['invalid-object', {}],
      ['valid', usage()],
      ['absent', absent],
    ]) {
      test(`${workflow} ${phase}: late ${shape} usage applies stop without rewriting quarantine`, async () => {
        const { release, f } = await prepared(workflow, phase),
          pending = await grantPair(db)
        await quarantine(f, phase)
        const before = await ledger(release),
          budget = await paidState(db, release)
        const model = phase === 'generation' ? GENERATOR : JUDGE,
          result = packet(model, value),
          id = randomUUID()
        const receipt = await journalPhase(f, phase, result, id)
        const invalid = shape === 'array' || shape === 'invalid-object'
        assert.deepEqual(await ledger(release), before)
        assert.deepEqual(await paidState(db, release), {
          ...budget,
          enabled: !invalid,
        })
        assert.deepEqual(await retainedResult(f, phase), result)
        assert.deepEqual(await journalPhase(f, phase, result, id), receipt)
        assert.deepEqual(await ledger(release), before)
        if (invalid) {
          await assert.rejects(
            claimPaid(db, pending),
            /paid-dispatch-unavailable/
          )
          await assert.rejects(grantPair(db), /shared-analysis-disabled/)
        } else assert.equal((await claimPaid(db, pending)).allowed, true)
      })
    }
  }
async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return
    await setTimeout(25)
  }
  throw new Error('Expected lock wait or marker')
}
async function analysisJournalSQL(f, result, id = randomUUID()) {
  return `SELECT public.journal_dictionary_analysis_result_v1('${owner}','${f.operation}','1',${literal(JSON.stringify(result))}::JSONB,'${id}');`
}
test('a committed late malformed freeze rejects a concurrently blocked claim', async () => {
  const { release, f } = await prepared('analysis', 'generation'),
    pending = await grantPair(db)
  await quarantine(f, 'generation')
  const before = await ledger(release),
    tx = db.connect()
  let claim
  try {
    tx.child.stdin.write(
      `BEGIN; ${service(await analysisJournalSQL(f, packet(GENERATOR, [])))} SELECT 'FROZEN';\n`
    )
    await waitFor(() => tx.output().includes('FROZEN'))
    claim = claimPaid(
      { sql: s => db.sql("SET application_name='r5_late_waiting_claim';" + s) },
      pending
    )
    void claim.catch(() => {})
    await waitFor(
      async () =>
        (await db.sql(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='r5_late_waiting_claim' AND wait_event_type='Lock');"
        )) === 't'
    )
    tx.child.stdin.end('COMMIT;\n')
    await tx.completed
    await assert.rejects(claim, /paid-dispatch-unavailable/)
    assert.deepEqual(await ledger(release), before)
    assert.equal((await paidState(db, release)).enabled, false)
  } finally {
    if (!tx.child.stdin.writableEnded) tx.child.stdin.end('ROLLBACK;\n')
    await tx.completed.catch(() => {})
    if (claim) await claim.catch(() => {})
  }
})
test('rolling back a late malformed journal restores release and raw result atomically', async () => {
  const { release, f } = await prepared('analysis', 'generation')
  await quarantine(f, 'generation')
  const before = await ledger(release),
    budget = await paidState(db, release)
  await db.sql(
    `BEGIN; ${service(await analysisJournalSQL(f, packet(GENERATOR, [])))} ROLLBACK;`
  )
  assert.deepEqual(await ledger(release), before)
  assert.deepEqual(await paidState(db, release), budget)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_analysis_results WHERE operation_id='${f.operation}';`
    ),
    '0'
  )
})
test('reconciliation rejects malformed review then settles valid usage once without re-enabling', async () => {
  const { release, f } = await prepared('analysis', 'generation')
  const attempt = (await ledger(release)).find(x => x.phase === 'generation')
  await journalPhase(f, 'generation', packet(GENERATOR, []), randomUUID())
  await db.sql(
    `INSERT INTO private.dictionary_administrators(user_id,enabled,audit_reference) VALUES('${other}',TRUE,'fixture://r5-reviewer') ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`
  )
  const before = await readAttempt(attempt.attempt_id)
  const reconcile = value =>
    asUser(
      other,
      `SELECT public.reconcile_dictionary_paid_attempt_v1('${attempt.attempt_id}','${'e'.repeat(64)}',${literal(JSON.stringify(value))}::JSONB,'${'f'.repeat(64)}');`
    )
  await assert.rejects(db.sql(reconcile([])), /invalid-paid-review-usage/)
  assert.deepEqual(await readAttempt(attempt.attempt_id), before)
  assert.deepEqual(await json(db, reconcile(usage())), { state: 'settled' })
  assert.deepEqual(await json(db, reconcile(usage())), { state: 'settled' })
  assert.deepEqual(await paidState(db, release), {
    held: '8292',
    settled: '25',
    calls: 1,
    enabled: false,
  })
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_paid_reconciliations WHERE attempt_id='${attempt.attempt_id}';`
    ),
    '1'
  )
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(
      await db.sql(
        `SELECT has_function_privilege('${role}','private.dictionary_paid_usage_cost(jsonb,jsonb,bigint)','EXECUTE');`
      ),
      'f'
    )
})
