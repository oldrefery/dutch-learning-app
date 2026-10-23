-- D13A.6 administrator-only local planning. Never installed by deploy migrations.
-- Requires D06 rehearsal.sql helpers; its historical pinned protocol stays intact.
BEGIN;
CREATE SCHEMA dictionary_following_rehearsal;
REVOKE ALL ON SCHEMA dictionary_following_rehearsal FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dictionary_following_rehearsal REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION dictionary_following_rehearsal.content(p_word public.words) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.resolve_word_effective_content(p_word, states, revisions)
  FROM (SELECT 1) dummy
  LEFT JOIN public.word_content_state states ON states.word_id = p_word.word_id
  LEFT JOIN public.dictionary_revisions revisions ON revisions.entry_id = p_word.dictionary_entry_id
    AND revisions.revision_id = p_word.dictionary_revision_id;
$$;

-- All fields, including media and nullable legacy values, participate in the diff.
CREATE FUNCTION dictionary_following_rehearsal.content_diff(p_before JSONB, p_after JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(key, jsonb_build_object(
    'before', p_before->key, 'after', p_after->key)), '{}')
  FROM (SELECT jsonb_object_keys(p_before) AS key UNION SELECT jsonb_object_keys(p_after)) keys
  WHERE p_before->key IS DISTINCT FROM p_after->key;
$$;

CREATE FUNCTION dictionary_following_rehearsal.head_sequence(p_entry UUID) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT max(changes.committed_version)::TEXT FROM private.dictionary_content_changes changes
  JOIN public.dictionary_entry_heads heads ON heads.entry_id = changes.entry_id
    AND heads.revision_id = changes.revision_id
  WHERE changes.entry_id = p_entry AND changes.change_kind = 'revision-head';
$$;

CREATE TABLE dictionary_following_rehearsal.runs (
  run_id UUID PRIMARY KEY,
  request JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE dictionary_following_rehearsal.items (
  run_id UUID NOT NULL REFERENCES dictionary_following_rehearsal.runs,
  word_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition IN (
    'exact-link', 'approved-diff-link', 'ambiguous', 'missing', 'private-review', 'stale', 'excluded')),
  reason TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  original_snapshot JSONB NOT NULL,
  original_content JSONB NOT NULL,
  original_content_sha256 TEXT NOT NULL,
  decision JSONB,
  decision_sha256 TEXT,
  target_entry_id UUID,
  target_revision_id UUID,
  target_head_sequence TEXT,
  target_content_sha256 TEXT,
  approved_diff JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (run_id, word_id)
);
-- No personal-word FK: later deletion cannot erase or be blocked by protected evidence.
CREATE TRIGGER immutable_runs BEFORE UPDATE OR DELETE ON dictionary_following_rehearsal.runs
  FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.immutable();
CREATE TRIGGER immutable_items BEFORE UPDATE OR DELETE ON dictionary_following_rehearsal.items
  FOR EACH ROW EXECUTE FUNCTION dictionary_rehearsal.immutable();
CREATE TRIGGER immutable_runs_truncate BEFORE TRUNCATE ON dictionary_following_rehearsal.runs
  FOR EACH STATEMENT EXECUTE FUNCTION dictionary_rehearsal.immutable();
CREATE TRIGGER immutable_items_truncate BEFORE TRUNCATE ON dictionary_following_rehearsal.items
  FOR EACH STATEMENT EXECUTE FUNCTION dictionary_rehearsal.immutable();

CREATE FUNCTION dictionary_following_rehearsal.valid_decision(p_decision JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  RETURN private.jsonb_has_exact_keys(p_decision, ARRAY[
    'owner_id', 'source_sha256', 'source_content_sha256', 'target_entry_id',
    'target_revision_id', 'target_head_sequence', 'target_content_sha256',
    'disposition', 'meaning_review', 'approved_diff'])
    AND p_decision->>'disposition' IN ('exact-link', 'approved-diff-link')
    AND jsonb_typeof(p_decision->'approved_diff') = 'object'
    AND p_decision->>'source_sha256' ~ '^[0-9a-f]{64}$'
    AND p_decision->>'source_content_sha256' ~ '^[0-9a-f]{64}$'
    AND p_decision->>'target_content_sha256' ~ '^[0-9a-f]{64}$'
    AND jsonb_typeof(p_decision->'target_head_sequence') = 'string'
    AND p_decision->>'target_head_sequence' ~ '^[1-9][0-9]*$'
    AND (p_decision->>'target_head_sequence')::NUMERIC <= 9223372036854775807
    AND (p_decision->>'owner_id')::UUID IS NOT NULL
    AND (p_decision->>'target_entry_id')::UUID IS NOT NULL
    AND (p_decision->>'target_revision_id')::UUID IS NOT NULL
    AND private.jsonb_has_exact_keys(p_decision->'meaning_review', ARRAY[
      'review_id', 'reviewer_id', 'reviewed_at', 'evidence_sha256'])
    AND (p_decision->'meaning_review'->>'review_id')::UUID IS NOT NULL
    AND (p_decision->'meaning_review'->>'reviewer_id')::UUID IS NOT NULL
    AND (p_decision->'meaning_review'->>'reviewed_at')::TIMESTAMPTZ IS NOT NULL
    AND p_decision->'meaning_review'->>'evidence_sha256' ~ '^[0-9a-f]{64}$';
EXCEPTION WHEN data_exception THEN
  RETURN FALSE;
END;
$$;

CREATE FUNCTION dictionary_following_rehearsal.plan_sha256(p_run UUID) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT dictionary_rehearsal.canonical_sha256(jsonb_build_object(
    'request', (SELECT request FROM dictionary_following_rehearsal.runs WHERE run_id = p_run),
    'items', (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY word_id), '[]')
      FROM dictionary_following_rehearsal.items i WHERE run_id = p_run)));
$$;

CREATE FUNCTION dictionary_following_rehearsal.plan(
  p_run UUID, p_owners UUID[], p_expected_count INTEGER,
  p_inventory_sha256 TEXT, p_decisions JSONB DEFAULT '{}'
) RETURNS TEXT LANGUAGE plpgsql SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_request JSONB;
  v_existing JSONB;
  original RECORD;
  decision JSONB;
  revision public.dictionary_revisions%ROWTYPE;
  v_disposition TEXT;
  v_reason TEXT;
  v_diff JSONB;
  v_sequence TEXT;
  v_content_hash TEXT;
BEGIN
  IF p_run IS NULL OR p_owners IS NULL OR cardinality(p_owners) = 0
    OR array_position(p_owners, NULL) IS NOT NULL
    OR p_expected_count IS NULL OR p_expected_count < 0
    OR p_inventory_sha256 IS NULL OR p_inventory_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_decisions) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid-following-plan-scope';
  END IF;
  v_request := jsonb_build_object('protocol_version', 2, 'owners', p_owners,
    'expected_count', p_expected_count, 'inventory_sha256', p_inventory_sha256,
    'decisions', p_decisions);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_run::TEXT, 26));
  SELECT request INTO v_existing FROM dictionary_following_rehearsal.runs WHERE run_id = p_run;
  IF FOUND THEN
    IF v_existing IS DISTINCT FROM v_request THEN RAISE EXCEPTION 'plan-intent-mismatch'; END IF;
    RETURN dictionary_following_rehearsal.plan_sha256(p_run);
  END IF;
  -- Durable exact-intent retries return the original packet even after a source
  -- row is deleted. Fresh source/owner checks apply only to a new plan.
  IF EXISTS (SELECT 1 FROM unnest(p_owners) supplied(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = supplied.id)) THEN
    RAISE EXCEPTION 'unknown-owner';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(p_decisions) supplied
    WHERE dictionary_following_rehearsal.valid_decision(supplied.value) IS NOT TRUE
      OR NOT EXISTS (SELECT 1 FROM public.words w
        WHERE w.word_id::TEXT = supplied.key AND w.user_id = ANY(p_owners))) THEN
    RAISE EXCEPTION 'invalid-or-out-of-scope-meaning-decision';
  END IF;
  INSERT INTO dictionary_following_rehearsal.runs VALUES (p_run, v_request, clock_timestamp());
  -- STABLE helpers execute against this single inventory-query snapshot. Learning
  -- is omitted from the fingerprint and never supplied as migration write data.
  FOR original IN SELECT w.word_id, w.user_id, w.deleted_at, w.dictionary_content_mode,
    dictionary_rehearsal.source_snapshot(w) AS snapshot,
    dictionary_following_rehearsal.content(w) AS content
    FROM public.words w WHERE w.user_id = ANY(p_owners) ORDER BY w.word_id
  LOOP
    decision := p_decisions->original.word_id::TEXT;
    v_diff := '{}'; v_sequence := NULL; v_content_hash := NULL;
    revision := NULL;
    v_disposition := 'ambiguous'; v_reason := 'reviewed-meaning-required';
    IF original.deleted_at IS NOT NULL OR original.dictionary_content_mode = 'follow' THEN
      v_disposition := 'excluded'; v_reason := 'tombstone-or-existing-following-reference';
    ELSIF dictionary_rehearsal.valid_legacy_content(original.content) IS NOT TRUE THEN
      v_disposition := 'private-review'; v_reason := 'malformed-legacy-content';
    ELSIF decision IS NULL THEN
      IF original.snapshot->'state'->'fallback_content' <> 'null'::JSONB
        OR coalesce(original.snapshot->'state'->'overrides', '{}') <> '{}'::JSONB THEN
        v_disposition := 'private-review'; v_reason := 'protected-private-content';
      ELSIF NOT EXISTS (SELECT 1 FROM public.dictionary_entries e
        WHERE e.state = 'published' AND e.language_code = 'nl'
          AND lower(btrim(e.lemma)) = lower(btrim(original.content->>'dutch_lemma'))
          AND e.part_of_speech IS NOT DISTINCT FROM original.content->>'part_of_speech'
          AND e.article IS NOT DISTINCT FROM original.content->>'article') THEN
        v_disposition := 'missing'; v_reason := 'no-published-candidate';
      END IF;
    ELSE
      IF decision->>'owner_id' IS DISTINCT FROM original.user_id::TEXT THEN
        RAISE EXCEPTION 'meaning-decision-owner-mismatch';
      END IF;
      IF decision->>'source_sha256' IS DISTINCT FROM dictionary_rehearsal.hash(original.snapshot)
        OR decision->>'source_content_sha256' IS DISTINCT FROM dictionary_rehearsal.canonical_sha256(original.content) THEN
        v_disposition := 'stale'; v_reason := 'personal-content-changed';
      ELSE
        SELECT r.* INTO revision FROM public.dictionary_entry_heads h
          JOIN public.dictionary_entries e USING (entry_id)
          JOIN public.dictionary_revisions r ON r.entry_id = h.entry_id AND r.revision_id = h.revision_id
          JOIN private.dictionary_sources s USING (source_id)
          WHERE h.entry_id = (decision->>'target_entry_id')::UUID
            AND h.revision_id = (decision->>'target_revision_id')::UUID
            AND e.language_code = 'nl' AND e.state = 'published'
            AND r.review_status = 'published' AND s.review_state = 'approved'
          FOR SHARE OF h, e, r, s NOWAIT;
        v_sequence := dictionary_following_rehearsal.head_sequence((decision->>'target_entry_id')::UUID);
        IF revision.revision_id IS NULL
          OR v_sequence IS DISTINCT FROM decision->>'target_head_sequence' THEN
          v_disposition := 'stale'; v_reason := 'published-head-changed-or-unavailable';
        ELSE
          v_content_hash := dictionary_rehearsal.canonical_sha256(revision.content);
          IF v_content_hash IS DISTINCT FROM decision->>'target_content_sha256'
            OR v_content_hash IS DISTINCT FROM revision.content_sha256 THEN
            v_disposition := 'stale'; v_reason := 'target-content-hash-mismatch';
          ELSE
            v_diff := dictionary_following_rehearsal.content_diff(original.content, revision.content);
            IF v_diff IS DISTINCT FROM decision->'approved_diff'
              OR (decision->>'disposition' = 'exact-link' AND v_diff <> '{}')
              OR (decision->>'disposition' = 'approved-diff-link' AND v_diff = '{}') THEN
              RAISE EXCEPTION 'exact-approved-full-content-diff-required';
            END IF;
            v_disposition := decision->>'disposition'; v_reason := 'operator-attested-meaning-and-diff';
          END IF;
        END IF;
      END IF;
    END IF;
    INSERT INTO dictionary_following_rehearsal.items VALUES (
      p_run, original.word_id, original.user_id, v_disposition, v_reason,
      dictionary_rehearsal.hash(original.snapshot), original.snapshot, original.content,
      dictionary_rehearsal.canonical_sha256(original.content), decision,
      CASE WHEN decision IS NOT NULL THEN dictionary_rehearsal.canonical_sha256(decision) END,
      revision.entry_id, revision.revision_id, v_sequence, v_content_hash, v_diff);
  END LOOP;
  IF (SELECT count(*) FROM dictionary_following_rehearsal.items WHERE run_id = p_run) <> p_expected_count THEN
    RAISE EXCEPTION 'scope-count-mismatch';
  END IF;
  RETURN dictionary_following_rehearsal.plan_sha256(p_run);
END;
$$;

CREATE FUNCTION dictionary_following_rehearsal.report(p_run UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dictionary_following_rehearsal.runs WHERE run_id = p_run) THEN
    RAISE EXCEPTION 'unknown-run';
  END IF;
  RETURN jsonb_build_object('protocol_version', 2,
    'plan_sha256', dictionary_following_rehearsal.plan_sha256(p_run),
    'total', (SELECT count(*) FROM dictionary_following_rehearsal.items WHERE run_id = p_run),
    'dispositions', (SELECT coalesce(jsonb_object_agg(disposition, n), '{}') FROM (
      SELECT disposition, count(*) n FROM dictionary_following_rehearsal.items
        WHERE run_id = p_run GROUP BY disposition) counts),
    'eligible_links', (SELECT count(*) FROM dictionary_following_rehearsal.items
      WHERE run_id = p_run AND disposition IN ('exact-link', 'approved-diff-link')),
    'applied', 0);
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA dictionary_following_rehearsal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dictionary_following_rehearsal FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
