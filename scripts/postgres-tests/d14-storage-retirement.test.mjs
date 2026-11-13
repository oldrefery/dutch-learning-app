import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  seedUsers,
  seedWord,
  owner,
  other,
  literal,
  asUser,
  state,
  assessment,
  review,
  rpc,
} from './fixtures.mjs'
import { session } from './following-session.fixture.mjs'

let db
const schema = 'dictionary_storage_rehearsal'
const reviewDate = '2026-11-12'
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const content = note => ({
  dutch_lemma: 'fiets',
  dutch_original: 'fiets',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['bicycle'], ru: ['велосипед'] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'fietsen',
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: note,
  usage_notes: null,
  image_url: null,
  tts_url: null,
})
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(
    `SET dictionary_storage_rehearsal.install='local-synthetic-only';\n${await readFile(new URL('../shared-dictionary/d14-storage-rehearsal.sql', import.meta.url), 'utf8')}`
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET reads_enabled=true,operations_enabled=true,legacy_guard_enabled=true,following_reads_enabled=true WHERE singleton;'
  )
})
after(async () => {
  await db?.close()
})
const query = sql => db.sql(sql).then(JSON.parse)
const plan = (ids, user = owner) =>
  query(`SELECT ${schema}.plan('${user}',ARRAY[${ids.map(literal)}]::uuid[]);`)
const capture = (word, user = owner) =>
  query(`SELECT ${schema}.capture('${user}','${word}');`)
const applySql = (operation, payload, user = owner) =>
  `SELECT ${schema}.prune('${operation}','${user}',${json(payload)});`
const apply = (operation, payload, user = owner) =>
  query(applySql(operation, payload, user))
const restore = (operation, payload, user = owner) =>
  query(
    `SELECT ${schema}.restore('${operation}','${user}',${schema}.hash(${json([...payload].sort((a, b) => a.word_id.localeCompare(b.word_id)))}));`
  )
const rows = ids => Promise.all(ids.map(id => state(db, id)))
async function revision(entry, number) {
  const id = randomUUID(),
    source = randomUUID()
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256) VALUES('${source}','editorial','fixture://d142/${source}','approved','${owner}',now(),'${'a'.repeat(64)}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at) VALUES('${id}','${entry}',${number},1,${json(content(`Revision ${number}`))},'${'a'.repeat(64)}','${'b'.repeat(64)}','${source}','published',now(),now());`)
  return id
}
async function fixture(count = 1) {
  const ids = [],
    entries = [],
    revisions = []
  for (let i = 0; i < count; i++) {
    const word = await seedWord(db, owner, {
        intervalDays: 12,
        repetitionCount: 7,
      }),
      entry = randomUUID()
    await db.sql(
      `INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key) VALUES('${entry}','nl','fiets-${entry}','noun','de','fixture');`
    )
    const rev = await revision(entry, 1)
    await db.sql(`INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES('${entry}','${rev}');UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';
      BEGIN;UPDATE public.words SET translations='{"en":["retained original"],"ru":[]}',analysis_notes='Retained personal copy',dictionary_entry_id='${entry}',dictionary_revision_id='${rev}',dictionary_content_mode='follow' WHERE word_id='${word}';
      INSERT INTO public.word_content_state(word_id,user_id,content_version,overrides) VALUES('${word}','${owner}',1,'{}');COMMIT;`)
    ids.push(word)
    entries.push(entry)
    revisions.push(rev)
  }
  return {
    ids,
    entries,
    revisions,
    operation: randomUUID(),
    payload: await plan(ids),
  }
}
const unchanged = async (f, expected) => {
  assert.deepEqual(await rows(f.ids), expected)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM ${schema}.operations WHERE operation_id='${f.operation}';`
    ),
    '0'
  )
}
async function failureTrigger(word) {
  const name = 'storage_fault_' + randomUUID().replaceAll('-', '')
  await db.sql(`CREATE FUNCTION ${schema}.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.word_id='${word}' THEN RAISE EXCEPTION 'injected-mid-batch-failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER ${name} BEFORE UPDATE ON public.words FOR EACH ROW EXECUTE FUNCTION ${schema}.${name}();`)
  return () =>
    db.sql(
      `DROP TRIGGER ${name} ON public.words;DROP FUNCTION ${schema}.${name}();`
    )
}

test('explicit bounded plan; private/foreign/missing words, duplicate IDs and malformed plans fail closed', async () => {
  const privateWord = await seedWord(db),
    foreignWord = await seedWord(db, other)
  await assert.rejects(plan([]), /invalid-bounded-ids/)
  await assert.rejects(
    plan(Array.from({ length: 21 }, randomUUID)),
    /invalid-bounded-ids/
  )
  await assert.rejects(plan([privateWord, privateWord]), /invalid-bounded-ids/)
  for (const id of [privateWord, foreignWord, randomUUID()])
    await assert.rejects(plan([id]), /ineligible-word/)
  const f = await fixture(),
    baseline = await rows(f.ids)
  for (const bad of [
    null,
    {},
    [],
    [f.payload[0], f.payload[0]],
    [{ ...f.payload[0], extra: 'ignored' }],
    [{ word_id: f.ids[0], expected_hash: null }],
  ])
    await assert.rejects(apply(f.operation, bad), /invalid-/)
  await assert.rejects(
    apply(f.operation, f.payload, other),
    /not-found-or-not-owned/
  )
  await unchanged(f, baseline)
})

test('apply is atomic, idempotent, published reads unchanged, and snapshots exclude learning', async () => {
  const f = await fixture(2),
    before = await rows(f.ids)
  const read = () =>
    query(
      asUser(
        owner,
        `SELECT public.d14_read_following_bootstrap_v1(ARRAY[${f.ids.map(literal)}]::uuid[]);`
      )
    )
  const published = (await read()).snapshot
  const result = await apply(f.operation, f.payload)
  assert.equal(result.count, 2)
  const applied = await rows(f.ids)
  assert.deepEqual(await apply(f.operation, [...f.payload].reverse()), result)
  assert.deepEqual(await rows(f.ids), applied)
  assert.deepEqual((await read()).snapshot, published)
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(applied[i].word.translations, { en: [], ru: [] })
    for (const key of [
      'word_id',
      'user_id',
      'dutch_lemma',
      'part_of_speech',
      'article',
      'dictionary_entry_id',
      'dictionary_revision_id',
      'dictionary_content_mode',
      'collection_id',
      'interval_days',
      'repetition_count',
      'easiness_factor',
      'next_review_date',
      'last_reviewed_at',
    ])
      assert.deepEqual(applied[i].word[key], before[i].word[key])
    assert.deepEqual(applied[i].events, before[i].events)
  }
  const receipt = await query(
    `SELECT before_rows FROM ${schema}.operations WHERE operation_id='${f.operation}';`
  )
  assert.equal(JSON.stringify(receipt).includes('repetition_count'), false)
  assert.equal(JSON.stringify(receipt).includes('next_review_date'), false)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM ${schema}.operations WHERE operation_id='${f.operation}';`
    ),
    '1'
  )
  await assert.rejects(
    apply(f.operation, [{ ...f.payload[0], expected_hash: 'a'.repeat(64) }]),
    /operation-intent-mismatch/
  )
  await assert.rejects(
    apply(randomUUID(), await plan(f.ids)),
    /already-pruned-word/
  )
})

test('selective restore retains new learning and placement; flags may be off; repeat cannot undo later changes', async () => {
  const f = await fixture(),
    word = f.ids[0],
    before = await capture(word)
  await apply(f.operation, f.payload)
  await review(
    db,
    assessment(word, { at: '2026-11-12T12:00:00Z', date: reviewDate })
  )
  const collection = randomUUID()
  await db.sql(
    `INSERT INTO public.collections(collection_id,user_id,name) VALUES('${collection}','${owner}','Moved fixture');UPDATE public.words SET collection_id='${collection}' WHERE word_id='${word}';UPDATE private.dictionary_content_runtime SET following_reads_enabled=false WHERE singleton;`
  )
  try {
    const learned = await state(db, word),
      result = await restore(f.operation, f.payload)
    const restored = await state(db, word)
    assert.equal(learned.events.length, 1)
    assert.deepEqual(restored.events, learned.events)
    for (const key of [
      'interval_days',
      'repetition_count',
      'easiness_factor',
      'next_review_date',
      'last_reviewed_at',
      'collection_id',
    ])
      assert.deepEqual(restored.word[key], learned.word[key])
    assert.deepEqual(await capture(word), before)
    assert.deepEqual(await restore(f.operation, f.payload), result)
    assert.deepEqual(await state(db, word), restored)
    assert.equal((await apply(f.operation, f.payload)).state, 'restored')
    assert.deepEqual(await state(db, word), restored)
  } finally {
    await db.sql(
      'UPDATE private.dictionary_content_runtime SET following_reads_enabled=true WHERE singleton;'
    )
  }
})

test('changed lexical copy or content version rejects the reviewed plan without mutation', async () => {
  for (const change of [
    "UPDATE public.words SET analysis_notes='Changed' WHERE word_id=",
    'UPDATE public.word_content_state SET content_version=content_version+1 WHERE word_id=',
  ]) {
    const f = await fixture()
    await db.sql(`${change}'${f.ids[0]}';`)
    const changed = await rows(f.ids)
    await assert.rejects(apply(f.operation, f.payload), /stale-plan/)
    await unchanged(f, changed)
  }
})

test('deletion, detachment and missing head sequence reject apply', async () => {
  for (const kind of ['deleted', 'detached', 'dependency']) {
    const f = await fixture()
    await db.sql(
      kind === 'deleted'
        ? `UPDATE public.words SET deleted_at=now() WHERE word_id='${f.ids[0]}';`
        : kind === 'detached'
          ? `UPDATE public.words SET dictionary_content_mode='legacy' WHERE word_id='${f.ids[0]}';`
          : `DELETE FROM private.dictionary_content_changes WHERE entry_id='${f.entries[0]}' AND change_kind='revision-head';`
    )
    const changed = await rows(f.ids)
    await assert.rejects(
      apply(f.operation, f.payload),
      /ineligible-word|unavailable-head-sequence/
    )
    await unchanged(f, changed)
  }
})

test('snapshot bound rejects large copies before any mutation', async () => {
  const f = await fixture()
  await db.sql(
    `UPDATE public.words SET dutch_original=repeat('x',2097153) WHERE word_id='${f.ids[0]}';`
  )
  f.payload = await plan(f.ids)
  const before = await rows(f.ids)
  await assert.rejects(apply(f.operation, f.payload), /snapshot-byte-limit/)
  await unchanged(f, before)
})

test('failure on the second apply row rolls back the entire batch and receipt', async () => {
  const f = await fixture(2),
    before = await rows(f.ids),
    cleanup = await failureTrigger([...f.ids].sort()[1])
  try {
    await assert.rejects(
      apply(f.operation, f.payload),
      /injected-mid-batch-failure/
    )
    await unchanged(f, before)
  } finally {
    await cleanup()
  }
  assert.equal((await apply(f.operation, f.payload)).count, 2)
})

test('failure on second restore row retains all pruned rows and creates no restoration receipt', async () => {
  const f = await fixture(2)
  await apply(f.operation, f.payload)
  const before = await rows(f.ids),
    cleanup = await failureTrigger([...f.ids].sort()[1])
  try {
    await assert.rejects(
      restore(f.operation, f.payload),
      /injected-mid-batch-failure/
    )
    assert.deepEqual(await rows(f.ids), before)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM ${schema}.restores WHERE operation_id='${f.operation}';`
      ),
      '0'
    )
  } finally {
    await cleanup()
  }
  assert.equal((await restore(f.operation, f.payload)).count, 2)
})

test('restore rejects lexical edit, changed state version, detachment, deletion and changed published head', async () => {
  for (const kind of ['lexical', 'version', 'detach', 'delete', 'head']) {
    const f = await fixture()
    await apply(f.operation, f.payload)
    if (kind === 'head') {
      const rev = await revision(f.entries[0], 2)
      await db.sql(
        `UPDATE public.dictionary_entry_heads SET revision_id='${rev}' WHERE entry_id='${f.entries[0]}';`
      )
    } else {
      const mutations = {
        lexical: `UPDATE public.words SET analysis_notes='Do not overwrite' WHERE word_id='${f.ids[0]}';`,
        version: `UPDATE public.word_content_state SET content_version=content_version+1 WHERE word_id='${f.ids[0]}';`,
        detach: `UPDATE public.words SET dictionary_content_mode='legacy' WHERE word_id='${f.ids[0]}';`,
        delete: `UPDATE public.words SET deleted_at=now() WHERE word_id='${f.ids[0]}';`,
      }
      await db.sql(mutations[kind])
    }
    const changed = await rows(f.ids)
    await assert.rejects(
      restore(f.operation, f.payload),
      /stale-prune-result|ineligible-word/
    )
    assert.deepEqual(await rows(f.ids), changed)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM ${schema}.restores WHERE operation_id='${f.operation}';`
      ),
      '0'
    )
  }
})

test('unknown receipt, wrong owner/hash and application-role calls fail; receipts are immutable', async () => {
  const f = await fixture()
  await assert.rejects(restore(f.operation, f.payload), /missing-prune-receipt/)
  await apply(f.operation, f.payload)
  await assert.rejects(
    restore(f.operation, f.payload, other),
    /operation-intent-mismatch/
  )
  await assert.rejects(
    query(
      `SELECT ${schema}.restore('${f.operation}','${owner}','${'0'.repeat(64)}');`
    ),
    /operation-intent-mismatch/
  )
  for (const role of ['anon', 'authenticated', 'service_role'])
    await assert.rejects(
      db.sql(`SET ROLE ${role};${applySql(randomUUID(), f.payload)}`),
      /permission denied/
    )
  await assert.rejects(
    db.sql(
      `UPDATE ${schema}.operations SET before_rows='[]' WHERE operation_id='${f.operation}';`
    ),
    /immutable-rehearsal-receipt/
  )
  await assert.rejects(
    db.sql(`TRUNCATE ${schema}.restores;`),
    /immutable-rehearsal-receipt/
  )
})

test('competing word lock fails boundedly; committed learning remains valid for old plan', async () => {
  const f = await fixture(),
    holder = await session(db)
  try {
    await holder.mark(
      `BEGIN;SELECT word_id FROM public.words WHERE word_id='${f.ids[0]}' FOR UPDATE;`
    )
    await assert.rejects(apply(f.operation, f.payload), /could not obtain lock/)
  } finally {
    await holder.finish()
  }
  await review(
    db,
    assessment(f.ids[0], { at: '2026-11-12T12:00:00Z', date: reviewDate })
  )
  const learned = await state(db, f.ids[0])
  await apply(f.operation, f.payload)
  const after = await state(db, f.ids[0])
  assert.deepEqual(after.events, learned.events)
  assert.equal(after.word.repetition_count, learned.word.repetition_count)
})

test('publication lock is rejected, and publication committed after review invalidates the plan', async () => {
  const f = await fixture(),
    rev = await revision(f.entries[0], 2),
    holder = await session(db)
  try {
    await holder.mark(
      `BEGIN;SELECT entry_id FROM public.dictionary_entries WHERE entry_id='${f.entries[0]}' FOR UPDATE;UPDATE public.dictionary_entry_heads SET revision_id='${rev}' WHERE entry_id='${f.entries[0]}';`
    )
    await assert.rejects(apply(f.operation, f.payload), /could not obtain lock/)
    await holder.finish('COMMIT')
  } finally {
    await holder.finish()
  }
  await assert.rejects(apply(f.operation, f.payload), /stale-plan/)
})

test('concurrent same-operation calls produce one receipt and no duplicate mutation', async () => {
  const f = await fixture()
  const [a, b] = await Promise.all([
    apply(f.operation, f.payload),
    apply(f.operation, f.payload),
  ])
  assert.deepEqual(a, b)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM ${schema}.operations WHERE operation_id='${f.operation}';`
    ),
    '1'
  )
})

test('a genuinely concurrent study answer waits for prune commit and survives selective restore', async () => {
  const f = await fixture(),
    operator = await session(db),
    learner = await session(db)
  const input = assessment(f.ids[0], {
    at: '2026-11-12T13:00:00Z',
    date: reviewDate,
  })
  try {
    await operator.mark(`BEGIN;${applySql(f.operation, f.payload)}`)
    learner.write(`BEGIN;${asUser(owner, rpc(input))}`)
    await learner.waitLock(operator)
    await operator.finish('COMMIT')
    await learner.finish('COMMIT')
  } finally {
    await operator.finish()
    await learner.finish()
  }
  const learned = await state(db, f.ids[0])
  assert.equal(learned.events.length, 1)
  assert.deepEqual(learned.word.translations, { en: [], ru: [] })
  await restore(f.operation, f.payload)
  const restored = await state(db, f.ids[0])
  assert.deepEqual(restored.events, learned.events)
  assert.equal(restored.word.repetition_count, learned.word.repetition_count)
})
