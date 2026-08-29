-- Add an immutable, user-owned review event stream for offline learning analytics.

CREATE TABLE public.review_events (
  event_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(word_id) ON DELETE CASCADE,
  assessment TEXT NOT NULL
    CHECK (assessment IN ('again', 'hard', 'good', 'easy')),
  review_mode TEXT NOT NULL
    CHECK (review_mode IN ('recognition', 'meaning-recall', 'dutch-production')),
  answered_correctly BOOLEAN,
  response_time_ms INTEGER
    CHECK (
      response_time_ms IS NULL OR
      (response_time_ms >= 0 AND response_time_ms <= 3600000)
    ),
  previous_interval_days INTEGER NOT NULL
    CHECK (previous_interval_days >= 0),
  next_interval_days INTEGER NOT NULL
    CHECK (next_interval_days >= 0),
  previous_easiness_factor DOUBLE PRECISION NOT NULL
    CHECK (previous_easiness_factor > 0),
  next_easiness_factor DOUBLE PRECISION NOT NULL
    CHECK (next_easiness_factor > 0),
  reviewed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_events_user_created
ON public.review_events(user_id, created_at, event_id);

CREATE INDEX idx_review_events_user_reviewed
ON public.review_events(user_id, reviewed_at, event_id);

CREATE INDEX idx_review_events_word_reviewed
ON public.review_events(word_id, reviewed_at, event_id);

ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own review events"
ON public.review_events
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own review events"
ON public.review_events
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.words
    WHERE words.word_id = review_events.word_id
      AND words.user_id = (SELECT auth.uid())
      AND words.deleted_at IS NULL
  )
);

-- UPDATE is granted only so an idempotent client upsert can return an existing
-- event. The trigger below rejects every material change to event data.
CREATE POLICY "Users can retry their own review events"
ON public.review_events
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.words
    WHERE words.word_id = review_events.word_id
      AND words.user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.preserve_immutable_review_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.word_id IS DISTINCT FROM OLD.word_id
    OR NEW.assessment IS DISTINCT FROM OLD.assessment
    OR NEW.review_mode IS DISTINCT FROM OLD.review_mode
    OR NEW.answered_correctly IS DISTINCT FROM OLD.answered_correctly
    OR NEW.response_time_ms IS DISTINCT FROM OLD.response_time_ms
    OR NEW.previous_interval_days IS DISTINCT FROM OLD.previous_interval_days
    OR NEW.next_interval_days IS DISTINCT FROM OLD.next_interval_days
    OR NEW.previous_easiness_factor IS DISTINCT FROM OLD.previous_easiness_factor
    OR NEW.next_easiness_factor IS DISTINCT FROM OLD.next_easiness_factor
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
  THEN
    RAISE EXCEPTION 'review_events rows are immutable';
  END IF;

  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_review_event_on_update
BEFORE UPDATE ON public.review_events
FOR EACH ROW
EXECUTE FUNCTION public.preserve_immutable_review_event();

CREATE OR REPLACE FUNCTION public.delete_review_events_for_tombstoned_word()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.review_events WHERE word_id = NEW.word_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER delete_review_events_on_word_tombstone
AFTER UPDATE OF deleted_at ON public.words
FOR EACH ROW
EXECUTE FUNCTION public.delete_review_events_for_tombstoned_word();

GRANT SELECT, INSERT, UPDATE ON public.review_events TO authenticated;

COMMENT ON TABLE public.review_events IS
  'Append-only review outcomes synchronized from offline clients.';

COMMENT ON COLUMN public.review_events.created_at IS
  'Server-assigned timestamp used with event_id as the incremental sync cursor.';

COMMENT ON FUNCTION public.preserve_immutable_review_event IS
  'Allows identical idempotent upserts while rejecting material event updates.';

COMMENT ON FUNCTION public.delete_review_events_for_tombstoned_word IS
  'Removes review history when its parent word is soft-deleted.';
