-- Add optional structured AI-generated usage guidance without backfilling
-- existing words or cache entries.

ALTER TABLE public.words
ADD COLUMN IF NOT EXISTS usage_notes JSONB;

ALTER TABLE public.word_analysis_cache
ADD COLUMN IF NOT EXISTS usage_notes JSONB;

ALTER TABLE public.words
DROP CONSTRAINT IF EXISTS words_usage_notes_object_check;

ALTER TABLE public.words
ADD CONSTRAINT words_usage_notes_object_check
CHECK (usage_notes IS NULL OR jsonb_typeof(usage_notes) = 'object');

ALTER TABLE public.word_analysis_cache
DROP CONSTRAINT IF EXISTS word_analysis_cache_usage_notes_object_check;

ALTER TABLE public.word_analysis_cache
ADD CONSTRAINT word_analysis_cache_usage_notes_object_check
CHECK (usage_notes IS NULL OR jsonb_typeof(usage_notes) = 'object');

COMMENT ON COLUMN public.words.usage_notes IS
'Validated AI-generated usage guidance with concise contrasts. NULL for legacy or unavailable analyses.';

COMMENT ON COLUMN public.word_analysis_cache.usage_notes IS
'Validated AI-generated usage guidance stored with cache version 2 analyses.';
