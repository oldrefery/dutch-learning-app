import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID } from 'node:crypto'
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
  reservePair,
  claimPaid,
  usage,
  preparePaidAnalysis,
  acceptPaidAnalysis,
  dispatchPaidAnalysis,
  finishPaidAnalysis,
} from './dictionary-paid.fixture.mjs'
import {
  configure,
  content,
  judge,
  verdict,
} from './dictionary-creation-publication.fixture.mjs'
import {
  ready,
  start,
  journal,
  fail,
  json,
  service,
} from './dictionary-creation-dispatch.fixture.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
const unavailable = /paid-dispatch-unavailable/
const notTerminal = /paid-business-not-terminal/
const evidence = 'e'.repeat(64)
const budgetWaitSleep = 'SELECT pg_sleep(3.1);'
const providerResult = () => ({
  content: content(),
  provider_response: {
    modelVersion: GENERATOR,
    usageMetadata: { ...usage(), modelVersion: undefined },
  },
})
const closeAttempt = (attempt, hash = evidence) =>
  db.sql(
    service(
      `SELECT public.close_dictionary_paid_unissued_v1('${attempt}','${hash}');`
    )
  )
const phaseId = (release, phase) =>
  db.sql(
    `SELECT attempt_id FROM private.dictionary_paid_attempts WHERE release_id='${release}' AND phase=${literal(phase)};`
  )
const named = name => ({
  sql: text => db.sql(`SET application_name=${literal(name)};` + text),
})
async function waitFor(check, message) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return
    await setTimeout(25)
  }
  throw new Error(message)
}
const waiting = name =>
  waitFor(
    async () =>
      (await db.sql(
        `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${literal(name)} AND wait_event_type='Lock');`
      )) === 't',
    `Expected lock wait: ${name}`
  )
async function withBudgetLock(release, action, duringWait) {
  const lock = db.connect()
  let pending
  try {
    lock.child.stdin.write(
      `BEGIN; SELECT release_id FROM private.dictionary_paid_releases WHERE release_id='${release}' FOR UPDATE; SELECT 'LOCKED';\n`
    )
    await waitFor(() => lock.output().includes('LOCKED'), 'Budget lock missing')
    pending = action(named('paid_lifecycle_budget'))
    void pending.catch(() => {})
    await waiting('paid_lifecycle_budget')
    await duringWait(lock)
    lock.child.stdin.end('COMMIT;\n')
    await lock.completed
    return await pending
  } finally {
    if (!lock.child.stdin.writableEnded) lock.child.stdin.end('ROLLBACK;\n')
    await lock.completed.catch(() => {})
    if (pending) await pending.catch(() => {})
  }
}
async function creationGeneration(options = {}) {
  await configure(db)
  const release = await paidRelease(db, options)
  const f = await ready(db)
  const dispatch = (await start(db, f)).dispatch
  assert.ok(dispatch)
  return { release, f, dispatch, key: `${f.run}:generation:1` }
}
async function creationJudgement() {
  const x = await creationGeneration()
  await claimPaid(db, { actor: owner, key: x.key })
  await journal(
    db,
    x.f,
    x.dispatch,
    providerResult(),
    'lifecycle-gen:' + randomUUID()
  )
  const judgement = (await judge(db, x.f)).dispatch
  assert.ok(judgement)
  return { ...x, judgement, judgeKey: `${x.f.run}:judgement:1` }
}
async function creationPublication() {
  const x = await creationJudgement()
  await claimPaid(db, { actor: owner, key: x.judgeKey }, { model: JUDGE })
  const raw = verdict(x.judgement)
  raw.provider_response = {
    modelVersion: JUDGE,
    usageMetadata: { ...usage(), modelVersion: undefined },
  }
  await json(
    db,
    service(
      `SELECT public.record_dictionary_creation_judgement_v1('${x.f.run}','1',${literal(x.judgement.input_sha256)},${literal(JSON.stringify(raw))}::JSONB,${literal('lifecycle-judge:' + randomUUID())});`
    )
  )
  const valid = await json(
    db,
    service(`SELECT public.validate_dictionary_creation_v1('${x.f.run}','1');`)
  )
  assert.equal(valid.outcome, 'accepted')
  return {
    ...x,
    valid,
    publishSql: `SELECT public.publish_dictionary_creation_v1('${x.f.run}','1','${valid.validation_id}');`,
  }
}

test('R1: cohort expiration during a budget wait denies the claim and preserves liability', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db)
  await db.sql(
    `UPDATE private.dictionary_paid_cohort SET expires_at=CLOCK_TIMESTAMP()+INTERVAL '3 seconds' WHERE release_id='${release}';`
  )
  const before = await paidState(db, release)
  await assert.rejects(
    withBudgetLock(
      release,
      client => claimPaid(client, f),
      async () => {
        await db.sql(budgetWaitSleep)
      }
    ),
    /analysis-permission-required/
  )
  assert.deepEqual(await paidState(db, release), before)
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_paid_attempts WHERE release_id='${release}' AND phase='generation';`
    ),
    'granted'
  )
})
test('R1: phase deadline is rechecked after the budget wait even while cohort remains active', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db)
  await db.sql(
    `UPDATE private.dictionary_analysis_leases SET expires_at=CLOCK_TIMESTAMP()+INTERVAL '3 seconds' WHERE entry_id='${f.entry}';`
  )
  await assert.rejects(
    withBudgetLock(
      release,
      client => claimPaid(client, f),
      async () => {
        await db.sql(budgetWaitSleep)
      }
    ),
    unavailable
  )
  assert.equal((await paidState(db, release)).held, '16584')
})
test('R1: expiry during the durable business grant rolls back both reservation and call count', async () => {
  const release = await paidRelease(db),
    f = await preparePaidAnalysis(db)
  await acceptPaidAnalysis(db, f)
  await db.sql(
    `UPDATE private.dictionary_paid_cohort SET expires_at=CLOCK_TIMESTAMP()+INTERVAL '3 seconds' WHERE release_id='${release}';`
  )
  await assert.rejects(
    withBudgetLock(
      release,
      client => dispatchPaidAnalysis(client, f),
      async () => {
        await db.sql(budgetWaitSleep)
      }
    ),
    /analysis-permission-required/
  )
  assert.equal((await paidState(db, release)).held, '0')
  assert.equal((await paidState(db, release)).calls, 0)
  assert.equal(
    await db.sql(
      `SELECT status FROM private.dictionary_analysis_operations WHERE actor_id='${owner}' AND operation_id='${f.operation}';`
    ),
    'accepted'
  )
})
for (const bound of ['cohort', 'release', 'phase']) {
  test(`claim deadline is the earliest ${bound} boundary`, async () => {
    const releaseUntil = new Date(Date.now() + 30000).toISOString()
    const release = await paidRelease(
      db,
      bound === 'release' ? { until: releaseUntil } : {}
    )
    const f = await grantPair(db)
    if (bound === 'cohort')
      await db.sql(
        `UPDATE private.dictionary_paid_cohort SET expires_at=CLOCK_TIMESTAMP()+INTERVAL '30 seconds' WHERE release_id='${release}';`
      )
    const expected = await db.sql(
      `SELECT LEAST(r.valid_until,c.expires_at,l.expires_at) FROM private.dictionary_paid_releases r JOIN private.dictionary_paid_cohort c USING(release_id) JOIN private.dictionary_analysis_leases l ON l.entry_id='${f.entry}' WHERE r.release_id='${release}';`
    )
    const claim = await claimPaid(db, f)
    assert.equal(claim.allowed, true)
    assert.equal(Date.parse(claim.expires_at), Date.parse(expected))
  })
}
test('R2: creation timeout cannot turn an old business grant into a fresh provider claim', async () => {
  await configure(db)
  const release = await paidRelease(db),
    f = await ready(db)
  // Seed elapsed time at insertion, preserving the immutable attempt update guard.
  await db.sql(`CREATE FUNCTION private.lifecycle_old_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.dispatched_at:=CLOCK_TIMESTAMP()-INTERVAL '3 minutes'; RETURN NEW; END $$;
    CREATE TRIGGER a_lifecycle_old_dispatch BEFORE INSERT ON private.dictionary_creation_generation_attempts FOR EACH ROW EXECUTE FUNCTION private.lifecycle_old_dispatch();`)
  try {
    assert.ok((await start(db, f)).dispatch)
  } finally {
    await db.sql(
      'DROP TRIGGER a_lifecycle_old_dispatch ON private.dictionary_creation_generation_attempts; DROP FUNCTION private.lifecycle_old_dispatch();'
    )
  }
  const timeout = await start(db, f)
  assert.equal(timeout.receipt.status, 'provider-outcome-unknown')
  assert.equal(timeout.dispatch, null)
  await assert.rejects(
    claimPaid(db, { actor: owner, key: `${f.run}:generation:1` }),
    unavailable
  )
  assert.equal((await paidState(db, release)).held, '16584')
})
test('R2: an isolated accounting reservation without business work never permits a call', async () => {
  await paidRelease(db)
  const f = await reservePair(db)
  await assert.rejects(claimPaid(db, f), unavailable)
})
test('R2: direct analysis timeout invalidates its outstanding monetary grant', async () => {
  await paidRelease(db)
  const f = await grantPair(db)
  await db.sql(
    `UPDATE private.dictionary_analysis_leases SET expires_at=CLOCK_TIMESTAMP()-INTERVAL '1 second' WHERE entry_id='${f.entry}';`
  )
  const timeout = await dispatchPaidAnalysis(db, f)
  assert.equal(timeout.receipt.status, 'provider-outcome-unknown')
  assert.equal(timeout.dispatch, null)
  await assert.rejects(claimPaid(db, f), unavailable)
})
test('R2: a superseded analysis lease cannot be claimed with its old fence', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db)
  await db.sql(
    `UPDATE private.dictionary_analysis_leases SET fence=fence+1 WHERE entry_id='${f.entry}';`
  )
  await assert.rejects(claimPaid(db, f), /stale-analysis-fence/)
  assert.equal((await paidState(db, release)).held, '16584')
})
test('R2: all creation phases bind the immutable phase dispatch deadline', async () => {
  const x = await creationJudgement()
  const claim = await claimPaid(
    db,
    { actor: owner, key: x.judgeKey },
    { model: JUDGE }
  )
  const expected = await db.sql(
    `SELECT dispatched_at+INTERVAL '2 minutes' FROM private.dictionary_creation_judge_attempts WHERE run_id='${x.f.run}';`
  )
  assert.equal(Date.parse(claim.expires_at), Date.parse(expected))
  const y = await creationGeneration()
  const generation = await claimPaid(db, { actor: owner, key: y.key })
  const generationUntil = await db.sql(
    `SELECT dispatched_at+INTERVAL '2 minutes' FROM private.dictionary_creation_generation_attempts WHERE run_id='${y.f.run}';`
  )
  assert.equal(Date.parse(generation.expires_at), Date.parse(generationUntil))
})
test('R2: the direct semantic phase has its own deadline and current business state', async () => {
  await paidRelease(db)
  const f = await grantPair(db)
  await claimPaid(db, f)
  const result = providerResult()
  await db.sql(
    service(
      `SELECT public.journal_dictionary_analysis_result_v1('${owner}','${f.operation}','1',${literal(JSON.stringify(result))}::JSONB,'semantic-lifecycle-gen');`
    )
  )
  const hash = await db.sql(
    `SELECT private.dictionary_canonical_sha256(${literal(JSON.stringify(result.content))}::JSONB);`
  )
  const check = await json(
    db,
    service(
      `SELECT public.start_dictionary_semantic_check_v1('${owner}','${f.operation}','1','paid-ledger-fixture','${PAID_POLICY}','${JUDGE}','${'c'.repeat(64)}','${hash}','${'a'.repeat(64)}');`
    )
  )
  assert.equal(check.dispatch, true)
  const expected = await db.sql(
    `SELECT LEAST(l.expires_at,s.dispatched_at+INTERVAL '2 minutes') FROM private.dictionary_semantic_checks s JOIN private.dictionary_analysis_operations o USING(actor_id,operation_id) JOIN private.dictionary_analysis_leases l USING(entry_id) WHERE s.actor_id='${owner}' AND s.operation_id='${f.operation}';`
  )
  const claim = await claimPaid(db, f, {
    key: 'semantic:' + f.key,
    model: JUDGE,
  })
  assert.equal(Date.parse(claim.expires_at), Date.parse(expected))
})
test('R3: active generation keeps its judge reserve; terminal close releases it exactly once', async () => {
  const x = await creationGeneration()
  await claimPaid(db, { actor: owner, key: x.key })
  const judgeId = await phaseId(x.release, 'judgement'),
    before = await paidState(db, x.release)
  await assert.rejects(closeAttempt(judgeId), notTerminal)
  assert.deepEqual(await paidState(db, x.release), before)
  await fail(db, x.f, x.dispatch, true, evidence)
  await Promise.all([closeAttempt(judgeId), closeAttempt(judgeId)])
  assert.equal((await paidState(db, x.release)).held, '8292')
  assert.equal((await paidState(db, x.release)).calls, 1)
  await assert.rejects(
    closeAttempt(await phaseId(x.release, 'generation')),
    /paid-attempt-not-unissued/
  )
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_paid_attempts WHERE release_id='${x.release}' AND phase='generation';`
    ),
    'unknown'
  )
})
test('R3: close racing a live claim cannot refund the issued phase', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    attempt = await phaseId(release, 'generation')
  const results = await Promise.allSettled([
    claimPaid(db, f),
    closeAttempt(attempt),
  ])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[0].value.allowed, true)
  assert.equal(results[1].status, 'rejected')
  assert.match(
    results[1].reason.message,
    /paid-business-not-terminal|paid-attempt-not-unissued/
  )
  assert.equal((await paidState(db, release)).held, '16584')
})
test('R3: close racing a claim on terminal business work never permits a provider call', async () => {
  const release = await paidRelease(db),
    f = await grantPair(db),
    attempt = await phaseId(release, 'generation')
  await finishPaidAnalysis(db, f)
  const results = await Promise.allSettled([
    claimPaid(db, f),
    closeAttempt(attempt),
  ])
  assert.equal(results[1].status, 'fulfilled')
  if (results[0].status === 'fulfilled')
    assert.equal(results[0].value.allowed, false)
  else assert.match(results[0].reason.message, unavailable)
  assert.equal((await paidState(db, release)).held, '8292')
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_paid_attempts WHERE attempt_id='${attempt}';`
    ),
    'closed'
  )
})
for (const entrypoint of ['dispatch', 'acceptance', 'independent']) {
  test(`R4: generic ${entrypoint} takes Auth before business locks and cannot deadlock deletion`, async () => {
    const release = await paidRelease(db),
      f = await preparePaidAnalysis(db)
    if (entrypoint === 'dispatch') await acceptPaidAnalysis(db, f)
    const deleting = db.connect()
    let worker
    try {
      deleting.child.stdin.write(
        `SET statement_timeout='10s'; BEGIN; SELECT id FROM auth.users WHERE id='${owner}' FOR UPDATE; SELECT 'AUTH_LOCKED';\n`
      )
      await waitFor(
        () => deleting.output().includes('AUTH_LOCKED'),
        'Auth lock missing'
      )
      const client = named('paid_lifecycle_auth')
      worker =
        entrypoint === 'dispatch'
          ? dispatchPaidAnalysis(client, f)
          : entrypoint === 'independent'
            ? acceptPaidAnalysis(client, f)
            : json(
                client,
                asUser(
                  owner,
                  `SELECT public.accept_dictionary_analysis_v2(${literal(JSON.stringify(f.command))}::JSONB);`
                )
              )
      void worker.catch(() => {})
      await waiting('paid_lifecycle_auth')
      assert.equal(
        await db.sql(
          "SELECT COUNT(*) FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE a.application_name='paid_lifecycle_auth' AND l.locktype='advisory' AND l.granted;"
        ),
        '0'
      )
      deleting.child.stdin.end(
        `DELETE FROM auth.users WHERE id='${owner}'; ROLLBACK;\n`
      )
      const results = await Promise.all([worker, deleting.completed])
      if (entrypoint === 'dispatch') assert.ok(results[0].dispatch)
      else assert.equal(results[0].status, 'accepted')
      assert.equal(
        await db.sql(`SELECT COUNT(*) FROM auth.users WHERE id='${owner}';`),
        '1'
      )
      assert.equal(
        (await paidState(db, release)).calls,
        entrypoint === 'dispatch' ? 1 : 0
      )
    } finally {
      if (!deleting.child.stdin.writableEnded)
        deleting.child.stdin.end('ROLLBACK;\n')
      await deleting.completed.catch(() => {})
      if (worker) await worker.catch(() => {})
    }
  })
}
test('generic dispatch replay preserves its receipt after revocation and private aliases are inaccessible', async () => {
  await paidRelease(db)
  const f = await grantPair(db)
  const before = await dispatchPaidAnalysis(db, f)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.deepEqual(await dispatchPaidAnalysis(db, f), before)
  assert.equal(before.dispatch, null)
  for (const signature of [
    'private.accept_dictionary_analysis_before_paid_lock_v2(jsonb)',
    'private.accept_dictionary_independent_before_paid_lock_v2(jsonb,text,text,text,text,text,text[])',
    'private.start_dictionary_analysis_before_paid_lock_v1(uuid,uuid,text,text,text,text)',
    'private.lock_dictionary_paid_business(private.dictionary_paid_attempts)',
  ])
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(
        await db.sql(
          `SELECT has_function_privilege('${role}',${literal(signature)},'EXECUTE');`
        ),
        'f'
      )
    }
})
test('publication waiting for an envelope stop rechecks disabled and rolls back content writes', async () => {
  const x = await creationPublication()
  await assert.rejects(
    withBudgetLock(
      x.release,
      client => json(client, service(x.publishSql)),
      async lock => {
        lock.child.stdin.write(
          `UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id='${x.release}';\n`
        )
      }
    ),
    /shared-analysis-disabled/
  )
  assert.equal(
    await db.sql(
      `SELECT state FROM public.dictionary_entries WHERE entry_id='${x.f.identity.entry_id}';`
    ),
    'draft'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${x.f.identity.entry_id}';`
    ),
    '0'
  )
  assert.equal((await paidState(db, x.release)).settled, '50')
})
test('an envelope stop waits for a publication that already holds the shared release lock', async () => {
  const x = await creationPublication(),
    publishing = db.connect()
  let stopping
  try {
    publishing.child.stdin.write(
      `BEGIN; SET ROLE service_role; ${x.publishSql} SELECT 'PUBLISHED';\n`
    )
    await waitFor(
      () => publishing.output().includes('PUBLISHED'),
      'Publication missing'
    )
    stopping = named('paid_lifecycle_stop').sql(
      `UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id='${x.release}';`
    )
    void stopping.catch(() => {})
    await waiting('paid_lifecycle_stop')
    publishing.child.stdin.end('COMMIT;\n')
    await publishing.completed
    await stopping
    assert.equal(
      await db.sql(
        `SELECT status FROM private.dictionary_creation_runs WHERE run_id='${x.f.run}';`
      ),
      'published'
    )
    assert.equal((await paidState(db, x.release)).enabled, false)
  } finally {
    if (!publishing.child.stdin.writableEnded)
      publishing.child.stdin.end('ROLLBACK;\n')
    await publishing.completed.catch(() => {})
    if (stopping) await stopping.catch(() => {})
  }
})
test('Auth deletion permits only unissued cleanup and never refunds an unknown liability', async () => {
  const release = await paidRelease(db, { actors: [other] }),
    f = await grantPair(db, { actor: other })
  await claimPaid(db, f)
  const gen = await phaseId(release, 'generation'),
    check = await phaseId(release, 'judgement')
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  await closeAttempt(check)
  await assert.rejects(closeAttempt(gen), /paid-attempt-not-unissued/)
  assert.equal((await paidState(db, release)).held, '8292')
  assert.equal(
    await db.sql(
      `SELECT state FROM private.dictionary_paid_attempts WHERE attempt_id='${gen}';`
    ),
    'unknown'
  )
})
