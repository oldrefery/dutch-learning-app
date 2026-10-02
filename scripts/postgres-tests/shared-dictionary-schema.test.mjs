import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { overlap } from './concurrency-fixtures.mjs'
import {
  asUser,
  assessment,
  other,
  owner,
  review,
  seedUsers,
  seedWord,
} from './fixtures.mjs'

const migrationName = '20260921103000_add_shared_dictionary_schema.sql'
const digest = value => value.repeat(64)

const sourceId = randomUUID()
const entryId = randomUUID()
const revisionId = randomUUID()
const assessmentId = randomUUID()

const approvedSourceSql = (id, contentDigest = digest('a')) => `
  INSERT INTO private.dictionary_sources (
    source_id, source_kind, provenance_locator, review_state,
    reviewed_by, reviewed_at, approved_content_sha256
  ) VALUES (
    '${id}', 'editorial', 'fixture://${id}', 'approved',
    '${owner}', '2026-09-21T08:00:00Z', '${contentDigest}'
  );`

const publishedEntrySql = ({
  entry = randomUUID(),
  lemma = 'fiets',
  revision = randomUUID(),
  sense = randomUUID(),
  source = randomUUID(),
} = {}) => ({
  entry,
  revision,
  source,
  sql: `
    ${approvedSourceSql(source)}
    INSERT INTO public.dictionary_entries (
      entry_id, language_code, lemma, part_of_speech, sense_key
    ) VALUES ('${entry}', 'nl', '${lemma}', 'noun', '${sense}');
    INSERT INTO public.dictionary_revisions (
      revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id, review_status, reviewed_at, published_at
    ) VALUES (
      '${revision}', '${entry}', 1, '{"translations":["fixture"]}',
      '${digest('a')}', '${digest('b')}', '${source}', 'published',
      '2026-09-21T08:01:00Z', '2026-09-21T08:02:00Z'
    );
    INSERT INTO public.dictionary_entry_heads(entry_id, revision_id)
      VALUES ('${entry}', '${revision}');
    UPDATE public.dictionary_entries SET state = 'published'
      WHERE entry_id = '${entry}';`,
})

let db

before(async () => {
  db = await createCluster()
  await seedUsers(db)
  await db.sql(`
    ${approvedSourceSql(sourceId)}
    INSERT INTO public.dictionary_entries (
      entry_id, language_code, lemma, part_of_speech, article, sense_key
    ) VALUES ('${entryId}', 'nl', 'fiets', 'noun', 'de', 'bicycle');
    INSERT INTO public.dictionary_revisions (
      revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id, review_status, reviewed_at, published_at
    ) VALUES (
      '${revisionId}', '${entryId}', 1,
      '{"translations":["bicycle"],"examples":[]}',
      '${digest('a')}', '${digest('b')}', '${sourceId}', 'published',
      '2026-09-21T08:01:00Z', '2026-09-21T08:02:00Z'
    );
    INSERT INTO public.dictionary_entry_heads(entry_id, revision_id)
      VALUES ('${entryId}', '${revisionId}');
    UPDATE public.dictionary_entries SET state = 'published'
      WHERE entry_id = '${entryId}';
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      confidence, method, method_version, source_id, locked
    ) VALUES (
      '${assessmentId}', '${entryId}', '${digest('b')}', 'A2', 'reviewed',
      0.95, 'editorial', '1', '${sourceId}', true
    );
    INSERT INTO public.dictionary_cefr_heads(entry_id, input_sha256, assessment_id)
      VALUES ('${entryId}', '${digest('b')}', '${assessmentId}');
  `)
})

after(async () => {
  await db?.close()
})

test('fresh schema exposes only current published content to authenticated clients', async () => {
  const draftEntry = randomUUID()
  const draftRevision = randomUUID()
  const draftSource = randomUUID()
  await db.sql(`
    INSERT INTO private.dictionary_sources (
      source_id, source_kind, provenance_locator
    ) VALUES ('${draftSource}', 'editorial', 'fixture://${draftSource}');
    INSERT INTO public.dictionary_entries (
      entry_id, language_code, lemma, part_of_speech, sense_key
    ) VALUES ('${draftEntry}', 'nl', 'concept', 'noun', 'draft');
    INSERT INTO public.dictionary_revisions (
      revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id
    ) VALUES (
      '${draftRevision}', '${draftEntry}', 1, '{}', '${digest('c')}',
      '${digest('d')}', '${draftSource}'
    );
  `)

  await assert.rejects(
    db.sql('SET ROLE anon; SELECT * FROM public.dictionary_entries;'),
    /42501.*permission denied for table dictionary_entries/s
  )
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT entry_id || '|' || revision_id || '|' || cefr_level
         FROM public.readable_dictionary_content;`
      )
    ),
    `${entryId}|${revisionId}|A2`
  )
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT count(*) FROM public.dictionary_entries
         WHERE entry_id = '${draftEntry}';`
      )
    ),
    '0'
  )
})

test('client roles cannot read provenance or mutate shared and private state', async () => {
  const word = await seedWord(db)

  await assert.rejects(
    db.sql(asUser(owner, 'SELECT * FROM private.dictionary_sources LIMIT 1;')),
    /42501.*permission denied for table dictionary_sources/s
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `INSERT INTO public.dictionary_entries (
          language_code, lemma, sense_key
        ) VALUES ('nl', 'forged', 'forged');`
      )
    ),
    /42501.*permission denied for table dictionary_entries/s
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `UPDATE public.words
         SET dictionary_entry_id = '${entryId}',
             dictionary_revision_id = '${revisionId}'
         WHERE word_id = '${word}';`
      )
    ),
    /Dictionary references can only be changed by trusted commands/
  )
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `INSERT INTO public.word_content_state (
          word_id, user_id, fallback_content
        ) VALUES ('${word}', '${owner}', '{}');`
      )
    ),
    /42501.*permission denied for table word_content_state/s
  )
})

test('trusted links preserve personal ownership and owner-only content state', async () => {
  const word = await seedWord(db)
  const foreignWord = await seedWord(db)
  const operation = randomUUID()
  const trustedSource = randomUUID()
  await db.sql(`SET ROLE service_role;
    INSERT INTO private.dictionary_sources (
      source_id, source_kind, provenance_locator
    ) VALUES ('${trustedSource}', 'unknown', 'fixture://${trustedSource}');
    UPDATE public.words
    SET dictionary_entry_id = '${entryId}',
        dictionary_revision_id = '${revisionId}'
    WHERE word_id = '${word}';
    INSERT INTO public.word_content_state (
      word_id, user_id, fallback_content, overrides
    ) VALUES (
      '${word}', '${owner}', NULL,
      '{"examples":{"op":"remove"},"translations":{"op":"set","value":{"en":["mine"],"ru":[]}}}'
    );
    INSERT INTO private.word_content_receipts (
      user_id, operation_id, word_id, request_sha256,
      resulting_content_version, result_code
    ) VALUES (
      '${owner}', '${operation}', '${word}', '${digest('e')}', 0, 'applied'
    );`)

  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT user_id || '|' || content_version
         FROM public.word_content_state WHERE word_id = '${word}';
         SELECT result_code FROM private.word_content_receipts
         WHERE operation_id = '${operation}';`
      )
    ),
    `${owner}|0\napplied`
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `SELECT count(*) FROM public.word_content_state WHERE word_id = '${word}';
         SELECT count(*) FROM private.word_content_receipts
         WHERE operation_id = '${operation}';`
      )
    ),
    '0\n0'
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role;
      INSERT INTO public.word_content_state (
        word_id, user_id, fallback_content
      ) VALUES ('${foreignWord}', '${other}', '{}');`),
    /23503.*word_content_state_word_owner/s
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role;
      UPDATE private.word_content_receipts SET result_code = 'idempotent'
      WHERE operation_id = '${operation}';`),
    /word_content_receipts rows are immutable/
  )
})

test('dictionary references must be complete, consistent, and publishable', async () => {
  const word = await seedWord(db)
  const draftEntry = randomUUID()
  const draftRevision = randomUUID()
  const draftSource = randomUUID()
  await db.sql(`
    INSERT INTO private.dictionary_sources (
      source_id, source_kind, provenance_locator
    ) VALUES ('${draftSource}', 'unknown', 'fixture://${draftSource}');
    INSERT INTO public.dictionary_entries (
      entry_id, language_code, lemma, sense_key
    ) VALUES ('${draftEntry}', 'nl', 'draft', 'draft');
    INSERT INTO public.dictionary_revisions (
      revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id
    ) VALUES (
      '${draftRevision}', '${draftEntry}', 1, '{}', '${digest('f')}',
      '${digest('0')}', '${draftSource}'
    );
  `)

  await assert.rejects(
    db.sql(`SET ROLE service_role;
      UPDATE public.words SET dictionary_entry_id = '${entryId}'
      WHERE word_id = '${word}';`),
    /23514.*words_dictionary_reference_pair/s
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role;
      UPDATE public.words
      SET dictionary_entry_id = '${draftEntry}',
          dictionary_revision_id = '${draftRevision}'
      WHERE word_id = '${word}';`),
    /New dictionary references require published content/
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role;
      UPDATE public.words
      SET dictionary_entry_id = '${entryId}',
          dictionary_revision_id = '${draftRevision}'
      WHERE word_id = '${word}';`),
    /New dictionary references require published content/
  )
})

test('shared history is immutable and cannot cascade-delete personal learning', async () => {
  const fixture = publishedEntrySql({ lemma: 'blijven' })
  await db.sql(fixture.sql)
  const word = await seedWord(db)
  await review(db, assessment(word))
  await db.sql(`SET ROLE service_role;
    UPDATE public.words
    SET dictionary_entry_id = '${fixture.entry}',
        dictionary_revision_id = '${fixture.revision}'
    WHERE word_id = '${word}';`)

  await assert.rejects(
    db.sql(`SET ROLE service_role;
      DELETE FROM public.dictionary_revisions
      WHERE revision_id = '${fixture.revision}';`),
    /dictionary_revisions rows are immutable/
  )
  await assert.rejects(
    db.sql(`SET ROLE service_role;
      DELETE FROM public.dictionary_entries
      WHERE entry_id = '${fixture.entry}';`),
    /23503/s
  )
  assert.equal(
    await db.sql(`SELECT
      (SELECT count(*) FROM public.words WHERE word_id = '${word}') || '|' ||
      (SELECT count(*) FROM public.review_events WHERE word_id = '${word}');`),
    '1|1'
  )
})

test('retired shared content remains readable only to an owner with a pinned card', async () => {
  const fixture = publishedEntrySql({ lemma: 'verlaten' })
  await db.sql(fixture.sql)
  const word = await seedWord(db)
  await db.sql(`SET ROLE service_role;
    UPDATE public.words
    SET dictionary_entry_id = '${fixture.entry}',
        dictionary_revision_id = '${fixture.revision}'
    WHERE word_id = '${word}';
    UPDATE public.dictionary_entries SET state = 'retired'
    WHERE entry_id = '${fixture.entry}';`)

  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT count(*) FROM public.dictionary_entries
         WHERE entry_id = '${fixture.entry}';
         SELECT count(*) FROM public.dictionary_revisions
         WHERE revision_id = '${fixture.revision}';`
      )
    ),
    '1\n1'
  )
  assert.equal(
    await db.sql(
      asUser(
        other,
        `SELECT count(*) FROM public.dictionary_entries
         WHERE entry_id = '${fixture.entry}';
         SELECT count(*) FROM public.dictionary_revisions
         WHERE revision_id = '${fixture.revision}';`
      )
    ),
    '0\n0'
  )
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT count(*) FROM public.readable_dictionary_content
         WHERE entry_id = '${fixture.entry}';`
      )
    ),
    '0'
  )
})

test('CEFR heads preserve locked reviewed assessments and entry identity keeps senses distinct', async () => {
  const estimated = randomUUID()
  const successor = randomUUID()
  const secondSense = randomUUID()

  await db.sql(`
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      confidence, method, method_version, source_id
    ) VALUES (
      '${estimated}', '${entryId}', '${digest('b')}', 'B1', 'estimated',
      0.7, 'fixture-model', '1', '${sourceId}'
    );
    INSERT INTO public.dictionary_entries (
      entry_id, language_code, lemma, part_of_speech, article, sense_key
    ) VALUES ('${secondSense}', 'nl', 'fiets', 'noun', 'de', 'act-of-cycling');
  `)

  await assert.rejects(
    db.sql(`UPDATE public.dictionary_cefr_heads
      SET assessment_id = '${estimated}'
      WHERE entry_id = '${entryId}' AND input_sha256 = '${digest('b')}';`),
    /Locked or reviewed CEFR assessments require an explicit reviewed successor/
  )
  await db.sql(`
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      confidence, method, method_version, source_id, locked,
      supersedes_assessment_id
    ) VALUES (
      '${successor}', '${entryId}', '${digest('b')}', 'B1', 'reviewed',
      0.99, 'editorial', '2', '${sourceId}', true, '${assessmentId}'
    );
    UPDATE public.dictionary_cefr_heads SET assessment_id = '${successor}'
    WHERE entry_id = '${entryId}' AND input_sha256 = '${digest('b')}';
  `)
  assert.equal(
    await db.sql(`SELECT assessment_id FROM public.dictionary_cefr_heads
      WHERE entry_id = '${entryId}' AND input_sha256 = '${digest('b')}';`),
    successor
  )
  await assert.rejects(
    db.sql(`UPDATE public.dictionary_cefr_assessments SET cefr_level = 'C1'
      WHERE assessment_id = '${successor}';`),
    /dictionary_cefr_assessments rows are immutable/
  )
  await db.sql(`INSERT INTO public.dictionary_entries (
    language_code, lemma, part_of_speech, article, sense_key
  ) VALUES ('nl', 'FIETS', 'NOUN', 'DE', 'bicycle');`)
  assert.equal(
    await db.sql(`SELECT count(*) FROM public.dictionary_entries
      WHERE LOWER(lemma) = 'fiets' AND LOWER(part_of_speech) = 'noun'
        AND LOWER(article) = 'de';`),
    '3'
  )
})

test('upgrading an existing database keeps legacy cards and old-client writes intact', async () => {
  const upgraded = await createCluster({
    throughMigration: '20260912110000_add_web_review_snapshot_rpc.sql',
  })
  try {
    await seedUsers(upgraded)
    const word = await seedWord(upgraded, owner, { intervalDays: 7 })
    const migration = await readFile(
      new URL(`../../supabase/migrations/${migrationName}`, import.meta.url),
      'utf8'
    )
    // Supabase installations may grant new objects to client roles by default.
    await upgraded.sql(`ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated; ${migration}`)
    await assert.rejects(
      upgraded.sql(
        'SET ROLE anon; SELECT * FROM public.readable_dictionary_content;'
      ),
      /42501.*permission denied/s
    )
    await assert.rejects(
      upgraded.sql(asUser(owner, 'DELETE FROM public.dictionary_entries;')),
      /42501.*permission denied/s
    )

    assert.equal(
      await upgraded.sql(`SELECT interval_days || '|' ||
        COALESCE(dictionary_entry_id::text, 'null') || '|' ||
        COALESCE(dictionary_revision_id::text, 'null')
        FROM public.words WHERE word_id = '${word}';`),
      '7|null|null'
    )
    assert.equal(
      await upgraded.sql(
        asUser(
          owner,
          `UPDATE public.words SET dutch_lemma = 'legacy-updated'
           WHERE word_id = '${word}' RETURNING dutch_lemma;`
        )
      ),
      'legacy-updated'
    )
  } finally {
    await upgraded.close()
  }
})

test('protected CEFR heads reject NULL successors, deletion, and identity changes', async () => {
  const fixture = publishedEntrySql()
  const previous = randomUUID()
  const replacement = randomUUID()
  await db.sql(`${fixture.sql}
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      method, method_version, source_id, locked
    ) VALUES
      ('${previous}', '${fixture.entry}', '${digest('1')}', 'A2', 'reviewed',
       'editorial', '1', '${fixture.source}', true),
      ('${replacement}', '${fixture.entry}', '${digest('1')}', 'B1', 'reviewed',
       'editorial', '2', '${fixture.source}', true);
    INSERT INTO public.dictionary_cefr_heads VALUES
      ('${fixture.entry}', '${digest('1')}', '${previous}', NOW());`)
  await assert.rejects(
    db.sql(`UPDATE public.dictionary_cefr_heads
    SET assessment_id = '${replacement}' WHERE entry_id = '${fixture.entry}';`),
    /explicit reviewed successor/
  )
  await assert.rejects(
    db.sql(`DELETE FROM public.dictionary_cefr_heads
    WHERE entry_id = '${fixture.entry}';`),
    /CEFR heads cannot be deleted/
  )
  await assert.rejects(
    db.sql(`UPDATE public.dictionary_cefr_heads
    SET input_sha256 = '${digest('2')}' WHERE entry_id = '${fixture.entry}';`),
    /CEFR head identity is immutable/
  )
})

test('reviewed but unlocked CEFR heads cannot be overwritten by estimates', async () => {
  const fixture = publishedEntrySql()
  const previous = randomUUID()
  const replacement = randomUUID()
  await db.sql(`${fixture.sql}
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      method, method_version, source_id
    ) VALUES
      ('${previous}', '${fixture.entry}', '${digest('3')}', 'A2', 'reviewed',
       'editorial', '1', '${fixture.source}'),
      ('${replacement}', '${fixture.entry}', '${digest('3')}', 'B1', 'estimated',
       'fixture-model', '1', '${fixture.source}');
    INSERT INTO public.dictionary_cefr_heads VALUES
      ('${fixture.entry}', '${digest('3')}', '${previous}', NOW());`)
  await assert.rejects(
    db.sql(`UPDATE public.dictionary_cefr_heads
    SET assessment_id = '${replacement}' WHERE entry_id = '${fixture.entry}';`),
    /explicit reviewed successor/
  )
})

test('retirement rejects new links while unchanged pins and legacy writes survive', async () => {
  const fixture = publishedEntrySql()
  const pinned = await seedWord(db)
  const unlinked = await seedWord(db)
  await db.sql(`${fixture.sql}
    UPDATE public.words SET dictionary_entry_id = '${fixture.entry}',
      dictionary_revision_id = '${fixture.revision}' WHERE word_id = '${pinned}';
    UPDATE public.dictionary_entries SET state = 'retired'
      WHERE entry_id = '${fixture.entry}';`)
  await assert.rejects(
    db.sql(`UPDATE public.words
    SET dictionary_entry_id = '${fixture.entry}',
      dictionary_revision_id = '${fixture.revision}' WHERE word_id = '${unlinked}';`),
    /New dictionary references require published content/
  )
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words
    SET dictionary_entry_id = '${fixture.entry}',
      dictionary_revision_id = '${fixture.revision}', dutch_lemma = 'still-private'
    WHERE word_id = '${pinned}';`
    )
  )
})

test('published identities cannot change meaning or return to draft', async () => {
  const fixture = publishedEntrySql()
  await db.sql(fixture.sql)
  for (const change of [
    "lemma = 'different'",
    "sense_key = 'different'",
    "state = 'draft'",
  ]) {
    await assert.rejects(
      db.sql(`UPDATE public.dictionary_entries SET ${change}
      WHERE entry_id = '${fixture.entry}';`),
      /Dictionary entry identity|cannot return to draft/
    )
  }
  const second = publishedEntrySql()
  await db.sql(second.sql)
  await assert.rejects(
    db.sql(`UPDATE public.dictionary_entry_heads
    SET entry_id = '${second.entry}', revision_id = '${second.revision}'
    WHERE entry_id = '${fixture.entry}';`),
    /Dictionary head identity is immutable/
  )
})

test('receipts survive tombstones but do not prevent authorized account deletion', async () => {
  const user = randomUUID()
  await db.sql(`INSERT INTO auth.users(id, email) VALUES
    ('${user}', '${user}@example.invalid');`)
  const word = await seedWord(db, user)
  const operation = randomUUID()
  await db.sql(`INSERT INTO private.word_content_receipts (
    user_id, operation_id, word_id, request_sha256, resulting_content_version, result_code
  ) VALUES ('${user}', '${operation}', '${word}', '${digest('4')}', 0, 'applied');`)
  await assert.rejects(
    db.sql(`DELETE FROM private.word_content_receipts
    WHERE operation_id = '${operation}';`),
    /word_content_receipts rows are immutable/
  )
  await db.sql(
    `UPDATE public.words SET deleted_at = NOW() WHERE word_id = '${word}';`
  )
  assert.equal(
    await db.sql(`SELECT count(*) FROM private.word_content_receipts
    WHERE operation_id = '${operation}';`),
    '1'
  )
  await db.sql(`DELETE FROM auth.users WHERE id = '${user}';`)
  assert.equal(
    await db.sql(`SELECT count(*) FROM private.word_content_receipts
    WHERE operation_id = '${operation}';`),
    '0'
  )
})

test('private fallback and linked overrides must be consistent at transaction commit', async () => {
  const word = await seedWord(db)
  await assert.rejects(
    db.sql(`INSERT INTO public.word_content_state (word_id, user_id)
    VALUES ('${word}', '${owner}');`),
    /Unlinked cards require private fallback and empty overrides/
  )
  await db.sql(`INSERT INTO public.word_content_state (word_id, user_id, fallback_content)
    VALUES ('${word}', '${owner}', '{"translations":{}}');`)
  await assert.rejects(
    db.sql(`UPDATE public.words SET dictionary_entry_id = '${entryId}',
    dictionary_revision_id = '${revisionId}' WHERE word_id = '${word}';`),
    /Linked cards must not store a full fallback/
  )
  await db.sql(`BEGIN;
    UPDATE public.words SET dictionary_entry_id = '${entryId}',
      dictionary_revision_id = '${revisionId}' WHERE word_id = '${word}';
    UPDATE public.word_content_state SET fallback_content = NULL WHERE word_id = '${word}';
    COMMIT;`)
  await assert.rejects(
    db.sql(`UPDATE public.word_content_state SET fallback_content = '{}'
    WHERE word_id = '${word}';`),
    /Linked cards must not store a full fallback/
  )
  await db.sql(`BEGIN;
    UPDATE public.word_content_state SET fallback_content = '{"translations":{}}'
      WHERE word_id = '${word}';
    UPDATE public.words SET dictionary_entry_id = NULL, dictionary_revision_id = NULL
      WHERE word_id = '${word}';
    COMMIT;`)
})

test('untrusted flags cannot authorize reference writes and workers cannot truncate history', async () => {
  const word = await seedWord(db)
  await assert.rejects(
    db.sql(
      asUser(
        owner,
        `
    SET request.jwt.claim.role = 'service_role';
    SET app.dictionary_write = 'true';
    UPDATE public.words SET dictionary_entry_id = '${entryId}',
      dictionary_revision_id = '${revisionId}' WHERE word_id = '${word}';`
      )
    ),
    /Dictionary references can only be changed by trusted commands/
  )
  for (const table of [
    'dictionary_cefr_heads',
    'dictionary_revisions',
    'dictionary_cefr_assessments',
  ]) {
    await assert.rejects(
      db.sql(`SET ROLE service_role; TRUNCATE public.${table} CASCADE;`),
      /42501.*permission denied/s
    )
  }
})

test('a link waiting behind retirement is rejected after the state change commits', async () => {
  const fixture = publishedEntrySql()
  await db.sql(fixture.sql)
  const word = await seedWord(db)
  await assert.rejects(
    overlap(
      db,
      `SET ROLE service_role; UPDATE public.dictionary_entries SET state = 'retired'
      WHERE entry_id = '${fixture.entry}';`,
      `SET ROLE service_role; UPDATE public.words SET dictionary_entry_id = '${fixture.entry}',
      dictionary_revision_id = '${fixture.revision}' WHERE word_id = '${word}';`
    ),
    /New dictionary references require published content/
  )
  assert.equal(
    await db.sql(`SELECT dictionary_entry_id IS NULL FROM public.words
    WHERE word_id = '${word}';`),
    't'
  )
})

test('provenance edits serialize behind first publication', async () => {
  const fixture = publishedEntrySql()
  await db.sql(approvedSourceSql(fixture.source))
  await assert.rejects(
    overlap(
      db,
      `SET ROLE service_role; ${fixture.sql.replace(approvedSourceSql(fixture.source), '')}`,
      `SET ROLE service_role; UPDATE private.dictionary_sources
      SET provenance_locator = 'fixture://changed' WHERE source_id = '${fixture.source}';`
    ),
    /Referenced dictionary provenance is immutable/
  )
})

test('head deletion cannot race a draft entry into publication without a head', async () => {
  const fixture = publishedEntrySql()
  // Build the reviewed revision/head without publishing the entry yet.
  await db.sql(
    fixture.sql.replace("SET state = 'published'", "SET state = 'draft'")
  )
  await assert.rejects(
    overlap(
      db,
      `SET ROLE service_role; DELETE FROM public.dictionary_entry_heads
      WHERE entry_id = '${fixture.entry}';`,
      `SET ROLE service_role; UPDATE public.dictionary_entries SET state = 'published'
      WHERE entry_id = '${fixture.entry}';`
    ),
    /Published dictionary entries require a revision head/
  )
})

test('publication requires approved matching provenance and freezes its source', async () => {
  const fixture = publishedEntrySql()
  await assert.rejects(
    db.sql(
      `BEGIN; ${fixture.sql.replace(
        approvedSourceSql(fixture.source),
        approvedSourceSql(fixture.source, digest('f'))
      )} COMMIT;`
    ),
    /Published dictionary revisions require matching approved provenance/
  )
  const pendingSource = `INSERT INTO private.dictionary_sources (
    source_id, source_kind, provenance_locator
  ) VALUES ('${fixture.source}', 'unknown', 'fixture://pending');`
  await assert.rejects(
    db.sql(
      `BEGIN; ${fixture.sql.replace(approvedSourceSql(fixture.source), pendingSource)} COMMIT;`
    ),
    /Published dictionary revisions require matching approved provenance/
  )
  await db.sql(fixture.sql)
  await assert.rejects(
    db.sql(`SET ROLE service_role;
    UPDATE private.dictionary_sources SET review_state = 'pending', reviewed_by = NULL,
      reviewed_at = NULL, approved_content_sha256 = NULL WHERE source_id = '${fixture.source}';`),
    /Referenced dictionary provenance is immutable/
  )
})

test('advancing discovery never adopts a personal pin or inherits CEFR for changed input', async () => {
  const fixture = publishedEntrySql()
  const word = await seedWord(db)
  const nextRevision = randomUUID()
  await db.sql(`${fixture.sql}
    UPDATE public.words SET dictionary_entry_id = '${fixture.entry}',
      dictionary_revision_id = '${fixture.revision}' WHERE word_id = '${word}';
    INSERT INTO public.dictionary_cefr_assessments (
      assessment_id, entry_id, input_sha256, cefr_level, status,
      method, method_version, source_id
    ) VALUES (
      '${nextRevision}', '${fixture.entry}', '${digest('b')}', 'A2', 'reviewed',
      'editorial', '1', '${fixture.source}'
    );
    INSERT INTO public.dictionary_cefr_heads VALUES
      ('${fixture.entry}', '${digest('b')}', '${nextRevision}', NOW());
    INSERT INTO public.dictionary_revisions (
      revision_id, entry_id, revision_no, content, content_sha256,
      cefr_input_sha256, source_id, review_status, reviewed_at, published_at
    ) VALUES ('${nextRevision}', '${fixture.entry}', 2, '{}', '${digest('a')}',
      '${digest('c')}', '${fixture.source}', 'published', NOW(), NOW());
    UPDATE public.dictionary_entry_heads SET revision_id = '${nextRevision}'
      WHERE entry_id = '${fixture.entry}';`)
  assert.equal(
    await db.sql(
      asUser(
        owner,
        `SELECT revision_id || '|' || (cefr_level IS NULL)
    FROM public.readable_dictionary_content WHERE entry_id = '${fixture.entry}';`
      )
    ),
    `${nextRevision}|true`
  )
  assert.equal(
    await db.sql(`SELECT dictionary_revision_id FROM public.words
    WHERE word_id = '${word}';`),
    fixture.revision
  )
})
