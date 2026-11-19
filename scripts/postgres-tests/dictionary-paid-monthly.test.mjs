import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { other, seedUsers } from './fixtures.mjs'
import {
  claimPaid,
  grantPair,
  paidRelease,
  paidState,
} from './dictionary-paid.fixture.mjs'

const monthStart = "date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam')"
const previousMonth = `(${monthStart} AT TIME ZONE 'Europe/Amsterdam') - interval '1 second'`
const budget = { fullAccessAnalysis: true, actors: [], monthlyLimit: '16584' }
let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('a calendar month budget is shared, survives release changes and releases prior-month capacity', async () => {
  const release = await paidRelease(db, budget)
  const outcomes = await Promise.allSettled([
    grantPair(db),
    grantPair(db, { actor: other }),
  ])
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1)
  assert.match(
    outcomes.find(x => x.status === 'rejected').reason.message,
    /rate-limit-exceeded/
  )
  assert.equal((await paidState(db, release)).held, '16584')

  const replacement = await paidRelease(db, budget)
  await assert.rejects(grantPair(db, { actor: other }), /rate-limit-exceeded/)
  assert.equal((await paidState(db, replacement)).held, '0')

  await db.sql(
    `UPDATE private.dictionary_paid_attempts SET created_at=${previousMonth} WHERE release_id='${release}';`
  )
  const carried = await grantPair(db)
  await db.sql(
    `UPDATE private.dictionary_paid_attempts SET created_at=${previousMonth} WHERE release_id='${replacement}';`
  )

  const current = await grantPair(db, { actor: other })
  await assert.rejects(claimPaid(db, carried), /rate-limit-exceeded/)
  const claim = await claimPaid(db, current)
  assert.equal(claim.allowed, true)
  assert.equal(
    await db.sql(`SELECT (dispatched_at AT TIME ZONE 'Europe/Amsterdam') >= ${monthStart}
      FROM private.dictionary_paid_attempts WHERE attempt_id='${claim.attempt_id}';`),
    't'
  )
})
