-- Add missing word features columns (is_reflexive, is_expression, expression_type)
-- These columns were referenced in the codebase but missing from previous migrations

ALTER TABLE public.words
ADD COLUMN IF NOT EXISTS is_reflexive BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_expression BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expression_type TEXT CHECK (expression_type IN ('idiom', 'phrase', 'collocation', 'compound'));

-- Add comments for clarity
COMMENT ON COLUMN public.words.is_reflexive IS 'True for reflexive verbs (zich wassen, zich herinneren)';
COMMENT ON COLUMN public.words.is_expression IS 'True for expressions, idioms, phrases, compounds';
COMMENT ON COLUMN public.words.expression_type IS 'Type of expression: idiom, phrase, collocation, compound';

-- Examples:
-- is_reflexive=true: zich herinneren, zich voelen, zich haasten
-- is_expression=true, expression_type='idiom': op hol slaan, de kat uit de boom kijken
-- is_expression=true, expression_type='phrase': goedemorgen, tot ziens
-- is_expression=true, expression_type='compound': toothbrush -> tandenborstel

