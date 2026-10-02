-- Default-off insert-only delivery for durable offline import intents.
BEGIN;
CREATE TABLE private.dictionary_import_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  intent_sha256 TEXT NOT NULL CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  receipt JSONB NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, operation_id)
);
ALTER TABLE private.dictionary_import_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_import_receipts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.protect_dictionary_import_receipt() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'dictionary_import_receipts rows are immutable';
END;
$$;
CREATE TRIGGER protect_dictionary_import_receipts BEFORE UPDATE OR DELETE
  ON private.dictionary_import_receipts FOR EACH ROW
  EXECUTE FUNCTION private.protect_dictionary_import_receipt();
REVOKE ALL ON FUNCTION private.protect_dictionary_import_receipt() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.apply_dictionary_import_intent_v1(p_intent JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_operation_id UUID;
  v_word_id UUID;
  v_collection_id UUID;
  v_source JSONB;
  v_content JSONB;
  v_manifest JSONB;
  v_entry JSONB;
  v_mapping private.official_dictionary_mappings;
  v_word public.words;
  v_saved private.dictionary_import_receipts;
  v_receipt JSONB;
  v_intent_sha256 TEXT;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
    OR p_intent - ARRAY['protocol_version','operation_id','word_id','collection_id','source'] <> '{}'
    OR p_intent->'protocol_version' IS DISTINCT FROM '1'::JSONB
    OR p_intent->>'operation_id' IS NULL OR p_intent->>'word_id' IS NULL
    OR p_intent->>'collection_id' IS NULL THEN RAISE EXCEPTION 'invalid-import-intent'; END IF;
  v_operation_id := (p_intent->>'operation_id')::UUID;
  v_word_id := (p_intent->>'word_id')::UUID;
  v_collection_id := (p_intent->>'collection_id')::UUID;
  v_source := p_intent->'source';
  IF jsonb_typeof(v_source) IS DISTINCT FROM 'object'
    OR private.valid_dictionary_content(v_source->'content') IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid-import-source';
  END IF;
  IF v_source->>'kind' = 'private-copy' THEN
    IF v_source - ARRAY['kind','content'] <> '{}' THEN RAISE EXCEPTION 'invalid-import-source'; END IF;
  ELSIF v_source->>'kind' = 'official-pack' THEN
    IF v_source - ARRAY['kind','pack_id','version','pack_entry_id','manifest_sha256','reference','content'] <> '{}'
      OR coalesce(v_source->>'pack_id','') = '' OR coalesce(v_source->>'version','') = ''
      OR coalesce(v_source->>'pack_entry_id','') = ''
      OR coalesce(v_source->>'manifest_sha256','') !~ '^[0-9a-f]{64}$'
      OR NOT v_source ? 'reference' THEN RAISE EXCEPTION 'invalid-import-source'; END IF;
  ELSE RAISE EXCEPTION 'invalid-import-source'; END IF;

  -- Keep the immutable replay binding without retaining private card text after
  -- a personal hard-delete. Account deletion still removes its receipt ledger.
  v_intent_sha256 := encode(extensions.digest(convert_to(
    private.dictionary_canonical_json(p_intent), 'UTF8'), 'sha256'), 'hex');

  -- Concurrent retries serialize by authenticated owner and immutable operation.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'dictionary-import:' || auth.uid()::TEXT || ':' || v_operation_id::TEXT, 0));
  SELECT * INTO v_saved FROM private.dictionary_import_receipts
    WHERE user_id = auth.uid() AND operation_id = v_operation_id;
  IF FOUND THEN
    IF v_saved.intent_sha256 IS DISTINCT FROM v_intent_sha256 THEN RAISE EXCEPTION 'import-operation-conflict'; END IF;
    RETURN v_saved.receipt || '{"idempotent":true}'::JSONB;
  END IF;
  PERFORM 1 FROM public.collections WHERE collection_id = v_collection_id
    AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  -- Never expose or claim a personal UUID owned by another account.
  PERFORM 1 FROM public.words WHERE word_id = v_word_id FOR SHARE;
  IF FOUND THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;

  v_content := v_source->'content';
  IF v_source->>'kind' = 'official-pack' THEN
    SELECT manifest INTO v_manifest FROM public.official_content_pack_versions
      WHERE pack_id = v_source->>'pack_id' AND version = v_source->>'version'
        AND content_sha256 = v_source->>'manifest_sha256' AND review_status = 'published' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'official-pack-unavailable'; END IF;
    SELECT e INTO v_entry FROM jsonb_array_elements(v_manifest->'entries') e
      WHERE e->>'entry_id' = v_source->>'pack_entry_id';
    IF NOT FOUND OR private.official_dictionary_content_v1(v_entry) IS DISTINCT FROM v_content THEN
      RAISE EXCEPTION 'invalid-import-source';
    END IF;
    SELECT m.* INTO v_mapping FROM private.official_dictionary_mappings m
      JOIN public.dictionary_revisions r USING(entry_id, revision_id)
      JOIN public.dictionary_entries e USING(entry_id)
      WHERE m.pack_id = v_source->>'pack_id' AND m.version = v_source->>'version'
        AND m.pack_entry_id = v_source->>'pack_entry_id'
        AND m.manifest_sha256 = v_source->>'manifest_sha256'
        AND r.review_status = 'published' AND e.state = 'published'
      FOR SHARE OF r, e;
    IF (CASE WHEN FOUND THEN jsonb_build_object('entry_id',v_mapping.entry_id,
      'revision_id',v_mapping.revision_id) ELSE 'null'::JSONB END)
      IS DISTINCT FROM v_source->'reference' THEN RAISE EXCEPTION 'invalid-import-reference'; END IF;
  END IF;

  INSERT INTO public.words(
    word_id, user_id, collection_id, dutch_lemma, dutch_original, part_of_speech,
    is_irregular, is_reflexive, is_expression, expression_type, is_separable,
    prefix_part, root_verb, article, plural, register, translations, examples,
    synonyms, antonyms, conjugation, preposition, image_url, tts_url, analysis_notes,
    usage_notes, interval_days, repetition_count, easiness_factor, next_review_date,
    last_reviewed_at
  ) VALUES (
    v_word_id, auth.uid(), v_collection_id, lower(btrim(v_content->>'dutch_lemma')),
    v_content->>'dutch_original', coalesce(nullif(btrim(v_content->>'part_of_speech'), ''), 'unknown'),
    (v_content->>'is_irregular')::BOOLEAN, (v_content->>'is_reflexive')::BOOLEAN,
    (v_content->>'is_expression')::BOOLEAN, v_content->>'expression_type',
    (v_content->>'is_separable')::BOOLEAN, v_content->>'prefix_part', v_content->>'root_verb',
    nullif(btrim(v_content->>'article'), ''), v_content->>'plural', v_content->>'register',
    v_content->'translations', ARRAY(SELECT jsonb_array_elements(v_content->'examples')),
    ARRAY(SELECT jsonb_array_elements_text(v_content->'synonyms')),
    ARRAY(SELECT jsonb_array_elements_text(v_content->'antonyms')),
    CASE WHEN v_content->'conjugation' = 'null' THEN NULL ELSE v_content->'conjugation' END,
    v_content->>'preposition', v_content->>'image_url', coalesce(v_content->>'tts_url', ''),
    v_content->>'analysis_notes',
    CASE WHEN v_content->'usage_notes' = 'null' THEN NULL ELSE v_content->'usage_notes' END,
    1, 0, 2.5, CURRENT_DATE, NULL
  ) ON CONFLICT (user_id, lower(dutch_lemma), COALESCE(part_of_speech, 'unknown'), COALESCE(article, ''))
    WHERE deleted_at IS NULL DO NOTHING RETURNING * INTO v_word;

  IF v_word.word_id IS NULL THEN
    SELECT * INTO v_word FROM public.words WHERE user_id = auth.uid() AND deleted_at IS NULL
      AND lower(dutch_lemma) = lower(btrim(v_content->>'dutch_lemma'))
      AND coalesce(part_of_speech, 'unknown') = coalesce(nullif(btrim(v_content->>'part_of_speech'), ''), 'unknown')
      AND coalesce(article, '') = coalesce(nullif(btrim(v_content->>'article'), ''), '') FOR SHARE;
    IF v_word.word_id IS NULL THEN RAISE EXCEPTION 'import-conflict-retry' USING ERRCODE = '40001'; END IF;
    v_receipt := jsonb_build_object('outcome','identity-conflict','existing_word_id',v_word.word_id);
  ELSE
    -- Version zero is deliberate: queued create-private/link starts at zero.
    -- No reference, private overrides or client SRS snapshot is accepted here.
    v_receipt := jsonb_build_object('outcome','inserted','existing_word_id',NULL);
  END IF;
  v_receipt := v_receipt || jsonb_build_object('protocol_version',1,'operation_id',v_operation_id,
    'word_id',v_word_id,'idempotent',false);
  INSERT INTO private.dictionary_import_receipts(user_id,operation_id,intent_sha256,receipt)
    VALUES(auth.uid(),v_operation_id,v_intent_sha256,v_receipt);
  RETURN v_receipt;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_dictionary_import_intent_v1(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_dictionary_import_intent_v1(JSONB) TO authenticated;
COMMIT;
