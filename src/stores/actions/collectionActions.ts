import { collectionService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
} from '@/types/ApplicationStoreTypes'

const USER_NOT_AUTHENTICATED_ERROR = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

export const createCollectionActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
) => ({
  fetchCollections: async () => {
    try {
      set({ collectionsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }
      const collections = await collectionService.getUserCollections(userId)
      set({ collections, collectionsLoading: false })
    } catch (error) {
      console.error('Error fetching collections:', error)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTIONS_FETCH_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
        collectionsLoading: false,
      })
    }
  },

  createNewCollection: async (name: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
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
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_CREATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  deleteCollection: async (collectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }
      await collectionService.deleteCollection(collectionId, userId)
      const currentCollections = get().collections
      const updatedCollections = currentCollections.filter(
        collection => collection.collection_id !== collectionId
      )
      set({ collections: updatedCollections })
    } catch (error) {
      console.error('Error deleting collection:', error)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_DELETE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  renameCollection: async (collectionId: string, newName: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }
      await collectionService.updateCollection(
        collectionId,
        { name: newName },
        userId
      )
      const currentCollections = get().collections
      const updatedCollections = currentCollections.map(collection =>
        collection.collection_id === collectionId
          ? { ...collection, name: newName }
          : collection
      )
      set({ collections: updatedCollections })
    } catch (error) {
      console.error('Error renaming collection:', error)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_UPDATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },
})
