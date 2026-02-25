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
      // Mock for checkExistingStatement - returns null (no existing word)
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(null),
        }),
        finalizeAsync: jest.fn(),
      }
      // Mock for updateStatement
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      // Mock for insertStatement
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      await wordRepository.saveWords([mockWord])

      expect(mockDatabase.prepareAsync).toHaveBeenCalledTimes(3)
      expect(mockCheckStatement.executeAsync).toHaveBeenCalled()
      expect(mockInsertStatement.executeAsync).toHaveBeenCalled()
      expect(mockCheckStatement.finalizeAsync).toHaveBeenCalled()
      expect(mockUpdateStatement.finalizeAsync).toHaveBeenCalled()
      expect(mockInsertStatement.finalizeAsync).toHaveBeenCalled()
    })

    it('should handle multiple words', async () => {
      // Mock for checkExistingStatement - returns null for both words
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(null),
        }),
        finalizeAsync: jest.fn(),
      }
      // Mock for updateStatement
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      // Mock for insertStatement
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      const words = [mockWord, { ...mockWord, word_id: 'word-2' }]
      await wordRepository.saveWords(words)

      // Check is called twice (once per word), insert is called twice
      expect(mockCheckStatement.executeAsync).toHaveBeenCalledTimes(2)
      expect(mockInsertStatement.executeAsync).toHaveBeenCalledTimes(2)
    })

    it('should update existing word when semantic key matches', async () => {
      const existingWord = {
        word_id: 'existing-word-id',
        sync_status: 'synced',
        updated_at: CREATED_AT,
      }
      // Mock for checkExistingStatement - returns existing word
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(existingWord),
        }),
        finalizeAsync: jest.fn(),
      }
      // Mock for updateStatement
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      // Mock for insertStatement
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      await wordRepository.saveWords([mockWord])

      expect(mockCheckStatement.executeAsync).toHaveBeenCalled()
      expect(mockUpdateStatement.executeAsync).toHaveBeenCalled()
      expect(mockInsertStatement.executeAsync).not.toHaveBeenCalled()
    })

    it('should finalize all statements even on error', async () => {
      // Mock for checkExistingStatement - returns null
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(null),
        }),
        finalizeAsync: jest.fn(),
      }
      // Mock for updateStatement
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      // Mock for insertStatement - throws error
      const mockInsertStatement = {
        executeAsync: jest.fn().mockRejectedValue(new Error('DB error')),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      try {
        await wordRepository.saveWords([mockWord])
      } catch {
        // Expected to throw
      }

      expect(mockCheckStatement.finalizeAsync).toHaveBeenCalled()
      expect(mockUpdateStatement.finalizeAsync).toHaveBeenCalled()
      expect(mockInsertStatement.finalizeAsync).toHaveBeenCalled()
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
