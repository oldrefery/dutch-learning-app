import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { calculateSRSProgress } from '../../packages/domain/src/srs.ts'
import { createCluster } from './cluster.mjs'
import { assessment, review, seedUsers, seedWord, state } from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

for (const [rating, intervalDays, easinessFactor, expected] of [
  ['good', 1, 2.5, 3],
  ['good', 9, 2.5, 23],
  ['good', 0, 2.5, 1],
  ['easy', 0, 2.5, 1],
  ['good', 25, 2.3, 57],
]) {
  test(`SRS regression: ${rating}, interval ${intervalDays}, EF ${easinessFactor} schedules ${expected} days`, async () => {
    const word = await seedWord(db, undefined, {
      intervalDays,
      easinessFactor,
      repetitionCount: 2,
    })
    assert.equal(
      (await review(db, assessment(word, { rating }))).interval_days,
      expected
    )
  })
}

for (const rating of ['again', 'hard', 'good', 'easy']) {
  test(`SQL ${rating} matches shared SRS across stages, bounds and rounding edges`, async () => {
    const mismatches = []
    for (const repetitionCount of [0, 1, 2]) {
      for (const intervalDays of [0, 1, 9, 20, 25]) {
        for (const easinessFactor of [1.3, 2.3, 2.35, 2.5]) {
          const progress = { repetitionCount, intervalDays, easinessFactor }
          const word = await seedWord(db, undefined, progress)
          const expected = calculateSRSProgress(progress, rating)
          const result = await review(db, assessment(word, { rating }))
          const actual = {
            intervalDays: result.interval_days,
            repetitionCount: result.repetition_count,
            easinessFactor: result.easiness_factor,
          }
          if (
            JSON.stringify(actual) !==
            JSON.stringify({
              intervalDays: expected.intervalDays,
              repetitionCount: expected.repetitionCount,
              easinessFactor: expected.easinessFactor,
            })
          )
            mismatches.push({ progress, expected, actual })
          const nextDate = new Date('2026-09-05T00:00:00Z')
          nextDate.setUTCDate(nextDate.getUTCDate() + result.interval_days)
          assert.equal(
            result.next_review_date,
            nextDate.toISOString().slice(0, 10)
          )
          const saved = await state(db, word)
          assert.equal(saved.word.interval_days, result.interval_days)
          assert.equal(saved.events[0].previous_interval_days, intervalDays)
          assert.equal(saved.events[0].next_interval_days, result.interval_days)
          assert.equal(
            saved.events[0].next_easiness_factor,
            result.easiness_factor
          )
        }
      }
    }
    assert.deepEqual(mismatches, [])
  })
}
