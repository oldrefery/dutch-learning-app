import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  owner,
  review,
  rpc,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'
import {
  correct,
  correction,
  correctionSql,
  correctionState,
  resetSql,
} from './correction-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('Good to Again replaces one result without changing the original event', async () => {
  const word = await seedWord(db)
  const input = assessment(word, { mode: 'recognition' })
  await review(db, input)
  const original = (await state(db, word)).events
  const command = correction(input)
  const result = await correct(db, command)
  assert.equal(result.accepted_revision, 1)
  assert.equal(result.effective_revision, 1)
  assert.equal(result.effective_assessment, 'again')
  assert.equal(result.repetition_count, 0)
  assert.equal(result.interval_days, 0)
  assert.equal(result.easiness_factor, 2.3)
  assert.equal(result.next_review_date, input.date)
  assert.equal(result.last_reviewed_at, original[0].reviewed_at)
  assert.deepEqual((await state(db, word)).events, original)
  const saved = await correctionState(db, word)
  assert.equal(saved.corrections.length, 1)
  assert.equal(saved.effective.length, 1)
  assert.equal(saved.effective[0].assessment, 'again')
  assert.equal(saved.effective[0].original_assessment, 'good')
  assert.equal(saved.effective[0].answered_correctly, true)
  assert.equal(saved.effective[0].response_time_ms, 750)
  assert.equal(saved.effective[0].created_at, original[0].created_at)
  assert.equal(saved.effective[0].next_interval_days, 0)
  assert.equal(saved.effective[0].next_easiness_factor, 2.3)
})

test('repeated edits recompute from the pre-review checkpoint, not the last edited result', async () => {
  const word = await seedWord(db, owner, {
    intervalDays: 12,
    repetitionCount: 4,
    easinessFactor: 1.4,
  })
  const input = assessment(word)
  await review(db, input)
  const cases = [
    ['again', 0, 0, 1.3],
    ['hard', 14, 5, 1.3],
    ['easy', 22, 5, 1.55],
    ['good', 17, 5, 1.4],
  ]
  for (const [
    revision,
    [rating, days, repetitions, easiness],
  ] of cases.entries()) {
    const result = await correct(db, correction(input, { revision, rating }))
    assert.equal(result.interval_days, days)
    assert.equal(result.repetition_count, repetitions)
    assert.equal(result.easiness_factor, easiness)
    assert.equal(result.effective_revision, revision + 1)
  }
  assert.equal((await state(db, word)).events.length, 1)
})

test('Again to Good restores repetitions lost by the original Again', async () => {
  const word = await seedWord(db, owner, {
    intervalDays: 10,
    repetitionCount: 3,
    easinessFactor: 2,
  })
  const input = assessment(word, { rating: 'again', correct: false })
  await review(db, input)
  const result = await correct(db, correction(input, { rating: 'good' }))
  assert.equal(result.repetition_count, 4)
  assert.equal(result.interval_days, 20)
  assert.equal(result.easiness_factor, 2)
  assert.equal(
    (await correctionState(db, word)).effective[0].answered_correctly,
    false
  )
})

test('idempotent correction and original-event retries leave progress and both ledgers unchanged', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const command = correction(input)
  const result = await correct(db, command)
  const before = await state(db, input.word)
  const ledger = await correctionState(db, input.word)
  assert.deepEqual(await correct(db, command), result)
  await review(db, input)
  assert.deepEqual(await state(db, input.word), before)
  assert.deepEqual(await correctionState(db, input.word), ledger)
})

test('old correction retry acknowledges its revision but returns current assessment and word progress', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const command = correction(input)
  await correct(db, command)
  await correct(db, correction(input, { revision: 1, rating: 'easy' }))
  const before = await state(db, input.word)
  const retried = await correct(db, command)
  assert.equal(retried.accepted_revision, 1)
  assert.equal(retried.effective_revision, 2)
  assert.equal(retried.effective_assessment, 'easy')
  assert.equal(retried.interval_days, 4)
  await review(db, assessment(input.word))
  const newer = await state(db, input.word)
  assert.equal((await correct(db, command)).repetition_count, 2)
  assert.deepEqual(await state(db, input.word), newer)
  assert.notDeepEqual(newer.word, before.word)
  await db.sql(asUser(owner, resetSql(input.word)))
  const reset = await state(db, input.word)
  assert.equal((await correct(db, command)).last_reviewed_at, null)
  assert.deepEqual(await state(db, input.word), reset)
})

test('other words and metadata edits do not prevent correcting an earlier session answer', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await review(db, assessment(await seedWord(db)))
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET analysis_notes = 'Keep this' WHERE word_id = '${input.word}';`
    )
  )
  await correct(db, correction(input))
  assert.equal((await state(db, input.word)).word.analysis_notes, 'Keep this')
})

test('offline arrival order, not answer timestamps, determines the correctable result', async () => {
  const word = await seedWord(db)
  const recent = assessment(word)
  await review(db, recent)
  const late = assessment(word, {
    at: '2026-09-01T10:00:00Z',
    date: '2026-09-01',
  })
  await review(db, late)
  await assert.rejects(
    correct(db, correction(recent)),
    /Review correction conflict/
  )
  const result = await correct(db, correction(late, { rating: 'easy' }))
  assert.equal(result.repetition_count, 2)
  assert.equal(result.next_review_date, '2026-09-15')
  assert.equal(result.last_reviewed_at, '2026-09-05T12:00:00+00:00')
})

test('review after a reset retains the reset scheduling anchor when corrected', async () => {
  const word = await seedWord(db)
  await db.sql(asUser(owner, resetSql(word)))
  const input = assessment(word, {
    at: '2026-09-01T10:00:00Z',
    date: '2026-09-01',
  })
  await review(db, input)
  const result = await correct(db, correction(input, { rating: 'easy' }))
  assert.equal(result.next_review_date, '2026-09-09')
})

test('caller rollback undoes correction receipt, revision, and progress together', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const before = await state(db, input.word)
  const ledger = await correctionState(db, input.word)
  await db.sql(
    `BEGIN; ${asUser(owner, correctionSql(correction(input)))} ROLLBACK;`
  )
  assert.deepEqual(await state(db, input.word), before)
  assert.deepEqual(await correctionState(db, input.word), ledger)
})

test('a transaction containing review then correction uses the same single-review baseline', async () => {
  const input = assessment(await seedWord(db))
  await db.sql(
    `BEGIN; ${asUser(owner, rpc(input))} ${correctionSql(correction(input))} COMMIT;`
  )
  const saved = await state(db, input.word)
  assert.equal(saved.events.length, 1)
  assert.equal(saved.word.repetition_count, 0)
})
