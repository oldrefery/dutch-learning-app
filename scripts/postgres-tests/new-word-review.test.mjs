import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  owner,
  other,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(
    `UPDATE user_access_levels SET access_level = 'full_access' WHERE user_id = '${owner}';`
  )
})
after(async () => db?.close())

for (const date of ['DEFAULT', "'2099-01-01'::date", 'CURRENT_DATE - 30']) {
  test(`a new authenticated word is due today regardless of snapshot date ${date}`, async () => {
    const word = randomUUID()
    const due = await db.sql(
      asUser(
        owner,
        `
      INSERT INTO words(word_id, user_id, dutch_lemma, translations, tts_url,
        next_review_date, repetition_count, interval_days, easiness_factor,
        last_reviewed_at)
      VALUES ('${word}', '${owner}', '${word}', '{}', '', ${date}, 99, 999, 1.3, now())
      RETURNING next_review_date = CURRENT_DATE;`
      )
    )
    assert.equal(
      due,
      't',
      'New words must be immediately eligible for their first review'
    )
    const saved = (await state(db, word)).word
    assert.equal(saved.repetition_count, 0)
    assert.equal(saved.interval_days, 1)
    assert.equal(saved.easiness_factor, 2.5)
    assert.equal(saved.last_reviewed_at, null)
  })
}

test('first review schedules from today, stale upsert preserves it, and reset still schedules tomorrow', async () => {
  const word = randomUUID()
  await db.sql(
    asUser(
      owner,
      `
    INSERT INTO words(word_id, user_id, dutch_lemma, translations, tts_url)
      VALUES ('${word}', '${owner}', '${word}', '{}', '');
    SELECT * FROM record_review_assessment('${word}', '${randomUUID()}',
      'easy', 'meaning-recall', NULL, NULL, now(), CURRENT_DATE);`
    )
  )
  const reviewed = await state(db, word)
  assert.equal(reviewed.word.repetition_count, 1)
  assert.equal(reviewed.word.interval_days, 4)
  assert.equal(
    await db.sql(
      `SELECT next_review_date = CURRENT_DATE + 4 FROM words WHERE word_id = '${word}';`
    ),
    't'
  )
  await db.sql(
    asUser(
      owner,
      `
    INSERT INTO words(word_id, user_id, dutch_lemma, translations, tts_url, next_review_date)
      VALUES ('${word}', '${owner}', '${word}', '{}', '', CURRENT_DATE)
      ON CONFLICT (word_id) DO UPDATE SET next_review_date = EXCLUDED.next_review_date;`
    )
  )
  const afterUpsert = await state(db, word)
  assert.equal(
    afterUpsert.word.next_review_date,
    reviewed.word.next_review_date
  )
  assert.equal(afterUpsert.word.repetition_count, 1)
  assert.deepEqual(afterUpsert.events, reviewed.events)
  await db.sql(
    asUser(
      owner,
      `SELECT * FROM reset_word_learning_progress(
    '${word}', '${randomUUID()}', now(), CURRENT_DATE);`
    )
  )
  assert.equal(
    await db.sql(
      `SELECT next_review_date = CURRENT_DATE + 1 FROM words WHERE word_id = '${word}';`
    ),
    't'
  )
  assert.deepEqual((await state(db, word)).events, reviewed.events)
})

test('replacing the trigger preserves existing rows, function ownership and privileges', async () => {
  const words = [await seedWord(db, owner), await seedWord(db, other)]
  const saved = await Promise.all(words.map(word => state(db, word)))
  const functionIdentity = () =>
    db.sql(`SELECT json_build_array(oid, proowner, proacl)
    FROM pg_proc WHERE oid = 'public.protect_word_learning_progress()'::regprocedure;`)
  const identity = await functionIdentity()
  await db.sql(
    await readFile(
      new URL(
        '../../supabase/migrations/20260906110000_make_new_words_immediately_reviewable.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  assert.deepEqual(await Promise.all(words.map(word => state(db, word))), saved)
  assert.equal(await functionIdentity(), identity)
})
