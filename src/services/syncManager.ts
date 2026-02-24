import { collectionService, supabase, wordService } from '@/lib/supabase'
import { wordRepository } from '@/db/wordRepository'
import { progressRepository } from '@/db/progressRepository'
import { collectionRepository } from '@/db/collectionRepository'
import {
  checkNetworkConnection,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from '@/utils/network'
import type { Word } from '@/types/database'
import { Sentry } from '@/lib/sentry'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

export interface SyncResult {
  success: boolean
  wordsSynced: number
  progressSynced: number
  error?: string
  timestamp: string
}

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505'
const SEMANTIC_UNIQUE_INDEX = 'idx_words_semantic_unique'
const SYNC_AUTH_PRECHECK_ERROR =
  'Authentication expired. Please sign in again to sync.'
const SYNC_DUPLICATE_FINGERPRINT = 'sync-duplicate-conflict'
const MAX_DUPLICATE_SENTRY_SAMPLES = 20
const AUTH_ERROR_PATTERNS = [
  'jwt expired',
  'invalid jwt',
  'authentication expired',
  'refresh token',
  'not authenticated',
  'no active session',
]
const RLS_ERROR_PATTERNS = [
  'row-level security',
  'violates row-level security policy',
  'permission denied for table',
]

type SyncErrorType = 'auth_expired' | 'rls' | 'other'
type SyncStage =
  | 'pull_collections'
  | 'pull_words'
  | 'push_collections'
  | 'push_words'
  | 'push_progress'

class ControlledSyncError extends Error {
  public sentryHandled = true

  constructor(message: string) {
    super(message)
    this.name = 'ControlledSyncError'
  }
}

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
}

interface SupabaseSessionLike {
  expires_at?: number | null
}

interface SupabaseWordPayload {
  word_id: string
  user_id: string
  collection_id: string | null
  dutch_lemma: string
  dutch_original: string | null
  part_of_speech: string | null
  is_irregular: boolean
  is_reflexive: boolean
  is_expression: boolean
  expression_type: Word['expression_type']
  is_separable: boolean
  prefix_part: string | null
  root_verb: string | null
  article: Word['article']
  plural: string | null
  translations: Word['translations']
  examples: Word['examples']
  synonyms: string[]
  antonyms: string[]
  conjugation: Word['conjugation']
  preposition: string | null
  image_url: string | null
  tts_url: string | null
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
  last_reviewed_at: string | null
  analysis_notes: string | null
}

export class SyncManager {
  private isSyncing = false
  private syncListeners: ((result: SyncResult) => void)[] = []

  subscribeSyncStatus(callback: (result: SyncResult) => void): () => void {
    this.syncListeners.push(callback)
    return () => {
      this.syncListeners = this.syncListeners.filter(
        listener => listener !== callback
      )
    }
  }

  private notifySyncStatus(result: SyncResult): void {
    this.syncListeners.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        console.error('[Sync] Error in sync listener:', error)
      }
    })
  }

  async performSync(userId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[Sync] Sync already in progress, skipping')
      return {
        success: false,
        wordsSynced: 0,
        progressSynced: 0,
        error: 'Sync already in progress',
        timestamp: new Date().toISOString(),
      }
    }

    this.isSyncing = true

    try {
      console.log('[Sync] Stage 0: checking network')
      const isConnected = await checkNetworkConnection()
      if (!isConnected) {
        console.log('[Sync] No network connection, skipping sync')
        return {
          success: false,
          wordsSynced: 0,
          progressSynced: 0,
          error: 'No network connection',
          timestamp: new Date().toISOString(),
        }
      }

      console.log('[Sync] Stage 0.5: auth preflight')
      const authPrecheckError = await this.ensureSessionForSync()
      if (authPrecheckError) {
        const result: SyncResult = {
          success: false,
          wordsSynced: 0,
          progressSynced: 0,
          error: authPrecheckError,
          timestamp: new Date().toISOString(),
        }

        this.notifySyncStatus(result)
        return result
      }

      const timestamp = new Date().toISOString()

      // Step 0: Pull collections from Supabase
      console.log('[Sync] Stage 1: pull collections')
      await this.runSyncStageWithSessionRetry(
        'pull_collections',
        userId,
        async () => this.pullCollectionsFromSupabase(userId)
      )

      // Step 1: Pull new words from Supabase
      console.log('[Sync] Stage 2: pull words')
      const lastSync = await getLastSyncTimestamp()
      const pulledWords = await this.runSyncStageWithSessionRetry(
        'pull_words',
        userId,
        async () => this.pullWordsFromSupabase(userId, lastSync)
      )

      // Clean up local orphan words after pull
      await this.cleanupOrphanWords(userId)

      // Step 2: Push pending collection updates to Supabase (needed for FK on words)
      console.log('[Sync] Stage 3: push collections')
      await this.runSyncStageWithSessionRetry(
        'push_collections',
        userId,
        async () => this.pushCollectionsToSupabase(userId)
      )

      // Step 3: Push pending word updates to Supabase
      console.log('[Sync] Stage 4: push words')
      const pushedWordsCount = await this.runSyncStageWithSessionRetry(
        'push_words',
        userId,
        async () => this.pushWordsToSupabase(userId)
      )

      // Step 4: Push pending progress to Supabase
      console.log('[Sync] Stage 5: push progress')
      const pushedProgressCount = await this.runSyncStageWithSessionRetry(
        'push_progress',
        userId,
        async () => this.pushProgressToSupabase(userId)
      )

      // Update last sync timestamp
      await setLastSyncTimestamp(timestamp)

      const result: SyncResult = {
        success: true,
        wordsSynced: pulledWords.length + pushedWordsCount,
        progressSynced: pushedProgressCount,
        timestamp,
      }

      console.log('[Sync] Sync completed successfully:', result)
      this.notifySyncStatus(result)

      return result
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      const isNetworkError = this.isNetworkErrorMessage(errorMessage)

      // Don't report network errors - they're expected when offline
      if (isNetworkError) {
        console.log(
          '[Sync] Network error during sync (expected when offline):',
          errorMessage
        )
      } else if (error instanceof ControlledSyncError) {
        console.warn('[Sync] Controlled sync failure:', errorMessage)
      } else if (!this.isSentryHandledError(error)) {
        const syncErrorType = this.categorizeSyncError(error)
        console.error('[Sync] Error during sync:', error)
        Sentry.captureException(this.toError(error), {
          tags: {
            module: 'syncManager',
            operation: 'performSync',
            sync_error_type: syncErrorType,
          },
          extra: {
            userId,
            errorMessage,
          },
          fingerprint: ['sync-manager', syncErrorType],
        })
      }

      const result: SyncResult = {
        success: false,
        wordsSynced: 0,
        progressSynced: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }

      // Only notify if it's not a network error
      if (!isNetworkError) {
        this.notifySyncStatus(result)
      }

      return result
    } finally {
      this.isSyncing = false
    }
  }

  private async ensureSessionForSync(): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.warn('[Sync] Failed to read auth session before sync:', {
          message: error.message,
        })
      }

      const session = data?.session as SupabaseSessionLike | null | undefined
      if (session && !this.isSessionExpired(session)) {
        return null
      }

      console.log('[Sync] Session missing/expired; attempting refresh')
      const { data: refreshedData, error: refreshError } =
        await supabase.auth.refreshSession()
      const refreshedSession = refreshedData?.session as
        | SupabaseSessionLike
        | null
        | undefined

      if (
        refreshError ||
        !refreshedSession ||
        this.isSessionExpired(refreshedSession)
      ) {
        console.warn('[Sync] Session refresh failed before sync:', {
          message: refreshError?.message || 'No active session after refresh',
        })
        return SYNC_AUTH_PRECHECK_ERROR
      }

      return null
    } catch (error) {
      const message = this.getErrorMessage(error)
      console.warn('[Sync] Unexpected auth preflight error:', { message })
      return SYNC_AUTH_PRECHECK_ERROR
    }
  }

  private async refreshSessionForSyncRetry(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      const refreshedSession = data?.session as
        | SupabaseSessionLike
        | null
        | undefined

      if (
        error ||
        !refreshedSession ||
        this.isSessionExpired(refreshedSession)
      ) {
        console.warn('[Sync] Session refresh failed during retry:', {
          message: error?.message || 'No active session after refresh',
        })
        return false
      }

      return true
    } catch (error) {
      console.warn('[Sync] Unexpected session refresh retry error:', {
        message: this.getErrorMessage(error),
      })
      return false
    }
  }

  private async runSyncStageWithSessionRetry<T>(
    stage: SyncStage,
    userId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const syncErrorType = this.categorizeSyncError(error)
      if (syncErrorType === 'other') {
        throw error
      }

      const initialErrorMessage = this.getErrorMessage(error)
      Sentry.captureMessage(
        'Recoverable sync stage failure detected; refreshing session and retrying once',
        {
          level: 'warning',
          tags: {
            module: 'syncManager',
            operation: stage,
            sync_error_type: syncErrorType,
          },
          extra: {
            userId,
            stage,
            errorMessage: initialErrorMessage,
          },
          fingerprint: ['sync-stage-retry', stage, syncErrorType],
        }
      )

      const sessionRefreshed = await this.refreshSessionForSyncRetry()
      if (!sessionRefreshed) {
        Sentry.captureMessage(
          'Sync retry aborted because session refresh failed',
          {
            level: 'warning',
            tags: {
              module: 'syncManager',
              operation: stage,
              sync_error_type: syncErrorType,
              sync_retry: 'refresh_failed',
            },
            extra: {
              userId,
              stage,
              errorMessage: initialErrorMessage,
              authPrecheckError: SYNC_AUTH_PRECHECK_ERROR,
            },
            fingerprint: ['sync-refresh-failed', stage, syncErrorType],
          }
        )
        throw new ControlledSyncError(SYNC_AUTH_PRECHECK_ERROR)
      }

      try {
        return await operation()
      } catch (retryError) {
        const retryErrorType = this.categorizeSyncError(retryError)
        if (retryErrorType !== 'other') {
          Sentry.captureException(this.toError(retryError), {
            tags: {
              module: 'syncManager',
              operation: stage,
              sync_error_type: retryErrorType,
              sync_retry: 'after_refresh',
            },
            extra: {
              userId,
              stage,
              initialErrorMessage,
              retryErrorMessage: this.getErrorMessage(retryError),
            },
            fingerprint: ['sync-retry-failed', stage, retryErrorType],
          })
          this.markErrorAsSentryHandled(retryError)
        }

        throw retryError
      }
    }
  }

  private categorizeSyncError(error: unknown): SyncErrorType {
    const details = this.getErrorSearchableText(error)

    if (AUTH_ERROR_PATTERNS.some(pattern => details.includes(pattern))) {
      return 'auth_expired'
    }

    if (RLS_ERROR_PATTERNS.some(pattern => details.includes(pattern))) {
      return 'rls'
    }

    const code = this.getSupabaseErrorCode(error)
    if (code === '42501') {
      return 'rls'
    }

    return 'other'
  }

  private getErrorSearchableText(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return this.getErrorMessage(error).toLowerCase()
    }

    const supabaseError = error as SupabaseLikeError
    return [
      supabaseError.code || '',
      supabaseError.message || '',
      supabaseError.details || '',
      this.getErrorMessage(error),
    ]
      .join(' ')
      .toLowerCase()
  }

  private getSupabaseErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && code.trim() !== '' ? code : null
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (!error || typeof error !== 'object') return 'Unknown error'

    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim() !== '') {
      return maybeMessage
    }

    return 'Unknown error'
  }

  private isNetworkErrorMessage(message: string): boolean {
    return (
      message.includes('Network request failed') || message.includes('Network')
    )
  }

  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }

    return new Error(this.getErrorMessage(error))
  }

  private markErrorAsSentryHandled(error: unknown): void {
    if (!error || typeof error !== 'object') return
    ;(error as { sentryHandled?: boolean }).sentryHandled = true
  }

  private isSentryHandledError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    return Boolean((error as { sentryHandled?: boolean }).sentryHandled)
  }

  private isSessionExpired(session: SupabaseSessionLike): boolean {
    if (typeof session.expires_at !== 'number') {
      return false
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiryBufferSeconds = 30

    return session.expires_at <= nowSeconds + expiryBufferSeconds
  }

  private async pullWordsFromSupabase(
    userId: string,
    lastSync: string | null
  ): Promise<Word[]> {
    let query = supabase.from('words').select('*').eq('user_id', userId)

    if (lastSync) {
      query = query.gt('created_at', lastSync)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to pull words: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[Sync] No new words to pull from Supabase')
      return []
    }

    // Parse JSON fields from Supabase and ensure required fields
    const now = new Date().toISOString()
    const parsedWords = data.map(word => {
      return {
        ...word,
        user_id: userId,
        // Ensure created_at and updated_at are always set (fallback to current time)
        created_at: word.created_at || now,
        updated_at: word.updated_at || word.created_at || now,
        // Ensure next_review_date is always set (required by SQLite schema)
        // Extract date only from fallback values
        next_review_date:
          word.next_review_date || (word.created_at || now).split('T')[0],
        // Ensure SRS fields have defaults
        interval_days: word.interval_days ?? 1,
        repetition_count: word.repetition_count ?? 0,
        easiness_factor: word.easiness_factor ?? 2.5,
        translations:
          typeof word.translations === 'string'
            ? JSON.parse(word.translations)
            : word.translations || [],
        examples:
          typeof word.examples === 'string'
            ? JSON.parse(word.examples)
            : word.examples,
        synonyms:
          typeof word.synonyms === 'string'
            ? JSON.parse(word.synonyms)
            : word.synonyms || [],
        antonyms:
          typeof word.antonyms === 'string'
            ? JSON.parse(word.antonyms)
            : word.antonyms || [],
        conjugation:
          typeof word.conjugation === 'string'
            ? JSON.parse(word.conjugation)
            : word.conjugation,
      }
    })

    await wordRepository.saveWords(parsedWords)

    console.log(`[Sync] Pulled ${parsedWords.length} words from Supabase`)

    return parsedWords
  }

  private async pushProgressToSupabase(userId: string): Promise<number> {
    const pendingProgress =
      await progressRepository.getPendingSyncProgress(userId)

    if (pendingProgress.length === 0) {
      console.log('[Sync] No pending progress to sync')
      return 0
    }

    // Convert local progress to Supabase format
    const progressToSync = pendingProgress.map(p => ({
      progress_id: p.progress_id,
      user_id: userId,
      word_id: p.word_id,
      status: p.status,
      reviewed_count: p.reviewed_count,
      last_reviewed_at: p.last_reviewed_at,
      updated_at: p.updated_at,
    }))

    const { error } = await supabase
      .from('user_progress')
      .upsert(progressToSync)

    if (error) {
      throw new Error(`Failed to push progress: ${error.message}`)
    }

    const progressIds = pendingProgress.map(p => p.progress_id)
    await progressRepository.markProgressSynced(progressIds)

    return pendingProgress.length
  }

  private async pushWordsToSupabase(userId: string): Promise<number> {
    await this.removeInvalidWordsBeforeSync(userId)

    const wordsWithCollections =
      await this.getSyncableWordsWithCollections(userId)
    if (wordsWithCollections.length === 0) {
      return 0
    }

    const { uniqueWords: uniqueBySemanticKey, localSemanticDuplicates } =
      await this.splitLocalSemanticDuplicates(userId, wordsWithCollections)
    const { uniqueWords, duplicateWords } =
      await this.splitRemoteSemanticDuplicates(userId, uniqueBySemanticKey)

    await this.handleRemoteDuplicates(userId, duplicateWords)

    const syncedUniqueCount = await this.syncUniqueWordsWithFallback(
      userId,
      uniqueWords
    )
    const totalSynced =
      syncedUniqueCount + duplicateWords.length + localSemanticDuplicates.length

    this.logWordSyncSummary(
      totalSynced,
      syncedUniqueCount,
      duplicateWords.length,
      localSemanticDuplicates.length
    )

    return totalSynced
  }

  private async removeInvalidWordsBeforeSync(userId: string): Promise<void> {
    const { count: deletedCount, words: deletedWords } =
      await wordRepository.deleteInvalidWords(userId)

    if (deletedCount === 0) return

    const historyStore = useHistoryStore.getState()
    deletedWords.forEach(word => {
      historyStore.addNotification(
        `Word "${word.dutch_lemma}" was not synced due to missing ID`,
        ToastType.INFO
      )
    })

    const wordList = deletedWords.map(w => w.dutch_lemma).join(', ')
    ToastService.show(
      `${deletedCount} invalid word${deletedCount > 1 ? 's' : ''} removed: ${wordList}. Please add again if needed.`,
      ToastType.INFO
    )
  }

  private async getSyncableWordsWithCollections(
    userId: string
  ): Promise<Word[]> {
    const pendingWords = await wordRepository.getPendingSyncWords(userId)

    if (pendingWords.length === 0) {
      console.log('[Sync] No pending words to sync')
      return []
    }

    const validWords = this.filterValidPendingWords(pendingWords)
    if (validWords.length === 0) {
      console.log('[Sync] No valid words to sync after filtering')
      return []
    }

    const wordsWithCollections = await this.filterWordsWithCollections(
      userId,
      validWords
    )
    if (wordsWithCollections.length === 0) {
      console.log('[Sync] No valid words to sync after collection checks')
      return []
    }

    await this.pushCollectionsForWords(userId, wordsWithCollections)
    return wordsWithCollections
  }

  private filterValidPendingWords(pendingWords: Word[]): Word[] {
    const validWords = pendingWords.filter(word => {
      if (word.word_id) return true

      console.error('[Sync] Skipping word with null word_id:', {
        dutch_lemma: word.dutch_lemma,
        user_id: word.user_id,
      })
      return false
    })

    if (validWords.length < pendingWords.length) {
      console.warn(
        `[Sync] Filtered out ${pendingWords.length - validWords.length} invalid words`
      )
    }

    return validWords
  }

  private async splitLocalSemanticDuplicates(
    userId: string,
    words: Word[]
  ): Promise<{ uniqueWords: Word[]; localSemanticDuplicates: Word[] }> {
    const uniqueWords: Word[] = []
    const localSemanticDuplicates: Word[] = []
    const semanticKeys = new Set<string>()

    for (const word of words) {
      const semanticKey = this.buildSemanticKey(userId, word)
      if (semanticKeys.has(semanticKey)) {
        localSemanticDuplicates.push(word)
        continue
      }
      semanticKeys.add(semanticKey)
      uniqueWords.push(word)
    }

    if (localSemanticDuplicates.length > 0) {
      console.warn(
        `[Sync] Skipped ${localSemanticDuplicates.length} local semantic duplicates before remote upsert`
      )
      Sentry.captureMessage(
        'Local semantic duplicates skipped before sync upsert',
        {
          level: 'warning',
          tags: {
            operation: 'pushWordsToSupabase',
            sync_error_type: 'duplicate_conflict_local',
          },
          ...this.buildDuplicateWordsSentryExtra(
            userId,
            localSemanticDuplicates
          ),
          fingerprint: [SYNC_DUPLICATE_FINGERPRINT, 'local'],
        }
      )
      await this.markDuplicateWordsSynced(localSemanticDuplicates)
    }

    return { uniqueWords, localSemanticDuplicates }
  }

  private async splitRemoteSemanticDuplicates(
    userId: string,
    words: Word[]
  ): Promise<{ uniqueWords: Word[]; duplicateWords: Word[] }> {
    const uniqueWords: Word[] = []
    const duplicateWords: Word[] = []

    for (const word of words) {
      const existingWord = await wordService.checkWordExists(
        userId,
        word.dutch_lemma,
        word.part_of_speech ?? undefined,
        word.article ?? undefined
      )

      if (existingWord) {
        duplicateWords.push(word)
      } else {
        uniqueWords.push(word)
      }
    }

    return { uniqueWords, duplicateWords }
  }

  private async handleRemoteDuplicates(
    userId: string,
    duplicateWords: Word[]
  ): Promise<void> {
    if (duplicateWords.length === 0) return

    console.warn(
      `[Sync] Skipped ${duplicateWords.length} duplicate words (already exist on server with same semantic key)`
    )
    const duplicateWordLabels = duplicateWords
      .map(w => w.dutch_lemma)
      .join(', ')

    Sentry.captureMessage(
      `Duplicate words prevented during sync: ${duplicateWordLabels}`,
      {
        level: 'warning',
        tags: {
          operation: 'pushWordsToSupabase',
          sync_error_type: 'duplicate_conflict_remote',
        },
        ...this.buildDuplicateWordsSentryExtra(userId, duplicateWords),
        fingerprint: [SYNC_DUPLICATE_FINGERPRINT, 'remote'],
      }
    )

    await this.markDuplicateWordsSynced(duplicateWords)
  }

  private async syncUniqueWordsWithFallback(
    userId: string,
    uniqueWords: Word[]
  ): Promise<number> {
    if (uniqueWords.length === 0) return 0

    const wordsToSync = uniqueWords.map(word =>
      this.mapWordToSupabasePayload(word, userId)
    )
    const { error } = await supabase.from('words').upsert(wordsToSync, {
      onConflict: 'word_id',
    })

    if (!error) {
      const wordIds = uniqueWords.map(w => w.word_id).filter(Boolean)
      await wordRepository.markWordsSynced(wordIds)
      console.log(
        `[Sync] Pushed ${uniqueWords.length} unique words to Supabase`
      )
      return uniqueWords.length
    }

    if (!this.isSemanticUniqueConflict(error)) {
      throw new Error(`Failed to push words: ${error.message}`)
    }

    console.warn(
      `[Sync] Semantic conflict detected during batch word upsert. Falling back to per-word reconciliation.`
    )
    Sentry.captureMessage(
      'Semantic duplicate conflict detected during sync batch upsert; applying safe fallback',
      {
        level: 'warning',
        tags: {
          operation: 'pushWordsToSupabase',
          sync_error_type: 'duplicate_conflict_batch',
        },
        extra: {
          userId,
          conflictCode: (error as SupabaseLikeError).code,
          conflictMessage: (error as SupabaseLikeError).message,
          uniqueWordsCount: uniqueWords.length,
        },
        fingerprint: [SYNC_DUPLICATE_FINGERPRINT, 'batch'],
      }
    )

    return this.reconcileSemanticConflicts(userId, uniqueWords)
  }

  private logWordSyncSummary(
    totalSynced: number,
    syncedUniqueCount: number,
    remoteDuplicatesCount: number,
    localDuplicatesCount: number
  ): void {
    if (remoteDuplicatesCount === 0 && localDuplicatesCount === 0) return

    console.log(
      `[Sync] Total: ${totalSynced} words processed (${syncedUniqueCount} pushed, ${remoteDuplicatesCount} remote duplicates skipped, ${localDuplicatesCount} local duplicates skipped)`
    )
  }

  private mapWordToSupabasePayload(
    word: Word,
    userId: string
  ): SupabaseWordPayload {
    return {
      word_id: word.word_id,
      user_id: userId,
      collection_id: word.collection_id,
      dutch_lemma: word.dutch_lemma,
      dutch_original: word.dutch_original,
      part_of_speech: word.part_of_speech,
      is_irregular: word.is_irregular,
      is_reflexive: word.is_reflexive,
      is_expression: word.is_expression,
      expression_type: word.expression_type,
      is_separable: word.is_separable,
      prefix_part: word.prefix_part,
      root_verb: word.root_verb,
      article: word.article,
      plural: word.plural,
      translations: word.translations,
      examples: word.examples,
      synonyms: word.synonyms,
      antonyms: word.antonyms,
      conjugation: word.conjugation,
      preposition: word.preposition,
      image_url: word.image_url,
      tts_url: word.tts_url,
      interval_days: word.interval_days,
      repetition_count: word.repetition_count,
      easiness_factor: word.easiness_factor,
      next_review_date: word.next_review_date,
      last_reviewed_at: word.last_reviewed_at,
      analysis_notes: word.analysis_notes,
    }
  }

  private normalizePartOfSpeech(value?: string | null): string {
    return value && value.trim() !== '' ? value.trim() : 'unknown'
  }

  private normalizeArticle(value?: string | null): string {
    return value && value.trim() !== '' ? value.trim() : ''
  }

  private buildSemanticKey(userId: string, word: Word): string {
    return [
      userId,
      word.dutch_lemma.trim().toLowerCase(),
      this.normalizePartOfSpeech(word.part_of_speech),
      this.normalizeArticle(word.article),
    ].join('|')
  }

  private isSemanticUniqueConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const supabaseError = error as SupabaseLikeError
    const details = `${supabaseError.message || ''} ${supabaseError.details || ''}`

    return (
      supabaseError.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
      details.includes(SEMANTIC_UNIQUE_INDEX)
    )
  }

  private async markDuplicateWordsSynced(words: Word[]): Promise<void> {
    const duplicateIds = words.map(w => w.word_id).filter(Boolean)
    if (duplicateIds.length === 0) return

    await wordRepository.markWordsSynced(duplicateIds)
  }

  private async reconcileSemanticConflicts(
    userId: string,
    words: Word[]
  ): Promise<number> {
    const syncedWordIds: string[] = []

    for (const word of words) {
      const existingWord = await wordService.checkWordExists(
        userId,
        word.dutch_lemma,
        word.part_of_speech ?? undefined,
        word.article ?? undefined
      )

      if (existingWord) {
        syncedWordIds.push(word.word_id)
        continue
      }

      const { error } = await supabase
        .from('words')
        .upsert([this.mapWordToSupabasePayload(word, userId)], {
          onConflict: 'word_id',
        })

      if (error) {
        if (this.isSemanticUniqueConflict(error)) {
          syncedWordIds.push(word.word_id)
          continue
        }

        throw new Error(`Failed to push words: ${error.message}`)
      }

      syncedWordIds.push(word.word_id)
    }

    await wordRepository.markWordsSynced(syncedWordIds)
    return syncedWordIds.length
  }

  private buildDuplicateWordsSentryExtra(
    userId: string,
    words: Word[]
  ): {
    extra: {
      userId: string
      duplicateCount: number
      duplicateSampleSize: number
      duplicateTruncatedCount: number
      words: {
        word_id: string
        dutch_lemma: string
        part_of_speech: string | null
        article: Word['article']
      }[]
    }
  } {
    const sampleWords = words
      .slice(0, MAX_DUPLICATE_SENTRY_SAMPLES)
      .map(word => ({
        word_id: word.word_id,
        dutch_lemma: word.dutch_lemma,
        part_of_speech: word.part_of_speech,
        article: word.article,
      }))

    return {
      extra: {
        userId,
        duplicateCount: words.length,
        duplicateSampleSize: sampleWords.length,
        duplicateTruncatedCount: Math.max(0, words.length - sampleWords.length),
        words: sampleWords,
      },
    }
  }

  private async filterWordsWithCollections(
    userId: string,
    words: Word[]
  ): Promise<Word[]> {
    const collectionIds = Array.from(
      new Set(
        words
          .map(word => word.collection_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    if (collectionIds.length === 0) {
      const wordIds = words.map(word => word.word_id).filter(Boolean)
      if (wordIds.length > 0) {
        await wordRepository.markWordsError(wordIds)
        ToastService.show(
          'Words skipped due to missing collection.',
          ToastType.INFO
        )
      }
      return []
    }

    const collections = await collectionRepository.getCollectionsByIds(
      collectionIds,
      userId
    )
    const collectionIdSet = new Set(
      collections.map(collection => collection.collection_id)
    )

    const missingCollectionWords = words.filter(
      word => !word.collection_id || !collectionIdSet.has(word.collection_id)
    )

    if (missingCollectionWords.length > 0) {
      const missingWordIds = missingCollectionWords
        .map(word => word.word_id)
        .filter(Boolean)
      const missingWordLabels = missingCollectionWords
        .map(word => word.dutch_lemma)
        .join(', ')

      await wordRepository.markWordsError(missingWordIds)

      const historyStore = useHistoryStore.getState()
      missingCollectionWords.forEach(word => {
        historyStore.addNotification(
          `Word "${word.dutch_lemma}" was not synced due to missing collection`,
          ToastType.INFO
        )
      })

      ToastService.show(
        `Words skipped due to missing collection: ${missingWordLabels}`,
        ToastType.INFO
      )
    }

    return words.filter(
      word => word.collection_id && collectionIdSet.has(word.collection_id)
    )
  }

  private async pushCollectionsForWords(
    userId: string,
    words: Word[]
  ): Promise<void> {
    const collectionIds = Array.from(
      new Set(
        words
          .map(word => word.collection_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    if (collectionIds.length === 0) return

    const collections = await collectionRepository.getCollectionsByIds(
      collectionIds,
      userId
    )

    if (collections.length === 0) return

    const collectionsToSync = collections.map(c => ({
      collection_id: c.collection_id,
      user_id: userId,
      name: c.name,
      is_shared: c.is_shared,
      created_at: c.created_at,
    }))

    const { error } = await supabase
      .from('collections')
      .upsert(collectionsToSync)

    if (error) {
      throw new Error(`Failed to push collections: ${error.message}`)
    }

    const syncedIds = collections.map(c => c.collection_id)
    await collectionRepository.markCollectionsSynced(syncedIds)
  }

  private async pullCollectionsFromSupabase(userId: string): Promise<any[]> {
    const deletedCollections =
      await collectionRepository.getDeletedCollections(userId)
    const deletedIds = new Set(
      deletedCollections.map(collection => collection.collection_id)
    )
    const pendingCollections =
      await collectionRepository.getPendingSyncCollections(userId)
    const pendingIds = new Set(
      pendingCollections.map(collection => collection.collection_id)
    )

    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to pull collections: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[Sync] No collections to pull from Supabase')
      return []
    }

    // Ensure all collections have required fields and filter out invalid ones
    const parsedCollections = data
      .filter(
        collection =>
          collection && collection.collection_id && collection.user_id
      )
      .filter(collection => !deletedIds.has(collection.collection_id))
      .filter(collection => !pendingIds.has(collection.collection_id))
      .map(collection => ({
        ...collection,
        updated_at:
          collection.updated_at ||
          collection.created_at ||
          new Date().toISOString(),
      }))

    if (deletedIds.size > 0) {
      console.log(
        `[Sync] Skipped ${deletedIds.size} deleted collections during pull`
      )
    }
    if (pendingIds.size > 0) {
      console.log(
        `[Sync] Skipped ${pendingIds.size} pending collections during pull`
      )
    }

    if (parsedCollections.length > 0) {
      await collectionRepository.saveCollections(parsedCollections)
    } else {
      console.log('[Sync] No valid collections to save')
    }

    return parsedCollections
  }

  private async cleanupOrphanWords(userId: string): Promise<void> {
    try {
      const { count } = await wordRepository.deleteOrphanWords(userId)
      if (count > 0) {
        console.log(`[Sync] Removed ${count} orphan words`)
        ToastService.show(
          `${count} orphan word${count > 1 ? 's' : ''} removed from local cache.`,
          ToastType.INFO
        )
      }
    } catch (error) {
      console.error('[Sync] Error cleaning orphan words:', error)
    }
  }

  private async pushCollectionsToSupabase(userId: string): Promise<number> {
    const deletedCollections =
      await collectionRepository.getDeletedCollections(userId)

    if (deletedCollections.length > 0) {
      console.log(
        `[Sync] Deleting ${deletedCollections.length} collections in Supabase`
      )
    }

    for (const collection of deletedCollections) {
      console.log(
        `[Sync] Deleting collection ${collection.collection_id} in Supabase`
      )
      await collectionService.deleteCollection(collection.collection_id, userId)
      await collectionRepository.deleteCollection(collection.collection_id)
    }

    const pendingCollections =
      await collectionRepository.getPendingSyncCollections(userId)

    if (pendingCollections.length === 0) {
      console.log('[Sync] No pending collections to sync')
      return 0
    }

    // Convert local collections to Supabase format
    // Note: updated_at is managed by Supabase, don't include it in upsert
    const collectionsToSync = pendingCollections.map(c => ({
      collection_id: c.collection_id,
      user_id: userId,
      name: c.name,
      is_shared: c.is_shared,
      created_at: c.created_at,
    }))

    const { error } = await supabase
      .from('collections')
      .upsert(collectionsToSync)

    if (error) {
      throw new Error(`Failed to push collections: ${error.message}`)
    }

    const collectionIds = pendingCollections.map(c => c.collection_id)
    await collectionRepository.markCollectionsSynced(collectionIds)

    console.log(
      `[Sync] Pushed ${pendingCollections.length} collections to Supabase`
    )

    return pendingCollections.length
  }
}

export const syncManager = new SyncManager()
