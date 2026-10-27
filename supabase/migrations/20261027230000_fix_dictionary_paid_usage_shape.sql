-- Preserve malformed usage for fail-closed paid settlement. No live settings seeded.
BEGIN;

CREATE OR REPLACE FUNCTION private.journal_dictionary_paid_result() RETURNS TRIGGER
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
  -- SQL NULL means the field is absent. Preserve present invalid JSON (including
  -- JSON null) so settlement freezes the release instead of treating it as absent.
  v_usage:=v_response->'usageMetadata';
  IF JSONB_TYPEOF(v_usage)='object' THEN
    v_usage:=JSONB_BUILD_OBJECT('modelVersion',v_response->'modelVersion','promptTokenCount',v_usage->'promptTokenCount',
      'cachedContentTokenCount',v_usage->'cachedContentTokenCount','candidatesTokenCount',v_usage->'candidatesTokenCount',
      'thoughtsTokenCount',v_usage->'thoughtsTokenCount','totalTokenCount',v_usage->'totalTokenCount');
  END IF;
  v_evidence:=private.dictionary_canonical_sha256(NEW.result);
  PERFORM private.settle_dictionary_paid_attempt_v1(v_attempt.attempt_id,v_evidence,v_usage);
  RETURN NEW;
END;
$$;
-- Reject non-objects before any object-key validation; retain their raw evidence.
CREATE OR REPLACE FUNCTION private.settle_dictionary_paid_attempt_v1(p_attempt UUID,p_evidence_sha256 TEXT,p_usage JSONB) RETURNS JSONB
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
  ELSIF JSONB_TYPEOF(p_usage) IS DISTINCT FROM 'object' THEN v_valid:=FALSE;
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

COMMIT;
