-- Reviews are commands, not replaceable word snapshots. Existing history is
-- already applied and is not replayed. New events serialize on the word row.
BEGIN;
LOCK TABLE public.words, public.review_events IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.review_events ADD COLUMN review_date DATE;

-- Legacy snapshot and event uploads were separate transactions. An unknown
-- pre-cutover event may already be included in the snapshot; do not guess.
CREATE TABLE public.learning_progress_cutovers (
  word_id UUID PRIMARY KEY REFERENCES public.words(word_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cutover_at TIMESTAMPTZ NOT NULL
);
INSERT INTO public.learning_progress_cutovers(word_id, user_id, cutover_at)
  SELECT word_id, user_id, clock_timestamp() FROM public.words;
ALTER TABLE public.learning_progress_cutovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their learning cutover" ON public.learning_progress_cutovers
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.learning_progress_cutovers FROM anon, authenticated;
GRANT SELECT ON public.learning_progress_cutovers TO authenticated;

CREATE FUNCTION public.calculate_review_progress(
  p_interval INTEGER, p_repetitions INTEGER, p_easiness DOUBLE PRECISION,
  p_assessment TEXT
) RETURNS TABLE (interval_days INTEGER, repetition_count INTEGER, easiness_factor DOUBLE PRECISION)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_raw DOUBLE PRECISION := p_interval;
BEGIN
  repetition_count := p_repetitions + 1;
  easiness_factor := p_easiness;
  CASE p_assessment
    WHEN 'again' THEN
      repetition_count := 0;
      easiness_factor := GREATEST(1.3, p_easiness - 0.2);
      v_raw := 0;
    WHEN 'hard' THEN
      easiness_factor := GREATEST(1.3, p_easiness - 0.15);
      v_raw := CASE WHEN p_interval = 0 THEN 1 ELSE p_interval * 1.2::DOUBLE PRECISION END;
    WHEN 'good' THEN
      v_raw := CASE repetition_count WHEN 1 THEN 1 WHEN 2 THEN 6
        ELSE p_interval * p_easiness END;
    WHEN 'easy' THEN
      easiness_factor := LEAST(2.5, p_easiness + 0.15);
      v_raw := CASE repetition_count WHEN 1 THEN 4 WHEN 2 THEN 10
        ELSE p_interval * p_easiness * 1.3::DOUBLE PRECISION END;
    ELSE RAISE EXCEPTION 'Invalid review assessment';
  END CASE;
  interval_days := CASE WHEN p_assessment = 'again' THEN 0 ELSE GREATEST(1,
    FLOOR(v_raw)::INTEGER + CASE WHEN v_raw - FLOOR(v_raw) >= 0.5 THEN 1 ELSE 0 END) END;
  easiness_factor := ROUND(easiness_factor::NUMERIC, 2)::DOUBLE PRECISION;
  RETURN NEXT;
END;
$$;

-- The table owner (migration/admin and narrowly scoped definer triggers) may
-- write progress. JWT callers may only replace metadata, including on upsert.
CREATE FUNCTION public.protect_word_learning_progress() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_existing public.words%ROWTYPE;
BEGIN
  IF current_user = pg_catalog.pg_get_userbyid(
    (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID)
  ) THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_existing FROM public.words WHERE word_id = NEW.word_id FOR UPDATE;
    NEW.interval_days := CASE WHEN FOUND THEN v_existing.interval_days ELSE 1 END;
    NEW.repetition_count := CASE WHEN FOUND THEN v_existing.repetition_count ELSE 0 END;
    NEW.easiness_factor := CASE WHEN FOUND THEN v_existing.easiness_factor ELSE 2.5 END;
    NEW.last_reviewed_at := v_existing.last_reviewed_at;
    NEW.next_review_date := CASE WHEN FOUND THEN v_existing.next_review_date ELSE CURRENT_DATE + 1 END;
  ELSE
    -- A legacy reset cannot be distinguished from an old unreviewed snapshot.
    -- Fail visibly rather than silently acknowledge a reset that did not happen.
    IF OLD.last_reviewed_at IS NOT NULL AND NEW.last_reviewed_at IS NULL
      AND NEW.interval_days = 1 AND NEW.repetition_count = 0
      AND NEW.easiness_factor = 2.5 THEN
      RAISE EXCEPTION 'Progress reset requires reset_word_learning_progress; update the client';
    END IF;
    NEW.interval_days := OLD.interval_days;
    NEW.repetition_count := OLD.repetition_count;
    NEW.easiness_factor := OLD.easiness_factor;
    NEW.last_reviewed_at := OLD.last_reviewed_at;
    NEW.next_review_date := OLD.next_review_date;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_word_learning_progress
BEFORE INSERT OR UPDATE ON public.words
FOR EACH ROW EXECUTE FUNCTION public.protect_word_learning_progress();

CREATE FUNCTION public.prepare_review_event() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_word public.words%ROWTYPE;
  v_existing public.review_events%ROWTYPE;
  v_progress RECORD;
BEGIN
  -- This invoker trigger keeps ownership and visibility subject to normal RLS.
  IF NEW.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Review event violates row-level security' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_word FROM public.words
    WHERE word_id = NEW.word_id AND user_id = NEW.user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review word not found; row-level security' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.review_events WHERE event_id = NEW.event_id;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM NEW.user_id
      OR v_existing.word_id IS DISTINCT FROM NEW.word_id
      OR v_existing.assessment IS DISTINCT FROM NEW.assessment
      OR v_existing.review_mode IS DISTINCT FROM NEW.review_mode
      OR v_existing.answered_correctly IS DISTINCT FROM NEW.answered_correctly
      OR v_existing.response_time_ms IS DISTINCT FROM NEW.response_time_ms
      OR v_existing.reviewed_at IS DISTINCT FROM NEW.reviewed_at
      OR (NEW.review_date IS NOT NULL AND v_existing.review_date IS NOT NULL
        AND NEW.review_date IS DISTINCT FROM v_existing.review_date)
    THEN RAISE EXCEPTION 'Review event ID already exists with different data'; END IF;
    -- Old clients retry their provisional before/after values. Canonicalize the
    -- candidate, but do not apply anything until an INSERT actually succeeds.
    RETURN v_existing;
  END IF;
  IF EXISTS (SELECT 1 FROM public.learning_progress_cutovers c
    WHERE c.word_id = NEW.word_id AND NEW.reviewed_at <= c.cutover_at) THEN
    RAISE EXCEPTION 'Legacy review requires reconciliation before upload; keep the local event';
  END IF;
  NEW.review_date := COALESCE(NEW.review_date, (NEW.reviewed_at AT TIME ZONE 'UTC')::DATE);
  IF NEW.reviewed_at IS NULL OR ABS(NEW.review_date - (NEW.reviewed_at AT TIME ZONE 'UTC')::DATE) > 1 THEN
    RAISE EXCEPTION 'Invalid review timestamps';
  END IF;
  SELECT * INTO v_progress FROM public.calculate_review_progress(
    v_word.interval_days, v_word.repetition_count, v_word.easiness_factor, NEW.assessment);
  NEW.previous_interval_days := v_word.interval_days;
  NEW.previous_easiness_factor := v_word.easiness_factor;
  NEW.next_interval_days := v_progress.interval_days;
  NEW.next_easiness_factor := v_progress.easiness_factor;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.apply_review_event() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_word public.words%ROWTYPE;
  v_progress RECORD;
BEGIN
  -- Only an actual new, RLS-authorized event reaches this trigger. The BEFORE
  -- trigger holds the word lock through commit, including concurrent retries.
  -- AFTER ROW triggers run at statement end: multiple events in one legacy
  -- upsert must each calculate from the preceding event's committed-in-this-
  -- transaction state, not all from the BEFORE trigger's original snapshot.
  SELECT * INTO STRICT v_word FROM public.words WHERE word_id = NEW.word_id FOR UPDATE;
  SELECT * INTO v_progress FROM public.calculate_review_progress(
    v_word.interval_days, v_word.repetition_count, v_word.easiness_factor, NEW.assessment);
  UPDATE public.review_events SET previous_interval_days = v_word.interval_days,
    next_interval_days = v_progress.interval_days,
    previous_easiness_factor = v_word.easiness_factor,
    next_easiness_factor = v_progress.easiness_factor
    WHERE event_id = NEW.event_id;
  UPDATE public.words SET
    interval_days = v_progress.interval_days,
    repetition_count = v_progress.repetition_count,
    easiness_factor = v_progress.easiness_factor,
    next_review_date = GREATEST(NEW.review_date, (last_reviewed_at AT TIME ZONE 'UTC')::DATE,
      (SELECT r.review_date FROM public.learning_resets r WHERE r.word_id = NEW.word_id
       ORDER BY r.created_at DESC, r.reset_id DESC LIMIT 1))
      + v_progress.interval_days,
    last_reviewed_at = GREATEST(last_reviewed_at, NEW.reviewed_at)
  WHERE word_id = NEW.word_id AND user_id = NEW.user_id AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prepare_review_event BEFORE INSERT ON public.review_events
FOR EACH ROW EXECUTE FUNCTION public.prepare_review_event();
CREATE TRIGGER apply_review_event AFTER INSERT ON public.review_events
FOR EACH ROW EXECUTE FUNCTION public.apply_review_event();

CREATE OR REPLACE FUNCTION public.preserve_immutable_review_event() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user = pg_catalog.pg_get_userbyid(
    (SELECT relowner FROM pg_catalog.pg_class WHERE oid = TG_RELID)
  ) AND (to_jsonb(NEW) - ARRAY['previous_interval_days', 'next_interval_days',
      'previous_easiness_factor', 'next_easiness_factor']) IS NOT DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['previous_interval_days', 'next_interval_days',
      'previous_easiness_factor', 'next_easiness_factor']) THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'created_at') IS DISTINCT FROM (to_jsonb(OLD) - 'created_at') THEN
    RAISE EXCEPTION 'review_events rows are immutable';
  END IF;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_review_assessment(
  p_word_id UUID, p_event_id UUID, p_assessment TEXT, p_review_mode TEXT,
  p_answered_correctly BOOLEAN, p_response_time_ms INTEGER,
  p_reviewed_at TIMESTAMPTZ, p_review_date DATE
) RETURNS TABLE (
  word_id UUID, interval_days INTEGER, repetition_count INTEGER,
  easiness_factor DOUBLE PRECISION, next_review_date DATE, last_reviewed_at TIMESTAMPTZ
) LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_review_date IS NULL THEN RAISE EXCEPTION 'Review timestamps are required'; END IF;
  INSERT INTO public.review_events (
    event_id, user_id, word_id, assessment, review_mode, answered_correctly,
    response_time_ms, previous_interval_days, next_interval_days,
    previous_easiness_factor, next_easiness_factor, reviewed_at, review_date
  ) VALUES (
    p_event_id, (SELECT auth.uid()), p_word_id, p_assessment, p_review_mode,
    p_answered_correctly, p_response_time_ms, 0, 0, 1, 1, p_reviewed_at, p_review_date
  ) ON CONFLICT (event_id) DO UPDATE SET
    user_id = EXCLUDED.user_id, word_id = EXCLUDED.word_id,
    assessment = EXCLUDED.assessment, review_mode = EXCLUDED.review_mode,
    answered_correctly = EXCLUDED.answered_correctly,
    response_time_ms = EXCLUDED.response_time_ms,
    reviewed_at = EXCLUDED.reviewed_at, review_date = EXCLUDED.review_date;
  RETURN QUERY SELECT w.word_id, w.interval_days, w.repetition_count,
    w.easiness_factor, w.next_review_date, w.last_reviewed_at
  FROM public.words w WHERE w.word_id = p_word_id AND w.user_id = (SELECT auth.uid());
END;
$$;

-- Reset is a separately identified command, not a magic combination of fields.
CREATE TABLE public.learning_resets (
  reset_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(word_id) ON DELETE CASCADE,
  reset_at TIMESTAMPTZ NOT NULL,
  review_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.learning_resets ENABLE ROW LEVEL SECURITY;
CREATE INDEX learning_resets_word_created ON public.learning_resets(word_id, created_at DESC, reset_id DESC);
-- This ledger is private: authenticated clients can only use the checked RPC.
REVOKE ALL ON public.learning_resets FROM anon, authenticated;

CREATE FUNCTION public.reset_word_learning_progress(
  p_word_id UUID, p_reset_id UUID, p_reset_at TIMESTAMPTZ, p_review_date DATE,
  p_collection_id UUID DEFAULT NULL
) RETURNS TABLE (word_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
  v_existing public.learning_resets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_reset_at IS NULL OR p_review_date IS NULL
    OR ABS(p_review_date - (p_reset_at AT TIME ZONE 'UTC')::DATE) > 1 THEN
    RAISE EXCEPTION 'Invalid reset timestamps';
  END IF;
  PERFORM 1 FROM public.words w WHERE w.word_id = p_word_id AND w.user_id = v_user
    AND w.deleted_at IS NULL AND (p_collection_id IS NULL OR w.collection_id = p_collection_id)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reset word not found'; END IF;
  SELECT * INTO v_existing FROM public.learning_resets WHERE reset_id = p_reset_id;
  IF FOUND THEN
    IF v_existing.word_id IS DISTINCT FROM p_word_id OR v_existing.user_id IS DISTINCT FROM v_user
      OR v_existing.reset_at IS DISTINCT FROM p_reset_at OR v_existing.review_date IS DISTINCT FROM p_review_date
    THEN RAISE EXCEPTION 'Reset ID already exists with different data'; END IF;
  ELSE
    INSERT INTO public.learning_resets(reset_id, user_id, word_id, reset_at, review_date)
      VALUES (p_reset_id, v_user, p_word_id, p_reset_at, p_review_date);
    UPDATE public.words w SET interval_days = 1, repetition_count = 0, easiness_factor = 2.5,
      next_review_date = p_review_date + 1, last_reviewed_at = NULL
      WHERE w.word_id = p_word_id AND w.user_id = v_user;
  END IF;
  RETURN QUERY SELECT p_word_id;
END;
$$;

CREATE FUNCTION public.learning_sync_protocol() RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 2; $$;

REVOKE ALL ON FUNCTION public.calculate_review_progress(INTEGER, INTEGER, DOUBLE PRECISION, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_review_progress(INTEGER, INTEGER, DOUBLE PRECISION, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_word_learning_progress() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_review_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_review_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_word_learning_progress(UUID, UUID, TIMESTAMPTZ, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_word_learning_progress(UUID, UUID, TIMESTAMPTZ, DATE, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.learning_sync_protocol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.learning_sync_protocol() TO authenticated;
COMMIT;
