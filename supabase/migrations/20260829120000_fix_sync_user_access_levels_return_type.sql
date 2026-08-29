-- Keep the declared TABLE return type aligned with auth.users.email.
-- auth.users.email is varchar(255), while the public function contract uses TEXT.
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
        au.email::TEXT,
        ual.access_level AS old_access_level,
        COALESCE(
            (SELECT pae.access_level
             FROM public.pre_approved_emails pae
             WHERE LOWER(pae.email) = LOWER(au.email)),
            'read_only'
        ) AS new_access_level,
        TRUE AS updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_user_access_levels IS
    'Manually sync user access levels based on pre_approved_emails table (case-insensitive)';
