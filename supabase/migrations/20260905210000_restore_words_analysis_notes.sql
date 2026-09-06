-- The deployed contract and both clients already use this nullable column,
-- but the historical migration chain only added it to word_analysis_cache.
-- Preserve existing hosted values and make a fresh database reproducible.
ALTER TABLE public.words ADD COLUMN IF NOT EXISTS analysis_notes TEXT;

NOTIFY pgrst, 'reload schema';
