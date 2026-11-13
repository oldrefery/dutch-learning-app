-- Local rehearsal only. This file is not a deployment migration.
CREATE FUNCTION public.d14_read_personal_words(
  p_word_ids UUID[] DEFAULT NULL,
  p_since_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_after_updated_at TIMESTAMPTZ DEFAULT NULL,
  p_after_word_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
)
RETURNS SETOF public.words
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_rows public.words[];
  v_following_ids UUID[];
  v_effective JSONB;
  v_result RECORD;
  v_content_columns CONSTANT TEXT[] := ARRAY[
    -- Keep lemma, part of speech and article as the personal storage key.
    -- The v2 cache provides the published values for display.
    'dutch_original', 'translations',
    'examples', 'is_irregular', 'is_reflexive', 'is_expression', 'expression_type',
    'is_separable', 'prefix_part', 'root_verb', 'plural', 'register', 'synonyms',
    'antonyms', 'conjugation', 'preposition', 'analysis_notes', 'usage_notes',
    'image_url', 'tts_url'
  ];
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000
    OR CARDINALITY(p_word_ids) > 1000
    OR ((p_after_updated_at IS NULL) <> (p_after_word_id IS NULL)) THEN
    RAISE EXCEPTION 'invalid-linked-read-page' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY_AGG(page.word ORDER BY (page.word).updated_at, (page.word).word_id)
  INTO v_rows
  FROM (
    SELECT w AS word
    FROM public.words AS w
    WHERE w.user_id = v_owner
      AND (p_word_ids IS NULL OR w.word_id = ANY(p_word_ids))
      AND (p_since_updated_at IS NULL OR w.updated_at >= p_since_updated_at)
      AND (p_after_updated_at IS NULL OR
        (w.updated_at, w.word_id) > (p_after_updated_at, p_after_word_id))
    ORDER BY w.updated_at, w.word_id
    LIMIT p_limit
  ) AS page;

  IF v_rows IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(w.word_id)
  INTO v_following_ids
  FROM UNNEST(v_rows) AS w
  WHERE w.dictionary_content_mode = 'follow' AND w.deleted_at IS NULL;

  IF v_following_ids IS NOT NULL THEN
    v_effective := public.get_dictionary_effective_content_v2(v_following_ids);
  END IF;

  -- Expand each v2 array once. A revision shared by several cards gets one overlay.
  FOR v_result IN
    WITH cards AS MATERIALIZED (
      SELECT item->>'word_id' AS word_id,
        item#>>'{reference,entry_id}' AS entry_id,
        item#>>'{reference,revision_id}' AS revision_id
      FROM JSONB_ARRAY_ELEMENTS(v_effective->'cards') AS item
      WHERE item->>'mode' = 'follow'
    ), revisions AS MATERIALIZED (
      SELECT item->>'entry_id' AS entry_id, item->>'revision_id' AS revision_id,
        overlay.content
      FROM JSONB_ARRAY_ELEMENTS(v_effective->'revisions') AS item
      CROSS JOIN LATERAL (
        SELECT JSONB_OBJECT_AGG(field, item->'content'->field) AS content
        FROM UNNEST(v_content_columns) AS field
      ) AS overlay
      WHERE item->>'review_status' = 'published'
        AND NULLIF(item->'content'->>'dutch_lemma', '') IS NOT NULL
    ), resolved AS (
      SELECT c.word_id, r.content
      FROM cards AS c
      JOIN revisions AS r USING (entry_id, revision_id)
    )
    SELECT CASE WHEN resolved.content IS NULL THEN (p.word)::public.words
             ELSE JSONB_POPULATE_RECORD(p.word, resolved.content)
           END AS word,
           (p.word).dictionary_content_mode = 'follow' AND (p.word).deleted_at IS NULL
             AND resolved.content IS NULL AS missing_head
    FROM (SELECT w AS word FROM UNNEST(v_rows) AS w) AS p
    LEFT JOIN resolved ON resolved.word_id = (p.word).word_id::TEXT
      AND (p.word).dictionary_content_mode = 'follow' AND (p.word).deleted_at IS NULL
    ORDER BY (p.word).updated_at, (p.word).word_id
  LOOP
    -- PL/pgSQL buffers the set. If any active linked row is unresolved, fail the page.
    IF v_result.missing_head THEN
      RAISE EXCEPTION 'missing-dictionary-head';
    END IF;
    RETURN NEXT v_result.word;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.d14_read_personal_words(UUID[], TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.d14_read_personal_words(UUID[], TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER)
TO authenticated;
