import { browseReviewHistory, revealReviewAnswer } from '@woordenaar/domain'
import {
  createSessionCorrections,
  type CorrectionTransport,
} from '../session-corrections'
import { createReviewSessionController } from '../session-controller'
import type { ReviewCorrectionInput } from '../correction-contract'
import { makeData, successfulResult } from './session'

export const correctionReceipt = (input: ReviewCorrectionInput) => ({
  status: 'success' as const,
  correctionId: input.correctionId,
  eventId: input.eventId,
  acceptedRevision: input.expectedRevision + 1,
  effectiveRevision: input.expectedRevision + 1,
  assessment: input.assessment,
  update: successfulResult(input.wordId).update,
})

export async function makeCorrectionSession() {
  const submit = jest.fn<
    ReturnType<CorrectionTransport['submit']>,
    Parameters<CorrectionTransport['submit']>
  >(async input => correctionReceipt(input))
  const refresh = jest.fn<
    ReturnType<CorrectionTransport['refresh']>,
    Parameters<CorrectionTransport['refresh']>
  >(async input => ({
    status: 'success',
    ...input,
    correctionsAvailable: true,
    progress: successfulResult(input.wordId).update,
    event: { assessment: 'easy', revision: 2 },
  }))
  const controller = createReviewSessionController(
    'synthetic-user',
    { ...makeData(), correctionsAvailable: true },
    async input => successfulResult(input.wordId),
    { submit, refresh }
  )
  controller.attach()
  controller.start('all-due', null, 'meaning-recall', false)
  controller.transition(flow =>
    revealReviewAnswer(flow, flow.active!.question.id, Date.now())
  )
  await controller.submit('good')
  controller.transition(flow => browseReviewHistory(flow, 0))
  let state = controller.getSnapshot()
  let attached = true
  const host = {
    get: () => state,
    set: (next: typeof state) => {
      state = next
    },
    attached: () => attached,
  }
  return {
    host,
    detach: () => {
      attached = false
    },
    submit,
    refresh,
    commands: createSessionCorrections(host, { submit, refresh }),
  }
}
