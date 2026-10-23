import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { prepareGeminiRequest } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { createCluster } from './cluster.mjs'
import { asUser, literal, owner, other, seedUsers } from './fixtures.mjs'

let db
const MODEL = 'gemini-fixture-model'
const UNKNOWN = 'provider-outcome-unknown'
const json = text => db.sql(text).then(value => JSON.parse(value))
const service = text => `SET ROLE service_role; ${text}`
const hash = value =>
  createHash('sha256').update(canonicalizeJson(value)).digest('hex')
const original = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I have money at the bank.',
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
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const cefrHash = hash({
  assessment_schema_version: 1,
  content: Object.fromEntries(
    Object.entries(original).filter(
      ([key]) => !['image_url', 'tts_url'].includes(key)
    )
  ),
})
const read = (command, fence, actor = owner) =>
  json(
    service(
      `SELECT public.get_dictionary_analysis_work_v1('${actor}', '${command.operation_id}', ${literal(fence)});`
    )
  )
const accept = command =>
  json(
    asUser(
      owner,
      `SELECT public.accept_dictionary_analysis_v2(${literal(JSON.stringify(command))});`
    )
  )
const dispatch = (command, fence, request) =>
  json(
    service(
      `SELECT public.start_dictionary_analysis_dispatch_v1('${owner}', '${command.operation_id}', '${fence}', 'gemini', '${request.model}', '${request.input_sha256}');`
    )
  )
const quota = () =>
  db
    .sql(
      `SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${owner}' AND capability='gemini-analysis';`
    )
    .then(Number)
async function fixture() {
  const entry = randomUUID(),
    revision = randomUUID(),
    anchor = randomUUID(),
    source = randomUUID()
  await db.sql(`DELETE FROM public.edge_function_rate_limits WHERE user_id='${owner}';
    UPDATE private.dictionary_content_runtime SET following_reads_enabled=TRUE, analysis_operations_enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator, review_state, reviewed_by, reviewed_at, approved_content_sha256)
      VALUES ('${source}', 'editorial', 'fixture://worker-reviewed', 'approved', '${owner}', NOW(), '${hash(original)}');
    INSERT INTO public.dictionary_entries(entry_id, language_code, lemma, part_of_speech, article, sense_key)
      VALUES ('${entry}', 'nl', 'bank', 'noun', 'de', 'financial-institution');
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, content, content_sha256, cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
      VALUES ('${revision}', '${entry}', 1, ${literal(JSON.stringify(original))}, '${hash(original)}', '${cefrHash}', '${source}', 'published', NOW(), NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id, revision_id) VALUES ('${entry}', '${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
    INSERT INTO private.dictionary_meaning_anchors(anchor_id, entry_id, source_id, gloss, examples, verified_by, verified_at, audit_reference, anchor_sha256)
      VALUES ('${anchor}', '${entry}', '${source}', 'A financial institution holding money and providing loans.', '["Ik heb geld bij de bank."]', '${owner}', NOW(), 'fixture://reviewed-anchor', '${'a'.repeat(64)}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id, anchor_id) VALUES ('${entry}', '${anchor}');`)
  return {
    protocol_version: 2,
    operation_id: randomUUID(),
    entry_id: entry,
    expected_revision_id: revision,
    expected_head_sequence: await db.sql(
      `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
    ),
  }
}
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('worker migration enables nothing and seeds no real authority or validator', async () => {
  assert.deepEqual(
    await json(
      `SELECT JSONB_BUILD_OBJECT('analysis',analysis_operations_enabled,'publication',analysis_publication_enabled) FROM private.dictionary_content_runtime;`
    ),
    { analysis: false, publication: false }
  )
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_administrators;'),
    '0'
  )
  assert.equal(
    await db.sql(
      'SELECT COUNT(*) FROM private.dictionary_analysis_validator_policies;'
    ),
    '0'
  )
})
test('protected worker read is service-only and preserves existing table ACLs', async () => {
  assert.equal(
    await db.sql(
      `SELECT has_function_privilege('service_role','public.get_dictionary_analysis_work_v1(uuid,uuid,text)','execute');`
    ),
    't'
  )
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await db.sql(
        `SELECT has_function_privilege('${role}','public.get_dictionary_analysis_work_v1(uuid,uuid,text)','execute');`
      ),
      'f'
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT public.get_dictionary_analysis_work_v1('${owner}','${randomUUID()}','1');`
      ),
      /permission denied/
    )
  }
  for (const role of ['anon', 'authenticated'])
    assert.equal(
      await db.sql(
        `SELECT has_table_privilege('${role}','private.dictionary_analysis_results','select');`
      ),
      'f'
    )
  assert.equal(
    await db.sql(
      `SELECT has_table_privilege('service_role','private.dictionary_analysis_results','select');`
    ),
    't'
  )
})
test('protected preflight matches committed dispatch grant and exact request hash; replay never grants dispatch', async () => {
  const command = await fixture(),
    receipt = await accept(command)
  const work = await read(command, receipt.fence)
  assert.deepEqual(work.receipt, receipt)
  assert.equal(work.result, null)
  assert.equal(work.input_sha256, null)
  assert.equal(work.validation_id, null)
  assert.deepEqual(Object.keys(work.payload).sort(), ['anchor', 'entry'])
  assert.equal(JSON.stringify(work).includes('verified_by'), false)
  assert.equal(JSON.stringify(work).includes('audit_reference'), false)
  const request = await prepareGeminiRequest(work.payload, MODEL)
  const grant = await dispatch(command, receipt.fence, request)
  assert.deepEqual(grant.dispatch, work.payload)
  assert.equal(grant.receipt.status, 'dispatching')
  const stored = await read(command, receipt.fence)
  assert.equal(stored.input_sha256, request.input_sha256)
  assert.equal(stored.provider, 'gemini')
  assert.equal(stored.model, request.model)
  assert.equal((await dispatch(command, receipt.fence, request)).dispatch, null)
  assert.equal((await accept(command)).status, 'dispatching')
  assert.equal(await quota(), 1)
})
test('durable result can be read after response loss without dispatch or another quota charge', async () => {
  const command = await fixture(),
    receipt = await accept(command)
  const work = await read(command, receipt.fence),
    request = await prepareGeminiRequest(work.payload, MODEL)
  await dispatch(command, receipt.fence, request)
  const packet = {
    content: original,
    provider_response: { responseId: 'synthetic-result' },
  }
  const journal = () =>
    json(
      service(
        `SELECT public.journal_dictionary_analysis_result_v1('${owner}','${command.operation_id}','${receipt.fence}',${literal(JSON.stringify(packet))},'synthetic-result');`
      )
    )
  const saved = await journal(),
    recovered = await read(command, receipt.fence)
  assert.deepEqual(recovered.result, packet)
  assert.equal(recovered.receipt.status, 'validating')
  assert.equal(recovered.receipt.result_sha256, saved.result_sha256)
  assert.deepEqual(await journal(), saved)
  assert.equal((await dispatch(command, receipt.fence, request)).dispatch, null)
  assert.equal((await accept(command)).status, 'validating')
  assert.equal(await quota(), 1)
  assert.equal(
    await db.sql(
      `SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${command.entry_id}';`
    ),
    command.expected_revision_id
  )
})
test('unknown outcome and late response remain quarantined through worker reads and nonce replays', async () => {
  const command = await fixture(),
    receipt = await accept(command)
  const request = await prepareGeminiRequest(
    (await read(command, receipt.fence)).payload,
    MODEL
  )
  await dispatch(command, receipt.fence, request)
  await db.sql(
    service(
      `SELECT public.record_dictionary_analysis_failure_v1('${owner}','${command.operation_id}','${receipt.fence}','${UNKNOWN}',NULL);`
    )
  )
  assert.equal((await read(command, receipt.fence)).receipt.status, UNKNOWN)
  const packet = {
    content: original,
    provider_response: { responseId: 'synthetic-late' },
  }
  await db.sql(
    service(
      `SELECT public.journal_dictionary_analysis_result_v1('${owner}','${command.operation_id}','${receipt.fence}',${literal(JSON.stringify(packet))},'synthetic-late');`
    )
  )
  const recovered = await read(command, receipt.fence)
  assert.deepEqual(recovered.result, packet)
  assert.equal(recovered.receipt.status, UNKNOWN)
  assert.equal((await dispatch(command, receipt.fence, request)).dispatch, null)
  assert.equal((await accept(command)).status, UNKNOWN)
  assert.equal(await quota(), 1)
})
test('worker read rejects other actor, missing operation and stale fence without exposing protected payload', async () => {
  const command = await fixture(),
    receipt = await accept(command)
  await assert.rejects(
    read(command, receipt.fence, other),
    /query returned no rows/
  )
  await assert.rejects(
    read({ ...command, operation_id: randomUUID() }, receipt.fence),
    /query returned no rows/
  )
  await assert.rejects(
    read(command, String(BigInt(receipt.fence) + BigInt(1))),
    /stale-analysis-fence/
  )
})
