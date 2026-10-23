import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { seedUsers, literal } from './fixtures.mjs'
import {
  configure,
  ready,
  start,
  journal,
  json,
  service,
  replay,
} from './dictionary-creation-dispatch.fixture.mjs'
import {
  content,
  judge,
  verdict,
  record,
  validate,
  publish,
} from './dictionary-creation-publication.fixture.mjs'
import { buildSemanticPolicy } from '../../supabase/functions/dictionary-analysis/semanticModel.ts'

let db
const GENERATOR = 'gemini-generator-fixture',
  JUDGE = 'gemini-judge-fixture'
const UNQUALIFIED = 'gemini-unqualified-version'
const REVIEW = 'review-required'
const VERSIONS = { generation: `${GENERATOR}-001`, judge: `${JUDGE}-001` }
let policy
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  policy = await buildSemanticPolicy(JUDGE, [], GENERATOR, VERSIONS)
})
after(async () => {
  await db?.close()
})

async function fixture(version = VERSIONS.generation) {
  await configure(db)
  await db.sql(`UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=TRUE,creation_publication_enabled=TRUE;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model,generation_model_version,semantic_model_version)
    VALUES('${policy.validator_version}','${policy.policy_sha256}',TRUE,'fixture://version-only','independent-gemini-v1','${JUDGE}','${policy.prompt_sha256}','${GENERATOR}','${VERSIONS.generation}','${VERSIONS.judge}')
    ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    UPDATE private.dictionary_creation_profile SET validator_version='${policy.validator_version}',policy_sha256='${policy.policy_sha256}' WHERE singleton;`)
  const f = await ready(db),
    dispatch = (await start(db, f)).dispatch
  const result = {
    content: content(),
    provider_response: version === null ? {} : { modelVersion: version },
  }
  return { ...f, dispatch, result }
}
const charged = f =>
  db.sql(
    `SELECT (SELECT COUNT(*) FROM private.dictionary_creation_generation_attempts WHERE run_id='${f.run}' AND quota_charged)+(SELECT COUNT(*) FROM private.dictionary_creation_judge_attempts WHERE run_id='${f.run}' AND quota_charged);`
  )
const noHead = f =>
  db.sql(
    `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}';`
  )

for (const version of [VERSIONS.judge, UNQUALIFIED])
  test(`early v3 validation preserves a pending judge and its later ${version} result`, async () => {
    const f = await fixture()
    await journal(db, f, f.dispatch, f.result)
    const d = (await judge(db, f)).dispatch
    await assert.rejects(
      validate(db, f),
      /independent-creation-evidence-required/
    )
    assert.equal((await replay(db, f)).status, 'validating')
    assert.equal(await charged(f), '2')
    assert.equal(await noHead(f), '0')
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.dictionary_creation_validations WHERE run_id='${f.run}';`
      ),
      '0'
    )
    assert.equal((await judge(db, f)).dispatch, null)
    const raw = {
      ...verdict(d),
      provider_response: { modelVersion: version },
    }
    const saved = await record(db, f, d, raw)
    assert.equal(saved.status, 'validating')
    assert.equal(
      await db.sql(
        `SELECT result=${literal(JSON.stringify(raw))}::JSONB AND status='returned' FROM private.dictionary_creation_judge_attempts WHERE run_id='${f.run}';`
      ),
      't'
    )
    const v = await validate(db, f)
    assert.equal(v.outcome, version === VERSIONS.judge ? 'accepted' : REVIEW)
    if (version === VERSIONS.judge) {
      const published = await publish(db, f, v.validation_id)
      assert.equal(published.status, 'published')
      assert.deepEqual(await replay(db, f), published)
    } else {
      assert.equal(await noHead(f), '0')
      assert.deepEqual(await replay(db, f), v.receipt)
    }
    assert.equal(await charged(f), '2')
  })

for (const version of [null, UNQUALIFIED, 7])
  test(`creation missing/mismatched generation version ${version} cannot charge a judge or publish`, async () => {
    const f = await fixture(version)
    await journal(db, f, f.dispatch, f.result)
    await assert.rejects(judge(db, f), /creation-candidate-invalid/)
    assert.equal(await charged(f), '1')
    const v = await validate(db, f)
    assert.equal(v.outcome, REVIEW)
    assert.equal(v.receipt.status, REVIEW)
    assert.equal(await noHead(f), '0')
    assert.deepEqual(await replay(db, f), v.receipt)
    assert.equal(await charged(f), '1')
  })

for (const version of [null, UNQUALIFIED, 7])
  test(`creation missing/mismatched judge version ${version} cannot produce accepted proof`, async () => {
    const f = await fixture()
    await journal(db, f, f.dispatch, f.result)
    const d = (await judge(db, f)).dispatch
    const raw = {
      ...verdict(d),
      provider_response: version === null ? {} : { modelVersion: version },
    }
    await record(db, f, d, raw)
    const v = await validate(db, f)
    assert.equal(v.outcome, REVIEW)
    assert.equal(v.receipt.status, REVIEW)
    assert.equal(await charged(f), '2')
    assert.equal(await noHead(f), '0')
    assert.deepEqual(await replay(db, f), v.receipt)
    await assert.rejects(publish(db, f, v.validation_id), /creation|transition/)
  })

test('matching observed versions permit one creation publication and exact replay', async () => {
  const f = await fixture()
  await journal(db, f, f.dispatch, f.result)
  const d = (await judge(db, f)).dispatch
  await record(db, f, d, {
    ...verdict(d),
    provider_response: { modelVersion: VERSIONS.judge },
  })
  const v = await validate(db, f)
  assert.equal(v.outcome, 'accepted')
  const p = await publish(db, f, v.validation_id)
  assert.equal(p.status, 'published')
  assert.deepEqual(await replay(db, f), p)
  assert.equal(await charged(f), '2')
})

for (const phase of ['generation', 'judgement'])
  test(`late unqualified ${phase} result retains accounting and requires review after reconciliation`, async () => {
    const f = await fixture(
      phase === 'generation' ? UNQUALIFIED : VERSIONS.generation
    )
    let grant = f.dispatch
    if (phase === 'judgement') {
      await journal(db, f, grant, f.result)
      grant = (await judge(db, f)).dispatch
    }
    const fail =
      phase === 'generation'
        ? 'record_dictionary_creation_failure_v1'
        : 'fail_dictionary_creation_judgement_v1'
    await json(
      db,
      service(
        `SELECT public.${fail}('${f.run}','1','${grant.input_sha256}',FALSE,NULL);`
      )
    )
    if (phase === 'generation') await journal(db, f, grant, f.result)
    else
      await record(db, f, grant, {
        ...verdict(grant),
        provider_response: { modelVersion: UNQUALIFIED },
      })
    const table =
      phase === 'generation'
        ? 'dictionary_creation_generation_attempts'
        : 'dictionary_creation_judge_attempts'
    const hash = await db.sql(
      `SELECT result_sha256 FROM private.${table} WHERE run_id='${f.run}';`
    )
    const reconcile =
      phase === 'generation'
        ? 'reconcile_dictionary_creation_result_v1'
        : 'reconcile_dictionary_creation_judgement_v1'
    await json(
      db,
      service(
        `SELECT public.${reconcile}('${f.run}','1','${hash}','${'e'.repeat(64)}');`
      )
    )
    if (phase === 'generation')
      await assert.rejects(judge(db, f), /creation-candidate-invalid/)
    const v = await validate(db, f)
    assert.equal(v.outcome, REVIEW)
    assert.equal(await noHead(f), '0')
    assert.equal(await charged(f), phase === 'generation' ? '1' : '2')
    assert.equal(
      await db.sql(
        `SELECT result_sha256 FROM private.${table} WHERE run_id='${f.run}';`
      ),
      hash
    )
  })

test('v3 registration needs both expected observed versions and canonical matching is exact', async () => {
  await assert.rejects(
    db.sql(`INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model)
    VALUES('${policy.validator_version}','${'a'.repeat(64)}',FALSE,'fixture://missing-versions','independent-gemini-v1','${JUDGE}','${policy.prompt_sha256}','${GENERATOR}');`),
    /dictionary_observed_versions_v3/
  )
  for (const actual of [null, 'gemini-generator-fixture-002', 7]) {
    const result = {
      provider_response: actual === null ? {} : { modelVersion: actual },
    }
    assert.equal(
      await db.sql(
        `SELECT private.dictionary_observed_model_matches(${literal(JSON.stringify(result))}::JSONB,'${VERSIONS.generation}');`
      ),
      'f'
    )
  }
})
