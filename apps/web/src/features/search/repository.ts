import 'server-only'

import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { createClient } from '@/lib/supabase/server'
import { buildWordSearchResults, normalizeWordSearchQuery } from './word-search'
import type {
  WordSearchCollectionRow,
  WordSearchResult,
  WordSearchRow,
} from './word-search'

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
  const wordsRequest = fetchAllRows<WordSearchRow>((from, to) =>
    supabase
      .from('words')
      .select(
        'collection_id, dutch_lemma, dutch_original, part_of_speech, translations, word_id'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('dutch_lemma', { ascending: true })
      .order('word_id', { ascending: true })
      .range(from, to)
  )

  const [collectionsResult, wordsResult] = await Promise.all([
    collectionsRequest,
    wordsRequest,
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not search your words.')
  }

  return buildWordSearchResults(
    wordsResult.data ?? [],
    (collectionsResult.data ?? []) as WordSearchCollectionRow[],
    normalizedQuery
  )
}
