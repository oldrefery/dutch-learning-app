-- Migration: Fix Import Words Function
-- Description: Fix type casting issue with JSONB array parameter

-- ============================================================================
-- DROP OLD FUNCTIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.import_words_to_collection(UUID, JSONB);
DROP FUNCTION IF EXISTS private.import_words_to_collection(UUID, JSONB);

-- ============================================================================
-- RECREATE PRIVATE FUNCTION WITH FIXED TYPE HANDLING
-- ============================================================================
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

    -- Ensure p_words is treated as an array by checking if it's an array type
    IF jsonb_typeof(p_words) != 'array' THEN
        RAISE EXCEPTION 'p_words must be a JSON array';
    END IF;

    -- Insert each word from the JSONB array
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
            interval_days,
            repetition_count,
            easiness_factor,
            next_review_date
        ) VALUES (
            auth.uid(),
            p_collection_id,
            v_word_record->>'dutch_lemma',
            COALESCE(v_word_record->>'dutch_original', ''),
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
            COALESCE(v_word_record->>'tts_url', ''),
            COALESCE(v_word_record->>'analysis_notes', ''),
            1,
            0,
            2.5,
            CURRENT_DATE
        )
        RETURNING * INTO v_inserted_word;

        RETURN NEXT v_inserted_word;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RECREATE PUBLIC WRAPPER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.import_words_to_collection(
    p_collection_id UUID,
    p_words JSONB
)
RETURNS SETOF public.words AS $$
BEGIN
    RETURN QUERY SELECT * FROM private.import_words_to_collection(p_collection_id, p_words);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION private.import_words_to_collection TO postgres;
GRANT EXECUTE ON FUNCTION public.import_words_to_collection TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION private.import_words_to_collection IS
'Private SECURITY DEFINER function that bypasses RLS to import words. Verifies collection ownership. Fixed type handling for JSONB arrays.';

COMMENT ON FUNCTION public.import_words_to_collection IS
'Public wrapper for importing words from shared collections. Calls private SECURITY DEFINER function to bypass RLS for read-only users.';
