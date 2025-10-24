import { supabase } from '@/lib/supabase'
import { wordRepository } from '@/db/wordRepository'
import { progressRepository } from '@/db/progressRepository'
import {
  checkNetworkConnection,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from '@/utils/network'
import type { Word } from '@/types/database'
import { Sentry } from '@/lib/sentry'

export interface SyncResult {
  success: boolean
  wordsSynced: number
  progressSynced: number
  error?: string
  timestamp: string
}

class SyncManager {
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

      // Step 1: Pull new words from Supabase
      const lastSync = await getLastSyncTimestamp()
      const pulledWords = await this.pullWordsFromSupabase(userId, lastSync)

      // Step 2: Push pending progress to Supabase
      const pushedProgressCount = await this.pushProgressToSupabase(userId)

      // Step 3: Push pending word updates to Supabase
      const pushedWordsCount = await this.pushWordsToSupabase(userId)

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
      console.error('[Sync] Error during sync:', error)

      Sentry.captureException(error, {
        tags: { module: 'syncManager' },
        extra: { userId },
      })

      const result: SyncResult = {
        success: false,
        wordsSynced: 0,
        progressSynced: 0,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }

      this.notifySyncStatus(result)

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
        query = query.gt('updated_at', lastSync)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to pull words: ${error.message}`)
      }

      if (!data || data.length === 0) {
        console.log('[Sync] No new words to pull from Supabase')
        return []
      }

      // Parse JSON fields from Supabase
      const parsedWords = data.map(word => ({
        ...word,
        translations:
          typeof word.translations === 'string'
            ? JSON.parse(word.translations)
            : word.translations,
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
      }))

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

      console.log(
        `[Sync] Pushed ${pendingProgress.length} progress records to Supabase`
      )

      return pendingProgress.length
    } catch (error) {
      console.error('[Sync] Error pushing progress to Supabase:', error)
      throw error
    }
  }

  private async pushWordsToSupabase(userId: string): Promise<number> {
    try {
      const pendingWords = await wordRepository.getPendingSyncWords(userId)

      if (pendingWords.length === 0) {
        console.log('[Sync] No pending words to sync')
        return 0
      }

      // Convert local words to Supabase format
      const wordsToSync = pendingWords.map(word => ({
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
        updated_at: word.updated_at,
      }))

      const { error } = await supabase.from('words').upsert(wordsToSync)

      if (error) {
        throw new Error(`Failed to push words: ${error.message}`)
      }

      const wordIds = pendingWords.map(w => w.word_id)
      await wordRepository.markWordsSynced(wordIds)

      console.log(`[Sync] Pushed ${pendingWords.length} words to Supabase`)

      return pendingWords.length
    } catch (error) {
      console.error('[Sync] Error pushing words to Supabase:', error)
      throw error
    }
  }
}

export const syncManager = new SyncManager()
