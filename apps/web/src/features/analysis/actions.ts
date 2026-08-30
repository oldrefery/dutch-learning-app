'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/features/words/word-detail'
import { parseSerializedWordAnalysis } from './analysis-contract'
import type { WordAnalysis } from './analysis-contract'
import type { AddWordActionState, DuplicateWordResult } from './form-state'
import { isSemanticWordMatch } from './semantic-duplicate'
import { buildWordInsert } from './word-persistence'

const getOwnedSemanticDuplicate = async (
  userId: string,
  analysis: WordAnalysis
): Promise<DuplicateWordResult | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('words')
    .select('article, collection_id, dutch_lemma, part_of_speech, word_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('dutch_lemma', analysis.dutchLemma)

  if (error) throw new Error('Could not check for duplicate words.')

  const duplicate = (data ?? []).find(candidate =>
    isSemanticWordMatch(candidate, analysis)
  )
  if (!duplicate) return null

  if (!duplicate.collection_id) {
    return {
      wordId: duplicate.word_id,
      collectionId: null,
      collectionName: null,
    }
  }

  const { data: collection } = await supabase
    .from('collections')
    .select('name')
    .eq('collection_id', duplicate.collection_id)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    wordId: duplicate.word_id,
    collectionId: duplicate.collection_id,
    collectionName: collection?.name ?? null,
  }
}

export async function findOwnedSemanticDuplicate(
  serializedAnalysis: string
): Promise<DuplicateWordResult | null> {
  const auth = await requireAuthContext()
  const analysis = parseSerializedWordAnalysis(serializedAnalysis)
  return getOwnedSemanticDuplicate(auth.userId, analysis)
}

export async function saveAnalyzedWord(
  previousState: AddWordActionState,
  formData: FormData
): Promise<AddWordActionState> {
  void previousState

  const auth = await requireAuthContext()
  if (auth.accessLevel !== 'full_access') {
    return {
      status: 'error',
      message: 'Full access is required to save analyzed words.',
    }
  }

  const collectionId = formData.get('collectionId')
  if (typeof collectionId !== 'string' || !isUuid(collectionId)) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { collectionId: 'Choose a valid collection.' },
    }
  }

  let analysis: WordAnalysis
  try {
    analysis = parseSerializedWordAnalysis(formData.get('analysis'))
  } catch (error) {
    return {
      status: 'error',
      message: null,
      fieldErrors: {
        analysis:
          error instanceof Error ? error.message : 'Analysis data is invalid.',
      },
    }
  }

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('collection_id')
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (collectionError || !collection) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { collectionId: 'Choose a collection you own.' },
    }
  }

  let existingWord: DuplicateWordResult | null
  try {
    existingWord = await getOwnedSemanticDuplicate(auth.userId, analysis)
  } catch {
    return {
      status: 'error',
      message: 'Could not verify duplicate words. Please try again.',
    }
  }
  if (existingWord) {
    return {
      status: 'error',
      message: `“${analysis.dutchLemma}” already exists in your vocabulary.`,
    }
  }

  const { data: insertedWord, error: insertError } = await supabase
    .from('words')
    .insert(buildWordInsert(analysis, auth.userId, collectionId))
    .select('word_id')
    .maybeSingle()

  if (insertError?.code === '23505') {
    return {
      status: 'error',
      message: `“${analysis.dutchLemma}” already exists in your vocabulary.`,
    }
  }
  if (insertError || !insertedWord) {
    return {
      status: 'error',
      message: 'Could not save this word. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)
  redirect(`/app/collections/${collectionId}/words/${insertedWord.word_id}`)
}
