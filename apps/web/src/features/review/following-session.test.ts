import { createReviewSessionController } from './session-controller'
import { mapReviewSnapshot } from './repository'
import { followingSnapshot } from '@/features/dictionary/__fixtures__/following'
import { successfulResult } from './__fixtures__/session'

jest.mock('server-only', () => ({}))

const updatedSnapshot = () => {
  const snapshot = followingSnapshot()
  return mapReviewSnapshot({
    ...snapshot,
    dictionaryContent: {
      ...snapshot.dictionaryContent,
      watermark: '9007199254740995',
      cards: snapshot.dictionaryContent.cards.map(card => ({
        ...card,
        head_sequence: '9007199254740995',
        reference: { ...card.reference, revision_id: card.adopted_revision_id },
      })),
      revisions: snapshot.dictionaryContent.revisions.map(revision => ({
        ...revision,
        revision_id: snapshot.dictionaryContent.cards[0].adopted_revision_id,
        revision_no: 1,
        content: {
          ...revision.content,
          translations: { en: ['earlier published analysis'], ru: [] },
        },
      })),
    },
  })
}

const controllerFor = () => {
  const controller = createReviewSessionController(
    'synthetic-owner',
    mapReviewSnapshot(followingSnapshot()),
    jest.fn(async input => successfulResult(input.wordId)),
    { submit: jest.fn(), refresh: jest.fn() }
  )
  controller.attach()
  return controller
}

it('freezes content/revision and personal learning during a session, then adopts a rollback at the next boundary', async () => {
  const controller = controllerFor()
  await controller.start('all-due', null, 'meaning-recall', false)
  const active = controller.getSnapshot().flow!.active!
  const word = active.question.payload.word
  expect(controller.refreshWorkspace(updatedSnapshot())).toBe(false)
  expect(controller.getSnapshot().flow!.active).toBe(active)
  expect(word.translations).toEqual({ en: ['dwelling'], ru: [] })
  expect(word.dictionary?.reference?.revision_id).toBe(
    '22222222-2222-4222-8222-222222222222'
  )
  expect(word.repetitionCount).toBe(12)
  expect(controller.exit()).toBe(true)
  expect(controller.refreshWorkspace(updatedSnapshot())).toBe(true)
  await controller.start('all-due', null, 'meaning-recall', false)
  const nextWord = controller.getSnapshot().flow!.active!.question.payload.word
  expect(nextWord.translations).toEqual({
    en: ['earlier published analysis'],
    ru: [],
  })
  expect(nextWord.dictionary?.reference?.revision_id).toBe(
    '33333333-3333-4333-8333-333333333333'
  )
  expect(nextWord.repetitionCount).toBe(12)
  controller.detach()
})

it('rejects a late older snapshot and a legacy downgrade without rounding decimal cursors', () => {
  const controller = controllerFor()
  expect(controller.refreshWorkspace(updatedSnapshot())).toBe(true)
  const fresh = controller.getSnapshot()
  expect(
    controller.refreshWorkspace(mapReviewSnapshot(followingSnapshot()))
  ).toBe(false)
  expect(
    controller.refreshWorkspace({
      ...updatedSnapshot(),
      dictionaryWatermark: undefined,
    })
  ).toBe(false)
  expect(controller.getSnapshot()).toBe(fresh)
  expect(fresh.dictionaryWatermark).toBe('9007199254740995')
  controller.detach()
})

it('keeps snapshot content stable while question preparation is in progress', async () => {
  const controller = controllerFor()
  const preparation = controller.start('all-due', null, 'meaning-recall', false)
  expect(controller.refreshWorkspace(updatedSnapshot())).toBe(false)
  await preparation
  expect(controller.getSnapshot().words[0].translations).toEqual({
    en: ['dwelling'],
    ru: [],
  })
  controller.detach()
})

it('copies revision metadata into questions so later cache object mutations cannot change an active question', async () => {
  const data = mapReviewSnapshot(followingSnapshot())
  const controller = createReviewSessionController(
    'synthetic-owner',
    data,
    jest.fn(async input => successfulResult(input.wordId)),
    { submit: jest.fn(), refresh: jest.fn() }
  )
  controller.attach()
  await controller.start('all-due', null, 'meaning-recall', false)
  const dictionary = data.words[0].dictionary!
  dictionary.reference!.revision_id = '33333333-3333-4333-8333-333333333333'
  dictionary.cefr.status = 'unknown'
  dictionary.cefr.level = null
  expect(
    controller.getSnapshot().flow!.active!.question.payload.word.dictionary
  ).toMatchObject({
    reference: { revision_id: '22222222-2222-4222-8222-222222222222' },
    cefr: { status: 'reviewed', level: 'A1' },
  })
  controller.detach()
})
