-- Dormant trusted authority and durable analysis journal. No provider dispatch,
-- publication, grants to real users, or conversion of existing cards is performed.
BEGIN;

ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN analysis_operations_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN analysis_quota_limit INTEGER NOT NULL DEFAULT 10 CHECK (analysis_quota_limit BETWEEN 1 AND 1000),
  ADD COLUMN analysis_quota_window_seconds INTEGER NOT NULL DEFAULT 60 CHECK (analysis_quota_window_seconds BETWEEN 1 AND 86400);

CREATE TABLE private.dictionary_administrators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handle_dictionary_administrators_updated_at
  BEFORE UPDATE ON private.dictionary_administrators FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- A reviewed, neutral meaning anchor is separate from generated content. The
-- service must supply explicit human evidence; analysis permission cannot approve it.
CREATE TABLE private.dictionary_meaning_anchors (
  anchor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id) ON DELETE RESTRICT,
  gloss TEXT NOT NULL CHECK (LENGTH(BTRIM(gloss)) BETWEEN 1 AND 4000),
  examples JSONB NOT NULL CHECK (JSONB_TYPEOF(examples) = 'array' AND JSONB_ARRAY_LENGTH(examples) BETWEEN 1 AND 20),
  verified_by UUID NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  audit_reference TEXT NOT NULL CHECK (LENGTH(BTRIM(audit_reference)) BETWEEN 1 AND 500),
  anchor_sha256 TEXT NOT NULL CHECK (anchor_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (entry_id, anchor_id)
);
-- Anchor evidence also freezes sources not yet used by a revision.
CREATE FUNCTION private.protect_dictionary_anchor_source()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.dictionary_meaning_anchors WHERE source_id = OLD.source_id) THEN
    RAISE EXCEPTION 'Referenced dictionary provenance is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dictionary_anchor_source BEFORE UPDATE OR DELETE ON private.dictionary_sources
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_anchor_source();
CREATE INDEX dictionary_meaning_anchor_source ON private.dictionary_meaning_anchors(source_id);
CREATE TABLE private.dictionary_meaning_anchor_heads (
  entry_id UUID PRIMARY KEY,
  anchor_id UUID NOT NULL,
  FOREIGN KEY (entry_id, anchor_id) REFERENCES private.dictionary_meaning_anchors(entry_id, anchor_id) ON DELETE RESTRICT
);
CREATE FUNCTION private.lock_dictionary_anchor_entry()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.entry_id IS DISTINCT FROM OLD.entry_id THEN RAISE EXCEPTION 'meaning-anchor-entry-immutable'; END IF;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.entry_id ELSE NEW.entry_id END FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lock_dictionary_anchor_entry BEFORE INSERT OR UPDATE OR DELETE ON private.dictionary_meaning_anchor_heads
  FOR EACH ROW EXECUTE FUNCTION private.lock_dictionary_anchor_entry();
CREATE FUNCTION private.validate_dictionary_meaning_anchor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_source private.dictionary_sources%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_source FROM private.dictionary_sources WHERE source_id = NEW.source_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.verified_by)
    OR v_source.review_state <> 'approved' OR v_source.reviewed_by IS DISTINCT FROM NEW.verified_by
    OR NEW.verified_at < v_source.reviewed_at
    OR EXISTS (SELECT 1 FROM JSONB_ARRAY_ELEMENTS(NEW.examples) e
      WHERE JSONB_TYPEOF(e) <> 'string' OR LENGTH(BTRIM(e #>> '{}')) NOT BETWEEN 1 AND 4000) THEN
    RAISE EXCEPTION 'unverified-meaning-anchor';
  END IF;
  NEW.anchor_sha256 := ENCODE(extensions.digest(CONVERT_TO(JSONB_BUILD_OBJECT(
    'entry_id', NEW.entry_id, 'source_id', NEW.source_id, 'gloss', NEW.gloss,
    'examples', NEW.examples, 'verified_by', NEW.verified_by, 'verified_at', NEW.verified_at,
    'audit_reference', NEW.audit_reference)::TEXT, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_dictionary_meaning_anchor BEFORE INSERT ON private.dictionary_meaning_anchors
  FOR EACH ROW EXECUTE FUNCTION private.validate_dictionary_meaning_anchor();
CREATE TRIGGER protect_dictionary_meaning_anchor BEFORE UPDATE OR DELETE ON private.dictionary_meaning_anchors
  FOR EACH ROW EXECUTE FUNCTION private.reject_dictionary_history_mutation();

CREATE TABLE private.dictionary_analysis_operations (
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_revision_id UUID NOT NULL,
  expected_head_sequence BIGINT NOT NULL CHECK (expected_head_sequence >= 0),
  anchor_id UUID NOT NULL,
  fence BIGINT NOT NULL CHECK (fence > 0),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'dispatching', 'validating', 'published', 'no-change',
    'rejected', 'head-conflict', 'authorization-revoked', 'provider-failed', 'provider-outcome-unknown')),
  quota_charged BOOLEAN NOT NULL DEFAULT TRUE CHECK (quota_charged),
  provider TEXT,
  model TEXT,
  input_sha256 TEXT CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  result_sha256 TEXT CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  error_code TEXT,
  reconciliation_sha256 TEXT CHECK (reconciliation_sha256 ~ '^[0-9a-f]{64}$'),
  published_revision_id UUID,
  published_head_sequence BIGINT CHECK (published_head_sequence >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_id, operation_id),
  FOREIGN KEY (entry_id, expected_revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id) ON DELETE RESTRICT,
  FOREIGN KEY (entry_id, anchor_id) REFERENCES private.dictionary_meaning_anchors(entry_id, anchor_id) ON DELETE RESTRICT,
  FOREIGN KEY (entry_id, published_revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id) ON DELETE RESTRICT,
  CHECK ((provider IS NULL AND model IS NULL AND input_sha256 IS NULL AND dispatched_at IS NULL)
    OR (provider IS NOT NULL AND model IS NOT NULL AND LENGTH(BTRIM(provider)) BETWEEN 1 AND 100 AND LENGTH(BTRIM(model)) BETWEEN 1 AND 200
      AND input_sha256 IS NOT NULL AND dispatched_at IS NOT NULL)),
  CHECK (status NOT IN ('dispatching', 'validating', 'provider-outcome-unknown', 'published', 'no-change') OR dispatched_at IS NOT NULL),
  CHECK (status NOT IN ('validating', 'published', 'no-change') OR result_sha256 IS NOT NULL),
  CHECK (status NOT IN ('accepted', 'dispatching') OR result_sha256 IS NULL),
  CHECK ((status IN ('published', 'no-change') AND published_revision_id IS NOT NULL AND published_head_sequence IS NOT NULL)
    OR (status NOT IN ('published', 'no-change') AND published_revision_id IS NULL AND published_head_sequence IS NULL)),
  CHECK ((status IN ('accepted', 'dispatching', 'validating', 'published', 'no-change') AND error_code IS NULL)
    OR (status NOT IN ('accepted', 'dispatching', 'validating', 'published', 'no-change') AND error_code IS NOT NULL))
);
CREATE INDEX dictionary_analysis_owner_history ON private.dictionary_analysis_operations(actor_id, created_at DESC, operation_id DESC);
CREATE TABLE private.dictionary_analysis_leases (
  entry_id UUID PRIMARY KEY REFERENCES public.dictionary_entries(entry_id) ON DELETE RESTRICT,
  fence BIGINT NOT NULL DEFAULT 0 CHECK (fence >= 0),
  actor_id UUID,
  operation_id UUID,
  expires_at TIMESTAMPTZ,
  FOREIGN KEY (actor_id, operation_id) REFERENCES private.dictionary_analysis_operations(actor_id, operation_id) ON DELETE SET NULL,
  CHECK ((actor_id IS NULL AND operation_id IS NULL) OR (actor_id IS NOT NULL AND operation_id IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE TABLE private.dictionary_analysis_results (
  actor_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  result JSONB NOT NULL CHECK (JSONB_TYPEOF(result) = 'object' AND OCTET_LENGTH(result::TEXT) <= 262144),
  result_sha256 TEXT NOT NULL CHECK (result_sha256 ~ '^[0-9a-f]{64}$'),
  provider_request_id TEXT NOT NULL CHECK (LENGTH(BTRIM(provider_request_id)) BETWEEN 1 AND 200),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_id, operation_id),
  FOREIGN KEY (actor_id, operation_id) REFERENCES private.dictionary_analysis_operations(actor_id, operation_id) ON DELETE CASCADE
);
-- Immutable while the actor exists; Auth deletion follows the existing privacy policy.
CREATE FUNCTION private.protect_dictionary_analysis_result()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.actor_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'dictionary analysis results are immutable';
END;
$$;
CREATE TRIGGER protect_dictionary_analysis_result BEFORE UPDATE OR DELETE ON private.dictionary_analysis_results
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_analysis_result();

CREATE FUNCTION private.may_analyze_dictionary(p_actor UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) AND (
    EXISTS (SELECT 1 FROM public.user_access_levels WHERE user_id = p_actor AND access_level = 'full_access')
    OR EXISTS (SELECT 1 FROM private.dictionary_administrators WHERE user_id = p_actor AND enabled));
$$;
CREATE FUNCTION private.dictionary_analysis_receipt(p_operation private.dictionary_analysis_operations)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT JSONB_BUILD_OBJECT('protocol_version', 2, 'operation_id', p_operation.operation_id,
    'entry_id', p_operation.entry_id, 'expected_revision_id', p_operation.expected_revision_id,
    'expected_head_sequence', p_operation.expected_head_sequence::TEXT, 'fence', p_operation.fence::TEXT,
    'status', p_operation.status, 'quota_charged', p_operation.quota_charged,
    'result_sha256', p_operation.result_sha256, 'error_code', p_operation.error_code,
    'published_revision_id', p_operation.published_revision_id,
    'published_head_sequence', p_operation.published_head_sequence::TEXT);
$$;
CREATE FUNCTION private.finish_dictionary_analysis(p_actor UUID, p_operation UUID, p_status TEXT, p_error TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE;
BEGIN
  UPDATE private.dictionary_analysis_operations SET status = p_status, error_code = p_error, updated_at = CLOCK_TIMESTAMP()
    WHERE actor_id = p_actor AND operation_id = p_operation RETURNING * INTO STRICT v_op;
  -- Unknown outcome remains quarantined regardless of elapsed lease time.
  IF p_status <> 'provider-outcome-unknown' THEN
    UPDATE private.dictionary_analysis_leases SET actor_id = NULL, operation_id = NULL, expires_at = NULL
      WHERE entry_id = v_op.entry_id AND fence = v_op.fence AND actor_id = p_actor AND operation_id = p_operation;
  END IF;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;

CREATE FUNCTION public.accept_dictionary_analysis_v2(p_command JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_id UUID; v_entry UUID; v_revision UUID; v_sequence BIGINT; v_hash TEXT;
  v_op private.dictionary_analysis_operations%ROWTYPE;
  v_lease private.dictionary_analysis_leases%ROWTYPE;
  v_runtime private.dictionary_content_runtime%ROWTYPE;
  v_anchor UUID; v_allowed BOOLEAN;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_actor) THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF private.jsonb_has_exact_keys(p_command, ARRAY['protocol_version', 'operation_id', 'entry_id', 'expected_revision_id', 'expected_head_sequence']) IS NOT TRUE
    OR p_command->'protocol_version' IS DISTINCT FROM '2'::JSONB
    OR JSONB_TYPEOF(p_command->'operation_id') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_command->'entry_id') IS DISTINCT FROM 'string'
    OR JSONB_TYPEOF(p_command->'expected_revision_id') IS DISTINCT FROM 'string'
    OR (p_command->>'operation_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR (p_command->>'entry_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR (p_command->>'expected_revision_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR JSONB_TYPEOF(p_command->'expected_head_sequence') IS DISTINCT FROM 'string'
    OR (p_command->>'expected_head_sequence') !~ '^(0|[1-9][0-9]{0,18})$'
    OR (p_command->>'expected_head_sequence')::NUMERIC > 9223372036854775807 THEN RAISE EXCEPTION 'invalid-analysis-command'; END IF;
  BEGIN
    v_id := (p_command->>'operation_id')::UUID; v_entry := (p_command->>'entry_id')::UUID;
    v_revision := (p_command->>'expected_revision_id')::UUID; v_sequence := (p_command->>'expected_head_sequence')::BIGINT;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid-analysis-command'; END;
  v_hash := ENCODE(extensions.digest(CONVERT_TO(p_command::TEXT, 'UTF8'), 'sha256'), 'hex');
  -- Serialize same-key requests even when they target different entries.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::TEXT || '/' || v_id::TEXT, 0));
  SELECT * INTO v_op FROM private.dictionary_analysis_operations WHERE actor_id = v_actor AND operation_id = v_id;
  IF FOUND THEN
    IF v_op.request_sha256 <> v_hash THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN private.dictionary_analysis_receipt(v_op);
  END IF;
  SELECT * INTO STRICT v_runtime FROM private.dictionary_content_runtime WHERE singleton;
  IF NOT v_runtime.analysis_operations_enabled THEN RAISE EXCEPTION 'shared-analysis-disabled'; END IF;
  IF NOT private.may_analyze_dictionary(v_actor) THEN RAISE EXCEPTION 'analysis-permission-required'; END IF;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_entry AND state = 'published' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'entry-unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id = v_entry AND revision_id = v_revision)
    OR v_sequence IS DISTINCT FROM (SELECT MAX(committed_version) FROM private.dictionary_content_changes
      WHERE entry_id = v_entry AND change_kind = 'revision-head') THEN RAISE EXCEPTION 'head-conflict'; END IF;
  SELECT anchor_id INTO v_anchor FROM private.dictionary_meaning_anchor_heads WHERE entry_id = v_entry;
  IF v_anchor IS NULL THEN RAISE EXCEPTION 'meaning-anchor-required'; END IF;
  INSERT INTO private.dictionary_analysis_leases(entry_id) VALUES (v_entry) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_lease FROM private.dictionary_analysis_leases WHERE entry_id = v_entry FOR UPDATE;
  IF v_lease.actor_id IS NOT NULL THEN
    SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations
      WHERE actor_id = v_lease.actor_id AND operation_id = v_lease.operation_id FOR UPDATE;
    IF v_op.status = 'accepted' AND v_lease.expires_at <= CLOCK_TIMESTAMP() THEN
      PERFORM private.finish_dictionary_analysis(v_op.actor_id, v_op.operation_id, 'provider-failed', 'lease-expired-before-dispatch');
    ELSIF v_op.status = 'dispatching' AND v_lease.expires_at <= CLOCK_TIMESTAMP() THEN
      -- Return a busy outcome instead of raising, so quarantine commits durably.
      PERFORM private.finish_dictionary_analysis(v_op.actor_id, v_op.operation_id, 'provider-outcome-unknown', 'lease-expired-after-dispatch');
      RETURN JSONB_BUILD_OBJECT('protocol_version', 2, 'outcome', 'analysis-in-progress');
    ELSE RETURN JSONB_BUILD_OBJECT('protocol_version', 2, 'outcome', 'analysis-in-progress'); END IF;
  END IF;
  SELECT allowed INTO STRICT v_allowed FROM public.consume_edge_function_quota(v_actor, 'gemini-analysis',
    v_runtime.analysis_quota_limit, v_runtime.analysis_quota_window_seconds);
  IF NOT v_allowed THEN RAISE EXCEPTION 'rate-limit-exceeded'; END IF;
  UPDATE private.dictionary_analysis_leases SET fence = fence + 1, expires_at = CLOCK_TIMESTAMP() + INTERVAL '5 minutes'
    WHERE entry_id = v_entry RETURNING * INTO STRICT v_lease;
  INSERT INTO private.dictionary_analysis_operations(actor_id, operation_id, entry_id, request_sha256,
    expected_revision_id, expected_head_sequence, anchor_id, fence, status)
    VALUES (v_actor, v_id, v_entry, v_hash, v_revision, v_sequence, v_anchor, v_lease.fence, 'accepted') RETURNING * INTO STRICT v_op;
  UPDATE private.dictionary_analysis_leases SET actor_id = v_actor, operation_id = v_id WHERE entry_id = v_entry;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;

-- Caller receives a dispatch payload only on the first committed transition.
-- Retrying this RPC never returns another permission to invoke the provider.
CREATE FUNCTION public.start_dictionary_analysis_dispatch_v1(p_actor UUID, p_operation UUID, p_fence TEXT,
  p_provider TEXT, p_model TEXT, p_input_sha256 TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_lease private.dictionary_analysis_leases%ROWTYPE; v_payload JSONB;
BEGIN
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_op.entry_id FOR UPDATE;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation FOR UPDATE;
  SELECT * INTO STRICT v_lease FROM private.dictionary_analysis_leases WHERE entry_id = v_op.entry_id FOR UPDATE;
  IF p_fence IS DISTINCT FROM v_op.fence::TEXT THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  IF v_op.dispatched_at IS NOT NULL AND ROW(v_op.provider, v_op.model, v_op.input_sha256)
    IS DISTINCT FROM ROW(p_provider, p_model, p_input_sha256) THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
  IF v_op.status <> 'accepted' THEN
    IF v_op.status = 'dispatching' AND v_lease.expires_at <= CLOCK_TIMESTAMP() THEN
      RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'provider-outcome-unknown', 'lease-expired-after-dispatch'), 'dispatch', NULL);
    END IF;
    RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'dispatch', NULL);
  END IF;
  IF ROW(v_lease.actor_id, v_lease.operation_id, v_lease.fence) IS DISTINCT FROM ROW(p_actor, p_operation, v_op.fence) THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  IF v_lease.expires_at <= CLOCK_TIMESTAMP() THEN
    RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'provider-failed', 'lease-expired-before-dispatch'), 'dispatch', NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_content_runtime WHERE singleton AND analysis_operations_enabled)
    OR NOT private.may_analyze_dictionary(p_actor) THEN
    RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'authorization-revoked', 'analysis-permission-revoked'), 'dispatch', NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dictionary_entry_heads WHERE entry_id = v_op.entry_id AND revision_id = v_op.expected_revision_id)
    OR v_op.expected_head_sequence IS DISTINCT FROM (SELECT MAX(committed_version) FROM private.dictionary_content_changes
      WHERE entry_id = v_op.entry_id AND change_kind = 'revision-head') THEN
    RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'head-conflict', 'head-conflict'), 'dispatch', NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_meaning_anchor_heads WHERE entry_id = v_op.entry_id AND anchor_id = v_op.anchor_id) THEN
    RETURN JSONB_BUILD_OBJECT('receipt', private.finish_dictionary_analysis(p_actor, p_operation, 'rejected', 'meaning-anchor-changed'), 'dispatch', NULL);
  END IF;
  IF p_provider IS NULL OR LENGTH(BTRIM(p_provider)) NOT BETWEEN 1 AND 100
    OR p_model IS NULL OR LENGTH(BTRIM(p_model)) NOT BETWEEN 1 AND 200
    OR p_input_sha256 IS NULL OR p_input_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid-dispatch-metadata'; END IF;
  UPDATE private.dictionary_analysis_operations SET status = 'dispatching', provider = p_provider, model = p_model,
    input_sha256 = p_input_sha256, dispatched_at = CLOCK_TIMESTAMP(), updated_at = CLOCK_TIMESTAMP()
    WHERE actor_id = p_actor AND operation_id = p_operation RETURNING * INTO STRICT v_op;
  UPDATE private.dictionary_analysis_leases SET expires_at = CLOCK_TIMESTAMP() + INTERVAL '5 minutes' WHERE entry_id = v_op.entry_id;
  SELECT JSONB_BUILD_OBJECT('entry', JSONB_BUILD_OBJECT('entry_id', e.entry_id, 'language_code', e.language_code,
    'lemma', e.lemma, 'part_of_speech', e.part_of_speech, 'article', e.article, 'sense_key', e.sense_key),
    'anchor', JSONB_BUILD_OBJECT('anchor_id', a.anchor_id, 'gloss', a.gloss, 'examples', a.examples, 'anchor_sha256', a.anchor_sha256))
    INTO STRICT v_payload FROM public.dictionary_entries e JOIN private.dictionary_meaning_anchors a ON a.entry_id = e.entry_id
    WHERE e.entry_id = v_op.entry_id AND a.anchor_id = v_op.anchor_id;
  RETURN JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(v_op), 'dispatch', v_payload);
END;
$$;

CREATE FUNCTION public.journal_dictionary_analysis_result_v1(p_actor UUID, p_operation UUID, p_fence TEXT,
  p_result JSONB, p_provider_request_id TEXT)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_lease private.dictionary_analysis_leases%ROWTYPE; v_hash TEXT;
BEGIN
  IF p_result IS NULL OR JSONB_TYPEOF(p_result) <> 'object' OR OCTET_LENGTH(p_result::TEXT) > 262144
    OR p_provider_request_id IS NULL OR LENGTH(BTRIM(p_provider_request_id)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid-analysis-result'; END IF;
  v_hash := ENCODE(extensions.digest(CONVERT_TO(p_result::TEXT, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_op.entry_id FOR UPDATE;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation FOR UPDATE;
  SELECT * INTO STRICT v_lease FROM private.dictionary_analysis_leases WHERE entry_id = v_op.entry_id FOR UPDATE;
  IF p_fence IS DISTINCT FROM v_op.fence::TEXT THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  IF v_op.result_sha256 IS NOT NULL THEN
    IF v_hash <> v_op.result_sha256 OR NOT EXISTS (SELECT 1 FROM private.dictionary_analysis_results
      WHERE actor_id = p_actor AND operation_id = p_operation AND provider_request_id = p_provider_request_id) THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN private.dictionary_analysis_receipt(v_op);
  END IF;
  IF v_op.status NOT IN ('dispatching', 'provider-outcome-unknown') THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  IF ROW(v_lease.actor_id, v_lease.operation_id, v_lease.fence) IS DISTINCT FROM ROW(p_actor, p_operation, v_op.fence) THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  -- A returned response is known evidence even after its lease timed out. Journal
  -- it, but quarantine late results until explicit reconciliation/validation exists.
  INSERT INTO private.dictionary_analysis_results(actor_id, operation_id, result, result_sha256, provider_request_id)
    VALUES (p_actor, p_operation, p_result, v_hash, p_provider_request_id);
  UPDATE private.dictionary_analysis_operations SET result_sha256 = v_hash, status = CASE
    WHEN v_op.status = 'provider-outcome-unknown' OR v_lease.expires_at <= CLOCK_TIMESTAMP() THEN 'provider-outcome-unknown' ELSE 'validating' END,
    error_code = CASE WHEN v_op.status = 'provider-outcome-unknown' OR v_lease.expires_at <= CLOCK_TIMESTAMP() THEN 'late-provider-result' ELSE NULL END,
    updated_at = CLOCK_TIMESTAMP() WHERE actor_id = p_actor AND operation_id = p_operation RETURNING * INTO STRICT v_op;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;

CREATE FUNCTION public.record_dictionary_analysis_failure_v1(p_actor UUID, p_operation UUID, p_fence TEXT,
  p_outcome TEXT, p_evidence_sha256 TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE; v_lease private.dictionary_analysis_leases%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('provider-failed', 'provider-outcome-unknown')
    OR (p_outcome = 'provider-failed' AND (p_evidence_sha256 IS NULL OR p_evidence_sha256 !~ '^[0-9a-f]{64}$')) THEN RAISE EXCEPTION 'invalid-provider-outcome'; END IF;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = v_op.entry_id FOR UPDATE;
  SELECT * INTO STRICT v_op FROM private.dictionary_analysis_operations WHERE actor_id = p_actor AND operation_id = p_operation FOR UPDATE;
  SELECT * INTO STRICT v_lease FROM private.dictionary_analysis_leases WHERE entry_id = v_op.entry_id FOR UPDATE;
  IF p_fence IS DISTINCT FROM v_op.fence::TEXT THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  IF v_op.status = p_outcome THEN
    IF v_op.reconciliation_sha256 IS DISTINCT FROM p_evidence_sha256 THEN RAISE EXCEPTION 'operation-payload-conflict'; END IF;
    RETURN private.dictionary_analysis_receipt(v_op);
  END IF;
  IF v_op.status NOT IN ('dispatching', 'provider-outcome-unknown') OR v_op.result_sha256 IS NOT NULL THEN RAISE EXCEPTION 'invalid-analysis-transition'; END IF;
  IF ROW(v_lease.actor_id, v_lease.operation_id, v_lease.fence) IS DISTINCT FROM ROW(p_actor, p_operation, v_op.fence) THEN RAISE EXCEPTION 'stale-analysis-fence'; END IF;
  UPDATE private.dictionary_analysis_operations SET reconciliation_sha256 = p_evidence_sha256 WHERE actor_id = p_actor AND operation_id = p_operation;
  RETURN private.finish_dictionary_analysis(p_actor, p_operation, p_outcome, p_outcome);
END;
$$;

CREATE FUNCTION public.get_dictionary_analysis_operation_v2(p_operation UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_op private.dictionary_analysis_operations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication-required'; END IF;
  SELECT * INTO v_op FROM private.dictionary_analysis_operations WHERE actor_id = auth.uid() AND operation_id = p_operation;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN private.dictionary_analysis_receipt(v_op);
END;
$$;
CREATE FUNCTION public.list_dictionary_analysis_operations_v2(p_limit INTEGER DEFAULT 50,
  p_before_created_at TIMESTAMPTZ DEFAULT NULL, p_before_operation UUID DEFAULT NULL, p_actor UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'authentication-required'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_before_created_at IS NULL) <> (p_before_operation IS NULL) THEN RAISE EXCEPTION 'invalid-analysis-page'; END IF;
  IF p_actor IS NOT NULL AND p_actor <> v_actor THEN
    IF NOT EXISTS (SELECT 1 FROM private.dictionary_administrators WHERE user_id = v_actor AND enabled) THEN RAISE EXCEPTION 'administrator-required'; END IF;
    v_actor := p_actor;
  END IF;
  RETURN (SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('receipt', private.dictionary_analysis_receipt(o), 'created_at', o.created_at)
    ORDER BY o.created_at DESC, o.operation_id DESC), '[]'::JSONB) FROM (
    SELECT * FROM private.dictionary_analysis_operations WHERE actor_id = v_actor
      AND (p_before_created_at IS NULL OR (created_at, operation_id) < (p_before_created_at, p_before_operation))
    ORDER BY created_at DESC, operation_id DESC LIMIT p_limit) o);
END;
$$;

ALTER TABLE private.dictionary_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_meaning_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_meaning_anchor_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_analysis_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_analysis_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_analysis_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_administrators, private.dictionary_meaning_anchors,
  private.dictionary_meaning_anchor_heads, private.dictionary_analysis_operations,
  private.dictionary_analysis_leases, private.dictionary_analysis_results FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.dictionary_administrators TO service_role;
GRANT SELECT, INSERT ON private.dictionary_meaning_anchors TO service_role;
GRANT SELECT, INSERT, UPDATE ON private.dictionary_meaning_anchor_heads TO service_role;
GRANT SELECT ON private.dictionary_analysis_operations, private.dictionary_analysis_leases, private.dictionary_analysis_results TO service_role;
REVOKE ALL ON FUNCTION private.protect_dictionary_anchor_source(), private.lock_dictionary_anchor_entry(), private.validate_dictionary_meaning_anchor(), private.protect_dictionary_analysis_result(),
  private.may_analyze_dictionary(UUID), private.dictionary_analysis_receipt(private.dictionary_analysis_operations),
  private.finish_dictionary_analysis(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_dictionary_analysis_v2(JSONB), public.get_dictionary_analysis_operation_v2(UUID),
  public.list_dictionary_analysis_operations_v2(INTEGER, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_dictionary_analysis_v2(JSONB), public.get_dictionary_analysis_operation_v2(UUID),
  public.list_dictionary_analysis_operations_v2(INTEGER, TIMESTAMPTZ, UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.start_dictionary_analysis_dispatch_v1(UUID, UUID, TEXT, TEXT, TEXT, TEXT),
  public.journal_dictionary_analysis_result_v1(UUID, UUID, TEXT, JSONB, TEXT),
  public.record_dictionary_analysis_failure_v1(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_dictionary_analysis_dispatch_v1(UUID, UUID, TEXT, TEXT, TEXT, TEXT),
  public.journal_dictionary_analysis_result_v1(UUID, UUID, TEXT, JSONB, TEXT),
  public.record_dictionary_analysis_failure_v1(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
COMMENT ON TABLE private.dictionary_analysis_operations IS 'Durable actor-scoped shared analysis receipts; no publication implementation or automatic redispatch.';
COMMENT ON COLUMN private.dictionary_content_runtime.analysis_operations_enabled IS 'Default-off local operation acceptance gate; shared_analysis capability stays false until guarded publication is implemented.';
COMMIT;
