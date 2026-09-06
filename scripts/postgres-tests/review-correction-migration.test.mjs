import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  owner,
  review,
  seedUsers,
  seedWord,
  state,
} from './fixtures.mjs'
import { correct, correction, correctionState } from './correction-fixtures.mjs'

test('migration preserves existing progress and immutable events without inventing checkpoints', async () => {
  const db = await createCluster({
    throughMigration:
      '20260906110000_make_new_words_immediately_reviewable.sql',
  })
  try {
    await seedUsers(db)
    const word = await seedWord(db, owner, {
      intervalDays: 25,
      repetitionCount: 7,
      easinessFactor: 1.8,
    })
    const input = assessment(word, { rating: 'again' })
    await review(db, input)
    const untouched = await seedWord(db, owner, {
      intervalDays: 70,
      repetitionCount: 12,
      easinessFactor: 2.1,
    })
    const before = await state(db, word)
    const untouchedBefore = await state(db, untouched)
    await db.sql(
      await readFile(
        new URL(
          '../../supabase/migrations/20260906160000_add_review_corrections.sql',
          import.meta.url
        ),
        'utf8'
      )
    )
    assert.deepEqual(await state(db, word), before)
    assert.deepEqual(await state(db, untouched), untouchedBefore)
    const ledger = await correctionState(db, word)
    assert.equal(ledger.checkpoints.length, 0)
    assert.equal(ledger.heads.length, 0)
    assert.equal(ledger.corrections.length, 0)
    assert.equal(ledger.effective[0].assessment, 'again')
    assert.equal(ledger.effective[0].revision, 0)
    await assert.rejects(
      correct(db, correction(input)),
      /no trusted checkpoint/
    )
    await review(db, input)
    assert.deepEqual(await state(db, word), before)
    assert.equal((await correctionState(db, word)).checkpoints.length, 0)
    const newInput = assessment(word)
    await review(db, newInput)
    const result = await correct(db, correction(newInput, { rating: 'easy' }))
    assert.equal(result.repetition_count, 1)
    assert.equal(result.interval_days, 4)
    assert.equal(result.easiness_factor, 1.75)
    assert.equal((await state(db, word)).events.length, 2)
    assert.deepEqual(await state(db, untouched), untouchedBefore)
  } finally {
    await db.close()
  }
})
