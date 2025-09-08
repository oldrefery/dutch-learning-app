-- Add new fields for enhanced word features
ALTER TABLE public.words
ADD COLUMN is_reflexive BOOLEAN DEFAULT FALSE,
ADD COLUMN is_expression BOOLEAN DEFAULT FALSE,
ADD COLUMN expression_type TEXT CHECK (expression_type IN ('idiom', 'phrase', 'collocation', 'compound'));
