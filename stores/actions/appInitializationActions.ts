import { getDevUserId, initDevSession } from '@/lib/supabase'
import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'

export const createAppInitializationActions = (set: any, get: any) => ({
  initializeApp: async () => {
    try {
      // Initialize development session
      await initDevSession()

      // For development, use the dev user ID
      const devUserId = getDevUserId()
      set({ currentUserId: devUserId })

      // Fetch initial data
      await Promise.all([get().fetchWords(), get().fetchCollections()])
    } catch (error) {
      console.error('App initialization error:', error)
      get().setError({
        message: APP_STORE_CONSTANTS.ERROR_MESSAGES.APP_INITIALIZATION_FAILED,
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  setError: (error: any) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },
})
