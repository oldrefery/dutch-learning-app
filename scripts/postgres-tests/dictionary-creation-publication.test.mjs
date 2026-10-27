import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal, owner, other, seedUsers } from './fixtures.mjs'
import {
  POLICY,
  VERSION,
  EVIDENCE,
  json,
  service,
  checked,
  ready,
  start,
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
  record,
  validate,
  publish,
  validated,
} from './dictionary-creation-publication.fixture.mjs'

let db
const UNKNOWN = 'provider-outcome-unknown'
const REJECTED = 'rejected'
const REVIEW = 'review-required'
const CURSOR_SQL =
  'SELECT committed_version FROM private.dictionary_delivery_cursor;'
before(async () => {
  db = await createCluster({
    // Historical core contract; current paid containment uses all migrations in dictionary-paid-* and the endpoint suite.
    throughMigration:
      '20261025093000_add_dictionary_capability_release_gate.sql',
  })
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})
const noHead = async f =>
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.identity.entry_id}';`
    ),
    '0'
  )
const attempt = f =>
  json(
    db,
    `SELECT TO_JSONB(a) FROM private.dictionary_creation_judge_attempts a WHERE run_id='${f.run}';`
  )
const expire = async f => {
  await db.sql(
    "ALTER TABLE private.dictionary_creation_judge_attempts ALTER COLUMN dispatched_at SET DEFAULT (NOW()-INTERVAL '3 minutes');"
  )
  try {
    return (await judge(db, f)).dispatch
  } finally {
    await db.sql(
      'ALTER TABLE private.dictionary_creation_judge_attempts ALTER COLUMN dispatched_at SET DEFAULT NOW();'
    )
  }
}
const reconcile = (f, hash, evidence = EVIDENCE) =>
  json(
    db,
    service(
      `SELECT public.reconcile_dictionary_creation_judgement_v1('${f.run}','1',${literal(hash)},${literal(evidence)});`
    )
  )

test('new gates default OFF and independent judgement remains unseeded', async () => {
  assert.equal(
    await db.sql(
      'SELECT creation_judgement_enabled OR creation_publication_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      'SELECT COUNT(*) FROM private.dictionary_creation_judge_attempts;'
    ),
    '0'
  )
})
test('separate concurrent judge intent charges once, excludes private/generator confidence', async () => {
  const f = await generated(db)
  const responses = await Promise.all([judge(db, f), judge(db, f)])
  assert.equal(responses.filter(r => r.dispatch).length, 1)
  const d = responses.find(r => r.dispatch).dispatch
  assert.equal(await quota(db), 2)
  assert.equal(d.model, 'gemini-judge-fixture')
  for (const secret of [
    'Private owner hint',
    'Never a judge input',
    'confidence',
    'reasoning',
    'original_query',
  ])
    assert.equal(JSON.stringify(d.input).includes(secret), false)
  assert.equal((await judge(db, f)).dispatch, null)
  await record(db, f, d)
  const v = await validate(db, f)
  assert.equal(v.outcome, 'accepted')
  assert.deepEqual(await validate(db, f), v)
  await noHead(f)
})
test('first publication revision1 has one actual global cursor above JS safe range and immutable replay', async () => {
  const f = await validated(db)
  const before = await snapshots(db)
  await db.sql(
    'UPDATE private.dictionary_delivery_cursor SET committed_version=9007199254740993;'
  )
  const receipts = await Promise.all([
    publish(db, f, f.validation),
    publish(db, f, f.validation),
  ])
  assert.deepEqual(receipts[0], receipts[1])
  const receipt = checked(receipts[0])
  assert.equal(receipt.published_head_sequence, '9007199254740994')
  assert.equal(
    await db.sql(
      `SELECT revision_no FROM public.dictionary_revisions WHERE entry_id='${f.identity.entry_id}';`
    ),
    '1'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_content_changes WHERE entry_id='${f.identity.entry_id}';`
    ),
    '1'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_leases WHERE run_id='${f.run}';`
    ),
    '0'
  )
  assert.equal(await quota(db), 2)
  assert.deepEqual(await snapshots(db), before)
  assert.deepEqual(await read(db, f), receipt)
  assert.deepEqual(await replay(db, f), receipt)
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET creation_publication_enabled=FALSE; UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}'; UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE validator_version='${VERSION}';`
  )
  assert.deepEqual(await publish(db, f, f.validation), receipt)
  assert.deepEqual(await read(db, f), receipt)
  await assert.rejects(
    publish(db, f, randomUUID()),
    /creation-validation-mismatch/
  )
  const provenance = await json(
    db,
    asUser(
      other,
      `SELECT public.get_dictionary_revision_provenance_v2(ARRAY['${receipt.published.reference.revision_id}']::UUID[]);`
    )
  )
  assert.equal(provenance[0].method, 'automated')
  assert.equal(provenance[0].validator_version, VERSION)
  assert.equal(provenance[0].model, 'gemini-generator-fixture')
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_sources WHERE creation_validation_id='${f.validation}' AND reviewed_by IS NULL AND reviewed_at IS NULL AND automated_validation_id IS NULL;`
    ),
    '1'
  )
})
for (const [code, change] of [
  ['schema-invalid', c => ({ ...c, injected: true })],
  ['identity-mismatch', c => ({ ...c, dutch_lemma: 'stoel' })],
  ['unsafe-media', c => ({ ...c, image_url: 'https://evil.test/private.png' })],
])
  test(`strict ${code} rejects before the second charge`, async () => {
    const f = await generated(db, change(content()))
    await assert.rejects(judge(db, f), /creation-candidate-invalid/)
    assert.equal(await quota(db), 1)
    const v = await validate(db, f)
    assert.equal(v.outcome, REJECTED)
    assert.equal(v.decision_code, code)
    checked(v.receipt)
    assert.deepEqual(await validate(db, f), v)
    await assert.rejects(
      publish(db, f, v.validation_id),
      /creation-validation-mismatch/
    )
    await noHead(f)
  })
for (const [value, outcome, decision] of [
  ['contradicted', REJECTED, 'meaning-mismatch'],
  ['uncertain', REVIEW, 'meaning-uncertain'],
])
  test(`grounded ${value} stays unpublished`, async () => {
    const f = await generated(db)
    const d = (await judge(db, f)).dispatch
    await record(db, f, d, verdict(d, value))
    const v = await validate(db, f)
    assert.equal(v.outcome, outcome)
    assert.equal(v.decision_code, decision)
    checked(v.receipt)
    await noHead(f)
  })
for (const [label, mutate] of [
  [
    'duplicate dimension',
    v => {
      v.content.checks[0].dimension = 'grammar'
    },
  ],
  [
    'ungrounded quote',
    v => {
      v.content.checks[0].anchor_quote = 'Private owner hint'
    },
  ],
  [
    'false same meaning',
    v => {
      v.content.checks[0].verdict = 'contradicted'
    },
  ],
  [
    'wrong result hash',
    v => {
      v.content.result_sha256 = 'f'.repeat(64)
    },
  ],
  [
    'missing verdict',
    v => {
      delete v.content.checks[0].verdict
    },
  ],
  [
    'extra field',
    v => {
      v.content.approved = true
    },
  ],
])
  test(`cannot validate ${label}`, async () => {
    const f = await generated(db)
    const d = (await judge(db, f)).dispatch
    const raw = verdict(d)
    mutate(raw)
    await record(db, f, d, raw)
    await assert.rejects(
      validate(db, f),
      /independent-creation-evidence-required|inconsistent-creation-verdict/
    )
    await noHead(f)
  })
test('no returned judge means no fabricated accepted validation', async () => {
  const f = await generated(db)
  await assert.rejects(validate(db, f), /query returned no rows/)
  await assert.rejects(
    db.sql(
      `INSERT INTO private.dictionary_creation_validations(run_id,proof) VALUES('${f.run}','{"outcome":"accepted"}');`
    ),
    /query returned no rows|derived-creation-validation-required/
  )
  await noHead(f)
})
test('unknown late judge result quarantines and requires exact audited reconciliation', async () => {
  const f = await generated(db)
  const d = await expire(f)
  const raw = verdict(d)
  assert.equal((await record(db, f, d, raw)).status, UNKNOWN)
  assert.equal((await judge(db, f)).dispatch, null)
  await assert.rejects(validate(db, f), /invalid-creation-transition/)
  const a = await attempt(f)
  await assert.rejects(
    reconcile(f, a.result_sha256, null),
    /invalid-creation-reconciliation/
  )
  const receipt = await reconcile(f, a.result_sha256)
  assert.equal(receipt.status, 'validating')
  assert.deepEqual(await reconcile(f, a.result_sha256), receipt)
  await assert.rejects(
    reconcile(f, a.result_sha256, 'f'.repeat(64)),
    /creation-reconciliation-conflict/
  )
  const v = await validate(db, f)
  assert.equal(v.outcome, 'accepted')
  assert.equal(await quota(db), 2)
})
test('judge quota denial retains one uncharged terminal intent without redispatch', async () => {
  const f = await generated(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=1;'
  )
  const response = await judge(db, f)
  assert.equal(response.dispatch, null)
  assert.equal(response.receipt.status, REVIEW)
  assert.equal((await attempt(f)).quota_charged, false)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_quota_limit=100;'
  )
  assert.equal((await judge(db, f)).dispatch, null)
  assert.equal(await quota(db), 1)
  await noHead(f)
})
test('judge request/input/fence bindings and immutable response cannot be replaced', async () => {
  const f = await generated(db)
  const d = (await judge(db, f)).dispatch
  await assert.rejects(judge(db, f, '01'), /creation-fence-conflict/)
  await assert.rejects(
    record(db, f, { ...d, input_sha256: 'f'.repeat(64) }),
    /creation-attempt-conflict/
  )
  const raw = verdict(d)
  const receipt = await record(db, f, d, raw, 'judge-request-1')
  assert.deepEqual(await record(db, f, d, raw, 'judge-request-1'), receipt)
  await assert.rejects(
    record(db, f, d, raw, 'changed'),
    /creation-result-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_creation_judge_attempts SET model='gemini-other' WHERE run_id='${f.run}';`
    ),
    /immutable-creation-attempt/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_creation_judge_attempts WHERE run_id='${f.run}';`
    ),
    /immutable-creation-accounting/
  )
})
for (const [label, sql] of [
  [
    'permission',
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`,
  ],
  [
    'publication gate',
    'UPDATE private.dictionary_content_runtime SET creation_publication_enabled=FALSE;',
  ],
  [
    'judge gate',
    'UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=FALSE;',
  ],
  [
    'policy',
    `UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE validator_version='${VERSION}' AND policy_sha256='${POLICY}';`,
  ],
])
  test(`fresh ${label} withdrawal prevents first publication`, async () => {
    const f = await validated(db)
    await db.sql(sql)
    await assert.rejects(
      publish(db, f, f.validation),
      /analysis-permission-required|creation-publication-unavailable/
    )
    await noHead(f)
  })
test('fresh identity availability and anchor head withdrawal prevents publication', async () => {
  const f = await validated(db)
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.identity.identity_id}';`
  )
  await assert.rejects(
    publish(db, f, f.validation),
    /creation-publication-unavailable/
  )
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=TRUE WHERE identity_id='${f.identity.identity_id}'; DELETE FROM private.dictionary_meaning_anchor_heads WHERE entry_id='${f.identity.entry_id}';`
  )
  await assert.rejects(
    publish(db, f, f.validation),
    /creation-publication-unavailable/
  )
  await noHead(f)
})
test('publication transaction rollback removes source revision head event permit and receipt together', async () => {
  const f = await validated(db)
  const cursor = await db.sql(CURSOR_SQL)
  await assert.rejects(
    db.sql(
      `BEGIN; SET ROLE service_role; SELECT public.publish_dictionary_creation_v1('${f.run}','1','${f.validation}'); RESET ROLE; SELECT 1/0; COMMIT;`
    ),
    /division by zero/
  )
  await noHead(f)
  assert.equal(await db.sql(CURSOR_SQL), cursor)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_publications WHERE validation_id='${f.validation}';`
    ),
    '0'
  )
  assert.equal((await read(db, f)).status, 'validating')
  assert.equal((await publish(db, f, f.validation)).status, 'published')
})
test('ordinary roles cannot invoke service judgement/publication or read durable proof', async () => {
  const functions = await json(
    db,
    `SELECT JSON_AGG(proname ORDER BY proname) FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (
    'get_dictionary_creation_judgement_v1','start_dictionary_creation_judgement_v1','record_dictionary_creation_judgement_v1',
    'fail_dictionary_creation_judgement_v1','reconcile_dictionary_creation_judgement_v1','validate_dictionary_creation_v1','publish_dictionary_creation_v1');`
  )
  assert.equal(functions.length, 7)
  for (const role of ['anon', 'authenticated'])
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[${functions.map(literal).join(',')}]) AND has_function_privilege('${role}',oid,'EXECUTE');`
      ),
      '0'
    )
  for (const role of ['anon', 'authenticated', 'service_role'])
    for (const table of [
      'dictionary_creation_judge_attempts',
      'dictionary_creation_validations',
      'dictionary_creation_publications',
    ]) {
      assert.equal(
        await db.sql(
          `SELECT has_table_privilege('${role}','private.${table}','SELECT,INSERT,UPDATE,DELETE');`
        ),
        'f'
      )
      assert.equal(
        await db.sql(
          `SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='private.${table}'::regclass;`
        ),
        't'
      )
    }
})
test('Auth deletion retains in-flight judge quarantine; recreated UUID cannot reconcile', async () => {
  const f = await generated(db, content(), other)
  const d = (await judge(db, f)).dispatch
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_leases WHERE run_id='${f.run}';`
    ),
    '1'
  )
  assert.equal((await record(db, f, d)).status, UNKNOWN)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${other}','recreated@example.invalid');`
  )
  const a = await attempt(f)
  await assert.rejects(
    reconcile(f, a.result_sha256),
    /analysis-permission-required/
  )
  assert.equal(await read(db, f), null)
  await noHead(f)
})
test('published receipt/provenance survive Auth deletion; recreated UUID gets no ownership', async () => {
  const f = await validated(db, other)
  const receipt = await publish(db, f, f.validation)
  await db.sql(`DELETE FROM auth.users WHERE id='${other}';`)
  assert.deepEqual(await publish(db, f, f.validation), receipt)
  assert.equal(
    await db.sql(
      `SELECT actor_id IS NULL FROM private.dictionary_creation_runs WHERE run_id='${f.run}';`
    ),
    't'
  )
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${other}','recreated@example.invalid');`
  )
  assert.equal(await read(db, f), null)
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_creation_runs SET publication_receipt='{}' WHERE run_id='${f.run}';`
    ),
    /immutable-creation-publication-receipt/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_creation_validations SET proof='{}' WHERE validation_id='${f.validation}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_sources WHERE creation_validation_id='${f.validation}';`
    ),
    /immutable/
  )
})
test('upgrade preserves old registered source hash and accepted neutral generation authority', async () => {
  const old = await createCluster({
    throughMigration: '20261010190000_add_dictionary_creation_dispatch.sql',
  })
  try {
    await seedUsers(old)
    const { configure: configureOld } =
      await import('./dictionary-creation-dispatch.fixture.mjs')
    await configureOld(old)
    const f = await ready(old)
    const hash = await old.sql(
      `SELECT source_approval_sha256 FROM private.dictionary_creation_identities WHERE identity_id='${f.identity.identity_id}';`
    )
    await old.sql(
      readFileSync(
        'supabase/migrations/20261010200000_add_dictionary_creation_publication.sql',
        'utf8'
      )
    )
    assert.equal(
      await old.sql(
        `SELECT source_approval_sha256 FROM private.dictionary_creation_identities WHERE identity_id='${f.identity.identity_id}';`
      ),
      hash
    )
    assert.equal(
      await old.sql(
        `SELECT private.dictionary_creation_identity_ready(i) FROM private.dictionary_creation_identities i WHERE identity_id='${f.identity.identity_id}';`
      ),
      't'
    )
    assert.ok((await start(old, f)).dispatch)
    assert.equal(
      await old.sql(
        'SELECT creation_judgement_enabled OR creation_publication_enabled FROM private.dictionary_content_runtime;'
      ),
      'f'
    )
  } finally {
    await old.close()
  }
})

test('known judge failure is documented and cannot be redispatched or replaced', async () => {
  const f = await generated(db)
  const d = (await judge(db, f)).dispatch
  const failure = (known, evidence) =>
    json(
      db,
      service(
        `SELECT public.fail_dictionary_creation_judgement_v1('${f.run}','1','${d.input_sha256}',${known},${literal(evidence)});`
      )
    )
  await assert.rejects(
    failure(true, null),
    /documented-creation-failure-required/
  )
  const receipt = checked(await failure(true, EVIDENCE))
  assert.equal(receipt.status, 'provider-failed')
  assert.deepEqual(await failure(true, EVIDENCE), receipt)
  assert.equal((await judge(db, f)).dispatch, null)
  await assert.rejects(
    record(db, f, d),
    /terminal-creation-run|terminal-creation-attempt/
  )
  await noHead(f)
})
test('unknown judge failure cannot become a free known failure or automatic retry', async () => {
  const f = await generated(db)
  const d = (await judge(db, f)).dispatch
  const failure = known =>
    json(
      db,
      service(
        `SELECT public.fail_dictionary_creation_judgement_v1('${f.run}','1','${d.input_sha256}',${known},'${EVIDENCE}');`
      )
    )
  assert.equal((await failure(false)).status, UNKNOWN)
  await assert.rejects(failure(true), /terminal-creation-attempt/)
  assert.equal((await judge(db, f)).dispatch, null)
  assert.equal((await record(db, f, d)).status, UNKNOWN)
  const a = await attempt(f)
  await reconcile(f, a.result_sha256)
  assert.equal((await validate(db, f)).outcome, 'accepted')
  assert.equal(await quota(db), 2)
})
test('first publication receipt survives later published heads and preserves original command', async () => {
  const f = await validated(db)
  const receipt = await publish(db, f, f.validation)
  const revision = randomUUID()
  const source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES('${source}','editorial','fixture://later-human-revision','approved','${owner}',NOW(),'${receipt.published.content_sha256}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      SELECT '${revision}',entry_id,2,1,content,content_sha256,cefr_input_sha256,'${source}','published',NOW(),NOW() FROM public.dictionary_revisions WHERE revision_id='${receipt.published.reference.revision_id}';
    UPDATE public.dictionary_entry_heads SET revision_id='${revision}' WHERE entry_id='${f.identity.entry_id}';`)
  assert.deepEqual(await publish(db, f, f.validation), receipt)
  assert.deepEqual(await replay(db, f), receipt)
  assert.equal(
    await db.sql(
      `SELECT receipt->>'status' FROM private.dictionary_creation_commands WHERE actor_id='${owner}' AND operation_id='${f.cmd.operation_id}';`
    ),
    'accepted'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_content_changes WHERE entry_id='${f.identity.entry_id}';`
    ),
    '2'
  )
})
test('cursor exhaustion rolls back the entire first publication and retains validation', async () => {
  const f = await validated(db)
  const cursor = await db.sql(CURSOR_SQL)
  await db.sql(
    'UPDATE private.dictionary_delivery_cursor SET committed_version=9223372036854775807;'
  )
  try {
    await assert.rejects(publish(db, f, f.validation), /bigint out of range/)
    await noHead(f)
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.dictionary_creation_publications WHERE validation_id='${f.validation}';`
      ),
      '0'
    )
    assert.equal((await read(db, f)).status, 'validating')
  } finally {
    await db.sql(
      `UPDATE private.dictionary_delivery_cursor SET committed_version=${cursor};`
    )
  }
})
test('creation machine provenance requires same-transaction publication permit', async () => {
  const f = await validated(db)
  await assert.rejects(
    db.sql(
      service(`INSERT INTO private.dictionary_sources(source_kind,provenance_locator,review_state,creation_validation_id)
    VALUES('provider','fixture://forged-machine-source','machine_validated','${f.validation}');`)
    ),
    /guarded-machine-publication-required/
  )
  await assert.rejects(
    db.sql(`INSERT INTO private.dictionary_sources(source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256,creation_validation_id)
    VALUES('editorial','fixture://forged-human-source','approved','${owner}',NOW(),'${'a'.repeat(64)}','${f.validation}');`),
    /dictionary_sources_review_fields/
  )
  await noHead(f)
})
test('reviewed source evidence is timezone-stable and unchanged by nullable provenance columns', async () => {
  const f = await generated(db)
  const expected = await db.sql(
    `SELECT source_approval_sha256 FROM private.dictionary_creation_identities WHERE identity_id='${f.identity.identity_id}';`
  )
  const actual = await db.sql(
    `SET timezone='Pacific/Auckland'; SELECT private.dictionary_canonical_sha256(private.dictionary_creation_source_evidence_v1(s)) FROM private.dictionary_sources s WHERE source_id='${f.identity.source_id}';`
  )
  assert.equal(actual, expected)
  const legacy = await db.sql(
    `SET timezone='UTC'; SELECT private.dictionary_canonical_sha256(TO_JSONB(s)-'creation_validation_id') FROM private.dictionary_sources s WHERE source_id='${f.identity.source_id}';`
  )
  assert.equal(legacy, expected)
})

test('fresh reserved profile withdrawal prevents publication without consuming another slot', async () => {
  const f = await validated(db)
  await db.sql('DELETE FROM private.dictionary_creation_profile;')
  await assert.rejects(
    publish(db, f, f.validation),
    /creation-publication-unavailable/
  )
  await noHead(f)
  assert.equal(await quota(db), 2)
})
test('judge dispatch requires current independent gate and actor authority', async () => {
  const f = await generated(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=FALSE;'
  )
  await assert.rejects(judge(db, f), /creation-judgement-unavailable/)
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=TRUE; UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  await assert.rejects(judge(db, f), /analysis-permission-required/)
  assert.equal(await quota(db), 1)
  assert.equal(await attempt(f), null)
})
test('known judge return after permission withdrawal is retained without publication authority', async () => {
  const f = await generated(db)
  const d = (await judge(db, f)).dispatch
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  const receipt = await record(db, f, d)
  assert.equal(receipt.status, 'authorization-revoked')
  assert.equal((await attempt(f)).status, 'returned')
  await assert.rejects(validate(db, f), /invalid-creation-transition/)
  assert.equal(await quota(db), 2)
  await noHead(f)
})
