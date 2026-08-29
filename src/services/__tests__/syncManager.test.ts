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
import { progressRepository } from '@/db/progressRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'

jest.mock('@/lib/supabaseClient')
jest.mock('@/lib/supabase')
jest.mock('@/utils/network')
jest.mock('@/db/wordRepository', () => ({
  wordRepository: {
    getWordsByUserId: jest.fn().mockResolvedValue([]),
    saveWords: jest.fn().mockResolvedValue(undefined),
    saveRemoteWordTombstones: jest.fn().mockResolvedValue(undefined),
    getPendingSyncWords: jest.fn().mockResolvedValue([]),
    getDeletedWords: jest.fn().mockResolvedValue([]),
    markWordsSynced: jest.fn().mockResolvedValue(undefined),
    reconcilePushedWords: jest.fn().mockResolvedValue(undefined),
    markWordTombstonesSynced: jest.fn().mockResolvedValue(undefined),
    markWordsError: jest.fn().mockResolvedValue(undefined),
    deleteWordsByCollection: jest.fn().mockResolvedValue(undefined),
    deleteOrphanWords: jest.fn().mockResolvedValue({ count: 0 }),
    deleteInvalidWords: jest.fn().mockResolvedValue({ count: 0, words: [] }),
  },
}))
jest.mock('@/db/progressRepository', () => ({
  progressRepository: {
    getPendingSyncProgress: jest.fn().mockResolvedValue([]),
    getDeletedProgress: jest.fn().mockResolvedValue([]),
    saveProgress: jest.fn().mockResolvedValue(undefined),
    saveRemoteProgressTombstones: jest.fn().mockResolvedValue(undefined),
    markProgressSynced: jest.fn().mockResolvedValue(undefined),
    reconcilePushedProgress: jest.fn().mockResolvedValue(undefined),
    markProgressTombstonesSynced: jest.fn().mockResolvedValue(undefined),
  },
}))
jest.mock('@/db/reviewEventRepository', () => ({
  reviewEventRepository: {
    getPendingSyncEvents: jest.fn().mockResolvedValue([]),
    saveRemoteEvents: jest.fn().mockResolvedValue(undefined),
    reconcilePushedEvents: jest.fn().mockResolvedValue(undefined),
  },
}))
jest.mock('@/db/collectionRepository', () => ({
  collectionRepository: {
    getPendingSyncCollections: jest.fn().mockResolvedValue([]),
    markCollectionsSynced: jest.fn().mockResolvedValue(undefined),
    reconcilePushedCollections: jest.fn().mockResolvedValue(undefined),
    getDeletedCollections: jest.fn().mockResolvedValue([]),
    saveCollections: jest.fn().mockResolvedValue(undefined),
    deleteCollection: jest.fn().mockResolvedValue(undefined),
    getCollectionsByIds: jest.fn().mockResolvedValue([]),
    getCollectionsByUserId: jest.fn().mockResolvedValue([]),
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
  const SERVER_TIMESTAMP = '2026-07-25T16:00:00.000Z'
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
    usage_notes: null,
    created_at: DEFAULT_TIMESTAMP,
    updated_at: DEFAULT_TIMESTAMP,
    sync_status: 'pending',
    ...overrides,
  })

  const createWordsPullQuery = (
    range: jest.Mock = jest.fn().mockResolvedValue({ data: [], error: null })
  ) => {
    const query = {
      eq: jest.fn(),
      gte: jest.fn(),
      order: jest.fn(),
      range,
    }
    query.eq.mockReturnValue(query)
    query.gte.mockReturnValue(query)
    query.order.mockReturnValue(query)
    return query
  }

  const createProgressPullQuery = createWordsPullQuery

  const createServerAcknowledgements = (
    payload: unknown
  ): Record<string, unknown>[] => {
    const rows = Array.isArray(payload) ? payload : [payload]

    return rows
      .filter(
        (row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null
      )
      .map(row => {
        if (typeof row.event_id === 'string') {
          return {
            event_id: row.event_id,
            created_at: SERVER_TIMESTAMP,
          }
        }
        if (typeof row.progress_id === 'string') {
          return {
            progress_id: row.progress_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: row.deleted_at ?? null,
          }
        }
        if (typeof row.word_id === 'string') {
          return {
            word_id: row.word_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: row.deleted_at ?? null,
          }
        }
        return {
          collection_id: row.collection_id,
          updated_at: SERVER_TIMESTAMP,
        }
      })
  }

  const createUpsertMock = (
    ...results: { data?: unknown[] | null; error?: unknown }[]
  ): jest.Mock => {
    let resultIndex = 0

    return jest.fn().mockImplementation((payload: unknown) => {
      const configuredResult = results[resultIndex++]
      const response = {
        data:
          configuredResult && 'data' in configuredResult
            ? configuredResult.data
            : createServerAcknowledgements(payload),
        error: configuredResult?.error ?? null,
      }

      return {
        select: jest.fn().mockResolvedValue(response),
      }
    })
  }

  const createUpdateMock = (idColumn: 'word_id' | 'progress_id'): jest.Mock =>
    jest.fn().mockImplementation((updates: Record<string, unknown>) => {
      let ids: string[] = []
      const query = {
        eq: jest.fn(),
        in: jest.fn(),
        select: jest.fn().mockImplementation(async () => ({
          data: ids.map(id => ({
            [idColumn]: id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: updates.deleted_at ?? null,
          })),
          error: null,
        })),
      }
      query.eq.mockReturnValue(query)
      query.in.mockImplementation((_column: string, values: string[]) => {
        ids = values
        return query
      })
      return query
    })

  const createProgressTable = (
    query = createProgressPullQuery(),
    update = createUpdateMock('progress_id'),
    upsert = createUpsertMock()
  ) => ({
    select: jest.fn().mockReturnValue(query),
    upsert,
    update,
  })

  const createReviewEventTable = (
    query = createWordsPullQuery(),
    upsert = createUpsertMock()
  ) => ({
    select: jest.fn().mockReturnValue(query),
    upsert,
  })

  const mockSupabaseFrom = (
    implementation: (tableName: string) => unknown,
    reviewEventTable = createReviewEventTable()
  ): void => {
    ;(supabase.from as jest.Mock).mockImplementation((tableName: string) =>
      tableName === 'review_events'
        ? reviewEventTable
        : implementation(tableName)
    )
  }

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
    mockSupabaseFrom((tableName: string) => {
      const resolved = { data: [], error: null, count: 0 }

      if (tableName === 'words') {
        return {
          select: jest.fn().mockReturnValue(createWordsPullQuery()),
          upsert: createUpsertMock(),
          update: createUpdateMock('word_id'),
        }
      }

      if (tableName === 'user_progress') {
        return createProgressTable()
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(resolved),
        }),
        upsert: createUpsertMock(),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue(resolved),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(resolved),
        }),
      }
    })
    ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)
    ;(networkUtils.getSyncCursor as jest.Mock).mockResolvedValue(null)
    ;(networkUtils.setSyncCursor as jest.Mock).mockResolvedValue(void 0)
    ;(wordService.checkWordExists as jest.Mock).mockResolvedValue(null)
    ;(
      collectionRepository.getCollectionsByUserId as jest.Mock
    ).mockResolvedValue([])
    ;(wordRepository.getDeletedWords as jest.Mock).mockResolvedValue([])
    ;(progressRepository.getDeletedProgress as jest.Mock).mockResolvedValue([])
    ;(progressRepository.getPendingSyncProgress as jest.Mock).mockResolvedValue(
      []
    )
    ;(
      reviewEventRepository.getPendingSyncEvents as jest.Mock
    ).mockResolvedValue([])
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
    it('should skip auth and sync when internet is not reachable', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(false)

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No network connection')
      expect(result.wordsSynced).toBe(0)
      expect(supabase.auth.getSession).not.toHaveBeenCalled()
    })

    it('should use reachability-aware preflight before proceeding', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      await syncManager.performSync(userId)

      expect(networkUtils.isNetworkAvailable).toHaveBeenCalled()
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
      const wordsRange = jest
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'JWT expired' },
        })
        .mockResolvedValueOnce({
          data: [],
          error: null,
        })

      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery(wordsRange)),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordsRange).toHaveBeenCalledTimes(2)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sync.retry',
          level: 'warning',
          data: expect.objectContaining({
            stage: 'pull_words',
            syncErrorType: 'auth_expired',
          }),
        })
      )
    })

    it('should return controlled sync error when retry refresh fails', async () => {
      const wordsRange = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'JWT expired' },
      })

      ;(supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token invalid' },
      })
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery(wordsRange)),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
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

      const wordsUpsert = createUpsertMock({ error: rlsError }, {})

      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordsUpsert).toHaveBeenCalledTimes(2)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sync.retry',
          level: 'warning',
          data: expect.objectContaining({
            stage: 'push_words',
            syncErrorType: 'rls',
          }),
        })
      )
    })

    it('should always push words with authenticated user_id', async () => {
      const pendingWord = createPendingWord({
        word_id: 'word-user-normalized',
        user_id: 'stale-user-id',
        usage_notes: {
          summary: 'Use huis in everyday conversation.',
          contrasts: [],
        },
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

      const wordsUpsert = createUpsertMock()
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)
      const syncedWordsPayload = wordsUpsert.mock.calls[0][0]

      expect(result.success).toBe(true)
      expect(Array.isArray(syncedWordsPayload)).toBe(true)
      expect(syncedWordsPayload[0].user_id).toBe(userId)
      expect(syncedWordsPayload[0].tts_url).toBe('')
      expect(syncedWordsPayload[0].usage_notes).toEqual({
        summary: 'Use huis in everyday conversation.',
        contrasts: [],
      })
    })
  })

  describe('sync state management', () => {
    const SYNC_IN_PROGRESS_ERROR = 'Sync already in progress'

    it('should prevent concurrent syncs', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

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
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      await syncManager.performSync(userId)

      // Second sync should be allowed
      const result = await syncManager.performSync(userId)
      expect(result.error).not.toBe(SYNC_IN_PROGRESS_ERROR)
    })
  })

  describe('sync result', () => {
    it('should return sync result with timestamp', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      const result = await syncManager.performSync(userId)

      expect(result).toHaveProperty('timestamp')
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include word and progress sync counts', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      const result = await syncManager.performSync(userId)

      expect(result).toHaveProperty('wordsSynced')
      expect(result).toHaveProperty('progressSynced')
      expect(typeof result.wordsSynced).toBe('number')
      expect(typeof result.progressSynced).toBe('number')
    })
  })

  describe('error handling', () => {
    it('should handle network check errors gracefully', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockRejectedValue(
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
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

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
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)
      ;(networkUtils.getLastSyncTimestamp as jest.Mock).mockResolvedValue(
        mockTimestamp
      )

      const result = await syncManager.performSync(userId)

      // Verify that every sync result includes a timestamp
      expect(result).toHaveProperty('timestamp')
      expect(result.timestamp).toMatch(/^(\d{4})-(\d{2})-(\d{2})T/) // ISO date format
    })

    it('should return result with timestamp property', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

      const result = await syncManager.performSync(userId)

      // Key test: sync result should have timestamp and success properties
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('success')
      expect(result.error).toBeUndefined()
    })
  })

  describe('offline-first behavior', () => {
    it('should return success false when no network', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(false)

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
    })

    it('should maintain sync state independently', async () => {
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)

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

      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValue(true)
      ;(
        collectionRepository.getPendingSyncCollections as jest.Mock
      ).mockResolvedValue([pendingCollection])
      mockSupabaseFrom((tableName: string) => {
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
            upsert: createUpsertMock(),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
            delete: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
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

    it('should remove a synced collection that was deleted remotely', async () => {
      const localCollection = {
        collection_id: 'col-deleted-remotely',
        user_id: userId,
        name: 'Deleted elsewhere',
        description: null,
        is_shared: false,
        shared_with: null,
        share_token: null,
        shared_at: null,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
        sync_status: 'synced',
      }
      ;(
        collectionRepository.getCollectionsByUserId as jest.Mock
      ).mockResolvedValue([localCollection])

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordRepository.deleteWordsByCollection).toHaveBeenCalledWith(
        localCollection.collection_id,
        userId
      )
      expect(collectionRepository.deleteCollection).toHaveBeenCalledWith(
        localCollection.collection_id
      )
    })
  })

  describe('word delta cursor', () => {
    const cursorUpdatedAt = '2026-07-25T10:00:00.000Z'
    const nextUpdatedAt = '2026-07-25T11:00:00.000Z'

    const mockWordPullPages = (
      pages: ReturnType<typeof createPendingWord>[][]
    ) => {
      const range = jest.fn().mockResolvedValue({ data: [], error: null })
      pages.forEach(page => {
        range.mockResolvedValueOnce({ data: page, error: null })
      })
      const query = createWordsPullQuery(range)

      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(query),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      return query
    }

    const mockWordPull = (words: ReturnType<typeof createPendingWord>[]) =>
      mockWordPullPages([words])

    it('should pull a word created before the cursor but updated after it', async () => {
      const updatedWordId = 'word-updated'
      const cursor = {
        updatedAt: cursorUpdatedAt,
        id: 'word-cursor',
      }
      const remoteWord = createPendingWord({
        word_id: updatedWordId,
        created_at: '2026-07-24T10:00:00.000Z',
        updated_at: nextUpdatedAt,
        sync_status: 'synced',
        usage_notes: JSON.stringify({
          summary: 'Use woning in formal housing contexts.',
          contrasts: [],
        }),
      })
      const query = mockWordPull([remoteWord])

      ;(networkUtils.getSyncCursor as jest.Mock).mockResolvedValue(cursor)

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(query.gte).toHaveBeenCalledWith('updated_at', cursor.updatedAt)
      expect(wordRepository.saveWords).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            word_id: updatedWordId,
            created_at: '2026-07-24T10:00:00.000Z',
            updated_at: nextUpdatedAt,
            usage_notes: {
              summary: 'Use woning in formal housing contexts.',
              contrasts: [],
            },
          }),
        ],
        { preserveUnsynced: true }
      )
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(userId, 'words', {
        updatedAt: nextUpdatedAt,
        id: updatedWordId,
      })
    })

    it('should use word id as the tiebreaker for equal timestamps', async () => {
      const updatedAt = cursorUpdatedAt
      const cursor = {
        updatedAt,
        id: 'word-b',
      }
      mockWordPull([
        createPendingWord({
          word_id: 'word-c',
          updated_at: updatedAt,
          sync_status: 'synced',
        }),
        createPendingWord({
          word_id: 'word-a',
          updated_at: updatedAt,
          sync_status: 'synced',
        }),
        createPendingWord({
          word_id: 'word-b',
          updated_at: updatedAt,
          sync_status: 'synced',
        }),
      ])
      ;(networkUtils.getSyncCursor as jest.Mock).mockResolvedValue(cursor)

      await syncManager.performSync(userId)

      expect(wordRepository.saveWords).toHaveBeenCalledWith(
        [expect.objectContaining({ word_id: 'word-c' })],
        { preserveUnsynced: true }
      )
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(userId, 'words', {
        updatedAt,
        id: 'word-c',
      })
    })

    it('should not advance the cursor when local apply fails', async () => {
      const cursor = {
        updatedAt: cursorUpdatedAt,
        id: 'word-cursor',
      }

      mockWordPull([
        createPendingWord({
          word_id: 'word-apply-failure',
          updated_at: nextUpdatedAt,
          sync_status: 'synced',
        }),
      ])
      ;(networkUtils.getSyncCursor as jest.Mock).mockResolvedValue(cursor)
      ;(wordRepository.saveWords as jest.Mock).mockRejectedValueOnce(
        new Error('SQLite apply failed')
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SQLite apply failed')
      expect(networkUtils.setSyncCursor).not.toHaveBeenCalled()
    })

    it('should pull every ordered page before advancing the cursor', async () => {
      const words = Array.from({ length: 501 }, (_, index) =>
        createPendingWord({
          word_id: `word-${index.toString().padStart(3, '0')}`,
          updated_at: nextUpdatedAt,
          sync_status: 'synced',
        })
      )
      const query = mockWordPullPages([words.slice(0, 500), words.slice(500)])

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(query.order).toHaveBeenCalledWith('updated_at', {
        ascending: true,
      })
      expect(query.order).toHaveBeenCalledWith('word_id', { ascending: true })
      expect(query.range).toHaveBeenNthCalledWith(1, 0, 499)
      expect(query.range).toHaveBeenNthCalledWith(2, 500, 999)
      expect(wordRepository.saveWords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ word_id: 'word-000' }),
          expect.objectContaining({ word_id: 'word-500' }),
        ]),
        { preserveUnsynced: true }
      )
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(userId, 'words', {
        updatedAt: nextUpdatedAt,
        id: 'word-500',
      })
    })

    it('should apply a remote tombstone before advancing the cursor', async () => {
      const deletedAt = '2026-07-25T11:30:00.000Z'
      const remoteTombstone = createPendingWord({
        word_id: 'word-deleted-remotely',
        updated_at: deletedAt,
        deleted_at: deletedAt,
        sync_status: 'synced',
      })
      mockWordPull([remoteTombstone])

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(wordRepository.saveRemoteWordTombstones).toHaveBeenCalledWith([
        expect.objectContaining({
          word_id: remoteTombstone.word_id,
          deleted_at: deletedAt,
        }),
      ])
      expect(wordRepository.saveWords).toHaveBeenCalledWith([], {
        preserveUnsynced: true,
      })
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(userId, 'words', {
        updatedAt: deletedAt,
        id: remoteTombstone.word_id,
      })
    })
  })

  describe('progress delta cursor', () => {
    const cursorUpdatedAt = '2026-07-25T13:00:00.000Z'
    const nextUpdatedAt = '2026-07-25T14:00:00.000Z'
    const cursorProgressId = 'progress-b'
    const progressAfterCursorId = 'progress-c'

    const createRemoteProgress = (overrides: Record<string, unknown> = {}) => ({
      progress_id: 'progress-remote',
      user_id: userId,
      word_id: 'word-remote',
      status: 'learning',
      reviewed_count: 2,
      last_reviewed_at: nextUpdatedAt,
      created_at: DEFAULT_TIMESTAMP,
      updated_at: nextUpdatedAt,
      deleted_at: null,
      ...overrides,
    })

    const mockProgressPullPages = (
      pages: ReturnType<typeof createRemoteProgress>[][]
    ) => {
      const range = jest.fn().mockResolvedValue({ data: [], error: null })
      pages.forEach(page => {
        range.mockResolvedValueOnce({ data: page, error: null })
      })
      const query = createProgressPullQuery(range)

      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable(query)
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          }),
          upsert: createUpsertMock(),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      return query
    }

    it('should pull progress updated after its per-user cursor', async () => {
      const cursor = {
        updatedAt: cursorUpdatedAt,
        id: 'progress-cursor',
      }
      const remoteProgress = createRemoteProgress()
      const query = mockProgressPullPages([[remoteProgress]])
      ;(networkUtils.getSyncCursor as jest.Mock).mockImplementation(
        (_requestedUserId: string, table: string) =>
          table === 'user_progress' ? cursor : null
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.progressSynced).toBe(1)
      expect(query.gte).toHaveBeenCalledWith('updated_at', cursor.updatedAt)
      expect(progressRepository.saveProgress).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            progress_id: remoteProgress.progress_id,
            reviewed_count: remoteProgress.reviewed_count,
            updated_at: nextUpdatedAt,
          }),
        ],
        { preserveUnsynced: true }
      )
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(
        userId,
        'user_progress',
        {
          updatedAt: nextUpdatedAt,
          id: remoteProgress.progress_id,
        }
      )
    })

    it('should use progress id as the equal-timestamp tiebreaker', async () => {
      const cursor = {
        updatedAt: cursorUpdatedAt,
        id: cursorProgressId,
      }
      mockProgressPullPages([
        [
          createRemoteProgress({
            progress_id: progressAfterCursorId,
            updated_at: cursorUpdatedAt,
          }),
          createRemoteProgress({
            progress_id: 'progress-a',
            updated_at: cursorUpdatedAt,
          }),
          createRemoteProgress({
            progress_id: cursorProgressId,
            updated_at: cursorUpdatedAt,
          }),
        ],
      ])
      ;(networkUtils.getSyncCursor as jest.Mock).mockImplementation(
        (_requestedUserId: string, table: string) =>
          table === 'user_progress' ? cursor : null
      )

      await syncManager.performSync(userId)

      expect(progressRepository.saveProgress).toHaveBeenCalledWith(
        [expect.objectContaining({ progress_id: progressAfterCursorId })],
        { preserveUnsynced: true }
      )
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(
        userId,
        'user_progress',
        {
          updatedAt: cursorUpdatedAt,
          id: progressAfterCursorId,
        }
      )
    })

    it('should pull every ordered progress page before advancing', async () => {
      const progressRecords = Array.from({ length: 501 }, (_, index) =>
        createRemoteProgress({
          progress_id: `progress-${index.toString().padStart(3, '0')}`,
        })
      )
      const query = mockProgressPullPages([
        progressRecords.slice(0, 500),
        progressRecords.slice(500),
      ])

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.progressSynced).toBe(501)
      expect(query.order).toHaveBeenCalledWith('updated_at', {
        ascending: true,
      })
      expect(query.order).toHaveBeenCalledWith('progress_id', {
        ascending: true,
      })
      expect(query.range).toHaveBeenNthCalledWith(1, 0, 499)
      expect(query.range).toHaveBeenNthCalledWith(2, 500, 999)
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(
        userId,
        'user_progress',
        {
          updatedAt: nextUpdatedAt,
          id: 'progress-500',
        }
      )
    })

    it('should apply a remote progress tombstone before advancing', async () => {
      const deletedAt = '2026-07-25T15:00:00.000Z'
      const remoteTombstone = createRemoteProgress({
        progress_id: 'progress-deleted-remotely',
        updated_at: deletedAt,
        deleted_at: deletedAt,
      })
      mockProgressPullPages([[remoteTombstone]])

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(
        progressRepository.saveRemoteProgressTombstones
      ).toHaveBeenCalledWith([
        expect.objectContaining({
          progress_id: remoteTombstone.progress_id,
          deleted_at: deletedAt,
        }),
      ])
      expect(progressRepository.saveProgress).toHaveBeenCalledWith([], {
        preserveUnsynced: true,
      })
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(
        userId,
        'user_progress',
        {
          updatedAt: deletedAt,
          id: remoteTombstone.progress_id,
        }
      )
    })

    it('should not advance the progress cursor when local apply fails', async () => {
      mockProgressPullPages([[createRemoteProgress()]])
      ;(progressRepository.saveProgress as jest.Mock).mockRejectedValueOnce(
        new Error('SQLite progress apply failed')
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SQLite progress apply failed')
      expect(networkUtils.setSyncCursor).not.toHaveBeenCalled()
    })
  })

  describe('review event synchronization', () => {
    const createdAt = '2026-08-29T10:00:00.000Z'

    const createRemoteReviewEvent = (
      overrides: Record<string, unknown> = {}
    ) => ({
      event_id: 'event-remote',
      user_id: userId,
      word_id: 'word-remote',
      assessment: 'good',
      review_mode: 'recognition',
      answered_correctly: true,
      response_time_ms: 1200,
      previous_interval_days: 1,
      next_interval_days: 3,
      previous_easiness_factor: 2.5,
      next_easiness_factor: 2.6,
      reviewed_at: createdAt,
      created_at: createdAt,
      ...overrides,
    })

    const installReviewEventTable = (
      reviewEventTable: ReturnType<typeof createReviewEventTable>
    ) => {
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }
        if (tableName === 'user_progress') {
          return createProgressTable()
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          }),
          upsert: createUpsertMock(),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }, reviewEventTable)
    }

    it('uses event id as the equal-timestamp cursor tiebreaker', async () => {
      const range = jest.fn().mockResolvedValue({
        data: [
          createRemoteReviewEvent({ event_id: 'event-a' }),
          createRemoteReviewEvent({ event_id: 'event-b' }),
          createRemoteReviewEvent({ event_id: 'event-c' }),
        ],
        error: null,
      })
      const query = createWordsPullQuery(range)
      installReviewEventTable(createReviewEventTable(query))
      ;(networkUtils.getSyncCursor as jest.Mock).mockImplementation(
        (_requestedUserId: string, table: string) =>
          table === 'review_events'
            ? { updatedAt: createdAt, id: 'event-b' }
            : null
      )

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(query.gte).toHaveBeenCalledWith('created_at', createdAt)
      expect(reviewEventRepository.saveRemoteEvents).toHaveBeenCalledWith([
        expect.objectContaining({ event_id: 'event-c' }),
      ])
      expect(networkUtils.setSyncCursor).toHaveBeenCalledWith(
        userId,
        'review_events',
        { updatedAt: createdAt, id: 'event-c' }
      )
    })

    it('pulls every ordered event page before advancing the cursor', async () => {
      const events = Array.from({ length: 501 }, (_, index) =>
        createRemoteReviewEvent({
          event_id: `event-${index.toString().padStart(3, '0')}`,
        })
      )
      const range = jest
        .fn()
        .mockResolvedValueOnce({ data: events.slice(0, 500), error: null })
        .mockResolvedValueOnce({ data: events.slice(500), error: null })
      const query = createWordsPullQuery(range)
      installReviewEventTable(createReviewEventTable(query))

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(query.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      })
      expect(query.order).toHaveBeenCalledWith('event_id', { ascending: true })
      expect(query.range).toHaveBeenNthCalledWith(1, 0, 499)
      expect(query.range).toHaveBeenNthCalledWith(2, 500, 999)
      expect(reviewEventRepository.saveRemoteEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ event_id: 'event-000' }),
          expect.objectContaining({ event_id: 'event-500' }),
        ])
      )
    })

    it('does not advance the event cursor when local apply fails', async () => {
      const query = createWordsPullQuery(
        jest.fn().mockResolvedValue({
          data: [createRemoteReviewEvent()],
          error: null,
        })
      )
      installReviewEventTable(createReviewEventTable(query))
      ;(
        reviewEventRepository.saveRemoteEvents as jest.Mock
      ).mockRejectedValueOnce(new Error('SQLite event apply failed'))

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SQLite event apply failed')
      expect(networkUtils.setSyncCursor).not.toHaveBeenCalled()
    })

    it('retries an offline event with an idempotent upsert', async () => {
      const offlineEventId = 'event-offline'
      const pendingEvent = {
        ...createRemoteReviewEvent({ event_id: offlineEventId }),
        created_at: null,
        sync_status: 'pending',
        last_sync_attempt_at: null,
        synced_at: null,
      }
      const upsert = createUpsertMock()
      installReviewEventTable(
        createReviewEventTable(createWordsPullQuery(), upsert)
      )
      ;(
        reviewEventRepository.getPendingSyncEvents as jest.Mock
      ).mockResolvedValue([pendingEvent])
      ;(networkUtils.isNetworkAvailable as jest.Mock).mockResolvedValueOnce(
        false
      )

      const offlineResult = await syncManager.performSync(userId)
      const onlineResult = await syncManager.performSync(userId)
      const retryResult = await syncManager.performSync(userId)

      expect(offlineResult.success).toBe(false)
      expect(onlineResult.success).toBe(true)
      expect(retryResult.success).toBe(true)
      expect(upsert).toHaveBeenCalledTimes(2)
      expect(upsert).toHaveBeenNthCalledWith(
        1,
        [expect.objectContaining({ event_id: offlineEventId })],
        { onConflict: 'event_id' }
      )
      expect(reviewEventRepository.reconcilePushedEvents).toHaveBeenCalledWith(
        userId,
        [{ event_id: offlineEventId, created_at: SERVER_TIMESTAMP }]
      )
    })
  })

  describe('server timestamp reconciliation', () => {
    it('reconciles active progress with the server-issued timestamp', async () => {
      const pendingProgress = {
        progress_id: 'progress-pending',
        user_id: userId,
        word_id: 'word-1',
        status: 'learning',
        reviewed_count: 2,
        last_reviewed_at: null,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
        deleted_at: null,
        sync_status: 'pending',
        last_sync_attempt_at: null,
        synced_at: null,
      }
      const progressUpsert = createUpsertMock()

      ;(
        progressRepository.getPendingSyncProgress as jest.Mock
      ).mockResolvedValue([pendingProgress])
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }
        if (tableName === 'user_progress') {
          return createProgressTable(
            createProgressPullQuery(),
            createUpdateMock('progress_id'),
            progressUpsert
          )
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
              count: 0,
            }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)
      const pushedPayload = progressUpsert.mock.calls[0][0][0]

      expect(result.success).toBe(true)
      expect(pushedPayload).not.toHaveProperty('updated_at')
      expect(progressRepository.reconcilePushedProgress).toHaveBeenCalledWith(
        [
          {
            progress_id: pendingProgress.progress_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: null,
          },
        ],
        new Map([[pendingProgress.progress_id, DEFAULT_TIMESTAMP]])
      )
      expect(progressRepository.markProgressSynced).not.toHaveBeenCalled()
    })

    it('reconciles pending collections with the server-issued timestamp', async () => {
      const pendingCollection = {
        collection_id: 'collection-pending',
        user_id: userId,
        name: 'Pending collection',
        description: null,
        is_shared: false,
        shared_with: null,
        share_token: null,
        shared_at: null,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
        sync_status: 'pending',
        last_sync_attempt_at: null,
        synced_at: null,
      }
      const collectionUpsert = createUpsertMock()

      ;(
        collectionRepository.getPendingSyncCollections as jest.Mock
      ).mockResolvedValue([pendingCollection])
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0,
              }),
            }),
            upsert: collectionUpsert,
          }
        }
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }
        if (tableName === 'user_progress') {
          return createProgressTable()
        }
        return { upsert: createUpsertMock() }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(
        collectionRepository.reconcilePushedCollections
      ).toHaveBeenCalledWith(
        [
          {
            collection_id: pendingCollection.collection_id,
            updated_at: SERVER_TIMESTAMP,
          },
        ],
        new Map([[pendingCollection.collection_id, DEFAULT_TIMESTAMP]])
      )
      expect(collectionRepository.markCollectionsSynced).not.toHaveBeenCalled()
    })

    it('keeps a word pending when Supabase omits its acknowledgement', async () => {
      const pendingWord = createPendingWord({
        word_id: 'word-missing-acknowledgement',
      })
      const wordsUpsert = createUpsertMock({ data: [] })

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
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
                count: 0,
              }),
            }),
            upsert: createUpsertMock(),
          }
        }
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }
        if (tableName === 'user_progress') {
          return createProgressTable()
        }
        return { upsert: createUpsertMock() }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toContain(
        'Supabase returned an incomplete acknowledgement'
      )
      expect(wordRepository.reconcilePushedWords).not.toHaveBeenCalled()
      expect(wordRepository.markWordsSynced).not.toHaveBeenCalled()
    })
  })

  describe('delete tombstone push', () => {
    const DELETED_AT = '2026-07-25T12:00:00.000Z'

    it('should push word tombstones before considering active words', async () => {
      const deletedWord = createPendingWord({
        word_id: 'word-deleted-locally',
        deleted_at: DELETED_AT,
        sync_status: 'deleted',
      })
      const wordTombstoneSelect = jest.fn().mockResolvedValue({
        data: [
          {
            word_id: deletedWord.word_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: SERVER_TIMESTAMP,
          },
        ],
        error: null,
      })
      const wordTombstoneIn = jest.fn().mockReturnValue({
        select: wordTombstoneSelect,
      })
      const wordTombstoneEq = jest.fn().mockReturnValue({
        in: wordTombstoneIn,
      })
      const wordUpdate = jest.fn().mockReturnValue({
        eq: wordTombstoneEq,
      })

      ;(wordRepository.getDeletedWords as jest.Mock).mockResolvedValue([
        deletedWord,
      ])
      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([])
      ;(progressRepository.getDeletedProgress as jest.Mock).mockResolvedValue(
        []
      )
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            update: wordUpdate,
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(1)
      expect(wordUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      })
      expect(wordTombstoneEq).toHaveBeenCalledWith('user_id', userId)
      expect(wordTombstoneIn).toHaveBeenCalledWith('word_id', [
        deletedWord.word_id,
      ])
      expect(wordRepository.reconcilePushedWords).toHaveBeenCalledWith(
        [
          {
            word_id: deletedWord.word_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: SERVER_TIMESTAMP,
          },
        ],
        new Map([[deletedWord.word_id, DEFAULT_TIMESTAMP]])
      )
    })

    it('acknowledges a never-synced local tombstone when no remote row exists', async () => {
      const deletedWord = createPendingWord({
        word_id: 'word-deleted-before-first-sync',
        deleted_at: DELETED_AT,
        sync_status: 'deleted',
        synced_at: null,
      })
      const wordTombstoneSelect = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const wordTombstoneIn = jest.fn().mockReturnValue({
        select: wordTombstoneSelect,
      })
      const wordTombstoneEq = jest.fn().mockReturnValue({
        in: wordTombstoneIn,
      })
      const wordUpdate = jest.fn().mockReturnValue({
        eq: wordTombstoneEq,
      })

      ;(wordRepository.getDeletedWords as jest.Mock).mockResolvedValue([
        deletedWord,
      ])
      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([])
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            update: wordUpdate,
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(1)
      expect(wordRepository.reconcilePushedWords).toHaveBeenCalledWith(
        [],
        new Map([[deletedWord.word_id, DEFAULT_TIMESTAMP]])
      )
      expect(wordRepository.markWordTombstonesSynced).toHaveBeenCalledWith([
        deletedWord.word_id,
      ])
    })

    it('requires a remote acknowledgement for a previously synced tombstone', async () => {
      const deletedWord = createPendingWord({
        word_id: 'word-deleted-after-sync',
        deleted_at: DELETED_AT,
        sync_status: 'deleted',
        synced_at: DEFAULT_TIMESTAMP,
      })
      const wordTombstoneSelect = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const wordTombstoneIn = jest.fn().mockReturnValue({
        select: wordTombstoneSelect,
      })
      const wordTombstoneEq = jest.fn().mockReturnValue({
        in: wordTombstoneIn,
      })
      const wordUpdate = jest.fn().mockReturnValue({
        eq: wordTombstoneEq,
      })

      ;(wordRepository.getDeletedWords as jest.Mock).mockResolvedValue([
        deletedWord,
      ])
      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([])
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            update: wordUpdate,
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(false)
      expect(result.error).toContain(
        'Supabase returned an incomplete acknowledgement'
      )
      expect(wordRepository.reconcilePushedWords).not.toHaveBeenCalled()
      expect(wordRepository.markWordTombstonesSynced).not.toHaveBeenCalled()
    })

    it('should push progress tombstones through the prepared remote contract', async () => {
      const progressTombstoneSelect = jest.fn().mockResolvedValue({
        data: [
          {
            progress_id: 'progress-deleted-locally',
            updated_at: SERVER_TIMESTAMP,
            deleted_at: SERVER_TIMESTAMP,
          },
        ],
        error: null,
      })
      const progressTombstoneIn = jest.fn().mockReturnValue({
        select: progressTombstoneSelect,
      })
      const progressTombstoneEq = jest.fn().mockReturnValue({
        in: progressTombstoneIn,
      })
      const progressUpdate = jest.fn().mockReturnValue({
        eq: progressTombstoneEq,
      })
      const deletedProgress = {
        progress_id: 'progress-deleted-locally',
        user_id: userId,
        word_id: 'word-1',
        status: 'learning',
        reviewed_count: 1,
        last_reviewed_at: null,
        created_at: DEFAULT_TIMESTAMP,
        updated_at: DEFAULT_TIMESTAMP,
        deleted_at: DEFAULT_TIMESTAMP,
        sync_status: 'deleted',
      }

      ;(wordRepository.getDeletedWords as jest.Mock).mockResolvedValue([])
      ;(wordRepository.getPendingSyncWords as jest.Mock).mockResolvedValue([])
      ;(progressRepository.getDeletedProgress as jest.Mock).mockResolvedValue([
        deletedProgress,
      ])
      ;(
        progressRepository.getPendingSyncProgress as jest.Mock
      ).mockResolvedValue([])
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable(createProgressPullQuery(), progressUpdate)
        }

        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.progressSynced).toBe(1)
      expect(progressUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      })
      expect(progressTombstoneEq).toHaveBeenCalledWith('user_id', userId)
      expect(progressTombstoneIn).toHaveBeenCalledWith('progress_id', [
        deletedProgress.progress_id,
      ])
      expect(progressRepository.reconcilePushedProgress).toHaveBeenCalledWith(
        [
          {
            progress_id: deletedProgress.progress_id,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: SERVER_TIMESTAMP,
          },
        ],
        new Map([[deletedProgress.progress_id, DEFAULT_TIMESTAMP]])
      )
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

      const wordsUpsert = createUpsertMock()
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          upsert: createUpsertMock(),
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
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          upsert: createUpsertMock(),
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
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          upsert: createUpsertMock(),
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
      const uniqueWordId = 'word-unique'
      const duplicateWord = createPendingWord({
        word_id: 'word-duplicate',
        dutch_lemma: 'huis',
      })
      const uniqueWord = createPendingWord({
        word_id: uniqueWordId,
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

      const wordsUpsert = createUpsertMock()
      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(2)
      expect(wordsUpsert).toHaveBeenCalledTimes(1)
      expect(wordRepository.markWordsSynced).toHaveBeenCalledWith([
        {
          word_id: 'word-duplicate',
          updated_at: DEFAULT_TIMESTAMP,
        },
      ])
      expect(wordRepository.reconcilePushedWords).toHaveBeenCalledWith(
        [
          {
            word_id: uniqueWordId,
            updated_at: SERVER_TIMESTAMP,
            deleted_at: null,
          },
        ],
        new Map([[uniqueWordId, DEFAULT_TIMESTAMP]])
      )
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

      const wordsUpsert = createUpsertMock({ error: duplicateError }, {})

      mockSupabaseFrom((tableName: string) => {
        if (tableName === 'collections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: createUpsertMock(),
          }
        }

        if (tableName === 'words') {
          return {
            select: jest.fn().mockReturnValue(createWordsPullQuery()),
            upsert: wordsUpsert,
          }
        }

        if (tableName === 'user_progress') {
          return createProgressTable()
        }

        return {
          upsert: createUpsertMock(),
        }
      })

      const result = await syncManager.performSync(userId)

      expect(result.success).toBe(true)
      expect(result.wordsSynced).toBe(2)
      expect(wordsUpsert).toHaveBeenCalledTimes(2)
      expect(wordRepository.markWordsSynced).toHaveBeenCalledWith([
        {
          word_id: 'word-1',
          updated_at: DEFAULT_TIMESTAMP,
        },
      ])
      expect(wordRepository.reconcilePushedWords).toHaveBeenCalledWith(
        [
          {
            word_id: 'word-2',
            updated_at: SERVER_TIMESTAMP,
            deleted_at: null,
          },
        ],
        new Map([
          ['word-1', DEFAULT_TIMESTAMP],
          ['word-2', DEFAULT_TIMESTAMP],
        ])
      )
    })
  })
})
