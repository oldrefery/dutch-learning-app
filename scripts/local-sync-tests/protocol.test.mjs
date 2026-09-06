import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import {
  localStack,
  createFixture,
  ok,
  state,
  assessment,
  review,
} from './fixture.mjs'

let stack
const fixtures = []
before(() => {
  stack = localStack()
})
after(async () => {
  for (const fixture of fixtures) await fixture.cleanup()
})
async function fixture() {
  const result = await createFixture(stack)
  fixtures.push(result)
  return result
}

test('real Auth and REST: delayed native upsert cannot replace newer RPC progress', async () => {
  const f = await fixture()
  assert.equal(ok(await f.a.rpc('learning_sync_protocol')), 2)
  const initial = (await state(f.a, f)).word
  const earlier = new Date(Date.now() - 120_000).toISOString()
  const good = assessment(f, 'good')
  await review(f.b, good)
  ok(
    await f.a.from('words').upsert(
      {
        ...initial,
        interval_days: 4,
        repetition_count: 1,
        last_reviewed_at: earlier,
      },
      { onConflict: 'word_id' }
    )
  )
  assert.equal((await state(f.b, f)).word.interval_days, 1)
  const event = {
    ...(await state(f.b, f)).events[0],
    event_id: randomUUID(),
    assessment: 'easy',
    reviewed_at: earlier,
    review_date: earlier.slice(0, 10),
    previous_interval_days: 1,
    next_interval_days: 4,
  }
  ok(await f.a.from('review_events').upsert(event, { onConflict: 'event_id' }))
  const result = await state(f.b, f)
  assert.equal(result.word.repetition_count, 2)
  assert.equal(result.word.interval_days, 10)
  assert.equal(result.word.easiness_factor, 2.5)
  assert.equal(
    Date.parse(result.word.last_reviewed_at),
    Date.parse(good.p_reviewed_at)
  )
  assert.equal(result.events.length, 2)
  assert.equal(
    result.events.find(row => row.event_id === event.event_id)
      .next_interval_days,
    10
  )
  ok(await f.a.from('review_events').upsert(event, { onConflict: 'event_id' }))
  assert.deepEqual(await state(f.a, f), result)
})

test('real REST batch and reset retry preserve command order and canonical history', async () => {
  const f = await fixture()
  await review(f.a, assessment(f))
  const template = (await state(f.a, f)).events[0]
  const events = [1, 2].map(() => ({
    ...template,
    event_id: randomUUID(),
    previous_interval_days: 999,
    next_interval_days: 999,
  }))
  ok(await f.a.from('review_events').upsert(events, { onConflict: 'event_id' }))
  const batch = await state(f.b, f)
  assert.equal(batch.word.repetition_count, 3)
  assert.equal(batch.word.interval_days, 15)
  assert.deepEqual(
    batch.events.map(e => e.next_interval_days).sort((a, b) => a - b),
    [1, 6, 15]
  )
  const at = new Date().toISOString()
  const reset = {
    p_word_id: f.wordId,
    p_reset_id: randomUUID(),
    p_reset_at: at,
    p_review_date: at.slice(0, 10),
    p_collection_id: f.collectionId,
  }
  assert.deepEqual(ok(await f.a.rpc('reset_word_learning_progress', reset)), [
    { word_id: f.wordId },
  ])
  const cleared = (await state(f.a, f)).word
  assert.equal(cleared.repetition_count, 0)
  assert.equal(cleared.interval_days, 1)
  assert.equal(cleared.last_reviewed_at, null)
  await review(f.b, assessment(f, 'hard'))
  const afterReview = await state(f.b, f)
  ok(await f.a.rpc('reset_word_learning_progress', reset))
  assert.deepEqual(await state(f.a, f), afterReview)
  assert.equal(afterReview.word.repetition_count, 1)
  assert.equal(afterReview.word.easiness_factor, 2.35)
  assert.equal(afterReview.events.length, 4)
})

test('real JWT ownership rejects foreign commands and hides private receipts', async () => {
  const owner = await fixture()
  const stranger = await fixture()
  const before = await state(owner.a, owner)
  const forbidden = await stranger.a.rpc(
    'record_review_assessment',
    assessment(owner)
  )
  assert.ok(forbidden.error)
  const at = new Date().toISOString()
  const reset = await stranger.a.rpc('reset_word_learning_progress', {
    p_word_id: owner.wordId,
    p_reset_id: randomUUID(),
    p_reset_at: at,
    p_review_date: at.slice(0, 10),
  })
  assert.ok(reset.error)
  assert.deepEqual(await state(owner.a, owner), before)
  assert.deepEqual(
    ok(
      await stranger.a
        .from('words')
        .select('word_id')
        .eq('word_id', owner.wordId)
    ),
    []
  )
  assert.ok((await owner.a.from('learning_resets').select('*')).error)
})

test('an actually expired access JWT is rejected, refreshed, and reuses the same review id', async () => {
  const f = await fixture()
  const input = assessment(f)
  await review(f.a, input)
  const accepted = await state(f.a, f)
  const wait = f.session.expires_at * 1000 - Date.now() + 2_000
  assert.ok(
    wait > 0 && wait <= 310_000,
    'Use jwt_expiry = 300 in the disposable local stack'
  )
  // No forged token, clock manipulation or mocked auth endpoint.
  await setTimeout(wait)
  const expired = stack.client()
  const rejected = await expired.auth.getUser(f.session.access_token)
  assert.ok(rejected.error)
  assert.equal(rejected.error.status, 403)
  const refreshed = ok(
    await expired.auth.refreshSession({
      refresh_token: f.session.refresh_token,
    })
  )
  assert.equal(refreshed.user.id, f.userId)
  assert.notEqual(refreshed.session.access_token, f.session.access_token)
  await review(expired, input)
  assert.deepEqual(await state(expired, f), accepted)
})
