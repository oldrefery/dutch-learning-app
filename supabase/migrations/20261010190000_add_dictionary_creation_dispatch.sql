-- Dormant creation generation journal. No provider call, policy or flag is seeded.
-- Independent judgement and first publication remain unavailable in this migration.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN creation_dispatch_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Paid intent survives owner deletion. No original query or private hint is copied.
CREATE TABLE private.dictionary_creation_runs (
  run_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_id UUID NOT NULL,
  resolution_id UUID NOT NULL,
  identity_id UUID NOT NULL REFERENCES private.dictionary_creation_identities(identity_id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  anchor_id UUID NOT NULL,
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  generation_model TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  policy_sha256 TEXT NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','dispatching','validating',
    'provider-failed','provider-outcome-unknown','authorization-revoked','review-required')),
  error_code TEXT,
  UNIQUE (actor_id,operation_id),
  UNIQUE (entry_id,fence),
  FOREIGN KEY (entry_id,anchor_id) REFERENCES private.dictionary_meaning_anchors(entry_id,anchor_id) ON DELETE RESTRICT,
  FOREIGN KEY (validator_version,policy_sha256) REFERENCES private.dictionary_analysis_validator_policies(validator_version,policy_sha256) ON DELETE RESTRICT,
  CHECK ((status IN ('accepted','dispatching','validating') AND error_code IS NULL) OR
    (status NOT IN ('accepted','dispatching','validating') AND error_code IS NOT NULL AND error_code ~ '^[a-z][a-z0-9-]{0,99}$'))
);
CREATE TABLE private.dictionary_creation_generation_attempts (
  run_id UUID PRIMARY KEY REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider='gemini'),
  model TEXT NOT NULL,
  input JSONB NOT NULL CHECK (JSONB_TYPEOF(input)='object'),
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('dispatching','returned','failed','unknown')),
  quota_charged BOOLEAN NOT NULL DEFAULT TRUE CHECK (quota_charged),
  result JSONB CHECK (result IS NULL OR (JSONB_TYPEOF(result)='object' AND OCTET_LENGTH(result::TEXT)<=262144)),
  result_sha256 TEXT CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  provider_request_id TEXT CHECK (provider_request_id IS NULL OR LENGTH(BTRIM(provider_request_id)) BETWEEN 1 AND 500),
  failure_evidence_sha256 TEXT CHECK (failure_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reconciliation_evidence_sha256 TEXT CHECK (reconciliation_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK ((result IS NULL)=(result_sha256 IS NULL)),
  CHECK (status<>'returned' OR result IS NOT NULL),
  CHECK (status<>'failed' OR (result IS NULL AND failure_evidence_sha256 IS NOT NULL)),
  CHECK (reconciliation_evidence_sha256 IS NULL OR (status='returned' AND result IS NOT NULL))
);
CREATE UNIQUE INDEX dictionary_creation_unique_generation_response
  ON private.dictionary_creation_generation_attempts(provider,provider_request_id) WHERE provider_request_id IS NOT NULL;

INSERT INTO private.dictionary_creation_runs(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,
  evidence_sha256,generation_model,validator_version,policy_sha256,fence)
  SELECT actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,evidence_sha256,
    planned_generation_model,planned_validator_version,planned_policy_sha256,fence FROM private.dictionary_creation_operations;
ALTER TABLE private.dictionary_creation_leases
  ADD COLUMN run_id UUID REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT;
UPDATE private.dictionary_creation_leases l SET run_id=r.run_id FROM private.dictionary_creation_runs r
  WHERE ROW(l.actor_id,l.operation_id)=ROW(r.actor_id,r.operation_id);
ALTER TABLE private.dictionary_creation_leases
  ALTER COLUMN run_id SET NOT NULL,
  ALTER COLUMN actor_id DROP NOT NULL,
  ALTER COLUMN operation_id DROP NOT NULL,
  DROP CONSTRAINT dictionary_creation_leases_actor_id_operation_id_fkey,
  ADD FOREIGN KEY(actor_id,operation_id) REFERENCES private.dictionary_creation_operations(actor_id,operation_id) ON DELETE SET NULL;

CREATE FUNCTION private.record_dictionary_creation_run()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO private.dictionary_creation_runs(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,
    evidence_sha256,generation_model,validator_version,policy_sha256,fence)
    VALUES(NEW.actor_id,NEW.operation_id,NEW.resolution_id,NEW.identity_id,NEW.entry_id,NEW.anchor_id,
      NEW.evidence_sha256,NEW.planned_generation_model,NEW.planned_validator_version,NEW.planned_policy_sha256,NEW.fence);
  RETURN NEW;
END;
$$;
CREATE TRIGGER record_dictionary_creation_run AFTER INSERT ON private.dictionary_creation_operations
  FOR EACH ROW EXECUTE FUNCTION private.record_dictionary_creation_run();
CREATE FUNCTION private.bind_dictionary_creation_lease()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  SELECT run_id INTO STRICT NEW.run_id FROM private.dictionary_creation_runs
    WHERE ROW(actor_id,operation_id,entry_id,identity_id,fence)=ROW(NEW.actor_id,NEW.operation_id,NEW.entry_id,NEW.identity_id,NEW.fence);
  RETURN NEW;
END;
$$;
CREATE TRIGGER bind_dictionary_creation_lease BEFORE INSERT ON private.dictionary_creation_leases
  FOR EACH ROW EXECUTE FUNCTION private.bind_dictionary_creation_lease();

CREATE FUNCTION private.guard_dictionary_creation_run()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable-creation-accounting'; END IF;
  IF (TO_JSONB(NEW)-ARRAY['actor_id','status','error_code']) IS DISTINCT FROM (TO_JSONB(OLD)-ARRAY['actor_id','status','error_code'])
    THEN RAISE EXCEPTION 'immutable-creation-run-binding'; END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    IF NEW.actor_id IS NOT NULL OR EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.actor_id)
      THEN RAISE EXCEPTION 'immutable-creation-owner'; END IF;
    -- Preserve an unresolved dispatch and its lease. A known, unsent/returned outcome
    -- can release the lease; the accounting row and any result still survive.
    IF NOT EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=OLD.run_id AND status IN ('dispatching','unknown')) THEN
      NEW.status:='authorization-revoked'; NEW.error_code:='owner-deleted';
      DELETE FROM private.dictionary_creation_leases WHERE run_id=OLD.run_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('provider-failed','authorization-revoked','review-required') AND ROW(NEW.status,NEW.error_code) IS DISTINCT FROM ROW(OLD.status,OLD.error_code)
    THEN RAISE EXCEPTION 'terminal-creation-run'; END IF;
  IF NEW.status='accepted' AND OLD.status<>'accepted' THEN RAISE EXCEPTION 'creation-status-regression'; END IF;
  IF NEW.status='dispatching' AND OLD.status NOT IN ('accepted','dispatching') THEN RAISE EXCEPTION 'creation-status-regression'; END IF;
  IF NEW.status='validating' AND NOT EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=OLD.run_id AND status='returned')
    THEN RAISE EXCEPTION 'creation-result-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_run BEFORE UPDATE OR DELETE ON private.dictionary_creation_runs
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_run();
CREATE FUNCTION private.guard_dictionary_creation_generation_attempt()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable-creation-accounting'; END IF;
  IF (TO_JSONB(NEW)-ARRAY['status','result','result_sha256','provider_request_id','failure_evidence_sha256','reconciliation_evidence_sha256'])
    IS DISTINCT FROM (TO_JSONB(OLD)-ARRAY['status','result','result_sha256','provider_request_id','failure_evidence_sha256','reconciliation_evidence_sha256'])
    OR (OLD.result IS NOT NULL AND ROW(NEW.result,NEW.result_sha256,NEW.provider_request_id) IS DISTINCT FROM ROW(OLD.result,OLD.result_sha256,OLD.provider_request_id))
    OR (OLD.failure_evidence_sha256 IS NOT NULL AND NEW.failure_evidence_sha256 IS DISTINCT FROM OLD.failure_evidence_sha256)
    OR (OLD.reconciliation_evidence_sha256 IS NOT NULL AND NEW.reconciliation_evidence_sha256 IS DISTINCT FROM OLD.reconciliation_evidence_sha256)
    THEN RAISE EXCEPTION 'immutable-creation-attempt'; END IF;
  IF (OLD.status IN ('returned','failed') AND TO_JSONB(NEW) IS DISTINCT FROM TO_JSONB(OLD)) OR NEW.status='dispatching'
    OR (OLD.status='unknown' AND NEW.status='returned' AND NEW.reconciliation_evidence_sha256 IS NULL)
    OR (OLD.status='unknown' AND NEW.status='failed') THEN RAISE EXCEPTION 'creation-attempt-regression'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_generation_attempt BEFORE UPDATE OR DELETE ON private.dictionary_creation_generation_attempts
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_generation_attempt();

CREATE FUNCTION private.dictionary_creation_run_receipt(p_run private.dictionary_creation_runs)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT JSONB_BUILD_OBJECT('protocol_version',2,'operation_id',p_run.operation_id,'resolution_id',p_run.resolution_id,
    'entry_id',p_run.entry_id,'fence',p_run.fence::TEXT,'status',p_run.status,'quota_charged',TRUE,
    'result_sha256',a.result_sha256,'error_code',p_run.error_code,'published',NULL,'published_head_sequence',NULL)
    FROM (SELECT 1) placeholder LEFT JOIN private.dictionary_creation_generation_attempts a ON a.run_id=p_run.run_id;
$$;
CREATE OR REPLACE FUNCTION public.get_dictionary_creation_operation_v2(p_operation UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_run private.dictionary_creation_runs%ROWTYPE; v_receipt JSONB;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  SELECT * INTO v_run FROM private.dictionary_creation_runs WHERE actor_id=v_actor AND operation_id=p_operation;
  IF FOUND THEN RETURN private.dictionary_creation_run_receipt(v_run); END IF;
  SELECT receipt INTO v_receipt FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=p_operation;
  RETURN v_receipt;
END;
$$;

-- Lock Auth before entry/run, consistently with acceptance and Auth deletion.
CREATE FUNCTION private.lock_dictionary_creation_run(p_run UUID,p_fence TEXT)
RETURNS private.dictionary_creation_runs LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_run FROM private.dictionary_creation_runs WHERE run_id=p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'creation-run-not-found'; END IF;
  IF p_fence IS DISTINCT FROM v_run.fence::TEXT THEN RAISE EXCEPTION 'creation-fence-conflict'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-entry/'||v_run.entry_id::TEXT,0));
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id=v_run.entry_id FOR UPDATE;
  SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=p_run FOR UPDATE;
  RETURN v_run;
END;
$$;
CREATE FUNCTION private.dictionary_creation_run_ready(p_run private.dictionary_creation_runs)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_identity private.dictionary_creation_identities%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
BEGIN
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_dispatch_enabled
    AND creation_operations_enabled AND creation_resolution_enabled FOR SHARE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=p_run.identity_id FOR SHARE;
  SELECT q.* INTO v_policy FROM private.dictionary_creation_profile p JOIN private.dictionary_analysis_validator_policies q
    ON ROW(p.validator_version,p.policy_sha256)=ROW(q.validator_version,q.policy_sha256) WHERE p.singleton FOR SHARE OF p,q;
  RETURN FOUND AND private.dictionary_creation_identity_ready(v_identity)
    AND ROW(v_identity.entry_id,v_identity.evidence_sha256)=ROW(p_run.entry_id,p_run.evidence_sha256)
    AND ROW(v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256)=ROW(p_run.generation_model,p_run.validator_version,p_run.policy_sha256)
    AND private.dictionary_analysis_profile_ready(p_run.generation_model,p_run.validator_version,p_run.policy_sha256,
      v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes)
    AND EXISTS(SELECT 1 FROM private.dictionary_creation_leases WHERE run_id=p_run.run_id AND entry_id=p_run.entry_id AND fence=p_run.fence)
    AND EXISTS(SELECT 1 FROM private.dictionary_meaning_anchor_heads h JOIN private.dictionary_meaning_anchors a USING(entry_id,anchor_id)
      WHERE h.entry_id=p_run.entry_id AND h.anchor_id=p_run.anchor_id AND ROW(a.source_id,a.gloss,a.examples,a.verified_by,a.verified_at)
        IS NOT DISTINCT FROM ROW(v_identity.source_id,v_identity.gloss,v_identity.examples,v_identity.verified_by,v_identity.verified_at))
    AND EXISTS(SELECT 1 FROM public.dictionary_entries WHERE entry_id=p_run.entry_id AND state='draft'
      AND ROW(language_code,lemma,part_of_speech,article,sense_key) IS NOT DISTINCT FROM
        ROW(v_identity.language_code,v_identity.lemma,v_identity.part_of_speech,v_identity.article,v_identity.sense_key))
    AND NOT EXISTS(SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id=p_run.entry_id)
    AND NOT EXISTS(SELECT 1 FROM public.dictionary_revisions WHERE entry_id=p_run.entry_id);
END;
$$;
CREATE FUNCTION public.get_dictionary_creation_work_v1(p_actor UUID,p_operation UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT JSONB_BUILD_OBJECT('run_id',r.run_id,'receipt',private.dictionary_creation_run_receipt(r))
    FROM private.dictionary_creation_runs r WHERE r.actor_id=p_actor AND r.operation_id=p_operation;
$$;
CREATE FUNCTION public.start_dictionary_creation_dispatch_v1(p_run UUID,p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_actor UUID; v_allowed BOOLEAN;
  v_identity private.dictionary_creation_identities%ROWTYPE; v_anchor private.dictionary_meaning_anchors%ROWTYPE; v_input JSONB;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  IF v_run.status='dispatching' AND EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts
    WHERE run_id=p_run AND dispatched_at<NOW()-INTERVAL '2 minutes') THEN
    UPDATE private.dictionary_creation_generation_attempts SET status='unknown' WHERE run_id=p_run AND status='dispatching';
    UPDATE private.dictionary_creation_runs SET status='provider-outcome-unknown',error_code='provider-outcome-unknown' WHERE run_id=p_run RETURNING * INTO v_run;
  END IF;
  IF v_run.status<>'accepted' THEN RETURN JSONB_BUILD_OBJECT('receipt',private.dictionary_creation_run_receipt(v_run),'dispatch',NULL); END IF;
  IF NOT COALESCE(v_allowed,FALSE) THEN
    UPDATE private.dictionary_creation_runs SET status='authorization-revoked',error_code='analysis-permission-revoked' WHERE run_id=p_run RETURNING * INTO v_run;
    DELETE FROM private.dictionary_creation_leases WHERE run_id=p_run;
    RETURN JSONB_BUILD_OBJECT('receipt',private.dictionary_creation_run_receipt(v_run),'dispatch',NULL);
  END IF;
  IF private.dictionary_creation_run_ready(v_run) IS NOT TRUE THEN RAISE EXCEPTION 'creation-dispatch-unavailable'; END IF;
  SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=v_run.identity_id;
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE entry_id=v_run.entry_id AND anchor_id=v_run.anchor_id;
  v_input:=JSONB_BUILD_OBJECT('schema_version',1,'identity',JSONB_BUILD_OBJECT('language_code',v_identity.language_code,
    'lemma',v_identity.lemma,'part_of_speech',v_identity.part_of_speech,'article',v_identity.article,'sense_key',v_identity.sense_key),
    'anchor',JSONB_BUILD_OBJECT('anchor_id',v_anchor.anchor_id,'anchor_sha256',v_anchor.anchor_sha256,'gloss',v_anchor.gloss,'examples',v_anchor.examples),
    'evidence_sha256',v_run.evidence_sha256,'validator_version',v_run.validator_version,'policy_sha256',v_run.policy_sha256);
  INSERT INTO private.dictionary_creation_generation_attempts(run_id,provider,model,input,input_sha256,status)
    VALUES(p_run,'gemini',v_run.generation_model,v_input,private.dictionary_canonical_sha256(v_input),'dispatching');
  UPDATE private.dictionary_creation_runs SET status='dispatching' WHERE run_id=p_run RETURNING * INTO v_run;
  RETURN JSONB_BUILD_OBJECT('receipt',private.dictionary_creation_run_receipt(v_run),'dispatch',JSONB_BUILD_OBJECT(
    'run_id',p_run,'fence',p_fence,'provider','gemini','model',v_run.generation_model,'input',v_input,'input_sha256',private.dictionary_canonical_sha256(v_input)));
END;
$$;
CREATE FUNCTION public.record_dictionary_creation_result_v1(p_run UUID,p_fence TEXT,p_input_sha256 TEXT,p_result JSONB,p_provider_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_generation_attempts%ROWTYPE;
  v_actor UUID; v_allowed BOOLEAN; v_hash TEXT; v_unknown BOOLEAN;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_input_sha256 IS DISTINCT FROM v_attempt.input_sha256 THEN RAISE EXCEPTION 'creation-attempt-conflict'; END IF;
  IF JSONB_TYPEOF(p_result) IS DISTINCT FROM 'object' OR OCTET_LENGTH(p_result::TEXT)>262144
    OR (p_provider_request_id IS NOT NULL AND LENGTH(BTRIM(p_provider_request_id)) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'invalid-creation-result'; END IF;
  v_hash:=private.dictionary_canonical_sha256(p_result);
  IF v_attempt.result IS NOT NULL THEN
    IF ROW(v_attempt.result_sha256,v_attempt.provider_request_id) IS DISTINCT FROM ROW(v_hash,p_provider_request_id)
      THEN RAISE EXCEPTION 'creation-result-conflict'; END IF;
    RETURN private.dictionary_creation_run_receipt(v_run);
  END IF;
  IF v_attempt.status='failed' THEN RAISE EXCEPTION 'terminal-creation-attempt'; END IF;
  v_unknown:=v_attempt.status='unknown' OR v_attempt.dispatched_at<NOW()-INTERVAL '2 minutes' OR v_run.actor_id IS NULL;
  UPDATE private.dictionary_creation_generation_attempts SET result=p_result,result_sha256=v_hash,provider_request_id=p_provider_request_id,
    status=CASE WHEN v_unknown THEN 'unknown' ELSE 'returned' END WHERE run_id=p_run;
  IF v_unknown THEN
    UPDATE private.dictionary_creation_runs SET status='provider-outcome-unknown',error_code='provider-outcome-unknown' WHERE run_id=p_run RETURNING * INTO v_run;
  ELSIF NOT COALESCE(v_allowed,FALSE) THEN
    UPDATE private.dictionary_creation_runs SET status='authorization-revoked',error_code='analysis-permission-revoked' WHERE run_id=p_run RETURNING * INTO v_run;
    DELETE FROM private.dictionary_creation_leases WHERE run_id=p_run;
  ELSIF private.dictionary_creation_run_ready(v_run) IS NOT TRUE THEN
    UPDATE private.dictionary_creation_runs SET status='review-required',error_code='creation-dependency-withdrawn' WHERE run_id=p_run RETURNING * INTO v_run;
  ELSE
    UPDATE private.dictionary_creation_runs SET status='validating',error_code=NULL WHERE run_id=p_run RETURNING * INTO v_run;
  END IF;
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;
CREATE FUNCTION public.record_dictionary_creation_failure_v1(p_run UUID,p_fence TEXT,p_input_sha256 TEXT,p_known_failure BOOLEAN,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_generation_attempts%ROWTYPE; v_actor UUID;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  PERFORM private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_input_sha256 IS DISTINCT FROM v_attempt.input_sha256 THEN RAISE EXCEPTION 'creation-attempt-conflict'; END IF;
  IF p_known_failure IS NULL OR (p_evidence_sha256 IS NOT NULL AND p_evidence_sha256 !~ '^[0-9a-f]{64}$')
    OR (p_known_failure AND p_evidence_sha256 IS NULL) THEN RAISE EXCEPTION 'documented-creation-failure-required'; END IF;
  IF v_attempt.status IN ('returned','failed','unknown') THEN
    IF (v_attempt.status='failed' AND p_known_failure AND v_attempt.failure_evidence_sha256=p_evidence_sha256)
      OR (v_attempt.status='unknown' AND NOT p_known_failure AND v_attempt.failure_evidence_sha256 IS NOT DISTINCT FROM p_evidence_sha256)
      THEN RETURN private.dictionary_creation_run_receipt(v_run); END IF;
    RAISE EXCEPTION 'terminal-creation-attempt';
  END IF;
  UPDATE private.dictionary_creation_generation_attempts SET status=CASE WHEN p_known_failure THEN 'failed' ELSE 'unknown' END,
    failure_evidence_sha256=p_evidence_sha256 WHERE run_id=p_run;
  UPDATE private.dictionary_creation_runs SET status=CASE WHEN p_known_failure THEN 'provider-failed' ELSE 'provider-outcome-unknown' END,
    error_code=CASE WHEN p_known_failure THEN 'provider-failed' ELSE 'provider-outcome-unknown' END WHERE run_id=p_run RETURNING * INTO v_run;
  -- No automatic takeover: every accepted entry still has immutable reviewed identity.
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;
CREATE FUNCTION public.reconcile_dictionary_creation_result_v1(p_run UUID,p_fence TEXT,p_result_sha256 TEXT,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_generation_attempts%ROWTYPE; v_actor UUID; v_allowed BOOLEAN;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_result_sha256 IS DISTINCT FROM v_attempt.result_sha256 OR v_attempt.result IS NULL
    OR p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-creation-reconciliation'; END IF;
  IF v_attempt.reconciliation_evidence_sha256 IS NOT NULL THEN
    IF v_attempt.reconciliation_evidence_sha256<>p_evidence_sha256 THEN RAISE EXCEPTION 'creation-reconciliation-conflict'; END IF;
    RETURN private.dictionary_creation_run_receipt(v_run);
  END IF;
  IF v_run.status<>'provider-outcome-unknown' OR v_attempt.status<>'unknown' THEN RAISE EXCEPTION 'creation-reconciliation-not-required'; END IF;
  IF NOT COALESCE(v_allowed,FALSE) OR v_run.actor_id IS NULL THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  IF private.dictionary_creation_run_ready(v_run) IS NOT TRUE THEN RAISE EXCEPTION 'creation-dispatch-unavailable'; END IF;
  UPDATE private.dictionary_creation_generation_attempts SET status='returned',reconciliation_evidence_sha256=p_evidence_sha256 WHERE run_id=p_run;
  UPDATE private.dictionary_creation_runs SET status='validating',error_code=NULL WHERE run_id=p_run RETURNING * INTO v_run;
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;

ALTER TABLE private.dictionary_creation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_generation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_creation_runs,private.dictionary_creation_generation_attempts FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.record_dictionary_creation_run(),private.bind_dictionary_creation_lease(),private.guard_dictionary_creation_run(),
  private.guard_dictionary_creation_generation_attempt(),private.dictionary_creation_run_receipt(private.dictionary_creation_runs),
  private.lock_dictionary_creation_run(UUID,TEXT),private.dictionary_creation_run_ready(private.dictionary_creation_runs) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_dictionary_creation_work_v1(UUID,UUID),public.start_dictionary_creation_dispatch_v1(UUID,TEXT),
  public.record_dictionary_creation_result_v1(UUID,TEXT,TEXT,JSONB,TEXT),public.record_dictionary_creation_failure_v1(UUID,TEXT,TEXT,BOOLEAN,TEXT),
  public.reconcile_dictionary_creation_result_v1(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_dictionary_creation_work_v1(UUID,UUID),public.start_dictionary_creation_dispatch_v1(UUID,TEXT),
  public.record_dictionary_creation_result_v1(UUID,TEXT,TEXT,JSONB,TEXT),public.record_dictionary_creation_failure_v1(UUID,TEXT,TEXT,BOOLEAN,TEXT),
  public.reconcile_dictionary_creation_result_v1(UUID,TEXT,TEXT,TEXT) TO service_role;
-- Same command parser/reservation, with a live journal receipt on exact replay.
CREATE OR REPLACE FUNCTION public.accept_dictionary_creation_v2(p_command JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_id UUID; v_resolution UUID; v_hash TEXT; v_receipt JSONB; v_ref JSONB;
  v_req private.dictionary_meaning_requests%ROWTYPE; v_identity private.dictionary_creation_identities%ROWTYPE;
  v_runtime private.dictionary_content_runtime%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
  v_anchor UUID; v_allowed BOOLEAN;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_command,ARRAY['protocol_version','operation_id','resolution_id']) IS NOT TRUE
    OR p_command->'protocol_version' IS DISTINCT FROM '2'::JSONB THEN RAISE EXCEPTION 'invalid-creation-command'; END IF;
  v_id:=private.dictionary_creation_uuid(p_command->'operation_id'); v_resolution:=private.dictionary_creation_uuid(p_command->'resolution_id');
  IF v_id=v_resolution THEN RAISE EXCEPTION 'invalid-creation-command'; END IF;
  p_command:=p_command||JSONB_BUILD_OBJECT('operation_id',v_id,'resolution_id',v_resolution);
  v_hash:=private.dictionary_canonical_sha256(p_command);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-command/'||v_actor::TEXT||'/'||v_id::TEXT,0));
  SELECT receipt INTO v_receipt FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id AND request_sha256=v_hash)
      THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF; RETURN public.get_dictionary_creation_operation_v2(v_id);
  END IF;
  IF NOT private.lock_dictionary_analysis_authority(v_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT(v_runtime.creation_resolution_enabled AND v_runtime.creation_operations_enabled) THEN RAISE EXCEPTION 'dictionary-creation-disabled'; END IF;
  SELECT q.* INTO v_policy FROM private.dictionary_creation_profile p JOIN private.dictionary_analysis_validator_policies q
    ON ROW(p.validator_version,p.policy_sha256)=ROW(q.validator_version,q.policy_sha256) WHERE p.singleton FOR SHARE OF p,q;
  IF NOT FOUND OR private.dictionary_analysis_profile_ready(v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256,
    v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes) IS NOT TRUE THEN RAISE EXCEPTION 'creation-profile-unavailable'; END IF;
  SELECT * INTO v_req FROM private.dictionary_meaning_requests WHERE actor_id=v_actor AND resolution_id=v_resolution FOR SHARE;
  IF NOT FOUND OR v_req.receipt->>'outcome' IS DISTINCT FROM 'new-meaning' OR v_req.identity_id IS NULL THEN RAISE EXCEPTION 'resolved-new-meaning-required'; END IF;
  SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=v_req.identity_id FOR SHARE;
  -- All actors for this reviewed sense serialize here; unrelated senses remain separate.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-entry/'||v_identity.entry_id::TEXT,0));
  IF private.dictionary_creation_identity_ready(v_identity) IS NOT TRUE THEN RAISE EXCEPTION 'reviewed-identity-unavailable'; END IF;
  v_ref:=private.dictionary_creation_published(v_identity);
  IF v_ref IS NOT NULL THEN
    v_receipt:=p_command||JSONB_BUILD_OBJECT('outcome','existing-meaning','quota_charged',FALSE,'published',v_ref);
  ELSIF EXISTS(SELECT 1 FROM private.dictionary_creation_leases WHERE identity_id=v_identity.identity_id) THEN
    v_receipt:=p_command||JSONB_BUILD_OBJECT('outcome','creation-in-progress','quota_charged',FALSE);
  ELSE
    IF EXISTS(SELECT 1 FROM public.dictionary_entries WHERE entry_id=v_identity.entry_id) OR EXISTS(SELECT 1 FROM public.dictionary_entries
      WHERE language_code=v_identity.language_code AND LOWER(BTRIM(lemma))=LOWER(BTRIM(v_identity.lemma))
      AND COALESCE(LOWER(BTRIM(part_of_speech)),'')=COALESCE(LOWER(BTRIM(v_identity.part_of_speech)),'')
      AND COALESCE(LOWER(BTRIM(article)),'')=COALESCE(LOWER(BTRIM(v_identity.article)),'') AND sense_key=v_identity.sense_key)
      THEN RAISE EXCEPTION 'reviewed-entry-identity-conflict'; END IF;
    SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(v_actor,'gemini-analysis',v_runtime.analysis_quota_limit,v_runtime.analysis_quota_window_seconds);
    IF NOT v_allowed THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
    INSERT INTO public.dictionary_entries(entry_id,language_code,lemma,part_of_speech,article,sense_key)
      VALUES(v_identity.entry_id,v_identity.language_code,v_identity.lemma,v_identity.part_of_speech,v_identity.article,v_identity.sense_key);
    v_anchor:=pg_catalog.gen_random_uuid();
    INSERT INTO private.dictionary_meaning_anchors(anchor_id,entry_id,source_id,gloss,examples,verified_by,verified_at,audit_reference,anchor_sha256)
      VALUES(v_anchor,v_identity.entry_id,v_identity.source_id,v_identity.gloss,v_identity.examples,v_identity.verified_by,v_identity.verified_at,v_identity.audit_reference,REPEAT('0',64));
    INSERT INTO private.dictionary_meaning_anchor_heads(entry_id,anchor_id) VALUES(v_identity.entry_id,v_anchor);
    INSERT INTO private.dictionary_creation_operations(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,evidence_sha256,
      planned_generation_model,planned_validator_version,planned_policy_sha256,fence)
      VALUES(v_actor,v_id,v_resolution,v_identity.identity_id,v_identity.entry_id,v_anchor,v_identity.evidence_sha256,v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256,1);
    INSERT INTO private.dictionary_creation_leases(entry_id,identity_id,actor_id,operation_id,fence) VALUES(v_identity.entry_id,v_identity.identity_id,v_actor,v_id,1);
    v_receipt:=p_command||JSONB_BUILD_OBJECT('entry_id',v_identity.entry_id,'fence','1','status','accepted','quota_charged',TRUE,
      'result_sha256',NULL,'error_code',NULL,'published',NULL,'published_head_sequence',NULL);
  END IF;
  INSERT INTO private.dictionary_creation_commands(actor_id,operation_id,resolution_id,request_sha256,receipt) VALUES(v_actor,v_id,v_resolution,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

COMMIT;
