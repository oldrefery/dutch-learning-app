-- A complete review setup must observe collections, words and effective events
-- from one statement snapshot. The JSON envelope also avoids REST row paging.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_web_review_snapshot_v1()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH collections_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('collection_id', c.collection_id, 'name', c.name)
        ORDER BY c.name ASC
      ),
      '[]'::JSONB
    ) AS value
    FROM public.collections AS c
    WHERE c.user_id = (SELECT auth.uid())
  ), words_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'article', w.article,
          'collection_id', w.collection_id,
          'dutch_lemma', w.dutch_lemma,
          'dutch_original', w.dutch_original,
          'easiness_factor', w.easiness_factor,
          'image_url', w.image_url,
          'interval_days', w.interval_days,
          'last_reviewed_at', w.last_reviewed_at,
          'next_review_date', w.next_review_date,
          'part_of_speech', w.part_of_speech,
          'repetition_count', w.repetition_count,
          'translations', w.translations,
          'tts_url', w.tts_url,
          'word_id', w.word_id
        )
        ORDER BY w.next_review_date ASC, w.word_id ASC
      ),
      '[]'::JSONB
    ) AS value
    FROM public.words AS w
    WHERE w.user_id = (SELECT auth.uid()) AND w.deleted_at IS NULL
  ), event_candidates AS (
    SELECT
      e.answered_correctly,
      e.assessment,
      e.event_id,
      e.review_mode,
      e.reviewed_at,
      e.word_id
    FROM public.effective_review_events AS e
    WHERE e.user_id = (SELECT auth.uid())
    ORDER BY e.reviewed_at DESC, e.event_id DESC
    LIMIT 5000
  ), events_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'answered_correctly', e.answered_correctly,
          'assessment', e.assessment,
          'event_id', e.event_id,
          'review_mode', e.review_mode,
          'reviewed_at', e.reviewed_at,
          'word_id', e.word_id
        )
        ORDER BY e.reviewed_at DESC, e.event_id DESC
      ),
      '[]'::JSONB
    ) AS value
    FROM event_candidates AS e
  )
  SELECT jsonb_build_object(
    'protocolVersion', 1,
    'correctionsAvailable', true,
    'collections', collections_json.value,
    'words', words_json.value,
    'events', events_json.value
  )
  FROM collections_json, words_json, events_json;
$$;

REVOKE ALL ON FUNCTION public.get_web_review_snapshot_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_review_snapshot_v1() TO authenticated;

COMMIT;
