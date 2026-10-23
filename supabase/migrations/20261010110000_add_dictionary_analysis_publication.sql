-- Dormant automated validation/publication support. No real policy, membership,
-- provider request or publication is created by applying this migration.
BEGIN;
ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN analysis_publication_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE private.dictionary_analysis_validator_policies (
  validator_version TEXT NOT NULL CHECK (LENGTH(BTRIM(validator_version)) BETWEEN 1 AND 100),
  policy_sha256 TEXT NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  media_url_prefixes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[] CHECK (CARDINALITY(media_url_prefixes) <= 20),
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (validator_version, policy_sha256)
);
CREATE TABLE private.dictionary_analysis_validations (
  validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  expected_revision_id UUID NOT NULL,
  expected_head_sequence BIGINT NOT NULL CHECK (expected_head_sequence >= 0),
  anchor_id UUID NOT NULL,
  anchor_sha256 TEXT NOT NULL CHECK (anchor_sha256 ~ '^[0-9a-f]{64}$'),
  fence BIGINT NOT NULL CHECK (fence > 0),
  validator_version TEXT NOT NULL,
  policy_sha256 TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  result_sha256 TEXT NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  meaning_evidence_sha256 TEXT NOT NULL CHECK (meaning_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'review-required')),
  decision_code TEXT NOT NULL CHECK (decision_code IN ('same-meaning', 'schema-invalid', 'unsafe-media', 'identity-mismatch', 'meaning-mismatch', 'meaning-uncertain')),
  content JSONB,
  content_sha256 TEXT CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  cefr_input_sha256 TEXT CHECK (cefr_input_sha256 ~ '^[0-9a-f]{64}$'),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  UNIQUE (actor_id, operation_id),
  FOREIGN KEY (entry_id, expected_revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id) ON DELETE RESTRICT,
  FOREIGN KEY (entry_id, anchor_id) REFERENCES private.dictionary_meaning_anchors(entry_id, anchor_id) ON DELETE RESTRICT,
  FOREIGN KEY (validator_version, policy_sha256) REFERENCES private.dictionary_analysis_validator_policies(validator_version, policy_sha256) ON DELETE RESTRICT,
  CHECK ((outcome = 'accepted' AND decision_code = 'same-meaning' AND content IS NOT NULL AND content_sha256 IS NOT NULL AND cefr_input_sha256 IS NOT NULL)
    OR (outcome = 'rejected' AND decision_code IN ('schema-invalid', 'unsafe-media', 'identity-mismatch', 'meaning-mismatch') AND content IS NULL AND content_sha256 IS NULL AND cefr_input_sha256 IS NULL)
    OR (outcome = 'review-required' AND decision_code = 'meaning-uncertain' AND content IS NULL AND content_sha256 IS NULL AND cefr_input_sha256 IS NULL))
);
ALTER TABLE private.dictionary_analysis_operations
  ADD COLUMN validation_id UUID UNIQUE REFERENCES private.dictionary_analysis_validations(validation_id) ON DELETE RESTRICT;

-- Publication permits are writable only by the guarded wrapper. Deferred FKs
-- allow a permit to precede source/revision inserts within that same transaction.
CREATE TABLE private.dictionary_analysis_publications (
  validation_id UUID PRIMARY KEY REFERENCES private.dictionary_analysis_validations(validation_id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  revision_id UUID NOT NULL UNIQUE,
  source_id UUID NOT NULL UNIQUE,
  publication_xid XID8 NOT NULL DEFAULT PG_CURRENT_XACT_ID(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT CLOCK_TIMESTAMP(),
  FOREIGN KEY (entry_id, revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (source_id) REFERENCES private.dictionary_sources(source_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE private.dictionary_sources
  ADD COLUMN automated_validation_id UUID UNIQUE REFERENCES private.dictionary_analysis_validations(validation_id) ON DELETE RESTRICT;
ALTER TABLE private.dictionary_sources DROP CONSTRAINT dictionary_sources_review_state;
ALTER TABLE private.dictionary_sources ADD CONSTRAINT dictionary_sources_review_state
  CHECK (review_state IN ('pending', 'approved', 'rejected', 'machine_validated'));
ALTER TABLE private.dictionary_sources DROP CONSTRAINT dictionary_sources_review_fields;
ALTER TABLE private.dictionary_sources ADD CONSTRAINT dictionary_sources_review_fields CHECK (
  (review_state = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_content_sha256 IS NULL AND automated_validation_id IS NULL)
  OR (review_state = 'approved' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_content_sha256 IS NOT NULL AND automated_validation_id IS NULL)
  OR (review_state = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approved_content_sha256 IS NULL AND automated_validation_id IS NULL)
  OR (review_state = 'machine_validated' AND source_kind = 'provider' AND reviewed_by IS NULL AND reviewed_at IS NULL AND approved_content_sha256 IS NULL AND automated_validation_id IS NOT NULL)
);
-- Human review requirements remain enforced by the source-aware insert trigger.
-- Automated published revisions have published_at but never pretend human review.
ALTER TABLE public.dictionary_revisions DROP CONSTRAINT dictionary_revisions_review_fields;
ALTER TABLE public.dictionary_revisions ADD CONSTRAINT dictionary_revisions_review_fields CHECK (
  (review_status = 'draft' AND reviewed_at IS NULL AND published_at IS NULL)
  OR (review_status IN ('published', 'retired') AND published_at IS NOT NULL)
);

CREATE FUNCTION private.protect_dictionary_analysis_validation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.actor_id)
    AND (TO_JSONB(NEW) - 'actor_id') = (TO_JSONB(OLD) - 'actor_id') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'dictionary analysis validation evidence is immutable';
END;
$$;
CREATE TRIGGER protect_dictionary_analysis_validation BEFORE UPDATE OR DELETE ON private.dictionary_analysis_validations
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_analysis_validation();
CREATE TRIGGER protect_dictionary_analysis_publication BEFORE UPDATE OR DELETE ON private.dictionary_analysis_publications
  FOR EACH ROW EXECUTE FUNCTION private.reject_dictionary_history_mutation();
CREATE FUNCTION private.guard_dictionary_machine_source()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.review_state = 'machine_validated' THEN RAISE EXCEPTION 'Referenced dictionary provenance is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.review_state = 'machine_validated' AND NOT EXISTS (
    SELECT 1 FROM private.dictionary_analysis_publications p JOIN private.dictionary_analysis_validations v USING (validation_id)
    WHERE p.source_id = NEW.source_id AND p.validation_id = NEW.automated_validation_id
      AND p.publication_xid = PG_CURRENT_XACT_ID() AND v.outcome = 'accepted' AND v.entry_id = p.entry_id
  ) THEN RAISE EXCEPTION 'guarded-machine-publication-required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_dictionary_machine_source BEFORE INSERT OR UPDATE OR DELETE ON private.dictionary_sources
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_machine_source();
CREATE OR REPLACE FUNCTION private.validate_dictionary_revision()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id = NEW.source_id FOR SHARE;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = NEW.entry_id FOR SHARE;
  IF v_source.review_state = 'machine_validated' THEN
    IF NEW.review_status <> 'published' OR NEW.reviewed_at IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM private.dictionary_analysis_publications p JOIN private.dictionary_analysis_validations v USING (validation_id)
      WHERE p.source_id = NEW.source_id AND p.entry_id = NEW.entry_id AND p.revision_id = NEW.revision_id
        AND p.validation_id = v_source.automated_validation_id AND p.publication_xid = PG_CURRENT_XACT_ID()
        AND v.outcome = 'accepted' AND v.content = NEW.content AND v.content_sha256 = NEW.content_sha256
        AND v.cefr_input_sha256 = NEW.cefr_input_sha256 AND NEW.schema_version = 1
    ) THEN RAISE EXCEPTION 'guarded-machine-publication-required'; END IF;
  ELSIF NEW.review_status IN ('published', 'retired') THEN
    IF v_source.review_state <> 'approved' OR v_source.approved_content_sha256 IS DISTINCT FROM NEW.content_sha256 THEN
      RAISE EXCEPTION 'Published dictionary revisions require matching approved provenance';
    END IF;
    IF NEW.reviewed_at IS NULL THEN RAISE EXCEPTION 'Human dictionary revisions require reviewed_at' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Same ASCII-key canonical JSON contract as the existing domain/rehearsal code.
CREATE FUNCTION private.dictionary_canonical_sha256(p_value JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT ENCODE(extensions.digest(CONVERT_TO(private.dictionary_canonical_json(p_value), 'UTF8'), 'sha256'), 'hex');
$$;
CREATE FUNCTION private.dictionary_cefr_content_sha256(p_content JSONB) RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT private.dictionary_canonical_sha256(JSONB_BUILD_OBJECT('assessment_schema_version', 1,
    'content', p_content - ARRAY['image_url', 'tts_url']));
$$;
CREATE FUNCTION private.dictionary_utf16_length(p_text TEXT) RETURNS INTEGER
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT COALESCE(SUM(CASE WHEN ASCII(c) > 65535 THEN 2 ELSE 1 END), 0)::INTEGER FROM REGEXP_SPLIT_TO_TABLE(p_text, '') c WHERE c <> '';
$$;
CREATE FUNCTION private.dictionary_bounded_text(p_value JSONB, p_limit INTEGER, p_nullable BOOLEAN DEFAULT FALSE) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(CASE WHEN p_value = 'null'::JSONB THEN p_nullable WHEN JSONB_TYPEOF(p_value) <> 'string' THEN FALSE
    ELSE BTRIM(p_value #>> '{}', E' \t\n\r\f' || CHR(11) || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') <> '' AND private.dictionary_utf16_length(p_value #>> '{}') <= p_limit END, FALSE);
$$;
CREATE FUNCTION private.dictionary_bounded_strings(p_value JSONB, p_min INTEGER, p_max INTEGER) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF JSONB_TYPEOF(p_value) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  RETURN JSONB_ARRAY_LENGTH(p_value) BETWEEN p_min AND p_max AND NOT EXISTS (
    SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_value) e WHERE NOT private.dictionary_bounded_text(e, 500));
END;
$$;
CREATE FUNCTION private.dictionary_bounded_example(p_value JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.jsonb_has_exact_keys(p_value, ARRAY['nl','en','ru']) IS TRUE
    AND private.dictionary_bounded_text(p_value->'nl', 1000) AND private.dictionary_bounded_text(p_value->'en', 1000)
    AND private.dictionary_bounded_text(p_value->'ru', 1000, TRUE);
$$;
CREATE FUNCTION private.valid_dictionary_analysis_content(p_content JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_field TEXT; v_value JSONB;
BEGIN
  IF private.valid_dictionary_content(p_content) IS NOT TRUE OR OCTET_LENGTH(p_content::TEXT) > 131072
    OR NOT private.dictionary_bounded_text(p_content->'dutch_lemma', 120)
    OR NOT private.dictionary_bounded_text(p_content->'part_of_speech', 80, TRUE)
    OR NOT private.dictionary_bounded_text(p_content->'expression_type', 80, TRUE)
    OR NOT private.dictionary_bounded_text(p_content->'analysis_notes', 4000, TRUE)
    OR NOT private.dictionary_bounded_strings(p_content#>'{translations,en}', 1, 30)
    OR NOT private.dictionary_bounded_strings(p_content#>'{translations,ru}', 0, 30)
    OR NOT private.dictionary_bounded_strings(p_content->'synonyms', 0, 50)
    OR NOT private.dictionary_bounded_strings(p_content->'antonyms', 0, 50)
    OR JSONB_ARRAY_LENGTH(p_content->'examples') > 20
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_content->'examples') e WHERE NOT private.dictionary_bounded_example(e)) THEN RETURN FALSE; END IF;
  FOREACH v_field IN ARRAY ARRAY['dutch_original','prefix_part','root_verb','plural','preposition'] LOOP
    IF NOT private.dictionary_bounded_text(p_content->v_field, 120, TRUE) THEN RETURN FALSE; END IF;
  END LOOP;
  FOREACH v_field IN ARRAY ARRAY['image_url','tts_url'] LOOP
    IF NOT private.dictionary_bounded_text(p_content->v_field, 2000, TRUE) THEN RETURN FALSE; END IF;
  END LOOP;
  v_value := p_content->'conjugation';
  IF v_value <> 'null'::JSONB AND (private.jsonb_has_exact_keys(v_value, ARRAY['present','simple_past','simple_past_plural','past_participle']) IS NOT TRUE
    OR NOT private.dictionary_bounded_text(v_value->'present', 500) OR NOT private.dictionary_bounded_text(v_value->'simple_past', 500)
    OR NOT private.dictionary_bounded_text(v_value->'simple_past_plural', 500, TRUE) OR NOT private.dictionary_bounded_text(v_value->'past_participle', 500)) THEN RETURN FALSE; END IF;
  v_value := p_content->'usage_notes';
  IF v_value <> 'null'::JSONB THEN
    IF private.jsonb_has_exact_keys(v_value, ARRAY['summary','contrasts']) IS NOT TRUE OR NOT private.dictionary_bounded_text(v_value->'summary', 2000)
      OR JSONB_TYPEOF(v_value->'contrasts') IS DISTINCT FROM 'array' OR JSONB_ARRAY_LENGTH(v_value->'contrasts') > 5 THEN RETURN FALSE; END IF;
    IF EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(v_value->'contrasts') c WHERE private.jsonb_has_exact_keys(c, ARRAY['term','distinction','example']) IS NOT TRUE
      OR NOT private.dictionary_bounded_text(c->'term', 500) OR NOT private.dictionary_bounded_text(c->'distinction', 2000)
      OR (c->'example' <> 'null'::JSONB AND NOT private.dictionary_bounded_example(c->'example'))) THEN RETURN FALSE; END IF;
  END IF;
  RETURN TRUE;
EXCEPTION WHEN data_exception THEN RETURN FALSE;
END;
$$;
CREATE FUNCTION private.safe_dictionary_analysis_media(p_value JSONB, p_prefixes TEXT[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_value = 'null'::JSONB OR (private.dictionary_bounded_text(p_value, 2000)
    AND (p_value #>> '{}') ~ '^https://[a-z0-9.-]+(:[0-9]+)?/'
    AND (p_value #>> '{}') !~ '[[:space:]\\?#]'
    AND (p_value #>> '{}') !~* '(/\.\.?/|%2e|%2f|%5c)'
    AND EXISTS (SELECT 1 FROM UNNEST(p_prefixes) prefix
      WHERE prefix ~ '^https://[a-z0-9.-]+(:[0-9]+)?/[^?#[:space:]\\]*/$'
        AND LEFT(p_value #>> '{}', LENGTH(prefix)) = prefix));
$$;

-- Lock authority before operation rows: Auth deletion also locks Auth before
-- cascading into operations. SHARE also serializes concurrent role revocation.
CREATE FUNCTION private.lock_dictionary_analysis_authority(p_actor UUID) RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_access TEXT; v_admin BOOLEAN;
BEGIN
  PERFORM 1 FROM auth.users WHERE id = p_actor FOR KEY SHARE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT access_level INTO v_access FROM public.user_access_levels WHERE user_id = p_actor FOR SHARE;
  SELECT enabled INTO v_admin FROM private.dictionary_administrators WHERE user_id = p_actor FOR SHARE;
  RETURN COALESCE(v_access = 'full_access', FALSE) OR COALESCE(v_admin, FALSE);
END;
$$;
CREATE FUNCTION private.lock_dictionary_analysis_operation(p_actor UUID, p_operation UUID, p_fence TEXT)
RETURNS private.dictionary_analysis_operations LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_lease private.dictionary_analysis_leases%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_op.entry_id FOR UPDATE;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation FOR UPDATE;
  SELECT * INTO STRICT v_lease FROM private.dictionary_analysis_leases WHERE entry_id = v_op.entry_id FOR UPDATE;
  IF p_fence IS DISTINCT FROM v_op.fence::TEXT THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  IF v_op.status IN ('accepted','dispatching','validating','provider-outcome-unknown')
    AND ROW(v_lease.actor_id, v_lease.operation_id, v_lease.fence) IS DISTINCT FROM ROW(p_actor, p_operation, v_op.fence) THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  RETURN v_op;
END;
$$;
CREATE FUNCTION private.dictionary_analysis_dependency_error(p_op private.dictionary_analysis_operations) RETURNS TEXT
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.dictionary_entries WHERE entry_id = p_op.entry_id AND state = 'published')
    OR NOT EXISTS (SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id = p_op.entry_id AND revision_id = p_op.expected_revision_id)
    OR p_op.expected_head_sequence IS DISTINCT FROM (SELECT MAX(committed_version) FROM private.dictionary_content_changes WHERE entry_id = p_op.entry_id AND change_kind = 'revision-head') THEN 'head-conflict'
    WHEN NOT EXISTS (SELECT 1 FROM private.dictionary_meaning_anchor_heads WHERE entry_id = p_op.entry_id AND anchor_id = p_op.anchor_id) THEN 'meaning-anchor-changed' ELSE NULL END;
$$;

CREATE FUNCTION public.reconcile_dictionary_analysis_result_v1(p_actor UUID, p_operation UUID, p_fence TEXT,
  p_result_sha256 TEXT, p_evidence_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_authorized BOOLEAN; v_error TEXT;
BEGIN
  IF p_result_sha256 IS NULL OR p_result_sha256 !~ '^[0-9a-f]{64}$' OR p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-reconciliation-evidence'; END IF;
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor, p_operation, p_fence);
  IF v_op.result_sha256 IS DISTINCT FROM p_result_sha256 THEN RAISE EXCEPTION 'result-evidence-mismatch'; END IF;
  IF v_op.reconciliation_sha256 IS NOT NULL AND v_op.status <> 'provider-outcome-unknown' THEN
    IF v_op.reconciliation_sha256 <> p_evidence_sha256 THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN private.dictionary_analysis_receipt(v_op);
  END IF;
  IF v_op.status <> 'provider-outcome-unknown' THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  IF NOT v_authorized THEN RETURN private.finish_dictionary_analysis(p_actor, p_operation, 'authorization-revoked', 'analysis-permission-revoked'); END IF;
  v_error := private.dictionary_analysis_dependency_error(v_op);
  IF v_error IS NOT NULL THEN RETURN private.finish_dictionary_analysis(p_actor, p_operation,
    CASE WHEN v_error = 'head-conflict' THEN 'head-conflict' ELSE 'rejected' END, v_error); END IF;
  UPDATE private.dictionary_analysis_operations SET status = 'validating', error_code = NULL, reconciliation_sha256 = p_evidence_sha256,
    updated_at = CLOCK_TIMESTAMP() WHERE actor_id = p_actor AND operation_id = p_operation RETURNING * INTO STRICT v_op;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;
CREATE FUNCTION public.record_dictionary_analysis_validation_v1(p_actor UUID, p_operation UUID, p_fence TEXT, p_validation JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_op private.dictionary_analysis_operations%ROWTYPE; v_validation private.dictionary_analysis_validations%ROWTYPE;
  v_policy private.dictionary_analysis_validator_policies%ROWTYPE; v_anchor private.dictionary_meaning_anchors%ROWTYPE;
  v_entry public.dictionary_entries%ROWTYPE; v_result JSONB; v_authorized BOOLEAN; v_error TEXT; v_key TEXT; v_hash TEXT;
  v_outcome TEXT; v_decision TEXT; v_content JSONB; v_content_hash TEXT; v_cefr_hash TEXT;
BEGIN
  IF private.jsonb_has_exact_keys(p_validation, ARRAY['validator_version','policy_sha256','anchor_sha256','input_sha256',
    'result_sha256','meaning_evidence_sha256','outcome','decision_code','content','content_sha256','cefr_input_sha256']) IS NOT TRUE
    OR NOT private.dictionary_bounded_text(p_validation->'validator_version', 100)
    OR JSONB_TYPEOF(p_validation->'outcome') IS DISTINCT FROM 'string' OR JSONB_TYPEOF(p_validation->'decision_code') IS DISTINCT FROM 'string'
    OR p_validation->>'outcome' NOT IN ('accepted','rejected','review-required')
    OR p_validation->>'decision_code' NOT IN ('same-meaning','schema-invalid','unsafe-media','identity-mismatch','meaning-mismatch','meaning-uncertain') THEN RAISE EXCEPTION 'invalid-analysis-validation'; END IF;
  FOREACH v_key IN ARRAY ARRAY['policy_sha256','anchor_sha256','input_sha256','result_sha256','meaning_evidence_sha256'] LOOP
    IF JSONB_TYPEOF(p_validation->v_key) IS DISTINCT FROM 'string' OR (p_validation->>v_key) !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-analysis-validation'; END IF;
  END LOOP;
  v_outcome := p_validation->>'outcome'; v_decision := p_validation->>'decision_code';
  IF NOT ((v_outcome = 'accepted' AND v_decision = 'same-meaning') OR (v_outcome = 'review-required' AND v_decision = 'meaning-uncertain')
    OR (v_outcome = 'rejected' AND v_decision IN ('schema-invalid','unsafe-media','identity-mismatch','meaning-mismatch'))) THEN RAISE EXCEPTION 'invalid-analysis-validation'; END IF;
  IF v_outcome = 'accepted' THEN
    IF JSONB_TYPEOF(p_validation->'content') IS DISTINCT FROM 'object'
      OR JSONB_TYPEOF(p_validation->'content_sha256') IS DISTINCT FROM 'string' OR (p_validation->>'content_sha256') !~ '^[0-9a-f]{64}$'
      OR JSONB_TYPEOF(p_validation->'cefr_input_sha256') IS DISTINCT FROM 'string' OR (p_validation->>'cefr_input_sha256') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-analysis-validation'; END IF;
  ELSIF p_validation->'content' IS DISTINCT FROM 'null'::JSONB OR p_validation->'content_sha256' IS DISTINCT FROM 'null'::JSONB
    OR p_validation->'cefr_input_sha256' IS DISTINCT FROM 'null'::JSONB THEN RAISE EXCEPTION 'invalid-analysis-validation'; END IF;
  v_hash := ENCODE(extensions.digest(CONVERT_TO(p_validation::TEXT, 'UTF8'), 'sha256'), 'hex');
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor, p_operation, p_fence);
  IF v_op.validation_id IS NOT NULL THEN
    SELECT * INTO STRICT v_validation FROM private.dictionary_analysis_validations WHERE validation_id = v_op.validation_id;
    IF v_validation.request_sha256 <> v_hash THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'validation_id', v_validation.validation_id,
      'outcome', v_validation.outcome, 'decision_code', v_validation.decision_code);
  END IF;
  IF v_op.status <> 'validating' OR v_op.result_sha256 IS NULL THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  IF NOT v_authorized THEN RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'authorization-revoked', 'analysis-permission-revoked'), 'validation_id', NULL, 'outcome', NULL, 'decision_code', NULL); END IF;
  v_error := private.dictionary_analysis_dependency_error(v_op);
  IF v_error IS NOT NULL THEN RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation,
    CASE WHEN v_error = 'head-conflict' THEN 'head-conflict' ELSE 'rejected' END, v_error), 'validation_id', NULL, 'outcome', NULL, 'decision_code', NULL); END IF;
  SELECT * INTO STRICT v_anchor FROM private.dictionary_meaning_anchors WHERE anchor_id = v_op.anchor_id;
  IF v_anchor.anchor_sha256 IS DISTINCT FROM p_validation->>'anchor_sha256' OR v_op.input_sha256 IS DISTINCT FROM p_validation->>'input_sha256'
    OR v_op.result_sha256 IS DISTINCT FROM p_validation->>'result_sha256' THEN RAISE EXCEPTION 'validation-evidence-mismatch'; END IF;
  SELECT * INTO v_policy FROM private.dictionary_analysis_validator_policies
    WHERE validator_version = p_validation->>'validator_version' AND policy_sha256 = p_validation->>'policy_sha256' FOR SHARE;
  IF NOT FOUND OR NOT v_policy.enabled THEN RAISE EXCEPTION 'validator-policy-unavailable'; END IF;
  IF v_outcome = 'accepted' THEN
    SELECT result INTO STRICT v_result FROM private.dictionary_analysis_results WHERE actor_id = p_actor AND operation_id = p_operation;
    v_content := p_validation->'content';
    IF v_result->'content' IS DISTINCT FROM v_content THEN RAISE EXCEPTION 'validation-result-content-mismatch'; END IF;
    IF private.valid_dictionary_analysis_content(v_content) IS NOT TRUE THEN v_outcome := 'rejected'; v_decision := 'schema-invalid';
    ELSE
      SELECT * INTO STRICT v_entry FROM public.dictionary_entries WHERE entry_id = v_op.entry_id;
      IF v_entry.language_code <> 'nl' OR v_content->>'dutch_lemma' IS DISTINCT FROM v_entry.lemma
        OR v_content->>'part_of_speech' IS DISTINCT FROM v_entry.part_of_speech OR v_content->>'article' IS DISTINCT FROM v_entry.article THEN v_outcome := 'rejected'; v_decision := 'identity-mismatch';
      ELSIF private.safe_dictionary_analysis_media(v_content->'image_url', v_policy.media_url_prefixes) IS NOT TRUE
        OR private.safe_dictionary_analysis_media(v_content->'tts_url', v_policy.media_url_prefixes) IS NOT TRUE THEN v_outcome := 'rejected'; v_decision := 'unsafe-media';
      ELSE
        v_content_hash := private.dictionary_canonical_sha256(v_content); v_cefr_hash := private.dictionary_cefr_content_sha256(v_content);
        IF v_content_hash IS DISTINCT FROM p_validation->>'content_sha256' OR v_cefr_hash IS DISTINCT FROM p_validation->>'cefr_input_sha256' THEN RAISE EXCEPTION 'validation-content-hash-mismatch'; END IF;
      END IF;
    END IF;
  END IF;
  IF v_outcome <> 'accepted' THEN v_content := NULL; v_content_hash := NULL; v_cefr_hash := NULL; END IF;
  INSERT INTO private.dictionary_analysis_validations(actor_id, operation_id, entry_id, expected_revision_id, expected_head_sequence,
    anchor_id, anchor_sha256, fence, validator_version, policy_sha256, provider, model, input_sha256, result_sha256, request_sha256,
    meaning_evidence_sha256, outcome, decision_code, content, content_sha256, cefr_input_sha256)
    VALUES (p_actor, p_operation, v_op.entry_id, v_op.expected_revision_id, v_op.expected_head_sequence, v_op.anchor_id, v_anchor.anchor_sha256,
      v_op.fence, v_policy.validator_version, v_policy.policy_sha256, v_op.provider, v_op.model, v_op.input_sha256, v_op.result_sha256, v_hash,
      p_validation->>'meaning_evidence_sha256', v_outcome, v_decision, v_content, v_content_hash, v_cefr_hash) RETURNING * INTO STRICT v_validation;
  UPDATE private.dictionary_analysis_operations SET validation_id = v_validation.validation_id, updated_at = CLOCK_TIMESTAMP()
    WHERE actor_id = p_actor AND operation_id = p_operation RETURNING * INTO STRICT v_op;
  IF v_outcome <> 'accepted' THEN
    PERFORM private.finish_dictionary_analysis(p_actor, p_operation, 'rejected', CASE WHEN v_outcome = 'review-required' THEN 'validation-review-required' ELSE 'validation-rejected' END);
    SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  END IF;
  RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'validation_id', v_validation.validation_id,
    'outcome', v_validation.outcome, 'decision_code', v_validation.decision_code);
END;
$$;

CREATE FUNCTION public.publish_dictionary_analysis_v1(p_actor UUID, p_operation UUID, p_fence TEXT, p_validation UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_op private.dictionary_analysis_operations%ROWTYPE; v_validation private.dictionary_analysis_validations%ROWTYPE;
  v_current public.dictionary_revisions%ROWTYPE; v_authorized BOOLEAN; v_enabled BOOLEAN; v_policy_enabled BOOLEAN;
  v_error TEXT; v_revision UUID; v_source UUID; v_revision_no INTEGER; v_sequence BIGINT;
BEGIN
  v_authorized := private.lock_dictionary_analysis_authority(p_actor);
  v_op := private.lock_dictionary_analysis_operation(p_actor, p_operation, p_fence);
  IF v_op.validation_id IS DISTINCT FROM p_validation OR p_validation IS NULL THEN RAISE EXCEPTION 'validation-evidence-mismatch'; END IF;
  -- Lost publication replies replay even after role/policy/feature revocation.
  IF v_op.status NOT IN ('validating','provider-outcome-unknown','accepted','dispatching') THEN RETURN private.dictionary_analysis_receipt(v_op); END IF;
  IF v_op.status <> 'validating' THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  SELECT analysis_operations_enabled AND analysis_publication_enabled INTO STRICT v_enabled
    FROM private.dictionary_content_runtime WHERE singleton FOR SHARE;
  IF NOT v_enabled THEN RAISE EXCEPTION 'shared-publication-disabled'; END IF;
  IF NOT v_authorized THEN RETURN private.finish_dictionary_analysis(p_actor, p_operation, 'authorization-revoked', 'analysis-permission-revoked'); END IF;
  v_error := private.dictionary_analysis_dependency_error(v_op);
  IF v_error IS NOT NULL THEN RETURN private.finish_dictionary_analysis(p_actor, p_operation,
    CASE WHEN v_error = 'head-conflict' THEN 'head-conflict' ELSE 'rejected' END, v_error); END IF;
  SELECT * INTO STRICT v_validation FROM private.dictionary_analysis_validations WHERE validation_id = p_validation;
  IF ROW(v_validation.actor_id, v_validation.operation_id, v_validation.entry_id, v_validation.fence, v_validation.anchor_id,
    v_validation.input_sha256, v_validation.result_sha256, v_validation.expected_revision_id, v_validation.expected_head_sequence)
    IS DISTINCT FROM ROW(p_actor, p_operation, v_op.entry_id, v_op.fence, v_op.anchor_id, v_op.input_sha256, v_op.result_sha256,
      v_op.expected_revision_id, v_op.expected_head_sequence) OR v_validation.outcome <> 'accepted' THEN RAISE EXCEPTION 'validation-evidence-mismatch'; END IF;
  SELECT enabled INTO v_policy_enabled FROM private.dictionary_analysis_validator_policies
    WHERE validator_version = v_validation.validator_version AND policy_sha256 = v_validation.policy_sha256 FOR SHARE;
  IF v_policy_enabled IS DISTINCT FROM TRUE THEN RETURN private.finish_dictionary_analysis(p_actor, p_operation, 'rejected', 'validator-policy-revoked'); END IF;
  SELECT * INTO STRICT v_current FROM public.dictionary_revisions WHERE revision_id = v_op.expected_revision_id;
  IF v_validation.content_sha256 = v_current.content_sha256 AND v_validation.content = v_current.content THEN
    v_revision := v_current.revision_id; v_sequence := v_op.expected_head_sequence;
    UPDATE private.dictionary_analysis_operations SET status = 'no-change', published_revision_id = v_revision,
      published_head_sequence = v_sequence, updated_at = CLOCK_TIMESTAMP() WHERE actor_id = p_actor AND operation_id = p_operation;
  ELSE
    v_revision := pg_catalog.gen_random_uuid(); v_source := pg_catalog.gen_random_uuid();
    SELECT COALESCE(MAX(revision_no), 0) + 1 INTO v_revision_no FROM public.dictionary_revisions WHERE entry_id = v_op.entry_id;
    INSERT INTO private.dictionary_analysis_publications(validation_id, entry_id, revision_id, source_id)
      VALUES (v_validation.validation_id, v_op.entry_id, v_revision, v_source);
    INSERT INTO private.dictionary_sources(source_id, source_kind, provenance_locator, license_metadata, review_state, automated_validation_id)
      VALUES (v_source, 'provider', 'automated-validation:' || v_validation.validation_id::TEXT,
        JSONB_BUILD_OBJECT('protected_anchor_source_id', (SELECT source_id FROM private.dictionary_meaning_anchors WHERE anchor_id = v_op.anchor_id)),
        'machine_validated', v_validation.validation_id);
    INSERT INTO public.dictionary_revisions(revision_id, entry_id, revision_no, schema_version, content, content_sha256,
      cefr_input_sha256, source_id, review_status, reviewed_at, published_at)
      VALUES (v_revision, v_op.entry_id, v_revision_no, 1, v_validation.content, v_validation.content_sha256,
        v_validation.cefr_input_sha256, v_source, 'published', NULL, CLOCK_TIMESTAMP());
    UPDATE public.dictionary_entry_heads SET revision_id = v_revision WHERE entry_id = v_op.entry_id;
    SELECT MAX(committed_version) INTO STRICT v_sequence FROM private.dictionary_content_changes WHERE entry_id = v_op.entry_id AND change_kind = 'revision-head';
    UPDATE private.dictionary_analysis_operations SET status = 'published', published_revision_id = v_revision,
      published_head_sequence = v_sequence, updated_at = CLOCK_TIMESTAMP() WHERE actor_id = p_actor AND operation_id = p_operation;
  END IF;
  UPDATE private.dictionary_analysis_leases SET actor_id = NULL, operation_id = NULL, expires_at = NULL
    WHERE entry_id = v_op.entry_id AND fence = v_op.fence AND actor_id = p_actor AND operation_id = p_operation;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;

CREATE FUNCTION public.get_dictionary_revision_provenance_v2(p_revision_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF p_revision_ids IS NULL OR CARDINALITY(p_revision_ids) > 500 OR ARRAY_POSITION(p_revision_ids, NULL) IS NOT NULL THEN RAISE EXCEPTION 'invalid-provenance-batch'; END IF;
  RETURN (SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('revision_id', r.revision_id,
    'method', CASE WHEN s.review_state = 'machine_validated' THEN 'automated' ELSE 'human' END,
    'validator_version', v.validator_version, 'provider', v.provider, 'model', v.model,
    'content_sha256', r.content_sha256, 'verified_at', COALESCE(v.validated_at, r.reviewed_at)) ORDER BY r.revision_id), '[]'::JSONB)
    FROM public.dictionary_revisions r JOIN private.dictionary_sources s USING (source_id)
    LEFT JOIN private.dictionary_analysis_validations v ON v.validation_id = s.automated_validation_id
    WHERE r.revision_id = ANY(p_revision_ids) AND ((r.review_status = 'published'
      AND EXISTS (SELECT 1 FROM public.dictionary_entries e WHERE e.entry_id = r.entry_id AND e.state = 'published'))
      OR (r.review_status IN ('published','retired') AND EXISTS (SELECT 1 FROM public.words w
        WHERE w.user_id = auth.uid() AND w.dictionary_entry_id = r.entry_id AND w.dictionary_revision_id = r.revision_id))));
END;
$$;

ALTER TABLE private.dictionary_analysis_validator_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_analysis_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_analysis_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_analysis_validator_policies, private.dictionary_analysis_validations,
  private.dictionary_analysis_publications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON private.dictionary_analysis_validator_policies TO service_role;
GRANT UPDATE (enabled) ON private.dictionary_analysis_validator_policies TO service_role;
GRANT SELECT ON private.dictionary_analysis_validations, private.dictionary_analysis_publications TO service_role;
REVOKE ALL ON FUNCTION private.protect_dictionary_analysis_validation(), private.guard_dictionary_machine_source(),
  private.dictionary_canonical_sha256(JSONB), private.dictionary_cefr_content_sha256(JSONB),
  private.dictionary_utf16_length(TEXT), private.dictionary_bounded_text(JSONB, INTEGER, BOOLEAN), private.dictionary_bounded_strings(JSONB, INTEGER, INTEGER),
  private.dictionary_bounded_example(JSONB), private.valid_dictionary_analysis_content(JSONB), private.safe_dictionary_analysis_media(JSONB, TEXT[]),
  private.lock_dictionary_analysis_authority(UUID), private.lock_dictionary_analysis_operation(UUID, UUID, TEXT),
  private.dictionary_analysis_dependency_error(private.dictionary_analysis_operations) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reconcile_dictionary_analysis_result_v1(UUID, UUID, TEXT, TEXT, TEXT),
  public.record_dictionary_analysis_validation_v1(UUID, UUID, TEXT, JSONB), public.publish_dictionary_analysis_v1(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_dictionary_analysis_result_v1(UUID, UUID, TEXT, TEXT, TEXT),
  public.record_dictionary_analysis_validation_v1(UUID, UUID, TEXT, JSONB), public.publish_dictionary_analysis_v1(UUID, UUID, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.get_dictionary_revision_provenance_v2(UUID[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_dictionary_revision_provenance_v2(UUID[]) TO authenticated;
COMMENT ON TABLE private.dictionary_analysis_validations IS 'Immutable machine validation evidence, separate from human review; actor UUID redacted on Auth deletion.';
COMMENT ON TABLE private.dictionary_analysis_publications IS 'Immutable permits and provenance for atomic guarded machine publications; no direct service-role writes.';
COMMENT ON COLUMN private.dictionary_content_runtime.analysis_publication_enabled IS 'Default-off publication gate; provider workflow and shared-analysis capability remain unavailable pending later integration.';
COMMIT;
