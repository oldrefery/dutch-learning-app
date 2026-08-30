import { useApplicationStore } from '@/stores/useApplicationStore'
import type { SyncResult } from '@/services/syncManager'
import { refreshApplicationStoreAfterSync } from '../useSyncManager'

const successfulSync: SyncResult = {
  success: true,
  wordsSynced: 1,
  progressSynced: 0,
  timestamp: '2026-08-30T21:52:51.574Z',
}

const failedSync: SyncResult = {
  success: false,
  wordsSynced: 0,
  progressSynced: 0,
  error: 'Sync already in progress',
  timestamp: '2026-08-30T21:52:51.574Z',
}

describe('refreshApplicationStoreAfterSync', () => {
  const fetchCollections = jest.fn<Promise<void>, []>()
  const fetchWords = jest.fn<Promise<void>, []>()

  beforeEach(() => {
    fetchCollections.mockReset().mockResolvedValue(undefined)
    fetchWords.mockReset().mockResolvedValue(undefined)
    useApplicationStore.setState({ fetchCollections, fetchWords })
  })

  it('rehydrates collections and words after a successful sync', async () => {
    await refreshApplicationStoreAfterSync(successfulSync)

    expect(fetchCollections).toHaveBeenCalledTimes(1)
    expect(fetchWords).toHaveBeenCalledTimes(1)
  })

  it('does not rehydrate the store after an unsuccessful sync', async () => {
    await refreshApplicationStoreAfterSync(failedSync)

    expect(fetchCollections).not.toHaveBeenCalled()
    expect(fetchWords).not.toHaveBeenCalled()
  })
})
