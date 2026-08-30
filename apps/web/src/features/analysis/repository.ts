import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/features/words/word-detail'
import type { CollectionOption } from '@/features/words/repository'

export async function listOwnedCollectionOptions(
  userId: string
): Promise<CollectionOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('collections')
    .select('collection_id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw new Error('Could not load collections.')

  return (data ?? []).map(collection => ({
    id: collection.collection_id,
    name: collection.name,
  }))
}

export const hasOwnedCollection = (
  collectionId: string,
  collections: CollectionOption[]
) => isUuid(collectionId) && collections.some(item => item.id === collectionId)
