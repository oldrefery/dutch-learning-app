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

  it('routes an unsettled import move to explicit current-state recovery without ordinary movement', async () => {
    const moveWordToCollection = jest.fn()
    const word = {
      ...useApplicationStore.getState().words[0],
      dictionary_import_recovery: 'pending' as const,
    }
    useApplicationStore.setState({ words: [word], moveWordToCollection })
    const { result } = renderHook(() => useCollectionDetail(collectionId))
    act(() => result.current.handleMoveToCollection(word.word_id))
    await act(async () => {
      await result.current.handleSelectTargetCollection(createMockCollection())
    })
    expect(moveWordToCollection).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledWith(ROUTES.DICTIONARY_RECOVERY)
  })

  it('does not report a successful move when the store retains a blocked card', async () => {
    const word = useApplicationStore.getState().words[0]
    useApplicationStore.setState({
      moveWordToCollection: jest.fn().mockResolvedValue(null),
    })
    const { result } = renderHook(() => useCollectionDetail(collectionId))
    act(() => result.current.handleMoveToCollection(word.word_id))
    await act(async () => {
      await result.current.handleSelectTargetCollection(createMockCollection())
    })
    expect(ToastService.show).toHaveBeenCalledWith(
      expect.stringContaining('not moved'),
      ToastType.ERROR
    )
    expect(ToastService.show).not.toHaveBeenCalledWith(
      expect.any(String),
      ToastType.SUCCESS
    )
  })

  it('does not rerender a collection for unrelated review state changes', () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useCollectionDetail(collectionId)
    })
    const initialRenders = renders
    const originalWords = result.current.collectionWords
    act(() => {
      useApplicationStore.setState({ reviewLoading: true })
    })
    act(() => {
      useApplicationStore.setState({
        reviewLoading: false,
        reviewSession: createMockReviewSession(),
      })
    })
    expect(renders).toBe(initialRenders)
    expect(result.current.collectionWords).toBe(originalWords)
  })

  it('keeps sorted data stable for modal updates and refreshes changed words and collection IDs', () => {
    const otherId = 'other-collection'
    const words = [
      createMockWord({
        word_id: 'z',
        collection_id: collectionId,
        dutch_lemma: 'zebra',
      }),
      createMockWord({
        word_id: 'a',
        collection_id: collectionId,
        dutch_lemma: 'appel',
      }),
      createMockWord({
        word_id: 'b',
        collection_id: otherId,
        dutch_lemma: 'boek',
      }),
    ]
    useApplicationStore.setState({ words })
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useCollectionDetail(id),
      { initialProps: { id: collectionId } }
    )
    const sorted = result.current.collectionWords
    expect(sorted.map(word => word.word_id)).toEqual(['a', 'z'])
    expect(words.map(word => word.word_id)).toEqual(['z', 'a', 'b'])
    act(() => result.current.handleWordPress(words[0]))
    expect(result.current.collectionWords).toBe(sorted)
    act(() => {
      useApplicationStore.setState({
        words: words.map(word =>
          word.word_id === 'z' ? { ...word, dutch_lemma: 'aardbei' } : word
        ),
      })
    })
    expect(result.current.collectionWords.map(word => word.word_id)).toEqual([
      'z',
      'a',
    ])
    expect(result.current.collectionWords).not.toBe(sorted)
    rerender({ id: otherId })
    expect(result.current.collectionWords.map(word => word.word_id)).toEqual([
      'b',
    ])
    act(() =>
      useApplicationStore.setState({
        currentUserId: null,
        words: [],
        collections: [],
      })
    )
    expect(result.current.collectionWords).toEqual([])
    expect(result.current.collection).toBeUndefined()
  })
})
