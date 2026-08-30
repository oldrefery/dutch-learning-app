-- Record one authenticated review assessment and its SRS update atomically.

CREATE OR REPLACE FUNCTION public.record_review_assessment(
  p_word_id UUID,
  p_event_id UUID,
  p_assessment TEXT,
  p_review_mode TEXT,
  p_answered_correctly BOOLEAN,
  p_response_time_ms INTEGER,
  p_reviewed_at TIMESTAMPTZ,
  p_review_date DATE
)
RETURNS TABLE (
  word_id UUID,
  interval_days INTEGER,
  repetition_count INTEGER,
  easiness_factor DOUBLE PRECISION,
  next_review_date DATE,
  last_reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_word public.words%ROWTYPE;
  v_existing_event public.review_events%ROWTYPE;
  v_next_interval INTEGER;
  v_next_repetition INTEGER;
  v_next_easiness DOUBLE PRECISION;
  v_next_review_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_assessment NOT IN ('again', 'hard', 'good', 'easy') THEN
    RAISE EXCEPTION 'Invalid review assessment';
  END IF;

  IF p_review_mode NOT IN (
    'recognition',
    'meaning-recall',
    'dutch-production'
  ) THEN
    RAISE EXCEPTION 'Invalid review mode';
  END IF;

  IF p_response_time_ms IS NOT NULL AND (
    p_response_time_ms < 0 OR p_response_time_ms > 3600000
  ) THEN
    RAISE EXCEPTION 'Invalid response time';
  END IF;

  IF p_reviewed_at IS NULL OR p_review_date IS NULL THEN
    RAISE EXCEPTION 'Review timestamps are required';
  END IF;

  IF ABS(p_review_date - (p_reviewed_at AT TIME ZONE 'UTC')::DATE) > 1 THEN
    RAISE EXCEPTION 'Review date is outside the accepted timezone window';
  END IF;

  SELECT words.*
  INTO v_word
  FROM public.words
  WHERE words.word_id = p_word_id
    AND words.user_id = v_user_id
    AND words.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review word not found';
  END IF;

  -- The event ID is generated before the request. A retried request therefore
  -- returns the current word state without applying the assessment twice.
  SELECT review_events.*
  INTO v_existing_event
  FROM public.review_events
  WHERE review_events.event_id = p_event_id;

  IF FOUND THEN
    IF v_existing_event.user_id IS DISTINCT FROM v_user_id
      OR v_existing_event.word_id IS DISTINCT FROM p_word_id
      OR v_existing_event.assessment IS DISTINCT FROM p_assessment
      OR v_existing_event.review_mode IS DISTINCT FROM p_review_mode
      OR v_existing_event.answered_correctly IS DISTINCT FROM p_answered_correctly
      OR v_existing_event.response_time_ms IS DISTINCT FROM p_response_time_ms
      OR v_existing_event.reviewed_at IS DISTINCT FROM p_reviewed_at
    THEN
      RAISE EXCEPTION 'Review event ID already exists with different data';
    END IF;

    RETURN QUERY SELECT
      v_word.word_id,
      v_word.interval_days,
      v_word.repetition_count,
      v_word.easiness_factor,
      v_word.next_review_date,
      v_word.last_reviewed_at;
    RETURN;
  END IF;

  v_next_interval := v_word.interval_days;
  v_next_repetition := v_word.repetition_count;
  v_next_easiness := v_word.easiness_factor;

  CASE p_assessment
    WHEN 'again' THEN
      v_next_easiness := GREATEST(1.3, v_word.easiness_factor - 0.2);
      v_next_repetition := 0;
      v_next_interval := 0;
    WHEN 'hard' THEN
      v_next_easiness := GREATEST(1.3, v_word.easiness_factor - 0.15);
      v_next_repetition := v_word.repetition_count + 1;
      v_next_interval := CASE
        WHEN v_word.interval_days = 0 THEN 1
        ELSE GREATEST(1, ROUND(v_word.interval_days * 1.2)::INTEGER)
      END;
    WHEN 'good' THEN
      v_next_repetition := v_word.repetition_count + 1;
      v_next_interval := CASE v_next_repetition
        WHEN 1 THEN 1
        WHEN 2 THEN 6
        ELSE ROUND(v_word.interval_days * v_word.easiness_factor)::INTEGER
      END;
    WHEN 'easy' THEN
      v_next_easiness := LEAST(2.5, v_word.easiness_factor + 0.15);
      v_next_repetition := v_word.repetition_count + 1;
      v_next_interval := CASE v_next_repetition
        WHEN 1 THEN 4
        WHEN 2 THEN 10
        ELSE ROUND(
          v_word.interval_days * v_word.easiness_factor * 1.3
        )::INTEGER
      END;
  END CASE;

  v_next_easiness := ROUND(v_next_easiness::NUMERIC, 2)::DOUBLE PRECISION;
  v_next_review_date := p_review_date + v_next_interval;

  UPDATE public.words
  SET
    interval_days = v_next_interval,
    repetition_count = v_next_repetition,
    easiness_factor = v_next_easiness,
    next_review_date = v_next_review_date,
    last_reviewed_at = p_reviewed_at
  WHERE words.word_id = p_word_id
    AND words.user_id = v_user_id;

  INSERT INTO public.review_events (
    event_id,
    user_id,
    word_id,
    assessment,
    review_mode,
    answered_correctly,
    response_time_ms,
    previous_interval_days,
    next_interval_days,
    previous_easiness_factor,
    next_easiness_factor,
    reviewed_at
  ) VALUES (
    p_event_id,
    v_user_id,
    p_word_id,
    p_assessment,
    p_review_mode,
    p_answered_correctly,
    p_response_time_ms,
    v_word.interval_days,
    v_next_interval,
    v_word.easiness_factor,
    v_next_easiness,
    p_reviewed_at
  );

  RETURN QUERY SELECT
    p_word_id,
    v_next_interval,
    v_next_repetition,
    v_next_easiness,
    v_next_review_date,
    p_reviewed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.record_review_assessment(
  UUID, UUID, TEXT, TEXT, BOOLEAN, INTEGER, TIMESTAMPTZ, DATE
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_review_assessment(
  UUID, UUID, TEXT, TEXT, BOOLEAN, INTEGER, TIMESTAMPTZ, DATE
) TO authenticated;

COMMENT ON FUNCTION public.record_review_assessment IS
  'Atomically applies the mobile-compatible SRS algorithm and appends its immutable review event.';
