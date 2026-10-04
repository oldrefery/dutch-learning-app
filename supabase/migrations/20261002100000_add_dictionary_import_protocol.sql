-- Dormant D10 import protocol; legacy imports remain available unchanged.
BEGIN;

CREATE FUNCTION private.require_dictionary_import_v1() RETURNS VOID
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton
    AND reads_enabled AND operations_enabled AND legacy_guard_enabled) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
END;
$$;

-- Insert identity and reference together. ON CONFLICT never attaches an existing
-- private card, changes its collection/content, or resets its learning progress.
CREATE FUNCTION private.import_dictionary_card_v1(
  p_collection_id UUID, p_content JSONB, p_entry_id UUID DEFAULT NULL,
  p_revision_id UUID DEFAULT NULL, p_overrides JSONB DEFAULT '{}'
) RETURNS public.words LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_word public.words;
  v_content JSONB := p_content;
  v_revision_content JSONB;
BEGIN
  PERFORM 1 FROM public.collections WHERE collection_id = p_collection_id AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection not found or access denied';
  END IF;
  IF private.valid_dictionary_content(p_content) IS NOT TRUE
    OR (p_entry_id IS NULL) <> (p_revision_id IS NULL)
    OR private.valid_dictionary_command_overrides(p_overrides) IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid-import-content';
  END IF;
  IF p_entry_id IS NOT NULL THEN
    SELECT r.content INTO v_revision_content FROM public.dictionary_revisions r JOIN public.dictionary_entries e USING (entry_id)
      WHERE r.entry_id = p_entry_id AND r.revision_id = p_revision_id
        AND r.review_status = 'published' AND e.state = 'published'
      FOR SHARE OF r, e;
    IF NOT FOUND OR p_content IS DISTINCT FROM v_revision_content THEN
      RAISE EXCEPTION 'invalid-import-reference';
    END IF;
  END IF;
  v_content := private.apply_dictionary_overrides(p_content, p_overrides);
  IF private.valid_dictionary_content(v_content) IS NOT TRUE THEN RAISE EXCEPTION 'invalid-import-content'; END IF;

  INSERT INTO public.words(
    user_id, collection_id, dutch_lemma, dutch_original, part_of_speech,
    is_irregular, is_reflexive, is_expression, expression_type, is_separable,
    prefix_part, root_verb, article, plural, register, translations, examples,
    synonyms, antonyms, conjugation, preposition, image_url, tts_url, analysis_notes,
    usage_notes, interval_days, repetition_count, easiness_factor, next_review_date,
    dictionary_entry_id, dictionary_revision_id
  ) VALUES (
    auth.uid(), p_collection_id, lower(btrim(v_content->>'dutch_lemma')),
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
    1, 0, 2.5, CURRENT_DATE, p_entry_id, p_revision_id
  ) ON CONFLICT (user_id, lower(dutch_lemma), COALESCE(part_of_speech, 'unknown'), COALESCE(article, ''))
    WHERE deleted_at IS NULL DO NOTHING RETURNING * INTO v_word;

  IF v_word.word_id IS NULL THEN
    SELECT * INTO v_word FROM public.words WHERE user_id = auth.uid() AND deleted_at IS NULL
      AND lower(dutch_lemma) = lower(btrim(v_content->>'dutch_lemma'))
      AND coalesce(part_of_speech, 'unknown') = coalesce(nullif(btrim(v_content->>'part_of_speech'), ''), 'unknown')
      AND coalesce(article, '') = coalesce(nullif(btrim(v_content->>'article'), ''), '') FOR SHARE;
    IF v_word.word_id IS NULL THEN
      RAISE EXCEPTION 'import-conflict-retry' USING ERRCODE = '40001';
    END IF;
    RETURN v_word;
  END IF;

  INSERT INTO public.word_content_state(word_id, user_id, content_version, fallback_content, overrides)
    VALUES (v_word.word_id, auth.uid(), 1,
      CASE WHEN p_entry_id IS NULL THEN p_content ELSE NULL END, p_overrides);
  RETURN v_word;
END;
$$;

CREATE FUNCTION public.import_official_dictionary_pack_v1(
  p_collection_id UUID, p_pack_id TEXT, p_version TEXT, p_entry_ids TEXT[]
) RETURNS SETOF public.words LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_manifest JSONB;
  v_entry JSONB;
  v_content JSONB;
  v_mapping private.official_dictionary_mappings;
  v_word public.words;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF p_entry_ids IS NULL OR cardinality(p_entry_ids) = 0 OR cardinality(p_entry_ids) > 1000
    OR array_position(p_entry_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid-pack-entry-ids'; END IF;
  SELECT manifest INTO v_manifest FROM public.official_content_pack_versions
    WHERE pack_id = p_pack_id AND version = p_version AND review_status = 'published' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'official-pack-unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_entry_ids) id WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_manifest->'entries') e WHERE e->>'entry_id' = id
  )) THEN RAISE EXCEPTION 'invalid-pack-entry-ids'; END IF;

  FOR v_entry IN SELECT e FROM jsonb_array_elements(v_manifest->'entries') e
    WHERE e->>'entry_id' = ANY(p_entry_ids)
  LOOP
    v_content := private.official_dictionary_content_v1(v_entry);
    SELECT m.* INTO v_mapping FROM private.official_dictionary_mappings m
      JOIN public.dictionary_revisions r USING (entry_id, revision_id)
      JOIN public.dictionary_entries e USING (entry_id)
      WHERE m.pack_id = p_pack_id AND m.version = p_version
        AND m.pack_entry_id = v_entry->>'entry_id'
        AND r.review_status = 'published' AND e.state = 'published'
      FOR SHARE OF r, e;
    v_word := private.import_dictionary_card_v1(p_collection_id, v_content,
      v_mapping.entry_id, v_mapping.revision_id);
    RETURN NEXT v_word;
  END LOOP;
END;
$$;

CREATE FUNCTION public.import_dictionary_copies_v1(p_collection_id UUID, p_contents JSONB)
RETURNS SETOF public.words LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_content JSONB;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF jsonb_typeof(p_contents) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_contents) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'invalid-import-contents';
  END IF;
  FOR v_content IN SELECT * FROM jsonb_array_elements(p_contents) LOOP
    RETURN NEXT private.import_dictionary_card_v1(p_collection_id, v_content);
  END LOOP;
END;
$$;

-- Preserve valid legacy/private content as a complete private copy, without
-- leaking owner IDs, SRS or reference dependencies into an export.
CREATE FUNCTION private.dictionary_import_content_v1(p_content JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT private.official_dictionary_content_v1(p_content || jsonb_build_object(
    'examples', coalesce(nullif(p_content->'examples', 'null'), '[]'),
    'synonyms', coalesce(nullif(p_content->'synonyms', 'null'), '[]'),
    'antonyms', coalesce(nullif(p_content->'antonyms', 'null'), '[]')
  )) || jsonb_build_object(
    'dutch_original', nullif(p_content->>'dutch_original', ''),
    'register', nullif(p_content->>'register', ''),
    'analysis_notes', nullif(p_content->>'analysis_notes', ''),
    'usage_notes', CASE WHEN jsonb_typeof(p_content->'usage_notes') = 'object'
      AND NOT (p_content->'usage_notes' ? 'contrasts')
      THEN p_content->'usage_notes' || '{"contrasts":[]}'::JSONB ELSE p_content->'usage_notes' END,
    'image_url', p_content->'image_url',
    'tts_url', nullif(p_content->>'tts_url', '')
  );
$$;

CREATE FUNCTION public.import_shared_dictionary_collection_v1(
  p_collection_id UUID, p_share_token UUID, p_word_ids UUID[]
) RETURNS SETOF public.words LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_source_collection UUID;
  v_source_owner UUID;
  v_source public.words;
  v_state public.word_content_state;
  v_revision public.dictionary_revisions;
  v_content JSONB;
  v_word public.words;
  v_count INTEGER := 0;
BEGIN
  PERFORM private.require_dictionary_import_v1();
  IF p_word_ids IS NULL OR cardinality(p_word_ids) NOT BETWEEN 1 AND 10000
    OR array_position(p_word_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid-shared-word-ids'; END IF;
  SELECT collection_id, user_id INTO v_source_collection, v_source_owner FROM public.collections
    WHERE is_shared IS TRUE AND share_token = p_share_token FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'shared-collection-unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_word_ids) id WHERE NOT EXISTS (
    SELECT 1 FROM public.words WHERE word_id = id AND collection_id = v_source_collection
      AND user_id = v_source_owner AND deleted_at IS NULL
  )) THEN RAISE EXCEPTION 'invalid-shared-word-ids'; END IF;
  FOR v_source IN SELECT * FROM public.words WHERE word_id = ANY(p_word_ids)
    AND collection_id = v_source_collection AND user_id = v_source_owner
    AND deleted_at IS NULL ORDER BY word_id FOR SHARE
  LOOP
    SELECT * INTO v_state FROM public.word_content_state WHERE word_id = v_source.word_id FOR SHARE;
    SELECT r.* INTO v_revision FROM public.dictionary_revisions r
      JOIN public.dictionary_entries e USING (entry_id)
      WHERE r.entry_id = v_source.dictionary_entry_id AND r.revision_id = v_source.dictionary_revision_id
        AND r.review_status = 'published' AND e.state = 'published' FOR SHARE OF r, e;
    IF FOUND THEN
      v_word := private.import_dictionary_card_v1(p_collection_id, v_revision.content,
        v_revision.entry_id, v_revision.revision_id, coalesce(v_state.overrides, '{}'));
    ELSE
      -- A retired pin can be copied as authorized text; it cannot create a new pin.
      SELECT * INTO v_revision FROM public.dictionary_revisions
        WHERE entry_id = v_source.dictionary_entry_id AND revision_id = v_source.dictionary_revision_id
          AND review_status = 'retired';
      v_content := private.dictionary_import_content_v1(private.resolve_word_effective_content(v_source, v_state, v_revision));
      v_word := private.import_dictionary_card_v1(p_collection_id, v_content);
    END IF;
    RETURN NEXT v_word;
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> (SELECT count(DISTINCT id) FROM unnest(p_word_ids) id) THEN
    RAISE EXCEPTION 'shared-selection-changed';
  END IF;
END;
$$;

-- An authenticated recipient gets only the explicitly shared content projection.
-- Private state and unpublished revision identifiers are never returned.
CREATE FUNCTION public.get_shared_dictionary_collection_v1(p_share_token UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_collection public.collections; v_words JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  SELECT * INTO v_collection FROM public.collections WHERE is_shared IS TRUE AND share_token = p_share_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('word_id', w.word_id, 'created_at', w.created_at,
    'content', private.dictionary_import_content_v1(private.resolve_word_effective_content(w, s, r)))
    ORDER BY w.created_at, w.word_id), '[]') INTO v_words
    FROM public.words w LEFT JOIN public.word_content_state s USING (word_id)
    LEFT JOIN public.dictionary_revisions r ON r.entry_id = w.dictionary_entry_id
      AND r.revision_id = w.dictionary_revision_id AND r.review_status IN ('published', 'retired')
    WHERE w.collection_id = v_collection.collection_id AND w.user_id = v_collection.user_id
      AND w.deleted_at IS NULL;
  RETURN jsonb_build_object('schema_version', 1, 'collection', jsonb_build_object(
    'collection_id', v_collection.collection_id, 'name', v_collection.name), 'words', v_words);
END;
$$;

CREATE FUNCTION public.export_dictionary_collection_v1(p_collection_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name TEXT; v_entries JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  SELECT name INTO v_name FROM public.collections WHERE collection_id = p_collection_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('content', private.dictionary_import_content_v1(
    private.resolve_word_effective_content(w, s, r))) ORDER BY w.created_at, w.word_id), '[]') INTO v_entries
    FROM public.words w LEFT JOIN public.word_content_state s USING (word_id)
    LEFT JOIN public.dictionary_revisions r ON r.entry_id = w.dictionary_entry_id
      AND r.revision_id = w.dictionary_revision_id AND r.review_status IN ('published', 'retired')
    WHERE w.user_id = auth.uid() AND w.collection_id = p_collection_id AND w.deleted_at IS NULL;
  IF jsonb_array_length(v_entries) > 10000 THEN RAISE EXCEPTION 'too-many-export-entries'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_entries) e
    WHERE private.valid_dictionary_content(e->'content') IS NOT TRUE) THEN
    RAISE EXCEPTION 'export-content-upgrade-required';
  END IF;
  RETURN jsonb_build_object('schema_version', 1, 'collection', jsonb_build_object('name', v_name), 'entries', v_entries);
END;
$$;

REVOKE ALL ON FUNCTION private.require_dictionary_import_v1(),
  private.import_dictionary_card_v1(UUID, JSONB, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.import_official_dictionary_pack_v1(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.import_official_dictionary_pack_v1(UUID, TEXT, TEXT, TEXT[]) TO authenticated;
REVOKE ALL ON FUNCTION public.import_dictionary_copies_v1(UUID, JSONB) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.import_dictionary_copies_v1(UUID, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION private.dictionary_import_content_v1(JSONB) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.import_shared_dictionary_collection_v1(UUID, UUID, UUID[]),
  public.get_shared_dictionary_collection_v1(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.import_shared_dictionary_collection_v1(UUID, UUID, UUID[]),
  public.get_shared_dictionary_collection_v1(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.export_dictionary_collection_v1(UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.export_dictionary_collection_v1(UUID) TO authenticated;
COMMIT;
