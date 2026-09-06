import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  calculateSRSProgress,
  getWordKnowledgeLevel,
} from '../../packages/domain/src/srs.ts'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  owner,
  review,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'
import { correct, correction } from './correction-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('correction capability is explicit and preserves the old review/reset protocol', async () => {
  assert.equal(
    await db.sql(
      asUser(
        owner,
        'SELECT review_correction_protocol(), learning_sync_protocol();'
      )
    ),
    '1|2'
  )
  await assert.rejects(
    db.sql('SET ROLE anon; SELECT review_correction_protocol();'),
    /permission denied/
  )
})

for (const original of ['again', 'hard', 'good', 'easy']) {
  test(`correcting ${original} matches shared SRS and knowledge levels across all target ratings`, async () => {
    for (const progress of [
      { intervalDays: 0, repetitionCount: 0, easinessFactor: 2.5 },
      { intervalDays: 1, repetitionCount: 1, easinessFactor: 1.3 },
      { intervalDays: 9, repetitionCount: 2, easinessFactor: 2.5 },
      { intervalDays: 25, repetitionCount: 7, easinessFactor: 2.3 },
    ]) {
      const input = assessment(await seedWord(db, owner, progress), {
        rating: original,
      })
      await review(db, input)
      for (const [revision, rating] of [
        'again',
        'hard',
        'good',
        'easy',
      ].entries()) {
        const expected = calculateSRSProgress(progress, rating)
        const result = await correct(
          db,
          correction(input, { revision, rating })
        )
        assert.deepEqual(
          {
            intervalDays: result.interval_days,
            repetitionCount: result.repetition_count,
            easinessFactor: result.easiness_factor,
          },
          expected
        )
        assert.equal(
          getWordKnowledgeLevel(result.repetition_count),
          getWordKnowledgeLevel(expected.repetitionCount)
        )
        const date = new Date(`${input.date}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + expected.intervalDays)
        assert.equal(result.next_review_date, date.toISOString().slice(0, 10))
        const saved = await state(db, input.word)
        assert.equal(saved.word.repetition_count, expected.repetitionCount)
        assert.equal(saved.events.length, 1)
      }
    }
  })
}
