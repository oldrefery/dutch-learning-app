/**
 * Tests for networkUtils
 *
 * Network connectivity checking utilities using expo-network.
 * Tests cover connected/disconnected states, internet reachability,
 * and error handling for both throwing and non-throwing variants.
 */

import * as Network from 'expo-network'
import { NetworkError } from '@/types/ErrorTypes'
import { checkNetworkConnection, isNetworkAvailable } from '../networkUtils'

jest.mock('expo-network')

const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.Mock

describe('networkUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkNetworkConnection', () => {
    it('should resolve when connected and reachable', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      await expect(checkNetworkConnection()).resolves.toBeUndefined()
    })

    it('should resolve when isInternetReachable is null (simulator)', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      })

      await expect(checkNetworkConnection()).resolves.toBeUndefined()
    })

    it('should throw NetworkError when not connected', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      })

      await expect(checkNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(checkNetworkConnection()).rejects.toThrow(
        'No network connection'
      )
    })

    it('should throw NetworkError when internet not reachable', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })

      await expect(checkNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(checkNetworkConnection()).rejects.toThrow(
        'Internet not reachable'
      )
    })

    it('should rethrow if error is already a NetworkError', async () => {
      const networkError = new NetworkError('Custom error', 'Custom message')
      mockGetNetworkStateAsync.mockRejectedValue(networkError)

      await expect(checkNetworkConnection()).rejects.toThrow(networkError)
    })

    it('should throw generic NetworkError for unexpected API errors', async () => {
      mockGetNetworkStateAsync.mockRejectedValue(new Error('API failure'))

      await expect(checkNetworkConnection()).rejects.toThrow(NetworkError)
      await expect(checkNetworkConnection()).rejects.toThrow(
        'Network check failed'
      )
    })
  })

  describe('isNetworkAvailable', () => {
    it('should return true when connected and reachable', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return true when connected and isInternetReachable is null', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      })

      expect(await isNetworkAvailable()).toBe(true)
    })

    it('should return false when not connected', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: false,
        isInternetReachable: true,
      })

      expect(await isNetworkAvailable()).toBe(false)
    })

    it('should return false when internet not reachable', async () => {
      mockGetNetworkStateAsync.mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      })

      expect(await isNetworkAvailable()).toBe(false)
    })

    it('should return true on API error (fail-open behavior)', async () => {
      mockGetNetworkStateAsync.mockRejectedValue(new Error('API failure'))

      expect(await isNetworkAvailable()).toBe(true)
    })
  })
})
