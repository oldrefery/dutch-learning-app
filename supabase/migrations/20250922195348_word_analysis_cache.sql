-- Create word analysis cache table for sharing analysis results between users
-- This table stores analysis results independently of users for optimal sharing
-- Use Postgres built-in UUID function instead of uuid-ossp
CREATE TABLE public.word_analysis_cache (
    cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Word identification (using existing normalized dutch_lemma as key)
    dutch_lemma TEXT NOT NULL UNIQUE, -- Already normalized via trim().toLowerCase()
    dutch_original TEXT NOT NULL, -- Original word as submitted

    -- Core analysis fields (matching existing word analysis structure)
    part_of_speech TEXT,
    is_irregular BOOLEAN DEFAULT FALSE,
    article TEXT, -- de/het for nouns
    is_reflexive BOOLEAN DEFAULT FALSE,
    is_expression BOOLEAN DEFAULT FALSE,
    expression_type TEXT,
    is_separable BOOLEAN DEFAULT FALSE,
    prefix_part TEXT,
    root_verb TEXT,

    -- Translations and examples
    translations JSONB NOT NULL, -- {en: [...], ru: [...], etc}
    examples JSONB[] DEFAULT '{}', -- Array of example objects

    -- Media URLs
    tts_url TEXT,
    image_url TEXT,

    -- Enhanced analysis fields
    synonyms JSONB DEFAULT '[]'::jsonb,
    antonyms JSONB DEFAULT '[]'::jsonb,
    plural TEXT,
    conjugation JSONB,
    preposition TEXT,
    analysis_notes TEXT DEFAULT '',

    -- Cache management
    cache_version INTEGER NOT NULL DEFAULT 1, -- For force refresh when prompt updates
    usage_count INTEGER NOT NULL DEFAULT 1, -- How many times requested
    cache_ttl_hours INTEGER NOT NULL DEFAULT 720, -- 30 days default TTL

    -- Timestamps
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_word_cache_dutch_lemma ON public.word_analysis_cache(dutch_lemma);
CREATE INDEX idx_word_cache_usage_count ON public.word_analysis_cache(usage_count DESC);
CREATE INDEX idx_word_cache_last_used ON public.word_analysis_cache(last_used_at DESC);
CREATE INDEX idx_word_cache_created_at ON public.word_analysis_cache(created_at DESC);

-- Enable RLS (authenticated users can only read)
ALTER TABLE public.word_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all cache entries
CREATE POLICY "Authenticated users can read word analysis cache"
    ON public.word_analysis_cache FOR SELECT
    TO authenticated
    USING (true);

-- No INSERT/UPDATE/DELETE policies for regular users
-- All writes happen through Edge Functions using service role

-- Function to check if cache entry is still valid (not expired)
CREATE OR REPLACE FUNCTION public.is_cache_entry_valid(
    created_at TIMESTAMPTZ,
    cache_ttl_hours INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (created_at + INTERVAL '1 hour' * cache_ttl_hours) > NOW();
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to increment usage statistics
CREATE OR REPLACE FUNCTION public.increment_cache_usage(lemma TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.word_analysis_cache
    SET
        usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE dutch_lemma = lemma;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get valid cache entry (helper for Edge Functions)
CREATE OR REPLACE FUNCTION public.get_valid_cache_entry(lemma TEXT)
RETURNS TABLE(
    cache_id UUID,
    dutch_original TEXT,
    dutch_lemma TEXT,
    part_of_speech TEXT,
    is_irregular BOOLEAN,
    article TEXT,
    is_reflexive BOOLEAN,
    is_expression BOOLEAN,
    expression_type TEXT,
    is_separable BOOLEAN,
    prefix_part TEXT,
    root_verb TEXT,
    translations JSONB,
    examples JSONB[],
    tts_url TEXT,
    image_url TEXT,
    synonyms JSONB,
    antonyms JSONB,
    plural TEXT,
    conjugation JSONB,
    preposition TEXT,
    analysis_notes TEXT,
    usage_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.cache_id,
        c.dutch_original,
        c.dutch_lemma,
        c.part_of_speech,
        c.is_irregular,
        c.article,
        c.is_reflexive,
        c.is_expression,
        c.expression_type,
        c.is_separable,
        c.prefix_part,
        c.root_verb,
        c.translations,
        c.examples,
        c.tts_url,
        c.image_url,
        c.synonyms,
        c.antonyms,
        c.plural,
        c.conjugation,
        c.preposition,
        c.analysis_notes,
        c.usage_count
    FROM public.word_analysis_cache c
    WHERE c.dutch_lemma = lemma
        AND public.is_cache_entry_valid(c.created_at, c.cache_ttl_hours)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;