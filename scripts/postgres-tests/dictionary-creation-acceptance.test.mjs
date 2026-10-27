import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
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

registerHooks({
  resolve(specifier, context, next) {
    if (
      context.parentURL?.includes('/packages/domain/src/') &&
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts')
    )
      return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.endsWith('.ts')) return next(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), {
        mode: 'transform',
      }),
    }
  },
})
const {
  parseDictionaryCreationResponseV2,
  parseDictionaryMeaningResolutionReceiptV2,
} = await import('../../packages/domain/src/dictionary-creation.ts')
const ADMIN = '33333333-3333-4333-8333-333333333333'
const HASH = 'a'.repeat(64),
  POLICY = 'b'.repeat(64),
  PROMPT = 'c'.repeat(64)
const VERSION = 'creation-fixture-v1'
const NEW_MEANING = 'new-meaning',
  BUSY = 'creation-in-progress',
  EXISTING = 'existing-meaning'
const PERMISSION = /analysis-permission-required/
let db
const json = sql => db.sql(sql).then(text => (text ? JSON.parse(text) : null))
const service = sql => `SET ROLE service_role; ${sql}`
const request = () => ({
  protocol_version: 2,
  resolution_id: randomUUID(),
  original_query: ' BANK ',
  meaning_hint: 'A financial institution.',
})
const command = req => ({
  protocol_version: 2,
  operation_id: randomUUID(),
  resolution_id: req.resolution_id,
})
const submit = (req, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.request_dictionary_meaning_resolution_v2(${literal(JSON.stringify(req))}::JSONB);`
    )
  )
const readResolution = (id, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.get_dictionary_meaning_resolution_v2('${id}');`
    )
  )
const accept = (cmd, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(cmd))}::JSONB);`
    )
  )
const readOperation = (id, actor = owner) =>
  json(
    asUser(
      actor,
      `SELECT public.get_dictionary_creation_operation_v2('${id}');`
    )
  )
const quota = (actor = owner) =>
  db
    .sql(
      `SELECT COALESCE((SELECT request_count FROM public.edge_function_rate_limits WHERE user_id='${actor}' AND capability='gemini-analysis'),0);`
    )
    .then(Number)
const register = identity =>
  json(
    service(
      `SELECT TO_JSONB(public.register_dictionary_creation_identity_v1(${literal(JSON.stringify(identity))}::JSONB));`
    )
  )
const resolve = async (
  req,
  identity,
  actor = owner,
  decision = null,
  hash = null
) => {
  const savedHash =
    hash ??
    (await db.sql(
      `SELECT request_sha256 FROM private.dictionary_meaning_requests WHERE actor_id='${actor}' AND resolution_id='${req.resolution_id}';`
    ))
  return json(
    service(
      `SELECT public.resolve_dictionary_meaning_request_v1('${actor}','${req.resolution_id}',${literal(savedHash)},${literal(identity?.identity_id ?? null)}::UUID,${literal(decision)});`
    )
  )
}
async function configure() {
  await db.sql(`DELETE FROM public.edge_function_rate_limits;
    UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${owner}';
    UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id IN ('${other}','${ADMIN}');
    UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${other}';
    INSERT INTO private.dictionary_administrators(user_id,audit_reference) VALUES('${ADMIN}','fixture://admin') ON CONFLICT(user_id) DO UPDATE SET enabled=TRUE;
    UPDATE private.dictionary_content_runtime SET creation_resolution_enabled=TRUE,creation_operations_enabled=TRUE,
      analysis_operations_enabled=TRUE,analysis_publication_enabled=TRUE,semantic_checks_enabled=TRUE,analysis_quota_limit=10,analysis_quota_window_seconds=60;
    INSERT INTO private.dictionary_analysis_validator_policies(validator_version,policy_sha256,enabled,audit_reference,semantic_method,semantic_model,semantic_prompt_sha256,generation_model)
      VALUES('${VERSION}','${POLICY}',TRUE,'fixture://profile','independent-gemini-v1','gemini-judge-fixture','${PROMPT}','gemini-generator-fixture') ON CONFLICT(validator_version,policy_sha256) DO UPDATE SET enabled=TRUE;
    INSERT INTO private.dictionary_creation_profile(singleton,validator_version,policy_sha256) VALUES(TRUE,'${VERSION}','${POLICY}') ON CONFLICT(singleton) DO UPDATE SET validator_version=EXCLUDED.validator_version,policy_sha256=EXCLUDED.policy_sha256;`)
}
async function identity({
  approved = true,
  sense = randomUUID(),
  gloss = 'A financial institution.',
} = {}) {
  const source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES('${source}','editorial','fixture://reviewed/${source}',${literal(approved ? 'approved' : 'pending')},${approved ? literal(owner) : 'NULL'},${approved ? "'2026-10-10T00:00:00Z'" : 'NULL'},${approved ? literal(HASH) : 'NULL'});`)
  return {
    identity_id: randomUUID(),
    entry_id: randomUUID(),
    language_code: 'nl',
    lemma: 'bank',
    part_of_speech: 'noun',
    article: 'de',
    sense_key: sense,
    source_id: source,
    gloss,
    examples: ['Ik ga naar de bank.'],
    verified_by: owner,
    verified_at: '2026-10-10T01:00:00+00:00',
    audit_reference: 'fixture://reviewed-identity',
  }
}
async function ready(actor = owner, fields = {}) {
  const id = await identity(fields)
  await register(id)
  const req = request()
  await submit(req, actor)
  const resolution = await resolve(req, id, actor)
  assert.equal(resolution.outcome, NEW_MEANING)
  assert.equal(
    parseDictionaryMeaningResolutionReceiptV2(resolution).success,
    true
  )
  return { id, req, cmd: command(req) }
}
async function publishFixture(f) {
  const revision = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES('${revision}','${f.id.entry_id}',1,'{}','${HASH}','${HASH}','${f.id.source_id}','published',NOW(),NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${f.id.entry_id}','${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${f.id.entry_id}';`)
  return {
    reference: { entry_id: f.id.entry_id, revision_id: revision },
    content_sha256: HASH,
  }
}
const publicState = async () => {
  const tables = JSON.parse(
    await db.sql(
      `SELECT JSON_AGG(tablename ORDER BY tablename) FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'dictionary_%' AND tablename<>'edge_function_rate_limits';`
    )
  )
  const result = {}
  for (const table of tables) {
    assert.match(table, /^[a-z_]+$/)
    result[table] = await db.sql(
      `SELECT COALESCE(JSONB_AGG(TO_JSONB(t) ORDER BY TO_JSONB(t)::TEXT),'[]') FROM public.${table} t;`
    )
  }
  return result
}
before(async () => {
  db = await createCluster({
    // Historical core contract; current paid containment uses all migrations in dictionary-paid-* and the endpoint suite.
    throughMigration:
      '20261025093000_add_dictionary_capability_release_gate.sql',
  })
  await seedUsers(db)
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES('${ADMIN}','admin@example.invalid');`
  )
})
after(async () => {
  await db?.close()
})

test('creation gates default OFF; no policy, roles, identity or operation is seeded', async () => {
  assert.equal(
    await db.sql(
      'SELECT creation_resolution_enabled OR creation_operations_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
  for (const table of [
    'dictionary_creation_profile',
    'dictionary_creation_identities',
    'dictionary_meaning_requests',
    'dictionary_creation_operations',
    'dictionary_administrators',
  ])
    assert.equal(await db.sql(`SELECT COUNT(*) FROM private.${table};`), '0')
  await assert.rejects(submit(request()), PERMISSION)
})
test('pending owner request survives repeat and status reads without quota, draft or publication', async () => {
  await configure()
  const req = request()
  assert.equal(await submit(req), null)
  assert.equal(await submit(req), null)
  assert.equal(await readResolution(req.resolution_id), null)
  assert.equal(await readResolution(req.resolution_id, other), null)
  assert.equal(await quota(), 0)
  assert.equal(
    await json(
      `SELECT request->'original_query' FROM private.dictionary_meaning_requests WHERE actor_id='${owner}' AND resolution_id='${req.resolution_id}';`
    ),
    req.original_query
  )
  await assert.rejects(
    submit({ ...req, meaning_hint: 'A seat.' }),
    /resolution-payload-conflict/
  )
  await assert.rejects(accept(command(req)), /resolved-new-meaning-required/)
})
test('ordinary read_only, anonymous and nonexistent actors cannot request or accept', async () => {
  await configure()
  const f = await ready()
  await assert.rejects(submit(request(), other), PERMISSION)
  await assert.rejects(accept(f.cmd, other), PERMISSION)
  for (const actor of [null, randomUUID()])
    await assert.rejects(submit(request(), actor), /authentication-required/)
  assert.equal(await quota(other), 0)
})
test('read_only trusted administrator can resolve and accept but membership withdrawal blocks a new attempt', async () => {
  await configure()
  const f = await ready(ADMIN)
  assert.equal((await accept(f.cmd, ADMIN)).status, 'accepted')
  assert.equal(await quota(ADMIN), 1)
  await db.sql(
    `UPDATE private.dictionary_administrators SET enabled=FALSE WHERE user_id='${ADMIN}';`
  )
  assert.equal(
    (await readOperation(f.cmd.operation_id, ADMIN)).status,
    'accepted'
  )
  await assert.rejects(submit(request(), ADMIN), PERMISSION)
})
for (const field of [
  'actor_id',
  'source_approved',
  'verified_by',
  'content',
  'word_id',
  'entry_id',
  'expected_head_sequence',
])
  test(`wire request/command rejects injected ${field}`, async () => {
    await configure()
    const req = request()
    await assert.rejects(
      submit({ ...req, [field]: owner }),
      /invalid-meaning-request/
    )
    await assert.rejects(
      accept({ ...command(req), [field]: owner }),
      /invalid-creation-command/
    )
    assert.equal(await quota(), 0)
  })
for (const query of ['', 'x'.repeat(121), '😀'.repeat(61), 'bank\n'])
  test(`bounds original query without changing meaning identity: ${JSON.stringify(query).slice(0, 40)}`, async () => {
    await configure()
    await assert.rejects(
      submit({ ...request(), original_query: query }),
      /invalid-meaning-request/
    )
  })
test('unapproved source and wrong human reviewer cannot become a reviewed identity', async () => {
  await configure()
  const id = await identity({ approved: false })
  await assert.rejects(register(id), /unverified-creation-identity/)
  const approved = await identity()
  await assert.rejects(
    register({ ...approved, verified_by: other }),
    /unverified-creation-identity/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `SELECT public.register_dictionary_creation_identity_v1(${literal(JSON.stringify(approved))}::JSONB);`
      )
    ),
    /permission denied/
  )
})
test('identity/source evidence is immutable, idempotent and cannot be relabelled by an authorized actor', async () => {
  await configure()
  const id = await identity()
  assert.equal(await register(id), id.identity_id)
  assert.equal(await register(id), id.identity_id)
  await assert.rejects(
    register({ ...id, gloss: 'A seat.' }),
    /reviewed-identity-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_creation_identities SET sense_key='changed' WHERE identity_id='${id.identity_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_sources SET provenance_locator='changed' WHERE source_id='${id.source_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    register({ ...id, identity_id: randomUUID(), entry_id: randomUUID() }),
    /duplicate key/
  )
})
for (const decision of [
  'meaning-uncertain',
  'source-unapproved',
  'identity-conflict',
])
  test(`immutable ${decision} resolution cannot create a meaning`, async () => {
    await configure()
    const req = request()
    await submit(req)
    const receipt = await resolve(req, null, owner, decision)
    assert.equal(
      parseDictionaryMeaningResolutionReceiptV2(receipt).success,
      true
    )
    assert.equal(receipt.resolved_identity_id, null)
    assert.equal(receipt.published, null)
    assert.deepEqual(await readResolution(req.resolution_id), receipt)
    assert.deepEqual(await submit(req), receipt)
    const id = await identity()
    await register(id)
    await assert.rejects(resolve(req, id), /resolution-decision-conflict/)
    await assert.rejects(accept(command(req)), /resolved-new-meaning-required/)
    assert.equal(await quota(), 0)
  })
test('trusted resolution requires the exact request hash; authenticated caller cannot finalize approval', async () => {
  await configure()
  const req = request()
  await submit(req)
  const id = await identity()
  await register(id)
  await assert.rejects(
    resolve(req, id, owner, null, HASH),
    /resolution-payload-conflict/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `SELECT public.resolve_dictionary_meaning_request_v1('${owner}','${req.resolution_id}','${HASH}','${id.identity_id}',NULL);`
      )
    ),
    /permission denied/
  )
  const receipt = await resolve(req, id)
  assert.equal(receipt.resolved_identity_id, id.identity_id)
  assert.deepEqual(await resolve(req, id), receipt)
})
test('accepted operation creates only an invisible reviewed draft/anchor and one quota slot; retries retain exact receipt', async () => {
  await configure()
  const f = await ready()
  await seedWord(db)
  const before = await publicState()
  const events = await db.sql(
    'SELECT COUNT(*) FROM private.dictionary_content_changes;'
  )
  const receipt = await accept(f.cmd)
  assert.equal(parseDictionaryCreationResponseV2(receipt).success, true)
  assert.equal(receipt.entry_id, f.id.entry_id)
  assert.equal(receipt.fence, '1')
  assert.equal(receipt.published, null)
  assert.deepEqual(await accept(f.cmd), receipt)
  assert.deepEqual(await readOperation(f.cmd.operation_id), receipt)
  assert.equal(await readOperation(f.cmd.operation_id, other), null)
  assert.equal(await quota(), 1)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.id.entry_id}';`
    ),
    '0'
  )
  for (const actor of [owner, other, ADMIN])
    assert.equal(
      await db.sql(
        asUser(
          actor,
          `SELECT COUNT(*) FROM public.dictionary_entries WHERE entry_id='${f.id.entry_id}';`
        )
      ),
      '0'
    )
  assert.deepEqual(await publicState(), before)
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM private.dictionary_content_changes;'),
    events
  )
  assert.equal(
    await db.sql(
      `SELECT planned_generation_model FROM private.dictionary_creation_operations WHERE operation_id='${f.cmd.operation_id}';`
    ),
    'gemini-generator-fixture'
  )
})
test('owner/nonce cannot borrow foreign resolution or change payload after lost acceptance', async () => {
  await configure()
  const f = await ready()
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${other}';`
  )
  await assert.rejects(accept(f.cmd, other), /resolved-new-meaning-required/)
  const receipt = await accept(f.cmd)
  await assert.rejects(
    accept({ ...f.cmd, resolution_id: randomUUID() }),
    /operation-payload-conflict/
  )
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}'; UPDATE private.dictionary_content_runtime SET creation_operations_enabled=FALSE;`
  )
  assert.deepEqual(await accept(f.cmd), receipt)
  assert.deepEqual(await readOperation(f.cmd.operation_id), receipt)
  assert.equal(await quota(), 1)
})
test('current permission, source availability and profile withdrawal block unaccepted requests before quota', async () => {
  await configure()
  const f = await ready()
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=FALSE WHERE identity_id='${f.id.identity_id}';`
  )
  await assert.rejects(accept(f.cmd), /reviewed-identity-unavailable/)
  await db.sql(
    `UPDATE private.dictionary_creation_identity_availability SET enabled=TRUE WHERE identity_id='${f.id.identity_id}'; UPDATE private.dictionary_analysis_validator_policies SET enabled=FALSE WHERE validator_version='${VERSION}';`
  )
  await assert.rejects(accept(f.cmd), /creation-profile-unavailable/)
  await db.sql(
    `UPDATE private.dictionary_analysis_validator_policies SET enabled=TRUE WHERE validator_version='${VERSION}'; UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
  )
  await assert.rejects(accept(f.cmd), PERMISSION)
  assert.equal(await quota(), 0)
})
test('quota denial rolls back the attempted draft, anchor, fence and command; existing quota is shared', async () => {
  await configure()
  const f = await ready()
  await db.sql(
    `SELECT allowed FROM public.consume_edge_function_quota('${owner}','gemini-analysis',1,60); UPDATE private.dictionary_content_runtime SET analysis_quota_limit=1;`
  )
  await assert.rejects(accept(f.cmd), /rate-limit-exceeded/)
  assert.equal(await quota(), 1)
  assert.equal(await readOperation(f.cmd.operation_id), null)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entries WHERE entry_id='${f.id.entry_id}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_meaning_anchors WHERE entry_id='${f.id.entry_id}';`
    ),
    '0'
  )
})
test('same reviewed identity across concurrent owners accepts only once and records durable zero-charge busy', async () => {
  await configure()
  const f = await ready()
  await db.sql(
    `UPDATE public.user_access_levels SET access_level='full_access' WHERE user_id='${other}';`
  )
  const req2 = request()
  await submit(req2, other)
  await resolve(req2, f.id, other)
  const cmd2 = command(req2)
  const responses = await Promise.all([accept(f.cmd), accept(cmd2, other)])
  assert.equal(responses.filter(r => r.status === 'accepted').length, 1)
  const index = responses.findIndex(r => r.outcome === BUSY)
  assert.notEqual(index, -1)
  assert.equal(responses[index].quota_charged, false)
  assert.equal((await quota()) + (await quota(other)), 1)
  assert.deepEqual(
    await accept(index === 0 ? f.cmd : cmd2, index === 0 ? owner : other),
    responses[index]
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_operations WHERE identity_id='${f.id.identity_id}';`
    ),
    '1'
  )
})
test('different reviewed senses sharing spelling and legacy card key remain separate drafts and never overwrite personal learning', async () => {
  await configure()
  const financial = await ready()
  const seat = await ready(owner, { gloss: 'A seat for several people.' })
  await accept(financial.cmd)
  await accept(seat.cmd)
  assert.notEqual(financial.id.entry_id, seat.id.entry_id)
  assert.equal(await quota(), 2)
})
test('already published exact meaning returns an immutable zero-charge reference, never an additional generation', async () => {
  await configure()
  const f = await ready()
  await accept(f.cmd)
  const published = await publishFixture(f)
  const next = command(f.req)
  const receipt = await accept(next)
  assert.equal(receipt.outcome, EXISTING)
  assert.deepEqual(receipt.published, published)
  assert.equal(receipt.quota_charged, false)
  assert.equal(parseDictionaryCreationResponseV2(receipt).success, true)
  assert.deepEqual(await accept(next), receipt)
  assert.equal(await quota(), 1)
  const req = request()
  await submit(req)
  const resolution = await resolve(req, f.id)
  assert.equal(resolution.outcome, EXISTING)
  assert.deepEqual(resolution.published, published)
  await assert.rejects(accept(command(req)), /resolved-new-meaning-required/)
})
test('conflicting planned entry cannot consume quota or be replaced by spelling', async () => {
  await configure()
  const f = await ready()
  await db.sql(
    `INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,sense_key,state) VALUES('${f.id.entry_id}','nl','wrong','unreviewed','draft');`
  )
  await assert.rejects(accept(f.cmd), /reviewed-entry-identity-conflict/)
  assert.equal(await quota(), 0)
})
test('private requests and command/identity writes remain inaccessible and helpers expose no PUBLIC execute', async () => {
  await configure()
  const f = await ready()
  await accept(f.cmd)
  for (const table of [
    'dictionary_meaning_requests',
    'dictionary_creation_commands',
    'dictionary_creation_identities',
    'dictionary_creation_operations',
  ])
    await assert.rejects(
      db.sql(asUser(owner, `SELECT * FROM private.${table};`)),
      /permission denied/
    )
  const helpers = await db.sql(
    `SELECT COUNT(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname LIKE '%creation%' AND HAS_FUNCTION_PRIVILEGE('authenticated',p.oid,'EXECUTE');`
  )
  assert.equal(helpers, '0')
  const exposed = await db.sql(
    `SELECT COUNT(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE '%creation%' AND HAS_FUNCTION_PRIVILEGE('anon',p.oid,'EXECUTE');`
  )
  assert.equal(exposed, '0')
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM pg_catalog.pg_proc WHERE proname='start_dictionary_creation_dispatch_v1'
        AND HAS_FUNCTION_PRIVILEGE('authenticated',oid,'EXECUTE');`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      'SELECT creation_dispatch_enabled FROM private.dictionary_content_runtime;'
    ),
    'f'
  )
})

test('retired published meaning cannot be resurrected by a saved resolution', async () => {
  await configure()
  const f = await ready()
  await accept(f.cmd)
  await publishFixture(f)
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.id.entry_id}';`
  )
  await assert.rejects(
    accept(command(f.req)),
    /reviewed-entry-identity-conflict/
  )
  assert.equal(await quota(), 1)
})

for (const whitespace of ['\u00a0', '\ufeff'])
  test(`Unicode blank intent fails closed ${JSON.stringify(whitespace)}`, async () => {
    await configure()
    await assert.rejects(
      submit({ ...request(), original_query: whitespace }),
      /invalid-meaning-request/
    )
    await assert.rejects(
      submit({ ...request(), meaning_hint: whitespace }),
      /invalid-meaning-request/
    )
  })
test('source approval digest and identity idempotency do not depend on session timezone', async () => {
  await configure()
  const f = await ready()
  const receipt = await json(
    `SET timezone='Europe/Amsterdam'; ${asUser(owner, `SELECT public.accept_dictionary_creation_v2(${literal(JSON.stringify(f.cmd))}::JSONB);`)}`
  )
  assert.equal(receipt.status, 'accepted')
  assert.equal(await register(f.id), f.id.identity_id)
})
test('ordinary journal mutation is forbidden and account deletion does not block or publish a reviewed draft', async () => {
  await configure()
  const f = await ready()
  await accept(f.cmd)
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_creation_operations WHERE actor_id='${owner}' AND operation_id='${f.cmd.operation_id}';`
    ),
    /immutable/
  )
  await db.sql(`DELETE FROM auth.users WHERE id='${owner}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_operations WHERE actor_id='${owner}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_creation_commands WHERE actor_id='${owner}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT state FROM public.dictionary_entries WHERE entry_id='${f.id.entry_id}';`
    ),
    'draft'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entry_heads WHERE entry_id='${f.id.entry_id}';`
    ),
    '0'
  )
})
