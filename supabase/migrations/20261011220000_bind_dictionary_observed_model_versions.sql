-- Bind observed versions for the new independent-v3 profile; no live gate or policy seeded.
BEGIN;
ALTER TABLE private.dictionary_analysis_validator_policies
  ADD COLUMN generation_model_version TEXT,
  ADD COLUMN semantic_model_version TEXT,
  ADD CONSTRAINT dictionary_observed_versions_v3 CHECK (validator_version <> 'shared-meaning-independent-v3' OR
    (semantic_method='independent-gemini-v1' AND generation_model_version IS NOT NULL AND semantic_model_version IS NOT NULL
      AND generation_model_version ~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$'
      AND semantic_model_version ~ '^gemini-[a-z0-9][a-z0-9.-]{0,100}$'));

CREATE FUNCTION private.dictionary_observed_model_matches(p_result JSONB,p_expected TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(p_expected IS NOT NULL AND JSONB_TYPEOF(p_result#>'{provider_response,modelVersion}')='string'
    AND p_result#>>'{provider_response,modelVersion}'=p_expected,FALSE);
$$;

CREATE FUNCTION private.guard_dictionary_observed_versions()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_result JSONB; v_judge JSONB;
BEGIN
  SELECT * INTO STRICT v_policy FROM private.dictionary_analysis_validator_policies
    WHERE validator_version=NEW.validator_version AND policy_sha256=NEW.policy_sha256;
  IF v_policy.validator_version <> 'shared-meaning-independent-v3' THEN RETURN NEW; END IF;
  SELECT result INTO STRICT v_result FROM private.dictionary_analysis_results
    WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
  IF private.dictionary_observed_model_matches(v_result,v_policy.generation_model_version) IS NOT TRUE
    AND (TG_TABLE_NAME='dictionary_semantic_checks' OR TO_JSONB(NEW)->>'outcome'='accepted')
    THEN RAISE EXCEPTION 'generation-model-version-unqualified'; END IF;
  IF TG_TABLE_NAME='dictionary_analysis_validations' AND TO_JSONB(NEW)->>'outcome'='accepted' THEN
    SELECT result INTO STRICT v_judge FROM private.dictionary_semantic_checks
      WHERE actor_id=NEW.actor_id AND operation_id=NEW.operation_id;
    IF private.dictionary_observed_model_matches(v_judge,v_policy.semantic_model_version) IS NOT TRUE
      THEN RAISE EXCEPTION 'semantic-model-version-unqualified'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_observed_semantic_dispatch BEFORE INSERT ON private.dictionary_semantic_checks
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_observed_versions();
CREATE TRIGGER guard_dictionary_observed_analysis_validation BEFORE INSERT ON private.dictionary_analysis_validations
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_observed_versions();

CREATE OR REPLACE FUNCTION private.dictionary_creation_candidate_error(p_run private.dictionary_creation_runs)
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
  IF v_policy.validator_version='shared-meaning-independent-v3' AND NOT EXISTS(
    SELECT 1 FROM private.dictionary_creation_generation_attempts WHERE run_id=p_run.run_id
      AND private.dictionary_observed_model_matches(result,v_policy.generation_model_version))
    THEN RETURN 'meaning-uncertain'; END IF;
  IF private.safe_dictionary_analysis_media(v_content->'image_url',v_policy.media_url_prefixes) IS NOT TRUE
    OR private.safe_dictionary_analysis_media(v_content->'tts_url',v_policy.media_url_prefixes) IS NOT TRUE THEN RETURN 'unsafe-media'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.dictionary_creation_validation_proof(p_run private.dictionary_creation_runs)
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
  IF v_decision IS NOT NULL THEN v_outcome:=CASE v_decision WHEN 'meaning-uncertain' THEN 'review-required' ELSE 'rejected' END;
  ELSE
    SELECT * INTO STRICT v_judge FROM private.dictionary_creation_judge_attempts WHERE run_id=p_run.run_id;
    -- An in-flight attempt has no observed response version yet. Keep its result
    -- journal available by requiring returned, charged, bound evidence first.
    IF v_judge.status<>'returned' OR NOT v_judge.quota_charged OR v_judge.model=p_run.generation_model
      OR ROW(v_judge.model,v_judge.prompt_sha256) IS DISTINCT FROM ROW(v_policy.semantic_model,v_policy.semantic_prompt_sha256)
      OR ROW(v_judge.input->>'result_sha256',v_judge.input->>'content_sha256',v_judge.input#>>'{anchor,anchor_sha256}',v_judge.input->>'fence')
        IS DISTINCT FROM ROW(v_gen.result_sha256,private.dictionary_canonical_sha256(v_content),v_anchor.anchor_sha256,p_run.fence::TEXT)
      THEN RAISE EXCEPTION 'independent-creation-evidence-required'; END IF;
    IF v_policy.validator_version='shared-meaning-independent-v3' AND
      private.dictionary_observed_model_matches(v_judge.result,v_policy.semantic_model_version) IS NOT TRUE THEN
      v_outcome:='review-required'; v_decision:='meaning-uncertain';
    ELSE
    v_verdict:=v_judge.result->'content';
    IF private.jsonb_has_exact_keys(v_verdict,ARRAY['schema_version','anchor_sha256','content_sha256','result_sha256','decision','checks']) IS NOT TRUE
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

REVOKE ALL ON FUNCTION private.dictionary_observed_model_matches(JSONB,TEXT),private.guard_dictionary_observed_versions()
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
