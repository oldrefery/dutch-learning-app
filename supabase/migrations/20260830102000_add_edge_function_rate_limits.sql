-- Durable per-user quotas for cost-bearing Edge Function operations.

CREATE TABLE public.edge_function_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK (
    capability IN ('gemini-analysis', 'image-search')
  ),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, capability)
);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.edge_function_rate_limits
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.edge_function_rate_limits
TO service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_function_quota(
  p_user_id UUID,
  p_capability TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_started_at TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_capability NOT IN ('gemini-analysis', 'image-search') THEN
    RAISE EXCEPTION 'Unsupported Edge Function capability';
  END IF;

  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Quota limit must be between 1 and 1000';
  END IF;

  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Quota window must be between 1 and 86400 seconds';
  END IF;

  INSERT INTO public.edge_function_rate_limits (
    user_id,
    capability,
    window_started_at,
    request_count,
    updated_at
  ) VALUES (
    p_user_id,
    p_capability,
    v_now,
    0,
    v_now
  )
  ON CONFLICT (user_id, capability) DO NOTHING;

  SELECT limits.window_started_at, limits.request_count
  INTO v_window_started_at, v_request_count
  FROM public.edge_function_rate_limits AS limits
  WHERE limits.user_id = p_user_id
    AND limits.capability = p_capability
  FOR UPDATE;

  IF v_window_started_at + make_interval(secs => p_window_seconds) <= v_now
  THEN
    v_window_started_at := v_now;
    v_request_count := 0;
  END IF;

  IF v_request_count >= p_limit THEN
    allowed := FALSE;
    remaining := 0;
    retry_after_seconds := GREATEST(
      1,
      CEIL(
        EXTRACT(
          EPOCH FROM (
            v_window_started_at
            + make_interval(secs => p_window_seconds)
            - v_now
          )
        )
      )::INTEGER
    );
    RETURN NEXT;
    RETURN;
  END IF;

  v_request_count := v_request_count + 1;

  UPDATE public.edge_function_rate_limits
  SET
    window_started_at = v_window_started_at,
    request_count = v_request_count,
    updated_at = v_now
  WHERE user_id = p_user_id
    AND capability = p_capability;

  allowed := TRUE;
  remaining := GREATEST(0, p_limit - v_request_count);
  retry_after_seconds := 0;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_function_quota(
  UUID,
  TEXT,
  INTEGER,
  INTEGER
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_edge_function_quota(
  UUID,
  TEXT,
  INTEGER,
  INTEGER
)
TO service_role;

COMMENT ON TABLE public.edge_function_rate_limits IS
  'Server-managed fixed-window counters for cost-bearing Edge Functions.';

COMMENT ON FUNCTION public.consume_edge_function_quota IS
  'Atomically consumes one per-user Edge Function quota unit. Service role only.';
