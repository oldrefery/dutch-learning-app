import {
  normalizeDictionaryMeaningQuery,
  parseCreationJournalRow,
  requireFollowingImportCard,
  type DictionaryCreationJournalRow,
} from '@woordenaar/domain'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useBatchCaptureStore } from '@/stores/useBatchCaptureStore'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'

/** Called only after receipt-bound personal and shared hydration succeeds. */
export async function completeCreationBatchItem(
  row: DictionaryCreationJournalRow,
  context: {
    ownerId: string
    itemId: string
    originalQuery: string
    targetCollectionId?: string
  },
  assertCurrent: () => void
): Promise<void> {
  assertCurrent()
  const saved = parseCreationJournalRow(row)
  const adoption = saved.adoption
  if (!adoption?.submitted || adoption.response?.outcome !== 'inserted')
    throw new Error('A confirmed inserted card is required')
  if (saved.session.user_id !== context.ownerId)
    throw new Error('Batch capture owner changed')
  const [word, cache] = await Promise.all([
    wordRepository.getWordByIdAndUserId(
      adoption.request.word_id,
      context.ownerId
    ),
    dictionaryFollowingRepository.getCachedCards(context.ownerId, [
      adoption.request.word_id,
    ]),
  ])
  assertCurrent()
  requireFollowingImportCard(
    {
      user_id: context.ownerId,
      kind: 'import',
      request: adoption.request,
      result: adoption.response,
    },
    cache.get(adoption.request.word_id)?.card
  )
  const app = useApplicationStore.getState()
  const batch = useBatchCaptureStore.getState()
  const item = batch.items.find(value => value.id === context.itemId)
  const query = normalizeDictionaryMeaningQuery(context.originalQuery)
  if (
    app.currentUserId !== context.ownerId ||
    saved.session.user_id !== context.ownerId ||
    batch.ownerUserId !== context.ownerId ||
    !item ||
    ['completed', 'skipped', 'cancelled'].includes(item.status) ||
    normalizeDictionaryMeaningQuery(item.dutchText) !== query ||
    normalizeDictionaryMeaningQuery(saved.session.request.original_query) !==
      query
  )
    throw new Error('Batch capture context changed')
  const target = adoption.request.collection_id
  if (
    (context.targetCollectionId && context.targetCollectionId !== target) ||
    (batch.targetCollectionId && batch.targetCollectionId !== target) ||
    !app.collections.some(
      value =>
        value.collection_id === target && value.user_id === context.ownerId
    )
  )
    throw new Error('Batch capture destination changed')
  if (word?.user_id !== context.ownerId || word.collection_id !== target)
    throw new Error(
      'Batch personal card must be loaded in its original collection'
    )
  assertCurrent()
  batch.completeItem(context.itemId)
}
