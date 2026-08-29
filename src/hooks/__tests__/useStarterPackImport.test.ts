import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useStarterPackImport } from '@/hooks/useStarterPackImport'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ToastService } from '@/components/AppToast'
import {
  getStarterPackPreview,
  loadOfficialDutchA1Pack,
} from '@/services/starterPackService'
import type { Collection, Word } from '@/types/database'

jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: {
    getState: jest.fn(),
  },
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: {
    show: jest.fn(),
  },
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
  },
}))
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    back: jest.fn(),
  },
}))

interface MockStoreState {
  currentUserId: string
  collections: Collection[]
  words: Word[]
  error: null
  fetchCollections: jest.Mock<Promise<void>, []>
  createNewCollection: jest.Mock<Promise<Collection | null>, [string]>
  addWordsToCollection: jest.Mock<Promise<boolean>, [string, Partial<Word>[]]>
}

const STARTER_COLLECTION_ID = 'starter-collection-id'

const createCollection = (): Collection => ({
  collection_id: STARTER_COLLECTION_ID,
  user_id: 'user-id',
  name: 'Dutch A1 Essentials',
  description: null,
  updated_at: '2026-08-29T00:00:00.000Z',
  created_at: '2026-08-29T00:00:00.000Z',
  is_shared: false,
  shared_with: null,
  share_token: null,
  shared_at: null,
})

const createExistingWord = (): Word => ({
  ...getStarterPackPreview(loadOfficialDutchA1Pack()).words[0],
  user_id: 'user-id',
  collection_id: STARTER_COLLECTION_ID,
  interval_days: 1,
  repetition_count: 0,
  easiness_factor: 2.5,
  next_review_date: '2026-08-29',
  last_reviewed_at: null,
})

describe('useStarterPackImport', () => {
  let storeState: MockStoreState

  beforeEach(() => {
    jest.clearAllMocks()
    const collection = createCollection()
    storeState = {
      currentUserId: 'user-id',
      collections: [],
      words: [],
      error: null,
      fetchCollections: jest.fn().mockResolvedValue(undefined),
      createNewCollection: jest.fn().mockResolvedValue(collection),
      addWordsToCollection: jest.fn(async (_collectionId, words) => {
        storeState = {
          ...storeState,
          words: [
            ...storeState.words,
            ...words.map((word, index) => ({
              ...createExistingWord(),
              ...word,
              word_id: `imported-${index}`,
            })),
          ],
        }
        return true
      }),
    }
    ;(useApplicationStore.getState as jest.Mock).mockImplementation(
      () => storeState
    )
  })

  const renderAndWait = async () => {
    const hook = renderHook(() => useStarterPackImport())
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('previews offline content without mutating the library', async () => {
    const { result } = await renderAndWait()

    expect(result.current.previewData?.words).toHaveLength(53)
    expect(result.current.selectedCount).toBe(53)
    expect(storeState.createNewCollection).not.toHaveBeenCalled()
    expect(storeState.addWordsToCollection).not.toHaveBeenCalled()
  })

  it('imports only the selected entry after an explicit action', async () => {
    const { result } = await renderAndWait()

    act(() => result.current.toggleSelectAll())
    act(() => result.current.toggleWordSelection('a1-035-opstaan'))
    expect(result.current.selectedCount).toBe(1)

    await act(async () => {
      await result.current.handleImport()
    })

    expect(storeState.createNewCollection).toHaveBeenCalledWith(
      'Dutch A1 Essentials'
    )
    expect(storeState.addWordsToCollection).toHaveBeenCalledWith(
      STARTER_COLLECTION_ID,
      [
        expect.objectContaining({
          dutch_lemma: 'opstaan',
          interval_days: 0,
          repetition_count: 0,
          easiness_factor: 2.5,
          last_reviewed_at: null,
        }),
      ]
    )
    const importedWord = storeState.addWordsToCollection.mock.calls[0][1][0]
    expect(importedWord).not.toHaveProperty('word_id')
    expect(importedWord).not.toHaveProperty('user_id')
    expect(result.current.success).toEqual(
      expect.objectContaining({ importedCount: 1 })
    )
    expect(ToastService.show).toHaveBeenCalledWith(
      'Successfully imported 1 word',
      expect.any(String)
    )
  })

  it('hides existing semantic duplicates on repeated import', async () => {
    const collection = createCollection()
    storeState = {
      ...storeState,
      collections: [collection],
      words: [createExistingWord()],
    }

    const { result } = await renderAndWait()

    expect(result.current.duplicateCount).toBe(1)
    expect(result.current.wordSelections).toHaveLength(52)
    expect(result.current.selectedCount).toBe(52)
  })

  it('reports a collection creation failure without completing the import', async () => {
    storeState.createNewCollection.mockResolvedValue(null)
    const { result } = await renderAndWait()

    await act(async () => {
      await result.current.handleImport()
    })

    expect(storeState.addWordsToCollection).not.toHaveBeenCalled()
    expect(result.current.success).toBeNull()
    expect(ToastService.show).toHaveBeenCalledWith(
      'Unable to create or resolve the target collection',
      expect.any(String)
    )
  })

  it('reports a store import failure without showing success', async () => {
    storeState.addWordsToCollection.mockResolvedValue(false)
    const { result } = await renderAndWait()

    await act(async () => {
      await result.current.handleImport()
    })

    expect(result.current.success).toBeNull()
    expect(ToastService.show).toHaveBeenCalledWith(
      'Starter pack import failed',
      expect.any(String)
    )
  })
})
