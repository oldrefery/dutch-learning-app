-- Centrally hosted, immutable official vocabulary pack manifests.
-- Client roles can read published content but cannot mutate the catalog.

CREATE TABLE public.official_content_packs (
  pack_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cefr_level TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  current_version TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT official_content_packs_pack_id_format
    CHECK (pack_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT official_content_packs_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT official_content_packs_title_not_blank
    CHECK (BTRIM(title) <> ''),
  CONSTRAINT official_content_packs_description_not_blank
    CHECK (BTRIM(description) <> ''),
  CONSTRAINT official_content_packs_cefr_level
    CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT official_content_packs_display_order
    CHECK (display_order >= 0),
  CONSTRAINT official_content_packs_publication_fields
    CHECK (
      (current_version IS NULL AND published_at IS NULL)
      OR (current_version IS NOT NULL AND published_at IS NOT NULL)
    )
);

CREATE TABLE public.official_content_pack_versions (
  pack_id TEXT NOT NULL,
  version TEXT NOT NULL,
  manifest JSONB NOT NULL,
  content_sha256 TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'draft',
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (pack_id, version),
  CONSTRAINT official_content_pack_versions_pack
    FOREIGN KEY (pack_id)
    REFERENCES public.official_content_packs(pack_id)
    ON DELETE RESTRICT,
  CONSTRAINT official_content_pack_versions_version_format
    CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$'),
  CONSTRAINT official_content_pack_versions_digest_format
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT official_content_pack_versions_review_status
    CHECK (review_status IN ('draft', 'published', 'retired')),
  CONSTRAINT official_content_pack_versions_review_fields
    CHECK (
      (review_status = 'draft' AND published_at IS NULL)
      OR (
        review_status IN ('published', 'retired')
        AND reviewed_at IS NOT NULL
        AND published_at IS NOT NULL
      )
    ),
  CONSTRAINT official_content_pack_versions_manifest_shape
    CHECK (
      JSONB_TYPEOF(manifest) = 'object'
      AND manifest ? 'schema_version'
      AND manifest->'schema_version' = '1'::JSONB
      AND manifest ? 'pack_id'
      AND manifest->>'pack_id' = pack_id
      AND manifest ? 'version'
      AND manifest->>'version' = version
      AND manifest ? 'entries'
      AND JSONB_TYPEOF(manifest->'entries') = 'array'
      AND JSONB_ARRAY_LENGTH(manifest->'entries') > 0
    )
);

ALTER TABLE public.official_content_packs
  ADD CONSTRAINT official_content_packs_current_version
  FOREIGN KEY (pack_id, current_version)
  REFERENCES public.official_content_pack_versions(pack_id, version)
  ON DELETE RESTRICT;

CREATE INDEX official_content_packs_catalog_order_idx
  ON public.official_content_packs(cefr_level, display_order, pack_id)
  WHERE current_version IS NOT NULL;

CREATE INDEX official_content_pack_versions_published_idx
  ON public.official_content_pack_versions(pack_id, published_at DESC)
  WHERE review_status = 'published';

CREATE TRIGGER handle_official_content_packs_updated_at
  BEFORE UPDATE ON public.official_content_packs
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

CREATE FUNCTION public.protect_published_official_content_pack_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.review_status IN ('published', 'retired') THEN
      RAISE EXCEPTION 'Published official content versions cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.review_status IN ('published', 'retired') AND (
    NEW.pack_id IS DISTINCT FROM OLD.pack_id
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.manifest IS DISTINCT FROM OLD.manifest
    OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Published official content versions are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_published_official_content_pack_version
  BEFORE UPDATE OR DELETE ON public.official_content_pack_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_published_official_content_pack_version();

REVOKE ALL ON FUNCTION public.protect_published_official_content_pack_version()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_published_official_content_pack_version()
  TO service_role;

ALTER TABLE public.official_content_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_content_pack_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.official_content_packs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.official_content_pack_versions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.official_content_packs TO anon, authenticated;
GRANT SELECT ON public.official_content_pack_versions TO anon, authenticated;
GRANT ALL ON public.official_content_packs TO service_role;
GRANT ALL ON public.official_content_pack_versions TO service_role;

CREATE POLICY "Published official packs are publicly readable"
  ON public.official_content_packs
  FOR SELECT
  TO anon, authenticated
  USING (
    current_version IS NOT NULL
    AND published_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.official_content_pack_versions AS versions
      WHERE versions.pack_id = official_content_packs.pack_id
        AND versions.version = official_content_packs.current_version
        AND versions.review_status = 'published'
    )
  );

CREATE POLICY "Published official pack versions are publicly readable"
  ON public.official_content_pack_versions
  FOR SELECT
  TO anon, authenticated
  USING (review_status = 'published' AND published_at IS NOT NULL);

COMMENT ON TABLE public.official_content_packs IS
  'Public catalog metadata and current immutable version pointers for official content packs.';
COMMENT ON TABLE public.official_content_pack_versions IS
  'Immutable reviewed manifest versions. Client roles can read published versions only.';
COMMENT ON COLUMN public.official_content_pack_versions.content_sha256 IS
  'Lowercase SHA-256 of the canonical manifest payload, verified by clients before import.';
