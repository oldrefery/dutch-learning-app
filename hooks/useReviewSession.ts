import { useAppStore } from '@/stores/useAppStore'

export interface UseReviewSessionReturn {
  reviewSession: any
  currentWord: any
  currentIndex: number
  sessionComplete: boolean
  reviewWords: any[]
  isLoading: boolean
}

export function useReviewSession(): UseReviewSessionReturn {
  const { reviewSession, currentWord, reviewLoading } = useAppStore()

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0
  const sessionComplete = currentIndex >= reviewWords.length
  const isLoading = reviewLoading

  return {
    reviewSession,
    currentWord,
    currentIndex,
    sessionComplete,
    reviewWords,
    isLoading,
  }
}
