-- Add dormant following references and versioned reads. No card is converted,
-- published or analyzed; existing deployed migrations remain immutable.
BEGIN;

ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN following_reads_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.words
  ADD COLUMN dictionary_content_mode TEXT NOT NULL DEFAULT 'legacy',
  ADD CONSTRAINT words_dictionary_content_mode
    CHECK (dictionary_content_mode IN ('legacy', 'follow')),
  ADD CONSTRAINT words_following_reference
    CHECK (dictionary_content_mode <> 'follow' OR dictionary_entry_id IS NOT NULL);

GRANT UPDATE (dictionary_content_mode) ON public.words TO service_role;
CREATE INDEX dictionary_revision_head_sequence_idx
  ON private.dictionary_content_changes(entry_id, committed_version DESC)
  WHERE change_kind = 'revision-head';

CREATE FUNCTION private.protect_following_reference()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF (TG_OP = 'INSERT' AND NEW.dictionary_content_mode <> 'legacy')
      OR (TG_OP = 'UPDATE' AND NEW.dictionary_content_mode IS DISTINCT FROM OLD.dictionary_content_mode) THEN
      RAISE EXCEPTION 'Dictionary modes can only be changed by trusted commands'
        USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.dictionary_content_mode = 'follow'
      AND ROW(NEW.dutch_lemma, NEW.dutch_original, NEW.part_of_speech, NEW.article, NEW.translations, NEW.examples, NEW.is_irregular, NEW.is_reflexive, NEW.is_expression, NEW.expression_type, NEW.is_separable, NEW.prefix_part, NEW.root_verb, NEW.plural, NEW.register, NEW.synonyms, NEW.antonyms, NEW.conjugation, NEW.preposition, NEW.analysis_notes, NEW.usage_notes, NEW.image_url, NEW.tts_url) IS DISTINCT FROM ROW(OLD.dutch_lemma, OLD.dutch_original, OLD.part_of_speech, OLD.article, OLD.translations, OLD.examples, OLD.is_irregular, OLD.is_reflexive, OLD.is_expression, OLD.expression_type, OLD.is_separable, OLD.prefix_part, OLD.root_verb, OLD.plural, OLD.register, OLD.synonyms, OLD.antonyms, OLD.conjugation, OLD.preposition, OLD.analysis_notes, OLD.usage_notes, OLD.image_url, OLD.tts_url) THEN
      RAISE EXCEPTION 'legacy-content-upgrade-required';
    END IF;
  END IF;
  IF NEW.dictionary_content_mode = 'follow' AND
    (TG_OP = 'INSERT' OR OLD.dictionary_content_mode IS DISTINCT FROM 'follow') THEN
    IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime
      WHERE singleton AND reads_enabled AND following_reads_enabled) THEN
      RAISE EXCEPTION 'following-content-disabled';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dictionary_entry_heads AS heads
      JOIN public.dictionary_entries AS entries USING (entry_id)
      JOIN private.dictionary_content_changes AS changes
        ON changes.entry_id = heads.entry_id AND changes.revision_id = heads.revision_id
        AND changes.change_kind = 'revision-head'
      WHERE heads.entry_id = NEW.dictionary_entry_id AND entries.state = 'published') THEN
      RAISE EXCEPTION 'missing-dictionary-head';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- This invoker trigger retains the caller identity for direct-write rejection
-- without granting callers access to any additional private helper.
REVOKE ALL ON FUNCTION private.protect_following_reference() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_following_reference
  BEFORE INSERT OR UPDATE ON public.words FOR EACH ROW
  EXECUTE FUNCTION private.protect_following_reference();

CREATE FUNCTION private.validate_following_content_layout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.words AS words
    JOIN public.word_content_state AS states USING (word_id)
    WHERE words.word_id = NEW.word_id AND words.dictionary_content_mode = 'follow'
      AND (states.fallback_content IS NOT NULL OR states.overrides <> '{}'::JSONB)) THEN
    RAISE EXCEPTION 'following-content-cannot-have-overrides';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_following_content_layout() FROM PUBLIC, anon, authenticated;
CREATE CONSTRAINT TRIGGER validate_following_content_state
  AFTER INSERT OR UPDATE ON public.word_content_state
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.validate_following_content_layout();
CREATE CONSTRAINT TRIGGER validate_following_word_layout
  AFTER INSERT OR UPDATE ON public.words
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.validate_following_content_layout();

CREATE FUNCTION private.require_following_dependencies(p_user_id UUID, p_word_ids UUID[])
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.words AS words
    WHERE words.user_id = p_user_id AND words.deleted_at IS NULL
      AND words.dictionary_content_mode = 'follow'
      AND (p_word_ids IS NULL OR words.word_id = ANY(p_word_ids))) THEN
    IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime
      WHERE singleton AND following_reads_enabled) THEN
      RAISE EXCEPTION 'following-content-disabled';
    END IF;
    IF EXISTS (SELECT 1 FROM public.words AS words
      LEFT JOIN public.dictionary_entry_heads AS heads
        ON heads.entry_id = words.dictionary_entry_id
      LEFT JOIN public.dictionary_revisions AS revisions
        ON revisions.entry_id = heads.entry_id AND revisions.revision_id = heads.revision_id
      WHERE words.user_id = p_user_id AND words.deleted_at IS NULL
        AND words.dictionary_content_mode = 'follow'
        AND (p_word_ids IS NULL OR words.word_id = ANY(p_word_ids))
        AND (revisions.review_status IS DISTINCT FROM 'published'
          OR NOT EXISTS (SELECT 1 FROM private.dictionary_content_changes AS changes
            WHERE changes.entry_id = heads.entry_id AND changes.revision_id = heads.revision_id
              AND changes.change_kind = 'revision-head'))) THEN
      RAISE EXCEPTION 'missing-dictionary-head';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.require_following_dependencies(UUID, UUID[]) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.dictionary_content_capability_v2()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT JSONB_BUILD_OBJECT(
    'dictionary_content_protocol', 2,
    'read_protocol_versions', CASE WHEN reads_enabled AND following_reads_enabled
      THEN '[1,2]'::JSONB WHEN reads_enabled THEN '[1]'::JSONB ELSE '[]'::JSONB END,
    'command_protocol_versions', CASE WHEN operations_enabled THEN '[1]'::JSONB ELSE '[]'::JSONB END,
    'following_enabled', reads_enabled AND following_reads_enabled,
    'shared_analysis_enabled', FALSE
  ) FROM private.dictionary_content_runtime WHERE singleton;
$$;

CREATE FUNCTION public.get_dictionary_effective_content_v2(p_word_ids UUID[] DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cards JSONB;
  v_revisions JSONB;
  v_watermark BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime
    WHERE singleton AND reads_enabled AND following_reads_enabled) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  IF p_word_ids IS NOT NULL AND CARDINALITY(p_word_ids) > 1000 THEN
    RAISE EXCEPTION 'too-many-word-ids';
  END IF;
  -- NULL supports the existing owner-only full review snapshot, with an explicit
  -- bound. Larger libraries use bounded ID batches instead of an unbounded RPC.
  IF p_word_ids IS NULL AND (SELECT COUNT(*) FROM public.words
    WHERE user_id = v_user_id AND deleted_at IS NULL) > 10000 THEN
    RAISE EXCEPTION 'too-many-word-ids';
  END IF;
  PERFORM private.require_following_dependencies(v_user_id, p_word_ids);
  SELECT committed_version INTO STRICT v_watermark
    FROM private.dictionary_delivery_cursor WHERE singleton;

  WITH owned_words AS (
    SELECT words.* FROM public.words AS words
    WHERE words.user_id = v_user_id AND words.deleted_at IS NULL
      AND (p_word_ids IS NULL OR words.word_id = ANY(p_word_ids))
  ), resolved AS (
    SELECT words.*, COALESCE(states.content_version, 0) AS content_version,
      states.fallback_content, COALESCE(states.overrides, '{}'::JSONB) AS overrides,
      revisions.revision_id AS applied_revision_id,
      private.resolve_word_effective_content(words, states, revisions) AS legacy_content,
      (SELECT MAX(changes.committed_version) FROM private.dictionary_content_changes AS changes
        WHERE changes.entry_id = heads.entry_id AND changes.change_kind = 'revision-head') AS head_sequence,
      assessments.cefr_level, assessments.status AS cefr_status, assessments.confidence AS cefr_confidence
    FROM owned_words AS words
    LEFT JOIN public.word_content_state AS states ON states.word_id = words.word_id
    LEFT JOIN public.dictionary_entry_heads AS heads ON heads.entry_id = words.dictionary_entry_id
    LEFT JOIN public.dictionary_revisions AS revisions
      ON revisions.entry_id = words.dictionary_entry_id
      AND revisions.revision_id = CASE WHEN words.dictionary_content_mode = 'follow'
        THEN heads.revision_id ELSE words.dictionary_revision_id END
    LEFT JOIN public.dictionary_cefr_heads AS cefr_heads
      ON cefr_heads.entry_id = revisions.entry_id AND cefr_heads.input_sha256 = revisions.cefr_input_sha256
    LEFT JOIN public.dictionary_cefr_assessments AS assessments
      ON assessments.entry_id = cefr_heads.entry_id
      AND assessments.input_sha256 = cefr_heads.input_sha256
      AND assessments.assessment_id = cefr_heads.assessment_id
  )
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'word_id', word_id, 'mode', dictionary_content_mode,
    'content_version', content_version::TEXT,
    'reference', CASE WHEN dictionary_entry_id IS NULL THEN NULL ELSE
      JSONB_BUILD_OBJECT('entry_id', dictionary_entry_id, 'revision_id', applied_revision_id) END,
    'adopted_revision_id', dictionary_revision_id,
    'head_sequence', CASE WHEN dictionary_content_mode = 'follow' THEN head_sequence::TEXT ELSE NULL END,
    'legacy_content', CASE WHEN dictionary_content_mode = 'legacy' THEN legacy_content ELSE NULL END,
    'removed_fields', COALESCE((SELECT JSONB_AGG(key ORDER BY key) FROM JSONB_EACH(overrides)
      WHERE value->>'op' = 'remove'), '[]'::JSONB),
    'cefr', CASE WHEN dictionary_entry_id IS NULL OR EXISTS (
      SELECT 1 FROM JSONB_OBJECT_KEYS(overrides) AS key WHERE key NOT IN ('image_url', 'tts_url'))
      THEN JSONB_BUILD_OBJECT('level', NULL, 'status', 'unknown', 'confidence', NULL)
      ELSE JSONB_BUILD_OBJECT('level', cefr_level, 'status', COALESCE(cefr_status, 'unknown'), 'confidence', cefr_confidence) END
  ) ORDER BY word_id), '[]'::JSONB) INTO v_cards FROM resolved;

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'revision_id', revisions.revision_id, 'entry_id', revisions.entry_id,
    'revision_no', revisions.revision_no, 'schema_version', revisions.schema_version,
    'content', revisions.content, 'content_sha256', revisions.content_sha256,
    'cefr_input_sha256', revisions.cefr_input_sha256, 'review_status', revisions.review_status
  ) ORDER BY revisions.revision_id), '[]'::JSONB) INTO v_revisions
  FROM public.dictionary_revisions AS revisions
  WHERE revisions.revision_id IN (SELECT (value#>>'{reference,revision_id}')::UUID
    FROM JSONB_ARRAY_ELEMENTS(v_cards) WHERE value->'reference' <> 'null'::JSONB);

  RETURN JSONB_BUILD_OBJECT('protocol_version', 2, 'watermark', v_watermark::TEXT,
    'cards', v_cards, 'revisions', v_revisions);
END;
$$;

CREATE FUNCTION public.get_web_review_snapshot_v3()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_legacy JSONB; v_content JSONB;
BEGIN
  v_legacy := public.get_web_review_snapshot_v1();
  v_content := public.get_dictionary_effective_content_v2(NULL);
  RETURN (v_legacy - 'protocolVersion') || JSONB_BUILD_OBJECT(
    'protocolVersion', 3, 'dictionaryContentProtocol', 2, 'dictionaryContent', v_content);
END;
$$;

-- Reuse the original commit-order pager internally. Numeric JSON is converted
-- to decimal strings inside PostgreSQL, before any JavaScript deserialization.
ALTER FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) SET SCHEMA private;
ALTER FUNCTION private.get_dictionary_content_changes_v1(BIGINT, INTEGER) RENAME TO dictionary_content_change_page;
REVOKE ALL ON FUNCTION private.dictionary_content_change_page(BIGINT, INTEGER) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_dictionary_content_changes_v1(p_after BIGINT DEFAULT 0, p_limit INTEGER DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result JSONB;
BEGIN
  v_result := private.dictionary_content_change_page(p_after, p_limit);
  IF p_after IS NULL OR p_limit IS NULL OR p_after > (v_result->>'latest_cursor')::BIGINT THEN
    RAISE EXCEPTION 'invalid-change-page';
  END IF;
  IF p_after > 9007199254740991 OR (v_result->>'latest_cursor')::BIGINT > 9007199254740991 THEN
    RAISE EXCEPTION 'unsafe-protocol-1-sequence';
  END IF;
  RETURN v_result;
END;
$$;

CREATE FUNCTION public.get_dictionary_content_changes_v2(p_after TEXT DEFAULT '0', p_limit INTEGER DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_after BIGINT; v_result JSONB; v_changes JSONB;
BEGIN
  IF p_after IS NULL OR p_after !~ '^(0|[1-9][0-9]{0,18})$'
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid-change-page';
  END IF;
  BEGIN v_after := p_after::BIGINT;
  EXCEPTION WHEN numeric_value_out_of_range THEN RAISE EXCEPTION 'invalid-change-page'; END;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime
    WHERE singleton AND reads_enabled AND following_reads_enabled) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  v_result := private.dictionary_content_change_page(v_after, p_limit);
  IF v_after > (v_result->>'latest_cursor')::BIGINT THEN
    RAISE EXCEPTION 'invalid-change-page';
  END IF;
  SELECT COALESCE(JSONB_AGG(value || JSONB_BUILD_OBJECT('cursor', value->>'cursor')
    ORDER BY (value->>'cursor')::BIGINT), '[]'::JSONB) INTO v_changes
    FROM JSONB_ARRAY_ELEMENTS(v_result->'changes');
  RETURN v_result || JSONB_BUILD_OBJECT('protocol_version', 2,
    'after', p_after, 'next_cursor', v_result->>'next_cursor',
    'latest_cursor', v_result->>'latest_cursor', 'changes', v_changes);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dictionary_effective_content_v1(
  p_word_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cards JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.dictionary_content_runtime
    WHERE singleton AND reads_enabled
  ) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  IF p_word_ids IS NOT NULL AND CARDINALITY(p_word_ids) > 1000 THEN
    RAISE EXCEPTION 'too-many-word-ids';
  END IF;

  IF EXISTS (SELECT 1 FROM public.words AS words
    JOIN public.word_content_state AS states USING (word_id)
    WHERE words.user_id = v_user_id AND words.deleted_at IS NULL
      AND (p_word_ids IS NULL OR words.word_id = ANY(p_word_ids))
      AND states.content_version > 9007199254740991) THEN
    RAISE EXCEPTION 'unsafe-protocol-1-sequence';
  END IF;
  PERFORM private.require_following_dependencies(v_user_id, p_word_ids);

  WITH owned_words AS (
    SELECT words.*
    FROM public.words
    WHERE words.user_id = v_user_id
      AND words.deleted_at IS NULL
      AND (p_word_ids IS NULL OR words.word_id = ANY(p_word_ids))
  ), resolved AS (
    SELECT
      words.word_id,
      words.dictionary_entry_id,
      revisions.revision_id AS dictionary_revision_id,
      COALESCE(states.content_version, 0) AS content_version,
      COALESCE(states.overrides, '{}'::JSONB) AS overrides,
      CASE WHEN words.dictionary_content_mode = 'follow' THEN revisions.content
        ELSE private.resolve_word_effective_content(words, states, revisions) END AS content,
      CASE WHEN words.dictionary_entry_id IS NULL THEN 'fallback' ELSE 'pinned' END AS source,
      revisions.cefr_input_sha256,
      assessments.cefr_level,
      assessments.status AS cefr_status,
      assessments.confidence AS cefr_confidence
    FROM owned_words AS words
    LEFT JOIN public.word_content_state AS states ON states.word_id = words.word_id
    LEFT JOIN public.dictionary_entry_heads AS heads
      ON heads.entry_id = words.dictionary_entry_id
    LEFT JOIN public.dictionary_revisions AS revisions
      ON revisions.entry_id = words.dictionary_entry_id
      AND revisions.revision_id = CASE WHEN words.dictionary_content_mode = 'follow'
        THEN heads.revision_id ELSE words.dictionary_revision_id END
    LEFT JOIN public.dictionary_cefr_heads AS cefr_heads
      ON cefr_heads.entry_id = revisions.entry_id
      AND cefr_heads.input_sha256 = revisions.cefr_input_sha256
    LEFT JOIN public.dictionary_cefr_assessments AS assessments
      ON assessments.entry_id = cefr_heads.entry_id
      AND assessments.input_sha256 = cefr_heads.input_sha256
      AND assessments.assessment_id = cefr_heads.assessment_id
  )
  SELECT COALESCE(JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'word_id', word_id,
      'content_version', content_version,
      'reference', CASE WHEN dictionary_entry_id IS NULL THEN NULL ELSE
        JSONB_BUILD_OBJECT(
          'entry_id', dictionary_entry_id,
          'revision_id', dictionary_revision_id
        ) END,
      'source', source,
      'content', content,
      'removed_fields', COALESCE((
        SELECT JSONB_AGG(key ORDER BY key)
        FROM JSONB_EACH(overrides)
        WHERE value->>'op' = 'remove'
      ), '[]'::JSONB),
      'cefr', CASE
        WHEN dictionary_entry_id IS NULL
          OR EXISTS (
            SELECT 1 FROM JSONB_OBJECT_KEYS(overrides) AS key
            WHERE key NOT IN ('image_url', 'tts_url')
          )
        THEN JSONB_BUILD_OBJECT('level', NULL, 'status', 'unknown', 'confidence', NULL)
        ELSE JSONB_BUILD_OBJECT(
          'level', cefr_level,
          'status', COALESCE(cefr_status, 'unknown'),
          'confidence', cefr_confidence
        )
      END
    ) ORDER BY word_id
  ), '[]'::JSONB) INTO v_cards
  FROM resolved;

  RETURN JSONB_BUILD_OBJECT('protocol_version', 1, 'cards', v_cards);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dictionary_content_command_v1(p_command JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_operation_id UUID;
  v_word_id UUID;
  v_expected_version BIGINT;
  v_kind TEXT;
  v_request_sha256 TEXT;
  v_receipt private.word_content_receipts%ROWTYPE;
  v_word public.words%ROWTYPE;
  v_state public.word_content_state%ROWTYPE;
  v_revision public.dictionary_revisions%ROWTYPE;
  v_overrides JSONB := '{}'::JSONB;
  v_content JSONB;
  v_new_version BIGINT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.dictionary_content_runtime
    WHERE singleton AND operations_enabled
  ) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;
  IF JSONB_TYPEOF(p_command) <> 'object'
     OR p_command->'protocol_version' <> '1'::JSONB
     OR p_command->>'kind' NOT IN (
       'create-private', 'edit-private', 'link', 'adopt-revision',
       'detach', 'resolve-conflict'
     ) THEN
    RAISE EXCEPTION 'unsupported-protocol';
  END IF;

  v_kind := p_command->>'kind';
  IF JSONB_TYPEOF(p_command->'operation_id') <> 'string'
     OR JSONB_TYPEOF(p_command->'word_id') <> 'string'
     OR JSONB_TYPEOF(p_command->'expected_content_version') <> 'number' THEN
    RAISE EXCEPTION 'invalid-content-command';
  END IF;
  IF (
    v_kind IN ('create-private', 'detach', 'resolve-conflict')
    AND NOT private.jsonb_has_exact_keys(
      p_command,
      ARRAY[
        'protocol_version', 'operation_id', 'word_id',
        'expected_content_version', 'kind', 'content'
      ]
    )
  ) OR (
    v_kind = 'edit-private'
    AND NOT private.jsonb_has_exact_keys(
      p_command,
      ARRAY[
        'protocol_version', 'operation_id', 'word_id',
        'expected_content_version', 'kind', 'overrides'
      ]
    )
  ) OR (
    v_kind IN ('link', 'adopt-revision')
    AND (
      NOT private.jsonb_has_exact_keys(
        p_command,
        ARRAY[
          'protocol_version', 'operation_id', 'word_id',
          'expected_content_version', 'kind', 'reference', 'overrides'
        ]
      )
      OR NOT private.jsonb_has_exact_keys(
        p_command->'reference', ARRAY['entry_id', 'revision_id']
      )
      OR JSONB_TYPEOF(p_command#>'{reference,entry_id}') <> 'string'
      OR JSONB_TYPEOF(p_command#>'{reference,revision_id}') <> 'string'
    )
  ) THEN
    RAISE EXCEPTION 'invalid-content-command';
  END IF;

  BEGIN
    v_operation_id := (p_command->>'operation_id')::UUID;
    v_word_id := (p_command->>'word_id')::UUID;
    v_expected_version := (p_command->>'expected_content_version')::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid-content-command';
  END;
  IF v_expected_version < 0 THEN
    RAISE EXCEPTION 'invalid-content-command';
  END IF;
  v_request_sha256 := ENCODE(
    extensions.digest(CONVERT_TO(p_command::TEXT, 'UTF8'), 'sha256'),
    'hex'
  );

  PERFORM PG_CATALOG.PG_ADVISORY_XACT_LOCK(
    PG_CATALOG.HASHTEXTEXTENDED(
      v_user_id::TEXT || ':' || v_operation_id::TEXT,
      0::BIGINT
    )
  );
  SELECT * INTO v_receipt
  FROM private.word_content_receipts
  WHERE user_id = v_user_id AND operation_id = v_operation_id;
  IF FOUND THEN
    IF v_receipt.request_sha256 IS DISTINCT FROM v_request_sha256 THEN
      RAISE EXCEPTION 'operation-intent-mismatch';
    END IF;
    RETURN v_receipt.result || JSONB_BUILD_OBJECT('idempotent', TRUE);
  END IF;

  SELECT * INTO v_word
  FROM public.words
  WHERE word_id = v_word_id AND user_id = v_user_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not-found-or-not-owned' USING ERRCODE = '42501';
  END IF;
  IF v_word.dictionary_content_mode = 'follow' THEN
    RAISE EXCEPTION 'legacy-content-upgrade-required';
  END IF;
  SELECT * INTO v_state FROM public.word_content_state
    WHERE word_id = v_word_id;
  IF NOT FOUND THEN
    v_state.content_version := 0;
    v_state.overrides := '{}'::JSONB;
    v_state.fallback_content := NULL;
  END IF;
  IF v_state.content_version IS DISTINCT FROM v_expected_version THEN
    RAISE EXCEPTION 'stale-content-version';
  END IF;

  IF v_kind IN ('create-private', 'detach', 'resolve-conflict') THEN
    v_content := p_command->'content';
    IF NOT private.valid_dictionary_content(v_content) THEN
      RAISE EXCEPTION 'invalid-content';
    END IF;
  ELSE
    v_overrides := p_command->'overrides';
    IF NOT private.valid_dictionary_command_overrides(v_overrides) THEN
      RAISE EXCEPTION 'invalid-content';
    END IF;
  END IF;

  IF v_kind IN ('link', 'adopt-revision') THEN
    BEGIN
      v_word.dictionary_entry_id := (p_command#>>'{reference,entry_id}')::UUID;
      v_word.dictionary_revision_id := (p_command#>>'{reference,revision_id}')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid-revision';
    END;
    SELECT * INTO v_revision
    FROM public.dictionary_revisions AS revisions
    JOIN public.dictionary_entries AS entries USING (entry_id)
    WHERE revisions.entry_id = v_word.dictionary_entry_id
      AND revisions.revision_id = v_word.dictionary_revision_id
      AND revisions.review_status = 'published'
      AND entries.state = 'published'
    FOR SHARE OF entries;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid-revision';
    END IF;
    IF v_kind = 'link' AND EXISTS (
      SELECT 1 FROM public.words
      WHERE word_id = v_word_id AND dictionary_entry_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'invalid-revision';
    END IF;
    v_content := private.apply_dictionary_overrides(v_revision.content, v_overrides);
  ELSIF v_kind = 'edit-private' THEN
    IF v_word.dictionary_entry_id IS NOT NULL THEN
      SELECT * INTO STRICT v_revision FROM public.dictionary_revisions
      WHERE entry_id = v_word.dictionary_entry_id
        AND revision_id = v_word.dictionary_revision_id;
      v_content := private.apply_dictionary_overrides(v_revision.content, v_overrides);
    ELSE
      v_content := private.apply_dictionary_overrides(
        COALESCE(v_state.fallback_content, private.legacy_word_content(v_word)),
        v_overrides
      );
      v_overrides := '{}'::JSONB;
    END IF;
  END IF;

  IF NOT private.valid_dictionary_content(v_content) THEN
    RAISE EXCEPTION 'legacy-content-upgrade-required';
  END IF;

  v_new_version := v_expected_version + 1;
  IF v_kind IN ('link', 'adopt-revision') THEN
    UPDATE public.words
    SET dictionary_entry_id = v_word.dictionary_entry_id,
        dictionary_revision_id = v_word.dictionary_revision_id
    WHERE word_id = v_word_id AND user_id = v_user_id;
    INSERT INTO public.word_content_state(
      word_id, user_id, content_version, fallback_content, overrides
    ) VALUES (v_word_id, v_user_id, v_new_version, NULL, v_overrides)
    ON CONFLICT (word_id) DO UPDATE SET
      content_version = EXCLUDED.content_version,
      fallback_content = NULL,
      overrides = EXCLUDED.overrides;
  ELSIF v_kind IN ('detach', 'resolve-conflict') THEN
    UPDATE public.words
    SET dictionary_entry_id = NULL, dictionary_revision_id = NULL
    WHERE word_id = v_word_id AND user_id = v_user_id;
    INSERT INTO public.word_content_state(
      word_id, user_id, content_version, fallback_content, overrides
    ) VALUES (v_word_id, v_user_id, v_new_version, v_content, '{}'::JSONB)
    ON CONFLICT (word_id) DO UPDATE SET
      content_version = EXCLUDED.content_version,
      fallback_content = EXCLUDED.fallback_content,
      overrides = '{}'::JSONB;
  ELSIF v_kind = 'create-private' THEN
    IF v_word.dictionary_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'legacy-content-upgrade-required';
    END IF;
    INSERT INTO public.word_content_state(
      word_id, user_id, content_version, fallback_content, overrides
    ) VALUES (v_word_id, v_user_id, v_new_version, v_content, '{}'::JSONB)
    ON CONFLICT (word_id) DO UPDATE SET
      content_version = EXCLUDED.content_version,
      fallback_content = EXCLUDED.fallback_content,
      overrides = '{}'::JSONB;
  ELSE
    INSERT INTO public.word_content_state(
      word_id, user_id, content_version, fallback_content, overrides
    ) VALUES (
      v_word_id, v_user_id, v_new_version,
      CASE WHEN v_word.dictionary_entry_id IS NULL THEN v_content ELSE NULL END,
      v_overrides
    ) ON CONFLICT (word_id) DO UPDATE SET
      content_version = EXCLUDED.content_version,
      fallback_content = EXCLUDED.fallback_content,
      overrides = EXCLUDED.overrides;
  END IF;

  BEGIN
    PERFORM private.project_dictionary_content_to_word(
      v_word_id, v_user_id, v_content
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'semantic-key-conflict';
  END;

  v_result := JSONB_BUILD_OBJECT(
    'protocol_version', 1,
    'operation_id', v_operation_id,
    'word_id', v_word_id,
    'content_version', v_new_version,
    'kind', v_kind,
    'idempotent', FALSE
  );
  INSERT INTO private.word_content_receipts(
    user_id, operation_id, word_id, request_sha256,
    resulting_content_version, result_code, result
  ) VALUES (
    v_user_id, v_operation_id, v_word_id, v_request_sha256,
    v_new_version, 'applied', v_result
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dictionary_content_capability_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dictionary_content_capability_v2() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dictionary_effective_content_v2(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dictionary_effective_content_v2(UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_web_review_snapshot_v3() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_review_snapshot_v3() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.get_dictionary_content_changes_v2(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dictionary_content_changes_v2(TEXT, INTEGER) TO authenticated;

COMMENT ON COLUMN public.words.dictionary_content_mode IS
  'Explicit legacy versus following shared-content authority; no existing row is converted.';
COMMENT ON FUNCTION public.get_dictionary_effective_content_v2(UUID[]) IS
  'Owner-only snapshot with deduplicated immutable revision dependencies and decimal BIGINT cursors.';
COMMIT;
