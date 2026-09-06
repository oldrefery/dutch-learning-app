import {
  reconcileReviewHistory,
  type SRSAssessmentType,
} from '@woordenaar/domain'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'
import { createCorrectionRestoration } from './restoreCorrections'
import type {
  CorrectionResult,
  NativeCorrectionTransport,
  NativeCorrectionState,
  CorrectionTarget,
} from './correctionTypes'
export type {
  CorrectionResult,
  NativeCorrectionTransport,
} from './correctionTypes'

export function createNativeCorrectionController(
  target: CorrectionTarget,
  newId: () => string,
  transport?: NativeCorrectionTransport
) {
  let state: NativeCorrectionState = {
    status: transport?.loadPending
      ? 'checking'
      : transport
        ? 'idle'
        : 'unavailable',
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
  const restore = createCorrectionRestoration(
    target,
    transport,
    () => state,
    update,
    validSession
  )
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
      if (!transport.loadPending) target.blockWrites(false)
      update({
        status: transport.loadPending ? 'checking' : 'idle',
        command: null,
        notice: 'Assessment updated. No extra review was recorded.',
      })
      await restore()
    } catch {
      if (validSession())
        update({
          status: 'retry',
          notice: 'Correction not confirmed. Retry the same change.',
        })
    }
  }
  return {
    restore,
    canCancelUnqueued: Boolean(transport?.cancelUnqueued),
    cancelUnqueued: async () => {
      if (
        state.status !== 'retry' ||
        !state.command ||
        !validSession() ||
        !transport?.cancelUnqueued
      )
        return
      const command = state.command
      update({ status: 'saving' })
      try {
        const cancelled = await transport.cancelUnqueued(command)
        if (!validSession()) return
        update(
          cancelled
            ? {
                status: 'checking',
                command: null,
                notice: 'Unsent change cancelled.',
              }
            : {
                status: 'retry',
                notice:
                  'This change is already saved locally. Retry to finish synchronizing it.',
              }
        )
        if (cancelled) await restore()
      } catch {
        if (validSession()) update({ status: 'retry' })
      }
    },
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
      if (state.status === 'loadFailed') {
        await restore()
        return
      }
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
        if (!transport.loadPending) target.blockWrites(false)
        update({
          status: transport.loadPending ? 'checking' : 'idle',
          command: null,
          lockedEvents: [...state.lockedEvents, command.event_id],
          notice: `Server version refreshed. The requested ${command.assessment} rating was not confirmed.`,
        })
        await restore()
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
