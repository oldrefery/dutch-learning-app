CREATE TABLE public.word_variant_choices_cache (
  lookup_form text PRIMARY KEY,
  choices jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.word_variant_choices_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.word_variant_choices_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.word_variant_choices_cache TO service_role;

CREATE INDEX word_analysis_cache_verified_lookup_form_idx
  ON public.word_analysis_cache (dutch_original)
  WHERE cache_version = 3;
