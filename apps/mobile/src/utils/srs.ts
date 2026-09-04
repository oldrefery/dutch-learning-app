/**
 * Spaced Repetition System (SRS) algorithm based on SM-2
 *
 * This implements a simplified version of the SuperMemo SM-2 algorithm
 * for optimal spacing of flashcard reviews.
 */
import { SRSAssessment, SRSResult } from '@/types/database'
import {
  addLocalCalendarDays,
  calculateSRSProgress,
  toLocalDateKey,
} from '@woordenaar/domain'

interface SRSInput {
  interval_days: number
  repetition_count: number
  easiness_factor: number
  assessment: SRSAssessment
}

export function calculateNextReview(
  { interval_days, repetition_count, easiness_factor, assessment }: SRSInput,
  referenceDate: Date = new Date()
): SRSResult {
  const next = calculateSRSProgress(
    {
      easinessFactor: easiness_factor,
      intervalDays: interval_days,
      repetitionCount: repetition_count,
    },
    assessment
  )

  return {
    interval_days: next.intervalDays,
    repetition_count: next.repetitionCount,
    easiness_factor: next.easinessFactor,
    next_review_date: toLocalDateKey(
      addLocalCalendarDays(referenceDate, next.intervalDays)
    ),
  }
}
