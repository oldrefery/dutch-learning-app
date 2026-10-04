import { createReviewSessionController } from './session-controller'
import { makeData, successfulResult } from './__fixtures__/session'

it('adopts fresh content at setup and freezes a running session until an explicit boundary', async () => {
  const data = { ...makeData(), dictionaryContentEnabled: true }
  const controller = createReviewSessionController(
    'test-user',
    data,
    jest.fn(async input => successfulResult(input.wordId)),
    { submit: jest.fn(), refresh: jest.fn() }
  )
  controller.attach()
  const updated = {
    ...data,
    words: data.words.map(word => ({ ...word, dutchLemma: 'updated' })),
  }
  expect(controller.refreshWorkspace(updated)).toBe(true)
  await controller.start('all-due', null, 'meaning-recall', false)
  const active = controller.getSnapshot().flow!.active
  expect(active!.question.payload.word.dutchLemma).toBe('updated')
  const newer = {
    ...data,
    words: data.words.map(word => ({ ...word, dutchLemma: 'newer' })),
  }
  expect(controller.refreshWorkspace(newer)).toBe(false)
  expect(controller.getSnapshot().flow!.active).toBe(active)
  expect(controller.getSnapshot().words[0].dutchLemma).toBe('updated')
  expect(controller.exit()).toBe(true)
  expect(controller.refreshWorkspace(newer)).toBe(true)
  await controller.start('all-due', null, 'meaning-recall', false)
  expect(
    controller.getSnapshot().flow!.active!.question.payload.word.dutchLemma
  ).toBe('newer')
  controller.detach()
})
