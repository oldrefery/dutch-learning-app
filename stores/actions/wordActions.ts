import { wordService } from '@/lib/supabase'
import { APP_STORE_CONSTANTS } from '@/constants/AppStoreConstants'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
} from '@/types/AppStoreTypes'

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
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
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

      const normalizedWord = word.toLowerCase()

      // Check if word already exists before analysis
      const existingWord = await wordService.checkWordExists(
        userId,
        normalizedWord
      )
      if (existingWord) {
        ToastService.showInfo(
          ToastMessageType.WORD_ALREADY_EXISTS,
          `"${existingWord.dutch_lemma}" is already in your collection`
        )
        return null
      }

      // First analyze the word - convert to lowercase before analysis
      const analysis = await wordService.analyzeWord(normalizedWord)

      // Check if analysis was successful
      if (!analysis || typeof analysis !== 'object') {
        throw new Error('Failed to analyze word - invalid response')
      }

      // Double-check for duplicates after analysis (in case dutch_lemma differs from input)
      const finalExistingWord = await wordService.checkWordExists(
        userId,
        analysis.dutch_lemma
      )
      if (finalExistingWord) {
        ToastService.showInfo(
          ToastMessageType.WORD_ALREADY_EXISTS,
          `"${analysis.dutch_lemma}" is already in your collection`
        )
        return null
      }

      // Add collection_id to analysis if provided
      if (collectionId) {
        analysis.collection_id = collectionId
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
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  // Save already analyzed word (skip analysis step)
  saveAnalyzedWord: async (
    analyzedWord: AnalyzedWord,
    collectionId?: string
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Validate analyzed word object
      console.log(
        'saveAnalyzedWord received:',
        JSON.stringify(analyzedWord, null, 2)
      )

      if (!analyzedWord || typeof analyzedWord !== 'object') {
        throw new Error('Invalid analyzed word object')
      }

      console.log('dutch_lemma:', analyzedWord.dutch_lemma)
      console.log('part_of_speech:', analyzedWord.part_of_speech)

      if (!analyzedWord.dutch_lemma || !analyzedWord.part_of_speech) {
        throw new Error(
          `Analyzed word missing required fields. dutch_lemma: ${analyzedWord.dutch_lemma}, part_of_speech: ${analyzedWord.part_of_speech}`
        )
      }

      // Check if word already exists by dutch_lemma before adding
      const existingWord = await wordService.checkWordExists(
        userId,
        analyzedWord.dutch_lemma
      )
      if (existingWord) {
        ToastService.showInfo(
          ToastMessageType.WORD_ALREADY_EXISTS,
          `"${analyzedWord.dutch_lemma}" is already in your collection`
        )
        return null
      }

      // Add collection_id to analysis if provided
      if (collectionId) {
        analyzedWord.collection_id = collectionId
      }

      // Add to the database directly
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
      // Update in database using the existing service and get the updated data
      const updatedWordData = await wordService.updateWordProgress(wordId, {
        quality: assessment,
      })

      // Update word in local store with the actual data from database
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          last_reviewed_at: updatedWordData.last_reviewed_at,
          next_review_date: updatedWordData.next_review_date,
          repetition_count: updatedWordData.repetition_count,
          interval_days: updatedWordData.interval_days,
          easiness_factor: updatedWordData.easiness_factor,
        }
        set({ words: updatedWords })
      }
    } catch (error) {
      console.error('Error updating word after review:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORD_UPDATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      await wordService.deleteWord(wordId)
      const currentWords = get().words
      const filteredWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: filteredWords })
    } catch (error) {
      console.error('Error deleting word:', error)
      set({
        error: {
          message: APP_STORE_CONSTANTS.ERROR_MESSAGES.WORD_DELETE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  // Get duplicate words
  getDuplicateWords: async () => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      return await wordService.getDuplicateWords(userId)
    } catch (error) {
      console.error('Error getting duplicate words:', error)
      set({
        error: {
          message: 'Failed to get duplicate words',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },

  // Remove duplicate word
  removeDuplicateWord: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      await wordService.removeDuplicateWord(userId, wordId)

      // Remove from local state
      const currentWords = get().words
      const updatedWords = currentWords.filter(word => word.word_id !== wordId)
      set({ words: updatedWords })

      return true
    } catch (error) {
      console.error('Error removing duplicate word:', error)
      set({
        error: {
          message: 'Failed to remove duplicate word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      throw error
    }
  },
})
