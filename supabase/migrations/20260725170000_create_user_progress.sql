-- Add the remote progress stream expected by the offline synchronization path.

CREATE TABLE public.user_progress (
  progress_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.words(word_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reviewed_count INTEGER NOT NULL DEFAULT 0 CHECK (reviewed_count >= 0),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_user_progress_word_id
ON public.user_progress(word_id);

CREATE INDEX idx_user_progress_sync_cursor
ON public.user_progress(user_id, updated_at, progress_id);

CREATE INDEX idx_user_progress_user_deleted_at
ON public.user_progress(user_id, deleted_at);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
ON public.user_progress
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own progress"
ON public.user_progress
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.words
    WHERE words.word_id = user_progress.word_id
      AND words.user_id = (SELECT auth.uid())
      AND words.deleted_at IS NULL
  )
);

CREATE POLICY "Users can update their own progress"
ON public.user_progress
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1
    FROM public.words
    WHERE words.word_id = user_progress.word_id
      AND words.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can delete their own progress"
ON public.user_progress
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.preserve_user_progress_tombstone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER preserve_user_progress_tombstone_on_update
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.preserve_user_progress_tombstone();

CREATE TRIGGER handle_user_progress_updated_at
BEFORE UPDATE ON public.user_progress
FOR EACH ROW
EXECUTE PROCEDURE extensions.moddatetime(updated_at);

COMMENT ON TABLE public.user_progress IS
  'User-owned review progress synchronized across offline clients.';

COMMENT ON COLUMN public.user_progress.deleted_at IS
  'Soft-delete timestamp retained for incremental offline synchronization.';

COMMENT ON FUNCTION public.preserve_user_progress_tombstone IS
  'Prevents stale updates and upserts from clearing a progress tombstone.';
