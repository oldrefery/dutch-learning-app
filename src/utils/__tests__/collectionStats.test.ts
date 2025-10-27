/**
 * Unit tests for collectionStats
 * Tests collection statistics calculation
 */

import { calculateCollectionStats } from '../collectionStats'
import type { Word } from '@/types/database'

describe('collectionStats', () => {
  // Helper to create mock Word
  const createMockWord = (overrides: Partial<Word> = {}): Word => ({
    word_id: 'word-1',
    user_id: 'user-1',
    collection_id: 'collection-1',
    dutch_lemma: 'test',
    dutch_original: 'test',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['test'] },
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2025-10-27T00:00:00Z',
    updated_at: '2025-10-27T00:00:00Z',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: [],
    antonyms: [],
    last_reviewed_at: null,
    ...overrides,
  })

  describe('calculateCollectionStats', () => {
    it('should return zero stats for empty collection', () => {
      const stats = calculateCollectionStats([])

      expect(stats).toEqual({
        totalWords: 0,
        masteredWords: 0,
        wordsToReview: 0,
        progressPercentage: 0,
      })
    })

    it('should count total words correctly', () => {
      const words = [
        createMockWord({ word_id: 'word-1' }),
        createMockWord({ word_id: 'word-2' }),
        createMockWord({ word_id: 'word-3' }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(3)
    })

    it('should identify mastered words (repetition_count > 2)', () => {
      const words = [
        createMockWord({ repetition_count: 0 }),
        createMockWord({ repetition_count: 1 }),
        createMockWord({ repetition_count: 2 }),
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 5 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.masteredWords).toBe(2) // Only those with repetition_count > 2
    })

    it('should count words needing review', () => {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const words = [
        createMockWord({ next_review_date: yesterday.toISOString() }), // Due today
        createMockWord({ next_review_date: now.toISOString() }), // Due today
        createMockWord({ next_review_date: tomorrow.toISOString() }), // Due later
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.wordsToReview).toBe(2)
    })

    it('should calculate progress percentage correctly', () => {
      const words = [
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 0 }),
        createMockWord({ repetition_count: 0 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.progressPercentage).toBe(50) // 2 mastered out of 4
    })

    it('should round progress percentage correctly', () => {
      const words = [
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 0 }),
        createMockWord({ repetition_count: 0 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.progressPercentage).toBe(33) // 1/3 = 0.333... = 33%
    })

    it('should return 100% progress when all words mastered', () => {
      const words = [
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 5 }),
        createMockWord({ repetition_count: 10 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.progressPercentage).toBe(100)
    })

    it('should return 0% progress when no words mastered', () => {
      const words = [
        createMockWord({ repetition_count: 0 }),
        createMockWord({ repetition_count: 1 }),
        createMockWord({ repetition_count: 2 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.progressPercentage).toBe(0)
    })

    it('should handle boundary case of repetition_count = 2', () => {
      const words = [createMockWord({ repetition_count: 2 })]

      const stats = calculateCollectionStats(words)

      expect(stats.masteredWords).toBe(0) // 2 is not > 2
    })

    it('should handle boundary case of repetition_count = 3', () => {
      const words = [createMockWord({ repetition_count: 3 })]

      const stats = calculateCollectionStats(words)

      expect(stats.masteredWords).toBe(1) // 3 > 2
    })

    it('should not count words with null/undefined repetition_count', () => {
      const words = [
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: null as unknown as number }),
        createMockWord({ repetition_count: undefined as unknown as number }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.masteredWords).toBe(1)
    })

    it('should not count words with null review date in wordsToReview', () => {
      const words = [
        createMockWord({ next_review_date: null as unknown as string }),
        createMockWord({
          next_review_date: new Date(
            Date.now() - 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.wordsToReview).toBe(1)
    })

    it('should return complete stats object', () => {
      const words = [createMockWord()]
      const stats = calculateCollectionStats(words)

      expect(stats).toHaveProperty('totalWords')
      expect(stats).toHaveProperty('masteredWords')
      expect(stats).toHaveProperty('wordsToReview')
      expect(stats).toHaveProperty('progressPercentage')
    })

    it('should have correct types for stats properties', () => {
      const stats = calculateCollectionStats([])

      expect(typeof stats.totalWords).toBe('number')
      expect(typeof stats.masteredWords).toBe('number')
      expect(typeof stats.wordsToReview).toBe('number')
      expect(typeof stats.progressPercentage).toBe('number')
    })
  })

  describe('edge cases', () => {
    it('should handle large collections efficiently', () => {
      const words: Word[] = []
      for (let i = 0; i < 10000; i++) {
        words.push(
          createMockWord({
            word_id: `word-${i}`,
            repetition_count: i % 5,
          })
        )
      }

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(10000)
      expect(typeof stats.masteredWords).toBe('number')
      expect(typeof stats.progressPercentage).toBe('number')
    })

    it('should handle words with missing properties gracefully', () => {
      const words = [
        createMockWord({ repetition_count: undefined as unknown as number }),
        createMockWord({ next_review_date: undefined as unknown as string }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(2)
      expect(stats.masteredWords).toBe(0)
      expect(stats.wordsToReview).toBe(0)
    })

    it('should use current time for review date comparison', () => {
      const now = new Date()

      // Word due exactly now
      const exactNow = createMockWord({
        next_review_date: now.toISOString(),
      })

      // Word due 1 second ago
      const oneSecondAgo = createMockWord({
        next_review_date: new Date(now.getTime() - 1000).toISOString(),
      })

      // Word due 1 second from now
      const oneSecondLater = createMockWord({
        next_review_date: new Date(now.getTime() + 1000).toISOString(),
      })

      const stats = calculateCollectionStats([
        exactNow,
        oneSecondAgo,
        oneSecondLater,
      ])

      // Should count as due if <= current time
      expect(stats.wordsToReview).toBeGreaterThanOrEqual(2)
    })

    it('should handle mixed valid and invalid words', () => {
      const words = [
        createMockWord({ repetition_count: 5 }),
        createMockWord({ repetition_count: 0 }),
        createMockWord({ repetition_count: null as unknown as number }),
        createMockWord(),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(4)
      expect(stats.masteredWords).toBeGreaterThan(0)
    })
  })

  describe('realistic scenarios', () => {
    it('should calculate stats for beginner collection', () => {
      const words = Array.from({ length: 10 }, (_, i) =>
        createMockWord({
          word_id: `word-${i}`,
          repetition_count: 0,
        })
      )

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(10)
      expect(stats.masteredWords).toBe(0)
      expect(stats.progressPercentage).toBe(0)
    })

    it('should calculate stats for partially learned collection', () => {
      const words = [
        ...Array.from({ length: 5 }, (_, i) =>
          createMockWord({
            word_id: `word-${i}`,
            repetition_count: 3,
          })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          createMockWord({
            word_id: `word-${i + 5}`,
            repetition_count: 0,
          })
        ),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(10)
      expect(stats.masteredWords).toBe(5)
      expect(stats.progressPercentage).toBe(50)
    })

    it('should calculate stats for fully mastered collection', () => {
      const words = Array.from({ length: 20 }, (_, i) =>
        createMockWord({
          word_id: `word-${i}`,
          repetition_count: 10,
        })
      )

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(20)
      expect(stats.masteredWords).toBe(20)
      expect(stats.progressPercentage).toBe(100)
    })

    it('should calculate stats with words due for review', () => {
      const overdue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      const words = [
        createMockWord({
          word_id: 'word-1',
          repetition_count: 3,
          next_review_date: overdue.toISOString(),
        }),
        createMockWord({
          word_id: 'word-2',
          repetition_count: 3,
          next_review_date: future.toISOString(),
        }),
        createMockWord({
          word_id: 'word-3',
          repetition_count: 0,
          next_review_date: overdue.toISOString(),
        }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.totalWords).toBe(3)
      expect(stats.masteredWords).toBe(2)
      expect(stats.wordsToReview).toBe(2) // 2 words are overdue
    })
  })

  describe('stats consistency', () => {
    it('should have mastered words <= total words', () => {
      const words = [
        createMockWord({ repetition_count: 5 }),
        createMockWord({ repetition_count: 2 }),
        createMockWord({ repetition_count: 0 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.masteredWords).toBeLessThanOrEqual(stats.totalWords)
    })

    it('should have words to review <= total words', () => {
      const words = [createMockWord(), createMockWord(), createMockWord()]

      const stats = calculateCollectionStats(words)

      expect(stats.wordsToReview).toBeLessThanOrEqual(stats.totalWords)
    })

    it('should have progress percentage between 0 and 100', () => {
      const words = [
        createMockWord({ repetition_count: 5 }),
        createMockWord({ repetition_count: 1 }),
      ]

      const stats = calculateCollectionStats(words)

      expect(stats.progressPercentage).toBeGreaterThanOrEqual(0)
      expect(stats.progressPercentage).toBeLessThanOrEqual(100)
    })

    it('should maintain consistency across multiple calls', () => {
      const words = [
        createMockWord({ repetition_count: 3 }),
        createMockWord({ repetition_count: 0 }),
      ]

      const stats1 = calculateCollectionStats(words)
      const stats2 = calculateCollectionStats(words)

      expect(stats1).toEqual(stats2)
    })
  })
})
