-- Dormant audited same-owner recovery. No source, role, gate or provider is seeded.
-- A review never retries an unknown attempt or rewrites prior paid accounting.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN creation_recovery_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE private.dictionary_creation_recovery_reviews (
  review_id UUID PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prior_run_id UUID NOT NULL REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  resolution_id UUID NOT NULL,
  request JSONB NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot JSONB NOT NULL,
  snapshot_sha256 TEXT NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  audit_evidence_sha256 TEXT NOT NULL CHECK (audit_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reviewed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > reviewed_at),
  receipt JSONB NOT NULL
);
CREATE TABLE private.dictionary_creation_recoveries (
  review_id UUID PRIMARY KEY REFERENCES private.dictionary_creation_recovery_reviews(review_id) ON DELETE RESTRICT,
  prior_run_id UUID NOT NULL UNIQUE REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  new_run_id UUID NOT NULL UNIQUE REFERENCES private.dictionary_creation_runs(run_id) ON DELETE RESTRICT,
  command_sha256 TEXT NOT NULL CHECK (command_sha256 ~ '^[0-9a-f]{64}$'),
  consumption_xid XID8 NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP()
);

-- Both Auth locks precede entry/run locks, in one order for owner/reviewer deletion.
CREATE FUNCTION private.lock_dictionary_creation_recovery_authority(p_actor UUID,p_reviewer UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM auth.users WHERE id IN (p_actor,p_reviewer) ORDER BY id FOR KEY SHARE;
  IF p_actor IS NULL OR p_reviewer IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_reviewer)
    THEN RAISE EXCEPTION 'recovery-owner-or-reviewer-unavailable'; END IF;
  IF private.lock_dictionary_analysis_authority(p_actor) IS NOT TRUE THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM private.dictionary_administrators WHERE user_id=p_reviewer AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'administrator-required' USING ERRCODE='42501'; END IF;
END;
$$;

-- Snapshot neutral authority and definitive accounting, never private prompts or
-- a caller's claim that a provider failure/semantic verdict is safe to retry.
CREATE FUNCTION private.dictionary_creation_recovery_snapshot(p_run private.dictionary_creation_runs,p_resolution UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SET search_path = '' SET TimeZone='UTC' AS $$
DECLARE v_identity private.dictionary_creation_identities%ROWTYPE;
  v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_req private.dictionary_meaning_requests%ROWTYPE;
  v_anchor private.dictionary_meaning_anchors%ROWTYPE; v_generation JSONB; v_judge JSONB; v_validation JSONB;
BEGIN
  IF p_run.actor_id IS NULL OR p_run.status NOT IN ('provider-failed','authorization-revoked','review-required','rejected')
    THEN RAISE EXCEPTION 'creation-recovery-definitive-owner-required'; END IF;
  PERFORM 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run.run_id FOR SHARE;
  PERFORM 1 FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run.run_id FOR SHARE;
  PERFORM 1 FROM private.dictionary_creation_validations WHERE run_id=p_run.run_id FOR SHARE;
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run.run_id AND status IN ('dispatching','unknown'))
    OR EXISTS(SELECT 1 FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run.run_id AND status IN ('dispatching','unknown'))
    THEN RAISE EXCEPTION 'creation-recovery-unknown-quarantined'; END IF;
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton AND creation_recovery_enabled
    AND creation_resolution_enabled AND creation_operations_enabled AND creation_dispatch_enabled
    AND creation_judgement_enabled AND creation_publication_enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dictionary-creation-recovery-disabled'; END IF;
  SELECT q.* INTO v_policy FROM private.dictionary_creation_profile p JOIN private.dictionary_analysis_validator_policies q
    ON ROW(p.validator_version,p.policy_sha256)=ROW(q.validator_version,q.policy_sha256) WHERE p.singleton FOR SHARE OF p,q;
  IF NOT FOUND OR private.dictionary_analysis_profile_ready(v_policy.generation_model,v_policy.validator_version,v_policy.policy_sha256,
    v_policy.semantic_model,v_policy.semantic_prompt_sha256,v_policy.media_url_prefixes) IS NOT TRUE THEN RAISE EXCEPTION 'creation-profile-unavailable'; END IF;
  SELECT * INTO STRICT v_identity FROM private.dictionary_creation_identities WHERE identity_id=p_run.identity_id FOR SHARE;
  IF private.dictionary_creation_identity_ready(v_identity) IS NOT TRUE OR ROW(v_identity.entry_id,v_identity.evidence_sha256)
    IS DISTINCT FROM ROW(p_run.entry_id,p_run.evidence_sha256) THEN RAISE EXCEPTION 'reviewed-identity-unavailable'; END IF;
  SELECT * INTO v_req FROM private.dictionary_meaning_requests WHERE actor_id=p_run.actor_id AND resolution_id=p_resolution FOR SHARE;
  IF NOT FOUND OR p_resolution=p_run.resolution_id OR v_req.identity_id IS DISTINCT FROM p_run.identity_id
    OR v_req.receipt->>'outcome' IS DISTINCT FROM 'new-meaning' THEN RAISE EXCEPTION 'fresh-resolved-new-meaning-required'; END IF;
  PERFORM 1 FROM private.dictionary_meaning_anchor_heads WHERE entry_id=p_run.entry_id AND anchor_id=p_run.anchor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'creation-recovery-anchor-conflict'; END IF;
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE entry_id=p_run.entry_id AND anchor_id=p_run.anchor_id FOR SHARE;
  IF ROW(v_anchor.source_id,v_anchor.gloss,v_anchor.examples,v_anchor.verified_by,v_anchor.verified_at) IS DISTINCT FROM
    ROW(v_identity.source_id,v_identity.gloss,v_identity.examples,v_identity.verified_by,v_identity.verified_at)
    THEN RAISE EXCEPTION 'creation-recovery-anchor-conflict'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dictionary_entries WHERE entry_id=p_run.entry_id AND state='draft'
    AND ROW(language_code,lemma,part_of_speech,article,sense_key) IS NOT DISTINCT FROM
      ROW(v_identity.language_code,v_identity.lemma,v_identity.part_of_speech,v_identity.article,v_identity.sense_key))
    OR EXISTS(SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id=p_run.entry_id)
    OR EXISTS(SELECT 1 FROM public.dictionary_revisions WHERE entry_id=p_run.entry_id)
    THEN RAISE EXCEPTION 'creation-recovery-unpublished-draft-required'; END IF;
  SELECT TO_JSONB(a)-ARRAY['input','result','dispatched_at'] INTO v_generation
    FROM private.dictionary_creation_generation_attempts a WHERE run_id=p_run.run_id;
  SELECT TO_JSONB(a)-ARRAY['input','result','dispatched_at'] INTO v_judge
    FROM private.dictionary_creation_judge_attempts a WHERE run_id=p_run.run_id;
  SELECT JSONB_BUILD_OBJECT('validation_id',v.validation_id,'proof_sha256',private.dictionary_canonical_sha256(v.proof)) INTO v_validation
    FROM private.dictionary_creation_validations v WHERE run_id=p_run.run_id;
  RETURN JSONB_BUILD_OBJECT('schema_version',1,'prior_run',TO_JSONB(p_run),'generation_attempt',v_generation,
    'judge_attempt',v_judge,'validation',v_validation,'identity_evidence_sha256',v_identity.evidence_sha256,
    'source_approval_sha256',v_identity.source_approval_sha256,'anchor_sha256',v_anchor.anchor_sha256,
    'resolution_request_sha256',v_req.request_sha256,'profile',TO_JSONB(v_policy));
END;
$$;
CREATE FUNCTION private.require_dictionary_creation_recovery_frontier(p_run private.dictionary_creation_runs)
RETURNS VOID LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_recoveries WHERE prior_run_id=p_run.run_id)
    OR EXISTS(SELECT 1 FROM private.dictionary_creation_runs WHERE entry_id=p_run.entry_id AND fence>p_run.fence)
    THEN RAISE EXCEPTION 'creation-recovery-frontier-conflict'; END IF;
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_leases WHERE entry_id=p_run.entry_id AND
    ROW(run_id,identity_id,actor_id,operation_id,fence) IS DISTINCT FROM
      ROW(p_run.run_id,p_run.identity_id,p_run.actor_id,p_run.operation_id,p_run.fence))
    THEN RAISE EXCEPTION 'creation-recovery-lease-conflict'; END IF;
END;
$$;
CREATE FUNCTION private.guard_dictionary_creation_recovery_review()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_run private.dictionary_creation_runs%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable-creation-recovery-audit'; END IF;
  IF TG_OP='UPDATE' THEN
    IF TO_JSONB(NEW)-ARRAY['actor_id','reviewer_id'] IS DISTINCT FROM TO_JSONB(OLD)-ARRAY['actor_id','reviewer_id']
      OR (NEW.actor_id IS DISTINCT FROM OLD.actor_id AND (NEW.actor_id IS NOT NULL OR EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.actor_id)))
      OR (NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id AND (NEW.reviewer_id IS NOT NULL OR EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.reviewer_id)))
      THEN RAISE EXCEPTION 'immutable-creation-recovery-audit'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT v_run FROM private.dictionary_creation_runs WHERE run_id=NEW.prior_run_id;
  IF NEW.reviewer_id IS DISTINCT FROM auth.uid() OR NEW.actor_id IS DISTINCT FROM v_run.actor_id
    OR NOT EXISTS(SELECT 1 FROM private.dictionary_administrators WHERE user_id=NEW.reviewer_id AND enabled)
    OR ROW(NEW.request->>'review_id',NEW.request->>'prior_run_id',NEW.request->>'actor_id',NEW.request->>'operation_id',NEW.request->>'resolution_id',NEW.request->>'expected_fence',NEW.request->>'audit_reference',NEW.request->>'audit_evidence_sha256')
      IS DISTINCT FROM ROW(NEW.review_id::TEXT,NEW.prior_run_id::TEXT,NEW.actor_id::TEXT,NEW.operation_id::TEXT,NEW.resolution_id::TEXT,v_run.fence::TEXT,NEW.audit_reference,NEW.audit_evidence_sha256)
    OR NEW.expires_at IS DISTINCT FROM NEW.reviewed_at+INTERVAL '15 minutes'
    OR NEW.snapshot IS DISTINCT FROM private.dictionary_creation_recovery_snapshot(v_run,NEW.resolution_id)
    OR NEW.snapshot_sha256 IS DISTINCT FROM private.dictionary_canonical_sha256(NEW.snapshot)
    OR NEW.request_sha256 IS DISTINCT FROM private.dictionary_canonical_sha256(NEW.request)
    OR NEW.receipt IS DISTINCT FROM JSONB_BUILD_OBJECT('review_id',NEW.review_id,'operation_id',NEW.operation_id,
      'resolution_id',NEW.resolution_id,'entry_id',v_run.entry_id,'prior_fence',v_run.fence::TEXT,
      'expires_at',TO_CHAR(NEW.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
    THEN RAISE EXCEPTION 'invalid-creation-recovery-review'; END IF;
  PERFORM private.require_dictionary_creation_recovery_frontier(v_run);
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_recovery_review BEFORE INSERT OR UPDATE OR DELETE
  ON private.dictionary_creation_recovery_reviews FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_recovery_review();

CREATE FUNCTION private.guard_dictionary_creation_recovery_consumption()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_review private.dictionary_creation_recovery_reviews%ROWTYPE;
  v_old private.dictionary_creation_runs%ROWTYPE; v_new private.dictionary_creation_runs%ROWTYPE; v_command JSONB;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'immutable-creation-recovery-audit'; END IF;
  SELECT * INTO STRICT v_review FROM private.dictionary_creation_recovery_reviews WHERE review_id=NEW.review_id;
  SELECT * INTO STRICT v_old FROM private.dictionary_creation_runs WHERE run_id=NEW.prior_run_id;
  SELECT * INTO STRICT v_new FROM private.dictionary_creation_runs WHERE run_id=NEW.new_run_id;
  v_command:=JSONB_BUILD_OBJECT('protocol_version',2,'operation_id',v_review.operation_id,
    'resolution_id',v_review.resolution_id,'recovery_id',v_review.review_id);
  IF NEW.consumption_xid IS DISTINCT FROM pg_catalog.pg_current_xact_id() OR auth.uid() IS DISTINCT FROM v_review.actor_id
    OR v_review.prior_run_id IS DISTINCT FROM v_old.run_id OR v_review.expires_at<=CLOCK_TIMESTAMP()
    OR v_review.snapshot IS DISTINCT FROM private.dictionary_creation_recovery_snapshot(v_old,v_review.resolution_id)
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_review.reviewer_id)
    OR NOT EXISTS(SELECT 1 FROM private.dictionary_administrators WHERE user_id=v_review.reviewer_id AND enabled)
    OR ROW(v_new.actor_id,v_new.operation_id,v_new.resolution_id,v_new.identity_id,v_new.entry_id,v_new.anchor_id,v_new.evidence_sha256,v_new.fence,v_new.status)
      IS DISTINCT FROM ROW(v_old.actor_id,v_review.operation_id,v_review.resolution_id,v_old.identity_id,v_old.entry_id,v_old.anchor_id,v_old.evidence_sha256,v_old.fence+1,'accepted'::TEXT)
    OR ROW(v_new.generation_model,v_new.validator_version,v_new.policy_sha256) IS DISTINCT FROM
      ROW(v_review.snapshot#>>'{profile,generation_model}',v_review.snapshot#>>'{profile,validator_version}',v_review.snapshot#>>'{profile,policy_sha256}')
    OR EXISTS(SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=v_new.run_id)
    OR EXISTS(SELECT 1 FROM private.dictionary_creation_judge_attempts WHERE run_id=v_new.run_id)
    OR NOT EXISTS(SELECT 1 FROM private.dictionary_creation_leases WHERE run_id=v_new.run_id AND fence=v_new.fence AND entry_id=v_old.entry_id)
    OR NEW.command_sha256 IS DISTINCT FROM private.dictionary_canonical_sha256(v_command)
    OR NOT EXISTS(SELECT 1 FROM private.dictionary_creation_commands WHERE actor_id=v_new.actor_id AND operation_id=v_new.operation_id
      AND request_sha256=NEW.command_sha256 AND receipt=private.dictionary_creation_run_receipt(v_new))
    THEN RAISE EXCEPTION 'invalid-creation-recovery-consumption'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_creation_recovery_consumption BEFORE INSERT OR UPDATE OR DELETE
  ON private.dictionary_creation_recoveries FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_creation_recovery_consumption();

CREATE FUNCTION public.review_dictionary_creation_recovery_v2(p_request JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_reviewer UUID:=auth.uid(); v_id UUID; v_actor UUID; v_operation UUID; v_resolution UUID; v_run_id UUID;
  v_run private.dictionary_creation_runs%ROWTYPE; v_review private.dictionary_creation_recovery_reviews%ROWTYPE;
  v_hash TEXT; v_snapshot JSONB; v_receipt JSONB; v_now TIMESTAMPTZ:=CLOCK_TIMESTAMP(); v_until TIMESTAMPTZ:=v_now+INTERVAL '15 minutes';
BEGIN
  IF v_reviewer IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_reviewer) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_request,ARRAY['review_id','prior_run_id','expected_fence','actor_id','operation_id','resolution_id','audit_reference','audit_evidence_sha256']) IS NOT TRUE
    OR JSONB_TYPEOF(p_request->'expected_fence') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_request->'audit_reference') IS DISTINCT FROM 'string'
    OR LENGTH(BTRIM(p_request->>'audit_reference')) NOT BETWEEN 1 AND 500
    OR JSONB_TYPEOF(p_request->'audit_evidence_sha256') IS DISTINCT FROM 'string'
    OR (p_request->>'audit_evidence_sha256') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-creation-recovery-request'; END IF;
  v_id:=private.dictionary_creation_uuid(p_request->'review_id'); v_actor:=private.dictionary_creation_uuid(p_request->'actor_id');
  v_operation:=private.dictionary_creation_uuid(p_request->'operation_id'); v_resolution:=private.dictionary_creation_uuid(p_request->'resolution_id');
  v_run_id:=private.dictionary_creation_uuid(p_request->'prior_run_id');
  IF (SELECT COUNT(DISTINCT id) FROM UNNEST(ARRAY[v_id,v_operation,v_resolution,v_run_id]) id)<>4 THEN RAISE EXCEPTION 'invalid-creation-recovery-request'; END IF;
  p_request:=p_request||JSONB_BUILD_OBJECT('review_id',v_id,'actor_id',v_actor,'operation_id',v_operation,'resolution_id',v_resolution,'prior_run_id',v_run_id);
  v_hash:=private.dictionary_canonical_sha256(p_request);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-recovery-review/'||v_id::TEXT,0));
  SELECT * INTO v_review FROM private.dictionary_creation_recovery_reviews WHERE review_id=v_id;
  IF FOUND THEN
    IF v_review.reviewer_id IS DISTINCT FROM v_reviewer OR v_review.request_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'recovery-review-payload-conflict'; END IF;
    RETURN v_review.receipt;
  END IF;
  PERFORM private.lock_dictionary_creation_recovery_authority(v_actor,v_reviewer);
  v_run:=private.lock_dictionary_creation_run(v_run_id,p_request->>'expected_fence');
  IF v_run.actor_id IS DISTINCT FROM v_actor OR v_operation IN (v_run.operation_id,v_run.resolution_id)
    OR v_id IN (v_run.operation_id,v_run.resolution_id) THEN RAISE EXCEPTION 'creation-recovery-owner-or-nonce-conflict'; END IF;
  PERFORM private.require_dictionary_creation_recovery_frontier(v_run);
  IF EXISTS(SELECT 1 FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_operation) THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
  v_snapshot:=private.dictionary_creation_recovery_snapshot(v_run,v_resolution);
  v_receipt:=JSONB_BUILD_OBJECT('review_id',v_id,'operation_id',v_operation,'resolution_id',v_resolution,'entry_id',v_run.entry_id,
    'prior_fence',v_run.fence::TEXT,'expires_at',TO_CHAR(v_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  INSERT INTO private.dictionary_creation_recovery_reviews(review_id,actor_id,reviewer_id,prior_run_id,operation_id,resolution_id,
    request,request_sha256,snapshot,snapshot_sha256,audit_reference,audit_evidence_sha256,reviewed_at,expires_at,receipt)
    VALUES(v_id,v_actor,v_reviewer,v_run.run_id,v_operation,v_resolution,p_request,v_hash,v_snapshot,private.dictionary_canonical_sha256(v_snapshot),
      p_request->>'audit_reference',p_request->>'audit_evidence_sha256',v_now,v_until,v_receipt);
  RETURN v_receipt;
END;
$$;
CREATE FUNCTION public.accept_dictionary_creation_recovery_v2(p_command JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID:=auth.uid(); v_id UUID; v_resolution UUID; v_review_id UUID; v_hash TEXT; v_receipt JSONB;
  v_review private.dictionary_creation_recovery_reviews%ROWTYPE; v_run private.dictionary_creation_runs%ROWTYPE;
  v_runtime private.dictionary_content_runtime%ROWTYPE; v_snapshot JSONB; v_fence BIGINT; v_new_run UUID; v_allowed BOOLEAN;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_command,ARRAY['protocol_version','operation_id','resolution_id','recovery_id']) IS NOT TRUE
    OR p_command->'protocol_version' IS DISTINCT FROM '2'::JSONB THEN RAISE EXCEPTION 'invalid-creation-recovery-command'; END IF;
  v_id:=private.dictionary_creation_uuid(p_command->'operation_id'); v_resolution:=private.dictionary_creation_uuid(p_command->'resolution_id');
  v_review_id:=private.dictionary_creation_uuid(p_command->'recovery_id');
  IF (SELECT COUNT(DISTINCT id) FROM UNNEST(ARRAY[v_id,v_resolution,v_review_id]) id)<>3 THEN RAISE EXCEPTION 'invalid-creation-recovery-command'; END IF;
  p_command:=p_command||JSONB_BUILD_OBJECT('operation_id',v_id,'resolution_id',v_resolution,'recovery_id',v_review_id);
  v_hash:=private.dictionary_canonical_sha256(p_command);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-command/'||v_actor::TEXT||'/'||v_id::TEXT,0));
  SELECT receipt INTO v_receipt FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM private.dictionary_creation_commands WHERE actor_id=v_actor AND operation_id=v_id AND request_sha256=v_hash)
      THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN public.get_dictionary_creation_operation_v2(v_id);
  END IF;
  SELECT * INTO v_review FROM private.dictionary_creation_recovery_reviews WHERE review_id=v_review_id;
  IF NOT FOUND OR ROW(v_review.actor_id,v_review.operation_id,v_review.resolution_id) IS DISTINCT FROM ROW(v_actor,v_id,v_resolution)
    THEN RAISE EXCEPTION 'owned-creation-recovery-review-required'; END IF;
  PERFORM private.lock_dictionary_creation_recovery_authority(v_actor,v_review.reviewer_id);
  v_run:=private.lock_dictionary_creation_run(v_review.prior_run_id,v_review.request->>'expected_fence');
  SELECT * INTO STRICT v_review FROM private.dictionary_creation_recovery_reviews WHERE review_id=v_review_id FOR SHARE;
  IF v_review.actor_id IS DISTINCT FROM v_actor OR v_review.reviewer_id IS NULL OR v_review.expires_at<=CLOCK_TIMESTAMP()
    THEN RAISE EXCEPTION 'creation-recovery-review-expired-or-revoked'; END IF;
  PERFORM private.require_dictionary_creation_recovery_frontier(v_run);
  v_snapshot:=private.dictionary_creation_recovery_snapshot(v_run,v_resolution);
  IF v_snapshot IS DISTINCT FROM v_review.snapshot THEN RAISE EXCEPTION 'creation-recovery-review-stale'; END IF;
  -- Overflow, stale authority and unknown outcomes fail before any new quota intent.
  v_fence:=v_run.fence+1;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton;
  SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(v_actor,'gemini-analysis',v_runtime.analysis_quota_limit,v_runtime.analysis_quota_window_seconds);
  IF NOT v_allowed THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
  DELETE FROM private.dictionary_creation_leases WHERE run_id=v_run.run_id;
  INSERT INTO private.dictionary_creation_operations(actor_id,operation_id,resolution_id,identity_id,entry_id,anchor_id,evidence_sha256,
    planned_generation_model,planned_validator_version,planned_policy_sha256,fence)
    VALUES(v_actor,v_id,v_resolution,v_run.identity_id,v_run.entry_id,v_run.anchor_id,v_run.evidence_sha256,
      v_snapshot#>>'{profile,generation_model}',v_snapshot#>>'{profile,validator_version}',v_snapshot#>>'{profile,policy_sha256}',v_fence);
  SELECT run_id INTO STRICT v_new_run FROM private.dictionary_creation_runs WHERE actor_id=v_actor AND operation_id=v_id;
  INSERT INTO private.dictionary_creation_leases(entry_id,identity_id,actor_id,operation_id,fence)
    VALUES(v_run.entry_id,v_run.identity_id,v_actor,v_id,v_fence);
  SELECT private.dictionary_creation_run_receipt(r) INTO STRICT v_receipt FROM private.dictionary_creation_runs r WHERE run_id=v_new_run;
  INSERT INTO private.dictionary_creation_commands(actor_id,operation_id,resolution_id,request_sha256,receipt)
    VALUES(v_actor,v_id,v_resolution,v_hash,v_receipt);
  INSERT INTO private.dictionary_creation_recoveries(review_id,prior_run_id,new_run_id,command_sha256,consumption_xid)
    VALUES(v_review_id,v_run.run_id,v_new_run,v_hash,pg_catalog.pg_current_xact_id());
  RETURN v_receipt;
END;
$$;

ALTER TABLE private.dictionary_creation_recovery_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_creation_recoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_creation_recovery_reviews,private.dictionary_creation_recoveries FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.lock_dictionary_creation_recovery_authority(UUID,UUID),
  private.dictionary_creation_recovery_snapshot(private.dictionary_creation_runs,UUID),
  private.require_dictionary_creation_recovery_frontier(private.dictionary_creation_runs),private.guard_dictionary_creation_recovery_review(),
  private.guard_dictionary_creation_recovery_consumption() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.review_dictionary_creation_recovery_v2(JSONB),public.accept_dictionary_creation_recovery_v2(JSONB) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.review_dictionary_creation_recovery_v2(JSONB),public.accept_dictionary_creation_recovery_v2(JSONB) TO authenticated;
COMMIT;
