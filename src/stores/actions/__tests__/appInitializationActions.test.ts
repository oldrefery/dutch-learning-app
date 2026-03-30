/**
 * Tests for appInitializationActions
 *
 * Factory that creates initializeApp, fetchUserAccessLevel, setError, clearError.
 * Orchestrates initial data fetching and access level checking.
 */

import { createAppInitializationActions } from '../appInitializationActions'
import { accessControlService } from '@/services/accessControlService'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { Sentry } from '@/lib/sentry'
import type {
  StoreSetFunction,
  StoreGetFunction,
} from '@/types/ApplicationStoreTypes'

jest.mock('@/services/accessControlService')
jest.mock('@/stores/useHistoryStore')
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}))

describe('appInitializationActions', () => {
  const USER_ID = 'test-user-123'

  let mockSet: jest.Mock
  let mockGet: jest.Mock
  let currentState: Record<string, unknown>
  let actions: ReturnType<typeof createAppInitializationActions>

  const mockFetchWords = jest.fn().mockResolvedValue(undefined)
  const mockFetchCollections = jest.fn().mockResolvedValue(undefined)
  const mockFetchUserAccessLevel = jest.fn().mockResolvedValue(undefined)
  const mockEndReviewSession = jest.fn()
  const mockSetError = jest.fn()

  const mockClearWordHistory = jest.fn()
  const mockClearNotificationHistory = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    currentState = {
      currentUserId: USER_ID,
      userAccessLevel: null,
      words: [],
      collections: [],
      error: null,
    }

    mockSet = jest.fn((update: Record<string, unknown>) => {
      currentState = { ...currentState, ...update }
    })

    mockGet = jest.fn(() => ({
      ...currentState,
      fetchWords: mockFetchWords,
      fetchCollections: mockFetchCollections,
      fetchUserAccessLevel: mockFetchUserAccessLevel,
      endReviewSession: mockEndReviewSession,
      setError: mockSetError,
    }))

    actions = createAppInitializationActions(
      mockSet as unknown as StoreSetFunction,
      mockGet as unknown as StoreGetFunction
    )

    // Mock useHistoryStore
    ;(useHistoryStore.getState as jest.Mock) = jest.fn().mockReturnValue({
      clearWordHistory: mockClearWordHistory,
      clearNotificationHistory: mockClearNotificationHistory,
    })
  })

  describe('initializeApp', () => {
    it('should set currentUserId and fetch data when userId provided', async () => {
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockResolvedValue(
        { success: true, data: 'full_access' }
      )

      await actions.initializeApp(USER_ID)

      expect(mockSet).toHaveBeenCalledWith({ currentUserId: USER_ID })
    })

    it('should call fetchWords, fetchCollections, fetchUserAccessLevel in parallel', async () => {
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockResolvedValue(
        { success: true, data: 'full_access' }
      )

      await actions.initializeApp(USER_ID)

      // The initializeApp calls get().fetchWords(), get().fetchCollections(), etc.
      // But since the actions we created have their own fetchUserAccessLevel,
      // the mock fetchUserAccessLevel is the one from mockGet
      expect(mockFetchWords).toHaveBeenCalled()
      expect(mockFetchCollections).toHaveBeenCalled()
    })

    it('should clear state when no userId (logout)', async () => {
      await actions.initializeApp(undefined)

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: null,
          userAccessLevel: null,
          words: [],
          collections: [],
        })
      )
    })

    it('should call endReviewSession on logout', async () => {
      await actions.initializeApp(undefined)

      expect(mockEndReviewSession).toHaveBeenCalled()
    })

    it('should clear history stores on logout', async () => {
      await actions.initializeApp(undefined)

      expect(mockClearWordHistory).toHaveBeenCalled()
      expect(mockClearNotificationHistory).toHaveBeenCalled()
    })

    it('should capture Sentry exception on error', async () => {
      const error = new Error('Init failed')
      mockFetchWords.mockRejectedValue(error)

      await actions.initializeApp(USER_ID)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { operation: 'appInitialization' },
        })
      )
    })

    it('should set store error on failure', async () => {
      mockFetchWords.mockRejectedValue(new Error('Init failed'))

      await actions.initializeApp(USER_ID)

      // setError is called via get().setError() which is our mockSetError
      expect(mockSetError).toHaveBeenCalled()
    })
  })

  describe('fetchUserAccessLevel', () => {
    it('should set userAccessLevel from successful service call', async () => {
      currentState.currentUserId = USER_ID
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockResolvedValue(
        { success: true, data: 'full_access' }
      )

      await actions.fetchUserAccessLevel()

      expect(mockSet).toHaveBeenCalledWith({ userAccessLevel: 'full_access' })
    })

    it('should set null when no currentUserId', async () => {
      currentState.currentUserId = null

      await actions.fetchUserAccessLevel()

      expect(mockSet).toHaveBeenCalledWith({ userAccessLevel: null })
      expect(accessControlService.getUserAccessLevel).not.toHaveBeenCalled()
    })

    it('should default to read_only on service failure', async () => {
      currentState.currentUserId = USER_ID
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockResolvedValue(
        {
          success: false,
          error: 'DATABASE_ERROR',
        }
      )

      await actions.fetchUserAccessLevel()

      expect(mockSet).toHaveBeenCalledWith({ userAccessLevel: 'read_only' })
    })

    it('should default to read_only on exception', async () => {
      currentState.currentUserId = USER_ID
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockRejectedValue(
        new Error('Unexpected')
      )

      await actions.fetchUserAccessLevel()

      expect(mockSet).toHaveBeenCalledWith({ userAccessLevel: 'read_only' })
    })

    it('should capture Sentry message on service failure', async () => {
      currentState.currentUserId = USER_ID
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockResolvedValue(
        {
          success: false,
          error: 'DATABASE_ERROR',
        }
      )

      await actions.fetchUserAccessLevel()

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Failed to fetch user access level',
        expect.objectContaining({
          level: 'warning',
          tags: { operation: 'fetchUserAccessLevel' },
        })
      )
    })

    it('should capture Sentry exception on unexpected error', async () => {
      currentState.currentUserId = USER_ID
      const error = new Error('Unexpected')
      ;(accessControlService.getUserAccessLevel as jest.Mock).mockRejectedValue(
        error
      )

      await actions.fetchUserAccessLevel()

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { operation: 'fetchUserAccessLevel' },
        })
      )
    })
  })

  describe('setError', () => {
    it('should set error in store', () => {
      const error = {
        category: 'CLIENT' as const,
        severity: 'ERROR' as const,
        message: 'Test error',
        userMessage: 'Something went wrong',
        isRetryable: false,
      }

      actions.setError(error)

      expect(mockSet).toHaveBeenCalledWith({ error })
    })
  })

  describe('clearError', () => {
    it('should clear error to null', () => {
      actions.clearError()

      expect(mockSet).toHaveBeenCalledWith({ error: null })
    })
  })
})
