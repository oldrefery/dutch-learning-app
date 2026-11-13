import 'server-only'

import { getAvailableRevision } from '@/features/dictionary/repository'
import { readOwnedDisplayWord } from '@/features/dictionary/owned-display-repository'

import { createClient } from '@/lib/supabase/server'
import { buildWordDetail, isUuid } from './word-detail'
import type { WordDetail } from './word-detail'

export interface CollectionOption {
  id: string
  name: string
}

export interface OwnedWordPageData {
  collection: CollectionOption
  moveTargets: CollectionOption[]
  word: WordDetail
}

export async function getOwnedWordPageData(
  userId: string,
  collectionId: string,
  wordId: string
): Promise<OwnedWordPageData | null> {
  if (!isUuid(collectionId) || !isUuid(wordId)) return null

  const supabase = await createClient()
  const collectionRequest = supabase
    .from('collections')
    .select('collection_id, name')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle()
  const wordRequest = readOwnedDisplayWord(
    supabase,
    userId,
    wordId,
    collectionId
  )
  const collectionsRequest = supabase
    .from('collections')
    .select('collection_id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  const [collectionResult, word, collectionsResult] = await Promise.all([
    collectionRequest,
    wordRequest,
    collectionsRequest,
  ])

  if (collectionResult.error || collectionsResult.error) {
    throw new Error('Could not load the word.')
  }

  if (!collectionResult.data || !word) return null
  if (word.dictionary?.reference && word.dictionary.mode !== 'follow') {
    word.dictionary.availableRevision = await getAvailableRevision(
      supabase,
      word.dictionary.reference
    )
  }

  return {
    collection: {
      id: collectionResult.data.collection_id,
      name: collectionResult.data.name,
    },
    moveTargets: (collectionsResult.data ?? [])
      .filter(collection => collection.collection_id !== collectionId)
      .map(collection => ({
        id: collection.collection_id,
        name: collection.name,
      })),
    word: buildWordDetail(word),
  }
}
