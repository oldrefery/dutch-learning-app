-- Migration: Add register field to word analysis cache
-- Description: Keeps cached AI analysis aligned with words.register for formal/informal badges.

ALTER TABLE public.word_analysis_cache
ADD COLUMN IF NOT EXISTS register TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'word_analysis_cache_register_check'
    ) THEN
        ALTER TABLE public.word_analysis_cache
        ADD CONSTRAINT word_analysis_cache_register_check
        CHECK (register IS NULL OR register IN ('formal', 'informal', 'neutral'));
    END IF;
END $$;

COMMENT ON COLUMN public.word_analysis_cache.register IS
'Formality level of the cached word analysis: formal, informal, or neutral. NULL if unknown.';
