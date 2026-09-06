import React, { useEffect } from 'react'
import * as ReactNative from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { useFocusEffect } from 'expo-router/react-navigation'
import SettingsScreen from '../(tabs)/settings'
import { syncManager, type SyncResult } from '@/services/syncManager'
import {
  syncStatusService,
  type SyncStatusSnapshot,
} from '@/services/syncStatusService'
import { useApplicationStore } from '@/stores/useApplicationStore'

jest.mock('expo-router/react-navigation', () => ({ useFocusEffect: jest.fn() }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/components/PlatformBlurView', () => ({
  PlatformBlurView: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/UpdateStatusBadge', () => ({
  UpdateStatusBadge: () => null,
}))
jest.mock('@/hooks/useSessionUser', () => ({ useSessionUser: () => null }))
jest.mock('@/contexts/SimpleAuthProvider', () => ({
  useSimpleAuth: () => ({ signOut: jest.fn(), loading: false }),
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: { show: jest.fn() },
}))
jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/supabase')
jest.mock('@/db/wordRepository')
jest.mock('@/services/syncManager', () => ({
  syncManager: { performSync: jest.fn(), subscribeSyncStatus: jest.fn() },
}))
jest.mock('@/services/syncStatusService', () => ({
  syncStatusService: { getSnapshot: jest.fn() },
}))

const completedAt = '2026-09-06T13:00:00.000Z'
const SYNC_BUTTON_ID = 'force-sync-button'
const snapshot = (lastSyncAt: string | null): SyncStatusSnapshot => ({
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
const successfulSync: SyncResult = {
  success: true,
  wordsSynced: 0,
  progressSynced: 0,
  timestamp: completedAt,
}

describe('Settings sync status integration', () => {
  const originalState = useApplicationStore.getState()
  let listener: (result: SyncResult) => void
  beforeEach(() => {
    jest.clearAllMocks()
    useApplicationStore.setState({
      currentUserId: 'qa-settings-user',
      userAccessLevel: 'full_access',
    })
    jest
      .mocked(useFocusEffect)
      .mockImplementation(function useMockFocus(effect) {
        useEffect(effect, [effect])
      })
    jest
      .mocked(syncManager.subscribeSyncStatus)
      .mockImplementation(callback => {
        listener = callback
        return jest.fn()
      })
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockReset()
      .mockResolvedValue(snapshot(null))
    jest
      .mocked(syncManager.performSync)
      .mockReset()
      .mockResolvedValue(successfulSync)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    useApplicationStore.setState(originalState)
  })

  it.each(['light', 'dark'] as const)(
    'updates the open %s screen on automatic synchronization',
    async theme => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(theme)
      const screen = render(<SettingsScreen />)
      await waitFor(() =>
        expect(screen.getByText('Not synced yet')).toBeTruthy()
      )
      expect(screen.getByText('Never')).toBeTruthy()
      jest
        .mocked(syncStatusService.getSnapshot)
        .mockResolvedValue(snapshot(completedAt))
      await act(async () => listener(successfulSync))
      expect(screen.getByText('Up to date')).toBeTruthy()
      expect(screen.queryByText('Never')).toBeNull()
      expect(syncManager.performSync).not.toHaveBeenCalled()
    }
  )

  it('refreshes after manual sync and keeps the previous success after a failed retry', async () => {
    const screen = render(<SettingsScreen />)
    await waitFor(() =>
      expect(screen.getByTestId(SYNC_BUTTON_ID)).toBeEnabled()
    )
    jest
      .mocked(syncStatusService.getSnapshot)
      .mockResolvedValue(snapshot(completedAt))
    fireEvent.press(screen.getByTestId(SYNC_BUTTON_ID))
    await waitFor(() => expect(screen.getByText('Up to date')).toBeTruthy())
    expect(syncManager.performSync).toHaveBeenCalledWith('qa-settings-user')
    jest.mocked(syncManager.performSync).mockResolvedValueOnce({
      ...successfulSync,
      success: false,
      error: 'Network unavailable',
    })
    fireEvent.press(screen.getByTestId(SYNC_BUTTON_ID))
    await waitFor(() =>
      expect(screen.getByTestId(SYNC_BUTTON_ID)).toBeEnabled()
    )
    expect(syncManager.performSync).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Never')).toBeNull()
  })
})
