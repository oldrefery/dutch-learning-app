import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal } from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import { canonicalizeOfficialContent } from '../../packages/content/src/manifest.ts'
import { canonicalizeCefrInput } from '../../packages/domain/src/shared-dictionary.ts'

const json = value => `${literal(JSON.stringify(value))}::jsonb`
const sha256 = value => createHash('sha256').update(value).digest('hex')
const exportedWording = 'owner-private exported wording'
const IDENTITY_CONFLICT = 'identity-conflict'
let db
before(async () => {
  db = await createCluster()
})
after(async () => {
  await db?.close()
})

async function fixture(sourceKind = 'first_party') {
  const user = randomUUID()
  const pack = `synthetic-${randomUUID()}`
  const source = randomUUID()
  const entry = {
    entry_id: 'explicit-pack-entry',
    dutch_lemma: 'fiets',
    part_of_speech: 'noun',
    article: 'de',
    translations: { en: ['bicycle'] },
  }
  const manifest = {
    schema_version: 1,
    pack_id: pack,
    version: '1.0.0',
    title: 'Synthetic mapping',
    description: 'Disposable fixture only',
    content_review: {
      status: 'approved',
      reviewed_by: 'synthetic',
      reviewed_at: '2026-10-02T06:00:00Z',
    },
    entries: [entry],
  }
  const manifestHash = sha256(canonicalizeOfficialContent(manifest))
  const content = {
    dutch_lemma: 'fiets',
    dutch_original: 'fiets',
    part_of_speech: 'noun',
    article: 'de',
    translations: { en: ['bicycle'], ru: [] },
    examples: [],
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    expression_type: null,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    plural: null,
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
  const contentHash = sha256(canonicalizeOfficialContent(content))
  const locator = `fixture://reviewed/${source}`
  await db.sql(`INSERT INTO auth.users(id, email) VALUES ('${user}', '${user}@example.invalid');
    SELECT public.publish_official_content_pack(${json(manifest)}, '${manifestHash}',
      'A1', 0, 1, '2026-10-02T06:00:00Z', NOW());
    INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator,
      review_state, reviewed_by, reviewed_at, approved_content_sha256)
    VALUES ('${source}', '${sourceKind}', '${locator}', 'approved', '${user}', NOW(), '${contentHash}');`)
  const reference = JSON.parse(
    await db.sql(`SELECT public.persist_canonical_dictionary_analysis_v1(
    '${randomUUID()}', 'nl', '${randomUUID()}', ${json(content)}, '${contentHash}',
    '${sha256(canonicalizeCefrInput(content))}', '${source}');`)
  )
  return {
    pack,
    user,
    source,
    reference,
    manifestHash,
    contentHash,
    locator,
    entry,
  }
}

const insert = (f, changes = {}) => {
  const m = { ...f, ...changes }
  return `INSERT INTO private.official_dictionary_mappings(pack_id, version, pack_entry_id,
    manifest_sha256, entry_id, revision_id, revision_content_sha256, source_id, provenance_locator)
    VALUES ('${m.pack}', '1.0.0', ${literal(m.entry.entry_id)}, '${m.manifestHash}',
      '${m.reference.entry_id}', '${m.reference.revision_id}', '${m.contentHash}',
      '${m.source}', ${literal(m.locator)});`
}

test('explicit reviewed mapping is immutable, authenticated and default-off', async () => {
  const f = await fixture()
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        `SELECT private.official_dictionary_content_v1(${json(f.entry)});`
      )
    ),
    {
      dutch_lemma: 'fiets',
      dutch_original: 'fiets',
      part_of_speech: 'noun',
      article: 'de',
      translations: { en: ['bicycle'], ru: [] },
      examples: [],
      is_irregular: false,
      is_reflexive: false,
      is_expression: false,
      expression_type: null,
      is_separable: false,
      prefix_part: null,
      root_verb: null,
      plural: null,
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
  )
  await db.sql(insert(f))
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `SELECT public.get_official_dictionary_mapping_v1('${f.pack}', '1.0.0');`
      )
    ),
    /unsupported-protocol/
  )
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET reads_enabled = true;`
  )
  const result = JSON.parse(
    await db.sql(
      asUser(
        f.user,
        `SELECT public.get_official_dictionary_mapping_v1('${f.pack}', '1.0.0');`
      )
    )
  )
  assert.equal(result.manifest_sha256, f.manifestHash)
  assert.deepEqual(result.entries[0].reference, {
    entry_id: f.reference.entry_id,
    revision_id: f.reference.revision_id,
  })
  assert.deepEqual(result.entries[0].provenance, {
    source_id: f.source,
    provenance_locator: f.locator,
  })
  for (const sql of [
    `UPDATE private.official_dictionary_mappings SET pack_entry_id = 'changed';`,
    `DELETE FROM private.official_dictionary_mappings;`,
    `TRUNCATE private.official_dictionary_mappings;`,
  ])
    await assert.rejects(db.sql(sql), /official-mapping-is-immutable/)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${insert({ ...f, pack: 'another' })}`),
      /permission denied/
    )
  }
  await assert.rejects(
    db.sql(
      `SET ROLE anon; SELECT public.get_official_dictionary_mapping_v1('${f.pack}', '1.0.0');`
    ),
    /permission denied/
  )
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET reads_enabled = false;`
  )
})

test('mapping rejects another manifest, entry, revision digest or provenance', async () => {
  const f = await fixture()
  for (const [changes, reason] of [
    [{ manifestHash: 'b'.repeat(64) }, /manifest-mismatch/],
    [{ entry: { ...f.entry, entry_id: 'absent' } }, /entry-mismatch/],
    [{ contentHash: 'b'.repeat(64) }, /revision-mismatch/],
    [{ locator: 'unreviewed-source' }, /source-mismatch/],
  ])
    await assert.rejects(db.sql(insert(f, changes)), reason)
  const provider = await fixture('provider')
  await assert.rejects(db.sql(insert(provider)), /source-mismatch/)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM private.official_dictionary_mappings WHERE pack_id = '${f.pack}';`
    ),
    '0'
  )
})

test('a same-spelling revision for another meaning cannot substitute for pack content', async () => {
  const f = await fixture()
  const other = await fixture()
  const changed = JSON.parse(
    await db.sql(
      `SELECT content FROM public.dictionary_revisions WHERE revision_id = '${other.reference.revision_id}';`
    )
  )
  changed.translations.en = ['another meaning']
  const source = randomUUID()
  const digest = sha256(canonicalizeOfficialContent(changed))
  await db.sql(`INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator,
    review_state, reviewed_by, reviewed_at, approved_content_sha256)
    VALUES ('${source}', 'first_party', 'fixture://different-meaning', 'approved', '${f.user}', NOW(), '${digest}');`)
  const reference = JSON.parse(
    await db.sql(`SELECT public.persist_canonical_dictionary_analysis_v1(
    '${randomUUID()}', 'nl', '${randomUUID()}', ${json(changed)}, '${digest}', '${'b'.repeat(64)}', '${source}');`)
  )
  await assert.rejects(
    db.sql(
      insert(f, {
        source,
        reference,
        contentHash: digest,
        locator: 'fixture://different-meaning',
      })
    ),
    /revision-mismatch/
  )
  await db.sql(
    `UPDATE public.dictionary_entries SET state = 'retired' WHERE entry_id = '${f.reference.entry_id}';`
  )
  await assert.rejects(db.sql(insert(f)), /revision-mismatch/)
})

test('official imports create personal identities and preserve duplicates, SRS and collection', async () => {
  const f = await fixture()
  await db.sql(insert(f))
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    reads_enabled = true, operations_enabled = true, legacy_guard_enabled = true;`)
  const collection = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Owned import target') RETURNING collection_id;`)
  const otherCollection =
    await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Second target') RETURNING collection_id;`)
  const rpc = target =>
    asUser(
      f.user,
      `SELECT to_jsonb(w) FROM public.import_official_dictionary_pack_v1(
    '${target}', '${f.pack}', '1.0.0', ARRAY['explicit-pack-entry']) w;`
    )
  const word = JSON.parse(await db.sql(rpc(collection)))
  assert.notEqual(word.word_id, f.reference.entry_id)
  assert.notEqual(word.word_id, f.entry.entry_id)
  assert.equal(word.dictionary_entry_id, f.reference.entry_id)
  assert.equal(word.dictionary_revision_id, f.reference.revision_id)
  assert.equal(word.interval_days, 1)
  assert.equal(word.repetition_count, 0)
  assert.equal(word.easiness_factor, 2.5)
  await db.sql(`UPDATE public.words SET interval_days = 34, repetition_count = 8,
    easiness_factor = 2.9, next_review_date = '2026-11-10' WHERE word_id = '${word.word_id}';`)
  const before = await db.sql(
    `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${word.word_id}';`
  )
  assert.equal(await db.sql(rpc(otherCollection)), before)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE user_id = '${f.user}';`
    ),
    '1'
  )
  assert.equal(
    await db.sql(
      `SELECT content_version FROM public.word_content_state WHERE word_id = '${word.word_id}';`
    ),
    '1'
  )
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `SELECT public.import_official_dictionary_pack_v1(
    '${collection}', '${f.pack}', '1.0.0', ARRAY['explicit-pack-entry', 'unknown']);`
      )
    ),
    /invalid-pack-entry-ids/
  )
})

test('new canonical imports never adopt a duplicate private card and unmapped entries stay private', async () => {
  const f = await fixture()
  await db.sql(insert(f))
  const collection = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Private duplicate') RETURNING collection_id;`)
  const word =
    await db.sql(`INSERT INTO public.words(user_id, collection_id, dutch_lemma, part_of_speech,
    article, translations, tts_url, interval_days, repetition_count)
    VALUES ('${f.user}', '${collection}', 'fiets', 'noun', 'de', '{"en":["private meaning"]}', '', 27, 5)
    RETURNING word_id;`)
  const before = await db.sql(
    `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${word}';`
  )
  await db.sql(
    asUser(
      f.user,
      `SELECT public.import_official_dictionary_pack_v1(
    '${collection}', '${f.pack}', '1.0.0', ARRAY['explicit-pack-entry']);`
    )
  )
  assert.equal(
    await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${word}';`
    ),
    before
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.word_content_state WHERE word_id = '${word}';`
    ),
    '0'
  )
  const unmapped = await fixture()
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${unmapped.user}', 'Unmapped') RETURNING collection_id;`)
  const imported = JSON.parse(
    await db.sql(
      asUser(
        unmapped.user,
        `SELECT to_jsonb(w) FROM public.import_official_dictionary_pack_v1(
    '${target}', '${unmapped.pack}', '1.0.0', ARRAY['explicit-pack-entry']) w;`
      )
    )
  )
  assert.equal(imported.dictionary_entry_id, null)
  assert.equal(imported.dictionary_revision_id, null)
  const state = JSON.parse(
    await db.sql(
      `SELECT to_jsonb(s) FROM public.word_content_state s WHERE word_id = '${imported.word_id}';`
    )
  )
  assert.equal(state.fallback_content.translations.en[0], 'bicycle')
})

test('sharing copies only selected authorized effective content and preserves private overrides', async () => {
  const owner = await fixture()
  await db.sql(insert(owner))
  const recipient = await fixture()
  const sourceCollection =
    await db.sql(`INSERT INTO public.collections(user_id, name, is_shared)
    VALUES ('${owner.user}', 'Explicit shared source', true) RETURNING collection_id;`)
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${recipient.user}', 'Recipient target') RETURNING collection_id;`)
  const token = await db.sql(
    `SELECT share_token FROM public.collections WHERE collection_id = '${sourceCollection}';`
  )
  const linked = JSON.parse(
    await db.sql(
      asUser(
        owner.user,
        `SELECT to_jsonb(w) FROM public.import_official_dictionary_pack_v1(
    '${sourceCollection}', '${owner.pack}', '1.0.0', ARRAY['explicit-pack-entry']) w;`
      )
    )
  )
  const overrides = {
    image_url: {
      op: 'set',
      value: 'https://example.invalid/shared-override.jpg',
    },
    analysis_notes: { op: 'remove' },
  }
  await db.sql(
    asUser(
      owner.user,
      `SELECT public.apply_dictionary_content_command_v1(${json({
        protocol_version: 1,
        operation_id: randomUUID(),
        word_id: linked.word_id,
        expected_content_version: 1,
        kind: 'edit-private',
        overrides,
      })});`
    )
  )
  const privateWord =
    await db.sql(`INSERT INTO public.words(user_id, collection_id, dutch_lemma, part_of_speech,
    translations, tts_url, interval_days, repetition_count)
    VALUES ('${owner.user}', '${sourceCollection}', 'private-shared', 'noun', '{"en":["authorized private copy"]}', '', 34, 9)
    RETURNING word_id;`)
  const outside =
    await db.sql(`INSERT INTO public.words(user_id, dutch_lemma, translations, tts_url)
    VALUES ('${owner.user}', 'unshared-secret', '{"en":["hidden private text"]}', '') RETURNING word_id;`)
  const foreignOwner = await fixture()
  const foreignAttached =
    await db.sql(`INSERT INTO public.words(user_id, collection_id, dutch_lemma, translations, tts_url)
    VALUES ('${foreignOwner.user}', '${sourceCollection}', 'foreign-owned', '{"en":["unshared foreign-owner content"]}', '') RETURNING word_id;`)
  const preview = JSON.parse(
    await db.sql(
      asUser(
        recipient.user,
        `SELECT public.get_shared_dictionary_collection_v1('${token}');`
      )
    )
  )
  assert.equal(preview.words.length, 2)
  assert.equal(
    preview.words.find(w => w.word_id === linked.word_id).content.image_url,
    overrides.image_url.value
  )
  assert.equal(JSON.stringify(preview).includes('hidden private text'), false)
  assert.equal(
    JSON.stringify(preview).includes('unshared foreign-owner content'),
    false
  )
  assert.equal(
    JSON.stringify(preview).includes('dictionary_revision_id'),
    false
  )
  assert.equal(
    JSON.stringify(preview).includes(owner.reference.revision_id),
    false
  )
  const rpc = ids =>
    asUser(
      recipient.user,
      `SELECT to_jsonb(w) FROM public.import_shared_dictionary_collection_v1(
    '${target}', '${token}', ARRAY[${ids.map(literal).join(',')}]::uuid[]) w;`
    )
  await assert.rejects(
    db.sql(rpc([linked.word_id, outside])),
    /invalid-shared-word-ids/
  )
  await assert.rejects(
    db.sql(rpc([foreignAttached])),
    /invalid-shared-word-ids/
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE user_id = '${recipient.user}';`
    ),
    '0'
  )
  const rows = (await db.sql(rpc([linked.word_id, privateWord])))
    .split('\n')
    .map(JSON.parse)
  const copy = rows.find(w => w.dictionary_entry_id !== null)
  assert.equal(copy.dictionary_revision_id, owner.reference.revision_id)
  assert.equal(copy.image_url, overrides.image_url.value)
  assert.notEqual(copy.word_id, linked.word_id)
  assert.equal(copy.user_id, recipient.user)
  assert.equal(copy.repetition_count, 0)
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        `SELECT overrides FROM public.word_content_state WHERE word_id = '${copy.word_id}';`
      )
    ),
    overrides
  )
  const privateCopy = rows.find(w => w.dictionary_entry_id === null)
  assert.equal(privateCopy.translations.en[0], 'authorized private copy')
  assert.equal(privateCopy.repetition_count, 0)
  assert.notEqual(privateCopy.word_id, privateWord)
  const before = await db.sql(
    `SELECT jsonb_agg(to_jsonb(w) ORDER BY word_id) FROM public.words w WHERE user_id = '${recipient.user}';`
  )
  await db.sql(rpc([linked.word_id, privateWord]))
  assert.equal(
    await db.sql(
      `SELECT jsonb_agg(to_jsonb(w) ORDER BY word_id) FROM public.words w WHERE user_id = '${recipient.user}';`
    ),
    before
  )
  await db.sql(
    `UPDATE public.collections SET is_shared = false WHERE collection_id = '${sourceCollection}';`
  )
  await assert.rejects(
    db.sql(rpc([linked.word_id])),
    /shared-collection-unavailable/
  )
  assert.equal(
    await db.sql(
      asUser(
        recipient.user,
        `SELECT public.get_shared_dictionary_collection_v1('${token}') IS NULL;`
      )
    ),
    't'
  )
  await assert.rejects(
    db.sql(
      `SET ROLE anon; SELECT public.get_shared_dictionary_collection_v1('${token}');`
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner.user,
        `SELECT public.import_shared_dictionary_collection_v1(
    '${target}', '${token}', ARRAY['${linked.word_id}']::uuid[]);`
      )
    ),
    /shared-collection-unavailable/
  )
})

test('concurrent imports retain one personal identity and lock the returned duplicate', async () => {
  const f = await fixture()
  await db.sql(insert(f))
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Concurrent import target') RETURNING collection_id;`)
  const rpc = asUser(
    f.user,
    `SELECT to_jsonb(w) FROM public.import_official_dictionary_pack_v1(
    '${target}', '${f.pack}', '1.0.0', ARRAY['explicit-pack-entry']) w;`
  )
  const duplicate = JSON.parse(await overlap(db, rpc, rpc))
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE user_id = '${f.user}';`
    ),
    '1'
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.word_content_state WHERE word_id = '${duplicate.word_id}';`
    ),
    '1'
  )
  const deleted = await overlap(
    db,
    rpc,
    asUser(
      f.user,
      `DELETE FROM public.words
    WHERE word_id = '${duplicate.word_id}' RETURNING word_id;`
    )
  )
  assert.equal(deleted, duplicate.word_id)
})

test('read-only copy imports require an owned target and normalized complete legacy content', async () => {
  const f = await fixture()
  const another = await fixture()
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Read-only import target') RETURNING collection_id;`)
  const foreign = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${another.user}', 'Foreign import target') RETURNING collection_id;`)
  assert.equal(
    await db.sql(
      asUser(f.user, 'SELECT public.get_user_access_level(auth.uid());')
    ),
    'read_only'
  )
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `INSERT INTO public.words(user_id, collection_id,
    dutch_lemma, translations, tts_url) VALUES ('${f.user}', '${target}', 'forbidden-direct', '{}', '');`
      )
    ),
    /row-level security/
  )
  const legacy = JSON.parse(
    await db.sql(`SELECT private.dictionary_import_content_v1(
    private.official_dictionary_content_v1(${json(f.entry)}) || ${json({
      usage_notes: { en: 'Authorized private note', ru: null },
      image_url: 'https://example.invalid/copied.jpg',
      tts_url: '',
    })});`)
  )
  assert.deepEqual(legacy.usage_notes, {
    en: 'Authorized private note',
    ru: null,
    contrasts: [],
  })
  assert.equal(legacy.tts_url, null)
  const rpc = id =>
    asUser(
      f.user,
      `SELECT to_jsonb(w) FROM public.import_dictionary_copies_v1('${id}', ${json([legacy])}) w;`
    )
  await assert.rejects(
    db.sql(rpc(foreign)),
    /Collection not found or access denied/
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = false;'
  )
  await assert.rejects(db.sql(rpc(target)), /unsupported-protocol/)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = true;'
  )
  const word = JSON.parse(await db.sql(rpc(target)))
  assert.equal(word.user_id, f.user)
  assert.equal(word.dictionary_revision_id, null)
  assert.equal(word.repetition_count, 0)
  assert.deepEqual(word.usage_notes, legacy.usage_notes)
  assert.equal(word.image_url, legacy.image_url)
})

test('owner exports are self-contained and reimport does not need the original private rows', async () => {
  const f = await fixture()
  await db.sql(insert(f))
  const recipient = await fixture()
  const source = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Self-contained source') RETURNING collection_id;`)
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${recipient.user}', 'Self-contained target') RETURNING collection_id;`)
  const word = JSON.parse(
    await db.sql(
      asUser(
        f.user,
        `SELECT to_jsonb(w) FROM public.import_official_dictionary_pack_v1(
    '${source}', '${f.pack}', '1.0.0', ARRAY['explicit-pack-entry']) w;`
      )
    )
  )
  await db.sql(
    asUser(
      f.user,
      `SELECT public.apply_dictionary_content_command_v1(${json({
        protocol_version: 1,
        operation_id: randomUUID(),
        word_id: word.word_id,
        expected_content_version: 1,
        kind: 'edit-private',
        overrides: {
          translations: {
            op: 'set',
            value: { en: [exportedWording], ru: [] },
          },
        },
      })});`
    )
  )
  await assert.rejects(
    db.sql(
      asUser(
        recipient.user,
        `SELECT public.export_dictionary_collection_v1('${source}');`
      )
    ),
    /Collection not found or access denied/
  )
  const document = JSON.parse(
    await db.sql(
      asUser(
        f.user,
        `SELECT public.export_dictionary_collection_v1('${source}');`
      )
    )
  )
  assert.deepEqual(Object.keys(document).sort(), [
    'collection',
    'entries',
    'schema_version',
  ])
  assert.equal(document.schema_version, 1)
  assert.deepEqual(document.collection, { name: 'Self-contained source' })
  assert.deepEqual(Object.keys(document.entries[0]), ['content'])
  assert.equal(document.entries[0].content.translations.en[0], exportedWording)
  for (const id of [
    f.user,
    word.word_id,
    f.reference.entry_id,
    f.reference.revision_id,
    f.source,
  ]) {
    assert.equal(JSON.stringify(document).includes(id), false)
  }
  await db.sql(`DELETE FROM public.words WHERE word_id = '${word.word_id}';`)
  const contents = document.entries.map(entry => entry.content)
  const copy = JSON.parse(
    await db.sql(
      asUser(
        recipient.user,
        `SELECT to_jsonb(w) FROM public.import_dictionary_copies_v1('${target}', ${json(contents)}) w;`
      )
    )
  )
  assert.notEqual(copy.word_id, word.word_id)
  assert.equal(copy.dictionary_entry_id, null)
  assert.equal(copy.dictionary_revision_id, null)
  assert.equal(copy.repetition_count, 0)
  assert.equal(copy.translations.en[0], exportedWording)
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        `SELECT fallback_content FROM public.word_content_state WHERE word_id = '${copy.word_id}';`
      )
    ),
    document.entries[0].content
  )
  await assert.rejects(
    db.sql(
      `SET ROLE anon; SELECT public.export_dictionary_collection_v1('${target}');`
    ),
    /permission denied/
  )
  const invalid = [
    ...contents,
    { ...contents[0], dutch_lemma: 'later-invalid', word_id: randomUUID() },
  ]
  const retryTarget =
    await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${recipient.user}', 'Rollback target') RETURNING collection_id;`)
  await assert.rejects(
    db.sql(
      asUser(
        recipient.user,
        `SELECT public.import_dictionary_copies_v1('${retryTarget}', ${json(invalid)});`
      )
    ),
    /invalid-import-content/
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE collection_id = '${retryTarget}';`
    ),
    '0'
  )
})

const intentRpc = intent =>
  `SELECT public.apply_dictionary_import_intent_v1(${json(intent)});`
async function intentFixture() {
  const f = await fixture()
  const target = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${f.user}', 'Offline import target') RETURNING collection_id;`)
  const content = JSON.parse(
    await db.sql(
      `SELECT private.official_dictionary_content_v1(${json(f.entry)});`
    )
  )
  const intent = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: target,
    source: { kind: 'private-copy', content },
  }
  const apply = value =>
    db.sql(asUser(f.user, intentRpc(value ?? intent))).then(JSON.parse)
  return { f, target, content, intent, apply }
}

test('durable read-only import keeps proposed identity, version zero and immutable replay without SRS input', async () => {
  const { f, intent, apply } = await intentFixture()
  const receipt = await apply()
  assert.deepEqual(receipt, {
    protocol_version: 1,
    operation_id: intent.operation_id,
    word_id: intent.word_id,
    outcome: 'inserted',
    existing_word_id: null,
    idempotent: false,
  })
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.word_content_state WHERE word_id = '${intent.word_id}';`
    ),
    '0'
  )
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `INSERT INTO public.words(word_id,user_id,dutch_lemma,
    translations,tts_url) VALUES('${intent.word_id}','${f.user}','fiets','{}','')
    ON CONFLICT(word_id) DO NOTHING;`
      )
    ),
    /row-level security/
  )
  await db.sql(
    asUser(
      f.user,
      `UPDATE public.words SET collection_id = '${intent.collection_id}'
    WHERE word_id = '${intent.word_id}' RETURNING word_id;`
    )
  )
  await assert.rejects(
    db.sql(`UPDATE private.dictionary_import_receipts SET intent_sha256 = repeat('0',64)
    WHERE user_id = '${f.user}';`),
    /rows are immutable/
  )
  const snapshot = JSON.parse(
    await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${intent.word_id}';`
    )
  )
  assert.equal(snapshot.dictionary_entry_id, null)
  assert.equal(snapshot.repetition_count, 0)
  await db.sql(
    `UPDATE public.words SET interval_days = 37, repetition_count = 8 WHERE word_id = '${intent.word_id}';`
  )
  assert.deepEqual(await apply(), { ...receipt, idempotent: true })
  assert.equal(
    await db.sql(
      `SELECT repetition_count FROM public.words WHERE word_id = '${intent.word_id}';`
    ),
    '8'
  )
  await assert.rejects(
    apply({ ...intent, interval_days: 900 }),
    /invalid-import-intent/
  )
  await assert.rejects(
    apply({
      ...intent,
      source: {
        ...intent.source,
        content: { ...intent.source.content, plural: 'mutated' },
      },
    }),
    /import-operation-conflict/
  )
  await db.sql(
    asUser(
      f.user,
      `SELECT public.apply_dictionary_content_command_v1(${json({
        protocol_version: 1,
        operation_id: randomUUID(),
        word_id: intent.word_id,
        expected_content_version: 0,
        kind: 'create-private',
        content: intent.source.content,
      })});`
    )
  )
  assert.equal(
    await db.sql(
      `SELECT content_version FROM public.word_content_state WHERE word_id = '${intent.word_id}';`
    ),
    '1'
  )
  await db.sql(`DELETE FROM public.words WHERE word_id = '${intent.word_id}';`)
  assert.equal((await apply()).idempotent, true)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE word_id = '${intent.word_id}';`
    ),
    '0'
  )
})

test('durable import records a different personal ID conflict without adopting or moving existing private content', async () => {
  const { f, target, intent, apply } = await intentFixture()
  const existing = randomUUID()
  await db.sql(`INSERT INTO public.words(word_id,user_id,dutch_lemma,part_of_speech,article,translations,tts_url,
    interval_days,repetition_count) VALUES ('${existing}','${f.user}','fiets','noun','de','{"en":["owner-private"]}','',29,7);`)
  const before = await db.sql(
    `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${existing}';`
  )
  const conflict = await apply()
  assert.equal(conflict.outcome, IDENTITY_CONFLICT)
  assert.equal(conflict.existing_word_id, existing)
  assert.equal(
    await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${existing}';`
    ),
    before
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE word_id = '${intent.word_id}';`
    ),
    '0'
  )
  await db.sql(`DELETE FROM public.words WHERE word_id = '${existing}';`)
  assert.equal((await apply()).outcome, IDENTITY_CONFLICT)
  const recovered = await apply({ ...intent, operation_id: randomUUID() })
  assert.equal(recovered.outcome, 'inserted')
  assert.equal(
    await db.sql(
      `SELECT collection_id FROM public.words WHERE word_id = '${intent.word_id}';`
    ),
    target
  )
})

test('durable import enforces owner, target, read-only creation restrictions and default-off gate', async () => {
  const { f, intent, apply } = await intentFixture()
  const other = await fixture()
  const foreign = await db.sql(`INSERT INTO public.collections(user_id,name)
    VALUES ('${other.user}','Foreign target') RETURNING collection_id;`)
  const collision =
    await db.sql(`INSERT INTO public.words(user_id,dutch_lemma,translations,tts_url)
    VALUES ('${other.user}','foreign-private','{}','') RETURNING word_id;`)
  await assert.rejects(
    apply({ ...intent, collection_id: foreign }),
    /access denied/
  )
  await assert.rejects(
    apply({ ...intent, word_id: collision }),
    /import-personal-id-unavailable/
  )
  await assert.rejects(
    apply({ ...intent, collection_id: randomUUID() }),
    /access denied/
  )
  await assert.rejects(
    db.sql(asUser(null, intentRpc(intent))),
    /authentication-required/
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; ${intentRpc(intent)}`),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      asUser(f.user, `SELECT count(*) FROM private.dictionary_import_receipts;`)
    ),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `INSERT INTO public.collections(user_id,name) VALUES('${f.user}','Forbidden new target');`
      )
    ),
    /row-level security/
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = false;'
  )
  await assert.rejects(apply(), /unsupported-protocol/)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = true;'
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM private.dictionary_import_receipts WHERE user_id = '${f.user}';`
    ),
    '0'
  )
})

test('durable official source validates exact manifest and mapping; create-private/link preserves version order', async () => {
  const { f, intent, content, apply } = await intentFixture()
  await db.sql(insert(f))
  const official = {
    ...intent,
    source: {
      kind: 'official-pack',
      pack_id: f.pack,
      version: '1.0.0',
      pack_entry_id: f.entry.entry_id,
      manifest_sha256: f.manifestHash,
      reference: {
        entry_id: f.reference.entry_id,
        revision_id: f.reference.revision_id,
      },
      content,
    },
  }
  await assert.rejects(
    apply({
      ...official,
      source: { ...official.source, manifest_sha256: '0'.repeat(64) },
    }),
    /official-pack-unavailable/
  )
  await assert.rejects(
    apply({ ...official, source: { ...official.source, reference: null } }),
    /invalid-import-reference/
  )
  await assert.rejects(
    apply({
      ...official,
      source: {
        ...official.source,
        content: { ...content, plural: 'client-forged' },
      },
    }),
    /invalid-import-source/
  )
  assert.equal((await apply(official)).outcome, 'inserted')
  const commands = [
    { kind: 'create-private', expected_content_version: 0, content },
    {
      kind: 'link',
      expected_content_version: 1,
      reference: official.source.reference,
      overrides: {},
    },
  ]
  for (const command of commands)
    await db.sql(
      asUser(
        f.user,
        `SELECT public.apply_dictionary_content_command_v1(${json({
          protocol_version: 1,
          operation_id: randomUUID(),
          word_id: intent.word_id,
          ...command,
        })});`
      )
    )
  assert.equal(
    await db.sql(
      `SELECT content_version FROM public.word_content_state WHERE word_id = '${intent.word_id}';`
    ),
    '2'
  )
  assert.equal(
    await db.sql(
      `SELECT dictionary_entry_id FROM public.words WHERE word_id = '${intent.word_id}';`
    ),
    f.reference.entry_id
  )
  await db.sql(
    `UPDATE public.dictionary_entries SET state = 'retired' WHERE entry_id = '${f.reference.entry_id}';`
  )
  const afterRetirement = {
    ...official,
    word_id: randomUUID(),
    operation_id: randomUUID(),
  }
  await assert.rejects(apply(afterRetirement), /invalid-import-reference/)
  assert.equal((await apply(official)).idempotent, true)
})

test('concurrent durable import requests serialize receipt replay and semantic conflicts', async () => {
  const { f, intent } = await intentFixture()
  const first = asUser(f.user, intentRpc(intent))
  const replay = JSON.parse(await overlap(db, first, first))
  assert.equal(replay.idempotent, true)
  const race = await intentFixture()
  const conflicting = {
    ...race.intent,
    operation_id: randomUUID(),
    word_id: randomUUID(),
  }
  const duplicate = JSON.parse(
    await overlap(
      db,
      asUser(race.f.user, intentRpc(race.intent)),
      asUser(race.f.user, intentRpc(conflicting))
    )
  )
  assert.equal(duplicate.outcome, IDENTITY_CONFLICT)
  assert.equal(duplicate.existing_word_id, race.intent.word_id)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.words WHERE user_id = '${race.f.user}';`
    ),
    '1'
  )
})
