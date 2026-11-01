-- Close paid-grant lifecycle and lock-order gaps. No live configuration is seeded.
BEGIN;

-- Every public alias must establish Auth authority before entry/operation locks.
-- Keep the existing parser, receipts and business transitions in private bodies.
ALTER FUNCTION public.accept_dictionary_analysis_v2(JSONB) SET SCHEMA private;
ALTER FUNCTION private.accept_dictionary_analysis_v2(JSONB) RENAME TO accept_dictionary_analysis_before_paid_lock_v2;
REVOKE ALL ON FUNCTION private.accept_dictionary_analysis_before_paid_lock_v2(JSONB) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.accept_dictionary_analysis_v2(p_command JSONB) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_dictionary_analysis_authority(auth.uid());
  RETURN private.accept_dictionary_analysis_before_paid_lock_v2(p_command);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_dictionary_analysis_v2(JSONB) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.accept_dictionary_analysis_v2(JSONB) TO authenticated;

-- The independent entrypoint takes the same Auth-before-command-advisory order
-- as the generic alias, including exact receipt replay after role revocation.
ALTER FUNCTION public.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) SET SCHEMA private;
ALTER FUNCTION private.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[])
  RENAME TO accept_dictionary_independent_before_paid_lock_v2;
REVOKE ALL ON FUNCTION private.accept_dictionary_independent_before_paid_lock_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[])
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.accept_dictionary_independent_analysis_v2(p_command JSONB,p_model TEXT,p_version TEXT,
  p_policy_sha256 TEXT,p_semantic_model TEXT,p_prompt_sha256 TEXT,p_media_url_prefixes TEXT[]) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_dictionary_analysis_authority(auth.uid());
  RETURN private.accept_dictionary_independent_before_paid_lock_v2(p_command,p_model,p_version,p_policy_sha256,
    p_semantic_model,p_prompt_sha256,p_media_url_prefixes);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.accept_dictionary_independent_analysis_v2(JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[]) TO authenticated;

ALTER FUNCTION public.start_dictionary_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT) SET SCHEMA private;
ALTER FUNCTION private.start_dictionary_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT)
  RENAME TO start_dictionary_analysis_before_paid_lock_v1;
REVOKE ALL ON FUNCTION private.start_dictionary_analysis_before_paid_lock_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.start_dictionary_analysis_dispatch_v1(p_actor UUID,p_operation UUID,p_fence TEXT,
  p_provider TEXT,p_model TEXT,p_input_sha256 TEXT) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.lock_dictionary_analysis_authority(p_actor);
  RETURN private.start_dictionary_analysis_before_paid_lock_v1(p_actor,p_operation,p_fence,p_provider,p_model,p_input_sha256);
END;
$$;
REVOKE ALL ON FUNCTION public.start_dictionary_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_dictionary_analysis_dispatch_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- Callers already hold the cohort SHARE lock. Read the wall clock again after
-- any subsequent blocking, without introducing cohort-after-budget lock waits.
CREATE FUNCTION private.require_dictionary_paid_cohort_current(p_actor UUID,p_release UUID) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_until TIMESTAMPTZ;
BEGIN
  SELECT expires_at INTO v_until FROM private.dictionary_paid_cohort
    WHERE release_id=p_release AND user_id=p_actor AND enabled;
  IF v_until IS NULL OR v_until<=CLOCK_TIMESTAMP() THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  RETURN v_until;
END;
$$;
CREATE OR REPLACE FUNCTION private.lock_dictionary_paid_actor(p_actor UUID,p_release UUID) RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF private.lock_dictionary_analysis_authority(p_actor) IS NOT TRUE THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM private.dictionary_paid_cohort WHERE release_id=p_release AND user_id=p_actor AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM private.require_dictionary_paid_cohort_current(p_actor,p_release);
END;
$$;

-- The four business grant triggers keep the original atomic pair accounting,
-- with a final cohort-time check after waiting for the envelope lock.
ALTER FUNCTION private.grant_dictionary_paid_phase(TEXT,UUID,UUID,UUID,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
  RENAME TO grant_dictionary_paid_phase_before_lifecycle;
CREATE FUNCTION private.grant_dictionary_paid_phase(p_workflow TEXT,p_actor UUID,p_operation UUID,p_entry UUID,p_fence BIGINT,
  p_phase TEXT,p_policy TEXT,p_version TEXT,p_generation TEXT,p_judge TEXT,p_generation_key TEXT,p_judge_key TEXT) RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_release UUID;
BEGIN
  PERFORM private.grant_dictionary_paid_phase_before_lifecycle(p_workflow,p_actor,p_operation,p_entry,p_fence,
    p_phase,p_policy,p_version,p_generation,p_judge,p_generation_key,p_judge_key);
  SELECT release_id INTO STRICT v_release FROM private.dictionary_paid_attempts
    WHERE workflow=p_workflow AND entry_id=p_entry AND fence=p_fence AND phase=p_phase;
  PERFORM private.require_dictionary_paid_cohort_current(p_actor,v_release);
END;
$$;

-- Lock the business state BEFORE the envelope/paid-attempt rows. Monetary rows
-- alone are not evidence of a live provider grant. NULL deadline means no claim.
-- Accounting close remains possible after revocation or owner redaction; it does
-- not require an active entitlement and can never release a sent/unknown phase.
CREATE FUNCTION private.lock_dictionary_paid_business(p_attempt private.dictionary_paid_attempts)
RETURNS TABLE(dispatch_until TIMESTAMPTZ,terminal BOOLEAN)
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_op private.dictionary_analysis_operations%ROWTYPE;
  v_lease private.dictionary_analysis_leases%ROWTYPE;
  v_check private.dictionary_semantic_checks%ROWTYPE;
  v_run private.dictionary_creation_runs%ROWTYPE;
  v_creation_lease private.dictionary_creation_leases%ROWTYPE;
  v_phase_status TEXT;
  v_phase_until TIMESTAMPTZ;
  v_owner_deleted BOOLEAN;
BEGIN
  PERFORM private.lock_dictionary_analysis_authority(p_attempt.actor_id);
  v_owner_deleted:=p_attempt.actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_attempt.actor_id);
  dispatch_until:=NULL;
  terminal:=FALSE;
  IF p_attempt.workflow='analysis' THEN
    SELECT * INTO v_op FROM private.dictionary_analysis_operations
      WHERE actor_id=p_attempt.actor_id AND operation_id=p_attempt.operation_id;
    IF NOT FOUND THEN
      -- Analysis journals cascade only with Auth deletion; ledger liabilities do not.
      terminal:=v_owner_deleted;
      RETURN NEXT; RETURN;
    END IF;
    v_op:=private.lock_dictionary_analysis_operation(p_attempt.actor_id,p_attempt.operation_id,p_attempt.fence::TEXT);
    IF ROW(v_op.entry_id,v_op.fence,v_op.planned_validator_version,v_op.planned_policy_sha256)
      IS DISTINCT FROM ROW(p_attempt.entry_id,p_attempt.fence,p_attempt.validator_version,p_attempt.policy_sha256)
      THEN RAISE EXCEPTION 'paid-attempt-conflict'; END IF;
    terminal:=v_op.status IN ('published','no-change','rejected','head-conflict','authorization-revoked','provider-failed');
    SELECT * INTO v_lease FROM private.dictionary_analysis_leases WHERE entry_id=v_op.entry_id;
    IF NOT terminal AND ROW(v_lease.actor_id,v_lease.operation_id,v_lease.fence)
      IS NOT DISTINCT FROM ROW(v_op.actor_id,v_op.operation_id,v_op.fence) THEN
      IF p_attempt.phase='generation' AND v_op.status='dispatching' AND v_op.model=p_attempt.model THEN
        dispatch_until:=v_lease.expires_at;
      ELSIF p_attempt.phase='judgement' AND v_op.status='validating' THEN
        SELECT * INTO v_check FROM private.dictionary_semantic_checks
          WHERE actor_id=v_op.actor_id AND operation_id=v_op.operation_id FOR UPDATE;
        IF FOUND AND v_check.status='dispatching' AND v_check.fence=v_op.fence AND v_check.model=p_attempt.model THEN
          dispatch_until:=LEAST(v_lease.expires_at,v_check.dispatched_at+INTERVAL '2 minutes');
        END IF;
      END IF;
    END IF;
  ELSE
    SELECT * INTO v_run FROM private.dictionary_creation_runs WHERE entry_id=p_attempt.entry_id AND fence=p_attempt.fence;
    IF NOT FOUND THEN RETURN NEXT; RETURN; END IF;
    v_run:=private.lock_dictionary_creation_run(v_run.run_id,p_attempt.fence::TEXT);
    IF ROW(v_run.operation_id,v_run.validator_version,v_run.policy_sha256)
      IS DISTINCT FROM ROW(p_attempt.operation_id,p_attempt.validator_version,p_attempt.policy_sha256)
      OR (v_run.actor_id IS DISTINCT FROM p_attempt.actor_id AND NOT (v_owner_deleted AND v_run.actor_id IS NULL))
      THEN RAISE EXCEPTION 'paid-attempt-conflict'; END IF;
    terminal:=v_owner_deleted OR v_run.status IN ('published','rejected','provider-failed','authorization-revoked','review-required');
    SELECT * INTO v_creation_lease FROM private.dictionary_creation_leases WHERE entry_id=v_run.entry_id FOR UPDATE;
    IF NOT terminal AND ROW(v_creation_lease.run_id,v_creation_lease.actor_id,v_creation_lease.operation_id,v_creation_lease.fence)
      IS NOT DISTINCT FROM ROW(v_run.run_id,v_run.actor_id,v_run.operation_id,v_run.fence)
      AND NOT EXISTS(SELECT 1 FROM private.dictionary_creation_runs WHERE entry_id=v_run.entry_id AND fence>v_run.fence) THEN
      IF p_attempt.phase='generation' AND v_run.status='dispatching' THEN
        SELECT status,dispatched_at+INTERVAL '2 minutes' INTO v_phase_status,v_phase_until
          FROM private.dictionary_creation_generation_attempts WHERE run_id=v_run.run_id AND model=p_attempt.model FOR UPDATE;
      ELSIF p_attempt.phase='judgement' AND v_run.status='validating' THEN
        SELECT status,dispatched_at+INTERVAL '2 minutes' INTO v_phase_status,v_phase_until
          FROM private.dictionary_creation_judge_attempts WHERE run_id=v_run.run_id AND model=p_attempt.model FOR UPDATE;
      END IF;
      IF v_phase_status='dispatching' THEN dispatch_until:=v_phase_until; END IF;
    END IF;
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_dictionary_paid_attempt_v1(p_actor UUID,p_invocation_key TEXT,p_model TEXT,p_binding_sha256 TEXT,
  p_request_sha256 TEXT,p_request_bytes INTEGER,p_output_tokens INTEGER) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempt private.dictionary_paid_attempts%ROWTYPE;
  v_release private.dictionary_paid_releases%ROWTYPE;
  v_phase_until TIMESTAMPTZ;
  v_cohort_until TIMESTAMPTZ;
  v_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE actor_id=p_actor AND invocation_key=p_invocation_key;
  SELECT b.dispatch_until INTO v_phase_until FROM private.lock_dictionary_paid_business(v_attempt) b;
  PERFORM private.lock_dictionary_paid_actor(p_actor,v_attempt.release_id);
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND analysis_operations_enabled AND analysis_publication_enabled
    AND semantic_checks_enabled AND (v_attempt.workflow='analysis' OR (creation_resolution_enabled AND creation_operations_enabled
      AND creation_dispatch_enabled AND creation_judgement_enabled AND creation_publication_enabled)) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'paid-dispatch-unavailable'; END IF;
  PERFORM 1 FROM private.dictionary_analysis_validator_policies WHERE validator_version=v_attempt.validator_version
    AND policy_sha256=v_attempt.policy_sha256 AND enabled
    AND (CASE v_attempt.phase WHEN 'generation' THEN generation_model ELSE semantic_model END)=v_attempt.model
    AND (CASE v_attempt.phase WHEN 'generation' THEN COALESCE(generation_model_version,generation_model)
      ELSE COALESCE(semantic_model_version,semantic_model) END)=v_attempt.limits->>'model_version' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'paid-dispatch-unavailable'; END IF;
  SELECT * INTO STRICT v_release FROM private.dictionary_paid_releases WHERE release_id=v_attempt.release_id FOR UPDATE;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=v_attempt.attempt_id FOR UPDATE;
  IF v_attempt.actor_id IS DISTINCT FROM p_actor OR v_attempt.model IS DISTINCT FROM p_model
    OR v_release.binding_sha256 IS DISTINCT FROM p_binding_sha256 OR p_request_sha256 IS NULL OR p_request_sha256 !~ '^[0-9a-f]{64}$'
    THEN RAISE EXCEPTION 'paid-attempt-conflict'; END IF;
  IF v_attempt.request_sha256 IS NOT NULL AND v_attempt.request_sha256<>p_request_sha256 THEN RAISE EXCEPTION 'paid-attempt-conflict'; END IF;
  IF v_attempt.state<>'granted' THEN RETURN JSONB_BUILD_OBJECT('allowed',FALSE); END IF;
  v_cohort_until:=private.require_dictionary_paid_cohort_current(p_actor,v_release.release_id);
  v_until:=LEAST(v_release.valid_until,v_cohort_until,v_phase_until);
  IF v_phase_until IS NULL OR v_until<=CLOCK_TIMESTAMP() OR NOT v_release.enabled OR v_release.valid_from>CLOCK_TIMESTAMP()
    OR p_request_bytes IS NULL OR p_request_bytes NOT BETWEEN 1 AND (v_attempt.limits->>'max_request_bytes')::INTEGER
    OR p_output_tokens IS NULL OR p_output_tokens NOT BETWEEN 1 AND (v_attempt.limits->>'max_output_tokens')::INTEGER
    THEN RAISE EXCEPTION 'paid-dispatch-unavailable'; END IF;
  UPDATE private.dictionary_paid_attempts SET state='sent',request_sha256=p_request_sha256 WHERE attempt_id=v_attempt.attempt_id;
  RETURN JSONB_BUILD_OBJECT('allowed',TRUE,'attempt_id',v_attempt.attempt_id,'expires_at',v_until,
    'request_sha256',p_request_sha256,'invocation_key',v_attempt.invocation_key,'model',v_attempt.model,'binding_sha256',v_release.binding_sha256);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_dictionary_paid_unissued_v1(p_attempt UUID,p_evidence_sha256 TEXT) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE; v_terminal BOOLEAN;
BEGIN
  IF p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-paid-evidence'; END IF;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt;
  SELECT b.terminal INTO v_terminal FROM private.lock_dictionary_paid_business(v_attempt) b;
  PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_attempt.release_id FOR UPDATE;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt FOR UPDATE;
  IF v_attempt.state='closed' AND v_attempt.evidence_sha256=p_evidence_sha256 THEN RETURN; END IF;
  IF v_attempt.state NOT IN ('reserved','granted') OR v_attempt.request_sha256 IS NOT NULL THEN RAISE EXCEPTION 'paid-attempt-not-unissued'; END IF;
  IF v_terminal IS NOT TRUE THEN RAISE EXCEPTION 'paid-business-not-terminal'; END IF;
  UPDATE private.dictionary_paid_releases SET held_nanousd=held_nanousd-v_attempt.reserved_nanousd WHERE release_id=v_attempt.release_id;
  UPDATE private.dictionary_paid_attempts SET state='closed',evidence_sha256=p_evidence_sha256 WHERE attempt_id=p_attempt;
END;
$$;

-- Publication is serialized with an envelope stop. If stop wins the row lock,
-- publication sees disabled; if publication wins, stop waits for its commit.
CREATE OR REPLACE FUNCTION private.guard_dictionary_paid_publication() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_actor UUID; v_entry UUID; v_fence BIGINT; v_workflow TEXT; v_release UUID;
BEGIN
  IF TG_TABLE_NAME='dictionary_analysis_operations' THEN
    v_actor:=NEW.actor_id;v_entry:=NEW.entry_id;v_fence:=NEW.fence;v_workflow:='analysis';
  ELSIF TG_TABLE_NAME='dictionary_creation_runs' THEN
    v_actor:=NEW.actor_id;v_entry:=NEW.entry_id;v_fence:=NEW.fence;v_workflow:='creation';
  ELSIF TG_TABLE_NAME='dictionary_analysis_publications' THEN
    SELECT actor_id,entry_id,fence INTO v_actor,v_entry,v_fence FROM private.dictionary_analysis_validations WHERE validation_id=NEW.validation_id;
    v_workflow:='analysis';
  ELSE
    SELECT r.actor_id,r.entry_id,r.fence INTO v_actor,v_entry,v_fence FROM private.dictionary_creation_validations v JOIN private.dictionary_creation_runs r USING(run_id) WHERE v.validation_id=NEW.validation_id;
    v_workflow:='creation';
  END IF;
  SELECT release_id INTO v_release FROM private.dictionary_paid_attempts WHERE workflow=v_workflow AND entry_id=v_entry AND fence=v_fence AND phase='generation';
  PERFORM private.lock_dictionary_paid_actor(v_actor,v_release);
  PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_release AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  PERFORM private.require_dictionary_paid_cohort_current(v_actor,v_release);
  IF (SELECT COUNT(*) FROM private.dictionary_paid_attempts WHERE workflow=v_workflow AND entry_id=v_entry AND fence=v_fence AND state='settled')<>2
    THEN RAISE EXCEPTION 'paid-accounting-required'; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.require_dictionary_paid_cohort_current(UUID,UUID),
  private.lock_dictionary_paid_business(private.dictionary_paid_attempts),
  private.grant_dictionary_paid_phase(TEXT,UUID,UUID,UUID,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  private.grant_dictionary_paid_phase_before_lifecycle(TEXT,UUID,UUID,UUID,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
