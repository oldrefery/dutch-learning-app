import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal, owner, other, seedUsers } from './fixtures.mjs'
import {
  POLICY,
  VERSION,
  json,
  service,
  ready,
  start,
  fail,
  journal,
  read,
  replay,
  quota,
  snapshots,
} from './dictionary-creation-dispatch.fixture.mjs'
import {
  content,
  generated,
  judge,
  verdict,
  validated,
  validate,
  publish,
} from './dictionary-creation-publication.fixture.mjs'
import {
  configure,
  definitive,
  request,
  review,
  reviewSQL,
  command,
  accept,
  acceptSQL,
  approved,
  accounting,
  counts,
  frontier,
} from './dictionary-creation-recovery.fixture.mjs'

let db
const RECOVERY_TABLES = [
  'dictionary_creation_recovery_reviews',
  'dictionary_creation_recoveries',
]
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('recovery starts OFF with no approval, handover or new administrator', async () => {
  assert.equal(
    await db.sql(
      'SELECT creation_recovery_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  for (const table of [...RECOVERY_TABLES, 'dictionary_administrators'])
    assert.equal(await db.sql(`SELECT COUNT(*) FROM private.${table};`), '0')
})
test('known generation failure needs audited review; reservation preserves all originals and charges once', async () => {
  const f = await definitive(db)
  const original = await accounting(db, f)
  const personal = await snapshots(db)
  const a = await approved(db, f)
  assert.equal(await quota(db), 1)
  assert.equal((await counts(db, f)).runs, 1)
  const responses = await Promise.all([accept(db, a.cmd), accept(db, a.cmd)])
  assert.deepEqual(responses[0], responses[1])
  assert.equal(responses[0].fence, '2')
  assert.equal(responses[0].status, 'accepted')
  assert.equal(await quota(db), 2)
  assert.deepEqual(await accounting(db, f), original)
  assert.deepEqual(await snapshots(db), personal)
  const state = await counts(db, f)
  assert.equal(state.runs, 2)
  assert.equal(state.recoveries, 1)
  assert.equal(state.lease.fence, 2)
  assert.equal(state.revisions, 0)
  assert.equal(state.head, 0)
  assert.equal((await start(db, f)).dispatch, null)
  assert.deepEqual(await replay(db, f), await read(db, f))
  const stored = await json(
    db,
    `SELECT TO_JSONB(r) FROM private.dictionary_creation_recovery_reviews r WHERE review_id='${a.r.review_id}';`
  )
  for (const secret of [
    'Private owner hint',
    'Retained private recovery',
    'original_query',
    'meaning_hint',
  ])
    assert.equal(JSON.stringify(stored).includes(secret), false)
})
test('recovered generation/judge publish revision1 with three individually charged attempts', async () => {
  const f = await definitive(db)
  const original = await accounting(db, f)
  const a = await approved(db, f)
  const receipt = await accept(db, a.cmd)
  const work = await json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${owner}','${a.cmd.operation_id}');`
    )
  )
  const next = { ...f, run: work.run_id, cmd: a.cmd, receipt }
  const d = (await start(db, next, '2')).dispatch
  assert.equal(d.fence, '2')
  await json(
    db,
    service(
      `SELECT public.record_dictionary_creation_result_v1('${next.run}','2',${literal(d.input_sha256)},${literal(JSON.stringify({ content: content() }))}::JSONB,NULL);`
    )
  )
  const j = (await judge(db, next, '2')).dispatch
  await json(
    db,
    service(
      `SELECT public.record_dictionary_creation_judgement_v1('${next.run}','2',${literal(j.input_sha256)},${literal(JSON.stringify(verdict(j)))}::JSONB,NULL);`
    )
  )
  const validation = await json(
    db,
    service(`SELECT public.validate_dictionary_creation_v1('${next.run}','2');`)
  )
  const published = await publish(db, next, validation.validation_id, '2')
  assert.equal(await quota(db), 3)
  assert.equal(published.status, 'published')
  assert.equal((await counts(db, f)).revisions, 1)
  assert.deepEqual(await accounting(db, f), original)
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET creation_recovery_enabled=FALSE; UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}'; DELETE FROM private.dictionary_administrators WHERE user_id='${other}';`
  )
  assert.deepEqual(await accept(db, a.cmd), published)
  assert.deepEqual(await read(db, next), published)
  await assert.rejects(
    accept(db, { ...a.cmd, recovery_id: randomUUID() }),
    /operation-payload-conflict/
  )
})
for (const kind of ['judge-failed', 'uncertain', 'contradicted'])
  test(`${kind} recovery keeps prior attempt/validation and reserves a fresh run`, async () => {
    const f = await definitive(db, kind)
    const original = await accounting(db, f)
    const charged = await quota(db)
    const a = await approved(db, f)
    assert.equal((await accept(db, a.cmd)).fence, '2')
    assert.equal(await quota(db), charged + 1)
    assert.deepEqual(await accounting(db, f), original)
  })
test('returned result with withdrawn dependency may recover only after fresh reviewed authority returns', async () => {
  await configure(db)
  const f = await ready(db)
  const d = (await start(db, f)).dispatch
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=FALSE;'
  )
  assert.equal(
    (await journal(db, f, d, { content: content() })).status,
    'review-required'
  )
  const r = await request(db, f)
  await assert.rejects(review(db, r), /dictionary-creation-recovery-disabled/)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_dispatch_enabled=TRUE;'
  )
  await review(db, r)
  assert.equal((await accept(db, command(r))).fence, '2')
})
test('freshly restored permission recovers a definitive unsent run whose lease was released', async () => {
  await configure(db)
  const f = await ready(db)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await start(db, f)).receipt.status, 'authorization-revoked')
  assert.equal((await counts(db, f)).lease, null)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';`
  )
  const a = await approved(db, f)
  assert.equal((await accept(db, a.cmd)).fence, '2')
  assert.equal(await quota(db), 2)
})
test('ordinary acceptance never consumes a reviewed recovery or turns its busy receipt into a retry', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const ordinary = { ...a.cmd }
  delete ordinary.recovery_id
  const busy = await json(
    db,
    asUser(
      owner,
      `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(ordinary))}::JSONB);`
    )
  )
  assert.equal(busy.outcome, 'creation-in-progress')
  await assert.rejects(accept(db, a.cmd), /operation-payload-conflict/)
  assert.equal(await quota(db), 1)
  assert.equal((await counts(db, f)).recoveries, 0)
})
test('two separately reviewed commands contend for one atomic handover, without a second charge', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const b = await approved(db, f)
  const replies = await Promise.allSettled([
    accept(db, a.cmd),
    accept(db, b.cmd),
  ])
  assert.equal(replies.filter(r => r.status === 'fulfilled').length, 1)
  assert.match(
    replies.find(r => r.status === 'rejected').reason.message,
    /creation-recovery-frontier-conflict/
  )
  assert.equal(await quota(db), 2)
  assert.equal((await counts(db, f)).runs, 2)
})
test('transaction rollback retains approval/original lease and undoes new quota/run/command', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const before = await counts(db, f)
  await db.sql(asUser(owner, `BEGIN; ${acceptSQL(a.cmd)} ROLLBACK;`))
  assert.deepEqual(await counts(db, f), before)
  assert.equal(await quota(db), 1)
  assert.equal((await accept(db, a.cmd)).fence, '2')
})
test('quota denial does not consume audit or release the retained draft lease', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const before = await counts(db, f)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=1;'
  )
  await assert.rejects(accept(db, a.cmd), /rate-limit-exceeded/)
  assert.deepEqual(await counts(db, f), before)
  assert.equal(await quota(db), 1)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=100;'
  )
  assert.equal((await accept(db, a.cmd)).fence, '2')
})
test('review requires administrator, same owner, fresh reviewed resolution, canonical fence and unused nonce', async () => {
  const f = await definitive(db)
  const r = await request(db, f)
  await assert.rejects(review(db, r, owner), /administrator-required/)
  for (const [change, error] of [
    [{ actor_id: other }, /creation-recovery-owner-or-nonce-conflict/],
    [{ expected_fence: '01' }, /creation-fence-conflict/],
    [{ expected_fence: 1 }, /invalid-creation-recovery-request/],
    [
      { operation_id: f.cmd.operation_id },
      /creation-recovery-owner-or-nonce-conflict/,
    ],
    [
      { operation_id: f.req.resolution_id },
      /creation-recovery-owner-or-nonce-conflict/,
    ],
    [
      { resolution_id: f.req.resolution_id },
      /fresh-resolved-new-meaning-required/,
    ],
    [{ resolution_id: randomUUID() }, /fresh-resolved-new-meaning-required/],
    [{ audit_evidence_sha256: 'bad' }, /invalid-creation-recovery-request/],
    [{ audit_reference: ' ' }, /invalid-creation-recovery-request/],
    [{ approved: true }, /invalid-creation-recovery-request/],
  ])
    await assert.rejects(review(db, { ...r, ...change }), error)
  assert.equal(await quota(db), 1)
})
test('review replay is exact and changed audit/identity/command bindings cannot reuse its id', async () => {
  const f = await definitive(db)
  const r = await request(db, f)
  const receipt = await review(db, r)
  assert.deepEqual(await review(db, r), receipt)
  await assert.rejects(
    review(db, { ...r, audit_reference: 'fixture://different' }),
    /recovery-review-payload-conflict/
  )
  await assert.rejects(review(db, r, owner), /recovery-review-payload-conflict/)
  for (const change of [
    { operation_id: randomUUID() },
    { resolution_id: randomUUID() },
    { recovery_id: randomUUID() },
  ])
    await assert.rejects(
      accept(db, { ...command(r), ...change }),
      /owned-creation-recovery-review-required/
    )
  await assert.rejects(
    accept(db, command(r), other),
    /owned-creation-recovery-review-required/
  )
  await assert.rejects(
    accept(db, { ...command(r), claimed_failure: true }),
    /invalid-creation-recovery-command/
  )
  assert.equal(await quota(db), 1)
})
for (const withdrawal of [
  'owner',
  'reviewer',
  'recovery-gate',
  'source',
  'profile',
])
  test(`fresh ${withdrawal} withdrawal prevents consuming an earlier review without new charge`, async () => {
    const f = await definitive(db)
    const a = await approved(db, f)
    const sql = {
      owner: `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`,
      reviewer: `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${other}';`,
      'recovery-gate':
        'UPDATE private.dictionary_content_runtime SET creation_recovery_enabled=FALSE;',
      source: `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.identity.identity_id}';`,
      profile: `UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE validator_version='${VERSION}';`,
    }[withdrawal]
    await db.sql(sql)
    const before = await counts(db, f)
    await assert.rejects(
      accept(db, a.cmd),
      /analysis-permission-required|administrator-required|dictionary-creation-recovery-disabled|reviewed-identity-unavailable|creation-profile-unavailable/
    )
    assert.deepEqual(await counts(db, f), before)
    assert.equal(await quota(db), 1)
  })
test('changed qualified profile requires a new review and uses current generation policy', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const nextVersion = 'recovery-profile-v2'
  const nextHash = 'd'.repeat(64)
  await db.sql(`INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,
    semantic_method,semantic_model,semantic_prompt_sha256,generation_model) VALUES('${nextVersion}','${nextHash}',TRUE,
    'fixture://recovery-profile','independent-gemini-v1','gemini-judge-fixture','${'c'.repeat(64)}','gemini-recovery-generator-v2');
    UPDATE private.dictionary_creation_profile SET validator_version='${nextVersion}',policy_sha256='${nextHash}';`)
  await assert.rejects(accept(db, a.cmd), /creation-recovery-review-stale/)
  const b = await approved(db, f)
  await accept(db, b.cmd)
  assert.equal(
    await db.sql(
      `SELECT generation_model FROM private.dictionary_creation_runs WHERE actor_id='${owner}' AND operation_id='${b.cmd.operation_id}';`
    ),
    'gemini-recovery-generator-v2'
  )
  assert.equal(await quota(db), 2)
})
test('expired retained audit cannot authorize a new reservation', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  // Fixture a historical approval through privileged local SQL, not by mutating it.
  // The production wrapper always sets reviewed_at now and expires_at +15 minutes.
  const oldId = randomUUID()
  const oldRequest = { ...a.r, review_id: oldId }
  await db.sql(
    asUser(other, 'RESET ROLE;') +
      `SET request.jwt.claim.sub='${other}';
    INSERT INTO private.dictionary_creation_recovery_reviews SELECT '${oldId}',actor_id,reviewer_id,prior_run_id,operation_id,resolution_id,
    ${literal(JSON.stringify(oldRequest))}::JSONB,private.dictionary_canonical_sha256(${literal(JSON.stringify(oldRequest))}::JSONB),
    snapshot,snapshot_sha256,audit_reference,audit_evidence_sha256,NOW()-INTERVAL '30 minutes',NOW()-INTERVAL '15 minutes',
    receipt||JSONB_BUILD_OBJECT('review_id','${oldId}','expires_at',TO_CHAR((NOW()-INTERVAL '15 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
    FROM private.dictionary_creation_recovery_reviews WHERE review_id='${a.r.review_id}';`
  )
  await assert.rejects(
    accept(db, { ...a.cmd, recovery_id: oldId }),
    /creation-recovery-review-expired-or-revoked/
  )
  assert.equal(await quota(db), 1)
})
for (const phase of ['generation', 'judge'])
  test(`unknown ${phase} is quarantined even with an administrator and exact neutral evidence`, async () => {
    await configure(db)
    const f = phase === 'generation' ? await ready(db) : await generated(db)
    const d =
      phase === 'generation'
        ? (await start(db, f)).dispatch
        : (await judge(db, f)).dispatch
    if (phase === 'generation') await fail(db, f, d)
    else
      await json(
        db,
        service(
          `SELECT public.fail_dictionary_creation_judgement_v1('${f.run}','1',${literal(d.input_sha256)},FALSE,NULL);`
        )
      )
    const r = await request(db, f)
    const before = await counts(db, f)
    await assert.rejects(
      review(db, r),
      /creation-recovery-definitive-owner-required|creation-recovery-unknown-quarantined/
    )
    assert.deepEqual(await counts(db, f), before)
  })
test('accepted/validating/published runs never enter terminal draft recovery', async () => {
  await configure(db)
  const accepted = await ready(db)
  await assert.rejects(
    review(db, await request(db, accepted)),
    /creation-recovery-definitive-owner-required/
  )
  const validating = await generated(db)
  await assert.rejects(
    review(db, await request(db, validating)),
    /creation-recovery-definitive-owner-required/
  )
  const published = await validated(db)
  // Resolve before publication so the retained receipt is still new-meaning.
  const r = await request(db, published)
  await publish(db, published, published.validation)
  await assert.rejects(
    review(db, r),
    /creation-recovery-definitive-owner-required/
  )
})
test('owner deletion redacts review/run; recreated Auth UUID cannot acquire the retained approval', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const before = await accounting(db, f)
  await db.sql(`DELETE FROM auth.users WHERE id='${owner}';`)
  assert.equal(
    await db.sql(
      `SELECT actor_id IS NULL FROM private.dictionary_creation_recovery_reviews WHERE review_id='${a.r.review_id}';`
    ),
    't'
  )
  assert.equal((await accounting(db, f)).run.actor_id, null)
  assert.deepEqual((await accounting(db, f)).generation, before.generation)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${owner}','recreated-owner@example.invalid');`
  )
  await configure(db)
  await assert.rejects(
    accept(db, a.cmd),
    /owned-creation-recovery-review-required/
  )
  await assert.rejects(
    review(db, { ...a.r, review_id: randomUUID() }),
    /creation-recovery-owner-or-nonce-conflict/
  )
  assert.equal((await counts(db, f)).recoveries, 0)
  assert.equal(await read(db, f), null)
})
test('reviewer deletion redacts authority; recreated/regranted UUID cannot consume old approval', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  await db.sql(
    `DELETE FROM auth.users WHERE id='${other}'; INSERT INTO auth.users(id,email) VALUES('${other}','recreated-reviewer@example.invalid');`
  )
  await configure(db)
  assert.equal(
    await db.sql(
      `SELECT reviewer_id IS NULL FROM private.dictionary_creation_recovery_reviews WHERE review_id='${a.r.review_id}';`
    ),
    't'
  )
  await assert.rejects(
    accept(db, a.cmd),
    /recovery-owner-or-reviewer-unavailable/
  )
  await assert.rejects(review(db, a.r), /recovery-review-payload-conflict/)
  assert.equal(await quota(db), 0)
})
test('review audit and consumption are immutable; private tables/helpers deny all client and service grants', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  await accept(db, a.cmd)
  for (const table of RECOVERY_TABLES) {
    await assert.rejects(
      db.sql(
        `DELETE FROM private.${table} WHERE review_id='${a.r.review_id}';`
      ),
      /immutable-creation-recovery-audit/
    )
    const assignment = table.endsWith('reviews')
      ? "audit_reference='fixture://forged'"
      : "command_sha256=REPEAT('a',64)"
    await assert.rejects(
      db.sql(
        `UPDATE private.${table} SET ${assignment} WHERE review_id='${a.r.review_id}';`
      ),
      /immutable-creation-recovery-audit/
    )
    for (const role of ['anon', 'authenticated', 'service_role'])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; SELECT * FROM private.${table};`),
        /permission denied/
      )
    assert.equal(
      await db.sql(
        `SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='private.${table}'::REGCLASS;`
      ),
      't'
    )
  }
  for (const role of ['anon', 'service_role'])
    for (const sql of [reviewSQL(a.r), acceptSQL(a.cmd)])
      await assert.rejects(
        db.sql(`SET ROLE ${role}; ${sql}`),
        /permission denied/
      )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        'SELECT private.lock_dictionary_creation_recovery_authority(NULL,NULL);'
      )
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(asUser(null, acceptSQL(a.cmd))),
    /authentication-required/
  )
})
test('upgrade preserves paid/approval bytes and default OFF without rewriting prior schema', async () => {
  const prior = await createCluster({
    throughMigration: '20261010200000_add_dictionary_creation_publication.sql',
  })
  try {
    await seedUsers(prior)
    const f = await generated(prior)
    const before = await accounting(prior, f)
    await prior.sql(
      readFileSync(
        new URL(
          '../../supabase/migrations/20261011210000_add_dictionary_creation_recovery.sql',
          import.meta.url
        ),
        'utf8'
      )
    )
    assert.deepEqual(await accounting(prior, f), before)
    assert.equal(
      await prior.sql(
        'SELECT creation_recovery_enabled FROM private.dictionary_content_runtime;'
      ),
      'f'
    )
    assert.equal(
      await prior.sql(
        `SELECT policy_sha256='${POLICY}' FROM private.dictionary_creation_profile WHERE validator_version='${VERSION}';`
      ),
      't'
    )
  } finally {
    await prior.close()
  }
})

test('repeated known failure recovery uses monotonic fences and individually reserved generation slots', async () => {
  const f = await definitive(db)
  const a = await approved(db, f)
  const first = await accept(db, a.cmd)
  const work = await json(
    db,
    service(
      `SELECT public.get_dictionary_creation_work_v1('${owner}','${a.cmd.operation_id}');`
    )
  )
  const next = { ...f, run: work.run_id, cmd: a.cmd, receipt: first }
  const d = (await start(db, next, '2')).dispatch
  await json(
    db,
    service(
      `SELECT public.record_dictionary_creation_failure_v1('${next.run}','2',${literal(d.input_sha256)},TRUE,${literal('e'.repeat(64))});`
    )
  )
  const original = await accounting(db, next)
  const b = await approved(db, next)
  assert.equal((await accept(db, b.cmd)).fence, '3')
  assert.equal(await quota(db), 3)
  assert.deepEqual(await accounting(db, next), original)
  assert.equal((await counts(db, f)).runs, 3)
  await assert.rejects(
    review(db, await request(db, f)),
    /creation-recovery-frontier-conflict/
  )
})
test('recovery fence above JS safe range stays canonical decimal text', async () => {
  const f = await frontier(db, await definitive(db), '9007199254740993')
  const before = await accounting(db, f)
  const a = await approved(db, f)
  const receipt = await accept(db, a.cmd)
  assert.equal(receipt.fence, '9007199254740994')
  assert.deepEqual(await accounting(db, f), before)
  assert.deepEqual(await accept(db, a.cmd), receipt)
})
test('BIGINT fence exhaustion fails before quota or lease handover', async () => {
  const f = await frontier(db, await definitive(db), '9223372036854775807')
  const a = await approved(db, f)
  const before = await counts(db, f)
  const charged = await quota(db)
  await assert.rejects(accept(db, a.cmd), /bigint out of range/)
  assert.deepEqual(await counts(db, f), before)
  assert.equal(await quota(db), charged)
})
test('an unresolved attempt hidden under a terminal review status remains quarantined', async () => {
  await configure(db)
  const f = await ready(db)
  await fail(db, f, (await start(db, f)).dispatch)
  await db.sql(
    `UPDATE private.dictionary_creation_runs SET status='review-required',error_code='review-required' WHERE run_id='${f.run}';`
  )
  await assert.rejects(
    review(db, await request(db, f)),
    /creation-recovery-unknown-quarantined/
  )
  assert.equal(await quota(db), 1)
})

test('UTC snapshot/receipt bindings survive different review and owner session time zones', async () => {
  const f = await definitive(db)
  const r = await request(db, f)
  const receipt = await json(
    db,
    asUser(other, `SET TIME ZONE 'Europe/Amsterdam'; ${reviewSQL(r)}`)
  )
  assert.match(receipt.expires_at, /Z$/)
  assert.deepEqual(
    await json(
      db,
      asUser(other, `SET TIME ZONE 'Pacific/Auckland'; ${reviewSQL(r)}`)
    ),
    receipt
  )
  const accepted = await json(
    db,
    asUser(owner, `SET TIME ZONE 'Asia/Tokyo'; ${acceptSQL(command(r))}`)
  )
  assert.equal(accepted.fence, '2')
})
test('judge quota denial preserves its uncharged terminal intent during later explicit recovery', async () => {
  await configure(db)
  const f = await generated(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=1;'
  )
  assert.equal((await judge(db, f)).dispatch, null)
  const original = await accounting(db, f)
  assert.equal(original.judge.status, 'quota-denied')
  assert.equal(original.judge.quota_charged, false)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=100;'
  )
  const a = await approved(db, f)
  await accept(db, a.cmd)
  assert.equal(await quota(db), 2)
  assert.deepEqual(await accounting(db, f), original)
})
test('schema rejection before any judge may recover only as a new charged generation', async () => {
  await configure(db)
  const f = await generated(db, { dutch_lemma: 'bank' })
  await assert.rejects(judge(db, f), /creation-candidate-invalid/)
  assert.equal((await validate(db, f)).outcome, 'rejected')
  const original = await accounting(db, f)
  assert.equal(original.run.status, 'rejected')
  assert.equal(original.judge, null)
  const a = await approved(db, f)
  await accept(db, a.cmd)
  assert.equal(await quota(db), 2)
  assert.deepEqual(await accounting(db, f), original)
})
