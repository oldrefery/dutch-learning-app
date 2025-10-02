import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AppError,
} from '@/types/ApplicationStoreTypes'
import { Sentry } from '@/lib/sentry'
import { accessControlService } from '@/services/accessControlService'

export const createAppInitializationActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
) => ({
  initializeApp: async (userId?: string) => {
    try {
      if (userId) {
        // User is authenticated, set the user ID and fetch data
        set({ currentUserId: userId })

        // Fetch initial data for an authenticated user
        await Promise.all([
          get().fetchWords(),
          get().fetchCollections(),
          get().fetchUserAccessLevel(),
        ])
      } else {
        // No user, clear data
        set({
          currentUserId: null,
          userAccessLevel: null,
          words: [],
          collections: [],
        })
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'appInitialization' },
        extra: { message: 'App initialization error' },
      })
      get().setError({
        message:
          APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.APP_INITIALIZATION_FAILED,
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  fetchUserAccessLevel: async () => {
    try {
      const { currentUserId } = get()

      if (!currentUserId) {
        set({ userAccessLevel: null })
        return
      }

      const result =
        await accessControlService.getUserAccessLevel(currentUserId)

      if (result.success) {
        set({ userAccessLevel: result.data })
      } else {
        // Default to read_only on error
        set({ userAccessLevel: 'read_only' })

        Sentry.captureMessage('Failed to fetch user access level', {
          level: 'warning',
          tags: { operation: 'fetchUserAccessLevel' },
          extra: { error: result.error, userId: currentUserId },
        })
      }
    } catch (error) {
      // Default to read_only on error
      set({ userAccessLevel: 'read_only' })

      Sentry.captureException(error, {
        tags: { operation: 'fetchUserAccessLevel' },
        extra: { message: 'Error fetching user access level' },
      })
    }
  },

  setError: (error: AppError) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },
})
