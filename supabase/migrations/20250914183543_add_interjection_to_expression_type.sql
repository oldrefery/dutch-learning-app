-- Migration: Add 'interjection' to expression_type constraint
-- Date: 2025-01-14
-- Description: Updates the words_expression_type_check constraint to include 'interjection' value

-- Drop the existing constraint
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_expression_type_check;

-- Add the updated constraint with 'interjection' included
ALTER TABLE words ADD CONSTRAINT words_expression_type_check
CHECK (expression_type = ANY (ARRAY[
    'idiom'::text,
    'phrase'::text,
    'collocation'::text,
    'compound'::text,
    'interjection'::text
]));

-- Comment for documentation
COMMENT ON CONSTRAINT words_expression_type_check ON words
IS 'Ensures expression_type contains only valid expression types including interjections';