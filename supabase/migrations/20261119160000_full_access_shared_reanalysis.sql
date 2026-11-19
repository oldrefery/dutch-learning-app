-- A release can explicitly admit full-access accounts to reanalysis only.
-- Existing releases retain cohort admission and their original spending limits.
BEGIN;
ALTER TABLE private.dictionary_paid_releases
  ADD COLUMN full_access_analysis_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE FUNCTION private.full_access_analysis_deadline(p_actor UUID, p_release UUID)
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT r.valid_until FROM private.dictionary_paid_releases r
  JOIN public.user_access_levels a ON a.user_id = p_actor AND a.access_level = 'full_access'
  WHERE r.release_id = p_release AND r.full_access_analysis_only AND r.enabled
    AND r.valid_from <= CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP < r.valid_until;
$$;
REVOKE ALL ON FUNCTION private.full_access_analysis_deadline(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION private.dictionary_paid_actor_available(UUID) RENAME TO dictionary_cohort_actor_available;
CREATE FUNCTION private.dictionary_paid_actor_available(p_actor UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT private.dictionary_cohort_actor_available(p_actor) OR EXISTS (
    SELECT 1 FROM private.dictionary_paid_releases r
    WHERE r.enabled AND private.full_access_analysis_deadline(p_actor, r.release_id) IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION private.dictionary_paid_actor_available(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION private.lock_dictionary_paid_actor(UUID,UUID) RENAME TO lock_dictionary_cohort_actor;
CREATE FUNCTION private.lock_dictionary_paid_actor(p_actor UUID, p_release UUID) RETURNS VOID
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
BEGIN
  IF private.full_access_analysis_deadline(p_actor, p_release) IS NOT NULL THEN
    PERFORM 1 FROM public.user_access_levels
      WHERE user_id = p_actor AND access_level = 'full_access' FOR SHARE;
    IF FOUND THEN RETURN; END IF;
  END IF;
  PERFORM private.lock_dictionary_cohort_actor(p_actor, p_release);
END;
$$;
REVOKE ALL ON FUNCTION private.lock_dictionary_paid_actor(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION private.require_dictionary_paid_cohort_current(UUID,UUID) RENAME TO require_dictionary_cohort_deadline;
CREATE FUNCTION private.require_dictionary_paid_cohort_current(p_actor UUID, p_release UUID) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE deadline TIMESTAMPTZ;
BEGIN
  deadline := private.full_access_analysis_deadline(p_actor, p_release);
  IF deadline > CLOCK_TIMESTAMP() THEN RETURN deadline; END IF;
  RETURN private.require_dictionary_cohort_deadline(p_actor, p_release);
END;
$$;
REVOKE ALL ON FUNCTION private.require_dictionary_paid_cohort_current(UUID, UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.guard_dictionary_paid_admission() RETURNS TRIGGER
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE active_release private.dictionary_paid_releases;
BEGIN
  SELECT * INTO active_release FROM private.dictionary_paid_releases WHERE enabled
    AND valid_from <= CLOCK_TIMESTAMP() AND valid_until > CLOCK_TIMESTAMP();
  IF NOT FOUND OR (active_release.full_access_analysis_only AND TG_TABLE_NAME <> 'dictionary_analysis_operations')
    THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  PERFORM private.lock_dictionary_paid_actor(NEW.actor_id, active_release.release_id);
  RETURN NEW;
END;
$$;

-- Old creation operations cannot reserve a new generation or judgement phase
-- against a release that only funds refreshing existing meanings.
CREATE FUNCTION private.guard_analysis_only_paid_attempt() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.dictionary_paid_releases
    WHERE release_id = NEW.release_id AND full_access_analysis_only)
    THEN RAISE EXCEPTION 'dictionary-creation-disabled'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_analysis_only_paid_attempt()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER restrict_analysis_only_paid_attempt
  BEFORE INSERT ON private.dictionary_paid_attempts FOR EACH ROW
  WHEN (NEW.workflow <> 'analysis') EXECUTE FUNCTION private.guard_analysis_only_paid_attempt();
-- Bootstrap a missing sense anchor from the exact previously approved editorial
-- revision. Preserve its reviewer, review time and source. No browser-supplied
-- translations, generated material or learner-owned words are accepted.
CREATE FUNCTION public.prepare_published_analysis_v1(p_entry UUID, p_revision UUID)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor UUID := auth.uid();
  revision public.dictionary_revisions;
  source private.dictionary_sources;
  anchor UUID;
  gloss TEXT;
  examples JSONB;
BEGIN
  IF actor IS NULL OR NOT private.dictionary_paid_actor_available(actor) OR
    NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND reads_enabled
      AND analysis_history_enabled AND semantic_checks_enabled AND analysis_operations_enabled AND analysis_publication_enabled)
    THEN RAISE EXCEPTION 'shared-analysis-unavailable' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = p_entry AND state = 'published' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'head-conflict'; END IF;
  SELECT r.* INTO revision FROM public.dictionary_entry_heads h JOIN public.dictionary_revisions r
    USING (entry_id, revision_id) WHERE h.entry_id = p_entry AND h.revision_id = p_revision AND r.review_status = 'published';
  IF NOT FOUND THEN RETURN 'head-conflict'; END IF;
  IF EXISTS (SELECT 1 FROM private.dictionary_meaning_anchor_heads WHERE entry_id = p_entry) THEN RETURN 'ready'; END IF;
  SELECT s.* INTO source FROM private.dictionary_sources s JOIN auth.users u ON u.id = s.reviewed_by
    WHERE s.source_id = revision.source_id AND s.source_kind = 'editorial' AND s.review_state = 'approved'
    AND s.approved_content_sha256 = revision.content_sha256;
  IF NOT FOUND THEN RETURN 'review-required'; END IF;
  SELECT string_agg(t, ', ' ORDER BY n) INTO gloss FROM jsonb_array_elements_text(revision.content#>'{translations,en}')
    WITH ORDINALITY AS translations(t, n) WHERE btrim(t) <> '';
  SELECT jsonb_agg(t->>'nl' ORDER BY n) INTO examples FROM jsonb_array_elements(revision.content->'examples')
    WITH ORDINALITY AS items(t, n) WHERE length(btrim(t->>'nl')) BETWEEN 1 AND 4000 AND n <= 20;
  IF gloss IS NULL OR length(gloss) > 4000 OR examples IS NULL THEN RETURN 'review-required'; END IF;
  INSERT INTO private.dictionary_meaning_anchors(entry_id, source_id, gloss, examples, verified_by, verified_at, audit_reference)
    VALUES (p_entry, source.source_id, gloss, examples, source.reviewed_by, source.reviewed_at,
      'published-editorial-revision:' || p_revision::text) RETURNING anchor_id INTO anchor;
  INSERT INTO private.dictionary_meaning_anchor_heads(entry_id, anchor_id) VALUES (p_entry, anchor);
  RETURN 'ready';
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_published_analysis_v1(UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_published_analysis_v1(UUID, UUID) TO authenticated;
COMMIT;
