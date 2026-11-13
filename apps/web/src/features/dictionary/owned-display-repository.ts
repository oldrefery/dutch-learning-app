import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import type { CollectionWordRow } from '@/features/collections/collection-detail'
import type { InsightWord } from '@/features/insights/types'
import type { WordSearchRow } from '@/features/search/word-search'
import type { DictionaryCardMetadata } from './content'
import {
  hydrateFollowingWords,
  hydrateOwnedWords,
  isDictionaryFollowingEnabled,
} from './repository'

const listFields =
  'word_id, collection_id, created_at, easiness_factor, interval_days, next_review_date, repetition_count'
const detailFields =
  'word_id, collection_id, created_at, easiness_factor, interval_days, next_review_date, repetition_count, last_reviewed_at, updated_at'

const isMetadataReadEnabled = () =>
  isDictionaryFollowingEnabled() &&
  process.env.DICTIONARY_WEB_METADATA_READS_ENABLED === 'true'

export async function readOwnedDisplayWord(
  client: SupabaseClient<Database>,
  userId: string,
  wordId: string,
  collectionId?: string
) {
  const query = <Columns extends string>(columns: Columns) => {
    const words = client.from('words').select(columns)
    const owned = collectionId
      ? words
          .eq('word_id', wordId)
          .eq('collection_id', collectionId)
          .eq('user_id', userId)
      : words.eq('user_id', userId).eq('word_id', wordId)
    return owned.is('deleted_at', null).maybeSingle()
  }

  if (isMetadataReadEnabled()) {
    const { data, error } = await query(detailFields)
    if (error) throw new Error('Could not load the word.')
    if (!data) return null
    const [word] = await hydrateFollowingWords(client, [data])
    return word
  }

  const { data, error } = await query('*')
  if (error) throw new Error('Could not load the word.')
  if (!data) return null
  const [word] = await hydrateOwnedWords(client, [data])
  return word
}

type CollectionView = { view: 'collection'; collectionId: string }
type SearchView = { view: 'search' }
type InsightsView = { view: 'insights' }

export function listOwnedDisplayWords(
  client: SupabaseClient<Database>,
  userId: string,
  scope: CollectionView
): Promise<(CollectionWordRow & { dictionary?: DictionaryCardMetadata })[]>
export function listOwnedDisplayWords(
  client: SupabaseClient<Database>,
  userId: string,
  scope: SearchView
): Promise<WordSearchRow[]>
export function listOwnedDisplayWords(
  client: SupabaseClient<Database>,
  userId: string,
  scope: InsightsView
): Promise<InsightWord[]>
export async function listOwnedDisplayWords(
  client: SupabaseClient<Database>,
  userId: string,
  scope: CollectionView | SearchView | InsightsView
) {
  const collectionId =
    scope.view === 'collection' ? scope.collectionId : undefined
  const errorMessage =
    scope.view === 'collection'
      ? 'Could not load collection words.'
      : scope.view === 'search'
        ? 'Could not search your words.'
        : 'Could not load learning insights.'
  const list = <Fields extends string>(fields: Fields) =>
    fetchAllRows((from, to) => {
      const owned = client
        .from('words')
        .select(fields)
        .eq('user_id', userId)
        .is('deleted_at', null)
      // Keep the personal sort key and stable tie-breaker across both readers.
      return (collectionId ? owned.eq('collection_id', collectionId) : owned)
        .order('dutch_lemma', { ascending: true })
        .order('word_id', { ascending: true })
        .range(from, to)
    })

  if (isMetadataReadEnabled()) {
    const { data, error } = await list(listFields)
    if (error) throw new Error(errorMessage)
    return hydrateFollowingWords(client, data ?? [])
  }

  if (scope.view === 'search') {
    const { data, error } = await list(
      'collection_id, dutch_lemma, dutch_original, part_of_speech, translations, word_id'
    )
    if (error) throw new Error(errorMessage)
    return hydrateOwnedWords(client, data ?? [])
  }
  if (scope.view === 'insights') {
    const { data, error } = await list(
      'article, collection_id, dutch_lemma, dutch_original, easiness_factor, interval_days, next_review_date, part_of_speech, repetition_count, translations, word_id'
    )
    if (error) throw new Error(errorMessage)
    return data ?? []
  }

  const { data, error } = await list(
    'article, collection_id, created_at, dutch_lemma, dutch_original, easiness_factor, image_url, interval_days, next_review_date, part_of_speech, repetition_count, translations, word_id'
  )
  if (error) throw new Error(errorMessage)
  return hydrateOwnedWords(client, data ?? [])
}
