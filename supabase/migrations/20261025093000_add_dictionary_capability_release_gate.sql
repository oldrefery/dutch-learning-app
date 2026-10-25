-- Advertisement remains off until the coordinated client/backend release is reviewed.
-- This gate does not replace dispatch/publication containment or spending controls.
BEGIN;

ALTER TABLE private.dictionary_content_runtime
  ADD COLUMN shared_analysis_capability_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.dictionary_content_capability_v2()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH availability AS (
    SELECT reads_enabled, operations_enabled,
      reads_enabled AND following_reads_enabled AS can_follow,
      shared_analysis_capability_enabled
        AND reads_enabled AND operations_enabled AND legacy_guard_enabled
        AND following_reads_enabled AND following_imports_enabled AND following_cache_enabled
        AND analysis_operations_enabled AND analysis_publication_enabled
        AND analysis_history_enabled AND administrator_rollback_enabled AND semantic_checks_enabled
        AND creation_resolution_enabled AND creation_operations_enabled AND creation_dispatch_enabled
        AND creation_judgement_enabled AND creation_publication_enabled AND creation_recovery_enabled
        AS can_analyze
    FROM private.dictionary_content_runtime WHERE singleton
  )
  SELECT JSONB_BUILD_OBJECT(
    'dictionary_content_protocol', 2,
    'read_protocol_versions', CASE WHEN can_follow THEN '[1,2]'::JSONB
      WHEN reads_enabled THEN '[1]'::JSONB ELSE '[]'::JSONB END,
    'command_protocol_versions', CASE WHEN can_analyze THEN '[1,2]'::JSONB
      WHEN operations_enabled THEN '[1]'::JSONB ELSE '[]'::JSONB END,
    'following_enabled', can_follow,
    'shared_analysis_enabled', can_analyze
  ) FROM availability;
$$;

REVOKE ALL ON FUNCTION public.dictionary_content_capability_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dictionary_content_capability_v2() TO authenticated;

COMMENT ON COLUMN private.dictionary_content_runtime.shared_analysis_capability_enabled IS
  'Default-off capability advertisement for the complete coordinated client profile. Requires separately reviewed endpoints, policies, actor permissions, spending limits and delivery/recovery qualification. Does not enable or stop provider dispatch/publication by itself.';

COMMIT;
