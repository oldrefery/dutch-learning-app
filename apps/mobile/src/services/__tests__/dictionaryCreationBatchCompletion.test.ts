import { completeCreationBatchItem } from '../dictionaryCreationBatchCompletion'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useBatchCaptureStore } from '@/stores/useBatchCaptureStore'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'
import type { CachedDictionaryEffectiveCard } from '@/db/dictionaryFollowingRepository'
import {
  createMockWord,
  createMockCollection,
} from '@/__tests__/helpers/factories'
import {
  CREATION_OWNER as OWNER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationPublishedFixture as published,
  creationAdoptionFixture as adoption,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'
jest.mock('@/db/wordRepository', () => ({
  wordRepository: { getWordByIdAndUserId: jest.fn() },
}))
jest.mock('@/db/dictionaryFollowingRepository', () => ({
  dictionaryFollowingRepository: { getCachedCards: jest.fn() },
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
jest.mock('@/stores/useBatchCaptureStore', () => ({
  useBatchCaptureStore: { getState: jest.fn() },
}))
const completeItem = jest.fn()
const ITEM_ID = 'batch-item'
const makeRow = () => {
  const draft = prepared(initial())
  const row = adoption(
    published({ ...draft, session: { ...draft.session, submitted: true } })
  )
  return {
    ...row,
    adoption: {
      ...row.adoption!,
      submitted: true,
      response: {
        protocol_version: 2 as const,
        operation_id: id(7),
        word_id: id(8),
        idempotent: false,
        outcome: 'inserted' as const,
        existing_word_id: null,
        reference: { entry_id: id(5), revision_id: id(6) },
        applied_reference: { entry_id: id(5), revision_id: id(6) },
        applied_head_sequence: '9007199254740995',
      },
    },
  }
}
let row: ReturnType<typeof makeRow>
let word: ReturnType<typeof createMockWord>
let personal: ReturnType<typeof createMockWord> | null
let app: {
  currentUserId: string
  words: (typeof word)[]
  collections: ReturnType<typeof createMockCollection>[]
}
let item: { id: string; dutchText: string; status: string }
let batch: {
  ownerUserId: string
  targetCollectionId: string
  items: (typeof item)[]
  completeItem: typeof completeItem
}
const context = {
  ownerId: OWNER,
  itemId: ITEM_ID,
  originalQuery: 'bank',
  targetCollectionId: id(9),
}
beforeEach(() => {
  jest.clearAllMocks()
  row = makeRow()
  word = createMockWord({
    word_id: id(8),
    user_id: OWNER,
    collection_id: id(9),
    interval_days: 11,
    repetition_count: 7,
    dictionary_content_source: 'following',
    dictionary_content_state: {
      protocol_version: 2,
      mode: 'follow',
      content_version: 'v2:test',
      reference: { entry_id: id(5), revision_id: id(6) },
      adopted_revision_id: id(6),
      head_sequence: '9007199254740995',
      watermark: '9007199254740995',
    },
  })
  personal = word
  app = {
    currentUserId: OWNER,
    words: [word],
    collections: [
      createMockCollection({ collection_id: id(9), user_id: OWNER }),
    ],
  }
  item = { id: ITEM_ID, dutchText: ' BANK ', status: 'awaiting_review' }
  batch = {
    ownerUserId: OWNER,
    targetCollectionId: id(9),
    items: [item],
    completeItem,
  }
  jest
    .mocked(wordRepository.getWordByIdAndUserId)
    .mockImplementation(async () => personal as never)
  jest.mocked(dictionaryFollowingRepository.getCachedCards).mockImplementation(
    async () =>
      new Map(
        word.dictionary_content_state
          ? [
              [
                id(8),
                {
                  card: { ...word.dictionary_content_state, word_id: id(8) },
                } as unknown as CachedDictionaryEffectiveCard,
              ],
            ]
          : []
      )
  )
  jest
    .mocked(useApplicationStore.getState)
    .mockImplementation(() => app as never)
  jest
    .mocked(useBatchCaptureStore.getState)
    .mockImplementation(() => batch as never)
})
it('completes only the exact loaded inserted item without changing SRS or the personal row', async () => {
  const before = JSON.stringify(word)
  await completeCreationBatchItem(row, context, () => {})
  expect(completeItem).toHaveBeenCalledWith(ITEM_ID)
  expect(JSON.stringify(word)).toBe(before)
})
it.each([
  'owner',
  'batch-owner',
  'query',
  'saved-query',
  'target',
  'missing-card',
  'missing-content',
  'stale-content',
  'different-meaning',
  'private-mode',
  'cancelled',
  'skipped',
  'completed',
] as const)('rejects %s without completing the queue item', async reason => {
  if (reason === 'owner') app.currentUserId = id(99)
  if (reason === 'batch-owner') batch.ownerUserId = id(99)
  if (reason === 'query') item.dutchText = 'huis'
  if (reason === 'saved-query') row.session.request.original_query = 'huis'
  if (reason === 'target') batch.targetCollectionId = id(99)
  if (reason === 'missing-card') personal = null
  if (reason === 'missing-content') word.dictionary_content_state = undefined
  if (reason === 'stale-content')
    word.dictionary_content_state!.head_sequence = '1'
  if (reason === 'different-meaning')
    word.dictionary_content_state!.reference!.entry_id = id(99)
  if (reason === 'private-mode') word.dictionary_content_state!.mode = 'legacy'
  if (['cancelled', 'skipped', 'completed'].includes(reason))
    item.status = reason
  await expect(
    completeCreationBatchItem(row, context, () => {})
  ).rejects.toThrow()
  expect(completeItem).not.toHaveBeenCalled()
})
it('does not complete a publication without the adoption receipt', async () => {
  await expect(
    completeCreationBatchItem({ ...row, adoption: null }, context, () => {})
  ).rejects.toThrow('confirmed inserted')
  expect(completeItem).not.toHaveBeenCalled()
})
it('checks the mounted owner again immediately before the queue write', async () => {
  let calls = 0
  await expect(
    completeCreationBatchItem(row, context, () => {
      if (++calls === 3) throw new Error('Context changed')
    })
  ).rejects.toThrow('Context changed')
  expect(completeItem).not.toHaveBeenCalled()
})

it('uses persisted personal/card data when the application word list has not refreshed', async () => {
  app.words = []
  await completeCreationBatchItem(row, context, () => {})
  expect(wordRepository.getWordByIdAndUserId).toHaveBeenCalledWith(id(8), OWNER)
  expect(dictionaryFollowingRepository.getCachedCards).toHaveBeenCalledWith(
    OWNER,
    [id(8)]
  )
  expect(completeItem).toHaveBeenCalledWith(ITEM_ID)
})
