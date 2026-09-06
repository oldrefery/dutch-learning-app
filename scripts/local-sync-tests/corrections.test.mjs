import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
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
function correction(f, event, rating = 'hard', revision = 0) {
  return {
    p_word_id: f.wordId,
    p_event_id: event.p_event_id,
    p_correction_id: randomUUID(),
    p_expected_revision: revision,
    p_assessment: rating,
  }
}
const correct = (client, input) =>
  client
    .rpc('correct_review_assessment', input)
    .abortSignal(AbortSignal.timeout(10_000))
async function ledger(client, f) {
  const rows = table => client.from(table).select('*').eq('word_id', f.wordId)
  return {
    ...(await state(client, f)),
    effective: ok(await rows('effective_review_events').order('event_id')),
    corrections: ok(
      await rows('review_assessment_corrections').order('revision')
    ),
  }
}

test('real correction RPC replaces SRS from the checkpoint and preserves the original event', async () => {
  const f = await fixture()
  assert.equal(ok(await f.a.rpc('review_correction_protocol')), 1)
  const event = assessment(f)
  await review(f.a, event)
  const original = await state(f.a, f)
  const input = correction(f, event)
  const [ack] = ok(await correct(f.a, input))
  assert.equal(ack.correction_id, input.p_correction_id)
  assert.equal(ack.accepted_revision, 1)
  assert.equal(ack.effective_revision, 1)
  assert.equal(ack.effective_assessment, 'hard')
  const changed = await ledger(f.b, f)
  assert.equal(changed.word.repetition_count, 1)
  assert.equal(changed.word.interval_days, 1)
  assert.equal(changed.word.easiness_factor, 2.35)
  assert.equal(changed.word.next_review_date, ack.next_review_date)
  assert.equal(changed.word.last_reviewed_at, original.word.last_reviewed_at)
  assert.deepEqual(changed.events, original.events)
  assert.equal(changed.effective[0].assessment, 'hard')
  assert.equal(changed.effective[0].original_assessment, 'good')
  assert.equal(changed.effective[0].revision, 1)
  assert.equal(changed.corrections.length, 1)
  ok(await correct(f.b, input))
  assert.deepEqual(await ledger(f.a, f), changed)
})

test('real concurrent corrections accept exactly one revision and allow an explicit refreshed edit', async () => {
  const f = await fixture()
  const event = assessment(f)
  await review(f.a, event)
  const inputs = [correction(f, event, 'hard'), correction(f, event, 'easy')]
  const results = await Promise.all([
    correct(f.a, inputs[0]),
    correct(f.b, inputs[1]),
  ])
  assert.equal(results.filter(result => !result.error).length, 1)
  const rejected = results.find(result => result.error)
  assert.equal(rejected.status, 409)
  assert.equal(rejected.error.code, 'PT409')
  const winner = ok(results.find(result => !result.error))[0]
  const current = await ledger(f.a, f)
  assert.equal(current.corrections.length, 1)
  assert.equal(current.effective[0].assessment, winner.effective_assessment)
  const accepted = ok(await correct(f.b, correction(f, event, 'again', 1)))[0]
  assert.equal(accepted.accepted_revision, 2)
  const updated = await ledger(f.a, f)
  assert.equal(updated.corrections.length, 2)
  assert.equal(updated.events.length, 1)
  assert.equal(updated.word.repetition_count, 0)
  assert.equal(updated.word.easiness_factor, 2.3)
  assert.equal(updated.effective[0].assessment, 'again')
})

test('offline transport and a lost successful HTTP response retry the identical correction only once', async () => {
  const f = await fixture()
  const event = assessment(f)
  await review(f.a, event)
  const input = correction(f, event, 'easy')
  const initial = await ledger(f.b, f)
  let mode = 'offline'
  let delivered = 0
  const client = stack.client({
    accessToken: async () => f.session.access_token,
    fetch: async (...args) => {
      if (mode === 'offline') throw new TypeError('Injected offline transport')
      const response = await fetch(...args)
      delivered++
      if (mode === 'lost-response') {
        assert.equal(response.status, 200)
        await response.arrayBuffer()
        throw new TypeError('Injected response loss after server commit')
      }
      return response
    },
  })
  assert.ok((await correct(client, input)).error)
  assert.equal(delivered, 0)
  assert.deepEqual(await ledger(f.b, f), initial)
  mode = 'lost-response'
  assert.ok((await correct(client, input)).error)
  assert.equal(delivered, 1)
  const committed = await ledger(f.b, f)
  assert.equal(committed.word.interval_days, 4)
  assert.equal(committed.word.repetition_count, 1)
  assert.equal(committed.corrections.length, 1)
  assert.equal(committed.corrections[0].correction_id, input.p_correction_id)
  mode = 'online'
  const ack = ok(await correct(client, input))[0]
  assert.equal(ack.accepted_revision, 1)
  assert.equal(delivered, 2)
  assert.deepEqual(await ledger(f.b, f), committed)
})

test('new review invalidates an old edit but its accepted receipt stays retryable', async () => {
  const f = await fixture()
  const event = assessment(f)
  await review(f.a, event)
  const input = correction(f, event)
  ok(await correct(f.a, input))
  await review(f.b, assessment(f, 'easy'))
  const current = await ledger(f.b, f)
  const stale = await correct(f.a, correction(f, event, 'again', 1))
  assert.equal(stale.status, 409)
  assert.equal(stale.error.code, 'PT409')
  const ack = ok(await correct(f.a, input))[0]
  assert.equal(ack.interval_days, current.word.interval_days)
  assert.equal(ack.repetition_count, current.word.repetition_count)
  assert.deepEqual(await ledger(f.b, f), current)
})

test('reset invalidates correction edits and retry cannot restore cleared progress', async () => {
  const f = await fixture()
  const event = assessment(f)
  await review(f.a, event)
  const input = correction(f, event, 'easy')
  ok(await correct(f.a, input))
  const at = new Date().toISOString()
  ok(
    await f.b.rpc('reset_word_learning_progress', {
      p_word_id: f.wordId,
      p_reset_id: randomUUID(),
      p_reset_at: at,
      p_review_date: at.slice(0, 10),
      p_collection_id: f.collectionId,
    })
  )
  const reset = await ledger(f.b, f)
  assert.equal(reset.word.repetition_count, 0)
  assert.equal(reset.word.last_reviewed_at, null)
  const denied = await correct(f.a, correction(f, event, 'again', 1))
  assert.equal(denied.status, 409)
  assert.equal(denied.error.code, 'PT409')
  const [ack] = ok(await correct(f.a, input))
  assert.equal(ack.last_reviewed_at, null)
  assert.deepEqual(await ledger(f.b, f), reset)
})

test('foreign JWT and anonymous clients cannot edit or read correction history', async () => {
  const owner = await fixture()
  const stranger = await fixture()
  const event = assessment(owner)
  await review(owner.a, event)
  const input = correction(owner, event)
  ok(await correct(owner.a, input))
  const current = await ledger(owner.a, owner)
  for (const client of [stranger.a, stack.client()]) {
    const denied = await correct(client, input)
    assert.equal(denied.error.code, '42501')
    assert.ok([401, 403].includes(denied.status))
  }
  for (const table of [
    'effective_review_events',
    'review_assessment_corrections',
    'review_progress_heads',
    'review_progress_checkpoints',
  ]) {
    assert.deepEqual(
      ok(await stranger.a.from(table).select('*').eq('word_id', owner.wordId)),
      []
    )
    assert.ok((await stack.client().from(table).select('*')).error)
  }
  const invalid = await correct(owner.a, { ...input, p_event_id: 'not-a-uuid' })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.error.code, '22P02')
  assert.deepEqual(await ledger(owner.a, owner), current)
})
