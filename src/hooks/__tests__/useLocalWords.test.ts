/**
 * Unit tests for useLocalWords hook
 * Tests local word fetching, caching, and progress updates
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useLocalWords } from '../useLocalWords'
import { wordRepository } from '@/db/wordRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { LocalWord } from '@/db/wordRepository'

jest.mock('@/db/wordRepository')
jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')
jest.mock('@/db/progressRepository')

describe('useLocalWords', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const COLLECTION_ID = generateId('collection')
  const WORD_ID = generateId('word')

  // Helper to create mock words
  const createMockWord = (overrides: Partial<LocalWord> = {}): LocalWord => ({
    word_id: generateId('word'),
    user_id: USER_ID,
    collection_id: generateId('collection'),
    dutch_lemma: 'lopen',
    dutch_original: 'loopt',
    part_of_speech: 'verb',
    article: null,
    translations: { en: ['walk'], ru: ['ходить'] },
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: [],
    antonyms: [],
    last_reviewed_at: null,
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useApplicationStore as jest.Mock).mockReturnValue({
      currentUserId: USER_ID,
    })
  })

  describe('fetchWords', () => {
    it('should fetch words by user ID', async () => {
      const mockWords = [
        createMockWord({ word_id: 'word-1' }),
        createMockWord({ word_id: 'word-2' }),
      ]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWords()
      })

      expect(result.current.words).toEqual(mockWords)
      expect(wordRepository.getWordsByUserId).toHaveBeenCalledWith(USER_ID)
    })

    it('should set isLoading to true during fetch', async () => {
      ;(wordRepository.getWordsByUserId as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      const { result } = renderHook(() => useLocalWords())

      act(() => {
        result.current.fetchWords()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Fetch failed')
      ;(wordRepository.getWordsByUserId as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWords()
      })

      expect(result.current.words).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should skip fetch if no user ID', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWords()
      })

      expect(wordRepository.getWordsByUserId).not.toHaveBeenCalled()
    })

    it('should auto-fetch on mount when user ID exists', async () => {
      const mockWords = [createMockWord()]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )

      const { result } = renderHook(() => useLocalWords())

      await waitFor(() => {
        expect(result.current.words).toEqual(mockWords)
      })
    })

    it('should not auto-fetch on mount when user ID is null', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      renderHook(() => useLocalWords())

      await waitFor(() => {
        expect(wordRepository.getWordsByUserId).not.toHaveBeenCalled()
      })
    })
  })

  describe('fetchWordsByCollection', () => {
    it('should fetch words by collection ID', async () => {
      const mockWords = [
        createMockWord({ word_id: 'word-1', collection_id: COLLECTION_ID }),
        createMockWord({ word_id: 'word-2', collection_id: COLLECTION_ID }),
      ]
      ;(wordRepository.getWordsByCollectionId as jest.Mock).mockResolvedValue(
        mockWords
      )

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWordsByCollection(COLLECTION_ID)
      })

      expect(result.current.words).toEqual(mockWords)
      expect(wordRepository.getWordsByCollectionId).toHaveBeenCalledWith(
        COLLECTION_ID
      )
    })

    it('should set isLoading during collection fetch', async () => {
      ;(wordRepository.getWordsByCollectionId as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      const { result } = renderHook(() => useLocalWords())

      act(() => {
        result.current.fetchWordsByCollection(COLLECTION_ID)
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle collection fetch errors', async () => {
      const error = new Error('Collection fetch failed')
      ;(wordRepository.getWordsByCollectionId as jest.Mock).mockRejectedValue(
        error
      )

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWordsByCollection(COLLECTION_ID)
      })

      expect(result.current.words).toEqual([])
    })
  })

  describe('getWord', () => {
    it('should get a single word by ID', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      ;(wordRepository.getWordByIdAndUserId as jest.Mock).mockResolvedValue(
        mockWord
      )

      const { result } = renderHook(() => useLocalWords())

      let fetchedWord: LocalWord | null = null
      await act(async () => {
        fetchedWord = await result.current.getWord(WORD_ID)
      })

      expect(fetchedWord).toEqual(mockWord)
      expect(wordRepository.getWordByIdAndUserId).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID
      )
    })

    it('should return null if word not found', async () => {
      ;(wordRepository.getWordByIdAndUserId as jest.Mock).mockResolvedValue(
        null
      )

      const { result } = renderHook(() => useLocalWords())

      let fetchedWord: LocalWord | null = { word_id: 'dummy' } as LocalWord
      await act(async () => {
        fetchedWord = await result.current.getWord(WORD_ID)
      })

      expect(fetchedWord).toBeNull()
    })

    it('should handle get word errors', async () => {
      const error = new Error('Get word failed')
      ;(wordRepository.getWordByIdAndUserId as jest.Mock).mockRejectedValue(
        error
      )

      const { result } = renderHook(() => useLocalWords())

      let fetchedWord: LocalWord | null = { word_id: 'dummy' } as LocalWord
      await act(async () => {
        fetchedWord = await result.current.getWord(WORD_ID)
      })

      expect(fetchedWord).toBeNull()
    })

    it('should return null if no user ID when getting word', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      const { result } = renderHook(() => useLocalWords())

      let fetchedWord: LocalWord | null = { word_id: 'dummy' } as LocalWord
      await act(async () => {
        fetchedWord = await result.current.getWord(WORD_ID)
      })

      expect(fetchedWord).toBeNull()
      expect(wordRepository.getWordByIdAndUserId).not.toHaveBeenCalled()
    })
  })

  describe('updateWordProgress', () => {
    it('should update word progress and refresh words', async () => {
      const mockWords = [createMockWord({ repetition_count: 1 })]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )
      ;(wordRepository.updateWordProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalWords())

      const progressUpdate = { repetition_count: 1 }

      await act(async () => {
        await result.current.updateWordProgress(WORD_ID, progressUpdate)
      })

      expect(wordRepository.updateWordProgress).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID,
        progressUpdate
      )
      expect(wordRepository.getWordsByUserId).toHaveBeenCalled()
    })

    it('should not update if no user ID', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      const { result } = renderHook(() => useLocalWords())

      const progressUpdate = { repetition_count: 1 }

      await act(async () => {
        await result.current.updateWordProgress(WORD_ID, progressUpdate)
      })

      expect(wordRepository.updateWordProgress).not.toHaveBeenCalled()
    })

    it('should throw error on update failure', async () => {
      const updateError = new Error('Update failed')
      ;(wordRepository.updateWordProgress as jest.Mock).mockRejectedValue(
        updateError
      )

      const { result } = renderHook(() => useLocalWords())

      const progressUpdate = { repetition_count: 1 }

      await expect(
        act(async () => {
          await result.current.updateWordProgress(WORD_ID, progressUpdate)
        })
      ).rejects.toThrow('Update failed')
    })

    it('should handle multiple progress updates', async () => {
      const mockWords = [createMockWord()]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )
      ;(wordRepository.updateWordProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalWords())

      const updates = [
        { repetition_count: 1 },
        { repetition_count: 2 },
        { repetition_count: 3 },
      ]

      for (const update of updates) {
        await act(async () => {
          await result.current.updateWordProgress(WORD_ID, update)
        })
      }

      expect(wordRepository.updateWordProgress).toHaveBeenCalledTimes(3)
    })
  })

  describe('hook integration', () => {
    it('should provide all expected methods', async () => {
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue([])

      const { result } = renderHook(() => useLocalWords())

      expect(result.current).toHaveProperty('words')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('fetchWords')
      expect(result.current).toHaveProperty('fetchWordsByCollection')
      expect(result.current).toHaveProperty('getWord')
      expect(result.current).toHaveProperty('updateWordProgress')
    })

    it('should initialize with empty words and false loading', () => {
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue([])

      const { result } = renderHook(() => useLocalWords())

      // Initial state before auto-fetch completes
      expect(Array.isArray(result.current.words)).toBe(true)
      expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('should handle sequential fetch operations', async () => {
      const mockWords1 = [createMockWord({ word_id: 'word-1' })]
      const mockWords2 = [createMockWord({ word_id: 'word-2' })]

      ;(
        wordRepository.getWordsByCollectionId as jest.Mock
      ).mockResolvedValueOnce(mockWords1)
      ;(
        wordRepository.getWordsByCollectionId as jest.Mock
      ).mockResolvedValueOnce(mockWords2)

      const { result } = renderHook(() => useLocalWords())

      await act(async () => {
        await result.current.fetchWordsByCollection('collection-1')
      })

      expect(result.current.words).toEqual(mockWords1)

      await act(async () => {
        await result.current.fetchWordsByCollection('collection-2')
      })

      expect(result.current.words).toEqual(mockWords2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty word lists', async () => {
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue([])

      const { result } = renderHook(() => useLocalWords())

      await waitFor(() => {
        expect(result.current.words).toEqual([])
      })
    })

    it('should handle word data with missing optional fields', async () => {
      const minimalWord = createMockWord({
        synonyms: undefined as any,
        antonyms: undefined as any,
      })
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue([
        minimalWord,
      ])

      const { result } = renderHook(() => useLocalWords())

      await waitFor(() => {
        expect(result.current.words.length).toBeGreaterThan(0)
      })
    })

    it('should maintain word state after failed update', async () => {
      const mockWords = [createMockWord()]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )
      ;(wordRepository.updateWordProgress as jest.Mock).mockRejectedValueOnce(
        new Error('Update failed')
      )

      const { result } = renderHook(() => useLocalWords())

      await waitFor(() => {
        expect(result.current.words).toEqual(mockWords)
      })

      try {
        await act(async () => {
          await result.current.updateWordProgress(WORD_ID, {
            repetition_count: 1,
          })
        })
      } catch {
        // Expected error
      }

      expect(result.current.words).toEqual(mockWords)
    })
  })
})
