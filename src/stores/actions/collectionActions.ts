import { collectionService } from '@/lib/supabase'
import {
  collectionSharingService,
  CollectionSharingError,
} from '@/services/collectionSharingService'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import type {
  StoreSetFunction,
  StoreGetFunction,
} from '@/types/ApplicationStoreTypes'

export const createCollectionActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
) => ({
  fetchCollections: async () => {
    try {
      set({ collectionsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'fetchCollections' },
          extra: { userId },
        })
        throw error
      }
      const collections = await collectionService.getUserCollections(userId)
      set({ collections, collectionsLoading: false })
    } catch (error) {
      console.error('Error fetching collections:', error)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTIONS_FETCH_FAILED,
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
        collectionsLoading: false,
      })
    }
  },

  createNewCollection: async (name: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'createNewCollection' },
          extra: { name, userId },
        })
        throw error
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
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  deleteCollection: async (collectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'deleteCollection' },
          extra: { collectionId, userId },
        })
        throw error
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
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  renameCollection: async (collectionId: string, newName: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'renameCollection' },
          extra: { collectionId, newName, userId },
        })
        throw error
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
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  shareCollection: async (collectionId: string) => {
    try {
      console.log('🔄 [shareCollection] Starting share process', {
        collectionId,
      })
      const userId = get().currentUserId

      if (!userId) {
        console.log('❌ [shareCollection] User not authenticated', { userId })
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'shareCollection' },
          extra: { collectionId, userId },
        })
        throw error
      }

      console.log('🔄 [shareCollection] Calling collectionSharingService', {
        collectionId,
        userId,
      })
      const result = await collectionSharingService.shareCollection(
        collectionId,
        userId
      )
      console.log('📥 [shareCollection] Service result', {
        success: result.success,
        error: result.success ? null : result.error,
      })

      if (!result.success) {
        console.log('❌ [shareCollection] Service failed', {
          error: result.error,
        })
        const errorMessage = getCollectionSharingErrorMessage(result.error)
        set({
          error: {
            message: errorMessage,
            details: result.error,
          },
        })
        return null
      }

      const currentCollections = get().collections
      const updatedCollections = currentCollections.map(collection =>
        collection.collection_id === collectionId
          ? {
              ...collection,
              is_shared: true,
              shared_at: new Date().toISOString(),
            }
          : collection
      )
      set({ collections: updatedCollections })
      console.log('✅ [shareCollection] Successfully shared collection', {
        shareToken: result.data,
      })

      return result.data
    } catch (error) {
      console.error('❌ [shareCollection] Unexpected error:', error)
      Sentry.captureException(error, {
        tags: { operation: 'shareCollection' },
        extra: { collectionId, userId: get().currentUserId },
      })
      set({
        error: {
          message: 'Failed to share collection',
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      return null
    }
  },

  unshareCollection: async (collectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'unshareCollection' },
          extra: { collectionId, userId },
        })
        throw error
      }

      const result = await collectionSharingService.unshareCollection(
        collectionId,
        userId
      )

      if (!result.success) {
        const errorMessage = getCollectionSharingErrorMessage(result.error)
        set({
          error: {
            message: errorMessage,
            details: result.error,
          },
        })
        return false
      }

      const currentCollections = get().collections
      const updatedCollections = currentCollections.map(collection =>
        collection.collection_id === collectionId
          ? { ...collection, is_shared: false, shared_at: null }
          : collection
      )
      set({ collections: updatedCollections })

      return true
    } catch (error) {
      console.error('Error unsharing collection:', error)
      set({
        error: {
          message: 'Failed to unshare collection',
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      return false
    }
  },

  getCollectionShareStatus: async (collectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        const error = new Error(
          APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
        )
        Sentry.captureException(error, {
          tags: { operation: 'getCollectionShareStatus' },
          extra: { collectionId, userId },
        })
        throw error
      }

      const result = await collectionSharingService.getCollectionShareStatus(
        collectionId,
        userId
      )

      if (!result.success) {
        const errorMessage = getCollectionSharingErrorMessage(result.error)
        set({
          error: {
            message: errorMessage,
            details: result.error,
          },
        })
        return null
      }

      return result.data
    } catch (error) {
      console.error('Error getting collection share status:', error)
      set({
        error: {
          message: 'Failed to get collection share status',
          details:
            error instanceof Error
              ? error.message
              : APPLICATION_STORE_CONSTANTS.GENERIC_ERRORS.UNKNOWN_ERROR,
        },
      })
      return null
    }
  },
})

const getCollectionSharingErrorMessage = (
  error: CollectionSharingError
): string => {
  switch (error) {
    case CollectionSharingError.NOT_FOUND:
      return 'Collection not found'
    case CollectionSharingError.NOT_SHARED:
      return 'Collection is not shared'
    case CollectionSharingError.UNAUTHORIZED:
      return 'Not authorized to access this collection'
    case CollectionSharingError.DATABASE_ERROR:
      return 'Database error occurred'
    case CollectionSharingError.TOKEN_GENERATION_FAILED:
      return 'Failed to generate share token'
    case CollectionSharingError.UNKNOWN_ERROR:
    default:
      return 'An unknown error occurred'
  }
}
