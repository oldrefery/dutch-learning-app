import { useState, useEffect, useCallback } from 'react'
import { wordService } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'

/**
 * Hook to get the count of words available for review
 * Updates automatically when user changes or when app becomes active
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
      console.error('Error fetching review words count:', error)
      setReviewWordsCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchReviewWordsCount()
  }, [fetchReviewWordsCount])

  // Refresh count when app becomes active (user might have added new words)
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
