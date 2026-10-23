-- Dormant independent-analysis endpoint gates. No policy, role or flag is seeded.
BEGIN;
ALTER TABLE private.dictionary_analysis_validator_policies
  ADD COLUMN generation_model TEXT CHECK (generation_model IS NULL OR generation_model ~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$');
ALTER TABLE private.dictionary_analysis_operations
  ADD COLUMN planned_generation_model TEXT,
  ADD COLUMN planned_validator_version TEXT,
  ADD COLUMN planned_policy_sha256 TEXT,
  ADD CONSTRAINT dictionary_analysis_planned_policy FOREIGN KEY (planned_validator_version,planned_policy_sha256)
    REFERENCES private.dictionary_analysis_validator_policies(validator_version,policy_sha256) ON DELETE RESTRICT,
  ADD CONSTRAINT dictionary_analysis_complete_profile CHECK (
    (planned_generation_model IS NULL AND planned_validator_version IS NULL AND planned_policy_sha256 IS NULL) OR
    (planned_generation_model IS NOT NULL AND planned_validator_version IS NOT NULL AND planned_policy_sha256 IS NOT NULL));

CREATE FUNCTION private.dictionary_analysis_profile_ready(p_model TEXT,p_version TEXT,p_policy_sha256 TEXT,
  p_semantic_model TEXT,p_prompt_sha256 TEXT,p_media_url_prefixes TEXT[])
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_runtime private.dictionary_content_runtime%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  SELECT * INTO v_policy FROM private.dictionary_analysis_validator_policies
    WHERE validator_version=p_version AND policy_sha256=p_policy_sha256 FOR SHARE;
  RETURN FOUND AND v_runtime.analysis_operations_enabled AND v_runtime.analysis_publication_enabled
    AND v_runtime.semantic_checks_enabled AND v_policy.enabled AND v_policy.semantic_method='independent-gemini-v1'
    AND v_policy.generation_model IS NOT NULL
    AND ROW(v_policy.generation_model,v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes)
      IS NOT DISTINCT FROM ROW(p_model,p_semantic_model,p_prompt_sha256,p_media_url_prefixes);
END;
$$;

CREATE FUNCTION public.accept_dictionary_independent_analysis_v2(p_command JSONB,p_model TEXT,p_version TEXT,
  p_policy_sha256 TEXT,p_semantic_model TEXT,p_prompt_sha256 TEXT,p_media_url_prefixes TEXT[])
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID; v_op private.dictionary_analysis_operations%ROWTYPE; v_receipt JSONB;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF JSONB_TYPEOF(p_command->'operation_id') IS DISTINCT FROM 'string'
    OR (p_command->>'operation_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'invalid-analysis-command'; END IF;
  v_id := (p_command->>'operation_id')::UUID;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::TEXT || '/' || v_id::TEXT,0));
  SELECT * INTO v_op FROM private.dictionary_analysis_operations WHERE actor_id=v_actor AND operation_id=v_id;
  IF FOUND THEN
    -- Always preserve exact command validation and terminal receipts after revocation.
    v_receipt := public.accept_dictionary_analysis_v2(p_command);
    IF v_op.status IN ('accepted','dispatching','validating','provider-outcome-unknown')
      AND ROW(v_op.planned_generation_model,v_op.planned_validator_version,v_op.planned_policy_sha256)
        IS DISTINCT FROM ROW(p_model,p_version,p_policy_sha256) THEN RAISE EXCEPTION 'operation-profile-conflict'; END IF;
    IF v_op.status IN ('accepted','dispatching','validating','provider-outcome-unknown')
      AND NOT EXISTS(SELECT 1 FROM private.dictionary_analysis_validator_policies
        WHERE validator_version=p_version AND policy_sha256=p_policy_sha256
        AND ROW(generation_model,semantic_model,semantic_prompt_sha256,media_url_prefixes)
          IS NOT DISTINCT FROM ROW(p_model,p_semantic_model,p_prompt_sha256,p_media_url_prefixes))
      THEN RAISE EXCEPTION 'operation-profile-conflict'; END IF;
    RETURN v_receipt;
  END IF;
  IF NOT private.lock_dictionary_analysis_authority(v_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  IF private.dictionary_analysis_profile_ready(p_model,p_version,p_policy_sha256,p_semantic_model,p_prompt_sha256,p_media_url_prefixes) IS NOT TRUE
    THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  -- The existing command parser, head/anchor/lease and quota reservation run in
  -- the same transaction, after readiness and under locked authority/policy.
  v_receipt := public.accept_dictionary_analysis_v2(p_command);
  IF v_receipt ? 'outcome' THEN RETURN v_receipt; END IF;
  UPDATE private.dictionary_analysis_operations SET planned_generation_model=p_model,
    planned_validator_version=p_version,planned_policy_sha256=p_policy_sha256
    WHERE actor_id=v_actor AND operation_id=v_id;
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION public.start_dictionary_independent_analysis_dispatch_v1(p_actor UUID,p_operation UUID,p_fence TEXT,
  p_model TEXT,p_input_sha256 TEXT,p_version TEXT,p_policy_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_authorized BOOLEAN;
BEGIN
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor,p_operation,p_fence);
  IF ROW(v_op.planned_generation_model,v_op.planned_validator_version,v_op.planned_policy_sha256)
    IS DISTINCT FROM ROW(p_model,p_version,p_policy_sha256) OR v_op.planned_policy_sha256 IS NULL THEN RAISE EXCEPTION 'operation-profile-conflict'; END IF;
  IF v_op.status='accepted' AND NOT v_authorized THEN
    RETURN JSONB_BUILD_OBJECT('receipt',private.finish_dictionary_analysis(p_actor,p_operation,'authorization-revoked','analysis-permission-revoked'),'dispatch',NULL);
  END IF;
  RETURN public.start_dictionary_analysis_dispatch_v1(p_actor,p_operation,p_fence,'gemini',p_model,p_input_sha256);
END;
$$;

CREATE FUNCTION private.guard_dictionary_analysis_profile()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
BEGIN
  IF OLD.planned_policy_sha256 IS NOT NULL
    AND ROW(NEW.planned_generation_model,NEW.planned_validator_version,NEW.planned_policy_sha256)
      IS DISTINCT FROM ROW(OLD.planned_generation_model,OLD.planned_validator_version,OLD.planned_policy_sha256)
    THEN RAISE EXCEPTION 'immutable-analysis-profile'; END IF;
  IF OLD.status='accepted' AND NEW.status='dispatching' AND NEW.planned_policy_sha256 IS NOT NULL THEN
    SELECT * INTO STRICT v_policy FROM private.dictionary_analysis_validator_policies
      WHERE validator_version=NEW.planned_validator_version AND policy_sha256=NEW.planned_policy_sha256;
    IF NEW.provider IS DISTINCT FROM 'gemini' OR NEW.model IS DISTINCT FROM NEW.planned_generation_model
      OR private.dictionary_analysis_profile_ready(NEW.planned_generation_model,NEW.planned_validator_version,
        NEW.planned_policy_sha256,v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes) IS NOT TRUE
      THEN RAISE EXCEPTION 'analysis-policy-unavailable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_analysis_profile BEFORE UPDATE ON private.dictionary_analysis_operations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_analysis_profile();

CREATE FUNCTION private.guard_dictionary_analysis_bound_evidence()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  IF v_op.planned_policy_sha256 IS NOT NULL
    AND ROW(NEW.validator_version,NEW.policy_sha256) IS DISTINCT FROM ROW(v_op.planned_validator_version,v_op.planned_policy_sha256)
    THEN RAISE EXCEPTION 'operation-profile-conflict'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_analysis_bound_validation BEFORE INSERT ON private.dictionary_analysis_validations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_analysis_bound_evidence();
CREATE TRIGGER guard_dictionary_analysis_bound_judge BEFORE INSERT ON private.dictionary_semantic_checks
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_analysis_bound_evidence();
REVOKE ALL ON FUNCTION private.dictionary_analysis_profile_ready(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]),
  private.guard_dictionary_analysis_profile(),private.guard_dictionary_analysis_bound_evidence() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) TO authenticated;
REVOKE ALL ON FUNCTION public.start_dictionary_independent_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_dictionary_independent_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
COMMIT;
