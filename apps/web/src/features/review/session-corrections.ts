import { reconcileReviewHistory } from '@woordenaar/domain'
import type { ReviewAssessment } from './types'
import type {
  ReviewCorrectionInput,
  ReviewCorrectionResult,
  ReviewCorrectionRefreshInput,
  ReviewCorrectionRefreshResult,
} from './correction-contract'
import type { WebReviewSnapshot } from './session-controller'

export interface SessionCorrection {
  input: ReviewCorrectionInput
  status:
    'saving' | 'retry' | 'conflict' | 'invalid' | 'unavailable' | 'refreshing'
  message: string
}
export interface CorrectionTransport {
  submit: (input: ReviewCorrectionInput) => Promise<ReviewCorrectionResult>
  refresh: (
    input: ReviewCorrectionRefreshInput
  ) => Promise<ReviewCorrectionRefreshResult>
}

export function createSessionCorrections(
  host: {
    get: () => WebReviewSnapshot
    set: (next: WebReviewSnapshot) => void
    attached: () => boolean
  },
  transport: CorrectionTransport
) {
  const currentRequest = (sessionId: string, correctionId: string) =>
    host.attached() &&
    host.get().flow?.sessionId === sessionId &&
    host.get().correction?.input.correctionId === correctionId
  const send = async (input: ReviewCorrectionInput) => {
    const snapshot = host.get()
    if (!snapshot.flow) return
    const sessionId = snapshot.flow.sessionId
    host.set({
      ...snapshot,
      correction: { input, status: 'saving', message: 'Saving correction…' },
    })
    let result: ReviewCorrectionResult
    try {
      result = await transport.submit(input)
    } catch {
      result = {
        status: 'retry',
        message: 'Could not confirm the correction. Retry the same edit.',
      }
    }
    if (!currentRequest(sessionId, input.correctionId)) return
    const current = host.get()
    if (result.status !== 'success') {
      host.set({ ...current, correction: { input, ...result } })
      return
    }
    if (
      result.correctionId !== input.correctionId ||
      result.eventId !== input.eventId ||
      result.update.wordId !== input.wordId ||
      result.acceptedRevision !== input.expectedRevision + 1 ||
      result.effectiveRevision < result.acceptedRevision
    ) {
      host.set({
        ...current,
        correction: {
          input,
          status: 'retry',
          message: 'Could not verify the receipt. Retry the same edit.',
        },
      })
      return
    }
    host.set({
      ...current,
      correction: null,
      notice: 'Assessment corrected. No extra review was added.',
      detailRevision: current.detailRevision + 1,
      flow: current.flow
        ? reconcileReviewHistory(
            current.flow,
            input.eventId,
            result.effectiveRevision,
            result.assessment
          )
        : null,
      words: current.words.map(word =>
        word.id === input.wordId ? { ...word, ...result.update } : word
      ),
      events: current.events.map(event =>
        event.eventId === input.eventId
          ? { ...event, assessment: result.assessment }
          : event
      ),
    })
  }
  return {
    correct: async (assessment: ReviewAssessment) => {
      const state = host.get()
      const flow = state.flow
      const entry =
        flow?.view.kind === 'history' ? flow.history[flow.view.index] : null
      const saving = flow?.active?.submission?.status
      if (
        !host.attached() ||
        !flow ||
        !flow.foreground ||
        state.correction ||
        !state.correctionsAvailable ||
        saving === 'saving' ||
        saving === 'failed' ||
        entry?.result.kind !== 'assessed' ||
        entry.question.assisted ||
        state.blockedCorrections.includes(entry.result.eventId) ||
        assessment === entry.result.assessment
      )
        return
      await send({
        userId: flow.userId,
        wordId: entry.question.question.wordId,
        eventId: entry.result.eventId,
        correctionId: crypto.randomUUID(),
        expectedRevision: entry.result.revision,
        assessment,
      })
    },
    retryCorrection: async () => {
      const command = host.get().correction
      if (host.attached() && command?.status === 'retry')
        await send(command.input)
    },
    keepServerVersion: async () => {
      const state = host.get()
      const command = state.correction
      if (
        !host.attached() ||
        !state.flow ||
        !command ||
        !['conflict', 'invalid', 'unavailable'].includes(command.status)
      )
        return
      const sessionId = state.flow.sessionId
      host.set({
        ...state,
        correction: {
          ...command,
          status: 'refreshing',
          message: 'Refreshing server progress…',
        },
      })
      let result: ReviewCorrectionRefreshResult
      try {
        result = await transport.refresh(command.input)
      } catch {
        result = {
          status: 'error',
          message: 'Could not refresh server progress. Try again.',
        }
      }
      if (!currentRequest(sessionId, command.input.correctionId)) return
      const current = host.get()
      if (
        result.status === 'error' ||
        result.userId !== command.input.userId ||
        result.eventId !== command.input.eventId ||
        result.wordId !== command.input.wordId
      ) {
        host.set({
          ...current,
          correction: {
            ...command,
            message:
              result.status === 'error'
                ? result.message
                : 'Could not verify server progress. Try again.',
          },
        })
        return
      }
      host.set({
        ...current,
        correction: null,
        correctionsAvailable: result.correctionsAvailable,
        blockedCorrections: [
          ...current.blockedCorrections,
          command.input.eventId,
        ],
        detailRevision: current.detailRevision + 1,
        notice: `Server progress kept. Your requested ${command.input.assessment} edit was not confirmed. This review cannot be edited again in this session.`,
        flow:
          current.flow && result.event
            ? reconcileReviewHistory(
                current.flow,
                result.eventId,
                result.event.revision,
                result.event.assessment
              )
            : current.flow,
        words: result.progress
          ? current.words.map(word =>
              word.id === result.wordId ? { ...word, ...result.progress } : word
            )
          : current.words.filter(word => word.id !== result.wordId),
        events: current.events.map(event =>
          event.eventId === result.eventId && result.event
            ? { ...event, assessment: result.event.assessment }
            : event
        ),
      })
    },
  }
}
