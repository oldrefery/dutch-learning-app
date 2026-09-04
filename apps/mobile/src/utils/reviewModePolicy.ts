import { REVIEW_MODE } from '@/constants/ReviewConstants'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'
import type {
  AdaptiveReviewModeDecision,
  ReviewEvent,
  ReviewMode,
} from '@/types/ReviewTypes'

type ReviewModeEvidence = Pick<
  ReviewEvent,
  | 'event_id'
  | 'assessment'
  | 'review_mode'
  | 'answered_correctly'
  | 'reviewed_at'
>

export const REVIEW_MODE_POLICY = {
  PROMOTION_SUCCESS_COUNT: 3,
  DEMOTION_AGAIN_COUNT: 2,
  DEMOTION_WINDOW_SIZE: 3,
  HISTORY_LIMIT_PER_WORD: 100,
} as const

const MODE_SEQUENCE: readonly ReviewMode[] = [
  REVIEW_MODE.RECOGNITION,
  REVIEW_MODE.MEANING_RECALL,
  REVIEW_MODE.DUTCH_PRODUCTION,
]

const compareEvents = (
  left: ReviewModeEvidence,
  right: ReviewModeEvidence
): number => {
  const timestampComparison = left.reviewed_at.localeCompare(right.reviewed_at)
  return timestampComparison || left.event_id.localeCompare(right.event_id)
}

const isSuccessfulReview = (event: ReviewModeEvidence): boolean => {
  if (event.assessment === SRS_ASSESSMENT.AGAIN) return false

  return event.review_mode !== REVIEW_MODE.RECOGNITION
    ? true
    : event.answered_correctly === true
}

const getAdjacentMode = (
  mode: ReviewMode,
  direction: -1 | 1
): ReviewMode | null => {
  const index = MODE_SEQUENCE.indexOf(mode)
  return MODE_SEQUENCE[index + direction] ?? null
}

export const resolveAdaptiveReviewMode = (
  events: readonly ReviewModeEvidence[]
): AdaptiveReviewModeDecision => {
  let mode: ReviewMode = REVIEW_MODE.RECOGNITION
  let decision: AdaptiveReviewModeDecision = {
    mode,
    reason: 'default',
    previousMode: null,
  }
  let currentModeWindow: ReviewModeEvidence[] = []

  for (const event of [...events].sort(compareEvents)) {
    if (event.review_mode !== mode) continue

    currentModeWindow = [
      ...currentModeWindow.slice(
        -(REVIEW_MODE_POLICY.DEMOTION_WINDOW_SIZE - 1)
      ),
      event,
    ]

    const againCount = currentModeWindow.filter(
      item => item.assessment === SRS_ASSESSMENT.AGAIN
    ).length
    const lowerMode = getAdjacentMode(mode, -1)

    if (
      lowerMode &&
      currentModeWindow.length === REVIEW_MODE_POLICY.DEMOTION_WINDOW_SIZE &&
      againCount >= REVIEW_MODE_POLICY.DEMOTION_AGAIN_COUNT
    ) {
      const previousMode = mode
      mode = lowerMode
      decision = { mode, reason: 'demotion', previousMode }
      currentModeWindow = []
      continue
    }

    const higherMode = getAdjacentMode(mode, 1)
    if (
      higherMode &&
      currentModeWindow.length === REVIEW_MODE_POLICY.PROMOTION_SUCCESS_COUNT &&
      currentModeWindow.every(isSuccessfulReview)
    ) {
      const previousMode = mode
      mode = higherMode
      decision = { mode, reason: 'promotion', previousMode }
      currentModeWindow = []
    }
  }

  return decision
}

const MODE_LABELS: Record<ReviewMode, string> = {
  [REVIEW_MODE.RECOGNITION]: 'Recognition',
  [REVIEW_MODE.MEANING_RECALL]: 'Meaning Recall',
  [REVIEW_MODE.DUTCH_PRODUCTION]: 'Dutch Production',
}

export const getAdaptiveReviewModeExplanation = (
  decision: AdaptiveReviewModeDecision
): string => {
  const currentLabel = MODE_LABELS[decision.mode]

  if (decision.reason === 'promotion' && decision.previousMode) {
    return `Adaptive: advanced from ${MODE_LABELS[decision.previousMode]} to ${currentLabel} after three successful reviews.`
  }

  if (decision.reason === 'demotion' && decision.previousMode) {
    return `Adaptive: moved from ${MODE_LABELS[decision.previousMode]} to ${currentLabel} after two Again ratings in three reviews.`
  }

  return 'Adaptive: starting with Recognition until three successful reviews are recorded.'
}
