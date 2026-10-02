import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { assertQaRoot, assertQaFixture } from './D08-qa-paths.mjs'

const stack = assertQaRoot(process.argv[2], 'qa')
const fixture = JSON.parse(
  readFileSync(assertQaFixture(process.argv[3]), 'utf8')
)
assert.equal(fixture.project, basename(stack))
assert.equal(fixture.apiUrl, 'http://127.0.0.1:55321')
const database = `supabase_db_${fixture.project}`
const inspection = JSON.parse(
  execFileSync('docker', ['inspect', database], { encoding: 'utf8' })
)[0]
assert.equal(
  inspection.Config.Labels['com.supabase.cli.project'],
  fixture.project
)
const sql = input =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      database,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-XqAt',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8' }
  ).trim()
const literal = value => `'${String(value).replaceAll("'", "''")}'`
for (const owner of [fixture.primary, fixture.isolated]) {
  assert.match(owner.userId, /^[0-9a-f-]{36}$/)
  assert.match(
    owner.email,
    /^d08-(primary|isolated)-[0-9a-f-]+@example\.invalid$/
  )
  assert.equal(
    sql(`SELECT email FROM auth.users WHERE id=${literal(owner.userId)}::uuid`),
    owner.email
  )
}
const action = process.argv[4]
if (action === 'snapshot') {
  const owners = [fixture.primary.userId, fixture.isolated.userId]
    .map(literal)
    .join(',')
  const learning = JSON.parse(
    sql(
      `SELECT COALESCE(json_agg(row ORDER BY word_id), '[]') FROM (SELECT word_id, user_id, collection_id, deleted_at, interval_days, repetition_count, easiness_factor, next_review_date, last_reviewed_at FROM public.words WHERE user_id IN (${owners})) row`
    )
  )
  const content = JSON.parse(
    sql(
      `SELECT COALESCE(json_agg(row ORDER BY word_id), '[]') FROM (SELECT * FROM public.word_content_state WHERE user_id IN (${owners})) row`
    )
  )
  const output = process.argv[5]
  assert.match(output, /^reports\/shared-dictionary-cefr\/D09-[a-z-]+\.json$/)
  writeFileSync(output, JSON.stringify({ learning, content }, null, 2) + '\n', {
    mode: 0o600,
  })
  console.log(JSON.stringify({ action, output, words: learning.length }))
} else {
  assert.equal(action, 'advance-fixture-revision')
  const row = JSON.parse(
    sql(
      `SELECT row_to_json(r) FROM (SELECT revision.* FROM public.words state JOIN public.dictionary_revisions revision ON revision.revision_id=state.dictionary_revision_id JOIN private.dictionary_sources source ON source.source_id=revision.source_id WHERE state.word_id=${literal(fixture.primary.estimatedWordId)}::uuid AND state.user_id=${literal(fixture.primary.userId)}::uuid AND source.reviewed_by=state.user_id AND source.provenance_locator LIKE 'fixture://%') r`
    )
  )
  const content = {
    ...row.content,
    translations: { ...row.content.translations, en: ['D09 updated bicycle'] },
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(content))
    .digest('hex')
  const revisionId = randomUUID()
  const sourceId = randomUUID()
  sql(`BEGIN;
    INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator, review_state, reviewed_by, reviewed_at, approved_content_sha256) VALUES (${literal(sourceId)}::uuid, 'editorial', ${literal(`fixture://d09/${sourceId}`)}, 'approved', ${literal(fixture.primary.userId)}::uuid, now(), ${literal(digest)});
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, schema_version, content, content_sha256, cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
    SELECT ${literal(revisionId)}::uuid, ${literal(row.entry_id)}::uuid, max(revision_no)+1, 1, ${literal(JSON.stringify(content))}::jsonb, ${literal(digest)}, ${literal(digest)}, ${literal(sourceId)}::uuid, 'published', now(), now() FROM public.dictionary_revisions WHERE entry_id=${literal(row.entry_id)}::uuid;
    UPDATE public.dictionary_entry_heads SET revision_id=${literal(revisionId)}::uuid WHERE entry_id=${literal(row.entry_id)}::uuid;
    COMMIT;`)
  console.log(
    JSON.stringify({
      action,
      revisionId,
      entryId: row.entry_id,
      translation: content.translations.en[0],
    })
  )
}
