-- Migration: Add enhanced Gemini AI fields to words table
-- Date: 2025-01-18
-- Description: Adds synonyms, antonyms, plural, conjugation, and preposition fields to support enhanced Gemini prompt

BEGIN;

-- Add synonyms array field
ALTER TABLE words
ADD COLUMN synonyms TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;

-- Add antonyms array field
ALTER TABLE words
ADD COLUMN antonyms TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL;

-- Add plural form for nouns
ALTER TABLE words
ADD COLUMN plural TEXT NULL;

-- Add conjugation forms as JSONB for verbs
-- Structure: {"present": "string", "simple_past": "string", "past_participle": "string"}
ALTER TABLE words
ADD COLUMN conjugation JSONB NULL;

-- Add fixed preposition field (e.g., "van" for "genieten van")
ALTER TABLE words
ADD COLUMN preposition TEXT NULL;

-- Add constraints for conjugation structure
ALTER TABLE words
ADD CONSTRAINT words_conjugation_structure_check
CHECK (
    conjugation IS NULL OR (
        jsonb_typeof(conjugation) = 'object' AND
        (conjugation ? 'present' OR conjugation ? 'simple_past' OR conjugation ? 'past_participle') AND
        (NOT (conjugation ? 'present') OR jsonb_typeof(conjugation->'present') = 'string') AND
        (NOT (conjugation ? 'simple_past') OR jsonb_typeof(conjugation->'simple_past') = 'string') AND
        (NOT (conjugation ? 'past_participle') OR jsonb_typeof(conjugation->'past_participle') = 'string')
    )
);

-- Add constraint for preposition length
ALTER TABLE words
ADD CONSTRAINT words_preposition_length_check
CHECK (preposition IS NULL OR char_length(preposition) BETWEEN 1 AND 20);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_words_synonyms ON words USING GIN(synonyms);
CREATE INDEX IF NOT EXISTS idx_words_antonyms ON words USING GIN(antonyms);
CREATE INDEX IF NOT EXISTS idx_words_plural ON words(plural) WHERE plural IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_words_conjugation ON words USING GIN(conjugation) WHERE conjugation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_words_preposition ON words(preposition) WHERE preposition IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN words.synonyms IS 'Array of Dutch synonyms for the word';
COMMENT ON COLUMN words.antonyms IS 'Array of Dutch antonyms for the word';
COMMENT ON COLUMN words.plural IS 'Plural form for Dutch nouns (de huis -> de huizen)';
COMMENT ON COLUMN words.conjugation IS 'JSONB object containing verb conjugation forms: present, simple_past, past_participle';
COMMENT ON COLUMN words.preposition IS 'Fixed preposition that consistently goes with this word (e.g., "van" for "genieten van")';

COMMIT;