import { collectionRepository } from '@/db/collectionRepository'
import { progressRepository } from '@/db/progressRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { dictionaryFollowingRepository } from '@/db/dictionaryFollowingRepository'
import { dictionaryImportDeliveryRepository } from '@/db/dictionaryImportDeliveryRepository'
import { dictionaryImportRecoveryRepository } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import { dictionaryPersonalRefreshRepository } from '@/db/dictionaryPersonalRefreshRepository'
import {
  isDictionaryContentEnabled,
  isDictionaryFollowingEnabled,
} from '@/constants/dictionaryContent'
import { retryWithBackoff } from '@/utils/retryUtils'

export interface SyncStatusSnapshot {
  totalLocalWords: number
  totalLocalCollections: number
  totalLocalProgress: number
  pendingWords: number
  pendingCollections: number
  pendingProgress: number
  totalPending: number
  lastSyncAt: string | null
  isOnline: boolean
}

async function readSnapshot(userId: string): Promise<SyncStatusSnapshot> {
  const [
    localWords,
    localCollections,
    localProgress,
    pendingWords,
    pendingCollections,
    pendingProgress,
    deletedWords,
    deletedCollections,
    lastSyncAt,
    isOnline,
  ] = await Promise.all([
    wordRepository.getWordsByUserId(userId),
    collectionRepository.getCollectionsByUserId(userId),
    progressRepository.getProgressByUserId(userId),
    wordRepository.getPendingSyncWords(userId),
    collectionRepository.getPendingSyncCollections(userId),
    progressRepository.getPendingSyncProgress(userId),
    wordRepository.getDeletedWords(userId),
    collectionRepository.getDeletedCollections(userId),
    getLastSyncTimestamp(userId),
    isNetworkAvailable(),
  ])

  const [
    commands,
    missingCardWordIds,
    imports,
    personalRefreshIds,
    recoveries,
    placementDebtIds,
  ] = isDictionaryContentEnabled()
    ? await Promise.all([
        dictionaryContentRepository.getPendingCommands(userId),
        isDictionaryFollowingEnabled()
          ? Promise.all([
              dictionaryFollowingRepository.getMissingCardWordIds(userId),
              dictionaryFollowingRepository.getLegacyRefreshWordIds(userId),
            ]).then(groups => groups.flat())
          : Promise.all([
              dictionaryContentRepository.getMissingCardWordIds(userId),
              dictionaryFollowingRepository.getPendingRefreshWordIds(userId),
            ]).then(groups => groups.flat()),
        dictionaryImportRepository.getPending(userId),
        dictionaryPersonalRefreshRepository.getWordIds(userId),
        dictionaryImportRecoveryRepository.getPending(userId),
        dictionaryImportDeliveryRepository.getDebtWordIds(userId),
      ])
    : [[], [], [], [], [], []]
  const pendingWordCount = new Set([
    ...pendingWords.map(word => word.word_id),
    ...deletedWords.map(word => word.word_id),
    ...commands.map(row => row.command.word_id),
    ...imports.map(row => row.intent.word_id),
    ...personalRefreshIds,
    ...recoveries.map(row => row.word_id),
    ...placementDebtIds,
    ...missingCardWordIds,
  ]).size
  const pendingCollectionCount = new Set([
    ...pendingCollections.map(collection => collection.collection_id),
    ...deletedCollections.map(collection => collection.collection_id),
  ]).size
  const pendingProgressCount = pendingProgress.length

  return {
    totalLocalWords: localWords.length,
    totalLocalCollections: localCollections.length,
    totalLocalProgress: localProgress.length,
    pendingWords: pendingWordCount,
    pendingCollections: pendingCollectionCount,
    pendingProgress: pendingProgressCount,
    totalPending:
      pendingWordCount + pendingCollectionCount + pendingProgressCount,
    lastSyncAt,
    isOnline,
  }
}

export const syncStatusService = {
  getSnapshot(userId: string): Promise<SyncStatusSnapshot> {
    // Status reads can overlap an exclusive sync transaction on another connection.
    // Retry the read only; persistent locks and all other failures still reach the UI.
    return retryWithBackoff(() => readSnapshot(userId), {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 400,
      shouldRetry: error =>
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string' &&
        /\bdatabase (?:table )?is locked\b/i.test(error.message),
    })
  },
}
