/**
 * Unit tests for reviewActions
 * Tests review session management with offline-first architecture
 */

import { createReviewActions } from '../reviewActions'
import type {
  StoreSetFunction,
  StoreGetFunction,
  ReviewAssessment,
} from '@/types/ApplicationStoreTypes'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'
import type { Word } from '@/types/database'

jest.mock('@/lib/sentry')
jest.mock('@/utils/logger')

describe('reviewActions', () => {
  // Helper to generate random IDs
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const WORD_ID = generateId('word')

  // Helper to create mock words
  const createMockWord = (overrides: Partial<Word> = {}): Word => ({
    word_id: generateId('word'),
    user_id: USER_ID,
    collection_id: generateId('collection'),
    dutch_lemma: 'lopen',
    dutch_original: 'loopt',
    part_of_speech: 'verb',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    article: null,
    plural: null,
    translations: { en: ['walk'] },
    examples: null,
    synonyms: [],
    antonyms: [],
    conjugation: null,
    preposition: null,
    image_url: null,
    tts_url: null,
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    last_reviewed_at: null,
    analysis_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  })

  let mockSet: jest.Mock
  let mockGet: jest.Mock
  let actions: ReturnType<typeof createReviewActions>

  // Helper to create a review session with words due today
  const createReviewWordsWithToday = () => {
    const today = new Date().toISOString().split('T')[0]
    return [
      createMockWord({
        word_id: 'word-1',
        next_review_date: today,
      }),
      createMockWord({
        word_id: 'word-2',
        next_review_date: today,
      }),
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockSet = jest.fn()
    mockGet = jest.fn(() => ({
      currentUserId: USER_ID,
      words: [],
      reviewSession: null,
      currentWord: null,
      error: null,
    }))

    actions = createReviewActions(
      mockSet as unknown as StoreSetFunction,
      mockGet as unknown as StoreGetFunction
    )
  })

  describe('startReviewSession', () => {
    it('should start review session with words due for review', async () => {
      const mockWords = createReviewWordsWithToday()

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession).toBeDefined()
      expect(setCall.reviewSession.words).toHaveLength(2)
      expect(setCall.currentWord).toEqual(mockWords[0])
      expect(setCall.reviewLoading).toBe(false)
    })

    it('should filter only words due for review (next_review_date <= today)', async () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const mockWords = [
        createMockWord({
          word_id: 'word-due-yesterday',
          next_review_date: yesterday,
        }),
        createMockWord({
          word_id: 'word-due-today',
          next_review_date: today,
        }),
        createMockWord({
          word_id: 'word-due-tomorrow',
          next_review_date: tomorrow,
        }),
      ]

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession.words).toHaveLength(2)
      expect(setCall.reviewSession.words.map((w: Word) => w.word_id)).toEqual([
        'word-due-yesterday',
        'word-due-today',
      ])
    })

    it('should set reviewLoading to true at start', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: [],
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const firstSetCall = mockSet.mock.calls[0][0]
      expect(firstSetCall.reviewLoading).toBe(true)
    })

    it('should handle no review words available', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: [],
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession).toBeNull()
      expect(setCall.currentWord).toBeNull()
      expect(setCall.reviewLoading).toBe(false)
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        words: [],
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      expect(mockSet).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: expect.any(String),
          details: 'User not authenticated',
        }),
        reviewLoading: false,
      })
    })

    it('should filter by user ID', async () => {
      const today = new Date().toISOString().split('T')[0]
      const otherUserId = generateId('user')
      const mockWords = [
        createMockWord({
          word_id: 'word-1',
          user_id: USER_ID,
          next_review_date: today,
        }),
        createMockWord({
          word_id: 'word-2',
          user_id: otherUserId,
          next_review_date: today,
        }),
      ]

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession.words).toHaveLength(1)
      expect(setCall.reviewSession.words[0].user_id).toBe(USER_ID)
    })
  })

  describe('submitReviewAssessment', () => {
    it('should move to next word after assessment', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
        createMockWord({ word_id: 'word-2', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        reviewSession,
        currentWord: mockWords[0],
        words: mockWords,
        updateWordAfterReview: jest.fn().mockResolvedValue(undefined),
      })

      const assessment: ReviewAssessment = {
        wordId: 'word-1',
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      }

      await actions.submitReviewAssessment(assessment)

      const setCall = mockSet.mock.calls[0][0]
      expect(setCall.reviewSession.currentIndex).toBe(1)
      expect(setCall.currentWord).toEqual(mockWords[1])
    })

    it('should end session when last word is assessed', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        reviewSession,
        currentWord: mockWords[0],
        words: mockWords,
        updateWordAfterReview: jest.fn().mockResolvedValue(undefined),
      })

      const assessment: ReviewAssessment = {
        wordId: 'word-1',
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      }

      await actions.submitReviewAssessment(assessment)

      const setCall = mockSet.mock.calls[0][0]
      expect(setCall.reviewSession).toBeNull()
      expect(setCall.currentWord).toBeNull()
    })

    it('should validate assessment object', async () => {
      const reviewSession = {
        words: [],
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        reviewSession,
        currentWord: { word_id: 'word-1' },
        words: [],
      })

      const invalidAssessment = { wordId: 'word-1' } as ReviewAssessment

      await actions.submitReviewAssessment(invalidAssessment)

      expect(mockSet).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: expect.any(String),
          details: 'Invalid assessment object',
        }),
      })
    })

    it('should handle missing review session', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        reviewSession: null,
        currentWord: null,
        words: [],
      })

      const assessment: ReviewAssessment = {
        wordId: 'word-1',
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      }

      await actions.submitReviewAssessment(assessment)

      // Should not throw and should not set error if no session exists
      expect(mockSet).not.toHaveBeenCalled()
    })

    it('should call updateWordAfterReview', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
      ]

      const updateWordMock = jest.fn().mockResolvedValue(undefined)
      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        reviewSession,
        currentWord: mockWords[0],
        words: mockWords,
        updateWordAfterReview: updateWordMock,
      })

      const assessment: ReviewAssessment = {
        wordId: 'word-1',
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      }

      await actions.submitReviewAssessment(assessment)

      expect(updateWordMock).toHaveBeenCalledWith('word-1', assessment)
    })
  })

  describe('endReviewSession', () => {
    it('should clear review session and current word', () => {
      actions.endReviewSession()

      expect(mockSet).toHaveBeenCalledWith({
        reviewSession: null,
        currentWord: null,
      })
    })
  })

  describe('markCorrect', () => {
    it('should submit assessment with GOOD rating', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWord = createMockWord({
        word_id: WORD_ID,
        next_review_date: today,
      })

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        currentWord: mockWord,
        words: [mockWord],
        reviewSession: {
          words: [mockWord],
          currentIndex: 0,
          completedCount: 0,
        },
        submitReviewAssessment: jest.fn().mockResolvedValue(undefined),
      })

      await actions.markCorrect()

      const submitCall = mockGet().submitReviewAssessment
      expect(submitCall).toHaveBeenCalledWith({
        wordId: WORD_ID,
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: expect.any(Date),
      })
    })
  })

  describe('markIncorrect', () => {
    it('should submit assessment with AGAIN rating', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWord = createMockWord({
        word_id: WORD_ID,
        next_review_date: today,
      })

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        currentWord: mockWord,
        words: [mockWord],
        reviewSession: {
          words: [mockWord],
          currentIndex: 0,
          completedCount: 0,
        },
        submitReviewAssessment: jest.fn().mockResolvedValue(undefined),
      })

      await actions.markIncorrect()

      const submitCall = mockGet().submitReviewAssessment
      expect(submitCall).toHaveBeenCalledWith({
        wordId: WORD_ID,
        assessment: SRS_ASSESSMENT.AGAIN,
        timestamp: expect.any(Date),
      })
    })
  })

  describe('goToNextWord', () => {
    it('should navigate to next word', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
        createMockWord({ word_id: 'word-2', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[0],
      })

      actions.goToNextWord()

      expect(mockSet).toHaveBeenCalledWith({
        reviewSession: expect.objectContaining({
          currentIndex: 1,
        }),
        currentWord: mockWords[1],
      })
    })

    it('should not navigate beyond last word', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[0],
      })

      actions.goToNextWord()

      // Should not call set since there's no next word
      expect(mockSet).not.toHaveBeenCalled()
    })
  })

  describe('goToPreviousWord', () => {
    it('should navigate to previous word', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
        createMockWord({ word_id: 'word-2', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 1,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[1],
      })

      actions.goToPreviousWord()

      expect(mockSet).toHaveBeenCalledWith({
        reviewSession: expect.objectContaining({
          currentIndex: 0,
        }),
        currentWord: mockWords[0],
      })
    })

    it('should not navigate before first word', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[0],
      })

      actions.goToPreviousWord()

      // Should not call set since there's no previous word
      expect(mockSet).not.toHaveBeenCalled()
    })
  })

  describe('deleteWordFromReview', () => {
    it('should remove word from review session', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
        createMockWord({ word_id: 'word-2', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[0],
      })

      actions.deleteWordFromReview('word-1')

      const setCall = mockSet.mock.calls[0][0]
      expect(setCall.reviewSession.words).toHaveLength(1)
      expect(setCall.reviewSession.words[0].word_id).toBe('word-2')
    })

    it('should end session when last word is deleted', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({ word_id: 'word-1', next_review_date: today }),
      ]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWords[0],
      })

      actions.deleteWordFromReview('word-1')

      expect(mockSet).toHaveBeenCalledWith({
        reviewSession: null,
        currentWord: null,
      })
    })
  })

  describe('updateCurrentWordImage', () => {
    it('should update current word image', () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWord = createMockWord({
        word_id: 'word-1',
        next_review_date: today,
        image_url: null,
      })
      const mockWords = [mockWord]

      const reviewSession = {
        words: mockWords,
        currentIndex: 0,
        completedCount: 0,
      }

      mockGet.mockReturnValueOnce({
        reviewSession,
        currentWord: mockWord,
      })

      const newImageUrl = 'https://example.com/image.jpg'
      actions.updateCurrentWordImage(newImageUrl)

      const setCall = mockSet.mock.calls[0][0]
      expect(setCall.currentWord.image_url).toBe(newImageUrl)
      expect(setCall.reviewSession.words[0].image_url).toBe(newImageUrl)
    })
  })

  describe('offline-first behavior', () => {
    it('should use local cache (no network calls)', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({
          word_id: 'word-1',
          next_review_date: today,
        }),
      ]

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      // Should only use mockGet().words - no external API calls
      expect(mockGet).toHaveBeenCalled()
      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession).toBeDefined()
    })

    it('should work when words are already loaded in store', async () => {
      const mockWords = createReviewWordsWithToday()

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession.words).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined words in array', async () => {
      const today = new Date().toISOString().split('T')[0]
      const mockWords = [
        createMockWord({
          word_id: 'word-1',
          next_review_date: today,
        }),
        null,
        undefined,
      ] as any

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession.words).toHaveLength(1)
    })

    it('should handle words with missing next_review_date', async () => {
      const mockWords = [
        createMockWord({
          word_id: 'word-1',
          next_review_date: new Date().toISOString().split('T')[0],
        }),
        { word_id: 'word-2' } as Word,
      ]

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: mockWords,
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession.words).toHaveLength(1)
    })

    it('should handle empty words array', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        words: [],
        reviewSession: null,
        currentWord: null,
        error: null,
      })

      await actions.startReviewSession()

      const setCall = mockSet.mock.calls[1][0]
      expect(setCall.reviewSession).toBeNull()
      expect(setCall.currentWord).toBeNull()
    })
  })
})
