import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCluster } from '../../../../scripts/postgres-tests/cluster.mjs'
import {
  owner,
  other,
  seedUsers,
} from '../../../../scripts/postgres-tests/fixtures.mjs'

const template = await readFile(
  new URL('./D01-cohort-census.sql', import.meta.url),
  'utf8'
)
const render = (p1, p2) =>
  template.replace('__P1_UUID__', p1).replace('__P2_UUID__', p2)
const excluded = '33333333-3333-4333-8333-333333333333'
const absent = '44444444-4444-4444-8444-444444444444'
const db = await createCluster()
let assertions = 0
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected)
  assertions++
}
const parse = raw =>
  JSON.parse(raw.split('\n').find(line => line.startsWith('{')))
try {
  await seedUsers(db)
  await db.sql(`INSERT INTO auth.users(id,email) VALUES ('${excluded}','excluded@example.invalid');
    INSERT INTO public.words(user_id,dutch_lemma,translations,tts_url,deleted_at) VALUES
    ('${owner}','audit-shared','{"en":["one"]}','',NULL),
    ('${other}','audit-shared','{"en":["two"]}','',NULL),
    ('${owner}','audit-missing','{"en":["three"]}','',NULL),
    ('${owner}','audit-deleted','{}','',now()),
    ('${excluded}','excluded-only','{"en":["private"]}','',NULL),
    ('${excluded}','audit-shared','{"en":["excluded variant"]}','',now());
    INSERT INTO public.word_analysis_cache(dutch_lemma,dutch_original,translations,cache_version)
    VALUES ('audit-shared','audit-shared','{"en":["one"]}',2);`)
  const snapshot = () =>
    db.sql(
      `SELECT jsonb_agg(to_jsonb(w) ORDER BY word_id) FROM public.words w;`
    )
  const before = await snapshot()
  const raw = await db.sql(render(owner, other))
  const r = parse(raw)
  equal(r.transaction_read_only, 'on')
  equal(r.distinct_target_owners, 2)
  equal(r.matched_auth_owners, 2)
  equal(r.active_personal_cards, 3)
  equal(r.tombstones, 1)
  equal(r.unique_sql_semantic_candidates, 2)
  equal(r.candidates_with_multiple_copies, 1)
  equal(r.candidates_with_translation_disagreement, 1)
  equal(r.cards_without_cache_key, 1)
  equal(r.cards_with_eligible_cache_key, 2)
  equal(r.cards_with_exact_cache_translations, 1)
  equal(r.shared_cache_rows, 1)
  equal(
    r.per_owner.map(p => [
      p.alias,
      p.active_cards,
      p.tombstones,
      p.review_events,
    ]),
    [
      ['P1', 2, 1, 0],
      ['P2', 1, 0, 0],
    ]
  )
  equal(r.verified_private_or_public_content_counts, null)
  equal(r.verified_individual_cefr_coverage, null)
  equal(await snapshot(), before)
  equal(
    [
      owner,
      other,
      excluded,
      'audit-shared',
      'excluded-only',
      '@example.invalid',
    ].some(value => raw.includes(value)),
    false
  )
  const missing = parse(await db.sql(render(owner, absent)))
  equal(missing.matched_auth_owners, 1)
  equal(missing.per_owner[1].active_cards, 0)
  equal(parse(await db.sql(render(owner, owner))).distinct_target_owners, 1)
  await assert.rejects(db.sql(template), /invalid input syntax/)
  assertions++
  await assert.rejects(
    db.sql(
      `BEGIN READ ONLY; UPDATE public.words SET dutch_lemma='forbidden'; ROLLBACK;`
    ),
    /read-only/
  )
  assertions++
  equal(await snapshot(), before)
  console.log(
    JSON.stringify({
      status: 'passed',
      assertions,
      environment: 'disposable-local-postgres',
      productionExecuted: false,
    })
  )
} finally {
  await db.close()
}
