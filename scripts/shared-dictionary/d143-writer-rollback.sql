-- Function-only rollback. Existing sparse cards still require published readers.
-- This does not authorize disabling readers or restoring lexical data.
BEGIN;
CREATE OR REPLACE FUNCTION private.insert_dictionary_import_word_v2(p_intent JSONB,p_target UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_word UUID := (p_intent->>'word_id')::UUID; v_target UUID := p_target;
  v_source JSONB := p_intent->'source'; v_entry UUID := (p_intent#>>'{source,reference,entry_id}')::UUID;
  v_adopted UUID := (p_intent#>>'{source,reference,revision_id}')::UUID;
  v_revision public.dictionary_revisions; v_head public.dictionary_revisions;
  v_shared public.words; v_shared_collection public.collections; v_manifest JSONB;
  v_enabled BOOLEAN; v_receipt JSONB; v_sequence BIGINT; v_release UUID;
  v_valid_from TIMESTAMPTZ; v_valid_until TIMESTAMPTZ; v_member_until TIMESTAMPTZ;
BEGIN
  SELECT reads_enabled AND operations_enabled AND legacy_guard_enabled AND following_reads_enabled AND following_imports_enabled,
    following_import_release_id
    INTO STRICT v_enabled, v_release FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT v_enabled THEN RAISE EXCEPTION 'following-import-disabled'; END IF;
  -- Importing an already published result does not spend money. Keep it available
  -- after the final paid grant, but only for the selected active release cohort.
  IF v_release IS NOT NULL THEN
    SELECT valid_from,valid_until INTO v_valid_from,v_valid_until FROM private.dictionary_paid_releases
      WHERE release_id=v_release AND enabled FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'following-import-cohort-required' USING ERRCODE='42501'; END IF;
    SELECT expires_at INTO v_member_until FROM private.dictionary_paid_cohort
      WHERE release_id=v_release AND user_id=v_actor AND enabled FOR SHARE;
    IF NOT FOUND OR v_member_until<=CLOCK_TIMESTAMP() OR v_valid_from>CLOCK_TIMESTAMP()
      OR v_valid_until<=CLOCK_TIMESTAMP() THEN
      RAISE EXCEPTION 'following-import-cohort-required' USING ERRCODE='42501';
    END IF;
  END IF;
  PERFORM 1 FROM public.collections WHERE collection_id = v_target AND user_id = v_actor FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  -- The head trigger locks its parent entry; read the head only after acquiring
  -- that same entry lock, avoiding a mixture while publication/retirement waits.
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_entry AND state = 'published' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'import-review-required'; END IF;
  SELECT * INTO v_revision FROM public.dictionary_revisions WHERE entry_id = v_entry AND revision_id = v_adopted AND review_status = 'published';
  IF NOT FOUND OR v_revision.content_sha256 IS DISTINCT FROM v_source->>'content_sha256' THEN RAISE EXCEPTION 'invalid-import-reference'; END IF;
  SELECT r.* INTO v_head FROM public.dictionary_entry_heads h JOIN public.dictionary_revisions r USING(entry_id,revision_id)
    WHERE h.entry_id = v_entry AND r.review_status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
  SELECT MAX(committed_version) INTO v_sequence FROM private.dictionary_content_changes WHERE entry_id = v_entry AND change_kind = 'revision-head';
  IF v_sequence IS NULL THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
  IF v_source->>'kind' = 'official-pack' THEN
    SELECT manifest INTO v_manifest FROM public.official_content_pack_versions WHERE pack_id = v_source->>'pack_id'
      AND version = v_source->>'version' AND content_sha256 = v_source->>'manifest_sha256' AND review_status = 'published' FOR SHARE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_manifest->'entries') e WHERE e->>'entry_id' = v_source->>'pack_entry_id')
      OR NOT EXISTS (SELECT 1 FROM private.official_dictionary_mappings m WHERE m.pack_id = v_source->>'pack_id'
        AND m.version = v_source->>'version' AND m.pack_entry_id = v_source->>'pack_entry_id' AND m.manifest_sha256 = v_source->>'manifest_sha256'
        AND m.entry_id = v_entry AND m.revision_id = v_adopted) THEN RAISE EXCEPTION 'invalid-import-source'; END IF;
  ELSIF v_source->>'kind' = 'shared-collection' THEN
    SELECT * INTO v_shared_collection FROM public.collections WHERE share_token = (v_source->>'share_token')::UUID AND is_shared FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'shared-collection-unavailable'; END IF;
    SELECT * INTO v_shared FROM public.words WHERE word_id = (v_source->>'word_id')::UUID AND user_id = v_shared_collection.user_id
      AND collection_id = v_shared_collection.collection_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND OR v_shared.dictionary_entry_id IS DISTINCT FROM v_entry OR v_shared.dictionary_content_mode <> 'follow' THEN RAISE EXCEPTION 'import-review-required'; END IF;
  END IF;
  -- Existing insert-only helper supplies the old semantic uniqueness/fresh SRS
  -- defaults. The synthesized copy is trusted head content, never imported text.
  v_receipt := private.insert_dictionary_import_word_v1(JSONB_BUILD_OBJECT('word_id',v_word,
    'source',JSONB_BUILD_OBJECT('kind','private-copy','content',v_head.content)), v_target);
  IF v_receipt->>'outcome' = 'inserted' THEN
    UPDATE public.words SET dictionary_entry_id = v_entry, dictionary_revision_id = v_adopted, dictionary_content_mode = 'follow' WHERE word_id = v_word;
    INSERT INTO public.word_content_state(word_id,user_id,content_version,overrides) VALUES(v_word,v_actor,1,'{}');
    v_receipt := v_receipt || JSONB_BUILD_OBJECT('reference',v_source->'reference', 'applied_reference',
      JSONB_BUILD_OBJECT('entry_id',v_entry,'revision_id',v_head.revision_id),'applied_head_sequence',v_sequence::TEXT);
  ELSE
    v_receipt := v_receipt || JSONB_BUILD_OBJECT('reference',NULL,'applied_reference',NULL,'applied_head_sequence',NULL);
  END IF;
  RETURN v_receipt;
END;
$$;


CREATE OR REPLACE FUNCTION private.project_dictionary_content_to_word(
  p_word_id UUID,
  p_user_id UUID,
  p_content JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_examples JSONB[];
  v_synonyms TEXT[];
  v_antonyms TEXT[];
BEGIN
  IF NOT private.valid_dictionary_content(p_content) THEN
    RAISE EXCEPTION 'invalid-content';
  END IF;

  v_examples := ARRAY(
    SELECT value FROM JSONB_ARRAY_ELEMENTS(p_content->'examples')
  );
  v_synonyms := ARRAY(
    SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(p_content->'synonyms')
  );
  v_antonyms := ARRAY(
    SELECT value FROM JSONB_ARRAY_ELEMENTS_TEXT(p_content->'antonyms')
  );

  UPDATE public.words
  SET dutch_lemma = p_content->>'dutch_lemma',
      dutch_original = p_content->>'dutch_original',
      part_of_speech = p_content->>'part_of_speech',
      article = p_content->>'article',
      translations = p_content->'translations',
      examples = v_examples,
      is_irregular = (p_content->>'is_irregular')::BOOLEAN,
      is_reflexive = (p_content->>'is_reflexive')::BOOLEAN,
      is_expression = (p_content->>'is_expression')::BOOLEAN,
      expression_type = p_content->>'expression_type',
      is_separable = (p_content->>'is_separable')::BOOLEAN,
      prefix_part = p_content->>'prefix_part',
      root_verb = p_content->>'root_verb',
      plural = p_content->>'plural',
      register = p_content->>'register',
      synonyms = v_synonyms,
      antonyms = v_antonyms,
      conjugation = NULLIF(p_content->'conjugation', 'null'::JSONB),
      preposition = p_content->>'preposition',
      analysis_notes = p_content->>'analysis_notes',
      usage_notes = NULLIF(p_content->'usage_notes', 'null'::JSONB),
      image_url = p_content->>'image_url',
      tts_url = COALESCE(p_content->>'tts_url', '')
  WHERE word_id = p_word_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not-found-or-not-owned';
  END IF;
END;
$$;

COMMIT;
