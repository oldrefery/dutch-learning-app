import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import {
  asUser,
  literal,
  owner,
  other,
  seedUsers,
  state,
  review,
  assessment,
} from './fixtures.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
let db
const json = value => `${literal(JSON.stringify(value))}::JSONB`
const rpc = (name, input) => `SELECT public.${name}(${json(input)});`
const applySql = input => rpc('apply_dictionary_import_intent_v2', input)
const recoverySql = input => rpc('recover_dictionary_import_v2', input)
const cancelSql = input => rpc('cancel_dictionary_import_v2', input)
const STALE_PLACEMENT = 'placement-conflict'
const APPLIED = 'applied'
const STALE_STATE = 'state-conflict'
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => db?.close())
async function fixture() {
  await db.sql(`UPDATE private.dictionary_content_runtime SET reads_enabled=TRUE,operations_enabled=TRUE,legacy_guard_enabled=TRUE,
    following_reads_enabled=TRUE,following_imports_enabled=TRUE;`)
  const targets = []
  for (const name of ['Original', 'Recovery', 'Later'])
    targets.push(
      await db.sql(
        `INSERT INTO public.collections(user_id,name) VALUES ('${owner}','${name}') RETURNING collection_id;`
      )
    )
  const c = JSON.parse(
    await db.sql(
      `SELECT private.official_dictionary_content_v1(${json({ entry_id: 'fixture', dutch_lemma: `recovery-${randomUUID()}`, part_of_speech: 'noun', article: 'de', translations: { en: ['synthetic'] } })});`
    )
  )
  const entry = randomUUID(),
    revision = randomUUID(),
    source = randomUUID(),
    hash = createHash('sha256').update(canonicalizeJson(c)).digest('hex')
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES ('${source}','first_party','fixture://${source}','approved','${owner}',NOW(),'${hash}');
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key) VALUES ('${entry}','nl',${literal(c.dutch_lemma)},'noun','de','${randomUUID()}');
    INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    VALUES ('${revision}','${entry}',1,${json(c)},'${hash}',private.dictionary_cefr_content_sha256(${json(c)}),'${source}','published',NOW(),NOW());
    INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES ('${entry}','${revision}');
    UPDATE public.dictionary_entries SET state='published' WHERE entry_id='${entry}';`)
  const intent = {
    protocol_version: 2,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: targets[0],
    source: {
      kind: 'published-reference',
      reference: { entry_id: entry, revision_id: revision },
      content_sha256: hash,
    },
  }
  const call = (name, input, actor = owner) =>
    db.sql(asUser(actor, rpc(name, input))).then(JSON.parse)
  return {
    entry,
    intent,
    targets,
    call,
    apply: () => call('apply_dictionary_import_intent_v2', intent),
    read: () => call('read_dictionary_import_recovery_v2', intent),
    recover: r => call('recover_dictionary_import_v2', r),
    cancel: r => call('cancel_dictionary_import_v2', r),
    recovery: fields => ({
      protocol_version: 2,
      operation_id: randomUUID(),
      original_intent: intent,
      expected_recovery_version: 0,
      expected_collection_id: targets[0],
      target_collection_id: targets[1],
      ...fields,
    }),
    cancellation: () => ({
      protocol_version: 2,
      operation_id: randomUUID(),
      original_intent: intent,
    }),
    row: () => state(db, intent.word_id),
  }
}
test('undelivered follow import recovers at the same ID and fences a late original even when its target is restored', async () => {
  const f = await fixture()
  await db.sql(
    `DELETE FROM public.collections WHERE collection_id='${f.targets[0]}';`
  )
  const request = f.recovery({ expected_collection_id: null }),
    receipt = await f.recover(request)
  assert.equal(receipt.outcome, APPLIED)
  assert.equal(receipt.recovery_version, 1)
  assert.equal((await f.row()).word.dictionary_content_mode, 'follow')
  assert.equal((await f.row()).word.collection_id, f.targets[1])
  await db.sql(
    `INSERT INTO public.collections(collection_id,user_id,name) VALUES ('${f.targets[0]}','${owner}','Restored');`
  )
  await assert.rejects(f.apply(), /import-original-settled/)
  assert.deepEqual(await f.recover(request), { ...receipt, idempotent: true })
  assert.equal((await f.read()).protocol_version, 2)
})
test('original-first recovery moves only placement after learning, retirement and flags off; replay preserves later ordinary moves', async () => {
  const f = await fixture(),
    original = await f.apply()
  await review(db, assessment(f.intent.word_id))
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${f.entry}'; UPDATE private.dictionary_content_runtime SET following_imports_enabled=FALSE;`
  )
  const before = await f.row(),
    request = f.recovery(),
    receipt = await f.recover(request),
    after = await f.row()
  const strip = ({ collection_id, updated_at, ...rest }) => rest
  assert.deepEqual(strip(after.word), strip(before.word))
  assert.deepEqual(after.events, before.events)
  assert.equal(after.word.collection_id, f.targets[1])
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET collection_id='${f.targets[2]}' WHERE word_id='${f.intent.word_id}';`
    )
  )
  const moved = await f.row()
  assert.deepEqual(await f.recover(request), { ...receipt, idempotent: true })
  assert.deepEqual(await f.apply(), { ...original, idempotent: true })
  assert.deepEqual(await f.row(), moved)
})
test('ordinary movement/deleted-target NULL placement requires explicit CAS refresh and stale recovery version conflicts', async () => {
  const f = await fixture()
  await f.apply()
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET collection_id='${f.targets[2]}' WHERE word_id='${f.intent.word_id}';`
    )
  )
  const stale = await f.recover(f.recovery())
  assert.equal(stale.outcome, STALE_PLACEMENT)
  assert.equal(stale.state.collection_id, f.targets[2])
  const receipt = await f.recover(
    f.recovery({ expected_collection_id: f.targets[2] })
  )
  assert.equal(receipt.recovery_version, 1)
  assert.equal((await f.recover(f.recovery())).outcome, STALE_STATE)
  await db.sql(
    `DELETE FROM public.collections WHERE collection_id='${f.targets[1]}';`
  )
  const pending = f.recovery({
    expected_recovery_version: 1,
    expected_collection_id: null,
    target_collection_id: f.targets[2],
  })
  assert.equal((await f.recover(pending)).outcome, APPLIED)
})
test('cancellation before arrival fences original/recovery; after creation it leaves the word and learning for ordinary deletion', async () => {
  const f = await fixture(),
    request = f.cancellation(),
    receipt = await f.cancel(request)
  assert.equal((await f.read()).state, 'cancelled')
  await assert.rejects(f.apply(), /import-cancelled/)
  await assert.rejects(f.recover(f.recovery()), /import-cancelled/)
  assert.deepEqual(await f.cancel(request), { ...receipt, idempotent: true })
  const g = await fixture()
  await g.apply()
  await review(db, assessment(g.intent.word_id))
  const before = await g.row()
  await g.cancel(g.cancellation())
  assert.deepEqual(await g.row(), before)
})
test('hard and soft deleted imported IDs are unavailable, not resurrected by recovery or a new original nonce', async () => {
  for (const hard of [false, true]) {
    const f = await fixture()
    await f.apply()
    await db.sql(
      hard
        ? `DELETE FROM public.words WHERE word_id='${f.intent.word_id}';`
        : `UPDATE public.words SET deleted_at=NOW() WHERE word_id='${f.intent.word_id}';`
    )
    assert.equal((await f.read()).state, 'unavailable')
    await assert.rejects(
      f.recover(f.recovery()),
      /import-personal-id-unavailable/
    )
    await assert.rejects(
      f.call('apply_dictionary_import_intent_v2', {
        ...f.intent,
        operation_id: randomUUID(),
      }),
      /import-personal-id-unavailable/
    )
  }
})
test('creation during recovery still enforces dormant flags, approved reference and ownership; reads/cancellation remain available', async () => {
  const f = await fixture()
  await db.sql(
    `UPDATE private.dictionary_content_runtime SET following_imports_enabled=FALSE;`
  )
  await assert.rejects(f.recover(f.recovery()), /following-import-disabled/)
  assert.equal((await f.read()).state, 'uncreated')
  await f.cancel(f.cancellation())
  const g = await fixture(),
    foreign = await db.sql(
      `INSERT INTO public.collections(user_id,name) VALUES ('${other}','Foreign') RETURNING collection_id;`
    )
  await assert.rejects(
    g.recover(g.recovery({ target_collection_id: foreign })),
    /access denied/
  )
  await db.sql(
    `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${g.entry}';`
  )
  await assert.rejects(g.recover(g.recovery()), /import-review-required/)
  assert.equal((await g.read()).recovery_version, 0)
})
test('changed roots/nonces/protocols and cross-owner access fail without mutating receipts', async () => {
  const f = await fixture(),
    request = f.recovery()
  await f.recover(request)
  await assert.rejects(
    f.recover({ ...request, target_collection_id: f.targets[2] }),
    /import-recovery-operation-conflict/
  )
  await assert.rejects(
    f.cancel({ ...f.cancellation(), operation_id: request.operation_id }),
    /import-recovery-operation-conflict/
  )
  await assert.rejects(
    f.call('read_dictionary_import_recovery_v2', f.intent, other),
    /import-personal-id-unavailable/
  )
  await assert.rejects(
    f.recover({ ...request, protocol_version: 1 }),
    /invalid-import-recovery/
  )
  await assert.rejects(
    f.recover({ ...request, repetition_count: 9 }),
    /invalid-import-recovery/
  )
})
test('real overlap: original-first moves; recovery-first rejects the waiting old original', async () => {
  const f = await fixture(),
    request = f.recovery()
  assert.equal(
    JSON.parse(await overlap(db, applySql(f.intent), recoverySql(request)))
      .outcome,
    APPLIED
  )
  assert.equal((await f.row()).word.collection_id, f.targets[1])
  const g = await fixture(),
    r = g.recovery()
  await assert.rejects(
    overlap(db, recoverySql(r), applySql(g.intent)),
    /import-original-settled/
  )
  assert.equal((await g.row()).word.collection_id, g.targets[1])
})
test('real overlap: same recovery replays, cancellation fences a waiting original and newer choices preserve the winner', async () => {
  const f = await fixture(),
    request = f.recovery()
  assert.equal(
    JSON.parse(await overlap(db, recoverySql(request), recoverySql(request)))
      .idempotent,
    true
  )
  const g = await fixture(),
    cancel = g.cancellation()
  await assert.rejects(
    overlap(db, cancelSql(cancel), applySql(g.intent)),
    /import-cancelled/
  )
  const changed = f.recovery({ target_collection_id: f.targets[2] })
  assert.equal((await f.recover(changed)).outcome, STALE_STATE)
})
test('recovery/cancellation journals remain immutable, bounded by version exhaustion and removed only on Auth deletion', async () => {
  const f = await fixture()
  await f.recover(f.recovery())
  await assert.rejects(
    db.sql(
      `DELETE FROM private.dictionary_import_recovery_receipts WHERE user_id='${owner}';`
    ),
    /immutable/
  )
  await db.sql(
    `UPDATE private.dictionary_import_origins SET recovery_version=2147483647 WHERE word_id='${f.intent.word_id}';`
  )
  await assert.rejects(
    f.cancel(f.cancellation()),
    /import-recovery-version-exhausted/
  )
  await assert.rejects(
    f.recover(
      f.recovery({
        expected_recovery_version: 2147483647,
        expected_collection_id: f.targets[1],
      })
    ),
    /import-recovery-version-exhausted/
  )
  await assert.rejects(
    db.sql('SET ROLE anon; SELECT public.recover_dictionary_import_v2(NULL);'),
    /permission denied/
  )
  await assert.rejects(
    db.sql(
      'SET ROLE service_role; SELECT public.recover_dictionary_import_v2(NULL);'
    ),
    /permission denied/
  )
  const g = await fixture(),
    actor = randomUUID()
  await db.sql(`INSERT INTO auth.users(id,email) VALUES ('${actor}','${actor}@example.invalid');
    UPDATE public.collections SET user_id='${actor}' WHERE collection_id=ANY(ARRAY[${g.targets.map(literal).join(',')}]::UUID[]);`)
  await g.call('recover_dictionary_import_v2', g.recovery(), actor)
  await db.sql(`DELETE FROM auth.users WHERE id='${actor}';`)
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_recovery_receipts WHERE user_id='${actor}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM private.dictionary_import_origins WHERE user_id='${actor}';`
    ),
    '0'
  )
  assert.equal(
    await db.sql(
      `SELECT COUNT(*) FROM public.dictionary_entries WHERE entry_id='${g.entry}';`
    ),
    '1'
  )
})

test('real overlap: different recovery choices CAS the root; ordinary moves preserve the winning placement in both orders', async () => {
  const f = await fixture(),
    a = f.recovery(),
    b = f.recovery({ target_collection_id: f.targets[2] })
  assert.equal(
    JSON.parse(await overlap(db, recoverySql(a), recoverySql(b))).outcome,
    STALE_STATE
  )
  const g = await fixture()
  await g.apply()
  const move = `UPDATE public.words SET collection_id='${g.targets[2]}' WHERE word_id='${g.intent.word_id}';`
  const request = g.recovery()
  assert.equal(
    JSON.parse(await overlap(db, move, recoverySql(request))).outcome,
    STALE_PLACEMENT
  )
  const h = await fixture()
  await h.apply()
  await overlap(
    db,
    recoverySql(h.recovery()),
    `UPDATE public.words SET collection_id='${h.targets[2]}' WHERE word_id='${h.intent.word_id}';`
  )
  assert.equal((await h.row()).word.collection_id, h.targets[2])
})
