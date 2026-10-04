-- Optional owner-run report for the specific application database only.
-- Run with an existing project-scoped SQL connection that can read all owners.
-- Do not create credentials or grant broader access for this report.
-- SELECT-only report; no personal text, owner IDs or word IDs leave the database.
-- Not yet executed against production. If schema preflight differs, stop and
-- adapt the report after reviewing the current schema. Do not apply migrations.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';

-- Schema evidence, not row data. Record whether CEFR/provenance columns exist.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('words', 'word_analysis_cache')
  AND (column_name ILIKE '%cefr%' OR column_name ILIKE '%source%'
    OR column_name ILIKE '%provenance%' OR column_name ILIKE '%dictionary%')
ORDER BY table_name, ordinal_position;

-- Tuple grouping follows current SQL uniqueness, not the broader JS trim/lower
-- normalization. Translation variants are a conflict proxy, not a sense count.
WITH active_words AS MATERIALIZED (
  SELECT lower(dutch_lemma) AS lemma,
    coalesce(part_of_speech, 'unknown') AS pos,
    coalesce(article, '') AS article,
    translations, user_id
  FROM public.words WHERE deleted_at IS NULL
), cache AS MATERIALIZED (
  SELECT lower(dutch_lemma) AS lemma,
    coalesce(part_of_speech, 'unknown') AS pos,
    coalesce(article, '') AS article,
    translations,
    cache_version = 2 AND last_used_at >= now() - interval '180 days' AS eligible
  FROM public.word_analysis_cache
), candidates AS (
  SELECT lemma, pos, article, count(*) AS copies,
    count(DISTINCT translations) AS translation_variants
  FROM active_words GROUP BY lemma, pos, article
), coverage AS (
  SELECT w.*,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma, c.pos, c.article) =
      (w.lemma, w.pos, w.article)) AS key_match,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma, c.pos, c.article) =
      (w.lemma, w.pos, w.article) AND c.eligible) AS eligible_match,
    EXISTS (SELECT 1 FROM cache c WHERE (c.lemma, c.pos, c.article) =
      (w.lemma, w.pos, w.article) AND c.translations = w.translations)
      AS translation_match
  FROM active_words w
)
SELECT jsonb_build_object(
  'captured_at', now(),
  'scope', 'Visible rows only; operator must confirm all-owner read visibility',
  'active_personal_cards', (SELECT count(*) FROM active_words),
  'tombstones', (SELECT count(*) FROM public.words WHERE deleted_at IS NOT NULL),
  'owners_with_active_cards', (SELECT count(DISTINCT user_id) FROM active_words),
  'unique_sql_semantic_candidates', (SELECT count(*) FROM candidates),
  'candidates_with_multiple_copies',
    (SELECT count(*) FROM candidates WHERE copies > 1),
  'candidates_with_translation_disagreement',
    (SELECT count(*) FROM candidates WHERE translation_variants > 1),
  'cards_without_cache_key', (SELECT count(*) FROM coverage WHERE NOT key_match),
  'cards_with_eligible_cache_key',
    (SELECT count(*) FROM coverage WHERE eligible_match),
  'cards_with_exact_cache_translations',
    (SELECT count(*) FROM coverage WHERE translation_match),
  'cache_rows', (SELECT count(*) FROM cache),
  'eligible_cache_rows', (SELECT count(*) FROM cache WHERE eligible),
  'verified_private_or_public_content_counts', NULL,
  'verified_individual_cefr_coverage', NULL,
  'limitations', jsonb_build_array(
    'Spelling/POS/article and equal translations do not establish equal meanings.',
    'Provenance cannot be inferred from cache matches or shared collection access.',
    'No verified per-word CEFR contract exists in the inspected source schema.',
    'NULL means unknown, not zero; pack CEFR is not per-word CEFR.',
    'No individual words or personal identifiers are emitted.'
  )
) AS aggregate_report;

ROLLBACK;
