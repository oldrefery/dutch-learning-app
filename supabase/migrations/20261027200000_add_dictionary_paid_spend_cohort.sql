-- Default-empty paid-workflow containment. No actor, policy, key or budget seeded.
BEGIN;

CREATE TABLE private.dictionary_paid_releases (
  release_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  binding_sha256 TEXT NOT NULL UNIQUE CHECK (binding_sha256 ~ '^[0-9a-f]{64}$'),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL CHECK (valid_until > valid_from),
  limit_nanousd BIGINT NOT NULL CHECK (limit_nanousd > 0),
  held_nanousd BIGINT NOT NULL DEFAULT 0 CHECK (held_nanousd >= 0),
  settled_nanousd BIGINT NOT NULL DEFAULT 0 CHECK (settled_nanousd >= 0),
  call_limit INTEGER NOT NULL CHECK (call_limit > 0),
  calls_issued INTEGER NOT NULL DEFAULT 0 CHECK (calls_issued BETWEEN 0 AND call_limit),
  models JSONB NOT NULL CHECK (JSONB_TYPEOF(models) = 'object'),
  credential_revision TEXT NOT NULL CHECK (LENGTH(BTRIM(credential_revision)) BETWEEN 1 AND 200),
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  CHECK (held_nanousd::NUMERIC + settled_nanousd::NUMERIC <= limit_nanousd)
);
CREATE UNIQUE INDEX dictionary_paid_one_enabled_release ON private.dictionary_paid_releases ((TRUE)) WHERE enabled;
CREATE TABLE private.dictionary_paid_cohort (
  release_id UUID NOT NULL REFERENCES private.dictionary_paid_releases(release_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  PRIMARY KEY (release_id,user_id)
);
CREATE TABLE private.dictionary_paid_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES private.dictionary_paid_releases(release_id) ON DELETE RESTRICT,
  workflow TEXT NOT NULL CHECK (workflow IN ('analysis','creation')),
  entry_id UUID NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  phase TEXT NOT NULL CHECK (phase IN ('generation','judgement')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_id UUID NOT NULL,
  invocation_key TEXT NOT NULL CHECK (LENGTH(invocation_key) BETWEEN 1 AND 200),
  model TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  policy_sha256 TEXT NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  limits JSONB NOT NULL,
  reserved_nanousd BIGINT NOT NULL CHECK (reserved_nanousd >= 0),
  state TEXT NOT NULL CHECK (state IN ('reserved','granted','sent','settled','unknown','closed')),
  request_sha256 TEXT CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_sha256 TEXT CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  usage JSONB,
  actual_nanousd BIGINT CHECK (actual_nanousd >= 0 AND actual_nanousd <= reserved_nanousd),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  UNIQUE (workflow,entry_id,fence,phase),
  CHECK ((state = 'settled') = (actual_nanousd IS NOT NULL)),
  CHECK (state NOT IN ('sent','settled','unknown') OR request_sha256 IS NOT NULL)
);
CREATE INDEX dictionary_paid_attempt_actor_key ON private.dictionary_paid_attempts(actor_id,invocation_key);
CREATE FUNCTION private.redact_dictionary_paid_actor() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL AND OLD.state='sent' THEN
    NEW.state:='unknown';
    NEW.evidence_sha256:=private.dictionary_canonical_sha256(JSONB_BUILD_OBJECT('reason','owner-deleted'));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER redact_dictionary_paid_actor BEFORE UPDATE OF actor_id ON private.dictionary_paid_attempts
  FOR EACH ROW EXECUTE FUNCTION private.redact_dictionary_paid_actor();
CREATE TABLE private.dictionary_paid_reconciliations (
  review_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES private.dictionary_paid_attempts(attempt_id) ON DELETE RESTRICT,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_sha256 TEXT NOT NULL CHECK (review_sha256 ~ '^[0-9a-f]{64}$'),
  prior_evidence_sha256 TEXT,
  evidence_sha256 TEXT NOT NULL,
  usage JSONB NOT NULL,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  UNIQUE (attempt_id,review_sha256)
);
CREATE FUNCTION private.protect_dictionary_paid_review() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.reviewer_id IS NOT NULL AND NEW.reviewer_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.reviewer_id)
    AND (TO_JSONB(NEW)-'reviewer_id')=(TO_JSONB(OLD)-'reviewer_id') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'immutable-paid-review';
END;
$$;
CREATE TRIGGER protect_dictionary_paid_review BEFORE UPDATE OR DELETE ON private.dictionary_paid_reconciliations
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_paid_review();

CREATE FUNCTION private.dictionary_paid_model_ceiling(p_limits JSONB) RETURNS BIGINT
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_key TEXT; v_total NUMERIC;
BEGIN
  IF private.jsonb_has_exact_keys(p_limits,ARRAY['model_version','max_request_bytes','max_input_tokens','max_output_tokens',
      'input_nanousd_per_token','cached_nanousd_per_token','output_nanousd_per_token']) IS NOT TRUE
    OR JSONB_TYPEOF(p_limits->'model_version') IS DISTINCT FROM 'string'
    OR p_limits->>'model_version' !~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$' THEN RAISE EXCEPTION 'invalid-paid-model-limits'; END IF;
  FOREACH v_key IN ARRAY ARRAY['max_request_bytes','max_input_tokens','max_output_tokens',
      'input_nanousd_per_token','cached_nanousd_per_token','output_nanousd_per_token'] LOOP
    IF JSONB_TYPEOF(p_limits->v_key) IS DISTINCT FROM 'string' OR (p_limits->>v_key) !~ '^(0|[1-9][0-9]{0,18})$'
      OR (p_limits->>v_key)::NUMERIC > 9223372036854775807 THEN RAISE EXCEPTION 'invalid-paid-model-limits'; END IF;
  END LOOP;
  IF (p_limits->>'max_request_bytes')::NUMERIC NOT BETWEEN 1 AND 32768
    OR (p_limits->>'max_input_tokens')::NUMERIC NOT BETWEEN 1 AND 1000000
    OR (p_limits->>'max_input_tokens')::NUMERIC < (p_limits->>'max_request_bytes')::NUMERIC
    OR (p_limits->>'max_output_tokens')::NUMERIC NOT BETWEEN 1 AND 8192
    OR (p_limits->>'cached_nanousd_per_token')::NUMERIC > (p_limits->>'input_nanousd_per_token')::NUMERIC
    THEN RAISE EXCEPTION 'invalid-paid-model-limits'; END IF;
  v_total := (p_limits->>'max_input_tokens')::NUMERIC * (p_limits->>'input_nanousd_per_token')::NUMERIC
    + (p_limits->>'max_output_tokens')::NUMERIC * (p_limits->>'output_nanousd_per_token')::NUMERIC;
  IF v_total > 9223372036854775807 THEN RAISE EXCEPTION 'paid-money-overflow'; END IF;
  RETURN v_total::BIGINT;
END;
$$;
CREATE FUNCTION private.guard_dictionary_paid_release() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_model TEXT; v_limits JSONB;
BEGIN
  IF TG_OP='UPDATE' AND (TO_JSONB(OLD)-ARRAY['enabled','held_nanousd','settled_nanousd','calls_issued'])
    IS DISTINCT FROM (TO_JSONB(NEW)-ARRAY['enabled','held_nanousd','settled_nanousd','calls_issued'])
    THEN RAISE EXCEPTION 'immutable-paid-release'; END IF;
  IF JSONB_TYPEOF(NEW.models) IS DISTINCT FROM 'object' OR NEW.models='{}'::JSONB
    THEN RAISE EXCEPTION 'invalid-paid-model-limits'; END IF;
  FOR v_model,v_limits IN SELECT key,value FROM JSONB_EACH(NEW.models) LOOP
    IF v_model !~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$' THEN RAISE EXCEPTION 'invalid-paid-model-limits'; END IF;
    PERFORM private.dictionary_paid_model_ceiling(v_limits);
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_paid_release BEFORE INSERT OR UPDATE ON private.dictionary_paid_releases
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_release();

CREATE FUNCTION private.dictionary_paid_actor_available(p_actor UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.may_analyze_dictionary(p_actor) AND EXISTS(
    SELECT 1 FROM private.dictionary_paid_releases r JOIN private.dictionary_paid_cohort c USING(release_id)
    WHERE r.enabled AND c.user_id=p_actor AND c.enabled AND c.expires_at > CURRENT_TIMESTAMP
      AND r.valid_from <= CURRENT_TIMESTAMP AND r.valid_until > CURRENT_TIMESTAMP);
$$;
CREATE FUNCTION private.lock_dictionary_paid_actor(p_actor UUID,p_release UUID) RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF private.lock_dictionary_analysis_authority(p_actor) IS NOT TRUE THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM private.dictionary_paid_cohort WHERE release_id=p_release AND user_id=p_actor
    AND enabled AND expires_at>CLOCK_TIMESTAMP() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
END;
$$;
CREATE FUNCTION private.guard_dictionary_paid_admission() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_release UUID;
BEGIN
  SELECT release_id INTO v_release FROM private.dictionary_paid_releases WHERE enabled
    AND valid_from<=CLOCK_TIMESTAMP() AND valid_until>CLOCK_TIMESTAMP();
  IF v_release IS NULL THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  PERFORM private.lock_dictionary_paid_actor(NEW.actor_id,v_release);
  RETURN NEW;
END;
$$;
CREATE TRIGGER z_paid_analysis_admission BEFORE INSERT ON private.dictionary_analysis_operations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_admission();
CREATE TRIGGER z_paid_creation_admission BEFORE INSERT ON private.dictionary_creation_operations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_admission();
CREATE TRIGGER z_paid_meaning_admission BEFORE INSERT ON private.dictionary_meaning_requests
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_admission();

-- Both phase ceilings are reserved together at the first durable generation grant.
-- Existing entry/run locks precede the shared envelope lock; no network is involved.
CREATE FUNCTION private.grant_dictionary_paid_phase(p_workflow TEXT,p_actor UUID,p_operation UUID,p_entry UUID,p_fence BIGINT,
  p_phase TEXT,p_policy TEXT,p_version TEXT,p_generation TEXT,p_judge TEXT,p_generation_key TEXT,p_judge_key TEXT) RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_release private.dictionary_paid_releases%ROWTYPE; v_attempt private.dictionary_paid_attempts%ROWTYPE;
  v_gen BIGINT; v_judge BIGINT; v_total NUMERIC;
BEGIN
  SELECT * INTO v_release FROM private.dictionary_paid_releases WHERE enabled
    AND valid_from<=CLOCK_TIMESTAMP() AND valid_until>CLOCK_TIMESTAMP();
  IF NOT FOUND THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  PERFORM private.lock_dictionary_paid_actor(p_actor,v_release.release_id);
  SELECT * INTO STRICT v_release FROM private.dictionary_paid_releases WHERE release_id=v_release.release_id FOR UPDATE;
  IF NOT v_release.enabled OR v_release.valid_from>CLOCK_TIMESTAMP() OR v_release.valid_until<=CLOCK_TIMESTAMP()
    THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  SELECT * INTO v_attempt FROM private.dictionary_paid_attempts WHERE workflow=p_workflow AND entry_id=p_entry AND fence=p_fence AND phase=p_phase FOR UPDATE;
  IF NOT FOUND THEN
    IF p_phase<>'generation' THEN RAISE EXCEPTION 'paid-generation-reservation-required'; END IF;
    v_gen:=private.dictionary_paid_model_ceiling(v_release.models->p_generation);
    v_judge:=private.dictionary_paid_model_ceiling(v_release.models->p_judge);
    v_total:=v_gen::NUMERIC+v_judge::NUMERIC;
    IF v_total>9223372036854775807 OR v_release.held_nanousd::NUMERIC+v_release.settled_nanousd::NUMERIC+v_total>v_release.limit_nanousd
      OR v_release.calls_issued>=v_release.call_limit THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
    UPDATE private.dictionary_paid_releases SET held_nanousd=(held_nanousd::NUMERIC+v_total)::BIGINT WHERE release_id=v_release.release_id;
    INSERT INTO private.dictionary_paid_attempts(release_id,workflow,entry_id,fence,phase,actor_id,operation_id,invocation_key,model,validator_version,policy_sha256,limits,reserved_nanousd,state)
      VALUES(v_release.release_id,p_workflow,p_entry,p_fence,'generation',p_actor,p_operation,p_generation_key,p_generation,p_version,p_policy,v_release.models->p_generation,v_gen,'reserved'),
        (v_release.release_id,p_workflow,p_entry,p_fence,'judgement',p_actor,p_operation,p_judge_key,p_judge,p_version,p_policy,v_release.models->p_judge,v_judge,'reserved');
    SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE workflow=p_workflow AND entry_id=p_entry AND fence=p_fence AND phase=p_phase FOR UPDATE;
  END IF;
  IF ROW(v_attempt.release_id,v_attempt.actor_id,v_attempt.operation_id,v_attempt.validator_version,v_attempt.policy_sha256,v_attempt.model)
    IS DISTINCT FROM ROW(v_release.release_id,p_actor,p_operation,p_version,p_policy,CASE p_phase WHEN 'generation' THEN p_generation ELSE p_judge END)
    OR v_attempt.state<>'reserved' THEN RAISE EXCEPTION 'paid-attempt-conflict'; END IF;
  IF p_phase='judgement' AND NOT EXISTS(SELECT 1 FROM private.dictionary_paid_attempts
    WHERE workflow=p_workflow AND entry_id=p_entry AND fence=p_fence AND phase='generation' AND state='settled')
    THEN RAISE EXCEPTION 'paid-generation-accounting-required'; END IF;
  IF v_release.calls_issued>=v_release.call_limit THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
  -- Count committed provider permissions, including lost/unused replies. An old
  -- worker or a failed monetary claim cannot obtain extra attempt slots.
  UPDATE private.dictionary_paid_releases SET calls_issued=calls_issued+1 WHERE release_id=v_release.release_id;
  UPDATE private.dictionary_paid_attempts SET state='granted' WHERE attempt_id=v_attempt.attempt_id;
END;
$$;

CREATE FUNCTION private.guard_dictionary_paid_grant() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_actor UUID; v_operation UUID; v_entry UUID; v_fence BIGINT; v_workflow TEXT; v_phase TEXT;
  v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_run private.dictionary_creation_runs%ROWTYPE; v_op private.dictionary_analysis_operations%ROWTYPE;
  v_generation_key TEXT; v_judge_key TEXT;
BEGIN
  IF TG_TABLE_NAME='dictionary_analysis_operations' THEN
    v_op:=NEW; v_phase:='generation';
  ELSIF TG_TABLE_NAME='dictionary_semantic_checks' THEN
    SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
    v_phase:='judgement';
  ELSE
    SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=NEW.run_id;
    v_phase:=CASE TG_TABLE_NAME WHEN 'dictionary_creation_generation_attempts' THEN 'generation' ELSE 'judgement' END;
  END IF;
  IF v_run.run_id IS NULL THEN
    v_workflow:='analysis'; v_actor:=v_op.actor_id; v_operation:=v_op.operation_id; v_entry:=v_op.entry_id; v_fence:=v_op.fence;
    SELECT * INTO v_policy FROM private.dictionary_analysis_validator_policies WHERE validator_version=v_op.planned_validator_version AND policy_sha256=v_op.planned_policy_sha256;
    v_generation_key:=v_operation::TEXT||':'||v_fence::TEXT; v_judge_key:='semantic:'||v_generation_key;
  ELSE
    v_workflow:='creation'; v_actor:=v_run.actor_id; v_operation:=v_run.operation_id; v_entry:=v_run.entry_id; v_fence:=v_run.fence;
    SELECT * INTO v_policy FROM private.dictionary_analysis_validator_policies WHERE validator_version=v_run.validator_version AND policy_sha256=v_run.policy_sha256;
    v_generation_key:=v_run.run_id::TEXT||':generation:'||v_fence::TEXT; v_judge_key:=v_run.run_id::TEXT||':judgement:'||v_fence::TEXT;
  END IF;
  IF v_policy.policy_sha256 IS NULL OR NOT v_policy.enabled OR v_policy.generation_model IS NULL OR v_policy.semantic_model IS NULL
    THEN RAISE EXCEPTION 'paid-profile-required'; END IF;
  PERFORM private.grant_dictionary_paid_phase(v_workflow,v_actor,v_operation,v_entry,v_fence,v_phase,v_policy.policy_sha256,v_policy.validator_version,
    v_policy.generation_model,v_policy.semantic_model,v_generation_key,v_judge_key);
  RETURN NEW;
END;
$$;
CREATE TRIGGER z_paid_generation_grant BEFORE UPDATE OF status ON private.dictionary_analysis_operations
  FOR EACH ROW WHEN (OLD.status='accepted' AND NEW.status='dispatching') EXECUTE FUNCTION private.guard_dictionary_paid_grant();
CREATE TRIGGER z_paid_semantic_grant BEFORE INSERT ON private.dictionary_semantic_checks
  FOR EACH ROW WHEN (NEW.status='dispatching') EXECUTE FUNCTION private.guard_dictionary_paid_grant();
CREATE TRIGGER z_paid_creation_generation BEFORE INSERT ON private.dictionary_creation_generation_attempts
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_grant();
CREATE TRIGGER z_paid_creation_judgement BEFORE INSERT ON private.dictionary_creation_judge_attempts
  FOR EACH ROW WHEN (NEW.status='dispatching') EXECUTE FUNCTION private.guard_dictionary_paid_grant();

CREATE FUNCTION public.claim_dictionary_paid_attempt_v1(p_actor UUID,p_invocation_key TEXT,p_model TEXT,p_binding_sha256 TEXT,
  p_request_sha256 TEXT,p_request_bytes INTEGER,p_output_tokens INTEGER) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE; v_release private.dictionary_paid_releases%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE actor_id=p_actor AND invocation_key=p_invocation_key;
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
  IF NOT v_release.enabled OR v_release.valid_from>CLOCK_TIMESTAMP() OR v_release.valid_until<=CLOCK_TIMESTAMP()
    OR p_request_bytes IS NULL OR p_request_bytes NOT BETWEEN 1 AND (v_attempt.limits->>'max_request_bytes')::INTEGER
    OR p_output_tokens IS NULL OR p_output_tokens NOT BETWEEN 1 AND (v_attempt.limits->>'max_output_tokens')::INTEGER
    THEN RAISE EXCEPTION 'paid-dispatch-unavailable'; END IF;
  UPDATE private.dictionary_paid_attempts SET state='sent',request_sha256=p_request_sha256 WHERE attempt_id=v_attempt.attempt_id;
  RETURN JSONB_BUILD_OBJECT('allowed',TRUE,'attempt_id',v_attempt.attempt_id,'expires_at',v_release.valid_until,
    'request_sha256',p_request_sha256,'invocation_key',v_attempt.invocation_key,'model',v_attempt.model,'binding_sha256',v_release.binding_sha256);
END;
$$;

CREATE FUNCTION private.settle_dictionary_paid_attempt_v1(p_attempt UUID,p_evidence_sha256 TEXT,p_usage JSONB) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE; v_key TEXT; v_input NUMERIC; v_cached NUMERIC; v_output NUMERIC; v_cost NUMERIC; v_valid BOOLEAN:=TRUE;
BEGIN
  IF p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-paid-evidence'; END IF;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt;
  PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_attempt.release_id FOR UPDATE;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt FOR UPDATE;
  IF v_attempt.state IN ('settled','unknown') THEN
    IF ROW(v_attempt.evidence_sha256,v_attempt.usage) IS DISTINCT FROM ROW(p_evidence_sha256,p_usage) THEN RAISE EXCEPTION 'paid-settlement-conflict'; END IF;
    RETURN JSONB_BUILD_OBJECT('state',v_attempt.state);
  END IF;
  IF v_attempt.state<>'sent' THEN RAISE EXCEPTION 'paid-attempt-not-sent'; END IF;
  IF p_usage IS NULL THEN v_valid:=FALSE;
  ELSIF private.jsonb_has_exact_keys(p_usage,ARRAY['modelVersion','promptTokenCount','cachedContentTokenCount','candidatesTokenCount','thoughtsTokenCount','totalTokenCount']) IS NOT TRUE
    OR p_usage->>'modelVersion' IS DISTINCT FROM v_attempt.limits->>'model_version' THEN v_valid:=FALSE;
  ELSE
    FOREACH v_key IN ARRAY ARRAY['promptTokenCount','cachedContentTokenCount','candidatesTokenCount','thoughtsTokenCount','totalTokenCount'] LOOP
      IF JSONB_TYPEOF(p_usage->v_key) IS DISTINCT FROM 'number' OR (p_usage->>v_key) !~ '^(0|[1-9][0-9]{0,8})$' THEN v_valid:=FALSE; END IF;
    END LOOP;
    IF v_valid THEN
      v_input:=(p_usage->>'promptTokenCount')::NUMERIC; v_cached:=(p_usage->>'cachedContentTokenCount')::NUMERIC;
      v_output:=(p_usage->>'candidatesTokenCount')::NUMERIC+(p_usage->>'thoughtsTokenCount')::NUMERIC;
      v_cost:=(v_input-v_cached)*(v_attempt.limits->>'input_nanousd_per_token')::NUMERIC
        +v_cached*(v_attempt.limits->>'cached_nanousd_per_token')::NUMERIC+v_output*(v_attempt.limits->>'output_nanousd_per_token')::NUMERIC;
      v_valid:=v_cached<=v_input AND v_input<=(v_attempt.limits->>'max_input_tokens')::NUMERIC
        AND v_output<=(v_attempt.limits->>'max_output_tokens')::NUMERIC AND v_input+v_output=(p_usage->>'totalTokenCount')::NUMERIC
        AND v_cost>=0 AND v_cost<=v_attempt.reserved_nanousd;
    END IF;
  END IF;
  IF NOT v_valid THEN
    UPDATE private.dictionary_paid_attempts SET state='unknown',evidence_sha256=p_evidence_sha256,usage=p_usage WHERE attempt_id=p_attempt;
    IF p_usage IS NOT NULL THEN UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id=v_attempt.release_id; END IF;
    RETURN JSONB_BUILD_OBJECT('state','unknown');
  END IF;
  UPDATE private.dictionary_paid_releases SET held_nanousd=held_nanousd-v_attempt.reserved_nanousd,
    settled_nanousd=settled_nanousd+v_cost::BIGINT WHERE release_id=v_attempt.release_id;
  UPDATE private.dictionary_paid_attempts SET state='settled',actual_nanousd=v_cost::BIGINT,evidence_sha256=p_evidence_sha256,usage=p_usage WHERE attempt_id=p_attempt;
  RETURN JSONB_BUILD_OBJECT('state','settled');
END;
$$;

CREATE FUNCTION public.close_dictionary_paid_unissued_v1(p_attempt UUID,p_evidence_sha256 TEXT) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE;
BEGIN
  IF p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-paid-evidence'; END IF;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt;
  PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_attempt.release_id FOR UPDATE;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt FOR UPDATE;
  IF v_attempt.state='closed' AND v_attempt.evidence_sha256=p_evidence_sha256 THEN RETURN; END IF;
  IF v_attempt.state NOT IN ('reserved','granted') OR v_attempt.request_sha256 IS NOT NULL THEN RAISE EXCEPTION 'paid-attempt-not-unissued'; END IF;
  UPDATE private.dictionary_paid_releases SET held_nanousd=held_nanousd-v_attempt.reserved_nanousd WHERE release_id=v_attempt.release_id;
  UPDATE private.dictionary_paid_attempts SET state='closed',evidence_sha256=p_evidence_sha256 WHERE attempt_id=p_attempt;
END;
$$;

-- Reviewed money reconciliation is not a new grant or content approval. The
-- old evidence survives, and even a reviewer cannot reopen a settled charge.
CREATE FUNCTION public.reconcile_dictionary_paid_attempt_v1(p_attempt UUID,p_evidence_sha256 TEXT,p_usage JSONB,p_review_sha256 TEXT) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE; v_review private.dictionary_paid_reconciliations%ROWTYPE;
  v_receipt JSONB; v_prior TEXT;
BEGIN
  PERFORM private.require_dictionary_administrator();
  IF p_review_sha256 IS NULL OR p_review_sha256 !~ '^[0-9a-f]{64}$' OR p_usage IS NULL
    THEN RAISE EXCEPTION 'invalid-paid-review'; END IF;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt;
  PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_attempt.release_id FOR UPDATE;
  SELECT * INTO STRICT v_attempt FROM private.dictionary_paid_attempts WHERE attempt_id=p_attempt FOR UPDATE;
  SELECT * INTO v_review FROM private.dictionary_paid_reconciliations WHERE attempt_id=p_attempt AND review_sha256=p_review_sha256;
  IF FOUND THEN
    IF ROW(v_review.evidence_sha256,v_review.usage) IS DISTINCT FROM ROW(p_evidence_sha256,p_usage)
      THEN RAISE EXCEPTION 'paid-review-conflict'; END IF;
    RETURN v_review.receipt;
  END IF;
  IF v_attempt.state<>'unknown' THEN RAISE EXCEPTION 'paid-attempt-not-unknown'; END IF;
  v_prior:=v_attempt.evidence_sha256;
  UPDATE private.dictionary_paid_attempts SET state='sent',evidence_sha256=NULL,usage=NULL WHERE attempt_id=p_attempt;
  v_receipt:=private.settle_dictionary_paid_attempt_v1(p_attempt,p_evidence_sha256,p_usage);
  IF v_receipt->>'state' IS DISTINCT FROM 'settled' THEN RAISE EXCEPTION 'invalid-paid-review-usage'; END IF;
  INSERT INTO private.dictionary_paid_reconciliations(attempt_id,reviewer_id,review_sha256,prior_evidence_sha256,evidence_sha256,usage,receipt)
    VALUES(p_attempt,auth.uid(),p_review_sha256,v_prior,p_evidence_sha256,p_usage,v_receipt);
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION private.quarantine_dictionary_paid_failure() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_actor UUID; v_key TEXT; v_run private.dictionary_creation_runs%ROWTYPE; v_release UUID;
BEGIN
  IF TG_TABLE_NAME='dictionary_analysis_operations' THEN
    v_actor:=NEW.actor_id;v_key:=NEW.operation_id::TEXT||':'||NEW.fence::TEXT;
  ELSIF TG_TABLE_NAME='dictionary_semantic_checks' THEN
    v_actor:=NEW.actor_id;v_key:='semantic:'||NEW.operation_id::TEXT||':'||NEW.fence::TEXT;
  ELSE
    SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=NEW.run_id;
    v_actor:=v_run.actor_id;v_key:=NEW.run_id::TEXT||CASE TG_TABLE_NAME WHEN 'dictionary_creation_generation_attempts' THEN ':generation:' ELSE ':judgement:' END||v_run.fence::TEXT;
  END IF;
  -- Do not overwrite trustworthy returned-usage settlement or free any money.
  SELECT release_id INTO v_release FROM private.dictionary_paid_attempts WHERE actor_id IS NOT DISTINCT FROM v_actor AND invocation_key=v_key;
  IF v_release IS NOT NULL THEN
    PERFORM 1 FROM private.dictionary_paid_releases WHERE release_id=v_release FOR UPDATE;
    UPDATE private.dictionary_paid_attempts SET state='unknown',evidence_sha256=private.dictionary_canonical_sha256(JSONB_BUILD_OBJECT('status',NEW.status))
      WHERE actor_id IS NOT DISTINCT FROM v_actor AND invocation_key=v_key AND state='sent';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER z_paid_analysis_failure AFTER UPDATE OF status ON private.dictionary_analysis_operations
  FOR EACH ROW WHEN (NEW.status IN ('provider-failed','provider-outcome-unknown')) EXECUTE FUNCTION private.quarantine_dictionary_paid_failure();
CREATE TRIGGER z_paid_semantic_failure AFTER UPDATE OF status ON private.dictionary_semantic_checks
  FOR EACH ROW WHEN (NEW.status IN ('provider-failed','provider-outcome-unknown')) EXECUTE FUNCTION private.quarantine_dictionary_paid_failure();
CREATE TRIGGER z_paid_creation_failure AFTER UPDATE OF status ON private.dictionary_creation_generation_attempts
  FOR EACH ROW WHEN (NEW.status IN ('failed','unknown')) EXECUTE FUNCTION private.quarantine_dictionary_paid_failure();
CREATE TRIGGER z_paid_creation_judge_failure AFTER UPDATE OF status ON private.dictionary_creation_judge_attempts
  FOR EACH ROW WHEN (NEW.status IN ('failed','unknown')) EXECUTE FUNCTION private.quarantine_dictionary_paid_failure();

-- Settlement is in the result journal transaction, not a second fallible HTTP
-- operation after fetch. Missing/invalid usage keeps the whole phase liability.
CREATE FUNCTION private.journal_dictionary_paid_result() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_attempt private.dictionary_paid_attempts%ROWTYPE; v_run private.dictionary_creation_runs%ROWTYPE;
  v_key TEXT; v_actor UUID; v_response JSONB; v_usage JSONB; v_evidence TEXT;
BEGIN
  IF TG_TABLE_NAME='dictionary_analysis_results' THEN
    v_actor:=NEW.actor_id;
    SELECT NEW.operation_id::TEXT||':'||fence::TEXT INTO STRICT v_key FROM private.dictionary_analysis_operations WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  ELSIF TG_TABLE_NAME='dictionary_semantic_checks' THEN
    v_actor:=NEW.actor_id; v_key:='semantic:'||NEW.operation_id::TEXT||':'||NEW.fence::TEXT;
  ELSE
    SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=NEW.run_id;
    v_actor:=v_run.actor_id; v_key:=NEW.run_id::TEXT||CASE TG_TABLE_NAME WHEN 'dictionary_creation_generation_attempts' THEN ':generation:' ELSE ':judgement:' END||v_run.fence::TEXT;
  END IF;
  SELECT * INTO v_attempt FROM private.dictionary_paid_attempts WHERE actor_id IS NOT DISTINCT FROM v_actor AND invocation_key=v_key;
  IF NOT FOUND OR v_attempt.state NOT IN ('sent','settled','unknown') THEN RAISE EXCEPTION 'paid-attempt-not-sent'; END IF;
  IF v_attempt.state='unknown' THEN RETURN NEW; END IF;
  v_response:=NEW.result->'provider_response';
  IF JSONB_TYPEOF(v_response->'usageMetadata')='object' THEN
    v_usage:=v_response->'usageMetadata';
    v_usage:=JSONB_BUILD_OBJECT('modelVersion',v_response->'modelVersion','promptTokenCount',v_usage->'promptTokenCount',
      'cachedContentTokenCount',v_usage->'cachedContentTokenCount','candidatesTokenCount',v_usage->'candidatesTokenCount',
      'thoughtsTokenCount',v_usage->'thoughtsTokenCount','totalTokenCount',v_usage->'totalTokenCount');
  END IF;
  v_evidence:=private.dictionary_canonical_sha256(NEW.result);
  PERFORM private.settle_dictionary_paid_attempt_v1(v_attempt.attempt_id,v_evidence,v_usage);
  RETURN NEW;
END;
$$;
CREATE TRIGGER z_paid_analysis_result AFTER INSERT ON private.dictionary_analysis_results
  FOR EACH ROW EXECUTE FUNCTION private.journal_dictionary_paid_result();
CREATE TRIGGER z_paid_semantic_result AFTER UPDATE OF result ON private.dictionary_semantic_checks
  FOR EACH ROW WHEN (NEW.result IS NOT NULL) EXECUTE FUNCTION private.journal_dictionary_paid_result();
CREATE TRIGGER z_paid_creation_result AFTER UPDATE OF result ON private.dictionary_creation_generation_attempts
  FOR EACH ROW WHEN (NEW.result IS NOT NULL) EXECUTE FUNCTION private.journal_dictionary_paid_result();
CREATE TRIGGER z_paid_creation_judge_result AFTER UPDATE OF result ON private.dictionary_creation_judge_attempts
  FOR EACH ROW WHEN (NEW.result IS NOT NULL) EXECUTE FUNCTION private.journal_dictionary_paid_result();

CREATE FUNCTION private.guard_dictionary_paid_publication() RETURNS TRIGGER
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
  IF NOT EXISTS(SELECT 1 FROM private.dictionary_paid_releases WHERE release_id=v_release AND enabled)
    THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  IF (SELECT COUNT(*) FROM private.dictionary_paid_attempts WHERE workflow=v_workflow AND entry_id=v_entry AND fence=v_fence AND state='settled')<>2
    THEN RAISE EXCEPTION 'paid-accounting-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER z_paid_analysis_publication BEFORE INSERT ON private.dictionary_analysis_publications
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_publication();
CREATE TRIGGER z_paid_creation_publication BEFORE INSERT ON private.dictionary_creation_publications
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_paid_publication();
CREATE TRIGGER z_paid_analysis_completion BEFORE UPDATE OF status ON private.dictionary_analysis_operations
  FOR EACH ROW WHEN (NEW.status IN ('published','no-change') AND OLD.status NOT IN ('published','no-change'))
  EXECUTE FUNCTION private.guard_dictionary_paid_publication();
CREATE TRIGGER z_paid_creation_completion BEFORE UPDATE OF status ON private.dictionary_creation_runs
  FOR EACH ROW WHEN (NEW.status='published' AND OLD.status<>'published') EXECUTE FUNCTION private.guard_dictionary_paid_publication();

-- Keep the prior complete-profile conjunction; only paid availability narrows it.
ALTER FUNCTION public.dictionary_content_capability_v2() SET SCHEMA private;
ALTER FUNCTION private.dictionary_content_capability_v2() RENAME TO dictionary_content_capability_before_paid_v2;
REVOKE ALL ON FUNCTION private.dictionary_content_capability_before_paid_v2() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.dictionary_content_capability_v2() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c||JSONB_BUILD_OBJECT('shared_analysis_enabled',COALESCE((c->>'shared_analysis_enabled')::BOOLEAN AND private.dictionary_paid_actor_available(auth.uid()),FALSE))
    FROM (SELECT private.dictionary_content_capability_before_paid_v2() AS c) s;
$$;
CREATE OR REPLACE FUNCTION public.dictionary_analysis_actor_v1() RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  RETURN JSONB_BUILD_OBJECT('protocol_version',1,'actor_id',v_actor,'may_analyze',private.dictionary_paid_actor_available(v_actor));
END;
$$;

ALTER TABLE private.dictionary_paid_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_paid_cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_paid_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_paid_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_paid_releases,private.dictionary_paid_cohort,private.dictionary_paid_attempts,private.dictionary_paid_reconciliations FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.dictionary_paid_model_ceiling(JSONB),private.guard_dictionary_paid_release(),
  private.dictionary_paid_actor_available(UUID),private.lock_dictionary_paid_actor(UUID,UUID),private.guard_dictionary_paid_admission(),
  private.grant_dictionary_paid_phase(TEXT,UUID,UUID,UUID,BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  private.guard_dictionary_paid_grant(),private.guard_dictionary_paid_publication(),private.journal_dictionary_paid_result(),
  private.quarantine_dictionary_paid_failure(),private.protect_dictionary_paid_review(),private.redact_dictionary_paid_actor(),
  private.settle_dictionary_paid_attempt_v1(UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_dictionary_paid_attempt_v1(UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER),
  public.close_dictionary_paid_unissued_v1(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_dictionary_paid_attempt_v1(UUID,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER),
  public.close_dictionary_paid_unissued_v1(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_dictionary_paid_attempt_v1(UUID,TEXT,JSONB,TEXT) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_dictionary_paid_attempt_v1(UUID,TEXT,JSONB,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.dictionary_content_capability_v2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dictionary_content_capability_v2() TO authenticated,service_role;

COMMIT;
