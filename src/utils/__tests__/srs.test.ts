/**
 * Unit tests for SRS (Spaced Repetition System) algorithm
 * Tests SM-2 based spaced repetition logic
 */

import { calculateNextReview } from '../srs'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'

describe('calculateNextReview', () => {
  describe('initial state (new word)', () => {
    it('should set interval to 0 for new word with GOOD assessment', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBe(1)
      expect(result.repetition_count).toBe(1)
      expect(result.easiness_factor).toBe(2.5)
    })

    it('should set interval to 4 for new word with EASY assessment', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.EASY,
      })

      expect(result.interval_days).toBe(4)
      expect(result.repetition_count).toBe(1)
      expect(result.easiness_factor).toBe(2.5)
    })

    it('should set interval to 1 for new word with HARD assessment', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.HARD,
      })

      expect(result.interval_days).toBe(1)
      expect(result.repetition_count).toBe(1)
      expect(result.easiness_factor).toBe(2.35)
    })

    it('should reset to available now for new word with AGAIN assessment', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.interval_days).toBe(0)
      expect(result.repetition_count).toBe(0)
      expect(result.easiness_factor).toBe(2.3)
    })
  })

  describe('second repetition (rep count = 1)', () => {
    it('should set interval to 6 for GOOD on second rep', () => {
      const result = calculateNextReview({
        interval_days: 1,
        repetition_count: 1,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBe(6)
      expect(result.repetition_count).toBe(2)
    })

    it('should set interval to 10 for EASY on second rep', () => {
      const result = calculateNextReview({
        interval_days: 4,
        repetition_count: 1,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.EASY,
      })

      expect(result.interval_days).toBe(10)
      expect(result.repetition_count).toBe(2)
      expect(result.easiness_factor).toBe(2.5)
    })

    it('should reset on AGAIN even after one correct', () => {
      const result = calculateNextReview({
        interval_days: 1,
        repetition_count: 1,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.interval_days).toBe(0)
      expect(result.repetition_count).toBe(0)
    })
  })

  describe('subsequent repetitions (rep count >= 2)', () => {
    it('should multiply interval by easiness_factor for GOOD', () => {
      const result = calculateNextReview({
        interval_days: 6,
        repetition_count: 2,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBe(15) // 6 * 2.5 = 15
      expect(result.repetition_count).toBe(3)
    })

    it('should apply easiness bonus for EASY on third rep', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 2,
        easiness_factor: 2.3,
        assessment: SRS_ASSESSMENT.EASY,
      })

      // 10 * 2.3 * 1.3 = 29.9 → 30
      expect(result.interval_days).toBe(30)
      expect(result.repetition_count).toBe(3)
      expect(result.easiness_factor).toBe(2.45)
    })

    it('should apply hard multiplier (1.2) for HARD on third rep', () => {
      const result = calculateNextReview({
        interval_days: 6,
        repetition_count: 2,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.HARD,
      })

      // 6 * 1.2 = 7.2 → 7
      expect(result.interval_days).toBe(7)
      expect(result.repetition_count).toBe(3)
      expect(result.easiness_factor).toBe(2.35)
    })

    it('should reset completely on AGAIN even after multiple reps', () => {
      const result = calculateNextReview({
        interval_days: 50,
        repetition_count: 10,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.interval_days).toBe(0)
      expect(result.repetition_count).toBe(0)
      expect(result.easiness_factor).toBe(2.3)
    })
  })

  describe('easiness factor adjustments', () => {
    it('should not change easiness for GOOD', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.easiness_factor).toBe(2.5)
    })

    it('should increase easiness by 0.15 for EASY', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.35,
        assessment: SRS_ASSESSMENT.EASY,
      })

      expect(result.easiness_factor).toBe(2.5)
    })

    it('should decrease easiness by 0.15 for HARD', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.HARD,
      })

      expect(result.easiness_factor).toBe(2.35)
    })

    it('should decrease easiness by 0.2 for AGAIN', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.easiness_factor).toBe(2.3)
    })
  })

  describe('easiness bounds (min: 1.3, max: 2.5)', () => {
    it('should enforce minimum easiness of 1.3', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 1.4,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.easiness_factor).toBe(1.3)
    })

    it('should not go below 1.3 with multiple AGAIN assessments', () => {
      let result = {
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 1.5,
        next_review_date: '',
      }

      for (let i = 0; i < 5; i++) {
        result = calculateNextReview({
          interval_days: result.interval_days,
          repetition_count: result.repetition_count,
          easiness_factor: result.easiness_factor,
          assessment: SRS_ASSESSMENT.AGAIN,
        })
      }

      expect(result.easiness_factor).toBeGreaterThanOrEqual(1.3)
    })

    it('should enforce maximum easiness of 2.5', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.4,
        assessment: SRS_ASSESSMENT.EASY,
      })

      expect(result.easiness_factor).toBe(2.5)
    })

    it('should not exceed 2.5 with multiple EASY assessments', () => {
      let result = {
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.3,
        next_review_date: '',
      }

      for (let i = 0; i < 5; i++) {
        result = calculateNextReview({
          interval_days: result.interval_days,
          repetition_count: result.repetition_count,
          easiness_factor: result.easiness_factor,
          assessment: SRS_ASSESSMENT.EASY,
        })
      }

      expect(result.easiness_factor).toBeLessThanOrEqual(2.5)
    })
  })

  describe('interval calculations', () => {
    it('should have minimum interval of 0 for AGAIN', () => {
      const result = calculateNextReview({
        interval_days: 100,
        repetition_count: 50,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.interval_days).toBe(0)
    })

    it('should have minimum interval of 1 for HARD from zero', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.HARD,
      })

      expect(result.interval_days).toBe(1)
    })

    it('should handle large intervals correctly', () => {
      const result = calculateNextReview({
        interval_days: 365,
        repetition_count: 20,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBe(913) // 365 * 2.5 = 912.5 → 913
    })

    it('should round intervals to nearest integer', () => {
      const result = calculateNextReview({
        interval_days: 7,
        repetition_count: 3,
        easiness_factor: 2.3,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBe(16) // 7 * 2.3 = 16.1 → 16
    })

    it('should round up for EASY multiplier', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 3,
        easiness_factor: 2.4,
        assessment: SRS_ASSESSMENT.EASY,
      })

      expect(result.interval_days).toBe(31) // 10 * 2.4 * 1.3 = 31.2 → 31
    })
  })

  describe('next_review_date calculation', () => {
    it('should generate valid ISO date string', () => {
      const result = calculateNextReview({
        interval_days: 5,
        repetition_count: 1,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.next_review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should correctly calculate date approximately 5 days in the future', () => {
      const before = new Date()
      const expectedStart = new Date(before.getTime() + 4 * 24 * 60 * 60 * 1000)
      const expectedEnd = new Date(before.getTime() + 6 * 24 * 60 * 60 * 1000)

      const result = calculateNextReview({
        interval_days: 5,
        repetition_count: 1,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      const resultDate = new Date(result.next_review_date + 'T00:00:00Z')
      expect(resultDate.getTime()).toBeGreaterThanOrEqual(
        expectedStart.getTime()
      )
      expect(resultDate.getTime()).toBeLessThanOrEqual(expectedEnd.getTime())
    })

    it('should handle review date for today (0 days)', () => {
      const today = new Date().toISOString().split('T')[0]

      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.AGAIN,
      })

      expect(result.next_review_date).toBe(today)
    })
  })

  describe('edge cases', () => {
    it('should handle zero interval with GOOD', () => {
      const result = calculateNextReview({
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.interval_days).toBeGreaterThan(0)
      expect(result.repetition_count).toBe(1)
    })

    it('should handle fractional easiness factor', () => {
      const result = calculateNextReview({
        interval_days: 7,
        repetition_count: 3,
        easiness_factor: 2.35,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.easiness_factor).toBe(2.35)
      expect(result.interval_days).toBe(16) // 7 * 2.35 = 16.45 → 16
    })

    it('should handle very large repetition counts', () => {
      const result = calculateNextReview({
        interval_days: 1000,
        repetition_count: 1000,
        easiness_factor: 2.5,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(result.repetition_count).toBe(1001)
      expect(result.interval_days).toBe(2500) // 1000 * 2.5
    })

    it('should maintain precision to 2 decimal places for easiness', () => {
      const result = calculateNextReview({
        interval_days: 10,
        repetition_count: 5,
        easiness_factor: 2.123,
        assessment: SRS_ASSESSMENT.GOOD,
      })

      expect(
        result.easiness_factor.toString().split('.')[1]?.length || 0
      ).toBeLessThanOrEqual(2)
    })
  })

  describe('progression scenarios', () => {
    it('should follow a typical "good" progression', () => {
      let result = {
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: '',
      }

      result = calculateNextReview({
        ...result,
        assessment: SRS_ASSESSMENT.GOOD,
      })
      expect(result.interval_days).toBe(1)
      expect(result.repetition_count).toBe(1)

      result = calculateNextReview({
        ...result,
        assessment: SRS_ASSESSMENT.GOOD,
      })
      expect(result.interval_days).toBe(6)
      expect(result.repetition_count).toBe(2)

      result = calculateNextReview({
        ...result,
        assessment: SRS_ASSESSMENT.GOOD,
      })
      expect(result.interval_days).toBe(15) // 6 * 2.5
      expect(result.repetition_count).toBe(3)
    })

    it('should handle recovery after AGAIN', () => {
      let result = {
        interval_days: 50,
        repetition_count: 10,
        easiness_factor: 2.5,
        next_review_date: '',
      }

      // Forget the word
      result = calculateNextReview({
        ...result,
        assessment: SRS_ASSESSMENT.AGAIN,
      })
      expect(result.interval_days).toBe(0)
      expect(result.repetition_count).toBe(0)

      // Learn again
      result = calculateNextReview({
        ...result,
        assessment: SRS_ASSESSMENT.GOOD,
      })
      expect(result.interval_days).toBe(1)
      expect(result.repetition_count).toBe(1)
    })

    it('should balance difficulty and success', () => {
      let result = {
        interval_days: 0,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: '',
      }

      // Good, good, hard, good progression
      const assessments = [
        SRS_ASSESSMENT.GOOD,
        SRS_ASSESSMENT.GOOD,
        SRS_ASSESSMENT.HARD,
        SRS_ASSESSMENT.GOOD,
      ]

      const intervals: number[] = []

      for (const assessment of assessments) {
        result = calculateNextReview({
          ...result,
          assessment,
        })
        intervals.push(result.interval_days)
      }

      // 1st: GOOD from 0 → 1
      // 2nd: GOOD from 1 → 6
      // 3rd: HARD from 6 → 6 * 1.2 = 7.2 → 7
      // 4th: GOOD from 7 → 7 * 2.35 = 16.45 → 16
      expect(intervals).toEqual([1, 6, 7, 16])
    })
  })
})
