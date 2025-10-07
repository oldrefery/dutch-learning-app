import { useEffect } from 'react'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'

/**
 * Hook to get the count of words available for review
 * Uses the centralized store for instant updates after review assessments
 * Periodically syncs with the database for reliability
 */
export function useReviewWordsCount() {
  const reviewWordsCount = useApplicationStore(state => state.reviewWordsCount)
  const fetchReviewWordsCount = useApplicationStore(
    state => state.fetchReviewWordsCount
  )
  const currentUserId = useApplicationStore(state => state.currentUserId)

  // Initial fetch on mount or when a user changes
  useEffect(() => {
    if (currentUserId) {
      void fetchReviewWordsCount()
    }
  }, [currentUserId, fetchReviewWordsCount])

  // Periodic sync to ensure accuracy
  // This handles edge cases like words added on other devices or background changes
  useEffect(() => {
    if (!currentUserId) return

    const interval = setInterval(() => {
      void fetchReviewWordsCount()
    }, APPLICATION_STORE_CONSTANTS.SYNC_INTERVALS.REVIEW_WORDS_COUNT)

    return () => clearInterval(interval)
  }, [currentUserId, fetchReviewWordsCount])

  return {
    reviewWordsCount,
    isLoading: false, // Store handles loading state internally now
    refreshCount: fetchReviewWordsCount,
  }
}
