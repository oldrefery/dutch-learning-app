import { makeController } from './fixtures'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'
const command: ReviewCorrectionCommand = {
  correction_id: 'old-edit',
  event_id: 'old-event',
  word_id: 'word-0',
  user_id: 'review-qa',
  expected_revision: 2,
  assessment: 'easy',
}
function setup() {
  const transport = {
    ownsSession: jest.fn(() => true),
    loadPending: jest.fn().mockResolvedValue(null),
    apply: jest.fn().mockResolvedValue({
      kind: 'confirmed',
      result: {
        eventId: 'old-event',
        wordId: 'word-0',
        revision: 3,
        assessment: 'easy',
      },
    }),
    keepServer: jest.fn().mockResolvedValue(null),
    cancelUnqueued: jest.fn().mockResolvedValue(true),
  }
  return { transport, controller: makeController(undefined, true, transport) }
}
it('blocks writes until SQLite restoration completes, with no network requirement', async () => {
  const { controller, transport } = setup()
  controller.selectOption('word-0')
  expect(controller.getSnapshot().active!.selectedOptionId).toBeNull()
  expect(controller.exit()).toBe(false)
  await controller.corrections.restore()
  expect(controller.areWritesBlocked()).toBe(false)
  expect(transport.apply).not.toHaveBeenCalled()
})
it('restores a pending correction from a previous session without recreating its review', async () => {
  const { controller, transport } = setup()
  transport.loadPending.mockResolvedValueOnce({ ...command, status: 'synced' })
  await controller.corrections.restore()
  expect(controller.areWritesBlocked()).toBe(true)
  await controller.corrections.retry()
  expect(transport.apply).toHaveBeenCalledWith(command)
  expect(controller.getSnapshot().history).toEqual([])
  expect(controller.areWritesBlocked()).toBe(false)
})
it('restores conflicts and requires explicit resolution', async () => {
  const { controller, transport } = setup()
  transport.loadPending.mockResolvedValueOnce({
    ...command,
    status: 'conflict',
  })
  await controller.corrections.restore()
  expect(controller.corrections.getSnapshot().status).toBe('conflict')
  expect(transport.keepServer).not.toHaveBeenCalled()
  await controller.corrections.keepServer()
  expect(transport.keepServer).toHaveBeenCalledWith(command)
  expect(controller.areWritesBlocked()).toBe(false)
})
it('keeps writes blocked after a disk read error and retries restoration', async () => {
  const { controller, transport } = setup()
  transport.loadPending.mockRejectedValueOnce(new Error('disk error'))
  await controller.corrections.restore()
  expect(controller.corrections.getSnapshot().status).toBe('loadFailed')
  expect(controller.areWritesBlocked()).toBe(true)
  await controller.corrections.retry()
  expect(controller.areWritesBlocked()).toBe(false)
})
it('refuses a foreign recovered command', async () => {
  const { controller, transport } = setup()
  transport.loadPending.mockResolvedValue({
    ...command,
    user_id: 'other',
    status: 'pending',
  })
  await controller.corrections.restore()
  expect(controller.areWritesBlocked()).toBe(true)
  expect(transport.apply).not.toHaveBeenCalled()
})
it('does not cancel a durable operation but can leave a never-saved attempt', async () => {
  const { controller, transport } = setup()
  transport.loadPending.mockResolvedValueOnce({ ...command, status: 'pending' })
  await controller.corrections.restore()
  transport.cancelUnqueued.mockResolvedValueOnce(false)
  await controller.corrections.cancelUnqueued()
  expect(controller.areWritesBlocked()).toBe(true)
  await controller.corrections.cancelUnqueued()
  expect(controller.areWritesBlocked()).toBe(false)
})
