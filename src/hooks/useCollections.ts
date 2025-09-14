import { useAppStore } from '@/stores/useAppStore'
import type { Collection } from '@/types/database'

export interface UseCollectionsReturn {
  collections: Collection[]
  collectionsLoading: boolean
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection>
}

export function useCollections(): UseCollectionsReturn {
  const {
    collections,
    collectionsLoading,
    fetchCollections,
    createNewCollection,
  } = useAppStore()

  return {
    collections,
    collectionsLoading,
    fetchCollections,
    createNewCollection,
  }
}
