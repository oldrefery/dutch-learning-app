import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { WordAnalysis } from './analysis-contract'
import { getOwnedSemanticDuplicate } from './duplicate-repository'
import { buildWordInsert } from './word-persistence'

export type PersistAnalyzedWordResult =
  | { success: true; wordId: string }
  | {
      success: false
      code: 'collection' | 'duplicate' | 'insert'
      message: string
    }

export const persistAnalyzedWord = async (
  userId: string,
  collectionId: string,
  analysis: WordAnalysis
): Promise<PersistAnalyzedWordResult> => {
  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('collection_id')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (collectionError || !collection) {
    return {
      success: false,
      code: 'collection',
      message: 'Choose a collection you own.',
    }
  }

  try {
    const existingWord = await getOwnedSemanticDuplicate(userId, analysis)
    if (existingWord) {
      return {
        success: false,
        code: 'duplicate',
        message: `“${analysis.dutchLemma}” already exists in your vocabulary.`,
      }
    }
  } catch {
    return {
      success: false,
      code: 'duplicate',
      message: 'Could not verify duplicate words. Please try again.',
    }
  }

  const { data: insertedWord, error: insertError } = await supabase
    .from('words')
    .insert(buildWordInsert(analysis, userId, collectionId))
    .select('word_id')
    .maybeSingle()

  if (insertError?.code === '23505') {
    return {
      success: false,
      code: 'duplicate',
      message: `“${analysis.dutchLemma}” already exists in your vocabulary.`,
    }
  }
  if (insertError || !insertedWord) {
    return {
      success: false,
      code: 'insert',
      message: 'Could not save this word. Please try again.',
    }
  }

  return { success: true, wordId: insertedWord.word_id }
}
