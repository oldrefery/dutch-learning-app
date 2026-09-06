import { isUuid } from '@/features/words/word-detail'
import { isReviewAssessment } from './review-domain'
import type {
  ReviewCorrectionInput,
  ReviewCorrectionAcknowledgement,
} from './correction-contract'

const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const time = Date.parse(value)
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  )
}

export function isReviewCorrectionInput(
  value: unknown
): value is ReviewCorrectionInput {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    ['userId', 'wordId', 'eventId', 'correctionId'].every(
      key => typeof row[key] === 'string' && isUuid(row[key])
    ) &&
    integer(row.expectedRevision) &&
    row.expectedRevision < 2147483647 &&
    typeof row.assessment === 'string' &&
    isReviewAssessment(row.assessment)
  )
}

export function isReviewCorrectionAcknowledgement(
  value: unknown,
  input: ReviewCorrectionInput
): value is ReviewCorrectionAcknowledgement {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    row.correction_id === input.correctionId &&
    row.event_id === input.eventId &&
    row.word_id === input.wordId &&
    row.accepted_revision === input.expectedRevision + 1 &&
    integer(row.effective_revision) &&
    row.effective_revision >= row.accepted_revision &&
    typeof row.effective_assessment === 'string' &&
    isReviewAssessment(row.effective_assessment) &&
    (row.effective_revision > row.accepted_revision ||
      row.effective_assessment === input.assessment) &&
    integer(row.interval_days) &&
    integer(row.repetition_count) &&
    typeof row.easiness_factor === 'number' &&
    Number.isFinite(row.easiness_factor) &&
    row.easiness_factor >= 1.3 &&
    row.easiness_factor <= 2.5 &&
    calendarDate(row.next_review_date) &&
    (row.last_reviewed_at === null ||
      (typeof row.last_reviewed_at === 'string' &&
        Number.isFinite(Date.parse(row.last_reviewed_at))))
  )
}
