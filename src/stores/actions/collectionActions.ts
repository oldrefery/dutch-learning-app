import {
  collectionSharingService,
  CollectionSharingError,
} from '@/services/collectionSharingService'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { logInfo, logError } from '@/utils/logger'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import * as Crypto from 'expo-crypto'
import type {
  StoreSetFunction,
  StoreGetFunction,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import type { Collection } from '@/types/database'

const USER_NOT_AUTHENTICATED_ERROR =
  APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
const USER_NOT_AUTHENTICATED_LOG = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

export const createCollectionActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<
  ApplicationState,
  | 'fetchCollections'
  | 'createNewCollection'
  | 'deleteCollection'
  | 'renameCollection'
  | 'shareCollection'
  | 'unshareCollection'
  | 'getCollectionShareStatus'
> => ({
  fetchCollections: async () => {
    try {
      set({ collectionsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTIONS_FETCH_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
          collectionsLoading: false,
        })
        return
      }

      // Offline-first: always fetch from a local SQLite database
      console.log('[Collections] Fetching from local SQLite')
      const collections =
        await collectionRepository.getCollectionsByUserId(userId)

      // Empty collection list is valid for new users - default collection created on the first word added
      set({ collections: collections || [], collectionsLoading: false })
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
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { name, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_CREATE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return null
      }

      // Create the new collection object (offline-first)
      const now = new Date().toISOString()
      const newCollection: Collection = {
        collection_id: Crypto.randomUUID(),
        user_id: userId,
        name,
        description: null,
        is_shared: false,
        shared_with: null,
        created_at: now,
        updated_at: now,
      }

      // Save to local SQLite
      await collectionRepository.saveCollections([newCollection], 'pending')

      // Add to store
      const currentCollections = get().collections
      set({
        collections: [...currentCollections, newCollection],
      })
      return newCollection
    } catch (error) {
      logError('Error creating collection', error, {}, 'collections', false)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_CREATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      return null
    }
  },

  deleteCollection: async (collectionId: string) => {
    try {
      console.log('[Collections] Deleting collection (local tombstone)', {
        collectionId,
      })
      const userId = get().currentUserId
      const userAccessLevel = get().userAccessLevel
      const currentCollections = get().collections
      const currentWords = get().words

      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_DELETE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Prevent read-only users from deleting their last collection
      if (userAccessLevel === 'read_only' && currentCollections.length <= 1) {
        logInfo(
          'Prevented deletion of last collection for read-only user',
          {
            collectionId,
            userId,
            userAccessLevel,
            collectionsCount: currentCollections.length,
          },
          'collections'
        )
        set({
          error: {
            message: 'Cannot delete collection',
            details: 'Read-only users must have at least one collection',
          },
        })
        return
      }

      // Mark it deleted locally so sync can remove it remotely
      await collectionRepository.markCollectionDeleted(collectionId)
      console.log('[Collections] Marked collection deleted locally', {
        collectionId,
      })

      // Remove words tied to this collection locally
      await wordRepository.deleteWordsByCollection(collectionId, userId)

      const updatedCollections = currentCollections.filter(
        collection => collection.collection_id !== collectionId
      )
      const updatedWords = currentWords.filter(
        word => word.collection_id !== collectionId
      )
      set({ collections: updatedCollections, words: updatedWords })
    } catch (error) {
      logError('Error deleting collection', error, {}, 'collections', false)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_DELETE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  renameCollection: async (collectionId: string, newName: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { collectionId, newName, userId },
          'collections',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .COLLECTION_UPDATE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Update in local SQLite (offline-first)
      await collectionRepository.updateCollection(collectionId, {
        name: newName,
      })

      const currentCollections = get().collections
      const updatedCollections = currentCollections.map(collection =>
        collection.collection_id === collectionId
          ? {
              ...collection,
              name: newName,
              updated_at: new Date().toISOString(),
            }
          : collection
      )
      set({ collections: updatedCollections })
    } catch (error) {
      logError('Error renaming collection', error, {}, 'collections', false)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.COLLECTION_UPDATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
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
          USER_NOT_AUTHENTICATED_LOG,
          undefined,
          { userId },
          'shareCollection',
          false
        )
        set({
          error: {
            message: 'Failed to share collection',
            details: USER_NOT_AUTHENTICATED_ERROR,
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
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message: 'Failed to unshare collection',
            details: USER_NOT_AUTHENTICATED_ERROR,
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
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { collectionId, userId },
          'collections',
          false
        )
        set({
          error: {
            message: 'Failed to get collection share status',
            details: USER_NOT_AUTHENTICATED_ERROR,
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
