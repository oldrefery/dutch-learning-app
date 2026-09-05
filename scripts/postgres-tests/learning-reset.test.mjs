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
})
after(async () => {
  await db?.close()
})

const resetCommand = (word, fields = {}) => ({
  word,
  id: randomUUID(),
  at: '2026-09-05T14:00:00Z',
  date: '2026-09-05',
  collection: null,
  ...fields,
})
const resetSql = command =>
  `SELECT * FROM reset_word_learning_progress(${[
    command.word,
    command.id,
    command.at,
    command.date,
    command.collection,
  ]
    .map(literal)
    .join(',')});`
const reset = (command, user = owner) => db.sql(asUser(user, resetSql(command)))

test('reset and retry after another assessment do not erase the new assessment', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word, { rating: 'easy' }))
  const command = resetCommand(word)
  await reset(command)
  let saved = await state(db, word)
  assert.equal(saved.word.repetition_count, 0)
  assert.equal(saved.word.last_reviewed_at, null)
  assert.equal(saved.word.next_review_date, tomorrow)
  assert.equal(saved.events.length, 1)
  await review(db, assessment(word, { at: '2026-09-05T15:00:00Z' }))
  saved = await state(db, word)
  await reset(command)
  assert.deepEqual(await state(db, word), saved)
  for (const fields of [
    { word: await seedWord(db) },
    { date: tomorrow },
    { at: '2026-09-05T14:00:01Z' },
  ]) {
    await assert.rejects(reset({ ...command, ...fields }), /different data/)
  }
})

test('an older offline assessment arriving after a reset is a new accepted command', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  await reset(resetCommand(word))
  const result = await review(
    db,
    assessment(word, {
      at: '2026-09-01T11:00:00Z',
      date: '2026-09-01',
      rating: 'easy',
    })
  )
  assert.equal(result.repetition_count, 1)
  assert.equal(result.interval_days, 4)
  assert.equal(result.next_review_date, '2026-09-09')
})

test('reset checks ownership, collection, tombstone, missing identity and anonymous execution', async () => {
  const word = await seedWord(db)
  const command = resetCommand(word)
  const before = await state(db, word)
  await assert.rejects(reset(command, other), /Reset word not found/)
  await assert.rejects(reset(command, null), /Authentication required/)
  await assert.rejects(
    reset({ ...command, collection: randomUUID() }),
    /Reset word not found/
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; ${resetSql(command)}`),
    /permission denied/
  )
  await assert.rejects(
    reset({ ...command, date: '2026-09-08' }),
    /Invalid reset timestamps/
  )
  assert.deepEqual(await state(db, word), before)
  await db.sql(
    asUser(
      owner,
      `UPDATE words SET deleted_at = now() WHERE word_id = '${word}';`
    )
  )
  await assert.rejects(reset(command), /Reset word not found/)
})

test('reset transaction rollback leaves no command receipt or progress change', async () => {
  const word = await seedWord(db)
  await review(db, assessment(word))
  const before = await state(db, word)
  const command = resetCommand(word)
  await db.sql(`BEGIN; ${asUser(owner, resetSql(command))} ROLLBACK;`)
  assert.deepEqual(await state(db, word), before)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM learning_resets WHERE reset_id = '${command.id}';`
    ),
    '0'
  )
})
