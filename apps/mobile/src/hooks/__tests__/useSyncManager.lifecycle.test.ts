import { act, cleanup, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { initializeDatabase } from '@/db/initDB'
import { syncManager, type SyncResult } from '@/services/syncManager'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { subscribeToNetworkChanges } from '@/utils/network'
import { useSyncManager } from '../useSyncManager'

jest.mock('expo-router/react-navigation', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/db/initDB', () => ({ initializeDatabase: jest.fn() }))
jest.mock('@/services/syncManager', () => ({
  syncManager: { performSync: jest.fn(), subscribeSyncStatus: jest.fn() },
}))
jest.mock('@/utils/network', () => ({ subscribeToNetworkChanges: jest.fn() }))

const successfulSync: SyncResult = {
  success: true,
  wordsSynced: 1,
  progressSynced: 0,
  timestamp: '2026-09-05T18:00:00.000Z',
}
const options = {
  autoSyncOnMount: false,
  autoSyncOnFocus: false,
  autoSyncOnNetworkChange: true,
  syncIntervalMs: 0,
}

describe('native synchronization lifecycle', () => {
  const originalAppState = AppState.currentState
  const originalStore = useApplicationStore.getState()
  const removeAppStateListener = jest.fn()
  const unsubscribeNetwork = jest.fn()
  const unsubscribeStatus = jest.fn()
  let appStateListener: (state: AppStateStatus) => void
  let networkListener: (connected: boolean) => void
  let statusListener: (result: SyncResult) => void

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    AppState.currentState = 'active'
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_, listener) => {
        appStateListener = listener
        return { remove: removeAppStateListener }
      })
    jest.mocked(subscribeToNetworkChanges).mockImplementation(listener => {
      networkListener = listener
      return unsubscribeNetwork
    })
    jest
      .mocked(syncManager.subscribeSyncStatus)
      .mockImplementation(listener => {
        statusListener = listener
        return unsubscribeStatus
      })
    jest
      .mocked(syncManager.performSync)
      .mockReset()
      .mockResolvedValue(successfulSync)
    jest
      .mocked(initializeDatabase)
      .mockResolvedValue({} as Awaited<ReturnType<typeof initializeDatabase>>)
    useApplicationStore.setState({
      currentUserId: 'qa-lifecycle-user',
      fetchCollections: jest.fn().mockResolvedValue(undefined),
      fetchWords: jest.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    cleanup()
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    AppState.currentState = originalAppState
    useApplicationStore.setState(originalStore)
  })

  const changeAppState = async (next: AppStateStatus) => {
    await act(async () => {
      AppState.currentState = next
      appStateListener(next)
    })
  }
  const changeNetwork = async (connected: boolean) => {
    await act(async () => {
      await networkListener(connected)
    })
  }

  it('starts sync on reconnection, not on a disconnected notification', async () => {
    const { result } = renderHook(() => useSyncManager(options))
    await changeNetwork(false)
    expect(syncManager.performSync).not.toHaveBeenCalled()
    await changeNetwork(true)
    expect(syncManager.performSync).toHaveBeenCalledTimes(1)
    expect(syncManager.performSync).toHaveBeenCalledWith('qa-lifecycle-user')
    expect(result.current.syncResult).toEqual(successfulSync)
    expect(result.current.isSyncing).toBe(false)
  })

  it.each(['background', 'inactive'] as const)(
    'defers reconnection while %s and synchronizes once on foreground',
    async state => {
      renderHook(() => useSyncManager(options))
      await changeAppState(state)
      await changeNetwork(true)
      expect(syncManager.performSync).not.toHaveBeenCalled()
      await changeAppState('active')
      expect(syncManager.performSync).toHaveBeenCalledTimes(1)
      await changeAppState('active')
      expect(syncManager.performSync).toHaveBeenCalledTimes(1)
    }
  )

  it('pauses periodic work in the background and resumes a single timer', async () => {
    renderHook(() => useSyncManager({ ...options, syncIntervalMs: 1000 }))
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(syncManager.performSync).toHaveBeenCalledTimes(1)
    await changeAppState('background')
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })
    expect(syncManager.performSync).toHaveBeenCalledTimes(1)
    await changeAppState('active')
    expect(syncManager.performSync).toHaveBeenCalledTimes(2)
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(syncManager.performSync).toHaveBeenCalledTimes(3)
  })

  it('cleans up subscriptions and timers when the screen unmounts', async () => {
    const { unmount } = renderHook(() =>
      useSyncManager({ ...options, syncIntervalMs: 1000 })
    )
    unmount()
    expect(unsubscribeNetwork).toHaveBeenCalledTimes(1)
    expect(unsubscribeStatus).toHaveBeenCalledTimes(1)
    expect(removeAppStateListener).toHaveBeenCalledTimes(1)
    await act(async () => {
      jest.advanceTimersByTime(5000)
    })
    expect(syncManager.performSync).not.toHaveBeenCalled()
  })

  it('does not synchronize without an authenticated store identity', async () => {
    useApplicationStore.setState({ currentUserId: null })
    const { result } = renderHook(() => useSyncManager(options))
    await changeNetwork(true)
    await changeAppState('background')
    await changeAppState('active')
    await act(async () => {
      await result.current.performSync()
    })
    expect(syncManager.performSync).not.toHaveBeenCalled()
  })

  it('honors the disabled network subscription option', async () => {
    renderHook(() =>
      useSyncManager({ ...options, autoSyncOnNetworkChange: false })
    )
    await act(async () => {})
    expect(subscribeToNetworkChanges).not.toHaveBeenCalled()
    expect(syncManager.performSync).not.toHaveBeenCalled()
  })

  it('clears a failed attempt after a successful reconnect', async () => {
    jest
      .mocked(syncManager.performSync)
      .mockRejectedValueOnce(new Error('Connection lost'))
    const { result } = renderHook(() => useSyncManager(options))
    await changeNetwork(true)
    expect(result.current.syncResult).toMatchObject({
      success: false,
      error: 'Connection lost',
    })
    expect(result.current.isSyncing).toBe(false)
    await changeNetwork(false)
    await changeNetwork(true)
    expect(syncManager.performSync).toHaveBeenCalledTimes(2)
    expect(result.current.syncResult).toEqual(successfulSync)
    expect(result.current.isSyncing).toBe(false)
  })

  it('rehydrates visible data only for successful sync notifications', async () => {
    renderHook(() => useSyncManager(options))
    const { fetchCollections, fetchWords } = useApplicationStore.getState()
    await act(async () => {
      statusListener({ ...successfulSync, success: false })
    })
    expect(fetchCollections).not.toHaveBeenCalled()
    expect(fetchWords).not.toHaveBeenCalled()
    await act(async () => {
      statusListener(successfulSync)
    })
    expect(fetchCollections).toHaveBeenCalledTimes(1)
    expect(fetchWords).toHaveBeenCalledTimes(1)
  })
})
