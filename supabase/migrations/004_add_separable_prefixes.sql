-- Add support for Dutch separable prefixes (scheidbare voorvoegsels)
ALTER TABLE public.words
ADD COLUMN is_separable BOOLEAN DEFAULT FALSE,
ADD COLUMN prefix_part TEXT,
ADD COLUMN root_verb TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.words.is_separable IS 'True if this is a separable verb (like opgeven, aankomen)';
COMMENT ON COLUMN public.words.prefix_part IS 'The separable prefix part (like "op" in "opgeven")';
COMMENT ON COLUMN public.words.root_verb IS 'The root verb part (like "geven" in "opgeven")';

-- Examples:
-- opgeven: is_separable=true, prefix_part="op", root_verb="geven"
-- aankomen: is_separable=true, prefix_part="aan", root_verb="komen"
-- lopen: is_separable=false, prefix_part=null, root_verb=null
