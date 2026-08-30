import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { WordAnalysis } from './analysis-contract'
import type { DuplicateWordResult } from './form-state'
import { isSemanticWordMatch } from './semantic-duplicate'

interface DuplicateCandidate {
  article: string | null
  collection_id: string | null
  dutch_lemma: string
  part_of_speech: string | null
  word_id: string
}

const buildDuplicateResult = async (
  userId: string,
  duplicate: DuplicateCandidate
): Promise<DuplicateWordResult> => {
  if (!duplicate.collection_id) {
    return {
      wordId: duplicate.word_id,
      collectionId: null,
      collectionName: null,
    }
  }

  const supabase = await createClient()
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

const listOwnedLemmaCandidates = async (
  userId: string,
  dutchLemma: string
): Promise<DuplicateCandidate[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('words')
    .select('article, collection_id, dutch_lemma, part_of_speech, word_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('dutch_lemma', dutchLemma.trim())

  if (error) throw new Error('Could not check for duplicate words.')
  return data ?? []
}

export const getOwnedSemanticDuplicate = async (
  userId: string,
  analysis: WordAnalysis
): Promise<DuplicateWordResult | null> => {
  const candidates = await listOwnedLemmaCandidates(userId, analysis.dutchLemma)
  const duplicate = candidates.find(candidate =>
    isSemanticWordMatch(candidate, analysis)
  )

  return duplicate ? buildDuplicateResult(userId, duplicate) : null
}

export const getOwnedLemmaDuplicate = async (
  userId: string,
  dutchLemma: string
): Promise<DuplicateWordResult | null> => {
  const [duplicate] = await listOwnedLemmaCandidates(userId, dutchLemma)
  return duplicate ? buildDuplicateResult(userId, duplicate) : null
}
