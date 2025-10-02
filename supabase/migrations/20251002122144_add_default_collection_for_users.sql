-- Migration: Add Default Collection for All Users
-- Description: Ensures every user has at least one default collection
--              Especially important for read-only users who need a place to import shared words

-- ============================================================================
-- UPDATE: handle_new_user function to create default collection
-- ============================================================================
-- This function runs when a new user registers
-- It creates a user profile AND a default collection

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user profile
    INSERT INTO public.users (id, username)
    VALUES (NEW.id, NEW.email);

    -- Create default collection for the new user
    -- This bypasses RLS policies since the function has SECURITY DEFINER
    INSERT INTO public.collections (user_id, name)
    VALUES (NEW.id, 'My Words');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BACKFILL: Create default collections for existing users
-- ============================================================================
-- For users who don't have any collections, create a default "My Words" collection
-- This ensures read-only users have somewhere to import shared words

INSERT INTO public.collections (user_id, name)
SELECT
    u.id,
    'My Words'
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.user_id = u.id
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.handle_new_user IS
'Creates user profile and default "My Words" collection for new users. Runs with SECURITY DEFINER to bypass RLS for read-only users.';
