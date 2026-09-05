import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Collection } from '@/types/database'

export interface UseCollectionsReturn {
  collections: Collection[]
  collectionsLoading: boolean
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection | null>
}

export function useCollections(): UseCollectionsReturn {
  const {
    collections,
    collectionsLoading,
    fetchCollections,
    createNewCollection,
  } = useApplicationStore()

  return {
    collections,
    collectionsLoading,
    fetchCollections,
    createNewCollection,
  }
}
