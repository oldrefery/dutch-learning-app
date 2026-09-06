import {
  beginReviewSubmission,
  continueReviewFlow,
  createReviewFlow,
  getAutomaticReviewAssessment,
  selectReviewOption,
  setReviewForeground,
  settleReviewSubmission,
  closeReviewFlow,
  type ReviewFlowState,
  type ReviewFlowActive,
} from '@woordenaar/domain'
import type { SRSAssessment } from '@/types/database'
import type { NativeReviewPayload } from './questions'
import {
  createNativeCorrectionController,
  type NativeCorrectionTransport,
} from './correctionController'

export type NativeReviewFlow = ReviewFlowState<NativeReviewPayload>
export interface NativeReviewSubmission {
  eventId: string
  userId: string
  wordId: string
  assessment: SRSAssessment
  reviewMode: ReviewFlowActive<NativeReviewPayload>['question']['mode']
  answeredCorrectly: boolean | null
  responseTimeMs: number
  reviewedAt: string
}

export function createNativeReviewController(
  config: Parameters<typeof createReviewFlow<NativeReviewPayload>>[0],
  persist: (input: NativeReviewSubmission) => Promise<void>,
  newId: () => string,
  correctionTransport?: NativeCorrectionTransport
) {
  let flow = createReviewFlow(config)
  const listeners = new Set<() => void>()
  let retry: NativeReviewSubmission | null = null
  let writesBlocked = false
  const transition = (
    change: (state: NativeReviewFlow) => NativeReviewFlow
  ) => {
    const next = change(flow)
    if (next === flow) return
    flow = next
    listeners.forEach(listener => listener())
  }
  const submit = async (assessment: SRSAssessment, advance = true) => {
    const before = flow
    const active = flow.active
    if (!active || flow.closed || writesBlocked) return
    if (active.submission?.status === 'saved') {
      transition(state =>
        continueReviewFlow(state, active.question.id, Date.now())
      )
      return
    }
    const now = Date.now()
    const input: NativeReviewSubmission = retry ?? {
      eventId: newId(),
      userId: flow.userId,
      wordId: active.question.wordId,
      assessment,
      reviewMode: active.question.mode,
      answeredCorrectly: active.answeredCorrectly,
      responseTimeMs: Math.max(
        0,
        (active.answeredAt ?? now) - active.startedAt
      ),
      reviewedAt: new Date(now).toISOString(),
    }
    const claimed = beginReviewSubmission(
      flow,
      active.question.id,
      input.eventId,
      assessment
    )
    if (claimed === flow) return
    retry = input
    transition(() => claimed)
    try {
      await persist(input)
      // A durable save may finish while the tab is unfocused. Remember it, but
      // never advance until focus returns and the user explicitly continues.
      transition(state =>
        settleReviewSubmission(state, before.sessionId, input.eventId, {
          status: 'saved',
        })
      )
      retry = null
      if (advance && flow.timerRevision === before.timerRevision) {
        transition(state =>
          continueReviewFlow(state, active.question.id, Date.now())
        )
      }
    } catch {
      transition(state =>
        settleReviewSubmission(state, before.sessionId, input.eventId, {
          status: 'failed',
          error: 'Could not save this answer. Retry the same assessment.',
        })
      )
    }
  }
  const blockWrites = (blocked: boolean) => {
    writesBlocked = blocked
    transition(state => ({
      ...state,
      timerRevision: state.timerRevision + 1,
      active: state.active ? { ...state.active, autoPaused: true } : null,
    }))
  }
  const corrections = createNativeCorrectionController(
    { getSnapshot: () => flow, transition, blockWrites },
    newId,
    correctionTransport
  )
  return {
    corrections,
    areWritesBlocked: () => writesBlocked,
    getSnapshot: () => flow,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    transition,
    submit,
    selectOption: (id: string) => {
      const active = flow.active
      if (!active || writesBlocked) return
      transition(state =>
        selectReviewOption(state, active.question.id, id, Date.now())
      )
      if (getAutomaticReviewAssessment(flow)) void submit('good', false)
    },
    setForeground: (foreground: boolean) =>
      transition(state => setReviewForeground(state, foreground)),
    exit: () => {
      const status = flow.active?.submission?.status
      if (writesBlocked || status === 'saving' || status === 'failed')
        return false
      transition(closeReviewFlow)
      return true
    },
  }
}
export type NativeReviewController = ReturnType<
  typeof createNativeReviewController
>
