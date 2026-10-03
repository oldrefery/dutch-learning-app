-- Dormant server invocation/accounting. No real budget policy, secret or schedule.
BEGIN;
CREATE TABLE private.dictionary_cefr_budget_policies (
  policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  method_id UUID NOT NULL REFERENCES private.dictionary_cefr_methods(method_id),
  profile_sha256 TEXT NOT NULL CHECK (profile_sha256 ~ '^[a-f0-9]{64}$'),
  qualification_sha256 TEXT NOT NULL CHECK (qualification_sha256 ~ '^[a-f0-9]{64}$'),
  approval_ref TEXT NOT NULL CHECK (btrim(approval_ref) <> ''),
  pricing_ref TEXT NOT NULL CHECK (btrim(pricing_ref) <> ''),
  bounds_ref TEXT NOT NULL CHECK (btrim(bounds_ref) <> ''),
  approved_by UUID NOT NULL, approved_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL CHECK (valid_until > approved_at),
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly')),
  daily_requests INTEGER NOT NULL CHECK (daily_requests BETWEEN 1 AND 1000000),
  daily_tokens BIGINT NOT NULL CHECK (daily_tokens BETWEEN 1 AND 1000000000000),
  daily_cost_microusd BIGINT NOT NULL CHECK (daily_cost_microusd BETWEEN 1 AND 1000000000000),
  max_input_tokens INTEGER NOT NULL CHECK (max_input_tokens BETWEEN 1 AND 1000000),
  max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens BETWEEN 1 AND 1000000),
  max_reasoning_tokens INTEGER NOT NULL CHECK (max_reasoning_tokens BETWEEN 0 AND 1000000),
  input_microusd_per_token NUMERIC(20,6) NOT NULL CHECK (input_microusd_per_token >= 0 AND input_microusd_per_token::TEXT NOT IN ('NaN','Infinity','-Infinity')),
  output_microusd_per_token NUMERIC(20,6) NOT NULL CHECK (output_microusd_per_token >= 0 AND output_microusd_per_token::TEXT NOT IN ('NaN','Infinity','-Infinity')),
  reasoning_microusd_per_token NUMERIC(20,6) NOT NULL CHECK (reasoning_microusd_per_token >= 0 AND reasoning_microusd_per_token::TEXT NOT IN ('NaN','Infinity','-Infinity')),
  CHECK (max_input_tokens::BIGINT + max_output_tokens + max_reasoning_tokens <= daily_tokens),
  CHECK (ceil(max_input_tokens * input_microusd_per_token + max_output_tokens * output_microusd_per_token
    + max_reasoning_tokens * reasoning_microusd_per_token) BETWEEN 1 AND daily_cost_microusd)
);
CREATE FUNCTION private.protect_dictionary_cefr_budget_v1() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'CEFR budget policy is immutable; register a new approval'; END;
$$;
CREATE TRIGGER protect_dictionary_cefr_budget BEFORE UPDATE OR DELETE ON private.dictionary_cefr_budget_policies
FOR EACH ROW EXECUTE FUNCTION private.protect_dictionary_cefr_budget_v1();

CREATE TABLE private.dictionary_cefr_worker_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  policy_id UUID REFERENCES private.dictionary_cefr_budget_policies(policy_id)
);
INSERT INTO private.dictionary_cefr_worker_control(singleton) VALUES(TRUE);

CREATE TABLE private.dictionary_cefr_daily_usage (
  utc_day DATE PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES private.dictionary_cefr_budget_policies(policy_id),
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  charged_tokens BIGINT NOT NULL DEFAULT 0 CHECK (charged_tokens >= 0),
  charged_cost_microusd BIGINT NOT NULL DEFAULT 0 CHECK (charged_cost_microusd >= 0),
  total_reserved_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_reserved_tokens >= charged_tokens),
  total_reserved_cost_microusd BIGINT NOT NULL DEFAULT 0 CHECK (total_reserved_cost_microusd >= charged_cost_microusd)
);
CREATE TABLE private.dictionary_cefr_runs (
  run_id UUID PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES private.dictionary_cefr_budget_policies(policy_id),
  status TEXT NOT NULL CHECK (status IN ('running','no_work','budget_stop','day_changed','finished','abandoned')),
  selected INTEGER NOT NULL DEFAULT 0, claimed INTEGER NOT NULL DEFAULT 0,
  budget_stops INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), finished_at TIMESTAMPTZ
);
CREATE TABLE private.dictionary_cefr_attempt_usage (
  reservation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES private.dictionary_cefr_runs(run_id),
  policy_id UUID NOT NULL REFERENCES private.dictionary_cefr_budget_policies(policy_id),
  utc_day DATE NOT NULL REFERENCES private.dictionary_cefr_daily_usage(utc_day),
  job_id UUID NOT NULL REFERENCES private.dictionary_cefr_jobs(job_id),
  attempt INTEGER NOT NULL CHECK (attempt > 0), lease_token UUID NOT NULL,
  reserved_tokens BIGINT NOT NULL CHECK (reserved_tokens > 0),
  reserved_cost_microusd BIGINT NOT NULL CHECK (reserved_cost_microusd > 0),
  charged_tokens BIGINT NOT NULL CHECK (charged_tokens >= 0 AND charged_tokens <= reserved_tokens),
  charged_cost_microusd BIGINT NOT NULL CHECK (charged_cost_microusd >= 0 AND charged_cost_microusd <= reserved_cost_microusd),
  usage_state TEXT NOT NULL DEFAULT 'reserved' CHECK (usage_state IN ('reserved','unknown','verified','exceeded')),
  observed_usage JSONB, usage_sha256 TEXT,
  provider_request_id TEXT,
  dispatch_started_at TIMESTAMPTZ,
  completion_sha256 TEXT, completion JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(job_id, attempt), UNIQUE(provider_request_id)
);
CREATE INDEX dictionary_cefr_attempt_run_idx ON private.dictionary_cefr_attempt_usage(run_id);

CREATE FUNCTION private.claim_dictionary_cefr_jobs_bounded_v1(p_method_id UUID, p_limit INTEGER) RETURNS JSONB
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  m private.dictionary_cefr_methods%ROWTYPE; j private.dictionary_cefr_jobs%ROWTYPE;
  result JSONB := '[]'; capacity INTEGER; current_head UUID; current_hash TEXT; current_revision UUID;
BEGIN
  -- Serialize capacity accounting per method; all locks end before provider work.
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id = p_method_id FOR UPDATE;
  IF NOT FOUND OR NOT private.dictionary_cefr_method_eligible_v1(m) THEN RETURN result; END IF;
  SELECT least(greatest(0, coalesce(p_limit, 0)), greatest(0, m.max_concurrency - count(*)::INTEGER)) INTO capacity
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

CREATE OR REPLACE FUNCTION public.claim_dictionary_cefr_jobs_v1(p_method_id UUID) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.claim_dictionary_cefr_jobs_bounded_v1(p_method_id, 8);
$$;

CREATE FUNCTION private.dictionary_cefr_budget_totals_v1(p private.dictionary_cefr_budget_policies)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('tokens', p.max_input_tokens::BIGINT + p.max_output_tokens + p.max_reasoning_tokens,
    'cost', ceil(p.max_input_tokens * p.input_microusd_per_token + p.max_output_tokens * p.output_microusd_per_token
      + p.max_reasoning_tokens * p.reasoning_microusd_per_token)::BIGINT);
$$;

CREATE FUNCTION public.start_dictionary_cefr_run_v1(p_policy_id UUID, p_run_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c private.dictionary_cefr_worker_control%ROWTYPE;
  p private.dictionary_cefr_budget_policies%ROWTYPE; m private.dictionary_cefr_methods%ROWTYPE;
  d private.dictionary_cefr_daily_usage%ROWTYPE;
  day DATE; totals JSONB; tokens BIGINT; cost BIGINT; capacity INTEGER; v_selected INTEGER;
  jobs JSONB; job JSONB; result JSONB := '[]'; reservation UUID;
BEGIN
  -- Consistent order: control, policy, method, UTC ledger, reservation, job/heads.
  -- Every transaction ends before provider I/O.
  SELECT * INTO c FROM private.dictionary_cefr_worker_control WHERE singleton FOR UPDATE;
  IF NOT c.enabled OR c.policy_id IS DISTINCT FROM p_policy_id THEN
    RETURN jsonb_build_object('status','disabled','jobs','[]'::JSONB);
  END IF;
  SELECT * INTO p FROM private.dictionary_cefr_budget_policies WHERE policy_id = p_policy_id FOR SHARE;
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id = p.method_id FOR UPDATE;
  IF p.valid_until <= clock_timestamp() OR NOT private.dictionary_cefr_method_eligible_v1(m)
    OR p.profile_sha256 <> m.profile_sha256 OR p.qualification_sha256 <> m.qualification_sha256
    OR NOT (CASE WHEN jsonb_typeof(m.profile->'generation_config'->'max_output_tokens')='number'
      AND (m.profile->'generation_config'->>'max_output_tokens') ~ '^[0-9]{1,7}$'
      THEN (m.profile->'generation_config'->>'max_output_tokens')::INTEGER BETWEEN 1 AND p.max_output_tokens ELSE FALSE END) THEN
    RETURN jsonb_build_object('status','unqualified','jobs','[]'::JSONB);
  END IF;
  INSERT INTO private.dictionary_cefr_runs(run_id,policy_id,status) VALUES(p_run_id,p.policy_id,'running') ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','duplicate_run','jobs','[]'::JSONB); END IF;
  v_selected := public.enqueue_dictionary_cefr_jobs_v1(m.method_id);
  IF NOT EXISTS (SELECT 1 FROM private.dictionary_cefr_jobs WHERE method_id = m.method_id AND
      ((state IN ('ready','retry_wait') AND next_attempt_at <= clock_timestamp()) OR
       (state = 'leased' AND lease_expires_at <= clock_timestamp()))) THEN
    UPDATE private.dictionary_cefr_runs SET status='no_work',selected=v_selected,finished_at=clock_timestamp() WHERE run_id=p_run_id;
    RETURN jsonb_build_object('status','no_work','run_id',p_run_id,'jobs','[]'::JSONB);
  END IF;
  day := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;
  INSERT INTO private.dictionary_cefr_daily_usage(utc_day,policy_id) VALUES(day,p.policy_id) ON CONFLICT DO NOTHING;
  SELECT * INTO d FROM private.dictionary_cefr_daily_usage WHERE utc_day=day FOR UPDATE;
  IF (clock_timestamp() AT TIME ZONE 'UTC')::DATE <> day THEN
    UPDATE private.dictionary_cefr_runs SET status='day_changed',finished_at=clock_timestamp() WHERE run_id=p_run_id;
    RETURN jsonb_build_object('status','day_changed','run_id',p_run_id,'jobs','[]'::JSONB);
  END IF;
  totals := private.dictionary_cefr_budget_totals_v1(p);
  tokens := (totals->>'tokens')::BIGINT; cost := (totals->>'cost')::BIGINT;
  -- A new policy never resets or increases the current day's established bucket.
  capacity := CASE WHEN d.policy_id <> p.policy_id THEN 0 ELSE greatest(0, least(8,
    p.daily_requests-d.requests, (p.daily_tokens-d.charged_tokens)/tokens,
    (p.daily_cost_microusd-d.charged_cost_microusd)/cost))::INTEGER END;
  IF capacity = 0 THEN
    UPDATE private.dictionary_cefr_runs SET status='budget_stop',selected=v_selected,budget_stops=1,finished_at=clock_timestamp() WHERE run_id=p_run_id;
    RETURN jsonb_build_object('status','budget_stop','run_id',p_run_id,'jobs','[]'::JSONB);
  END IF;
  jobs := private.claim_dictionary_cefr_jobs_bounded_v1(m.method_id, capacity);
  FOR job IN SELECT value FROM jsonb_array_elements(jobs) LOOP
    INSERT INTO private.dictionary_cefr_attempt_usage(run_id,policy_id,utc_day,job_id,attempt,lease_token,
      reserved_tokens,reserved_cost_microusd,charged_tokens,charged_cost_microusd)
    VALUES(p_run_id,p.policy_id,day,(job->>'job_id')::UUID,(job->>'attempt')::INTEGER,(job->>'lease_token')::UUID,
      tokens,cost,tokens,cost) RETURNING reservation_id INTO reservation;
    result := result || jsonb_build_array(job || jsonb_build_object('reservation_id',reservation,'reservation_utc_day',day));
  END LOOP;
  UPDATE private.dictionary_cefr_daily_usage SET requests=requests+jsonb_array_length(jobs),
    charged_tokens=charged_tokens+tokens*jsonb_array_length(jobs),charged_cost_microusd=charged_cost_microusd+cost*jsonb_array_length(jobs),
    total_reserved_tokens=total_reserved_tokens+tokens*jsonb_array_length(jobs),
    total_reserved_cost_microusd=total_reserved_cost_microusd+cost*jsonb_array_length(jobs) WHERE utc_day=day;
  UPDATE private.dictionary_cefr_runs SET selected=v_selected,claimed=jsonb_array_length(jobs),
    status=CASE WHEN jobs='[]'::JSONB THEN 'no_work' ELSE 'running' END,
    finished_at=CASE WHEN jobs='[]'::JSONB THEN clock_timestamp() ELSE NULL END WHERE run_id=p_run_id;
  RETURN jsonb_build_object('status',CASE WHEN jobs='[]'::JSONB THEN 'no_work' ELSE 'running' END,
    'run_id',p_run_id,'jobs',result);
END;
$$;

CREATE FUNCTION public.authorize_dictionary_cefr_dispatch_v1(p_reservation_id UUID, p_lease_token UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c private.dictionary_cefr_worker_control%ROWTYPE; p private.dictionary_cefr_budget_policies%ROWTYPE;
  m private.dictionary_cefr_methods%ROWTYPE; a private.dictionary_cefr_attempt_usage%ROWTYPE;
  j private.dictionary_cefr_jobs%ROWTYPE; current_revision UUID; current_input TEXT; current_head UUID;
BEGIN
  SELECT * INTO c FROM private.dictionary_cefr_worker_control WHERE singleton FOR UPDATE;
  SELECT b.* INTO p FROM private.dictionary_cefr_budget_policies b JOIN private.dictionary_cefr_attempt_usage u ON u.policy_id=b.policy_id
    WHERE u.reservation_id=p_reservation_id FOR SHARE OF b;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',FALSE,'reason','missing'); END IF;
  SELECT * INTO m FROM private.dictionary_cefr_methods WHERE method_id=p.method_id FOR SHARE;
  SELECT * INTO a FROM private.dictionary_cefr_attempt_usage WHERE reservation_id=p_reservation_id FOR UPDATE;
  SELECT * INTO j FROM private.dictionary_cefr_jobs WHERE job_id=a.job_id FOR UPDATE;
  IF NOT c.enabled OR c.policy_id<>p.policy_id OR p.valid_until<=clock_timestamp()+interval '5 seconds'
    OR NOT private.dictionary_cefr_method_eligible_v1(m) THEN
    RETURN jsonb_build_object('allowed',FALSE,'reason','disabled');
  END IF;
  IF a.lease_token IS DISTINCT FROM p_lease_token OR a.dispatch_started_at IS NOT NULL OR a.completion IS NOT NULL
    OR a.utc_day<>(clock_timestamp() AT TIME ZONE 'UTC')::DATE OR j.state<>'leased'
    OR j.lease_token<>a.lease_token OR j.attempt<>a.attempt OR j.lease_expires_at<=clock_timestamp()+interval '5 seconds' THEN
    RETURN jsonb_build_object('allowed',FALSE,'reason','stale');
  END IF;
  SELECT r.revision_id,r.cefr_input_sha256,h.assessment_id INTO current_revision,current_input,current_head
  FROM public.dictionary_entry_heads eh JOIN public.dictionary_revisions r ON r.revision_id=eh.revision_id
  LEFT JOIN public.dictionary_cefr_heads h ON h.entry_id=eh.entry_id AND h.input_sha256=r.cefr_input_sha256 WHERE eh.entry_id=j.entry_id;
  IF current_input IS DISTINCT FROM j.input_sha256 OR current_head IS DISTINCT FROM j.expected_assessment_id
    OR NOT private.dictionary_cefr_revision_eligible_v1(current_revision) OR NOT private.dictionary_cefr_revision_eligible_v1(j.revision_id) THEN
    RETURN jsonb_build_object('allowed',FALSE,'reason','eligibility_changed');
  END IF;
  UPDATE private.dictionary_cefr_attempt_usage SET dispatch_started_at=clock_timestamp() WHERE reservation_id=a.reservation_id;
  RETURN jsonb_build_object('allowed',TRUE);
END;
$$;

CREATE FUNCTION public.account_dictionary_cefr_attempt_v1(p_reservation_id UUID, p_lease_token UUID, p_usage JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a private.dictionary_cefr_attempt_usage%ROWTYPE; p private.dictionary_cefr_budget_policies%ROWTYPE;
  usage_hash TEXT; input_tokens BIGINT; output_tokens BIGINT; reasoning_tokens BIGINT;
  tokens BIGINT; cost BIGINT; request_id TEXT;
BEGIN
  PERFORM 1 FROM private.dictionary_cefr_worker_control WHERE singleton FOR UPDATE;
  SELECT b.* INTO p FROM private.dictionary_cefr_budget_policies b
    JOIN private.dictionary_cefr_attempt_usage u ON u.policy_id=b.policy_id WHERE u.reservation_id=p_reservation_id FOR SHARE OF b;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  PERFORM 1 FROM private.dictionary_cefr_methods WHERE method_id=p.method_id FOR SHARE;
  PERFORM 1 FROM private.dictionary_cefr_daily_usage d JOIN private.dictionary_cefr_attempt_usage u ON u.utc_day=d.utc_day
    WHERE u.reservation_id=p_reservation_id FOR UPDATE OF d;
  SELECT * INTO a FROM private.dictionary_cefr_attempt_usage WHERE reservation_id=p_reservation_id FOR UPDATE;
  IF a.lease_token IS DISTINCT FROM p_lease_token THEN RETURN jsonb_build_object('status','stale'); END IF;
  IF p_usage IS NULL THEN
    UPDATE private.dictionary_cefr_attempt_usage SET usage_state='unknown' WHERE reservation_id=a.reservation_id AND usage_state='reserved';
    RETURN jsonb_build_object('status',CASE WHEN a.usage_state='reserved' THEN 'unknown' ELSE a.usage_state END);
  END IF;
  IF a.dispatch_started_at IS NULL THEN RAISE EXCEPTION 'CEFR usage requires a dispatched reservation'; END IF;
  -- Usage is trusted transport metadata, never a model candidate or HTTP client form.
  IF jsonb_typeof(p_usage) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_usage)) <> 4
    OR jsonb_typeof(p_usage->'provider_request_id') IS DISTINCT FROM 'string'
    OR coalesce(p_usage->>'provider_request_id','') !~ '^[A-Za-z0-9_.:-]{1,200}$'
    OR NOT ((jsonb_typeof(p_usage->'input_tokens')='number' AND (p_usage->>'input_tokens') ~ '^[0-9]{1,12}$'
      AND jsonb_typeof(p_usage->'output_tokens')='number' AND (p_usage->>'output_tokens') ~ '^[0-9]{1,12}$'
      AND jsonb_typeof(p_usage->'reasoning_tokens')='number' AND (p_usage->>'reasoning_tokens') ~ '^[0-9]{1,12}$') IS TRUE) THEN
    RAISE EXCEPTION 'Invalid verified CEFR usage';
  END IF;
  usage_hash := encode(extensions.digest(convert_to(private.dictionary_canonical_json(p_usage),'UTF8'),'sha256'),'hex');
  IF a.usage_sha256 IS NOT NULL THEN
    IF a.usage_sha256 <> usage_hash THEN RAISE EXCEPTION 'Verified CEFR usage changed'; END IF;
    RETURN jsonb_build_object('status',a.usage_state);
  END IF;
  input_tokens := (p_usage->>'input_tokens')::BIGINT; output_tokens := (p_usage->>'output_tokens')::BIGINT;
  reasoning_tokens := (p_usage->>'reasoning_tokens')::BIGINT; request_id := p_usage->>'provider_request_id';
  IF input_tokens>p.max_input_tokens OR output_tokens>p.max_output_tokens OR reasoning_tokens>p.max_reasoning_tokens THEN
    -- A violated reviewed bound is not a refund and disables all further dispatch.
    UPDATE private.dictionary_cefr_worker_control SET enabled=FALSE WHERE singleton;
    UPDATE private.dictionary_cefr_attempt_usage SET usage_state='exceeded',observed_usage=p_usage,
      usage_sha256=usage_hash,provider_request_id=request_id WHERE reservation_id=a.reservation_id;
    RETURN jsonb_build_object('status','exceeded');
  END IF;
  tokens := input_tokens+output_tokens+reasoning_tokens;
  cost := ceil(input_tokens*p.input_microusd_per_token + output_tokens*p.output_microusd_per_token
    + reasoning_tokens*p.reasoning_microusd_per_token)::BIGINT;
  UPDATE private.dictionary_cefr_daily_usage SET charged_tokens=charged_tokens-a.charged_tokens+tokens,
    charged_cost_microusd=charged_cost_microusd-a.charged_cost_microusd+cost WHERE utc_day=a.utc_day;
  UPDATE private.dictionary_cefr_attempt_usage SET usage_state='verified',observed_usage=p_usage,
    usage_sha256=usage_hash,provider_request_id=request_id,charged_tokens=tokens,charged_cost_microusd=cost
    WHERE reservation_id=a.reservation_id;
  RETURN jsonb_build_object('status','verified');
END;
$$;

CREATE FUNCTION public.finish_dictionary_cefr_attempt_v1(
  p_reservation_id UUID, p_lease_token UUID, p_outcome TEXT, p_level TEXT DEFAULT NULL,
  p_confidence DOUBLE PRECISION DEFAULT NULL, p_retry_after_seconds INTEGER DEFAULT NULL, p_usage JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a private.dictionary_cefr_attempt_usage%ROWTYPE; m private.dictionary_cefr_methods%ROWTYPE;
  account JSONB; result JSONB; result_hash TEXT; active BOOLEAN;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('estimated','unknown','retry','failed') THEN RAISE EXCEPTION 'Invalid CEFR attempt outcome'; END IF;
  -- Accounting has the same lock order as dispatch and retains uncertain charges.
  account := public.account_dictionary_cefr_attempt_v1(p_reservation_id,p_lease_token,p_usage);
  IF account->>'status' IN ('missing','stale') THEN RETURN account; END IF;
  SELECT c.enabled AND c.policy_id=b.policy_id AND b.valid_until>clock_timestamp() INTO active
    FROM private.dictionary_cefr_worker_control c JOIN private.dictionary_cefr_budget_policies b ON b.policy_id=
      (SELECT policy_id FROM private.dictionary_cefr_attempt_usage WHERE reservation_id=p_reservation_id) WHERE c.singleton;
  SELECT * INTO a FROM private.dictionary_cefr_attempt_usage WHERE reservation_id=p_reservation_id FOR UPDATE;
  SELECT m1.* INTO m FROM private.dictionary_cefr_methods m1
    JOIN private.dictionary_cefr_budget_policies b ON b.method_id=m1.method_id WHERE b.policy_id=a.policy_id;
  result_hash := encode(extensions.digest(convert_to(private.dictionary_canonical_json(jsonb_build_object(
    'outcome',p_outcome,'level',p_level,'confidence',p_confidence,'retry_after_seconds',p_retry_after_seconds)), 'UTF8'),'sha256'),'hex');
  IF a.completion_sha256 IS NOT NULL THEN
    IF a.completion_sha256 <> result_hash THEN RAISE EXCEPTION 'CEFR attempt completion changed'; END IF;
    RETURN a.completion;
  END IF;
  IF NOT active THEN
    UPDATE private.dictionary_cefr_jobs SET state='obsolete',outcome_reason='worker_disabled',updated_at=clock_timestamp()
      WHERE job_id=a.job_id AND state='leased' AND lease_token=a.lease_token AND attempt=a.attempt AND lease_expires_at>clock_timestamp();
    result := jsonb_build_object('status',CASE WHEN FOUND THEN 'obsolete' ELSE 'stale' END);
  ELSE
    result := public.settle_dictionary_cefr_job_v1(a.job_id,a.lease_token,a.attempt,
      (SELECT input_sha256 FROM private.dictionary_cefr_jobs WHERE job_id=a.job_id),m.qualification_sha256,
      p_outcome,p_level,p_confidence,p_retry_after_seconds);
  END IF;
  UPDATE private.dictionary_cefr_attempt_usage SET completion_sha256=result_hash,completion=result WHERE reservation_id=a.reservation_id;
  RETURN result;
END;
$$;

CREATE FUNCTION public.finish_dictionary_cefr_run_v1(p_run_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.dictionary_cefr_runs%ROWTYPE; result JSONB; pending INTEGER; abandoned BOOLEAN;
BEGIN
  PERFORM 1 FROM private.dictionary_cefr_worker_control WHERE singleton FOR UPDATE;
  SELECT * INTO r FROM private.dictionary_cefr_runs WHERE run_id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','missing'); END IF;
  SELECT count(*) FILTER (WHERE u.completion IS NULL), coalesce(bool_or(u.completion IS NULL AND
    (j.lease_token<>u.lease_token OR j.lease_expires_at<=clock_timestamp())),FALSE)
    INTO pending,abandoned FROM private.dictionary_cefr_attempt_usage u
    JOIN private.dictionary_cefr_jobs j ON j.job_id=u.job_id WHERE u.run_id=r.run_id;
  SELECT jsonb_build_object('run_id',r.run_id,'status',CASE WHEN r.claimed=0 THEN r.status
      WHEN pending=0 THEN 'finished' WHEN abandoned THEN 'abandoned' ELSE 'running' END,
    'selected',r.selected,'claimed',r.claimed,'budget_stops',r.budget_stops,'pending',pending,
    'completed',count(*) FILTER (WHERE completion->>'status'='completed'),
    'unknown',count(*) FILTER (WHERE completion->>'status'='needs_review'),
    'needs_review',count(*) FILTER (WHERE completion->>'status'='needs_review'),
    'retry',count(*) FILTER (WHERE completion->>'status'='retry_wait'),
    'obsolete',count(*) FILTER (WHERE completion->>'status'='obsolete'),
    'stale',count(*) FILTER (WHERE completion->>'status'='stale'),
    'failed',count(*) FILTER (WHERE completion->>'status'='failed'),
    'unknown_usage',count(*) FILTER (WHERE usage_state IN ('reserved','unknown')),
    'exceeded_usage',count(*) FILTER (WHERE usage_state='exceeded'),
    'reserved_tokens',coalesce(sum(reserved_tokens),0),'reserved_cost_microusd',coalesce(sum(reserved_cost_microusd),0),
    'charged_tokens',coalesce(sum(charged_tokens),0),'charged_cost_microusd',coalesce(sum(charged_cost_microusd),0),
    'observed_tokens',coalesce(sum((observed_usage->>'input_tokens')::BIGINT+(observed_usage->>'output_tokens')::BIGINT+(observed_usage->>'reasoning_tokens')::BIGINT),0),
    'remaining_eligible',(SELECT count(*) FROM public.dictionary_entry_heads eh JOIN public.dictionary_revisions rev ON rev.revision_id=eh.revision_id
      LEFT JOIN public.dictionary_cefr_heads h ON h.entry_id=eh.entry_id AND h.input_sha256=rev.cefr_input_sha256
      LEFT JOIN public.dictionary_cefr_assessments a ON a.assessment_id=h.assessment_id
      WHERE private.dictionary_cefr_revision_eligible_v1(rev.revision_id) AND (h.assessment_id IS NULL OR (a.status='unknown' AND NOT a.locked))))
    INTO result FROM private.dictionary_cefr_attempt_usage WHERE run_id=r.run_id;
  UPDATE private.dictionary_cefr_runs SET status=result->>'status',summary=result,
    finished_at=CASE WHEN result->>'status'='running' THEN NULL ELSE coalesce(finished_at,clock_timestamp()) END WHERE run_id=r.run_id;
  RETURN result;
END;
$$;

ALTER TABLE private.dictionary_cefr_budget_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_worker_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.dictionary_cefr_attempt_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.dictionary_cefr_budget_policies,private.dictionary_cefr_worker_control,
  private.dictionary_cefr_daily_usage,private.dictionary_cefr_runs,private.dictionary_cefr_attempt_usage FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.protect_dictionary_cefr_budget_v1(),
  private.claim_dictionary_cefr_jobs_bounded_v1(UUID,INTEGER),
  private.dictionary_cefr_budget_totals_v1(private.dictionary_cefr_budget_policies),
  public.authorize_dictionary_cefr_dispatch_v1(UUID,UUID),
  public.start_dictionary_cefr_run_v1(UUID,UUID), public.account_dictionary_cefr_attempt_v1(UUID,UUID,JSONB),
  public.finish_dictionary_cefr_attempt_v1(UUID,UUID,TEXT,TEXT,DOUBLE PRECISION,INTEGER,JSONB),
  public.finish_dictionary_cefr_run_v1(UUID) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.authorize_dictionary_cefr_dispatch_v1(UUID,UUID), public.start_dictionary_cefr_run_v1(UUID,UUID),
  public.account_dictionary_cefr_attempt_v1(UUID,UUID,JSONB),
  public.finish_dictionary_cefr_attempt_v1(UUID,UUID,TEXT,TEXT,DOUBLE PRECISION,INTEGER,JSONB),
  public.finish_dictionary_cefr_run_v1(UUID) TO service_role;
COMMENT ON TABLE private.dictionary_cefr_budget_policies IS 'Empty immutable reviewed spending/pricing/bounds registry; no live approval is seeded.';
COMMENT ON TABLE private.dictionary_cefr_worker_control IS 'Global kill switch defaults off. No schedule is installed.';
COMMENT ON TABLE private.dictionary_cefr_attempt_usage IS 'Conservative per-attempt charges survive crash, timeout and stale completion; verified usage only can reduce them.';
COMMIT;
