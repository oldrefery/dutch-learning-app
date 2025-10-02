-- Migration: Grant Usage on Private Schema
-- Description: Allow authenticated users to execute functions in private schema
--              This is required for public wrapper functions to call private SECURITY DEFINER functions

-- ============================================================================
-- GRANT SCHEMA USAGE
-- ============================================================================
-- Allow authenticated users to use the private schema
-- This allows them to call functions within the schema
-- The functions themselves still control their own access via GRANT EXECUTE

GRANT USAGE ON SCHEMA private TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON SCHEMA private IS 'Private schema for SECURITY DEFINER functions. Accessible via public wrappers only.';
