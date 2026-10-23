-- Read-only self permission signal. Readiness, authority grants and quota stay unchanged.
BEGIN;
CREATE FUNCTION public.dictionary_analysis_actor_v1()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_actor) THEN
    RAISE EXCEPTION 'authentication-required';
  END IF;
  RETURN JSONB_BUILD_OBJECT('protocol_version',1,'actor_id',v_actor,
    'may_analyze',private.may_analyze_dictionary(v_actor));
END;
$$;
REVOKE ALL ON FUNCTION public.dictionary_analysis_actor_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.dictionary_analysis_actor_v1() TO authenticated;
COMMIT;
