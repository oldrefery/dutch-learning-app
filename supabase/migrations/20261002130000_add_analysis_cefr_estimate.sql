-- Optional model-only analysis metadata. Never publishes a dictionary assessment.
ALTER TABLE public.word_analysis_cache ADD COLUMN cefr_estimate JSONB;

ALTER TABLE public.word_analysis_cache
  ADD CONSTRAINT word_analysis_cache_cefr_estimate_valid CHECK (
    cefr_estimate IS NULL OR COALESCE(
      jsonb_typeof(cefr_estimate) = 'object'
      AND cefr_estimate->>'source' = 'model'
      AND cefr_estimate->>'input_version' = 'word-analysis-cefr-v1'
      AND cefr_estimate->>'input_sha256' ~ '^[0-9a-f]{64}$'
      AND jsonb_typeof(cefr_estimate->'method') = 'string'
      AND LENGTH(cefr_estimate->>'method') BETWEEN 1 AND 120
      AND BTRIM(cefr_estimate->>'method') = cefr_estimate->>'method'
      AND jsonb_typeof(cefr_estimate->'method_version') = 'string'
      AND LENGTH(cefr_estimate->>'method_version') BETWEEN 1 AND 120
      AND BTRIM(cefr_estimate->>'method_version') = cefr_estimate->>'method_version'
      AND (
        (cefr_estimate->>'status' = 'unknown'
          AND cefr_estimate->'level' = 'null'::JSONB
          AND cefr_estimate->'confidence' = 'null'::JSONB)
        OR (cefr_estimate->>'status' = 'estimated'
          AND cefr_estimate->>'level' IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
          AND CASE WHEN jsonb_typeof(cefr_estimate->'confidence') = 'number'
            THEN (cefr_estimate->>'confidence')::NUMERIC BETWEEN 0 AND 1
            ELSE FALSE END)
      ), FALSE)
  );

COMMENT ON COLUMN public.word_analysis_cache.cefr_estimate IS
  'Optional model estimate with an analysis-input digest. Not reviewed provenance, a meaning identity, or authority to publish shared CEFR.';
