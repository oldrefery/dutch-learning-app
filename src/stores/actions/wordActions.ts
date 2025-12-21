import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { wordService } from '@/lib/supabase'
import { logError, logInfo } from '@/utils/logger'
import { wordRepository } from '@/db/wordRepository'
import { calculateNextReview } from '@/utils/srs'
import * as Crypto from 'expo-crypto'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import type { GeminiWordAnalysis } from '@/types/database'

const USER_NOT_AUTHENTICATED_ERROR =
  APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
const USER_NOT_AUTHENTICATED_LOG = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

// Error messages for word operations
const WORD_SAVE_FAILED = 'Failed to save analyzed word'
const WORD_UPDATE_FAILED = 'Failed to update word progress'
const WORD_DELETE_FAILED = 'Failed to delete word'
const WORD_IMAGE_UPDATE_FAILED = 'Failed to update word image'
const WORD_MOVE_FAILED = 'Failed to move word to collection'
const WORD_RESET_FAILED = 'Failed to reset word progress'
const WORDS_IMPORT_FAILED = 'Failed to import words'

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

      // Offline-first: fetch from local SQLite
      const words = await wordRepository.getWordsByUserId(userId)

      // Empty word list is a valid state for new users
      set({ words: words || [], wordsLoading: false })
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

  addNewWord: async () => {
    // NOTE: This method is deprecated - word analysis should be done in the UI layer
    // and passed via saveAnalyzedWord instead
    logError(
      'addNewWord called',
      new Error(
        'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
      ),
      {},
      'words',
      false
    )
    throw new Error(
      'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
    )
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
            message: WORD_SAVE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      if (collectionId) {
        analyzedWord.collection_id = collectionId
      }

      // Offline-first: save to local SQLite
      // Generate word_id on a client for offline-first architecture
      const wordToAdd = {
        ...analyzedWord,
        word_id: Crypto.randomUUID(),
        user_id: userId,
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: new Date().toISOString().split('T')[0], // Store-only date: "2025-12-21"
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any

      await wordRepository.addWord(wordToAdd)

      // Return the saved word
      const currentWords = get().words
      set({ words: [...currentWords, wordToAdd] })
      return wordToAdd
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: { analyzedWord, collectionId, userId: get().currentUserId },
      })

      set({
        error: {
          message: WORD_SAVE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  updateWordAfterReview: async (
    wordId: string,
    assessment: ReviewAssessment
  ) => {
    try {
      // Validate inputs
      if (!wordId) {
        logError(
          'Invalid wordId provided to updateWordAfterReview',
          new Error('wordId is required'),
          { wordId },
          'words',
          false
        )
        set({
          error: {
            message: WORD_UPDATE_FAILED,
            details: 'Invalid word ID',
          },
        })
        return
      }
      if (!assessment || !assessment.assessment) {
        logError(
          'Invalid assessment provided to updateWordAfterReview',
          new Error('assessment is required'),
          { assessment },
          'words',
          false
        )
        set({
          error: {
            message: WORD_UPDATE_FAILED,
            details: 'Invalid assessment',
          },
        })
        return
      }

      const userId = get().currentUserId

      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, assessment },
          'words',
          false
        )
        set({
          error: {
            message: WORD_UPDATE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Get the current word to calculate new SRS values
      const currentWords = get().words
      const currentWord = currentWords.find(w => w.word_id === wordId)

      if (!currentWord) {
        logInfo(
          `Word with ID ${wordId} not found in local cache`,
          { wordId, wordsCount: currentWords.length },
          'words'
        )
        set({
          error: {
            message: WORD_UPDATE_FAILED,
            details: 'Word not found',
          },
        })
        return
      }

      // Calculate new SRS values
      const srsUpdate = calculateNextReview({
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        assessment: assessment.assessment,
      })

      const lastReviewedAt = new Date().toISOString()

      // Offline-first: always update local SQLite first
      await wordRepository.updateWordProgress(wordId, userId, {
        interval_days: srsUpdate.interval_days,
        repetition_count: srsUpdate.repetition_count,
        easiness_factor: srsUpdate.easiness_factor,
        next_review_date: srsUpdate.next_review_date,
        last_reviewed_at: lastReviewedAt,
      })

      // Update the local store with calculated values
      const updatedWordData = {
        ...currentWord,
        ...srsUpdate,
        last_reviewed_at: lastReviewedAt,
      }

      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)
      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
    } catch (error) {
      logError(
        'Error updating word after review',
        error,
        { wordId, assessment },
        'words',
        false
      )
      set({
        error: {
          message: WORD_UPDATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId },
          'words',
          false
        )
        set({
          error: {
            message: WORD_DELETE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Offline-first: delete it from local SQLite
      await wordRepository.deleteWord(wordId, userId)
      const currentWords = get().words
      const updatedWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: updatedWords })
    } catch (error) {
      logError('Error deleting word', error, { wordId }, 'words', false)
      set({
        error: {
          message: WORD_DELETE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  updateWordImage: async (wordId: string, imageUrl: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, imageUrl },
          'words',
          false
        )
        set({
          error: {
            message: WORD_IMAGE_UPDATE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Offline-first: update image in local SQLite
      await wordRepository.updateWordImage(wordId, userId, imageUrl)

      // Update local store
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
      }
    } catch (error) {
      logError(
        'Error updating word image',
        error,
        { wordId, imageUrl },
        'words',
        false
      )
      set({
        error: {
          message: WORD_IMAGE_UPDATE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  moveWordToCollection: async (wordId: string, newCollectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, newCollectionId },
          'words',
          false
        )
        set({
          error: {
            message: WORD_MOVE_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return null
      }

      // Offline-first: move word in local SQLite
      await wordRepository.moveWordToCollection(wordId, userId, newCollectionId)

      // Update local store
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          collection_id: newCollectionId,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
        return updatedWords[wordIndex]
      }
      return null
    } catch (error) {
      logError(
        'Error moving word to collection',
        error,
        { wordId, newCollectionId },
        'words',
        false
      )
      set({
        error: {
          message: WORD_MOVE_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      return null
    }
  },

  resetWordProgress: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId },
          'words',
          false
        )
        set({
          error: {
            message: WORD_RESET_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      // Offline-first: reset progress in local SQLite
      await wordRepository.resetWordProgress(wordId, userId)

      // Update the local store with reset values
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0] // Store-only date: "2025-12-22"
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
          next_review_date: tomorrow,
          last_reviewed_at: null,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
        return updatedWords[wordIndex]
      }
    } catch (error) {
      logError(
        'Error resetting word progress',
        error,
        { wordId },
        'words',
        false
      )
      set({
        error: {
          message: WORD_RESET_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  addWordsToCollection: async (
    collectionId: string,
    words: Partial<import('@/types/database').Word>[],
    isImportFromShared: boolean = false
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message: WORDS_IMPORT_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return false
      }

      // For imports from shared collections, use RPC to bypass RLS
      if (isImportFromShared) {
        try {
          // Use wordService to call RPC function with SECURITY DEFINER to bypass RLS
          const importedWords = await wordService.importWordsToCollection(
            collectionId,
            words
          )

          if (!importedWords || importedWords.length === 0) {
            logInfo('No words were imported', { collectionId })
            return true
          }

          const now = new Date().toISOString()
          // Ensure all imported words have word_id (should come from the server but fallback to generate)
          const wordsWithIds = importedWords.map((word: any) => ({
            ...word,
            word_id: word.word_id || Crypto.randomUUID(),
            created_at: word.created_at ?? now,
            updated_at: word.updated_at ?? now,
          }))

          await Promise.all(
            wordsWithIds.map((word: any) => wordRepository.addWord(word))
          )

          // Update store with imported words
          const currentWords = get().words
          set({ words: [...currentWords, ...wordsWithIds] })

          logInfo(
            `Successfully imported ${importedWords.length} words from shared collection`,
            { collectionId }
          )

          return true
        } catch (error) {
          logError(
            'Error importing words from shared collection',
            error,
            { collectionId, wordCount: words.length },
            'words',
            false
          )
          set({
            error: {
              message: WORDS_IMPORT_FAILED,
              details: error instanceof Error ? error.message : UNKNOWN_ERROR,
            },
          })
          return false
        }
      }

      // Offline-first: save all words to local SQLite for regular word creation
      // Generate word_id on a client for offline-first architecture
      const now = new Date().toISOString()
      const today = now.split('T')[0] // Extract date only: "2025-12-21"
      const wordsWithIds = words.map(word => ({
        ...word,
        word_id: word.word_id || Crypto.randomUUID(),
        user_id: userId,
        collection_id: collectionId,
        interval_days: word.interval_days ?? 1,
        repetition_count: word.repetition_count ?? 0,
        easiness_factor: word.easiness_factor ?? 2.5,
        next_review_date: word.next_review_date ?? today, // Store-only date
        created_at: word.created_at ?? now,
        updated_at: word.updated_at ?? now,
      }))

      await Promise.all(
        wordsWithIds.map(word => wordRepository.addWord(word as any))
      )

      // Update the store with new words (in offline-first, we just track the count)
      const currentWords = get().words
      const wordsToAdd = wordsWithIds as any

      set({ words: [...currentWords, ...wordsToAdd] })

      return true
    } catch (error) {
      logError(
        'Error adding words to collection',
        error,
        { collectionId, wordCount: words.length },
        'words',
        false
      )
      set({
        error: {
          message: WORDS_IMPORT_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      return false
    }
  },
})
