import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AppError,
} from '@/types/ApplicationStoreTypes'
import { Sentry } from '@/lib/sentry.ts'

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
        await Promise.all([get().fetchWords(), get().fetchCollections()])
      } else {
        // No user, clear data
        set({
          currentUserId: null,
          words: [],
          collections: [],
        })
      }
    } catch (error) {
      Sentry.captureException('App initialization error:', error)
      get().setError({
        message:
          APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.APP_INITIALIZATION_FAILED,
        details: error instanceof Error ? error.message : 'Unknown error',
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
