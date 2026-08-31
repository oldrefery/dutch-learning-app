import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { ToastService } from '@/components/AppToast'
import { REVIEW_SCOPE, REVIEW_SESSION_MODE } from '@/constants/ReviewConstants'
import { ROUTES } from '@/constants/Routes'
import { ToastType } from '@/constants/ToastConstants'
import { useCollectionDetail } from '@/hooks/useCollectionDetail'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { ReviewSessionConfig } from '@/types/ReviewTypes'
import {
  createMockCollection,
  createMockReviewSession,
  createMockWord,
} from '@/__tests__/helpers/factories'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}))
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: {
    show: jest.fn(),
  },
}))
jest.mock('@/lib/supabaseClient')

describe('useCollectionDetail', () => {
  const collectionId = 'collection-under-review'

  beforeEach(() => {
    jest.clearAllMocks()

    const collection = createMockCollection({ collection_id: collectionId })
    const dueWord = createMockWord({
      collection_id: collectionId,
      next_review_date: new Date().toISOString().split('T')[0],
    })

    useApplicationStore.setState({
      currentUserId: collection.user_id,
      collections: [collection],
      words: [dueWord],
      reviewSession: null,
      currentWord: null,
      error: null,
    })
    useSettingsStore.setState({
      lastSelectedReviewMode: REVIEW_SESSION_MODE.ADAPTIVE,
    })
  })

  it('starts a collection-scoped session before navigating to review', async () => {
    const startReviewSession = jest.fn(async (config?: ReviewSessionConfig) => {
      if (!config) throw new Error('Expected a review session configuration.')
      useApplicationStore.setState({
        reviewSession: createMockReviewSession({ config }),
      })
    })
    useApplicationStore.setState({ startReviewSession })

    const { result } = renderHook(() => useCollectionDetail(collectionId))

    await act(async () => {
      await result.current.handleStartReview()
    })

    expect(startReviewSession).toHaveBeenCalledWith({
      mode: REVIEW_SESSION_MODE.ADAPTIVE,
      scope: REVIEW_SCOPE.COLLECTION_DUE,
      collectionId,
    })
    expect(router.push).toHaveBeenCalledWith(ROUTES.TABS.REVIEW)
  })

  it('does not create a session when no words are due', async () => {
    const startReviewSession = jest.fn()
    useApplicationStore.setState({
      words: [
        createMockWord({
          collection_id: collectionId,
          next_review_date: '2999-01-01',
        }),
      ],
      startReviewSession,
    })

    const { result } = renderHook(() => useCollectionDetail(collectionId))

    await act(async () => {
      await result.current.handleStartReview()
    })

    expect(startReviewSession).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(ToastService.show).toHaveBeenCalledWith(
      'No words are due for review in this collection',
      ToastType.INFO
    )
  })
})
