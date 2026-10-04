import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal } from './fixtures.mjs'

// Historical counterexamples, deliberately pinned BEFORE the recovery migration.
// These document gaps; they are not acceptance tests for the new protocol.
let db
before(async () => {
  db = await createCluster({
    throughMigration: '20261002110000_add_dictionary_import_intents.sql',
  })
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    reads_enabled = true, operations_enabled = true, legacy_guard_enabled = true;`)
})
after(async () => db?.close())

async function fixture() {
  const user = randomUUID()
  await db.sql(`INSERT INTO auth.users(id,email)
    VALUES ('${user}','${user}@example.invalid');`)
  const targets = []
  for (const name of ['Original', 'Recovery']) {
    targets.push(
      await db.sql(`INSERT INTO public.collections(user_id,name)
        VALUES ('${user}', '${name}') RETURNING collection_id;`)
    )
  }
  const entry = {
    entry_id: 'synthetic-recovery-baseline',
    dutch_lemma: 'fiets',
    part_of_speech: 'noun',
    article: 'de',
    translations: { en: ['bicycle'] },
  }
  const content = JSON.parse(
    await db.sql(`SELECT private.official_dictionary_content_v1(
      ${literal(JSON.stringify(entry))}::jsonb);`)
  )
  const intent = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: targets[0],
    source: { kind: 'private-copy', content },
  }
  const apply = (input = intent) =>
    db
      .sql(
        asUser(
          user,
          `SELECT public.apply_dictionary_import_intent_v1(
            ${literal(JSON.stringify(input))}::jsonb);`
        )
      )
      .then(JSON.parse)
  const read = () =>
    db
      .sql(
        `SELECT to_jsonb(w) FROM public.words w
        WHERE word_id = '${intent.word_id}';`
      )
      .then(value => (value ? JSON.parse(value) : null))
  return { user, targets, intent, apply, read }
}

test('baseline: rotating a nonce fails before deletion but resurrects an accepted ID after deletion', async () => {
  const f = await fixture()
  assert.equal((await f.apply()).outcome, 'inserted')
  const successor = {
    ...f.intent,
    operation_id: randomUUID(),
    collection_id: f.targets[1],
  }
  await assert.rejects(f.apply(successor), /import-personal-id-unavailable/)
  await db.sql(`UPDATE public.words SET interval_days = 37, repetition_count = 8
    WHERE word_id = '${f.intent.word_id}';`)
  await db.sql(
    asUser(
      f.user,
      `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
    )
  )
  assert.equal((await f.apply()).idempotent, true)
  assert.equal(await f.read(), null)
  assert.equal((await f.apply(successor)).outcome, 'inserted')
  const recreated = await f.read()
  assert.equal(recreated.word_id, f.intent.word_id)
  assert.equal(recreated.collection_id, f.targets[1])
  assert.equal(recreated.interval_days, 1)
  assert.equal(recreated.repetition_count, 0)
})

test('baseline: deleting an undelivered ID does not fence a late original import', async () => {
  const f = await fixture()
  await db.sql(
    asUser(
      f.user,
      `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
    )
  )
  assert.equal(await f.read(), null)
  assert.equal((await f.apply()).outcome, 'inserted')
  assert.equal((await f.read()).word_id, f.intent.word_id)
})

test('baseline: target deletion leaves NULL placement; read-only owner can move without resetting content or SRS', async () => {
  const f = await fixture()
  await f.apply()
  await db.sql(`UPDATE public.words SET interval_days = 37, repetition_count = 8
    WHERE word_id = '${f.intent.word_id}';
    DELETE FROM public.collections WHERE collection_id = '${f.targets[0]}';`)
  const detached = await f.read()
  assert.equal(detached.collection_id, null)
  assert.equal((await f.apply()).idempotent, true)
  assert.deepEqual(await f.read(), detached)
  await assert.rejects(
    db.sql(
      asUser(
        f.user,
        `INSERT INTO public.collections(user_id,name) VALUES ('${f.user}','Forbidden');`
      )
    ),
    /row-level security/
  )
  await db.sql(
    asUser(
      f.user,
      `UPDATE public.words SET collection_id = '${f.targets[1]}'
        WHERE word_id = '${f.intent.word_id}';`
    )
  )
  const moved = await f.read()
  assert.equal(moved.collection_id, f.targets[1])
  const withoutMetadata = ({ collection_id, updated_at, ...value }) => value
  assert.deepEqual(withoutMetadata(moved), withoutMetadata(detached))
})
