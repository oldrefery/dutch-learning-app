import { useAppStore } from '@/stores/useAppStore'
import type { Word, ReviewSession } from '@/types/database'

export interface UseReviewSessionReturn {
  reviewSession: ReviewSession | null
  currentWord: Word | null
  currentIndex: number
  sessionComplete: boolean
  reviewWords: Word[]
  isLoading: boolean
  totalWords: number
  currentWordNumber: number
}

export function useReviewSession(): UseReviewSessionReturn {
  const { reviewSession, currentWord, reviewLoading } = useAppStore()

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0

  // Total words is just the original words length
  const totalWords = reviewWords.length

  // Calculate current position - simple approach
  const currentWordNumber = currentIndex + 1

  // Session is complete when all words are done OR no current word
  const sessionComplete = currentIndex >= reviewWords.length && !currentWord
  const isLoading = reviewLoading

  return {
    reviewSession,
    currentWord,
    currentIndex,
    sessionComplete,
    reviewWords,
    isLoading,
    totalWords,
    currentWordNumber,
  }
}
