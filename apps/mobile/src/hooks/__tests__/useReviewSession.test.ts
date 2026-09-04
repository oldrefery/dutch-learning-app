/**
 * Tests for useReviewSession hook
 *
 * Pure derived state from useApplicationStore.
 * Returns review session data, current word, indices, and completion status.
 */

import { renderHook } from '@testing-library/react-native'
import { useReviewSession } from '../useReviewSession'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { createMockWord } from '@/__tests__/helpers/factories'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')

describe('useReviewSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return null reviewSession when store has no session', () => {
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: null,
      currentWord: null,
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.reviewSession).toBeNull()
    expect(result.current.reviewWords).toEqual([])
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.totalWords).toBe(0)
    // Null session is considered complete (no words to review)
    expect(result.current.sessionComplete).toBe(true)
  })

  it('should return correct reviewWords from session', () => {
    const words = [createMockWord(), createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 0, completedCount: 0 },
      currentWord: words[0],
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.reviewWords).toEqual(words)
  })

  it('should return correct currentIndex from session', () => {
    const words = [createMockWord(), createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 1, completedCount: 0 },
      currentWord: words[1],
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.currentIndex).toBe(1)
  })

  it('should calculate totalWords as reviewWords length', () => {
    const words = [createMockWord(), createMockWord(), createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 0, completedCount: 0 },
      currentWord: words[0],
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.totalWords).toBe(3)
  })

  it('should calculate currentWordNumber as currentIndex + 1', () => {
    const words = [createMockWord(), createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 1, completedCount: 0 },
      currentWord: words[1],
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.currentWordNumber).toBe(2)
  })

  it('should mark sessionComplete when index >= words length and no currentWord', () => {
    const words = [createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 1, completedCount: 1 },
      currentWord: null,
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.sessionComplete).toBe(true)
  })

  it('should not mark sessionComplete when there are remaining words', () => {
    const words = [createMockWord(), createMockWord()]
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words, currentIndex: 0, completedCount: 0 },
      currentWord: words[0],
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.sessionComplete).toBe(false)
  })

  it('should reflect reviewLoading from store', () => {
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: null,
      currentWord: null,
      reviewLoading: true,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.isLoading).toBe(true)
  })

  it('should handle empty words array', () => {
    ;(useApplicationStore as unknown as jest.Mock).mockReturnValue({
      reviewSession: { words: [], currentIndex: 0, completedCount: 0 },
      currentWord: null,
      reviewLoading: false,
    })

    const { result } = renderHook(() => useReviewSession())

    expect(result.current.reviewWords).toEqual([])
    expect(result.current.totalWords).toBe(0)
    expect(result.current.currentWordNumber).toBe(1)
  })
})
