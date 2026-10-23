-- Dormant following imports and bounded cache/transfer contracts. No live rows
-- are linked, granted, published, converted or analyzed by this migration.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN following_imports_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN following_cache_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE FUNCTION private.validate_dictionary_import_intent_v2(p_intent JSONB) RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_source JSONB; v_keys TEXT[];
BEGIN
  IF private.jsonb_has_exact_keys(p_intent, ARRAY['protocol_version','operation_id','word_id','collection_id','source']) IS NOT TRUE
    OR p_intent->'protocol_version' IS DISTINCT FROM '2'::JSONB
    OR private.dictionary_import_uuid_v1(p_intent->'operation_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_intent->'word_id') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(p_intent->'collection_id') IS NOT TRUE THEN RAISE EXCEPTION 'invalid-import-intent'; END IF;
  v_source := p_intent->'source';
  v_keys := CASE v_source->>'kind'
    WHEN 'published-reference' THEN ARRAY['kind','reference','content_sha256']
    WHEN 'official-pack' THEN ARRAY['kind','reference','content_sha256','pack_id','version','pack_entry_id','manifest_sha256']
    WHEN 'shared-collection' THEN ARRAY['kind','reference','content_sha256','share_token','word_id'] END;
  IF v_keys IS NULL OR private.jsonb_has_exact_keys(v_source, v_keys) IS NOT TRUE
    OR private.jsonb_has_exact_keys(v_source->'reference', ARRAY['entry_id','revision_id']) IS NOT TRUE
    OR private.dictionary_import_uuid_v1(v_source#>'{reference,entry_id}') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(v_source#>'{reference,revision_id}') IS NOT TRUE
    OR JSONB_TYPEOF(v_source->'content_sha256') IS DISTINCT FROM 'string'
    OR (v_source->>'content_sha256') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'import-review-required'; END IF;
  IF v_source->>'kind' = 'official-pack' AND (
    NOT private.dictionary_bounded_text(v_source->'pack_id', 200)
    OR NOT private.dictionary_bounded_text(v_source->'version', 200)
    OR NOT private.dictionary_bounded_text(v_source->'pack_entry_id', 200)
    OR JSONB_TYPEOF(v_source->'manifest_sha256') IS DISTINCT FROM 'string'
    OR (v_source->>'manifest_sha256') !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'invalid-import-source'; END IF;
  IF v_source->>'kind' = 'shared-collection' AND (
    private.dictionary_import_uuid_v1(v_source->'share_token') IS NOT TRUE
    OR private.dictionary_import_uuid_v1(v_source->'word_id') IS NOT TRUE) THEN RAISE EXCEPTION 'invalid-import-source'; END IF;
END;
$$;

-- Shared creation core used by original delivery and explicit placement recovery.
CREATE FUNCTION private.insert_dictionary_import_word_v2(p_intent JSONB,p_target UUID) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_word UUID := (p_intent->>'word_id')::UUID; v_target UUID := p_target;
  v_source JSONB := p_intent->'source'; v_entry UUID := (p_intent#>>'{source,reference,entry_id}')::UUID;
  v_adopted UUID := (p_intent#>>'{source,reference,revision_id}')::UUID;
  v_revision public.dictionary_revisions; v_head public.dictionary_revisions;
  v_shared public.words; v_shared_collection public.collections; v_manifest JSONB;
  v_enabled BOOLEAN; v_receipt JSONB; v_sequence BIGINT;
BEGIN
  SELECT reads_enabled AND operations_enabled AND legacy_guard_enabled AND following_reads_enabled AND following_imports_enabled
    INTO STRICT v_enabled FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT v_enabled THEN RAISE EXCEPTION 'following-import-disabled'; END IF;
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

CREATE FUNCTION private.require_dictionary_import_actor_v2() RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM auth.users WHERE id = auth.uid() FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
END;
$$;
CREATE FUNCTION public.apply_dictionary_import_intent_v2(p_intent JSONB) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_origin private.dictionary_import_origins; v_saved private.dictionary_import_receipts;
  v_hash TEXT; v_operation UUID; v_word UUID; v_target UUID; v_receipt JSONB;
BEGIN
  PERFORM private.require_dictionary_import_actor_v2();
  PERFORM private.validate_dictionary_import_intent_v2(p_intent);
  v_operation := (p_intent->>'operation_id')::UUID; v_word := (p_intent->>'word_id')::UUID;
  v_target := (p_intent->>'collection_id')::UUID; v_hash := private.dictionary_import_hash_v1(p_intent);
  -- The v1 nonce/personal-ID namespace also fences cross-protocol reuse.
  v_origin := private.lock_dictionary_import_root_v1(p_intent);
  SELECT * INTO v_saved FROM private.dictionary_import_receipts WHERE user_id = v_actor AND operation_id = v_operation;
  IF FOUND THEN RETURN v_saved.receipt || '{"idempotent":true}'::JSONB; END IF;
  IF v_origin.cancelled THEN RAISE EXCEPTION 'import-cancelled'; END IF;
  IF v_origin.recovery_version > 0 THEN RAISE EXCEPTION 'import-original-settled'; END IF;
  IF v_origin.inserted_once THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
  v_receipt := private.insert_dictionary_import_word_v2(p_intent,v_target);
  IF v_receipt->>'outcome' = 'inserted' THEN
    INSERT INTO private.dictionary_import_origins(word_id,user_id,original_operation_id,intent_sha256,inserted_once)
      VALUES(v_word,v_actor,v_operation,v_hash,TRUE);
  END IF;
  v_receipt := v_receipt || JSONB_BUILD_OBJECT('protocol_version',2,'operation_id',v_operation,'word_id',v_word,'idempotent',FALSE);
  INSERT INTO private.dictionary_import_receipts(user_id,operation_id,intent_sha256,receipt) VALUES(v_actor,v_operation,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

-- Keep v1 sharing/export wire shapes and snapshot imports compatible with follow
-- sources. Immutable queued v1 intents/recovery are not reinterpreted.
CREATE OR REPLACE FUNCTION private.resolve_word_effective_content(
  p_word public.words, p_state public.word_content_state, p_revision public.dictionary_revisions
) RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_content JSONB;
BEGIN
  IF p_word.dictionary_content_mode = 'follow' THEN
    PERFORM private.require_following_dependencies(p_word.user_id,ARRAY[p_word.word_id]);
    SELECT r.content INTO v_content FROM public.dictionary_entry_heads h JOIN public.dictionary_revisions r USING(entry_id,revision_id)
      WHERE h.entry_id = p_word.dictionary_entry_id AND r.review_status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
    RETURN v_content;
  END IF;
  RETURN private.apply_dictionary_overrides(CASE WHEN p_word.dictionary_entry_id IS NOT NULL
    AND p_revision.entry_id = p_word.dictionary_entry_id AND p_revision.revision_id = p_word.dictionary_revision_id
    AND p_revision.review_status IN ('published','retired') THEN p_revision.content
    WHEN p_state.fallback_content IS NOT NULL THEN p_state.fallback_content ELSE private.legacy_word_content(p_word) END,
    COALESCE(p_state.overrides,'{}'::JSONB));
END;
$$;

CREATE OR REPLACE FUNCTION public.import_shared_dictionary_collection_v1(
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
      WHERE r.entry_id = v_source.dictionary_entry_id AND r.revision_id = CASE WHEN v_source.dictionary_content_mode = 'follow'
        THEN (SELECT revision_id FROM public.dictionary_entry_heads WHERE entry_id = v_source.dictionary_entry_id) ELSE v_source.dictionary_revision_id END
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

-- Transfer files remain portable snapshots. Only following, published content
-- carries a reusable reference; legacy/private differences stay explicit review.
CREATE FUNCTION private.dictionary_transfer_entry_v2(p_word public.words, p_state public.word_content_state) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_revision public.dictionary_revisions; v_content JSONB; v_reference JSONB := 'null';
BEGIN
  IF p_word.dictionary_content_mode = 'follow' THEN
    SELECT r.* INTO v_revision FROM public.dictionary_entry_heads h JOIN public.dictionary_revisions r USING(entry_id,revision_id)
      JOIN public.dictionary_entries e USING(entry_id) WHERE e.entry_id = p_word.dictionary_entry_id AND e.state IN ('published','retired') AND r.review_status = 'published';
    IF NOT FOUND THEN RAISE EXCEPTION 'missing-dictionary-head'; END IF;
    v_content := v_revision.content;
    IF EXISTS (SELECT 1 FROM public.dictionary_entries WHERE entry_id = v_revision.entry_id AND state = 'published') THEN
      v_reference := JSONB_BUILD_OBJECT('reference',JSONB_BUILD_OBJECT('entry_id',v_revision.entry_id,'revision_id',v_revision.revision_id),
        'content_sha256',v_revision.content_sha256);
    END IF;
  ELSE
    SELECT * INTO v_revision FROM public.dictionary_revisions WHERE entry_id = p_word.dictionary_entry_id
      AND revision_id = p_word.dictionary_revision_id AND review_status IN ('published','retired');
    v_content := private.dictionary_import_content_v1(private.resolve_word_effective_content(p_word,p_state,v_revision));
  END IF;
  IF private.valid_dictionary_content(v_content) IS NOT TRUE THEN RAISE EXCEPTION 'export-content-upgrade-required'; END IF;
  RETURN JSONB_BUILD_OBJECT('content',v_content,'shared_reference',v_reference);
END;
$$;
CREATE FUNCTION public.export_dictionary_collection_v2(p_collection_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name TEXT; v_entries JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled AND following_reads_enabled) THEN RAISE EXCEPTION 'unsupported-protocol'; END IF;
  SELECT name INTO v_name FROM public.collections WHERE collection_id = p_collection_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  PERFORM private.require_following_dependencies(auth.uid(),ARRAY(SELECT word_id FROM public.words WHERE user_id = auth.uid() AND collection_id = p_collection_id AND deleted_at IS NULL));
  SELECT COALESCE(JSONB_AGG(private.dictionary_transfer_entry_v2(w,s) ORDER BY w.created_at,w.word_id),'[]') INTO v_entries
    FROM public.words w LEFT JOIN public.word_content_state s USING(word_id) WHERE w.user_id = auth.uid() AND w.collection_id = p_collection_id AND w.deleted_at IS NULL;
  IF JSONB_ARRAY_LENGTH(v_entries) > 10000 THEN RAISE EXCEPTION 'too-many-export-entries'; END IF;
  RETURN JSONB_BUILD_OBJECT('schema_version',2,'collection',JSONB_BUILD_OBJECT('name',v_name),'entries',v_entries);
END;
$$;
CREATE FUNCTION public.get_shared_dictionary_collection_v2(p_share_token UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_collection public.collections; v_words JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled AND following_reads_enabled) THEN RAISE EXCEPTION 'unsupported-protocol'; END IF;
  SELECT * INTO v_collection FROM public.collections WHERE share_token = p_share_token AND is_shared;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM private.require_following_dependencies(v_collection.user_id,ARRAY(SELECT word_id FROM public.words WHERE user_id = v_collection.user_id AND collection_id = v_collection.collection_id AND deleted_at IS NULL));
  SELECT COALESCE(JSONB_AGG(private.dictionary_transfer_entry_v2(w,s) || JSONB_BUILD_OBJECT('word_id',w.word_id) ORDER BY w.created_at,w.word_id),'[]') INTO v_words
    FROM public.words w LEFT JOIN public.word_content_state s USING(word_id) WHERE w.user_id = v_collection.user_id AND w.collection_id = v_collection.collection_id AND w.deleted_at IS NULL;
  IF JSONB_ARRAY_LENGTH(v_words) > 10000 THEN RAISE EXCEPTION 'too-many-export-entries'; END IF;
  RETURN JSONB_BUILD_OBJECT('schema_version',2,'collection',JSONB_BUILD_OBJECT('collection_id',v_collection.collection_id,'name',v_collection.name),'words',v_words);
END;
$$;

CREATE FUNCTION private.dictionary_cache_content_v2(p_cache public.word_analysis_cache) RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT JSONB_OBJECT_AGG(key,value) FROM JSONB_EACH(TO_JSONB(p_cache)) WHERE key = ANY(ARRAY[
    'dutch_lemma','dutch_original','part_of_speech','article','translations','examples','is_irregular','is_reflexive','is_expression','expression_type',
    'is_separable','prefix_part','root_verb','plural','register','synonyms','antonyms','conjugation','preposition','analysis_notes','usage_notes','image_url','tts_url']);
$$;
CREATE FUNCTION public.resolve_dictionary_cache_references_v2(p_cache_ids UUID[]) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_resolutions JSONB; v_revisions JSONB;
BEGIN
  IF p_cache_ids IS NULL OR CARDINALITY(p_cache_ids) > 500 OR ARRAY_POSITION(p_cache_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid-cache-batch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled AND following_reads_enabled AND following_cache_enabled) THEN RAISE EXCEPTION 'following-cache-disabled'; END IF;
  WITH requested AS (SELECT DISTINCT UNNEST(p_cache_ids) cache_id), resolved AS (
    SELECT q.cache_id, h.revision_id, h.entry_id,
      CASE WHEN c.cache_id IS NULL THEN 'missing' WHEN c.dictionary_entry_id IS NULL THEN 'unmapped'
        WHEN c.created_at + c.cache_ttl_hours * INTERVAL '1 hour' <= NOW() THEN 'expired'
        WHEN e.state IS DISTINCT FROM 'published' OR r.review_status IS DISTINCT FROM 'published' OR h.revision_id IS NULL THEN 'unavailable'
        WHEN private.dictionary_cache_content_v2(c) IS DISTINCT FROM r.content THEN 'mapping-mismatch' ELSE 'resolved' END AS status
    FROM requested q LEFT JOIN public.word_analysis_cache c USING(cache_id)
    LEFT JOIN public.dictionary_entries e ON e.entry_id = c.dictionary_entry_id
    LEFT JOIN public.dictionary_revisions r ON r.entry_id = c.dictionary_entry_id AND r.revision_id = c.dictionary_revision_id
    LEFT JOIN public.dictionary_entry_heads h ON h.entry_id = e.entry_id
  ) SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('cache_id',cache_id,'status',status,
      'reference',CASE WHEN status = 'resolved' THEN JSONB_BUILD_OBJECT('entry_id',entry_id,'revision_id',revision_id) ELSE NULL END,
      'head_sequence',CASE WHEN status = 'resolved' THEN (SELECT MAX(committed_version)::TEXT FROM private.dictionary_content_changes d
        WHERE d.entry_id = resolved.entry_id AND d.change_kind = 'revision-head') ELSE NULL END) ORDER BY cache_id),'[]'),
    COALESCE((SELECT JSONB_AGG(TO_JSONB(r) - ARRAY['source_id','reviewed_at','published_at','created_at'] ORDER BY revision_id)
      FROM public.dictionary_revisions r WHERE revision_id IN (SELECT revision_id FROM resolved WHERE status = 'resolved')),'[]')
    INTO v_resolutions,v_revisions FROM resolved;
  RETURN JSONB_BUILD_OBJECT('protocol_version',2,'resolutions',v_resolutions,'revisions',v_revisions);
END;
$$;
-- Preserve the v1 media-only cache mapping contract. The v2 resolver independently
-- rejects full content/media mismatch without changing legacy mapping columns.
-- Recovery/cancellation can settle pending roots after feature disablement;
-- only the creation core can create a new follow row, behind its runtime gate.
CREATE FUNCTION private.dictionary_import_snapshot_v2(p_intent JSONB,p_origin private.dictionary_import_origins) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.dictionary_import_snapshot_v1(p_intent,p_origin) || JSONB_BUILD_OBJECT('protocol_version',2);
$$;
CREATE FUNCTION public.read_dictionary_import_recovery_v2(p_intent JSONB) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_origin private.dictionary_import_origins;
BEGIN
  PERFORM private.require_dictionary_import_actor_v2();
  PERFORM private.validate_dictionary_import_intent_v2(p_intent);
  v_origin := private.lock_dictionary_import_root_v1(p_intent);
  RETURN private.dictionary_import_snapshot_v2(p_intent,v_origin);
END;
$$;
CREATE FUNCTION public.recover_dictionary_import_v2(p_request JSONB)
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
  PERFORM private.require_dictionary_import_actor_v2();
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR NOT p_request ?& ARRAY['protocol_version','operation_id','original_intent','expected_recovery_version','expected_collection_id','target_collection_id']
    OR p_request - ARRAY['protocol_version','operation_id','original_intent','expected_recovery_version','expected_collection_id','target_collection_id'] <> '{}'
    OR p_request->'protocol_version' IS DISTINCT FROM '2'::JSONB
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
  PERFORM private.validate_dictionary_import_intent_v2(v_intent);
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
  v_result := jsonb_build_object('protocol_version',2,'operation_id',v_operation,
    'original_operation_id',v_intent->>'operation_id','word_id',v_intent->>'word_id','target_collection_id',v_target);
  IF v_version <> (p_request->>'expected_recovery_version')::INTEGER THEN
    RETURN v_result || jsonb_build_object('outcome','state-conflict','state',private.dictionary_import_snapshot_v2(v_intent,v_origin));
  END IF;
  IF v_version = 2147483647 THEN RAISE EXCEPTION 'import-recovery-version-exhausted'; END IF;
  PERFORM 1 FROM public.collections WHERE collection_id = v_target AND user_id = auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found or access denied'; END IF;
  IF coalesce(v_origin.inserted_once,false) THEN
    SELECT * INTO v_word FROM public.words WHERE word_id = v_origin.word_id AND user_id = auth.uid() AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'import-personal-id-unavailable' USING ERRCODE = '42501'; END IF;
    IF v_word.collection_id IS DISTINCT FROM v_expected_collection THEN
      RETURN v_result || jsonb_build_object('outcome','placement-conflict','state',private.dictionary_import_snapshot_v2(v_intent,v_origin));
    END IF;
    UPDATE public.words SET collection_id = v_target WHERE word_id = v_origin.word_id;
    v_receipt := jsonb_build_object('outcome','applied','existing_word_id',NULL);
  ELSE
    v_receipt := private.insert_dictionary_import_word_v2(v_intent,v_target);
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
  v_receipt := (v_receipt - ARRAY['reference','applied_reference','applied_head_sequence']) || v_result || jsonb_build_object('recovery_version',v_version+1,'idempotent',false);
  INSERT INTO private.dictionary_import_recovery_receipts(user_id,operation_id,request_sha256,receipt)
    VALUES(auth.uid(),v_operation,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

CREATE FUNCTION public.cancel_dictionary_import_v2(p_request JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_intent JSONB;
  v_origin private.dictionary_import_origins;
  v_saved private.dictionary_import_recovery_receipts;
  v_operation UUID; v_version INTEGER;
  v_hash TEXT; v_receipt JSONB;
BEGIN
  PERFORM private.require_dictionary_import_actor_v2();
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object'
    OR NOT p_request ?& ARRAY['protocol_version','operation_id','original_intent']
    OR p_request - ARRAY['protocol_version','operation_id','original_intent'] <> '{}'
    OR p_request->'protocol_version' IS DISTINCT FROM '2'::JSONB
    OR private.dictionary_import_uuid_v1(p_request->'operation_id') IS NOT TRUE THEN
    RAISE EXCEPTION 'invalid-import-cancellation';
  END IF;
  v_intent := p_request->'original_intent';
  PERFORM private.validate_dictionary_import_intent_v2(v_intent);
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
  v_receipt := jsonb_build_object('protocol_version',2,'operation_id',v_operation,
    'original_operation_id',v_intent->>'operation_id','word_id',v_intent->>'word_id',
    'outcome','cancelled','recovery_version',v_version,'idempotent',false);
  INSERT INTO private.dictionary_import_recovery_receipts(user_id,operation_id,request_sha256,receipt)
    VALUES(auth.uid(),v_operation,v_hash,v_receipt);
  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION private.insert_dictionary_import_word_v2(JSONB,UUID), private.require_dictionary_import_actor_v2(),
  private.dictionary_import_snapshot_v2(JSONB,private.dictionary_import_origins) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.read_dictionary_import_recovery_v2(JSONB),public.recover_dictionary_import_v2(JSONB),public.cancel_dictionary_import_v2(JSONB) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_dictionary_import_recovery_v2(JSONB),public.recover_dictionary_import_v2(JSONB),public.cancel_dictionary_import_v2(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_import_intent_v2(JSONB), private.dictionary_transfer_entry_v2(public.words,public.word_content_state),
  private.dictionary_cache_content_v2(public.word_analysis_cache) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_dictionary_import_intent_v2(JSONB), public.export_dictionary_collection_v2(UUID), public.get_shared_dictionary_collection_v2(UUID) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.apply_dictionary_import_intent_v2(JSONB), public.export_dictionary_collection_v2(UUID), public.get_shared_dictionary_collection_v2(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_dictionary_cache_references_v2(UUID[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dictionary_cache_references_v2(UUID[]) TO service_role;
COMMENT ON COLUMN private.dictionary_content_runtime.following_imports_enabled IS 'Default-off new follow imports; immutable v1 queued input and recovery remain unchanged.';
COMMENT ON FUNCTION public.resolve_dictionary_cache_references_v2(UUID[]) IS 'Bounded trusted mapping resolver; cache is not publication authority, private text is never published.';
COMMIT;
