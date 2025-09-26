import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
  ReviewAssessment,
} from '@/types/ApplicationStoreTypes'

export const createReviewActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
) => ({
  startReviewSession: async () => {
    try {
      set({ reviewLoading: true })

      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const reviewWords = await wordService.getWordsForReview(userId)

      if (reviewWords.length > 0) {
        reviewWords.forEach(word => {
          console.log(
            `📝 мReview word: ${word.dutch_lemma}, next_review: ${word.next_review_date}`
          )
        })
      }

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
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
              .REVIEW_SESSION_START_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        reviewLoading: false,
      })
    }
  },

  submitReviewAssessment: async (assessment: ReviewAssessment) => {
    try {
      const { reviewSession, currentWord } = get()
      if (!reviewSession || !currentWord) return

      console.log(
        `💯 ${assessment.assessment.toUpperCase()} clicked for word:`,
        currentWord.dutch_lemma
      )

      // Classic SRS: All assessments update the word in the database
      await get().updateWordAfterReview(currentWord.word_id, assessment)
      console.log(
        `💾 Word ${currentWord.dutch_lemma} updated in database with assessment: ${assessment.assessment}`
      )

      // Move to the next word
      const nextIndex = reviewSession.currentIndex + 1
      const nextWord = reviewSession.words[nextIndex] || null

      if (nextWord && nextIndex < reviewSession.words.length) {
        // Continue with the next word
        console.log('➡️ Moving to next word:', nextWord.dutch_lemma)
        set({
          reviewSession: {
            ...reviewSession,
            currentIndex: nextIndex,
          },
          currentWord: nextWord,
        })
      } else {
        // Session complete
        console.log('🏁 Session complete')
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
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
              .REVIEW_ASSESSMENT_SUBMIT_FAILED,
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
    const state = get()
    if (state.currentWord) {
      get().submitReviewAssessment({
        wordId: state.currentWord.word_id,
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      })
    }
  },

  markIncorrect: () => {
    const state = get()
    if (state.currentWord) {
      get().submitReviewAssessment({
        wordId: state.currentWord.word_id,
        assessment: SRS_ASSESSMENT.AGAIN,
        timestamp: new Date(),
      })
    }
  },

  flipCard: () => {
    // This would be handled by the UI component
    // The store doesn't need to track card flip state
  },

  // Navigation functions for swipe gestures
  goToNextWord: () => {
    const { reviewSession, currentWord } = get()
    if (!reviewSession || !currentWord) return

    const nextIndex = reviewSession.currentIndex + 1
    const nextWord = reviewSession.words[nextIndex]

    // Only allow navigation to unassessed words within the session
    if (nextWord && nextIndex < reviewSession.words.length) {
      set({
        reviewSession: {
          ...reviewSession,
          currentIndex: nextIndex,
        },
        currentWord: nextWord,
      })
    }
  },

  goToPreviousWord: () => {
    const { reviewSession, currentWord } = get()
    if (!reviewSession || !currentWord) return

    const prevIndex = reviewSession.currentIndex - 1

    // Only allow navigation to previous words (not beyond the start)
    if (prevIndex >= 0) {
      const prevWord = reviewSession.words[prevIndex]
      set({
        reviewSession: {
          ...reviewSession,
          currentIndex: prevIndex,
        },
        currentWord: prevWord,
      })
    }
  },

  // Delete word from the current review session
  deleteWordFromReview: (wordId: string) => {
    const { reviewSession, currentWord } = get()
    if (!reviewSession || !currentWord) return

    // Remove the word from the review session words array
    const updatedWords = reviewSession.words.filter(
      word => word.word_id !== wordId
    )
    const currentIndex = reviewSession.currentIndex

    if (updatedWords.length === 0) {
      // No more words in the session, end the session
      set({
        reviewSession: null,
        currentWord: null,
      })
      return
    }

    // Adjust the current index if we deleted a word before the current position
    let newIndex = currentIndex
    if (currentIndex >= updatedWords.length) {
      // If the current index is beyond the new array length, go to the last word
      newIndex = updatedWords.length - 1
    } else if (currentWord.word_id === wordId) {
      // If we deleted the current word, stay at the same index (the next word will be shown)
      newIndex = Math.min(currentIndex, updatedWords.length - 1)
    }

    const nextWord = updatedWords[newIndex]

    set({
      reviewSession: {
        ...reviewSession,
        words: updatedWords,
        currentIndex: newIndex,
      },
      currentWord: nextWord,
    })
  },

  updateCurrentWordImage: (imageUrl: string) => {
    const { currentWord, reviewSession } = get()

    if (!currentWord || !reviewSession) return

    // Update current word
    const updatedCurrentWord = { ...currentWord, image_url: imageUrl }

    // Update word in the review session
    const updatedWords = reviewSession.words.map(word =>
      word.word_id === currentWord.word_id
        ? { ...word, image_url: imageUrl }
        : word
    )

    set({
      currentWord: updatedCurrentWord,
      reviewSession: {
        ...reviewSession,
        words: updatedWords,
      },
    })
  },
})
