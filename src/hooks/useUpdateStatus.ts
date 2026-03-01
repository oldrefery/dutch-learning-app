/**
 * Hook for checking EAS Update status
 * Shows current update info and checks for new updates
 */

import { useEffect, useState, useCallback } from 'react'
import * as Updates from 'expo-updates'

export interface UpdateStatus {
  isEnabled: boolean
  isChecking: boolean
  isDownloading: boolean
  updateAvailable: boolean
  currentUpdateId: string | null
  channel: string | null
  runtimeVersion: string | null
  lastCheckTime: Date | null
  error: string | null
}

export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus>({
    isEnabled: Updates.isEnabled,
    isChecking: false,
    isDownloading: false,
    updateAvailable: false,
    currentUpdateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    lastCheckTime: null,
    error: null,
  })

  const checkForUpdate = useCallback(async () => {
    if (!Updates.isEnabled) {
      return
    }

    setStatus(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      const result = await Updates.checkForUpdateAsync()
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        updateAvailable: result.isAvailable,
        lastCheckTime: new Date(),
      }))
      return result.isAvailable
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Check failed',
      }))
      return false
    }
  }, [])

  const downloadAndApplyUpdate = useCallback(async () => {
    if (!Updates.isEnabled) {
      return false
    }

    setStatus(prev => ({ ...prev, isDownloading: true, error: null }))

    try {
      const result = await Updates.fetchUpdateAsync()
      if (result.isNew) {
        await Updates.reloadAsync()
        return true
      }
      setStatus(prev => ({ ...prev, isDownloading: false }))
      return false
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isDownloading: false,
        error: error instanceof Error ? error.message : 'Download failed',
      }))
      return false
    }
  }, [])

  // Check for updates on mount (only in production)
  useEffect(() => {
    if (Updates.isEnabled && !__DEV__) {
      void checkForUpdate()
    }
  }, [checkForUpdate])

  return {
    status,
    checkForUpdate,
    downloadAndApplyUpdate,
  }
}
