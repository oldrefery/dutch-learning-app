/**
 * Tests for useReviewWordsCount hook
 *
 * Calculates the number of words due for review based on
 * next_review_date, collection validity, and current time.
 */

import { renderHook, act } from '@testing-library/react-native'
import { useReviewWordsCount } from '../useReviewWordsCount'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  createMockWord,
  createMockCollection,
} from '@/__tests__/helpers/factories'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')

describe('useReviewWordsCount', () => {
  const mockFetchWords = jest.fn()

  const mockStoreState = {
    words: [] as ReturnType<typeof createMockWord>[],
    collections: [] as ReturnType<typeof createMockCollection>[],
    fetchWords: mockFetchWords,
    wordsLoading: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchWords.mockResolvedValue(undefined)
    mockStoreState.words = []
    mockStoreState.collections = []
    mockStoreState.wordsLoading = false
    ;(useApplicationStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof mockStoreState) => unknown) =>
        selector(mockStoreState)
    )
  })

  describe('reviewWordsCount', () => {
    it('should return 0 when no words', () => {
      mockStoreState.words = []
      mockStoreState.collections = []

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(0)
    })

    it('should return 0 when no words are due for review', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const futureDate = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString()
      const word = createMockWord({
        collection_id: 'col-1',
        next_review_date: futureDate,
      })

      mockStoreState.words = [word]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(0)
    })

    it('should count words where next_review_date <= now', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const word = createMockWord({
        collection_id: 'col-1',
        next_review_date: pastDate,
      })

      mockStoreState.words = [word]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(1)
    })

    it('should exclude words without collection_id', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const word = createMockWord({
        collection_id: null,
        next_review_date: pastDate,
      })

      mockStoreState.words = [word]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(0)
    })

    it('should exclude words whose collection is not in collections list', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const word = createMockWord({
        collection_id: 'col-nonexistent',
        next_review_date: pastDate,
      })

      mockStoreState.words = [word]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(0)
    })

    it('should exclude words without next_review_date', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const word = createMockWord({
        collection_id: 'col-1',
        next_review_date: '',
      })

      mockStoreState.words = [word]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(0)
    })

    it('should handle mixed due/not-due words correctly', () => {
      const collection = createMockCollection({ collection_id: 'col-1' })
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const futureDate = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString()
      const dueWord = createMockWord({
        collection_id: 'col-1',
        next_review_date: pastDate,
      })
      const notDueWord = createMockWord({
        collection_id: 'col-1',
        next_review_date: futureDate,
      })

      mockStoreState.words = [dueWord, notDueWord]
      mockStoreState.collections = [collection]

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.reviewWordsCount).toBe(1)
    })
  })

  describe('refreshCount', () => {
    it('should call fetchWords from store', async () => {
      mockStoreState.words = []
      mockStoreState.collections = []

      const { result } = renderHook(() => useReviewWordsCount())

      await act(async () => {
        await result.current.refreshCount()
      })

      expect(mockFetchWords).toHaveBeenCalledTimes(1)
    })
  })

  describe('isLoading', () => {
    it('should return true when wordsLoading is true', () => {
      mockStoreState.wordsLoading = true
      mockStoreState.words = []
      mockStoreState.collections = []

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.isLoading).toBe(true)
    })

    it('should return false when neither is loading', () => {
      mockStoreState.wordsLoading = false
      mockStoreState.words = []
      mockStoreState.collections = []

      const { result } = renderHook(() => useReviewWordsCount())

      expect(result.current.isLoading).toBe(false)
    })
  })
})
