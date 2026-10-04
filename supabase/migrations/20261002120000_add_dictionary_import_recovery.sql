-- Dormant same-ID import recovery. No runtime flags or legacy write policy change.
BEGIN;
CREATE TABLE private.dictionary_import_origins (
  word_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_operation_id UUID NOT NULL,
  intent_sha256 TEXT NOT NULL CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  inserted_once BOOLEAN NOT NULL DEFAULT false,
  recovery_version INTEGER NOT NULL DEFAULT 0 CHECK (recovery_version >= 0),
  cancelled BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, original_operation_id)
);
ALTER TABLE private.dictionary_import_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_import_origins FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_ambiguous BIGINT;
BEGIN
  SELECT count(*) INTO v_ambiguous FROM (
    SELECT receipt->>'word_id' FROM private.dictionary_import_receipts
      WHERE receipt->>'outcome' = 'inserted'
      GROUP BY receipt->>'word_id' HAVING count(*) > 1
  ) ambiguous;
  IF v_ambiguous > 0 THEN
    RAISE EXCEPTION 'ambiguous-import-provenance: % personal IDs', v_ambiguous;
  END IF;
END;
$$;
INSERT INTO private.dictionary_import_origins(word_id, user_id,
  original_operation_id, intent_sha256, inserted_once)
  SELECT (receipt->>'word_id')::UUID, user_id, operation_id, intent_sha256, true
  FROM private.dictionary_import_receipts WHERE receipt->>'outcome' = 'inserted';

CREATE FUNCTION private.protect_dictionary_import_origin_v1() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'dictionary import origin cannot be deleted';
  END IF;
  IF ROW(NEW.word_id,NEW.user_id,NEW.original_operation_id,NEW.intent_sha256)
      IS DISTINCT FROM ROW(OLD.word_id,OLD.user_id,OLD.original_operation_id,OLD.intent_sha256)
    OR (OLD.inserted_once AND NOT NEW.inserted_once)
    OR (OLD.cancelled AND NOT NEW.cancelled)
    OR NEW.recovery_version < OLD.recovery_version THEN
    RAISE EXCEPTION 'dictionary import origin cannot regress';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dictionary_import_origins BEFORE UPDATE OR DELETE
  ON private.dictionary_import_origins FOR EACH ROW
  EXECUTE FUNCTION private.protect_dictionary_import_origin_v1();

CREATE TABLE private.dictionary_import_recovery_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  receipt JSONB NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation_id)
);
ALTER TABLE private.dictionary_import_recovery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_import_recovery_receipts FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_dictionary_import_recovery_receipts BEFORE UPDATE OR DELETE
  ON private.dictionary_import_recovery_receipts FOR EACH ROW
  EXECUTE FUNCTION private.protect_dictionary_import_receipt();

CREATE FUNCTION private.dictionary_import_uuid_v1(p_value JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_typeof(p_value) = 'string' AND p_value #>> '{}' ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', false);
$$;
CREATE FUNCTION private.dictionary_import_hash_v1(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to(private.dictionary_canonical_json(p_value), 'UTF8'), 'sha256'), 'hex');
$$;
CREATE FUNCTION private.validate_dictionary_import_intent_v1(p_intent JSONB) RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_operation_id UUID; v_word_id UUID; v_collection_id UUID; v_source JSONB;
BEGIN
  IF jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
    OR NOT p_intent ?& ARRAY['protocol_version','operation_id','word_id','collection_id','source']
    OR private.dictionary_import_uuid_v1(p_intent->'operation_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_intent->'word_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_intent->'collection_id') IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid-import-intent';
  END IF;
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

  IF v_source->>'kind' = 'official-pack' THEN
    IF NOT v_source ?& ARRAY['kind','pack_id','version','pack_entry_id','manifest_sha256','reference','content']
      OR jsonb_typeof(v_source->'pack_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_source->'version') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_source->'pack_entry_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_source->'manifest_sha256') IS DISTINCT FROM 'string'
      OR (v_source->'reference' <> 'null'::JSONB AND (
        jsonb_typeof(v_source->'reference') IS DISTINCT FROM 'object'
        OR NOT (v_source->'reference') ?& ARRAY['entry_id','revision_id']
        OR (v_source->'reference') - ARRAY['entry_id','revision_id'] <> '{}'
        OR private.dictionary_import_uuid_v1(v_source->'reference'->'entry_id') IS NOT TRUE
        OR private.dictionary_import_uuid_v1(v_source->'reference'->'revision_id') IS NOT TRUE)) THEN
      RAISE EXCEPTION 'invalid-import-source';
    END IF;
  END IF;
END;
$$;

-- Caller holds personal UUID, original operation and owned target locks.
CREATE FUNCTION private.insert_dictionary_import_word_v1(p_intent JSONB, p_target UUID)
RETURNS JSONB LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_word_id UUID := (p_intent->>'word_id')::UUID;
  v_collection_id UUID := p_target;
  v_source JSONB := p_intent->'source';
  v_content JSONB; v_manifest JSONB; v_entry JSONB;
  v_mapping private.official_dictionary_mappings;
  v_word public.words; v_receipt JSONB;
BEGIN
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
  RETURN v_receipt;
END;
$$;

-- Fixed lock order: personal ID, owner/root, then owner/recovery nonce.
CREATE FUNCTION private.lock_dictionary_import_root_v1(p_intent JSONB)
RETURNS private.dictionary_import_origins LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_word UUID := (p_intent->>'word_id')::UUID;
  v_operation UUID := (p_intent->>'operation_id')::UUID;
  v_hash TEXT := private.dictionary_import_hash_v1(p_intent);
  v_saved private.dictionary_import_receipts;
  v_origin private.dictionary_import_origins;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import-personal:' || v_word::TEXT,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import:' || auth.uid()::TEXT || ':' || v_operation::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_import_receipts
    WHERE user_id = auth.uid() AND operation_id = v_operation;
  IF FOUND AND v_saved.intent_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'import-operation-conflict'; END IF;
  PERFORM 1 FROM private.dictionary_import_origins WHERE user_id = auth.uid()
    AND original_operation_id = v_operation AND word_id <> v_word;
  IF FOUND THEN RAISE EXCEPTION 'import-operation-conflict'; END IF;
  SELECT * INTO v_origin FROM private.dictionary_import_origins WHERE word_id = v_word;
  IF FOUND AND (v_origin.user_id IS DISTINCT FROM auth.uid()
    OR v_origin.original_operation_id IS DISTINCT FROM v_operation
    OR v_origin.intent_sha256 IS DISTINCT FROM v_hash) THEN
    RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN v_origin;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dictionary_import_intent_v1(p_intent JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_origin private.dictionary_import_origins;
  v_saved private.dictionary_import_receipts;
  v_receipt JSONB;
  v_word UUID; v_operation UUID; v_target UUID;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  PERFORM private.validate_dictionary_import_intent_v1(p_intent);
  v_word := (p_intent->>'word_id')::UUID;
  v_operation := (p_intent->>'operation_id')::UUID;
  v_target := (p_intent->>'collection_id')::UUID;
  -- Cached historical original receipts are immutable no-ops even after another
  -- proven conflict retry claims this word. Validate under the same root locks.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import-personal:' || v_word::TEXT,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import:' || auth.uid()::TEXT || ':' || v_operation::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_import_receipts WHERE user_id = auth.uid() AND operation_id = v_operation;
  IF FOUND THEN
    IF v_saved.intent_sha256 IS DISTINCT FROM private.dictionary_import_hash_v1(p_intent) THEN RAISE EXCEPTION 'import-operation-conflict'; END IF;
    RETURN v_saved.receipt || '{"idempotent":true}'::JSONB;
  END IF;
  v_origin := private.lock_dictionary_import_root_v1(p_intent);
  IF v_origin.cancelled THEN RAISE EXCEPTION 'import-cancelled'; END IF;
  IF v_origin.recovery_version > 0 THEN RAISE EXCEPTION 'import-original-settled'; END IF;
  IF v_origin.inserted_once THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.collections WHERE collection_id = v_target AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  v_receipt := private.insert_dictionary_import_word_v1(p_intent,v_target);
  IF v_receipt->>'outcome' = 'inserted' THEN
    INSERT INTO private.dictionary_import_origins(word_id,user_id,original_operation_id,intent_sha256,inserted_once)
      VALUES(v_word,auth.uid(),v_operation,private.dictionary_import_hash_v1(p_intent),true);
  END IF;
  v_receipt := v_receipt || jsonb_build_object('protocol_version',1,'operation_id',v_operation,'word_id',v_word,'idempotent',false);
  INSERT INTO private.dictionary_import_receipts(user_id,operation_id,intent_sha256,receipt)
    VALUES(auth.uid(),v_operation,private.dictionary_import_hash_v1(p_intent),v_receipt);
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION private.dictionary_import_snapshot_v1(p_intent JSONB, p_origin private.dictionary_import_origins)
RETURNS JSONB LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_word public.words;
  v_state TEXT := 'uncreated';
  v_collection UUID;
BEGIN
  IF coalesce(p_origin.inserted_once,false) THEN
    SELECT * INTO v_word FROM public.words WHERE word_id = (p_intent->>'word_id')::UUID
      AND user_id = auth.uid() AND deleted_at IS NULL FOR SHARE;
    IF FOUND THEN v_state := 'active'; v_collection := v_word.collection_id;
    ELSE v_state := 'unavailable'; END IF;
  ELSE
    PERFORM 1 FROM public.words WHERE word_id = (p_intent->>'word_id')::UUID FOR SHARE;
    IF FOUND THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
  END IF;
  IF p_origin.cancelled THEN v_state := 'cancelled'; END IF;
  RETURN jsonb_build_object('protocol_version',1,'original_operation_id',p_intent->>'operation_id',
    'word_id',p_intent->>'word_id','recovery_version',coalesce(p_origin.recovery_version,0),
    'inserted_once',coalesce(p_origin.inserted_once,false),'state',v_state,'collection_id',v_collection);
END;
$$;
CREATE FUNCTION public.read_dictionary_import_recovery_v1(p_intent JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_origin private.dictionary_import_origins;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  PERFORM private.validate_dictionary_import_intent_v1(p_intent);
  v_origin := private.lock_dictionary_import_root_v1(p_intent);
  RETURN private.dictionary_import_snapshot_v1(p_intent,v_origin);
END;
$$;

CREATE FUNCTION public.recover_dictionary_import_v1(p_request JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_intent JSONB;
  v_origin private.dictionary_import_origins;
  v_saved private.dictionary_import_recovery_receipts;
  v_receipt JSONB;
  v_result JSONB;
  v_word public.words;
  v_operation UUID; v_target UUID; v_expected_collection UUID;
  v_version INTEGER;
  v_hash TEXT;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR NOT p_request ?& ARRAY['protocol_version','operation_id','original_intent','expected_recovery_version','expected_collection_id','target_collection_id']
    OR p_request - ARRAY['protocol_version','operation_id','original_intent','expected_recovery_version','expected_collection_id','target_collection_id'] <> '{}'
    OR p_request->'protocol_version' IS DISTINCT FROM '1'::JSONB
    OR private.dictionary_import_uuid_v1(p_request->'operation_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_request->'target_collection_id') IS NOT TRUE
    OR (p_request->'expected_collection_id' <> 'null'::JSONB
      AND private.dictionary_import_uuid_v1(p_request->'expected_collection_id') IS NOT TRUE)
    OR jsonb_typeof(p_request->'expected_recovery_version') IS DISTINCT FROM 'number'
    OR (p_request->>'expected_recovery_version') !~ '^[0-9]+$'
    OR (p_request->>'expected_recovery_version')::NUMERIC > 2147483647 THEN
    RAISE EXCEPTION 'invalid-import-recovery';
  END IF;
  v_intent := p_request->'original_intent';
  PERFORM private.validate_dictionary_import_intent_v1(v_intent);
  v_operation := (p_request->>'operation_id')::UUID;
  IF v_operation = (v_intent->>'operation_id')::UUID THEN RAISE EXCEPTION 'invalid-import-recovery'; END IF;
  v_target := (p_request->>'target_collection_id')::UUID;
  v_expected_collection := (p_request->>'expected_collection_id')::UUID;
  v_hash := private.dictionary_import_hash_v1(p_request);
  v_origin := private.lock_dictionary_import_root_v1(v_intent);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import-recovery:' || auth.uid()::TEXT || ':' || v_operation::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_import_recovery_receipts WHERE user_id = auth.uid() AND operation_id = v_operation;
  IF FOUND THEN
    IF v_saved.request_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'import-recovery-operation-conflict'; END IF;
    RETURN v_saved.receipt || '{"idempotent":true}'::JSONB;
  END IF;
  IF v_origin.cancelled THEN RAISE EXCEPTION 'import-cancelled'; END IF;
  v_version := coalesce(v_origin.recovery_version,0);
  v_result := jsonb_build_object('protocol_version',1,'operation_id',v_operation,
    'original_operation_id',v_intent->>'operation_id','word_id',v_intent->>'word_id','target_collection_id',v_target);
  IF v_version <> (p_request->>'expected_recovery_version')::INTEGER THEN
    RETURN v_result || jsonb_build_object('outcome','state-conflict','state',private.dictionary_import_snapshot_v1(v_intent,v_origin));
  END IF;
  IF v_version = 2147483647 THEN RAISE EXCEPTION 'import-recovery-version-exhausted'; END IF;
  PERFORM 1 FROM public.collections WHERE collection_id = v_target AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  IF coalesce(v_origin.inserted_once,false) THEN
    SELECT * INTO v_word FROM public.words WHERE word_id = v_origin.word_id AND user_id = auth.uid() AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
    IF v_word.collection_id IS DISTINCT FROM v_expected_collection THEN
      RETURN v_result || jsonb_build_object('outcome','placement-conflict','state',private.dictionary_import_snapshot_v1(v_intent,v_origin));
    END IF;
    UPDATE public.words SET collection_id = v_target WHERE word_id = v_origin.word_id;
    v_receipt := jsonb_build_object('outcome','applied','existing_word_id',NULL);
  ELSE
    v_receipt := private.insert_dictionary_import_word_v1(v_intent,v_target);
    IF v_receipt->>'outcome' = 'inserted' THEN v_receipt := v_receipt || '{"outcome":"applied"}'::JSONB; END IF;
  END IF;
  IF v_origin.word_id IS NULL THEN
    INSERT INTO private.dictionary_import_origins(word_id,user_id,original_operation_id,intent_sha256,inserted_once,recovery_version)
      VALUES((v_intent->>'word_id')::UUID,auth.uid(),(v_intent->>'operation_id')::UUID,
        private.dictionary_import_hash_v1(v_intent),v_receipt->>'outcome' = 'applied',v_version+1);
  ELSE
    UPDATE private.dictionary_import_origins SET recovery_version = v_version+1,
      inserted_once = inserted_once OR v_receipt->>'outcome' = 'applied' WHERE word_id = v_origin.word_id;
  END IF;
  v_receipt := v_receipt || v_result || jsonb_build_object('recovery_version',v_version+1,'idempotent',false);
  INSERT INTO private.dictionary_import_recovery_receipts(user_id,operation_id,request_sha256,receipt)
    VALUES(auth.uid(),v_operation,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION public.cancel_dictionary_import_v1(p_request JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_intent JSONB;
  v_origin private.dictionary_import_origins;
  v_saved private.dictionary_import_recovery_receipts;
  v_operation UUID; v_version INTEGER;
  v_hash TEXT; v_receipt JSONB;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR NOT p_request ?& ARRAY['protocol_version','operation_id','original_intent']
    OR p_request - ARRAY['protocol_version','operation_id','original_intent'] <> '{}'
    OR p_request->'protocol_version' IS DISTINCT FROM '1'::JSONB
    OR private.dictionary_import_uuid_v1(p_request->'operation_id') IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid-import-cancellation';
  END IF;
  v_intent := p_request->'original_intent';
  PERFORM private.validate_dictionary_import_intent_v1(v_intent);
  v_operation := (p_request->>'operation_id')::UUID;
  IF v_operation = (v_intent->>'operation_id')::UUID THEN RAISE EXCEPTION 'invalid-import-cancellation'; END IF;
  v_hash := private.dictionary_import_hash_v1(p_request);
  v_origin := private.lock_dictionary_import_root_v1(v_intent);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dictionary-import-recovery:' || auth.uid()::TEXT || ':' || v_operation::TEXT,0));
  SELECT * INTO v_saved FROM private.dictionary_import_recovery_receipts WHERE user_id = auth.uid() AND operation_id = v_operation;
  IF FOUND THEN
    IF v_saved.request_sha256 IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'import-recovery-operation-conflict'; END IF;
    RETURN v_saved.receipt || '{"idempotent":true}'::JSONB;
  END IF;
  IF v_origin.word_id IS NULL THEN
    PERFORM 1 FROM public.words WHERE word_id = (v_intent->>'word_id')::UUID FOR SHARE;
    IF FOUND THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
    v_version := 1;
    INSERT INTO private.dictionary_import_origins(word_id,user_id,original_operation_id,intent_sha256,recovery_version,cancelled)
      VALUES((v_intent->>'word_id')::UUID,auth.uid(),(v_intent->>'operation_id')::UUID,private.dictionary_import_hash_v1(v_intent),v_version,true);
  ELSE
    v_version := v_origin.recovery_version;
    IF NOT v_origin.cancelled THEN
      IF v_version = 2147483647 THEN RAISE EXCEPTION 'import-recovery-version-exhausted'; END IF;
      v_version := v_version+1;
      UPDATE private.dictionary_import_origins SET cancelled = true,recovery_version = v_version WHERE word_id = v_origin.word_id;
    END IF;
  END IF;
  v_receipt := jsonb_build_object('protocol_version',1,'operation_id',v_operation,
    'original_operation_id',v_intent->>'operation_id','word_id',v_intent->>'word_id',
    'outcome','cancelled','recovery_version',v_version,'idempotent',false);
  INSERT INTO private.dictionary_import_recovery_receipts(user_id,operation_id,request_sha256,receipt)
    VALUES(auth.uid(),v_operation,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_dictionary_import_origin_v1(),
  private.dictionary_import_uuid_v1(JSONB), private.dictionary_import_hash_v1(JSONB),
  private.validate_dictionary_import_intent_v1(JSONB), private.insert_dictionary_import_word_v1(JSONB,UUID),
  private.lock_dictionary_import_root_v1(JSONB),
  private.dictionary_import_snapshot_v1(JSONB,private.dictionary_import_origins)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_dictionary_import_recovery_v1(JSONB),
  public.recover_dictionary_import_v1(JSONB), public.cancel_dictionary_import_v1(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_dictionary_import_recovery_v1(JSONB),
  public.recover_dictionary_import_v1(JSONB), public.cancel_dictionary_import_v1(JSONB) TO authenticated;
COMMIT;
