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
  for (const name of ['rehearsal.sql', 'following-plan.sql']) {
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
  for (let n = 0; n < count; n++) {
    const word = randomUUID()
    words.push(word)
    await db.sql(`INSERT INTO public.words(word_id,user_id,collection_id,dutch_lemma,part_of_speech,article,translations,tts_url,
      interval_days,repetition_count,easiness_factor,next_review_date)
      VALUES ('${word}','${owner}','${collection}','${word}','noun','de','{"en":["synthetic"],"ru":[]}','',7,8,2.35,'2026-10-11');`)
  }
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
const report = async p =>
  JSON.parse(
    await db.sql(`SELECT dictionary_following_rehearsal.report('${p.run}');`)
  )
const protectedRow = async word =>
  JSON.parse(
    await db.sql(
      `SELECT to_jsonb(w) FROM public.words w WHERE word_id='${word}';`
    )
  )

test('same spelling and even exact complete content stay ambiguous without meaning evidence', async () => {
  const f = await fixture()
  await target(f, await content(f.words[0]))
  const before = await protectedRow(f.words[0])
  const p = await plan(f)
  assert.equal((await items(p))[0].disposition, 'ambiguous')
  assert.equal((await report(p)).eligible_links, 0)
  assert.equal((await report(p)).applied, 0)
  assert.deepEqual(await protectedRow(f.words[0]), before)
})

test('covers missing, private and tombstone rows while preserving protected originals', async () => {
  const f = await fixture(3)
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
    VALUES ('${f.words[1]}','${f.owner}',7,${json(await content(f.words[1]))},'{}');
    UPDATE public.words SET deleted_at=NOW() WHERE word_id='${f.words[2]}';`)
  const before = await Promise.all(f.words.map(protectedRow))
  const p = await plan(f)
  assert.deepEqual((await report(p)).dispositions, {
    excluded: 1,
    missing: 1,
    'private-review': 1,
  })
  assert.deepEqual(await Promise.all(f.words.map(protectedRow)), before)
  const originals = await items(p)
  assert.ok(
    originals.every(x => x.original_snapshot.word.word_id === x.word_id)
  )
  const privateItem = originals.find(x => x.word_id === f.words[1])
  assert.equal(privateItem.original_snapshot.state.content_version, 7)
  assert.deepEqual(
    privateItem.original_snapshot.state.fallback_content,
    await content(f.words[1])
  )
})

test('malformed legacy content is preserved for private review rather than dropped', async () => {
  const f = await fixture()
  await db.sql(
    `UPDATE public.words SET translations='{"en":42}' WHERE word_id='${f.words[0]}';`
  )
  const p = await plan(f)
  const [item] = await items(p)
  assert.equal(item.disposition, 'private-review')
  assert.deepEqual(item.original_snapshot.word.translations, { en: 42 })
})

test('binds exact linking to immutable source, complete content, head sequence and operator-attested review', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  const p = await plan(f, { [word]: input })
  const [item] = await items(p)
  assert.equal(item.disposition, EXACT_LINK)
  assert.equal(item.target_head_sequence, entry.sequence)
  assert.equal(item.original_content_sha256, input.source_content_sha256)
  assert.equal(item.decision_sha256, await sha(input))
  assert.deepEqual(item.approved_diff, {})
  assert.equal((await report(p)).eligible_links, 1)
  assert.equal((await protectedRow(word)).dictionary_entry_id, null)
})

test('requires the exact approved field diff including media and null changes', async () => {
  const f = await fixture()
  const word = f.words[0]
  const original = await content(word)
  const entry = await target(f, {
    ...original,
    translations: { en: ['approved common meaning'], ru: [] },
    image_url: 'https://example.invalid/shared.png',
    usage_notes: { en: 'Shared usage', ru: '' },
  })
  const input = await decision(f, word, entry, DIFF_LINK)
  assert.deepEqual(Object.keys(input.approved_diff).sort(), [
    'image_url',
    'translations',
    'usage_notes',
  ])
  const p = await plan(f, { [word]: input })
  assert.equal((await items(p))[0].disposition, DIFF_LINK)
  assert.deepEqual((await items(p))[0].original_content, original)
  const withoutMedia = { ...input.approved_diff }
  delete withoutMedia.image_url
  await assert.rejects(
    plan(f, { [word]: { ...input, approved_diff: withoutMedia } }),
    /full-content-diff-required/
  )
  await assert.rejects(
    plan(f, { [word]: { ...input, disposition: EXACT_LINK } }),
    /full-content-diff-required/
  )
})

test('existing private content is never published and may only be proposed through explicit complete diff review', async () => {
  const f = await fixture()
  const word = f.words[0]
  const original = await content(word)
  const entry = await target(f, original)
  const privateContent = {
    ...original,
    translations: { en: ['private original'], ru: [] },
    analysis_notes: 'Private history',
  }
  await db.sql(`INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
    VALUES ('${word}','${f.owner}',9,${json(privateContent)},'{}');`)
  const input = await decision(f, word, entry, DIFF_LINK)
  const p = await plan(f, { [word]: input })
  assert.deepEqual((await items(p))[0].original_content, privateContent)
  assert.deepEqual(
    JSON.parse(
      await db.sql(
        `SELECT content FROM public.dictionary_revisions WHERE revision_id='${entry.revision_id}';`
      )
    ),
    original
  )
})

test('rejects incomplete, owner-mismatched and out-of-scope review packets atomically', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  const incomplete = { ...input }
  delete incomplete.meaning_review
  for (const invalid of [
    incomplete,
    { ...input, target_head_sequence: Number(entry.sequence) },
    { ...input, source_sha256: 'bad' },
    { ...input, meaning_review: { reviewed: true } },
  ]) {
    await assert.rejects(plan(f, { [word]: invalid }), /meaning-decision/)
  }
  await assert.rejects(
    plan(f, { [word]: { ...input, owner_id: randomUUID() } }),
    /owner-mismatch/
  )
  await assert.rejects(plan(f, { [randomUUID()]: input }), /out-of-scope/)
})

test('changed source, target hash and exact publication sequence become explicit stale holds', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  for (const delta of [
    { source_sha256: 'd'.repeat(64) },
    { source_content_sha256: 'd'.repeat(64) },
    { target_content_sha256: 'd'.repeat(64) },
    { target_head_sequence: String(BigInt(entry.sequence) + 1n) },
    { target_revision_id: randomUUID() },
  ]) {
    const p = await plan(f, { [word]: { ...input, ...delta } })
    assert.equal((await items(p))[0].disposition, 'stale')
    assert.equal((await report(p)).eligible_links, 0)
  }
})

test('new learning changes no content fingerprint and planning never rewrites learning', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  await db.sql(
    `UPDATE public.words SET interval_days=19,repetition_count=21,easiness_factor=2.1,next_review_date='2026-11-15',last_reviewed_at=NOW() WHERE word_id='${word}';`
  )
  assert.equal(await source(word), input.source_sha256)
  const before = await protectedRow(word)
  const p = await plan(f, { [word]: input })
  assert.equal((await items(p))[0].disposition, EXACT_LINK)
  assert.deepEqual(await protectedRow(word), before)
  assert.ok(
    !Object.hasOwn(
      (await items(p))[0].original_snapshot.word,
      'repetition_count'
    )
  )
})

test('exact retry returns the same immutable plan; changed intent and audit mutation fail', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  const p = await plan(f, { [word]: input })
  assert.equal(await db.sql(p.sql), p.hash)
  await assert.rejects(
    plan(
      f,
      {
        [word]: {
          ...input,
          meaning_review: {
            ...input.meaning_review,
            evidence_sha256: 'd'.repeat(64),
          },
        },
      },
      p.run
    ),
    /intent-mismatch/
  )
  for (const sql of [
    `UPDATE dictionary_following_rehearsal.items SET approved_diff='{}' WHERE run_id='${p.run}';`,
    `DELETE FROM dictionary_following_rehearsal.runs WHERE run_id='${p.run}';`,
    'TRUNCATE dictionary_following_rehearsal.items;',
  ]) {
    await assert.rejects(db.sql(sql), /append-only/)
  }
})

test('count mismatch and interrupted planning leave no partial receipt; exact retry can resume', async () => {
  const f = await fixture(2)
  const p = planSql(f, {}, randomUUID(), 3)
  await assert.rejects(db.sql(p.sql), /scope-count-mismatch/)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM dictionary_following_rehearsal.runs WHERE run_id='${p.run}';`
    ),
    '0'
  )
  const valid = planSql(f)
  await db.sql(`BEGIN; ${valid.sql} ROLLBACK;`)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM dictionary_following_rehearsal.items WHERE run_id='${valid.run}';`
    ),
    '0'
  )
  assert.equal((await report(await plan(f, {}, valid.run))).total, 2)
})

test('ordinary app and service roles cannot read originals or invoke operator planning', async () => {
  const f = await fixture()
  const p = await plan(f)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT original_snapshot FROM dictionary_following_rehearsal.items;`
      ),
      /permission denied/
    )
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT dictionary_following_rehearsal.report('${p.run}');`
      ),
      /permission denied/
    )
  }
  const text = JSON.stringify(await report(p))
  assert.ok(!text.includes(f.owner) && !text.includes(f.words[0]))
})

test('large publication sequences stay decimal strings and protected SQL originals retain exact content versions', async () => {
  const f = await fixture()
  const word = f.words[0]
  const value = await content(word)
  await db.sql(`UPDATE private.dictionary_delivery_cursor SET committed_version=9007199254740993 WHERE singleton;
    INSERT INTO public.word_content_state(word_id,user_id,content_version,fallback_content,overrides)
    VALUES ('${word}','${f.owner}',9007199254740993,${json(value)},'{}');`)
  const entry = await target(f, value)
  assert.ok(BigInt(entry.sequence) > BigInt(Number.MAX_SAFE_INTEGER))
  const input = await decision(f, word, entry)
  const p = await plan(f, { [word]: input })
  assert.equal(
    await db.sql(
      `SELECT target_head_sequence FROM dictionary_following_rehearsal.items WHERE run_id='${p.run}';`
    ),
    entry.sequence
  )
  assert.equal(
    await db.sql(
      `SELECT original_snapshot#>>'{state,content_version}' FROM dictionary_following_rehearsal.items WHERE run_id='${p.run}';`
    ),
    '9007199254740993'
  )
})

test('deleting a planned personal word retains the immutable protected evidence without resurrecting it', async () => {
  const f = await fixture()
  const word = f.words[0]
  const entry = await target(f, await content(word))
  const input = await decision(f, word, entry)
  const p = await plan(f, { [word]: input })
  const before = await items(p)
  await db.sql(`DELETE FROM public.words WHERE word_id='${word}';`)
  assert.deepEqual(await items(p), before)
  assert.equal(await db.sql(p.sql), p.hash)
  await assert.rejects(plan(f, { [word]: input }), /invalid-or-out-of-scope/)
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.words WHERE word_id='${word}';`),
    '0'
  )
})
