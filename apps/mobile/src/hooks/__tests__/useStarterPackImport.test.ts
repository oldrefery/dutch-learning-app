import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useStarterPackImport } from '@/hooks/useStarterPackImport'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { ToastService } from '@/components/AppToast'
import {
  getStarterPackPreview,
  loadOfficialDutchA1Pack,
} from '@/services/starterPackService'
import { officialContentCatalogService } from '@/services/officialContentCatalogService'
import { Sentry } from '@/lib/sentry'
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
jest.mock('@/services/officialContentCatalogService', () => ({
  officialContentCatalogService: {
    getPack: jest.fn(),
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
  userAccessLevel: 'full_access' | 'read_only'
  collections: Collection[]
  words: Word[]
  error: null
  fetchCollections: jest.Mock<Promise<void>, []>
  createNewCollection: jest.Mock<Promise<Collection | null>, [string]>
  deleteCollection: jest.Mock<Promise<void>, [string]>
  addWordsToCollection: jest.Mock<Promise<boolean>, [string, Partial<Word>[]]>
}

const STARTER_COLLECTION_ID = 'starter-collection-id'
const REMOTE_A2_PACK_ID = 'dutch-a2-01'

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

const createRemoteManifest = (packId: string, title: string) => ({
  ...loadOfficialDutchA1Pack(),
  pack_id: packId,
  version: '1.0.0',
  title,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('useStarterPackImport', () => {
  let storeState: MockStoreState

  beforeEach(() => {
    jest.clearAllMocks()
    const collection = createCollection()
    storeState = {
      currentUserId: 'user-id',
      userAccessLevel: 'full_access',
      collections: [],
      words: [],
      error: null,
      fetchCollections: jest.fn().mockResolvedValue(undefined),
      createNewCollection: jest.fn().mockResolvedValue(collection),
      deleteCollection: jest.fn().mockResolvedValue(undefined),
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

    expect(result.current.previewData?.words).toHaveLength(60)
    expect(result.current.selectedCount).toBe(60)
    expect(storeState.createNewCollection).not.toHaveBeenCalled()
    expect(storeState.addWordsToCollection).not.toHaveBeenCalled()
  })

  it('downloads a selected remote pack before preparing its import', async () => {
    const manifest = createRemoteManifest(
      'official-dutch-a2-frequency-1',
      'Dutch A2 · 1'
    )
    jest.mocked(officialContentCatalogService.getPack).mockResolvedValue({
      manifest: manifest as never,
      source: 'network',
    })

    const { result } = renderHook(() =>
      useStarterPackImport({
        packId: manifest.pack_id,
        version: manifest.version,
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(officialContentCatalogService.getPack).toHaveBeenCalledWith(
      manifest.pack_id,
      manifest.version
    )
    expect(result.current.manifest?.title).toBe('Dutch A2 · 1')
    expect(result.current.previewData?.words).toHaveLength(60)
  })

  it('rejects an incomplete remote route without leaving the screen loading', async () => {
    const { result } = renderHook(() =>
      useStarterPackImport({ packId: REMOTE_A2_PACK_ID })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.manifest).toBeNull()
    expect(result.current.error).toBe(
      'The selected official pack link is incomplete.'
    )
    expect(officialContentCatalogService.getPack).not.toHaveBeenCalled()
  })

  it('ignores a stale A response that finishes after B', async () => {
    const manifestA = createRemoteManifest(
      REMOTE_A2_PACK_ID,
      'Dutch A2 · Pack 01'
    )
    const manifestB = createRemoteManifest('dutch-b1-01', 'Dutch B1 · Pack 01')
    const pendingA = deferred<{ manifest: never; source: 'network' }>()
    const pendingB = deferred<{ manifest: never; source: 'network' }>()
    jest
      .mocked(officialContentCatalogService.getPack)
      .mockReturnValueOnce(pendingA.promise)
      .mockReturnValueOnce(pendingB.promise)

    const hook = renderHook<
      ReturnType<typeof useStarterPackImport>,
      { packId: string }
    >(({ packId }) => useStarterPackImport({ packId, version: '1.0.0' }), {
      initialProps: { packId: manifestA.pack_id },
    })
    hook.rerender({ packId: manifestB.pack_id })

    await act(async () => {
      pendingB.resolve({
        manifest: manifestB as never,
        source: 'network',
      })
      await pendingB.promise
    })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))

    await act(async () => {
      pendingA.resolve({
        manifest: manifestA as never,
        source: 'network',
      })
      await pendingA.promise
    })

    expect(hook.result.current.manifest?.pack_id).toBe(manifestB.pack_id)
  })

  it('retries a failed remote download and prepares the recovered pack', async () => {
    const manifest = createRemoteManifest(
      REMOTE_A2_PACK_ID,
      'Dutch A2 · Pack 01'
    )
    jest
      .mocked(officialContentCatalogService.getPack)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ manifest: manifest as never, source: 'network' })

    const { result } = renderHook(() =>
      useStarterPackImport({
        packId: manifest.pack_id,
        version: manifest.version,
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toContain('could not be downloaded')

    act(() => result.current.retryRemotePack())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.manifest?.pack_id).toBe(manifest.pack_id)
    expect(officialContentCatalogService.getPack).toHaveBeenCalledTimes(2)
  })

  it('ignores a rejected download after leaving the screen', async () => {
    const pending = deferred<{ manifest: never; source: 'network' }>()
    jest
      .mocked(officialContentCatalogService.getPack)
      .mockReturnValueOnce(pending.promise)
    const hook = renderHook(() =>
      useStarterPackImport({ packId: REMOTE_A2_PACK_ID, version: '1.0.0' })
    )

    hook.unmount()
    await act(async () => {
      pending.reject(new Error('late failure'))
      await expect(pending.promise).rejects.toThrow('late failure')
    })

    expect(Sentry.captureException).not.toHaveBeenCalled()
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
    expect(result.current.wordSelections).toHaveLength(59)
    expect(result.current.selectedCount).toBe(59)
  })

  it('does not create an empty collection when every entry is a duplicate', async () => {
    const collection = createCollection()
    const previewWords = getStarterPackPreview(loadOfficialDutchA1Pack()).words
    storeState = {
      ...storeState,
      collections: [collection],
      words: previewWords.map((word, index) => ({
        ...createExistingWord(),
        ...word,
        collection_id: collection.collection_id,
        word_id: `existing-${index}`,
        interval_days: 30,
        repetition_count: 7,
        easiness_factor: 2.8,
      })),
    }

    const { result } = await renderAndWait()
    expect(result.current.duplicateCount).toBe(60)
    expect(result.current.selectedCount).toBe(0)

    await act(async () => {
      await result.current.handleImport()
    })

    expect(storeState.createNewCollection).not.toHaveBeenCalled()
    expect(storeState.addWordsToCollection).not.toHaveBeenCalled()
  })

  it('limits a read-only account to an existing target collection', async () => {
    const collection = createCollection()
    storeState = {
      ...storeState,
      userAccessLevel: 'read_only',
      collections: [collection],
    }

    const { result } = await renderAndWait()

    expect(result.current.collections).toEqual([
      { collection_id: collection.collection_id, name: collection.name },
    ])
    expect(result.current.targetCollectionId).toBe(collection.collection_id)
    expect(result.current.importEnabled).toBe(true)
  })

  it('disables import for a read-only account without a target collection', async () => {
    storeState = {
      ...storeState,
      userAccessLevel: 'read_only',
      collections: [],
    }

    const { result } = await renderAndWait()

    expect(result.current.collections).toEqual([])
    expect(result.current.targetCollectionId).toBeNull()
    expect(result.current.importEnabled).toBe(false)
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
    expect(storeState.deleteCollection).toHaveBeenCalledWith(
      STARTER_COLLECTION_ID
    )
    expect(ToastService.show).toHaveBeenCalledWith(
      'Starter pack import failed',
      expect.any(String)
    )
  })

  it('does not delete an existing target collection when import fails', async () => {
    const collection = createCollection()
    storeState = {
      ...storeState,
      collections: [collection],
    }
    storeState.addWordsToCollection.mockResolvedValue(false)
    const { result } = await renderAndWait()

    act(() => result.current.setTargetCollectionId(collection.collection_id))
    await act(async () => {
      await result.current.handleImport()
    })

    expect(storeState.deleteCollection).not.toHaveBeenCalled()
  })

  it('ignores a second submit while the first import is still running', async () => {
    const pendingImport = deferred<boolean>()
    storeState.addWordsToCollection.mockReturnValue(pendingImport.promise)
    const { result } = await renderAndWait()

    let firstImport!: Promise<void>
    act(() => {
      firstImport = result.current.handleImport()
    })
    await waitFor(() =>
      expect(storeState.addWordsToCollection).toHaveBeenCalledTimes(1)
    )

    await act(async () => {
      await result.current.handleImport()
    })
    expect(storeState.createNewCollection).toHaveBeenCalledTimes(1)
    expect(storeState.addWordsToCollection).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingImport.resolve(true)
      await firstImport
    })
  })
})
