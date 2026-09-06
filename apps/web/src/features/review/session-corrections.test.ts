import {
  browseReviewHistory,
  openReviewDetails,
  revealReviewAnswer,
  returnToReviewQuestion,
  summarizeReviewFlow,
} from '@woordenaar/domain'
import { createReviewSessionController } from './session-controller'
import { makeData, successfulResult } from './__fixtures__/session'
import type {
  ReviewCorrectionInput,
  ReviewCorrectionResult,
  ReviewCorrectionRefreshResult,
} from './correction-contract'

const receipt = (input: ReviewCorrectionInput): ReviewCorrectionResult => ({
  status: 'success',
  correctionId: input.correctionId,
  eventId: input.eventId,
  acceptedRevision: input.expectedRevision + 1,
  effectiveRevision: input.expectedRevision + 1,
  assessment: input.assessment,
  update: {
    ...successfulResult(input.wordId).update,
    intervalDays: 0,
    repetitionCount: 0,
    easinessFactor: 2.3,
  },
})
async function setup(available = true) {
  const persist = jest.fn(async (input: { wordId: string }) =>
    successfulResult(input.wordId)
  )
  const submit = jest.fn(
    async (input: ReviewCorrectionInput): Promise<ReviewCorrectionResult> =>
      receipt(input)
  )
  const refresh = jest.fn(async (): Promise<ReviewCorrectionRefreshResult> => ({
    status: 'error',
    message: 'Offline',
  }))
  const controller = createReviewSessionController(
    'test-user',
    { ...makeData(), correctionsAvailable: available },
    persist,
    { submit, refresh }
  )
  controller.attach()
  controller.start('all-due', null, 'meaning-recall', false)
  controller.transition(state =>
    revealReviewAnswer(state, state.active!.question.id, Date.now())
  )
  await controller.submit('good')
  controller.transition(state => browseReviewHistory(state, 0))
  const summary = () => summarizeReviewFlow(controller.getSnapshot().flow!)
  const serverState = (): Extract<
    ReviewCorrectionRefreshResult,
    { status: 'success' }
  > => {
    const input = submit.mock.calls[0][0]
    return {
      status: 'success',
      userId: input.userId,
      eventId: input.eventId,
      wordId: input.wordId,
      correctionsAvailable: true,
      progress: {
        ...successfulResult(input.wordId).update,
        lastReviewedAt: null,
        repetitionCount: 0,
      },
      event: { assessment: 'easy', revision: 2 },
    }
  }
  return { controller, persist, submit, refresh, summary, serverState }
}

test('correction replaces the rating and canonical SRS without another review or moving the question', async () => {
  const { controller, persist, submit, summary } = await setup()
  const active = controller.getSnapshot().flow!.active
  await controller.correct('again')
  const state = controller.getSnapshot()
  expect(summary()).toMatchObject({
    assessed: 1,
    counts: { again: 1, good: 0 },
  })
  expect(state.flow!.active).toBe(active)
  expect(state.flow!.history[0].result).toMatchObject({
    assessment: 'again',
    originalAssessment: 'good',
    revision: 1,
  })
  expect(state.words[0]).toMatchObject({
    easinessFactor: 2.3,
    repetitionCount: 0,
  })
  expect(state.events[0].assessment).toBe('again')
  expect(persist).toHaveBeenCalledTimes(1)
  await controller.correct('easy')
  expect(submit.mock.calls[1][0].expectedRevision).toBe(1)
  expect(submit.mock.calls[1][0].correctionId).not.toBe(
    submit.mock.calls[0][0].correctionId
  )
  expect(summary()).toMatchObject({
    assessed: 1,
    counts: { easy: 1, again: 0 },
  })
})

test('double clicks claim one correction synchronously and do not update optimistically', async () => {
  const { controller, submit, summary } = await setup()
  let resolve!: (result: ReviewCorrectionResult) => void
  submit.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const pending = controller.correct('again')
  await controller.correct('hard')
  expect(submit).toHaveBeenCalledTimes(1)
  expect(summary().counts.good).toBe(1)
  expect(controller.getSnapshot().correction).toMatchObject({
    status: 'saving',
    message: 'Saving correction…',
  })
  resolve(receipt(submit.mock.calls[0][0]))
  await pending
  expect(summary().counts.again).toBe(1)
})

test('lost acknowledgement preserves the exact command and blocks new writes, restart, and exit', async () => {
  const { controller, submit, persist, refresh } = await setup()
  submit.mockRejectedValueOnce(new Error('Connection lost'))
  await controller.correct('again')
  const original = submit.mock.calls[0][0]
  controller.transition(returnToReviewQuestion)
  controller.transition(state =>
    revealReviewAnswer(state, state.active!.question.id, Date.now())
  )
  await controller.submit('easy')
  expect(persist).toHaveBeenCalledTimes(1)
  expect(controller.exit()).toBe(false)
  expect(controller.start('all-due', null, 'recognition', false)).toBe(false)
  await controller.keepServerVersion()
  expect(refresh).not.toHaveBeenCalled()
  await controller.retryCorrection()
  expect(submit.mock.calls[1][0]).toBe(original)
  expect(controller.getSnapshot().correction).toBeNull()
})

test.each(['conflict', 'invalid', 'unavailable'] as const)(
  '%s requires a successful read-only reconciliation',
  async status => {
    const { controller, submit, refresh, serverState, summary, persist } =
      await setup()
    submit.mockResolvedValueOnce({ status, message: 'Cannot apply edit' })
    await controller.correct('again')
    await controller.retryCorrection()
    expect(submit).toHaveBeenCalledTimes(1)
    await controller.keepServerVersion()
    expect(controller.getSnapshot().correction).toMatchObject({
      status,
      message: 'Offline',
    })
    refresh.mockResolvedValueOnce(serverState())
    await controller.keepServerVersion()
    expect(controller.getSnapshot().correction).toBeNull()
    expect(summary().counts.easy).toBe(1)
    expect(controller.getSnapshot().words[0].lastReviewedAt).toBeNull()
    await controller.correct('hard')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().notice).toContain('not confirmed')
  }
)

test('a retry receipt may contain a newer correction and reset progress', async () => {
  const { controller, submit, summary } = await setup()
  submit.mockImplementationOnce(async input => ({
    ...receipt(input),
    status: 'success',
    correctionId: input.correctionId,
    eventId: input.eventId,
    acceptedRevision: 1,
    effectiveRevision: 2,
    assessment: 'easy',
    update: {
      ...successfulResult(input.wordId).update,
      lastReviewedAt: null,
      repetitionCount: 0,
    },
  }))
  await controller.correct('again')
  expect(summary()).toMatchObject({
    assessed: 1,
    counts: { easy: 1, good: 0, again: 0 },
  })
  expect(controller.getSnapshot().words[0].lastReviewedAt).toBeNull()
})

test('unsupported capability never calls the correction transport', async () => {
  const { controller, submit } = await setup(false)
  await controller.correct('again')
  expect(submit).not.toHaveBeenCalled()
})

test('same rating and non-history commands do not write', async () => {
  const { controller, submit } = await setup()
  await controller.correct('good')
  controller.transition(returnToReviewQuestion)
  await controller.correct('again')
  expect(submit).not.toHaveBeenCalled()
})

test('assisted history cannot be upgraded through corrections', async () => {
  const { controller, submit } = await setup()
  controller.transition(returnToReviewQuestion)
  controller.transition(openReviewDetails)
  await controller.submit('again')
  controller.transition(state => browseReviewHistory(state, 1))
  await controller.correct('good')
  expect(submit).not.toHaveBeenCalled()
})

test('a missing server word is removed from the next session without destroying readable history', async () => {
  const { controller, submit, refresh, serverState } = await setup()
  submit.mockResolvedValueOnce({ status: 'invalid', message: 'Word deleted' })
  await controller.correct('again')
  refresh.mockResolvedValueOnce({
    ...serverState(),
    progress: null,
    event: null,
  })
  await controller.keepServerVersion()
  expect(
    controller.getSnapshot().words.some(word => word.id === 'word-1')
  ).toBe(false)
  expect(controller.getSnapshot().flow!.history).toHaveLength(1)
})

test('account unmount ignores a late correction response', async () => {
  const { controller, submit, summary } = await setup()
  let resolve!: (result: ReviewCorrectionResult) => void
  submit.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const pending = controller.correct('again')
  controller.detach()
  resolve(receipt(submit.mock.calls[0][0]))
  await pending
  expect(summary().counts.good).toBe(1)
})

test.each([
  { correctionId: 'wrong-id' },
  { eventId: 'wrong-event' },
  { update: successfulResult('wrong-word').update },
  { acceptedRevision: 0 },
  { acceptedRevision: 2 },
  { effectiveRevision: 0 },
])('a mismatched receipt stays retryable: %j', async mismatch => {
  const { controller, submit, summary } = await setup()
  submit.mockImplementationOnce(
    async input =>
      ({
        ...receipt(input),
        ...mismatch,
      }) as ReviewCorrectionResult
  )
  await controller.correct('again')
  expect(controller.getSnapshot().correction).toMatchObject({
    status: 'retry',
    message: 'Could not verify the receipt. Retry the same edit.',
  })
  expect(summary().counts.good).toBe(1)
})

test.each(['userId', 'wordId', 'eventId'])(
  'a refresh with mismatched %s cannot resolve the conflict',
  async field => {
    const { controller, submit, refresh, serverState } = await setup()
    submit.mockResolvedValueOnce({
      status: 'conflict',
      message: 'Changed elsewhere',
    })
    await controller.correct('again')
    refresh.mockResolvedValueOnce({
      ...serverState(),
      [field]: 'other-identity',
    })
    await controller.keepServerVersion()
    expect(controller.getSnapshot().correction).toMatchObject({
      status: 'conflict',
      message: 'Could not verify server progress. Try again.',
    })
  }
)
