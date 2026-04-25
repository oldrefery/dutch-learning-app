/**
 * Tests for network utilities
 *
 * Network connectivity checking utilities using @react-native-community/netinfo.
 * Tests cover connected/disconnected states, internet reachability,
 * and error handling for both throwing and non-throwing variants.
 */

import NetInfo from '@react-native-community/netinfo'
import { NetworkError } from '@/types/ErrorTypes'
import {
  assertNetworkConnection,
  isNetworkAvailable,
  checkNetworkConnection,
} from '../network'

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  refresh: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
  configure: jest.fn(),
}))

const mockNetInfoFetch = NetInfo.fetch as jest.Mock
const mockNetInfoRefresh = NetInfo.refresh as jest.Mock

const API_FAILURE_ERROR = 'API failure'

describe('network utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('assertNetworkConnection', () => {
    it('should resolve when connected and reachable', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      await expect(assertNetworkConnection()).resolves.toBeUndefined()
    })

    it('should resolve when isInternetReachable is null (simulator)', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      })

      await expect(assertNetworkConnection()).resolves.toBeUndefined()
    })

    it('should throw NetworkError when not connected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      })

      await expect(assertNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(assertNetworkConnection()).rejects.toThrow(
        'No network connection'
      )
    })

    it('should throw NetworkError when internet not reachable', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })
      mockNetInfoRefresh.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })

      await expect(assertNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(assertNetworkConnection()).rejects.toThrow(
        'Internet not reachable'
      )
    })

    it('should refresh stale reachability before throwing', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })
      mockNetInfoRefresh.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      await expect(assertNetworkConnection()).resolves.toBeUndefined()
      expect(mockNetInfoRefresh).toHaveBeenCalledTimes(1)
    })

    it('should rethrow if error is already a NetworkError', async () => {
      const networkError = new NetworkError('Custom error', 'Custom message')
      mockNetInfoFetch.mockRejectedValue(networkError)

      await expect(assertNetworkConnection()).rejects.toThrow(networkError)
    })

    it('should throw generic NetworkError for unexpected API errors', async () => {
      mockNetInfoFetch.mockRejectedValue(new Error(API_FAILURE_ERROR))

      await expect(assertNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(assertNetworkConnection()).rejects.toThrow(
        'Network check failed'
      )
    })
  })

  describe('checkNetworkConnection', () => {
    it('should return true when connected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await checkNetworkConnection()).toBe(true)
    })

    it('should return false when not connected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      })

      expect(await checkNetworkConnection()).toBe(false)
    })

    it('should return false on error', async () => {
      mockNetInfoFetch.mockRejectedValue(new Error(API_FAILURE_ERROR))

      expect(await checkNetworkConnection()).toBe(false)
    })
  })

  describe('isNetworkAvailable', () => {
    it('should return true when connected and reachable', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return true when connected and isInternetReachable is null', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return false when not connected', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(false)
    })

    it('should return false when internet not reachable', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })
      mockNetInfoRefresh.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })

      expect(await isNetworkAvailable()).toBe(false)
    })

    it('should return true after refresh recovers reachability', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })
      mockNetInfoRefresh.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(true)
      expect(mockNetInfoRefresh).toHaveBeenCalledTimes(1)
    })

    it('should return false on API error', async () => {
      mockNetInfoFetch.mockRejectedValue(new Error(API_FAILURE_ERROR))

      expect(await isNetworkAvailable()).toBe(false)
    })
  })
})
