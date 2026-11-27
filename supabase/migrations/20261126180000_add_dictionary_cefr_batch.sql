BEGIN;

CREATE TABLE private.dictionary_cefr_batch_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  source_id UUID REFERENCES private.dictionary_sources(source_id),
  remaining_batches INTEGER CHECK (remaining_batches >= 0),
  pilot_entry_ids UUID[] CHECK (cardinality(pilot_entry_ids) BETWEEN 1 AND 25),
  CHECK (NOT enabled OR source_id IS NOT NULL)
);
INSERT INTO private.dictionary_cefr_batch_settings DEFAULT VALUES;

CREATE TABLE private.dictionary_cefr_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  provider_name TEXT UNIQUE CHECK (provider_name ~ '^batches/[A-Za-z0-9_-]+$'),
  finished_at TIMESTAMPTZ
);

CREATE TABLE private.dictionary_cefr_batch_items (
  batch_id UUID NOT NULL REFERENCES private.dictionary_cefr_batches(batch_id),
  revision_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  outcome TEXT CHECK (outcome IN ('estimated', 'unknown', 'failed', 'obsolete')),
  PRIMARY KEY (batch_id, entry_id),
  FOREIGN KEY (entry_id, revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id)
);
CREATE INDEX dictionary_cefr_batch_items_input
  ON private.dictionary_cefr_batch_items(entry_id, input_sha256);
CREATE UNIQUE INDEX dictionary_cefr_batches_single_active
  ON private.dictionary_cefr_batches ((TRUE)) WHERE finished_at IS NULL;

CREATE FUNCTION private.dictionary_cefr_batch_source_eligible(p_source UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.dictionary_sources
    WHERE source_id = p_source AND source_kind = 'provider' AND review_state = 'approved'
      AND provenance_locator = 'gemini-batch:cefr-estimate-v1'
  );
$$;

CREATE FUNCTION public.next_dictionary_cefr_batch_v1()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  settings private.dictionary_cefr_batch_settings%ROWTYPE;
  active private.dictionary_cefr_batches%ROWTYPE;
  new_batch UUID := gen_random_uuid();
  requests JSONB;
BEGIN
  SELECT * INTO STRICT settings FROM private.dictionary_cefr_batch_settings FOR UPDATE;
  IF NOT settings.enabled OR NOT private.dictionary_cefr_batch_source_eligible(settings.source_id) THEN
    RETURN jsonb_build_object('action', 'disabled');
  END IF;

  SELECT * INTO active FROM private.dictionary_cefr_batches WHERE finished_at IS NULL;
  IF FOUND THEN
    RETURN jsonb_build_object('action', CASE WHEN active.provider_name IS NULL THEN 'awaiting_receipt' ELSE 'poll' END,
      'batch_id', active.batch_id, 'provider_name', active.provider_name, 'created_at', active.created_at,
      'entry_ids', (SELECT jsonb_agg(entry_id ORDER BY entry_id) FROM private.dictionary_cefr_batch_items
        WHERE batch_id = active.batch_id));
  END IF;

  -- Budget cardinality includes failed and uncertain dispatches.
  IF settings.remaining_batches = 0
    OR EXISTS (SELECT 1 FROM private.dictionary_cefr_batches WHERE created_at > now() - INTERVAL '1 hour')
    OR (SELECT count(*) FROM private.dictionary_cefr_batches WHERE created_at > now() - INTERVAL '24 hours') >= 8 THEN
    RETURN jsonb_build_object('action', 'idle');
  END IF;

  INSERT INTO private.dictionary_cefr_batches(batch_id, source_id) VALUES (new_batch, settings.source_id);
  INSERT INTO private.dictionary_cefr_batch_items(batch_id, revision_id, entry_id, input_sha256)
  SELECT new_batch, r.revision_id, r.entry_id, r.cefr_input_sha256
  FROM public.dictionary_entry_heads h
  JOIN public.dictionary_revisions r USING (entry_id, revision_id)
  JOIN public.dictionary_entries e USING (entry_id)
  LEFT JOIN public.dictionary_cefr_heads ch ON ch.entry_id = r.entry_id AND ch.input_sha256 = r.cefr_input_sha256
  LEFT JOIN public.dictionary_cefr_assessments a ON a.assessment_id = ch.assessment_id
  WHERE e.language_code = 'nl' AND private.dictionary_cefr_revision_eligible_v1(r.revision_id)
    AND (a.assessment_id IS NULL OR a.status = 'unknown')
    AND (settings.pilot_entry_ids IS NULL OR r.entry_id = ANY(settings.pilot_entry_ids))
    AND octet_length(r.content::TEXT) <= 8192
    AND NOT EXISTS (
      SELECT 1 FROM private.dictionary_cefr_batch_items i
      WHERE i.entry_id = r.entry_id AND i.input_sha256 = r.cefr_input_sha256
      GROUP BY i.entry_id
      HAVING count(*) >= 2 OR bool_or(i.outcome IS DISTINCT FROM 'failed')
    )
  ORDER BY r.published_at DESC NULLS LAST, r.entry_id
  LIMIT 25;

  SELECT jsonb_agg(jsonb_build_object('entry_id', i.entry_id, 'meaning', jsonb_build_object(
    'lemma', r.content->'dutch_lemma', 'original', r.content->'dutch_original',
    'part_of_speech', r.content->'part_of_speech', 'article', r.content->'article',
    'expression_type', r.content->'expression_type', 'translations', r.content->'translations',
    'examples', r.content->'examples')) ORDER BY i.entry_id)
  INTO requests FROM private.dictionary_cefr_batch_items i
  JOIN public.dictionary_revisions r USING (entry_id, revision_id)
  WHERE i.batch_id = new_batch;

  IF requests IS NULL THEN
    DELETE FROM private.dictionary_cefr_batches WHERE batch_id = new_batch;
    RETURN jsonb_build_object('action', 'idle');
  END IF;
  IF settings.remaining_batches IS NOT NULL THEN
    UPDATE private.dictionary_cefr_batch_settings SET remaining_batches = remaining_batches - 1;
  END IF;
  RETURN jsonb_build_object('action', 'submit', 'batch_id', new_batch, 'requests', requests);
END;
$$;

CREATE FUNCTION public.record_dictionary_cefr_batch_v1(p_batch UUID, p_provider_name TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.dictionary_cefr_batches SET provider_name = p_provider_name
  WHERE batch_id = p_batch AND finished_at IS NULL AND p_provider_name IS NOT NULL
    AND (provider_name IS NULL OR provider_name = p_provider_name);
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid CEFR batch receipt'; END IF;
END;
$$;

CREATE FUNCTION public.finish_dictionary_cefr_batch_v1(p_batch UUID, p_results JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  settings private.dictionary_cefr_batch_settings%ROWTYPE;
  active private.dictionary_cefr_batches%ROWTYPE;
  item private.dictionary_cefr_batch_items%ROWTYPE;
  result JSONB;
  current_revision UUID;
  previous_assessment UUID;
  new_assessment UUID;
  disposition TEXT;
BEGIN
  SELECT * INTO STRICT settings FROM private.dictionary_cefr_batch_settings FOR UPDATE;
  SELECT * INTO STRICT active FROM private.dictionary_cefr_batches WHERE batch_id = p_batch FOR UPDATE;
  IF active.finished_at IS NOT NULL THEN RETURN; END IF;
  IF NOT settings.enabled OR settings.source_id IS DISTINCT FROM active.source_id
    OR NOT private.dictionary_cefr_batch_source_eligible(active.source_id) THEN
    RAISE EXCEPTION 'CEFR batch publishing disabled';
  END IF;
  IF jsonb_typeof(p_results) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_results)) <>
      (SELECT count(*) FROM private.dictionary_cefr_batch_items WHERE batch_id = p_batch) THEN
    RAISE EXCEPTION 'incomplete CEFR batch results';
  END IF;

  -- Acquire publication locks before writing any changes to the shared delivery cursor.
  FOR item IN SELECT * FROM private.dictionary_cefr_batch_items WHERE batch_id = p_batch ORDER BY entry_id
  LOOP
    IF p_results->item.entry_id::TEXT->>'outcome' = 'estimated' THEN
      PERFORM 1 FROM public.dictionary_entry_heads WHERE entry_id = item.entry_id FOR UPDATE;
      PERFORM 1 FROM public.dictionary_entries WHERE entry_id = item.entry_id FOR UPDATE;
      PERFORM 1 FROM public.dictionary_cefr_heads
      WHERE entry_id = item.entry_id AND input_sha256 = item.input_sha256 FOR UPDATE;
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM private.dictionary_cefr_batch_items WHERE batch_id = p_batch ORDER BY entry_id
  LOOP
    result := p_results->item.entry_id::TEXT;
    disposition := result->>'outcome';
    IF disposition IS NULL OR disposition NOT IN ('estimated', 'unknown', 'failed')
      OR (active.provider_name IS NULL AND disposition <> 'failed') THEN
      RAISE EXCEPTION 'invalid CEFR item result';
    END IF;
    IF disposition = 'estimated' THEN
      IF result->>'level' IS NULL OR result->>'level' NOT IN ('A1','A2','B1','B2','C1','C2')
        OR jsonb_typeof(result->'confidence') IS DISTINCT FROM 'number'
        OR (result->>'confidence')::NUMERIC NOT BETWEEN 0.75 AND 1 THEN
        RAISE EXCEPTION 'invalid CEFR estimate';
      END IF;

      SELECT revision_id INTO current_revision FROM public.dictionary_entry_heads
      WHERE entry_id = item.entry_id;
      SELECT assessment_id INTO previous_assessment FROM public.dictionary_cefr_heads
      WHERE entry_id = item.entry_id AND input_sha256 = item.input_sha256;
      IF NOT private.dictionary_cefr_revision_eligible_v1(current_revision) OR
        NOT private.dictionary_cefr_revision_eligible_v1(item.revision_id) OR
        (SELECT cefr_input_sha256 FROM public.dictionary_revisions WHERE revision_id = current_revision)
          IS DISTINCT FROM item.input_sha256 OR EXISTS (
        SELECT 1 FROM public.dictionary_cefr_assessments WHERE assessment_id = previous_assessment AND status <> 'unknown'
      ) THEN
        disposition := 'obsolete';
      ELSE
        BEGIN
          INSERT INTO public.dictionary_cefr_assessments(entry_id, input_sha256, cefr_level, status,
            confidence, method, method_version, source_id, supersedes_assessment_id)
          VALUES (item.entry_id, item.input_sha256, result->>'level', 'estimated',
            (result->>'confidence')::DOUBLE PRECISION, 'gemini-batch', 'gemini-3.6-flash/cefr-estimate-v1',
            active.source_id, previous_assessment)
          RETURNING assessment_id INTO new_assessment;

          INSERT INTO public.dictionary_cefr_heads(entry_id, input_sha256, assessment_id)
          VALUES (item.entry_id, item.input_sha256, new_assessment)
          ON CONFLICT (entry_id, input_sha256) DO UPDATE SET assessment_id = EXCLUDED.assessment_id
            WHERE dictionary_cefr_heads.assessment_id IS NOT DISTINCT FROM previous_assessment;
          IF NOT FOUND THEN RAISE NO_DATA_FOUND; END IF;
        EXCEPTION WHEN no_data_found THEN
          disposition := 'obsolete';
        END;
      END IF;
    END IF;
    UPDATE private.dictionary_cefr_batch_items SET outcome = disposition
    WHERE batch_id = p_batch AND entry_id = item.entry_id;
  END LOOP;
  UPDATE private.dictionary_cefr_batches SET finished_at = clock_timestamp() WHERE batch_id = p_batch;
END;
$$;

ALTER TABLE private.dictionary_cefr_batch_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_batch_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_cefr_batch_settings, private.dictionary_cefr_batches,
  private.dictionary_cefr_batch_items FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION private.dictionary_cefr_batch_source_eligible(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.next_dictionary_cefr_batch_v1(),
  public.record_dictionary_cefr_batch_v1(UUID,TEXT), public.finish_dictionary_cefr_batch_v1(UUID,JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_dictionary_cefr_batch_v1(),
  public.record_dictionary_cefr_batch_v1(UUID,TEXT), public.finish_dictionary_cefr_batch_v1(UUID,JSONB)
  TO service_role;

COMMIT;
