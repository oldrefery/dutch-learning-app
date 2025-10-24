import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'
import { logInfo, logWarning, logError } from '@/utils/logger'
import { isNetworkAvailable } from '@/utils/network'
import type {
  StoreSetFunction,
  StoreGetFunction,
  ReviewAssessment,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'

const USER_NOT_AUTHENTICATED_ERROR = 'User not authenticated'
const INVALID_ASSESSMENT_ERROR = 'Invalid assessment object'

export const createReviewActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<
  ApplicationState,
  | 'startReviewSession'
  | 'submitReviewAssessment'
  | 'endReviewSession'
  | 'markCorrect'
  | 'markIncorrect'
  | 'flipCard'
  | 'goToNextWord'
  | 'goToPreviousWord'
  | 'deleteWordFromReview'
  | 'updateCurrentWordImage'
> => ({
  startReviewSession: async () => {
    try {
      set({ reviewLoading: true })

      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_ERROR,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          {},
          'review',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .REVIEW_SESSION_START_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
          reviewLoading: false,
        })
        return
      }

      // Check network availability and get review words accordingly
      const hasNetwork = await isNetworkAvailable()
      let reviewWords = null

      if (hasNetwork) {
        // Online: fetch from Supabase
        logInfo(
          'Network available, fetching review words from Supabase',
          {},
          'review'
        )
        reviewWords = await wordService.getWordsForReview(userId)
      } else {
        // Offline: filter from local words
        logInfo(
          'Network unavailable, filtering review words from local cache',
          {},
          'review'
        )
        const allWords = get().words
        const today = new Date().toISOString().split('T')[0]
        reviewWords = allWords.filter(
          w => w && w.next_review_date && w.next_review_date <= today
        )
      }

      if (!reviewWords) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .REVIEW_SESSION_START_FAILED,
            details: 'Failed to fetch review words from service',
          },
          reviewLoading: false,
        })
        return
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
      logError('Error starting review session', error, {}, 'review', false)
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
      if (!reviewSession || !currentWord) {
        logWarning('Missing session or word data', {}, 'review')
        return
      }

      // Validate assessment object
      if (!assessment || !assessment.assessment) {
        logError(
          INVALID_ASSESSMENT_ERROR,
          new Error(INVALID_ASSESSMENT_ERROR),
          { assessment },
          'review',
          false
        )
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                .REVIEW_ASSESSMENT_SUBMIT_FAILED,
            details: INVALID_ASSESSMENT_ERROR,
          },
        })
        return
      }

      // Classic SRS: All assessments update the word in the database
      await get().updateWordAfterReview(currentWord.word_id, assessment)

      // Get fresh state after database update to ensure consistency
      const freshState = get()
      const freshReviewSession = freshState.reviewSession

      if (!freshReviewSession) {
        logWarning('Review session was cleared during update', {}, 'review')
        return
      }

      // Move to the next word
      const nextIndex = freshReviewSession.currentIndex + 1
      const nextWord = freshReviewSession.words[nextIndex] || null

      if (nextWord && nextIndex < freshReviewSession.words.length) {
        // Validate the next word before setting
        if (!nextWord.word_id || !nextWord.dutch_lemma) {
          logError(
            'Invalid next word data',
            undefined,
            { nextWord },
            'review',
            false
          )
          set({
            error: {
              message:
                APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
                  .REVIEW_ASSESSMENT_SUBMIT_FAILED,
              details: 'Invalid word data in review session',
            },
          })
          return
        }

        // Continue with the next word
        logInfo('Moving to next word', { word: nextWord.dutch_lemma }, 'review')
        set({
          reviewSession: {
            ...freshReviewSession,
            currentIndex: nextIndex,
          },
          currentWord: nextWord,
        })
      } else {
        // Session complete
        logInfo('Session complete', {}, 'review')
        set({
          reviewSession: null,
          currentWord: null,
        })
      }
    } catch (error) {
      logError('Error submitting review assessment', error, {}, 'review', false)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES
              .REVIEW_ASSESSMENT_SUBMIT_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  endReviewSession: () => {
    set({
      reviewSession: null,
      currentWord: null,
    })
  },

  markCorrect: async () => {
    const state = get()
    if (state.currentWord) {
      await get().submitReviewAssessment({
        wordId: state.currentWord.word_id,
        assessment: SRS_ASSESSMENT.GOOD,
        timestamp: new Date(),
      })
    }
  },

  markIncorrect: async () => {
    const state = get()
    if (state.currentWord) {
      await get().submitReviewAssessment({
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
