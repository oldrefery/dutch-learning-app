import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  owner,
  other,
  review,
  rpc,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('applies an assessment and persists matching immutable before/after history', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  assert.deepEqual(await review(db, input), {
    word_id: word,
    interval_days: 1,
    repetition_count: 1,
    easiness_factor: 2.5,
    next_review_date: '2026-09-06',
    last_reviewed_at: '2026-09-05T12:00:00+00:00',
  })
  const saved = await state(db, word)
  assert.equal(saved.events.length, 1)
  assert.deepEqual(saved.events[0], {
    event_id: input.event,
    user_id: owner,
    word_id: word,
    assessment: 'good',
    review_mode: 'meaning-recall',
    answered_correctly: true,
    response_time_ms: 750,
    previous_interval_days: 1,
    next_interval_days: 1,
    previous_easiness_factor: 2.5,
    next_easiness_factor: 2.5,
    reviewed_at: '2026-09-05T12:00:00+00:00',
    created_at: saved.events[0].created_at,
    review_date: '2026-09-05',
  })
})

test('an identical retry changes neither progress nor event timestamps', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  const result = await review(db, input)
  const before = await state(db, word)
  assert.deepEqual(await review(db, input), result)
  assert.deepEqual(await state(db, word), before)
})

for (const fields of [
  { rating: 'hard' },
  { mode: 'recognition' },
  { correct: false },
  { responseTime: 751 },
  { at: '2026-09-05T12:01:00Z' },
]) {
  test(`rejects an event ID reused with different data: ${JSON.stringify(fields)}`, async () => {
    const word = await seedWord(db)
    const input = assessment(word)
    await review(db, input)
    const before = await state(db, word)
    await assert.rejects(
      review(db, { ...input, ...fields }),
      /already exists with different data/
    )
    assert.deepEqual(await state(db, word), before)
  })
}

for (const fields of [
  { rating: null },
  { rating: 'invalid' },
  { mode: null },
  { mode: 'invalid' },
  { responseTime: -1 },
  { responseTime: 3600001 },
  { at: null },
  { date: null },
  { date: '2026-09-07' },
  { date: '2026-09-03' },
]) {
  test(`invalid assessment rolls back all writes: ${JSON.stringify(fields)}`, async () => {
    const word = await seedWord(db)
    const before = await state(db, word)
    await assert.rejects(review(db, assessment(word, fields)))
    assert.deepEqual(await state(db, word), before)
  })
}

test('a foreign event ID collision rolls back progress', async () => {
  const foreignWord = await seedWord(db, other)
  const existing = assessment(foreignWord)
  await review(db, existing, other)
  const word = await seedWord(db)
  const before = await state(db, word)
  await assert.rejects(
    review(db, assessment(word, { event: existing.event })),
    /42501.*row-level security/s
  )
  assert.deepEqual(await state(db, word), before)
  assert.equal((await state(db, foreignWord)).events.length, 1)
})

test('caller transaction rollback undoes both the assessment and event', async () => {
  const word = await seedWord(db)
  const before = await state(db, word)
  await db.sql(`BEGIN; ${asUser(owner, rpc(assessment(word)))} ROLLBACK;`)
  assert.deepEqual(await state(db, word), before)
})

test('accepts nullable answer/timing and adjacent local dates', async () => {
  for (const date of ['2026-09-04', '2026-09-06']) {
    const word = await seedWord(db)
    const result = await review(
      db,
      assessment(word, { date, correct: null, responseTime: null })
    )
    assert.equal(
      result.next_review_date,
      date === '2026-09-04' ? '2026-09-05' : '2026-09-07'
    )
    assert.equal((await state(db, word)).events[0].response_time_ms, null)
  }
})
