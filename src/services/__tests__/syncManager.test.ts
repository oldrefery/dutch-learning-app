/**
 * Integration tests for SyncManager
 * Tests offline-first sync orchestration with mocks
 */

import { SyncManager } from '../syncManager'
import * as networkUtils from '@/utils/network'
import { supabase, wordService } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'

jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/supabase')
jest.mock('@/utils/network')
jest.mock('@/db/wordRepository', () => ({
  wordRepository: {
    getWordsByUserId: jest.fn().mockResolvedValue([]),
    saveWords: jest.fn().mockResolvedValue(undefined),
    getPendingSyncWords: jest.fn().mockResolvedValue([]),
    markWordsSynced: jest.fn().mockResolvedValue(undefined),
    markWordsError: jest.fn().mockResolvedValue(undefined),
    deleteOrphanWords: jest.fn().mockResolvedValue({ count: 0 }),
    deleteInvalidWords: jest.fn().mockResolvedValue({ count: 0, words: [] }),
  },
}))
jest.mock('@/db/progressRepository', () => ({
  progressRepository: {
    getPendingSyncProgress: jest.fn().mockResolvedValue([]),
    markProgressSynced: jest.fn().mockResolvedValue(undefined),
  },
}))
jest.mock('@/db/collectionRepository', () => ({
  collectionRepository: {
    getPendingSyncCollections: jest.fn().mockResolvedValue([]),
    markCollectionsSynced: jest.fn().mockResolvedValue(undefined),
    getDeletedCollections: jest.fn().mockResolvedValue([]),
    saveCollections: jest.fn().mockResolvedValue(undefined),
    deleteCollection: jest.fn().mockResolvedValue(undefined),
    getCollectionsByIds: jest.fn().mockResolvedValue([]),
  },
}))

describe('SyncManager', () => {
  // Helper functions to generate random test data
  const SYNC_AUTH_PRECHECK_ERROR =
    'Authentication expired. Please sign in again to sync.'
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`
  const MAIN_COLLECTION_ID = 'collection-main'
  const DEFAULT_TIMESTAMP = '2026-02-23T00:00:00.000Z'
  const DEFAULT_REVIEW_DATE = '2026-02-23'
  const createSession = (expiresInSeconds: number) => ({
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  })

  const createPendingWord = (overrides: Record<string, unknown> = {}) => ({
    word_id: generateId('word'),
    user_id: userId,
    collection_id: MAIN_COLLECTION_ID,
    dutch_lemma: 'huis',
    dutch_original: 'huis',
    part_of_speech: 'noun',
    is_irregular: false,
    is_reflexive: false,
    is_expression: false,
    expression_type: null,
    is_separable: false,
    prefix_part: null,
    root_verb: null,
    article: 'het',
    plural: null,
    translations: { en: ['house'] },
    examples: [],
    synonyms: [],
    antonyms: [],
    conjugation: null,
    preposition: null,
    image_url: null,
    tts_url: null,
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: DEFAULT_REVIEW_DATE,
    last_reviewed_at: null,
    analysis_notes: null,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
    sync_status: 'pending',
    ...overrides,
  })

  let syncManager: SyncManager
  const userId = generateId('user')

  beforeEach(() => {
    jest.clearAllMocks()
    syncManager = new SyncManager()
    ;(supabase as any).auth = {
      getSession: jest.fn().mockResolvedValue({
        data: { session: createSession(60 * 60) },
        error: null,
      }),
      refreshSession: jest.fn().mockResolvedValue({
        data: { session: createSession(60 * 60) },
        error: null,
      }),
    }
    ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
      const resolved = { data: [], error: null }

      if (tableName === 'words') {
        const wordsQuery = Promise.resolve(resolved) as any
        wordsQuery.gt = jest.fn().mockResolvedValue(resolved)

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue(wordsQuery),
          }),
          upsert: jest.fn().mockResolvedValue(resolved),
        }
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(resolved),
        }),
        upsert: jest.fn().mockResolvedValue(resolved),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(resolved),
        }),
      }
    })
    ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(true)
    ;(networkUtils.getLastSyncTimestamp as jest.Mock).mockResolvedValue(null)
    ;(networkUtils.setLastSyncTimestamp as jest.Mock).mockResolvedValue(void 0)
    ;(wordService.checkWordExists as jest.Mock).mockResolvedValue(null)
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

      await syncManager.performSync(userId)

      expect(networkUtils.checkNetworkConnection).toHaveBeenCalled()
    })
  })

  describe('auth preflight', () => {
    it('should refresh expired session before sync stages', async () => {
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: createSession(-60) },
        error: null,
      })
      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: createSession(60 * 60) },
        error: null,
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    })

    it('should return controlled error and skip sync stages when refresh fails', async () => {
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null,
      })
      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token invalid' },
      })
      ;(supabase.from as jest.Mock).mockClear()

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe(SYNC_AUTH_PRECHECK_ERROR)
      expect(supabase.from).not.toHaveBeenCalled()
    })
  })

  describe('auth/rls retry hardening', () => {
    it('should retry pull words once after JWT expiry by refreshing session', async () => {
      const wordsEq = jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'JWT expired' },
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })

      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: wordsEq,
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordsEq).toHaveBeenCalledTimes(2)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Recoverable sync stage failure detected; refreshing session and retrying once',
        expect.objectContaining({
          tags: expect.objectContaining({
            operation: 'pull_words',
            sync_error_type: 'auth_expired',
          }),
        })
      )
    })

    it('should return controlled sync error when retry refresh fails', async () => {
      const wordsEq = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'JWT expired' },
      })

      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token invalid' },
      })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: wordsEq,
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe(SYNC_AUTH_PRECHECK_ERROR)
      expect(Sentry.captureException).not.toHaveBeenCalled()
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Sync retry aborted because session refresh failed',
        expect.objectContaining({
          tags: expect.objectContaining({
            operation: 'pull_words',
            sync_retry: 'refresh_failed',
          }),
        })
      )
    })

    it('should retry push words once after RLS failure', async () => {
      const pendingWord = createPendingWord({
        word_id: 'word-rls',
      })
      const rlsError = {
        code: '42501',
        message: 'new row violates row-level security policy for table "words"',
        details: 'RLS check failed',
      }

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([
        pendingWord,
      ])
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock).mockResolvedValue(null)

      const wordsUpsert = jest
        .fn()
        .mockResolvedValueOnce({ data: [], error: rlsError })
        .mockResolvedValueOnce({ data: [], error: null })

      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: wordsUpsert,
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordsUpsert).toHaveBeenCalledTimes(2)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Recoverable sync stage failure detected; refreshing session and retrying once',
        expect.objectContaining({
          tags: expect.objectContaining({
            operation: 'push_words',
            sync_error_type: 'rls',
          }),
        })
      )
    })

    it('should always push words with authenticated user_id', async () => {
      const pendingWord = createPendingWord({
        word_id: 'word-user-normalized',
        user_id: 'stale-user-id',
      })

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([
        pendingWord,
      ])
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock).mockResolvedValue(null)

      const wordsUpsert = jest.fn().mockResolvedValue({ data: [], error: null })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: wordsUpsert,
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)
      const syncedWordsPayload = wordsUpsert.mock.calls[0][0]

      expect(result.success).toBe(true)
      expect(Array.isArray(syncedWordsPayload)).toBe(true)
      expect(syncedWordsPayload[0].user_id).toBe(userId)
    })
  })

  describe('sync state management', () => {
    const SYNC_IN_PROGRESS_ERROR = 'Sync already in progress'

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
        result1.error === SYNC_IN_PROGRESS_ERROR ||
        result2.error === SYNC_IN_PROGRESS_ERROR

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
      expect(result.error).not.toBe(SYNC_IN_PROGRESS_ERROR)
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
      expect(result.error).toBeUndefined()
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

    it('should skip pending collections during pull', async () => {
      const pendingCollection = {
        collection_id: 'col-pending',
        user_id: userId,
        name: 'Local Rename',
        description: null,
        is_shared: false,
        shared_with: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending' as const,
      }

      ;(networkUtils.checkNetworkConnection as jest.Mock).mockResolvedValue(
        true
      )
      ;(
        collectionRepository.getPendingSyncCollections as jest.Mock
      ).mockResolvedValue([pendingCollection])
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    collection_id: 'col-pending',
                    user_id: userId,
                    name: 'Remote Old Name',
                    description: null,
                    is_shared: false,
                    shared_with: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  {
                    collection_id: 'col-remote',
                    user_id: userId,
                    name: 'Remote New',
                    description: null,
                    is_shared: false,
                    shared_with: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
                error: null,
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      await syncManager.performSync(userId)

      expect(collectionRepository.saveCollections).toHaveBeenCalledWith([
        expect.objectContaining({
          collection_id: 'col-remote',
          name: 'Remote New',
        }),
      ])
    })
  })

  describe('semantic duplicate handling', () => {
    it('should truncate local duplicate payload in Sentry warning', async () => {
      const pendingWords = Array.from({ length: 25 }, (_, index) =>
        createPendingWord({
          word_id: `local-dup-${index}`,
          dutch_lemma: 'huis',
        })
      )

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue(
        pendingWords
      )
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock).mockResolvedValue(null)

      const wordsUpsert = jest.fn().mockResolvedValue({ data: [], error: null })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: wordsUpsert,
          }
        }

        return {
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Local semantic duplicates skipped before sync upsert',
        expect.objectContaining({
          extra: expect.objectContaining({
            duplicateCount: 24,
            duplicateSampleSize: 20,
            duplicateTruncatedCount: 4,
            words: expect.arrayContaining([
              expect.objectContaining({ word_id: 'local-dup-1' }),
            ]),
          }),
        })
      )
    })

    it('should log remote duplicates as breadcrumb without creating warning issue for normal batches', async () => {
      const duplicateWords = Array.from({ length: 25 }, (_, index) =>
        createPendingWord({
          word_id: `remote-dup-${index}`,
          dutch_lemma: `woord-${index}`,
        })
      )

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue(
        duplicateWords
      )
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock).mockResolvedValue({
        word_id: 'server-dup',
      })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        return {
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sync.duplicates',
          message: 'Skipped 25 remote semantic duplicates during sync',
          data: expect.objectContaining({
            duplicateCount: 25,
            duplicateSampleSize: 20,
            duplicateTruncatedCount: 5,
            words: expect.arrayContaining([
              expect.objectContaining({ word_id: 'remote-dup-0' }),
            ]),
          }),
        })
      )
      expect(Sentry.captureMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('Duplicate words prevented during sync'),
        expect.anything()
      )
    })

    it('should create warning issue when remote duplicate batch is unusually large', async () => {
      const duplicateWords = Array.from({ length: 101 }, (_, index) =>
        createPendingWord({
          word_id: `remote-large-dup-${index}`,
          dutch_lemma: `woord-large-${index}`,
        })
      )

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue(
        duplicateWords
      )
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock).mockResolvedValue({
        word_id: 'server-dup',
      })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        return {
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Large batch of remote semantic duplicates skipped during sync',
        expect.objectContaining({
          tags: expect.objectContaining({
            sync_error_type: 'duplicate_conflict_remote_large_batch',
          }),
          extra: expect.objectContaining({
            duplicateCount: 101,
            duplicateSampleSize: 20,
            duplicateTruncatedCount: 81,
          }),
          fingerprint: ['sync-duplicate-conflict', 'remote-large-batch'],
        })
      )
    })

    it('should skip server semantic duplicates and sync only unique words', async () => {
      const duplicateWord = createPendingWord({
        word_id: 'word-duplicate',
        dutch_lemma: 'huis',
      })
      const uniqueWord = createPendingWord({
        word_id: 'word-unique',
        dutch_lemma: 'fiets',
      })

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([
        duplicateWord,
        uniqueWord,
      ])
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock)
        .mockResolvedValueOnce({ word_id: 'server-duplicate' })
        .mockResolvedValueOnce(null)

      const wordsUpsert = jest.fn().mockResolvedValue({ data: [], error: null })
      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: wordsUpsert,
          }
        }

        return {
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(2)
      expect(wordsUpsert).toHaveBeenCalledTimes(1)
      expect(wordRepository.markWordsSynced).toHaveBeenCalledWith([
        'word-duplicate',
      ])
      expect(wordRepository.markWordsSynced).toHaveBeenCalledWith([
        'word-unique',
      ])
    })

    it('should reconcile 23505 semantic conflicts via per-word fallback', async () => {
      const firstWord = createPendingWord({
        word_id: 'word-1',
        dutch_lemma: 'huis',
      })
      const secondWord = createPendingWord({
        word_id: 'word-2',
        dutch_lemma: 'fiets',
      })
      const duplicateError = {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "idx_words_semantic_unique"',
        details:
          "Key (user_id, dutch_lemma, coalesce(part_of_speech, 'unknown'::text), coalesce(article, ''::text)) already exists.",
      }

      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([
        firstWord,
        secondWord,
      ])
      ;(
        collectionRepository.getCollectionsByIds as jest.Mock
      ).mockResolvedValue([
        {
          collection_id: MAIN_COLLECTION_ID,
          user_id: userId,
          name: 'Main',
          is_shared: false,
          created_at: DEFAULT_TIMESTAMP,
        },
      ])
      ;(wordService.checkWordExists as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ word_id: 'server-duplicate' })
        .mockResolvedValueOnce(null)

      const wordsUpsert = jest
        .fn()
        .mockResolvedValueOnce({ data: [], error: duplicateError })
        .mockResolvedValueOnce({ data: [], error: null })

      ;(supabase.from as jest.Mock).mockImplementation((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: wordsUpsert,
          }
        }

        return {
          upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(2)
      expect(wordsUpsert).toHaveBeenCalledTimes(2)
      expect(wordRepository.markWordsSynced).toHaveBeenCalledWith([
        'word-1',
        'word-2',
      ])
    })
  })
})
