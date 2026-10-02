-- Read-only audit of exactly two verified priority owners plus shared cache.
-- Replace the two UUID placeholders privately; never commit the rendered SQL.
-- Invalid/missing UUIDs fail rather than expanding the scope to all owners.
-- Use existing project-scoped owner access. No credential or permission changes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';

WITH cohort(alias, user_id) AS (
  VALUES ('P1', '__P1_UUID__'::uuid), ('P2', '__P2_UUID__'::uuid)
), scoped_words AS MATERIALIZED (
  SELECT w.* FROM public.words w JOIN cohort c ON c.user_id = w.user_id
), active_words AS MATERIALIZED (
  SELECT lower(dutch_lemma) AS lemma,
    coalesce(part_of_speech, 'unknown') AS pos,
    coalesce(article, '') AS article, translations, user_id
  FROM scoped_words WHERE deleted_at IS NULL
), cache AS MATERIALIZED (
  SELECT lower(dutch_lemma) AS lemma,
    coalesce(part_of_speech, 'unknown') AS pos,
    coalesce(article, '') AS article, translations,
    cache_version = 2 AND last_used_at >= now() - interval '180 days' AS eligible
  FROM public.word_analysis_cache
), candidates AS (
  SELECT lemma, pos, article, count(*) AS copies,
    count(DISTINCT translations) AS translation_variants
  FROM active_words GROUP BY lemma, pos, article
), coverage AS (
  SELECT w.*,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma,c.pos,c.article) =
      (w.lemma,w.pos,w.article)) AS key_match,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma,c.pos,c.article) =
      (w.lemma,w.pos,w.article) AND c.eligible) AS eligible_match,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma,c.pos,c.article) =
      (w.lemma,w.pos,w.article) AND c.translations = w.translations) AS translation_match
  FROM active_words w
), per_owner AS (
  SELECT c.alias,
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id) AS identity_exists,
    (SELECT count(*) FROM active_words w WHERE w.user_id = c.user_id) AS active_cards,
    (SELECT count(*) FROM scoped_words w WHERE w.user_id = c.user_id
      AND w.deleted_at IS NOT NULL) AS tombstones,
    (SELECT count(*) FROM public.collections x WHERE x.user_id = c.user_id) AS collections,
    (SELECT count(*) FROM public.review_events x WHERE x.user_id = c.user_id) AS review_events,
    (SELECT count(*) FROM public.user_progress x WHERE x.user_id = c.user_id) AS progress_rows
  FROM cohort c
), schema_evidence AS (
  SELECT table_name, column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name IN ('words','word_analysis_cache')
    AND (column_name ILIKE '%cefr%' OR column_name ILIKE '%source%'
      OR column_name ILIKE '%provenance%' OR column_name ILIKE '%dictionary%')
)
SELECT jsonb_build_object(
  'captured_at', now(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'scope', 'Two verified priority owners; shared cache counted separately',
  'distinct_target_owners', (SELECT count(DISTINCT user_id) FROM cohort),
  'matched_auth_owners', (SELECT count(*) FROM per_owner WHERE identity_exists),
  'per_owner', (SELECT jsonb_agg(to_jsonb(p) ORDER BY alias) FROM per_owner p),
  'active_personal_cards', (SELECT count(*) FROM active_words),
  'tombstones', (SELECT count(*) FROM scoped_words WHERE deleted_at IS NOT NULL),
  'unique_sql_semantic_candidates', (SELECT count(*) FROM candidates),
  'candidates_with_multiple_copies', (SELECT count(*) FROM candidates WHERE copies > 1),
  'candidates_with_translation_disagreement',
    (SELECT count(*) FROM candidates WHERE translation_variants > 1),
  'cards_without_cache_key', (SELECT count(*) FROM coverage WHERE NOT key_match),
  'cards_with_eligible_cache_key', (SELECT count(*) FROM coverage WHERE eligible_match),
  'cards_with_exact_cache_translations', (SELECT count(*) FROM coverage WHERE translation_match),
  'shared_cache_rows', (SELECT count(*) FROM cache),
  'eligible_shared_cache_rows', (SELECT count(*) FROM cache WHERE eligible),
  'schema_evidence', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY table_name,column_name),
    '[]'::jsonb) FROM schema_evidence s),
  'verified_private_or_public_content_counts', NULL,
  'verified_individual_cefr_coverage', NULL,
  'limitations', jsonb_build_array(
    'Require two distinct target owners and two matched Auth owners before accepting results.',
    'Semantic keys and equal translations are not proof of equal meanings or public provenance.',
    'NULL means unknown, not zero; pack CEFR is not per-word CEFR.',
    'Server counts do not establish device-local pending operations or installed builds.',
    'No word text, owner IDs, emails or word IDs are emitted.'
  )
) AS aggregate_report;
ROLLBACK;
