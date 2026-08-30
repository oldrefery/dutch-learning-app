import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { buildCollectionDetail, isCollectionId } from './collection-detail'
import type { CollectionDetail } from './collection-detail'
import { buildCollectionOverviews } from './collection-overview'
import type { CollectionOverview } from './collection-overview'

export async function listCollectionOverviews(
  userId: string
): Promise<CollectionOverview[]> {
  const supabase = await createClient()
  const collectionsRequest = supabase
    .from('collections')
    .select('collection_id, created_at, is_shared, name, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  const wordsRequest = supabase
    .from('words')
    .select('collection_id, next_review_date, repetition_count')
    .eq('user_id', userId)
    .is('deleted_at', null)

  const [collectionsResult, wordsResult] = await Promise.all([
    collectionsRequest,
    wordsRequest,
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not load collections.')
  }

  return buildCollectionOverviews(
    collectionsResult.data ?? [],
    wordsResult.data ?? []
  )
}

export async function getOwnedCollectionDetail(
  userId: string,
  collectionId: string
): Promise<CollectionDetail | null> {
  if (!isCollectionId(collectionId)) return null

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('collection_id, created_at, is_shared, name, updated_at')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (collectionError) {
    throw new Error('Could not load the collection.')
  }

  if (!collection) return null

  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select(
      'article, collection_id, created_at, dutch_lemma, dutch_original, image_url, interval_days, next_review_date, part_of_speech, repetition_count, translations, word_id'
    )
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('dutch_lemma', { ascending: true })

  if (wordsError) {
    throw new Error('Could not load collection words.')
  }

  return buildCollectionDetail(collection, words ?? [])
}
