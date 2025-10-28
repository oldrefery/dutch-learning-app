/**
 * Unit tests for word store actions
 * Test word management operations in Zustand store with offline-first architecture
 */

import { createWordActions } from '../actions/wordActions'
import { wordRepository } from '@/db/wordRepository'
import { Sentry } from '@/lib/sentry'
import { calculateNextReview } from '@/utils/srs'
import { logError } from '@/utils/logger'
import type { ApplicationState } from '@/types/ApplicationStoreTypes'

jest.mock('@/db/wordRepository', () => ({
  wordRepository: {
    getWordsByUserId: jest.fn(),
    addWord: jest.fn(),
    deleteWord: jest.fn(),
    updateWordProgress: jest.fn(),
    updateWordImage: jest.fn(),
    moveWordToCollection: jest.fn(),
    resetWordProgress: jest.fn(),
  },
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))
jest.mock('@/utils/srs', () => ({
  calculateNextReview: jest.fn(),
}))
jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
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

    let currentState = {
      currentUserId: USER_ID,
      words: [],
      error: null,
    } as ApplicationState

    mockSet = jest.fn((update: any) => {
      if (typeof update === 'function') {
        currentState = update(currentState)
      } else {
        currentState = { ...currentState, ...update }
      }
    })

    mockGet = jest.fn(() => currentState)

    actions = createWordActions(mockSet, mockGet)
  })

  describe('fetchWords', () => {
    it('should fetch words from local repository', async () => {
      const mockWords = [
        createMockWord({ word_id: generateId('word') }),
        createMockWord({ word_id: generateId('word') }),
      ]
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue(
        mockWords
      )

      await actions.fetchWords()

      expect(mockSet).toHaveBeenCalledWith({ wordsLoading: true })
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
      ;(wordRepository.getWordsByUserId as jest.Mock).mockRejectedValue(error)

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

    it('should handle empty word list as valid state', async () => {
      ;(wordRepository.getWordsByUserId as jest.Mock).mockResolvedValue([])
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        error: null,
      })

      await actions.fetchWords()

      // Empty word list is a valid state for new users - no error should be set
      expect(mockSet).toHaveBeenCalledWith({
        words: [],
        wordsLoading: false,
      })
    })
  })

  describe('addNewWord', () => {
    it('should throw deprecation error', async () => {
      await expect(actions.addNewWord('lopen')).rejects.toThrow(
        'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
      )
    })

    it('should throw deprecation error with collection id', async () => {
      await expect(actions.addNewWord('lopen', COLLECTION_ID)).rejects.toThrow(
        'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
      )
    })
  })

  describe('saveAnalyzedWord', () => {
    it('should save analyzed word to repository', async () => {
      const analyzedWord = {
        dutch_lemma: 'lopen',
        dutch_original: 'loopt',
        part_of_speech: 'verb',
        translations: { en: ['walk'], ru: ['ходить'] },
        synonyms: [],
        antonyms: [],
        is_irregular: false,
        is_reflexive: false,
        is_expression: false,
        is_separable: false,
      }
      const currentWords = [createMockWord()]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordRepository.addWord as jest.Mock).mockResolvedValue(undefined)

      const result = await actions.saveAnalyzedWord(analyzedWord)

      expect(wordRepository.addWord).toHaveBeenCalledWith(
        expect.objectContaining({
          dutch_lemma: 'lopen',
          dutch_original: 'loopt',
          user_id: USER_ID,
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
        })
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          ...currentWords,
          expect.objectContaining({ dutch_lemma: 'lopen' }),
        ]),
      })
      expect(result).toEqual(
        expect.objectContaining({
          dutch_lemma: 'lopen',
          user_id: USER_ID,
        })
      )
    })

    it('should save analyzed word with collection id', async () => {
      const analyzedWord = {
        dutch_lemma: 'lopen',
        translations: { en: ['walk'] },
        synonyms: [],
        antonyms: [],
      }
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [],
        error: null,
      })
      ;(wordRepository.addWord as jest.Mock).mockResolvedValue(undefined)

      await actions.saveAnalyzedWord(analyzedWord, COLLECTION_ID)

      expect(wordRepository.addWord).toHaveBeenCalledWith(
        expect.objectContaining({
          collection_id: COLLECTION_ID,
          user_id: USER_ID,
        })
      )
    })

    it(UNAUTHENTICATED_ERROR_MSG, async () => {
      mockGet.mockReturnValue(UNAUTHENTICATED_STATE)

      const analyzedWord = {
        dutch_lemma: 'lopen',
        translations: { en: ['walk'] },
      }

      await actions.saveAnalyzedWord(analyzedWord)

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
        })
      )
    })

    it('should handle save errors', async () => {
      const error = new Error('Save failed')
      const analyzedWord = {
        dutch_lemma: 'lopen',
        translations: { en: ['walk'] },
      }
      ;(wordRepository.addWord as jest.Mock).mockRejectedValue(error)

      await actions.saveAnalyzedWord(analyzedWord)

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: expect.objectContaining({
          analyzedWord,
          userId: USER_ID,
        }),
      })
    })
  })

  describe('updateWordAfterReview', () => {
    it('should update word progress in repository', async () => {
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
          easiness_factor: 2.6,
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
      ;(wordRepository.updateWordProgress as jest.Mock).mockRejectedValue(error)
      ;(calculateNextReview as jest.Mock).mockReturnValue({
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
      })

      const assessment = { assessment: 4 }

      await actions.updateWordAfterReview(WORD_ID, assessment as any)

      expect(logError).toHaveBeenCalledWith(
        'Error updating word after review',
        error,
        expect.objectContaining({ wordId: WORD_ID, assessment }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to update word progress',
          }),
        })
      )
    })
  })

  describe('deleteWord', () => {
    it('should delete a word from repository', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      const currentWords = [mockWord, createMockWord()]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordRepository.deleteWord as jest.Mock).mockResolvedValue(undefined)

      await actions.deleteWord(WORD_ID)

      expect(wordRepository.deleteWord).toHaveBeenCalledWith(WORD_ID, USER_ID)
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          expect.not.objectContaining({ word_id: WORD_ID }),
        ]),
      })
    })

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed')
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [],
        error: null,
      })
      ;(wordRepository.deleteWord as jest.Mock).mockRejectedValue(error)

      await actions.deleteWord(WORD_ID)

      expect(logError).toHaveBeenCalledWith(
        'Error deleting word',
        error,
        expect.objectContaining({ wordId: WORD_ID }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to delete word',
          }),
        })
      )
    })
  })

  describe('updateWordImage', () => {
    it('should update word image in repository', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      const currentWords = [mockWord]
      const imageUrl = 'https://example.com/image.jpg'
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordRepository.updateWordImage as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.updateWordImage(WORD_ID, imageUrl)

      expect(wordRepository.updateWordImage).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID,
        imageUrl
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          expect.objectContaining({
            word_id: WORD_ID,
            image_url: imageUrl,
          }),
        ]),
      })
    })

    it('should handle update image errors', async () => {
      const error = new Error('Update image failed')
      const imageUrl = 'https://example.com/image.jpg'
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [createMockWord({ word_id: WORD_ID })],
        error: null,
      })
      ;(wordRepository.updateWordImage as jest.Mock).mockRejectedValue(error)

      await actions.updateWordImage(WORD_ID, imageUrl)

      expect(logError).toHaveBeenCalledWith(
        'Error updating word image',
        error,
        expect.objectContaining({ wordId: WORD_ID, imageUrl }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to update word image',
          }),
        })
      )
    })
  })

  describe('resetWordProgress', () => {
    it('should reset word progress in repository', async () => {
      const mockWord = createMockWord({ word_id: WORD_ID })
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [mockWord],
        error: null,
      })
      ;(wordRepository.resetWordProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.resetWordProgress(WORD_ID)

      expect(wordRepository.resetWordProgress).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          expect.objectContaining({
            word_id: WORD_ID,
            interval_days: 1,
            repetition_count: 0,
            easiness_factor: 2.5,
            last_reviewed_at: null,
          }),
        ]),
      })
    })

    it('should handle reset errors', async () => {
      const error = new Error('Reset failed')
      ;(wordRepository.resetWordProgress as jest.Mock).mockRejectedValue(error)
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [createMockWord({ word_id: WORD_ID })],
        error: null,
      })

      await actions.resetWordProgress(WORD_ID)

      expect(logError).toHaveBeenCalledWith(
        'Error resetting word progress',
        error,
        expect.objectContaining({ wordId: WORD_ID }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to reset word progress',
          }),
        })
      )
    })
  })

  describe('moveWordToCollection', () => {
    it('should move word to different collection in repository', async () => {
      const newCollectionId = generateId('collection')
      const mockWord = createMockWord({ word_id: WORD_ID })
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [mockWord],
        error: null,
      })
      ;(wordRepository.moveWordToCollection as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.moveWordToCollection(WORD_ID, newCollectionId)

      expect(wordRepository.moveWordToCollection).toHaveBeenCalledWith(
        WORD_ID,
        USER_ID,
        newCollectionId
      )
      expect(mockSet).toHaveBeenCalledWith({
        words: expect.arrayContaining([
          expect.objectContaining({
            word_id: WORD_ID,
            collection_id: newCollectionId,
          }),
        ]),
      })
    })

    it('should handle move errors', async () => {
      const error = new Error('Move failed')
      const newCollectionId = generateId('collection')
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [createMockWord({ word_id: WORD_ID })],
        error: null,
      })
      ;(wordRepository.moveWordToCollection as jest.Mock).mockRejectedValue(
        error
      )

      await actions.moveWordToCollection(WORD_ID, newCollectionId)

      expect(logError).toHaveBeenCalledWith(
        'Error moving word to collection',
        error,
        expect.objectContaining({ wordId: WORD_ID, newCollectionId }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to move word to collection',
          }),
        })
      )
    })
  })

  describe('addWordsToCollection', () => {
    it('should add multiple words to collection using repository', async () => {
      const currentWords = [createMockWord()]
      const newWords = [
        {
          dutch_lemma: 'eten',
          translations: { en: ['eat'] },
          synonyms: [],
          antonyms: [],
        },
        {
          dutch_lemma: 'drinken',
          translations: { en: ['drink'] },
          synonyms: [],
          antonyms: [],
        },
      ]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: currentWords,
        error: null,
      })
      ;(wordRepository.addWord as jest.Mock).mockResolvedValue(undefined)

      const result = await actions.addWordsToCollection(COLLECTION_ID, newWords)

      expect(wordRepository.addWord).toHaveBeenCalledTimes(2)
      expect(wordRepository.addWord).toHaveBeenCalledWith(
        expect.objectContaining({
          dutch_lemma: 'eten',
          user_id: USER_ID,
          collection_id: COLLECTION_ID,
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
        })
      )
      expect(wordRepository.addWord).toHaveBeenCalledWith(
        expect.objectContaining({
          dutch_lemma: 'drinken',
          user_id: USER_ID,
          collection_id: COLLECTION_ID,
        })
      )
      expect(result).toBe(true)
    })

    it('should handle empty word list', async () => {
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [],
        error: null,
      })
      ;(wordRepository.addWord as jest.Mock).mockResolvedValue(undefined)

      const result = await actions.addWordsToCollection(COLLECTION_ID, [])

      expect(wordRepository.addWord).not.toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should handle add words errors', async () => {
      const error = new Error('Add words failed')
      const newWords = [{ dutch_lemma: 'eten', translations: { en: ['eat'] } }]
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        words: [],
        error: null,
      })
      ;(wordRepository.addWord as jest.Mock).mockRejectedValue(error)

      const result = await actions.addWordsToCollection(COLLECTION_ID, newWords)

      expect(logError).toHaveBeenCalledWith(
        'Error adding words to collection',
        error,
        expect.objectContaining({
          collectionId: COLLECTION_ID,
          wordCount: newWords.length,
        }),
        'words',
        false
      )
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to import words',
          }),
        })
      )
      expect(result).toBe(false)
    })

    it(UNAUTHENTICATED_ERROR_MSG, async () => {
      mockGet.mockReturnValue(UNAUTHENTICATED_STATE)

      const result = await actions.addWordsToCollection(COLLECTION_ID, [
        { dutch_lemma: 'eten', translations: { en: ['eat'] } },
      ])

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.any(String),
          }),
        })
      )
      expect(result).toBe(false)
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
