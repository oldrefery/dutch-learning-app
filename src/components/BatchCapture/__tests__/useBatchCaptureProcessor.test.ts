import { act, renderHook } from '@testing-library/react-native'
import { useBatchCaptureProcessor } from '../useBatchCaptureProcessor'
import { wordService } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  INITIAL_BATCH_CAPTURE_STATE,
  useBatchCaptureStore,
} from '@/stores/useBatchCaptureStore'
import { ErrorCategory, ErrorSeverity, NetworkError } from '@/types/ErrorTypes'
import type { BatchCaptureItem } from '@/types/BatchCaptureTypes'
import type { Collection } from '@/types/database'

const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))
jest.mock('@/lib/supabase', () => ({
  wordService: {
    findWordByLemma: jest.fn(),
  },
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: {
    getState: jest.fn(),
  },
}))

const timestamp = '2026-08-29T00:00:00.000Z'
const item: BatchCaptureItem = {
  id: 'item-1',
  dutchText: 'huis',
  translationHint: 'house',
  sourceLine: 1,
  status: 'queued',
  error: null,
  duplicate: null,
  createdAt: timestamp,
  updatedAt: timestamp,
}
const collection: Collection = {
  collection_id: 'collection-1',
  user_id: 'user-1',
  name: 'My Words',
  description: null,
  updated_at: timestamp,
  created_at: timestamp,
  is_shared: false,
  shared_with: null,
  share_token: null,
  shared_at: null,
}

const mockedFindWordByLemma =
  wordService.findWordByLemma as jest.MockedFunction<
    typeof wordService.findWordByLemma
  >
const mockedGetApplicationState = useApplicationStore.getState as jest.Mock

const renderProcessor = (isConnected: boolean | null = true) =>
  renderHook(() =>
    useBatchCaptureProcessor({
      currentUserId: 'user-1',
      isConnected,
      collections: [collection],
      targetCollectionId: collection.collection_id,
    })
  )

describe('useBatchCaptureProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useBatchCaptureStore.setState({
      ...INITIAL_BATCH_CAPTURE_STATE,
      ownerUserId: 'user-1',
      targetCollectionId: collection.collection_id,
      items: [item],
      isPaused: false,
    })
    mockedGetApplicationState.mockReturnValue({ words: [] })
    mockedFindWordByLemma.mockResolvedValue(null)
  })

  it('keeps an offline item queued without making a remote request', async () => {
    const { result } = renderProcessor(false)

    await act(async () => result.current.processItem(item))

    expect(mockedFindWordByLemma).not.toHaveBeenCalled()
    expect(useBatchCaptureStore.getState().items[0]).toEqual(
      expect.objectContaining({
        status: 'queued',
        error: 'Waiting for an internet connection.',
      })
    )
  })

  it('pauses for a local duplicate without spending an AI request', async () => {
    mockedGetApplicationState.mockReturnValue({
      words: [
        {
          word_id: 'local-word-1',
          dutch_lemma: 'HUIS',
          collection_id: collection.collection_id,
        },
      ],
    })
    const { result } = renderProcessor()

    await act(async () => result.current.processItem(item))

    expect(mockedFindWordByLemma).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(useBatchCaptureStore.getState()).toEqual(
      expect.objectContaining({
        isPaused: true,
        items: [
          expect.objectContaining({
            status: 'possible_duplicate',
            duplicate: expect.objectContaining({
              wordId: 'local-word-1',
              collectionName: 'My Words',
            }),
          }),
        ],
      })
    )
  })

  it('opens exactly one explicit review after duplicate checks pass', async () => {
    const { result } = renderProcessor()

    await act(async () => result.current.processItem(item))

    expect(mockedFindWordByLemma).toHaveBeenCalledWith('user-1', 'huis')
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          batchItemId: 'item-1',
          initialWord: 'huis',
          translationHint: 'house',
        }),
      })
    )
    expect(useBatchCaptureStore.getState().items[0].status).toBe('analyzing')
  })

  it('returns connectivity errors to the queue for a later resume', async () => {
    mockedFindWordByLemma.mockRejectedValue(
      new NetworkError('Offline during lookup')
    )
    const { result } = renderProcessor()

    await act(async () => result.current.processItem(item))

    expect(useBatchCaptureStore.getState().items[0]).toEqual(
      expect.objectContaining({
        status: 'queued',
        error: 'Waiting for an internet connection.',
      })
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('isolates a non-network error to the affected item and pauses', async () => {
    mockedFindWordByLemma.mockRejectedValue({
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.ERROR,
      message: 'Rate limited',
      userMessage: 'Please try again later.',
      isRetryable: true,
    })
    const { result } = renderProcessor()

    await act(async () => result.current.processItem(item))

    expect(useBatchCaptureStore.getState()).toEqual(
      expect.objectContaining({
        isPaused: true,
        activeItemId: null,
        items: [
          expect.objectContaining({
            status: 'failed',
            error: 'Please try again later.',
          }),
        ],
      })
    )
  })
})
