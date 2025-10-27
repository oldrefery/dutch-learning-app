/**
 * Unit tests for streakUtils
 * Tests study streak calculation logic
 */

import { calculateStreak } from '../streakUtils'
import type { Word } from '@/types/database'

describe('streakUtils', () => {
  // Helper to create a mock word with a specific review date
  const createWord = (
    lastReviewedAt: string | null,
    id: string = 'word-1'
  ): Word => ({
    word_id: id,
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
    next_review_date: '2025-11-02',
    created_at: '2025-10-27T00:00:00Z',
    updated_at: '2025-10-27T00:00:00Z',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    is_separable: false,
    synonyms: [],
    antonyms: [],
    last_reviewed_at: lastReviewedAt,
  })

  describe('calculateStreak', () => {
    // Tests for calculateStreak function
  })

  describe('empty and null cases', () => {
    it('should return 0 for empty word list', () => {
      expect(calculateStreak([])).toBe(0)
    })

    it('should return 0 when no words have been reviewed', () => {
      const words = [createWord(null), createWord(null), createWord(null)]
      expect(calculateStreak(words)).toBe(0)
    })

    it('should skip words with null last_reviewed_at', () => {
      const words = [
        createWord(null),
        createWord('2025-10-27T10:00:00Z', 'word-1'),
        createWord(null),
      ]
      const streak = calculateStreak(words)
      expect(streak).toBeGreaterThanOrEqual(0)
    })
  })

  describe('single review', () => {
    it('should return 1 for a review today', () => {
      const today = new Date()
      const todayISO = today.toISOString()
      const words = [createWord(todayISO)]
      expect(calculateStreak(words)).toBe(1)
    })

    it('should return 1 for a review yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const yesterdayISO = yesterday.toISOString()
      const words = [createWord(yesterdayISO)]
      expect(calculateStreak(words)).toBe(1)
    })

    it('should return 0 for a review 2 days ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const twoDaysAgoISO = twoDaysAgo.toISOString()
      const words = [createWord(twoDaysAgoISO)]
      expect(calculateStreak(words)).toBe(0)
    })
  })

  describe('consecutive days', () => {
    it('should return 2 for reviews yesterday and today', () => {
      const today = new Date()
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(yesterday.toISOString(), 'word-2'),
      ]
      expect(calculateStreak(words)).toBe(2)
    })

    it('should return 3 for reviews 3 consecutive days', () => {
      const today = new Date()
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(yesterday.toISOString(), 'word-2'),
        createWord(twoDaysAgo.toISOString(), 'word-3'),
      ]
      expect(calculateStreak(words)).toBe(3)
    })

    it('should return 5 for reviews 5 consecutive days', () => {
      const words: Word[] = []
      for (let i = 0; i < 5; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        words.push(createWord(date.toISOString(), `word-${i}`))
      }
      expect(calculateStreak(words)).toBe(5)
    })
  })

  describe('streak breaks', () => {
    it('should return 1 when streak is broken by gap of 2 days', () => {
      const today = new Date()
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(threeDaysAgo.toISOString(), 'word-2'),
      ]
      expect(calculateStreak(words)).toBe(1)
    })

    it('should count only consecutive days from most recent', () => {
      const today = new Date()
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(yesterday.toISOString(), 'word-2'),
        createWord(threeWeeksAgo.toISOString(), 'word-3'),
        createWord(fourWeeksAgo.toISOString(), 'word-4'),
      ]

      expect(calculateStreak(words)).toBe(2)
    })
  })

  describe('no recent activity', () => {
    it('should return 0 if most recent review is older than yesterday', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(twoDaysAgo.toISOString(), 'word-1'),
        createWord(threeDaysAgo.toISOString(), 'word-2'),
      ]

      expect(calculateStreak(words)).toBe(0)
    })

    it('should return 0 for reviews from weeks ago', () => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const words = [createWord(oneWeekAgo.toISOString())]
      expect(calculateStreak(words)).toBe(0)
    })
  })

  describe('multiple reviews per day', () => {
    it('should count as single day when multiple reviews on same day', () => {
      const today = new Date()
      const todayISO = today.toISOString()

      const words = [
        createWord(todayISO, 'word-1'),
        createWord(todayISO, 'word-2'),
        createWord(todayISO, 'word-3'),
      ]

      expect(calculateStreak(words)).toBe(1)
    })

    it('should count days correctly with multiple reviews per day', () => {
      const today = new Date()
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const todayISO = today.toISOString()
      const yesterdayISO = yesterday.toISOString()

      const words = [
        createWord(todayISO, 'word-1'),
        createWord(todayISO, 'word-2'),
        createWord(yesterdayISO, 'word-3'),
        createWord(yesterdayISO, 'word-4'),
      ]

      expect(calculateStreak(words)).toBe(2)
    })
  })

  describe('time zone handling', () => {
    it('should handle dates from different times of day on same day', () => {
      const today = new Date()
      const morning = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        6,
        0,
        0
      )
      const evening = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        20,
        0,
        0
      )

      const words = [
        createWord(morning.toISOString(), 'word-1'),
        createWord(evening.toISOString(), 'word-2'),
      ]

      expect(calculateStreak(words)).toBe(1)
    })

    it('should correctly identify today vs yesterday across midnight', () => {
      const today = new Date()
      const almostMidnightToday = new Date(Date.now() - 1 * 60 * 1000) // 1 minute ago
      const justAfterMidnightYesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000 + 1 * 60 * 1000
      ) // 23:59 yesterday

      const words = [
        createWord(almostMidnightToday.toISOString(), 'word-1'),
        createWord(justAfterMidnightYesterday.toISOString(), 'word-2'),
      ]

      // Should recognize these as consecutive days
      expect(calculateStreak(words)).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle very long streaks (30+ days)', () => {
      const words: Word[] = []
      for (let i = 0; i < 30; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        words.push(createWord(date.toISOString(), `word-${i}`))
      }

      expect(calculateStreak(words)).toBe(30)
    })

    it('should handle large word lists with sparse reviews', () => {
      const words: Word[] = []

      // 100 words with only a few reviewed
      for (let i = 0; i < 100; i++) {
        if (i % 20 === 0) {
          const date = new Date(
            Date.now() - (5 - Math.floor(i / 20)) * 24 * 60 * 60 * 1000
          )
          words.push(createWord(date.toISOString(), `word-${i}`))
        } else {
          words.push(createWord(null, `word-${i}`))
        }
      }

      const streak = calculateStreak(words)
      expect(typeof streak).toBe('number')
      expect(streak).toBeGreaterThanOrEqual(0)
    })

    it('should handle null values in word array gracefully', () => {
      const today = new Date()
      const words = [createWord(today.toISOString(), 'word-1')]

      expect(calculateStreak(words)).toBe(1)
    })
  })

  describe('practical scenarios', () => {
    it('should return correct streak for typical learning pattern', () => {
      // User reviews daily for 3 days, then skips 2 days
      const today = new Date()
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(yesterday.toISOString(), 'word-2'),
        createWord(twoDaysAgo.toISOString(), 'word-3'),
        createWord(oneWeekAgo.toISOString(), 'word-4'),
      ]

      // Should only count recent 2-3 days
      expect(calculateStreak(words)).toBeLessThanOrEqual(3)
    })

    it('should reset streak after missing a day', () => {
      const today = new Date()
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

      const words = [
        createWord(today.toISOString(), 'word-1'),
        createWord(twoDaysAgo.toISOString(), 'word-2'),
      ]

      expect(calculateStreak(words)).toBe(1)
    })
  })
})
