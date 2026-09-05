import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { initializeDatabase } from '@/db/initDB'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { syncManager, type SyncResult } from '@/services/syncManager'
import {
  useSyncManager,
  refreshApplicationStoreAfterSync,
} from '../useSyncManager'

jest.mock('expo-router/react-navigation', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/db/initDB', () => ({ initializeDatabase: jest.fn() }))
jest.mock('@/services/syncManager', () => ({
  syncManager: {
    performSync: jest.fn(),
    subscribeSyncStatus: jest.fn(() => () => {}),
  },
}))
jest.mock('@/utils/network', () => ({
  subscribeToNetworkChanges: jest.fn(() => () => {}),
}))

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

describe('initial synchronization', () => {
  const initializedDatabase = {} as Awaited<
    ReturnType<typeof initializeDatabase>
  >
  const options = {
    autoSyncOnMount: true,
    autoSyncOnFocus: false,
    autoSyncOnNetworkChange: false,
    syncIntervalMs: 0,
  }
  beforeEach(() => {
    jest.mocked(initializeDatabase).mockReset()
    jest
      .mocked(syncManager.performSync)
      .mockReset()
      .mockResolvedValue(successfulSync)
    useApplicationStore.setState({ currentUserId: 'sync-user' })
  })

  it('waits for database initialization before synchronizing', async () => {
    const previousAppState = AppState.currentState
    AppState.currentState = 'active'
    let finishInitialization: () => void = () => {}
    jest.mocked(initializeDatabase).mockImplementation(
      () =>
        new Promise(resolve => {
          finishInitialization = () => resolve(initializedDatabase)
        })
    )
    const { result, unmount } = renderHook(() => useSyncManager(options))
    expect(syncManager.performSync).not.toHaveBeenCalled()
    await act(async () => {
      finishInitialization()
    })
    await waitFor(() =>
      expect(result.current.syncResult).toEqual(successfulSync)
    )
    expect(syncManager.performSync).toHaveBeenCalledWith('sync-user')
    expect(result.current.isSyncing).toBe(false)
    unmount()
    AppState.currentState = previousAppState
  })

  it('does not start synchronization after unmounting during initialization', async () => {
    let finishInitialization: () => void = () => {}
    jest.mocked(initializeDatabase).mockImplementation(
      () =>
        new Promise(resolve => {
          finishInitialization = () => resolve(initializedDatabase)
        })
    )
    const { unmount } = renderHook(() => useSyncManager(options))
    unmount()
    await act(async () => {
      finishInitialization()
    })
    expect(syncManager.performSync).not.toHaveBeenCalled()
  })
})
