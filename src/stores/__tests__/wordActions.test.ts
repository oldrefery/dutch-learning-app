/**
 * Unit tests for word store actions
 * Tests word management operations in Zustand store
 */

import { createWordActions } from '../actions/wordActions'
import { wordService } from '@/lib/supabase'
import { wordRepository } from '@/db/wordRepository'
import { Sentry } from '@/lib/sentry'
import * as network from '@/utils/network'
import { calculateNextReview } from '@/utils/srs'
import type { ApplicationState } from '@/types/ApplicationStoreTypes'

jest.mock('@/lib/supabase')
jest.mock('@/db/wordRepository', () => ({
  wordRepository: {
    saveWords: jest.fn(),
    getWordsByUserId: jest.fn(),
    deleteWord: jest.fn(),
    updateWordProgress: jest.fn(),
  },
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))
jest.mock('@/utils/network', () => ({
  isNetworkAvailable: jest.fn(),
}))
jest.mock('@/utils/srs', () => ({
  calculateNextReview: jest.fn(),
}))
jest.mock('@/lib/supabaseClient')

describe('wordActions', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const WORD_ID = generateId('word')
  const COLLECTION_ID = generateId('collection')
  const UNAUTHENTICATED_ERROR_MSG = 'should set error if user not authenticated'
  const UNAUTHENTICATED_STATE = {
    currentUserId: null,
    words: [],
    error: null,
  }

  let mockSet: jest.Mock
  let mockGet: jest.Mock
  let actions: any

  const createMockWord = (overrides: any = {}) => ({
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

    mockSet = jest.fn(state => {
      if (typeof state === 'function') {
        return state({} as ApplicationState)
      }
      return state
    })

    mockGet = jest.fn().mockReturnValue({
      currentUserId: USER_ID,
      words: [],
      error: null,
    } as ApplicationState)

    actions = createWordActions(mockSet, mockGet)
    ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(true)
  })

  describe('fetchWords', () => {
    it('should fetch words from Supabase when online', async () => {
      const mockWords = [
        createMockWord({ word_id: generateId('word') }),
        createMockWord({ word_id: generateId('word') }),
      ]
      ;(wordService.getUserWords as jest.Mock).mockResolvedValue(mockWords)
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      await actions.fetchWords()

      expect(mockSet).toHaveBeenCalledWith({ wordsLoading: true })
      expect(wordService.getUserWords).toHaveBeenCalledWith(USER_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: mockWords,
        wordsLoading: false,
      })
    })

    it('should fetch words from local database when offline', async () => {
      const mockWords = [createMockWord()]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(false)

      await actions.fetchWords()

      expect(wordRepository.getWordsByUserId).toHaveBeenCalledWith(USER_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: mockWords,
        wordsLoading: false,
      })
    })

    it(UNAUTHENTICATED_ERROR_MSG, async () => {
      mockGet.mockReturnValue(UNAUTHENTICATED_STATE)

      await actions.fetchWords()

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
          wordsLoading: false,
        })
      )
    })

    it('should handle fetch errors', async () => {
      const error = new Error('Fetch failed')
      ;(wordService.getUserWords as jest.Mock).mockRejectedValue(error)
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      await actions.fetchWords()

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { operation: 'fetchWords' },
        extra: { message: 'Error fetching words' },
      })
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
          wordsLoading: false,
        })
      )
    })

    it('should handle empty word list', async () => {
      ;(wordService.getUserWords as jest.Mock).mockResolvedValue([])
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      await actions.fetchWords()

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
          wordsLoading: false,
        })
      )
    })
  })

  describe('addNewWord', () => {
    it('should add a new word to store', async () => {
      const newWord = createMockWord()
      const currentWords = [createMockWord()]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordService.analyzeWord as jest.Mock).mockResolvedValue(newWord)
      ;(wordService.addWord as jest.Mock).mockResolvedValue(newWord)

      const result = await actions.addNewWord('lopen')

      expect(wordService.analyzeWord).toHaveBeenCalledWith('lopen')
      expect(wordService.addWord).toHaveBeenCalledWith(newWord, USER_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: [...currentWords, newWord],
      })
      expect(result).toEqual(newWord)
    })

    it(UNAUTHENTICATED_ERROR_MSG, async () => {
      mockGet.mockReturnValue(UNAUTHENTICATED_STATE)

      await actions.addNewWord('lopen')

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
        })
      )
    })

    it('should handle add word errors', async () => {
      const error = new Error('Add failed')
      ;(wordService.analyzeWord as jest.Mock).mockRejectedValue(error)

      await actions.addNewWord('lopen')

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { operation: 'addNewWord' },
        extra: expect.objectContaining({
          word: 'lopen',
          userId: USER_ID,
        }),
      })
    })
  })

  describe('updateWordAfterReview', () => {
    it('should update word progress after review', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      const currentWords = [mockWord]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(calculateNextReview as jest.Mock).mockReturnValue({
        interval_days: 3,
        repetition_count: 1,
        easiness_factor: 2.6,
        next_review_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      })
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(false)
      ;(wordRepository.updateWordProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const assessment = { assessment: 4, rating: 4 }

      await actions.updateWordAfterReview(WORD_ID, assessment as any)

      expect(calculateNextReview).toHaveBeenCalledWith(
        expect.objectContaining({
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
          assessment: 4,
        })
      )
      expect(wordRepository.updateWordProgress).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID,
        expect.objectContaining({
          interval_days: 3,
          repetition_count: 1,
        })
      )
    })

    it(UNAUTHENTICATED_ERROR_MSG, async () => {
      mockGet.mockReturnValue(UNAUTHENTICATED_STATE)

      const assessment = { assessment: 4 }

      await actions.updateWordAfterReview(WORD_ID, assessment as any)

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
        })
      )
    })

    it('should handle update errors', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [mockWord],
        error: null,
      })
      const error = new Error('Update failed')
      ;(wordService.updateWordProgress as jest.Mock).mockRejectedValue(error)
      ;(calculateNextReview as jest.Mock).mockReturnValue({
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
      })
      ;(network.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      const assessment = { assessment: 4 }

      await actions.updateWordAfterReview(WORD_ID, assessment as any)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { operation: 'updateWordAfterReview' },
        })
      )
    })
  })

  describe('deleteWord', () => {
    it('should delete a word', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      const currentWords = [mockWord, createMockWord()]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordService.deleteWord as jest.Mock).mockResolvedValue(undefined)

      await actions.deleteWord(WORD_ID)

      expect(wordService.deleteWord).toHaveBeenCalledWith(WORD_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          expect.not.objectContaining({ word_id: WORD_ID }),
        ]),
      })
    })

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed')
      ;(wordService.deleteWord as jest.Mock).mockRejectedValue(error)

      await actions.deleteWord(WORD_ID)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { operation: 'deleteWord' },
        })
      )
    })
  })

  describe('resetWordProgress', () => {
    it('should reset word progress', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      const resetWord = createMockWord({
        word_id: WORD_ID,
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
      })
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [mockWord],
        error: null,
      })
      ;(wordService.resetWordProgress as jest.Mock).mockResolvedValue(resetWord)

      await actions.resetWordProgress(WORD_ID)

      expect(wordService.resetWordProgress).toHaveBeenCalledWith(WORD_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([resetWord]),
      })
    })

    it('should handle reset errors', async () => {
      const error = new Error('Reset failed')
      ;(wordService.resetWordProgress as jest.Mock).mockRejectedValue(error)
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [createMockWord({ word_id: WORD_ID })],
        error: null,
      })

      await actions.resetWordProgress(WORD_ID)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { operation: 'resetWordProgress' },
        })
      )
    })
  })

  describe('moveWordToCollection', () => {
    it('should move word to different collection', async () => {
      const newCollectionId = generateId('collection')
      const mockWord = createMockWord({ word_id: WORD_ID })
      const movedWord = createMockWord({
        word_id: WORD_ID,
        collection_id: newCollectionId,
      })
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [mockWord],
        error: null,
      })
      ;(wordService.moveWordToCollection as jest.Mock).mockResolvedValue(
        movedWord
      )

      await actions.moveWordToCollection(WORD_ID, newCollectionId)

      expect(wordService.moveWordToCollection).toHaveBeenCalledWith(
        WORD_ID,
        newCollectionId
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([movedWord]),
      })
    })
  })

  describe('addWordsToCollection', () => {
    it('should add multiple words to collection', async () => {
      const currentWords = [createMockWord()]
      const newWords = [
        createMockWord({ word_id: generateId('word') }),
        createMockWord({ word_id: generateId('word') }),
      ]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordService.importWordsToCollection as jest.Mock).mockResolvedValue(
        newWords
      )

      const result = await actions.addWordsToCollection(COLLECTION_ID, newWords)

      expect(wordService.importWordsToCollection).toHaveBeenCalledWith(
        COLLECTION_ID,
        newWords
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: [...currentWords, ...newWords],
      })
      expect(result).toBe(true)
    })

    it('should handle empty word list', async () => {
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [],
        error: null,
      })
      ;(wordService.importWordsToCollection as jest.Mock).mockResolvedValue([])

      const result = await actions.addWordsToCollection(COLLECTION_ID, [])

      expect(wordService.importWordsToCollection).toHaveBeenCalledWith(
        COLLECTION_ID,
        []
      )
      expect(result).toBe(true)
    })
  })

  describe('integration', () => {
    it('should provide all word action methods', () => {
      expect(actions).toHaveProperty('fetchWords')
      expect(actions).toHaveProperty('addNewWord')
      expect(actions).toHaveProperty('saveAnalyzedWord')
      expect(actions).toHaveProperty('updateWordAfterReview')
      expect(actions).toHaveProperty('deleteWord')
      expect(actions).toHaveProperty('updateWordImage')
      expect(actions).toHaveProperty('moveWordToCollection')
      expect(actions).toHaveProperty('resetWordProgress')
      expect(actions).toHaveProperty('addWordsToCollection')
    })
  })
})
