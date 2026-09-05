import { act } from '@testing-library/react-native'
import {
  INITIAL_BATCH_CAPTURE_STATE,
  useBatchCaptureStore,
} from '@/stores/useBatchCaptureStore'

const COLLECTION_ID = 'collection-1'
const TIMESTAMP = '2026-08-29T00:00:00.000Z'

jest.mock('expo-crypto', () => ({
  randomUUID: jest
    .fn()
    .mockReturnValueOnce('item-1')
    .mockReturnValueOnce('item-2'),
}))

describe('useBatchCaptureStore', () => {
  beforeEach(() => {
    useBatchCaptureStore.setState(INITIAL_BATCH_CAPTURE_STATE)
  })

  it('creates a user-scoped paused queue', () => {
    act(() => {
      useBatchCaptureStore.getState().createQueue(
        'user-1',
        [
          { dutchText: 'huis', translationHint: 'home', sourceLine: 1 },
          { dutchText: 'boek', translationHint: null, sourceLine: 2 },
        ],
        COLLECTION_ID
      )
    })

    expect(useBatchCaptureStore.getState()).toEqual(
      expect.objectContaining({
        ownerUserId: 'user-1',
        targetCollectionId: COLLECTION_ID,
        isPaused: true,
        activeItemId: null,
        items: [
          expect.objectContaining({ id: 'item-1', status: 'queued' }),
          expect.objectContaining({ id: 'item-2', status: 'queued' }),
        ],
      })
    )
  })

  it('clears persisted drafts when the signed-in owner changes', () => {
    useBatchCaptureStore.setState({
      ownerUserId: 'user-1',
      targetCollectionId: COLLECTION_ID,
      items: [
        {
          id: 'item-1',
          dutchText: 'huis',
          translationHint: null,
          sourceLine: 1,
          status: 'queued',
          error: null,
          duplicate: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      isPaused: false,
      activeItemId: 'item-1',
    })

    act(() => useBatchCaptureStore.getState().ensureOwner('user-2'))

    expect(useBatchCaptureStore.getState()).toEqual(
      expect.objectContaining({
        ownerUserId: 'user-2',
        targetCollectionId: null,
        items: [],
        isPaused: true,
        activeItemId: null,
      })
    )
  })

  it('recovers transient work after restart without losing queued content', () => {
    useBatchCaptureStore.setState({
      ownerUserId: 'user-1',
      items: [
        {
          id: 'item-1',
          dutchText: 'huis',
          translationHint: null,
          sourceLine: 1,
          status: 'awaiting_review',
          error: null,
          duplicate: null,
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ],
      isPaused: false,
      activeItemId: 'item-1',
    })

    act(() => useBatchCaptureStore.getState().recoverInterruptedItems())

    expect(useBatchCaptureStore.getState()).toEqual(
      expect.objectContaining({
        isPaused: true,
        activeItemId: null,
        items: [
          expect.objectContaining({
            id: 'item-1',
            status: 'queued',
            error: 'Previous analysis was interrupted. Ready to resume.',
          }),
        ],
      })
    )
  })

  it('resumes partial completion without resetting already saved items', () => {
    const baseItem = {
      translationHint: null,
      sourceLine: 1,
      error: null,
      duplicate: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    }
    useBatchCaptureStore.setState({
      items: [
        {
          ...baseItem,
          id: 'item-1',
          dutchText: 'huis',
          status: 'completed',
        },
        {
          ...baseItem,
          id: 'item-2',
          dutchText: 'boek',
          status: 'analyzing',
        },
      ],
      isPaused: false,
      activeItemId: 'item-2',
    })

    act(() => useBatchCaptureStore.getState().recoverInterruptedItems())

    expect(useBatchCaptureStore.getState().items).toEqual([
      expect.objectContaining({ id: 'item-1', status: 'completed' }),
      expect.objectContaining({ id: 'item-2', status: 'queued' }),
    ])
  })

  it('keeps completed items when the remaining queue is cancelled', () => {
    const baseItem = {
      translationHint: null,
      sourceLine: 1,
      error: null,
      duplicate: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    }
    useBatchCaptureStore.setState({
      items: [
        {
          ...baseItem,
          id: 'item-1',
          dutchText: 'huis',
          status: 'completed',
        },
        {
          ...baseItem,
          id: 'item-2',
          dutchText: 'boek',
          status: 'failed',
        },
      ],
      isPaused: false,
      activeItemId: 'item-2',
    })

    act(() => useBatchCaptureStore.getState().cancelRemaining())

    expect(useBatchCaptureStore.getState().items).toEqual([
      expect.objectContaining({ id: 'item-1', status: 'completed' }),
      expect.objectContaining({ id: 'item-2', status: 'cancelled' }),
    ])
    expect(useBatchCaptureStore.getState().isPaused).toBe(true)
  })
})
