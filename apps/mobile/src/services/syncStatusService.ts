import { collectionRepository } from '@/db/collectionRepository'
import { progressRepository } from '@/db/progressRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { dictionaryImportDeliveryRepository } from '@/db/dictionaryImportDeliveryRepository'
import { dictionaryImportRecoveryRepository } from '@/db/dictionaryImportRecoveryRepository'
import { dictionaryImportRepository } from '@/db/dictionaryImportRepository'
import { dictionaryPersonalRefreshRepository } from '@/db/dictionaryPersonalRefreshRepository'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'

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

export const syncStatusService = {
  async getSnapshot(userId: string): Promise<SyncStatusSnapshot> {
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
          dictionaryContentRepository.getMissingCardWordIds(userId),
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
  },
}
