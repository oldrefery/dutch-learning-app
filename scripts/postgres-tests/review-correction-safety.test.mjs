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

for (const fields of [
  { rating: null },
  { rating: 'invalid' },
  { revision: null },
  { revision: -1 },
  { id: null },
  { word: null },
  { event: null },
]) {
  test(`invalid correction rolls back all writes: ${JSON.stringify(fields)}`, async () => {
    const input = assessment(await seedWord(db))
    await review(db, input)
    const before = await state(db, input.word)
    const ledger = await correctionState(db, input.word)
    await assert.rejects(
      correct(db, correction(input, fields)),
      /Invalid review correction/
    )
    assert.deepEqual(await state(db, input.word), before)
    assert.deepEqual(await correctionState(db, input.word), ledger)
  })
}

test('stale and changed-payload corrections cannot overwrite a newer assessment', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const command = correction(input)
  await correct(db, command)
  const before = await state(db, input.word)
  const ledger = await correctionState(db, input.word)
  for (const fields of [{ rating: 'hard' }, { revision: 1 }]) {
    await assert.rejects(
      correct(db, { ...command, ...fields }),
      /Correction ID already exists with different data/
    )
  }
  await assert.rejects(
    correct(db, correction(input)),
    /Review correction conflict: stale revision/
  )
  assert.deepEqual(await state(db, input.word), before)
  assert.deepEqual(await correctionState(db, input.word), ledger)
})

test('a later reset invalidates correction eligibility without deleting review history', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await db.sql(asUser(owner, resetSql(input.word)))
  const before = await state(db, input.word)
  await assert.rejects(
    correct(db, correction(input)),
    /Review correction conflict/
  )
  assert.deepEqual(await state(db, input.word), before)
  assert.equal((await correctionState(db, input.word)).heads.length, 0)
})

test('reset retry after a new review does not invalidate that new review', async () => {
  const word = await seedWord(db)
  const reset = resetSql(word)
  await db.sql(asUser(owner, reset))
  const input = assessment(word)
  await review(db, input)
  await db.sql(asUser(owner, reset))
  assert.equal((await correct(db, correction(input))).repetition_count, 0)
})

test('out-of-ledger progress changes are rejected rather than replaced by a checkpoint', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await db.sql(
    `UPDATE words SET repetition_count = 12 WHERE word_id = '${input.word}';`
  )
  const before = await state(db, input.word)
  await assert.rejects(
    correct(db, correction(input)),
    /Review correction conflict: progress changed/
  )
  assert.deepEqual(await state(db, input.word), before)
})

test('ownership, event/word binding, authentication and anonymous execution are enforced', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const command = correction(input)
  const before = await state(db, input.word)
  await assert.rejects(
    correct(db, command, other),
    /42501.*Review word not found/s
  )
  await assert.rejects(
    correct(db, command, null),
    /42501.*Authentication required/s
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; ${correctionSql(command)}`),
    /permission denied/
  )
  await assert.rejects(
    correct(db, { ...command, word: await seedWord(db) }),
    /42501.*Review event not found/s
  )
  await assert.rejects(
    correct(db, { ...command, event: randomUUID() }),
    /Review event not found/
  )
  assert.deepEqual(await state(db, input.word), before)
})

test('cross-user correction ID collision does not mutate either account', async () => {
  const foreign = assessment(await seedWord(db, other))
  await review(db, foreign, other)
  const existing = correction(foreign)
  await correct(db, existing, other)
  const input = assessment(await seedWord(db))
  await review(db, input)
  const before = await state(db, input.word)
  const foreignBefore = await state(db, foreign.word)
  await assert.rejects(
    correct(db, correction(input, { id: existing.id })),
    /Correction ID already exists with different data/
  )
  assert.deepEqual(await state(db, input.word), before)
  assert.deepEqual(await state(db, foreign.word), foreignBefore)
})

test('new tables are owner-readable only and cannot be written directly', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  await correct(db, correction(input))
  assert.deepEqual(await correctionState(db, input.word, other), {
    checkpoints: [],
    heads: [],
    corrections: [],
    effective: [],
  })
  for (const table of [
    'review_progress_checkpoints',
    'review_progress_heads',
    'review_assessment_corrections',
  ]) {
    for (const sql of [
      `DELETE FROM ${table} WHERE word_id = '${input.word}';`,
      `UPDATE ${table} SET user_id = '${other}' WHERE word_id = '${input.word}';`,
      `INSERT INTO ${table} SELECT * FROM ${table} WHERE word_id = '${input.word}';`,
    ])
      await assert.rejects(db.sql(asUser(owner, sql)), /permission denied/)
    await assert.rejects(
      db.sql(`SET ROLE anon; SELECT * FROM ${table};`),
      /permission denied/
    )
  }
  await assert.rejects(
    db.sql(`SET ROLE anon; SELECT * FROM effective_review_events;`),
    /permission denied/
  )
})

test('tombstoning a word cleans up correction records and prevents replay', async () => {
  const input = assessment(await seedWord(db))
  await review(db, input)
  const command = correction(input)
  await correct(db, command)
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET deleted_at = now() WHERE word_id = '${input.word}';`
    )
  )
  await assert.rejects(correct(db, command), /Review word not found/)
  assert.deepEqual(await correctionState(db, input.word), {
    checkpoints: [],
    heads: [],
    corrections: [],
    effective: [],
  })
})

test('a batched legacy insert checkpoints the applied predecessor, including retries', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const template = (await state(db, word)).events[0]
  const events = [1, 2].map(() => ({
    ...template,
    event_id: randomUUID(),
    previous_interval_days: 999,
  }))
  const insert = `INSERT INTO review_events SELECT * FROM json_populate_recordset(NULL::review_events,
    ${literal(JSON.stringify(events))}::json) ON CONFLICT(event_id) DO UPDATE SET
    previous_interval_days = EXCLUDED.previous_interval_days;`
  await db.sql(asUser(owner, insert))
  const checkpoints = (await correctionState(db, word)).checkpoints
  assert.equal(
    checkpoints.find(row => row.event_id === events[1].event_id)
      .previous_repetition_count,
    2
  )
  const result = await correct(
    db,
    correction({ word, event: events[1].event_id }, { rating: 'hard' })
  )
  assert.equal(result.repetition_count, 3)
  assert.equal(result.interval_days, 7)
  const before = await state(db, word)
  const ledger = await correctionState(db, word)
  await db.sql(asUser(owner, insert))
  assert.deepEqual(await state(db, word), before)
  assert.deepEqual(await correctionState(db, word), ledger)
})
