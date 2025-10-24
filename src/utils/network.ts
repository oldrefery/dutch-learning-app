import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LAST_SYNC_TIMESTAMP_KEY = 'last_sync_timestamp'

export async function checkNetworkConnection(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return state.isConnected ?? false
  } catch (error) {
    console.error('[Network] Error checking connection:', error)
    return false
  }
}

export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return state.isConnected === true && state.isInternetReachable !== false
  } catch (error) {
    console.error('[Network] Error checking network availability:', error)
    return false
  }
}

export function subscribeToNetworkChanges(
  callback: (isConnected: boolean) => void
): () => void {
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const isConnected = state.isConnected ?? false
    callback(isConnected)
  })

  return () => {
    unsubscribe()
  }
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_TIMESTAMP_KEY)
  } catch (error) {
    console.error('[Network] Error getting last sync timestamp:', error)
    return null
  }
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_TIMESTAMP_KEY, timestamp)
  } catch (error) {
    console.error('[Network] Error setting last sync timestamp:', error)
    throw error
  }
}

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkConnection = useCallback(async () => {
    setIsLoading(true)
    try {
      const connected = await checkNetworkConnection()
      setIsConnected(connected)
    } catch (error) {
      console.error('[Network] Error in useNetworkStatus:', error)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkConnection()

    return subscribeToNetworkChanges((connected: boolean) => {
      setIsConnected(connected)
    })
  }, [checkConnection])

  return { isConnected, isLoading }
}

export const NetworkStatus = {
  checkConnection: checkNetworkConnection,
  subscribe: subscribeToNetworkChanges,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  useNetworkStatus,
}
