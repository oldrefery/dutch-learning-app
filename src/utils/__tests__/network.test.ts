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
  getSyncCursor,
  setSyncCursor,
  useNetworkStatus,
} from '../network'

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    refresh: jest.fn(),
    addEventListener: jest.fn(),
  },
}))

const LAST_SYNC_TIMESTAMP_KEY = 'last_sync_timestamp'
const STORED_TIMESTAMP = '2025-10-01T00:00:00Z'
const STORAGE_ERROR_MESSAGE = 'Storage error'
const USER_ID = 'user-1'
const WORD_CURSOR_KEY = `sync_cursor:${USER_ID}:words`

describe('network', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(AsyncStorage.getItem as jest.Mock).mockReset().mockResolvedValue(null)
    ;(AsyncStorage.setItem as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined)
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

    it('should refresh stale unreachable state before returning availability', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })
      ;(NetInfo.refresh as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(true)
      expect(NetInfo.refresh).toHaveBeenCalledTimes(1)
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
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(STORED_TIMESTAMP)

      const result = await getLastSyncTimestamp()

      expect(result).toBe(STORED_TIMESTAMP)
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(LAST_SYNC_TIMESTAMP_KEY)
    })

    it('should return null on error', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error(STORAGE_ERROR_MESSAGE)
      )

      const result = await getLastSyncTimestamp()

      expect(result).toBeNull()
    })
  })

  describe('setLastSyncTimestamp', () => {
    it('should save timestamp to AsyncStorage', async () => {
      await setLastSyncTimestamp(STORED_TIMESTAMP)

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        LAST_SYNC_TIMESTAMP_KEY,
        STORED_TIMESTAMP
      )
    })

    it('should throw on error', async () => {
      ;(AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error(STORAGE_ERROR_MESSAGE)
      )

      await expect(setLastSyncTimestamp(STORED_TIMESTAMP)).rejects.toThrow(
        STORAGE_ERROR_MESSAGE
      )
    })
  })

  describe('getSyncCursor', () => {
    it('should return a typed per-user table cursor', async () => {
      const cursor = {
        updatedAt: '2026-07-25T10:00:00.000Z',
        id: 'word-10',
      }
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(cursor)
      )

      await expect(getSyncCursor(USER_ID, 'words')).resolves.toEqual(cursor)
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(WORD_CURSOR_KEY)
    })

    it('should ignore a stored value that is not a valid cursor', async () => {
      ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ updatedAt: '', id: 42 })
      )

      await expect(getSyncCursor(USER_ID, 'words')).resolves.toBeNull()
    })
  })

  describe('setSyncCursor', () => {
    it('should save a cursor under its user and table key', async () => {
      const cursor = {
        updatedAt: '2026-07-25T10:00:00.000Z',
        id: 'word-10',
      }

      await setSyncCursor(USER_ID, 'words', cursor)

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        WORD_CURSOR_KEY,
        JSON.stringify(cursor)
      )
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

    it('should subscribe to changes on mount', async () => {
      ;(NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true })
      ;(NetInfo.addEventListener as jest.Mock).mockReturnValue(jest.fn())

      const { result } = renderHook(() => useNetworkStatus())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(NetInfo.addEventListener).toHaveBeenCalled()
    })
  })
})
