-- Support documented provider limits and absent-only optional usage counters.
BEGIN;

CREATE OR REPLACE FUNCTION private.dictionary_paid_model_ceiling(p_limits JSONB) RETURNS BIGINT
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
    OR (p_limits->>'max_input_tokens')::NUMERIC NOT BETWEEN 1 AND 1048576
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
  v_response:=NEW.result->'provider_response';
  -- SQL NULL means the field is absent. Preserve present invalid JSON (including
  -- JSON null) so settlement freezes the release instead of treating it as absent.
  v_usage:=v_response->'usageMetadata';
  -- ProtoJSON may omit zero cache/thought counts. Default absence only; an
  -- explicit JSON null remains invalid. The original business result is retained.
  IF JSONB_TYPEOF(v_usage)='object' THEN
    v_usage:=JSONB_BUILD_OBJECT('modelVersion',v_response->'modelVersion','promptTokenCount',v_usage->'promptTokenCount',
      'cachedContentTokenCount',CASE WHEN v_usage ? 'cachedContentTokenCount' THEN v_usage->'cachedContentTokenCount' ELSE '0'::JSONB END,
      'candidatesTokenCount',v_usage->'candidatesTokenCount',
      'thoughtsTokenCount',CASE WHEN v_usage ? 'thoughtsTokenCount' THEN v_usage->'thoughtsTokenCount' ELSE '0'::JSONB END,
      'totalTokenCount',v_usage->'totalTokenCount');
  END IF;
  IF v_attempt.state='unknown' THEN
    -- Late usage may stop new work without reconciling money or overwriting
    -- the original quarantine evidence. Business journal and stop commit together.
    IF v_usage IS NOT NULL AND private.dictionary_paid_usage_cost(v_usage,v_attempt.limits,v_attempt.reserved_nanousd) IS NULL THEN
      UPDATE private.dictionary_paid_releases SET enabled=FALSE WHERE release_id=v_attempt.release_id;
    END IF;
    RETURN NEW;
  END IF;
  v_evidence:=private.dictionary_canonical_sha256(NEW.result);
  PERFORM private.settle_dictionary_paid_attempt_v1(v_attempt.attempt_id,v_evidence,v_usage);
  RETURN NEW;
END;
$$;

COMMIT;
