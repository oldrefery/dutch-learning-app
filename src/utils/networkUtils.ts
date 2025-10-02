/**
 * Network Utilities
 * Provides network connectivity checking using expo-network
 */

import * as Network from 'expo-network'
import { NetworkError } from '@/types/ErrorTypes'

/**
 * Check if device has internet connectivity
 * Throws NetworkError if no connection
 */
export async function checkNetworkConnection(): Promise<void> {
  try {
    const networkState = await Network.getNetworkStateAsync()

    // Check if device is connected to any network
    if (!networkState.isConnected) {
      throw new NetworkError(
        'No network connection',
        'No internet connection. Please check your network settings.',
        undefined,
        { networkState }
      )
    }

    // Additional check for internet reachability
    // Note: isInternetReachable can be null on some platforms/simulators
    if (networkState.isInternetReachable === false) {
      throw new NetworkError(
        'Internet not reachable',
        'Cannot reach the internet. Please check your connection.',
        undefined,
        { networkState }
      )
    }
  } catch (error) {
    // If it's already a NetworkError, rethrow it
    if (error instanceof NetworkError) {
      throw error
    }

    // For any other error (API error, etc), throw generic network error
    throw new NetworkError(
      'Network check failed',
      'Unable to verify network connection. Please try again.',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Check if device currently has internet connectivity
 * Returns boolean without throwing
 */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync()
    return (
      networkState.isConnected === true &&
      networkState.isInternetReachable !== false
    )
  } catch {
    // If we can't check, assume network is available
    // to avoid blocking the user unnecessarily
    return true
  }
}
