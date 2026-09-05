import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  literal,
  owner,
  other,
  review,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'

let db
const tomorrow = '2026-09-06'
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(
    `UPDATE user_access_levels SET access_level = 'full_access' WHERE user_id = '${owner}';`
  )
})
after(async () => {
  await db?.close()
})

const uploadSnapshot = (snapshot, sql = '') =>
  db.sql(
    asUser(
      owner,
      `
  INSERT INTO words SELECT * FROM json_populate_record(NULL::words, ${literal(JSON.stringify(snapshot))}::json)
  ON CONFLICT (word_id) DO UPDATE SET
    interval_days = EXCLUDED.interval_days, repetition_count = EXCLUDED.repetition_count,
    easiness_factor = EXCLUDED.easiness_factor, next_review_date = EXCLUDED.next_review_date,
    last_reviewed_at = EXCLUDED.last_reviewed_at, image_url = EXCLUDED.image_url;
  ${sql}`
    )
  )
const uploadEvent = event =>
  db.sql(
    asUser(
      owner,
      `
  INSERT INTO review_events SELECT * FROM json_populate_record(NULL::review_events, ${literal(JSON.stringify(event))}::json)
  ON CONFLICT(event_id) DO UPDATE SET previous_interval_days = EXCLUDED.previous_interval_days,
    next_interval_days = EXCLUDED.next_interval_days, previous_easiness_factor = EXCLUDED.previous_easiness_factor,
    next_easiness_factor = EXCLUDED.next_easiness_factor;`
    )
  )

test('two-client regression: later Good, older offline Easy and legacy snapshots retain both assessments', async () => {
  const word = await seedWord(db)
  const initial = (await state(db, word)).word
  const good = assessment(word, { at: '2026-09-05T18:18:16.085Z' })
  await review(db, good)
  const offline = {
    ...initial,
    interval_days: 4,
    repetition_count: 1,
    last_reviewed_at: '2026-09-05T18:16:39.282Z',
    next_review_date: '2026-09-09',
  }
  await uploadSnapshot(offline)
  assert.equal((await state(db, word)).word.interval_days, 1)
  const event = {
    ...(await state(db, word)).events[0],
    event_id: randomUUID(),
    assessment: 'easy',
    reviewed_at: offline.last_reviewed_at,
    previous_interval_days: 1,
    next_interval_days: 4,
    review_date: null,
    created_at: '2000-01-01T00:00:00Z',
  }
  await uploadEvent(event)
  const result = await state(db, word)
  assert.equal(result.word.repetition_count, 2)
  assert.equal(result.word.interval_days, 10)
  assert.equal(result.word.easiness_factor, 2.5)
  assert.equal(result.word.last_reviewed_at, '2026-09-05T18:18:16.085+00:00')
  assert.equal(result.word.next_review_date, '2026-09-15')
  assert.equal(result.events.length, 2)
  const savedEasy = result.events.find(row => row.event_id === event.event_id)
  assert.equal(savedEasy.next_interval_days, 10)
  assert.notEqual(savedEasy.created_at, event.created_at)
  await uploadEvent(event)
  assert.deepEqual(await state(db, word), result)
  await uploadSnapshot({
    ...offline,
    image_url: 'https://example.invalid/new.jpg',
  })
  const refreshed = (await state(db, word)).word
  assert.equal(refreshed.repetition_count, 2)
  assert.equal(refreshed.interval_days, 10)
  assert.equal(refreshed.image_url, 'https://example.invalid/new.jpg')
})

test('late review keeps the latest date as its scheduling anchor', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word, { at: '2026-09-05T12:00:00Z' }))
  const result = await review(
    db,
    assessment(word, {
      at: '2026-09-01T12:00:00Z',
      date: '2026-09-01',
      rating: 'hard',
    })
  )
  assert.equal(result.repetition_count, 2)
  assert.equal(result.easiness_factor, 2.35)
  assert.equal(result.last_reviewed_at, '2026-09-05T12:00:00+00:00')
  assert.equal(result.next_review_date, tomorrow)
})

test('a native batch calculates each event after the preceding event, with immutable canonical history', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const template = (await state(db, word)).events[0]
  const events = [1, 2].map(() => ({
    ...template,
    event_id: randomUUID(),
    previous_interval_days: 999,
    next_interval_days: 999,
  }))
  const insert = `INSERT INTO review_events SELECT * FROM json_populate_recordset(NULL::review_events, ${literal(JSON.stringify(events))}::json)
    ON CONFLICT(event_id) DO UPDATE SET next_interval_days = EXCLUDED.next_interval_days;`
  await db.sql(asUser(owner, insert))
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 3)
  assert.equal(saved.word.interval_days, 15)
  assert.deepEqual(
    saved.events.map(row => row.next_interval_days).sort((a, b) => a - b),
    [1, 6, 15]
  )
  await db.sql(asUser(owner, insert))
  assert.deepEqual(await state(db, word), saved)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE review_events SET next_interval_days = 777 WHERE event_id = '${events[0].event_id}';`
      )
    ),
    /immutable/
  )
})

test('new offline word snapshots cannot pre-apply the queued first assessment', async () => {
  const template = (await state(db, await seedWord(db))).word
  const word = randomUUID()
  await uploadSnapshot({
    ...template,
    word_id: word,
    dutch_lemma: word,
    repetition_count: 77,
    interval_days: 999,
    last_reviewed_at: '2026-09-05T12:00:00Z',
  })
  assert.equal((await state(db, word)).word.repetition_count, 0)
  assert.equal(
    (await review(db, assessment(word, { rating: 'easy' }))).interval_days,
    4
  )
})

test('direct reset fails visibly while stale snapshots cannot mutate progress', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const before = await state(db, word)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE words SET interval_days = 1,
    repetition_count = 0, easiness_factor = 2.5, last_reviewed_at = NULL WHERE word_id = '${word}';`
      )
    ),
    /update the client/
  )
  assert.deepEqual(await state(db, word), before)
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET repetition_count = 99, interval_days = 999 WHERE word_id = '${word}';`
    )
  )
  assert.equal((await state(db, word)).word.repetition_count, 1)
  await assert.rejects(
    db.sql(asUser(owner, 'SELECT * FROM learning_resets;')),
    /permission denied/
  )
})

test('unknown pre-cutover events fail closed, but known retries and new assessments work', async () => {
  const word = await seedWord(db)
  const known = assessment(word)
  await review(db, known)
  await db.sql(
    `INSERT INTO learning_progress_cutovers VALUES ('${word}', '${owner}', '2026-09-05T13:00:00Z');`
  )
  const before = await state(db, word)
  await assert.rejects(review(db, assessment(word)), /requires reconciliation/)
  assert.deepEqual(await state(db, word), before)
  await review(db, known)
  assert.deepEqual(await state(db, word), before)
  const result = await review(
    db,
    assessment(word, { at: '2026-09-05T14:00:00Z' })
  )
  assert.equal(result.repetition_count, 2)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `DELETE FROM learning_progress_cutovers WHERE word_id = '${word}';`
      )
    ),
    /permission denied/
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `SELECT count(*) FROM learning_progress_cutovers WHERE word_id = '${word}';`
      )
    ),
    '0'
  )
})
