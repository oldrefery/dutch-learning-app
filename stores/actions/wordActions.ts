import { wordService } from '@/lib/supabase'
import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'
import { appStoreUtils } from '@/utils/appStoreUtils'

export const createWordActions = (set: any, get: any) => ({
  fetchWords: async () => {
    try {
      set({ wordsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }
      const words = await wordService.getUserWords(userId)
      set({ words, wordsLoading: false })
    } catch (error) {
      console.error('Error fetching words:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        wordsLoading: false,
      })
    }
  },

  addNewWord: async (word: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error('User not authenticated')
      }

      // First analyze the word
      const analysis = await wordService.analyzeWord(word)

      console.log('Word analysis result:', analysis)

      // Check if analysis was successful
      if (!analysis || typeof analysis !== 'object') {
        throw new Error('Failed to analyze word - invalid response')
      }

      // Then add it to the database
      const newWord = await wordService.addWord(analysis, userId)
      const currentWords = get().words
      set({ words: [...currentWords, newWord] })
      return newWord
    } catch (error) {
      console.error('Error adding word:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORD_ADD_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      throw error
    }
  },

  updateWordAfterReview: async (wordId: string, assessment: any) => {
    try {
      // Update in database using the existing service
      await wordService.updateWordProgress(wordId, { quality: assessment })

      // Update word in local store without full refresh
      const currentWords = get().words
      const wordIndex = currentWords.findIndex((w: any) => w.word_id === wordId)

      if (wordIndex !== -1) {
        // Update the word locally with new review date
        const updatedWords = [...currentWords]
        const today = new Date()
        const nextReviewDate = new Date(today)
        nextReviewDate.setDate(today.getDate() + 1) // Add 1 day for next review

        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          last_reviewed_at: today.toISOString(),
          next_review_date: nextReviewDate.toISOString().split('T')[0],
          repetition_count: (updatedWords[wordIndex].repetition_count || 0) + 1,
        }
        set({ words: updatedWords })
      }
    } catch (error) {
      console.error('Error updating word after review:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORD_UPDATE_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      await wordService.deleteWord(wordId)
      const currentWords = get().words
      const filteredWords = currentWords.filter(
        (w: any) => w.word_id !== wordId
      )
      set({ words: filteredWords })
    } catch (error) {
      console.error('Error deleting word:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORD_DELETE_FAILED,
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  },
})
