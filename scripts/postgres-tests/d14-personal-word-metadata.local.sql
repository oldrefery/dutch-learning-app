-- Local rehearsal only. This is not a deployment migration.
CREATE FUNCTION public.d14_read_personal_metadata_v1(
  p_word_ids uuid[] DEFAULT NULL,
  p_since_updated_at timestamptz DEFAULT NULL,
  p_after_updated_at timestamptz DEFAULT NULL,
  p_after_word_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (updated_at timestamptz, word_id uuid, payload jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
    OR cardinality(p_word_ids) > 500
    OR ((p_after_updated_at IS NULL) <> (p_after_word_id IS NULL)) THEN
    RAISE EXCEPTION 'invalid-personal-page' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT w.updated_at, w.word_id,
    CASE WHEN w.dictionary_content_mode = 'legacy' AND w.deleted_at IS NULL
      THEN to_jsonb(w)
      ELSE jsonb_build_object(
        'word_id', w.word_id, 'user_id', w.user_id, 'collection_id', w.collection_id,
        'created_at', w.created_at, 'updated_at', w.updated_at, 'deleted_at', w.deleted_at,
        'dutch_lemma', w.dutch_lemma, 'part_of_speech', w.part_of_speech, 'article', w.article,
        'interval_days', w.interval_days, 'repetition_count', w.repetition_count,
        'easiness_factor', w.easiness_factor, 'next_review_date', w.next_review_date,
        'last_reviewed_at', w.last_reviewed_at,
        'dictionary_content_mode', w.dictionary_content_mode,
        'dictionary_entry_id', w.dictionary_entry_id, 'dictionary_revision_id', w.dictionary_revision_id
      )
    END || jsonb_build_object('content_version', coalesce(s.content_version, 0)::text)
  FROM public.words w
  LEFT JOIN public.word_content_state s ON s.word_id = w.word_id AND s.user_id = w.user_id
  WHERE w.user_id = auth.uid()
    AND (p_word_ids IS NULL OR w.word_id = ANY(p_word_ids))
    AND (p_since_updated_at IS NULL OR w.updated_at >= p_since_updated_at)
    AND (p_after_updated_at IS NULL OR (w.updated_at, w.word_id) > (p_after_updated_at, p_after_word_id))
  ORDER BY w.updated_at, w.word_id
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.d14_read_personal_metadata_v1(uuid[],timestamptz,timestamptz,uuid,integer)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.d14_read_personal_metadata_v1(uuid[],timestamptz,timestamptz,uuid,integer)
TO authenticated;

-- Bind the personal metadata and the effective dictionary batch to one read snapshot.
CREATE FUNCTION public.d14_read_following_bootstrap_v1(p_word_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF p_word_ids IS NULL OR cardinality(p_word_ids) NOT BETWEEN 1 AND 400 THEN
    RAISE EXCEPTION 'invalid-following-bootstrap-request' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_rows
  FROM public.d14_read_personal_metadata_v1(p_word_ids) m
  WHERE m.payload->>'dictionary_content_mode' = 'follow'
    AND m.payload->>'deleted_at' IS NULL;

  IF jsonb_array_length(v_rows) <> cardinality(p_word_ids) THEN
    RAISE EXCEPTION 'incomplete-following-bootstrap' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'snapshot', public.get_dictionary_effective_content_v2(p_word_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.d14_read_following_bootstrap_v1(uuid[])
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.d14_read_following_bootstrap_v1(uuid[])
TO authenticated;
