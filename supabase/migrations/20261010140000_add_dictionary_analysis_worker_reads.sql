-- Protected worker context for preparing exact input hashes and resuming journaled
-- results. Read access is service-only; no roles, policies or flags are enabled.
BEGIN;

CREATE FUNCTION public.get_dictionary_analysis_work_v1(p_actor UUID, p_operation UUID, p_fence TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_payload JSONB; v_result JSONB;
BEGIN
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations
    WHERE actor_id = p_actor AND operation_id = p_operation;
  IF p_fence IS DISTINCT FROM v_op.fence::TEXT THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  SELECT JSONB_BUILD_OBJECT('entry', JSONB_BUILD_OBJECT('entry_id', e.entry_id, 'language_code', e.language_code,
    'lemma', e.lemma, 'part_of_speech', e.part_of_speech, 'article', e.article, 'sense_key', e.sense_key),
    'anchor', JSONB_BUILD_OBJECT('anchor_id', a.anchor_id, 'gloss', a.gloss, 'examples', a.examples, 'anchor_sha256', a.anchor_sha256))
    INTO STRICT v_payload FROM public.dictionary_entries e JOIN private.dictionary_meaning_anchors a ON a.entry_id = e.entry_id
    WHERE e.entry_id = v_op.entry_id AND a.anchor_id = v_op.anchor_id;
  SELECT result INTO v_result FROM private.dictionary_analysis_results
    WHERE actor_id = p_actor AND operation_id = p_operation;
  RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'payload', v_payload,
    'provider', v_op.provider, 'model', v_op.model, 'input_sha256', v_op.input_sha256,
    'result', v_result, 'validation_id', v_op.validation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_dictionary_analysis_work_v1(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dictionary_analysis_work_v1(UUID, UUID, TEXT) TO service_role;

COMMIT;
