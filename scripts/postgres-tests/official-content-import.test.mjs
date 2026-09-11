import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, literal, other, owner, seedUsers } from './fixtures.mjs'

const word = (index, overrides = {}) => ({
  dutch_lemma: `fixture-${index}`,
  dutch_original: `fixture-${index}`,
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: [`fixture ${index}`] },
  examples: [],
  synonyms: [],
  antonyms: [],
  ...overrides,
})

const importWords = (collectionId, words) =>
  `SELECT count(*) FROM public.import_words_to_collection(
    '${collectionId}', ${literal(JSON.stringify(words))}::jsonb
  );`

let db
let ownerCollection
let otherCollection

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  ownerCollection = await db.sql(`INSERT INTO collections(user_id, name)
    VALUES ('${owner}', 'Official import fixture') RETURNING collection_id;`)
  otherCollection = await db.sql(`INSERT INTO collections(user_id, name)
    VALUES ('${other}', 'Foreign fixture') RETURNING collection_id;`)
})

after(async () => {
  await db?.close()
})

test('a full-size pack imports into one owned collection with pending-neutral SRS defaults', async () => {
  const collection = await db.sql(`INSERT INTO collections(user_id, name)
    VALUES ('${owner}', 'Full pack fixture') RETURNING collection_id;`)
  const entries = Array.from({ length: 122 }, (_, index) => word(index))

  assert.equal(
    await db.sql(asUser(owner, importWords(collection, entries))),
    '122'
  )
  assert.equal(
    await db.sql(`SELECT count(*) || ':' || min(interval_days) || ':' ||
      min(repetition_count) || ':' || min(easiness_factor)
      FROM words WHERE collection_id = '${collection}';`),
    '122:1:0:2.5'
  )
})

test('an existing semantic word is returned but not copied or reset', async () => {
  const existingId = randomUUID()
  await db.sql(`INSERT INTO words(
      word_id, user_id, collection_id, dutch_lemma, part_of_speech, article,
      translations, tts_url, interval_days, repetition_count, easiness_factor,
      next_review_date, last_reviewed_at
    ) VALUES (
      '${existingId}', '${owner}', '${ownerCollection}', 'bestaand', 'noun', 'het',
      '{"en":["existing"]}', '', 34, 8, 2.9, '2026-10-15',
      '2026-09-10T08:00:00Z'
    );`)

  assert.equal(
    await db.sql(
      asUser(
        owner,
        importWords(ownerCollection, [
          word('duplicate', {
            dutch_lemma: '  BESTAAND ',
            dutch_original: 'changed',
            translations: { en: ['changed'] },
          }),
          word('fresh'),
        ])
      )
    ),
    '2'
  )
  assert.equal(
    await db.sql(`SELECT COALESCE(dutch_original, '<null>') || ':' || interval_days || ':' ||
      repetition_count || ':' || easiness_factor || ':' || next_review_date
      FROM words WHERE word_id = '${existingId}';`),
    '<null>:34:8:2.9:2026-10-15'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM words
      WHERE collection_id = '${ownerCollection}' AND dutch_lemma = 'fixture-fresh';`),
    '1'
  )
})

test('a malformed later entry rolls back every earlier insert in the call', async () => {
  const firstLemma = `rollback-${randomUUID()}`
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        importWords(ownerCollection, [
          word('rollback-first', { dutch_lemma: firstLemma }),
          word('rollback-invalid', { synonyms: null }),
        ])
      )
    ),
    /cannot extract elements from a scalar/
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM words WHERE dutch_lemma = '${firstLemma}';`
    ),
    '0'
  )
})

test('read-only product access can import into its existing collection but not another user collection', async () => {
  assert.equal(
    await db.sql(asUser(owner, `SELECT get_user_access_level('${owner}');`)),
    'read_only'
  )
  assert.equal(
    await db.sql(
      asUser(owner, importWords(ownerCollection, [word('read-only')]))
    ),
    '1'
  )
  await assert.rejects(
    db.sql(asUser(owner, importWords(otherCollection, [word('foreign')]))),
    /Collection not found or access denied/
  )
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM words WHERE dutch_lemma = 'fixture-foreign';`
    ),
    '0'
  )
})
