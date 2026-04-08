-- Add updated_at column to words and collections tables
-- These columns are expected by the app's sync logic (syncManager.ts)

ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows with created_at value
UPDATE public.words SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.collections SET updated_at = created_at WHERE updated_at IS NULL;

-- Enable moddatetime extension for automatic timestamp management
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Auto-update triggers: set updated_at = NOW() on every row update
CREATE TRIGGER handle_words_updated_at
  BEFORE UPDATE ON public.words
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE TRIGGER handle_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);
