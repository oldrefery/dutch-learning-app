import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  buildSemanticPolicy,
  prepareSemanticRequest,
  SEMANTIC_DIMENSIONS,
} from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers, literal, asUser } from './fixtures.mjs'

let db
const digest = 'a'.repeat(64),
  UNKNOWN = 'provider-outcome-unknown',
  FINANCIAL = 'financial institution',
  MODEL = 'gemini-fixture-model'
const hash = value =>
  createHash('sha256').update(canonicalizeJson(value)).digest('hex')
const original = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: [FINANCIAL], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I keep money at the bank.',
      ru: null,
    },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: 'Initial reviewed financial meaning.',
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const cefrHash = content =>
  hash({
    assessment_schema_version: 1,
    content: Object.fromEntries(
      Object.entries(content).filter(
        ([key]) => !['image_url', 'tts_url'].includes(key)
      )
    ),
  })
const service = sql => `SET ROLE service_role; ${sql}`
const json = sql => db.sql(sql).then(JSON.parse)
const quota = () =>
  db
    .sql(
      `SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${owner}' AND capability='gemini-analysis';`
    )
    .then(Number)
const read = f =>
  json(
    service(
      `SELECT public.get_dictionary_semantic_check_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}');`
    )
  )
const startSql =
  f => `SELECT public.start_dictionary_semantic_check_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}',
  '${f.policy.validator_version}','${f.policy.policy_sha256}','${f.policy.model}','${f.policy.prompt_sha256}','${f.contentHash}','${f.request.input_sha256}');`
const start = f => json(service(startSql(f)))
const validate = (f, packet = f.packet) =>
  json(
    service(
      `SELECT public.record_dictionary_analysis_validation_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}',${literal(JSON.stringify(packet))});`
    )
  )
const journal = (f, verdict = f.verdict, version = MODEL) =>
  json(
    service(`SELECT public.journal_dictionary_semantic_result_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}',
  ${literal(JSON.stringify({ content: verdict, provider_response: { responseId: 'synthetic-judge', ...(version === null ? {} : { modelVersion: version }) } }))},'synthetic-judge');`)
  )
const unknown = f =>
  json(
    service(
      `SELECT public.record_dictionary_semantic_failure_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}','${UNKNOWN}',NULL);`
    )
  )
const parent = f =>
  json(
    asUser(
      owner,
      `SELECT public.get_dictionary_analysis_operation_v2('${f.command.operation_id}');`
    )
  )
const head = f =>
  db.sql(
    `SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.command.entry_id}';`
  )
async function fixture(overrides = {}, version = MODEL) {
  // The Auth-deletion regression removes this actor; later fixtures recreate it.
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${owner}','review-owner@example.invalid') ON CONFLICT(id) DO NOTHING;`
  )
  const entry = randomUUID(),
    revision = randomUUID(),
    source = randomUUID(),
    anchor = randomUUID()
  const policy = await buildSemanticPolicy(MODEL, [], MODEL, {
    generation: MODEL,
    judge: MODEL,
  })
  await db.sql(`DELETE FROM public.edge_function_rate_limits WHERE user_id='${owner}';
    UPDATE private.dictionary_content_runtime SET following_reads_enabled=TRUE,analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE,semantic_checks_enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,media_url_prefixes,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model_version,semantic_model_version)
      VALUES('${policy.validator_version}','${policy.policy_sha256}',TRUE,ARRAY[]::TEXT[],'fixture://independent-semantic-local','independent-gemini-v1','${MODEL}','${policy.prompt_sha256}','${MODEL}','${MODEL}') ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
      VALUES('${source}','editorial','fixture://semantic-human','approved','${owner}',NOW(),'${hash(original)}');
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key) VALUES('${entry}','nl','bank','noun','de','financial-institution');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      VALUES('${revision}','${entry}',1,${literal(JSON.stringify(original))},'${hash(original)}','${cefrHash(original)}','${source}','published',NOW(),NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${entry}','${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
    INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
      VALUES('${anchor}','${entry}','${source}','A financial institution holding money and providing loans.','["Ik heb geld bij de bank."]','${owner}',NOW(),'fixture://semantic-anchor','${digest}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES('${entry}','${anchor}');`)
  const command = {
    protocol_version: 2,
    operation_id: randomUUID(),
    entry_id: entry,
    expected_revision_id: revision,
    expected_head_sequence: await db.sql(
      `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
    ),
  }
  const accepted = await json(
    asUser(
      owner,
      `SELECT public.accept_dictionary_analysis_v2(${literal(JSON.stringify(command))});`
    )
  )
  const grant = await json(
    service(
      `SELECT public.start_dictionary_analysis_dispatch_v1('${owner}','${command.operation_id}','${accepted.fence}','gemini','${MODEL}','${digest}');`
    )
  )
  const candidate = {
      ...original,
      analysis_notes: 'Updated financial meaning with clearer explanation.',
      ...overrides,
    },
    contentHash = hash(candidate)
  const receipt = await json(
    service(
      `SELECT public.journal_dictionary_analysis_result_v1('${owner}','${command.operation_id}','${accepted.fence}',${literal(JSON.stringify({ content: candidate, provider_response: version === null ? {} : { modelVersion: version } }))},'synthetic-generator');`
    )
  )
  const context = {
    receipt,
    input: grant.dispatch,
    input_sha256: digest,
    result: {
      content: candidate,
      provider_response: version === null ? {} : { modelVersion: version },
    },
  }
  const request = await prepareSemanticRequest(
    context,
    {
      valid: true,
      content: candidate,
      content_sha256: contentHash,
      cefr_input_sha256: cefrHash(candidate),
    },
    policy
  )
  const verdict = {
    schema_version: 1,
    anchor_sha256: grant.dispatch.anchor.anchor_sha256,
    content_sha256: contentHash,
    result_sha256: receipt.result_sha256,
    decision: 'same-meaning',
    checks: SEMANTIC_DIMENSIONS.map(dimension => ({
      dimension,
      verdict: 'preserved',
      reason: 'Synthetic financial-sense protocol fixture.',
      anchor_quote: FINANCIAL,
    })),
  }
  return {
    command,
    receipt,
    policy,
    request,
    context,
    verdict,
    candidate,
    contentHash,
    source,
  }
}
async function ready(f, version = MODEL) {
  await start(f)
  const saved = await journal(f, f.verdict, version)
  f.packet = {
    validator_version: f.policy.validator_version,
    policy_sha256: f.policy.policy_sha256,
    anchor_sha256: f.context.input.anchor.anchor_sha256,
    input_sha256: digest,
    result_sha256: f.receipt.result_sha256,
    meaning_evidence_sha256: hash({
      method: 'independent-gemini-v1',
      judge_input_sha256: f.request.input_sha256,
      judge_result_sha256: saved.check.result_sha256,
      verdict: f.verdict,
    }),
    outcome: 'accepted',
    decision_code: 'same-meaning',
    content: f.candidate,
    content_sha256: f.contentHash,
    cefr_input_sha256: cefrHash(f.candidate),
  }
  return f
}
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

test('semantic flag defaults OFF, no policies seeded and clients/service cannot mutate child journals', async () => {
  assert.equal(
    await db.sql(
      'SELECT semantic_checks_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      'SELECT COUNT(*) FROM private.dictionary_analysis_validator_policies;'
    ),
    '0'
  )
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(
      await db.sql(
        `SELECT has_table_privilege('${role}','private.dictionary_semantic_checks','select');`
      ),
      'f'
    )
  for (const role of ['anon', 'authenticated'])
    assert.equal(
      await db.sql(
        `SELECT has_function_privilege('${role}','public.get_dictionary_semantic_check_v1(uuid,uuid,text)','execute');`
      ),
      'f'
    )
})
test('independent dispatch charges exactly a second slot; concurrent/replayed dispatch yields one grant', async () => {
  const f = await fixture()
  assert.equal(await quota(), 1)
  const responses = await Promise.all([start(f), start(f)])
  assert.equal(responses.filter(value => value.dispatch).length, 1)
  assert.equal(await quota(), 2)
  assert.equal(responses[0].check.fence, f.receipt.fence)
  assert.equal((await start(f)).dispatch, false)
  assert.equal(await quota(), 2)
  assert.equal((await parent(f)).status, 'validating')
})
test('profile/input/fence conflicts and unqualified/disabled policy never buy another judge attempt', async () => {
  const f = await fixture()
  await start(f)
  await assert.rejects(
    json(
      service(
        startSql({
          ...f,
          request: { ...f.request, input_sha256: 'b'.repeat(64) },
        })
      )
    ),
    /operation-payload-conflict/
  )
  await assert.rejects(
    json(
      service(
        startSql({
          ...f,
          receipt: {
            ...f.receipt,
            fence: String(BigInt(f.receipt.fence) + BigInt(1)),
          },
        })
      )
    ),
    /stale-analysis-fence/
  )
  assert.equal(await quota(), 2)
  const unqualified = await fixture()
  await db.sql(
    `UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE policy_sha256='${unqualified.policy.policy_sha256}';`
  )
  await assert.rejects(start(unqualified), /validator-policy-unavailable/)
  assert.equal(await quota(), 1)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET semantic_checks_enabled=FALSE;'
  )
  await assert.rejects(start(unqualified), /semantic-check-disabled/)
  assert.equal(await quota(), 1)
})
test('second-slot quota denial persists one uncharged receipt and cannot be retried into a later paid call', async () => {
  const f = await fixture()
  await db.sql(
    `UPDATE public.edge_function_rate_limits SET request_count=10 WHERE user_id='${owner}' AND capability='gemini-analysis';`
  )
  const result = await start(f)
  assert.equal(result.dispatch, false)
  assert.equal(result.check.status, 'quota-denied')
  assert.equal(result.check.quota_charged, false)
  await db.sql(
    `UPDATE public.edge_function_rate_limits SET request_count=1 WHERE user_id='${owner}' AND capability='gemini-analysis';`
  )
  assert.equal((await start(f)).dispatch, false)
  assert.equal(await quota(), 1)
})
test('child/slot reservation rolls back atomically when journal insertion fails, then retry charges once', async () => {
  const f = await fixture()
  await db.sql(`CREATE FUNCTION private.fail_semantic_fixture() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected-child-failure'; END $$;
    CREATE TRIGGER fail_semantic_fixture BEFORE INSERT ON private.dictionary_semantic_checks FOR EACH ROW EXECUTE FUNCTION private.fail_semantic_fixture();`)
  await assert.rejects(start(f), /injected-child-failure/)
  assert.equal(await quota(), 1)
  assert.equal((await read(f)).check, null)
  await db.sql(
    'DROP TRIGGER fail_semantic_fixture ON private.dictionary_semantic_checks; DROP FUNCTION private.fail_semantic_fixture();'
  )
  assert.equal((await start(f)).dispatch, true)
  assert.equal(await quota(), 2)
})
test('accepted new policy requires independent grounded/bound result, publishes atomically and replays after disablement', async () => {
  const f = await ready(await fixture())
  const bad = { ...f.packet, meaning_evidence_sha256: 'e'.repeat(64) }
  await assert.rejects(validate(f, bad), /semantic-evidence-hash-mismatch/)
  const validated = await validate(f)
  const publish = () =>
    json(
      service(
        `SELECT public.publish_dictionary_analysis_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}','${validated.validation_id}');`
      )
    )
  const saved = await publish()
  assert.equal(saved.status, 'published')
  assert.equal(await quota(), 2)
  assert.notEqual(await head(f), f.command.expected_revision_id)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=FALSE,analysis_publication_enabled=FALSE,semantic_checks_enabled=FALSE; UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;'
  )
  assert.deepEqual(await publish(), saved)
  assert.equal(await quota(), 2)
})
test('same English but furniture Russian cannot be accepted from an independent contradictory verdict', async () => {
  const f = await fixture({
    translations: { en: [FINANCIAL], ru: ['скамейка'] },
  })
  f.verdict.decision = 'different-meaning'
  f.verdict.checks[1].verdict = 'contradicted'
  f.verdict.checks[1].reason =
    'Russian denotes furniture, not a financial institution.'
  await ready(f)
  await assert.rejects(validate(f), /independent-semantic-evidence-required/)
  const rejected = await validate(f, {
    ...f.packet,
    outcome: 'rejected',
    decision_code: 'meaning-mismatch',
    content: null,
    content_sha256: null,
    cefr_input_sha256: null,
  })
  assert.equal(rejected.receipt.status, 'rejected')
  assert.equal(await head(f), f.command.expected_revision_id)
  assert.equal(await quota(), 2)
})
test('unknown/late judge result blocks generic parent reconciliation; exact explicit child reconciliation resumes without another call/slot', async () => {
  const f = await fixture()
  await start(f)
  await unknown(f)
  const late = await journal(f)
  assert.equal(late.check.status, UNKNOWN)
  assert.equal(late.receipt.status, UNKNOWN)
  await assert.rejects(
    json(
      service(
        `SELECT public.reconcile_dictionary_analysis_result_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}','${f.receipt.result_sha256}','${digest}');`
      )
    ),
    /semantic-result-reconciliation-required/
  )
  assert.equal((await start(f)).dispatch, false)
  assert.equal(await quota(), 2)
  const reconcile = hashValue =>
    json(
      service(
        `SELECT public.reconcile_dictionary_semantic_result_v1('${owner}','${f.command.operation_id}','${f.receipt.fence}','${hashValue}','${digest}');`
      )
    )
  await assert.rejects(reconcile('e'.repeat(64)), /result-evidence-mismatch/)
  assert.equal(
    (await reconcile(late.check.result_sha256)).receipt.status,
    'validating'
  )
  assert.equal(
    (await reconcile(late.check.result_sha256)).check.status,
    'returned'
  )
  assert.equal(await quota(), 2)
  await ready(f)
  assert.equal((await validate(f)).outcome, 'accepted')
  assert.equal(await quota(), 2)
})
test('current role/head fences run before second-slot charge; trusted read_only administrator remains eligible', async () => {
  const revoked = await fixture()
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await start(revoked)).receipt.status, 'authorization-revoked')
  assert.equal(await quota(), 1)
  const administrator = await fixture()
  await db.sql(`UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';
    INSERT INTO private.dictionary_administrators(user_id,enabled,audit_reference) VALUES('${owner}',TRUE,'fixture://semantic-admin') ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`)
  assert.equal((await start(administrator)).dispatch, true)
  assert.equal(await quota(), 2)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${owner}';`
  )
  const conflict = await fixture()
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${conflict.command.entry_id}';`
  )
  assert.equal((await start(conflict)).receipt.status, 'head-conflict')
  assert.equal(await quota(), 1)
})
test('immutable returned child/result receipts reject mismatched replay; Auth deletion cascades journals and preserves shared head', async () => {
  const f = await fixture()
  await start(f)
  const saved = await journal(f)
  assert.deepEqual(await journal(f), saved)
  await assert.rejects(
    journal(f, { ...f.verdict, decision: 'uncertain' }),
    /operation-payload-conflict/
  )
  await assert.rejects(
    json(
      service(
        `SELECT public.get_dictionary_semantic_check_v1('${other}','${f.command.operation_id}','${f.receipt.fence}');`
      )
    ),
    /query returned no rows/
  )
  await db.sql(`DELETE FROM auth.users WHERE id='${owner}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_semantic_checks WHERE actor_id='${owner}';`
    ),
    '0'
  )
  assert.equal(await head(f), f.command.expected_revision_id)
})

for (const version of [null, 'gemini-unqualified-version']) {
  test(`SQL blocks unqualified generation version ${version} before committing a child slot`, async () => {
    const f = await fixture({}, version)
    await assert.rejects(start(f), /generation-model-version-unqualified/)
    assert.equal(await quota(), 1)
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.dictionary_semantic_checks WHERE operation_id='${f.command.operation_id}';`
      ),
      '0'
    )
    assert.equal(await head(f), f.command.expected_revision_id)
  })
  test(`SQL blocks accepted proof with unqualified judge version ${version}`, async () => {
    const f = await fixture()
    await ready(f, version)
    await assert.rejects(validate(f), /semantic-model-version-unqualified/)
    assert.equal(await quota(), 2)
    assert.equal(await head(f), f.command.expected_revision_id)
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM private.dictionary_analysis_validations WHERE operation_id='${f.command.operation_id}';`
      ),
      '0'
    )
  })
}
