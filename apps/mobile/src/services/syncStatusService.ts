import { collectionRepository } from '@/db/collectionRepository'
import { progressRepository } from '@/db/progressRepository'
import { wordRepository } from '@/db/wordRepository'
import { getLastSyncTimestamp, isNetworkAvailable } from '@/utils/network'

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
      getLastSyncTimestamp(),
      isNetworkAvailable(),
    ])

    const pendingWordCount = pendingWords.length
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
