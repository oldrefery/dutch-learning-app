import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { followingFixture } from './following-concurrency.fixture.mjs'
import { session } from './following-session.fixture.mjs'
import { asUser, assessment, rpc, state } from './fixtures.mjs'

let db, tools
before(async () => {
  db = await createCluster()
  for (const name of [
    'rehearsal.sql',
    'following-plan.sql',
    'following-apply.sql',
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
const table = 'dictionary_following_rehearsal'
const STALE_SOURCE = 'stale-source'
const hasNoWrites = async (p, f, beforeRows) => {
  assert.deepEqual(await tools.receipts(p), [])
  assert.deepEqual(
    await Promise.all(f.words.map(tools.protectedRow)),
    beforeRows
  )
}
const busy = result => {
  assert.equal(result.applied, 0)
  assert.equal(result.rejected, 0)
  assert.equal(result.busy, 1)
  assert.equal(result.remaining, 1)
}
async function publish(entry) {
  const newer = randomUUID()
  await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,
    content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
    SELECT '${newer}',entry_id,revision_no+1,schema_version,content,content_sha256,cefr_input_sha256,
      source_id,'published',NOW(),NOW() FROM public.dictionary_revisions WHERE revision_id='${entry.revision_id}';`)
  return `UPDATE public.dictionary_entry_heads SET revision_id='${newer}' WHERE entry_id='${entry.entry_id}';`
}

test('word, existing state and collection contention leave no receipt or false applied count; fresh batches resume', async () => {
  for (const kind of ['word', 'state', 'collection']) {
    const f = await tools.fixture()
    const word = f.words[0]
    if (kind === 'state')
      await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
      VALUES('${word}','${f.owner}',3,${tools.json(await tools.content(word))});`)
    const entry = await tools.target(f, await tools.content(word))
    const p = await tools.plan(f, {
      [word]: await tools.decision(f, word, entry),
    })
    const beforeRows = await Promise.all(f.words.map(tools.protectedRow))
    const locks = {
      word: `SELECT 1 FROM public.words WHERE word_id='${word}' FOR UPDATE;`,
      state: `SELECT 1 FROM public.word_content_state WHERE word_id='${word}' FOR UPDATE;`,
      collection: `SELECT 1 FROM public.collections WHERE collection_id='${f.collection}' FOR UPDATE;`,
    }
    const holder = await session(db)
    try {
      await holder.mark(`BEGIN; ${locks[kind]}`)
      const result = await tools.apply(p)
      busy(result.result)
      await hasNoWrites(p, f, beforeRows)
      await holder.finish('COMMIT')
      assert.deepEqual(JSON.parse(await db.sql(result.sql)), result.result)
      assert.equal((await tools.apply(p)).result.applied, 1)
      assert.equal((await tools.receipts(p)).length, 1)
    } finally {
      await holder.finish()
    }
  }
})

test('concurrent private content and placement edits are busy first and stale after commit without overwriting edits', async () => {
  for (const kind of ['content', 'placement']) {
    const { f, p } = await tools.reviewed()
    const word = f.words[0]
    const holder = await session(db)
    try {
      const sql =
        kind === 'content'
          ? `UPDATE public.words SET image_url='https://example.invalid/concurrent-private' WHERE word_id='${word}';`
          : `UPDATE public.words SET collection_id=NULL WHERE word_id='${word}';`
      await holder.mark(`BEGIN; ${sql}`)
      busy((await tools.apply(p)).result)
      assert.deepEqual(await tools.receipts(p), [])
      await holder.finish('COMMIT')
      const edited = await tools.protectedRow(word)
      assert.equal((await tools.apply(p)).result.rejected, 1)
      assert.equal((await tools.receipts(p))[0].outcome, STALE_SOURCE)
      assert.deepEqual(await tools.protectedRow(word), edited)
    } finally {
      await holder.finish()
    }
  }
})

test('concurrent state insert/update cannot cross the personal fingerprint fence', async () => {
  for (const existing of [false, true]) {
    const f = await tools.fixture()
    const word = f.words[0]
    const value = await tools.content(word)
    if (existing)
      await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
      VALUES('${word}','${f.owner}',4,${tools.json(value)});`)
    const entry = await tools.target(f, value)
    const p = await tools.plan(f, {
      [word]: await tools.decision(f, word, entry),
    })
    const holder = await session(db)
    try {
      const sql = existing
        ? `UPDATE public.word_content_state SET content_version=5 WHERE word_id='${word}';`
        : `INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content) VALUES('${word}','${f.owner}',5,${tools.json(value)});`
      await holder.mark(`BEGIN; ${sql}`)
      busy((await tools.apply(p)).result)
      await holder.finish('COMMIT')
      const beforeRows = await Promise.all(f.words.map(tools.protectedRow))
      assert.equal((await tools.apply(p)).result.rejected, 1)
      assert.equal((await tools.receipts(p))[0].outcome, STALE_SOURCE)
      assert.deepEqual(
        await Promise.all(f.words.map(tools.protectedRow)),
        beforeRows
      )
      assert.equal(
        await db.sql(
          `SELECT content_version FROM public.word_content_state WHERE word_id='${word}';`
        ),
        '5'
      )
    } finally {
      await holder.finish()
    }
  }
})

test('apply holds absent-state insertion behind its transaction and rejects the losing private insert after commit', async () => {
  const { f, p } = await tools.reviewed()
  const word = f.words[0],
    value = await tools.content(word)
  const worker = await session(db),
    writer = await session(db)
  try {
    await worker.mark(`BEGIN; ${tools.applySql(p, randomUUID())}`)
    assert.equal(worker.result().applied, 1)
    writer.write(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
      VALUES('${word}','${f.owner}',77,${tools.json(value)});`)
    await writer.waitLock(worker)
    await worker.finish('COMMIT')
    writer.child.stdin.end()
    await assert.rejects(
      writer.completed,
      /duplicate key|following-content-cannot-have-overrides/
    )
    assert.equal(
      await db.sql(
        `SELECT content_version FROM public.word_content_state WHERE word_id='${word}';`
      ),
      '1'
    )
    assert.equal(
      (await tools.protectedRow(word)).dictionary_content_mode,
      'follow'
    )
    assert.equal((await tools.receipts(p)).length, 1)
  } finally {
    await worker.finish()
    await writer.finish()
  }
})

test('concurrent published head change is retryable while locked and terminal stale once committed', async () => {
  const { f, entry, p } = await tools.reviewed()
  const holder = await session(db)
  try {
    await holder.mark(`BEGIN; ${await publish(entry)}`)
    busy((await tools.apply(p)).result)
    assert.deepEqual(await tools.receipts(p), [])
    await holder.finish('COMMIT')
    assert.equal((await tools.apply(p)).result.rejected, 1)
    assert.equal((await tools.receipts(p))[0].outcome, 'stale-target')
    assert.equal(
      (await tools.protectedRow(f.words[0])).dictionary_content_mode,
      'legacy'
    )
  } finally {
    await holder.finish()
  }
})

test('apply locks published head and capabilities until commit; later changes cannot rewrite its accepted receipt', async () => {
  const { entry, p } = await tools.reviewed()
  const worker = await session(db),
    publisher = await session(db),
    disabler = await session(db)
  try {
    const publishSql = await publish(entry)
    const batch = randomUUID(),
      sql = tools.applySql(p, batch)
    await worker.mark(`BEGIN; ${sql}`)
    const result = worker.result()
    publisher.write(publishSql)
    disabler.write(
      'UPDATE private.dictionary_content_runtime SET following_reads_enabled=FALSE WHERE singleton;'
    )
    await publisher.waitLock(worker)
    await disabler.waitLock(worker)
    await worker.finish('COMMIT')
    publisher.child.stdin.end()
    disabler.child.stdin.end()
    await publisher.completed
    await disabler.completed
    assert.deepEqual(JSON.parse(await db.sql(sql)), result)
    assert.equal(
      (await tools.receipts(p))[0].target_head_sequence,
      entry.sequence
    )
    await assert.rejects(tools.apply(p), /cutover-capabilities-required/)
  } finally {
    await worker.finish()
    await publisher.finish()
    await disabler.finish()
    await tools.enable()
  }
})

test('concurrent tombstone and hard deletion do not resurrect cards and retain original plans', async () => {
  for (const hard of [false, true]) {
    const { f, p } = await tools.reviewed()
    const word = f.words[0],
      original = await tools.items(p)
    const holder = await session(db)
    try {
      const sql = hard
        ? `DELETE FROM public.words WHERE word_id='${word}';`
        : `UPDATE public.words SET deleted_at=NOW() WHERE word_id='${word}';`
      await holder.mark(`BEGIN; ${sql}`)
      busy((await tools.apply(p)).result)
      await holder.finish('COMMIT')
      const afterDelete = await tools.protectedRow(word)
      assert.equal((await tools.apply(p)).result.rejected, 1)
      assert.equal(
        (await tools.receipts(p))[0].outcome,
        hard ? 'source-unavailable' : STALE_SOURCE
      )
      assert.deepEqual(await tools.protectedRow(word), afterDelete)
      assert.deepEqual(await tools.items(p), original)
    } finally {
      await holder.finish()
    }
  }
})

test('actual accepted review event wins contention and its learning/history survive apply and same-event retry', async () => {
  const { f, p } = await tools.reviewed()
  const word = f.words[0],
    hash = await tools.source(word)
  const input = assessment(word, {
    at: '2026-10-11T12:00:00Z',
    date: '2026-10-11',
  })
  const learner = await session(db)
  try {
    await learner.mark(`BEGIN; ${asUser(f.owner, rpc(input))}`)
    busy((await tools.apply(p)).result)
    await learner.finish('COMMIT')
    const accepted = await state(db, word)
    assert.equal(accepted.events.length, 1)
    assert.equal(await tools.source(word), hash)
    assert.equal((await tools.apply(p)).result.applied, 1)
    const applied = await state(db, word)
    assert.deepEqual(
      tools.baseWord(applied.word),
      tools.baseWord(accepted.word)
    )
    assert.deepEqual(applied.events, accepted.events)
    await db.sql(asUser(f.owner, rpc(input)))
    assert.deepEqual(await state(db, word), applied)
  } finally {
    await learner.finish()
  }
})

test('overlapping workers process disjoint bounded items and replays never double-apply', async () => {
  const { f, p } = await tools.reviewed(4)
  const worker = await session(db)
  try {
    const firstSql = tools.applySql(p, randomUUID(), 2)
    await worker.mark(`BEGIN; ${firstSql}`)
    assert.equal(worker.result().applied, 2)
    const second = await tools.apply(p, 2)
    assert.equal(second.result.applied, 2)
    assert.equal((await tools.receipts(p)).length, 2)
    await worker.finish('COMMIT')
    assert.equal((await tools.receipts(p)).length, 4)
    assert.equal((await tools.apply(p)).result.remaining, 0)
    for (const sql of [firstSql, second.sql])
      assert.equal(JSON.parse(await db.sql(sql)).applied, 2)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM public.word_content_state WHERE word_id=ANY(ARRAY[${f.words.map(x => `'${x}'`).join(',')}]::UUID[]) AND content_version=1;`
      ),
      '4'
    )
  } finally {
    await worker.finish()
  }
})

test('same batch concurrent callers wait for its receipt and receive one identical committed result', async () => {
  const { p } = await tools.reviewed(2)
  const first = await session(db),
    retry = await session(db)
  try {
    const sql = tools.applySql(p, randomUUID())
    await first.mark(`BEGIN; ${sql}`)
    const result = first.result()
    retry.write(sql)
    await retry.waitLock(first)
    await first.finish('COMMIT')
    retry.child.stdin.end()
    await retry.completed
    assert.deepEqual(retry.result(), result)
    assert.equal((await tools.receipts(p)).length, 2)
  } finally {
    await first.finish()
    await retry.finish()
  }
})

async function faultTrigger(p, relation, body) {
  const name = `qa_fault_${randomUUID().replaceAll('-', '')}`
  await db.sql(`CREATE FUNCTION ${table}.${name}() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN IF NEW.run_id='${p.run}' THEN ${body} END IF; RETURN NEW; END; $$;
    CREATE TRIGGER ${name} BEFORE INSERT ON ${table}.${relation} FOR EACH ROW EXECUTE FUNCTION ${table}.${name}();`)
  let removed = false
  return async () => {
    if (removed) return
    await db.sql(
      `DROP TRIGGER ${name} ON ${table}.${relation}; DROP FUNCTION ${table}.${name}();`
    )
    removed = true
  }
}

test('receipt insertion lock failure rolls back personal writes and reports busy without terminal receipt', async () => {
  const { f, p } = await tools.reviewed()
  const beforeRows = await Promise.all(f.words.map(tools.protectedRow))
  const remove = await faultTrigger(
    p,
    'apply_receipts',
    "RAISE EXCEPTION 'synthetic-receipt-lock' USING ERRCODE='55P03';"
  )
  try {
    const result = await tools.apply(p)
    busy(result.result)
    await hasNoWrites(p, f, beforeRows)
    await remove()
    assert.deepEqual(JSON.parse(await db.sql(result.sql)), result.result)
    assert.equal((await tools.apply(p)).result.applied, 1)
  } finally {
    await remove()
  }
})

test('failed final batch receipt cannot commit any partial row and the same UUID resumes after the fault', async () => {
  const { f, p } = await tools.reviewed(3)
  const beforeRows = await Promise.all(f.words.map(tools.protectedRow))
  const batch = randomUUID(),
    sql = tools.applySql(p, batch)
  const remove = await faultTrigger(
    p,
    'apply_batches',
    "RAISE EXCEPTION 'synthetic-batch-receipt-failure';"
  )
  try {
    await assert.rejects(db.sql(sql), /synthetic-batch-receipt-failure/)
    await hasNoWrites(p, f, beforeRows)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM ${table}.apply_batches WHERE batch_id='${batch}';`
      ),
      '0'
    )
  } finally {
    await remove()
  }
  assert.equal(JSON.parse(await db.sql(sql)).applied, 3)
})

test('terminating an owned backend midway through a multi-row batch leaves no partial writes and same batch resumes', async () => {
  const { f, p } = await tools.reviewed(3)
  const beforeRows = await Promise.all(f.words.map(tools.protectedRow))
  const blocker = await session(db),
    worker = await session(db)
  const key = Math.floor(Math.random() * 1000000000),
    batch = randomUUID()
  const sql = tools.applySql(p, batch)
  const remove = await faultTrigger(
    p,
    'apply_receipts',
    `IF (SELECT count(*) FROM ${table}.apply_receipts WHERE run_id=NEW.run_id)=1 THEN PERFORM pg_advisory_xact_lock(${key}); END IF;`
  )
  try {
    await blocker.mark(`BEGIN; SELECT pg_advisory_xact_lock(${key});`)
    worker.write(`BEGIN; ${sql}`)
    await worker.waitLock(blocker)
    await worker.terminate()
    await blocker.finish('COMMIT')
    await hasNoWrites(p, f, beforeRows)
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM ${table}.apply_batches WHERE batch_id='${batch}';`
      ),
      '0'
    )
  } finally {
    await worker.finish()
    await blocker.finish()
    await remove()
  }
  assert.equal(JSON.parse(await db.sql(sql)).applied, 3)
})

test('connection loss after commit returns the durable batch receipt without a second transition', async () => {
  const { p } = await tools.reviewed(2)
  const worker = await session(db)
  try {
    const sql = tools.applySql(p, randomUUID())
    await worker.mark(`BEGIN; ${sql} COMMIT;`)
    const result = worker.result(),
      before = await tools.receipts(p)
    await worker.terminate()
    assert.deepEqual(JSON.parse(await db.sql(sql)), result)
    assert.deepEqual(await tools.receipts(p), before)
  } finally {
    await worker.finish()
  }
})
