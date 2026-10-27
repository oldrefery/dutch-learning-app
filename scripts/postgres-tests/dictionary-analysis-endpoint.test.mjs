import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  buildSemanticPolicy,
  SEMANTIC_DIMENSIONS,
} from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import { createCluster } from './cluster.mjs'
import { owner, other, seedUsers, literal, asUser } from './fixtures.mjs'
import {
  paidRelease,
  modelLimits,
  claimPaid,
} from './dictionary-paid.fixture.mjs'

// Transform parameter properties in memory for this isolated Node test process;
// the Deno/domain sources and installed packages remain unchanged.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.includes('/packages/domain/src/') &&
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts')
    )
      return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.ts')) return nextLoad(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), {
        mode: 'transform',
      }),
    }
  },
})
const { createIndependentDictionaryAnalysisEndpoint } =
  await import('../../supabase/functions/dictionary-analysis/endpoint.ts')

let db
const GENERATOR = 'gemini-generator-fixture',
  JUDGE = 'gemini-judge-fixture'
const SERVICE = 'synthetic-service',
  TOKEN = 'synthetic-owner'
const PROVIDER_KEY = 'synthetic-provider'
const ANON_KEY = 'synthetic-anon'
const SUPABASE_URL = 'https://supabase.example.invalid'
const ACCEPT = 'accept_dictionary_independent_analysis_v2',
  DISPATCH = 'start_dictionary_independent_analysis_dispatch_v1'
const hash = value =>
  createHash('sha256').update(canonicalizeJson(value)).digest('hex')
const content = {
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
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
  analysis_notes: 'Reviewed financial meaning.',
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
const profileArgs = p => ({
  p_model: p.generation_model,
  p_version: p.validator_version,
  p_policy_sha256: p.policy_sha256,
  p_semantic_model: p.model,
  p_prompt_sha256: p.prompt_sha256,
  p_media_url_prefixes: [...p.media_url_prefixes],
})
const common = { p_actor: 'uuid', p_operation: 'uuid', p_fence: 'text' }
const signatures = {
  claim_dictionary_paid_attempt_v1: {
    p_actor: 'uuid',
    p_invocation_key: 'text',
    p_model: 'text',
    p_binding_sha256: 'text',
    p_request_sha256: 'text',
    p_request_bytes: 'integer',
    p_output_tokens: 'integer',
  },
  [ACCEPT]: {
    p_command: 'jsonb',
    p_model: 'text',
    p_version: 'text',
    p_policy_sha256: 'text',
    p_semantic_model: 'text',
    p_prompt_sha256: 'text',
    p_media_url_prefixes: 'text[]',
  },
  [DISPATCH]: {
    ...common,
    p_model: 'text',
    p_input_sha256: 'text',
    p_version: 'text',
    p_policy_sha256: 'text',
  },
  get_dictionary_analysis_work_v1: common,
  journal_dictionary_analysis_result_v1: {
    ...common,
    p_result: 'jsonb',
    p_provider_request_id: 'text',
  },
  record_dictionary_analysis_failure_v1: {
    ...common,
    p_outcome: 'text',
    p_evidence_sha256: 'text',
  },
  get_dictionary_semantic_check_v1: common,
  start_dictionary_semantic_check_v1: {
    ...common,
    p_version: 'text',
    p_policy_sha256: 'text',
    p_model: 'text',
    p_prompt_sha256: 'text',
    p_content_sha256: 'text',
    p_input_sha256: 'text',
  },
  journal_dictionary_semantic_result_v1: {
    ...common,
    p_result: 'jsonb',
    p_provider_request_id: 'text',
  },
  record_dictionary_semantic_failure_v1: {
    ...common,
    p_outcome: 'text',
    p_evidence_sha256: 'text',
  },
  record_dictionary_analysis_validation_v1: {
    ...common,
    p_validation: 'jsonb',
  },
  publish_dictionary_analysis_v1: { ...common, p_validation: 'uuid' },
}
const callSql = (name, args) => {
  const signature = signatures[name]
  assert.ok(signature, 'Only explicitly whitelisted synthetic RPCs can run')
  assert.deepEqual(Object.keys(args).sort(), Object.keys(signature).sort())
  return `SELECT public.${name}(${Object.entries(signature)
    .map(([key, type]) => {
      const value = args[key]
      const encoded =
        type === 'jsonb'
          ? literal(JSON.stringify(value))
          : type === 'text[]'
            ? `ARRAY[${value.map(literal).join(',')}]`
            : literal(value)
      return `${key} => ${encoded}::${type}`
    })
    .join(',')});`
}
const sqlResult = async sql => {
  const result = await db.sql(sql)
  return result ? JSON.parse(result) : null
}
const service = sql => `SET ROLE service_role; ${sql}`
const accept = (f, overrides = {}) =>
  sqlResult(
    asUser(
      owner,
      callSql(ACCEPT, {
        p_command: f.command,
        ...profileArgs(f.policy),
        ...overrides,
      })
    )
  )
const dispatch = (f, receipt, policy = f.policy) =>
  sqlResult(
    service(
      callSql(DISPATCH, {
        p_actor: owner,
        p_operation: f.command.operation_id,
        p_fence: receipt.fence,
        p_model: policy.generation_model,
        p_input_sha256: 'b'.repeat(64),
        p_version: policy.validator_version,
        p_policy_sha256: policy.policy_sha256,
      })
    )
  )
const quota = () =>
  db
    .sql(
      `SELECT COALESCE(MAX(request_count),0) FROM public.edge_function_rate_limits WHERE user_id='${owner}' AND capability='gemini-analysis';`
    )
    .then(Number)
const head = f =>
  db.sql(
    `SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id='${f.command.entry_id}';`
  )
const receipt = f =>
  sqlResult(
    asUser(
      owner,
      `SELECT public.get_dictionary_analysis_operation_v2('${f.command.operation_id}');`
    )
  )
async function insertPolicy(policy) {
  await db.sql(`INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,media_url_prefixes,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model,generation_model_version,semantic_model_version)
    VALUES('${policy.validator_version}','${policy.policy_sha256}',TRUE,ARRAY[${policy.media_url_prefixes.map(literal).join(',')}]::TEXT[],'fixture://endpoint-only','independent-gemini-v1','${policy.model}','${policy.prompt_sha256}','${policy.generation_model}','${policy.generation_model_version}','${policy.model_version}')
    ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;`)
}
async function fixture() {
  const release = await paidRelease(db, {
    limit: '1000000',
    models: {
      [GENERATOR]: modelLimits(GENERATOR, {
        max_request_bytes: '32768',
        max_input_tokens: '32768',
      }),
      [JUDGE]: modelLimits(JUDGE, {
        max_request_bytes: '32768',
        max_input_tokens: '32768',
      }),
    },
  })
  const entry = randomUUID(),
    revision = randomUUID(),
    source = randomUUID(),
    anchor = randomUUID()
  const policy = await buildSemanticPolicy(JUDGE, [], GENERATOR, {
    generation: GENERATOR,
    judge: JUDGE,
  })
  await insertPolicy(policy)
  await db.sql(`DELETE FROM public.edge_function_rate_limits WHERE user_id='${owner}';
    UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE,semantic_checks_enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
      VALUES('${source}','editorial','fixture://endpoint-human','approved','${owner}',NOW(),'${hash(content)}');
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key) VALUES('${entry}','nl','bank','noun','de','financial-institution');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      VALUES('${revision}','${entry}',1,${literal(JSON.stringify(content))},'${hash(content)}','${'a'.repeat(64)}','${source}','published',NOW(),NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${entry}','${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
    INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
      VALUES('${anchor}','${entry}','${source}','A financial institution holding money and providing loans.','["Ik heb geld bij de bank."]','${owner}',NOW(),'fixture://endpoint-anchor','${'a'.repeat(64)}');
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES('${entry}','${anchor}');`)
  return {
    paidReleaseBinding: await db.sql(
      `SELECT binding_sha256 FROM private.dictionary_paid_releases WHERE release_id='${release}';`
    ),
    policy,
    command: {
      protocol_version: 2,
      operation_id: randomUUID(),
      entry_id: entry,
      expected_revision_id: revision,
      expected_head_sequence: await db.sql(
        `SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${entry}' AND change_kind='revision-head';`
      ),
    },
  }
}
async function providerReply(request, url, mode, providerCalls) {
  assert.equal(request.headers.get('x-goog-api-key'), PROVIDER_KEY)
  assert.equal(request.headers.get('Authorization'), null)
  const body = await request.json()
  providerCalls.push(body)
  const judge = url.pathname.includes(JUDGE)
  if (judge && mode.unknownJudge) throw new Error('synthetic-timeout')
  if (!judge && mode.beforeGenerationResult) await mode.beforeGenerationResult()
  let result = mode.unchanged
    ? content
    : { ...content, analysis_notes: 'Clearer financial meaning.' }
  if (judge) {
    const payload = JSON.parse(body.contents[0].parts[0].text)
    result = {
      ...payload.binding,
      decision: mode.verdict ?? 'same-meaning',
      checks: SEMANTIC_DIMENSIONS.map((dimension, index) => ({
        dimension,
        verdict:
          index === 1 && mode.verdict === 'different-meaning'
            ? 'contradicted'
            : index === 1 && mode.verdict === 'uncertain'
              ? 'uncertain'
              : 'preserved',
        reason: 'Synthetic independent verdict; no real-model qualification.',
        anchor_quote: 'financial institution',
      })),
    }
  }
  return Response.json({
    usageMetadata: {
      promptTokenCount: 20,
      cachedContentTokenCount: 5,
      candidatesTokenCount: 6,
      thoughtsTokenCount: 4,
      totalTokenCount: 30,
    },
    ...(mode.missingVersion === (judge ? 'judge' : 'generation')
      ? {}
      : {
          modelVersion: judge
            ? (mode.judgeVersion ?? JUDGE)
            : (mode.generationVersion ?? GENERATOR),
        }),
    responseId: judge ? 'synthetic-judge' : 'synthetic-generation',
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [{ text: JSON.stringify({ content: result }) }],
        },
      },
    ],
  })
}

async function endpoint(f, mode = {}) {
  const calls = [],
    providerCalls = []
  let loss = mode.loseAfter
  const handler = await createIndependentDictionaryAnalysisEndpoint({
    url: SUPABASE_URL,
    anonKey: ANON_KEY,
    serviceRoleKey: SERVICE,
    apiKey: PROVIDER_KEY,
    model: GENERATOR,
    modelVersion: GENERATOR,
    semanticModel: JUDGE,
    semanticModelVersion: JUDGE,
    mediaUrlPrefixes: [],
    allowedOrigins: ['https://web.example.invalid'],
    paidReleaseBinding: f.paidReleaseBinding,
    fetch: async (input, init) => {
      const request = new Request(input, init),
        url = new URL(request.url)
      if (url.hostname === 'generativelanguage.googleapis.com') {
        return providerReply(request, url, mode, providerCalls)
      }
      assert.equal(url.origin, SUPABASE_URL, 'No real network fallback')
      if (url.pathname === '/auth/v1/user') {
        assert.equal(request.headers.get('Authorization'), `Bearer ${TOKEN}`)
        assert.equal(request.headers.get('apikey'), ANON_KEY)
        return Response.json({ id: owner })
      }
      const name = url.pathname.slice('/rest/v1/rpc/'.length)
      const caller = name === ACCEPT
      assert.equal(
        request.headers.get('Authorization'),
        `Bearer ${caller ? TOKEN : SERVICE}`
      )
      assert.equal(request.headers.get('apikey'), caller ? ANON_KEY : SERVICE)
      calls.push(name)
      const args = await request.json()
      if (!caller) assert.equal(args.p_actor, owner)
      let data
      try {
        data = await sqlResult(
          caller
            ? asUser(owner, callSql(name, args))
            : service(callSql(name, args))
        )
      } catch (error) {
        const code =
          /ERROR:\s+([a-z][a-z-]+)/.exec(error.message)?.[1] ??
          'synthetic-storage-error'
        return Response.json({ code: 'P0001', message: code }, { status: 400 })
      }
      if (loss === name) {
        loss = null
        throw new Error('synthetic-lost-committed-reply')
      }
      return Response.json(data)
    },
  })
  return {
    calls,
    providerCalls,
    run: (command = f.command) =>
      handler(
        new Request('https://edge.example.invalid', {
          method: 'POST',
          headers: { Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify(command),
        })
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
test('endpoint migration seeds no profile or flags; ACLs retain verified caller/service separation', async () => {
  assert.equal(
    await db.sql(
      'SELECT COUNT(*) FROM private.dictionary_analysis_validator_policies;'
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      'SELECT analysis_operations_enabled OR analysis_publication_enabled OR semantic_checks_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      `SELECT has_function_privilege('anon','public.${ACCEPT}(jsonb,text,text,text,text,text,text[])','EXECUTE');`
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      `SELECT has_function_privilege('service_role','public.${ACCEPT}(jsonb,text,text,text,text,text,text[])','EXECUTE');`
    ),
    'f'
  )
  assert.equal(
    await db.sql(
      `SELECT has_function_privilege('authenticated','public.${DISPATCH}(uuid,uuid,text,text,text,text,text)','EXECUTE');`
    ),
    'f'
  )
})
test('readiness denial before acceptance preserves quota and creates no operation/lease', async () => {
  const f = await fixture()
  for (const flag of [
    'analysis_operations_enabled',
    'analysis_publication_enabled',
    'semantic_checks_enabled',
  ]) {
    await db.sql(`UPDATE private.dictionary_content_runtime SET ${flag}=FALSE;`)
    await assert.rejects(accept(f), /shared-analysis-disabled/)
    assert.equal(await quota(), 0)
    assert.equal(await receipt(f), null)
    await db.sql(`UPDATE private.dictionary_content_runtime SET ${flag}=TRUE;`)
  }
  for (const overrides of [
    { p_model: 'gemini-other-fixture' },
    { p_semantic_model: GENERATOR },
    { p_prompt_sha256: 'c'.repeat(64) },
    { p_media_url_prefixes: ['https://media.example.invalid/shared/'] },
  ]) {
    await assert.rejects(accept(f, overrides), /shared-analysis-disabled/)
    assert.equal(await quota(), 0)
  }
  await db.sql(
    'UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;'
  )
  await assert.rejects(accept(f), /shared-analysis-disabled/)
  assert.equal(await receipt(f), null)
})
test('exact concurrent acceptance binds one immutable generation/policy profile and consumes one slot', async () => {
  const f = await fixture(),
    results = await Promise.all([accept(f), accept(f)])
  assert.deepEqual(results[0], results[1])
  assert.equal(await quota(), 1)
  await assert.rejects(
    accept(f, { p_model: 'gemini-other-fixture' }),
    /operation-profile-conflict/
  )
  await assert.rejects(
    accept(f, { p_command: { ...f.command, entry_id: randomUUID() } }),
    /operation-payload-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_analysis_operations SET planned_policy_sha256=NULL WHERE operation_id='${f.command.operation_id}';`
    ),
    /immutable-analysis-profile/
  )
})
test('dispatch rechecks disabled policy/flags and cannot bypass a bound model using the legacy RPC', async () => {
  const f = await fixture(),
    r = await accept(f)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET semantic_checks_enabled=FALSE;'
  )
  await assert.rejects(dispatch(f, r), /analysis-policy-unavailable/)
  await assert.rejects(
    db.sql(
      service(
        `SELECT public.start_dictionary_analysis_dispatch_v1('${owner}','${f.command.operation_id}','${r.fence}','gemini','${GENERATOR}','${'b'.repeat(64)}');`
      )
    ),
    /analysis-policy-unavailable/
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET semantic_checks_enabled=TRUE;'
  )
  await assert.rejects(
    db.sql(
      service(
        `SELECT public.start_dictionary_analysis_dispatch_v1('${owner}','${f.command.operation_id}','${r.fence}','gemini','${JUDGE}','${'b'.repeat(64)}');`
      )
    ),
    /analysis-policy-unavailable/
  )
  const grant = await dispatch(f, r)
  assert.ok(grant.dispatch)
  assert.equal((await dispatch(f, r)).dispatch, null)
  assert.equal(await quota(), 1)
})
test('revoked authority prevents generation dispatch while trusted read_only administrator remains eligible', async () => {
  const f = await fixture(),
    r = await accept(f)
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  assert.equal((await dispatch(f, r)).receipt.status, 'authorization-revoked')
  const next = { ...f, command: { ...f.command, operation_id: randomUUID() } }
  await assert.rejects(accept(next), /analysis-permission-required/)
  await db.sql(
    `INSERT INTO private.dictionary_administrators(user_id,enabled,audit_reference) VALUES('${owner}',TRUE,'fixture://endpoint-admin') ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;`
  )
  assert.equal((await accept(next)).status, 'accepted')
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${owner}';`
  )
})
test('bound operation rejects a different judge policy before its quota reservation', async () => {
  const f = await fixture(),
    r = await accept(f)
  await dispatch(f, r)
  await claimPaid(
    db,
    { actor: owner, key: `${f.command.operation_id}:${r.fence}` },
    { hash: 'b'.repeat(64) }
  )
  const otherPolicy = await buildSemanticPolicy(
    JUDGE,
    ['https://media.example.invalid/shared/'],
    GENERATOR,
    { generation: GENERATOR, judge: JUDGE }
  )
  await insertPolicy(otherPolicy)
  const candidate = { ...content, analysis_notes: 'Clearer financial meaning.' }
  await sqlResult(
    service(
      callSql('journal_dictionary_analysis_result_v1', {
        p_actor: owner,
        p_operation: f.command.operation_id,
        p_fence: r.fence,
        p_result: { content: candidate },
        p_provider_request_id: 'synthetic-generation',
      })
    )
  )
  await assert.rejects(
    db.sql(
      service(
        callSql('start_dictionary_semantic_check_v1', {
          p_actor: owner,
          p_operation: f.command.operation_id,
          p_fence: r.fence,
          p_version: otherPolicy.validator_version,
          p_policy_sha256: otherPolicy.policy_sha256,
          p_model: otherPolicy.model,
          p_prompt_sha256: otherPolicy.prompt_sha256,
          p_content_sha256: hash(candidate),
          p_input_sha256: 'c'.repeat(64),
        })
      )
    ),
    /operation-profile-conflict/
  )
  assert.equal(await quota(), 1)
})
test('concrete SDK/handler/worker/judge workflow publishes one machine revision with two durable slots', async () => {
  const f = await fixture(),
    e = await endpoint(f),
    response = await e.run()
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.status, 'published')
  assert.equal(e.providerCalls.length, 2)
  assert.equal(await quota(), 2)
  assert.equal(await head(f), result.published_revision_id)
  assert.equal((await e.run()).status, 200)
  assert.equal(e.providerCalls.length, 2)
  assert.equal(await quota(), 2)
  assert.equal(e.calls.filter(n => n === DISPATCH).length, 1)
})
test('A26 unchanged content still requires two independent attempts and replays without a new revision or event', async () => {
  const f = await fixture(),
    e = await endpoint(f, { unchanged: true })
  const publicationState = () =>
    sqlResult(`SELECT JSONB_BUILD_OBJECT(
      'revisions',(SELECT COUNT(*) FROM public.dictionary_revisions WHERE entry_id='${f.command.entry_id}'),
      'events',(SELECT COUNT(*) FROM private.dictionary_content_changes WHERE entry_id='${f.command.entry_id}'),
      'sequence',(SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes WHERE entry_id='${f.command.entry_id}' AND change_kind='revision-head'));`)
  const before = await publicationState()
  const response = await e.run()
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.status, 'no-change')
  assert.equal(result.published_revision_id, f.command.expected_revision_id)
  assert.equal(result.published_head_sequence, f.command.expected_head_sequence)
  assert.deepEqual(await publicationState(), before)
  assert.equal(e.providerCalls.length, 2)
  assert.equal(await quota(), 2)
  assert.deepEqual(await (await e.run()).json(), result)
  assert.deepEqual(await publicationState(), before)
  assert.equal(e.providerCalls.length, 2)
  assert.equal(await quota(), 2)
})
for (const verdict of ['different-meaning', 'uncertain'])
  test(`concrete independent ${verdict} verdict leaves the existing published head`, async () => {
    const f = await fixture(),
      e = await endpoint(f, { verdict }),
      result = await (await e.run()).json()
    assert.equal(result.status, 'rejected')
    assert.equal(await head(f), f.command.expected_revision_id)
    assert.equal(await quota(), 2)
    assert.equal(e.providerCalls.length, 2)
  })
for (const loseAfter of [
  DISPATCH,
  'journal_dictionary_analysis_result_v1',
  'journal_dictionary_semantic_result_v1',
  'publish_dictionary_analysis_v1',
])
  test(`committed ${loseAfter} reply loss never repeats a paid call`, async () => {
    const f = await fixture(),
      e = await endpoint(f, { loseAfter })
    assert.equal((await e.run()).status, 503)
    const before = e.providerCalls.length
    if (loseAfter === 'journal_dictionary_analysis_result_v1')
      assert.equal(
        before,
        1,
        'A08 generation-only journal still needs the judge'
      )
    if (loseAfter === 'publish_dictionary_analysis_v1') {
      await db.sql(`UPDATE private.dictionary_content_runtime SET analysis_operations_enabled=FALSE,analysis_publication_enabled=FALSE,semantic_checks_enabled=FALSE;
        UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE;
        UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`)
    }
    const response = await e.run(),
      result = await response.json()
    if (loseAfter === DISPATCH) {
      assert.equal(response.status, 202)
      assert.equal(result.status, 'dispatching')
      assert.equal(e.providerCalls.length, 0)
    } else {
      assert.equal(result.status, 'published')
      assert.equal(e.providerCalls.length, 2)
    }
    if (
      loseAfter === 'journal_dictionary_semantic_result_v1' ||
      loseAfter === 'publish_dictionary_analysis_v1'
    )
      assert.equal(e.providerCalls.length, before)
    assert.equal(await quota(), loseAfter === DISPATCH ? 1 : 2)
  })
test('judge uncertainty after network failure remains quarantined through concrete endpoint retries', async () => {
  const f = await fixture(),
    e = await endpoint(f, { unknownJudge: true })
  assert.equal(
    (await (await e.run()).json()).status,
    'provider-outcome-unknown'
  )
  assert.equal(
    (await (await e.run()).json()).status,
    'provider-outcome-unknown'
  )
  assert.equal(e.providerCalls.length, 2)
  assert.equal(await quota(), 2)
  assert.equal(await head(f), f.command.expected_revision_id)
})
test('head change between generation and judging prevents the second slot and preserves the newer head', async () => {
  const f = await fixture(),
    next = randomUUID(),
    e = await endpoint(f, {
      beforeGenerationResult: () =>
        db.sql(`
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      SELECT '${next}',entry_id,2,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at
      FROM public.dictionary_revisions WHERE revision_id='${f.command.expected_revision_id}';
    UPDATE public.dictionary_entry_heads SET revision_id='${next}' WHERE entry_id='${f.command.entry_id}';
    UPDATE public.dictionary_entry_heads SET revision_id='${f.command.expected_revision_id}' WHERE entry_id='${f.command.entry_id}';`),
    })
  // A head event with the same revision is an ABA sequence change, not a content edit.
  const result = await (await e.run()).json()
  assert.equal(result.status, 'head-conflict')
  assert.equal(e.providerCalls.length, 1)
  assert.equal(await quota(), 1)
  assert.equal(await head(f), f.command.expected_revision_id)
})
test('injected client actor or learning data is rejected before command acceptance/provider work', async () => {
  const f = await fixture(),
    e = await endpoint(f)
  assert.equal((await e.run({ ...f.command, actor_id: other })).status, 400)
  assert.equal(
    (await e.run({ ...f.command, repetition_count: 100 })).status,
    400
  )
  assert.equal(e.calls.length, 0)
  assert.equal(e.providerCalls.length, 0)
  assert.equal(await quota(), 0)
})

for (const phase of ['generation', 'judge']) {
  for (const missing of [false, true]) {
    test(`observed ${phase} version ${missing ? 'missing' : 'changed'} requires review without publication or redispatch`, async () => {
      const f = await fixture(),
        e = await endpoint(
          f,
          missing
            ? { missingVersion: phase }
            : { [`${phase}Version`]: 'gemini-unqualified-model' }
        )
      const result = await (await e.run()).json()
      assert.equal(result.status, 'rejected')
      assert.equal(result.error_code, 'validation-review-required')
      assert.equal(
        await db.sql(
          `SELECT outcome FROM private.dictionary_analysis_validations WHERE operation_id='${f.command.operation_id}';`
        ),
        'review-required'
      )
      assert.equal(await head(f), f.command.expected_revision_id)
      assert.equal(e.providerCalls.length, phase === 'generation' ? 1 : 2)
      assert.equal(await quota(), phase === 'generation' ? 1 : 2)
      assert.deepEqual(await (await e.run()).json(), result)
      assert.equal(e.providerCalls.length, phase === 'generation' ? 1 : 2)
    })
  }
}
