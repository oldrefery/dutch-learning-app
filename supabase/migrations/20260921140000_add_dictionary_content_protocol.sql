-- Add dormant dictionary content commands and read models. Runtime flags remain
-- disabled until the separately approved final cutover.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE private.dictionary_content_runtime (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  operations_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reads_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_guard_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO private.dictionary_content_runtime(singleton) VALUES (TRUE);

CREATE TABLE private.dictionary_delivery_cursor (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  committed_version BIGINT NOT NULL DEFAULT 0 CHECK (committed_version >= 0)
);

INSERT INTO private.dictionary_delivery_cursor(singleton) VALUES (TRUE);

CREATE TABLE private.dictionary_content_changes (
  committed_version BIGINT PRIMARY KEY,
  change_kind TEXT NOT NULL,
  entry_id UUID NOT NULL,
  revision_id UUID,
  assessment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_content_changes_kind
    CHECK (change_kind IN ('revision-head', 'cefr-head')),
  CONSTRAINT dictionary_content_changes_shape
    CHECK (
      (change_kind = 'revision-head' AND revision_id IS NOT NULL AND assessment_id IS NULL)
      OR (change_kind = 'cefr-head' AND revision_id IS NULL AND assessment_id IS NOT NULL)
    ),
  CONSTRAINT dictionary_content_changes_entry
    FOREIGN KEY (entry_id) REFERENCES public.dictionary_entries(entry_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_content_changes_revision
    FOREIGN KEY (entry_id, revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_content_changes_assessment
    FOREIGN KEY (entry_id, assessment_id)
    REFERENCES public.dictionary_cefr_assessments(entry_id, assessment_id)
    ON DELETE RESTRICT
);

CREATE TABLE private.dictionary_entry_resolutions (
  resolution_id UUID PRIMARY KEY,
  request_sha256 TEXT NOT NULL,
  entry_id UUID NOT NULL,
  revision_id UUID NOT NULL,
  cache_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dictionary_entry_resolutions_digest
    CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dictionary_entry_resolutions_revision
    FOREIGN KEY (entry_id, revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
    ON DELETE RESTRICT,
  CONSTRAINT dictionary_entry_resolutions_cache
    FOREIGN KEY (cache_id)
    REFERENCES public.word_analysis_cache(cache_id)
    ON DELETE SET NULL
);

ALTER TABLE public.word_analysis_cache
  ADD COLUMN dictionary_entry_id UUID,
  ADD COLUMN dictionary_revision_id UUID,
  ADD CONSTRAINT word_analysis_cache_dictionary_reference_pair
    CHECK (
      (dictionary_entry_id IS NULL AND dictionary_revision_id IS NULL)
      OR (dictionary_entry_id IS NOT NULL AND dictionary_revision_id IS NOT NULL)
    ),
  ADD CONSTRAINT word_analysis_cache_dictionary_revision
    FOREIGN KEY (dictionary_entry_id, dictionary_revision_id)
    REFERENCES public.dictionary_revisions(entry_id, revision_id)
    ON DELETE RESTRICT;

CREATE INDEX word_analysis_cache_dictionary_reference_idx
  ON public.word_analysis_cache(dictionary_entry_id, dictionary_revision_id)
  WHERE dictionary_entry_id IS NOT NULL;

CREATE FUNCTION private.dictionary_content_fields()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'dutch_lemma', 'dutch_original', 'part_of_speech', 'article',
    'translations', 'examples', 'is_irregular', 'is_reflexive',
    'is_expression', 'expression_type', 'is_separable', 'prefix_part',
    'root_verb', 'plural', 'register', 'synonyms', 'antonyms',
    'conjugation', 'preposition', 'analysis_notes', 'usage_notes',
    'image_url', 'tts_url'
  ]::TEXT[];
$$;

CREATE FUNCTION private.jsonb_has_exact_keys(p_value JSONB, p_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT JSONB_TYPEOF(p_value) = 'object'
    AND ARRAY(SELECT JSONB_OBJECT_KEYS(p_value) ORDER BY 1)
      = ARRAY(SELECT UNNEST(p_keys) ORDER BY 1);
$$;

CREATE FUNCTION private.valid_dictionary_content(p_content JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    JSONB_TYPEOF(p_content) = 'object'
    AND ARRAY(SELECT JSONB_OBJECT_KEYS(p_content) ORDER BY 1)
      = ARRAY(SELECT UNNEST(private.dictionary_content_fields()) ORDER BY 1)
    AND JSONB_TYPEOF(p_content->'dutch_lemma') = 'string'
    AND BTRIM(p_content->>'dutch_lemma') <> ''
    AND (p_content->'dutch_original' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'dutch_original') = 'string')
    AND (p_content->'part_of_speech' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'part_of_speech') = 'string')
    AND (p_content->'article' = 'null'::JSONB
      OR p_content->>'article' IN ('de', 'het'))
    AND JSONB_TYPEOF(p_content->'translations') = 'object'
    AND ARRAY(SELECT JSONB_OBJECT_KEYS(p_content->'translations') ORDER BY 1)
      = ARRAY['en', 'ru']::TEXT[]
    AND JSONB_TYPEOF(p_content#>'{translations,en}') = 'array'
    AND JSONB_ARRAY_LENGTH(p_content#>'{translations,en}') > 0
    AND JSONB_TYPEOF(p_content#>'{translations,ru}') = 'array'
    AND JSONB_TYPEOF(p_content->'examples') = 'array'
    AND JSONB_TYPEOF(p_content->'synonyms') = 'array'
    AND JSONB_TYPEOF(p_content->'antonyms') = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content#>'{translations,en}')
      WHERE JSONB_TYPEOF(value) <> 'string' OR BTRIM(value#>>'{}') = ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content#>'{translations,ru}')
      WHERE JSONB_TYPEOF(value) <> 'string' OR BTRIM(value#>>'{}') = ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content->'synonyms')
      WHERE JSONB_TYPEOF(value) <> 'string' OR BTRIM(value#>>'{}') = ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content->'antonyms')
      WHERE JSONB_TYPEOF(value) <> 'string' OR BTRIM(value#>>'{}') = ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content->'examples') AS examples(value)
      WHERE NOT private.jsonb_has_exact_keys(examples.value, ARRAY['nl', 'en', 'ru'])
        OR JSONB_TYPEOF(examples.value->'nl') <> 'string'
        OR BTRIM(examples.value->>'nl') = ''
        OR JSONB_TYPEOF(examples.value->'en') <> 'string'
        OR BTRIM(examples.value->>'en') = ''
        OR NOT (
          examples.value->'ru' = 'null'::JSONB
          OR JSONB_TYPEOF(examples.value->'ru') = 'string'
        )
    )
    AND JSONB_TYPEOF(p_content->'is_irregular') = 'boolean'
    AND JSONB_TYPEOF(p_content->'is_reflexive') = 'boolean'
    AND JSONB_TYPEOF(p_content->'is_expression') = 'boolean'
    AND JSONB_TYPEOF(p_content->'is_separable') = 'boolean'
    AND (p_content->'expression_type' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'expression_type') = 'string')
    AND (p_content->'prefix_part' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'prefix_part') = 'string')
    AND (p_content->'root_verb' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'root_verb') = 'string')
    AND (p_content->'plural' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'plural') = 'string')
    AND (p_content->'register' = 'null'::JSONB
      OR p_content->>'register' IN ('formal', 'informal', 'neutral'))
    AND (p_content->'conjugation' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'conjugation') = 'object')
    AND (p_content->'preposition' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'preposition') = 'string')
    AND (p_content->'analysis_notes' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'analysis_notes') = 'string')
    AND (p_content->'usage_notes' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'usage_notes') = 'object')
    AND (p_content->'image_url' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'image_url') = 'string')
    AND (p_content->'tts_url' = 'null'::JSONB
      OR JSONB_TYPEOF(p_content->'tts_url') = 'string');
$$;

CREATE FUNCTION private.valid_dictionary_command_overrides(p_overrides JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT private.valid_dictionary_overrides(p_overrides)
    AND NOT EXISTS (
      SELECT 1
      FROM JSONB_EACH(p_overrides) AS fields(key, value)
      WHERE NOT fields.key = ANY(private.dictionary_content_fields())
        OR (
          fields.value->>'op' = 'set'
          AND NOT private.valid_dictionary_content(
            JSONB_BUILD_OBJECT(
              'dutch_lemma', 'fixture',
              'dutch_original', NULL,
              'part_of_speech', NULL,
              'article', NULL,
              'translations', '{"en":["fixture"],"ru":[]}'::JSONB,
              'examples', '[]'::JSONB,
              'is_irregular', FALSE,
              'is_reflexive', FALSE,
              'is_expression', FALSE,
              'expression_type', NULL,
              'is_separable', FALSE,
              'prefix_part', NULL,
              'root_verb', NULL,
              'plural', NULL,
              'register', NULL,
              'synonyms', '[]'::JSONB,
              'antonyms', '[]'::JSONB,
              'conjugation', NULL,
              'preposition', NULL,
              'analysis_notes', NULL,
              'usage_notes', NULL,
              'image_url', NULL,
              'tts_url', NULL
            ) || JSONB_BUILD_OBJECT(fields.key, fields.value->'value')
          )
        )
    );
$$;

CREATE FUNCTION private.apply_dictionary_overrides(
  p_content JSONB,
  p_overrides JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_result JSONB := p_content;
  v_field RECORD;
BEGIN
  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;
  FOR v_field IN SELECT key, value FROM JSONB_EACH(p_overrides)
  LOOP
    IF v_field.value->>'op' = 'remove' THEN
      v_result := JSONB_SET(v_result, ARRAY[v_field.key], 'null'::JSONB, TRUE);
    ELSE
      v_result := JSONB_SET(
        v_result,
        ARRAY[v_field.key],
        v_field.value->'value',
        TRUE
      );
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE FUNCTION private.legacy_word_content(p_word public.words)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'dutch_lemma', p_word.dutch_lemma,
    'dutch_original', p_word.dutch_original,
    'part_of_speech', p_word.part_of_speech,
    'article', p_word.article,
    'translations', p_word.translations,
    'examples', TO_JSONB(COALESCE(p_word.examples, ARRAY[]::JSONB[])),
    'is_irregular', COALESCE(p_word.is_irregular, FALSE),
    'is_reflexive', COALESCE(p_word.is_reflexive, FALSE),
    'is_expression', COALESCE(p_word.is_expression, FALSE),
    'expression_type', p_word.expression_type,
    'is_separable', COALESCE(p_word.is_separable, FALSE),
    'prefix_part', p_word.prefix_part,
    'root_verb', p_word.root_verb,
    'plural', p_word.plural,
    'register', p_word.register,
    'synonyms', TO_JSONB(COALESCE(p_word.synonyms, ARRAY[]::TEXT[])),
    'antonyms', TO_JSONB(COALESCE(p_word.antonyms, ARRAY[]::TEXT[])),
    'conjugation', p_word.conjugation,
    'preposition', p_word.preposition,
    'analysis_notes', p_word.analysis_notes,
    'usage_notes', p_word.usage_notes,
    'image_url', p_word.image_url,
    'tts_url', NULLIF(p_word.tts_url, '')
  );
$$;

CREATE FUNCTION private.project_dictionary_content_to_word(
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

CREATE FUNCTION private.invalidate_cache_dictionary_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.dictionary_entry_id := NULL;
  NEW.dictionary_revision_id := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invalidate_cache_dictionary_reference
  BEFORE UPDATE OF dutch_lemma, dutch_original, part_of_speech, article,
    translations, examples, is_irregular, is_reflexive, is_expression,
    expression_type, is_separable, prefix_part, root_verb, plural, register,
    synonyms, antonyms, conjugation, preposition, analysis_notes, usage_notes
  ON public.word_analysis_cache
  FOR EACH ROW
  WHEN (
    OLD.dictionary_entry_id IS NOT NULL
    AND ROW(
      NEW.dutch_lemma, NEW.dutch_original, NEW.part_of_speech, NEW.article,
      NEW.translations, NEW.examples, NEW.is_irregular, NEW.is_reflexive,
      NEW.is_expression, NEW.expression_type, NEW.is_separable, NEW.prefix_part,
      NEW.root_verb, NEW.plural, NEW.register, NEW.synonyms, NEW.antonyms,
      NEW.conjugation, NEW.preposition, NEW.analysis_notes, NEW.usage_notes
    ) IS DISTINCT FROM ROW(
      OLD.dutch_lemma, OLD.dutch_original, OLD.part_of_speech, OLD.article,
      OLD.translations, OLD.examples, OLD.is_irregular, OLD.is_reflexive,
      OLD.is_expression, OLD.expression_type, OLD.is_separable, OLD.prefix_part,
      OLD.root_verb, OLD.plural, OLD.register, OLD.synonyms, OLD.antonyms,
      OLD.conjugation, OLD.preposition, OLD.analysis_notes, OLD.usage_notes
    )
  )
  EXECUTE FUNCTION private.invalidate_cache_dictionary_reference();

CREATE FUNCTION private.record_dictionary_content_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'dictionary_entry_heads' THEN
      IF OLD.revision_id IS NOT DISTINCT FROM NEW.revision_id THEN
        RETURN NEW;
      END IF;
    ELSIF OLD.assessment_id IS NOT DISTINCT FROM NEW.assessment_id THEN
      RETURN NEW;
    END IF;
  END IF;
  UPDATE private.dictionary_delivery_cursor
  SET committed_version = committed_version + 1
  WHERE singleton
  RETURNING committed_version INTO STRICT v_version;

  IF TG_TABLE_NAME = 'dictionary_entry_heads' THEN
    INSERT INTO private.dictionary_content_changes(
      committed_version, change_kind, entry_id, revision_id
    ) VALUES (v_version, 'revision-head', NEW.entry_id, NEW.revision_id);
  ELSE
    INSERT INTO private.dictionary_content_changes(
      committed_version, change_kind, entry_id, assessment_id
    ) VALUES (v_version, 'cefr-head', NEW.entry_id, NEW.assessment_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_dictionary_revision_head_change
  AFTER INSERT OR UPDATE OF revision_id ON public.dictionary_entry_heads
  FOR EACH ROW
  EXECUTE FUNCTION private.record_dictionary_content_change();

CREATE TRIGGER record_dictionary_cefr_head_change
  AFTER INSERT OR UPDATE OF assessment_id ON public.dictionary_cefr_heads
  FOR EACH ROW
  EXECUTE FUNCTION private.record_dictionary_content_change();

CREATE FUNCTION public.persist_canonical_dictionary_analysis_v1(
  p_resolution_id UUID,
  p_language_code TEXT,
  p_sense_key TEXT,
  p_content JSONB,
  p_content_sha256 TEXT,
  p_cefr_input_sha256 TEXT,
  p_source_id UUID,
  p_cache_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request JSONB;
  v_request_sha256 TEXT;
  v_existing private.dictionary_entry_resolutions%ROWTYPE;
  v_entry_id UUID := extensions.gen_random_uuid();
  v_revision_id UUID := extensions.gen_random_uuid();
BEGIN
  IF p_language_code !~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
     OR BTRIM(p_sense_key) = ''
     OR p_content_sha256 !~ '^[0-9a-f]{64}$'
     OR p_cefr_input_sha256 !~ '^[0-9a-f]{64}$'
     OR NOT private.valid_dictionary_content(p_content) THEN
    RAISE EXCEPTION 'invalid-content';
  END IF;

  v_request := JSONB_BUILD_OBJECT(
    'resolution_id', p_resolution_id,
    'language_code', p_language_code,
    'sense_key', p_sense_key,
    'content', p_content,
    'content_sha256', p_content_sha256,
    'cefr_input_sha256', p_cefr_input_sha256,
    'source_id', p_source_id,
    'cache_id', p_cache_id
  );
  v_request_sha256 := ENCODE(
    extensions.digest(CONVERT_TO(v_request::TEXT, 'UTF8'), 'sha256'),
    'hex'
  );

  PERFORM PG_CATALOG.PG_ADVISORY_XACT_LOCK(
    PG_CATALOG.HASHTEXTEXTENDED(p_resolution_id::TEXT, 0::BIGINT)
  );
  SELECT * INTO v_existing
  FROM private.dictionary_entry_resolutions
  WHERE resolution_id = p_resolution_id;
  IF FOUND THEN
    IF v_existing.request_sha256 IS DISTINCT FROM v_request_sha256 THEN
      RAISE EXCEPTION 'operation-intent-mismatch';
    END IF;
    RETURN JSONB_BUILD_OBJECT(
      'entry_id', v_existing.entry_id,
      'revision_id', v_existing.revision_id,
      'idempotent', TRUE
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM private.dictionary_sources
    WHERE source_id = p_source_id
      AND review_state = 'approved'
      AND approved_content_sha256 = p_content_sha256
  ) THEN
    RAISE EXCEPTION 'invalid-revision';
  END IF;
  IF p_cache_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.word_analysis_cache WHERE cache_id = p_cache_id
  ) THEN
    RAISE EXCEPTION 'invalid-cache-reference';
  END IF;

  INSERT INTO public.dictionary_entries(
    entry_id, language_code, lemma, part_of_speech, article, sense_key
  ) VALUES (
    v_entry_id,
    p_language_code,
    p_content->>'dutch_lemma',
    p_content->>'part_of_speech',
    p_content->>'article',
    p_sense_key
  );
  INSERT INTO public.dictionary_revisions(
    revision_id, entry_id, revision_no, schema_version, content,
    content_sha256, cefr_input_sha256, source_id, review_status,
    reviewed_at, published_at
  ) VALUES (
    v_revision_id, v_entry_id, 1, 1, p_content,
    p_content_sha256, p_cefr_input_sha256, p_source_id, 'published', NOW(), NOW()
  );
  INSERT INTO public.dictionary_entry_heads(entry_id, revision_id)
    VALUES (v_entry_id, v_revision_id);
  UPDATE public.dictionary_entries SET state = 'published'
    WHERE entry_id = v_entry_id;

  IF p_cache_id IS NOT NULL THEN
    UPDATE public.word_analysis_cache
    SET dictionary_entry_id = v_entry_id,
        dictionary_revision_id = v_revision_id
    WHERE cache_id = p_cache_id;
  END IF;
  INSERT INTO private.dictionary_entry_resolutions(
    resolution_id, request_sha256, entry_id, revision_id, cache_id
  ) VALUES (
    p_resolution_id, v_request_sha256, v_entry_id, v_revision_id, p_cache_id
  );

  RETURN JSONB_BUILD_OBJECT(
    'entry_id', v_entry_id,
    'revision_id', v_revision_id,
    'idempotent', FALSE
  );
END;
$$;

CREATE FUNCTION public.dictionary_content_capability_v1()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'dictionary_content_protocol',
    CASE WHEN operations_enabled THEN 1 ELSE 0 END
  )
  FROM private.dictionary_content_runtime WHERE singleton;
$$;

CREATE FUNCTION private.resolve_word_effective_content(
  p_word public.words,
  p_state public.word_content_state,
  p_revision public.dictionary_revisions
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT private.apply_dictionary_overrides(
    CASE
      WHEN p_word.dictionary_entry_id IS NOT NULL
        AND p_revision.entry_id = p_word.dictionary_entry_id
        AND p_revision.revision_id = p_word.dictionary_revision_id
        AND p_revision.review_status IN ('published', 'retired')
      THEN p_revision.content
      WHEN p_state.fallback_content IS NOT NULL THEN p_state.fallback_content
      ELSE private.legacy_word_content(p_word)
    END,
    COALESCE(p_state.overrides, '{}'::JSONB)
  );
$$;

CREATE FUNCTION public.apply_dictionary_content_command_v1(p_command JSONB)
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

CREATE FUNCTION public.get_dictionary_effective_content_v1(
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
      words.dictionary_revision_id,
      COALESCE(states.content_version, 0) AS content_version,
      COALESCE(states.overrides, '{}'::JSONB) AS overrides,
      private.resolve_word_effective_content(words, states, revisions) AS content,
      CASE WHEN words.dictionary_entry_id IS NULL THEN 'fallback' ELSE 'pinned' END AS source,
      revisions.cefr_input_sha256,
      assessments.cefr_level,
      assessments.status AS cefr_status,
      assessments.confidence AS cefr_confidence
    FROM owned_words AS words
    LEFT JOIN public.word_content_state AS states ON states.word_id = words.word_id
    LEFT JOIN public.dictionary_revisions AS revisions
      ON revisions.entry_id = words.dictionary_entry_id
      AND revisions.revision_id = words.dictionary_revision_id
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

CREATE FUNCTION public.get_web_review_snapshot_v2()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_legacy JSONB;
  v_content JSONB;
BEGIN
  v_legacy := public.get_web_review_snapshot_v1();
  v_content := public.get_dictionary_effective_content_v1(NULL);
  RETURN (v_legacy - 'protocolVersion') || JSONB_BUILD_OBJECT(
    'protocolVersion', 2,
    'dictionaryContentProtocol', 1,
    'effectiveContent', v_content->'cards'
  );
END;
$$;

CREATE FUNCTION public.get_dictionary_content_changes_v1(
  p_after BIGINT DEFAULT 0,
  p_limit INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_latest BIGINT;
  v_next BIGINT;
  v_changes JSONB;
  v_has_more BOOLEAN;
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
  IF p_after < 0 OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'invalid-change-page';
  END IF;

  SELECT committed_version INTO STRICT v_latest
  FROM private.dictionary_delivery_cursor WHERE singleton;

  WITH visible AS (
    SELECT changes.*
    FROM private.dictionary_content_changes AS changes
    JOIN public.dictionary_entries AS entries
      ON entries.entry_id = changes.entry_id
    WHERE changes.committed_version > p_after
      AND (
        entries.state = 'published'
        OR EXISTS (
          SELECT 1 FROM public.words
          WHERE words.user_id = v_user_id
            AND words.dictionary_entry_id = changes.entry_id
        )
      )
    ORDER BY changes.committed_version
    LIMIT p_limit
  )
  SELECT
    COALESCE(JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'cursor', committed_version,
        'kind', change_kind,
        'entry_id', entry_id,
        'revision_id', revision_id,
        'assessment_id', assessment_id
      ) ORDER BY committed_version
    ), '[]'::JSONB),
    COALESCE(MAX(committed_version), LEAST(p_after, v_latest))
  INTO v_changes, v_next
  FROM visible;

  IF JSONB_ARRAY_LENGTH(v_changes) = 0 THEN
    v_next := v_latest;
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM private.dictionary_content_changes AS changes
    JOIN public.dictionary_entries AS entries
      ON entries.entry_id = changes.entry_id
    WHERE changes.committed_version > v_next
      AND (
        entries.state = 'published'
        OR EXISTS (
          SELECT 1 FROM public.words
          WHERE words.user_id = v_user_id
            AND words.dictionary_entry_id = changes.entry_id
        )
      )
  ) INTO v_has_more;

  RETURN JSONB_BUILD_OBJECT(
    'protocol_version', 1,
    'after', p_after,
    'next_cursor', v_next,
    'latest_cursor', v_latest,
    'has_more', v_has_more,
    'changes', v_changes
  );
END;
$$;

CREATE FUNCTION private.dictionary_legacy_guard_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT legacy_guard_enabled
  FROM private.dictionary_content_runtime
  WHERE singleton;
$$;

CREATE FUNCTION private.protect_linked_legacy_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT private.dictionary_legacy_guard_enabled()
     OR OLD.dictionary_entry_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF CURRENT_USER = PG_CATALOG.PG_GET_USERBYID(
    (SELECT relowner FROM PG_CATALOG.PG_CLASS WHERE oid = TG_RELID)
  ) THEN
    RETURN NEW;
  END IF;
  IF ROW(
    NEW.dutch_lemma, NEW.dutch_original, NEW.part_of_speech, NEW.article,
    NEW.translations, NEW.examples, NEW.is_irregular, NEW.is_reflexive,
    NEW.is_expression, NEW.expression_type, NEW.is_separable, NEW.prefix_part,
    NEW.root_verb, NEW.plural, NEW.register, NEW.synonyms, NEW.antonyms,
    NEW.conjugation, NEW.preposition, NEW.analysis_notes, NEW.usage_notes,
    NEW.image_url, NEW.tts_url
  ) IS DISTINCT FROM ROW(
    OLD.dutch_lemma, OLD.dutch_original, OLD.part_of_speech, OLD.article,
    OLD.translations, OLD.examples, OLD.is_irregular, OLD.is_reflexive,
    OLD.is_expression, OLD.expression_type, OLD.is_separable, OLD.prefix_part,
    OLD.root_verb, OLD.plural, OLD.register, OLD.synonyms, OLD.antonyms,
    OLD.conjugation, OLD.preposition, OLD.analysis_notes, OLD.usage_notes,
    OLD.image_url, OLD.tts_url
  ) THEN
    RAISE EXCEPTION 'legacy-content-upgrade-required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_linked_legacy_content
  BEFORE UPDATE ON public.words
  FOR EACH ROW
  EXECUTE FUNCTION private.protect_linked_legacy_content();

-- Older clients may still edit unlinked words. Keep the private projection and
-- its concurrency version in step with those accepted legacy writes. Command
-- projection has already installed this exact fallback and must not double-bump.
CREATE FUNCTION private.capture_unlinked_legacy_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_content JSONB;
BEGIN
  IF NOT private.dictionary_legacy_guard_enabled()
     OR NEW.dictionary_entry_id IS NOT NULL
     OR private.legacy_word_content(NEW) IS NOT DISTINCT FROM private.legacy_word_content(OLD) THEN
    RETURN NEW;
  END IF;
  v_content := private.legacy_word_content(NEW);
  UPDATE public.word_content_state
  SET fallback_content = v_content,
      overrides = '{}'::JSONB,
      content_version = content_version + 1
  WHERE word_id = NEW.word_id AND user_id = NEW.user_id
    AND (fallback_content IS DISTINCT FROM v_content OR overrides <> '{}'::JSONB);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.capture_unlinked_legacy_content() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_unlinked_legacy_content
  AFTER UPDATE ON public.words
  FOR EACH ROW
  EXECUTE FUNCTION private.capture_unlinked_legacy_content();

REVOKE ALL ON private.dictionary_content_runtime,
  private.dictionary_delivery_cursor, private.dictionary_content_changes,
  private.dictionary_entry_resolutions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON private.dictionary_content_runtime,
  private.dictionary_delivery_cursor, private.dictionary_content_changes,
  private.dictionary_entry_resolutions TO service_role;

REVOKE ALL ON FUNCTION private.dictionary_content_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.jsonb_has_exact_keys(JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_dictionary_content(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.valid_dictionary_command_overrides(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.apply_dictionary_overrides(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_word_content(public.words) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.project_dictionary_content_to_word(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.invalidate_cache_dictionary_reference() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_dictionary_content_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.resolve_word_effective_content(public.words, public.word_content_state, public.dictionary_revisions) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.dictionary_legacy_guard_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.dictionary_legacy_guard_enabled() TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.protect_linked_legacy_content() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.persist_canonical_dictionary_analysis_v1(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_canonical_dictionary_analysis_v1(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.dictionary_content_capability_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dictionary_content_capability_v1() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_dictionary_content_command_v1(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_dictionary_content_command_v1(JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.get_dictionary_effective_content_v1(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dictionary_effective_content_v1(UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_web_review_snapshot_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_web_review_snapshot_v2() TO authenticated;
REVOKE ALL ON FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) TO authenticated;

COMMENT ON TABLE private.dictionary_content_runtime IS
  'Release-controlled dictionary content flags. All flags default off; clients cannot modify them.';
COMMENT ON TABLE private.dictionary_entry_resolutions IS
  'Idempotent trusted canonical analysis receipts. A resolution ID identifies one reviewed meaning decision.';
COMMENT ON TABLE private.dictionary_content_changes IS
  'Commit-order-safe shared revision and CEFR delivery log serialized by a transactional cursor row.';
COMMENT ON COLUMN public.word_analysis_cache.dictionary_revision_id IS
  'Optional explicit mapping from cache optimization to immutable canonical content; invalidated by linguistic refresh.';
COMMENT ON FUNCTION public.persist_canonical_dictionary_analysis_v1(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, UUID, UUID) IS
  'Service-role-only idempotent publication of approved canonical analysis; semantic spelling is not a merge key.';
COMMENT ON FUNCTION public.apply_dictionary_content_command_v1(JSONB) IS
  'Owner-authenticated idempotent content command. Updates content/reference/projection atomically and never accepts SRS fields.';
COMMENT ON FUNCTION public.get_dictionary_effective_content_v1(UUID[]) IS
  'Bounded owner-only bulk effective-content envelope with inherited CEFR safety.';
COMMENT ON FUNCTION public.get_web_review_snapshot_v2() IS
  'Opt-in review snapshot v2. Snapshot v1 remains unchanged for rollback and legacy clients.';
COMMENT ON FUNCTION public.get_dictionary_content_changes_v1(BIGINT, INTEGER) IS
  'Owner-authenticated page over the serialized dictionary delivery cursor; requires the dormant read flag.';
COMMENT ON FUNCTION private.protect_linked_legacy_content() IS
  'Release-controlled guard against direct legacy content writes to linked cards; disabled by default.';

COMMIT;
