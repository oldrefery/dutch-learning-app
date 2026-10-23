-- Dormant creation judgement and first publication. No policy, role or gate seeded.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN creation_judgement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN creation_publication_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE private.dictionary_creation_judge_attempts (
  run_id UUID PRIMARY KEY REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider='gemini'),
  model TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  input JSONB NOT NULL CHECK (JSONB_TYPEOF(input)='object'),
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('dispatching','returned','failed','unknown','quota-denied')),
  quota_charged BOOLEAN NOT NULL CHECK (quota_charged=(status<>'quota-denied')),
  result JSONB CHECK (result IS NULL OR (JSONB_TYPEOF(result)='object' AND OCTET_LENGTH(result::TEXT)<=262144)),
  result_sha256 TEXT CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  provider_request_id TEXT CHECK (provider_request_id IS NULL OR LENGTH(BTRIM(provider_request_id)) BETWEEN 1 AND 500),
  failure_evidence_sha256 TEXT CHECK (failure_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reconciliation_evidence_sha256 TEXT CHECK (reconciliation_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK ((result IS NULL)=(result_sha256 IS NULL)),
  CHECK (status<>'returned' OR result IS NOT NULL),
  CHECK (status<>'failed' OR (result IS NULL AND failure_evidence_sha256 IS NOT NULL)),
  CHECK (status<>'quota-denied' OR result IS NULL),
  CHECK (reconciliation_evidence_sha256 IS NULL OR (status='returned' AND result IS NOT NULL))
);
CREATE UNIQUE INDEX dictionary_creation_unique_judge_response
  ON private.dictionary_creation_judge_attempts(provider,provider_request_id) WHERE provider_request_id IS NOT NULL;
CREATE TABLE private.dictionary_creation_validations (
  validation_id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  proof JSONB NOT NULL CHECK (JSONB_TYPEOF(proof)='object'),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP()
);
CREATE TABLE private.dictionary_creation_publications (
  validation_id UUID PRIMARY KEY REFERENCES private.dictionary_creation_validations(validation_id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  revision_id UUID NOT NULL UNIQUE,
  source_id UUID NOT NULL UNIQUE,
  publication_xid XID8 NOT NULL DEFAULT PG_CURRENT_XACT_ID(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  FOREIGN KEY (entry_id,revision_id) REFERENCES public.dictionary_revisions(entry_id,revision_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (source_id) REFERENCES private.dictionary_sources(source_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
CREATE TRIGGER protect_dictionary_creation_validation BEFORE UPDATE OR DELETE ON private.dictionary_creation_validations
  FOR EACH ROW EXECUTE FUNCTION private.reject_dictionary_history_mutation();
CREATE TRIGGER protect_dictionary_creation_publication BEFORE UPDATE OR DELETE ON private.dictionary_creation_publications
  FOR EACH ROW EXECUTE FUNCTION private.reject_dictionary_history_mutation();
ALTER TABLE private.dictionary_sources ADD COLUMN creation_validation_id UUID UNIQUE
  REFERENCES private.dictionary_creation_validations(validation_id) ON DELETE RESTRICT;
ALTER TABLE private.dictionary_sources DROP CONSTRAINT dictionary_sources_review_fields;
ALTER TABLE private.dictionary_sources ADD CONSTRAINT dictionary_sources_review_fields CHECK (
  (review_state='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_content_sha256 IS NULL
    AND automated_validation_id IS NULL AND creation_validation_id IS NULL)
  OR (review_state='approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_content_sha256 IS NOT NULL
    AND automated_validation_id IS NULL AND creation_validation_id IS NULL)
  OR (review_state='rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_content_sha256 IS NULL
    AND automated_validation_id IS NULL AND creation_validation_id IS NULL)
  OR (review_state='machine_validated' AND source_kind='provider' AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND approved_content_sha256 IS NULL AND ((automated_validation_id IS NOT NULL)<>(creation_validation_id IS NOT NULL)))
);

-- Versioned old row projection preserves registered human source evidence bytes.
CREATE FUNCTION private.dictionary_creation_source_evidence_v1(p_source private.dictionary_sources)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = '' SET timezone = 'UTC' AS $$
  SELECT JSONB_BUILD_OBJECT('source_id',p_source.source_id,'source_kind',p_source.source_kind,
    'provenance_locator',p_source.provenance_locator,'license_metadata',p_source.license_metadata,
    'review_state',p_source.review_state,'reviewed_by',p_source.reviewed_by,'reviewed_at',p_source.reviewed_at,
    'approved_content_sha256',p_source.approved_content_sha256,'created_at',p_source.created_at,
    'automated_validation_id',p_source.automated_validation_id);
$$;
CREATE OR REPLACE FUNCTION private.validate_dictionary_creation_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id=NEW.source_id FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=NEW.verified_by) OR v_source.review_state <> 'approved' OR v_source.reviewed_by IS DISTINCT FROM NEW.verified_by
    OR NEW.verified_at < v_source.reviewed_at OR EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS(NEW.examples) e
      WHERE JSONB_TYPEOF(e) <> 'string' OR LENGTH(BTRIM(e #>> '{}')) NOT BETWEEN 1 AND 4000)
    THEN RAISE EXCEPTION 'unverified-creation-identity'; END IF;
  NEW.source_approval_sha256 := private.dictionary_canonical_sha256(private.dictionary_creation_source_evidence_v1(v_source));
  NEW.evidence_sha256 := private.dictionary_canonical_sha256(TO_JSONB(NEW)-'evidence_sha256');
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.dictionary_creation_identity_ready(p_identity private.dictionary_creation_identities)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE; v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled FROM private.dictionary_creation_identity_availability WHERE identity_id=p_identity.identity_id FOR SHARE;
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id=p_identity.source_id FOR SHARE;
  RETURN COALESCE(v_enabled,FALSE) AND v_source.review_state='approved' AND v_source.reviewed_by=p_identity.verified_by
    AND private.dictionary_canonical_sha256(private.dictionary_creation_source_evidence_v1(v_source))=p_identity.source_approval_sha256;
END;
$$;

ALTER TABLE private.dictionary_creation_runs DROP CONSTRAINT dictionary_creation_runs_status_check;
ALTER TABLE private.dictionary_creation_runs DROP CONSTRAINT dictionary_creation_runs_check;
ALTER TABLE private.dictionary_creation_runs
  ADD COLUMN publication_receipt JSONB,
  ADD CHECK (status IN ('accepted','dispatching','validating','published','rejected','provider-failed',
    'provider-outcome-unknown','authorization-revoked','review-required')),
  ADD CHECK ((status IN ('accepted','dispatching','validating','published') AND error_code IS NULL) OR
    (status NOT IN ('accepted','dispatching','validating','published') AND error_code IS NOT NULL AND error_code ~ '^[a-z][a-z0-9-]{0,99}$')),
  ADD CHECK ((status='published')=(publication_receipt IS NOT NULL));
CREATE OR REPLACE FUNCTION private.guard_dictionary_creation_run()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable-creation-accounting'; END IF;
  IF (TO_JSONB(NEW)-ARRAY['actor_id','status','error_code','publication_receipt']) IS DISTINCT FROM (TO_JSONB(OLD)-ARRAY['actor_id','status','error_code','publication_receipt'])
    THEN RAISE EXCEPTION 'immutable-creation-run-binding'; END IF;
  IF OLD.publication_receipt IS NOT NULL AND (TO_JSONB(NEW)-'actor_id') IS DISTINCT FROM (TO_JSONB(OLD)-'actor_id')
    THEN RAISE EXCEPTION 'immutable-creation-publication-receipt'; END IF;
  IF NEW.publication_receipt IS DISTINCT FROM OLD.publication_receipt THEN
    IF OLD.publication_receipt IS NOT NULL OR NEW.status<>'published' OR NOT EXISTS(
      SELECT 1 FROM private.dictionary_creation_validations v JOIN private.dictionary_creation_publications p USING(validation_id)
      JOIN public.dictionary_revisions r ON r.revision_id=p.revision_id
      JOIN private.dictionary_content_changes c ON c.entry_id=p.entry_id AND c.revision_id=p.revision_id AND c.change_kind='revision-head'
      WHERE v.run_id=OLD.run_id AND p.publication_xid=PG_CURRENT_XACT_ID() AND v.proof->>'outcome'='accepted'
        AND NEW.publication_receipt=JSONB_BUILD_OBJECT('protocol_version',2,'operation_id',OLD.operation_id,'resolution_id',OLD.resolution_id,
          'entry_id',OLD.entry_id,'fence',OLD.fence::TEXT,'status','published','quota_charged',TRUE,
          'result_sha256',v.proof->>'result_sha256','error_code',NULL,
          'published',JSONB_BUILD_OBJECT('reference',JSONB_BUILD_OBJECT('entry_id',OLD.entry_id,'revision_id',r.revision_id),
            'content_sha256',r.content_sha256),'published_head_sequence',c.committed_version::TEXT))
      THEN RAISE EXCEPTION 'guarded-creation-receipt-required'; END IF;
  END IF;
  IF NEW.actor_id IS DISTINCT FROM OLD.actor_id THEN
    IF NEW.actor_id IS NOT NULL OR EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.actor_id)
      THEN RAISE EXCEPTION 'immutable-creation-owner'; END IF;
    -- Preserve an unresolved dispatch and its lease. A known, unsent/returned outcome
    -- can release the lease; the accounting row and any result still survive.
    IF OLD.status NOT IN ('published','rejected','provider-failed','authorization-revoked','review-required')
      AND NOT EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=OLD.run_id AND status IN ('dispatching','unknown'))
      AND NOT EXISTS(SELECT 1 FROM private.dictionary_creation_judge_attempts WHERE run_id=OLD.run_id AND status IN ('dispatching','unknown')) THEN
      NEW.status:='authorization-revoked'; NEW.error_code:='owner-deleted';
      DELETE FROM private.dictionary_creation_leases WHERE run_id=OLD.run_id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('published','rejected','provider-failed','authorization-revoked','review-required') AND ROW(NEW.status,NEW.error_code) IS DISTINCT FROM ROW(OLD.status,OLD.error_code)
    THEN RAISE EXCEPTION 'terminal-creation-run'; END IF;
  IF NEW.status='accepted' AND OLD.status<>'accepted' THEN RAISE EXCEPTION 'creation-status-regression'; END IF;
  IF NEW.status='dispatching' AND OLD.status NOT IN ('accepted','dispatching') THEN RAISE EXCEPTION 'creation-status-regression'; END IF;
  IF NEW.status='validating' AND NOT EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=OLD.run_id AND status='returned')
    THEN RAISE EXCEPTION 'creation-result-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_judge_attempt BEFORE UPDATE OR DELETE ON private.dictionary_creation_judge_attempts
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_generation_attempt();
CREATE OR REPLACE FUNCTION private.guard_dictionary_creation_generation_attempt()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable-creation-accounting'; END IF;
  IF (TO_JSONB(NEW)-ARRAY['status','result','result_sha256','provider_request_id','failure_evidence_sha256','reconciliation_evidence_sha256'])
    IS DISTINCT FROM (TO_JSONB(OLD)-ARRAY['status','result','result_sha256','provider_request_id','failure_evidence_sha256','reconciliation_evidence_sha256'])
    OR (OLD.result IS NOT NULL AND ROW(NEW.result,NEW.result_sha256,NEW.provider_request_id) IS DISTINCT FROM ROW(OLD.result,OLD.result_sha256,OLD.provider_request_id))
    OR (OLD.failure_evidence_sha256 IS NOT NULL AND NEW.failure_evidence_sha256 IS DISTINCT FROM OLD.failure_evidence_sha256)
    OR (OLD.reconciliation_evidence_sha256 IS NOT NULL AND NEW.reconciliation_evidence_sha256 IS DISTINCT FROM OLD.reconciliation_evidence_sha256)
    THEN RAISE EXCEPTION 'immutable-creation-attempt'; END IF;
  IF (OLD.status IN ('returned','failed','quota-denied') AND TO_JSONB(NEW) IS DISTINCT FROM TO_JSONB(OLD)) OR NEW.status='dispatching'
    OR (OLD.status='unknown' AND NEW.status='returned' AND NEW.reconciliation_evidence_sha256 IS NULL)
    OR (OLD.status='unknown' AND NEW.status='failed') THEN RAISE EXCEPTION 'creation-attempt-regression'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.dictionary_creation_run_receipt(p_run private.dictionary_creation_runs)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(p_run.publication_receipt,JSONB_BUILD_OBJECT('protocol_version',2,'operation_id',p_run.operation_id,'resolution_id',p_run.resolution_id,
    'entry_id',p_run.entry_id,'fence',p_run.fence::TEXT,'status',p_run.status,'quota_charged',TRUE,
    'result_sha256',a.result_sha256,'error_code',p_run.error_code,'published',NULL,'published_head_sequence',NULL))
    FROM (SELECT 1) placeholder LEFT JOIN private.dictionary_creation_generation_attempts a ON a.run_id=p_run.run_id;
$$;
CREATE OR REPLACE FUNCTION private.dictionary_creation_run_ready(p_run private.dictionary_creation_runs)
RETURNS BOOLEAN LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_identity private.dictionary_creation_identities%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
BEGIN
  PERFORM 1 FROM private.dictionary_meaning_anchor_heads WHERE entry_id=p_run.entry_id FOR SHARE;
  PERFORM 1 FROM private.dictionary_meaning_anchors WHERE entry_id=p_run.entry_id AND anchor_id=p_run.anchor_id FOR SHARE;
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

CREATE FUNCTION private.dictionary_creation_candidate_error(p_run private.dictionary_creation_runs)
RETURNS TEXT LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_content JSONB; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
BEGIN
  SELECT result->'content' INTO STRICT v_content FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run.run_id AND status='returned';
  IF private.valid_dictionary_analysis_content(v_content) IS NOT TRUE THEN RETURN 'schema-invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dictionary_entries e WHERE e.entry_id=p_run.entry_id AND e.language_code='nl'
    AND ROW(e.lemma,e.part_of_speech,e.article) IS NOT DISTINCT FROM
      ROW(v_content->>'dutch_lemma',v_content->>'part_of_speech',v_content->>'article')) THEN RETURN 'identity-mismatch'; END IF;
  SELECT * INTO STRICT v_policy FROM private.dictionary_analysis_validator_policies WHERE
    ROW(validator_version,policy_sha256)=ROW(p_run.validator_version,p_run.policy_sha256);
  IF private.safe_dictionary_analysis_media(v_content->'image_url',v_policy.media_url_prefixes) IS NOT TRUE
    OR private.safe_dictionary_analysis_media(v_content->'tts_url',v_policy.media_url_prefixes) IS NOT TRUE THEN RETURN 'unsafe-media'; END IF;
  RETURN NULL;
END;
$$;
CREATE FUNCTION public.get_dictionary_creation_judgement_v1(p_run UUID,p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_judge_attempts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=p_run;
  IF p_fence IS DISTINCT FROM v_run.fence::TEXT THEN RAISE EXCEPTION 'creation-fence-conflict'; END IF;
  SELECT * INTO v_attempt FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run;
  RETURN JSONB_BUILD_OBJECT('receipt',private.dictionary_creation_run_receipt(v_run),'attempt',CASE WHEN FOUND THEN TO_JSONB(v_attempt) ELSE NULL END);
END;
$$;
CREATE FUNCTION public.start_dictionary_creation_judgement_v1(p_run UUID,p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_actor UUID; v_authorized BOOLEAN; v_allowed BOOLEAN;
  v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_runtime private.dictionary_content_runtime%ROWTYPE;
  v_gen private.dictionary_creation_generation_attempts%ROWTYPE; v_anchor private.dictionary_meaning_anchors%ROWTYPE;
  v_input JSONB;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_authorized:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run) THEN
    IF v_run.status='validating' AND EXISTS(SELECT 1 FROM private.dictionary_creation_judge_attempts
      WHERE run_id=p_run AND status='dispatching' AND dispatched_at<NOW()-INTERVAL '2 minutes') THEN
      UPDATE private.dictionary_creation_judge_attempts SET status='unknown' WHERE run_id=p_run;
      UPDATE private.dictionary_creation_runs SET status='provider-outcome-unknown',error_code='judge-outcome-unknown' WHERE run_id=p_run;
    END IF;
    RETURN public.get_dictionary_creation_judgement_v1(p_run,p_fence)||JSONB_BUILD_OBJECT('dispatch',NULL);
  END IF;
  IF v_run.status<>'validating' OR EXISTS(SELECT 1 FROM private.dictionary_creation_validations WHERE run_id=p_run)
    THEN RAISE EXCEPTION 'invalid-creation-transition'; END IF;
  IF NOT COALESCE(v_authorized,FALSE) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT v_runtime.creation_judgement_enabled OR private.dictionary_creation_run_ready(v_run) IS NOT TRUE THEN RAISE EXCEPTION 'creation-judgement-unavailable'; END IF;
  IF private.dictionary_creation_candidate_error(v_run) IS NOT NULL THEN RAISE EXCEPTION 'creation-candidate-invalid'; END IF;
  SELECT * INTO STRICT v_policy FROM private.dictionary_analysis_validator_policies WHERE
    ROW(validator_version,policy_sha256)=ROW(v_run.validator_version,v_run.policy_sha256) FOR SHARE;
  IF v_policy.semantic_model=v_run.generation_model THEN RAISE EXCEPTION 'independent-judge-required'; END IF;
  SELECT * INTO STRICT v_gen FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run;
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE anchor_id=v_run.anchor_id;
  v_input:=JSONB_BUILD_OBJECT('schema_version',1,'anchor',JSONB_BUILD_OBJECT('anchor_sha256',v_anchor.anchor_sha256,
    'gloss',v_anchor.gloss,'examples',v_anchor.examples),'candidate',v_gen.result->'content',
    'content_sha256',private.dictionary_canonical_sha256(v_gen.result->'content'),'result_sha256',v_gen.result_sha256,
    'generation_input_sha256',v_gen.input_sha256,'fence',v_run.fence::TEXT,'evidence_sha256',v_run.evidence_sha256,
    'validator_version',v_run.validator_version,'policy_sha256',v_run.policy_sha256,'prompt_sha256',v_policy.semantic_prompt_sha256);
  SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(v_actor,'gemini-analysis',v_runtime.analysis_quota_limit,v_runtime.analysis_quota_window_seconds);
  INSERT INTO private.dictionary_creation_judge_attempts(run_id,provider,model,prompt_sha256,input,input_sha256,status,quota_charged)
    VALUES(p_run,'gemini',v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_input,private.dictionary_canonical_sha256(v_input),
      CASE WHEN v_allowed THEN 'dispatching' ELSE 'quota-denied' END,v_allowed);
  IF NOT v_allowed THEN
    UPDATE private.dictionary_creation_runs SET status='review-required',error_code='judge-quota-denied' WHERE run_id=p_run;
  END IF;
  RETURN public.get_dictionary_creation_judgement_v1(p_run,p_fence)||JSONB_BUILD_OBJECT('dispatch',CASE WHEN v_allowed THEN
    JSONB_BUILD_OBJECT('run_id',p_run,'fence',p_fence,'provider','gemini','model',v_policy.semantic_model,
      'prompt_sha256',v_policy.semantic_prompt_sha256,'input',v_input,'input_sha256',private.dictionary_canonical_sha256(v_input)) ELSE NULL END);
END;
$$;
CREATE OR REPLACE FUNCTION public.record_dictionary_creation_judgement_v1(p_run UUID,p_fence TEXT,p_input_sha256 TEXT,p_result JSONB,p_provider_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_judge_attempts%ROWTYPE;
  v_actor UUID; v_allowed BOOLEAN; v_hash TEXT; v_unknown BOOLEAN;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_input_sha256 IS DISTINCT FROM v_attempt.input_sha256 THEN RAISE EXCEPTION 'creation-attempt-conflict'; END IF;
  IF JSONB_TYPEOF(p_result) IS DISTINCT FROM 'object' OR OCTET_LENGTH(p_result::TEXT)>262144
    OR (p_provider_request_id IS NOT NULL AND LENGTH(BTRIM(p_provider_request_id)) NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'invalid-creation-result'; END IF;
  v_hash:=private.dictionary_canonical_sha256(p_result);
  IF v_attempt.result IS NOT NULL THEN
    IF ROW(v_attempt.result_sha256,v_attempt.provider_request_id) IS DISTINCT FROM ROW(v_hash,p_provider_request_id)
      THEN RAISE EXCEPTION 'creation-result-conflict'; END IF;
    RETURN private.dictionary_creation_run_receipt(v_run);
  END IF;
  IF v_run.status NOT IN ('validating','provider-outcome-unknown') THEN RAISE EXCEPTION 'terminal-creation-run'; END IF;
  IF v_attempt.status IN ('failed','quota-denied') THEN RAISE EXCEPTION 'terminal-creation-attempt'; END IF;
  v_unknown:=v_attempt.status='unknown' OR v_attempt.dispatched_at<NOW()-INTERVAL '2 minutes' OR v_run.actor_id IS NULL;
  UPDATE private.dictionary_creation_judge_attempts SET result=p_result,result_sha256=v_hash,provider_request_id=p_provider_request_id,
    status=CASE WHEN v_unknown THEN 'unknown' ELSE 'returned' END WHERE run_id=p_run;
  IF v_unknown THEN
    UPDATE private.dictionary_creation_runs SET status='provider-outcome-unknown',error_code='provider-outcome-unknown' WHERE run_id=p_run RETURNING * INTO v_run;
  ELSIF NOT COALESCE(v_allowed,FALSE) THEN
    UPDATE private.dictionary_creation_runs SET status='authorization-revoked',error_code='analysis-permission-revoked' WHERE run_id=p_run RETURNING * INTO v_run;
    DELETE FROM private.dictionary_creation_leases WHERE run_id=p_run;
  ELSIF private.dictionary_creation_run_ready(v_run) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_judgement_enabled) THEN
    UPDATE private.dictionary_creation_runs SET status='review-required',error_code='creation-dependency-withdrawn' WHERE run_id=p_run RETURNING * INTO v_run;
  ELSE
    UPDATE private.dictionary_creation_runs SET status='validating',error_code=NULL WHERE run_id=p_run RETURNING * INTO v_run;
  END IF;
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;
CREATE OR REPLACE FUNCTION public.fail_dictionary_creation_judgement_v1(p_run UUID,p_fence TEXT,p_input_sha256 TEXT,p_known_failure BOOLEAN,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_judge_attempts%ROWTYPE; v_actor UUID;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  PERFORM private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_input_sha256 IS DISTINCT FROM v_attempt.input_sha256 THEN RAISE EXCEPTION 'creation-attempt-conflict'; END IF;
  IF p_known_failure IS NULL OR (p_evidence_sha256 IS NOT NULL AND p_evidence_sha256 !~ '^[0-9a-f]{64}$')
    OR (p_known_failure AND p_evidence_sha256 IS NULL) THEN RAISE EXCEPTION 'documented-creation-failure-required'; END IF;
  IF v_attempt.status IN ('returned','failed','unknown','quota-denied') THEN
    IF (v_attempt.status='failed' AND p_known_failure AND v_attempt.failure_evidence_sha256=p_evidence_sha256)
      OR (v_attempt.status='unknown' AND NOT p_known_failure AND v_attempt.failure_evidence_sha256 IS NOT DISTINCT FROM p_evidence_sha256)
      THEN RETURN private.dictionary_creation_run_receipt(v_run); END IF;
    RAISE EXCEPTION 'terminal-creation-attempt';
  END IF;
  UPDATE private.dictionary_creation_judge_attempts SET status=CASE WHEN p_known_failure THEN 'failed' ELSE 'unknown' END,
    failure_evidence_sha256=p_evidence_sha256 WHERE run_id=p_run;
  UPDATE private.dictionary_creation_runs SET status=CASE WHEN p_known_failure THEN 'provider-failed' ELSE 'provider-outcome-unknown' END,
    error_code=CASE WHEN p_known_failure THEN 'provider-failed' ELSE 'provider-outcome-unknown' END WHERE run_id=p_run RETURNING * INTO v_run;
  -- No automatic takeover: every accepted entry still has immutable reviewed identity.
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;
CREATE OR REPLACE FUNCTION public.reconcile_dictionary_creation_judgement_v1(p_run UUID,p_fence TEXT,p_result_sha256 TEXT,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_attempt private.dictionary_creation_judge_attempts%ROWTYPE; v_actor UUID; v_allowed BOOLEAN;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_attempt FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run FOR UPDATE;
  IF NOT FOUND OR p_result_sha256 IS DISTINCT FROM v_attempt.result_sha256 OR v_attempt.result IS NULL
    OR p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-creation-reconciliation'; END IF;
  IF v_attempt.reconciliation_evidence_sha256 IS NOT NULL THEN
    IF v_attempt.reconciliation_evidence_sha256<>p_evidence_sha256 THEN RAISE EXCEPTION 'creation-reconciliation-conflict'; END IF;
    RETURN private.dictionary_creation_run_receipt(v_run);
  END IF;
  IF v_run.status<>'provider-outcome-unknown' OR v_attempt.status<>'unknown' THEN RAISE EXCEPTION 'creation-reconciliation-not-required'; END IF;
  IF NOT COALESCE(v_allowed,FALSE) OR v_run.actor_id IS NULL THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  IF private.dictionary_creation_run_ready(v_run) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_judgement_enabled) THEN RAISE EXCEPTION 'creation-dispatch-unavailable'; END IF;
  UPDATE private.dictionary_creation_judge_attempts SET status='returned',reconciliation_evidence_sha256=p_evidence_sha256 WHERE run_id=p_run;
  UPDATE private.dictionary_creation_runs SET status='validating',error_code=NULL WHERE run_id=p_run RETURNING * INTO v_run;
  RETURN private.dictionary_creation_run_receipt(v_run);
END;
$$;

-- Derive authority from retained server journals. Caller never supplies an outcome.
CREATE FUNCTION private.dictionary_creation_validation_proof(p_run private.dictionary_creation_runs)
RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_gen private.dictionary_creation_generation_attempts%ROWTYPE; v_judge private.dictionary_creation_judge_attempts%ROWTYPE;
  v_anchor private.dictionary_meaning_anchors%ROWTYPE; v_policy private.dictionary_analysis_validator_policies%ROWTYPE;
  v_content JSONB; v_verdict JSONB; v_outcome TEXT:='accepted'; v_decision TEXT; v_claim TEXT; v_judge_proof JSONB;
BEGIN
  SELECT * INTO STRICT v_gen FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run.run_id AND status='returned';
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE anchor_id=p_run.anchor_id;
  SELECT * INTO STRICT v_policy FROM private.dictionary_analysis_validator_policies WHERE
    ROW(validator_version,policy_sha256)=ROW(p_run.validator_version,p_run.policy_sha256);
  v_content:=v_gen.result->'content'; v_decision:=private.dictionary_creation_candidate_error(p_run);
  IF v_decision IS NOT NULL THEN v_outcome:='rejected';
  ELSE
    SELECT * INTO STRICT v_judge FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run.run_id;
    v_verdict:=v_judge.result->'content';
    IF v_judge.status<>'returned' OR NOT v_judge.quota_charged OR v_judge.model=p_run.generation_model
      OR ROW(v_judge.model,v_judge.prompt_sha256) IS DISTINCT FROM ROW(v_policy.semantic_model,v_policy.semantic_prompt_sha256)
      OR ROW(v_judge.input->>'result_sha256',v_judge.input->>'content_sha256',v_judge.input#>>'{anchor,anchor_sha256}',v_judge.input->>'fence')
        IS DISTINCT FROM ROW(v_gen.result_sha256,private.dictionary_canonical_sha256(v_content),v_anchor.anchor_sha256,p_run.fence::TEXT)
      OR private.jsonb_has_exact_keys(v_verdict,ARRAY['schema_version','anchor_sha256','content_sha256','result_sha256','decision','checks']) IS NOT TRUE
      OR v_verdict->'schema_version' IS DISTINCT FROM '1'::JSONB
      OR ROW(v_verdict->>'anchor_sha256',v_verdict->>'content_sha256',v_verdict->>'result_sha256') IS DISTINCT FROM
        ROW(v_anchor.anchor_sha256,private.dictionary_canonical_sha256(v_content),v_gen.result_sha256)
      OR JSONB_TYPEOF(v_verdict->'checks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'independent-creation-evidence-required'; END IF;
    IF JSONB_ARRAY_LENGTH(v_verdict->'checks')<>6 OR
      (SELECT COUNT(DISTINCT c->>'dimension') FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c)<>6 OR
      EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c WHERE
        private.jsonb_has_exact_keys(c,ARRAY['dimension','verdict','reason','anchor_quote']) IS NOT TRUE
        OR c->>'dimension' NOT IN ('translations-en','translations-ru','examples','related-words','notes','grammar')
        OR c->>'verdict' NOT IN ('preserved','contradicted','uncertain') OR JSONB_TYPEOF(c->'verdict') IS DISTINCT FROM 'string'
        OR private.dictionary_bounded_text(c->'reason',1000) IS NOT TRUE
        OR private.dictionary_bounded_text(c->'anchor_quote',1000) IS NOT TRUE OR LENGTH(c->>'anchor_quote')<8
        OR (STRPOS(v_anchor.gloss,c->>'anchor_quote')=0 AND NOT EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS_TEXT(v_anchor.examples) x WHERE STRPOS(x,c->>'anchor_quote')>0)))
      THEN RAISE EXCEPTION 'independent-creation-evidence-required'; END IF;
    v_claim:=CASE WHEN EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c WHERE c->>'verdict'='contradicted') THEN 'different-meaning'
      WHEN EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c WHERE c->>'verdict'='uncertain') THEN 'uncertain' ELSE 'same-meaning' END;
    IF v_verdict->>'decision' IS DISTINCT FROM v_claim THEN RAISE EXCEPTION 'inconsistent-creation-verdict'; END IF;
    v_outcome:=CASE v_claim WHEN 'different-meaning' THEN 'rejected' WHEN 'uncertain' THEN 'review-required' ELSE 'accepted' END;
    v_decision:=CASE v_claim WHEN 'different-meaning' THEN 'meaning-mismatch' WHEN 'uncertain' THEN 'meaning-uncertain' ELSE 'same-meaning' END;
    v_judge_proof:=JSONB_BUILD_OBJECT('input_sha256',v_judge.input_sha256,'result_sha256',v_judge.result_sha256,
      'model',v_judge.model,'prompt_sha256',v_judge.prompt_sha256,'verdict',v_verdict);
  END IF;
  RETURN JSONB_BUILD_OBJECT('run_id',p_run.run_id,'entry_id',p_run.entry_id,'identity_id',p_run.identity_id,'fence',p_run.fence::TEXT,
    'anchor_id',p_run.anchor_id,'anchor_sha256',v_anchor.anchor_sha256,'evidence_sha256',p_run.evidence_sha256,
    'validator_version',p_run.validator_version,'policy_sha256',p_run.policy_sha256,'provider',v_gen.provider,'model',v_gen.model,
    'input_sha256',v_gen.input_sha256,'result_sha256',v_gen.result_sha256,'judge',v_judge_proof,'outcome',v_outcome,'decision_code',v_decision,
    'content',CASE WHEN v_outcome='accepted' THEN v_content ELSE NULL END,
    'content_sha256',CASE WHEN v_outcome='accepted' THEN private.dictionary_canonical_sha256(v_content) ELSE NULL END,
    'cefr_input_sha256',CASE WHEN v_outcome='accepted' THEN private.dictionary_cefr_content_sha256(v_content) ELSE NULL END);
END;
$$;
CREATE FUNCTION private.guard_dictionary_creation_validation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=NEW.run_id;
  IF v_run.status<>'validating' OR NEW.proof IS DISTINCT FROM private.dictionary_creation_validation_proof(v_run)
    THEN RAISE EXCEPTION 'derived-creation-validation-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_validation BEFORE INSERT ON private.dictionary_creation_validations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_validation();
CREATE FUNCTION public.validate_dictionary_creation_v1(p_run UUID,p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_actor UUID; v_allowed BOOLEAN;
  v_validation private.dictionary_creation_validations%ROWTYPE; v_proof JSONB;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_validation FROM private.dictionary_creation_validations WHERE run_id=p_run;
  IF NOT FOUND THEN
    IF v_run.status<>'validating' THEN RAISE EXCEPTION 'invalid-creation-transition'; END IF;
    IF NOT COALESCE(v_allowed,FALSE) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
    IF private.dictionary_creation_run_ready(v_run) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_judgement_enabled)
      THEN RAISE EXCEPTION 'creation-validation-unavailable'; END IF;
    v_proof:=private.dictionary_creation_validation_proof(v_run);
    INSERT INTO private.dictionary_creation_validations(run_id,proof) VALUES(p_run,v_proof) RETURNING * INTO v_validation;
    IF v_proof->>'outcome'<>'accepted' THEN
      UPDATE private.dictionary_creation_runs SET status=v_proof->>'outcome',error_code=v_proof->>'decision_code' WHERE run_id=p_run RETURNING * INTO v_run;
    END IF;
  END IF;
  RETURN JSONB_BUILD_OBJECT('receipt',private.dictionary_creation_run_receipt(v_run),'validation_id',v_validation.validation_id,
    'outcome',v_validation.proof->>'outcome','decision_code',v_validation.proof->>'decision_code');
END;
$$;
CREATE OR REPLACE FUNCTION private.guard_dictionary_machine_source()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.review_state = 'machine_validated' THEN RAISE EXCEPTION 'Referenced dictionary provenance is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.review_state = 'machine_validated' AND NOT EXISTS (
    SELECT 1 FROM private.dictionary_analysis_publications p JOIN private.dictionary_analysis_validations v USING (validation_id)
    WHERE p.source_id = NEW.source_id AND p.validation_id = NEW.automated_validation_id
      AND p.publication_xid = PG_CURRENT_XACT_ID() AND v.outcome = 'accepted' AND v.entry_id = p.entry_id
  ) AND NOT EXISTS(
    SELECT 1 FROM private.dictionary_creation_publications p JOIN private.dictionary_creation_validations v USING(validation_id)
    WHERE p.source_id=NEW.source_id AND p.validation_id=NEW.creation_validation_id AND NEW.automated_validation_id IS NULL
      AND p.publication_xid=PG_CURRENT_XACT_ID() AND v.proof->>'outcome'='accepted' AND v.proof->>'entry_id'=p.entry_id::TEXT
  ) THEN RAISE EXCEPTION 'guarded-machine-publication-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION private.validate_dictionary_revision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id = NEW.source_id FOR SHARE;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = NEW.entry_id FOR SHARE;
  IF v_source.review_state = 'machine_validated' THEN
    IF NEW.review_status <> 'published' OR NEW.reviewed_at IS NOT NULL OR (NOT EXISTS (
      SELECT 1 FROM private.dictionary_analysis_publications p JOIN private.dictionary_analysis_validations v USING (validation_id)
      WHERE p.source_id = NEW.source_id AND p.entry_id = NEW.entry_id AND p.revision_id = NEW.revision_id
        AND p.validation_id = v_source.automated_validation_id AND p.publication_xid = PG_CURRENT_XACT_ID()
        AND v.outcome = 'accepted' AND v.content = NEW.content AND v.content_sha256 = NEW.content_sha256
        AND v.cefr_input_sha256 = NEW.cefr_input_sha256 AND NEW.schema_version = 1
    ) AND NOT EXISTS(
      SELECT 1 FROM private.dictionary_creation_publications p JOIN private.dictionary_creation_validations v USING(validation_id)
      WHERE p.source_id=NEW.source_id AND p.entry_id=NEW.entry_id AND p.revision_id=NEW.revision_id
        AND p.validation_id=v_source.creation_validation_id AND v_source.automated_validation_id IS NULL AND p.publication_xid=PG_CURRENT_XACT_ID()
        AND v.proof->>'outcome'='accepted' AND v.proof->'content'=NEW.content AND v.proof->>'content_sha256'=NEW.content_sha256
        AND v.proof->>'cefr_input_sha256'=NEW.cefr_input_sha256 AND NEW.schema_version=1 AND NEW.revision_no=1
    )) THEN RAISE EXCEPTION 'guarded-machine-publication-required'; END IF;
  ELSIF NEW.review_status IN ('published', 'retired') THEN
    IF v_source.review_state <> 'approved' OR v_source.approved_content_sha256 IS DISTINCT FROM NEW.content_sha256 THEN
      RAISE EXCEPTION 'Published dictionary revisions require matching approved provenance';
    END IF;
    IF NEW.reviewed_at IS NULL THEN RAISE EXCEPTION 'Human dictionary revisions require reviewed_at' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.publish_dictionary_creation_v1(p_run UUID,p_fence TEXT,p_validation UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE; v_actor UUID; v_allowed BOOLEAN;
  v_validation private.dictionary_creation_validations%ROWTYPE; v_source UUID; v_revision UUID; v_sequence BIGINT; v_receipt JSONB;
BEGIN
  SELECT actor_id INTO v_actor FROM private.dictionary_creation_runs WHERE run_id=p_run;
  v_allowed:=private.lock_dictionary_analysis_authority(v_actor);
  v_run:=private.lock_dictionary_creation_run(p_run,p_fence);
  SELECT * INTO v_validation FROM private.dictionary_creation_validations WHERE run_id=p_run AND validation_id=p_validation;
  IF NOT FOUND OR v_validation.proof->>'outcome'<>'accepted' THEN RAISE EXCEPTION 'creation-validation-mismatch'; END IF;
  IF v_run.status='published' THEN RETURN v_run.publication_receipt; END IF;
  IF v_run.status<>'validating' THEN RAISE EXCEPTION 'invalid-creation-transition'; END IF;
  IF NOT COALESCE(v_allowed,FALSE) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  IF private.dictionary_creation_run_ready(v_run) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM private.dictionary_content_runtime
    WHERE singleton AND creation_judgement_enabled AND creation_publication_enabled)
    THEN RAISE EXCEPTION 'creation-publication-unavailable'; END IF;
  IF v_validation.proof IS DISTINCT FROM private.dictionary_creation_validation_proof(v_run) THEN RAISE EXCEPTION 'creation-validation-mismatch'; END IF;
  v_source:=pg_catalog.gen_random_uuid(); v_revision:=pg_catalog.gen_random_uuid();
  INSERT INTO private.dictionary_creation_publications(validation_id,entry_id,revision_id,source_id)
    VALUES(p_validation,v_run.entry_id,v_revision,v_source);
  INSERT INTO private.dictionary_sources(source_id,source_kind,provenance_locator,license_metadata,review_state,creation_validation_id)
    VALUES(v_source,'provider','creation-validation:'||p_validation::TEXT,
      JSONB_BUILD_OBJECT('protected_anchor_source_id',(SELECT source_id FROM private.dictionary_meaning_anchors WHERE anchor_id=v_run.anchor_id)),
      'machine_validated',p_validation);
  INSERT INTO public.dictionary_revisions(revision_id,entry_id,revision_no,schema_version,content,content_sha256,cefr_input_sha256,
    source_id,review_status,reviewed_at,published_at)
    VALUES(v_revision,v_run.entry_id,1,1,v_validation.proof->'content',v_validation.proof->>'content_sha256',v_validation.proof->>'cefr_input_sha256',
      v_source,'published',NULL,CLOCK_TIMESTAMP());
  INSERT INTO public.dictionary_entry_heads(entry_id,revision_id) VALUES(v_run.entry_id,v_revision);
  UPDATE public.dictionary_entries SET state='published' WHERE entry_id=v_run.entry_id;
  SELECT committed_version INTO STRICT v_sequence FROM private.dictionary_content_changes
    WHERE entry_id=v_run.entry_id AND revision_id=v_revision AND change_kind='revision-head';
  v_receipt:=private.dictionary_creation_run_receipt(v_run)||JSONB_BUILD_OBJECT('status','published',
    'published',JSONB_BUILD_OBJECT('reference',JSONB_BUILD_OBJECT('entry_id',v_run.entry_id,'revision_id',v_revision),
      'content_sha256',v_validation.proof->>'content_sha256'),'published_head_sequence',v_sequence::TEXT);
  UPDATE private.dictionary_creation_runs SET status='published',error_code=NULL,publication_receipt=v_receipt WHERE run_id=p_run;
  DELETE FROM private.dictionary_creation_leases WHERE run_id=p_run;
  RETURN v_receipt;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_dictionary_revision_provenance_v2(p_revision_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF p_revision_ids IS NULL OR CARDINALITY(p_revision_ids) > 500 OR ARRAY_POSITION(p_revision_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid-provenance-batch'; END IF;
  RETURN (SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('revision_id', r.revision_id,
    'method', CASE WHEN s.review_state = 'machine_validated' THEN 'automated' ELSE 'human' END,
    'validator_version', COALESCE(v.validator_version,cv.proof->>'validator_version'),
    'provider', COALESCE(v.provider,cv.proof->>'provider'), 'model', COALESCE(v.model,cv.proof->>'model'),
    'content_sha256', r.content_sha256, 'verified_at', COALESCE(v.validated_at,cv.validated_at,r.reviewed_at)) ORDER BY r.revision_id), '[]'::JSONB)
    FROM public.dictionary_revisions r JOIN private.dictionary_sources s USING (source_id)
    LEFT JOIN private.dictionary_analysis_validations v ON v.validation_id = s.automated_validation_id
    LEFT JOIN private.dictionary_creation_validations cv ON cv.validation_id=s.creation_validation_id
    WHERE r.revision_id = ANY(p_revision_ids) AND ((r.review_status = 'published'
      AND EXISTS (SELECT 1 FROM public.dictionary_entries e WHERE e.entry_id = r.entry_id AND e.state = 'published'))
      OR (r.review_status IN ('published','retired') AND EXISTS (SELECT 1 FROM public.words w
        WHERE w.user_id = auth.uid() AND w.dictionary_entry_id = r.entry_id AND w.dictionary_revision_id = r.revision_id))));
END;
$$;
ALTER TABLE private.dictionary_creation_judge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_creation_judge_attempts,private.dictionary_creation_validations,private.dictionary_creation_publications
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.dictionary_creation_source_evidence_v1(private.dictionary_sources) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.dictionary_creation_candidate_error(private.dictionary_creation_runs) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_dictionary_creation_judgement_v1(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_dictionary_creation_judgement_v1(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.start_dictionary_creation_judgement_v1(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_dictionary_creation_judgement_v1(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION private.dictionary_creation_validation_proof(private.dictionary_creation_runs) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.guard_dictionary_creation_validation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.validate_dictionary_creation_v1(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_dictionary_creation_v1(UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.publish_dictionary_creation_v1(UUID,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_dictionary_creation_v1(UUID,TEXT,UUID) TO service_role;
REVOKE ALL ON FUNCTION public.record_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,JSONB,TEXT),
  public.fail_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,BOOLEAN,TEXT),
  public.reconcile_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,JSONB,TEXT),
  public.fail_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,BOOLEAN,TEXT),
  public.reconcile_dictionary_creation_judgement_v1(UUID,TEXT,TEXT,TEXT) TO service_role;
COMMIT;
