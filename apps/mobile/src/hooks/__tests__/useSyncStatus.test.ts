import { useEffect } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { useFocusEffect } from 'expo-router/react-navigation'
import { syncManager, type SyncResult } from '@/services/syncManager'
import {
  syncStatusService,
  type SyncStatusSnapshot,
} from '@/services/syncStatusService'
import { Sentry } from '@/lib/sentry'
import { ToastService } from '@/components/AppToast'
import { useSyncStatus } from '../useSyncStatus'

jest.mock('expo-router/react-navigation', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/services/syncManager', () => ({
  syncManager: { subscribeSyncStatus: jest.fn(), performSync: jest.fn() },
}))
jest.mock('@/services/syncStatusService', () => ({
  syncStatusService: { getSnapshot: jest.fn() },
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: { show: jest.fn() },
}))

const snapshot = (lastSyncAt: string | null = null): SyncStatusSnapshot => ({
  totalLocalWords: 0,
  totalLocalCollections: 0,
  totalLocalProgress: 0,
  pendingWords: 0,
  pendingCollections: 0,
  pendingProgress: 0,
  totalPending: 0,
  lastSyncAt,
  isOnline: true,
})
const syncResult: SyncResult = {
  success: true,
  wordsSynced: 0,
  progressSynced: 0,
  timestamp: '2026-09-06T13:00:00.000Z',
}
const deferred = () => {
  let resolve: (value: SyncStatusSnapshot) => void = () => undefined
  let reject: (reason: Error) => void = () => undefined
  const promise = new Promise<SyncStatusSnapshot>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('focused sync status', () => {
  let focused = true
  let listener: (result: SyncResult) => void
  const unsubscribe = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    focused = true
    jest
      .mocked(useFocusEffect)
      .mockImplementation(function useMockFocus(effect) {
        const isFocused = focused
        useEffect(() => (isFocused ? effect() : undefined), [effect, isFocused])
      })
    jest
      .mocked(syncManager.subscribeSyncStatus)
      .mockImplementation(callback => {
        listener = callback
        return unsubscribe
      })
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockReset()
      .mockResolvedValue(snapshot())
  })

  it('refreshes on automatic sync without starting another sync', async () => {
    const { result } = renderHook(() => useSyncStatus('user-1'))
    await act(async () => undefined)
    expect(result.current.snapshot?.lastSyncAt).toBeNull()
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockResolvedValue(snapshot(syncResult.timestamp))
    await act(async () => listener(syncResult))
    expect(result.current.snapshot?.lastSyncAt).toBe(syncResult.timestamp)
    expect(syncStatusService.getSnapshot).toHaveBeenCalledTimes(2)
    expect(syncManager.performSync).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('uses the latest request when responses arrive out of order', async () => {
    const old = deferred()
    jest.mocked(syncStatusService.getSnapshot).mockReturnValueOnce(old.promise)
    const { result } = renderHook(() => useSyncStatus('user-1'))
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockResolvedValue(snapshot(syncResult.timestamp))
    await act(async () => listener(syncResult))
    await act(async () => old.resolve(snapshot()))
    expect(result.current.snapshot?.lastSyncAt).toBe(syncResult.timestamp)
  })

  it('ignores an old failure while the latest request is pending', async () => {
    const old = deferred()
    const fresh = deferred()
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise)
    const { result } = renderHook(() => useSyncStatus('user-1'))
    act(() => listener(syncResult))
    await act(async () => old.reject(new Error('Old failure')))
    expect(result.current.isLoading).toBe(true)
    expect(ToastService.show).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
    await act(async () => fresh.resolve(snapshot(syncResult.timestamp)))
    expect(result.current.isLoading).toBe(false)
  })

  it('hides the previous account and ignores its delayed response', async () => {
    const old = deferred()
    const fresh = deferred()
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSyncStatus(id),
      { initialProps: { id: 'user-1' } }
    )
    await act(async () => undefined)
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise)
    act(() => listener(syncResult))
    rerender({ id: 'user-2' })
    expect(result.current.snapshot).toBeNull()
    await act(async () => old.resolve(snapshot('2025-01-01T00:00:00Z')))
    expect(result.current.snapshot).toBeNull()
    await act(async () => fresh.resolve(snapshot(syncResult.timestamp)))
    expect(result.current.snapshot?.lastSyncAt).toBe(syncResult.timestamp)
    rerender({ id: null })
    expect(result.current.snapshot).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })

  it('cleans up on blur, ignores queued callbacks and refreshes on refocus', async () => {
    const pending = deferred()
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockReturnValueOnce(pending.promise)
    const { result, rerender, unmount } = renderHook(() =>
      useSyncStatus('user-1')
    )
    const queued = listener
    focused = false
    rerender({})
    await act(async () => {
      queued(syncResult)
      pending.reject(new Error('Screen closed'))
      await result.current.refresh()
    })
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(syncStatusService.getSnapshot).toHaveBeenCalledTimes(1)
    expect(ToastService.show).not.toHaveBeenCalled()
    focused = true
    rerender({})
    await act(async () => undefined)
    expect(syncStatusService.getSnapshot).toHaveBeenCalledTimes(2)
    unmount()
    act(() => listener(syncResult))
    expect(unsubscribe).toHaveBeenCalledTimes(2)
    expect(syncStatusService.getSnapshot).toHaveBeenCalledTimes(2)
  })

  it('retains the last snapshot on failure and allows a manual retry', async () => {
    const { result } = renderHook(() => useSyncStatus('user-1'))
    await act(async () => undefined)
    const previous = result.current.snapshot
    const error = new Error('Status unavailable')
    jest.mocked(syncStatusService.getSnapshot).mockRejectedValueOnce(error)
    await act(async () => result.current.refresh())
    expect(result.current.snapshot).toEqual(previous)
    expect(result.current.isLoading).toBe(false)
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { operation: 'loadSyncStatus' },
    })
    expect(ToastService.show).toHaveBeenCalledTimes(1)
    await act(async () => result.current.refresh())
    expect(syncStatusService.getSnapshot).toHaveBeenCalledTimes(3)
  })
})
