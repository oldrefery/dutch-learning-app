import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCluster } from '../../../../scripts/postgres-tests/cluster.mjs'
import {
  owner,
  other,
  seedUsers,
} from '../../../../scripts/postgres-tests/fixtures.mjs'

// Disposable Unix-socket cluster only; no app .env or remote database connection.
const report = await readFile(
  new URL('./D01-owner-census.sql', import.meta.url),
  'utf8'
)
const db = await createCluster()
try {
  await seedUsers(db)
  await db.sql(`INSERT INTO public.words(word_id,user_id,dutch_lemma,translations,tts_url)
    VALUES ('aaaaaaaa-1111-4111-8111-111111111111','${owner}','audit-shared','{"en":["one"]}',''),
    ('aaaaaaaa-2222-4222-8222-222222222222','${other}','audit-shared','{"en":["two"]}',''),
    ('aaaaaaaa-3333-4333-8333-333333333333','${owner}','audit-missing','{"en":["three"]}','');
    INSERT INTO public.word_analysis_cache(dutch_lemma,dutch_original,translations,cache_version)
    VALUES ('audit-shared','audit-shared','{"en":["one"]}',2);`)
  const before = await db.sql('SELECT count(*) FROM public.words;')
  const raw = await db.sql(report)
  const lines = raw.split('\n')
  const result = JSON.parse(lines.find(line => line.startsWith('{')))
  assert.equal(result.active_personal_cards, 3)
  assert.equal(result.owners_with_active_cards, 2)
  assert.equal(result.unique_sql_semantic_candidates, 2)
  assert.equal(result.candidates_with_multiple_copies, 1)
  assert.equal(result.candidates_with_translation_disagreement, 1)
  assert.equal(result.cards_without_cache_key, 1)
  assert.equal(result.cards_with_eligible_cache_key, 2)
  assert.equal(result.cards_with_exact_cache_translations, 1)
  assert.equal(result.verified_private_or_public_content_counts, null)
  assert.equal(result.verified_individual_cefr_coverage, null)
  assert.equal(await db.sql('SELECT count(*) FROM public.words;'), before)
  assert.ok(
    !raw.includes('audit-shared') &&
      !raw.includes(owner) &&
      !raw.includes(other)
  )
  console.log(
    JSON.stringify({
      status: 'passed',
      environment: 'disposable-local-postgres',
      assertions: 12,
      productionExecuted: false,
    })
  )
} finally {
  await db.close()
}
