import {
  previousReviewWord,
  returnToReviewQuestion,
  openReviewDetails,
} from '@woordenaar/domain'
import { makeController, deferred } from './fixtures'
import type { CorrectionResult } from '../correctionController'

const result: CorrectionResult = {
  eventId: 'event-1',
  wordId: 'word-0',
  revision: 1,
  assessment: 'hard',
}
const makeTransport = () => ({
  ownsSession: jest.fn(() => true),
  apply: jest.fn().mockResolvedValue({ kind: 'confirmed', result }),
  keepServer: jest.fn().mockResolvedValue(result),
})
async function setup(transport = makeTransport()) {
  const persist = jest.fn().mockResolvedValue(undefined)
  const controller = makeController(persist, true, transport)
  controller.selectOption('word-0')
  await controller.submit('good')
  controller.transition(previousReviewWord)
  return { controller, persist, transport }
}

it('reconciles history without an extra review or replacing the pending question', async () => {
  const { controller, persist, transport } = await setup()
  const question = controller.getSnapshot().active!.question
  await controller.corrections.change('hard')
  expect(transport.apply).toHaveBeenCalledWith({
    correction_id: 'event-2',
    user_id: 'review-qa',
    word_id: 'word-0',
    event_id: 'event-1',
    expected_revision: 0,
    assessment: 'hard',
  })
  expect(controller.getSnapshot().history[0].result).toMatchObject({
    originalAssessment: 'good',
    assessment: 'hard',
    revision: 1,
  })
  expect(persist).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().active!.question).toBe(question)
  expect(controller.getSnapshot().active!.autoPaused).toBe(true)
  expect(controller.areWritesBlocked()).toBe(false)
})

it('claims once even when a flow subscriber re-enters change', async () => {
  const { controller, transport } = await setup()
  const stop = controller.subscribe(() => {
    void controller.corrections.change('easy')
  })
  await controller.corrections.change('hard')
  stop()
  expect(transport.apply).toHaveBeenCalledTimes(1)
})

it('keeps writes blocked after an uncertain outcome and retries the identical frozen command', async () => {
  const { controller, persist, transport } = await setup()
  transport.apply.mockRejectedValueOnce(new Error('lost response'))
  await controller.corrections.change('hard')
  const command = transport.apply.mock.calls[0][0]
  expect(Object.isFrozen(command)).toBe(true)
  expect(controller.corrections.getSnapshot().status).toBe('retry')
  expect(controller.exit()).toBe(false)
  controller.transition(returnToReviewQuestion)
  controller.selectOption('word-1')
  await controller.submit('easy')
  expect(persist).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().active!.selectedOptionId).toBeNull()
  await controller.corrections.change('easy')
  await controller.corrections.retry()
  expect(transport.apply).toHaveBeenCalledTimes(2)
  expect(transport.apply.mock.calls[1][0]).toBe(command)
  expect(controller.areWritesBlocked()).toBe(false)
})

it('waits for acknowledgement and ignores double presses', async () => {
  const { controller, transport } = await setup()
  const pending = deferred()
  transport.apply.mockImplementationOnce(async () => {
    await pending.promise
    return { kind: 'confirmed', result }
  })
  const saving = controller.corrections.change('hard')
  await controller.corrections.change('easy')
  expect(controller.getSnapshot().history[0].result).toMatchObject({
    assessment: 'good',
  })
  expect(controller.areWritesBlocked()).toBe(true)
  pending.resolve()
  await saving
  expect(transport.apply).toHaveBeenCalledTimes(1)
})

it('retains a conflict after refresh failure and locks its event after keeping the server version', async () => {
  const { controller, transport } = await setup()
  transport.apply.mockResolvedValue({ kind: 'conflict' })
  transport.keepServer.mockRejectedValueOnce(new Error('offline'))
  await controller.corrections.change('hard')
  await controller.corrections.keepServer()
  expect(controller.corrections.getSnapshot().status).toBe('conflict')
  expect(controller.areWritesBlocked()).toBe(true)
  await controller.corrections.keepServer()
  expect(controller.areWritesBlocked()).toBe(false)
  expect(controller.corrections.getSnapshot().lockedEvents).toEqual(['event-1'])
  await controller.corrections.change('easy')
  expect(transport.apply).toHaveBeenCalledTimes(1)
})

it('handles a deleted server event without inventing a corrected history rating', async () => {
  const { controller, transport } = await setup()
  transport.apply.mockResolvedValue({ kind: 'conflict' })
  transport.keepServer.mockResolvedValue(null)
  await controller.corrections.change('hard')
  await controller.corrections.keepServer()
  expect(controller.getSnapshot().history[0].result).toMatchObject({
    assessment: 'good',
    revision: 0,
  })
  expect(controller.areWritesBlocked()).toBe(false)
})

it.each([
  { eventId: 'another-event' },
  { wordId: 'another-word' },
  { revision: 0 },
  { revision: 1.5 },
  { assessment: 'invalid' },
])('rejects malformed confirmation %j', async patch => {
  const { controller, transport } = await setup()
  transport.apply.mockResolvedValue({
    kind: 'confirmed',
    result: { ...result, ...patch },
  })
  await controller.corrections.change('hard')
  expect(controller.corrections.getSnapshot().status).toBe('retry')
  expect(controller.areWritesBlocked()).toBe(true)
  expect(controller.getSnapshot().history[0].result).toMatchObject({
    assessment: 'good',
    revision: 0,
  })
})

it('ignores a late confirmation after ownership changes', async () => {
  const { controller, transport } = await setup()
  const pending = deferred()
  transport.apply.mockImplementationOnce(async () => {
    await pending.promise
    return { kind: 'confirmed', result }
  })
  const saving = controller.corrections.change('hard')
  transport.ownsSession.mockReturnValue(false)
  pending.resolve()
  await saving
  expect(controller.getSnapshot().history[0].result).toMatchObject({
    assessment: 'good',
  })
  expect(controller.areWritesBlocked()).toBe(true)
})

it('rejects unfocused, unchanged and unowned requests', async () => {
  const { controller, transport } = await setup()
  await controller.corrections.change('good')
  controller.setForeground(false)
  await controller.corrections.change('hard')
  controller.setForeground(true)
  transport.ownsSession.mockReturnValue(false)
  await controller.corrections.change('hard')
  expect(transport.apply).not.toHaveBeenCalled()
})

it('does not allow a peek-assisted answer to become a successful correction', async () => {
  const transport = makeTransport()
  const controller = makeController(undefined, true, transport)
  controller.transition(openReviewDetails)
  await controller.submit('again')
  controller.transition(previousReviewWord)
  await controller.corrections.change('easy')
  expect(transport.apply).not.toHaveBeenCalled()
})

it('keeps correction writes unavailable without the production transport', async () => {
  const controller = makeController(undefined, true)
  controller.selectOption('word-0')
  await controller.submit('good')
  controller.transition(previousReviewWord)
  await controller.corrections.change('hard')
  expect(controller.corrections.getSnapshot().status).toBe('unavailable')
  expect(controller.areWritesBlocked()).toBe(false)
})
