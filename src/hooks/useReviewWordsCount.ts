import { useState, useCallback, useMemo } from 'react'
import { useApplicationStore } from '@/stores/useApplicationStore'

/**
 * Hook to get the count of words available for review
 * Updates automatically when the user changes or when the app becomes active
 */
export function useReviewWordsCount() {
  const words = useApplicationStore(state => state.words)
  const fetchWords = useApplicationStore(state => state.fetchWords)
  const wordsLoading = useApplicationStore(state => state.wordsLoading)

  const [refreshing, setRefreshing] = useState(false)

  const reviewWordsCount = useMemo(() => {
    const now = new Date()
    return words.filter(
      w => w && w.next_review_date && new Date(w.next_review_date) <= now
    ).length
  }, [words])

  const refreshCount = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchWords()
    } finally {
      setRefreshing(false)
    }
  }, [fetchWords])

  return {
    reviewWordsCount,
    isLoading: wordsLoading || refreshing,
    refreshCount,
  }
}
