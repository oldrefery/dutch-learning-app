import type { Word } from '@/types/database'

/** Raw learning rows must not replace materialized content or current placement. */
export function mergeReviewLearningProgress(
  displayed: Word,
  persisted: Word
): Word {
  return {
    ...displayed,
    interval_days: persisted.interval_days,
    repetition_count: persisted.repetition_count,
    easiness_factor: persisted.easiness_factor,
    next_review_date: persisted.next_review_date,
    last_reviewed_at: persisted.last_reviewed_at,
    updated_at: persisted.updated_at,
  }
}
