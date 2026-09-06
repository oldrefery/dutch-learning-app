import type { ReviewFlowState } from './review-flow.types'

function pause<T>(state: ReviewFlowState<T>): ReviewFlowState<T> {
  return {
    ...state,
    timerRevision: state.timerRevision + 1,
    active: state.active ? { ...state.active, autoPaused: true } : null,
  }
}

export function openReviewDetails<T>(
  state: ReviewFlowState<T>
): ReviewFlowState<T> {
  if (state.closed) return state
  if (state.view.kind === 'history')
    return { ...state, view: { ...state.view, details: true } }
  if (!state.active) return state
  const paused = pause(state)
  return {
    ...paused,
    view: { kind: 'details' },
    active: {
      ...state.active,
      autoPaused: true,
      revealed: true,
      assisted: state.active.assisted || state.active.answeredAt === null,
    },
  }
}

export function closeReviewDetails<T>(
  state: ReviewFlowState<T>
): ReviewFlowState<T> {
  if (state.closed) return state
  if (state.view.kind === 'history')
    return { ...state, view: { ...state.view, details: false } }
  return { ...state, view: { kind: 'current' } }
}

export function browseReviewHistory<T>(
  state: ReviewFlowState<T>,
  index: number
): ReviewFlowState<T> {
  if (state.closed || !Number.isInteger(index) || !state.history[index])
    return state
  return { ...pause(state), view: { kind: 'history', index, details: false } }
}

export function previousReviewWord<T>(
  state: ReviewFlowState<T>
): ReviewFlowState<T> {
  return browseReviewHistory(
    state,
    state.view.kind === 'history'
      ? state.view.index - 1
      : state.history.length - 1
  )
}

export function returnToReviewQuestion<T>(
  state: ReviewFlowState<T>
): ReviewFlowState<T> {
  if (state.closed) return state
  return { ...state, view: { kind: 'current' } }
}

export function setReviewForeground<T>(
  state: ReviewFlowState<T>,
  foreground: boolean
): ReviewFlowState<T> {
  if (state.closed || state.foreground === foreground) return state
  return { ...(foreground ? state : pause(state)), foreground }
}

export function setReviewManualRecognition<T>(
  state: ReviewFlowState<T>,
  manualRecognition: boolean
): ReviewFlowState<T> {
  if (state.closed) return state
  // A preference change applies only when the next question is activated.
  return { ...state, manualRecognition }
}
