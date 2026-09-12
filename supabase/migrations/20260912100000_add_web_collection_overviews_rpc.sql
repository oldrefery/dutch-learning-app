-- The collections page needs aggregate counts, not every word row. Keep this
-- invoker function subject to the caller's RLS policies and derive ownership
-- exclusively from the JWT subject.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_web_collection_overviews_v1(p_today DATE)
RETURNS TABLE (
  collection_id UUID,
  name TEXT,
  is_shared BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_words INTEGER,
  mastered_words INTEGER,
  due_words INTEGER,
  difficult_words INTEGER,
  new_words INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH owned_collections AS (
    SELECT c.collection_id, c.name, c.is_shared, c.created_at, c.updated_at
    FROM public.collections AS c
    WHERE c.user_id = (SELECT auth.uid())
  ), collection_counts AS (
    SELECT
      w.collection_id,
      COUNT(*)::INTEGER AS total_words,
      COUNT(*) FILTER (WHERE w.repetition_count >= 3)::INTEGER AS mastered_words,
      COUNT(*) FILTER (WHERE w.next_review_date <= p_today)::INTEGER AS due_words,
      COUNT(*) FILTER (WHERE w.easiness_factor <= 2.1)::INTEGER AS difficult_words,
      COUNT(*) FILTER (WHERE w.repetition_count = 0)::INTEGER AS new_words
    FROM public.words AS w
    WHERE w.user_id = (SELECT auth.uid())
      AND w.deleted_at IS NULL
      AND w.collection_id IS NOT NULL
    GROUP BY w.collection_id
  )
  SELECT
    c.collection_id,
    c.name,
    c.is_shared,
    c.created_at,
    c.updated_at,
    COALESCE(counts.total_words, 0)::INTEGER,
    COALESCE(counts.mastered_words, 0)::INTEGER,
    COALESCE(counts.due_words, 0)::INTEGER,
    COALESCE(counts.difficult_words, 0)::INTEGER,
    COALESCE(counts.new_words, 0)::INTEGER
  FROM owned_collections AS c
  LEFT JOIN collection_counts AS counts ON counts.collection_id = c.collection_id
  ORDER BY c.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_web_collection_overviews_v1(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_collection_overviews_v1(DATE) TO authenticated;

COMMIT;
