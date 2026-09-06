import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { assessment, owner, seedUsers, seedWord, state } from './fixtures.mjs'
import { overlap as overlapTransactions } from './concurrency-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

const overlap = (first, second) => overlapTransactions(db, first, second)

test('two distinct assessments serialize against the latest word state without lost updates', async () => {
  const word = await seedWord(db)
  const a = assessment(word)
  const b = assessment(word)
  const result = JSON.parse(await overlap(a, b))
  assert.equal(result.repetition_count, 2)
  assert.equal(result.interval_days, 6)
  assert.equal(result.next_review_date, '2026-09-11')
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 2)
  assert.equal(saved.events.length, 2)
  assert.equal(
    saved.events.find(event => event.event_id === b.event)
      .previous_interval_days,
    1
  )
  assert.equal(
    saved.events.find(event => event.event_id === b.event).next_interval_days,
    6
  )
})

test('concurrent retries of the same event advance SRS exactly once', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  assert.equal(JSON.parse(await overlap(input, input)).repetition_count, 1)
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 1)
  assert.equal(saved.events.length, 1)
})

test('concurrent changed-payload retry is rejected after the first assessment commits', async () => {
  const word = await seedWord(db)
  const input = assessment(word)
  await assert.rejects(
    overlap(input, { ...input, rating: 'easy' }),
    /already exists with different data/
  )
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 1)
  assert.equal(saved.events.length, 1)
  assert.equal(saved.events[0].assessment, 'good')
})

test('concurrent event collision across different words rolls back the losing word update', async () => {
  const first = await seedWord(db)
  const second = await seedWord(db)
  const before = await state(db, second)
  const a = assessment(first)
  await assert.rejects(
    overlap(a, assessment(second, { event: a.event })),
    /immutable/
  )
  assert.deepEqual(await state(db, second), before)
  assert.equal((await state(db, first)).events.length, 1)
})

const resetSql = (
  word,
  id = randomUUID()
) => `SELECT * FROM reset_word_learning_progress(
  '${word}', '${id}', '2026-09-05T12:00:00Z', '2026-09-05');`

test('concurrent reset retries create one receipt and reset once', async () => {
  const word = await seedWord(db, owner, {
    repetitionCount: 3,
    intervalDays: 15,
  })
  const reset = resetSql(word)
  await overlap(reset, reset)
  assert.equal((await state(db, word)).word.repetition_count, 0)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM learning_resets WHERE word_id = '${word}';`
    ),
    '1'
  )
})

test('a review waiting behind a reset uses initial SRS', async () => {
  const word = await seedWord(db, owner, {
    repetitionCount: 3,
    intervalDays: 15,
  })
  await overlap(resetSql(word), assessment(word))
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 1)
  assert.equal(saved.word.interval_days, 1)
  assert.equal(saved.events[0].previous_interval_days, 1)
})

test('a reset waiting behind a review clears progress but preserves its event', async () => {
  const word = await seedWord(db)
  await overlap(assessment(word), resetSql(word))
  const saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 0)
  assert.equal(saved.word.last_reviewed_at, null)
  assert.equal(saved.events.length, 1)
})
