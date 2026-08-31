import { parseWordAnalysis } from '../analysis/analysis-contract'
import {
  createBatchCaptureState,
  createEmptyBatchCaptureState,
  recoverBatchCaptureState,
  serializeBatchCaptureState,
  updateBatchCaptureItem,
} from './batch-capture-domain'

const USER_ID = 'user-1'
const COLLECTION_ID = 'collection-1'
const NOW = '2026-08-30T12:00:00.000Z'

const createAnalysis = () =>
  parseWordAnalysis({
    dutch_lemma: 'huis',
    dutch_original: 'huis',
    part_of_speech: 'noun',
    article: 'het',
    translations: { en: ['house'] },
    examples: [{ nl: 'Dit is mijn huis.', en: 'This is my house.' }],
  })

describe('web batch capture domain', () => {
  it('creates a paused user-scoped queue with stable metadata', () => {
    const ids = ['item-1', 'item-2']
    const state = createBatchCaptureState(
      USER_ID,
      COLLECTION_ID,
      [
        { dutchText: 'huis', translationHint: 'house', sourceLine: 1 },
        { dutchText: 'boek', translationHint: null, sourceLine: 2 },
      ],
      () => ids.shift() ?? 'missing',
      NOW
    )

    expect(state).toEqual(
      expect.objectContaining({
        ownerUserId: USER_ID,
        targetCollectionId: COLLECTION_ID,
        isPaused: true,
        items: [
          expect.objectContaining({ id: 'item-1', status: 'queued' }),
          expect.objectContaining({ id: 'item-2', status: 'queued' }),
        ],
      })
    )
  })

  it('drops a queue that belongs to another authenticated user', () => {
    const recovered = recoverBatchCaptureState(
      { version: 1, ownerUserId: 'user-2', items: [] },
      USER_ID,
      [COLLECTION_ID],
      COLLECTION_ID,
      NOW
    )

    expect(recovered).toEqual(
      createEmptyBatchCaptureState(USER_ID, COLLECTION_ID)
    )
  })

  it('recovers network work as queued while preserving a completed item', () => {
    const value = {
      version: 1,
      ownerUserId: USER_ID,
      targetCollectionId: COLLECTION_ID,
      items: [
        {
          id: 'item-1',
          dutchText: 'huis',
          translationHint: null,
          sourceLine: 1,
          status: 'analyzing',
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 'item-2',
          dutchText: 'boek',
          translationHint: null,
          sourceLine: 2,
          status: 'completed',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }

    const recovered = recoverBatchCaptureState(
      value,
      USER_ID,
      [COLLECTION_ID],
      COLLECTION_ID,
      NOW
    )

    expect(recovered.items).toEqual([
      expect.objectContaining({
        id: 'item-1',
        status: 'queued',
        error: 'Previous analysis was interrupted. Ready to resume.',
      }),
      expect.objectContaining({ id: 'item-2', status: 'completed' }),
    ])
    expect(recovered.isPaused).toBe(true)
  })

  it('round-trips an awaiting-review analysis through persisted JSON', () => {
    const base = createBatchCaptureState(
      USER_ID,
      COLLECTION_ID,
      [{ dutchText: 'huis', translationHint: 'house', sourceLine: 1 }],
      () => 'item-1',
      NOW
    )
    const withAnalysis = {
      ...base,
      items: updateBatchCaptureItem(
        base.items,
        'item-1',
        {
          status: 'awaiting_review',
          analysis: createAnalysis(),
          analysisMetadata: {
            source: 'cache',
            cacheHit: true,
            forceRefresh: false,
            usageCount: 2,
          },
        },
        NOW
      ),
    }

    const recovered = recoverBatchCaptureState(
      serializeBatchCaptureState(withAnalysis),
      USER_ID,
      [COLLECTION_ID],
      COLLECTION_ID,
      NOW
    )

    expect(recovered.items[0]).toEqual(
      expect.objectContaining({
        status: 'awaiting_review',
        analysis: expect.objectContaining({
          dutchLemma: 'huis',
          article: 'het',
        }),
        analysisMetadata: expect.objectContaining({ cacheHit: true }),
      })
    )
  })
})
