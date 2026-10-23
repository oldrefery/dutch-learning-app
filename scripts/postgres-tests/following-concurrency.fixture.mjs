import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { literal } from './fixtures.mjs'

const json = value => `${literal(JSON.stringify(value))}::jsonb`
const inventoryHash = 'a'.repeat(64)
const EXACT_LINK = 'exact-link'
const DIFF_LINK = 'approved-diff-link'

// Synthetic mechanical attestations only; no real semantic approvals.
export function followingFixture(db) {
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
    await db.sql(
      `SELECT dictionary_rehearsal.canonical_sha256(${json(value)});`
    )
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
      dictionary_content_mode === 'legacy' ||
        dictionary_content_mode === 'follow'
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

  return {
    fixture,
    content,
    source,
    target,
    decision,
    plan,
    items,
    protectedRow,
    enable,
    receipts,
    apply,
    baseWord,
    reviewed,
    json,
    applySql: (p, batch, limit = 50) =>
      `${APPLY}('${p.run}','${p.hash}','${batch}',${limit});`,
  }
}
