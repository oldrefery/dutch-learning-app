import {
  beginReviewSubmission,
  continueReviewFlow,
  createReviewFlow,
  getAutomaticReviewAssessment,
  selectReviewOption,
  setReviewForeground,
  settleReviewSubmission,
  type ReviewFlowState,
} from '@woordenaar/domain'
import {
  getLocalReviewDate,
  MAX_REVIEW_RESPONSE_TIME_MS,
  selectReviewWords,
} from './review-domain'
import {
  prepareReviewQuestionsAsync,
  type ReviewQuestionPayload,
} from './session-questions'
import type {
  ReviewAssessment,
  ReviewScope,
  ReviewSessionMode,
  ReviewSubmissionInput,
  ReviewSubmissionResult,
  ReviewWorkspaceData,
} from './types'
import {
  createSessionCorrections,
  type SessionCorrection,
  type CorrectionTransport,
} from './session-corrections'

export type WebReviewFlow = ReviewFlowState<ReviewQuestionPayload>
export type ReviewPreparationState =
  | { status: 'idle' }
  | { completed: number; status: 'preparing'; total: number }
  | { message: string; status: 'error' }

export interface WebReviewSnapshot {
  flow: WebReviewFlow | null
  words: ReviewWorkspaceData['words']
  events: ReviewWorkspaceData['events']
  correction: SessionCorrection | null
  correctionsAvailable: boolean
  blockedCorrections: string[]
  notice: string | null
  noticeEventId: string | null
  preparation: ReviewPreparationState
  detailRevision: number
}

/** One controller per mounted account. Commands synchronously claim state before I/O. */
export function createReviewSessionController(
  userId: string,
  data: ReviewWorkspaceData,
  persist: (input: ReviewSubmissionInput) => Promise<ReviewSubmissionResult>,
  correctionTransport: CorrectionTransport
) {
  let snapshot: WebReviewSnapshot = {
    flow: null,
    words: data.words,
    events: data.events,
    correction: null,
    correctionsAvailable: data.correctionsAvailable === true,
    blockedCorrections: [],
    notice: null,
    noticeEventId: null,
    preparation: { status: 'idle' },
    detailRevision: 0,
  }
  const initial = snapshot
  const listeners = new Set<() => void>()
  let attached = false
  let preparationAbort: AbortController | null = null
  let preparationGeneration = 0
  let retry: ReviewSubmissionInput | null = null
  const emit = () => listeners.forEach(listener => listener())
  const transition = (change: (flow: WebReviewFlow) => WebReviewFlow) => {
    if (!snapshot.flow) return
    const flow = change(snapshot.flow)
    if (flow === snapshot.flow) return
    snapshot = { ...snapshot, flow }
    emit()
  }
  const unsettled = () => {
    const status = snapshot.flow?.active?.submission?.status
    return (
      Boolean(snapshot.correction) || status === 'saving' || status === 'failed'
    )
  }
  const cancelPreparation = () => {
    if (snapshot.preparation.status !== 'preparing') return false
    preparationGeneration += 1
    preparationAbort?.abort()
    preparationAbort = null
    snapshot = { ...snapshot, preparation: { status: 'idle' } }
    emit()
    return true
  }
  const submit = async (assessment: ReviewAssessment, advance = true) => {
    const before = snapshot.flow
    const active = before?.active
    if (!attached || !before || !active || snapshot.correction) return
    if (active.submission?.status === 'saved') {
      transition(flow =>
        continueReviewFlow(flow, active.question.id, Date.now())
      )
      return
    }
    const now = Date.now()
    const input: ReviewSubmissionInput = retry ?? {
      assessment,
      eventId: crypto.randomUUID(),
      wordId: active.question.wordId,
      reviewMode: active.question.mode,
      answeredCorrectly: active.answeredCorrectly,
      reviewedAt: new Date(now).toISOString(),
      reviewDate: getLocalReviewDate(),
      responseTimeMs: Math.min(
        MAX_REVIEW_RESPONSE_TIME_MS,
        Math.max(0, (active.answeredAt ?? now) - active.startedAt)
      ),
    }
    const claimed = beginReviewSubmission(
      before,
      active.question.id,
      input.eventId,
      assessment
    )
    if (claimed === before) return
    retry = input
    snapshot = { ...snapshot, flow: claimed }
    emit()
    try {
      const result = await persist(input)
      if (!attached || snapshot.flow?.sessionId !== before.sessionId) return
      if (result.status === 'error') {
        transition(flow =>
          settleReviewSubmission(flow, before.sessionId, input.eventId, {
            status: 'failed',
            error: result.message,
          })
        )
        return
      }
      if (result.update.wordId !== input.wordId)
        throw new Error('Unexpected review acknowledgement')
      snapshot = {
        ...snapshot,
        words: snapshot.words.map(word =>
          word.id === input.wordId
            ? {
                ...word,
                ...result.update,
                id: word.id,
              }
            : word
        ),
        events: [{ ...input }, ...snapshot.events],
      }
      retry = null
      transition(flow =>
        settleReviewSubmission(flow, before.sessionId, input.eventId, {
          status: 'saved',
        })
      )
      // Navigation/background changes during the request revoke explicit advance intent.
      if (advance && snapshot.flow?.timerRevision === before.timerRevision) {
        transition(flow =>
          continueReviewFlow(flow, active.question.id, Date.now())
        )
      }
    } catch {
      if (!attached) return
      transition(flow =>
        settleReviewSubmission(flow, before.sessionId, input.eventId, {
          status: 'failed',
          error: 'Could not confirm this review. Retry the same assessment.',
        })
      )
    }
  }
  const corrections = createSessionCorrections(
    {
      get: () => snapshot,
      attached: () => attached,
      set: next => {
        snapshot = next
        emit()
      },
    },
    correctionTransport
  )
  return {
    ...corrections,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    attach: () => {
      attached = true
    },
    detach: () => {
      attached = false
      cancelPreparation()
      transition(flow => setReviewForeground(flow, false))
    },
    transition,
    submit,
    selectOption: (optionId: string) => {
      if (snapshot.correction) return
      const active = snapshot.flow?.active
      if (!active) return
      transition(flow =>
        selectReviewOption(flow, active.question.id, optionId, Date.now())
      )
      if (snapshot.flow && getAutomaticReviewAssessment(snapshot.flow))
        void submit('good', false)
    },
    start: async (
      scope: ReviewScope,
      collectionId: string | null,
      mode: ReviewSessionMode,
      manualRecognition: boolean
    ) => {
      if (unsettled() || snapshot.preparation.status === 'preparing')
        return 'blocked' as const
      const selected = selectReviewWords(snapshot.words, scope, collectionId)
      if (!selected.length) return 'empty' as const
      retry = null
      const generation = ++preparationGeneration
      const abort = new AbortController()
      preparationAbort = abort
      snapshot = {
        ...snapshot,
        blockedCorrections: [],
        notice: null,
        noticeEventId: null,
        preparation: {
          completed: 0,
          status: 'preparing',
          total: selected.length,
        },
      }
      emit()
      try {
        const questions = await prepareReviewQuestionsAsync(
          selected,
          snapshot.words,
          snapshot.events,
          mode,
          {
            signal: abort.signal,
            onProgress: (completed, total) => {
              if (
                attached &&
                generation === preparationGeneration &&
                !abort.signal.aborted
              ) {
                snapshot = {
                  ...snapshot,
                  preparation: { completed, status: 'preparing', total },
                }
                emit()
              }
            },
          }
        )
        if (
          !attached ||
          generation !== preparationGeneration ||
          abort.signal.aborted
        )
          return 'cancelled' as const
        snapshot = {
          ...snapshot,
          flow: createReviewFlow({
            sessionId: crypto.randomUUID(),
            userId,
            now: Date.now(),
            manualRecognition,
            questions,
          }),
          preparation: { status: 'idle' },
        }
        preparationAbort = null
        emit()
        return 'started' as const
      } catch (error) {
        if (generation !== preparationGeneration || abort.signal.aborted)
          return 'cancelled' as const
        preparationAbort = null
        snapshot = {
          ...snapshot,
          preparation: {
            message:
              error instanceof Error
                ? error.message
                : 'Could not prepare this review. Try again.',
            status: 'error',
          },
        }
        emit()
        return 'error' as const
      }
    },
    cancelPreparation,
    exit: () => {
      if (cancelPreparation()) return true
      if (unsettled()) return false
      snapshot = { ...snapshot, flow: null }
      retry = null
      emit()
      return true
    },
  }
}
