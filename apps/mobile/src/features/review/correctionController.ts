import {
  reconcileReviewHistory,
  type SRSAssessmentType,
} from '@woordenaar/domain'
import type { NativeReviewFlow } from './controller'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'

export interface CorrectionResult {
  eventId: string
  wordId: string
  revision: number
  assessment: SRSAssessmentType
}

/** A result may be returned only after durable intent and canonical SRS reconciliation. */
export interface NativeCorrectionTransport {
  ownsSession: () => boolean
  apply: (
    command: Readonly<ReviewCorrectionCommand>
  ) => Promise<
    { kind: 'confirmed'; result: CorrectionResult } | { kind: 'conflict' }
  >
  keepServer: (
    command: Readonly<ReviewCorrectionCommand>
  ) => Promise<CorrectionResult | null>
}

export interface NativeCorrectionState {
  status: 'unavailable' | 'idle' | 'saving' | 'retry' | 'conflict' | 'resolving'
  command: Readonly<ReviewCorrectionCommand> | null
  lockedEvents: readonly string[]
  notice: string | null
}

interface Target {
  getSnapshot: () => NativeReviewFlow
  transition: (change: (state: NativeReviewFlow) => NativeReviewFlow) => void
  blockWrites: (blocked: boolean) => void
}

export function createNativeCorrectionController(
  target: Target,
  newId: () => string,
  transport?: NativeCorrectionTransport
) {
  let state: NativeCorrectionState = {
    status: transport ? 'idle' : 'unavailable',
    command: null,
    lockedEvents: [],
    notice: null,
  }
  const listeners = new Set<() => void>()
  const update = (patch: Partial<NativeCorrectionState>) => {
    state = { ...state, ...patch }
    listeners.forEach(listener => listener())
  }
  const validSession = () =>
    Boolean(transport?.ownsSession()) && !target.getSnapshot().closed
  const reconcile = (
    command: Readonly<ReviewCorrectionCommand>,
    result: CorrectionResult
  ) => {
    if (
      result.eventId !== command.event_id ||
      result.wordId !== command.word_id ||
      !Number.isSafeInteger(result.revision) ||
      result.revision < command.expected_revision ||
      !['again', 'hard', 'good', 'easy'].includes(result.assessment)
    )
      throw new Error('Invalid correction reconciliation')
    target.transition(flow =>
      reconcileReviewHistory(
        flow,
        result.eventId,
        result.revision,
        result.assessment
      )
    )
  }
  const apply = async (command: Readonly<ReviewCorrectionCommand>) => {
    if (!transport || !validSession()) return
    update({ status: 'saving', notice: 'Saving correction…' })
    try {
      const response = await transport.apply(command)
      if (!validSession()) return
      if (response.kind === 'conflict') {
        update({
          status: 'conflict',
          notice:
            'This review changed elsewhere. Refresh the server version before continuing.',
        })
        return
      }
      if (response.result.revision <= command.expected_revision)
        throw new Error('Correction was not confirmed')
      reconcile(command, response.result)
      target.blockWrites(false)
      update({
        status: 'idle',
        command: null,
        notice: 'Assessment updated. No extra review was recorded.',
      })
    } catch {
      if (validSession())
        update({
          status: 'retry',
          notice: 'Correction not confirmed. Retry the same change.',
        })
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    change: async (assessment: SRSAssessmentType) => {
      const flow = target.getSnapshot()
      if (
        state.status !== 'idle' ||
        !validSession() ||
        !flow.foreground ||
        flow.view.kind !== 'history'
      )
        return
      const entry = flow.history[flow.view.index]
      if (
        !entry ||
        entry.result.kind !== 'assessed' ||
        entry.question.assisted ||
        state.lockedEvents.includes(entry.result.eventId) ||
        entry.result.assessment === assessment ||
        flow.active?.submission?.status === 'saving' ||
        flow.active?.submission?.status === 'failed'
      )
        return
      const command = Object.freeze({
        correction_id: newId(),
        user_id: flow.userId,
        word_id: entry.question.question.wordId,
        event_id: entry.result.eventId,
        expected_revision: entry.result.revision,
        assessment,
      })
      // Claim before notifying either store: subscribers may re-enter change.
      state = { ...state, status: 'saving', command }
      target.blockWrites(true)
      await apply(command)
    },
    retry: async () => {
      if (
        state.status === 'retry' &&
        state.command &&
        target.getSnapshot().foreground
      )
        await apply(state.command)
    },
    keepServer: async () => {
      if (
        !transport ||
        state.status !== 'conflict' ||
        !state.command ||
        !validSession() ||
        !target.getSnapshot().foreground
      )
        return
      const command = state.command
      update({ status: 'resolving', notice: 'Refreshing the server version…' })
      try {
        const result = await transport.keepServer(command)
        if (!validSession()) return
        if (result) reconcile(command, result)
        target.blockWrites(false)
        update({
          status: 'idle',
          command: null,
          lockedEvents: [...state.lockedEvents, command.event_id],
          notice: `Server version refreshed. The requested ${command.assessment} rating was not confirmed.`,
        })
      } catch {
        if (validSession())
          update({
            status: 'conflict',
            notice: 'Could not refresh the server version. Try again.',
          })
      }
    },
  }
}
