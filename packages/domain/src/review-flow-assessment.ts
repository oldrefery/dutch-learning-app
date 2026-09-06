import type { SRSAssessmentType } from './srs'
import type { ReviewFlowState, ReviewFlowActive } from './review-flow.types'

function editable<T>(
  state: ReviewFlowState<T>,
  questionId: string
): ReviewFlowActive<T> | null {
  if (state.closed || !state.foreground || state.view.kind === 'history')
    return null
  return state.active?.question.id === questionId ? state.active : null
}

export function selectReviewOption<T>(
  state: ReviewFlowState<T>,
  questionId: string,
  optionId: string,
  now: number
): ReviewFlowState<T> {
  const active = editable(state, questionId)
  if (
    !active ||
    state.view.kind !== 'current' ||
    active.question.mode !== 'recognition' ||
    active.answeredAt !== null ||
    active.assisted ||
    active.submission ||
    !Number.isFinite(now)
  )
    return state
  const option = active.question.options.find(
    candidate => candidate.id === optionId
  )
  if (!option) return state
  return {
    ...state,
    view: option.isCorrect ? state.view : { kind: 'details' },
    active: {
      ...active,
      selectedOptionId: option.id,
      answeredCorrectly: option.isCorrect,
      revealed: true,
      answeredAt: Math.max(active.startedAt, now),
    },
  }
}

export function revealReviewAnswer<T>(
  state: ReviewFlowState<T>,
  questionId: string,
  now: number
): ReviewFlowState<T> {
  const active = editable(state, questionId)
  if (
    !active ||
    active.question.mode === 'recognition' ||
    active.answeredAt !== null ||
    active.assisted ||
    active.submission ||
    !Number.isFinite(now)
  )
    return state
  return {
    ...state,
    active: {
      ...active,
      revealed: true,
      answeredAt: Math.max(active.startedAt, now),
    },
  }
}

export function getAutomaticReviewAssessment<T>(
  state: ReviewFlowState<T>
): 'good' | null {
  const active = state.active
  if (
    state.closed ||
    !state.foreground ||
    state.view.kind !== 'current' ||
    !active ||
    active.question.mode !== 'recognition' ||
    active.manualRecognition ||
    active.autoPaused ||
    active.assisted ||
    active.answeredCorrectly !== true ||
    active.submission
  )
    return null
  return 'good'
}

export function getAllowedReviewAssessments<T>(
  state: ReviewFlowState<T>
): readonly SRSAssessmentType[] {
  const active = state.active
  if (!active || !editable(state, active.question.id)) return []
  if (active.submission)
    return active.submission.status === 'failed'
      ? [active.submission.assessment]
      : []
  if (active.assisted) return ['again']
  if (active.answeredAt === null) return []
  if (active.answeredCorrectly === false) return ['again']
  return ['again', 'hard', 'good', 'easy']
}

/** Only a changed state authorizes the adapter to persist a command. */
export function beginReviewSubmission<T>(
  state: ReviewFlowState<T>,
  questionId: string,
  eventId: string,
  assessment: SRSAssessmentType
): ReviewFlowState<T> {
  const active = editable(state, questionId)
  if (
    !active ||
    !eventId ||
    !getAllowedReviewAssessments(state).includes(assessment)
  )
    return state
  if (active.submission && active.submission.eventId !== eventId) return state
  if (
    state.history.some(
      entry =>
        entry.result.kind === 'assessed' && entry.result.eventId === eventId
    )
  )
    return state
  return {
    ...state,
    active: {
      ...active,
      submission: { eventId, assessment, status: 'saving', error: null },
    },
  }
}

/** Saved means server confirmation on web, durable local commit on mobile. */
export function settleReviewSubmission<T>(
  state: ReviewFlowState<T>,
  sessionId: string,
  eventId: string,
  result: { status: 'saved' } | { status: 'failed'; error: string }
): ReviewFlowState<T> {
  const active = state.active
  if (
    state.closed ||
    state.sessionId !== sessionId ||
    !active?.submission ||
    active.submission.eventId !== eventId ||
    active.submission.status === 'saved'
  )
    return state
  // A late failure must not undo a confirmed save; a late success may reconcile a retry.
  return {
    ...state,
    active: {
      ...active,
      submission: {
        ...active.submission,
        status: result.status,
        error: result.status === 'failed' ? result.error : null,
      },
    },
  }
}

/** Apply confirmed effective ledger results only, never optimistic corrections. */
export function reconcileReviewHistory<T>(
  state: ReviewFlowState<T>,
  eventId: string,
  revision: number,
  assessment: SRSAssessmentType
): ReviewFlowState<T> {
  if (state.closed || !Number.isSafeInteger(revision) || revision < 1)
    return state
  const index = state.history.findIndex(
    entry =>
      entry.result.kind === 'assessed' &&
      entry.result.eventId === eventId &&
      entry.result.revision < revision
  )
  if (index < 0) return state
  const entry = state.history[index]
  if (entry.result.kind !== 'assessed') return state
  const history = [...state.history]
  history[index] = {
    ...entry,
    result: { ...entry.result, assessment, revision },
  }
  return { ...state, history }
}

export function summarizeReviewFlow<T>(state: ReviewFlowState<T>) {
  const counts: Record<SRSAssessmentType, number> = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  }
  let skipped = 0
  for (const entry of state.history) {
    if (entry.result.kind === 'skipped') skipped += 1
    else counts[entry.result.assessment] += 1
  }
  if (state.active?.submission?.status === 'saved')
    counts[state.active.submission.assessment] += 1
  const assessed = Object.values(counts).reduce(
    (total, count) => total + count,
    0
  )
  return {
    counts,
    assessed,
    skipped,
    completed: assessed + skipped,
    finished: !state.closed && !state.active && state.remaining.length === 0,
  }
}
