-- Dormant queue foundation. No method approval, scheduler, provider call or activation.
BEGIN;

CREATE TABLE private.dictionary_cefr_methods (
  method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile JSONB NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
  profile_sha256 TEXT NOT NULL CHECK (profile_sha256 ~ '^[a-f0-9]{64}$'),
  qualification_sha256 TEXT NOT NULL UNIQUE CHECK (qualification_sha256 ~ '^[a-f0-9]{64}$'),
  fixture_sha256 TEXT NOT NULL CHECK (fixture_sha256 ~ '^[a-f0-9]{64}$'),
  report_sha256 TEXT NOT NULL CHECK (report_sha256 ~ '^[a-f0-9]{64}$'),
  policy_sha256 TEXT NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
  provider_source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id),
  provider_reuse_policy_ref TEXT NOT NULL CHECK (btrim(provider_reuse_policy_ref) <> ''),
  review_ref TEXT NOT NULL CHECK (btrim(review_ref) <> ''),
  approved_by UUID NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  confidence_threshold DOUBLE PRECISION NOT NULL CHECK (confidence_threshold BETWEEN 0 AND 1),
  batch_size INTEGER NOT NULL CHECK (batch_size BETWEEN 1 AND 100),
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency BETWEEN 1 AND 8),
  max_attempts INTEGER NOT NULL CHECK (max_attempts BETWEEN 1 AND 10),
  lease_seconds INTEGER NOT NULL CHECK (lease_seconds BETWEEN 10 AND 600),
  retry_seconds INTEGER NOT NULL CHECK (retry_seconds BETWEEN 1 AND 3600),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((profile->>'namespace' = 'dictionary-cefr-method-v1'
    AND profile->>'input_schema_version' = '1'
    AND coalesce(btrim(profile->>'method_revision'), '') <> ''
    AND coalesce(btrim(profile->>'prompt_revision'), '') <> ''
    AND coalesce(btrim(profile->>'provider'), '') <> ''
    AND coalesce(btrim(profile->>'requested_model'), '') <> ''
    AND profile ? 'resolved_model_version'
    AND jsonb_typeof(profile->'generation_config') = 'object') IS TRUE),
  CHECK (profile_sha256 = encode(extensions.digest(convert_to(
    private.dictionary_canonical_json(profile), 'UTF8'), 'sha256'), 'hex'))
);

CREATE FUNCTION private.protect_dictionary_cefr_method_v1() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CEFR methods retain immutable review history'; END IF;
  IF (to_jsonb(NEW) - ARRAY['enabled', 'revoked_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['enabled', 'revoked_at'])
     OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'CEFR method approval is immutable; register a new method';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dictionary_cefr_method
  BEFORE UPDATE OR DELETE ON private.dictionary_cefr_methods
  FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_cefr_method_v1();

CREATE TABLE private.dictionary_cefr_jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  method_id UUID NOT NULL REFERENCES private.dictionary_cefr_methods(method_id),
  entry_id UUID NOT NULL,
  revision_id UUID NOT NULL,
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  content_source_id UUID NOT NULL REFERENCES private.dictionary_sources(source_id),
  expected_assessment_id UUID,
  state TEXT NOT NULL DEFAULT 'ready' CHECK (state IN
    ('ready', 'leased', 'retry_wait', 'completed', 'obsolete', 'needs_review', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessment_id UUID REFERENCES public.dictionary_cefr_assessments(assessment_id),
  last_result_sha256 TEXT CHECK (last_result_sha256 ~ '^[a-f0-9]{64}$'),
  outcome_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, input_sha256, method_id),
  FOREIGN KEY (entry_id, revision_id) REFERENCES public.dictionary_revisions(entry_id, revision_id),
  FOREIGN KEY (entry_id, input_sha256, expected_assessment_id)
    REFERENCES public.dictionary_cefr_assessments(entry_id, input_sha256, assessment_id),
  CHECK (state <> 'leased' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND attempt > 0)),
  CHECK ((state = 'completed') = (assessment_id IS NOT NULL))
);
CREATE INDEX dictionary_cefr_jobs_claim_idx
  ON private.dictionary_cefr_jobs(method_id, next_attempt_at, created_at, job_id)
  WHERE state IN ('ready', 'leased', 'retry_wait');

CREATE FUNCTION private.dictionary_cefr_method_eligible_v1(p_method private.dictionary_cefr_methods)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_method.enabled AND p_method.revoked_at IS NULL AND EXISTS (
    SELECT 1 FROM private.dictionary_sources s
    WHERE s.source_id = p_method.provider_source_id AND s.source_kind = 'provider'
      AND s.review_state = 'approved'
      AND s.approved_content_sha256 = p_method.qualification_sha256
  );
$$;

CREATE FUNCTION private.dictionary_cefr_revision_eligible_v1(p_revision UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dictionary_revisions r
    JOIN public.dictionary_entries e ON e.entry_id = r.entry_id
    JOIN private.dictionary_sources s ON s.source_id = r.source_id
    WHERE r.revision_id = p_revision AND e.state = 'published'
      AND r.review_status = 'published' AND r.schema_version = 1
      AND s.review_state = 'approved' AND s.approved_content_sha256 = r.content_sha256
      AND private.valid_dictionary_content(r.content)
      AND r.content_sha256 = encode(extensions.digest(convert_to(
        private.dictionary_canonical_json(r.content), 'UTF8'), 'sha256'), 'hex')
      AND r.cefr_input_sha256 = encode(extensions.digest(convert_to(
        private.dictionary_canonical_json(jsonb_build_object('assessment_schema_version', 1,
          'content', r.content - ARRAY['image_url', 'tts_url'])), 'UTF8'), 'sha256'), 'hex')
  );
$$;

CREATE FUNCTION public.enqueue_dictionary_cefr_jobs_v1(p_method_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m private.dictionary_cefr_methods%ROWTYPE; n INTEGER;
BEGIN
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id = p_method_id FOR SHARE;
  IF NOT FOUND OR NOT private.dictionary_cefr_method_eligible_v1(m) THEN RETURN 0; END IF;
  INSERT INTO private.dictionary_cefr_jobs(method_id, entry_id, revision_id, input_sha256,
    content_source_id, expected_assessment_id)
  SELECT m.method_id, e.entry_id, r.revision_id, r.cefr_input_sha256, r.source_id, h.assessment_id
  FROM public.dictionary_entries e
  JOIN public.dictionary_entry_heads eh ON eh.entry_id = e.entry_id
  JOIN public.dictionary_revisions r ON r.revision_id = eh.revision_id
  LEFT JOIN public.dictionary_cefr_heads h ON h.entry_id = e.entry_id AND h.input_sha256 = r.cefr_input_sha256
  LEFT JOIN public.dictionary_cefr_assessments a ON a.assessment_id = h.assessment_id
  WHERE private.dictionary_cefr_revision_eligible_v1(r.revision_id)
    AND (h.assessment_id IS NULL OR (a.status = 'unknown' AND NOT a.locked))
    AND NOT EXISTS (SELECT 1 FROM private.dictionary_cefr_jobs j
      WHERE j.entry_id = e.entry_id AND j.input_sha256 = r.cefr_input_sha256 AND j.method_id = m.method_id)
  ORDER BY e.entry_id LIMIT m.batch_size ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE FUNCTION public.claim_dictionary_cefr_jobs_v1(p_method_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m private.dictionary_cefr_methods%ROWTYPE; j private.dictionary_cefr_jobs%ROWTYPE;
  result JSONB := '[]'; capacity INTEGER; current_head UUID; current_hash TEXT; current_revision UUID;
BEGIN
  -- Serialize capacity accounting per method; all locks end before provider work.
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id = p_method_id FOR UPDATE;
  IF NOT FOUND OR NOT private.dictionary_cefr_method_eligible_v1(m) THEN RETURN result; END IF;
  SELECT greatest(0, m.max_concurrency - count(*)::INTEGER) INTO capacity
  FROM private.dictionary_cefr_jobs WHERE method_id = m.method_id
    AND state = 'leased' AND lease_expires_at > clock_timestamp();
  FOR j IN SELECT * FROM private.dictionary_cefr_jobs
    WHERE method_id = m.method_id AND
      ((state IN ('ready', 'retry_wait') AND next_attempt_at <= clock_timestamp())
        OR (state = 'leased' AND lease_expires_at <= clock_timestamp()))
    ORDER BY next_attempt_at, created_at, job_id LIMIT m.batch_size FOR UPDATE SKIP LOCKED
  LOOP
    IF j.attempt >= m.max_attempts THEN
      UPDATE private.dictionary_cefr_jobs SET state = 'failed', outcome_reason = 'attempt_limit',
        updated_at = clock_timestamp() WHERE job_id = j.job_id;
      CONTINUE;
    END IF;
    EXIT WHEN capacity = 0;
    SELECT r.revision_id, r.cefr_input_sha256, h.assessment_id
      INTO current_revision, current_hash, current_head
    FROM public.dictionary_entry_heads eh JOIN public.dictionary_revisions r ON r.revision_id = eh.revision_id
    LEFT JOIN public.dictionary_cefr_heads h ON h.entry_id = eh.entry_id AND h.input_sha256 = r.cefr_input_sha256
    WHERE eh.entry_id = j.entry_id;
    IF current_hash IS DISTINCT FROM j.input_sha256
      OR current_head IS DISTINCT FROM j.expected_assessment_id
      OR NOT private.dictionary_cefr_revision_eligible_v1(current_revision)
      OR NOT private.dictionary_cefr_revision_eligible_v1(j.revision_id) THEN
      UPDATE private.dictionary_cefr_jobs SET state = 'obsolete', outcome_reason = 'eligibility_changed',
        updated_at = clock_timestamp() WHERE job_id = j.job_id;
      CONTINUE;
    END IF;
    UPDATE private.dictionary_cefr_jobs SET state = 'leased', attempt = attempt + 1,
      lease_token = public.uuid_generate_v4(), lease_expires_at = clock_timestamp() + make_interval(secs => m.lease_seconds),
      last_result_sha256 = NULL, outcome_reason = NULL, updated_at = clock_timestamp()
      WHERE job_id = j.job_id RETURNING * INTO j;
    result := result || jsonb_build_array(to_jsonb(j) || jsonb_build_object(
      'content', (SELECT content FROM public.dictionary_revisions WHERE revision_id = j.revision_id),
      'profile', m.profile, 'profile_sha256', m.profile_sha256,
      'qualification_sha256', m.qualification_sha256));
    capacity := capacity - 1;
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION public.settle_dictionary_cefr_job_v1(
  p_job_id UUID, p_lease_token UUID, p_attempt INTEGER, p_input_sha256 TEXT,
  p_qualification_sha256 TEXT, p_outcome TEXT, p_level TEXT DEFAULT NULL,
  p_confidence DOUBLE PRECISION DEFAULT NULL, p_retry_after_seconds INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  m private.dictionary_cefr_methods%ROWTYPE; j private.dictionary_cefr_jobs%ROWTYPE;
  current_revision UUID; current_hash TEXT; current_head UUID; result_hash TEXT;
  new_assessment UUID; changed INTEGER; method UUID;
BEGIN
  SELECT method_id INTO method FROM private.dictionary_cefr_jobs WHERE job_id = p_job_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'missing'); END IF;
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id = method FOR SHARE;
  -- Keep source approval stable through assessment insertion.
  PERFORM 1 FROM private.dictionary_sources WHERE source_id = m.provider_source_id FOR SHARE;
  SELECT * INTO j FROM private.dictionary_cefr_jobs WHERE job_id = p_job_id FOR UPDATE;
  IF j.lease_token IS DISTINCT FROM p_lease_token OR j.attempt IS DISTINCT FROM p_attempt
    OR j.input_sha256 IS DISTINCT FROM p_input_sha256
    OR m.qualification_sha256 IS DISTINCT FROM p_qualification_sha256 THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  result_hash := encode(extensions.digest(convert_to(private.dictionary_canonical_json(jsonb_build_object(
    'outcome', p_outcome, 'level', p_level, 'confidence', p_confidence,
    'retry_after_seconds', p_retry_after_seconds)), 'UTF8'), 'sha256'), 'hex');
  IF j.last_result_sha256 IS NOT NULL THEN
    IF j.last_result_sha256 <> result_hash THEN RAISE EXCEPTION 'CEFR completion payload changed'; END IF;
    RETURN jsonb_build_object('status', j.state, 'assessment_id', j.assessment_id);
  END IF;
  IF j.state <> 'leased' OR j.lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('estimated', 'unknown', 'retry', 'failed') THEN
    RAISE EXCEPTION 'Unsupported CEFR outcome';
  END IF;
  IF NOT private.dictionary_cefr_method_eligible_v1(m) THEN
    UPDATE private.dictionary_cefr_jobs SET state = 'obsolete', outcome_reason = 'method_disabled',
      last_result_sha256 = result_hash, updated_at = clock_timestamp() WHERE job_id = j.job_id;
    RETURN jsonb_build_object('status', 'obsolete');
  END IF;
  -- Match the existing publication trigger order: revision head, then entry.
  SELECT revision_id INTO current_revision FROM public.dictionary_entry_heads WHERE entry_id = j.entry_id FOR UPDATE;
  PERFORM 1 FROM public.dictionary_entries WHERE entry_id = j.entry_id FOR UPDATE;
  SELECT cefr_input_sha256 INTO current_hash FROM public.dictionary_revisions WHERE revision_id = current_revision;
  SELECT assessment_id INTO current_head FROM public.dictionary_cefr_heads
    WHERE entry_id = j.entry_id AND input_sha256 = j.input_sha256 FOR UPDATE;
  IF j.lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  IF current_hash IS DISTINCT FROM j.input_sha256 OR current_head IS DISTINCT FROM j.expected_assessment_id
    OR NOT private.dictionary_cefr_revision_eligible_v1(current_revision)
    OR NOT private.dictionary_cefr_revision_eligible_v1(j.revision_id)
    OR EXISTS (SELECT 1 FROM public.dictionary_cefr_assessments
      WHERE assessment_id = current_head AND (status <> 'unknown' OR locked)) THEN
    UPDATE private.dictionary_cefr_jobs SET state = 'obsolete', outcome_reason = 'eligibility_changed',
      last_result_sha256 = result_hash, updated_at = clock_timestamp() WHERE job_id = j.job_id;
    RETURN jsonb_build_object('status', 'obsolete');
  END IF;
  IF p_outcome <> 'estimated' THEN
    UPDATE private.dictionary_cefr_jobs SET
      state = CASE WHEN p_outcome = 'unknown' THEN 'needs_review'
        WHEN p_outcome = 'failed' OR attempt >= m.max_attempts THEN 'failed' ELSE 'retry_wait' END,
      next_attempt_at = clock_timestamp() + make_interval(secs => least(3600,
        greatest(m.retry_seconds * (2 ^ least(j.attempt - 1, 10))::INTEGER, coalesce(p_retry_after_seconds, 0)))),
      last_result_sha256 = result_hash, outcome_reason = p_outcome, updated_at = clock_timestamp()
      WHERE job_id = j.job_id RETURNING * INTO j;
    RETURN jsonb_build_object('status', j.state);
  END IF;
  IF p_level IS NULL OR p_level NOT IN ('A1','A2','B1','B2','C1','C2') OR p_confidence IS NULL
    OR NOT (p_confidence BETWEEN m.confidence_threshold AND 1) THEN
    RAISE EXCEPTION 'Invalid or unqualified CEFR estimate';
  END IF;
  BEGIN
    INSERT INTO public.dictionary_cefr_assessments(entry_id, input_sha256, cefr_level,
      status, confidence, method, method_version, source_id, supersedes_assessment_id)
    VALUES(j.entry_id, j.input_sha256, p_level, 'estimated', p_confidence,
      m.profile->>'provider', m.profile->>'method_revision', m.provider_source_id, j.expected_assessment_id)
    RETURNING assessment_id INTO new_assessment;
    INSERT INTO public.dictionary_cefr_heads(entry_id, input_sha256, assessment_id)
    VALUES(j.entry_id, j.input_sha256, new_assessment)
    ON CONFLICT (entry_id, input_sha256) DO UPDATE SET assessment_id = EXCLUDED.assessment_id
      WHERE dictionary_cefr_heads.assessment_id IS NOT DISTINCT FROM j.expected_assessment_id;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE SQLSTATE 'P0002'; END IF;
    -- An absent-head conflict or a change-log lock may also outlive the lease.
    IF j.lease_expires_at <= clock_timestamp() THEN RAISE SQLSTATE 'PCE01'; END IF;
    UPDATE private.dictionary_cefr_jobs SET state = 'completed', assessment_id = new_assessment,
      last_result_sha256 = result_hash, outcome_reason = 'estimated', updated_at = clock_timestamp() WHERE job_id = j.job_id;
  EXCEPTION
  WHEN SQLSTATE 'PCE01' THEN
    RETURN jsonb_build_object('status', 'stale');
  WHEN no_data_found THEN
    -- Roll back the unpublished assessment as well as the losing head write.
    UPDATE private.dictionary_cefr_jobs SET state = 'obsolete', outcome_reason = 'assessment_head_changed',
      last_result_sha256 = result_hash, updated_at = clock_timestamp() WHERE job_id = j.job_id;
    RETURN jsonb_build_object('status', 'obsolete');
  END;
  RETURN jsonb_build_object('status', 'completed', 'assessment_id', new_assessment);
END;
$$;

ALTER TABLE private.dictionary_cefr_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_cefr_methods, private.dictionary_cefr_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.protect_dictionary_cefr_method_v1(),
  private.dictionary_cefr_method_eligible_v1(private.dictionary_cefr_methods),
  private.dictionary_cefr_revision_eligible_v1(UUID),
  public.enqueue_dictionary_cefr_jobs_v1(UUID), public.claim_dictionary_cefr_jobs_v1(UUID),
  public.settle_dictionary_cefr_job_v1(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_dictionary_cefr_jobs_v1(UUID), public.claim_dictionary_cefr_jobs_v1(UUID),
  public.settle_dictionary_cefr_job_v1(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, INTEGER) TO service_role;
COMMENT ON TABLE private.dictionary_cefr_methods IS
  'Admin-reviewed immutable qualification/source binding. No worker write grant; empty and disabled by default.';
COMMENT ON TABLE private.dictionary_cefr_jobs IS
  'Private published-meaning-only work. No personal inputs. Leases are not spending authorization; scheduler stays off.';
COMMIT;
