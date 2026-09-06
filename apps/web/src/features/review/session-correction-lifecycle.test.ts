import {
  correctionReceipt,
  makeCorrectionSession,
} from './__fixtures__/correction-session'
import type { WebReviewSnapshot } from './session-controller'
import type {
  ReviewCorrectionResult,
  ReviewCorrectionRefreshResult,
} from './correction-contract'

test.each(['background', 'no-flow', 'detached'])(
  '%s cannot start a correction',
  async condition => {
    const { host, commands, submit, detach } = await makeCorrectionSession()
    if (condition === 'detached') detach()
    else
      host.set({
        ...host.get(),
        flow:
          condition === 'no-flow'
            ? null
            : { ...host.get().flow!, foreground: false },
      })
    const before = host.get()
    await commands.correct('hard')
    expect(submit).not.toHaveBeenCalled()
    expect(host.get()).toBe(before)
  }
)

test.each(['saving', 'failed'] as const)(
  'an active %s review blocks edits of older history',
  async status => {
    const { host, commands, submit } = await makeCorrectionSession()
    const flow = host.get().flow!
    host.set({
      ...host.get(),
      flow: {
        ...flow,
        active: {
          ...flow.active!,
          submission: {
            status,
            eventId: 'pending-review',
            assessment: 'good',
            error: 'Offline',
          },
        },
      },
    })
    const before = host.get()
    await commands.correct('hard')
    expect(submit).not.toHaveBeenCalled()
    expect(host.get()).toBe(before)
  }
)

test.each(['detached', 'session', 'command'])(
  'a late correction cannot update a changed %s',
  async condition => {
    const { host, commands, submit, detach } = await makeCorrectionSession()
    let resolve!: (value: ReviewCorrectionResult) => void
    submit.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done
        })
    )
    const pending = commands.correct('hard')
    const input = submit.mock.calls[0][0]
    if (condition === 'detached') detach()
    if (condition === 'session')
      host.set({
        ...host.get(),
        flow: { ...host.get().flow!, sessionId: 'new-session' },
      })
    if (condition === 'command') host.set({ ...host.get(), correction: null })
    const before = host.get()
    resolve(correctionReceipt(input))
    await pending
    expect(host.get()).toBe(before)
  }
)

test('a detached retry cannot submit or change pending state', async () => {
  const { host, commands, submit, detach } = await makeCorrectionSession()
  submit.mockRejectedValueOnce(new Error('Offline'))
  await commands.correct('hard')
  expect(host.get().correction?.message).toBe(
    'Could not confirm the correction. Retry the same edit.'
  )
  detach()
  const before = host.get()
  await commands.retryCorrection()
  expect(host.get()).toBe(before)
  expect(submit).toHaveBeenCalledTimes(1)
})

test.each(['no-command', 'no-flow', 'detached'])(
  '%s cannot start read-only reconciliation',
  async condition => {
    const { host, commands, submit, refresh, detach } =
      await makeCorrectionSession()
    if (condition !== 'no-command') {
      submit.mockResolvedValueOnce({
        status: 'conflict',
        message: 'Changed elsewhere',
      })
      await commands.correct('hard')
    }
    if (condition === 'no-flow') host.set({ ...host.get(), flow: null })
    if (condition === 'detached') detach()
    const before = host.get()
    await commands.keepServerVersion()
    expect(refresh).not.toHaveBeenCalled()
    expect(host.get()).toBe(before)
  }
)

test('refresh claims one request and ignores a late response after detach', async () => {
  const { host, commands, submit, refresh, detach } =
    await makeCorrectionSession()
  submit.mockResolvedValueOnce({
    status: 'conflict',
    message: 'Changed elsewhere',
  })
  await commands.correct('hard')
  let resolve!: (value: ReviewCorrectionRefreshResult) => void
  refresh.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  const pending = commands.keepServerVersion()
  expect(host.get().correction).toMatchObject({
    status: 'refreshing',
    message: 'Refreshing server progress…',
  })
  await commands.keepServerVersion()
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(refresh).toHaveBeenCalledWith(submit.mock.calls[0][0])
  detach()
  const before = host.get()
  resolve({ status: 'error', message: 'Late failure' })
  await pending
  expect(host.get()).toBe(before)
})

test('refresh rejection preserves the command for another read, never a new write', async () => {
  const { host, commands, submit, refresh } = await makeCorrectionSession()
  submit.mockResolvedValueOnce({
    status: 'conflict',
    message: 'Changed elsewhere',
  })
  await commands.correct('hard')
  const command = host.get().correction!
  refresh.mockRejectedValueOnce(new Error('Private provider detail'))
  await commands.keepServerVersion()
  expect(host.get().correction).toEqual({
    ...command,
    message: 'Could not refresh server progress. Try again.',
  })
  expect(submit).toHaveBeenCalledTimes(1)
})

test.each(['correct', 'refresh', 'deleted'] as const)(
  '%s invalidates details and preserves unrelated words, events and blocked edits',
  async action => {
    const { host, commands, submit, refresh } = await makeCorrectionSession()
    const before = host.get()
    const unrelatedEvent = {
      ...before.events[0],
      eventId: 'unrelated-event',
      wordId: 'word-2',
    }
    host.set({
      ...before,
      events: [...before.events, unrelatedEvent],
      blockedCorrections: ['older-block'],
      detailRevision: 7,
    })
    if (action !== 'correct')
      submit.mockResolvedValueOnce({
        status: 'unavailable',
        message: 'Unsupported',
      })
    await commands.correct('hard')
    if (action !== 'correct') {
      if (action === 'deleted')
        refresh.mockResolvedValueOnce({
          status: 'success',
          ...submit.mock.calls[0][0],
          correctionsAvailable: false,
          event: null,
          progress: null,
        })
      await commands.keepServerVersion()
    }
    const after: WebReviewSnapshot = host.get()
    expect(after.detailRevision).toBe(8)
    expect(after.events[1]).toBe(unrelatedEvent)
    expect(after.words.filter(word => word.id !== 'word-1')).toEqual(
      before.words.slice(1)
    )
    expect(after.blockedCorrections).toContain('older-block')
    expect(after.correction).toBeNull()
    if (action === 'correct')
      expect(after.notice).toBe(
        'Assessment corrected. No extra review was added.'
      )
    else if (action === 'deleted') {
      expect(after.correctionsAvailable).toBe(false)
      expect(after.flow).toBe(before.flow)
      expect(after.events[0]).toBe(before.events[0])
      expect(after.notice).toContain('hard edit was not confirmed')
    } else {
      expect(after.correctionsAvailable).toBe(true)
      expect(after.events[0].assessment).toBe('easy')
    }
  }
)
