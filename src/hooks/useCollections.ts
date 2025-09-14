import { useAppStore } from '@/stores/useAppStore'

export interface UseCollectionsReturn {
  collections: any[]
  collectionsLoading: boolean
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<any>
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
