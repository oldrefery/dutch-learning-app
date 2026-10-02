import { collectionRepository } from '@/db/collectionRepository'
import { progressRepository } from '@/db/progressRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
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
      lastSyncAt,
      isOnline,
    ] = await Promise.all([
      wordRepository.getWordsByUserId(userId),
      collectionRepository.getCollectionsByUserId(userId),
      progressRepository.getProgressByUserId(userId),
      wordRepository.getPendingSyncWords(userId),
      collectionRepository.getPendingSyncCollections(userId),
      progressRepository.getPendingSyncProgress(userId),
      getLastSyncTimestamp(userId),
      isNetworkAvailable(),
    ])

    const [commands, missingCardWordIds, imports, personalRefreshIds] =
      isDictionaryContentEnabled()
        ? await Promise.all([
            dictionaryContentRepository.getPendingCommands(userId),
            dictionaryContentRepository.getMissingCardWordIds(userId),
            dictionaryImportRepository.getPending(userId),
            dictionaryPersonalRefreshRepository.getWordIds(userId),
          ])
        : [[], [], [], []]
    const pendingWordCount = new Set([
      ...pendingWords.map(word => word.word_id),
      ...commands.map(row => row.command.word_id),
      ...imports.map(row => row.intent.word_id),
      ...personalRefreshIds,
      ...missingCardWordIds,
    ]).size
    const pendingCollectionCount = pendingCollections.length
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
