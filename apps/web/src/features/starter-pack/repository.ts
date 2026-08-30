import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { ExistingStarterPackWord } from './starter-pack-domain'

export interface StarterPackTargetCollection {
  id: string
  name: string
}

export interface StarterPackContext {
  collections: StarterPackTargetCollection[]
  existingWords: ExistingStarterPackWord[]
}

export async function getStarterPackContext(
  userId: string
): Promise<StarterPackContext> {
  const supabase = await createClient()
  const [collectionsResult, wordsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('words')
      .select('article, collection_id, dutch_lemma, part_of_speech')
      .eq('user_id', userId)
      .is('deleted_at', null),
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not prepare the starter pack.')
  }

  const collections = (collectionsResult.data ?? []).map(collection => ({
    id: collection.collection_id,
    name: collection.name,
  }))
  const collectionNames = new Map(
    collections.map(collection => [collection.id, collection.name])
  )

  return {
    collections,
    existingWords: (wordsResult.data ?? []).map(word => ({
      dutchLemma: word.dutch_lemma,
      partOfSpeech: word.part_of_speech,
      article: word.article,
      collectionName: word.collection_id
        ? (collectionNames.get(word.collection_id) ?? null)
        : null,
    })),
  }
}
