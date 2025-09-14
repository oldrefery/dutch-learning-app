/**
 * Spaced Repetition System (SRS) algorithm based on SM-2
 *
 * This implements a simplified version of the SuperMemo SM-2 algorithm
 * for optimal spacing of flashcard reviews.
 */
import { SRSAssessment, SRSResult } from '@/types/database'

interface SRSInput {
  interval_days: number
  repetition_count: number
  easiness_factor: number
  assessment: SRSAssessment
}

export function calculateNextReview({
  interval_days,
  repetition_count,
  easiness_factor,
  assessment,
}: SRSInput): SRSResult {
  let newEasinessFactor = easiness_factor
  let newRepetitionCount = repetition_count
  let newInterval = interval_days

  // Adjust easiness factor based on assessment
  switch (assessment) {
    case 'again':
      // Reset card to beginning, reduce the easiness factor significantly
      newEasinessFactor = Math.max(1.3, easiness_factor - 0.2)
      newRepetitionCount = 0
      newInterval = 0 // Available today (will show on restart)
      break

    case 'hard':
      // Reduce an easiness factor, small interval increase
      newEasinessFactor = Math.max(1.3, easiness_factor - 0.15)
      newRepetitionCount = repetition_count + 1
      newInterval = Math.max(1, Math.round(interval_days * 1.2)) // 20% increase
      break

    case 'good':
      // Standard progression
      newEasinessFactor = easiness_factor
      newRepetitionCount = repetition_count + 1

      if (newRepetitionCount === 1) {
        newInterval = 1
      } else if (newRepetitionCount === 2) {
        newInterval = 6
      } else {
        newInterval = Math.round(interval_days * easiness_factor)
      }
      break

    case 'easy':
      // Increase easiness factor, speed up an interval
      newEasinessFactor = Math.min(2.5, easiness_factor + 0.15)
      newRepetitionCount = repetition_count + 1

      if (newRepetitionCount === 1) {
        newInterval = 4
      } else if (newRepetitionCount === 2) {
        newInterval = 10
      } else {
        newInterval = Math.round(interval_days * easiness_factor * 1.3)
      }
      break
  }

  // Calculate the next review date
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

  return {
    interval_days: newInterval,
    repetition_count: newRepetitionCount,
    easiness_factor: Number(newEasinessFactor.toFixed(2)),
    next_review_date: nextReviewDate.toISOString().split('T')[0],
  }
}
