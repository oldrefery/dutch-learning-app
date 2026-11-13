import 'server-only'

import { listOwnedDisplayWords } from '@/features/dictionary/owned-display-repository'

import { createClient } from '@/lib/supabase/server'
import { buildWordSearchResults, normalizeWordSearchQuery } from './word-search'
import type { WordSearchResult } from './word-search'

export async function searchOwnedWords(
  userId: string,
  query: string
): Promise<WordSearchResult[]> {
  const normalizedQuery = normalizeWordSearchQuery(query)
  if (!normalizedQuery) return []

  const supabase = await createClient()
  const collectionsRequest = supabase
    .from('collections')
    .select('collection_id, name')
    .eq('user_id', userId)
  const wordsRequest = listOwnedDisplayWords(supabase, userId, {
    view: 'search',
  })

  const [collectionsResult, words] = await Promise.all([
    collectionsRequest,
    wordsRequest,
  ])

  if (collectionsResult.error) {
    throw new Error('Could not search your words.')
  }

  return buildWordSearchResults(
    words,
    collectionsResult.data ?? [],
    normalizedQuery
  )
}
