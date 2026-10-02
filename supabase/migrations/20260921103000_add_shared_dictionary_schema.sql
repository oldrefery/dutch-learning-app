-- Additive shared-dictionary foundation. This migration does not link existing
-- cards, change the legacy read/write path, publish content, or enable workers.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.dictionary_sources (
  source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_kind TEXT NOT NULL,
  provenance_locator TEXT NOT NULL,
  license_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  review_state TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  approved_content_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_sources_kind
    CHECK (source_kind IN ('licensed', 'first_party', 'provider', 'editorial', 'unknown')),
  CONSTRAINT dictionary_sources_locator_not_blank
    CHECK (BTRIM(provenance_locator) <> ''),
  CONSTRAINT dictionary_sources_license_shape
    CHECK (JSONB_TYPEOF(license_metadata) = 'object'),
  CONSTRAINT dictionary_sources_review_state
    CHECK (review_state IN ('pending', 'approved', 'rejected')),
  CONSTRAINT dictionary_sources_digest
    CHECK (
      approved_content_sha256 IS NULL
      OR approved_content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT dictionary_sources_review_fields
    CHECK (
      (
        review_state = 'pending'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND approved_content_sha256 IS NULL
      )
      OR (
        review_state = 'approved'
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND approved_content_sha256 IS NOT NULL
      )
      OR (
        review_state = 'rejected'
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND approved_content_sha256 IS NULL
      )
    )
);

CREATE TABLE public.dictionary_entries (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  language_code TEXT NOT NULL,
  lemma TEXT NOT NULL,
  part_of_speech TEXT,
  article TEXT,
  sense_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_entries_language_code
    CHECK (language_code ~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'),
  CONSTRAINT dictionary_entries_lemma_not_blank
    CHECK (BTRIM(lemma) <> ''),
  CONSTRAINT dictionary_entries_part_of_speech_not_blank
    CHECK (part_of_speech IS NULL OR BTRIM(part_of_speech) <> ''),
  CONSTRAINT dictionary_entries_article_not_blank
    CHECK (article IS NULL OR BTRIM(article) <> ''),
  CONSTRAINT dictionary_entries_sense_key_not_blank
    CHECK (BTRIM(sense_key) <> ''),
  CONSTRAINT dictionary_entries_state
    CHECK (state IN ('draft', 'published', 'retired'))
);

CREATE INDEX dictionary_entries_candidate_idx
  ON public.dictionary_entries (
    language_code,
    LOWER(BTRIM(lemma)),
    COALESCE(LOWER(BTRIM(part_of_speech)), ''),
    COALESCE(LOWER(BTRIM(article)), ''),
    sense_key
  );

CREATE INDEX dictionary_entries_state_idx
  ON public.dictionary_entries(state, updated_at, entry_id);

CREATE TRIGGER handle_dictionary_entries_updated_at
  BEFORE UPDATE ON public.dictionary_entries
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TABLE public.dictionary_revisions (
  revision_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL,
  revision_no INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  content_sha256 TEXT NOT NULL,
  cefr_input_sha256 TEXT NOT NULL,
  source_id UUID NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft',
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_revisions_entry
    FOREIGN KEY (entry_id)
    REFERENCES public.dictionary_entries(entry_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_revisions_source
    FOREIGN KEY (source_id)
    REFERENCES private.dictionary_sources(source_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_revisions_number
    CHECK (revision_no > 0),
  CONSTRAINT dictionary_revisions_schema_version
    CHECK (schema_version > 0),
  CONSTRAINT dictionary_revisions_content_shape
    CHECK (JSONB_TYPEOF(content) = 'object'),
  CONSTRAINT dictionary_revisions_content_digest
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dictionary_revisions_cefr_digest
    CHECK (cefr_input_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dictionary_revisions_review_status
    CHECK (review_status IN ('draft', 'published', 'retired')),
  CONSTRAINT dictionary_revisions_review_fields
    CHECK (
      (review_status = 'draft' AND reviewed_at IS NULL AND published_at IS NULL)
      OR (
        review_status IN ('published', 'retired')
        AND reviewed_at IS NOT NULL
        AND published_at IS NOT NULL
      )
    ),
  CONSTRAINT dictionary_revisions_entry_number_unique
    UNIQUE (entry_id, revision_no),
  CONSTRAINT dictionary_revisions_entry_revision_unique
    UNIQUE (entry_id, revision_id)
);

CREATE INDEX dictionary_revisions_entry_created_idx
  ON public.dictionary_revisions(entry_id, created_at, revision_id);

CREATE INDEX dictionary_revisions_delivery_idx
  ON public.dictionary_revisions(published_at, entry_id, revision_id)
  WHERE review_status = 'published';

CREATE TABLE public.dictionary_entry_heads (
  entry_id UUID PRIMARY KEY,
  revision_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_entry_heads_revision
    FOREIGN KEY (entry_id, revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
    ON DELETE RESTRICT
);

CREATE INDEX dictionary_entry_heads_delivery_idx
  ON public.dictionary_entry_heads(updated_at, entry_id, revision_id);

CREATE TRIGGER handle_dictionary_entry_heads_updated_at
  BEFORE UPDATE ON public.dictionary_entry_heads
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TABLE public.dictionary_cefr_assessments (
  assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL,
  input_sha256 TEXT NOT NULL,
  cefr_level TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  confidence DOUBLE PRECISION,
  method TEXT NOT NULL,
  method_version TEXT NOT NULL,
  source_id UUID,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  supersedes_assessment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_cefr_assessments_entry
    FOREIGN KEY (entry_id)
    REFERENCES public.dictionary_entries(entry_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_cefr_assessments_source
    FOREIGN KEY (source_id)
    REFERENCES private.dictionary_sources(source_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_cefr_assessments_input_digest
    CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dictionary_cefr_assessments_level
    CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT dictionary_cefr_assessments_status
    CHECK (status IN ('unknown', 'estimated', 'reviewed')),
  CONSTRAINT dictionary_cefr_assessments_status_level
    CHECK (
      (status = 'unknown' AND cefr_level IS NULL)
      OR (status IN ('estimated', 'reviewed') AND cefr_level IS NOT NULL)
    ),
  CONSTRAINT dictionary_cefr_assessments_confidence
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT dictionary_cefr_assessments_method_not_blank
    CHECK (BTRIM(method) <> '' AND BTRIM(method_version) <> ''),
  CONSTRAINT dictionary_cefr_assessments_source_required
    CHECK (status = 'unknown' OR source_id IS NOT NULL),
  CONSTRAINT dictionary_cefr_assessments_lock
    CHECK (NOT locked OR status = 'reviewed'),
  CONSTRAINT dictionary_cefr_assessments_entry_assessment_unique
    UNIQUE (entry_id, assessment_id),
  CONSTRAINT dictionary_cefr_assessments_entry_input_assessment_unique
    UNIQUE (entry_id, input_sha256, assessment_id),
  CONSTRAINT dictionary_cefr_assessments_supersedes
    FOREIGN KEY (entry_id, supersedes_assessment_id)
    REFERENCES public.dictionary_cefr_assessments(entry_id, assessment_id)
    ON DELETE RESTRICT
);

CREATE INDEX dictionary_cefr_assessments_entry_time_idx
  ON public.dictionary_cefr_assessments(entry_id, assessed_at, assessment_id);

CREATE TABLE public.dictionary_cefr_heads (
  entry_id UUID NOT NULL,
  input_sha256 TEXT NOT NULL,
  assessment_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (entry_id, input_sha256),
  CONSTRAINT dictionary_cefr_heads_assessment
    FOREIGN KEY (entry_id, input_sha256, assessment_id)
    REFERENCES public.dictionary_cefr_assessments(
      entry_id,
      input_sha256,
      assessment_id
    )
    ON DELETE RESTRICT
);

CREATE INDEX dictionary_cefr_heads_assessment_idx
  ON public.dictionary_cefr_heads(assessment_id);

CREATE TRIGGER handle_dictionary_cefr_heads_updated_at
  BEFORE UPDATE ON public.dictionary_cefr_heads
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE FUNCTION private.valid_dictionary_overrides(p_overrides JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN JSONB_TYPEOF(p_overrides) IS DISTINCT FROM 'object' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1
      FROM JSONB_EACH(p_overrides) AS fields(key, value)
      WHERE CASE
        WHEN JSONB_TYPEOF(fields.value) IS DISTINCT FROM 'object' THEN TRUE
        WHEN fields.value->>'op' = 'remove' THEN
          fields.value <> '{"op":"remove"}'::JSONB
        WHEN fields.value->>'op' = 'set' THEN
          NOT fields.value ? 'value'
          OR (
            SELECT COUNT(*)
            FROM JSONB_OBJECT_KEYS(fields.value)
          ) <> 2
        ELSE TRUE
      END
    )
  END;
$$;

ALTER TABLE public.words
  ADD COLUMN dictionary_entry_id UUID,
  ADD COLUMN dictionary_revision_id UUID,
  ADD CONSTRAINT words_word_owner_unique UNIQUE (word_id, user_id),
  ADD CONSTRAINT words_dictionary_reference_pair
    CHECK (
      (dictionary_entry_id IS NULL AND dictionary_revision_id IS NULL)
      OR (dictionary_entry_id IS NOT NULL AND dictionary_revision_id IS NOT NULL)
    ),
  ADD CONSTRAINT words_dictionary_revision
    FOREIGN KEY (dictionary_entry_id, dictionary_revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
    ON DELETE RESTRICT;

CREATE INDEX words_dictionary_reference_idx
  ON public.words(dictionary_entry_id, dictionary_revision_id, user_id, word_id)
  WHERE dictionary_entry_id IS NOT NULL;

CREATE TABLE public.word_content_state (
  word_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  content_version BIGINT NOT NULL DEFAULT 0,
  fallback_content JSONB,
  overrides JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT word_content_state_word_owner
    FOREIGN KEY (word_id, user_id)
    REFERENCES public.words(word_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT word_content_state_version
    CHECK (content_version >= 0),
  CONSTRAINT word_content_state_fallback_shape
    CHECK (
      fallback_content IS NULL
      OR JSONB_TYPEOF(fallback_content) = 'object'
    ),
  CONSTRAINT word_content_state_overrides_shape
    CHECK (private.valid_dictionary_overrides(overrides))
);

CREATE INDEX word_content_state_owner_idx
  ON public.word_content_state(user_id, word_id);

CREATE TRIGGER handle_word_content_state_updated_at
  BEFORE UPDATE ON public.word_content_state
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TABLE private.word_content_receipts (
  user_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  word_id UUID NOT NULL,
  request_sha256 TEXT NOT NULL,
  resulting_content_version BIGINT NOT NULL,
  result_code TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, operation_id),
  CONSTRAINT word_content_receipts_word_owner
    FOREIGN KEY (word_id, user_id)
    REFERENCES public.words(word_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT word_content_receipts_digest
    CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT word_content_receipts_version
    CHECK (resulting_content_version >= 0),
  CONSTRAINT word_content_receipts_result_code
    CHECK (result_code IN ('applied', 'idempotent', 'conflict', 'rejected')),
  CONSTRAINT word_content_receipts_result_shape
    CHECK (JSONB_TYPEOF(result) = 'object')
);

CREATE INDEX word_content_receipts_word_created_idx
  ON private.word_content_receipts(word_id, created_at, operation_id);

CREATE FUNCTION private.validate_dictionary_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT *
  INTO STRICT v_source
  FROM private.dictionary_sources
  WHERE source_id = NEW.source_id
  FOR SHARE;

  -- Serialize the first revision against identity edits on the parent entry.
  PERFORM 1 FROM public.dictionary_entries
  WHERE entry_id = NEW.entry_id FOR SHARE;

  IF NEW.review_status IN ('published', 'retired') AND (
    v_source.review_state <> 'approved'
    OR v_source.approved_content_sha256 IS DISTINCT FROM NEW.content_sha256
  ) THEN
    RAISE EXCEPTION 'Published dictionary revisions require matching approved provenance';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dictionary_revision
  BEFORE INSERT ON public.dictionary_revisions
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_dictionary_revision();

CREATE FUNCTION private.reject_dictionary_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER protect_dictionary_revisions
  BEFORE UPDATE OR DELETE ON public.dictionary_revisions
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_dictionary_history_mutation();

CREATE TRIGGER protect_dictionary_cefr_assessments
  BEFORE UPDATE OR DELETE ON public.dictionary_cefr_assessments
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_dictionary_history_mutation();

CREATE FUNCTION private.protect_word_content_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Hard-deletion cascades follow the existing account/card privacy policy.
  -- Tombstones still exist in words, so their retry receipts remain immutable.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.words
    WHERE word_id = OLD.word_id AND user_id = OLD.user_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'word_content_receipts rows are immutable';
END;
$$;

CREATE TRIGGER protect_word_content_receipts
  BEFORE UPDATE OR DELETE ON private.word_content_receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_word_content_receipt();

CREATE FUNCTION private.protect_dictionary_source_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dictionary_revisions
    WHERE source_id = OLD.source_id
  ) OR EXISTS (
    SELECT 1
    FROM public.dictionary_cefr_assessments
    WHERE source_id = OLD.source_id
  ) THEN
    RAISE EXCEPTION 'Referenced dictionary provenance is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_dictionary_source_history
  BEFORE UPDATE OR DELETE ON private.dictionary_sources
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_dictionary_source_history();

CREATE FUNCTION private.validate_dictionary_entry_head()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.entry_id IS DISTINCT FROM OLD.entry_id THEN
    RAISE EXCEPTION 'Dictionary head identity is immutable';
  END IF;

  -- State transitions and head removal must not observe each other's old state.
  PERFORM 1 FROM public.dictionary_entries
  WHERE entry_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END
  FOR UPDATE;

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.dictionary_entries
      WHERE entry_id = OLD.entry_id
        AND state IN ('published', 'retired')
    ) THEN
      RAISE EXCEPTION 'Published dictionary entries must retain a revision head';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dictionary_revisions
    WHERE entry_id = NEW.entry_id
      AND revision_id = NEW.revision_id
      AND review_status = 'published'
  ) THEN
    RAISE EXCEPTION 'Dictionary entry heads must reference a published revision';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dictionary_entry_head
  BEFORE INSERT OR UPDATE OR DELETE ON public.dictionary_entry_heads
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_dictionary_entry_head();

CREATE FUNCTION private.validate_dictionary_entry_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.entry_id, NEW.language_code, NEW.lemma, NEW.part_of_speech,
           NEW.article, NEW.sense_key)
       IS DISTINCT FROM
       ROW(OLD.entry_id, OLD.language_code, OLD.lemma, OLD.part_of_speech,
           OLD.article, OLD.sense_key)
       AND EXISTS (
         SELECT 1 FROM public.dictionary_revisions WHERE entry_id = OLD.entry_id
       ) THEN
      RAISE EXCEPTION 'Dictionary entry identity is immutable after its first revision';
    END IF;
    IF OLD.state <> 'draft' AND NEW.state = 'draft' THEN
      RAISE EXCEPTION 'Published dictionary entries cannot return to draft';
    END IF;
  END IF;

  IF NEW.state IN ('published', 'retired') AND NOT EXISTS (
    SELECT 1
    FROM public.dictionary_entry_heads
    WHERE entry_id = NEW.entry_id
  ) THEN
    RAISE EXCEPTION 'Published dictionary entries require a revision head';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dictionary_entry_state
  BEFORE INSERT OR UPDATE ON public.dictionary_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_dictionary_entry_state();

CREATE FUNCTION private.validate_dictionary_cefr_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.source_id IS NOT NULL THEN
    PERFORM 1 FROM private.dictionary_sources
    WHERE source_id = NEW.source_id FOR SHARE;
  END IF;
  IF NEW.status IN ('estimated', 'reviewed') THEN
    IF NOT EXISTS (
      SELECT 1 FROM private.dictionary_sources
      WHERE source_id = NEW.source_id AND review_state = 'approved'
    ) THEN
      RAISE EXCEPTION 'Estimated and reviewed CEFR assessments require approved provenance';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dictionary_cefr_assessment
  BEFORE INSERT ON public.dictionary_cefr_assessments
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_dictionary_cefr_assessment();

CREATE FUNCTION private.validate_dictionary_cefr_head()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_previous public.dictionary_cefr_assessments%ROWTYPE;
  v_new public.dictionary_cefr_assessments%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'CEFR heads cannot be deleted; append a successor assessment';
  END IF;
  IF ROW(NEW.entry_id, NEW.input_sha256)
     IS DISTINCT FROM ROW(OLD.entry_id, OLD.input_sha256) THEN
    RAISE EXCEPTION 'CEFR head identity is immutable';
  END IF;
  IF NEW.assessment_id IS NOT DISTINCT FROM OLD.assessment_id THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO STRICT v_previous
  FROM public.dictionary_cefr_assessments
  WHERE assessment_id = OLD.assessment_id;

  IF v_previous.locked OR v_previous.status = 'reviewed' THEN
    SELECT *
    INTO STRICT v_new
    FROM public.dictionary_cefr_assessments
    WHERE assessment_id = NEW.assessment_id;

    IF v_new.status <> 'reviewed'
       OR (v_previous.locked AND NOT v_new.locked)
       OR v_new.supersedes_assessment_id IS DISTINCT FROM OLD.assessment_id THEN
      RAISE EXCEPTION 'Locked or reviewed CEFR assessments require an explicit reviewed successor';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_dictionary_cefr_head
  BEFORE UPDATE OR DELETE ON public.dictionary_cefr_heads
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_dictionary_cefr_head();

CREATE FUNCTION private.validate_word_dictionary_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') AND (
    (TG_OP = 'INSERT' AND NEW.dictionary_entry_id IS NOT NULL)
    OR (
      TG_OP = 'UPDATE'
      AND (
        NEW.dictionary_entry_id IS DISTINCT FROM OLD.dictionary_entry_id
        OR NEW.dictionary_revision_id IS DISTINCT FROM OLD.dictionary_revision_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'Dictionary references can only be changed by trusted commands'
      USING ERRCODE = '42501';
  END IF;

  -- Resending an existing pin (including a retired one) is not a new link.
  IF TG_OP = 'UPDATE'
     AND NEW.dictionary_entry_id IS NOT DISTINCT FROM OLD.dictionary_entry_id
     AND NEW.dictionary_revision_id IS NOT DISTINCT FROM OLD.dictionary_revision_id THEN
    RETURN NEW;
  END IF;

  -- Let the named CHECK constraint report incomplete trusted writes.
  IF (NEW.dictionary_entry_id IS NULL) <> (NEW.dictionary_revision_id IS NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.dictionary_entry_id IS NOT NULL THEN
    PERFORM 1
    FROM public.dictionary_revisions AS revisions
    JOIN public.dictionary_entries AS entries
      ON entries.entry_id = revisions.entry_id
    WHERE revisions.entry_id = NEW.dictionary_entry_id
      AND revisions.revision_id = NEW.dictionary_revision_id
      AND revisions.review_status = 'published'
      AND entries.state = 'published'
    FOR SHARE OF entries;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'New dictionary references require published content';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_word_dictionary_reference
  BEFORE INSERT OR UPDATE OF dictionary_entry_id, dictionary_revision_id
  ON public.words
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_word_dictionary_reference();

CREATE FUNCTION private.validate_word_content_layout()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_linked BOOLEAN;
  v_content public.word_content_state%ROWTYPE;
BEGIN
  -- Read the final transaction state so link/detach can update both tables
  -- atomically in either order. Missing rows remain valid for legacy cards.
  SELECT dictionary_entry_id IS NOT NULL INTO v_linked
  FROM public.words WHERE word_id = NEW.word_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_content
  FROM public.word_content_state WHERE word_id = NEW.word_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_linked AND v_content.fallback_content IS NOT NULL THEN
    RAISE EXCEPTION 'Linked cards must not store a full fallback';
  END IF;
  IF NOT v_linked AND (
    v_content.fallback_content IS NULL OR v_content.overrides <> '{}'::JSONB
  ) THEN
    RAISE EXCEPTION 'Unlinked cards require private fallback and empty overrides';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER validate_word_content_layout
  AFTER INSERT OR UPDATE ON public.word_content_state
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION private.validate_word_content_layout();

CREATE CONSTRAINT TRIGGER validate_word_reference_layout
  AFTER UPDATE OF dictionary_entry_id, dictionary_revision_id ON public.words
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (OLD.dictionary_entry_id IS DISTINCT FROM NEW.dictionary_entry_id
    OR OLD.dictionary_revision_id IS DISTINCT FROM NEW.dictionary_revision_id)
  EXECUTE FUNCTION private.validate_word_content_layout();

ALTER TABLE public.dictionary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_entry_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_cefr_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_cefr_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_content_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.word_content_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.dictionary_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dictionary_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dictionary_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dictionary_entry_heads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dictionary_cefr_assessments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.dictionary_cefr_heads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.word_content_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.word_content_receipts FROM PUBLIC, anon, authenticated;

-- TRUNCATE bypasses row guards; even trusted workers must use guarded DML.
REVOKE ALL ON private.dictionary_sources, public.dictionary_entries,
  public.dictionary_revisions, public.dictionary_entry_heads,
  public.dictionary_cefr_assessments, public.dictionary_cefr_heads,
  public.word_content_state, private.word_content_receipts FROM service_role;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.dictionary_sources,
  public.dictionary_entries, public.dictionary_revisions,
  public.dictionary_entry_heads, public.dictionary_cefr_assessments,
  public.dictionary_cefr_heads, public.word_content_state,
  private.word_content_receipts TO service_role;
GRANT SELECT ON public.words TO service_role;
GRANT UPDATE (dictionary_entry_id, dictionary_revision_id)
  ON public.words TO service_role;

GRANT SELECT ON public.dictionary_entries TO authenticated;
GRANT SELECT ON public.dictionary_revisions TO authenticated;
GRANT SELECT ON public.dictionary_entry_heads TO authenticated;
GRANT SELECT ON public.dictionary_cefr_assessments TO authenticated;
GRANT SELECT ON public.dictionary_cefr_heads TO authenticated;
GRANT SELECT ON public.word_content_state TO authenticated;
GRANT SELECT ON private.word_content_receipts TO authenticated;

CREATE POLICY "Read published or pinned dictionary entries"
  ON public.dictionary_entries
  FOR SELECT
  TO authenticated
  USING (
    state = 'published'
    OR EXISTS (
      SELECT 1
      FROM public.words
      WHERE words.user_id = (SELECT auth.uid())
        AND words.dictionary_entry_id = dictionary_entries.entry_id
    )
  );

CREATE POLICY "Read published or pinned dictionary revisions"
  ON public.dictionary_revisions
  FOR SELECT
  TO authenticated
  USING (
    (
      review_status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.dictionary_entries
        WHERE dictionary_entries.entry_id = dictionary_revisions.entry_id
          AND dictionary_entries.state = 'published'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.words
      WHERE words.user_id = (SELECT auth.uid())
        AND words.dictionary_entry_id = dictionary_revisions.entry_id
        AND words.dictionary_revision_id = dictionary_revisions.revision_id
    )
  );

CREATE POLICY "Read published dictionary entry heads"
  ON public.dictionary_entry_heads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dictionary_entries
      WHERE dictionary_entries.entry_id = dictionary_entry_heads.entry_id
        AND dictionary_entries.state = 'published'
    )
  );

CREATE POLICY "Read CEFR history for visible dictionary entries"
  ON public.dictionary_cefr_assessments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dictionary_entries
      WHERE dictionary_entries.entry_id = dictionary_cefr_assessments.entry_id
        AND (
          dictionary_entries.state = 'published'
          OR EXISTS (
            SELECT 1
            FROM public.words
            WHERE words.user_id = (SELECT auth.uid())
              AND words.dictionary_entry_id = dictionary_entries.entry_id
          )
        )
    )
  );

CREATE POLICY "Read CEFR heads for visible dictionary entries"
  ON public.dictionary_cefr_heads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.dictionary_entries
      WHERE dictionary_entries.entry_id = dictionary_cefr_heads.entry_id
        AND (
          dictionary_entries.state = 'published'
          OR EXISTS (
            SELECT 1
            FROM public.words
            WHERE words.user_id = (SELECT auth.uid())
              AND words.dictionary_entry_id = dictionary_entries.entry_id
          )
        )
    )
  );

CREATE POLICY "Read own word content state"
  ON public.word_content_state
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Read own word content receipts"
  ON private.word_content_receipts
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE VIEW public.readable_dictionary_content
WITH (security_invoker = true, security_barrier = true)
AS
SELECT
  entries.entry_id,
  entries.language_code,
  entries.lemma,
  entries.part_of_speech,
  entries.article,
  entries.sense_key,
  heads.revision_id,
  revisions.revision_no,
  revisions.schema_version,
  revisions.content,
  revisions.content_sha256,
  revisions.cefr_input_sha256,
  revisions.published_at,
  assessments.cefr_level,
  assessments.status AS cefr_status,
  assessments.confidence AS cefr_confidence,
  assessments.assessed_at AS cefr_assessed_at,
  assessments.locked AS cefr_locked
FROM public.dictionary_entries AS entries
JOIN public.dictionary_entry_heads AS heads
  ON heads.entry_id = entries.entry_id
JOIN public.dictionary_revisions AS revisions
  ON revisions.entry_id = heads.entry_id
  AND revisions.revision_id = heads.revision_id
LEFT JOIN public.dictionary_cefr_heads AS cefr_heads
  ON cefr_heads.entry_id = entries.entry_id
  AND cefr_heads.input_sha256 = revisions.cefr_input_sha256
LEFT JOIN public.dictionary_cefr_assessments AS assessments
  ON assessments.entry_id = cefr_heads.entry_id
  AND assessments.input_sha256 = cefr_heads.input_sha256
  AND assessments.assessment_id = cefr_heads.assessment_id
WHERE entries.state = 'published'
  AND revisions.review_status = 'published';

REVOKE ALL ON public.readable_dictionary_content FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.readable_dictionary_content TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.valid_dictionary_overrides(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_revision()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reject_dictionary_history_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_word_content_receipt()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_word_content_layout()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_dictionary_source_history()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_entry_head()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_entry_state()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_cefr_assessment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_dictionary_cefr_head()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.validate_word_dictionary_reference()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.valid_dictionary_overrides(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_dictionary_revision() TO service_role;
GRANT EXECUTE ON FUNCTION private.reject_dictionary_history_mutation() TO service_role;
GRANT EXECUTE ON FUNCTION private.protect_word_content_receipt() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_word_content_layout() TO service_role;
GRANT EXECUTE ON FUNCTION private.protect_dictionary_source_history() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_dictionary_entry_head() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_dictionary_entry_state() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_dictionary_cefr_assessment() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_dictionary_cefr_head() TO service_role;
GRANT EXECUTE ON FUNCTION private.validate_word_dictionary_reference() TO service_role;

COMMENT ON TABLE private.dictionary_sources IS
  'Restricted provenance records. Locators and licensing metadata are never exposed to client roles.';
COMMENT ON TABLE public.dictionary_entries IS
  'Stable shared meaning identities; personal learning state remains on public.words and related owner tables.';
COMMENT ON TABLE public.dictionary_revisions IS
  'Immutable content revisions with approved provenance required before publication.';
COMMENT ON TABLE public.dictionary_entry_heads IS
  'Trusted current published revision pointers. Personal cards remain pinned until an explicit adoption command.';
COMMENT ON TABLE public.dictionary_cefr_assessments IS
  'Immutable CEFR assessment history keyed by exact normalized input digest.';
COMMENT ON TABLE public.word_content_state IS
  'Owner-private fallback and explicit {op,set/value/remove} overrides for linked personal cards; direct client writes are denied.';
COMMENT ON TABLE private.word_content_receipts IS
  'Immutable owner-visible idempotency receipts for future trusted content commands.';
COMMENT ON VIEW public.readable_dictionary_content IS
  'RLS-preserving current published content surface. No anonymous or provenance-locator access.';
COMMENT ON COLUMN public.words.dictionary_entry_id IS
  'Optional dormant shared meaning reference; trusted commands only.';
COMMENT ON COLUMN public.words.dictionary_revision_id IS
  'Optional pinned immutable revision reference; trusted commands only.';

COMMIT;
