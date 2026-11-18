-- Select one owner-scoped Review session before resolving dictionary revisions.
BEGIN;

CREATE FUNCTION public.get_web_review_bounded_snapshot(
  p_today DATE,
  p_scope TEXT,
  p_collection_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_ids UUID[];
  v_due_count INTEGER;
  v_words JSONB;
  v_collections JSONB;
  v_events JSONB;
  v_content JSONB;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_today IS NULL OR NOT pg_catalog.isfinite(p_today)
    OR p_scope IS NULL OR p_scope NOT IN ('all-due', 'collection-due', 'difficult-due')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid Review selection' USING ERRCODE = '22023';
  END IF;

  WITH eligible AS MATERIALIZED (
    SELECT w.word_id, w.next_review_date
    FROM public.words AS w
    WHERE w.user_id = v_owner AND w.deleted_at IS NULL
      AND w.next_review_date <= p_today
      AND (p_scope <> 'collection-due' OR w.collection_id IS NOT DISTINCT FROM p_collection_id)
      AND (p_scope <> 'difficult-due' OR w.easiness_factor <= 2.1)
  )
  SELECT (SELECT COUNT(*) FROM eligible),
    ARRAY(SELECT word_id FROM eligible ORDER BY next_review_date, word_id LIMIT p_limit)
  INTO v_due_count, v_ids;

  v_content := public.get_dictionary_effective_content_v2(v_ids);

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'word_id', w.word_id,
    'collection_id', w.collection_id,
    'easiness_factor', w.easiness_factor,
    'interval_days', w.interval_days,
    'last_reviewed_at', w.last_reviewed_at,
    'next_review_date', w.next_review_date,
    'repetition_count', w.repetition_count
  ) ORDER BY w.next_review_date, w.word_id), '[]'::JSONB)
  INTO v_words
  FROM public.words AS w
  WHERE w.user_id = v_owner AND w.word_id = ANY(v_ids);

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'collection_id', c.collection_id, 'name', c.name
  ) ORDER BY c.name), '[]'::JSONB)
  INTO v_collections FROM public.collections AS c WHERE c.user_id = v_owner;

  -- Preserve the same global history window and corrected values as snapshot v1.
  SELECT COALESCE(JSONB_AGG(TO_JSONB(e) ORDER BY e.reviewed_at DESC, e.event_id DESC), '[]'::JSONB)
  INTO v_events FROM (
    SELECT answered_correctly, assessment, event_id, review_mode, reviewed_at, word_id
    FROM public.effective_review_events
    WHERE user_id = v_owner
    ORDER BY reviewed_at DESC, event_id DESC
    LIMIT 5000
  ) AS e;

  RETURN JSONB_BUILD_OBJECT(
    'protocolVersion', 3, 'dictionaryContentProtocol', 2,
    'correctionsAvailable', TRUE, 'dueCount', v_due_count,
    'collections', v_collections, 'events', v_events,
    'words', v_words, 'dictionaryContent', v_content
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_web_review_bounded_snapshot(DATE, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_review_bounded_snapshot(DATE, TEXT, UUID, INTEGER)
  TO authenticated;

COMMIT;
