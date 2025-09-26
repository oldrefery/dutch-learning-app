import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
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
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
          wordsLoading: false,
        })
        return
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
        set({
          error: {
            message: APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORD_ADD_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
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
      Sentry.captureException(error, {
        tags: { operation: 'addNewWord' },
        extra: { word, collectionId, userId },
      })
      set({
        error: {
          message: APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORD_ADD_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  saveAnalyzedWord: async (
    analyzedWord: AnalyzedWord | GeminiWordAnalysis,
    collectionId?: string
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message: 'Failed to save analyzed word',
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
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
      Sentry.captureException(error, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: { analyzedWord, collectionId, userId },
      })
      set({
        error: {
          message: 'Failed to save analyzed word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
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
      Sentry.captureException(error, {
        tags: { operation: 'updateWordAfterReview' },
        extra: { wordId, assessment },
      })
      set({
        error: {
          message: 'Failed to update word progress',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
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
      Sentry.captureException(error, {
        tags: { operation: 'deleteWord' },
        extra: { wordId },
      })
      set({
        error: {
          message: 'Failed to delete word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
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
      Sentry.captureException(error, {
        tags: { operation: 'updateWordImage' },
        extra: { wordId, imageUrl },
      })
      set({
        error: {
          message: 'Failed to update word image',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  addWordsToCollection: async (
    collectionId: string,
    words: Partial<import('@/types/database').Word>[]
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message: 'Failed to import words',
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return false
      }

      console.log('🔄 [addWordsToCollection] Starting batch import', {
        collectionId,
        wordCount: words.length,
        userId,
      })

      // Add word one by one (we don't have a batch insert method)
      const addedWords = []
      for (const wordData of words) {
        try {
          const wordToAdd = {
            ...wordData,
            collection_id: collectionId,
          }
          const newWord = await wordService.addWord(wordToAdd, userId)
          addedWords.push(newWord)
        } catch (wordError) {
          console.error(
            'Error adding individual word:',
            wordData.dutch_lemma,
            wordError
          )
          // Continue with other words even if one fails
        }
      }

      console.log('✅ [addWordsToCollection] Batch import completed', {
        requested: words.length,
        successful: addedWords.length,
      })

      // Update the store with new words
      const currentWords = get().words
      set({ words: [...currentWords, ...addedWords] })

      return addedWords.length === words.length
    } catch (error) {
      console.error('❌ [addWordsToCollection] Batch import failed:', error)
      Sentry.captureException(error, {
        tags: { operation: 'addWordsToCollection' },
        extra: { collectionId, wordCount: words.length, userId },
      })
      set({
        error: {
          message: 'Failed to import words',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
      return false
    }
  },
})
