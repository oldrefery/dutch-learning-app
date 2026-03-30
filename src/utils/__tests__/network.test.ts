/**
 * Tests for network utility
 *
 * Network connectivity checking and subscription using @react-native-community/netinfo.
 * Also manages last sync timestamp via AsyncStorage.
 */

import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { renderHook, waitFor } from '@testing-library/react-native'
import {
  checkNetworkConnection,
  isNetworkAvailable,
  subscribeToNetworkChanges,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  useNetworkStatus,
} from '../network'

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}))

describe('network', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkNetworkConnection', () => {
    it('should return true when connected', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true })

      expect(await checkNetworkConnection()).toBe(true)
    })

    it('should return false when not connected', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false })

      expect(await checkNetworkConnection()).toBe(false)
    })

    it('should return false when isConnected is null', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: null })

      expect(await checkNetworkConnection()).toBe(false)
    })

    it('should return false on error', async () => {
      ;(NetInfo.fetch as jest.Mock).mockRejectedValue(
        new Error('NetInfo error')
      )

      expect(await checkNetworkConnection()).toBe(false)
    })
  })

  describe('isNetworkAvailable', () => {
    it('should return true when connected and reachable', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return true when connected and reachability unknown', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return false when not connected', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      })

      expect(await isNetworkAvailable()).toBe(false)
    })

    it('should return false on error', async () => {
      ;(NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('Error'))

      expect(await isNetworkAvailable()).toBe(false)
    })
  })

  describe('subscribeToNetworkChanges', () => {
    it('should subscribe to NetInfo listener', () => {
      const mockUnsubscribe = jest.fn()
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe)

      const callback = jest.fn()
      subscribeToNetworkChanges(callback)

      expect(NetInfo.addEventListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('should call callback with connection status', () => {
      ;(NetInfo.addEventListener as jest.Mock).mockImplementation(cb => {
        cb({ isConnected: true })
        return jest.fn()
      })

      const callback = jest.fn()
      subscribeToNetworkChanges(callback)

      expect(callback).toHaveBeenCalledWith(true)
    })

    it('should return unsubscribe function', () => {
      const mockUnsubscribe = jest.fn()
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe)

      const unsubscribe = subscribeToNetworkChanges(jest.fn())
      unsubscribe()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('getLastSyncTimestamp', () => {
    it('should return stored timestamp', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        '2025-10-01T00:00:00Z'
      )

      const result = await getLastSyncTimestamp()

      expect(result).toBe('2025-10-01T00:00:00Z')
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('last_sync_timestamp')
    })

    it('should return null on error', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      )

      const result = await getLastSyncTimestamp()

      expect(result).toBeNull()
    })
  })

  describe('setLastSyncTimestamp', () => {
    it('should save timestamp to AsyncStorage', async () => {
      await setLastSyncTimestamp('2025-10-01T00:00:00Z')

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_sync_timestamp',
        '2025-10-01T00:00:00Z'
      )
    })

    it('should throw on error', async () => {
      ;(AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      )

      await expect(
        setLastSyncTimestamp('2025-10-01T00:00:00Z')
      ).rejects.toThrow('Storage error')
    })
  })

  describe('useNetworkStatus', () => {
    it('should resolve to connected status', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true })
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(jest.fn())

      const { result } = renderHook(() => useNetworkStatus())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isConnected).toBe(true)
    })

    it('should handle disconnected status', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false })
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(jest.fn())

      const { result } = renderHook(() => useNetworkStatus())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isConnected).toBe(false)
    })

    it('should subscribe to changes on mount', () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true })
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(jest.fn())

      renderHook(() => useNetworkStatus())

      expect(NetInfo.addEventListener).toHaveBeenCalled()
    })
  })
})
