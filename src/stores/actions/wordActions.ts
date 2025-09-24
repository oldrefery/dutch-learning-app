import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
} from '@/types/ApplicationStoreTypes'
import type { GeminiWordAnalysis } from '@/types/database'

const USER_NOT_AUTHENTICATED_ERROR = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

export const createWordActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
) => ({
  fetchWords: async () => {
    try {
      set({ wordsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }
      const words = await wordService.getUserWords(userId)
      set({ words, wordsLoading: false })
    } catch (error) {
      console.error('Error fetching words:', error)
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
        wordsLoading: false,
      })
    }
  },

  addNewWord: async (word: string, collectionId?: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Analyze word first
      const analysis = await wordService.analyzeWord(word)
      if (collectionId) {
        analysis.collection_id = collectionId
      }

      // Add to the database
      const newWord = await wordService.addWord(analysis, userId)
      const currentWords = get().words
      set({ words: [...currentWords, newWord] })
      return newWord
    } catch (error) {
      console.error('Error adding word:', error)
      set({
        error: {
          message: APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORD_ADD_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  saveAnalyzedWord: async (
    analyzedWord: AnalyzedWord | GeminiWordAnalysis,
    collectionId?: string
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      if (collectionId) {
        analyzedWord.collection_id = collectionId
      }

      const newWord = await wordService.addWord(analyzedWord, userId)
      const currentWords = get().words
      set({ words: [...currentWords, newWord] })
      return newWord
    } catch (error) {
      console.error('Error saving analyzed word:', error)
      set({
        error: {
          message: 'Failed to save analyzed word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  updateWordAfterReview: async (
    wordId: string,
    assessment: ReviewAssessment
  ) => {
    try {
      const updatedWordData = await wordService.updateWordProgress(
        wordId,
        assessment
      )
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
    } catch (error) {
      console.error('Error updating word after review:', error)
      set({
        error: {
          message: 'Failed to update word progress',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      await wordService.deleteWord(wordId)
      const currentWords = get().words
      const updatedWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: updatedWords })
    } catch (error) {
      console.error('Error deleting word:', error)
      set({
        error: {
          message: 'Failed to delete word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  updateWordImage: async (wordId: string, imageUrl: string) => {
    try {
      const updatedWordData = await wordService.updateWordImage(
        wordId,
        imageUrl
      )
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
    } catch (error) {
      console.error('Error updating word image:', error)
      set({
        error: {
          message: 'Failed to update word image',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },
})
