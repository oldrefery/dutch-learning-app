-- Migration: Add register field for formality marking
-- Description: Adds register column to words table for marking formal/informal/neutral usage

-- Add register column to words table
ALTER TABLE public.words
ADD COLUMN IF NOT EXISTS register TEXT;

-- Add check constraint for valid register values
ALTER TABLE public.words
ADD CONSTRAINT words_register_check
CHECK (register IS NULL OR register IN ('formal', 'informal', 'neutral'));

-- Update import_words_to_collection function to handle register field
DROP FUNCTION IF EXISTS public.import_words_to_collection(UUID, JSONB);
DROP FUNCTION IF EXISTS private.import_words_to_collection(UUID, JSONB);

CREATE OR REPLACE FUNCTION private.import_words_to_collection(
    p_collection_id UUID,
    p_words JSONB
)
RETURNS SETOF public.words AS $$
DECLARE
    v_word_record JSONB;
    v_inserted_word public.words;
    v_examples JSONB[];
    v_part_of_speech TEXT;
    v_conjugation JSONB;
    v_normalized_lemma TEXT;
    v_normalized_part_of_speech TEXT;
    v_normalized_article TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.collections
        WHERE collection_id = p_collection_id
          AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Collection not found or access denied';
    END IF;

    IF jsonb_typeof(p_words) != 'array' THEN
        RAISE EXCEPTION 'p_words must be a JSON array';
    END IF;

    FOR v_word_record IN SELECT * FROM jsonb_array_elements(p_words)
    LOOP
        v_inserted_word := NULL;

        v_normalized_lemma := lower(trim(v_word_record->>'dutch_lemma'));
        v_normalized_part_of_speech := COALESCE(NULLIF(trim(v_word_record->>'part_of_speech'), ''), 'unknown');
        v_normalized_article := NULLIF(trim(COALESCE(v_word_record->>'article', '')), '');

        IF v_word_record->'examples' IS NOT NULL AND jsonb_typeof(v_word_record->'examples') = 'array' THEN
            v_examples := ARRAY(SELECT jsonb_array_elements(v_word_record->'examples'));
        ELSE
            v_examples := ARRAY[]::JSONB[];
        END IF;

        v_part_of_speech := v_normalized_part_of_speech;
        IF v_part_of_speech = 'verb' THEN
            v_conjugation := v_word_record->'conjugation';
        ELSE
            v_conjugation := NULL;
        END IF;

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
            register,
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
            v_normalized_lemma,
            COALESCE(v_word_record->>'dutch_original', ''),
            v_part_of_speech,
            COALESCE((v_word_record->>'is_irregular')::BOOLEAN, FALSE),
            COALESCE((v_word_record->>'is_reflexive')::BOOLEAN, FALSE),
            COALESCE((v_word_record->>'is_expression')::BOOLEAN, FALSE),
            v_word_record->>'expression_type',
            COALESCE((v_word_record->>'is_separable')::BOOLEAN, FALSE),
            v_word_record->>'prefix_part',
            v_word_record->>'root_verb',
            v_normalized_article,
            v_word_record->>'plural',
            v_word_record->>'register',
            COALESCE(v_word_record->'translations', '{}'::JSONB),
            v_examples,
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
            v_conjugation,
            v_word_record->>'preposition',
            v_word_record->>'image_url',
            COALESCE(v_word_record->>'tts_url', ''),
            COALESCE(v_word_record->>'analysis_notes', ''),
            1,
            0,
            2.5,
            CURRENT_DATE
        )
        ON CONFLICT (
            user_id,
            dutch_lemma,
            COALESCE(part_of_speech, 'unknown'),
            COALESCE(article, '')
        ) DO NOTHING
        RETURNING * INTO v_inserted_word;

        IF v_inserted_word.word_id IS NULL THEN
            SELECT *
            INTO v_inserted_word
            FROM public.words w
            WHERE w.user_id = auth.uid()
              AND w.dutch_lemma = v_normalized_lemma
              AND COALESCE(w.part_of_speech, 'unknown') = v_normalized_part_of_speech
              AND COALESCE(w.article, '') = COALESCE(v_normalized_article, '')
            ORDER BY w.created_at DESC
            LIMIT 1;
        END IF;

        IF v_inserted_word.word_id IS NOT NULL THEN
            RETURN NEXT v_inserted_word;
        END IF;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.import_words_to_collection(
    p_collection_id UUID,
    p_words JSONB
)
RETURNS SETOF public.words AS $$
BEGIN
    RETURN QUERY SELECT * FROM private.import_words_to_collection(p_collection_id, p_words);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION private.import_words_to_collection TO postgres;
GRANT EXECUTE ON FUNCTION public.import_words_to_collection TO authenticated;

COMMENT ON FUNCTION private.import_words_to_collection IS
'Private SECURITY DEFINER function that bypasses RLS and safely handles semantic duplicates using ON CONFLICT on idx_words_semantic_unique key. Includes register field support.';

COMMENT ON FUNCTION public.import_words_to_collection IS
'Public wrapper for importing words from shared collections. Semantic duplicates are skipped without raising 23505. Includes register field support.';

COMMENT ON COLUMN public.words.register IS
'Formality level of the word: formal, informal, or neutral. NULL if unknown.';
