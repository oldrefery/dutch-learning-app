import { collectionService, supabase } from '@/lib/supabase'
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

      const timestamp = new Date().toISOString()

      // Step 0: Pull collections from Supabase
      console.log('[Sync] Stage 1: pull collections')
      await this.pullCollectionsFromSupabase(userId)

      // Step 1: Pull new words from Supabase
      console.log('[Sync] Stage 2: pull words')
      const lastSync = await getLastSyncTimestamp()
      const pulledWords = await this.pullWordsFromSupabase(userId, lastSync)

      // Clean up local orphan words after pull
      await this.cleanupOrphanWords(userId)

      // Step 2: Push pending collection updates to Supabase (needed for FK on words)
      console.log('[Sync] Stage 3: push collections')
      await this.pushCollectionsToSupabase(userId)

      // Step 3: Push pending word updates to Supabase
      console.log('[Sync] Stage 4: push words')
      const pushedWordsCount = await this.pushWordsToSupabase(userId)

      // Step 4: Push pending progress to Supabase
      console.log('[Sync] Stage 5: push progress')
      const pushedProgressCount = await this.pushProgressToSupabase(userId)

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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Don't report network errors - they're expected when offline
      if (
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Network')
      ) {
        console.log(
          '[Sync] Network error during sync (expected when offline):',
          errorMessage
        )
      } else {
        console.error('[Sync] Error during sync:', error)
        Sentry.captureException(error, {
          tags: { module: 'syncManager' },
          extra: { userId },
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
      if (
        !errorMessage.includes('Network request failed') &&
        !errorMessage.includes('Network')
      ) {
        this.notifySyncStatus(result)
      }

      return result
    } finally {
      this.isSyncing = false
    }
  }

  private async pullWordsFromSupabase(
    userId: string,
    lastSync: string | null
  ): Promise<Word[]> {
    try {
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
    } catch (error) {
      console.error('[Sync] Error pulling words from Supabase:', error)
      throw error
    }
  }

  private async pushProgressToSupabase(userId: string): Promise<number> {
    try {
      const pendingProgress =
        await progressRepository.getPendingSyncProgress(userId)

      if (pendingProgress.length === 0) {
        console.log('[Sync] No pending progress to sync')
        return 0
      }

      // Convert local progress to Supabase format
      const progressToSync = pendingProgress.map(p => ({
        progress_id: p.progress_id,
        user_id: p.user_id,
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
    } catch (error) {
      console.error('[Sync] Error pushing progress to Supabase:', error)
      throw error
    }
  }

  private async pushWordsToSupabase(userId: string): Promise<number> {
    try {
      // Clean up invalid words before syncing
      const { count: deletedCount, words: deletedWords } =
        await wordRepository.deleteInvalidWords(userId)

      if (deletedCount > 0) {
        // Log each deleted word to history
        const historyStore = useHistoryStore.getState()
        deletedWords.forEach(word => {
          historyStore.addNotification(
            `Word "${word.dutch_lemma}" was not synced due to missing ID`,
            ToastType.WARNING
          )
        })

        // Show toast notification to inform user
        const wordList = deletedWords.map(w => w.dutch_lemma).join(', ')
        ToastService.show(
          `${deletedCount} invalid word${deletedCount > 1 ? 's' : ''} removed: ${wordList}. Please add again if needed.`,
          ToastType.WARNING
        )
      }

      const pendingWords = await wordRepository.getPendingSyncWords(userId)

      if (pendingWords.length === 0) {
        console.log('[Sync] No pending words to sync')
        return 0
      }

      // Filter out invalid words with null word_id (safety check)
      const validWords = pendingWords.filter(word => {
        if (!word.word_id) {
          console.error('[Sync] Skipping word with null word_id:', {
            dutch_lemma: word.dutch_lemma,
            user_id: word.user_id,
          })
          return false
        }
        return true
      })

      if (validWords.length === 0) {
        console.log('[Sync] No valid words to sync after filtering')
        return 0
      }

      if (validWords.length < pendingWords.length) {
        console.warn(
          `[Sync] Filtered out ${pendingWords.length - validWords.length} invalid words`
        )
      }

      const wordsWithCollections = await this.filterWordsWithCollections(
        userId,
        validWords
      )

      if (wordsWithCollections.length === 0) {
        console.log('[Sync] No valid words to sync after collection checks')
        return 0
      }

      // Ensure collections exist in Supabase for pending words
      await this.pushCollectionsForWords(userId, wordsWithCollections)

      // Convert local words to Supabase format
      // Note: updated_at is managed by Supabase, don't include it in upsert
      const wordsToSync = wordsWithCollections.map(word => ({
        word_id: word.word_id,
        user_id: word.user_id,
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
      }))

      const { error } = await supabase.from('words').upsert(wordsToSync)

      if (error) {
        throw new Error(`Failed to push words: ${error.message}`)
      }

      const wordIds = wordsWithCollections.map(w => w.word_id).filter(Boolean)
      await wordRepository.markWordsSynced(wordIds)

      console.log(
        `[Sync] Pushed ${wordsWithCollections.length} words to Supabase`
      )

      return wordsWithCollections.length
    } catch (error) {
      console.error('[Sync] Error pushing words to Supabase:', error)
      throw error
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
          ToastType.WARNING
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
          ToastType.WARNING
        )
      })

      ToastService.show(
        `Words skipped due to missing collection: ${missingWordLabels}`,
        ToastType.WARNING
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

    try {
      const collections = await collectionRepository.getCollectionsByIds(
        collectionIds,
        userId
      )

      if (collections.length === 0) return

      const collectionsToSync = collections.map(c => ({
        collection_id: c.collection_id,
        user_id: c.user_id,
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
    } catch (error) {
      console.error('[Sync] Error pushing collections for words:', error)
      throw error
    }
  }

  private async pullCollectionsFromSupabase(userId: string): Promise<any[]> {
    try {
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
    } catch (error) {
      console.error('[Sync] Error pulling collections from Supabase:', error)
      throw error
    }
  }

  private async cleanupOrphanWords(userId: string): Promise<void> {
    try {
      const { count } = await wordRepository.deleteOrphanWords(userId)
      if (count > 0) {
        console.log(`[Sync] Removed ${count} orphan words`)
        ToastService.show(
          `${count} orphan word${count > 1 ? 's' : ''} removed from local cache.`,
          ToastType.WARNING
        )
      }
    } catch (error) {
      console.error('[Sync] Error cleaning orphan words:', error)
    }
  }

  private async pushCollectionsToSupabase(userId: string): Promise<number> {
    try {
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
        await collectionService.deleteCollection(
          collection.collection_id,
          userId
        )
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
        user_id: c.user_id,
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
    } catch (error) {
      console.error('[Sync] Error pushing collections to Supabase:', error)
      throw error
    }
  }
}

export const syncManager = new SyncManager()
