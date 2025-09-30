import { collectionService } from '@/lib/supabase'
import {
  collectionSharingService,
  CollectionSharingError,
} from '@/services/collectionSharingService'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { logInfo, logError } from '@/utils/logger'
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
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTIONS_FETCH_FAILED,
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
          collectionsLoading: false,
        })
        return
      }
      const collections = await collectionService.getUserCollections(userId)
      if (!collections) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTIONS_FETCH_FAILED,
            details: 'Failed to fetch collections from service',
          },
          collectionsLoading: false,
        })
        return
      }
      set({ collections, collectionsLoading: false })
    } catch (error) {
      logError('Error fetching collections', error, {}, 'collections', false)
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
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { name, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_CREATE_FAILED,
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return null
      }
      const newCollection = await collectionService.createCollection(
        name,
        userId
      )
      if (!newCollection) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_CREATE_FAILED,
            details: 'Failed to create collection in service',
          },
        })
        return null
      }
      const currentCollections = get().collections
      set({ collections: [...currentCollections, newCollection] })
      return newCollection
    } catch (error) {
      logError('Error creating collection', error, {}, 'collections', false)
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
      return null
    }
  },

  deleteCollection: async (collectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_DELETE_FAILED,
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return
      }
      await collectionService.deleteCollection(collectionId, userId)
      const currentCollections = get().collections
      const updatedCollections = currentCollections.filter(
        collection => collection.collection_id !== collectionId
      )
      set({ collections: updatedCollections })
    } catch (error) {
      logError('Error deleting collection', error, {}, 'collections', false)
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
    }
  },

  renameCollection: async (collectionId: string, newName: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { collectionId, newName, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_UPDATE_FAILED,
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return
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
      logError('Error renaming collection', error, {}, 'collections', false)
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
    }
  },

  shareCollection: async (collectionId: string) => {
    try {
      logInfo('Starting share process', { collectionId }, 'shareCollection')
      const userId = get().currentUserId

      if (!userId) {
        logError(
          'User not authenticated',
          undefined,
          { userId },
          'shareCollection',
          false
        )
        set({
          error: {
            message: 'Failed to share collection',
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return null
      }

      logInfo(
        'Calling collectionSharingService',
        {
          collectionId,
          userId,
        },
        'shareCollection'
      )
      const result = await collectionSharingService.shareCollection(
        collectionId,
        userId
      )
      logInfo(
        'Service result',
        {
          success: result.success,
          error: result.success ? null : result.error,
        },
        'shareCollection'
      )

      if (!result.success) {
        logError(
          'Service failed',
          undefined,
          {
            error: result.error,
          },
          'shareCollection',
          false
        )
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
      logInfo(
        'Successfully shared collection',
        {
          shareToken: result.data,
        },
        'shareCollection'
      )

      return result.data
    } catch (error) {
      logError('Unexpected error', error, {}, 'shareCollection', false)
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
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message: 'Failed to unshare collection',
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return false
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
      logError('Error unsharing collection', error, {}, 'collections', false)
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
        logError(
          'User not authenticated',
          new Error(
            APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
          ),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message: 'Failed to get collection share status',
            details:
              APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED,
          },
        })
        return null
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
      logError(
        'Error getting collection share status',
        error,
        {},
        'collections',
        false
      )
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
