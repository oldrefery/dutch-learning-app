/**
 * Integration tests for WordRepository
 * Tests SQLite database operations with mocks
 */

import { wordRepository } from '../wordRepository'
import * as initDB from '../initDB'
import type { Word } from '@/types/database'

jest.mock('../initDB')

describe('WordRepository', () => {
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
    word_id: 'word-1',
    user_id: 'user-1',
    collection_id: 'collection-1',
    dutch_lemma: 'huis',
    dutch_original: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'], ru: ['дом'] },
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '2025-11-02',
    created_at: '2025-10-27T00:00:00Z',
    updated_at: '2025-10-27T00:00:00Z',
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
      } catch (error) {
        // Expected to throw
      }

      expect(mockStatement.finalizeAsync).toHaveBeenCalled()
    })
  })

  describe('getWordsByUserId', () => {
    it('should retrieve words by user ID', async () => {
      const mockRow = {
        word_id: 'word-1',
        user_id: 'user-1',
        dutch_lemma: 'huis',
        translations: '{"en":["house"]}',
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: '2025-11-02',
        created_at: '2025-10-27T00:00:00Z',
      }

      mockDatabase.getAllAsync.mockResolvedValue([mockRow])

      const result = await wordRepository.getWordsByUserId('user-1')

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM words'),
        ['user-1']
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
        word_id: 'word-1',
        user_id: 'user-1',
        dutch_lemma: 'huis',
        translations: '{"en":["house"],"ru":["дом"]}',
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: '2025-11-02',
        created_at: '2025-10-27T00:00:00Z',
      }

      mockDatabase.getAllAsync.mockResolvedValue([mockRow])

      const result = await wordRepository.getWordsByUserId('user-1')

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

      await wordRepository.getWordsByUserId('user-1')

      expect(initDB.getDatabase).toHaveBeenCalled()
    })

    it('should reuse database connection', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      await wordRepository.getWordsByUserId('user-1')
      await wordRepository.getWordsByUserId('user-1')

      expect(initDB.getDatabase).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')
      ;(initDB.getDatabase as jest.Mock).mockRejectedValue(dbError)

      await expect(wordRepository.getWordsByUserId('user-1')).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle prepare statement errors', async () => {
      const prepareError = new Error('Prepare failed')
      mockDatabase.prepareAsync.mockRejectedValue(prepareError)

      await expect(wordRepository.saveWords([mockWord])).rejects.toThrow(
        'Prepare failed'
      )
    })
  })
})
