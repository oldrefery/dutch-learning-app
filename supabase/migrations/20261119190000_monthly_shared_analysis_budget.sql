BEGIN;

ALTER TABLE private.dictionary_paid_releases
  ADD COLUMN monthly_limit_nanousd BIGINT CHECK (
    monthly_limit_nanousd IS NULL OR (monthly_limit_nanousd > 0 AND full_access_analysis_only)
  );
ALTER TABLE private.dictionary_paid_attempts ADD COLUMN dispatched_at TIMESTAMPTZ;
CREATE INDEX dictionary_analysis_month_usage ON private.dictionary_paid_attempts
  (COALESCE(dispatched_at, created_at))
  WHERE workflow = 'analysis' AND state <> 'closed';

CREATE FUNCTION private.guard_dictionary_analysis_monthly_budget() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  monthly_limit BIGINT;
  budget_month TIMESTAMP;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
  used NUMERIC;
BEGIN
  IF NEW.workflow <> 'analysis' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.state <> 'sent' OR OLD.state = 'sent' THEN RETURN NEW; END IF;
    NEW.dispatched_at := clock_timestamp();
  END IF;

  -- The grant and claim paths lock this release. Reuse that lock to serialize
  -- reservations and claims across all actors, including both rows of a grant.
  SELECT monthly_limit_nanousd INTO monthly_limit
    FROM private.dictionary_paid_releases WHERE release_id = NEW.release_id FOR UPDATE;
  IF monthly_limit IS NULL THEN RETURN NEW; END IF;

  budget_month := date_trunc('month',
    COALESCE(NEW.dispatched_at, NEW.created_at) AT TIME ZONE 'Europe/Amsterdam');
  month_start := budget_month AT TIME ZONE 'Europe/Amsterdam';
  month_end := (budget_month + INTERVAL '1 month') AT TIME ZONE 'Europe/Amsterdam';

  SELECT COALESCE(SUM(COALESCE(actual_nanousd, reserved_nanousd)), 0) INTO used
    FROM private.dictionary_paid_attempts
    WHERE workflow = 'analysis' AND state <> 'closed'
      AND COALESCE(dispatched_at, created_at) >= month_start
      AND COALESCE(dispatched_at, created_at) < month_end
      AND attempt_id <> NEW.attempt_id;
  IF used + NEW.reserved_nanousd > monthly_limit THEN
    RAISE EXCEPTION 'rate-limit-exceeded';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_dictionary_analysis_monthly_budget()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER guard_dictionary_analysis_monthly_budget
  BEFORE INSERT OR UPDATE OF state ON private.dictionary_paid_attempts
  FOR EACH ROW EXECUTE FUNCTION private.guard_dictionary_analysis_monthly_budget();

COMMIT;
