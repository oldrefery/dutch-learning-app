-- Additive D10 receipts. No manifest edits, dictionary publication or flag changes.
BEGIN;

CREATE FUNCTION private.dictionary_canonical_json(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'object' THEN '{' || coalesce((SELECT string_agg(
      to_jsonb(key)::TEXT || ':' || private.dictionary_canonical_json(value),
      ',' ORDER BY key COLLATE "C") FROM jsonb_each(p_value)), '') || '}'
    WHEN 'array' THEN '[' || coalesce((SELECT string_agg(
      private.dictionary_canonical_json(value), ',' ORDER BY position)
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(value, position)), '') || ']'
    ELSE p_value::TEXT END;
$$;

CREATE FUNCTION private.official_dictionary_content_v1(p_entry JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'dutch_lemma', p_entry->'dutch_lemma',
    'dutch_original', coalesce(nullif(p_entry->'dutch_original', 'null'), p_entry->'dutch_lemma'),
    'part_of_speech', p_entry->'part_of_speech',
    'article', p_entry->'article',
    'translations', jsonb_build_object('en', p_entry#>'{translations,en}',
      'ru', coalesce(p_entry#>'{translations,ru}', '[]')),
    'examples', coalesce((SELECT jsonb_agg(e || jsonb_build_object('ru', e->'ru') ORDER BY position)
      FROM jsonb_array_elements(coalesce(p_entry->'examples', '[]'))
        WITH ORDINALITY AS a(e, position)), '[]'),
    'is_irregular', coalesce(p_entry->'is_irregular', 'false'),
    'is_reflexive', coalesce(p_entry->'is_reflexive', 'false'),
    'is_expression', coalesce(p_entry->'is_expression', 'false'),
    'expression_type', p_entry->'expression_type',
    'is_separable', coalesce(p_entry->'is_separable', 'false'),
    'prefix_part', p_entry->'prefix_part', 'root_verb', p_entry->'root_verb',
    'plural', p_entry->'plural',
    'register', coalesce(nullif(p_entry->'register', 'null'), '"neutral"'),
    'synonyms', coalesce(p_entry->'synonyms', '[]'),
    'antonyms', coalesce(p_entry->'antonyms', '[]'),
    'conjugation', CASE WHEN p_entry->'conjugation' IS NULL OR p_entry->'conjugation' = 'null'
      THEN 'null'::JSONB ELSE p_entry->'conjugation' ||
        jsonb_build_object('simple_past_plural', p_entry#>'{conjugation,simple_past_plural}') END,
    'preposition', p_entry->'preposition', 'analysis_notes', p_entry->'analysis_notes',
    'usage_notes', NULL, 'image_url', NULL, 'tts_url', NULL
  );
$$;

-- Only an administrator can insert a reviewed explicit mapping. No spelling joins.
CREATE TABLE private.official_dictionary_mappings (
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  pack_entry_id TEXT NOT NULL CHECK (btrim(pack_entry_id) <> ''),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  entry_id UUID NOT NULL,
  revision_id UUID NOT NULL,
  revision_content_sha256 TEXT NOT NULL CHECK (revision_content_sha256 ~ '^[0-9a-f]{64}$'),
  source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id),
  provenance_locator TEXT NOT NULL CHECK (btrim(provenance_locator) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pack_id, version, pack_entry_id),
  FOREIGN KEY (pack_id, version) REFERENCES public.official_content_pack_versions(pack_id, version),
  FOREIGN KEY (entry_id, revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id)
);

CREATE FUNCTION private.validate_official_dictionary_mapping() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_manifest JSONB;
  v_entry JSONB;
  v_revision public.dictionary_revisions;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'official-mapping-is-immutable'; END IF;
  SELECT manifest INTO v_manifest FROM public.official_content_pack_versions
    WHERE pack_id = NEW.pack_id AND version = NEW.version
      AND review_status = 'published' AND content_sha256 = NEW.manifest_sha256
    FOR SHARE;
  IF NOT FOUND OR encode(extensions.digest(convert_to(
    private.dictionary_canonical_json(v_manifest), 'UTF8'), 'sha256'), 'hex')
      IS DISTINCT FROM NEW.manifest_sha256 THEN
    RAISE EXCEPTION 'official-mapping-manifest-mismatch';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(v_manifest->'entries') AS e
    WHERE e->>'entry_id' = NEW.pack_entry_id) <> 1 THEN
    RAISE EXCEPTION 'official-mapping-entry-mismatch';
  END IF;
  SELECT e INTO v_entry FROM jsonb_array_elements(v_manifest->'entries') AS e
    WHERE e->>'entry_id' = NEW.pack_entry_id;
  SELECT r.* INTO v_revision FROM public.dictionary_revisions r
    JOIN public.dictionary_entries e USING (entry_id)
    WHERE r.entry_id = NEW.entry_id AND r.revision_id = NEW.revision_id
      AND r.review_status = 'published' AND e.state = 'published'
    FOR SHARE OF r, e;
  IF NOT FOUND OR v_revision.content IS DISTINCT FROM private.official_dictionary_content_v1(v_entry)
    OR v_revision.content_sha256 IS DISTINCT FROM NEW.revision_content_sha256
    OR v_revision.source_id IS DISTINCT FROM NEW.source_id
    OR encode(extensions.digest(convert_to(private.dictionary_canonical_json(v_revision.content),
      'UTF8'), 'sha256'), 'hex') IS DISTINCT FROM NEW.revision_content_sha256
    OR private.valid_dictionary_content(v_revision.content) IS NOT TRUE THEN
    RAISE EXCEPTION 'official-mapping-revision-mismatch';
  END IF;
  IF v_revision.schema_version <> 1 OR v_revision.cefr_input_sha256 IS DISTINCT FROM
    encode(extensions.digest(convert_to(private.dictionary_canonical_json(
      jsonb_build_object('assessment_schema_version', 1,
        'content', v_revision.content - ARRAY['image_url', 'tts_url'])), 'UTF8'), 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'official-mapping-cefr-input-mismatch';
  END IF;
  PERFORM 1 FROM private.dictionary_sources WHERE source_id = NEW.source_id
    AND source_kind IN ('first_party', 'licensed') AND review_state = 'approved'
    AND approved_content_sha256 = NEW.revision_content_sha256
    AND provenance_locator = NEW.provenance_locator FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'official-mapping-source-mismatch'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_official_dictionary_mapping
  BEFORE INSERT OR UPDATE OR DELETE ON private.official_dictionary_mappings
  FOR EACH ROW EXECUTE FUNCTION private.validate_official_dictionary_mapping();

CREATE FUNCTION private.protect_official_dictionary_mapping_truncate() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'official-mapping-is-immutable'; END;
$$;
CREATE TRIGGER protect_official_dictionary_mapping_truncate
  BEFORE TRUNCATE ON private.official_dictionary_mappings
  FOR EACH STATEMENT EXECUTE FUNCTION private.protect_official_dictionary_mapping_truncate();

CREATE FUNCTION public.get_official_dictionary_mapping_v1(p_pack_id TEXT, p_version TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled)
    THEN RAISE EXCEPTION 'unsupported-protocol'; END IF;
  SELECT jsonb_build_object('schema_version', 1, 'pack_id', m.pack_id, 'version', m.version,
    'manifest_sha256', m.manifest_sha256, 'entries', jsonb_agg(jsonb_build_object(
      'pack_entry_id', m.pack_entry_id,
      'reference', jsonb_build_object('entry_id', m.entry_id, 'revision_id', m.revision_id),
      'revision_content_sha256', m.revision_content_sha256,
      'revision', jsonb_build_object('revision_no', r.revision_no,
        'schema_version', r.schema_version, 'cefr_input_sha256', r.cefr_input_sha256),
      'provenance', jsonb_build_object('source_id', m.source_id, 'provenance_locator', m.provenance_locator)
    ) ORDER BY m.pack_entry_id)) INTO v_result
    FROM private.official_dictionary_mappings m
    JOIN public.official_content_pack_versions p USING (pack_id, version)
    JOIN public.dictionary_revisions r USING (entry_id, revision_id)
    JOIN public.dictionary_entries e USING (entry_id)
    JOIN private.dictionary_sources s ON s.source_id = m.source_id
    WHERE m.pack_id = p_pack_id AND m.version = p_version AND p.review_status = 'published'
      AND r.review_status = 'published' AND e.state = 'published' AND s.review_state = 'approved'
    GROUP BY m.pack_id, m.version, m.manifest_sha256;
  RETURN v_result;
END;
$$;

REVOKE ALL ON private.official_dictionary_mappings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.dictionary_canonical_json(JSONB),
  private.official_dictionary_content_v1(JSONB), private.validate_official_dictionary_mapping(),
  private.protect_official_dictionary_mapping_truncate() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_official_dictionary_mapping_v1(TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_official_dictionary_mapping_v1(TEXT, TEXT) TO authenticated;
COMMIT;
