import 'server-only'

import { createClient } from '@/lib/supabase/server'
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
