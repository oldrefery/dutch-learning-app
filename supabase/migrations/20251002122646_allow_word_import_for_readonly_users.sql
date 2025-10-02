-- Migration: Allow Word Import for Read-Only Users
-- Description: Create database function to import words from shared collections
--              This bypasses RLS restrictions for read-only users when importing

-- ============================================================================
-- CREATE PRIVATE SCHEMA (if not exists)
-- ============================================================================
-- Private schema to hide SECURITY DEFINER functions from API exposure
CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================================
-- FUNCTION: import_words_to_collection
-- ============================================================================
-- Allows read-only users to import words from shared collections
-- Uses SECURITY DEFINER to bypass RLS INSERT restrictions
-- Created in private schema to prevent direct RPC calls
-- This is safe because:
-- 1. Only authenticated users can call it via wrapper
-- 2. Words are imported to user's own collections
-- 3. User must own the target collection

CREATE OR REPLACE FUNCTION private.import_words_to_collection(
    p_collection_id UUID,
    p_words JSONB
)
RETURNS SETOF public.words AS $$
DECLARE
    v_word_record JSONB;
    v_inserted_word public.words;
BEGIN
    -- Verify the collection belongs to the current user
    IF NOT EXISTS (
        SELECT 1
        FROM public.collections
        WHERE collection_id = p_collection_id
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Collection not found or access denied';
    END IF;

    -- Insert each word
    FOR v_word_record IN SELECT * FROM jsonb_array_elements(p_words)
    LOOP
        INSERT INTO public.words (
            user_id,
            collection_id,
            dutch_lemma,
            dutch_original,
            part_of_speech,
            is_irregular,
            is_reflexive,
            is_expression,
            expression_type,
            is_separable,
            prefix_part,
            root_verb,
            article,
            plural,
            translations,
            examples,
            synonyms,
            antonyms,
            conjugation,
            preposition,
            image_url,
            tts_url,
            analysis_notes,
            -- Reset SRS fields for imported words
            interval_days,
            repetition_count,
            easiness_factor,
            next_review_date
        ) VALUES (
            auth.uid(),  -- Current user
            p_collection_id,
            v_word_record->>'dutch_lemma',
            v_word_record->>'dutch_original',
            v_word_record->>'part_of_speech',
            COALESCE((v_word_record->>'is_irregular')::BOOLEAN, FALSE),
            COALESCE((v_word_record->>'is_reflexive')::BOOLEAN, FALSE),
            COALESCE((v_word_record->>'is_expression')::BOOLEAN, FALSE),
            v_word_record->>'expression_type',
            COALESCE((v_word_record->>'is_separable')::BOOLEAN, FALSE),
            v_word_record->>'prefix_part',
            v_word_record->>'root_verb',
            v_word_record->>'article',
            v_word_record->>'plural',
            COALESCE(v_word_record->'translations', '{}'::JSONB),
            COALESCE((v_word_record->'examples')::JSONB[], ARRAY[]::JSONB[]),
            COALESCE(
                (SELECT array_agg(elem::TEXT)
                FROM jsonb_array_elements_text(v_word_record->'synonyms') elem),
                ARRAY[]::TEXT[]
            ),
            COALESCE(
                (SELECT array_agg(elem::TEXT)
                FROM jsonb_array_elements_text(v_word_record->'antonyms') elem),
                ARRAY[]::TEXT[]
            ),
            v_word_record->'conjugation',
            v_word_record->>'preposition',
            v_word_record->>'image_url',
            COALESCE(v_word_record->>'tts_url', ''),  -- Required field
            v_word_record->>'analysis_notes',
            -- Reset SRS for new import
            1,  -- interval_days
            0,  -- repetition_count
            2.5,  -- easiness_factor
            CURRENT_DATE  -- next_review_date
        )
        RETURNING * INTO v_inserted_word;

        RETURN NEXT v_inserted_word;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PUBLIC WRAPPER FUNCTION
-- ============================================================================
-- Public wrapper that can be called via RPC
-- This wrapper calls the private SECURITY DEFINER function
-- Provides additional safety layer and API accessibility

CREATE OR REPLACE FUNCTION public.import_words_to_collection(
    p_collection_id UUID,
    p_words JSONB
)
RETURNS SETOF public.words AS $$
BEGIN
    -- Call the private SECURITY DEFINER function
    RETURN QUERY SELECT * FROM private.import_words_to_collection(p_collection_id, p_words);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Grant execute on private function to postgres (creator)
GRANT EXECUTE ON FUNCTION private.import_words_to_collection TO postgres;

-- Grant execute on public wrapper to authenticated users
GRANT EXECUTE ON FUNCTION public.import_words_to_collection TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION private.import_words_to_collection IS
'Private SECURITY DEFINER function that bypasses RLS to import words. Verifies collection ownership.';

COMMENT ON FUNCTION public.import_words_to_collection IS
'Public wrapper for importing words from shared collections. Calls private SECURITY DEFINER function to bypass RLS for read-only users.';
