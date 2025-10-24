import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { wordRepository } from '@/db/wordRepository'
import { isNetworkAvailable } from '@/utils/network'
import { calculateNextReview } from '@/utils/srs'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import type { GeminiWordAnalysis } from '@/types/database'

const USER_NOT_AUTHENTICATED_ERROR = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

export const createWordActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<
  ApplicationState,
  | 'fetchWords'
  | 'addNewWord'
  | 'saveAnalyzedWord'
  | 'updateWordAfterReview'
  | 'deleteWord'
  | 'updateWordImage'
  | 'moveWordToCollection'
  | 'resetWordProgress'
  | 'addWordsToCollection'
> => ({
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

      // Check if network is available
      const hasNetwork = await isNetworkAvailable()

      let words = null

      if (hasNetwork) {
        // Online: fetch from Supabase
        console.log('[Words] Network available, fetching from Supabase')
        words = await wordService.getUserWords(userId)
      } else {
        // Offline: fetch from local SQLite
        console.log('[Words] Network unavailable, fetching from local SQLite')
        words = await wordRepository.getWordsByUserId(userId)
      }

      if (!words || words.length === 0) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
            details: 'Failed to fetch words from service',
          },
          wordsLoading: false,
        })
        return
      }

      set({ words, wordsLoading: false })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchWords' },
        extra: { message: 'Error fetching words' },
      })
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
      Sentry.captureException(error, {
        tags: { operation: 'addNewWord' },
        extra: { word, collectionId, userId: get().currentUserId },
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
      Sentry.captureException(error, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: { message: 'Error saving analyzed word' },
      })

      // Check if it's a duplicate word error
      const isDuplicateError =
        error instanceof Error &&
        (error.message.includes('already exists in your vocabulary') ||
          error.message.includes(
            'duplicate key value violates unique constraint'
          ))

      // Only log to Sentry if it's not a user-facing duplicate error
      if (!isDuplicateError) {
        Sentry.captureException(error, {
          tags: { operation: 'saveAnalyzedWord' },
          extra: { analyzedWord, collectionId, userId: get().currentUserId },
        })
      }

      set({
        error: {
          message: isDuplicateError
            ? 'Word already exists'
            : 'Failed to save analyzed word',
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
      // Validate inputs
      if (!wordId) {
        Sentry.captureException(new Error('Invalid wordId provided'), {
          tags: { operation: 'updateWordAfterReview' },
          extra: { wordId },
        })
      }
      if (!assessment || !assessment.assessment) {
        Sentry.captureException(new Error('Invalid assessment provided'), {
          tags: { operation: 'updateWordAfterReview' },
          extra: { assessment },
        })
      }

      // Check network availability
      const hasNetwork = await isNetworkAvailable()
      const userId = get().currentUserId

      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Get the current word to calculate new SRS values
      const currentWords = get().words
      const currentWord = currentWords.find(w => w.word_id === wordId)

      if (!currentWord) {
        throw new Error(`Word with ID ${wordId} not found in local cache`)
      }

      // Calculate new SRS values
      const srsUpdate = calculateNextReview({
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        assessment: assessment.assessment,
      })

      let updatedWordData = {
        ...currentWord,
        ...srsUpdate,
        last_reviewed_at: new Date().toISOString(),
      }

      if (hasNetwork) {
        // Online: also update in Supabase for sync
        const supabaseResponse = await wordService.updateWordProgress(
          wordId,
          assessment
        )

        // Validate response from service
        if (supabaseResponse && supabaseResponse.word_id) {
          updatedWordData = supabaseResponse
        }
      } else {
        // Offline: update local SQLite only
        await wordRepository.updateWordProgress(wordId, userId, {
          interval_days: srsUpdate.interval_days,
          repetition_count: srsUpdate.repetition_count,
          easiness_factor: srsUpdate.easiness_factor,
          next_review_date: srsUpdate.next_review_date,
          last_reviewed_at: new Date().toISOString(),
        })
      }

      // Update local store
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)
      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
    } catch (error) {
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
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      await wordService.deleteWord(wordId)
      const currentWords = get().words
      const updatedWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: updatedWords })
    } catch (error) {
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

  moveWordToCollection: async (wordId: string, newCollectionId: string) => {
    try {
      const updatedWordData = await wordService.moveWordToCollection(
        wordId,
        newCollectionId
      )
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
      return updatedWordData
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'moveWordToCollection' },
        extra: { wordId, newCollectionId },
      })
      set({
        error: {
          message: 'Failed to move word to collection',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      return null
    }
  },

  resetWordProgress: async (wordId: string) => {
    try {
      const updatedWordData = await wordService.resetWordProgress(wordId)

      if (!updatedWordData) {
        set({
          error: {
            message: 'Failed to reset word progress',
            details: 'No data returned from service',
          },
        })
        return
      }

      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }

      return updatedWordData
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'resetWordProgress' },
        extra: { wordId },
      })
      set({
        error: {
          message: 'Failed to reset word progress',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
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

      // Use the SECURITY DEFINER function to import words
      // This allows read-only users to import words from shared collections
      const addedWords = await wordService.importWordsToCollection(
        collectionId,
        words
      )

      // Update the store with new words
      const currentWords = get().words
      set({ words: [...currentWords, ...addedWords] })

      return addedWords.length === words.length
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'addWordsToCollection' },
        extra: {
          collectionId,
          wordCount: words.length,
          userId: get().currentUserId,
        },
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
