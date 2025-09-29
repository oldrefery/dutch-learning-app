-- Update expression_type constraint to include all 9 expression types
-- Migration: Add support for proverb, saying, fixed_expression, abbreviation

-- Drop the existing constraint
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_expression_type_check;

-- Create new constraint with all 9 expression types
ALTER TABLE words ADD CONSTRAINT words_expression_type_check
CHECK (expression_type IS NULL OR expression_type = ANY (ARRAY[
  'idiom'::text,
  'phrase'::text,
  'collocation'::text,
  'compound'::text,
  'proverb'::text,
  'saying'::text,
  'fixed_expression'::text,
  'interjection'::text,
  'abbreviation'::text
]));