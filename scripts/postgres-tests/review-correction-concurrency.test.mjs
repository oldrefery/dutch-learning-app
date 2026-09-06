import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { assessment, review, seedUsers, seedWord, state } from './fixtures.mjs'
import {
  correction,
  correctionSql,
  correctionState,
  resetSql,
} from './correction-fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('concurrent identical corrections create one receipt and apply once', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const sql = correctionSql(correction(input))
  const result = JSON.parse(await overlap(db, sql, sql))
  assert.equal(result.accepted_revision, 1)
  assert.equal(result.repetition_count, 0)
  assert.equal(result.easiness_factor, 2.3)
  assert.equal((await correctionState(db, input.word)).corrections.length, 1)
})

test('concurrent different edits of the same revision cannot lose the winning edit', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await assert.rejects(
    overlap(
      db,
      correctionSql(correction(input)),
      correctionSql(correction(input, { rating: 'easy' }))
    ),
    /Review correction conflict: stale revision/
  )
  assert.equal((await state(db, input.word)).word.easiness_factor, 2.3)
  const saved = await correctionState(db, input.word)
  assert.equal(saved.corrections.length, 1)
  assert.equal(saved.effective[0].assessment, 'again')
})

test('correction waiting behind a newer review is rejected without erasing that review', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await assert.rejects(
    overlap(db, assessment(input.word), correctionSql(correction(input))),
    /Review correction conflict/
  )
  const saved = await state(db, input.word)
  assert.equal(saved.events.length, 2)
  assert.equal(saved.word.repetition_count, 2)
  assert.equal((await correctionState(db, input.word)).corrections.length, 0)
})

test('review waiting behind a correction uses corrected SRS as its predecessor', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const result = JSON.parse(
    await overlap(db, correctionSql(correction(input)), assessment(input.word))
  )
  assert.equal(result.repetition_count, 1)
  assert.equal(result.interval_days, 1)
  assert.equal(result.easiness_factor, 2.3)
  assert.equal((await state(db, input.word)).events.length, 2)
})

test('correction waiting behind a reset is rejected', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await assert.rejects(
    overlap(db, resetSql(input.word), correctionSql(correction(input))),
    /Review correction conflict/
  )
  assert.equal((await state(db, input.word)).word.last_reviewed_at, null)
  assert.equal((await correctionState(db, input.word)).corrections.length, 0)
})

test('reset waiting behind a correction still resets and invalidates the head', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await overlap(db, correctionSql(correction(input)), resetSql(input.word))
  const saved = await state(db, input.word)
  assert.equal(saved.word.last_reviewed_at, null)
  assert.equal(saved.word.easiness_factor, 2.5)
  const ledger = await correctionState(db, input.word)
  assert.equal(ledger.corrections.length, 1)
  assert.equal(ledger.heads.length, 0)
})

test('correction ID collision across words rolls back the losing transaction entirely', async () => {
  const a = assessment(await seedWord(db))
  const b = assessment(await seedWord(db))
  await review(db, a)
  await review(db, b)
  const command = correction(a)
  const before = await state(db, b.word)
  const ledger = await correctionState(db, b.word)
  await assert.rejects(
    overlap(
      db,
      correctionSql(command),
      correctionSql(correction(b, { id: command.id }))
    ),
    /duplicate key/
  )
  assert.deepEqual(await state(db, b.word), before)
  assert.deepEqual(await correctionState(db, b.word), ledger)
  assert.equal((await state(db, a.word)).word.repetition_count, 0)
})
