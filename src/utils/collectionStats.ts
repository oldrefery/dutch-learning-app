import type { Word } from '@/types/database'

export interface CollectionStats {
  totalWords: number
  masteredWords: number
  wordsToReview: number
  progressPercentage: number
}

/**
 * Calculate statistics for a collection based on its words
 */
export function calculateCollectionStats(
  collectionWords: Word[]
): CollectionStats {
  const totalWords = collectionWords.length
  const masteredWords = collectionWords.filter(
    w => w && w.repetition_count && w.repetition_count > 2
  ).length
  const wordsToReview = collectionWords.filter(
    w => w && w.next_review_date && new Date(w.next_review_date) <= new Date()
  ).length
  const progressPercentage =
    totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0

  return {
    totalWords,
    masteredWords,
    wordsToReview,
    progressPercentage,
  }
}
