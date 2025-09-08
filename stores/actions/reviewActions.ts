import { wordService } from '@/lib/supabase'
import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'
import { appStoreUtils } from '@/utils/appStoreUtils'

export const createReviewActions = (set: any, get: any) => ({
  startReviewSession: async () => {
    try {
      set({ reviewLoading: true })

      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const reviewWords = await wordService.getWordsForReview(userId)

      if (reviewWords.length === 0) {
        set({
          reviewSession: null,
          currentWord: null,
          reviewLoading: false,
        })
        return
      }

      const reviewSession = {
        words: reviewWords,
        currentIndex: 0,
        completedCount: 0,
        againQueue: [],
      }

      set({
        reviewSession,
        currentWord: reviewWords[0],
        reviewLoading: false,
      })
    } catch (error) {
      console.error('Error starting review session:', error)
      set({
        error: {
          message:
            APP_STORE_CONSTANTS.ERROR_MESSAGES.REVIEW_SESSION_START_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        reviewLoading: false,
      })
    }
  },

  submitReviewAssessment: async (assessment: any) => {
    try {
      const { reviewSession, currentWord } = get()
      if (!reviewSession || !currentWord) return

      // Update word in database and store
      await get().updateWordAfterReview(currentWord.word_id, assessment)

      // Move to next word
      const nextIndex = reviewSession.currentIndex + 1
      const nextWord = reviewSession.words[nextIndex] || null

      if (nextWord) {
        set({
          reviewSession: {
            ...reviewSession,
            currentIndex: nextIndex,
          },
          currentWord: nextWord,
        })
      } else {
        // Session complete
        set({
          reviewSession: null,
          currentWord: null,
        })
      }
    } catch (error) {
      console.error('Error submitting review assessment:', error)
      set({
        error: {
          message:
            APP_STORE_CONSTANTS.ERROR_MESSAGES.REVIEW_ASSESSMENT_SUBMIT_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  },

  endReviewSession: () => {
    set({
      reviewSession: null,
      currentWord: null,
    })
  },

  markCorrect: () => {
    get().submitReviewAssessment('good')
  },

  markIncorrect: () => {
    get().submitReviewAssessment('again')
  },

  flipCard: () => {
    // This would be handled by the UI component
    // The store doesn't need to track card flip state
  },
})
