import type {
  ReviewFlowActive,
  ReviewFlowQuestion,
  ReviewFlowState,
  ReviewFlowResult,
  ReviewAutoAdvanceTicket,
} from './review-flow.types'

export const RECOGNITION_FEEDBACK_MS = 600

function activate<T>(
  question: ReviewFlowQuestion<T>,
  manualRecognition: boolean,
  now: number
): ReviewFlowActive<T> {
  return {
    question,
    manualRecognition,
    startedAt: now,
    answeredAt: null,
    selectedOptionId: null,
    answeredCorrectly: null,
    revealed: false,
    assisted: false,
    autoPaused: false,
    submission: null,
  }
}

export function createReviewFlow<T>(input: {
  sessionId: string
  userId: string
  questions: readonly ReviewFlowQuestion<T>[]
  now: number
  manualRecognition?: boolean
}): ReviewFlowState<T> {
  if (!input.sessionId || !input.userId || !Number.isFinite(input.now))
    throw new Error('Invalid review session identity or time')
  const ids = new Set<string>()
  const questions = input.questions.map(question => {
    if (!question.id || !question.wordId || ids.has(question.id))
      throw new Error('Invalid or duplicate review question identity')
    ids.add(question.id)
    if (
      question.mode === 'recognition' &&
      (question.options.length < 2 ||
        question.options.filter(option => option.isCorrect).length !== 1 ||
        new Set(question.options.map(option => option.id)).size !==
          question.options.length ||
        question.options.some(option => !option.id))
    )
      throw new Error('Invalid recognition options')
    return {
      ...question,
      options: question.options.map(option => ({ ...option })),
    }
  })
  const manual = input.manualRecognition ?? false
  return {
    sessionId: input.sessionId,
    userId: input.userId,
    active: questions[0] ? activate(questions[0], manual, input.now) : null,
    remaining: questions.slice(1),
    history: [],
    view: { kind: 'current' },
    manualRecognition: manual,
    foreground: true,
    closed: false,
    timerRevision: 0,
  }
}

function advance<T>(
  state: ReviewFlowState<T>,
  result: ReviewFlowResult,
  now: number
): ReviewFlowState<T> {
  if (!state.active || !Number.isFinite(now)) return state
  return {
    ...state,
    history: [...state.history, { question: state.active, result }],
    active: state.remaining[0]
      ? activate(state.remaining[0], state.manualRecognition, now)
      : null,
    remaining: state.remaining.slice(1),
    view: { kind: 'current' },
    timerRevision: state.timerRevision + 1,
  }
}

export function continueReviewFlow<T>(
  state: ReviewFlowState<T>,
  questionId: string,
  now: number
): ReviewFlowState<T> {
  const active = state.active
  if (
    state.closed ||
    !state.foreground ||
    state.view.kind === 'history' ||
    active?.question.id !== questionId ||
    active.submission?.status !== 'saved'
  )
    return state
  return advance(
    state,
    {
      kind: 'assessed',
      eventId: active.submission.eventId,
      originalAssessment: active.submission.assessment,
      assessment: active.submission.assessment,
      revision: 0,
    },
    now
  )
}

export function skipAssistedReview<T>(
  state: ReviewFlowState<T>,
  questionId: string,
  now: number
): ReviewFlowState<T> {
  const active = state.active
  if (
    state.closed ||
    !state.foreground ||
    state.view.kind === 'history' ||
    active?.question.id !== questionId ||
    !active.assisted ||
    active.submission
  )
    return state
  return advance(state, { kind: 'skipped' }, now)
}

export function getReviewAutoAdvance<T>(
  state: ReviewFlowState<T>
): ReviewAutoAdvanceTicket | null {
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
    active.answeredAt === null ||
    active.submission?.status !== 'saved'
  )
    return null
  return {
    sessionId: state.sessionId,
    questionId: active.question.id,
    timerRevision: state.timerRevision,
    notBefore: active.answeredAt + RECOGNITION_FEEDBACK_MS,
  }
}

export function autoAdvanceReview<T>(
  state: ReviewFlowState<T>,
  ticket: ReviewAutoAdvanceTicket,
  now: number
): ReviewFlowState<T> {
  const current = getReviewAutoAdvance(state)
  if (
    !current ||
    !Number.isFinite(now) ||
    now < current.notBefore ||
    current.sessionId !== ticket.sessionId ||
    current.questionId !== ticket.questionId ||
    current.timerRevision !== ticket.timerRevision ||
    current.notBefore !== ticket.notBefore
  )
    return state
  return continueReviewFlow(state, ticket.questionId, now)
}

/** Use on exit/logout/account change. Old async completions cannot restore this state. */
export function closeReviewFlow<T>(
  state: ReviewFlowState<T>
): ReviewFlowState<T> {
  return {
    ...state,
    closed: true,
    active: null,
    remaining: [],
    history: [],
    view: { kind: 'current' },
    timerRevision: state.timerRevision + 1,
  }
}
