import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  literal,
  owner,
  other,
  seedUsers,
  seedWord,
} from './fixtures.mjs'
import {
  POLICY,
  VERSION,
  EVIDENCE,
  result,
  json,
  service,
  checked,
  configure,
  ready,
  start,
  journal,
  fail,
  reconcile,
  read,
  replay,
  quota,
  snapshots,
} from './dictionary-creation-dispatch.fixture.mjs'

const { canonicalizeJson } =
  await import('../../packages/domain/src/shared-dictionary.ts')
let db
const UNKNOWN = 'provider-outcome-unknown'
const REVOKED = 'authorization-revoked'
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
const leases = f =>
  db.sql(
    `SELECT COUNT(*) FROM private.dictionary_creation_leases WHERE run_id='${f.run}';`
  )
const attempt = f =>
  json(
    db,
    `SELECT TO_JSONB(a) FROM private.dictionary_creation_generation_attempts a WHERE run_id='${f.run}';`
  )
const dispatch = async f => {
  const response = await start(db, f)
  checked(response.receipt)
  assert.equal(response.receipt.status, 'dispatching')
  assert.ok(response.dispatch)
  return response.dispatch
}
const expiredDispatch = async f => {
  await db.sql(
    "ALTER TABLE private.dictionary_creation_generation_attempts ALTER COLUMN dispatched_at SET DEFAULT (NOW()-INTERVAL '3 minutes');"
  )
  try {
    return await dispatch(f)
  } finally {
    await db.sql(
      'ALTER TABLE private.dictionary_creation_generation_attempts ALTER COLUMN dispatched_at SET DEFAULT NOW();'
    )
  }
}
const revoke = f =>
  db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${f.actor}';`
  )
const noHead = async f => {
  for (const table of ['dictionary_entry_heads', 'dictionary_revisions'])
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM public.${table} WHERE entry_id='${f.identity.entry_id}';`
      ),
      '0'
    )
}

test('creation dispatch starts OFF, with no durable run, attempt or live provider capability seeded', async () => {
  assert.equal(
    await db.sql(
      'SELECT creation_dispatch_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  for (const table of [
    'dictionary_creation_runs',
    'dictionary_creation_generation_attempts',
  ])
    assert.equal(await db.sql(`SELECT COUNT(*) FROM private.${table};`), '0')
})
test('accepted reservation atomically binds a durable run and lease without copying private owner intent', async () => {
  await configure(db)
  const f = await ready(db)
  const run = await json(
    db,
    `SELECT TO_JSONB(r) FROM private.dictionary_creation_runs r WHERE run_id='${f.run}';`
  )
  assert.equal(run.actor_id, owner)
  assert.equal(run.operation_id, f.cmd.operation_id)
  assert.equal(run.status, 'accepted')
  assert.equal(await leases(f), '1')
  assert.equal(await attempt(f), null)
  assert.equal(JSON.stringify(run).includes(f.req.meaning_hint), false)
  assert.equal(JSON.stringify(run).includes(f.req.original_query), false)
  assert.equal(await quota(db), 1)
})
test('generation dispatch computes immutable neutral input and consumes only the accepted quota slot', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  assert.deepEqual(Object.keys(input).sort(), [
    'fence',
    'input',
    'input_sha256',
    'model',
    'provider',
    'run_id',
  ])
  assert.equal(input.model, 'gemini-generator-fixture')
  assert.equal(input.input.identity.lemma, 'bank')
  assert.equal(input.input.anchor.gloss, f.identity.gloss)
  assert.equal(
    input.input_sha256,
    createHash('sha256').update(canonicalizeJson(input.input)).digest('hex')
  )
  assert.equal(JSON.stringify(input).includes(f.req.meaning_hint), false)
  assert.equal(JSON.stringify(input).includes(f.req.original_query), false)
  assert.equal(await quota(db), 1)
  assert.equal((await attempt(f)).quota_charged, true)
})
test('concurrent/replayed dispatch grants one intent and never repeats a provider attempt or quota charge', async () => {
  await configure(db)
  const f = await ready(db)
  const responses = await Promise.all([
    start(db, f),
    start(db, f),
    start(db, f),
  ])
  assert.equal(responses.filter(r => r.dispatch !== null).length, 1)
  assert.equal((await start(db, f)).dispatch, null)
  assert.equal(await quota(db), 1)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_generation_attempts WHERE run_id='${f.run}';`
    ),
    '1'
  )
})
test('commit loss cannot grant another dispatch; a restarted worker finds the durable status only', async () => {
  await configure(db)
  const f = await ready(db)
  await start(db, f)
  const work = await json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${owner}','${f.cmd.operation_id}');`
    )
  )
  assert.equal(work.run_id, f.run)
  assert.equal(work.receipt.status, 'dispatching')
  assert.equal((await start(db, f)).dispatch, null)
})
test('owner status and exact acceptance replay follow the live run while the original command receipt stays immutable', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  assert.equal((await read(db, f)).status, 'dispatching')
  assert.deepEqual(await replay(db, f), await read(db, f))
  const receipt = await journal(db, f, input)
  assert.equal(receipt.status, 'validating')
  assert.deepEqual(await replay(db, f), receipt)
  const stored = await json(
    db,
    `SELECT receipt FROM private.dictionary_creation_commands WHERE actor_id='${owner}' AND operation_id='${f.cmd.operation_id}';`
  )
  assert.deepEqual(stored, f.receipt)
  assert.equal(await read(db, f, other), null)
})
test('bounded raw result is hashed once and replay preserves its exact provider identity without a head', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f),
    provider = randomUUID()
  const receipt = await journal(db, f, input, result, provider)
  assert.equal(
    receipt.result_sha256,
    createHash('sha256').update(canonicalizeJson(result)).digest('hex')
  )
  assert.deepEqual(await journal(db, f, input, result, provider), receipt)
  await assert.rejects(
    journal(
      db,
      f,
      input,
      { ...result, content: { dutch_lemma: 'stoel' } },
      provider
    ),
    /creation-result-conflict/
  )
  await assert.rejects(
    journal(db, f, input, result, randomUUID()),
    /creation-result-conflict/
  )
  await noHead(f)
  assert.equal(await quota(db), 1)
})
test('wrong run, noncanonical/stale fence and forged input hash cannot dispatch or journal', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await assert.rejects(
    start(db, { ...f, run: randomUUID() }),
    /creation-run-not-found/
  )
  for (const fence of ['0', '01', '2', '9007199254740992', null])
    await assert.rejects(start(db, f, fence), /creation-fence-conflict/)
  await assert.rejects(
    journal(db, f, { ...input, input_sha256: 'f'.repeat(64) }),
    /creation-attempt-conflict/
  )
  assert.equal((await attempt(f)).result, null)
})
test('result without dispatch and malformed/oversized result fail atomically without changing status', async () => {
  await configure(db)
  const f = await ready(db)
  await assert.rejects(
    journal(db, f, { input_sha256: POLICY }),
    /creation-attempt-conflict/
  )
  const input = await dispatch(f)
  for (const raw of [null, [], 12, { text: 'x'.repeat(262144) }])
    await assert.rejects(journal(db, f, input, raw), /invalid-creation-result/)
  for (const provider of ['', 'x'.repeat(501)])
    await assert.rejects(
      journal(db, f, input, result, provider),
      /invalid-creation-result/
    )
  assert.equal((await attempt(f)).result, null)
  assert.equal((await read(db, f)).status, 'dispatching')
})
test('one non-null provider response id cannot be reused across separate creation runs', async () => {
  await configure(db)
  const f = await ready(db),
    g = await ready(db),
    input = await dispatch(f),
    next = await dispatch(g),
    provider = randomUUID()
  await journal(db, f, input, result, provider)
  await assert.rejects(
    journal(db, g, next, result, provider),
    /dictionary_creation_unique_generation_response/
  )
  assert.equal((await attempt(g)).result, null)
  assert.equal((await read(db, g)).status, 'dispatching')
})
test('late result enters quarantine automatically and requires hash-bound explicit reconciliation', async () => {
  await configure(db)
  const f = await ready(db),
    input = await expiredDispatch(f)
  const receipt = await journal(db, f, input)
  assert.equal(receipt.status, UNKNOWN)
  assert.equal((await attempt(f)).status, 'unknown')
  assert.equal((await start(db, f)).dispatch, null)
  await assert.rejects(
    reconcile(db, f, 'f'.repeat(64)),
    /invalid-creation-reconciliation/
  )
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256, null),
    /invalid-creation-reconciliation/
  )
  const reconciled = await reconcile(db, f, receipt.result_sha256)
  assert.equal(reconciled.status, 'validating')
  assert.deepEqual(await reconcile(db, f, receipt.result_sha256), reconciled)
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256, 'f'.repeat(64)),
    /creation-reconciliation-conflict/
  )
  assert.equal(await quota(db), 1)
  await noHead(f)
})
test('expired worker retry marks an unknown outcome without dispatch, refund, expiry takeover or replacement', async () => {
  await configure(db)
  const f = await ready(db)
  await expiredDispatch(f)
  const response = await start(db, f)
  assert.equal(response.dispatch, null)
  assert.equal(response.receipt.status, UNKNOWN)
  assert.equal((await attempt(f)).status, 'unknown')
  assert.equal(await leases(f), '1')
  assert.equal(await quota(db), 1)
  const cmd = { ...f.cmd, operation_id: randomUUID() }
  const busy = await json(
    db,
    asUser(
      owner,
      `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(cmd))}::JSONB);`
    )
  )
  assert.equal(checked(busy).outcome, 'creation-in-progress')
  assert.equal(await quota(db), 1)
})
test('unknown transport failure retains late result but cannot accept automatic redispatch or known-failure downgrade', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  const unknown = await fail(db, f, input)
  assert.equal(unknown.status, UNKNOWN)
  assert.deepEqual(await fail(db, f, input), unknown)
  await assert.rejects(
    fail(db, f, input, true, EVIDENCE),
    /terminal-creation-attempt/
  )
  const returned = await journal(db, f, input)
  assert.equal(returned.status, UNKNOWN)
  assert.equal((await attempt(f)).status, 'unknown')
  assert.equal((await start(db, f)).dispatch, null)
  assert.equal(
    (await reconcile(db, f, returned.result_sha256)).status,
    'validating'
  )
})
test('documented known failure is terminal and no later result or worker retry can replace it', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await assert.rejects(
    fail(db, f, input, true),
    /documented-creation-failure-required/
  )
  const failed = await fail(db, f, input, true, EVIDENCE)
  assert.equal(failed.status, 'provider-failed')
  assert.deepEqual(await fail(db, f, input, true, EVIDENCE), failed)
  await assert.rejects(journal(db, f, input), /terminal-creation-attempt/)
  await assert.rejects(fail(db, f, input, false), /terminal-creation-attempt/)
  assert.equal((await start(db, f)).dispatch, null)
  assert.equal(await quota(db), 1)
})
test('runtime flag withdrawal blocks dispatch and preserves an unsent accepted reservation', async () => {
  await configure(db)
  const f = await ready(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=FALSE;'
  )
  await assert.rejects(start(db, f), /creation-dispatch-unavailable/)
  assert.equal((await read(db, f)).status, 'accepted')
  assert.equal(await attempt(f), null)
  await configure(db)
  await dispatch(f)
})
test('read_only ordinary owner cannot dispatch; stored status remains readable after revocation', async () => {
  await configure(db)
  const f = await ready(db)
  await revoke(f)
  const response = await start(db, f)
  assert.equal(response.dispatch, null)
  assert.equal(response.receipt.status, REVOKED)
  assert.equal(await attempt(f), null)
  assert.equal(await leases(f), '0')
  assert.deepEqual(await replay(db, f), response.receipt)
})
test('an enabled administrator may dispatch with read_only access and loses authority when that role is withdrawn', async () => {
  await configure(db)
  const f = await ready(db, other)
  await db.sql(`INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES('${other}','fixture://creation-admin')
    ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`)
  await revoke(f)
  const input = await dispatch(f)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${other}';`
  )
  assert.equal((await journal(db, f, input)).status, REVOKED)
  await noHead(f)
})
for (const withdrawal of ['identity', 'policy', 'profile', 'anchor']) {
  test(`${withdrawal} withdrawal blocks dispatch and preserves exact reviewed binding`, async () => {
    await configure(db)
    const f = await ready(db)
    if (withdrawal === 'identity')
      await db.sql(
        `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.identity.identity_id}';`
      )
    if (withdrawal === 'policy')
      await db.sql(
        `UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE validator_version='${VERSION}' AND policy_sha256='${POLICY}';`
      )
    if (withdrawal === 'profile')
      await db.sql('DELETE FROM private.dictionary_creation_profile;')
    if (withdrawal === 'anchor')
      await db.sql(
        `DELETE FROM private.dictionary_meaning_anchor_heads WHERE entry_id='${f.identity.entry_id}';`
      )
    await assert.rejects(start(db, f), /creation-dispatch-unavailable/)
    assert.equal((await read(db, f)).status, 'accepted')
    assert.equal(await attempt(f), null)
    await noHead(f)
  })
}
test('permission withdrawal after dispatch retains the paid result but cannot validate or publish', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await revoke(f)
  const receipt = await journal(db, f, input)
  assert.equal(receipt.status, REVOKED)
  assert.ok(receipt.result_sha256)
  assert.equal((await attempt(f)).status, 'returned')
  assert.equal(await leases(f), '0')
  await configure(db)
  assert.equal((await start(db, f)).dispatch, null)
  assert.deepEqual(await journal(db, f, input), receipt)
  await noHead(f)
})
test('source availability withdrawal after dispatch retains result in review-required without any public change', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.identity.identity_id}';`
  )
  const receipt = await journal(db, f, input)
  assert.equal(receipt.status, 'review-required')
  assert.ok(receipt.result_sha256)
  await noHead(f)
})
test('reconciliation requires fresh authority, gates, identity availability and immutable exact result', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await fail(db, f, input)
  const receipt = await journal(db, f, input)
  await revoke(f)
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256),
    /analysis-permission-required/
  )
  await configure(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=FALSE;'
  )
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256),
    /creation-dispatch-unavailable/
  )
  await configure(db)
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.identity.identity_id}';`
  )
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256),
    /creation-dispatch-unavailable/
  )
  assert.equal((await attempt(f)).status, 'unknown')
  assert.equal((await attempt(f)).reconciliation_evidence_sha256, null)
})
test('unsent owner deletion redacts the durable reservation and releases its lease without publication', async () => {
  await configure(db)
  const f = await ready(db, other)
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  const run = await json(
    db,
    `SELECT TO_JSONB(r) FROM private.dictionary_creation_runs r WHERE run_id='${f.run}';`
  )
  assert.equal(run.actor_id, null)
  assert.equal(run.status, REVOKED)
  assert.equal(await leases(f), '0')
  assert.equal((await start(db, f)).dispatch, null)
  await noHead(f)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${other}','recreated@example.invalid');`
  )
  assert.equal(await read(db, f, other), null)
})
test('dispatched owner deletion preserves its paid ledger and lease; late callback remains quarantined permanently', async () => {
  await configure(db)
  const f = await ready(db, other),
    input = await dispatch(f)
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  assert.equal(await leases(f), '1')
  const receipt = await journal(db, f, input)
  assert.equal(receipt.status, UNKNOWN)
  assert.equal((await attempt(f)).quota_charged, true)
  assert.equal((await attempt(f)).result_sha256, receipt.result_sha256)
  assert.equal((await start(db, f)).dispatch, null)
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256),
    /analysis-permission-required/
  )
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${other}','recreated@example.invalid');`
  )
  await configure(db)
  assert.equal(await read(db, f, other), null)
  await assert.rejects(
    reconcile(db, f, receipt.result_sha256),
    /analysis-permission-required/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_creation_generation_attempts WHERE run_id='${f.run}';`
    ),
    /immutable-creation-accounting/
  )
  assert.equal(await leases(f), '1')
})
test('returned owner deletion preserves immutable raw result and paid journal while releasing a known lease', async () => {
  await configure(db)
  const f = await ready(db, other),
    input = await dispatch(f)
  const receipt = await journal(db, f, input)
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  assert.equal(await leases(f), '0')
  assert.equal((await attempt(f)).result_sha256, receipt.result_sha256)
  assert.equal((await journal(db, f, input)).status, REVOKED)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${other}','recreated@example.invalid');`
  )
})
test('private runs/attempts have no ordinary or direct service mutation grants; RPC allowlist is service-only', async () => {
  await configure(db)
  const f = await ready(db)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const table of [
      'dictionary_creation_runs',
      'dictionary_creation_generation_attempts',
    ])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; SELECT * FROM private.${table};`),
        /permission denied/
      )
  }
  const rpcs = [
    `get_dictionary_creation_work_v1('${owner}','${f.cmd.operation_id}')`,
    `start_dictionary_creation_dispatch_v1('${f.run}','1')`,
    `record_dictionary_creation_result_v1('${f.run}','1','${POLICY}','{}',NULL)`,
    `record_dictionary_creation_failure_v1('${f.run}','1','${POLICY}',FALSE,NULL)`,
    `reconcile_dictionary_creation_result_v1('${f.run}','1','${POLICY}','${EVIDENCE}')`,
  ]
  for (const role of ['anon', 'authenticated'])
    for (const rpc of rpcs)
      await assert.rejects(
        db.sql(`SET ROLE ${role}; SELECT public.${rpc};`),
        /permission denied/
      )
})
test('run and attempt bindings, result, dispatch date, paid bit and terminal state reject direct mutations', async () => {
  await configure(db)
  const f = await ready(db),
    input = await dispatch(f)
  await journal(db, f, input)
  for (const update of [
    `fence=2`,
    `actor_id='${other}'`,
    `generation_model='gemini-forged'`,
    `evidence_sha256='${POLICY}'`,
    `status='accepted'`,
  ])
    await assert.rejects(
      db.sql(
        `UPDATE private.dictionary_creation_runs SET ${update} WHERE run_id='${f.run}';`
      ),
      /immutable-creation|creation-status-regression/
    )
  for (const update of [
    `input='{}'`,
    `model='gemini-forged'`,
    `dispatched_at=NOW()`,
    `quota_charged=FALSE`,
    `result='{}'`,
    `status='dispatching'`,
  ])
    await assert.rejects(
      db.sql(
        `UPDATE private.dictionary_creation_generation_attempts SET ${update} WHERE run_id='${f.run}';`
      ),
      /immutable-creation|creation-attempt-regression/
    )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_creation_runs WHERE run_id='${f.run}';`
    ),
    /immutable-creation-accounting/
  )
})
test('generation success/unknown/reconciliation leave every personal/SRS table and global delivery cursor unchanged', async () => {
  await configure(db)
  await seedWord(db, owner, {
    intervalDays: 18,
    repetitionCount: 7,
    easinessFactor: 2.7,
  })
  const before = await snapshots(db),
    cursor = await db.sql(
      'SELECT committed_version FROM private.dictionary_delivery_cursor;'
    )
  const f = await ready(db),
    input = await dispatch(f)
  await fail(db, f, input)
  const receipt = await journal(db, f, input)
  await reconcile(db, f, receipt.result_sha256)
  assert.deepEqual(await snapshots(db), before)
  assert.equal(
    await db.sql(
      'SELECT committed_version FROM private.dictionary_delivery_cursor;'
    ),
    cursor
  )
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT COUNT(*) FROM public.dictionary_entries WHERE entry_id='${f.identity.entry_id}';`
      )
    ),
    '0'
  )
  await noHead(f)
})
test('rollback of dispatch/result transaction retains accepted intent and makes no half-written attempt/result visible', async () => {
  await configure(db)
  const f = await ready(db)
  await db.sql(
    service(
      `BEGIN; SELECT public.start_dictionary_creation_dispatch_v1('${f.run}','1'); ROLLBACK;`
    )
  )
  assert.equal(await attempt(f), null)
  assert.equal((await read(db, f)).status, 'accepted')
  const input = await dispatch(f)
  await db.sql(
    service(
      `BEGIN; SELECT public.record_dictionary_creation_result_v1('${f.run}','1','${input.input_sha256}','{}',NULL); ROLLBACK;`
    )
  )
  assert.equal((await attempt(f)).result, null)
  assert.equal((await read(db, f)).status, 'dispatching')
  assert.equal(await quota(db), 1)
})
test('upgrade preserves an existing accepted command, creates its durable lease binding, and keeps dispatch OFF', async () => {
  const legacy = await createCluster({
    throughMigration: '20261010180000_add_dictionary_creation_acceptance.sql',
  })
  try {
    await seedUsers(legacy)
    const adapter = {
      sql: sql =>
        legacy.sql(
          sql.includes('get_dictionary_creation_work_v1')
            ? "SELECT JSONB_BUILD_OBJECT('run_id',NULL);"
            : sql.replace('creation_dispatch_enabled=TRUE,', '')
        ),
    }
    await configure(adapter)
    const f = await ready(adapter)
    await legacy.sql(
      readFileSync(
        new URL(
          '../../supabase/migrations/20261010190000_add_dictionary_creation_dispatch.sql',
          import.meta.url
        ),
        'utf8'
      )
    )
    const work = await json(
      legacy,
      service(
        `SELECT public.get_dictionary_creation_work_v1('${owner}','${f.cmd.operation_id}');`
      )
    )
    assert.ok(work.run_id)
    assert.deepEqual(work.receipt, f.receipt)
    assert.equal(
      await legacy.sql(
        `SELECT run_id='${work.run_id}' FROM private.dictionary_creation_leases WHERE entry_id='${f.identity.entry_id}';`
      ),
      't'
    )
    await assert.rejects(
      start(legacy, { ...f, run: work.run_id }),
      /creation-dispatch-unavailable/
    )
  } finally {
    await legacy.close()
  }
})
