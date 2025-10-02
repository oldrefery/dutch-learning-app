-- Migration: Add simple_past_plural to conjugation structure
-- Description: Updates conjugation constraint to support simple_past_plural field for verb conjugations

-- Drop existing constraint
ALTER TABLE words
DROP CONSTRAINT IF EXISTS words_conjugation_structure_check;

-- Add updated constraint with simple_past_plural support
ALTER TABLE words
ADD CONSTRAINT words_conjugation_structure_check
CHECK (
    conjugation IS NULL OR (
        jsonb_typeof(conjugation) = 'object' AND
        (conjugation ? 'present' OR conjugation ? 'simple_past' OR conjugation ? 'simple_past_plural' OR conjugation ? 'past_participle') AND
        (NOT (conjugation ? 'present') OR jsonb_typeof(conjugation->'present') = 'string') AND
        (NOT (conjugation ? 'simple_past') OR jsonb_typeof(conjugation->'simple_past') = 'string') AND
        (NOT (conjugation ? 'simple_past_plural') OR jsonb_typeof(conjugation->'simple_past_plural') = 'string') AND
        (NOT (conjugation ? 'past_participle') OR jsonb_typeof(conjugation->'past_participle') = 'string')
    )
);

-- Update comment to reflect new field
COMMENT ON COLUMN words.conjugation IS 'JSONB object containing verb conjugation forms: present, simple_past, simple_past_plural, past_participle';
