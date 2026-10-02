import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  owner,
  other,
  seedUsers,
  review,
  assessment,
} from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import {
  importFixture,
  applyRpc,
  recoverRpc,
  cancelRpc,
  readRpc,
} from './dictionary-import-recovery-fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    reads_enabled = true, operations_enabled = true, legacy_guard_enabled = true;`)
})
after(async () => db?.close())
const PLACEMENT_CONFLICT = 'placement-conflict'
const IDENTITY_CONFLICT = 'identity-conflict'
const STATE_CONFLICT = 'state-conflict'
const unavailable = /import-personal-id-unavailable/
const settled = /import-original-settled/
const cancelled = /import-cancelled/
const operationConflict = /import-recovery-operation-conflict/
const withoutMetadata = ({ collection_id, updated_at, ...word }) => word

// These test new-protocol outcomes; historical vulnerable behavior stays pinned
// in dictionary-import-recovery-baseline.test.mjs.
test('undelivered import recovers at the same ID and fences the restored old target', async () => {
  const f = await importFixture(db)
  await db.sql(
    `DELETE FROM public.collections WHERE collection_id = '${f.targets[0]}';`
  )
  const request = f.recovery({ expected_collection_id: null })
  const receipt = await f.recover(request)
  assert.equal(receipt.outcome, 'applied')
  assert.equal(receipt.recovery_version, 1)
  assert.equal((await f.row()).word_id, f.intent.word_id)
  assert.equal((await f.row()).collection_id, f.targets[1])
  assert.equal((await f.row()).repetition_count, 0)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM public.word_content_state WHERE word_id = '${f.intent.word_id}';`
    ),
    '0'
  )
  await db.sql(
    `INSERT INTO public.collections(collection_id,user_id,name) VALUES ('${f.targets[0]}','${owner}','Restored');`
  )
  await assert.rejects(f.apply(), settled)
  assert.equal((await f.recover(request)).idempotent, true)
  assert.equal((await f.row()).collection_id, f.targets[1])
})

test('lost original reply recovers only placement and preserves private text, SRS and review events', async () => {
  const f = await importFixture(db)
  await f.apply()
  await review(db, assessment(f.intent.word_id))
  await db.sql(
    `UPDATE public.words SET analysis_notes = 'owner-private',interval_days = 37,repetition_count = 8 WHERE word_id = '${f.intent.word_id}';`
  )
  const before = await f.row()
  const events = await db.sql(
    `SELECT jsonb_agg(to_jsonb(e)) FROM public.review_events e WHERE word_id = '${f.intent.word_id}';`
  )
  const request = f.recovery()
  await f.recover(request)
  assert.deepEqual(withoutMetadata(await f.row()), withoutMetadata(before))
  assert.equal(
    await db.sql(
      `SELECT jsonb_agg(to_jsonb(e)) FROM public.review_events e WHERE word_id = '${f.intent.word_id}';`
    ),
    events
  )
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET collection_id = '${f.targets[2]}' WHERE word_id = '${f.intent.word_id}';`
    )
  )
  const moved = await f.row()
  assert.equal((await f.apply()).idempotent, true)
  assert.equal((await f.recover(request)).idempotent, true)
  assert.deepEqual(await f.row(), moved)
})

test('accepted personal ID is never resurrected after hard deletion, soft deletion or new original nonce', async () => {
  for (const hard of [true, false]) {
    const f = await importFixture(db)
    await f.apply()
    const request = f.recovery()
    await f.recover(request)
    await db.sql(
      hard
        ? `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
        : `UPDATE public.words SET deleted_at = now() WHERE word_id = '${f.intent.word_id}';`
    )
    const before = await f.row()
    assert.equal((await f.apply()).idempotent, true)
    assert.equal((await f.recover(request)).idempotent, true)
    await assert.rejects(
      f.recover(
        f.recovery({
          expected_recovery_version: 1,
          expected_collection_id: f.targets[1],
        })
      ),
      unavailable
    )
    await assert.rejects(
      f.apply({ ...f.intent, operation_id: randomUUID() }),
      unavailable
    )
    assert.equal((await f.read()).state, 'unavailable')
    assert.deepEqual(await f.row(), before)
    assert.equal((await f.origin()).inserted_once, true)
  }
})

test('repeated recovery uses CAS; ordinary movement and deleted-target NULL placement need explicit refresh', async () => {
  const f = await importFixture(db)
  await f.apply()
  const a = f.recovery()
  await f.recover(a)
  const stale = f.recovery({ target_collection_id: f.targets[2] })
  const conflict = await f.recover(stale)
  assert.equal(conflict.outcome, STATE_CONFLICT)
  assert.equal(conflict.state.recovery_version, 1)
  assert.equal(conflict.state.collection_id, f.targets[1])
  const b = f.recovery({
    target_collection_id: f.targets[2],
    expected_recovery_version: 1,
    expected_collection_id: f.targets[1],
  })
  await f.recover(b)
  await f.recover(a)
  assert.equal((await f.row()).collection_id, f.targets[2])
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET collection_id = '${f.targets[0]}' WHERE word_id = '${f.intent.word_id}';`
    )
  )
  const placement = await f.recover(
    f.recovery({
      expected_recovery_version: 2,
      expected_collection_id: f.targets[2],
    })
  )
  assert.equal(placement.outcome, PLACEMENT_CONFLICT)
  assert.equal(placement.state.collection_id, f.targets[0])
  await db.sql(
    `DELETE FROM public.collections WHERE collection_id = '${f.targets[0]}';`
  )
  assert.equal((await f.read()).collection_id, null)
  await f.recover(
    f.recovery({ expected_recovery_version: 2, expected_collection_id: null })
  )
  assert.equal((await f.origin()).recovery_version, 3)
})

test('semantic conflict settles the old root and explicit vacant-key retry never adopts the duplicate', async () => {
  const f = await importFixture(db)
  const duplicate = {
    ...f.intent,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: f.targets[2],
  }
  await f.apply(duplicate)
  await db.sql(
    `UPDATE public.words SET repetition_count = 9 WHERE word_id = '${duplicate.word_id}';`
  )
  const request = f.recovery()
  const conflict = await f.recover(request)
  assert.equal(conflict.outcome, IDENTITY_CONFLICT)
  assert.equal(conflict.existing_word_id, duplicate.word_id)
  assert.equal(await f.row(), null)
  assert.equal((await f.origin()).inserted_once, false)
  await assert.rejects(f.apply(), settled)
  await assert.rejects(
    f.apply({ ...f.intent, operation_id: randomUUID() }),
    unavailable
  )
  await db.sql(
    `DELETE FROM public.words WHERE word_id = '${duplicate.word_id}';`
  )
  assert.equal((await f.recover(request)).outcome, IDENTITY_CONFLICT)
  await f.recover(f.recovery({ expected_recovery_version: 1 }))
  assert.equal((await f.row()).word_id, f.intent.word_id)
  assert.equal((await f.origin()).inserted_once, true)
})

test('original conflict retry remains compatible until a recovery root is claimed', async () => {
  const f = await importFixture(db)
  const duplicate = {
    ...f.intent,
    operation_id: randomUUID(),
    word_id: randomUUID(),
  }
  await f.apply(duplicate)
  assert.equal((await f.apply()).outcome, IDENTITY_CONFLICT)
  assert.equal(await f.origin(), null)
  await db.sql(
    `DELETE FROM public.words WHERE word_id = '${duplicate.word_id}';`
  )
  const next = { ...f.intent, operation_id: randomUUID() }
  assert.equal((await f.apply(next)).outcome, 'inserted')
  assert.equal((await f.apply()).outcome, IDENTITY_CONFLICT)
})

test('cancellation fences late creation and preserves existing card until ordinary deletion', async () => {
  for (const delivered of [true, false]) {
    const f = await importFixture(db)
    if (delivered) await f.apply()
    const before = await f.row()
    const request = f.cancellation()
    const result = await f.cancel(request)
    assert.equal(result.recovery_version, 1)
    assert.equal((await f.cancel(request)).idempotent, true)
    assert.equal((await f.cancel(f.cancellation())).recovery_version, 1)
    assert.deepEqual(await f.row(), before)
    if (delivered) assert.equal((await f.apply()).idempotent, true)
    else await assert.rejects(f.apply(), cancelled)
    await assert.rejects(
      f.recover(f.recovery({ expected_recovery_version: 1 })),
      cancelled
    )
    await db.sql(
      asUser(
        owner,
        `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
      )
    )
    assert.equal(await f.row(), null)
    assert.equal((await f.read()).state, 'cancelled')
  }
})

test('lost recovery receipt remains a historical no-op after cancellation', async () => {
  const f = await importFixture(db)
  const request = f.recovery()
  await f.recover(request)
  await f.cancel(f.cancellation())
  await db.sql(
    `DELETE FROM public.words WHERE word_id = '${f.intent.word_id}';`
  )
  assert.equal((await f.recover(request)).idempotent, true)
  assert.equal(await f.row(), null)
})

test('default-off, anonymous, foreign target and unproven same-owner ID cannot bypass recovery authority', async () => {
  const f = await importFixture(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = false;'
  )
  for (const query of [
    readRpc(f.intent),
    recoverRpc(f.recovery()),
    cancelRpc(f.cancellation()),
  ]) {
    await assert.rejects(db.sql(asUser(owner, query)), /unsupported-protocol/)
  }
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled = true;'
  )
  await assert.rejects(
    db.sql(`SET ROLE anon; ${recoverRpc(f.recovery())}`),
    /permission denied/
  )
  const foreign = await importFixture(db, other)
  await assert.rejects(
    f.recover(f.recovery({ target_collection_id: foreign.targets[1] })),
    /access denied/
  )
  await foreign.apply()
  const unproven = { ...f.intent, word_id: foreign.intent.word_id }
  await assert.rejects(
    f.call('read_dictionary_import_recovery_v1', unproven),
    unavailable
  )
  await assert.rejects(
    f.call('cancel_dictionary_import_v1', {
      ...f.cancellation(),
      original_intent: unproven,
    }),
    unavailable
  )
  await db.sql(`INSERT INTO public.words(word_id,user_id,dutch_lemma,translations,tts_url)
    VALUES ('${f.intent.word_id}','${owner}','unrelated-${randomUUID()}','{}','');`)
  await assert.rejects(f.read(), unavailable)
  await assert.rejects(f.recover(f.recovery()), unavailable)
  await assert.rejects(f.cancel(f.cancellation()), unavailable)
  assert.equal(await f.origin(), null)
})

test('immutable requests, root payloads and shared recovery/cancel nonces reject mismatches', async () => {
  const f = await importFixture(db)
  const request = f.recovery()
  await f.recover(request)
  await assert.rejects(
    f.recover({ ...request, target_collection_id: f.targets[2] }),
    operationConflict
  )
  await assert.rejects(
    f.cancel({ ...f.cancellation(), operation_id: request.operation_id }),
    operationConflict
  )
  await assert.rejects(
    f.call('read_dictionary_import_recovery_v1', {
      ...f.intent,
      collection_id: f.targets[2],
    }),
    unavailable
  )
  const another = await importFixture(db)
  await assert.rejects(
    another.apply({ ...another.intent, operation_id: f.intent.operation_id }),
    /import-operation-conflict/
  )
  await assert.rejects(
    db.sql(
      `UPDATE private.dictionary_import_origins SET cancelled = false,recovery_version = 0 WHERE word_id = '${f.intent.word_id}';`
    ),
    /cannot regress/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_import_origins WHERE word_id = '${f.intent.word_id}';`
    ),
    /cannot be deleted/
  )
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_import_recovery_receipts WHERE operation_id = '${request.operation_id}';`
    ),
    /immutable/
  )
  await assert.rejects(
    db.sql(asUser(owner, 'SELECT * FROM private.dictionary_import_origins;')),
    /permission denied/
  )
})

test('invalid request and unavailable target roll back all origin/receipt changes', async () => {
  const f = await importFixture(db)
  const request = f.recovery()
  for (const change of [
    { extra: true },
    { expected_recovery_version: -1 },
    { expected_recovery_version: 1.5 },
    { expected_recovery_version: 2147483648 },
    { expected_collection_id: 123 },
    { operation_id: f.intent.operation_id },
  ]) {
    await assert.rejects(
      f.recover({ ...request, ...change }),
      /invalid-import-recovery/
    )
  }
  await assert.rejects(
    f.recover({ ...request, target_collection_id: randomUUID() }),
    /access denied/
  )
  assert.equal(await f.origin(), null)
  assert.equal(await f.row(), null)
  await db.sql(`BEGIN; ${asUser(owner, recoverRpc(request))} ROLLBACK;`)
  assert.equal(await f.origin(), null)
  assert.equal(await f.row(), null)
  assert.equal((await f.apply()).outcome, 'inserted')
})

test('real overlap: same request replays once; different choices conflict at the same generation', async () => {
  const f = await importFixture(db)
  const a = f.recovery()
  const replay = JSON.parse(await overlap(db, recoverRpc(a), recoverRpc(a)))
  assert.equal(replay.idempotent, true)
  assert.equal((await f.origin()).recovery_version, 1)
  const g = await importFixture(db)
  const b = g.recovery({ target_collection_id: g.targets[2] })
  const conflict = JSON.parse(
    await overlap(db, recoverRpc(g.recovery()), recoverRpc(b))
  )
  assert.equal(conflict.outcome, STATE_CONFLICT)
  assert.equal((await g.row()).collection_id, g.targets[1])
})

test('real overlap: original-first is moved; recovery-first fences a waiting original', async () => {
  const f = await importFixture(db)
  assert.equal(
    JSON.parse(await overlap(db, applyRpc(f.intent), recoverRpc(f.recovery())))
      .outcome,
    'applied'
  )
  assert.equal((await f.row()).collection_id, f.targets[1])
  const g = await importFixture(db)
  await assert.rejects(
    overlap(db, recoverRpc(g.recovery()), applyRpc(g.intent)),
    settled
  )
  assert.equal((await g.row()).collection_id, g.targets[1])
})

test('real overlap: cancellation wins against late original/recovery; insertion-first is fenced before normal delete', async () => {
  const f = await importFixture(db)
  await assert.rejects(
    overlap(db, cancelRpc(f.cancellation()), applyRpc(f.intent)),
    cancelled
  )
  assert.equal(await f.row(), null)
  const g = await importFixture(db)
  await assert.rejects(
    overlap(db, cancelRpc(g.cancellation()), recoverRpc(g.recovery())),
    cancelled
  )
  const h = await importFixture(db)
  assert.equal(
    JSON.parse(
      await overlap(db, applyRpc(h.intent), cancelRpc(h.cancellation()))
    ).outcome,
    'cancelled'
  )
  assert.equal((await h.origin()).inserted_once, true)
  await db.sql(
    asUser(
      owner,
      `DELETE FROM public.words WHERE word_id = '${h.intent.word_id}';`
    )
  )
  assert.equal(await h.row(), null)
})

test('version exhaustion is explicit; account cascade removes origin and both immutable ledgers', async () => {
  const user = randomUUID()
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${user}','${user}@example.invalid');`
  )
  const f = await importFixture(db, user)
  await f.apply()
  await f.recover(f.recovery())
  await db.sql(
    `UPDATE private.dictionary_import_origins SET recovery_version = 2147483647 WHERE word_id = '${f.intent.word_id}';`
  )
  await assert.rejects(
    f.recover(
      f.recovery({
        expected_recovery_version: 2147483647,
        expected_collection_id: f.targets[1],
      })
    ),
    /version-exhausted/
  )
  await assert.rejects(f.cancel(f.cancellation()), /version-exhausted/)
  await db.sql(`DELETE FROM auth.users WHERE id = '${user}';`)
  for (const table of [
    'dictionary_import_origins',
    'dictionary_import_receipts',
    'dictionary_import_recovery_receipts',
  ]) {
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM private.${table} WHERE user_id = '${user}';`
      ),
      '0'
    )
  }
})

test('real overlap: concurrent ordinary move or target deletion yields placement conflict, without stale target overwrite', async () => {
  const f = await importFixture(db)
  await f.apply()
  const moved = JSON.parse(
    await overlap(
      db,
      `UPDATE public.words SET collection_id = '${f.targets[2]}' WHERE word_id = '${f.intent.word_id}';`,
      recoverRpc(f.recovery())
    )
  )
  assert.equal(moved.outcome, PLACEMENT_CONFLICT)
  assert.equal((await f.row()).collection_id, f.targets[2])
  const detached = JSON.parse(
    await overlap(
      db,
      `DELETE FROM public.collections WHERE collection_id = '${f.targets[2]}';`,
      recoverRpc(f.recovery({ expected_collection_id: f.targets[2] }))
    )
  )
  assert.equal(detached.outcome, PLACEMENT_CONFLICT)
  assert.equal(detached.state.collection_id, null)
  assert.equal((await f.origin()).recovery_version, 0)
})

test('guarded ordinary move races recovery in either order without overwriting the winner', async () => {
  for (const ordinaryFirst of [false, true]) {
    const f = await importFixture(db)
    await f.apply()
    // The repaired client persists this same immutable recovery request for an
    // ordinary settled imported move before attempting any network delivery.
    const ordinary = f.recovery({ target_collection_id: f.targets[1] })
    const recovery = f.recovery({ target_collection_id: f.targets[2] })
    const first = ordinaryFirst ? ordinary : recovery
    const second = ordinaryFirst ? recovery : ordinary
    const conflict = JSON.parse(
      await overlap(db, recoverRpc(first), recoverRpc(second))
    )
    assert.equal(conflict.outcome, STATE_CONFLICT)
    assert.equal((await f.row()).collection_id, first.target_collection_id)
    assert.equal((await f.origin()).recovery_version, 1)
    assert.equal((await f.recover(first)).idempotent, true)
    // A later explicit move must not be undone by an old lost-reply replay.
    await f.recover(
      f.recovery({
        expected_recovery_version: 1,
        expected_collection_id: first.target_collection_id,
        target_collection_id: second.target_collection_id,
      })
    )
    assert.equal((await f.recover(first)).idempotent, true)
    assert.equal((await f.row()).collection_id, second.target_collection_id)
    assert.equal((await f.origin()).recovery_version, 2)
  }
})
