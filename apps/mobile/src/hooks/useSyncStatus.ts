import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router/react-navigation'
import { syncManager } from '@/services/syncManager'
import {
  syncStatusService,
  type SyncStatusSnapshot,
} from '@/services/syncStatusService'
import { Sentry } from '@/lib/sentry'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

interface StatusState {
  userId: string | null
  snapshot: SyncStatusSnapshot | null
  loading: boolean
}

/** Display metadata only; reading status never starts synchronization. */
export function useSyncStatus(currentUserId: string | null) {
  const [state, setState] = useState<StatusState>({
    userId: null,
    snapshot: null,
    loading: false,
  })
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) return
      let active = true
      let latestRequest = 0

      const load = async () => {
        if (!active) return
        const request = ++latestRequest
        const isCurrent = () => active && request === latestRequest
        setState(previous => ({
          userId: currentUserId,
          snapshot:
            previous.userId === currentUserId ? previous.snapshot : null,
          loading: true,
        }))
        try {
          const snapshot = await syncStatusService.getSnapshot(currentUserId)
          if (isCurrent()) {
            setState({ userId: currentUserId, snapshot, loading: false })
          }
        } catch (error) {
          if (isCurrent()) {
            setState(previous => ({ ...previous, loading: false }))
            Sentry.captureException(error, {
              tags: { operation: 'loadSyncStatus' },
            })
            ToastService.show('Could not load sync status.', ToastType.ERROR)
          }
        }
      }

      refreshRef.current = load
      const unsubscribe = syncManager.subscribeSyncStatus(() => void load())
      void load()
      return () => {
        active = false
        refreshRef.current = null
        unsubscribe()
      }
    }, [currentUserId])
  )

  // Stable identity: a finishing manual sync refreshes the currently focused user.
  const refresh = useCallback(async () => {
    await refreshRef.current?.()
  }, [])

  const belongsToUser = currentUserId !== null && state.userId === currentUserId
  return {
    snapshot: belongsToUser ? state.snapshot : null,
    isLoading: belongsToUser && state.loading,
    refresh,
  }
}
