import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { literal } from './fixtures.mjs'

const json = value => `${literal(JSON.stringify(value))}::jsonb`
const inventoryHash = 'a'.repeat(64)
const EXACT_LINK = 'exact-link'
const DIFF_LINK = 'approved-diff-link'
let db
before(async () => {
  db = await createCluster()
  for (const name of [
    'rehearsal.sql',
    'following-plan.sql',
    'following-apply.sql',
  ]) {
    await db.sql(
      await readFile(
        new URL(`../shared-dictionary/${name}`, import.meta.url),
        'utf8'
      )
    )
  }
})
after(async () => {
  await db?.close()
})

async function fixture(count = 1) {
  const owner = randomUUID()
  const words = []
  await db.sql(
    `INSERT INTO auth.users(id,email) VALUES ('${owner}','${owner}@example.invalid');`
  )
  const collection = await db.sql(
    `INSERT INTO public.collections(user_id,name) VALUES ('${owner}','Synthetic following migration') RETURNING collection_id;`
  )
  const ids =
    await db.sql(`INSERT INTO public.words(word_id,user_id,collection_id,dutch_lemma,part_of_speech,article,translations,tts_url,
    interval_days,repetition_count,easiness_factor,next_review_date)
    SELECT gen_random_uuid(),'${owner}','${collection}',gen_random_uuid()::TEXT,'noun','de','{"en":["synthetic"],"ru":[]}','',7,8,2.35,'2026-10-11'
    FROM generate_series(1,${count}) RETURNING word_id;`)
  words.push(...ids.split('\n'))
  return { owner, words, collection }
}
const content = async word =>
  JSON.parse(
    await db.sql(
      `SELECT dictionary_following_rehearsal.content(w) FROM public.words w WHERE word_id='${word}';`
    )
  )
const source = async word =>
  await db.sql(
    `SELECT dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w)) FROM public.words w WHERE word_id='${word}';`
  )
const sha = async value =>
  await db.sql(`SELECT dictionary_rehearsal.canonical_sha256(${json(value)});`)
async function target(f, value) {
  const sourceId = randomUUID()
  const contentHash = await sha(value)
  await db.sql(`INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,review_state,reviewed_by,reviewed_at,approved_content_sha256)
    VALUES ('${sourceId}','first_party','fixture://following-plan/${sourceId}','approved','${f.owner}',NOW(),'${contentHash}');`)
  const result = JSON.parse(
    await db.sql(`SELECT dictionary_rehearsal.seed_official('${randomUUID()}','${'b'.repeat(64)}',
    '${randomUUID()}',${json(value)},'${contentHash}',dictionary_rehearsal.canonical_sha256(jsonb_build_object('assessment_schema_version',1,'content',${json(value)} - ARRAY['image_url','tts_url'])),'${sourceId}');`)
  )
  return {
    ...result,
    content: value,
    hash: contentHash,
    sequence: await db.sql(
      `SELECT dictionary_following_rehearsal.head_sequence('${result.entry_id}');`
    ),
  }
}
async function decision(f, word, entry, disposition = EXACT_LINK) {
  const original = await content(word)
  return {
    owner_id: f.owner,
    source_sha256: await source(word),
    source_content_sha256: await sha(original),
    target_entry_id: entry.entry_id,
    target_revision_id: entry.revision_id,
    target_head_sequence: entry.sequence,
    target_content_sha256: entry.hash,
    disposition,
    meaning_review: {
      review_id: randomUUID(),
      reviewer_id: f.owner,
      reviewed_at: '2026-10-11T12:00:00Z',
      evidence_sha256: 'c'.repeat(64),
    },
    approved_diff: JSON.parse(
      await db.sql(
        `SELECT dictionary_following_rehearsal.content_diff(${json(original)},${json(entry.content)});`
      )
    ),
  }
}
function planSql(
  f,
  decisions = {},
  run = randomUUID(),
  count = f.words.length
) {
  return {
    run,
    sql: `SELECT dictionary_following_rehearsal.plan('${run}',ARRAY['${f.owner}']::UUID[],${count},'${inventoryHash}',${json(decisions)});`,
  }
}
const plan = async (...args) => {
  const p = planSql(...args)
  return { ...p, hash: await db.sql(p.sql) }
}
const items = async p =>
  JSON.parse(
    await db.sql(
      `SELECT jsonb_agg(to_jsonb(i) ORDER BY word_id) FROM dictionary_following_rehearsal.items i WHERE run_id='${p.run}';`
    )
  )
const protectedRow = async word =>
  JSON.parse(
    (await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id='${word}';`
    )) || 'null'
  )

const APPLY = 'SELECT dictionary_following_rehearsal.apply'
const enable = async () =>
  db.sql(`UPDATE private.dictionary_content_runtime SET operations_enabled=TRUE,reads_enabled=TRUE,
    legacy_guard_enabled=TRUE,following_reads_enabled=TRUE WHERE singleton;`)
const receipts = async p =>
  JSON.parse(
    await db.sql(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY word_id),'[]')
    FROM dictionary_following_rehearsal.apply_receipts x WHERE run_id='${p.run}';`)
  )
const apply = async (p, limit, batch = randomUUID(), hash = p.hash) => {
  const sql = `${APPLY}('${p.run}','${hash}','${batch}'${limit === undefined ? '' : `,${limit}`});`
  return { batch, sql, result: JSON.parse(await db.sql(sql)) }
}
const baseWord = word => {
  const {
    dictionary_entry_id,
    dictionary_revision_id,
    dictionary_content_mode,
    updated_at,
    ...rest
  } = word
  assert.ok(
    dictionary_content_mode === 'legacy' || dictionary_content_mode === 'follow'
  )
  return rest
}
async function reviewed(count = 1, change = {}) {
  const f = await fixture(count)
  const entry = await target(f, { ...(await content(f.words[0])), ...change })
  // All positive decisions are artificial operator attestations on synthetic aliases.
  // They test binding/full-diff mechanics, not human meaning approval.
  const decisions = JSON.parse(
    await db.sql(`SELECT jsonb_object_agg(w.word_id::TEXT,
    jsonb_build_object('owner_id',w.user_id,'source_sha256',dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w)),
      'source_content_sha256',dictionary_rehearsal.canonical_sha256(dictionary_following_rehearsal.content(w)),
      'target_entry_id','${entry.entry_id}','target_revision_id','${entry.revision_id}',
      'target_head_sequence','${entry.sequence}','target_content_sha256','${entry.hash}',
      'disposition',CASE WHEN dictionary_following_rehearsal.content(w)=${json(entry.content)} THEN '${EXACT_LINK}' ELSE '${DIFF_LINK}' END,
      'meaning_review',jsonb_build_object('review_id',gen_random_uuid(),'reviewer_id',w.user_id,
        'reviewed_at','2026-10-11T12:00:00Z','evidence_sha256','${'c'.repeat(64)}'),
      'approved_diff',dictionary_following_rehearsal.content_diff(dictionary_following_rehearsal.content(w),${json(entry.content)})))
    FROM public.words w WHERE w.user_id='${f.owner}';`)
  )
  const p = await plan(f, decisions)
  return { f, entry, p }
}

test('exact apply preserves every raw personal field and learning row with immutable exact result fingerprints', async () => {
  await enable()
  const { f, entry, p } = await reviewed()
  const word = f.words[0]
  const before = await protectedRow(word)
  const original = await items(p)
  const result = await apply(p)
  assert.equal(result.result.applied, 1)
  assert.equal(result.result.remaining, 0)
  const after = await protectedRow(word)
  assert.deepEqual(baseWord(after), baseWord(before))
  assert.equal(after.dictionary_content_mode, 'follow')
  assert.equal(after.dictionary_entry_id, entry.entry_id)
  assert.equal(after.dictionary_revision_id, entry.revision_id)
  const [receipt] = await receipts(p)
  assert.equal(receipt.outcome, 'applied')
  assert.equal(receipt.resulting_content_version, '1')
  assert.equal(receipt.target_head_sequence, entry.sequence)
  assert.equal(receipt.result_sha256, await source(word))
  assert.deepEqual(await items(p), original)
  assert.deepEqual(await content(word), entry.content)
})

test('approved media/private diffs retain private originals and clear following overrides with a single content version bump', async () => {
  const f = await fixture()
  const word = f.words[0]
  const legacy = await content(word)
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
    VALUES('${word}','${f.owner}',41,${json(legacy)},'{}');`)
  const entry = await target(f, {
    ...legacy,
    image_url: 'https://example.invalid/shared-image',
    usage_notes: { en: 'Synthetic shared note', ru: '' },
  })
  const input = await decision(f, word, entry, DIFF_LINK)
  const p = await plan(f, { [word]: input })
  const original = await items(p)
  const before = await protectedRow(word)
  await apply(p)
  assert.deepEqual(baseWord(await protectedRow(word)), baseWord(before))
  assert.deepEqual(await items(p), original)
  assert.deepEqual(await content(word), entry.content)
  const state = JSON.parse(
    await db.sql(
      `SELECT to_jsonb(s) FROM public.word_content_state s WHERE word_id='${word}';`
    )
  )
  assert.equal(state.content_version, 42)
  assert.equal(state.fallback_content, null)
  assert.deepEqual(state.overrides, {})
  assert.equal((await receipts(p))[0].resulting_content_version, '42')
})

test('default50 and maximum100 bound new work; batches and per-row receipts are idempotent', async () => {
  const { f, p } = await reviewed(110)
  const first = await apply(p)
  assert.equal(first.result.applied, 50)
  assert.equal(first.result.remaining, 60)
  const before = await receipts(p)
  assert.deepEqual(JSON.parse(await db.sql(first.sql)), first.result)
  assert.deepEqual(await receipts(p), before)
  const second = await apply(p, 100)
  assert.equal(second.result.applied, 60)
  assert.equal(second.result.remaining, 0)
  assert.equal((await receipts(p)).length, f.words.length)
  assert.equal((await apply(p)).result.applied, 0)
  await assert.rejects(apply(p, 49, first.batch), /batch-intent-mismatch/)
  for (const limit of [0, 101, 'NULL'])
    await assert.rejects(apply(p, limit), /invalid-apply-request/)
})

test('wrong plan, unknown run and disabled gates cannot write; completed batch retry survives disabled gates', async () => {
  const { f, p } = await reviewed()
  const before = await protectedRow(f.words[0])
  await assert.rejects(
    apply(p, 50, randomUUID(), 'd'.repeat(64)),
    /reviewed-plan-required/
  )
  await assert.rejects(
    apply({ ...p, run: randomUUID() }),
    /reviewed-plan-required/
  )
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET following_reads_enabled=FALSE;'
  )
  await assert.rejects(apply(p), /cutover-capabilities-required/)
  assert.deepEqual(await protectedRow(f.words[0]), before)
  assert.deepEqual(await receipts(p), [])
  await enable()
  const accepted = await apply(p)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET operations_enabled=FALSE;'
  )
  assert.deepEqual(JSON.parse(await db.sql(accepted.sql)), accepted.result)
  await enable()
})

test('ambiguous missing private stale and excluded rows stay legacy without apply receipts', async () => {
  const f = await fixture(5)
  const entry = await target(f, await content(f.words[0]))
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,fallback_content)
    VALUES('${f.words[1]}','${f.owner}',${json(await content(f.words[1]))});
    UPDATE public.words SET deleted_at=NOW() WHERE word_id='${f.words[2]}';`)
  const input = await decision(f, f.words[4], entry, DIFF_LINK)
  input.source_sha256 = 'f'.repeat(64)
  const p = await plan(f, { [f.words[4]]: input })
  const before = await Promise.all(f.words.map(protectedRow))
  assert.equal((await apply(p)).result.applied, 0)
  assert.deepEqual(await receipts(p), [])
  assert.deepEqual(await Promise.all(f.words.map(protectedRow)), before)
})

test('changed personal content placement or deletion is held without overwriting the current word', async () => {
  for (const kind of ['content', 'placement', 'tombstone', 'delete']) {
    const { f, p } = await reviewed()
    const word = f.words[0]
    const changes = {
      content: `UPDATE public.words SET image_url='https://example.invalid/new-private-image' WHERE word_id='${word}';`,
      placement: `UPDATE public.words SET collection_id=NULL WHERE word_id='${word}';`,
      tombstone: `UPDATE public.words SET deleted_at=NOW() WHERE word_id='${word}';`,
      delete: `DELETE FROM public.words WHERE word_id='${word}';`,
    }
    await db.sql(changes[kind])
    const before = await protectedRow(word)
    assert.equal((await apply(p)).result.rejected, 1)
    const [receipt] = await receipts(p)
    assert.equal(
      receipt.outcome,
      kind === 'delete' ? 'source-unavailable' : 'stale-source'
    )
    assert.equal(receipt.result_snapshot, null)
    assert.deepEqual(await protectedRow(word), before)
    assert.equal((await apply(p)).result.rejected, 0)
  }
})

test('immutable source guards and withdrawn entry or head ABA sequence protect reviewed targets', async () => {
  for (const kind of ['source', 'entry', 'head']) {
    const { f, entry, p } = await reviewed()
    if (kind === 'source') {
      await assert.rejects(
        db.sql(
          `UPDATE private.dictionary_sources SET review_state='rejected' WHERE source_id=(SELECT source_id FROM public.dictionary_revisions WHERE revision_id='${entry.revision_id}');`
        ),
        /provenance is immutable/
      )
      assert.equal((await apply(p)).result.applied, 1)
      continue
    }
    if (kind === 'entry')
      await db.sql(
        `UPDATE public.dictionary_entries SET state='retired' WHERE entry_id='${entry.entry_id}';`
      )
    if (kind === 'head') {
      const newer = randomUUID()
      await db.sql(`INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,
          content,content_sha256,cefr_input_sha256,source_id,review_status,reviewed_at,published_at)
        SELECT '${newer}',entry_id,revision_no+1,schema_version,content,content_sha256,
          cefr_input_sha256,source_id,'published',NOW(),NOW() FROM public.dictionary_revisions WHERE revision_id='${entry.revision_id}';
        UPDATE public.dictionary_entry_heads SET revision_id='${newer}' WHERE entry_id='${entry.entry_id}';
        UPDATE public.dictionary_entry_heads SET revision_id='${entry.revision_id}' WHERE entry_id='${entry.entry_id}';`)
      assert.notEqual(
        await db.sql(
          `SELECT dictionary_following_rehearsal.head_sequence('${entry.entry_id}');`
        ),
        entry.sequence
      )
    }
    const before = await protectedRow(f.words[0])
    assert.equal((await apply(p)).result.rejected, 1)
    assert.equal((await receipts(p))[0].outcome, 'stale-target')
    assert.deepEqual(await protectedRow(f.words[0]), before)
  }
})

test('later learning is not a stale-content conflict and all accepted learning values survive apply', async () => {
  const { f, p } = await reviewed()
  const word = f.words[0]
  const originalHash = await source(word)
  await db.sql(`UPDATE public.words SET repetition_count=37,interval_days=90,easiness_factor=2.75,
    last_reviewed_at='2026-10-11T13:00:00Z',next_review_date='2027-01-09' WHERE word_id='${word}';`)
  assert.equal(await source(word), originalHash)
  const before = await protectedRow(word)
  assert.equal((await apply(p)).result.applied, 1)
  assert.deepEqual(baseWord(await protectedRow(word)), baseWord(before))
})

test('exact large versions remain decimal strings and maximum BIGINT is a hold rather than overflow', async () => {
  for (const version of ['9007199254740993', '9223372036854775807']) {
    const f = await fixture()
    const word = f.words[0]
    await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content)
      VALUES('${word}','${f.owner}',${version},${json(await content(word))});`)
    const entry = await target(f, await content(word))
    const p = await plan(f, { [word]: await decision(f, word, entry) })
    const result = await apply(p)
    const [receipt] = await receipts(p)
    if (version === '9007199254740993') {
      assert.equal(result.result.applied, 1)
      assert.equal(receipt.resulting_content_version, '9007199254740994')
      assert.equal(
        await db.sql(
          `SELECT result_snapshot#>>'{state,content_version}' FROM dictionary_following_rehearsal.apply_receipts WHERE run_id='${p.run}';`
        ),
        '9007199254740994'
      )
    } else {
      assert.equal(result.result.rejected, 1)
      assert.equal(receipt.outcome, 'content-version-exhausted')
      assert.equal(
        await db.sql(
          `SELECT content_version::TEXT FROM public.word_content_state WHERE word_id='${word}';`
        ),
        version
      )
    }
  }
})

test('receipts are append-only and survive deletion; ordinary roles cannot read or execute operator apply', async () => {
  const { f, p } = await reviewed()
  const result = await apply(p)
  const before = await receipts(p)
  await db.sql(`DELETE FROM public.words WHERE word_id='${f.words[0]}';`)
  assert.deepEqual(await receipts(p), before)
  assert.deepEqual(JSON.parse(await db.sql(result.sql)), result.result)
  for (const table of ['apply_batches', 'apply_receipts']) {
    for (const mutation of [
      `DELETE FROM dictionary_following_rehearsal.${table};`,
      `TRUNCATE dictionary_following_rehearsal.${table} CASCADE;`,
    ])
      await assert.rejects(db.sql(mutation), /append-only/)
    for (const role of ['anon', 'authenticated', 'service_role'])
      await assert.rejects(
        db.sql(
          `SET ROLE ${role}; SELECT * FROM dictionary_following_rehearsal.${table};`
        ),
        /permission denied/
      )
  }
  for (const role of ['anon', 'authenticated', 'service_role'])
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${result.sql}`),
      /permission denied/
    )
  const summary = await db.sql(
    `SELECT dictionary_following_rehearsal.apply_report('${p.run}');`
  )
  assert.ok(!summary.includes(f.owner) && !summary.includes(f.words[0]))
  assert.equal(JSON.parse(summary).outcomes.applied, 1)
})

test('transaction rollback leaves neither personal transitions nor row or batch receipts; same batch intent can resume', async () => {
  const { f, p } = await reviewed(2)
  const before = await Promise.all(f.words.map(protectedRow))
  const batch = randomUUID()
  const sql = `${APPLY}('${p.run}','${p.hash}','${batch}');`
  await db.sql(`BEGIN; ${sql} ROLLBACK;`)
  assert.deepEqual(await Promise.all(f.words.map(protectedRow)), before)
  assert.deepEqual(await receipts(p), [])
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM dictionary_following_rehearsal.apply_batches WHERE batch_id='${batch}';`
    ),
    '0'
  )
  assert.equal(JSON.parse(await db.sql(sql)).applied, 2)
})
