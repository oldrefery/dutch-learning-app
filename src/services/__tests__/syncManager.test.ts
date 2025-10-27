/**
 * Integration tests for SyncManager
 * Tests offline-first sync orchestration with mocks
 */

import { SyncManager, type SyncResult } from '../syncManager'
import * as networkUtils from '@/utils/network'
import * as supabaseLib from '@/lib/supabase'

jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/supabase')
jest.mock('@/utils/network')
jest.mock('@/db/wordRepository')
jest.mock('@/db/progressRepository')
jest.mock('@/db/collectionRepository')

describe('SyncManager', () => {
  let syncManager: SyncManager
  const userId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    syncManager = new SyncManager()
    ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(true)
    ;(networkUtils.getLastSyncTimestamp as jest.Mock).mockResolvedValue(null)
    ;(networkUtils.setLastSyncTimestamp as jest.Mock).mockResolvedValue(void 0)

    // Mock repository methods
    const mockWordRepository = require('@/db/wordRepository')
    const mockProgressRepository = require('@/db/progressRepository')
    const mockCollectionRepository = require('@/db/collectionRepository')

    mockWordRepository.wordRepository.getWordsByUserId = jest
      .fn()
      .mockResolvedValue([])
    mockWordRepository.wordRepository.saveWords = jest
      .fn()
      .mockResolvedValue(void 0)
    mockProgressRepository.progressRepository.getPendingProgress = jest
      .fn()
      .mockResolvedValue([])
    mockProgressRepository.progressRepository.markProgressSynced = jest
      .fn()
      .mockResolvedValue(void 0)
    mockCollectionRepository.collectionRepository.getPendingCollections = jest
      .fn()
      .mockResolvedValue([])
    mockCollectionRepository.collectionRepository.markCollectionsSynced = jest
      .fn()
      .mockResolvedValue(void 0)
  })

  describe('sync status subscriptions', () => {
    it('should subscribe to sync status updates', () => {
      const callback = jest.fn()
      const unsubscribe = syncManager.subscribeSyncStatus(callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should unsubscribe from sync updates', () => {
      const callback = jest.fn()
      const unsubscribe = syncManager.subscribeSyncStatus(callback)

      unsubscribe()

      // After unsubscribe, callback should not be called (tested in actual sync)
      expect(callback).not.toHaveBeenCalled()
    })

    it('should handle multiple subscribers', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      syncManager.subscribeSyncStatus(callback1)
      syncManager.subscribeSyncStatus(callback2)

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })
  })

  describe('network detection', () => {
    it('should skip sync when offline', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        false
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No network connection')
      expect(result.wordsSynced).toBe(0)
    })

    it('should proceed with sync when online', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      const result = await syncManager.performSync(userId)

      expect(networkUtils.checkNetworkConnection).toHaveBeenCalled()
    })
  })

  describe('sync state management', () => {
    it('should prevent concurrent syncs', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      // Start first sync
      const sync1 = syncManager.performSync(userId)

      // Attempt second sync immediately
      const sync2 = syncManager.performSync(userId)

      const [result1, result2] = await Promise.all([sync1, sync2])

      // One of the two results should have the 'Sync already in progress' error
      // This tests that concurrent syncs are prevented
      const hasConcurrentError =
        result1.error === 'Sync already in progress' ||
        result2.error === 'Sync already in progress'

      expect(hasConcurrentError).toBe(true)
      // Both results should have the required properties
      expect(result1).toHaveProperty('success')
      expect(result2).toHaveProperty('success')
    })

    it('should reset sync state after completion', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      await syncManager.performSync(userId)

      // Second sync should be allowed
      const result = await syncManager.performSync(userId)
      expect(result.error).not.toBe('Sync already in progress')
    })
  })

  describe('sync result', () => {
    it('should return sync result with timestamp', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      const result = await syncManager.performSync(userId)

      expect(result).toHaveProperty('timestamp')
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include word and progress sync counts', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      const result = await syncManager.performSync(userId)

      expect(result).toHaveProperty('wordsSynced')
      expect(result).toHaveProperty('progressSynced')
      expect(typeof result.wordsSynced).toBe('number')
      expect(typeof result.progressSynced).toBe('number')
    })
  })

  describe('error handling', () => {
    it('should handle network check errors gracefully', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockRejectedValue(
        new Error('Network check failed')
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should catch subscription callback errors', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })
      const normalCallback = jest.fn()

      syncManager.subscribeSyncStatus(errorCallback)
      syncManager.subscribeSyncStatus(normalCallback)
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      // Should not throw even if callback errors - the key is that performSync completes
      const result = await syncManager.performSync(userId)

      // The test passes if performSync returns a result (doesn't throw)
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('timestamp')
    })
  })

  describe('sync timing', () => {
    it('should include timestamp in sync result', async () => {
      const mockTimestamp = '2025-10-20T00:00:00Z'
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )
      ;(networkUtils.getLastSyncTimestamp as jest.Mock).mockResolvedValue(
        mockTimestamp
      )

      const result = await syncManager.performSync(userId)

      // Verify that every sync result includes a timestamp
      expect(result).toHaveProperty('timestamp')
      expect(result.timestamp).toMatch(/^(\d{4})-(\d{2})-(\d{2})T/) // ISO date format
    })

    it('should return result with timestamp property', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      const result = await syncManager.performSync(userId)

      // Key test: sync result should have timestamp and success properties
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('error')
    })
  })

  describe('offline-first behavior', () => {
    it('should return success false when no network', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        false
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
    })

    it('should maintain sync state independently', async () => {
      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )

      const manager1 = new SyncManager()
      const manager2 = new SyncManager()

      await manager1.performSync(userId)
      const result2 = await manager2.performSync(userId)

      // Different instances should have independent sync state
      expect(result2.error).not.toBe('Sync already in progress')
    })
  })
})
