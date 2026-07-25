/**
 * Integration tests for WordRepository
 * Tests SQLite database operations with mocks
 */

import { wordRepository } from '../wordRepository'
import * as initDB from '../initDB'
import type { Word } from '@/types/database'
import { ExpressionType } from '@/types/ExpressionTypes'

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
    last_reviewed_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    plural: null,
    register: null,
    examples: null,
    conjugation: null,
    preposition: null,
    image_url: null,
    tts_url: null,
    analysis_notes: null,
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

      const words = [
        mockWord,
        {
          ...mockWord,
          word_id: 'word-2',
          part_of_speech: null,
          article: null,
        },
      ]
      await wordRepository.saveWords(words)

      // Check is called twice (once per word), insert is called twice
      expect(mockCheckStatement.executeAsync).toHaveBeenCalledTimes(2)
      expect(mockInsertStatement.executeAsync).toHaveBeenCalledTimes(2)
    })

    it('should bind populated optional fields and enabled flags', async () => {
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(null),
        }),
        finalizeAsync: jest.fn(),
      }
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)
      const populatedWord: Word = {
        ...mockWord,
        dutch_original: 'het huis',
        is_irregular: true,
        is_reflexive: true,
        is_expression: true,
        expression_type: ExpressionType.IDIOM,
        is_separable: true,
        prefix_part: 'op',
        root_verb: 'geven',
        plural: 'huizen',
        register: 'formal',
        examples: [{ nl: 'Een huis.', en: 'A house.' }],
        conjugation: {
          present: 'geef',
          simple_past: 'gaf',
          past_participle: 'gegeven',
        },
        preposition: 'van',
        image_url: 'https://example.com/house.png',
        tts_url: 'https://example.com/house.mp3',
        last_reviewed_at: CREATED_AT,
        analysis_notes: 'Common noun',
      }

      await wordRepository.saveWords([populatedWord])

      const insertArguments = mockInsertStatement.executeAsync.mock.calls[0]
      expect(insertArguments).toEqual(
        expect.arrayContaining([
          1,
          ExpressionType.IDIOM,
          'op',
          'geven',
          'huizen',
          'formal',
          JSON.stringify(populatedWord.examples),
          JSON.stringify(populatedWord.conjugation),
          'https://example.com/house.png',
          'https://example.com/house.mp3',
          'Common noun',
        ])
      )
    })

    it('should apply SRS defaults to incomplete imported words', async () => {
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(null),
        }),
        finalizeAsync: jest.fn(),
      }
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)
      const incompleteWord = {
        ...mockWord,
        interval_days: undefined,
        repetition_count: undefined,
        easiness_factor: undefined,
      } as unknown as Word

      await wordRepository.saveWords([incompleteWord])

      const insertArguments = mockInsertStatement.executeAsync.mock.calls[0]
      expect(insertArguments.slice(24, 27)).toEqual([1, 0, 2.5])
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

      expect(mockCheckStatement.executeAsync).toHaveBeenCalledWith(
        mockWord.user_id,
        mockWord.word_id,
        mockWord.dutch_lemma,
        mockWord.part_of_speech,
        mockWord.article,
        mockWord.word_id
      )
      expect(mockUpdateStatement.executeAsync).toHaveBeenCalled()
      expect(mockInsertStatement.executeAsync).not.toHaveBeenCalled()
      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('dutch_lemma = ?')
      )
      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('part_of_speech = ?')
      )
      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('article = ?')
      )
      const updateArguments = mockUpdateStatement.executeAsync.mock.calls[0]
      expect(updateArguments.slice(-2)).toEqual([
        existingWord.word_id,
        mockWord.user_id,
      ])
    })

    it('should preserve an unsynced local word during remote apply', async () => {
      const existingWord = {
        word_id: 'pending-word-id',
        sync_status: 'pending',
        updated_at: '2026-07-25T11:00:00.000Z',
      }
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(existingWord),
        }),
        finalizeAsync: jest.fn(),
      }
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      await wordRepository.saveWords([mockWord], {
        preserveUnsynced: true,
      })

      expect(mockCheckStatement.executeAsync).toHaveBeenCalled()
      expect(mockUpdateStatement.executeAsync).not.toHaveBeenCalled()
      expect(mockInsertStatement.executeAsync).not.toHaveBeenCalled()
    })

    it('should never resurrect an existing local tombstone', async () => {
      const existingWord = {
        word_id: mockWord.word_id,
        sync_status: 'deleted',
        updated_at: CREATED_AT,
        deleted_at: CREATED_AT,
      }
      const mockCheckStatement = {
        executeAsync: jest.fn().mockResolvedValue({
          getFirstAsync: jest.fn().mockResolvedValue(existingWord),
        }),
        finalizeAsync: jest.fn(),
      }
      const mockUpdateStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      const mockInsertStatement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(mockCheckStatement)
        .mockResolvedValueOnce(mockUpdateStatement)
        .mockResolvedValueOnce(mockInsertStatement)

      await wordRepository.saveWords([mockWord])

      expect(mockUpdateStatement.executeAsync).not.toHaveBeenCalled()
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
        expect.stringContaining('deleted_at IS NULL'),
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

  describe('delete tombstones', () => {
    it('should mark a word deleted instead of removing it', async () => {
      const statement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync.mockResolvedValue(statement)

      await wordRepository.deleteWord(WORD_ID_1, USER_ID)

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'deleted'")
      )
      expect(statement.executeAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        WORD_ID_1,
        USER_ID
      )
    })

    it('should apply remote tombstones with exact-id conflict handling', async () => {
      const statement = {
        executeAsync: jest.fn(),
        finalizeAsync: jest.fn(),
      }
      mockDatabase.prepareAsync.mockResolvedValue(statement)

      await wordRepository.saveRemoteWordTombstones([
        { ...mockWord, deleted_at: CREATED_AT },
      ])

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT(word_id) DO UPDATE')
      )
      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.not.stringContaining('COALESCE(part_of_speech,')
      )
      const values = statement.executeAsync.mock.calls[0]
      expect(values.slice(-2)).toEqual([CREATED_AT, 'synced'])
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

    it('should finalize prepared statements when later preparation fails', async () => {
      const checkStatement = {
        finalizeAsync: jest.fn().mockResolvedValue(undefined),
      }
      const prepareError = new Error(PREPARE_ERROR_MSG)
      mockDatabase.prepareAsync
        .mockResolvedValueOnce(checkStatement)
        .mockRejectedValueOnce(prepareError)

      await expect(wordRepository.saveWords([mockWord])).rejects.toThrow(
        PREPARE_ERROR_MSG
      )

      expect(checkStatement.finalizeAsync).toHaveBeenCalledTimes(1)
    })
  })
})
