-- Independent semantic judging is a second explicitly charged provider attempt.
-- Default OFF; no real policy, model, membership or provider is enabled here.
BEGIN;
ALTER TABLE private.dictionary_content_runtime ADD COLUMN semantic_checks_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE private.dictionary_analysis_validator_policies
  ADD COLUMN semantic_method TEXT NOT NULL DEFAULT 'external-v1' CHECK (semantic_method IN ('external-v1', 'independent-gemini-v1')),
  ADD COLUMN semantic_model TEXT,
  ADD COLUMN semantic_prompt_sha256 TEXT,
  ADD CONSTRAINT dictionary_semantic_policy_profile CHECK (
    (semantic_method = 'external-v1' AND semantic_model IS NULL AND semantic_prompt_sha256 IS NULL) OR
    (semantic_method = 'independent-gemini-v1' AND semantic_model ~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$'
      AND semantic_prompt_sha256 ~ '^[0-9a-f]{64}$' AND semantic_model IS NOT NULL AND semantic_prompt_sha256 IS NOT NULL));

CREATE TABLE private.dictionary_semantic_checks (
  actor_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  validator_version TEXT NOT NULL,
  policy_sha256 TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('dispatching', 'returned', 'provider-failed', 'provider-outcome-unknown', 'quota-denied')),
  quota_charged BOOLEAN NOT NULL,
  result JSONB,
  result_sha256 TEXT,
  provider_request_id TEXT,
  failure_evidence_sha256 TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  PRIMARY KEY (actor_id, operation_id),
  FOREIGN KEY (actor_id, operation_id) REFERENCES private.dictionary_analysis_operations(actor_id, operation_id) ON DELETE CASCADE,
  FOREIGN KEY (validator_version, policy_sha256) REFERENCES private.dictionary_analysis_validator_policies(validator_version, policy_sha256) ON DELETE RESTRICT,
  CHECK (quota_charged = (status <> 'quota-denied')),
  CHECK ((result IS NULL AND result_sha256 IS NULL AND provider_request_id IS NULL) OR
    (JSONB_TYPEOF(result) = 'object' AND OCTET_LENGTH(result::TEXT) <= 262144
      AND result_sha256 ~ '^[0-9a-f]{64}$' AND result_sha256 IS NOT NULL
      AND LENGTH(BTRIM(provider_request_id)) BETWEEN 1 AND 200 AND provider_request_id IS NOT NULL)),
  CHECK (status <> 'returned' OR result IS NOT NULL),
  CHECK (status NOT IN ('quota-denied', 'provider-failed') OR result IS NULL),
  CHECK (failure_evidence_sha256 IS NULL OR failure_evidence_sha256 ~ '^[0-9a-f]{64}$')
);
ALTER TABLE private.dictionary_semantic_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_semantic_checks FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_dictionary_semantic_check_v1(p_actor UUID, p_operation UUID, p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_check private.dictionary_semantic_checks%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id=p_actor AND operation_id=p_operation;
  IF v_op.fence::TEXT IS DISTINCT FROM p_fence THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  SELECT * INTO v_check FROM private.dictionary_semantic_checks WHERE actor_id=p_actor AND operation_id=p_operation;
  RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'check', CASE WHEN FOUND
    THEN (TO_JSONB(v_check) - ARRAY['actor_id','operation_id']) || JSONB_BUILD_OBJECT('fence',v_check.fence::TEXT) ELSE NULL END);
END;
$$;

CREATE FUNCTION public.start_dictionary_semantic_check_v1(p_actor UUID, p_operation UUID, p_fence TEXT,
  p_version TEXT, p_policy_sha256 TEXT, p_model TEXT, p_prompt_sha256 TEXT, p_content_sha256 TEXT, p_input_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_check private.dictionary_semantic_checks%ROWTYPE;
  v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_runtime private.dictionary_content_runtime%ROWTYPE;
  v_authorized BOOLEAN; v_allowed BOOLEAN; v_error TEXT; v_result JSONB;
BEGIN
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor,p_operation,p_fence);
  SELECT * INTO v_check FROM private.dictionary_semantic_checks WHERE actor_id=p_actor AND operation_id=p_operation FOR UPDATE;
  IF FOUND THEN
    IF ROW(v_check.validator_version,v_check.policy_sha256,v_check.model,v_check.prompt_sha256,v_check.content_sha256,v_check.input_sha256)
      IS DISTINCT FROM ROW(p_version,p_policy_sha256,p_model,p_prompt_sha256,p_content_sha256,p_input_sha256) THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    IF v_check.status='dispatching' AND v_check.dispatched_at + INTERVAL '2 minutes' <= CLOCK_TIMESTAMP() THEN
      UPDATE private.dictionary_semantic_checks SET status='provider-outcome-unknown' WHERE actor_id=p_actor AND operation_id=p_operation;
      IF v_op.status='validating' THEN PERFORM private.finish_dictionary_analysis(p_actor,p_operation,'provider-outcome-unknown','semantic-outcome-unknown'); END IF;
    END IF;
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence) || JSONB_BUILD_OBJECT('dispatch',FALSE);
  END IF;
  IF v_op.status <> 'validating' OR v_op.validation_id IS NOT NULL THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT (v_runtime.analysis_operations_enabled AND v_runtime.semantic_checks_enabled) THEN RAISE EXCEPTION 'semantic-check-disabled'; END IF;
  IF NOT v_authorized THEN RETURN JSONB_BUILD_OBJECT('receipt',private.finish_dictionary_analysis(p_actor,p_operation,'authorization-revoked','analysis-permission-revoked'),'check',NULL,'dispatch',FALSE); END IF;
  v_error := private.dictionary_analysis_dependency_error(v_op);
  IF v_error IS NOT NULL THEN RETURN JSONB_BUILD_OBJECT('receipt',private.finish_dictionary_analysis(p_actor,p_operation,
    CASE WHEN v_error='head-conflict' THEN 'head-conflict' ELSE 'rejected' END,v_error),'check',NULL,'dispatch',FALSE); END IF;
  IF EXISTS (SELECT 1 FROM private.dictionary_analysis_leases WHERE entry_id=v_op.entry_id AND expires_at <= CLOCK_TIMESTAMP()) THEN RAISE EXCEPTION 'semantic-lease-expired'; END IF;
  SELECT * INTO v_policy FROM private.dictionary_analysis_validator_policies WHERE validator_version=p_version AND policy_sha256=p_policy_sha256 FOR SHARE;
  IF NOT FOUND OR NOT v_policy.enabled OR v_policy.semantic_method <> 'independent-gemini-v1'
    OR ROW(v_policy.semantic_model,v_policy.semantic_prompt_sha256) IS DISTINCT FROM ROW(p_model,p_prompt_sha256) THEN RAISE EXCEPTION 'validator-policy-unavailable'; END IF;
  IF p_content_sha256 IS NULL OR p_content_sha256 !~ '^[0-9a-f]{64}$' OR p_input_sha256 IS NULL OR p_input_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-semantic-input'; END IF;
  SELECT result INTO STRICT v_result FROM private.dictionary_analysis_results WHERE actor_id=p_actor AND operation_id=p_operation;
  IF private.valid_dictionary_analysis_content(v_result->'content') IS NOT TRUE
    OR private.dictionary_canonical_sha256(v_result->'content') IS DISTINCT FROM p_content_sha256 THEN RAISE EXCEPTION 'semantic-content-mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dictionary_entries e WHERE e.entry_id=v_op.entry_id AND e.language_code='nl'
    AND e.lemma=v_result#>>'{content,dutch_lemma}' AND e.part_of_speech IS NOT DISTINCT FROM v_result#>>'{content,part_of_speech}'
    AND e.article IS NOT DISTINCT FROM v_result#>>'{content,article}')
    OR private.safe_dictionary_analysis_media(v_result#>'{content,image_url}',v_policy.media_url_prefixes) IS NOT TRUE
    OR private.safe_dictionary_analysis_media(v_result#>'{content,tts_url}',v_policy.media_url_prefixes) IS NOT TRUE THEN RAISE EXCEPTION 'semantic-content-invalid'; END IF;
  SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(p_actor,'gemini-analysis',v_runtime.analysis_quota_limit,v_runtime.analysis_quota_window_seconds);
  INSERT INTO private.dictionary_semantic_checks(actor_id,operation_id,fence,validator_version,policy_sha256,model,prompt_sha256,input_sha256,content_sha256,status,quota_charged)
    VALUES(p_actor,p_operation,v_op.fence,p_version,p_policy_sha256,p_model,p_prompt_sha256,p_input_sha256,p_content_sha256,
      CASE WHEN v_allowed THEN 'dispatching' ELSE 'quota-denied' END,v_allowed);
  RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence) || JSONB_BUILD_OBJECT('dispatch',v_allowed);
END;
$$;

CREATE FUNCTION public.journal_dictionary_semantic_result_v1(p_actor UUID,p_operation UUID,p_fence TEXT,p_result JSONB,p_provider_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_check private.dictionary_semantic_checks%ROWTYPE; v_hash TEXT;
BEGIN
  v_op := private.lock_dictionary_analysis_operation(p_actor,p_operation,p_fence);
  SELECT * INTO STRICT v_check FROM private.dictionary_semantic_checks WHERE actor_id=p_actor AND operation_id=p_operation FOR UPDATE;
  IF p_result IS NULL OR JSONB_TYPEOF(p_result) <> 'object' OR OCTET_LENGTH(p_result::TEXT)>262144
    OR p_provider_request_id IS NULL OR LENGTH(BTRIM(p_provider_request_id)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid-semantic-result'; END IF;
  v_hash := ENCODE(extensions.digest(CONVERT_TO(p_result::TEXT,'UTF8'),'sha256'),'hex');
  IF v_check.result IS NOT NULL THEN
    IF ROW(v_check.result_sha256,v_check.provider_request_id) IS DISTINCT FROM ROW(v_hash,p_provider_request_id) THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
  END IF;
  IF v_check.status NOT IN ('dispatching','provider-outcome-unknown') OR v_op.status NOT IN ('validating','provider-outcome-unknown') THEN RAISE EXCEPTION 'invalid-semantic-transition'; END IF;
  UPDATE private.dictionary_semantic_checks SET result=p_result,result_sha256=v_hash,provider_request_id=p_provider_request_id,
    status=CASE WHEN v_check.status='provider-outcome-unknown' OR v_check.dispatched_at + INTERVAL '2 minutes' <= CLOCK_TIMESTAMP() OR v_op.status='provider-outcome-unknown'
      THEN 'provider-outcome-unknown' ELSE 'returned' END WHERE actor_id=p_actor AND operation_id=p_operation RETURNING * INTO STRICT v_check;
  IF v_check.status='provider-outcome-unknown' AND v_op.status='validating' THEN PERFORM private.finish_dictionary_analysis(p_actor,p_operation,'provider-outcome-unknown','semantic-late-result'); END IF;
  RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
END;
$$;

CREATE FUNCTION public.record_dictionary_semantic_failure_v1(p_actor UUID,p_operation UUID,p_fence TEXT,p_outcome TEXT,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_check private.dictionary_semantic_checks%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('provider-failed','provider-outcome-unknown')
    OR (p_outcome='provider-failed' AND (p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$'))
    OR (p_evidence_sha256 IS NOT NULL AND p_evidence_sha256 !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'invalid-semantic-failure'; END IF;
  v_op := private.lock_dictionary_analysis_operation(p_actor,p_operation,p_fence);
  SELECT * INTO STRICT v_check FROM private.dictionary_semantic_checks WHERE actor_id=p_actor AND operation_id=p_operation FOR UPDATE;
  IF v_check.status=p_outcome THEN
    IF v_check.failure_evidence_sha256 IS DISTINCT FROM p_evidence_sha256 THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
  END IF;
  IF v_check.status NOT IN ('dispatching','provider-outcome-unknown') OR v_check.result IS NOT NULL THEN RAISE EXCEPTION 'invalid-semantic-transition'; END IF;
  UPDATE private.dictionary_semantic_checks SET status=p_outcome,failure_evidence_sha256=p_evidence_sha256 WHERE actor_id=p_actor AND operation_id=p_operation;
  IF p_outcome='provider-outcome-unknown' AND v_op.status='validating' THEN PERFORM private.finish_dictionary_analysis(p_actor,p_operation,'provider-outcome-unknown','semantic-outcome-unknown'); END IF;
  RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
END;
$$;

-- This new policy cannot reuse an old service-side same-meaning assertion without
-- a separately charged and journaled independent verdict bound to exact content.
CREATE FUNCTION private.guard_dictionary_independent_validation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_check private.dictionary_semantic_checks%ROWTYPE; v_verdict JSONB; v_anchor private.dictionary_meaning_anchors%ROWTYPE; v_evidence JSONB;
BEGIN
  IF NEW.outcome <> 'accepted' OR NOT EXISTS (SELECT 1 FROM private.dictionary_analysis_validator_policies
    WHERE validator_version=NEW.validator_version AND policy_sha256=NEW.policy_sha256 AND semantic_method='independent-gemini-v1') THEN RETURN NEW; END IF;
  SELECT * INTO STRICT v_check FROM private.dictionary_semantic_checks WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  v_verdict := v_check.result->'content';
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE anchor_id=NEW.anchor_id;
  IF v_check.status <> 'returned' OR NOT v_check.quota_charged OR v_check.fence <> NEW.fence
    OR ROW(v_check.validator_version,v_check.policy_sha256,v_check.content_sha256) IS DISTINCT FROM ROW(NEW.validator_version,NEW.policy_sha256,NEW.content_sha256)
    OR private.jsonb_has_exact_keys(v_verdict,ARRAY['schema_version','anchor_sha256','content_sha256','result_sha256','decision','checks']) IS NOT TRUE
    OR v_verdict->'schema_version' IS DISTINCT FROM '1'::JSONB OR v_verdict->>'decision' IS DISTINCT FROM 'same-meaning'
    OR ROW(v_verdict->>'anchor_sha256',v_verdict->>'content_sha256',v_verdict->>'result_sha256') IS DISTINCT FROM ROW(NEW.anchor_sha256,NEW.content_sha256,NEW.result_sha256)
    OR JSONB_TYPEOF(v_verdict->'checks') IS DISTINCT FROM 'array' OR JSONB_ARRAY_LENGTH(v_verdict->'checks') <> 6 THEN RAISE EXCEPTION 'independent-semantic-evidence-required'; END IF;
  IF (SELECT COUNT(DISTINCT c->>'dimension') FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c) <> 6
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_verdict->'checks') c WHERE
      private.jsonb_has_exact_keys(c,ARRAY['dimension','verdict','reason','anchor_quote']) IS NOT TRUE
      OR c->>'dimension' NOT IN ('translations-en','translations-ru','examples','related-words','notes','grammar')
      OR c->>'verdict' IS DISTINCT FROM 'preserved' OR NOT private.dictionary_bounded_text(c->'reason',1000)
      OR NOT private.dictionary_bounded_text(c->'anchor_quote',1000) OR LENGTH(c->>'anchor_quote') < 8
      OR (STRPOS(v_anchor.gloss,c->>'anchor_quote')=0 AND NOT EXISTS(SELECT 1 FROM JSONB_ARRAY_ELEMENTS_TEXT(v_anchor.examples) x WHERE STRPOS(x,c->>'anchor_quote')>0)))
    THEN RAISE EXCEPTION 'independent-semantic-evidence-required'; END IF;
  v_evidence := JSONB_BUILD_OBJECT('method','independent-gemini-v1','judge_input_sha256',v_check.input_sha256,
    'judge_result_sha256',v_check.result_sha256,'verdict',v_verdict);
  IF NEW.meaning_evidence_sha256 IS DISTINCT FROM private.dictionary_canonical_sha256(v_evidence) THEN RAISE EXCEPTION 'semantic-evidence-hash-mismatch'; END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.reconcile_dictionary_semantic_result_v1(p_actor UUID,p_operation UUID,p_fence TEXT,p_result_sha256 TEXT,p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_check private.dictionary_semantic_checks%ROWTYPE; v_error TEXT; v_authorized BOOLEAN;
BEGIN
  IF p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-reconciliation-evidence'; END IF;
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor,p_operation,p_fence);
  SELECT * INTO STRICT v_check FROM private.dictionary_semantic_checks WHERE actor_id=p_actor AND operation_id=p_operation FOR UPDATE;
  IF v_check.result IS NULL OR v_check.result_sha256 IS DISTINCT FROM p_result_sha256 THEN RAISE EXCEPTION 'result-evidence-mismatch'; END IF;
  IF v_check.status='returned' THEN
    IF v_check.failure_evidence_sha256 IS DISTINCT FROM p_evidence_sha256 THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
  END IF;
  IF v_check.status <> 'provider-outcome-unknown' OR v_op.status <> 'provider-outcome-unknown' THEN RAISE EXCEPTION 'invalid-semantic-transition'; END IF;
  IF NOT v_authorized THEN PERFORM private.finish_dictionary_analysis(p_actor,p_operation,'authorization-revoked','analysis-permission-revoked');
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence); END IF;
  v_error := private.dictionary_analysis_dependency_error(v_op);
  IF v_error IS NOT NULL THEN PERFORM private.finish_dictionary_analysis(p_actor,p_operation,
    CASE WHEN v_error='head-conflict' THEN 'head-conflict' ELSE 'rejected' END,v_error);
    RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence); END IF;
  IF NOT EXISTS(SELECT 1 FROM private.dictionary_analysis_validator_policies WHERE validator_version=v_check.validator_version AND policy_sha256=v_check.policy_sha256 AND enabled)
    THEN RAISE EXCEPTION 'validator-policy-unavailable'; END IF;
  UPDATE private.dictionary_semantic_checks SET status='returned',failure_evidence_sha256=p_evidence_sha256 WHERE actor_id=p_actor AND operation_id=p_operation;
  UPDATE private.dictionary_analysis_operations SET status='validating',error_code=NULL,updated_at=CLOCK_TIMESTAMP() WHERE actor_id=p_actor AND operation_id=p_operation;
  RETURN public.get_dictionary_semantic_check_v1(p_actor,p_operation,p_fence);
END;
$$;
CREATE TRIGGER guard_dictionary_independent_validation BEFORE INSERT ON private.dictionary_analysis_validations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_independent_validation();
CREATE FUNCTION private.guard_dictionary_semantic_reconciliation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status='provider-outcome-unknown' AND NEW.status='validating'
    AND EXISTS(SELECT 1 FROM private.dictionary_semantic_checks WHERE actor_id=OLD.actor_id AND operation_id=OLD.operation_id AND status='provider-outcome-unknown')
    THEN RAISE EXCEPTION 'semantic-result-reconciliation-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_semantic_reconciliation BEFORE UPDATE ON private.dictionary_analysis_operations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_semantic_reconciliation();
REVOKE ALL ON FUNCTION private.guard_dictionary_independent_validation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.guard_dictionary_semantic_reconciliation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_dictionary_semantic_check_v1(UUID,UUID,TEXT),
  public.start_dictionary_semantic_check_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  public.journal_dictionary_semantic_result_v1(UUID,UUID,TEXT,JSONB,TEXT),
  public.record_dictionary_semantic_failure_v1(UUID,UUID,TEXT,TEXT,TEXT),
  public.reconcile_dictionary_semantic_result_v1(UUID,UUID,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_dictionary_semantic_check_v1(UUID,UUID,TEXT),
  public.start_dictionary_semantic_check_v1(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT),
  public.journal_dictionary_semantic_result_v1(UUID,UUID,TEXT,JSONB,TEXT),
  public.record_dictionary_semantic_failure_v1(UUID,UUID,TEXT,TEXT,TEXT),
  public.reconcile_dictionary_semantic_result_v1(UUID,UUID,TEXT,TEXT,TEXT) TO service_role;
COMMIT;
