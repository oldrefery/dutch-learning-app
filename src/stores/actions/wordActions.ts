import { wordService } from '@/lib/supabase'
import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
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
      const words = await wordService.getUserWords(userId)
      if (!words) {
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

      const updatedWordData = await wordService.updateWordProgress(
        wordId,
        assessment
      )

      // Validate response from service
      if (!updatedWordData || !updatedWordData.word_id) {
        Sentry.captureException(
          new Error('Invalid response from word service'),
          { tags: { operation: 'updateWordAfterReview' }, extra: { wordId } }
        )
      }

      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      } else {
        Sentry.captureException(
          new Error('Word not found in current words array'),
          { tags: { operation: 'updateWordAfterReview' }, extra: { wordId } }
        )
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
          Sentry.captureException(wordError, {
            tags: { operation: 'addWordsToCollection' },
            extra: {
              message: 'Error adding individual word',
              dutchLemma: wordData.dutch_lemma,
            },
          })
          // Continue with other words even if one fails
        }
      }

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
