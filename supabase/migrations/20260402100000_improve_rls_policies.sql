-- ============================================================================
-- Improve RLS policies: add WITH CHECK to UPDATE, TO authenticated role,
-- and (SELECT auth.uid()) subquery for performance
-- ============================================================================

-- ============================================================================
-- COLLECTIONS TABLE
-- ============================================================================

-- SELECT policy: add TO authenticated and (SELECT auth.uid()) optimization
DROP POLICY IF EXISTS "Users can view their own collections" ON public.collections;
CREATE POLICY "Users can view their own collections"
    ON public.collections FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- INSERT policy: add TO authenticated and (SELECT auth.uid()) optimization
DROP POLICY IF EXISTS "Users can create their own collections" ON public.collections;
CREATE POLICY "Users can create their own collections"
    ON public.collections FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND public.get_user_access_level((SELECT auth.uid())) = 'full_access'
    );

-- UPDATE policy: add WITH CHECK, TO authenticated, and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can update their own collections" ON public.collections;
CREATE POLICY "Users can update their own collections"
    ON public.collections FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE policy: add TO authenticated and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can delete their own collections" ON public.collections;
CREATE POLICY "Users can delete their own collections"
    ON public.collections FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Shared collections policy: keep for all authenticated users
DROP POLICY IF EXISTS "Allow reading shared collections" ON public.collections;
CREATE POLICY "Allow reading shared collections"
    ON public.collections FOR SELECT
    TO authenticated
    USING (is_shared = true);

-- ============================================================================
-- WORDS TABLE
-- ============================================================================

-- SELECT policy: add TO authenticated and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can view their own words" ON public.words;
CREATE POLICY "Users can view their own words"
    ON public.words FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- INSERT policy: add TO authenticated and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can create their own words" ON public.words;
CREATE POLICY "Users can create their own words"
    ON public.words FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND public.get_user_access_level((SELECT auth.uid())) = 'full_access'
    );

-- UPDATE policy: add WITH CHECK, TO authenticated, and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can update their own words" ON public.words;
CREATE POLICY "Users can update their own words"
    ON public.words FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE policy: add TO authenticated and (SELECT auth.uid())
DROP POLICY IF EXISTS "Users can delete their own words" ON public.words;
CREATE POLICY "Users can delete their own words"
    ON public.words FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Shared words policy: keep for all authenticated users
DROP POLICY IF EXISTS "Allow reading words from shared collections" ON public.words;
CREATE POLICY "Allow reading words from shared collections"
    ON public.words FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.collections c
            WHERE c.collection_id = words.collection_id
            AND c.is_shared = true
        )
    );

-- ============================================================================
-- USERS TABLE
-- ============================================================================

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

-- UPDATE policy: add WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- ============================================================================
-- USER ACCESS LEVELS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own access level" ON public.user_access_levels;
CREATE POLICY "Users can view their own access level"
    ON public.user_access_levels FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
