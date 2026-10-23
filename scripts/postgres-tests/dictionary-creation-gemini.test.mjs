import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { seedUsers } from './fixtures.mjs'
import {
  configure,
  ready,
  start,
  journal,
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
const { buildCreationGeminiProfile, prepareCreationRequest } =
  await import('../../supabase/functions/dictionary-creation/geminiModel.ts')
const { createCreationGeminiTransport } =
  await import('../../supabase/functions/dictionary-creation/geminiTransport.ts')
const { parseCreationGrant } =
  await import('../../supabase/functions/dictionary-creation/contracts.ts')
const { createGeminiTransport } =
  await import('../../supabase/functions/dictionary-analysis/geminiTransport.ts')

let db, profile
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  profile = await buildCreationGeminiProfile({
    generation_model: 'gemini-3.8-flash',
    judgement_model: 'gemini-3.6-flash',
    generation_model_version: 'gemini-3.8-flash',
    judgement_model_version: 'gemini-3.6-flash',
  })
})
after(async () => {
  await db?.close()
})
async function fixture() {
  await configure(db)
  await db.sql(`UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=TRUE,creation_publication_enabled=TRUE;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model,generation_model_version,semantic_model_version)
    VALUES('${profile.validator_version}','${profile.policy_sha256}',TRUE,'fixture://creation-transport-only','independent-gemini-v1','${profile.judgement_model}','${profile.prompt_sha256}','${profile.generation_model}','${profile.generation_model_version}','${profile.judgement_model_version}')
    ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    UPDATE private.dictionary_creation_profile SET validator_version='${profile.validator_version}',policy_sha256='${profile.policy_sha256}' WHERE singleton;`)
  return ready(db)
}
async function invoke(f, phase, dispatch, receipt, candidate, version) {
  const grant = await parseCreationGrant(
    dispatch,
    phase,
    f.run,
    receipt,
    profile
  )
  const prepared = await prepareCreationRequest(phase, grant, profile)
  assert.equal(prepared.grant_input_sha256, dispatch.input_sha256)
  assert.notEqual(prepared.input_sha256, dispatch.input_sha256)
  let calls = 0
  const transport = await createCreationGeminiTransport({
    profile,
    transport: createGeminiTransport({
      apiKey: 'fixture-key',
      fetch: (_url, init) => {
        calls++
        const body = JSON.parse(init.body)
        const payload = JSON.parse(body.contents[0].parts[0].text)
        assert.deepEqual(payload.creation_input, dispatch.input)
        assert.equal(
          body.generationConfig.responseFormat.text.mimeType,
          'APPLICATION_JSON'
        )
        assert.ok(!init.body.includes('Private owner hint'))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              modelVersion: version,
              responseId: randomUUID(),
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [{ text: JSON.stringify({ content: candidate }) }],
                  },
                },
              ],
            })
          )
        )
      },
    }),
  })
  const outcome = await transport.invoke(phase, grant)
  assert.equal(calls, 1)
  assert.equal(outcome.kind, 'returned')
  return outcome
}
test('actual SQL grants map to mocked provider requests and publish one isolated draft', async () => {
  const f = await fixture()
  const g = await start(db, f)
  const result = await invoke(
    f,
    'generation',
    g.dispatch,
    g.receipt,
    content(),
    profile.generation_model_version
  )
  const receipt = await journal(
    db,
    f,
    g.dispatch,
    result.result,
    result.requestId
  )
  const j = await judge(db, f)
  const judged = await invoke(
    f,
    'judgement',
    j.dispatch,
    receipt,
    verdict(j.dispatch).content,
    profile.judgement_model_version
  )
  await record(db, f, j.dispatch, judged.result, judged.requestId)
  const validation = await validate(db, f)
  assert.equal(validation.outcome, 'accepted')
  const published = await publish(db, f, validation.validation_id)
  assert.equal(published.status, 'published')
  assert.deepEqual(await publish(db, f, validation.validation_id), published)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.identity.entry_id}';`
    ),
    '1'
  )
})
test('wrong observed generation is journalled and blocks SQL judgement dispatch', async () => {
  const f = await fixture()
  const g = await start(db, f)
  const outcome = await invoke(
    f,
    'generation',
    g.dispatch,
    g.receipt,
    content(),
    profile.judgement_model_version
  )
  await journal(db, f, g.dispatch, outcome.result, outcome.requestId)
  await assert.rejects(judge(db, f), /creation-candidate-invalid/)
  assert.equal((await validate(db, f)).outcome, 'review-required')
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_judge_attempts WHERE run_id='${f.run}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT result#>>'{provider_response,modelVersion}' FROM private.dictionary_creation_generation_attempts WHERE run_id='${f.run}';`
    ),
    profile.judgement_model_version
  )
})
test('in-flight judge validation refuses; wrong returned version remains durable and unpublishable', async () => {
  const f = await fixture()
  const g = await start(db, f)
  const generated = await invoke(
    f,
    'generation',
    g.dispatch,
    g.receipt,
    content(),
    profile.generation_model_version
  )
  const receipt = await journal(
    db,
    f,
    g.dispatch,
    generated.result,
    generated.requestId
  )
  const j = await judge(db, f)
  await assert.rejects(
    validate(db, f),
    /independent-creation-evidence-required/
  )
  assert.equal((await replay(db, f)).status, 'validating')
  const wrong = await invoke(
    f,
    'judgement',
    j.dispatch,
    receipt,
    verdict(j.dispatch).content,
    profile.generation_model_version
  )
  await record(db, f, j.dispatch, wrong.result, wrong.requestId)
  const validation = await validate(db, f)
  assert.equal(validation.outcome, 'review-required')
  await assert.rejects(publish(db, f, validation.validation_id))
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.identity.entry_id}';`
    ),
    '0'
  )
  assert.equal((await judge(db, f)).dispatch, null)
})
