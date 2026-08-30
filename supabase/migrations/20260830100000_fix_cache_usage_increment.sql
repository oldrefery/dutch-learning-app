-- Increment exactly one semantic cache entry atomically.
-- The legacy TEXT overload is retained for backward compatibility, while new
-- clients must use the UUID overload to avoid incrementing multiple variants.

CREATE OR REPLACE FUNCTION public.increment_cache_usage(p_cache_id UUID)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.word_analysis_cache
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE cache_id = p_cache_id;
$$;

REVOKE ALL ON FUNCTION public.increment_cache_usage(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_cache_usage(UUID)
TO service_role;

COMMENT ON FUNCTION public.increment_cache_usage(UUID) IS
  'Atomically increments usage metadata for one cache entry. Service role only.';
