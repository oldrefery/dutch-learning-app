import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  assessment,
  asUser,
  owner,
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

async function until(predicate) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await setTimeout(20)
  }
  throw new Error('Expected PostgreSQL concurrency barrier was not reached')
}

// A stays uncommitted until pg_stat_activity proves B is blocked on a lock.
// This tests actual overlapping transactions, not a race based on sleep timing.
async function overlap(first, second) {
  const a = db.connect()
  const application = `qa-review-${randomUUID()}`
  let b
  try {
    a.child.stdin.write(`SET statement_timeout = '10s';
      SET idle_in_transaction_session_timeout = '10s'; BEGIN;
      ${asUser(owner, rpc(first))}\n\\echo ASSESSMENT_HELD\n`)
    await until(() => a.output().includes('ASSESSMENT_HELD'))
    b = db.sql(
      `SET application_name = '${application}'; ${asUser(owner, rpc(second))}`
    )
    void b.catch(() => {})
    await until(
      async () =>
        (await db.sql(`SELECT count(*) FROM pg_stat_activity
      WHERE application_name = '${application}' AND wait_event_type = 'Lock';`)) ===
        '1'
    )
    a.child.stdin.end('COMMIT;\n')
    await a.completed
    return await b
  } finally {
    if (!a.child.stdin.writableEnded) a.child.stdin.end('ROLLBACK;\n')
    await a.completed.catch(() => {})
    await b?.catch(() => {})
  }
}

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
    /23505/
  )
  assert.deepEqual(await state(db, second), before)
  assert.equal((await state(db, first)).events.length, 1)
})
