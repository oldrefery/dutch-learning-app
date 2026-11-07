import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  literal,
  owner,
  other,
  seedUsers,
  state,
  review,
  assessment,
} from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import { importFixture } from './dictionary-import-recovery-fixtures.mjs'
import { paidRelease } from './dictionary-paid.fixture.mjs'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { canonicalizeOfficialContent } from '../../packages/content/src/manifest.ts'
const json = value => `${literal(JSON.stringify(value))}::JSONB`
const hash = value =>
  createHash('sha256').update(canonicalizeJson(value)).digest('hex')
const rpc = intent =>
  `SELECT public.apply_dictionary_import_intent_v2(${json(intent)});`
const READ_ONLY = 'read_only'
const IDENTITY_CONFLICT = 'identity-conflict'
let db
const read = sql => db.sql(sql).then(v => (v === '' ? null : JSON.parse(v)))
const apply = (intent, actor = owner) => read(asUser(actor, rpc(intent)))
const cache = ids =>
  read(
    `SET ROLE service_role; SELECT public.resolve_dictionary_cache_references_v2(ARRAY[${ids.map(literal).join(',')}]::UUID[]);`
  )
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => db?.close())

async function fixture() {
  await db.sql(`UPDATE private.dictionary_content_runtime SET reads_enabled=TRUE,operations_enabled=TRUE,legacy_guard_enabled=TRUE,
    following_reads_enabled=TRUE,following_imports_enabled=TRUE,following_cache_enabled=TRUE;
    UPDATE public.user_access_levels SET access_level='${READ_ONLY}' WHERE user_id IN ('${owner}','${other}');`)
  const target = await db.sql(
    `INSERT INTO public.collections(user_id,name) VALUES ('${owner}','Target') RETURNING collection_id;`
  )
  const share = randomUUID()
  const sourceCollection = await db.sql(
    `INSERT INTO public.collections(user_id,name,is_shared,share_token) VALUES ('${other}','Shared',TRUE,'${share}') RETURNING collection_id;`
  )
  const c = await read(
    `SELECT private.official_dictionary_content_v1(${json({ entry_id: 'fixture', dutch_lemma: `fiets-${randomUUID()}`, part_of_speech: 'noun', article: 'de', translations: { en: ['bicycle'] } })});`
  )
  const entry = randomUUID(),
    first = randomUUID(),
    second = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
    VALUES ('${entry}','nl',${literal(c.dutch_lemma)},'noun','de','${randomUUID()}');`)
  const source = await revision(entry, first, 1, c)
  const updated = { ...c, analysis_notes: 'Updated common wording' }
  await revision(entry, second, 2, updated)
  await db.sql(`INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES ('${entry}','${first}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';`)
  const intent = {
    protocol_version: 2,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: target,
    source: {
      kind: 'published-reference',
      reference: { entry_id: entry, revision_id: first },
      content_sha256: hash(c),
    },
  }
  return {
    target,
    sourceCollection,
    share,
    c,
    updated,
    entry,
    first,
    second,
    source,
    intent,
  }
}
async function revision(entry, id, no, c) {
  const source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES ('${source}','first_party','fixture://${source}','approved','${owner}',NOW(),'${hash(c)}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES ('${id}','${entry}',${no},${json(c)},'${hash(c)}',private.dictionary_cefr_content_sha256(${json(c)}),'${source}','published',NOW(),NOW());`)
  return source
}
const advance = f =>
  db.sql(
    `UPDATE public.dictionary_entry_heads SET revision_id='${f.second}' WHERE entry_id='${f.entry}';`
  )
async function sourceWord(f) {
  const intent = {
    ...f.intent,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: f.sourceCollection,
  }
  await apply(intent, other)
  await db.sql(
    `UPDATE public.words SET repetition_count=9,interval_days=38,analysis_notes='retained non-authoritative original' WHERE word_id='${intent.word_id}';`
  )
  return intent.word_id
}
async function cached(f) {
  const id = randomUUID(),
    at = new Date().toISOString()
  const c = {
    ...f.c,
    cache_id: id,
    cache_version: 2,
    usage_count: 1,
    cache_ttl_hours: 720,
    created_at: at,
    updated_at: at,
    last_used_at: at,
    dictionary_entry_id: f.entry,
    dictionary_revision_id: f.first,
  }
  await db.sql(
    `INSERT INTO public.word_analysis_cache SELECT (JSONB_POPULATE_RECORD(NULL::public.word_analysis_cache,${json(c)})).*;`
  )
  return id
}

test('new import/cache flags default off; new capability remains unavailable and no receipts or quota are fabricated', async () => {
  assert.equal(
    await db.sql(
      `SELECT following_imports_enabled OR following_cache_enabled FROM private.dictionary_content_runtime;`
    ),
    'f'
  )
  const f = await fixture()
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET following_imports_enabled=FALSE,following_cache_enabled=FALSE;'
  )
  await assert.rejects(apply(f.intent), /following-import-disabled/)
  await assert.rejects(cache([]), /following-cache-disabled/)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_receipts WHERE operation_id='${f.intent.operation_id}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql('SELECT COUNT(*) FROM public.edge_function_rate_limits;'),
    '0'
  )
})
test('read-only import records original revision but follows the current head with independent fresh learning', async () => {
  const f = await fixture()
  await advance(f)
  const receipt = await apply(f.intent)
  assert.equal(receipt.reference.revision_id, f.first)
  assert.equal(receipt.applied_reference.revision_id, f.second)
  const s = await state(db, f.intent.word_id)
  assert.equal(s.word.dictionary_content_mode, 'follow')
  assert.equal(s.word.dictionary_revision_id, f.first)
  assert.equal(s.word.analysis_notes, f.updated.analysis_notes)
  assert.equal(s.word.repetition_count, 0)
  assert.equal(s.word.interval_days, 1)
  assert.equal(s.word.easiness_factor, 2.5)
  const contentState = await read(
    `SELECT TO_JSONB(s) FROM public.word_content_state s WHERE word_id='${f.intent.word_id}';`
  )
  assert.equal(contentState.fallback_content, null)
  assert.deepEqual(contentState.overrides, {})
  assert.equal(contentState.content_version, 1)
})
test('lost reply returns immutable receipt after later reviews/moves/head change and feature disablement', async () => {
  const f = await fixture(),
    receipt = await apply(f.intent)
  await review(db, assessment(f.intent.word_id))
  await advance(f)
  await db.sql(
    `UPDATE public.words SET collection_id=NULL WHERE word_id='${f.intent.word_id}'; UPDATE private.dictionary_content_runtime SET following_imports_enabled=FALSE;`
  )
  const before = await state(db, f.intent.word_id)
  assert.deepEqual(await apply(f.intent), { ...receipt, idempotent: true })
  assert.deepEqual(await state(db, f.intent.word_id), before)
})
test('hard/soft deletion never resurrects an imported personal ID; same or new nonce cannot reinterpret the origin', async () => {
  for (const hard of [false, true]) {
    const f = await fixture(),
      receipt = await apply(f.intent)
    await db.sql(
      hard
        ? `DELETE FROM public.words WHERE word_id='${f.intent.word_id}';`
        : `UPDATE public.words SET deleted_at=NOW() WHERE word_id='${f.intent.word_id}';`
    )
    assert.deepEqual(await apply(f.intent), { ...receipt, idempotent: true })
    await assert.rejects(
      apply({ ...f.intent, operation_id: randomUUID() }),
      /import-personal-id-unavailable/
    )
  }
})
test('new same-key request never adopts, moves or resets an existing private card or a different sense', async () => {
  const f = await fixture(),
    first = await apply(f.intent)
  await review(db, assessment(f.intent.word_id))
  const before = await state(db, f.intent.word_id),
    next = { ...f.intent, operation_id: randomUUID(), word_id: randomUUID() }
  const conflict = await apply(next)
  assert.equal(conflict.outcome, IDENTITY_CONFLICT)
  assert.equal(conflict.existing_word_id, first.word_id)
  assert.equal(conflict.reference, null)
  assert.deepEqual(await state(db, f.intent.word_id), before)
  const legacy = await importFixture(db)
  legacy.intent.source.content = f.c
  await assert.rejects(
    apply({ ...next, collection_id: legacy.targets[0] }),
    /import-operation-conflict/
  )
  const g = await fixture(),
    privateImport = await importFixture(db)
  privateImport.intent.source.content = g.c
  await privateImport.apply()
  const privateBefore = await privateImport.row()
  assert.equal((await apply(g.intent)).outcome, IDENTITY_CONFLICT)
  assert.deepEqual(await privateImport.row(), privateBefore)
  const different = randomUUID(),
    revisionId = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
    VALUES ('${different}','nl',${literal(g.c.dutch_lemma)},'noun','de','a-distinct-protected-meaning');`)
  await revision(different, revisionId, 1, g.c)
  await db.sql(`INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES ('${different}','${revisionId}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${different}';`)
  assert.equal(
    (
      await apply({
        ...g.intent,
        operation_id: randomUUID(),
        word_id: randomUUID(),
        source: {
          ...g.intent.source,
          reference: { entry_id: different, revision_id: revisionId },
        },
      })
    ).outcome,
    IDENTITY_CONFLICT
  )
  assert.deepEqual(await privateImport.row(), privateBefore)
})
test('invalid private content, actor/SRS injection, unverified hash and foreign personal ID/target fail without mutation', async () => {
  const f = await fixture()
  for (const input of [
    { ...f.intent, user_id: other },
    { ...f.intent, repetition_count: 8 },
    { ...f.intent, source: { kind: 'private-copy', content: f.c } },
    {
      ...f.intent,
      source: { ...f.intent.source, content_sha256: 'a'.repeat(64) },
    },
    { ...f.intent, collection_id: f.sourceCollection },
  ]) {
    await assert.rejects(
      apply(input),
      /invalid-import|import-review-required|access denied/
    )
  }
  const foreign = {
    ...f.intent,
    word_id: randomUUID(),
    operation_id: randomUUID(),
    collection_id: f.sourceCollection,
  }
  await apply(foreign, other)
  await assert.rejects(
    apply({ ...f.intent, word_id: foreign.word_id }),
    /import-personal-id-unavailable/
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.words WHERE word_id='${f.intent.word_id}';`
    ),
    '0'
  )
})
test('legacy protocol1 queued create/recovery stays private and cannot reuse protocol2 nonces or imported origins', async () => {
  const legacy = await importFixture(db)
  const f = await fixture(),
    receipt = await legacy.apply()
  const before = await legacy.row()
  assert.equal(before.dictionary_content_mode, 'legacy')
  assert.deepEqual(await legacy.apply(), { ...receipt, idempotent: true })
  await legacy.recover(legacy.recovery())
  assert.equal((await legacy.row()).dictionary_content_mode, 'legacy')
  await assert.rejects(
    apply({ ...f.intent, operation_id: legacy.intent.operation_id }),
    /import-operation-conflict/
  )
  await apply(f.intent)
  await assert.rejects(
    legacy.apply({
      ...legacy.intent,
      operation_id: f.intent.operation_id,
      word_id: f.intent.word_id,
    }),
    /import-operation-conflict/
  )
})
test('shared source authorization copies only the published entry and fresh learning; revocation/private sources require review', async () => {
  const f = await fixture(),
    word = await sourceWord(f)
  await advance(f)
  const intent = {
    ...f.intent,
    source: {
      ...f.intent.source,
      kind: 'shared-collection',
      share_token: f.share,
      word_id: word,
    },
  }
  const sourceBefore = await state(db, word)
  const receipt = await apply(intent)
  assert.equal(receipt.outcome, 'inserted')
  assert.equal((await state(db, intent.word_id)).word.repetition_count, 0)
  assert.deepEqual(await state(db, word), sourceBefore)
  const privateWord =
    await db.sql(`INSERT INTO public.words(user_id,collection_id,dutch_lemma,translations,tts_url)
    VALUES ('${other}','${f.sourceCollection}','private-${randomUUID()}','{}','') RETURNING word_id;`)
  await assert.rejects(
    apply({
      ...intent,
      operation_id: randomUUID(),
      word_id: randomUUID(),
      source: { ...intent.source, word_id: privateWord },
    }),
    /import-review-required/
  )
  await db.sql(
    `UPDATE public.collections SET is_shared=FALSE WHERE collection_id='${f.sourceCollection}';`
  )
  assert.equal((await apply(intent)).idempotent, true)
  await assert.rejects(
    apply({ ...intent, operation_id: randomUUID(), word_id: randomUUID() }),
    /shared-collection-unavailable/
  )
})
test('official immutable manifest/mapping stays bound to original revision while a new import follows a later head', async () => {
  const f = await fixture(),
    pack = `synthetic-${randomUUID()}`
  const manifest = {
    schema_version: 1,
    pack_id: pack,
    version: '1.0.0',
    title: 'Synthetic',
    description: 'Fixture only',
    content_review: {
      status: 'approved',
      reviewed_by: 'synthetic',
      reviewed_at: '2026-10-10T06:00:00Z',
    },
    entries: [
      {
        entry_id: 'entry',
        dutch_lemma: f.c.dutch_lemma,
        part_of_speech: 'noun',
        article: 'de',
        translations: { en: ['bicycle'] },
      },
    ],
  }
  const digest = createHash('sha256')
    .update(canonicalizeOfficialContent(manifest))
    .digest('hex')
  await db.sql(`SELECT public.publish_official_content_pack(${json(manifest)},'${digest}','A1',0,1,'2026-10-10T06:00:00Z',NOW());
    INSERT INTO private.official_dictionary_mappings(pack_id,version,pack_entry_id,manifest_sha256,entry_id,revision_id,revision_content_sha256,source_id,provenance_locator)
    VALUES ('${pack}','1.0.0','entry','${digest}','${f.entry}','${f.first}','${hash(f.c)}','${f.source}','fixture://${f.source}');`)
  await advance(f)
  const intent = {
    ...f.intent,
    source: {
      ...f.intent.source,
      kind: 'official-pack',
      pack_id: pack,
      version: '1.0.0',
      pack_entry_id: 'entry',
      manifest_sha256: digest,
    },
  }
  await assert.rejects(
    apply({
      ...intent,
      source: { ...intent.source, manifest_sha256: 'a'.repeat(64) },
    }),
    /invalid-import-source/
  )
  const receipt = await apply(intent)
  assert.equal(receipt.reference.revision_id, f.first)
  assert.equal(receipt.applied_reference.revision_id, f.second)
  assert.equal(
    await db.sql(
      `SELECT manifest_sha256 FROM private.official_dictionary_mappings WHERE pack_id='${pack}';`
    ),
    digest
  )
})
test('portable and shared projections expose current common content, private review disposition and no owner learning/provenance', async () => {
  const f = await fixture(),
    source = await sourceWord(f)
  const privateWord = await db.sql(
    `INSERT INTO public.words(user_id,collection_id,dutch_lemma,translations,tts_url) VALUES ('${other}','${f.sourceCollection}','private-${randomUUID()}','{"en":["private"]}','') RETURNING word_id;`
  )
  await advance(f)
  const shared = await read(
    asUser(
      owner,
      `SELECT public.get_shared_dictionary_collection_v2('${f.share}');`
    )
  )
  assert.equal(
    shared.words.find(w => w.word_id === source).content.analysis_notes,
    f.updated.analysis_notes
  )
  assert.equal(
    shared.words.find(w => w.word_id === privateWord).shared_reference,
    null
  )
  const exported = await read(
    asUser(
      other,
      `SELECT public.export_dictionary_collection_v2('${f.sourceCollection}');`
    )
  )
  assert.equal(
    exported.entries.find(e => e.shared_reference).shared_reference.reference
      .revision_id,
    f.second
  )
  assert.equal(JSON.stringify(exported).includes('user_id'), false)
  assert.equal(JSON.stringify(exported).includes('repetition_count'), false)
  await assert.rejects(
    read(
      asUser(
        owner,
        `SELECT public.export_dictionary_collection_v2('${f.sourceCollection}');`
      )
    ),
    /access denied/
  )
})
test('bounded verified cache mapping resolves current head with deduplicated dependencies, never lemma-based or private text', async () => {
  const f = await fixture(),
    id = await cached(f),
    missing = randomUUID()
  await advance(f)
  const batch = await cache([id, id, missing])
  assert.equal(batch.resolutions.length, 2)
  assert.equal(batch.revisions.length, 1)
  assert.equal(batch.revisions[0].revision_id, f.second)
  assert.equal(
    batch.resolutions.find(r => r.cache_id === missing).reference,
    null
  )
  await db.sql(
    `UPDATE public.word_analysis_cache SET usage_count=usage_count+1 WHERE cache_id='${id}';`
  )
  assert.equal((await cache([id])).resolutions[0].status, 'resolved')
  await db.sql(
    `UPDATE public.word_analysis_cache SET created_at=NOW()-INTERVAL '40 days' WHERE cache_id='${id}';`
  )
  assert.equal((await cache([id])).resolutions[0].status, 'expired')
})
test('media cache refresh retains v1 mapping but fails closed in v2; retired entry unavailable', async () => {
  const f = await fixture(),
    id = await cached(f)
  await db.sql(
    `UPDATE public.word_analysis_cache SET image_url='https://public.example.invalid/a.png' WHERE cache_id='${id}';`
  )
  assert.equal((await cache([id])).resolutions[0].status, 'mapping-mismatch')
  assert.equal(
    await db.sql(
      `SELECT dictionary_revision_id FROM public.word_analysis_cache WHERE cache_id='${id}';`
    ),
    f.first
  )
  await db.sql(
    `UPDATE public.word_analysis_cache SET dictionary_entry_id='${f.entry}',dictionary_revision_id='${f.first}' WHERE cache_id='${id}';`
  )
  assert.equal((await cache([id])).resolutions[0].status, 'mapping-mismatch')
  await db.sql(`UPDATE public.word_analysis_cache SET image_url=NULL WHERE cache_id='${id}';
    UPDATE public.word_analysis_cache SET dictionary_entry_id='${f.entry}',dictionary_revision_id='${f.first}' WHERE cache_id='${id}';
    UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.entry}';`)
  assert.equal((await cache([id])).resolutions[0].status, 'unavailable')
  await assert.rejects(apply(f.intent), /import-review-required/)
})
test('concurrent same import applies once; changed payload same nonce conflicts and both response bindings stay exact', async () => {
  const f = await fixture()
  const second = JSON.parse(await overlap(db, rpc(f.intent), rpc(f.intent)))
  assert.equal(second.idempotent, true)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.words WHERE word_id='${f.intent.word_id}';`
    ),
    '1'
  )
  await assert.rejects(
    apply({ ...f.intent, word_id: randomUUID() }),
    /import-operation-conflict/
  )
})
test('head publication waiting behind import cannot produce a mixed receipt; publisher-first import sees the new head', async () => {
  const f = await fixture()
  const sql = `RESET ROLE; UPDATE public.dictionary_entry_heads SET revision_id='${f.second}' WHERE entry_id='${f.entry}';`
  await overlap(db, rpc(f.intent), sql)
  const receipt = await apply(f.intent)
  assert.equal(receipt.applied_reference.revision_id, f.first)
  const g = await fixture()
  const first = `RESET ROLE; UPDATE public.dictionary_entry_heads SET revision_id='${g.second}' WHERE entry_id='${g.entry}';`
  const next = JSON.parse(await overlap(db, first, rpc(g.intent)))
  assert.equal(next.applied_reference.revision_id, g.second)
})
test('anonymous/client cache access, direct mode changes and legacy private commands are rejected; learning continues', async () => {
  const f = await fixture()
  await apply(f.intent)
  await assert.rejects(
    db.sql(
      'SET ROLE anon; SELECT public.apply_dictionary_import_intent_v2(NULL);'
    ),
    /permission denied/
  )
  await assert.rejects(
    read(asUser(null, rpc(f.intent))),
    /authentication-required/
  )
  await assert.rejects(
    read(
      asUser(
        owner,
        `SELECT public.resolve_dictionary_cache_references_v2(ARRAY[]::UUID[]);`
      )
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      'SET ROLE service_role; SELECT public.resolve_dictionary_cache_references_v2(ARRAY_FILL(gen_random_uuid(),ARRAY[501]));'
    ),
    /invalid-cache-batch/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words SET dictionary_content_mode='legacy' WHERE word_id='${f.intent.word_id}';`
      )
    ),
    /trusted commands/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words SET analysis_notes='private override' WHERE word_id='${f.intent.word_id}';`
      )
    ),
    /legacy-content-upgrade-required/
  )
  const before = await state(db, f.intent.word_id)
  const command = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: f.intent.word_id,
    expected_content_version: 1,
    kind: 'detach',
    content: f.c,
  }
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `SELECT public.apply_dictionary_content_command_v1(${json(command)});`
      )
    ),
    /legacy-content-upgrade-required/
  )
  assert.deepEqual(await state(db, f.intent.word_id), before)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.word_content_receipts WHERE operation_id='${command.operation_id}';`
    ),
    '0'
  )
  await review(db, assessment(f.intent.word_id))
  assert.equal((await state(db, f.intent.word_id)).events.length, 1)
})
test('account deletion clears both protocol receipts/origins without deleting the common dictionary', async () => {
  const actor = randomUUID(),
    f = await fixture()
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${actor}','${actor}@example.invalid'); UPDATE public.collections SET user_id='${actor}' WHERE collection_id='${f.target}';`
  )
  await apply(f.intent, actor)
  await db.sql(`DELETE FROM auth.users WHERE id='${actor}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_receipts WHERE user_id='${actor}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_origins WHERE user_id='${actor}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entries WHERE entry_id='${f.entry}';`
    ),
    '1'
  )
})

test('failure after word insertion rolls back references, state, origin and receipt; retry inserts once', async () => {
  const f = await fixture()
  await db.sql(`CREATE FUNCTION private.reject_fixture_follow_import() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected-import-failure'; END $$;
    CREATE TRIGGER reject_fixture_follow_import AFTER INSERT ON public.word_content_state FOR EACH ROW EXECUTE FUNCTION private.reject_fixture_follow_import();`)
  try {
    await assert.rejects(apply(f.intent), /injected-import-failure/)
  } finally {
    await db.sql(
      'DROP TRIGGER reject_fixture_follow_import ON public.word_content_state; DROP FUNCTION private.reject_fixture_follow_import();'
    )
  }
  for (const table of [
    'public.words',
    'public.word_content_state',
    'private.dictionary_import_origins',
  ])
    assert.equal(
      await db.sql(
        `SELECT COUNT(*) FROM ${table} WHERE word_id='${f.intent.word_id}';`
      ),
      '0'
    )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_receipts WHERE operation_id='${f.intent.operation_id}';`
    ),
    '0'
  )
  assert.equal((await apply(f.intent)).outcome, 'inserted')
})

test('v1 sharing/export/import adapters use current follow content but preserve legacy wire and snapshot semantics', async () => {
  const f = await fixture()
  await sourceWord(f)
  await advance(f)
  const shared = await read(
    asUser(
      owner,
      `SELECT public.get_shared_dictionary_collection_v1('${f.share}');`
    )
  )
  const exported = await read(
    asUser(
      other,
      `SELECT public.export_dictionary_collection_v1('${f.sourceCollection}');`
    )
  )
  assert.equal(shared.schema_version, 1)
  assert.equal(exported.schema_version, 1)
  assert.equal(shared.words[0].content.analysis_notes, f.updated.analysis_notes)
  assert.equal(
    exported.entries[0].content.analysis_notes,
    f.updated.analysis_notes
  )
  assert.deepEqual(Object.keys(exported.entries[0]), ['content'])
  const imported = await read(
    asUser(
      owner,
      `SELECT TO_JSONB(w) FROM public.import_shared_dictionary_collection_v1('${f.target}','${f.share}',ARRAY['${shared.words[0].word_id}']::UUID[]) w;`
    )
  )
  assert.equal(imported.dictionary_content_mode, 'legacy')
  assert.equal(imported.dictionary_revision_id, f.second)
  assert.equal(imported.repetition_count, 0)
})
test('retired follow content remains portable but its exported IDs cannot create a new public reference', async () => {
  const f = await fixture()
  await sourceWord(f)
  await advance(f)
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.entry}';`
  )
  const exported = await read(
    asUser(
      other,
      `SELECT public.export_dictionary_collection_v2('${f.sourceCollection}');`
    )
  )
  assert.equal(exported.entries[0].shared_reference, null)
  assert.equal(
    exported.entries[0].content.analysis_notes,
    f.updated.analysis_notes
  )
  await assert.rejects(apply(f.intent), /import-review-required/)
})

async function scopedImportFixture(options = {}) {
  const f = await fixture()
  const release = await paidRelease(db, options)
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET following_import_release_id='${release}';`
  )
  return { ...f, release }
}

async function clearImportScope() {
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET following_import_release_id=NULL;'
  )
}

test('scoped imports reject another actor without writing a personal card or receipt', async () => {
  const f = await scopedImportFixture()
  try {
    const foreign = {
      ...f.intent,
      word_id: randomUUID(),
      operation_id: randomUUID(),
      collection_id: f.sourceCollection,
    }
    await assert.rejects(
      apply(foreign, other),
      /following-import-cohort-required/
    )
    const recovery = {
      protocol_version: 2,
      operation_id: randomUUID(),
      original_intent: foreign,
      expected_recovery_version: 0,
      expected_collection_id: null,
      target_collection_id: f.sourceCollection,
    }
    await assert.rejects(
      read(
        asUser(
          other,
          `SELECT public.recover_dictionary_import_v2(${json(recovery)});`
        )
      ),
      /following-import-cohort-required/
    )
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM public.words WHERE word_id='${foreign.word_id}';`
      ),
      '0'
    )
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM private.dictionary_import_receipts WHERE operation_id='${foreign.operation_id}';`
      ),
      '0'
    )
    assert.equal((await apply(f.intent)).outcome, 'inserted')
  } finally {
    await clearImportScope()
  }
})

test('cohort members can save published content after the paid budget and call limit are exhausted', async () => {
  const f = await scopedImportFixture({ calls: 4 })
  try {
    await db.sql(
      `UPDATE public.user_access_levels SET access_level='read_only' WHERE user_id='${owner}';`
    )
    await db.sql(
      `UPDATE private.dictionary_paid_releases SET calls_issued=call_limit,settled_nanousd=limit_nanousd WHERE release_id='${f.release}';`
    )
    const before = await db.sql(
      `SELECT row_to_json(r)::text FROM private.dictionary_paid_releases r WHERE release_id='${f.release}';`
    )
    assert.equal((await apply(f.intent)).outcome, 'inserted')
    assert.equal(
      await db.sql(
        `SELECT row_to_json(r)::text FROM private.dictionary_paid_releases r WHERE release_id='${f.release}';`
      ),
      before
    )
  } finally {
    await clearImportScope()
  }
})

test('expired, future and disabled releases cannot admit new following imports', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const tomorrow = new Date(Date.now() + 86400000).toISOString()
  const later = new Date(Date.now() + 172800000).toISOString()
  for (const options of [
    { until: new Date(Date.now() - 60000).toISOString(), from: yesterday },
    { from: tomorrow, until: later },
    { enabled: false },
  ]) {
    const f = await scopedImportFixture(options)
    try {
      await assert.rejects(apply(f.intent), /following-import-cohort-required/)
    } finally {
      await clearImportScope()
    }
  }
})

test('revoked or expired memberships block new imports without changing the legacy null-scope behavior', async () => {
  for (const change of [
    'enabled=FALSE',
    "expires_at=CLOCK_TIMESTAMP()-INTERVAL '1 minute'",
  ]) {
    const f = await scopedImportFixture()
    try {
      await db.sql(
        `UPDATE private.dictionary_paid_cohort SET ${change} WHERE release_id='${f.release}' AND user_id='${owner}';`
      )
      await assert.rejects(apply(f.intent), /following-import-cohort-required/)
      await clearImportScope()
      assert.equal((await apply(f.intent)).outcome, 'inserted')
    } finally {
      await clearImportScope()
    }
  }
})

test('receipt replay and moving an existing imported card survive cohort shutdown', async () => {
  const f = await scopedImportFixture()
  try {
    assert.equal((await apply(f.intent)).outcome, 'inserted')
    await db.sql(
      `UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id='${f.release}';`
    )
    assert.equal((await apply(f.intent)).idempotent, true)
    const target = await db.sql(
      `INSERT INTO public.collections(user_id,name) VALUES('${owner}','Recovered placement') RETURNING collection_id;`
    )
    const recovery = {
      protocol_version: 2,
      operation_id: randomUUID(),
      original_intent: f.intent,
      expected_recovery_version: 0,
      expected_collection_id: f.target,
      target_collection_id: target,
    }
    assert.equal(
      (
        await read(
          asUser(
            owner,
            `SELECT public.recover_dictionary_import_v2(${json(recovery)});`
          )
        )
      ).outcome,
      'applied'
    )
    const fresh = {
      ...f.intent,
      word_id: randomUUID(),
      operation_id: randomUUID(),
    }
    await assert.rejects(apply(fresh), /following-import-cohort-required/)
  } finally {
    await clearImportScope()
  }
})

test('concurrent release or membership withdrawal wins before a waiting import can insert', async () => {
  for (const table of ['dictionary_paid_releases', 'dictionary_paid_cohort']) {
    const f = await scopedImportFixture()
    try {
      await assert.rejects(
        overlap(
          db,
          `RESET ROLE; UPDATE private.${table} SET enabled=FALSE WHERE release_id='${f.release}';`,
          rpc(f.intent)
        ),
        /following-import-cohort-required/
      )
      assert.equal(
        await db.sql(
          `SELECT count(*) FROM public.words WHERE word_id='${f.intent.word_id}';`
        ),
        '0'
      )
    } finally {
      await clearImportScope()
    }
  }
})
