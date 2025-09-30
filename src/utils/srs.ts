/**
 * Spaced Repetition System (SRS) algorithm based on SM-2
 *
 * This implements a simplified version of the SuperMemo SM-2 algorithm
 * for optimal spacing of flashcard reviews.
 */
import { SRSAssessment, SRSResult } from '@/types/database'
import { SRS_ASSESSMENT, SRS_PARAMS } from '@/constants/SRSConstants'

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
    case SRS_ASSESSMENT.AGAIN:
      // Reset card to beginning, reduce the easiness factor significantly
      newEasinessFactor = Math.max(
        SRS_PARAMS.EASINESS_BOUNDS.MIN,
        easiness_factor + SRS_PARAMS.EASINESS_ADJUSTMENT.AGAIN
      )
      newRepetitionCount = 0
      newInterval = SRS_PARAMS.INITIAL.INTERVAL_DAYS // Available today
      break

    case SRS_ASSESSMENT.HARD:
      // Reduce the easiness factor, small interval increase
      newEasinessFactor = Math.max(
        SRS_PARAMS.EASINESS_BOUNDS.MIN,
        easiness_factor + SRS_PARAMS.EASINESS_ADJUSTMENT.HARD
      )
      newRepetitionCount = repetition_count + 1
      // Special case: if an interval is 0 (new word or after "again"), set to 1
      // Otherwise increase by 20% with a minimum of 1 day
      newInterval =
        interval_days === 0
          ? 1
          : Math.max(1, Math.round(interval_days * SRS_PARAMS.MULTIPLIERS.HARD))
      break

    case SRS_ASSESSMENT.GOOD:
      // Standard progression
      newEasinessFactor = easiness_factor + SRS_PARAMS.EASINESS_ADJUSTMENT.GOOD
      newRepetitionCount = repetition_count + 1

      if (newRepetitionCount === 1) {
        newInterval = SRS_PARAMS.FIRST_INTERVALS.GOOD.FIRST
      } else if (newRepetitionCount === 2) {
        newInterval = SRS_PARAMS.FIRST_INTERVALS.GOOD.SECOND
      } else {
        newInterval = Math.round(interval_days * easiness_factor)
      }

      break

    case SRS_ASSESSMENT.EASY:
      // Increase easiness factor, speed up progression
      newEasinessFactor = Math.min(
        SRS_PARAMS.EASINESS_BOUNDS.MAX,
        easiness_factor + SRS_PARAMS.EASINESS_ADJUSTMENT.EASY
      )
      newRepetitionCount = repetition_count + 1

      if (newRepetitionCount === 1) {
        newInterval = SRS_PARAMS.FIRST_INTERVALS.EASY.FIRST
      } else if (newRepetitionCount === 2) {
        newInterval = SRS_PARAMS.FIRST_INTERVALS.EASY.SECOND
      } else {
        newInterval = Math.round(
          interval_days * easiness_factor * SRS_PARAMS.MULTIPLIERS.EASY
        )
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
