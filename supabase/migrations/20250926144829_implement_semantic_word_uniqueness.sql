-- Implement Semantic Word Uniqueness
-- This addresses the limitation where users cannot add semantically different words
-- that share the same dutch_lemma but have different parts of speech or articles
--
-- Examples that will now be possible:
-- - "het haar" (hair, collective) + "de haar" (a single hair) + "haar" (pronoun: her)
-- - "het idee" (idea, general) + "de idee" (idea, philosophical concept)

-- 1. Update words table uniqueness constraint
-- Remove any existing simple uniqueness constraints if they exist
DROP INDEX IF EXISTS idx_words_user_lemma_unique;

-- Create new semantic uniqueness constraint for words table
-- This allows the same dutch_lemma with different part_of_speech and/or article
CREATE UNIQUE INDEX idx_words_semantic_unique
ON public.words(
    user_id,
    dutch_lemma,
    COALESCE(part_of_speech, 'unknown'),
    COALESCE(article, '')
);

-- 2. Update word_analysis_cache table uniqueness constraint
-- First, drop the existing simple uniqueness constraint
DROP INDEX IF EXISTS idx_word_cache_dutch_lemma;
ALTER TABLE public.word_analysis_cache DROP CONSTRAINT IF EXISTS word_analysis_cache_dutch_lemma_key;

-- Add new columns to cache table if they don't exist
-- (These might already exist from previous migrations)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'word_analysis_cache'
                   AND column_name = 'part_of_speech') THEN
        ALTER TABLE public.word_analysis_cache ADD COLUMN part_of_speech TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'word_analysis_cache'
                   AND column_name = 'article') THEN
        ALTER TABLE public.word_analysis_cache ADD COLUMN article TEXT;
    END IF;
END $$;

-- Create new semantic uniqueness constraint for cache table
CREATE UNIQUE INDEX idx_cache_semantic_unique
ON public.word_analysis_cache(
    dutch_lemma,
    COALESCE(part_of_speech, 'unknown'),
    COALESCE(article, '')
);

-- 3. Create optimized indexes for common queries
-- Index for lemma-only queries (backwards compatibility)
CREATE INDEX idx_words_lemma_lookup
ON public.words(user_id, dutch_lemma);

-- Index for cache lemma-only queries
CREATE INDEX idx_cache_lemma_lookup
ON public.word_analysis_cache(dutch_lemma);

-- Index for part_of_speech queries
CREATE INDEX idx_words_part_of_speech
ON public.words(part_of_speech) WHERE part_of_speech IS NOT NULL;

-- Index for article queries
CREATE INDEX idx_words_article
ON public.words(article) WHERE article IS NOT NULL;

-- 4. Update existing cache data to have proper part_of_speech and article values
-- This ensures existing cache entries work with the new schema
UPDATE public.word_analysis_cache
SET
    part_of_speech = COALESCE(part_of_speech, 'unknown'),
    article = COALESCE(article, '')
WHERE part_of_speech IS NULL OR article IS NULL;

-- Add comments to document the new schema
COMMENT ON INDEX idx_words_semantic_unique IS
    'Ensures semantic uniqueness: same dutch_lemma can exist with different part_of_speech and/or article';

COMMENT ON INDEX idx_cache_semantic_unique IS
    'Cache uniqueness based on full semantic context: lemma + part_of_speech + article';

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Successfully implemented semantic word uniqueness system';
    RAISE NOTICE 'Users can now add: het haar, de haar, and haar (pronoun) as separate entries';
    RAISE NOTICE 'Cache system updated to handle semantic variants properly';
END $$;