-- Migration: Fix OAuth User Access Level Assignment
-- Description: Updates the trigger to handle case-insensitive email matching
--              and fixes access level for existing OAuth users

-- ============================================================================
-- STEP 1: Fix existing user (curysef@gmail.com)
-- ============================================================================
-- Update access level for curysef@gmail.com to full_access
UPDATE public.user_access_levels
SET
    access_level = 'full_access',
    updated_at = NOW()
WHERE user_id = (
    SELECT id
    FROM auth.users
    WHERE LOWER(email) = 'curysef@gmail.com'
)
AND access_level != 'full_access';

-- ============================================================================
-- STEP 2: Improve the trigger function for case-insensitive email matching
-- ============================================================================
-- Replace the existing function with case-insensitive version
CREATE OR REPLACE FUNCTION public.assign_user_access_level()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_access_levels (user_id, access_level)
    VALUES (
        NEW.id,
        COALESCE(
            -- Case-insensitive email lookup
            (SELECT access_level
             FROM public.pre_approved_emails
             WHERE LOWER(email) = LOWER(NEW.email)),
            'read_only'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Add function to sync access levels for existing users
-- ============================================================================
-- This function can be called to re-sync access levels based on pre_approved_emails
CREATE OR REPLACE FUNCTION public.sync_user_access_levels()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    old_access_level TEXT,
    new_access_level TEXT,
    updated BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.user_access_levels ual
    SET
        access_level = COALESCE(
            (SELECT pae.access_level
             FROM public.pre_approved_emails pae
             JOIN auth.users u ON LOWER(u.email) = LOWER(pae.email)
             WHERE u.id = ual.user_id),
            'read_only'
        ),
        updated_at = NOW()
    FROM auth.users au
    WHERE ual.user_id = au.id
    AND ual.access_level != COALESCE(
        (SELECT pae.access_level
         FROM public.pre_approved_emails pae
         WHERE LOWER(pae.email) = LOWER(au.email)),
        'read_only'
    )
    RETURNING
        ual.user_id,
        au.email,
        ual.access_level as old_access_level,
        COALESCE(
            (SELECT pae.access_level
             FROM public.pre_approved_emails pae
             WHERE LOWER(pae.email) = LOWER(au.email)),
            'read_only'
        ) as new_access_level,
        TRUE as updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Ensure pre_approved_emails are lowercase
-- ============================================================================
-- Normalize existing emails to lowercase for consistency
UPDATE public.pre_approved_emails
SET email = LOWER(email)
WHERE email != LOWER(email);

-- Add constraint to enforce lowercase emails in future
CREATE OR REPLACE FUNCTION public.normalize_email_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email = LOWER(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS normalize_pre_approved_email ON public.pre_approved_emails;

-- Create trigger to normalize emails
CREATE TRIGGER normalize_pre_approved_email
    BEFORE INSERT OR UPDATE OF email ON public.pre_approved_emails
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_email_before_insert();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_user_access_levels IS 'Manually sync user access levels based on pre_approved_emails table (case-insensitive)';
COMMENT ON FUNCTION public.normalize_email_before_insert IS 'Normalizes email to lowercase before insert/update';
