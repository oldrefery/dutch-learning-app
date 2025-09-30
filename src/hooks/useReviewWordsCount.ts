import { useState, useEffect, useCallback } from 'react'
import { wordService } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry.ts'

/**
 * Hook to get the count of words available for review
 * Updates automatically when the user changes or when the app becomes active
 */
export function useReviewWordsCount() {
  const [reviewWordsCount, setReviewWordsCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)

  const currentUserId = useApplicationStore(state => state.currentUserId)

  const fetchReviewWordsCount = useCallback(async () => {
    if (!currentUserId) {
      setReviewWordsCount(0)
      return
    }

    setIsLoading(true)
    try {
      const reviewWords = await wordService.getWordsForReview(currentUserId)
      setReviewWordsCount(reviewWords.length)
    } catch (error) {
      setReviewWordsCount(0)
      Sentry.captureException(error, {
        tags: { operation: 'fetchReviewWordsCount' },
        extra: { currentUserId },
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchReviewWordsCount()
  }, [fetchReviewWordsCount])

  // Refresh count when the app becomes active (a user might have added new words)
  useEffect(() => {
    const interval = setInterval(fetchReviewWordsCount, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchReviewWordsCount])

  return {
    reviewWordsCount,
    isLoading,
    refreshCount: fetchReviewWordsCount,
  }
}
