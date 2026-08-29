import { collectionService, supabase, wordService } from '@/lib/supabase'
import {
  wordRepository,
  type WordSyncAcknowledgement,
} from '@/db/wordRepository'
import {
  progressRepository,
  type ProgressRecord,
  type ProgressSyncAcknowledgement,
  type RemoteProgressTombstone,
} from '@/db/progressRepository'
import {
  collectionRepository,
  type CollectionSyncAcknowledgement,
} from '@/db/collectionRepository'
import {
  reviewEventRepository,
  type ReviewEventSyncAcknowledgement,
} from '@/db/reviewEventRepository'
import {
  getSyncCursor,
  isNetworkAvailable,
  setSyncCursor,
} from '@/utils/network'
import type { SyncCursor } from '@/utils/network'
import type { Word } from '@/types/database'
import type { ReviewEvent } from '@/types/ReviewTypes'
import { Sentry } from '@/lib/sentry'
import { isNetworkError } from '@/utils/logger'
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
const REMOTE_DUPLICATE_SENTRY_ALERT_THRESHOLD = 100
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
  | 'pull_progress'
  | 'pull_review_events'
  | 'push_collections'
  | 'push_words'
  | 'push_progress'
  | 'push_review_events'

class ControlledSyncError extends Error {
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

interface WordsUpsertResult {
  data: WordSyncAcknowledgement[] | null
  error: SupabaseLikeError | null
}

interface SupabaseSessionLike {
  expires_at?: number | null
}

/**
 * Parses a JSON field that may come as a string from Supabase or already parsed.
 * Returns the fallback if parsing fails or value is null/undefined.
 */
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
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
  register: Word['register']
  translations: Word['translations']
  examples: Word['examples']
  synonyms: string[]
  antonyms: string[]
  conjugation: Word['conjugation']
  preposition: string | null
  image_url: string | null
  tts_url: string
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
  last_reviewed_at: string | null
  analysis_notes: string | null
}

interface SyncWord extends Word {
  deleted_at: string | null
}

interface SyncProgress extends ProgressRecord {
  deleted_at: string | null
}

type SyncReviewEvent = ReviewEvent

type SupabaseWordPayloadWithoutRegister = Omit<SupabaseWordPayload, 'register'>
type SupabaseWordsUpsertPayload =
  | SupabaseWordPayload
  | SupabaseWordPayloadWithoutRegister

const WORDS_SELECT_COLUMNS_WITHOUT_REGISTER = [
  'word_id',
  'user_id',
  'collection_id',
  'dutch_lemma',
  'dutch_original',
  'part_of_speech',
  'is_irregular',
  'is_reflexive',
  'is_expression',
  'expression_type',
  'is_separable',
  'prefix_part',
  'root_verb',
  'article',
  'plural',
  'translations',
  'examples',
  'synonyms',
  'antonyms',
  'conjugation',
  'preposition',
  'image_url',
  'tts_url',
  'interval_days',
  'repetition_count',
  'easiness_factor',
  'next_review_date',
  'last_reviewed_at',
  'analysis_notes',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ')

const WORD_SYNC_PAGE_SIZE = 500
const PROGRESS_SYNC_PAGE_SIZE = 500
const REVIEW_EVENT_SYNC_PAGE_SIZE = 500
const WORD_ACKNOWLEDGEMENT_COLUMNS = 'word_id, updated_at, deleted_at'
const PROGRESS_ACKNOWLEDGEMENT_COLUMNS = 'progress_id, updated_at, deleted_at'
const COLLECTION_ACKNOWLEDGEMENT_COLUMNS = 'collection_id, updated_at'
const REVIEW_EVENT_ACKNOWLEDGEMENT_COLUMNS = 'event_id, created_at'

const toWordSyncCursor = (word: Word): SyncCursor => ({
  updatedAt: word.updated_at,
  id: word.word_id,
})

const compareSyncCursors = (left: SyncCursor, right: SyncCursor): number => {
  const timestampComparison = left.updatedAt.localeCompare(right.updatedAt)
  return timestampComparison !== 0
    ? timestampComparison
    : left.id.localeCompare(right.id)
}

const isWordAfterCursor = (word: Word, cursor: SyncCursor): boolean =>
  compareSyncCursors(toWordSyncCursor(word), cursor) > 0

const toProgressSyncCursor = (progress: SyncProgress): SyncCursor => ({
  updatedAt: progress.updated_at,
  id: progress.progress_id,
})

const isProgressAfterCursor = (
  progress: SyncProgress,
  cursor: SyncCursor
): boolean => compareSyncCursors(toProgressSyncCursor(progress), cursor) > 0

const toReviewEventSyncCursor = (event: ReviewEvent): SyncCursor => ({
  updatedAt: event.created_at,
  id: event.event_id,
})

const isReviewEventAfterCursor = (
  event: ReviewEvent,
  cursor: SyncCursor
): boolean => compareSyncCursors(toReviewEventSyncCursor(event), cursor) > 0

export class SyncManager {
  private isSyncing = false
  private syncListeners: ((result: SyncResult) => void)[] = []
  private wordsRegisterColumnAvailable: boolean | null = null

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
      const isOnline = await isNetworkAvailable()
      if (!isOnline) {
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
      const wordCursor = await getSyncCursor(userId, 'words')
      const pulledWords = await this.runSyncStageWithSessionRetry(
        'pull_words',
        userId,
        async () => this.pullWordsFromSupabase(userId, wordCursor)
      )

      // Clean up local orphan words after pull
      await this.cleanupOrphanWords(userId)

      // Step 2: Pull progress after words so local foreign keys can resolve
      console.log('[Sync] Stage 3: pull progress')
      const progressCursor = await getSyncCursor(userId, 'user_progress')
      const pulledProgress = await this.runSyncStageWithSessionRetry(
        'pull_progress',
        userId,
        async () => this.pullProgressFromSupabase(userId, progressCursor)
      )

      // Review events depend on words and use server-created timestamps.
      console.log('[Sync] Stage 4: pull review events')
      const reviewEventCursor = await getSyncCursor(userId, 'review_events')
      const pulledReviewEvents = await this.runSyncStageWithSessionRetry(
        'pull_review_events',
        userId,
        async () => this.pullReviewEventsFromSupabase(userId, reviewEventCursor)
      )

      // Step 3: Push pending collection updates to Supabase (needed for FK on words)
      console.log('[Sync] Stage 5: push collections')
      await this.runSyncStageWithSessionRetry(
        'push_collections',
        userId,
        async () => this.pushCollectionsToSupabase(userId)
      )

      // Step 4: Push pending word updates to Supabase
      console.log('[Sync] Stage 6: push words')
      const pushedWordsCount = await this.runSyncStageWithSessionRetry(
        'push_words',
        userId,
        async () => this.pushWordsToSupabase(userId)
      )

      // Step 5: Push pending progress to Supabase
      console.log('[Sync] Stage 7: push progress')
      const pushedProgressCount = await this.runSyncStageWithSessionRetry(
        'push_progress',
        userId,
        async () => this.pushProgressToSupabase(userId)
      )

      console.log('[Sync] Stage 8: push review events')
      const pushedReviewEventsCount = await this.runSyncStageWithSessionRetry(
        'push_review_events',
        userId,
        async () => this.pushReviewEventsToSupabase(userId)
      )

      const result: SyncResult = {
        success: true,
        wordsSynced: pulledWords.length + pushedWordsCount,
        progressSynced: pulledProgress.length + pushedProgressCount,
        timestamp,
      }

      console.log('[Sync] Sync completed successfully:', result)
      console.log(
        `[Sync] Review events synchronized: ${pulledReviewEvents.length + pushedReviewEventsCount}`
      )
      this.notifySyncStatus(result)

      return result
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      const isNetworkErr = isNetworkError(errorMessage)

      // Don't report network errors - they're expected when offline
      if (isNetworkErr) {
        console.log(
          '[Sync] Network error during sync (expected when offline):',
          errorMessage
        )
      } else if (error instanceof ControlledSyncError) {
        console.warn('[Sync] Controlled sync failure:', errorMessage)
      } else if (__DEV__) {
        console.error(
          '[Sync] Error in development (not reported to Sentry):',
          error
        )
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
      if (!isNetworkErr) {
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
      Sentry.addBreadcrumb({
        category: 'sync.retry',
        message:
          'Recoverable sync stage failure; refreshing session and retrying',
        level: 'warning',
        data: {
          stage,
          syncErrorType,
          errorMessage: initialErrorMessage,
          userId,
        },
      })

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
    cursor: SyncCursor | null
  ): Promise<Word[]> {
    let data: SyncWord[] | null = null
    let error: SupabaseLikeError | null = null

    try {
      const initialResult = await this.fetchWordPages(userId, cursor, '*')
      data = initialResult.data
      error = initialResult.error
    } catch (queryError) {
      if (!this.isMissingWordsRegisterColumnError(queryError)) {
        throw queryError
      }
      error = this.toSupabaseLikeError(queryError)
    }

    if (error && this.isMissingWordsRegisterColumnError(error)) {
      this.wordsRegisterColumnAvailable = false
      console.warn(
        '[Sync] Remote words table has no register column. Falling back to compatible pull query.'
      )
      try {
        const fallbackResult = await this.fetchWordPages(
          userId,
          cursor,
          WORDS_SELECT_COLUMNS_WITHOUT_REGISTER
        )
        data = fallbackResult.data
        error = fallbackResult.error
      } catch (fallbackQueryError) {
        error = this.toSupabaseLikeError(fallbackQueryError)
      }
    }

    if (error) {
      throw new Error(`Failed to pull words: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[Sync] No new words to pull from Supabase')
      return []
    }

    // Parse JSON fields from Supabase and ensure required fields
    const now = new Date().toISOString()
    const parsedWords: SyncWord[] = data
      .map((word): SyncWord => {
        return {
          ...word,
          user_id: userId,
          deleted_at: word.deleted_at ?? null,
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
          translations: parseJsonField<Word['translations']>(
            word.translations,
            { en: [] }
          ),
          examples: parseJsonField<Word['examples']>(word.examples, null),
          synonyms: parseJsonField<string[]>(word.synonyms, []),
          antonyms: parseJsonField<string[]>(word.antonyms, []),
          conjugation: parseJsonField<Word['conjugation']>(
            word.conjugation,
            null
          ),
        }
      })
      .filter(word => !cursor || isWordAfterCursor(word, cursor))
      .sort((left, right) =>
        compareSyncCursors(toWordSyncCursor(left), toWordSyncCursor(right))
      )

    if (parsedWords.length === 0) {
      console.log('[Sync] No updated words after cursor filtering')
      return []
    }

    const tombstones = parsedWords.filter(
      (word): word is SyncWord & { deleted_at: string } =>
        Boolean(word.deleted_at)
    )
    const activeWords = parsedWords.filter(word => !word.deleted_at)

    await wordRepository.saveRemoteWordTombstones(tombstones)
    await wordRepository.saveWords(activeWords, { preserveUnsynced: true })

    const newestWord = parsedWords[parsedWords.length - 1]
    await setSyncCursor(userId, 'words', toWordSyncCursor(newestWord))

    console.log(`[Sync] Pulled ${parsedWords.length} words from Supabase`)

    return parsedWords
  }

  private async fetchWordPages(
    userId: string,
    cursor: SyncCursor | null,
    selectColumns: string
  ): Promise<{
    data: SyncWord[] | null
    error: SupabaseLikeError | null
  }> {
    const words: SyncWord[] = []
    let from = 0

    while (true) {
      let query = supabase
        .from('words')
        .select(selectColumns)
        .eq('user_id', userId)

      if (cursor) {
        query = query.gte('updated_at', cursor.updatedAt)
      }

      const result = this.toWordsSelectResult(
        await query
          .order('updated_at', { ascending: true })
          .order('word_id', { ascending: true })
          .range(from, from + WORD_SYNC_PAGE_SIZE - 1)
      )

      if (result.error) {
        return result
      }

      const page = result.data ?? []
      words.push(...page)

      if (page.length < WORD_SYNC_PAGE_SIZE) {
        return { data: words, error: null }
      }

      from += WORD_SYNC_PAGE_SIZE
    }
  }

  private async pullProgressFromSupabase(
    userId: string,
    cursor: SyncCursor | null
  ): Promise<SyncProgress[]> {
    const { data, error } = await this.fetchProgressPages(userId, cursor)

    if (error) {
      throw new Error(`Failed to pull progress: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('[Sync] No new progress to pull from Supabase')
      return []
    }

    const now = new Date().toISOString()
    const parsedProgress = data
      .map(
        (progress): SyncProgress => ({
          ...progress,
          user_id: userId,
          reviewed_count: progress.reviewed_count ?? 0,
          last_reviewed_at: progress.last_reviewed_at ?? null,
          created_at: progress.created_at || now,
          updated_at: progress.updated_at || progress.created_at || now,
          deleted_at: progress.deleted_at ?? null,
        })
      )
      .filter(progress => !cursor || isProgressAfterCursor(progress, cursor))
      .sort((left, right) =>
        compareSyncCursors(
          toProgressSyncCursor(left),
          toProgressSyncCursor(right)
        )
      )

    if (parsedProgress.length === 0) {
      console.log('[Sync] No updated progress after cursor filtering')
      return []
    }

    const tombstones = parsedProgress.filter(
      (progress): progress is RemoteProgressTombstone =>
        Boolean(progress.deleted_at)
    )
    const activeProgress = parsedProgress
      .filter(progress => !progress.deleted_at)
      .map(({ deleted_at: _deletedAt, ...progress }) => progress)

    await progressRepository.saveRemoteProgressTombstones(tombstones)
    await progressRepository.saveProgress(activeProgress, {
      preserveUnsynced: true,
    })

    const newestProgress = parsedProgress[parsedProgress.length - 1]
    await setSyncCursor(
      userId,
      'user_progress',
      toProgressSyncCursor(newestProgress)
    )

    console.log(
      `[Sync] Pulled ${parsedProgress.length} progress records from Supabase`
    )

    return parsedProgress
  }

  private async fetchProgressPages(
    userId: string,
    cursor: SyncCursor | null
  ): Promise<{
    data: SyncProgress[] | null
    error: SupabaseLikeError | null
  }> {
    const progressRecords: SyncProgress[] = []
    let from = 0

    while (true) {
      let query = supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)

      if (cursor) {
        query = query.gte('updated_at', cursor.updatedAt)
      }

      const result = this.toProgressSelectResult(
        await query
          .order('updated_at', { ascending: true })
          .order('progress_id', { ascending: true })
          .range(from, from + PROGRESS_SYNC_PAGE_SIZE - 1)
      )

      if (result.error) {
        return result
      }

      const page = result.data ?? []
      progressRecords.push(...page)

      if (page.length < PROGRESS_SYNC_PAGE_SIZE) {
        return { data: progressRecords, error: null }
      }

      from += PROGRESS_SYNC_PAGE_SIZE
    }
  }

  private async pullReviewEventsFromSupabase(
    userId: string,
    cursor: SyncCursor | null
  ): Promise<SyncReviewEvent[]> {
    const { data, error } = await this.fetchReviewEventPages(userId, cursor)

    if (error) {
      throw new Error(`Failed to pull review events: ${error.message}`)
    }

    const events = (data ?? [])
      .filter(event => !cursor || isReviewEventAfterCursor(event, cursor))
      .sort((left, right) =>
        compareSyncCursors(
          toReviewEventSyncCursor(left),
          toReviewEventSyncCursor(right)
        )
      )

    if (events.length === 0) {
      console.log('[Sync] No new review events to pull from Supabase')
      return []
    }

    await reviewEventRepository.saveRemoteEvents(events)

    const newestEvent = events[events.length - 1]
    await setSyncCursor(
      userId,
      'review_events',
      toReviewEventSyncCursor(newestEvent)
    )

    console.log(`[Sync] Pulled ${events.length} review events from Supabase`)
    return events
  }

  private async fetchReviewEventPages(
    userId: string,
    cursor: SyncCursor | null
  ): Promise<{
    data: SyncReviewEvent[] | null
    error: SupabaseLikeError | null
  }> {
    const events: SyncReviewEvent[] = []
    let from = 0

    while (true) {
      let query = supabase
        .from('review_events')
        .select('*')
        .eq('user_id', userId)

      if (cursor) {
        query = query.gte('created_at', cursor.updatedAt)
      }

      const result = await query
        .order('created_at', { ascending: true })
        .order('event_id', { ascending: true })
        .range(from, from + REVIEW_EVENT_SYNC_PAGE_SIZE - 1)

      if (result.error) {
        return {
          data: null,
          error: this.toSupabaseLikeError(result.error),
        }
      }

      const page = Array.isArray(result.data)
        ? (result.data as SyncReviewEvent[])
        : []
      events.push(...page)

      if (page.length < REVIEW_EVENT_SYNC_PAGE_SIZE) {
        return { data: events, error: null }
      }

      from += REVIEW_EVENT_SYNC_PAGE_SIZE
    }
  }

  private async pushReviewEventsToSupabase(userId: string): Promise<number> {
    let totalPushed = 0

    while (true) {
      const pendingEvents = await reviewEventRepository.getPendingSyncEvents(
        userId,
        REVIEW_EVENT_SYNC_PAGE_SIZE
      )
      if (pendingEvents.length === 0) {
        if (totalPushed === 0) {
          console.log('[Sync] No pending review events to sync')
        }
        return totalPushed
      }

      const payloads = pendingEvents.map(event => ({
        event_id: event.event_id,
        user_id: userId,
        word_id: event.word_id,
        assessment: event.assessment,
        review_mode: event.review_mode,
        answered_correctly: event.answered_correctly,
        response_time_ms: event.response_time_ms,
        previous_interval_days: event.previous_interval_days,
        next_interval_days: event.next_interval_days,
        previous_easiness_factor: event.previous_easiness_factor,
        next_easiness_factor: event.next_easiness_factor,
        reviewed_at: event.reviewed_at,
      }))

      const { data, error } = await supabase
        .from('review_events')
        .upsert(payloads, { onConflict: 'event_id' })
        .select(REVIEW_EVENT_ACKNOWLEDGEMENT_COLUMNS)

      if (error) {
        throw new Error(`Failed to push review events: ${error.message}`)
      }

      const acknowledgements = this.requireReviewEventAcknowledgements(
        data,
        pendingEvents.map(event => event.event_id)
      )
      await reviewEventRepository.reconcilePushedEvents(
        userId,
        acknowledgements
      )
      totalPushed += pendingEvents.length

      if (pendingEvents.length < REVIEW_EVENT_SYNC_PAGE_SIZE) {
        console.log(`[Sync] Pushed ${totalPushed} review events to Supabase`)
        return totalPushed
      }
    }
  }

  private async pushProgressToSupabase(userId: string): Promise<number> {
    const deletedProgress = await progressRepository.getDeletedProgress(userId)
    const deletedCount = await this.pushProgressTombstones(
      userId,
      deletedProgress
    )
    const pendingProgress =
      await progressRepository.getPendingSyncProgress(userId)

    if (pendingProgress.length === 0) {
      console.log('[Sync] No pending progress to sync')
      return deletedCount
    }

    // Convert local progress to Supabase format
    const progressToSync = pendingProgress.map(p => ({
      progress_id: p.progress_id,
      user_id: userId,
      word_id: p.word_id,
      status: p.status,
      reviewed_count: p.reviewed_count,
      last_reviewed_at: p.last_reviewed_at,
    }))

    const { data, error } = await supabase
      .from('user_progress')
      .upsert(progressToSync)
      .select(PROGRESS_ACKNOWLEDGEMENT_COLUMNS)

    if (error) {
      throw new Error(`Failed to push progress: ${error.message}`)
    }

    const progressIds = pendingProgress.map(p => p.progress_id)
    const acknowledgements = this.requireProgressAcknowledgements(
      data,
      progressIds
    )
    await progressRepository.reconcilePushedProgress(
      acknowledgements,
      new Map(
        pendingProgress.map(progress => [
          progress.progress_id,
          progress.updated_at,
        ])
      )
    )

    return deletedCount + pendingProgress.length
  }

  private async pushWordsToSupabase(userId: string): Promise<number> {
    await this.removeInvalidWordsBeforeSync(userId)
    const deletedWords = await wordRepository.getDeletedWords(userId)
    const deletedCount = await this.pushWordTombstones(userId, deletedWords)

    const wordsWithCollections =
      await this.getSyncableWordsWithCollections(userId)
    if (wordsWithCollections.length === 0) {
      return deletedCount
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

    return deletedCount + totalSynced
  }

  private async pushWordTombstones(
    userId: string,
    deletedWords: Awaited<ReturnType<typeof wordRepository.getDeletedWords>>
  ): Promise<number> {
    if (deletedWords.length === 0) return 0

    const wordIds = deletedWords.map(word => word.word_id)
    const deletedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('words')
      .update({ deleted_at: deletedAt })
      .eq('user_id', userId)
      .in('word_id', wordIds)
      .select(WORD_ACKNOWLEDGEMENT_COLUMNS)

    if (error) {
      throw new Error(`Failed to push word tombstones: ${error.message}`)
    }

    const acknowledgements = this.parseWordAcknowledgements(data)
    const acknowledgedWordIds = new Set(
      acknowledgements.map(acknowledgement => acknowledgement.word_id)
    )
    const neverSyncedMissingWords = deletedWords.filter(
      word => !word.synced_at && !acknowledgedWordIds.has(word.word_id)
    )
    const requiredWordIds = wordIds.filter(
      wordId =>
        acknowledgedWordIds.has(wordId) ||
        !neverSyncedMissingWords.some(word => word.word_id === wordId)
    )

    this.assertAcknowledgementIds(
      [...acknowledgedWordIds],
      requiredWordIds,
      'word'
    )
    await wordRepository.reconcilePushedWords(
      acknowledgements,
      new Map(deletedWords.map(word => [word.word_id, word.updated_at]))
    )
    await wordRepository.markWordTombstonesSynced(
      neverSyncedMissingWords.map(word => word.word_id)
    )
    console.log(`[Sync] Pushed ${wordIds.length} word tombstones to Supabase`)
    return wordIds.length
  }

  private async pushProgressTombstones(
    userId: string,
    deletedProgress: Awaited<
      ReturnType<typeof progressRepository.getDeletedProgress>
    >
  ): Promise<number> {
    if (deletedProgress.length === 0) return 0

    const progressIds = deletedProgress.map(progress => progress.progress_id)
    const deletedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('user_progress')
      .update({ deleted_at: deletedAt })
      .eq('user_id', userId)
      .in('progress_id', progressIds)
      .select(PROGRESS_ACKNOWLEDGEMENT_COLUMNS)

    if (error) {
      throw new Error(`Failed to push progress tombstones: ${error.message}`)
    }

    const acknowledgements = this.requireProgressAcknowledgements(
      data,
      progressIds
    )
    await progressRepository.reconcilePushedProgress(
      acknowledgements,
      new Map(
        deletedProgress.map(progress => [
          progress.progress_id,
          progress.updated_at,
        ])
      )
    )
    console.log(
      `[Sync] Pushed ${progressIds.length} progress tombstones to Supabase`
    )
    return progressIds.length
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

      if (existingWord && existingWord.word_id !== word.word_id) {
        // Only skip if a DIFFERENT word with the same semantic key exists
        // (true duplicate). The same word_id means it's an update (e.g., review
        // progress) that should be upserted normally.
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
    const duplicateSummary = this.buildDuplicateWordsSentryExtra(
      userId,
      duplicateWords
    ).extra

    Sentry.addBreadcrumb({
      category: 'sync.duplicates',
      message: `Skipped ${duplicateWords.length} remote semantic duplicates during sync`,
      level: 'warning',
      data: duplicateSummary,
    })

    if (duplicateWords.length >= REMOTE_DUPLICATE_SENTRY_ALERT_THRESHOLD) {
      Sentry.captureMessage(
        'Large batch of remote semantic duplicates skipped during sync',
        {
          level: 'warning',
          tags: {
            operation: 'pushWordsToSupabase',
            sync_error_type: 'duplicate_conflict_remote_large_batch',
          },
          extra: duplicateSummary,
          fingerprint: [SYNC_DUPLICATE_FINGERPRINT, 'remote-large-batch'],
        }
      )
    }

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
    const result = await this.upsertWordsWithRegisterFallback(wordsToSync)

    if (!result.error) {
      const wordIds = uniqueWords.map(w => w.word_id).filter(Boolean)
      const acknowledgements = this.requireWordAcknowledgements(
        result.data,
        wordIds
      )
      await wordRepository.reconcilePushedWords(
        acknowledgements,
        new Map(uniqueWords.map(word => [word.word_id, word.updated_at]))
      )
      console.log(
        `[Sync] Pushed ${uniqueWords.length} unique words to Supabase`
      )
      return uniqueWords.length
    }

    if (!this.isSemanticUniqueConflict(result.error)) {
      throw new Error(`Failed to push words: ${result.error.message}`)
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
          conflictCode: result.error.code,
          conflictMessage: result.error.message,
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
      register: word.register,
      translations: word.translations,
      examples: word.examples,
      synonyms: word.synonyms,
      antonyms: word.antonyms,
      conjugation: word.conjugation,
      preposition: word.preposition,
      image_url: word.image_url,
      // The remote schema keeps this legacy column NOT NULL. An empty string
      // means that no pre-generated audio is available.
      tts_url: word.tts_url ?? '',
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
    const duplicateVersions = words
      .filter(word => Boolean(word.word_id))
      .map(word => ({
        word_id: word.word_id,
        updated_at: word.updated_at,
      }))
    if (duplicateVersions.length === 0) return

    await wordRepository.markWordsSynced(duplicateVersions)
  }

  private async reconcileSemanticConflicts(
    userId: string,
    words: Word[]
  ): Promise<number> {
    const statusOnlyWords: Word[] = []
    const acknowledgements: WordSyncAcknowledgement[] = []

    for (const word of words) {
      const existingWord = await wordService.checkWordExists(
        userId,
        word.dutch_lemma,
        word.part_of_speech ?? undefined,
        word.article ?? undefined
      )

      if (existingWord) {
        statusOnlyWords.push(word)
        continue
      }

      const result = await this.upsertWordsWithRegisterFallback([
        this.mapWordToSupabasePayload(word, userId),
      ])

      if (result.error) {
        if (this.isSemanticUniqueConflict(result.error)) {
          statusOnlyWords.push(word)
          continue
        }

        throw new Error(`Failed to push words: ${result.error.message}`)
      }

      acknowledgements.push(
        ...this.requireWordAcknowledgements(result.data, [word.word_id])
      )
    }

    await wordRepository.reconcilePushedWords(
      acknowledgements,
      new Map(words.map(word => [word.word_id, word.updated_at]))
    )
    await this.markDuplicateWordsSynced(statusOnlyWords)
    return acknowledgements.length + statusOnlyWords.length
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

  private async upsertWordsWithRegisterFallback(
    payloads: SupabaseWordPayload[]
  ): Promise<WordsUpsertResult> {
    const includeRegister = this.wordsRegisterColumnAvailable !== false
    const initialPayloads = includeRegister
      ? payloads
      : payloads.map(payload => this.omitRegisterFromPayload(payload))

    const result = await this.executeWordsUpsert(initialPayloads)

    if (!result.error) {
      if (includeRegister) {
        this.wordsRegisterColumnAvailable = true
      }
      return result
    }

    if (
      !includeRegister ||
      !this.isMissingWordsRegisterColumnError(result.error)
    ) {
      return result
    }

    this.wordsRegisterColumnAvailable = false
    console.warn(
      '[Sync] Remote words table has no register column. Retrying sync without register field.'
    )

    const fallbackPayloads = payloads.map(payload =>
      this.omitRegisterFromPayload(payload)
    )

    return this.executeWordsUpsert(fallbackPayloads)
  }

  private omitRegisterFromPayload(
    payload: SupabaseWordPayload
  ): SupabaseWordPayloadWithoutRegister {
    const { register: _register, ...payloadWithoutRegister } = payload
    return payloadWithoutRegister
  }

  private isMissingWordsRegisterColumnError(error: unknown): boolean {
    const details = this.getErrorSearchableText(error)
    return (
      details.includes("'register' column of 'words' in the schema cache") ||
      (details.includes('register') &&
        details.includes('words') &&
        details.includes('schema cache'))
    )
  }

  private toWordsSelectResult(result: { data: unknown; error: unknown }): {
    data: SyncWord[] | null
    error: SupabaseLikeError | null
  } {
    return {
      data: Array.isArray(result.data) ? (result.data as SyncWord[]) : null,
      error: result.error ? this.toSupabaseLikeError(result.error) : null,
    }
  }

  private toProgressSelectResult(result: { data: unknown; error: unknown }): {
    data: SyncProgress[] | null
    error: SupabaseLikeError | null
  } {
    return {
      data: Array.isArray(result.data) ? (result.data as SyncProgress[]) : null,
      error: result.error ? this.toSupabaseLikeError(result.error) : null,
    }
  }

  private requireWordAcknowledgements(
    data: unknown,
    expectedWordIds: string[]
  ): WordSyncAcknowledgement[] {
    const acknowledgements = this.parseWordAcknowledgements(data)

    this.assertAcknowledgementIds(
      acknowledgements.map(value => value.word_id),
      expectedWordIds,
      'word'
    )
    return acknowledgements
  }

  private parseWordAcknowledgements(data: unknown): WordSyncAcknowledgement[] {
    return Array.isArray(data)
      ? data.filter(
          (value): value is WordSyncAcknowledgement =>
            this.isRecord(value) &&
            typeof value.word_id === 'string' &&
            typeof value.updated_at === 'string' &&
            (typeof value.deleted_at === 'string' || value.deleted_at === null)
        )
      : []
  }

  private requireProgressAcknowledgements(
    data: unknown,
    expectedProgressIds: string[]
  ): ProgressSyncAcknowledgement[] {
    const acknowledgements = Array.isArray(data)
      ? data.filter(
          (value): value is ProgressSyncAcknowledgement =>
            this.isRecord(value) &&
            typeof value.progress_id === 'string' &&
            typeof value.updated_at === 'string' &&
            (typeof value.deleted_at === 'string' || value.deleted_at === null)
        )
      : []

    this.assertAcknowledgementIds(
      acknowledgements.map(value => value.progress_id),
      expectedProgressIds,
      'progress'
    )
    return acknowledgements
  }

  private requireReviewEventAcknowledgements(
    data: unknown,
    expectedEventIds: string[]
  ): ReviewEventSyncAcknowledgement[] {
    const acknowledgements = Array.isArray(data)
      ? data.filter(
          (value): value is ReviewEventSyncAcknowledgement =>
            this.isRecord(value) &&
            typeof value.event_id === 'string' &&
            typeof value.created_at === 'string'
        )
      : []

    this.assertAcknowledgementIds(
      acknowledgements.map(value => value.event_id),
      expectedEventIds,
      'review event'
    )
    return acknowledgements
  }

  private requireCollectionAcknowledgements(
    data: unknown,
    expectedCollectionIds: string[]
  ): CollectionSyncAcknowledgement[] {
    const acknowledgements = Array.isArray(data)
      ? data.filter(
          (value): value is CollectionSyncAcknowledgement =>
            this.isRecord(value) &&
            typeof value.collection_id === 'string' &&
            typeof value.updated_at === 'string'
        )
      : []

    this.assertAcknowledgementIds(
      acknowledgements.map(value => value.collection_id),
      expectedCollectionIds,
      'collection'
    )
    return acknowledgements
  }

  private assertAcknowledgementIds(
    actualIds: string[],
    expectedIds: string[],
    entityName: string
  ): void {
    const actualIdSet = new Set(actualIds)
    const expectedIdSet = new Set(expectedIds)
    const hasEveryExpectedId = [...expectedIdSet].every(id =>
      actualIdSet.has(id)
    )

    if (
      actualIds.length !== expectedIdSet.size ||
      actualIdSet.size !== expectedIdSet.size ||
      !hasEveryExpectedId
    ) {
      throw new Error(
        `Failed to reconcile pushed ${entityName} timestamps: Supabase returned an incomplete acknowledgement`
      )
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private async executeWordsUpsert(
    payloads: SupabaseWordsUpsertPayload[]
  ): Promise<WordsUpsertResult> {
    try {
      const result = await supabase
        .from('words')
        .upsert(payloads, {
          onConflict: 'word_id',
        })
        .select(WORD_ACKNOWLEDGEMENT_COLUMNS)
      return {
        data: Array.isArray(result.data)
          ? (result.data as WordSyncAcknowledgement[])
          : null,
        error: result.error ? this.toSupabaseLikeError(result.error) : null,
      }
    } catch (upsertError) {
      if (!this.isMissingWordsRegisterColumnError(upsertError)) {
        throw upsertError
      }
      return {
        data: null,
        error: this.toSupabaseLikeError(upsertError),
      }
    }
  }

  private toSupabaseLikeError(error: unknown): SupabaseLikeError {
    if (error && typeof error === 'object') {
      return {
        code: (error as { code?: string }).code,
        message: this.getErrorMessage(error),
        details: (error as { details?: string }).details,
      }
    }

    return {
      message: this.getErrorMessage(error),
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
      const wordVersions = words
        .filter(word => Boolean(word.word_id))
        .map(word => ({
          word_id: word.word_id,
          updated_at: word.updated_at,
        }))
      if (wordVersions.length > 0) {
        await wordRepository.markWordsError(wordVersions)
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
      const missingWordLabels = missingCollectionWords
        .map(word => word.dutch_lemma)
        .join(', ')

      await wordRepository.markWordsError(
        missingCollectionWords
          .filter(word => Boolean(word.word_id))
          .map(word => ({
            word_id: word.word_id,
            updated_at: word.updated_at,
          }))
      )

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

    const { data, error } = await supabase
      .from('collections')
      .upsert(collectionsToSync)
      .select(COLLECTION_ACKNOWLEDGEMENT_COLUMNS)

    if (error) {
      throw new Error(`Failed to push collections: ${error.message}`)
    }

    const syncedIds = collections.map(c => c.collection_id)
    const acknowledgements = this.requireCollectionAcknowledgements(
      data,
      syncedIds
    )
    await collectionRepository.reconcilePushedCollections(
      acknowledgements,
      new Map(
        collections.map(collection => [
          collection.collection_id,
          collection.updated_at,
        ])
      )
    )
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

    const { data, error, count } = await supabase
      .from('collections')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to pull collections: ${error.message}`)
    }

    if (typeof count === 'number' && count === (data?.length ?? 0)) {
      await this.reconcileRemoteCollectionDeletes(userId, data ?? [])
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

  private async reconcileRemoteCollectionDeletes(
    userId: string,
    remoteCollections: { collection_id?: string | null }[]
  ): Promise<void> {
    const remoteIds = new Set(
      remoteCollections
        .map(collection => collection.collection_id)
        .filter((id): id is string => Boolean(id))
    )
    const localCollections =
      await collectionRepository.getCollectionsByUserId(userId)
    const deletedRemotely = localCollections.filter(
      collection =>
        collection.sync_status === 'synced' &&
        !remoteIds.has(collection.collection_id)
    )

    for (const collection of deletedRemotely) {
      await wordRepository.deleteWordsByCollection(
        collection.collection_id,
        userId
      )
      await collectionRepository.deleteCollection(collection.collection_id)
    }

    if (deletedRemotely.length > 0) {
      console.log(
        `[Sync] Removed ${deletedRemotely.length} collections deleted remotely`
      )
    }
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

    const { data, error } = await supabase
      .from('collections')
      .upsert(collectionsToSync)
      .select(COLLECTION_ACKNOWLEDGEMENT_COLUMNS)

    if (error) {
      throw new Error(`Failed to push collections: ${error.message}`)
    }

    const collectionIds = pendingCollections.map(c => c.collection_id)
    const acknowledgements = this.requireCollectionAcknowledgements(
      data,
      collectionIds
    )
    await collectionRepository.reconcilePushedCollections(
      acknowledgements,
      new Map(
        pendingCollections.map(collection => [
          collection.collection_id,
          collection.updated_at,
        ])
      )
    )

    console.log(
      `[Sync] Pushed ${pendingCollections.length} collections to Supabase`
    )

    return pendingCollections.length
  }
}

export const syncManager = new SyncManager()
