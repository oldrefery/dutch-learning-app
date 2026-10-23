import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { followingFixture } from './following-concurrency.fixture.mjs'
import { session } from './following-session.fixture.mjs'
import { asUser, assessment, rpc, state } from './fixtures.mjs'
import {
  correction,
  correctionSql,
  correctionState,
  resetSql,
} from './correction-fixtures.mjs'

let db, tools
const TABLE = 'dictionary_following_rehearsal'
const STALE = 'stale-result'
before(async () => {
  db = await createCluster()
  for (const name of [
    'rehearsal.sql',
    'following-plan.sql',
    'following-apply.sql',
    'following-rollback.sql',
  ])
    await db.sql(
      await readFile(
        new URL(`../shared-dictionary/${name}`, import.meta.url),
        'utf8'
      )
    )
  tools = followingFixture(db)
  await tools.enable()
})
after(async () => {
  await db?.close()
})
const sql = (p, batch = randomUUID(), limit = 50) =>
  `SELECT ${TABLE}.rollback('${p.run}','${p.hash}','${batch}',${limit});`
const undo = async (p, batch, limit) =>
  JSON.parse(await db.sql(sql(p, batch, limit)))
const receipts = async p =>
  JSON.parse(
    await db.sql(
      `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY word_id),'[]') FROM ${TABLE}.rollback_receipts r WHERE run_id='${p.run}';`
    )
  )
async function applied(count = 1) {
  const value = await tools.reviewed(count)
  value.originals = await tools.items(value.p)
  assert.equal(
    (await tools.apply(value.p, 100)).result.applied,
    Math.min(count, 100)
  )
  if (count > 100) await tools.apply(value.p, 100)
  value.applied = await tools.receipts(value.p)
  return value
}
async function fault(p, table, body) {
  const name = `rollback_fault_${randomUUID().replaceAll('-', '')}`
  await db.sql(`CREATE FUNCTION ${TABLE}.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.run_id='${p.run}' THEN ${body} END IF; RETURN NEW; END; $$;
    CREATE TRIGGER ${name} BEFORE INSERT ON ${TABLE}.${table} FOR EACH ROW EXECUTE FUNCTION ${TABLE}.${name}();`)
  return () =>
    db.sql(
      `DROP TRIGGER IF EXISTS ${name} ON ${TABLE}.${table}; DROP FUNCTION IF EXISTS ${TABLE}.${name}();`
    )
}
async function unchanged(p, f, rows) {
  assert.deepEqual(await receipts(p), [])
  assert.deepEqual(await Promise.all(f.words.map(tools.protectedRow)), rows)
}
test('committed apply, new authenticated accepted review, selective rollback and exact review retry preserve learning/history', async () => {
  const { f, p, originals, applied: originalReceipts } = await applied()
  const word = f.words[0],
    input = assessment(word, { at: '2026-10-11T12:00:00Z', date: '2026-10-11' })
  await db.sql(asUser(f.owner, rpc(input)))
  const accepted = await state(db, word)
  assert.equal(accepted.events.length, 1)
  assert.equal((await undo(p)).restored, 1)
  const restored = await state(db, word)
  assert.deepEqual(tools.baseWord(restored.word), tools.baseWord(accepted.word))
  assert.deepEqual(restored.events, accepted.events)
  assert.equal(restored.word.dictionary_content_mode, 'legacy')
  assert.equal(restored.word.dictionary_entry_id, null)
  assert.deepEqual(await tools.content(word), originals[0].original_content)
  assert.equal((await receipts(p))[0].resulting_content_version, '2')
  await db.sql(asUser(f.owner, rpc(input)))
  assert.deepEqual(await state(db, word), restored)
  assert.deepEqual(await tools.items(p), originals)
  assert.deepEqual(await tools.receipts(p), originalReceipts)
})
test('private media/diff and existing fallback are restored with a new exact large decimal version', async () => {
  const f = await tools.fixture(),
    word = f.words[0],
    original = await tools.content(word)
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
    VALUES('${word}','${f.owner}',9007199254740993,${tools.json(original)});`)
  const entry = await tools.target(f, {
    ...original,
    image_url: 'https://example.invalid/shared',
  })
  const p = await tools.plan(f, {
    [word]: await tools.decision(f, word, entry, 'approved-diff-link'),
  })
  await tools.apply(p)
  assert.equal((await undo(p)).restored, 1)
  assert.equal(
    (await receipts(p))[0].resulting_content_version,
    '9007199254740995'
  )
  assert.deepEqual(await tools.content(word), original)
})
test('post-apply reset and corrected review checkpoints, effective history and exact command retries survive rollback', async () => {
  const { f, p } = await applied(),
    word = f.words[0]
  await db.sql(asUser(f.owner, resetSql(word)))
  const input = assessment(word, { at: '2026-09-05T15:00:00Z' }),
    command = correction(input)
  await db.sql(asUser(f.owner, rpc(input)))
  await db.sql(asUser(f.owner, correctionSql(command)))
  const learning = await state(db, word),
    history = await correctionState(db, word, f.owner)
  assert.equal(history.corrections.length, 1)
  assert.equal((await undo(p)).restored, 1)
  const restored = await state(db, word)
  assert.deepEqual(tools.baseWord(restored.word), tools.baseWord(learning.word))
  assert.deepEqual(restored.events, learning.events)
  assert.deepEqual(await correctionState(db, word, f.owner), history)
  await db.sql(asUser(f.owner, correctionSql(command)))
  assert.deepEqual(await state(db, word), restored)
  assert.deepEqual(await correctionState(db, word, f.owner), history)
})
test('original linked legacy reference and state are restored without deleting originals or rewriting lexical fields', async () => {
  const f = await tools.fixture(),
    word = f.words[0],
    raw = await tools.protectedRow(word)
  const original = await tools.target(f, await tools.content(word))
  await db.sql(`UPDATE public.words SET dictionary_entry_id='${original.entry_id}',dictionary_revision_id='${original.revision_id}' WHERE word_id='${word}';
    INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
    VALUES('${word}','${f.owner}',31,NULL,'{}');`)
  const legacy = await tools.content(word),
    target = await tools.target(f, {
      ...legacy,
      image_url: 'https://example.invalid/new-shared',
    })
  const p = await tools.plan(f, {
    [word]: await tools.decision(f, word, target, 'approved-diff-link'),
  })
  const originals = await tools.items(p)
  assert.equal((await tools.apply(p)).result.applied, 1)
  assert.equal((await undo(p)).restored, 1)
  const restored = await tools.protectedRow(word)
  assert.equal(restored.dictionary_content_mode, 'legacy')
  assert.equal(restored.dictionary_entry_id, original.entry_id)
  assert.equal(restored.dictionary_revision_id, original.revision_id)
  assert.deepEqual(tools.baseWord(restored), tools.baseWord(raw))
  assert.deepEqual(await tools.content(word), legacy)
  assert.equal((await receipts(p))[0].resulting_content_version, '33')
  assert.deepEqual(await tools.items(p), originals)
})
test('later raw content, placement, state version and reference changes are terminal holds', async () => {
  for (const kind of ['content', 'placement', 'state', 'reference']) {
    const { f, p } = await applied(),
      word = f.words[0]
    const changes = {
      content: `UPDATE public.words SET image_url='https://example.invalid/later' WHERE word_id='${word}';`,
      placement: `UPDATE public.words SET collection_id=NULL WHERE word_id='${word}';`,
      state: `UPDATE public.word_content_state SET content_version=content_version+1 WHERE word_id='${word}';`,
      reference: `UPDATE public.words SET dictionary_content_mode='legacy' WHERE word_id='${word}';`,
    }
    await db.sql(changes[kind])
    const before = await tools.protectedRow(word)
    assert.equal((await undo(p)).skipped, 1)
    assert.equal((await receipts(p))[0].outcome, STALE)
    assert.deepEqual(await tools.protectedRow(word), before)
    assert.equal((await undo(p)).skipped, 0)
  }
})
test('a newer shared head and head ABA hold rollback even when personal fingerprints and content stay equal', async () => {
  for (const aba of [false, true]) {
    const { f, p, entry } = await applied(),
      revision = randomUUID()
    await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,
      content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
      SELECT '${revision}',entry_id,revision_no+1,schema_version,content,content_sha256,cefr_input_sha256,
      source_id,'published',NOW(),NOW() FROM public.dictionary_revisions WHERE revision_id='${entry.revision_id}';
      UPDATE public.dictionary_entry_heads SET revision_id='${revision}' WHERE entry_id='${entry.entry_id}';
      ${aba ? `UPDATE public.dictionary_entry_heads SET revision_id='${entry.revision_id}' WHERE entry_id='${entry.entry_id}';` : ''}`)
    const before = await tools.protectedRow(f.words[0])
    assert.equal((await undo(p)).skipped, 1)
    assert.deepEqual(await tools.protectedRow(f.words[0]), before)
  }
})
test('committed tombstone and hard deletion races skip without resurrection and preserve originals/receipts', async () => {
  for (const hard of [false, true]) {
    const { f, p, originals, applied: originalReceipts } = await applied(),
      word = f.words[0]
    const holder = await session(db)
    try {
      await holder.mark(
        `BEGIN; ${hard ? `DELETE FROM public.words WHERE word_id='${word}';` : `UPDATE public.words SET deleted_at=NOW() WHERE word_id='${word}';`}`
      )
      assert.equal((await undo(p)).busy, 1)
      assert.deepEqual(await receipts(p), [])
      await holder.finish('COMMIT')
      const deleted = await tools.protectedRow(word)
      assert.equal((await undo(p)).skipped, 1)
      assert.equal((await receipts(p))[0].outcome, 'source-unavailable')
      assert.deepEqual(await tools.protectedRow(word), deleted)
      assert.deepEqual(await tools.items(p), originals)
      assert.deepEqual(await tools.receipts(p), originalReceipts)
    } finally {
      await holder.finish()
    }
  }
})
test('concurrent accepted learning is busy until commit then preserved; rollback locks head until commit', async () => {
  const { f, p, entry } = await applied(),
    word = f.words[0]
  const learner = await session(db),
    worker = await session(db),
    publisher = await session(db)
  try {
    await learner.mark(`BEGIN; ${asUser(f.owner, rpc(assessment(word)))}`)
    assert.equal((await undo(p)).busy, 1)
    await learner.finish('COMMIT')
    const accepted = await state(db, word)
    await worker.mark(`BEGIN; ${sql(p)}`)
    assert.equal(worker.result().restored, 1)
    publisher.write(
      `UPDATE public.dictionary_entry_heads SET updated_at=NOW() WHERE entry_id='${entry.entry_id}';`
    )
    await publisher.waitLock(worker)
    await worker.finish('COMMIT')
    publisher.child.stdin.end()
    await publisher.completed
    const after = await state(db, word)
    assert.deepEqual(tools.baseWord(after.word), tools.baseWord(accepted.word))
    assert.deepEqual(after.events, accepted.events)
  } finally {
    await learner.finish()
    await worker.finish()
    await publisher.finish()
  }
})
test('two workers restore disjoint rows and concurrent same-batch callers replay one committed receipt', async () => {
  const { p } = await applied(4),
    first = await session(db),
    retry = await session(db)
  try {
    const request = sql(p, randomUUID(), 2)
    await first.mark(`BEGIN; ${request}`)
    assert.equal(first.result().restored, 2)
    assert.equal((await undo(p, randomUUID(), 2)).restored, 2)
    retry.write(request)
    await retry.waitLock(first)
    await first.finish('COMMIT')
    retry.child.stdin.end()
    await retry.completed
    assert.deepEqual(retry.result(), first.result())
    assert.equal((await receipts(p)).length, 4)
    assert.equal((await undo(p)).remaining, 0)
  } finally {
    await first.finish()
    await retry.finish()
  }
})
test('row and final batch receipt failures roll back compensation; identical intent resumes', async () => {
  for (const table of ['rollback_receipts', 'rollback_batches']) {
    const { f, p } = await applied(3),
      rows = await Promise.all(f.words.map(tools.protectedRow)),
      request = sql(p)
    const remove = await fault(
      p,
      table,
      "RAISE EXCEPTION 'synthetic-rollback-receipt-failure';"
    )
    try {
      await assert.rejects(
        db.sql(request),
        /synthetic-rollback-receipt-failure/
      )
      await unchanged(p, f, rows)
    } finally {
      await remove()
    }
    assert.equal(JSON.parse(await db.sql(request)).restored, 3)
  }
})
test('owned backend interruption after one provisional restoration leaves no partial rows; same batch resumes', async () => {
  const { f, p } = await applied(3),
    rows = await Promise.all(f.words.map(tools.protectedRow)),
    request = sql(p)
  const blocker = await session(db),
    worker = await session(db),
    key = Math.floor(Math.random() * 1000000000)
  const remove = await fault(
    p,
    'rollback_receipts',
    `IF (SELECT count(*) FROM ${TABLE}.rollback_receipts WHERE run_id=NEW.run_id)=1 THEN PERFORM pg_advisory_xact_lock(${key}); END IF;`
  )
  try {
    await blocker.mark(`BEGIN; SELECT pg_advisory_xact_lock(${key});`)
    worker.write(`BEGIN; ${request}`)
    await worker.waitLock(blocker)
    await worker.terminate()
    await blocker.finish('COMMIT')
    await unchanged(p, f, rows)
  } finally {
    await worker.finish()
    await blocker.finish()
    await remove()
  }
  assert.equal(JSON.parse(await db.sql(request)).restored, 3)
})
test('lost response after commit and later deletion return immutable result without another transition', async () => {
  const { f, p } = await applied(),
    worker = await session(db),
    request = sql(p)
  try {
    await worker.mark(`BEGIN; ${request} COMMIT;`)
    const result = worker.result(),
      before = await receipts(p)
    await worker.terminate()
    await db.sql(`DELETE FROM public.words WHERE word_id='${f.words[0]}';`)
    assert.deepEqual(JSON.parse(await db.sql(request)), result)
    assert.deepEqual(await receipts(p), before)
    assert.equal(await tools.protectedRow(f.words[0]), null)
  } finally {
    await worker.finish()
  }
})
test('default50/max100 bounds, request identity, disabled flags and immutable/admin-only receipts', async () => {
  const { p } = await applied(110),
    batch = randomUUID()
  const first = await undo(p, batch)
  assert.equal(first.restored, 50)
  assert.equal(first.remaining, 60)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled=FALSE,following_reads_enabled=FALSE;'
  )
  assert.deepEqual(await undo(p, batch), first)
  assert.equal((await undo(p, randomUUID(), 100)).restored, 60)
  await assert.rejects(undo(p, batch, 49), /rollback-intent-mismatch/)
  for (const limit of [0, 101, 'NULL'])
    await assert.rejects(
      undo(p, randomUUID(), limit),
      /invalid-rollback-request/
    )
  await assert.rejects(
    undo({ ...p, hash: 'f'.repeat(64) }),
    /reviewed-plan-required/
  )
  for (const role of ['anon', 'authenticated', 'service_role'])
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${sql(p)}`),
      /permission denied/
    )
  for (const table of ['rollback_batches', 'rollback_receipts']) {
    await assert.rejects(
      db.sql(
        `UPDATE ${TABLE}.${table} SET run_id=run_id WHERE run_id='${p.run}';`
      ),
      /immutable/
    )
    await assert.rejects(
      db.sql(`DELETE FROM ${TABLE}.${table} WHERE run_id='${p.run}';`),
      /immutable/
    )
    await assert.rejects(
      db.sql(`TRUNCATE ${TABLE}.${table};`),
      /immutable|foreign key/
    )
  }
  await tools.enable()
})
test('maximum resulting BIGINT is held instead of overflowing or rewinding version', async () => {
  const f = await tools.fixture(),
    word = f.words[0],
    original = await tools.content(word)
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
    VALUES('${word}','${f.owner}',9223372036854775806,${tools.json(original)});`)
  const entry = await tools.target(f, original),
    p = await tools.plan(f, { [word]: await tools.decision(f, word, entry) })
  await tools.apply(p)
  const before = await tools.protectedRow(word)
  assert.equal((await undo(p)).skipped, 1)
  assert.equal((await receipts(p))[0].outcome, 'content-version-exhausted')
  assert.deepEqual(await tools.protectedRow(word), before)
})
