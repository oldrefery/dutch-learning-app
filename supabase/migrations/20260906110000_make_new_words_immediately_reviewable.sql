-- New words must be eligible for their first review on creation day.
-- Only replace the trigger body: existing rows/history and reset scheduling
-- remain untouched. Do not backfill dates or trust uploaded SRS snapshots.
CREATE OR REPLACE FUNCTION public.protect_word_learning_progress() RETURNS TRIGGER
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
    NEW.next_review_date := CASE WHEN FOUND THEN v_existing.next_review_date ELSE CURRENT_DATE END;
  ELSE
    -- Keep the explicit reset RPC requirement and stale-snapshot protection.
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
