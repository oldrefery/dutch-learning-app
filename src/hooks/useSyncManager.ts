import { useEffect, useCallback, useState, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { syncManager, type SyncResult } from '@/services/syncManager'
import { subscribeToNetworkChanges } from '@/utils/network'
import { initializeDatabase } from '@/db/initDB'

export interface UseSyncManagerOptions {
  autoSyncOnMount?: boolean
  autoSyncOnFocus?: boolean
  autoSyncOnNetworkChange?: boolean
  syncIntervalMs?: number
}

const DEFAULT_OPTIONS: UseSyncManagerOptions = {
  autoSyncOnMount: true,
  autoSyncOnFocus: true,
  autoSyncOnNetworkChange: true,
  syncIntervalMs: 5 * 60 * 1000, // 5 minutes
}

export function useSyncManager(options: UseSyncManagerOptions = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }
  const { currentUserId } = useApplicationStore()
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeNetworkRef = useRef<(() => void) | null>(null)
  const unsubscribeSyncRef = useRef<(() => void) | null>(null)

  const initializeSync = useCallback(async () => {
    try {
      await initializeDatabase()
      console.log('[Sync] Database initialized')
    } catch (error) {
      console.error('[Sync] Error initializing database:', error)
    }
  }, [])

  const performSync = useCallback(async () => {
    if (!currentUserId) {
      console.log('[Sync] No user logged in, skipping sync')
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncManager.performSync(currentUserId)
      setSyncResult(result)
    } catch (error) {
      console.error('[Sync] Error in performSync:', error)
      // Set error result so UI knows sync failed
      setSyncResult({
        success: false,
        wordsSynced: 0,
        progressSynced: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsSyncing(false)
    }
  }, [currentUserId])

  const setupSyncOnNetworkChange = useCallback(() => {
    if (!mergedOptions.autoSyncOnNetworkChange) return

    unsubscribeNetworkRef.current = subscribeToNetworkChanges(
      async (isConnected: boolean) => {
        if (isConnected) {
          console.log('[Sync] Network reconnected, triggering sync')
          await performSync()
        }
      }
    )
  }, [mergedOptions.autoSyncOnNetworkChange, performSync])

  const setupPeriodicSync = useCallback(() => {
    if (!mergedOptions.syncIntervalMs || !currentUserId) return

    syncIntervalRef.current = setInterval(() => {
      performSync()
    }, mergedOptions.syncIntervalMs)

    console.log(
      `[Sync] Periodic sync set up with interval: ${mergedOptions.syncIntervalMs}ms`
    )
  }, [mergedOptions.syncIntervalMs, performSync, currentUserId])

  const setupSyncStatusListener = useCallback(() => {
    unsubscribeSyncRef.current = syncManager.subscribeSyncStatus(
      (result: SyncResult) => {
        setSyncResult(result)
      }
    )
  }, [])

  // Initialize database on mount
  useEffect(() => {
    initializeSync()
  }, [initializeSync])

  // Setup sync listeners and periodic sync
  useEffect(() => {
    setupSyncStatusListener()
    setupSyncOnNetworkChange()
    setupPeriodicSync()

    return () => {
      if (unsubscribeNetworkRef.current) {
        unsubscribeNetworkRef.current()
      }
      if (unsubscribeSyncRef.current) {
        unsubscribeSyncRef.current()
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [setupSyncStatusListener, setupSyncOnNetworkChange, setupPeriodicSync])

  // Sync on app focus
  useFocusEffect(
    useCallback(() => {
      if (mergedOptions.autoSyncOnFocus) {
        performSync()
      }
    }, [mergedOptions.autoSyncOnFocus, performSync])
  )

  // Initial sync on mount
  useEffect(() => {
    if (mergedOptions.autoSyncOnMount && currentUserId) {
      performSync()
    }
  }, [mergedOptions.autoSyncOnMount, currentUserId, performSync])

  return {
    syncResult,
    isSyncing,
    performSync,
  }
}
