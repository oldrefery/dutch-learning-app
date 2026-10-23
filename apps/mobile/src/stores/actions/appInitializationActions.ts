import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { createStoreError } from '@/types/ErrorTypes'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AppError,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import { Sentry } from '@/lib/sentry'
import { accessControlService } from '@/services/accessControlService'
import { useHistoryStore } from '@/stores/useHistoryStore'

export const createAppInitializationActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<
  ApplicationState,
  'initializeApp' | 'fetchUserAccessLevel' | 'setError' | 'clearError'
> => {
  let accessRequest = 0
  let localInitialization: {
    userId: string
    promise: Promise<void>
  } | null = null

  // Auth restoration and the entry route may initialize the same owner together.
  // Share only their unfinished local reads; permission lookup has its own lifetime.
  const loadInitialLocalData = (userId: string): Promise<void> => {
    if (localInitialization?.userId === userId)
      return localInitialization.promise
    const request = {
      userId,
      promise: Promise.all([get().fetchWords(), get().fetchCollections()]).then(
        () => {}
      ),
    }
    localInitialization = request
    request.promise = request.promise.finally(() => {
      if (localInitialization === request) localInitialization = null
    })
    return request.promise
  }

  return {
    initializeApp: async (userId?: string) => {
      try {
        if (userId) {
          // User is authenticated, set the user ID and fetch data
          if (get().currentUserId !== userId) {
            localInitialization = null
            accessRequest += 1
            set({ currentUserId: userId, userAccessLevel: null })
          } else {
            set({ currentUserId: userId })
          }

          // Fetch initial data for an authenticated user
          await Promise.all([
            loadInitialLocalData(userId),
            get().fetchUserAccessLevel(),
          ])
        } else {
          localInitialization = null
          accessRequest += 1
          // No user, clear data
          set({
            currentUserId: null,
            userAccessLevel: null,
            words: [],
            collections: [],
          })

          // End any active review session to prevent orphaned state
          get().endReviewSession()

          // Clear history from previous user
          const historyStore = useHistoryStore.getState()
          historyStore.clearWordHistory()
          historyStore.clearNotificationHistory()
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { operation: 'appInitialization' },
          extra: { message: 'App initialization error' },
        })
        get().setError(
          createStoreError(
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
              .APP_INITIALIZATION_FAILED,
            { originalError: error instanceof Error ? error : undefined }
          )
        )
      }
    },

    fetchUserAccessLevel: async () => {
      const request = ++accessRequest
      const { currentUserId } = get()
      const isCurrentRequest = () =>
        request === accessRequest && get().currentUserId === currentUserId
      try {
        if (!currentUserId) {
          set({ userAccessLevel: null })
          return
        }

        const result =
          await accessControlService.getUserAccessLevel(currentUserId)

        if (!isCurrentRequest()) return

        if (result.success) {
          set({ userAccessLevel: result.data })
        } else {
          // Default to read_only on error
          set({ userAccessLevel: 'read_only' })

          // The service owns error reporting. Keep the store fallback as context
          // without creating a second Sentry event for the same failure.
          Sentry.addBreadcrumb({
            category: 'access_control',
            message: 'Defaulted user access level to read_only',
            level: 'warning',
            data: { error: result.error },
          })
        }
      } catch (error) {
        if (!isCurrentRequest()) return
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
  }
}
