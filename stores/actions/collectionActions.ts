import { collectionService } from '@/lib/supabase'
import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'

export const createCollectionActions = (set: any, get: any) => ({
  fetchCollections: async () => {
    try {
      set({ collectionsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }
      const collections = await collectionService.getUserCollections(userId)
      set({ collections, collectionsLoading: false })
    } catch (error) {
      console.error('Error fetching collections:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTIONS_FETCH_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        collectionsLoading: false,
      })
    }
  },

  createNewCollection: async (name: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }
      const newCollection = await collectionService.createCollection(
        name,
        userId
      )
      const currentCollections = get().collections
      set({ collections: [...currentCollections, newCollection] })
      return newCollection
    } catch (error) {
      console.error('Error creating collection:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_CREATE_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      throw error
    }
  },
})
