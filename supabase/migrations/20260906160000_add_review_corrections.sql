-- Corrections replace the effective rating of one review, never its identity.
-- No backfill: pre-migration events do not have a trustworthy full checkpoint.
BEGIN;
LOCK TABLE public.words, public.review_events, public.learning_resets IN ACCESS EXCLUSIVE MODE;

CREATE TABLE public.review_progress_checkpoints (
  event_id UUID PRIMARY KEY REFERENCES public.review_events(event_id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(word_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  previous_interval_days INTEGER NOT NULL,
  previous_repetition_count INTEGER NOT NULL,
  previous_easiness_factor DOUBLE PRECISION NOT NULL,
  review_base_date DATE NOT NULL,
  last_reviewed_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.review_progress_heads (
  word_id UUID PRIMARY KEY REFERENCES public.words(word_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL UNIQUE REFERENCES public.review_progress_checkpoints(event_id) ON DELETE CASCADE
);
CREATE TABLE public.review_assessment_corrections (
  correction_id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.review_progress_checkpoints(event_id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(word_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  revision INTEGER NOT NULL CHECK (revision = expected_revision + 1),
  assessment TEXT NOT NULL CHECK (assessment IN ('again', 'hard', 'good', 'easy')),
  next_interval_days INTEGER NOT NULL,
  next_repetition_count INTEGER NOT NULL,
  next_easiness_factor DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (event_id, revision)
);
CREATE INDEX review_corrections_user_created
  ON public.review_assessment_corrections(user_id, created_at, correction_id);
CREATE INDEX review_checkpoints_word ON public.review_progress_checkpoints(word_id);

ALTER TABLE public.review_progress_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_progress_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assessment_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own review checkpoints" ON public.review_progress_checkpoints
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Read own review heads" ON public.review_progress_heads
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Read own review corrections" ON public.review_assessment_corrections
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.review_progress_checkpoints, public.review_progress_heads,
  public.review_assessment_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.review_progress_checkpoints, public.review_progress_heads,
  public.review_assessment_corrections TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_review_event() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_word public.words%ROWTYPE;
  v_progress RECORD;
  v_base_date DATE;
  v_last_reviewed TIMESTAMPTZ;
BEGIN
  -- Capture inside the existing AFTER trigger, not a separate BEFORE trigger:
  -- legacy multi-row inserts must checkpoint each preceding applied result.
  SELECT * INTO STRICT v_word FROM public.words WHERE word_id = NEW.word_id FOR UPDATE;
  SELECT * INTO v_progress FROM public.calculate_review_progress(
    v_word.interval_days, v_word.repetition_count, v_word.easiness_factor, NEW.assessment);
  v_base_date := GREATEST(NEW.review_date, (v_word.last_reviewed_at AT TIME ZONE 'UTC')::DATE,
    (SELECT r.review_date FROM public.learning_resets r WHERE r.word_id = NEW.word_id
     ORDER BY r.created_at DESC, r.reset_id DESC LIMIT 1));
  v_last_reviewed := GREATEST(v_word.last_reviewed_at, NEW.reviewed_at);
  INSERT INTO public.review_progress_checkpoints(
    event_id, word_id, user_id, previous_interval_days, previous_repetition_count,
    previous_easiness_factor, review_base_date, last_reviewed_at
  ) VALUES (NEW.event_id, NEW.word_id, NEW.user_id, v_word.interval_days,
    v_word.repetition_count, v_word.easiness_factor, v_base_date, v_last_reviewed);
  INSERT INTO public.review_progress_heads(word_id, user_id, event_id)
    VALUES (NEW.word_id, NEW.user_id, NEW.event_id)
    ON CONFLICT (word_id) DO UPDATE SET event_id = EXCLUDED.event_id, user_id = EXCLUDED.user_id;
  UPDATE public.review_events SET previous_interval_days = v_word.interval_days,
    next_interval_days = v_progress.interval_days,
    previous_easiness_factor = v_word.easiness_factor,
    next_easiness_factor = v_progress.easiness_factor
    WHERE event_id = NEW.event_id;
  UPDATE public.words SET interval_days = v_progress.interval_days,
    repetition_count = v_progress.repetition_count, easiness_factor = v_progress.easiness_factor,
    next_review_date = v_base_date + v_progress.interval_days, last_reviewed_at = v_last_reviewed
    WHERE word_id = NEW.word_id AND user_id = NEW.user_id AND deleted_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.invalidate_review_head_on_reset() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Reset RPC already locks the word. Identical reset retries do not INSERT,
  -- so they cannot invalidate the head of a review accepted after that reset.
  DELETE FROM public.review_progress_heads WHERE word_id = NEW.word_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invalidate_review_head_on_reset AFTER INSERT ON public.learning_resets
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_review_head_on_reset();
REVOKE ALL ON FUNCTION public.invalidate_review_head_on_reset() FROM PUBLIC, anon, authenticated;

-- Keep the original stream unchanged for old clients and idempotent uploads.
-- Corrections have a separate incremental cursor; created_at here is still the
-- original event timestamp, and is NOT a cursor for correction synchronization.
CREATE VIEW public.effective_review_events WITH (security_invoker = true) AS
  SELECT e.event_id, e.user_id, e.word_id,
    COALESCE(c.assessment, e.assessment) AS assessment,
    e.review_mode, e.answered_correctly, e.response_time_ms,
    e.previous_interval_days, COALESCE(c.next_interval_days, e.next_interval_days) AS next_interval_days,
    e.previous_easiness_factor, COALESCE(c.next_easiness_factor, e.next_easiness_factor) AS next_easiness_factor,
    e.reviewed_at, e.created_at, e.review_date,
    e.assessment AS original_assessment, COALESCE(c.revision, 0) AS revision
  FROM public.review_events e LEFT JOIN LATERAL (
    SELECT r.* FROM public.review_assessment_corrections r
      WHERE r.event_id = e.event_id ORDER BY r.revision DESC LIMIT 1
  ) c ON true;
REVOKE ALL ON public.effective_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.effective_review_events TO authenticated;

CREATE FUNCTION public.correct_review_assessment(
  p_word_id UUID, p_event_id UUID, p_correction_id UUID,
  p_expected_revision INTEGER, p_assessment TEXT
) RETURNS TABLE (
  correction_id UUID, event_id UUID, accepted_revision INTEGER,
  effective_revision INTEGER, effective_assessment TEXT,
  word_id UUID, interval_days INTEGER, repetition_count INTEGER,
  easiness_factor DOUBLE PRECISION, next_review_date DATE, last_reviewed_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := (SELECT auth.uid());
  v_word public.words%ROWTYPE;
  v_event public.review_events%ROWTYPE;
  v_checkpoint public.review_progress_checkpoints%ROWTYPE;
  v_existing public.review_assessment_corrections%ROWTYPE;
  v_progress RECORD;
  v_revision INTEGER;
  v_assessment TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_word_id IS NULL OR p_event_id IS NULL OR p_correction_id IS NULL
    OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_assessment IS NULL OR p_assessment NOT IN ('again', 'hard', 'good', 'easy') THEN
    RAISE EXCEPTION 'Invalid review correction' USING ERRCODE = '22023';
  END IF;
  -- All reviews, resets and corrections serialize on the same owned word row.
  SELECT * INTO v_word FROM public.words w WHERE w.word_id = p_word_id
    AND w.user_id = v_user AND w.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review word not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_event FROM public.review_events e WHERE e.event_id = p_event_id
    AND e.word_id = p_word_id AND e.user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review event not found' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_existing FROM public.review_assessment_corrections c
    WHERE c.correction_id = p_correction_id;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_user OR v_existing.word_id IS DISTINCT FROM p_word_id
      OR v_existing.event_id IS DISTINCT FROM p_event_id
      OR v_existing.expected_revision IS DISTINCT FROM p_expected_revision
      OR v_existing.assessment IS DISTINCT FROM p_assessment THEN
      RAISE EXCEPTION 'Correction ID already exists with different data' USING ERRCODE = '22023';
    END IF;
    -- An acknowledged retry never reapplies its state, even after another review/reset.
  ELSE
    SELECT * INTO v_checkpoint FROM public.review_progress_checkpoints c
      WHERE c.event_id = p_event_id AND c.word_id = p_word_id AND c.user_id = v_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Review correction unavailable: no trusted checkpoint' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.review_progress_heads h
      WHERE h.word_id = p_word_id AND h.event_id = p_event_id AND h.user_id = v_user) THEN
      RAISE EXCEPTION 'Review correction conflict: word has a newer review or reset' USING ERRCODE = 'PT409';
    END IF;
    SELECT e.revision, e.assessment INTO v_revision, v_assessment
      FROM public.effective_review_events e WHERE e.event_id = p_event_id;
    IF v_revision <> p_expected_revision THEN
      -- This is a business conflict, not a retryable serialization failure.
      -- PostgREST must return it immediately instead of retrying the transaction.
      RAISE EXCEPTION 'Review correction conflict: stale revision' USING ERRCODE = 'PT409';
    END IF;
    -- Fail closed if an administrative write changed progress outside this ledger.
    SELECT * INTO v_progress FROM public.calculate_review_progress(
      v_checkpoint.previous_interval_days, v_checkpoint.previous_repetition_count,
      v_checkpoint.previous_easiness_factor, v_assessment);
    IF (v_word.interval_days, v_word.repetition_count, v_word.easiness_factor,
        v_word.next_review_date, v_word.last_reviewed_at) IS DISTINCT FROM
      (v_progress.interval_days, v_progress.repetition_count, v_progress.easiness_factor,
        v_checkpoint.review_base_date + v_progress.interval_days, v_checkpoint.last_reviewed_at) THEN
      RAISE EXCEPTION 'Review correction conflict: progress changed' USING ERRCODE = 'PT409';
    END IF;
    SELECT * INTO v_progress FROM public.calculate_review_progress(
      v_checkpoint.previous_interval_days, v_checkpoint.previous_repetition_count,
      v_checkpoint.previous_easiness_factor, p_assessment);
    INSERT INTO public.review_assessment_corrections(
      correction_id, event_id, word_id, user_id, expected_revision, revision, assessment,
      next_interval_days, next_repetition_count, next_easiness_factor
    ) VALUES (p_correction_id, p_event_id, p_word_id, v_user, p_expected_revision,
      p_expected_revision + 1, p_assessment, v_progress.interval_days,
      v_progress.repetition_count, v_progress.easiness_factor)
    RETURNING * INTO v_existing;
    UPDATE public.words w SET interval_days = v_progress.interval_days,
      repetition_count = v_progress.repetition_count, easiness_factor = v_progress.easiness_factor,
      next_review_date = v_checkpoint.review_base_date + v_progress.interval_days,
      last_reviewed_at = v_checkpoint.last_reviewed_at WHERE w.word_id = p_word_id;
  END IF;
  RETURN QUERY SELECT p_correction_id, p_event_id, v_existing.revision, e.revision, e.assessment,
    w.word_id, w.interval_days, w.repetition_count, w.easiness_factor, w.next_review_date, w.last_reviewed_at
    FROM public.words w JOIN public.effective_review_events e ON e.event_id = p_event_id
    WHERE w.word_id = p_word_id AND w.user_id = v_user;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_review_assessment(UUID, UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_review_assessment(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;

-- Separate capability: do not change the existing review/reset sync protocol.
CREATE FUNCTION public.review_correction_protocol() RETURNS INTEGER
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 1; $$;
REVOKE ALL ON FUNCTION public.review_correction_protocol() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_correction_protocol() TO authenticated;

COMMENT ON TABLE public.review_assessment_corrections IS
  'Append-only correction receipts; sync separately from immutable review_events.';
COMMENT ON TABLE public.review_progress_checkpoints IS
  'Trusted pre-review state captured for new events only; never reconstructed from legacy history.';
COMMIT;
