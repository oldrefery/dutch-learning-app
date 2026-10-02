import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { createCluster } from './cluster.mjs'
import { asUser, literal, assessment, review } from './fixtures.mjs'
import { correct, correction, resetSql } from './correction-fixtures.mjs'
import { canonicalizeCefrInput } from '../../packages/domain/src/shared-dictionary.ts'

const json = value => `${literal(JSON.stringify(value))}::jsonb`
const hash = 'a'.repeat(64)
const sha256 = value => createHash('sha256').update(value).digest('hex')
let db

before(async () => {
  db = await createCluster()
  await db.sql(
    await readFile(
      new URL('../shared-dictionary/rehearsal.sql', import.meta.url),
      'utf8'
    )
  )
})
after(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.sql(`UPDATE private.dictionary_content_runtime SET
    operations_enabled = false, reads_enabled = false, legacy_guard_enabled = false;`)
})

async function fixture(count = 1) {
  const user = randomUUID()
  await db.sql(
    `INSERT INTO auth.users(id, email) VALUES ('${user}', '${user}@example.invalid');`
  )
  const collection = await db.sql(`INSERT INTO public.collections(user_id, name)
    VALUES ('${user}', 'Synthetic backfill') RETURNING collection_id;`)
  const words = []
  for (let i = 0; i < count; i++) {
    const word = randomUUID()
    await db.sql(`INSERT INTO public.words(word_id, user_id, collection_id,
      dutch_lemma, part_of_speech, article, translations, tts_url)
      VALUES ('${word}', '${user}', '${collection}', '${word}', 'noun', 'de',
        '{"en":["synthetic"],"ru":[]}', '');`)
    words.push(word)
  }
  return { user, words, collection }
}

const contentOf = async word =>
  JSON.parse(
    await db.sql(
      `SELECT private.legacy_word_content(w) FROM public.words w WHERE word_id = '${word}';`
    )
  )

async function seed(
  word,
  { content, cefr, sourceKind = 'first_party', resolution = randomUUID() } = {}
) {
  const value = content ?? (await contentOf(word))
  const contentHash = await db.sql(
    `SELECT dictionary_rehearsal.canonical_sha256(${json(value)});`
  )
  const inputHash = sha256(canonicalizeCefrInput(value))
  const source = randomUUID()
  const user = await db.sql(
    `SELECT user_id FROM public.words WHERE word_id = '${word}';`
  )
  await db.sql(`INSERT INTO private.dictionary_sources(source_id, source_kind,
    provenance_locator, review_state, reviewed_by, reviewed_at, approved_content_sha256)
    VALUES ('${source}', '${sourceKind}', 'fixture://official/${source}', 'approved',
      '${user}', NOW(), '${contentHash}');`)
  const sense = `fixture-${word}`
  const meaningAssessment =
    cefr === undefined
      ? null
      : {
          scope: 'meaning',
          sense_key: sense,
          input_sha256: inputHash,
          level: 'B1',
          status: 'estimated',
          confidence: 0.7,
          method: 'editorial',
          method_version: 'fixture-1',
          source_id: source,
          assessed_at: '2026-09-21T10:00:00Z',
          ...cefr,
        }
  const sql = `SELECT dictionary_rehearsal.seed_official('${resolution}', '${hash}',
    '${sense}', ${json(value)}, '${contentHash}', '${inputHash}', '${source}',
    ${meaningAssessment === null ? 'NULL' : json(meaningAssessment)});`
  return { ...JSON.parse(await db.sql(sql)), sql, source }
}

async function plan(f, options = {}) {
  const run = options.run ?? randomUUID()
  const sql = `SELECT dictionary_rehearsal.plan('${run}', ARRAY['${f.user}']::uuid[],
    ${options.count ?? f.words.length},
    ARRAY[${(options.excluded ?? []).map(literal).join(',')}]::uuid[],
    ARRAY[${(options.private ?? []).map(literal).join(',')}]::uuid[],
    ${json(options.hashes ?? {})});`
  return { run, sha: await db.sql(sql), sql }
}

const enable = () =>
  db.sql(`UPDATE private.dictionary_content_runtime SET
  operations_enabled = true, reads_enabled = true, legacy_guard_enabled = true;`)
const applySql = (p, limit = 50) =>
  `SELECT dictionary_rehearsal.apply_batch('${p.run}', '${p.sha}', ${limit});`
const apply = async (p, limit) => JSON.parse(await db.sql(applySql(p, limit)))
const items = async p =>
  JSON.parse(
    await db.sql(`SELECT jsonb_agg(to_jsonb(i) ORDER BY word_id)
  FROM dictionary_rehearsal.items i WHERE run_id = '${p.run}';`)
  )

// Independent before/after assertions include exact stored nullable legacy fields.
async function snapshot(f) {
  const result = {}
  for (const table of [
    'words',
    'collections',
    'user_progress',
    'review_events',
    'learning_resets',
    'learning_progress_cutovers',
    'review_progress_checkpoints',
    'review_progress_heads',
    'review_assessment_corrections',
  ]) {
    const row =
      table === 'words'
        ? "to_jsonb(t) - ARRAY['dictionary_entry_id', 'dictionary_revision_id', 'updated_at']"
        : 'to_jsonb(t)'
    result[table] = JSON.parse(
      await db.sql(`SELECT coalesce(jsonb_agg(${row} ORDER BY to_jsonb(t)::text), '[]')
      FROM public.${table} t WHERE user_id = '${f.user}';`)
    )
  }
  return result
}

test('canonical CEFR bytes match the shared domain contract and reject tampered content', async () => {
  const f = await fixture()
  const value = await contentOf(f.words[0])
  value.analysis_notes = 'Quotes " and accents ë, plus newline\n'
  value.synonyms = ['één', 'twee']
  const { image_url, tts_url, ...linguistic } = value
  assert.equal(image_url, null)
  assert.equal(tts_url, null)
  assert.equal(
    await db.sql(
      `SELECT dictionary_rehearsal.canonical_json(${json({
        assessment_schema_version: 1,
        content: linguistic,
      })});`
    ),
    canonicalizeCefrInput(value)
  )
  const seeded = await seed(f.words[0], { content: value })
  await assert.rejects(
    db.sql(seeded.sql.replace('Quotes', 'Changed')),
    /official-content-fingerprint-mismatch/
  )
})

test('malformed legacy content remains private without losing dry-run coverage', async () => {
  const f = await fixture()
  await db.sql(
    `UPDATE public.words SET translations = '{"en":42}' WHERE word_id = '${f.words[0]}';`
  )
  const p = await plan(f)
  assert.equal((await items(p))[0].disposition, 'private-only')
})

test('report exposes inventory deltas and receipt checkpoints without private text', async () => {
  const f = await fixture(2)
  await seed(f.words[0])
  const p = await plan(f)
  const report = async () =>
    JSON.parse(await db.sql(`SELECT dictionary_rehearsal.report('${p.run}');`))
  assert.deepEqual(await report(), {
    plan_sha256: p.sha,
    total: 2,
    dispositions: { 'safe-match': 1, 'missing-source': 1 },
    outcomes: {},
    remaining: 1,
    unplanned_cards: 0,
    changed_or_missing_cards: 0,
  })
  await enable()
  await apply(p)
  assert.equal((await report()).changed_or_missing_cards, 0)
  assert.deepEqual((await report()).outcomes, { applied: 1 })
  await db.sql(`INSERT INTO public.words(word_id, user_id, dutch_lemma, translations, tts_url)
    VALUES ('${randomUUID()}', '${f.user}', 'new-unplanned-fixture', '{}', '');
    UPDATE public.words SET analysis_notes = 'changed' WHERE word_id = '${f.words[1]}';`)
  const delta = await report()
  assert.equal(delta.unplanned_cards, 1)
  assert.equal(delta.changed_or_missing_cards, 1)
  assert.equal(delta.remaining, 0)
})

test('dry run covers all six dispositions without modifying personal data', async () => {
  const f = await fixture(6)
  const [safe, possible, personal, excluded, stale] = f.words
  await seed(safe)
  const changed = await contentOf(possible)
  await seed(possible, {
    content: {
      ...changed,
      translations: { en: ['different meaning'], ru: [] },
    },
  })
  const original = await snapshot(f)
  const p = await plan(f, {
    private: [personal],
    excluded: [excluded],
    hashes: { [stale]: hash },
  })
  const mapped = await items(p)
  assert.deepEqual(
    mapped.map(i => i.disposition).sort(),
    [
      'safe-match',
      'possible-match',
      'private-only',
      'excluded',
      'stale-source',
      'missing-source',
    ].sort()
  )
  assert.deepEqual(await snapshot(f), original)
  assert.equal(await db.sql(p.sql), p.sha)
  await assert.rejects(
    plan(f, { run: p.run, count: 5 }),
    /plan-intent-mismatch/
  )
  await assert.rejects(plan(f, { count: 5 }), /scope-count-mismatch/)
  await assert.rejects(
    plan(f, { excluded: [randomUUID()] }),
    /out-of-scope-evidence/
  )
  await assert.rejects(
    plan({ ...f, user: randomUUID() }, { count: 0 }),
    /unknown-owner/
  )
})

test('two owners share a reviewed meaning while retaining separate cards and progress', async () => {
  const first = await fixture()
  const second = await fixture()
  const value = await contentOf(first.words[0])
  const seeded = await seed(first.words[0])
  await db.sql(`SELECT private.project_dictionary_content_to_word(
    '${second.words[0]}', '${second.user}', ${json(value)});`)
  const plans = [await plan(first), await plan(second)]
  await enable()
  for (const p of plans) assert.equal((await apply(p)).applied, 1)
  assert.equal(
    await db.sql(`SELECT count(DISTINCT dictionary_entry_id) FROM public.words
    WHERE user_id IN ('${first.user}', '${second.user}');`),
    '1'
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.words
    WHERE dictionary_entry_id = '${seeded.entry_id}';`),
    '2'
  )
  const otherBefore = await snapshot(second)
  await review(db, assessment(first.words[0]), first.user)
  assert.deepEqual(await snapshot(second), otherBefore)
  const own = JSON.parse(
    await db.sql(
      asUser(
        first.user,
        `SELECT public.get_dictionary_effective_content_v1(ARRAY['${second.words[0]}']::uuid[]);`
      )
    )
  )
  assert.equal(own.cards.length, 0)
})

test('equal spelling or ambiguous identical meanings never collapse personal cards', async () => {
  const f = await fixture()
  await seed(f.words[0])
  await seed(f.words[0])
  const p = await plan(f)
  assert.equal((await items(p))[0].disposition, 'possible-match')
  await enable()
  assert.equal((await apply(p)).applied, 0)
})

test('official seed retries are idempotent and CEFR requires per-meaning provenance', async () => {
  const f = await fixture(6)
  const seeded = await seed(f.words[0], { cefr: {} })
  assert.deepEqual(JSON.parse(await db.sql(seeded.sql)), {
    entry_id: seeded.entry_id,
    revision_id: seeded.revision_id,
  })
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.dictionary_cefr_assessments
    WHERE entry_id = '${seeded.entry_id}';`),
    '1'
  )
  await assert.rejects(
    seed(f.words[1], { cefr: { scope: 'pack' } }),
    /meaning-bound-cefr/
  )
  await assert.rejects(
    seed(f.words[2], { cefr: { input_sha256: hash } }),
    /meaning-bound-cefr/
  )
  await assert.rejects(
    seed(f.words[3], { cefr: { sense_key: 'other-meaning' } }),
    /meaning-bound-cefr/
  )
  await assert.rejects(
    seed(f.words[4], { sourceKind: 'unknown' }),
    /reviewed-official-source/
  )
  const unknown = await seed(f.words[5])
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.dictionary_cefr_assessments
    WHERE entry_id = '${unknown.entry_id}';`),
    '0'
  )
})

test('capability and plan fingerprint gates prevent accidental preparation-time apply', async () => {
  const f = await fixture()
  await seed(f.words[0])
  const p = await plan(f)
  await assert.rejects(apply(p), /cutover-capabilities-required/)
  await enable()
  await assert.rejects(apply({ ...p, sha: hash }), /reviewed-plan-required/)
  await assert.rejects(apply(p, 101), /invalid-batch-limit/)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await assert.rejects(
      db.sql(`SET ROLE ${role}; ${applySql(p)}`),
      /permission denied/
    )
    await assert.rejects(
      db.sql(`SET ROLE ${role}; SELECT * FROM dictionary_rehearsal.items;`),
      /permission denied/
    )
  }
})

test('bounded apply preserves exact content, metadata and every learning stream', async () => {
  const f = await fixture(3)
  const [word, second, tombstone] = f.words
  await db.sql(`UPDATE public.words SET image_url = 'https://example.invalid/private.png'
    WHERE word_id = '${word}'; UPDATE public.words SET deleted_at = NOW() WHERE word_id = '${tombstone}';`)
  const value = await contentOf(word)
  await seed(word, { content: { ...value, image_url: null }, cefr: {} })
  await seed(second)
  await review(db, assessment(word), f.user)
  await db.sql(asUser(f.user, resetSql(word)))
  const event = assessment(word)
  await review(db, event, f.user)
  await correct(db, correction(event), f.user)
  await db.sql(`INSERT INTO public.user_progress(user_id, word_id, status, reviewed_count)
    VALUES ('${f.user}', '${word}', 'learning', 4);`)
  const p = await plan(f)
  const original = await snapshot(f)
  await enable()
  assert.equal((await apply(p, 1)).applied, 1)
  assert.equal((await apply(p, 1)).applied, 1)
  assert.equal((await apply(p, 1)).applied, 0)
  assert.deepEqual(await snapshot(f), original)
  const hydrated = JSON.parse(
    await db.sql(
      asUser(
        f.user,
        `SELECT public.get_dictionary_effective_content_v1(ARRAY['${word}']::uuid[]);`
      )
    )
  )
  assert.deepEqual(hydrated.cards[0].content, value)
  assert.equal(hydrated.cards[0].cefr.level, 'B1')
  assert.equal(
    (await items(p)).find(i => i.word_id === tombstone).disposition,
    'excluded'
  )
})

test('review arriving after the plan survives apply and read rollback', async () => {
  const f = await fixture()
  const word = f.words[0]
  await seed(word)
  const p = await plan(f)
  await review(db, assessment(word), f.user)
  const original = await snapshot(f)
  await enable()
  assert.equal((await apply(p)).applied, 1)
  await review(db, assessment(word, { rating: 'easy' }), f.user)
  const afterReview = await snapshot(f)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET reads_enabled = false;'
  )
  await db.sql(asUser(f.user, 'SELECT public.get_web_review_snapshot_v1();'))
  assert.deepEqual(await snapshot(f), afterReview)
  assert.equal(
    afterReview.review_events.length,
    original.review_events.length + 1
  )
})

test('content edits, moves and tombstones after planning are rejected without writes', async () => {
  const f = await fixture(3)
  for (const word of f.words) await seed(word)
  const p = await plan(f)
  await db.sql(`UPDATE public.words SET analysis_notes = 'Private edit' WHERE word_id = '${f.words[0]}';
    UPDATE public.words SET collection_id = NULL WHERE word_id = '${f.words[1]}';
    UPDATE public.words SET deleted_at = NOW() WHERE word_id = '${f.words[2]}';`)
  const original = await snapshot(f)
  await enable()
  assert.deepEqual(await apply(p), {
    applied: 0,
    rejected: 3,
    busy: 0,
    remaining: 0,
  })
  assert.deepEqual(await snapshot(f), original)
  assert.equal((await apply(p)).rejected, 0)
  const fresh = await plan(f)
  assert.equal(
    (await items(fresh)).find(i => i.word_id === f.words[1]).disposition,
    'safe-match'
  )
})

test('retired sources are rejected without erasing the original plan', async () => {
  const f = await fixture()
  const seeded = await seed(f.words[0])
  const p = await plan(f)
  await db.sql(
    `UPDATE public.dictionary_entries SET state = 'retired' WHERE entry_id = '${seeded.entry_id}';`
  )
  await enable()
  assert.equal((await apply(p)).rejected, 1)
  assert.equal(
    await db.sql(
      `SELECT outcome FROM dictionary_rehearsal.ledger WHERE run_id = '${p.run}';`
    ),
    'source-unavailable'
  )
  assert.equal(await db.sql(p.sql), p.sha)
})

test('transaction interruption rolls back receipts and links; resume uses durable receipts', async () => {
  const f = await fixture(2)
  for (const word of f.words) await seed(word)
  const p = await plan(f)
  await enable()
  await db.sql(`BEGIN; ${applySql(p, 1)} ROLLBACK;`)
  assert.equal(
    await db.sql(
      `SELECT count(*) FROM dictionary_rehearsal.ledger WHERE run_id = '${p.run}';`
    ),
    '0'
  )
  assert.equal((await apply(p, 1)).applied, 1)
  // A separate connection resumes the same immutable run without an in-memory cursor.
  assert.equal((await apply(p, 1)).applied, 1)
  assert.equal((await apply(p, 1)).applied, 0)
  for (const table of ['runs', 'items', 'ledger', 'seeds']) {
    await assert.rejects(
      db.sql(`DELETE FROM dictionary_rehearsal.${table};`),
      /append-only/
    )
    await assert.rejects(
      db.sql(`TRUNCATE dictionary_rehearsal.${table} CASCADE;`),
      /append-only/
    )
  }
})

test('a receipt lock failure rolls back the link and reports no false applied count', async () => {
  const f = await fixture()
  await seed(f.words[0])
  const p = await plan(f)
  await enable()
  await db.sql(`CREATE FUNCTION dictionary_rehearsal.fixture_block_receipt() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.word_id = '${f.words[0]}'::uuid THEN
        RAISE EXCEPTION 'synthetic receipt lock timeout' USING ERRCODE = '55P03';
      END IF;
      RETURN NEW;
    END; $$;
    CREATE TRIGGER fixture_block_receipt BEFORE INSERT ON dictionary_rehearsal.ledger
    FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.fixture_block_receipt();`)
  try {
    assert.deepEqual(await apply(p), {
      applied: 0,
      rejected: 0,
      busy: 1,
      remaining: 1,
    })
    assert.equal(
      await db.sql(
        `SELECT count(*) FROM public.word_content_state WHERE user_id = '${f.user}';`
      ),
      '0'
    )
  } finally {
    await db.sql(
      'DROP TRIGGER fixture_block_receipt ON dictionary_rehearsal.ledger; DROP FUNCTION dictionary_rehearsal.fixture_block_receipt();'
    )
  }
  assert.equal((await apply(p)).applied, 1)
})

test('concurrent workers and overlapping runs link each card at most once', async () => {
  const f = await fixture(4)
  for (const word of f.words) await seed(word)
  const p = await plan(f)
  const competing = await plan(f)
  await enable()
  const results = await Promise.all([apply(p, 2), apply(p, 2)])
  while ((await apply(p, 2)).remaining > 0) {
    /* Drain any skipped in-flight rows. */
  }
  assert.ok(results.reduce((sum, r) => sum + r.applied, 0) <= 4)
  assert.equal(
    await db.sql(`SELECT count(*) FROM dictionary_rehearsal.ledger
    WHERE run_id = '${p.run}' AND outcome = 'applied';`),
    '4'
  )
  assert.equal((await apply(competing)).rejected, 4)
  assert.equal(
    await db.sql(`SELECT max(content_version) FROM public.word_content_state
    WHERE user_id = '${f.user}';`),
    '1'
  )
})

test('a locked personal card is retryable and does not stall the other cards', async () => {
  const f = await fixture(2)
  for (const word of f.words) await seed(word)
  const p = await plan(f)
  await enable()
  const connection = db.connect()
  try {
    connection.child.stdin
      .write(`BEGIN; SELECT 1 FROM public.words WHERE word_id = '${f.words[0]}' FOR UPDATE;
      \\echo REHEARSAL_LOCK_HELD\n`)
    const deadline = Date.now() + 5000
    while (!connection.output().includes('REHEARSAL_LOCK_HELD')) {
      if (Date.now() > deadline) throw new Error('Lock barrier timeout')
      await setTimeout(20)
    }
    assert.deepEqual(await apply(p), {
      applied: 1,
      rejected: 0,
      busy: 1,
      remaining: 1,
    })
  } finally {
    connection.child.stdin.end('ROLLBACK;\n')
    await connection.completed
  }
  assert.deepEqual(await apply(p), {
    applied: 1,
    rejected: 0,
    busy: 0,
    remaining: 0,
  })
})
