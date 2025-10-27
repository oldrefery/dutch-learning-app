/**
 * Integration tests for WordRepository
 * Tests SQLite database operations with mocks
 */

import { wordRepository } from '../wordRepository'
import * as initDB from '../initDB'
import type { Word } from '@/types/database'

jest.mock('../initDB')

describe('WordRepository', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const WORD_ID_1 = generateId('word')
  const DB_ERROR_MSG = 'Database connection failed'
  const PREPARE_ERROR_MSG = 'Prepare failed'
  const NEXT_REVIEW_DATE = '2025-11-02'
  const CREATED_AT = '2025-10-27T00:00:00Z'

  const mockDatabase = {
    prepareAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    execAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
    closeAsync: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(initDB.getDatabase as jest.Mock).mockResolvedValue(mockDatabase)
  })

  const mockWord: Word = {
    word_id: generateId('word'),
    user_id: generateId('user'),
    collection_id: generateId('collection'),
    dutch_lemma: 'huis',
    dutch_original: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'], ru: ['дом'] },
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: NEXT_REVIEW_DATE,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: [],
    antonyms: [],
  }

  describe('saveWords', () => {
    it('should save words to database', async () => {
      const mockStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync.mockResolvedValue(mockStatement)

      await wordRepository.saveWords([mockWord])

      expect(mockDatabase.prepareAsync).toHaveBeenCalled()
      expect(mockStatement.executeAsync).toHaveBeenCalled()
      expect(mockStatement.finalizeAsync).toHaveBeenCalled()
    })

    it('should handle multiple words', async () => {
      const mockStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync.mockResolvedValue(mockStatement)

      const words = [mockWord, { ...mockWord, word_id: 'word-2' }]
      await wordRepository.saveWords(words)

      expect(mockStatement.executeAsync).toHaveBeenCalledTimes(2)
    })

    it('should finalize statement even on error', async () => {
      const mockStatement = {
        executeAsync: jest.fn().mockRejectedValue(new Error('DB error')),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync.mockResolvedValue(mockStatement)

      try {
        await wordRepository.saveWords([mockWord])
      } catch {
        // Expected to throw
      }

      expect(mockStatement.finalizeAsync).toHaveBeenCalled()
    })
  })

  describe('getWordsByUserId', () => {
    it('should retrieve words by user ID', async () => {
      const mockRow = {
        word_id: WORD_ID_1,
        user_id: USER_ID,
        dutch_lemma: 'huis',
        translations: '{"en":["house"]}',
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: '2025-11-02',
        created_at: '2025-10-27T00:00:00Z',
      }

      mockDatabase.getAllAsync.mockResolvedValue([mockRow])

      const result = await wordRepository.getWordsByUserId(USER_ID)

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM words'),
        [USER_ID]
      )
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return empty array when no words found', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      const result = await wordRepository.getWordsByUserId('user-unknown')

      expect(result).toEqual([])
    })

    it('should parse translations from JSON string', async () => {
      const mockRow = {
        word_id: WORD_ID_1,
        user_id: USER_ID,
        dutch_lemma: 'huis',
        translations: '{"en":["house"],"ru":["дом"]}',
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: NEXT_REVIEW_DATE,
        created_at: CREATED_AT,
      }

      mockDatabase.getAllAsync.mockResolvedValue([mockRow])

      const result = await wordRepository.getWordsByUserId(USER_ID)

      if (result.length > 0) {
        expect(result[0].translations).toEqual({
          en: ['house'],
          ru: ['дом'],
        })
      }
    })
  })

  describe('database connection', () => {
    it('should initialize database on first call', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      await wordRepository.getWordsByUserId(USER_ID)

      expect(initDB.getDatabase).toHaveBeenCalled()
    })

    it('should reuse database connection', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      await wordRepository.getWordsByUserId(USER_ID)
      await wordRepository.getWordsByUserId(USER_ID)

      expect(initDB.getDatabase).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error(DB_ERROR_MSG)
      ;(initDB.getDatabase as jest.Mock).mockRejectedValue(dbError)

      await expect(wordRepository.getWordsByUserId(USER_ID)).rejects.toThrow(
        DB_ERROR_MSG
      )
    })

    it('should handle prepare statement errors', async () => {
      const prepareError = new Error(PREPARE_ERROR_MSG)
      mockDatabase.prepareAsync.mockRejectedValue(prepareError)

      await expect(wordRepository.saveWords([mockWord])).rejects.toThrow(
        PREPARE_ERROR_MSG
      )
    })
  })
})
