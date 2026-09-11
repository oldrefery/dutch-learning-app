-- Read-only analysis export; this is NOT a recovery backup.
-- Replace the placeholder only with the explicitly approved account email.
-- Run in the SQL editor and export the single snapshot result as CSV.
-- Keep exports in reports/vocabulary-organization/ (ignored by Git).
-- Validate matchedAccounts = 1 and reconcile card IDs/counts before analysis.
WITH owner AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('REPLACE_WITH_APPROVED_PROFILE_EMAIL')
), cards AS (
  SELECT
    w.word_id, w.collection_id, w.dutch_lemma, w.dutch_original,
    w.part_of_speech, w.article, w.translations, w.examples, w.usage_notes,
    w.analysis_notes, w.is_expression, w.expression_type, w.register,
    w.preposition, w.root_verb, w.is_reflexive, w.is_separable, w.updated_at
  FROM public.words w
  WHERE w.user_id IN (SELECT id FROM owner)
    AND w.deleted_at IS NULL
), collections AS (
  SELECT c.collection_id, c.name, c.is_shared
  FROM public.collections c
  WHERE c.user_id IN (SELECT id FROM owner)
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'capturedAt', now(),
  'purpose', 'read-only vocabulary classification; not a recovery backup',
  'matchedAccounts', (SELECT count(*) FROM owner),
  'ownerId', (SELECT id FROM owner),
  'cards', (
    SELECT coalesce(jsonb_agg(to_jsonb(cards) ORDER BY word_id), '[]'::jsonb)
    FROM cards
  ),
  'collections', (
    SELECT coalesce(jsonb_agg(to_jsonb(collections) ORDER BY collection_id), '[]'::jsonb)
    FROM collections
  )
) AS snapshot;
