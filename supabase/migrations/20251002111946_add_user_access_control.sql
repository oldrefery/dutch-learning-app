-- Migration: Add User Access Control System
-- Description: Implements tiered access control (read_only vs full_access)
--              with email pre-approval whitelist

-- ============================================================================
-- TABLE: pre_approved_emails
-- ============================================================================
-- Stores email addresses that should receive specific access levels
-- Admin-managed whitelist for granting full access to users
CREATE TABLE public.pre_approved_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'full_access' CHECK (access_level IN ('read_only', 'full_access')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookup during registration
CREATE INDEX idx_pre_approved_emails_email ON public.pre_approved_emails(email);

-- ============================================================================
-- TABLE: user_access_levels
-- ============================================================================
-- Stores the access level for each user
-- Automatically populated via trigger on user registration
CREATE TABLE public.user_access_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('read_only', 'full_access')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user_id lookup
CREATE INDEX idx_user_access_levels_user_id ON public.user_access_levels(user_id);

-- ============================================================================
-- FUNCTION: get_user_access_level
-- ============================================================================
-- Helper function to get access level for a user
-- Returns 'read_only' by default if not found
CREATE OR REPLACE FUNCTION public.get_user_access_level(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT access_level FROM public.user_access_levels WHERE user_id = user_uuid),
        'read_only'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: assign_user_access_level
-- ============================================================================
-- Automatically assigns access level to new users based on email whitelist
-- Default: read_only
-- If email in pre_approved_emails: use specified access_level
CREATE OR REPLACE FUNCTION public.assign_user_access_level()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_access_levels (user_id, access_level)
    VALUES (
        NEW.id,
        COALESCE(
            (SELECT access_level FROM public.pre_approved_emails WHERE email = NEW.email),
            'read_only'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: on_auth_user_access_assigned
-- ============================================================================
-- Automatically assign access level when new user registers
CREATE TRIGGER on_auth_user_access_assigned
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.assign_user_access_level();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.pre_approved_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_levels ENABLE ROW LEVEL SECURITY;

-- Pre-approved emails: Only service role can manage (admin only)
-- No user-facing policies - admin managed only

-- User access levels: Users can view their own access level
CREATE POLICY "Users can view their own access level"
    ON public.user_access_levels FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE EXISTING RLS POLICIES
-- ============================================================================
-- Restrict collection/word creation to full_access users only

-- Drop existing collection creation policy
DROP POLICY IF EXISTS "Users can create their own collections" ON public.collections;

-- Recreate with access level check
CREATE POLICY "Users can create their own collections"
    ON public.collections FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.get_user_access_level(auth.uid()) = 'full_access'
    );

-- Drop existing word creation policy
DROP POLICY IF EXISTS "Users can create their own words" ON public.words;

-- Recreate with access level check
CREATE POLICY "Users can create their own words"
    ON public.words FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.get_user_access_level(auth.uid()) = 'full_access'
    );

-- ============================================================================
-- GRANT EXISTING USERS FULL ACCESS
-- ============================================================================
-- Backfill: Give all existing users full_access to maintain current functionality
INSERT INTO public.user_access_levels (user_id, access_level)
SELECT id, 'full_access'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_access_levels);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.pre_approved_emails IS 'Admin-managed whitelist for granting specific access levels to users by email';
COMMENT ON TABLE public.user_access_levels IS 'Stores access level for each user (read_only or full_access)';
COMMENT ON FUNCTION public.get_user_access_level IS 'Returns access level for a given user UUID';
COMMENT ON FUNCTION public.assign_user_access_level IS 'Trigger function to automatically assign access level on user registration';
