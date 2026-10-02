-- Administrator-only D06 tooling. Install only on a disposable rehearsal database.
-- Deliberately outside supabase/migrations: normal deploys never install this.
BEGIN;
CREATE SCHEMA dictionary_rehearsal;
REVOKE ALL ON SCHEMA dictionary_rehearsal FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dictionary_rehearsal
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION dictionary_rehearsal.hash(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to(p_value::TEXT, 'UTF8'), 'sha256'), 'hex');
$$;

-- Canonical dictionary keys are ASCII; C ordering matches the shared contract.
CREATE FUNCTION dictionary_rehearsal.canonical_json(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'object' THEN '{' || coalesce((SELECT string_agg(
      to_jsonb(key)::TEXT || ':' || dictionary_rehearsal.canonical_json(value),
      ',' ORDER BY key COLLATE "C") FROM jsonb_each(p_value)), '') || '}'
    WHEN 'array' THEN '[' || coalesce((SELECT string_agg(
      dictionary_rehearsal.canonical_json(value), ',' ORDER BY position)
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS a(value, position)), '') || ']'
    ELSE p_value::TEXT END;
$$;

CREATE FUNCTION dictionary_rehearsal.canonical_sha256(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to(dictionary_rehearsal.canonical_json(p_value),
    'UTF8'), 'sha256'), 'hex');
$$;

CREATE FUNCTION dictionary_rehearsal.valid_legacy_content(p_value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN private.valid_dictionary_content(p_value) IS TRUE;
EXCEPTION WHEN data_exception THEN
  RETURN FALSE;
END;
$$;

-- This fingerprint deliberately excludes learning and delivery timestamps.
-- A review arriving during preparation must not invalidate unchanged content.
CREATE FUNCTION dictionary_rehearsal.source_snapshot(p_word public.words) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('word', to_jsonb(p_word) - ARRAY[
    'interval_days', 'repetition_count', 'easiness_factor',
    'next_review_date', 'last_reviewed_at', 'updated_at'
  ], 'state', (SELECT to_jsonb(s) FROM public.word_content_state s
    WHERE s.word_id = p_word.word_id));
$$;

CREATE TABLE dictionary_rehearsal.seeds (
  resolution_id UUID PRIMARY KEY,
  request_sha256 TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  entry_id UUID NOT NULL,
  revision_id UUID NOT NULL UNIQUE,
  FOREIGN KEY (entry_id, revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
);

CREATE TABLE dictionary_rehearsal.runs (
  run_id UUID PRIMARY KEY,
  request JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE dictionary_rehearsal.items (
  run_id UUID NOT NULL REFERENCES dictionary_rehearsal.runs,
  word_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source_sha256 TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition IN (
    'safe-match', 'possible-match', 'private-only', 'excluded',
    'stale-source', 'missing-source'
  )),
  revision_id UUID,
  overrides JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (run_id, word_id)
);

-- No FK to a personal word: tombstones/deletions must not erase the audit trail
-- or be prevented by rehearsal records. These records stay in disposable data.
CREATE TABLE dictionary_rehearsal.ledger (
  run_id UUID NOT NULL,
  word_id UUID NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'stale-source', 'source-unavailable')),
  source_sha256 TEXT NOT NULL,
  result_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (run_id, word_id),
  FOREIGN KEY (run_id, word_id) REFERENCES dictionary_rehearsal.items
);

CREATE FUNCTION dictionary_rehearsal.immutable() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'rehearsal-records-are-append-only';
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['seeds', 'runs', 'items', 'ledger'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON dictionary_rehearsal.%I
      FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.immutable()', t);
    EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON dictionary_rehearsal.%I
      FOR EACH STATEMENT EXECUTE FUNCTION dictionary_rehearsal.immutable()', t);
  END LOOP;
END;
$$;

-- Input is an explicitly reviewed official per-meaning record, never a personal
-- export or a pack-level CEFR label. Approved provenance already exists in D03.
CREATE FUNCTION dictionary_rehearsal.seed_official(
  p_resolution UUID, p_manifest_sha256 TEXT, p_sense TEXT,
  p_content JSONB, p_content_sha256 TEXT, p_cefr_input_sha256 TEXT,
  p_source UUID, p_assessment JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_request TEXT;
  v_seed dictionary_rehearsal.seeds%ROWTYPE;
  v_result JSONB;
  v_assessment UUID;
BEGIN
  IF p_content_sha256 IS DISTINCT FROM dictionary_rehearsal.canonical_sha256(p_content)
    OR p_cefr_input_sha256 IS DISTINCT FROM dictionary_rehearsal.canonical_sha256(
      jsonb_build_object('assessment_schema_version', 1,
        'content', p_content - ARRAY['image_url', 'tts_url'])) THEN
    RAISE EXCEPTION 'official-content-fingerprint-mismatch';
  END IF;
  IF p_manifest_sha256 IS NULL OR p_manifest_sha256 !~ '^[0-9a-f]{64}$'
    OR NOT EXISTS (SELECT 1 FROM private.dictionary_sources WHERE source_id = p_source
      AND source_kind IN ('first_party', 'licensed') AND review_state = 'approved'
      AND approved_content_sha256 = p_content_sha256) THEN
    RAISE EXCEPTION 'reviewed-official-source-required';
  END IF;
  v_request := dictionary_rehearsal.hash(jsonb_build_array(
    p_manifest_sha256, p_sense, p_content, p_content_sha256,
    p_cefr_input_sha256, p_source, p_assessment));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_resolution::TEXT, 1));
  SELECT * INTO v_seed FROM dictionary_rehearsal.seeds WHERE resolution_id = p_resolution;
  IF FOUND THEN
    IF v_seed.request_sha256 IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'seed-intent-mismatch';
    END IF;
    RETURN jsonb_build_object('entry_id', v_seed.entry_id, 'revision_id', v_seed.revision_id);
  END IF;
  IF p_assessment IS NOT NULL AND (
    NOT private.jsonb_has_exact_keys(p_assessment, ARRAY[
      'scope', 'sense_key', 'input_sha256', 'level', 'status', 'confidence',
      'method', 'method_version', 'source_id', 'assessed_at'
    ]) OR p_assessment->>'scope' IS DISTINCT FROM 'meaning'
    OR p_assessment->>'sense_key' IS DISTINCT FROM p_sense
    OR p_assessment->>'input_sha256' IS DISTINCT FROM p_cefr_input_sha256
    OR p_assessment->>'status' NOT IN ('estimated', 'reviewed')
    OR NOT EXISTS (SELECT 1 FROM private.dictionary_sources
      WHERE source_id = (p_assessment->>'source_id')::UUID
        AND review_state = 'approved' AND approved_content_sha256 = p_content_sha256)
  ) THEN
    RAISE EXCEPTION 'meaning-bound-cefr-evidence-required';
  END IF;
  v_result := public.persist_canonical_dictionary_analysis_v1(
    p_resolution, 'nl', p_sense, p_content, p_content_sha256, p_cefr_input_sha256, p_source);
  IF p_assessment IS NOT NULL THEN
    INSERT INTO public.dictionary_cefr_assessments(
      entry_id, input_sha256, cefr_level, status, confidence,
      method, method_version, source_id, assessed_at
    ) VALUES (
      (v_result->>'entry_id')::UUID, p_cefr_input_sha256,
      p_assessment->>'level', p_assessment->>'status',
      (p_assessment->>'confidence')::DOUBLE PRECISION,
      p_assessment->>'method', p_assessment->>'method_version',
      (p_assessment->>'source_id')::UUID, (p_assessment->>'assessed_at')::TIMESTAMPTZ
    ) RETURNING assessment_id INTO v_assessment;
    INSERT INTO public.dictionary_cefr_heads(entry_id, input_sha256, assessment_id)
      VALUES ((v_result->>'entry_id')::UUID, p_cefr_input_sha256, v_assessment);
  END IF;
  INSERT INTO dictionary_rehearsal.seeds VALUES (
    p_resolution, v_request, p_manifest_sha256,
    (v_result->>'entry_id')::UUID, (v_result->>'revision_id')::UUID);
  RETURN v_result - 'idempotent';
END;
$$;

CREATE FUNCTION dictionary_rehearsal.plan_sha256(p_run UUID) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT dictionary_rehearsal.hash(jsonb_build_object(
    'request', (SELECT request FROM dictionary_rehearsal.runs WHERE run_id = p_run),
    'items', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY word_id), '[]')
      FROM dictionary_rehearsal.items i WHERE run_id = p_run)));
$$;

CREATE FUNCTION dictionary_rehearsal.plan(
  p_run UUID, p_owners UUID[], p_expected_count INTEGER,
  p_excluded UUID[] DEFAULT '{}', p_private UUID[] DEFAULT '{}',
  p_source_hashes JSONB DEFAULT '{}'
) RETURNS TEXT LANGUAGE plpgsql SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_request JSONB;
  v_existing JSONB;
BEGIN
  IF p_run IS NULL OR p_owners IS NULL OR cardinality(p_owners) = 0
    OR array_position(p_owners, NULL) IS NOT NULL
    OR p_expected_count IS NULL OR p_expected_count < 0
    OR p_excluded IS NULL OR p_private IS NULL
    OR array_position(p_excluded, NULL) IS NOT NULL
    OR array_position(p_private, NULL) IS NOT NULL
    OR jsonb_typeof(p_source_hashes) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid-rehearsal-scope';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(p_source_hashes)
    WHERE value IS NULL OR value !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'invalid-source-hash';
  END IF;
  v_request := jsonb_build_object('owners', p_owners, 'expected_count', p_expected_count,
    'excluded', p_excluded, 'private', p_private, 'source_hashes', p_source_hashes);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_run::TEXT, 2));
  SELECT request INTO v_existing FROM dictionary_rehearsal.runs WHERE run_id = p_run;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM v_request THEN RAISE EXCEPTION 'plan-intent-mismatch'; END IF;
    RETURN dictionary_rehearsal.plan_sha256(p_run);
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_owners) AS supplied(id) WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE users.id = supplied.id)) THEN
    RAISE EXCEPTION 'unknown-owner';
  END IF;
  IF EXISTS (SELECT 1 FROM (
    SELECT unnest(p_excluded || p_private) AS id UNION
    SELECT key::UUID FROM jsonb_object_keys(p_source_hashes) AS key
  ) supplied WHERE NOT EXISTS (SELECT 1 FROM public.words w
    WHERE w.word_id = supplied.id AND w.user_id = ANY(p_owners))) THEN
    RAISE EXCEPTION 'out-of-scope-evidence';
  END IF;
  INSERT INTO dictionary_rehearsal.runs(run_id, request) VALUES (p_run, v_request);
  -- One statement snapshot covers the complete scoped inventory, including tombstones.
  WITH candidates AS (
    SELECT w.*, private.legacy_word_content(w) AS content,
      dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w)) AS source_hash,
      EXISTS (SELECT 1 FROM public.word_content_state s WHERE s.word_id = w.word_id) AS has_state
    FROM public.words w WHERE w.user_id = ANY(p_owners)
  ), matched AS (
    SELECT c.*, m.exact_ids, m.candidate_count
    FROM candidates c CROSS JOIN LATERAL (
      SELECT array_agg(r.revision_id ORDER BY r.revision_id) FILTER (
        WHERE (r.content - ARRAY['image_url', 'tts_url'])
          = (c.content - ARRAY['image_url', 'tts_url'])) AS exact_ids,
        count(*) AS candidate_count
      FROM dictionary_rehearsal.seeds s
      JOIN public.dictionary_revisions r USING (entry_id, revision_id)
      JOIN public.dictionary_entries e USING (entry_id)
      WHERE e.state = 'published' AND r.review_status = 'published'
        AND e.language_code = 'nl'
        AND lower(btrim(e.lemma)) = lower(btrim(c.dutch_lemma))
        AND e.part_of_speech IS NOT DISTINCT FROM c.part_of_speech
        AND e.article IS NOT DISTINCT FROM c.article
    ) m
  ), classified AS (
    SELECT *, CASE
      WHEN deleted_at IS NOT NULL OR word_id = ANY(p_excluded)
        OR dictionary_entry_id IS NOT NULL THEN 'excluded'
      WHEN word_id = ANY(p_private) OR has_state THEN 'private-only'
      WHEN p_source_hashes ? word_id::TEXT
        AND p_source_hashes->>word_id::TEXT <> source_hash THEN 'stale-source'
      WHEN NOT dictionary_rehearsal.valid_legacy_content(content) THEN 'private-only'
      WHEN cardinality(exact_ids) = 1 THEN 'safe-match'
      WHEN candidate_count > 0 THEN 'possible-match'
      ELSE 'missing-source' END AS disposition
    FROM matched
  ) INSERT INTO dictionary_rehearsal.items(
    run_id, word_id, user_id, source_sha256, disposition, revision_id, overrides
  ) SELECT p_run, c.word_id, c.user_id, c.source_hash, c.disposition,
      CASE WHEN disposition = 'safe-match' THEN exact_ids[1] ELSE NULL END,
      CASE WHEN disposition = 'safe-match' THEN coalesce((
        SELECT jsonb_object_agg(key, jsonb_build_object('op', 'set', 'value', value))
        FROM jsonb_each(c.content) WHERE key IN ('image_url', 'tts_url')
          AND value IS DISTINCT FROM r.content->key), '{}') ELSE '{}' END
    FROM classified c LEFT JOIN public.dictionary_revisions r ON r.revision_id = c.exact_ids[1];
  IF (SELECT count(*) FROM dictionary_rehearsal.items WHERE run_id = p_run) <> p_expected_count THEN
    RAISE EXCEPTION 'scope-count-mismatch';
  END IF;
  RETURN dictionary_rehearsal.plan_sha256(p_run);
END;
$$;

CREATE FUNCTION dictionary_rehearsal.apply_batch(
  p_run UUID, p_reviewed_plan_sha256 TEXT, p_limit INTEGER DEFAULT 50
) RETURNS JSONB LANGUAGE plpgsql SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  i dictionary_rehearsal.items%ROWTYPE;
  w public.words%ROWTYPE;
  r public.dictionary_revisions%ROWTYPE;
  v_outcome TEXT;
  v_applied INTEGER := 0;
  v_rejected INTEGER := 0;
  v_busy INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'invalid-batch-limit'; END IF;
  IF NOT EXISTS (SELECT 1 FROM dictionary_rehearsal.runs WHERE run_id = p_run)
    OR p_reviewed_plan_sha256 IS DISTINCT FROM dictionary_rehearsal.plan_sha256(p_run) THEN
    RAISE EXCEPTION 'reviewed-plan-required';
  END IF;
  -- A linked card needs the legacy guard immediately. No preparation-time apply.
  PERFORM 1 FROM private.dictionary_content_runtime WHERE singleton
    AND operations_enabled AND reads_enabled AND legacy_guard_enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cutover-capabilities-required'; END IF;
  FOR i IN SELECT items.* FROM dictionary_rehearsal.items items
    WHERE run_id = p_run AND disposition = 'safe-match' AND NOT EXISTS (
      SELECT 1 FROM dictionary_rehearsal.ledger l
      WHERE l.run_id = items.run_id AND l.word_id = items.word_id)
    ORDER BY word_id LIMIT p_limit FOR UPDATE OF items SKIP LOCKED
  LOOP
    BEGIN
      v_outcome := 'applied';
      SELECT * INTO w FROM public.words WHERE word_id = i.word_id FOR UPDATE NOWAIT;
      IF NOT FOUND OR dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w))
        IS DISTINCT FROM i.source_sha256 THEN
        v_outcome := 'stale-source';
      ELSE
        SELECT revisions.* INTO r FROM public.dictionary_revisions revisions
          JOIN public.dictionary_entries entries USING (entry_id)
          WHERE revisions.revision_id = i.revision_id
            AND revisions.review_status = 'published' AND entries.state = 'published'
          FOR SHARE OF entries NOWAIT;
        IF NOT FOUND THEN v_outcome := 'source-unavailable'; END IF;
      END IF;
      IF v_outcome = 'applied' THEN
        IF private.apply_dictionary_overrides(r.content, i.overrides)
          IS DISTINCT FROM private.legacy_word_content(w) THEN
          RAISE EXCEPTION 'effective-content-preservation-failed';
        END IF;
        -- Only reference columns change. Nullable legacy fields and all learning
        -- columns retain their exact stored values; there is no content rewrite.
        UPDATE public.words SET dictionary_entry_id = r.entry_id,
          dictionary_revision_id = r.revision_id WHERE word_id = i.word_id;
        INSERT INTO public.word_content_state(word_id, user_id, content_version, overrides)
          VALUES (i.word_id, i.user_id, 1, i.overrides);
      END IF;
      INSERT INTO dictionary_rehearsal.ledger(run_id, word_id, outcome, source_sha256, result_sha256)
        VALUES (p_run, i.word_id, v_outcome, i.source_sha256,
          (SELECT dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(words))
            FROM public.words WHERE word_id = i.word_id));
      -- PL/pgSQL variables survive an exception rollback; count only after the
      -- final receipt write, so a retryable lock never reports a false success.
      IF v_outcome = 'applied' THEN
        v_applied := v_applied + 1;
      ELSE
        v_rejected := v_rejected + 1;
      END IF;
    EXCEPTION WHEN lock_not_available THEN
      -- Retryable: no terminal receipt and all changes in this block rolled back.
      v_busy := v_busy + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('applied', v_applied, 'rejected', v_rejected, 'busy', v_busy,
    'remaining', (SELECT count(*) FROM dictionary_rehearsal.items items
      WHERE run_id = p_run AND disposition = 'safe-match' AND NOT EXISTS (
        SELECT 1 FROM dictionary_rehearsal.ledger l
        WHERE l.run_id = items.run_id AND l.word_id = items.word_id)));
END;
$$;

CREATE FUNCTION dictionary_rehearsal.report(p_run UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_owners UUID[];
BEGIN
  SELECT ARRAY(SELECT jsonb_array_elements_text(request->'owners')::UUID)
    INTO v_owners FROM dictionary_rehearsal.runs WHERE run_id = p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown-run'; END IF;
  RETURN jsonb_build_object(
    'plan_sha256', dictionary_rehearsal.plan_sha256(p_run),
    'total', (SELECT count(*) FROM dictionary_rehearsal.items WHERE run_id = p_run),
    'dispositions', (SELECT coalesce(jsonb_object_agg(disposition, n), '{}') FROM (
      SELECT disposition, count(*) n FROM dictionary_rehearsal.items
        WHERE run_id = p_run GROUP BY disposition) counts),
    'outcomes', (SELECT coalesce(jsonb_object_agg(outcome, n), '{}') FROM (
      SELECT outcome, count(*) n FROM dictionary_rehearsal.ledger
        WHERE run_id = p_run GROUP BY outcome) counts),
    'remaining', (SELECT count(*) FROM dictionary_rehearsal.items i
      WHERE run_id = p_run AND disposition = 'safe-match' AND NOT EXISTS (
        SELECT 1 FROM dictionary_rehearsal.ledger l WHERE l.run_id = i.run_id AND l.word_id = i.word_id)),
    'unplanned_cards', (SELECT count(*) FROM public.words w WHERE user_id = ANY(v_owners)
      AND NOT EXISTS (SELECT 1 FROM dictionary_rehearsal.items i
        WHERE i.run_id = p_run AND i.word_id = w.word_id)),
    'changed_or_missing_cards', (SELECT count(*) FROM dictionary_rehearsal.items i
      LEFT JOIN public.words w USING (word_id)
      LEFT JOIN dictionary_rehearsal.ledger l USING (run_id, word_id)
      WHERE i.run_id = p_run AND (
        w.word_id IS NULL OR dictionary_rehearsal.hash(dictionary_rehearsal.source_snapshot(w))
          IS DISTINCT FROM CASE WHEN l.outcome = 'applied' THEN l.result_sha256 ELSE i.source_sha256 END))
  );
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA dictionary_rehearsal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dictionary_rehearsal FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
